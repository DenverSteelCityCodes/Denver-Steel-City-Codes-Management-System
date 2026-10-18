#!/usr/bin/env bash
# Seat-race test (spec 08): 20 parents try to take the last seats of one section at the same
# moment, each on its own database connection. The section row lock in
# registrations_before_insert() must give exactly CAPACITY seats and waitlist the rest.
#
#   DATABASE_URL=postgres://… test-plans/seat-race.sh          # psql (CI, local Supabase)
#   RUN_SQL="/path/to/runner" test-plans/seat-race.sh           # any command that runs a .sql file
#   RUNS=20 PARENTS=20 CAPACITY=5                               # defaults
#   RACE=seats | laptops | all (default)
#
# The laptop race (spec 29): LAPTOP_PARENTS families (default 2) whose campers hold seats in one
# week ask for a loaner at the same moment, each on its own connection, with LOANERS (default 1)
# left. The sessions row lock in request_laptop() must reserve exactly LOANERS and queue the rest.
#
# Uses existing parent accounts (it needs PARENTS of them) and cleans up after itself. Run it on
# a test or demo database, never production: it adds and removes a class while it runs (the
# laptop race also a "[TEST]" week in year 2099).
set -euo pipefail
RUNS=${RUNS:-20}; PARENTS=${PARENTS:-20}; CAPACITY=${CAPACITY:-5}; RACE=${RACE:-all}
LAPTOP_PARENTS=${LAPTOP_PARENTS:-2}; LOANERS=${LOANERS:-1}
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

# Any error from the runner counts: psql prints ERROR, an API runner may print an exception
# (e.g. a rate limit). A cleanup that fails is a failure too, so nothing is left behind silently.
bad() { echo "$1" | grep -qE "FAIL|ERROR|Exception"; }
cleanup() { local out; out=$($RUN_SQL "$TMP/cleanup.sql" 2>&1) || true; bad "$out" && { echo "cleanup failed: $out"; return 1; }; return 0; }
fail() { echo "$1"; cleanup || true; exit 1; }
if [ "$RACE" != laptops ]; then
for run in $(seq 1 "$RUNS"); do
  out=$($RUN_SQL "$TMP/setup.sql" 2>&1) || true
  bad "$out" && fail "run $run setup: $out"
  for i in $(seq 1 "$PARENTS"); do $RUN_SQL "$TMP/take_$i.sql" > "$TMP/out_$i" 2>&1 & done
  wait
  failed=$(grep -lE "ERROR|Exception" "$TMP"/out_* 2>/dev/null || true)
  [ -n "$failed" ] && fail "run $run: an insert failed: $(cat $failed | head -c 400)"
  out=$($RUN_SQL "$TMP/check.sql" 2>&1) || true
  bad "$out" && fail "run $run: $out"
  cleanup || exit 1
  echo "run $run: $CAPACITY seats, $((PARENTS - CAPACITY)) waitlisted — ok"
done
echo "SEAT RACE PASS ($RUNS runs)"
fi

[ "$RACE" = seats ] && exit 0

# ── The last loaner (spec 29) ─────────────────────────────────
cat > "$TMP/lsetup.sql" <<SQL
do \$\$
declare cls uuid; wk uuid; sec uuid; p record; i int := 0; st uuid; r uuid;
  today date := (now() at time zone 'America/Denver')::date;
begin
  drop table if exists private.laptop_race;
  create table private.laptop_race (n int primary key, parent_id uuid, registration_id uuid, session_id uuid);
  insert into sessions (name, year, start_date, end_date, is_active, laptop_loaners)
    values ('[TEST] Laptop Race', 2099, today + 30, today + 34, false, $LOANERS) returning id into wk;
  insert into classes (name) values ('[TEST] Laptop Race') returning id into cls;
  insert into sections (class_id, label, week, session_id, age_min, age_max, capacity)
    values (cls, 'RACE', 1, wk, 5, 17, $LAPTOP_PARENTS) returning id into sec;
  for p in select id from profiles where role = 'parent' order by id limit $LAPTOP_PARENTS loop
    i := i + 1;
    insert into students (parent_id, full_name, first_name, age, grade)
      values (p.id, 'Laptop Race ' || i, 'Race', 11, '6th') returning id into st;
    insert into registrations (student_id, section_id, status) values (st, sec, 'confirmed') returning id into r;
    insert into private.laptop_race values (i, p.id, r, wk);
  end loop;
  if i < $LAPTOP_PARENTS then raise exception 'LAPTOP RACE FAIL: only % parent accounts', i; end if;
end \$\$;
SQL

for i in $(seq 1 "$LAPTOP_PARENTS"); do
  cat > "$TMP/ask_$i.sql" <<SQL
do \$\$
declare p uuid; r uuid;
begin
  select parent_id, registration_id into p, r from private.laptop_race where n = $i;
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.request_laptop(r);
end \$\$;
SQL
done

cat > "$TMP/lcheck.sql" <<SQL
do \$\$
declare reserved int; queued int; total int;
begin
  select count(*) filter (where l.status = 'reserved'), count(*) filter (where l.status = 'queued'), count(*)
    into reserved, queued, total
    from laptop_loans l join private.laptop_race x on x.registration_id = l.registration_id;
  if reserved <> $LOANERS or queued <> $LAPTOP_PARENTS - $LOANERS or total <> $LAPTOP_PARENTS then
    raise exception 'LAPTOP RACE FAIL: % reserved, % queued, % rows (want $LOANERS / % / $LAPTOP_PARENTS)', reserved, queued, total, $LAPTOP_PARENTS - $LOANERS;
  end if;
end \$\$;
SQL

cat > "$TMP/lcleanup.sql" <<SQL
do \$\$
begin
  delete from laptop_loans where registration_id in (select registration_id from private.laptop_race);
  delete from notifications where payload->>'class' = '[TEST] Laptop Race';
  delete from registrations where id in (select registration_id from private.laptop_race);
  delete from students where full_name like 'Laptop Race %' and first_name = 'Race';
  delete from sections where class_id in (select id from classes where name = '[TEST] Laptop Race');
  delete from classes where name = '[TEST] Laptop Race';
  delete from sessions where name = '[TEST] Laptop Race' and year = 2099;
  drop table private.laptop_race;
end \$\$;
SQL

lcleanup() { local out; out=$($RUN_SQL "$TMP/lcleanup.sql" 2>&1) || true; bad "$out" && { echo "cleanup failed: $out"; return 1; }; return 0; }
lfail() { echo "$1"; lcleanup || true; exit 1; }
for run in $(seq 1 "$RUNS"); do
  out=$($RUN_SQL "$TMP/lsetup.sql" 2>&1) || true
  bad "$out" && lfail "laptop run $run setup: $out"
  rm -f "$TMP"/lout_*
  for i in $(seq 1 "$LAPTOP_PARENTS"); do $RUN_SQL "$TMP/ask_$i.sql" > "$TMP/lout_$i" 2>&1 & done
  wait
  failed=$(grep -lE "ERROR|Exception" "$TMP"/lout_* 2>/dev/null || true)
  [ -n "$failed" ] && lfail "laptop run $run: a request failed: $(cat $failed | head -c 400)"
  out=$($RUN_SQL "$TMP/lcheck.sql" 2>&1) || true
  bad "$out" && lfail "laptop run $run: $out"
  lcleanup || exit 1
  echo "laptop run $run: $LOANERS reserved, $((LAPTOP_PARENTS - LOANERS)) queued — ok"
done
echo "LAPTOP RACE PASS ($RUNS runs)"
