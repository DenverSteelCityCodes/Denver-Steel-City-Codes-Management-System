do $$
declare
  yr int := (select max(year) from sessions where is_active);
  p uuid[]; c uuid[] := '{}'; cls uuid; ra uuid; rb uuid; rd uuid; re uuid; i int; sid uuid;
begin
  select array_agg(id order by id) into p from (select id from profiles where role='parent' order by id limit 4) x;
  for i in 1..4 loop
    insert into students (parent_id, full_name, first_name, age, grade) values (p[i], 'Race '||i, 'Race', 11, '6th') returning id into sid;
    c := c || sid;
  end loop;
  insert into classes (name) values ('Swap Race') returning id into cls;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'RA', 2, 5, 17, 3) returning id into ra;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'RB', 2, 5, 17, 1) returning id into rb;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'RD', 2, 5, 17, 2) returning id into rd;
  insert into sections (class_id, label, week, age_min, age_max, capacity) values (cls, 'RE', 2, 5, 17, 2) returning id into re;
  insert into registrations (student_id, section_id, status, year) values (c[1], ra, 'confirmed', yr), (c[2], ra, 'confirmed', yr), (c[3], rd, 'confirmed', yr), (c[4], re, 'confirmed', yr);
  insert into season_settings (year, change_deadline_days) values (yr, 0) on conflict (year) do update set change_deadline_days = 0;
end $$;
select st.full_name, st.parent_id, r.id reg, s.label, (select id from sections where label='RB' and class_id=s.class_id) rb, (select id from sections where label='RD' and class_id=s.class_id) rd, (select id from sections where label='RE' and class_id=s.class_id) re
from registrations r join students st on st.id=r.student_id join sections s on s.id=r.section_id where st.full_name like 'Race %' order by 1;
