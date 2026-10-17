#!/usr/bin/env bash
# Seat-race test (spec 08): 20 parents try to take the last seats of one section at the same
# moment, each on its own database connection. The section row lock in
# registrations_before_insert() must give exactly CAPACITY seats and waitlist the rest.
#
#   DATABASE_URL=postgres://… test-plans/seat-race.sh          # psql (CI, local Supabase)
#   RUN_SQL="/path/to/runner" test-plans/seat-race.sh           # any command that runs a .sql file
#   RUNS=20 PARENTS=20 CAPACITY=5                               # defaults
#
# Uses existing parent accounts (it needs PARENTS of them) and cleans up after itself. Run it on
# a test or demo database, never production: it adds and removes a class while it runs.
set -euo pipefail
RUNS=${RUNS:-20}; PARENTS=${PARENTS:-20}; CAPACITY=${CAPACITY:-5}
RUN_SQL=${RUN_SQL:-"psql $DATABASE_URL -v ON_ERROR_STOP=1 -q -f"}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/setup.sql" <<SQL
do \$\$
declare cls uuid; sec uuid; p record; i int := 0; st uuid;
begin
  drop table if exists private.seat_race;
  create table private.seat_race (n int primary key, parent_id uuid, student_id uuid, section_id uuid);
  insert into classes (name) values ('Seat Race Test') returning id into cls;
  insert into sections (class_id, label, week, age_min, age_max, capacity)
    values (cls, 'RACE', 2, 5, 17, $CAPACITY) returning id into sec;
  for p in select id from profiles where role = 'parent' order by id limit $PARENTS loop
    i := i + 1;
    insert into students (parent_id, full_name, first_name, age, grade)
      values (p.id, 'Race Camper ' || i, 'Race', 11, '6th') returning id into st;
    insert into private.seat_race values (i, p.id, st, sec);
  end loop;
  if i < $PARENTS then raise exception 'SEAT RACE FAIL: only % parent accounts', i; end if;
end \$\$;
SQL

for i in $(seq 1 "$PARENTS"); do
  cat > "$TMP/take_$i.sql" <<SQL
do \$\$
declare p uuid; s uuid; sec uuid;
begin
  select parent_id, student_id, section_id into p, s, sec from private.seat_race where n = $i;
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into registrations (student_id, section_id) values (s, sec);
end \$\$;
SQL
done

cat > "$TMP/check.sql" <<SQL
do \$\$
declare held int; waiting int; total int;
begin
  select count(*) filter (where r.status in ('confirmed', 'pending', 'offered')),
         count(*) filter (where r.status = 'waitlisted'), count(*)
    into held, waiting, total
    from registrations r where r.section_id = (select section_id from private.seat_race limit 1);
  if held <> $CAPACITY or waiting <> $PARENTS - $CAPACITY or total <> $PARENTS then
    raise exception 'SEAT RACE FAIL: % held, % waitlisted, % rows (want $CAPACITY / % / $PARENTS)', held, waiting, total, $PARENTS - $CAPACITY;
  end if;
end \$\$;
SQL

cat > "$TMP/cleanup.sql" <<SQL
do \$\$
declare sec uuid := (select section_id from private.seat_race limit 1);
begin
  delete from registrations where section_id = sec;
  delete from students where id in (select student_id from private.seat_race);
  delete from sections where id = sec;
  delete from classes where name = 'Seat Race Test';
  delete from notifications where payload->>'class' = 'Seat Race Test';
  drop table private.seat_race;
end \$\$;
SQL

fail() { echo "$1"; $RUN_SQL "$TMP/cleanup.sql" >/dev/null 2>&1 || true; exit 1; }
for run in $(seq 1 "$RUNS"); do
  out=$($RUN_SQL "$TMP/setup.sql" 2>&1) || true
  echo "$out" | grep -q "FAIL\|ERROR" && fail "run $run setup: $out"
  for i in $(seq 1 "$PARENTS"); do $RUN_SQL "$TMP/take_$i.sql" > "$TMP/out_$i" 2>&1 & done
  wait
  bad=$(grep -l "ERROR" "$TMP"/out_* 2>/dev/null || true)
  [ -n "$bad" ] && fail "run $run: an insert failed: $(cat $bad | head -c 400)"
  out=$($RUN_SQL "$TMP/check.sql" 2>&1) || true
  echo "$out" | grep -q "FAIL\|ERROR" && fail "run $run: $out"
  $RUN_SQL "$TMP/cleanup.sql" >/dev/null 2>&1
  echo "run $run: $CAPACITY seats, $((PARENTS - CAPACITY)) waitlisted — ok"
done
echo "SEAT RACE PASS ($RUNS runs)"
