-- Migration: demo / test environment (applied to rdckxazvoeixgwtjhrlf via MCP on 2026-09-30)
--
-- private.reset_demo() wipes all camp data and reseeds a realistic summer: 5 courses across
-- Week 1/2, ~45 families / ~60 campers, ~20 volunteers with crews and duties, applications in
-- every state, interview slots relative to "now", and four one-click demo accounts.
-- It runs nightly (pg_cron) so public demo visitors can't break it for the next person.
--
-- Camp is always in session in the demo: Week 1 is the current Monday–Friday (Denver time; the
-- following week when reset on a weekend) and Week 2 the week after, so the "today" views —
-- roll calls, the parent "this week" card, the admin attendance board — have something to show.
-- Roll calls are seeded for the days of Week 1 already past plus this morning's arrival (two
-- sections left for the crew to take live), and a few updates are posted.
--
-- Not in git: demo account passwords and accounts to keep. Fill these per environment:
--   insert into private.demo_accounts (key, email, password) values ('admin', ..., ...), ...;
--   insert into private.demo_keep_users (id) values (...);   -- e.g. the owner's own logins
-- All seeded people are fictional; emails use the reserved example.com domain and phone numbers
-- the reserved 555-01xx range.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS private.demo_accounts (
  key      TEXT PRIMARY KEY CHECK (key IN ('admin', 'parent', 'volunteer', 'applicant')),
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS private.demo_keep_users (id UUID PRIMARY KEY);
REVOKE ALL ON private.demo_accounts, private.demo_keep_users FROM PUBLIC, anon, authenticated;

-- Create (or refresh) an email/password auth user with a stable id derived from the email.
-- handle_new_user() creates the profile from the metadata role (parent/volunteer).
-- An account that already has this email (e.g. a demo login first created through the normal
-- sign-up, with a random id) is refreshed in place: inserting a second row with the same email
-- would violate auth.users' email uniqueness and fail every nightly reset.
CREATE OR REPLACE FUNCTION private.demo_user(p_email TEXT, p_name TEXT, p_role TEXT, p_password TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth, extensions AS $$
DECLARE
  uid UUID := coalesce(
    (SELECT id FROM auth.users WHERE lower(email) = lower(p_email) ORDER BY created_at LIMIT 1),
    md5('scc-demo:' || lower(p_email))::uuid);
  pw  TEXT := crypt(coalesce(p_password, gen_random_uuid()::text), gen_salt('bf'));
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = uid) THEN
    UPDATE auth.users SET encrypted_password = pw, email = lower(p_email),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_build_object('display_name', p_name, 'role', p_role), updated_at = now()
    WHERE id = uid;
    UPDATE public.profiles SET display_name = p_name WHERE id = uid;
    RETURN uid;
  END IF;

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(p_email), pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_name, 'role', p_role), now() - interval '90 days', now(),
    '', '', '', '');

  INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (uid, uid::text, jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now());
  RETURN uid;
END;
$$;

CREATE OR REPLACE FUNCTION private.reset_demo()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth, extensions AS $$
DECLARE
  kid_first TEXT[] := ARRAY['Ava','Liam','Sofia','Mateo','Zoe','Ethan','Amara','Lucas','Priya','Noah','Isla','Diego',
    'Hana','Owen','Leila','Caleb','Mia','Jonah','Aaliyah','Theo','Nora','Kai','Elena','Ezra','Maya','Arjun','Chloe',
    'Dante','Freya','Malik','Ivy','Rohan','Lucia','Felix','Jada','Omar','Grace','Tariq','Wren','Santiago','Esme','Hugo',
    'Nia','Rafael','Talia','Bodhi','June','Mason','Yara','Kenji','Clara','Isaac','Imani','Leo','Saanvi','Miles','Lena',
    'Andre','Ruby','Samir'];
  last_names TEXT[] := ARRAY['Nguyen','Patel','Garcia','Johnson','Kim','Okafor','Martinez','Chen','Williams','Haddad',
    'Rivera','Thompson','Singh','Lopez','Brown','Yamamoto','Davis','Ali','Hernandez','Clarke','Moreno','Fischer',
    'Robinson','Kowalski','Begay','Ortiz','Shah','Bennett','Reyes','Novak','Mensah','Flores','Price','Ibrahim',
    'Castillo','Walsh','Tran','Cooper','Diaz','Larsen','Romero','Ahmed','Sullivan','Vargas','Park'];
  parent_first TEXT[] := ARRAY['Maria','David','Aisha','James','Mei','Carlos','Sarah','Kwame','Elena','Michael',
    'Fatima','Robert','Priya','Daniel','Laura','Hiroshi','Rachel','Hassan','Ana','Chris','Lucia','Tom','Nadia','Peter',
    'Rose','Javier','Anjali','Mark','Sofia','Ben','Grace','Luis','Hannah','Yusuf','Carmen','Sean','Linh','Paul',
    'Gabriela','Erik','Diana','Kareem','Molly','Rosa','Jin'];
  vol_names TEXT[] := ARRAY['Aiden Brooks','Bella Nguyen','Cameron Ortiz','Daniela Ruiz','Elijah Foster','Fiona Zhang',
    'Gabe Holloway','Harper Ito','Isaiah Grant','Jasmine Kaur','Kevin Osei','Lily Moreau','Marcus Bell','Nadia Rahman',
    'Oscar Lindqvist','Paige Morgan','Quinn Alvarez','Ravi Iyer','Sienna Cole','Tyler Washington'];
  hs TEXT[] := ARRAY['Cherry Creek High School','Grandview High School','Smoky Hill High School','Eaglecrest High School','Rock Canyon High School'];
  ms TEXT[] := ARRAY['Campus Middle School','West Middle School','Prairie Middle School','Thunder Ridge Middle School','Fox Ridge Middle School','Cottonwood Creek Elementary','Peakview Elementary'];
  grades TEXT[] := ARRAY['4th','5th','6th','7th','8th','9th'];
  allergy TEXT[] := ARRAY['Peanuts','Tree nuts','Dairy','Gluten','Shellfish','Bee stings — EpiPen in backpack'];
  medical TEXT[] := ARRAY['Asthma — inhaler in backpack','ADHD — does best with movement breaks','Type 1 diabetes — checks levels at lunch','Wears glasses; needs to sit near the front'];
  w1 UUID; w2 UUID;
  c_py UUID; c_java UUID; c_web UUID; c_micro UUID; c_ipy UUID;
  sec RECORD; s_id UUID;
  fam INT; kid INT := 0; nkids INT; k INT;
  parent_id UUID; student_id UUID; g TEXT; age INT; yr INT; ln TEXT; pf TEXT;
  wk INT; st registration_status; taken INT; cap INT;
  vol_ids UUID[] := '{}'; v UUID; i INT; d DATE; t RECORD;
  demo RECORD; demo_parent UUID; demo_vol UUID; demo_app UUID; demo_admin UUID;
  app_id UUID; slot_id UUID;
  today DATE := (now() AT TIME ZONE 'America/Denver')::date;
  -- Monday of the current week, or of next week when it's already the weekend.
  w1_start DATE := date_trunc('week', today)::date + CASE WHEN extract(isodow FROM today) >= 6 THEN 7 ELSE 0 END;
  w1_end DATE; w2_start DATE; w2_end DATE; camp_year INT;
  reg RECORD; rc TEXT; absent BOOLEAN; author UUID; risk_absent UUID;
BEGIN
  -- Refuse to run anywhere that hasn't been set up as a demo. This function deletes every
  -- camper, registration and login it wasn't told to keep, and it is scheduled nightly below;
  -- applied by mistake to a real camp database, both lists are empty and nothing is touched.
  IF NOT EXISTS (SELECT 1 FROM private.demo_accounts) OR NOT EXISTS (SELECT 1 FROM private.demo_keep_users) THEN
    RAISE EXCEPTION 'reset_demo() refused: fill private.demo_accounts and private.demo_keep_users first (see the header of migration_demo_environment.sql)';
  END IF;

  w1_end := w1_start + 4; w2_start := w1_start + 7; w2_end := w1_start + 11;
  camp_year := extract(year FROM w1_start)::int;
  -- ── 1. Wipe camp data (keeps duty types, demo accounts and owner logins) ──
  DELETE FROM roll_call_marks; DELETE FROM updates; DELETE FROM schedule_items;
  DELETE FROM change_requests;   -- specs 11 and 25 (crew_absences go with volunteers)
  -- Spec 29: laptop loans first (they hold registrations by a RESTRICT key).
  IF to_regclass('public.laptop_loans') IS NOT NULL THEN DELETE FROM laptop_loans; END IF;
  DELETE FROM attendance_logs; DELETE FROM registrations; DELETE FROM students;
  DELETE FROM duty_assignments; DELETE FROM duty_slots;
  DELETE FROM interview_bookings; DELETE FROM interview_slots; DELETE FROM volunteer_applications;
  DELETE FROM section_supports; DELETE FROM sections; DELETE FROM classes;
  DELETE FROM volunteers; DELETE FROM parent_profiles; DELETE FROM sessions;
  -- Spec 30: visitors' "notify me" addresses go with every reset (audit.log's copies of them are
  -- trimmed after 7 days, below).
  DELETE FROM interest_signups;
  -- Every account except the demo logins and the kept owner logins (also removes visitor sign-ups).
  DELETE FROM auth.users
  WHERE id NOT IN (SELECT id FROM private.demo_keep_users)
    AND lower(email) NOT IN (SELECT lower(email) FROM private.demo_accounts);

  UPDATE form_configs SET config = jsonb_build_object('enabled', true, 'fields', '{}'::jsonb), updated_at = now();
  INSERT INTO app_settings (key, value, updated_at) VALUES ('volunteer_applications_open', 'true', now())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
  -- The demo's one-click admin can't pass a TOTP step, so admin MFA (spec 27) is off here, and
  -- any authenticator a visitor set up on a demo login is removed.
  INSERT INTO app_settings (key, value, updated_at) VALUES ('admin_mfa_required', 'false', now())
    ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = now();
  DELETE FROM auth.mfa_factors;

  -- ── 2. Camp weeks and courses ──
  -- The place each week happens (spec 30): shown on /camp, the wizard and the volunteer apply page.
  INSERT INTO sessions (name, year, start_date, end_date, is_active, location) VALUES ('Week 1', camp_year, w1_start, w1_end, true, 'Cherry Creek High School') RETURNING id INTO w1;
  INSERT INTO sessions (name, year, start_date, end_date, is_active, location) VALUES ('Week 2', camp_year, w2_start, w2_end, true, 'Cherry Creek High School') RETURNING id INTO w2;

  -- The same daily schedule both weeks (parents and volunteers see it on their dashboards).
  INSERT INTO schedule_items (session_id, start_time, end_time, title, location)
  SELECT wk_id.id, item.start_time, item.end_time, item.title, item.location
  FROM (VALUES (w1), (w2)) wk_id(id)
  CROSS JOIN (VALUES
    (time '08:30', time '09:00', 'Drop-off', 'Front lobby'),
    (time '09:00', time '10:30', 'Morning session', 'Classrooms'),
    (time '10:30', time '10:45', 'Snack break', 'Courtyard'),
    (time '10:45', time '12:00', 'Morning session continues', 'Classrooms'),
    (time '12:00', time '12:45', 'Lunch', 'Cafeteria'),
    (time '12:45', time '14:30', 'Afternoon session', 'Classrooms'),
    (time '14:30', time '15:00', 'Show and tell', 'Classrooms'),
    (time '15:00', time '15:30', 'Pickup', 'Front lobby')) item(start_time, end_time, title, location);

  INSERT INTO classes (name, description) VALUES ('Intro to Python',
    'First steps in programming: variables, loops and functions, building small games and art with Python.') RETURNING id INTO c_py;
  INSERT INTO classes (name, description) VALUES ('Intro to Java',
    'Object-oriented programming fundamentals in Java. Recommended for campers who have tried some coding before.') RETURNING id INTO c_java;
  INSERT INTO classes (name, description) VALUES ('Web Development',
    'Build and publish a personal website with HTML, CSS and a little JavaScript.') RETURNING id INTO c_web;
  INSERT INTO classes (name, description) VALUES ('Intermediate Python',
    'Lists, dictionaries and files, then a bigger project of your own. For campers who know the Python basics.') RETURNING id INTO c_ipy;
  INSERT INTO classes (name, description) VALUES ('Microcontrollers',
    'Program real hardware — LEDs, sensors and buttons — with CircuitPython.') RETURNING id INTO c_micro;
  -- Course rules (spec 31): Microcontrollers is for grades 7–9 this fall, after Intermediate
  -- Python; a camper repeating a Python course is pointed at the next one.
  UPDATE classes SET grades_allowed = ARRAY['7th', '8th', '9th'], requires_class_id = c_ipy,
         requirement_note = 'Taking Intermediate Python in Week 1 counts.' WHERE id = c_micro;
  UPDATE classes SET next_class_id = c_ipy WHERE id = c_py;
  UPDATE classes SET next_class_id = c_micro WHERE id = c_ipy;

  INSERT INTO sections (class_id, label, age_min, age_max, capacity, week, session_id, start_time, end_time, room) VALUES
    (c_py,    'PY-A',              9, 10, 12, 1, w1, '09:00', '15:00', 'Room 101'),
    (c_py,    'PY-B',             11, 13, 16, 1, w1, '09:00', '15:00', 'Room 102'),
    (c_py,    'PY-A',              9, 10, 14, 2, w2, '09:00', '15:00', 'Room 101'),
    (c_py,    'PY-B',             11, 13, 16, 2, w2, '09:00', '15:00', 'Room 102'),
    (c_java,  'JAVA-1',           11, 14, 14, 1, w1, '09:00', '15:00', 'Room 201'),
    (c_java,  'JAVA-1',           11, 14, 14, 2, w2, '09:00', '15:00', 'Room 201'),
    (c_web,   'WEB-1',            10, 13, 18, 1, w1, '09:00', '15:00', 'Room 202'),
    (c_ipy,   'IP-1',             11, 14, 14, 1, w1, '09:00', '15:00', 'Room 103'),
    (c_ipy,   'IP-1',             11, 14, 14, 2, w2, '09:00', '15:00', 'Room 103'),
    (c_micro, 'MC-1',             12, 14, 10, 1, w1, '09:00', '15:00', 'Maker Lab'),
    (c_micro, 'MC-1',             12, 14, 10, 2, w2, '09:00', '15:00', 'Maker Lab');

  -- ── 3. Demo accounts ──
  FOR demo IN SELECT * FROM private.demo_accounts LOOP
    IF demo.key = 'admin' THEN
      demo_admin := private.demo_user(demo.email, 'Jordan Rivera', 'parent', demo.password);
      UPDATE profiles SET role = 'admin' WHERE id = demo_admin;
    ELSIF demo.key = 'parent' THEN
      demo_parent := private.demo_user(demo.email, 'Taylor Brooks', 'parent', demo.password);
      UPDATE profiles SET role = 'parent' WHERE id = demo_parent;
    ELSIF demo.key = 'volunteer' THEN
      demo_vol := private.demo_user(demo.email, 'Sam Okafor', 'volunteer', demo.password);
      UPDATE profiles SET role = 'volunteer' WHERE id = demo_vol;
    ELSIF demo.key = 'applicant' THEN
      demo_app := private.demo_user(demo.email, 'Riley Chen', 'volunteer', demo.password);
      UPDATE profiles SET role = 'volunteer' WHERE id = demo_app;
    END IF;
  END LOOP;

  -- ── 4. Volunteers (20 fixture + demo volunteer + any kept volunteer logins) ──
  FOR i IN 1..array_length(vol_names, 1) LOOP
    v := private.demo_user(lower(replace(vol_names[i], ' ', '.')) || '@example.com', vol_names[i], 'volunteer');
    vol_ids := vol_ids || v;
    INSERT INTO volunteers (id, experience_level, availability_week_1, availability_week_2)
    VALUES (v, CASE WHEN i <= 8 THEN 'senior' ELSE 'junior' END::experience_level,
            i % 5 <> 0, i % 4 <> 1);
    INSERT INTO volunteer_notes (volunteer_id, notes)
    VALUES (v, CASE WHEN i <= 8 THEN 'Returning volunteer, comfortable leading a room.' ELSE 'Great energy; pair with a senior lead.' END);
  END LOOP;
  IF demo_vol IS NOT NULL THEN
    INSERT INTO volunteers (id, experience_level, availability_week_1, availability_week_2)
    VALUES (demo_vol, 'senior', true, true);
    INSERT INTO volunteer_notes (volunteer_id, notes)
    VALUES (demo_vol, 'Taught Python at a library coding club; strong with younger campers.');
  END IF;
  INSERT INTO volunteers (id, experience_level, availability_week_1, availability_week_2)
  SELECT p.id, 'senior', true, true FROM profiles p JOIN private.demo_keep_users k ON k.id = p.id
  WHERE p.role = 'volunteer' ON CONFLICT (id) DO NOTHING;

  -- Accepted applications for every volunteer (interviewed in the spring).
  INSERT INTO volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size,
    availability_week_1, availability_week_2, why_volunteer, previous_scc_volunteer, cs_languages, skill_python,
    skill_java, skill_html, course_first_choice, course_second_choice, volunteer_signature, interview_confirmed,
    status, created_at)
  SELECT vo.id, split_part(p.display_name, ' ', 1), split_part(p.display_name, ' ', 2), u.email,
    '303-555-01' || lpad((row_number() OVER ())::text, 2, '0'), 16 + (row_number() OVER ())::int % 3,
    (ARRAY['10th','11th','12th'])[1 + (row_number() OVER ())::int % 3], hs[1 + (row_number() OVER ())::int % 5],
    (ARRAY['S','M','L'])[1 + (row_number() OVER ())::int % 3], vo.availability_week_1, vo.availability_week_2,
    'I learned to code at a camp like this and want to help younger kids get excited about it.',
    vo.experience_level = 'senior', ARRAY['Python','Java'], CASE WHEN vo.experience_level = 'senior' THEN 4 ELSE 3 END,
    3, 2, 'Intro to Python', 'Intro to Java', p.display_name, true, 'accepted', now() - interval '120 days'
  FROM volunteers vo JOIN profiles p ON p.id = vo.id JOIN auth.users u ON u.id = vo.id;

  -- Crews: one senior lead per section (never two sections in the same week), one or two juniors.
  -- Web (Week 1) is left without supports and Microcontrollers Week 2 without a lead, so the
  -- dashboard and auto-matcher have real work to show.
  FOR sec IN SELECT s.id, s.week, c.name, s.label FROM sections s JOIN classes c ON c.id = s.class_id ORDER BY s.week, c.name, s.label LOOP
    IF sec.name = 'Microcontrollers' AND sec.week = 2 THEN CONTINUE; END IF;
    UPDATE sections SET lead_id = (
      SELECT v2.id FROM volunteers v2
      WHERE v2.experience_level = 'senior'
        AND CASE WHEN sec.week = 1 THEN v2.availability_week_1 ELSE v2.availability_week_2 END
        AND NOT EXISTS (SELECT 1 FROM sections s2 WHERE s2.lead_id = v2.id AND s2.week = sec.week)
        -- the demo volunteer leads Python B and nothing else
        AND (v2.id IS DISTINCT FROM demo_vol OR (sec.name = 'Intro to Python' AND sec.label = 'PY-B'))
      -- fictional seniors before the owner's own account
      ORDER BY (v2.id = demo_vol AND sec.name = 'Intro to Python' AND sec.label = 'PY-B') DESC,
               (v2.id IN (SELECT id FROM private.demo_keep_users)), v2.created_at, v2.id LIMIT 1)
    WHERE id = sec.id;
    IF sec.name = 'Web Development' THEN CONTINUE; END IF;
    INSERT INTO section_supports (section_id, volunteer_id)
    SELECT sec.id, v2.id FROM volunteers v2
    WHERE v2.experience_level = 'junior'
      AND CASE WHEN sec.week = 1 THEN v2.availability_week_1 ELSE v2.availability_week_2 END
      AND NOT EXISTS (SELECT 1 FROM section_supports ss JOIN sections s3 ON s3.id = ss.section_id
                      WHERE ss.volunteer_id = v2.id AND s3.week = sec.week)
    ORDER BY v2.id LIMIT CASE WHEN sec.name = 'Intro to Python' THEN 2 ELSE 1 END;
  END LOOP;

  -- ── 5. Applicants still in the pipeline ──
  FOR i IN 1..6 LOOP
    IF i = 1 AND demo_app IS NOT NULL THEN
      v := demo_app;
    ELSE
      v := private.demo_user('applicant' || i || '@example.com', (ARRAY['Riley Chen','Avery Johnson','Mila Novak','Jalen Price','Sofia Haddad','Eli Grant'])[i], 'volunteer');
    END IF;
    INSERT INTO volunteer_applications (user_id, first_name, last_name, email, phone, age, grade, school, shirt_size,
      availability_week_1, availability_week_2, why_volunteer, previous_scc_volunteer, cs_languages, cs_classes,
      experience_children, skill_python, skill_java, skill_html, skill_css, skill_javascript, course_first_choice,
      course_second_choice, volunteer_signature, guardian_signature, interview_confirmed, status, admin_notes, created_at)
    SELECT v, split_part(p.display_name, ' ', 1), split_part(p.display_name, ' ', 2), u.email,
      '303-555-01' || (60 + i), 15 + i % 3, (ARRAY['10th','11th','12th'])[1 + i % 3], hs[1 + i % 5], 'M',
      true, i % 2 = 0,
      (ARRAY['I tutor my younger cousins in math and loved helping them build their first Scratch game.',
             'Our robotics club does outreach at middle schools and I want to do more of it.',
             'Coding changed what I want to study — I''d love to pass that on.',
             'I want teaching experience before studying computer science in college.',
             'My little sister went to Steel City Codes and still talks about it.',
             'I enjoy explaining things and want to help kids who are nervous about coding.'])[i],
      i = 3, ARRAY['Python','HTML','CSS'], 'AP Computer Science Principles',
      'Camp counselor last summer; babysit regularly.', 3, 2, 3, 3, 2, 'Intro to Python', 'Web Development',
      p.display_name, CASE WHEN 15 + i % 3 < 18 THEN 'Parent of ' || split_part(p.display_name, ' ', 1) END,
      false,
      CASE WHEN i = 6 THEN 'rejected' ELSE 'pending' END,
      CASE WHEN i = 6 THEN 'Not available either camp week.' END,
      now() - (i || ' days')::interval
    FROM profiles p JOIN auth.users u ON u.id = p.id WHERE p.id = v;
  END LOOP;

  -- Interview slots: two each weekday afternoon for the next two weeks (Denver time).
  FOR d IN SELECT gs::date FROM generate_series(current_date + 1, current_date + 14, interval '1 day') gs LOOP
    IF extract(isodow FROM d) < 6 THEN
      INSERT INTO interview_slots (slot_datetime, duration_minutes, notes)
      VALUES ((d + time '16:00') AT TIME ZONE 'America/Denver', 15, 'Google Meet'),
             ((d + time '16:30') AT TIME ZONE 'America/Denver', 15, 'Google Meet');
    END IF;
  END LOOP;
  -- Three pending applicants (including the demo applicant) already booked a time.
  FOR app_id IN SELECT a.id FROM volunteer_applications a WHERE a.status = 'pending'
                ORDER BY (a.user_id = demo_app) DESC NULLS LAST, a.created_at LIMIT 3 LOOP
    SELECT s.id INTO slot_id FROM interview_slots s
    WHERE NOT EXISTS (SELECT 1 FROM interview_bookings b WHERE b.slot_id = s.id)
    ORDER BY s.slot_datetime OFFSET 2 LIMIT 1;
    INSERT INTO interview_bookings (slot_id, application_id) VALUES (slot_id, app_id);
    UPDATE volunteer_applications SET interview_confirmed = true WHERE id = app_id;
  END LOOP;

  -- ── 5b. Onboarding, crew profiles and interview links (spec 35) ──
  -- The crew was accepted in the spring and finished the checklist, except two juniors who still
  -- haven't joined Remind or opened the shared folder (the admin's Overdue list). The demo volunteer
  -- was accepted last night: two items done, two still due. The crew have preferred names, a
  -- pronunciation where it helps and a short bio, so "Meet the teachers" has something to show.
  -- No photos: those are uploaded files. Each interview slot gets a fictional meeting link.
  IF to_regclass('public.volunteer_tasks') IS NOT NULL THEN
    DELETE FROM onboarding_tasks;   -- a visitor's edits go; volunteer_tasks went with volunteers
    INSERT INTO onboarding_tasks (key, label, help_url, due_hours_after_accept, sort_order, created_at) VALUES
      ('profile', 'Fill in your volunteer profile: your names, a short bio and, if you like, a photo', '/volunteer/profile', 24, 1, now() - interval '200 days'),
      ('discord', 'Join the crew Discord', 'https://discord.example.com/scc-denver-crew', 24, 2, now() - interval '200 days'),
      ('remind', 'Join the Remind class for camp-day texts', 'https://remind.example.com/join/sccden', 24, 3, now() - interval '200 days'),
      ('shared-folder', 'Open the shared volunteer folder and read the welcome doc', 'https://drive.example.com/scc-denver-volunteers', 48, 4, now() - interval '200 days');
    UPDATE volunteers SET accepted_at = CASE WHEN id = demo_vol THEN now() - interval '5 hours' ELSE now() - interval '113 days' END;
    INSERT INTO volunteer_tasks (volunteer_id, task_key, done_at, verified_by)
    SELECT vo.id, ot.key, vo.accepted_at + interval '3 hours', CASE WHEN ot.key <> 'profile' THEN demo_admin END
    FROM volunteers vo CROSS JOIN onboarding_tasks ot
    WHERE vo.id IS DISTINCT FROM demo_vol
      AND NOT (vo.id IN (vol_ids[14], vol_ids[17]) AND ot.key IN ('remind', 'shared-folder'));
    IF demo_vol IS NOT NULL THEN
      INSERT INTO volunteer_tasks (volunteer_id, task_key, done_at)
      VALUES (demo_vol, 'profile', now() - interval '4 hours'), (demo_vol, 'discord', now() - interval '4 hours');
    END IF;
    UPDATE volunteers vo SET
      legal_name = p.display_name,
      preferred_name = CASE p.display_name WHEN 'Daniela Ruiz' THEN 'Dani' WHEN 'Isaiah Grant' THEN 'Zay'
                         WHEN 'Elijah Foster' THEN 'Eli' ELSE split_part(p.display_name, ' ', 1) END,
      pronunciation = CASE p.display_name WHEN 'Ravi Iyer' THEN 'RAH-vee EYE-er' WHEN 'Nadia Rahman' THEN 'NAH-dee-uh rah-MAHN'
                        WHEN 'Sienna Cole' THEN 'see-EN-uh' WHEN 'Fiona Zhang' THEN 'fee-OH-nuh JAHNG'
                        WHEN 'Oscar Lindqvist' THEN 'LIND-kvist' WHEN 'Sam Okafor' THEN 'oh-KAH-for' END,
      bio = CASE WHEN vo.id = demo_vol
              THEN 'I taught Python at a library coding club and I''m happiest when a younger coder gets their first program to run. Ask me about turtle graphics.'
              ELSE (ARRAY[
                'I started with Scratch in fifth grade and now build small games in Python. Ask me about my pixel-art platformer.',
                'Robotics club captain. I like taking things apart to see how they work, and putting them back together (usually).',
                'I tutor middle schoolers in math and love the moment a bug finally makes sense.',
                'Second summer with Steel City Codes. Favorite language: JavaScript. Favorite snack: clementines.',
                'I make websites for my friends'' bands and I''m learning to draw with CSS.',
                'Future computer science major. I play cello and think music and code have a lot in common.',
                'I like puzzles, chess and figuring out why a program does what it does.',
                'Camp counselor last summer. Every kid can code, and I''m here to prove it.'])[1 + abs(hashtext(p.display_name)) % 8] END
    FROM profiles p
    WHERE p.id = vo.id AND (vo.id = ANY (vol_ids) OR vo.id = demo_vol);
    INSERT INTO interview_slot_links (slot_id, meeting_url)
    SELECT s.id, 'https://meet.example.com/scc-' || to_char(s.slot_datetime AT TIME ZONE 'America/Denver', 'MMDD-HH24MI')
    FROM interview_slots s;
  END IF;

  -- ── 6. Families and campers ──
  FOR fam IN 1..array_length(last_names, 1) LOOP
    ln := last_names[fam]; pf := parent_first[fam];
    parent_id := private.demo_user(lower(pf || '.' || ln) || '@example.com', pf || ' ' || ln, 'parent');
    INSERT INTO parent_profiles (id, email, phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
    VALUES (parent_id, lower(pf || '.' || ln) || '@example.com', '303-555-01' || lpad(fam::text, 2, '0'),
            (ARRAY['Grandma','Grandpa','Aunt','Uncle'])[1 + fam % 4] || ' ' || ln, '720-555-01' || lpad(fam::text, 2, '0'),
            (ARRAY['Grandparent','Grandparent','Aunt','Uncle'])[1 + fam % 4]);
    nkids := CASE WHEN fam % 7 = 0 THEN 3 WHEN fam % 3 = 0 THEN 2 ELSE 1 END;
    yr := CASE WHEN fam % 8 = 0 THEN camp_year - 1 ELSE camp_year END;   -- returning families who still need to confirm
    FOR k IN 1..nkids LOOP
      kid := kid + 1;
      g := grades[1 + (kid * 7) % 6];
      age := 9 + array_position(grades, g) - 1;
      INSERT INTO students (parent_id, first_name, last_name, full_name, age, grade, email, school_district, school_name,
        shirt_size, laptop_available, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relation, allergies, medical_conditions, medical_info, free_reduced_lunch, lunch_provision,
        how_heard, previous_program, candy_consent, waiver_signature, guardian_signature, waiver_signed_at, registration_year)
      VALUES (parent_id, kid_first[1 + (kid - 1) % 60], ln, kid_first[1 + (kid - 1) % 60] || ' ' || ln, age, g,
        lower(kid_first[1 + (kid - 1) % 60]) || '.' || lower(ln) || '@example.com',
        (ARRAY['Cherry Creek School District','Douglas County School District','Jefferson County Public Schools'])[1 + kid % 3],
        ms[1 + kid % 7], (ARRAY['XS','S','M','L'])[1 + kid % 4], kid % 6 <> 0, pf || ' ' || ln,
        '303-555-01' || lpad(fam::text, 2, '0'),
        (ARRAY['Grandma','Grandpa','Aunt','Uncle'])[1 + fam % 4] || ' ' || ln, '720-555-01' || lpad(fam::text, 2, '0'),
        (ARRAY['Grandparent','Grandparent','Aunt','Uncle'])[1 + fam % 4],
        CASE WHEN kid % 6 = 1 THEN allergy[1 + (kid / 6) % 6] ELSE 'None' END,
        CASE WHEN kid % 9 = 4 THEN medical[1 + (kid / 9) % 4] ELSE 'None' END,
        CASE WHEN kid % 9 = 4 THEN medical[1 + (kid / 9) % 4] END,
        kid % 5 = 0, kid % 10 = 0, (ARRAY['Friend or family','School announcement','Teacher/counselor','Social media','Returning camper'])[1 + kid % 5],
        yr < camp_year OR kid % 4 = 0, true, kid_first[1 + (kid - 1) % 60] || ' ' || ln, pf || ' ' || ln,
        now() - interval '30 days', yr)
      RETURNING id INTO student_id;

      CONTINUE WHEN yr < camp_year;   -- returning camper who hasn't confirmed for this summer yet
      -- Register into an eligible section of their week — the emptier one, with a little noise so
      -- it isn't perfectly even. A third of campers come both weeks.
      FOR wk IN SELECT unnest(CASE WHEN kid % 3 = 0 THEN ARRAY[1, 2] WHEN kid % 3 = 2 THEN ARRAY[2] ELSE ARRAY[1] END) LOOP
        SELECT s.id, s.capacity INTO s_id, cap FROM sections s JOIN classes c ON c.id = s.class_id
        WHERE s.week = wk AND age BETWEEN s.age_min AND s.age_max
          -- course rules (spec 31): the class's grades, and its prerequisite in an earlier week
          AND (c.grades_allowed IS NULL OR g = ANY (c.grades_allowed))
          AND (c.requires_class_id IS NULL OR private.prerequisite_met(student_id, c.requires_class_id, camp_year, wk))
        ORDER BY (SELECT count(*) FROM registrations r WHERE r.section_id = s.id)::numeric / s.capacity
                 + abs(hashtext(student_id::text || c.name) % 5) / 25.0
        LIMIT 1;
        CONTINUE WHEN s_id IS NULL;
        SELECT count(*) INTO taken FROM registrations WHERE section_id = s_id AND status IN ('confirmed','pending');
        st := CASE WHEN taken >= cap THEN 'waitlisted'
                   WHEN kid % 17 = 0 THEN 'cancelled'
                   ELSE 'confirmed' END;   -- no 'pending': registrations auto-confirm (spec 14)
        INSERT INTO registrations (student_id, section_id, status, created_at)
        VALUES (student_id, s_id, st, now() - ((60 - kid) || ' days')::interval);
      END LOOP;
    END LOOP;
  END LOOP;

  -- The demo parent: one camper set, one waitlisted, one returning camper to confirm.
  -- Popular sections fill up: Python A and Microcontrollers in Week 1 are full with a waitlist.
  -- (Week 1 Microcontrollers campers count as having taken Intermediate Python last summer: the
  -- demo has no past years, so this seed places them past the prerequisite, as an admin could.)
  FOR sec IN SELECT s.id, s.capacity, s.age_min, s.age_max, c.name, c.grades_allowed FROM sections s JOIN classes c ON c.id = s.class_id
             WHERE s.week = 1 AND ((c.name = 'Intro to Python' AND s.label = 'PY-A') OR c.name = 'Microcontrollers') LOOP
    FOR k IN 1..(sec.capacity + 3) LOOP
      SELECT count(*) INTO taken FROM registrations WHERE section_id = sec.id AND status IN ('confirmed','pending');
      SELECT count(*) INTO cap FROM registrations WHERE section_id = sec.id AND status = 'waitlisted';
      EXIT WHEN taken >= sec.capacity AND cap >= 2;
      SELECT st2.id INTO student_id FROM students st2
      WHERE st2.age BETWEEN sec.age_min AND sec.age_max AND st2.registration_year = camp_year
        AND (sec.grades_allowed IS NULL OR st2.grade = ANY (sec.grades_allowed))
        -- not already booked anywhere in Week 1 (a camper can't be in two rooms at once)
        AND NOT EXISTS (SELECT 1 FROM registrations r JOIN sections s4 ON s4.id = r.section_id
                        WHERE r.student_id = st2.id AND s4.week = 1 AND r.status <> 'cancelled')
        -- and no row in this section at all: a cancelled one would trip the unique key
        AND NOT EXISTS (SELECT 1 FROM registrations r5 WHERE r5.student_id = st2.id AND r5.section_id = sec.id)
      ORDER BY st2.id LIMIT 1;
      EXIT WHEN student_id IS NULL;
      INSERT INTO registrations (student_id, section_id, status)
      VALUES (student_id, sec.id, CASE WHEN taken >= sec.capacity THEN 'waitlisted' ELSE 'confirmed' END::registration_status);
    END LOOP;
    -- If there weren't enough eligible campers to fill it, size the room to its enrollment so
    -- "full with a waitlist" is true.
    UPDATE sections SET capacity = GREATEST(6, (SELECT count(*) FROM registrations r WHERE r.section_id = sec.id AND r.status IN ('confirmed','pending')))
    WHERE id = sec.id;
  END LOOP;

  IF demo_parent IS NOT NULL THEN
    INSERT INTO parent_profiles (id, email, phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
    SELECT demo_parent, email, '303-555-0199', 'Morgan Brooks', '720-555-0199', 'Aunt' FROM private.demo_accounts WHERE key = 'parent';
    INSERT INTO students (parent_id, first_name, last_name, full_name, age, grade, school_district, school_name, shirt_size,
      laptop_available, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      allergies, medical_conditions, how_heard, previous_program, candy_consent, waiver_signature, guardian_signature,
      waiver_signed_at, registration_year)
    VALUES
      (demo_parent, 'Maya', 'Brooks', 'Maya Brooks', 12, '7th', 'Cherry Creek School District', 'Campus Middle School', 'M',
       true, 'Taylor Brooks', '303-555-0199', 'Morgan Brooks', '720-555-0199', 'Aunt', 'Peanuts', 'None', 'Friend or family',
       false, true, 'Maya Brooks', 'Taylor Brooks', now() - interval '20 days', camp_year),
      (demo_parent, 'Eli', 'Brooks', 'Eli Brooks', 9, '4th', 'Cherry Creek School District', 'Cottonwood Creek Elementary', 'S',
       false, 'Taylor Brooks', '303-555-0199', 'Morgan Brooks', '720-555-0199', 'Aunt', 'None', 'None', 'Friend or family',
       false, true, 'Eli Brooks', 'Taylor Brooks', now() - interval '20 days', camp_year),
      (demo_parent, 'Noor', 'Brooks', 'Noor Brooks', 13, '8th', 'Cherry Creek School District', 'Campus Middle School', 'L',
       true, 'Taylor Brooks', '303-555-0199', 'Morgan Brooks', '720-555-0199', 'Aunt', 'None',
       'Asthma — inhaler in backpack', 'Returning camper', true, true, 'Noor Brooks', 'Taylor Brooks', now() - interval '380 days', camp_year - 1);
    INSERT INTO registrations (student_id, section_id, status)
    SELECT st2.id, s.id, 'confirmed' FROM students st2, sections s JOIN classes c ON c.id = s.class_id
    WHERE st2.parent_id = demo_parent AND st2.first_name = 'Maya' AND c.name = 'Web Development';
    INSERT INTO registrations (student_id, section_id, status)
    SELECT st2.id, s.id, 'waitlisted' FROM students st2, sections s JOIN classes c ON c.id = s.class_id
    WHERE st2.parent_id = demo_parent AND st2.first_name = 'Eli' AND c.name = 'Intro to Python' AND s.label = 'PY-A' AND s.week = 1;
  END IF;

  -- Course rules (spec 31). "Prerequisite at risk" on the admin's list: a Week 2 Microcontrollers
  -- camper whose Week 1 Intermediate Python spot was then cancelled, and one who missed every
  -- Week 1 arrival roll call so far (marked in step 8). "Place with": a few families asked for a
  -- sibling or a friend (the demo parent's Maya among them).
  FOR reg IN SELECT r.id, r.student_id, row_number() OVER (ORDER BY st2.full_name) AS n FROM registrations r
               JOIN sections s ON s.id = r.section_id JOIN students st2 ON st2.id = r.student_id
              WHERE s.class_id = c_ipy AND s.week = 1 AND r.status = 'confirmed' AND st2.grade IN ('7th', '8th', '9th')
                AND NOT EXISTS (SELECT 1 FROM registrations r2 JOIN sections s2 ON s2.id = r2.section_id
                                 WHERE r2.student_id = r.student_id AND s2.week = 2)
              ORDER BY st2.full_name LIMIT 2 LOOP
    INSERT INTO registrations (student_id, section_id, status, created_at)
    SELECT reg.student_id, s.id, 'confirmed', now() - interval '20 days' FROM sections s WHERE s.class_id = c_micro AND s.week = 2;
    IF reg.n = 1 THEN
      UPDATE registrations SET status = 'cancelled', cancel_reason = 'parent_cancel' WHERE id = reg.id;
    ELSE
      risk_absent := reg.student_id;
    END IF;
  END LOOP;
  UPDATE registrations r SET place_with = 'Same class as ' || sib.first_name || ', please'
    FROM students st2, students sib
   WHERE st2.id = r.student_id AND sib.parent_id = st2.parent_id AND sib.id <> st2.id
     AND st2.parent_id IS DISTINCT FROM demo_parent
     AND r.status = 'confirmed' AND abs(hashtext(r.id::text)) % 4 = 0;
  UPDATE registrations r SET place_with = 'Same room as her friend Ava Nguyen, please'
    FROM students st2 WHERE st2.id = r.student_id AND st2.parent_id = demo_parent AND st2.first_name = 'Maya';
  -- An exception request waiting in the admins' queue: a 6th grader asking for Microcontrollers.
  INSERT INTO change_requests (student_id, section_id, requested_by, kind, message, created_at)
  SELECT st2.id, s.id, st2.parent_id, 'exception',
         'They finished the Python unit at school this spring and build with a Raspberry Pi at home.', now() - interval '2 days'
    FROM students st2, sections s
   WHERE s.class_id = c_micro AND s.week = 2 AND st2.grade = '6th' AND st2.registration_year = camp_year
     AND st2.parent_id IS DISTINCT FROM demo_parent
   ORDER BY st2.full_name LIMIT 1;

  -- ── 7. Duty schedule: four duties each camp day; volunteers have claimed most spots ──
  FOR d IN SELECT gs::date FROM generate_series(w1_start, w2_end, interval '1 day') gs LOOP
    CONTINUE WHEN extract(isodow FROM d) > 5;
    FOR t IN SELECT id, name FROM duty_types ORDER BY name LOOP
      INSERT INTO duty_slots (duty_type_id, session_id, slot_date, capacity)
      VALUES (t.id, CASE WHEN d <= w1_end THEN w1 ELSE w2 END, d, 2)
      RETURNING id INTO slot_id;
      INSERT INTO duty_assignments (duty_slot_id, volunteer_id)
      SELECT slot_id, vo.id FROM volunteers vo
      WHERE CASE WHEN d <= w1_end THEN vo.availability_week_1 ELSE vo.availability_week_2 END
        AND vo.id IS DISTINCT FROM demo_vol
      ORDER BY hashtext(vo.id::text || d::text || t.name) LIMIT (hashtext(d::text || t.name) & 1) + 1;
    END LOOP;
  END LOOP;
  -- The demo volunteer has signed up for a couple of duties and has open ones to try.
  INSERT INTO duty_assignments (duty_slot_id, volunteer_id)
  SELECT ds.id, demo_vol FROM duty_slots ds JOIN duty_types dt ON dt.id = ds.duty_type_id
  WHERE demo_vol IS NOT NULL AND dt.name = 'Morning Check-In' AND ds.slot_date IN (w1_start, w1_start + 2)
    AND (SELECT count(*) FROM duty_assignments da WHERE da.duty_slot_id = ds.id) < ds.capacity;

  -- ── 8. Camp in session: roll calls for Week 1 so far ──
  -- Every past camp day of Week 1 has all three roll calls; today has the arrival roll call for
  -- every Week 1 section except Python B (the demo volunteer's room) and Microcontrollers, which
  -- the crew takes live. A few campers are marked absent so the admin board isn't empty.
  FOR d IN SELECT gs::date FROM generate_series(w1_start, LEAST(today, w1_end), interval '1 day') gs LOOP
    FOR reg IN SELECT r.student_id, r.section_id, s.lead_id, s.label, c.name
               FROM registrations r JOIN sections s ON s.id = r.section_id JOIN classes c ON c.id = s.class_id
               WHERE s.week = 1 AND r.status IN ('confirmed', 'pending') LOOP
      FOREACH rc IN ARRAY ARRAY['arrival', 'after_lunch', 'dismissal'] LOOP
        IF d = today THEN
          EXIT WHEN rc <> 'arrival';
          CONTINUE WHEN reg.label = 'PY-B' OR reg.name = 'Microcontrollers';
        END IF;
        -- about one camper in twenty misses a day; two Python A campers are missing this morning
        absent := (hashtext(reg.student_id::text || d::text) % 20 = 0)
               OR (d = today AND reg.label = 'PY-A' AND hashtext(reg.student_id::text) % 5 = 0);
        INSERT INTO roll_call_marks (section_id, student_id, day, roll_call, present, marked_by, marked_at)
        VALUES (reg.section_id, reg.student_id, d, rc, NOT absent, reg.lead_id,
                (d + CASE rc WHEN 'arrival' THEN time '09:05' WHEN 'after_lunch' THEN time '12:50' ELSE time '14:55' END) AT TIME ZONE 'America/Denver');
      END LOOP;
    END LOOP;
  END LOOP;

  -- The "prerequisite at risk" camper from step 6 has missed Intermediate Python all week so far.
  UPDATE roll_call_marks m SET present = false
    FROM sections s WHERE s.id = m.section_id AND s.class_id = c_ipy AND m.student_id = risk_absent;

  -- ── 9. Updates: a welcome from the admin, a note to the crew, and a lead's end-of-day post ──
  author := coalesce(demo_admin, (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1));
  IF author IS NOT NULL THEN
    INSERT INTO updates (author_id, author_name, audience, body, created_at) VALUES
      (author, '', 'everyone', 'Welcome to Week 1! Drop-off is 8:30–9:00 in the front lobby and pickup starts at 3:00. Please send a water bottle and a labelled laptop charger each day.',
       (w1_start - 2 + time '17:00') AT TIME ZONE 'America/Denver'),
      (author, '', 'volunteers', 'Crew huddle at 8:15 each morning by the check-in table. Roll calls happen at arrival, after lunch and at dismissal — take them on your phone from the dashboard.',
       (w1_start - 1 + time '19:30') AT TIME ZONE 'America/Denver'),
      (author, '', 'parents', 'Reminder: Friday is show-and-tell at 2:30. Families are welcome to come early and see what the campers built this week.',
       (w1_start + time '12:15') AT TIME ZONE 'America/Denver');
  END IF;
  INSERT INTO updates (author_id, author_name, audience, section_id, body, created_at)
  SELECT s.lead_id, '', 'section', s.id,
    'Great first day in Web Dev! Everyone built their first page with a heading, a photo and a link. Tomorrow we add colour with CSS — no homework, just bring your ideas.',
    (w1_start + time '15:20') AT TIME ZONE 'America/Denver'
  FROM sections s JOIN classes c ON c.id = s.class_id
  WHERE c.name = 'Web Development' AND s.week = 1 AND s.lead_id IS NOT NULL;
  -- The insert trigger stamps author_name from profiles; this re-stamp keeps the seed explicit.
  UPDATE updates u SET author_name = p.display_name FROM profiles p WHERE p.id = u.author_id;

  -- ── 10. Laptop loans (spec 29) ──
  -- Campers without a laptop of their own borrowed one, in registration order, and so did two in
  -- Python B, the demo volunteer's room. Week 1 lends 6, so it has a short queue; on a camp day
  -- the loaners are handed out, except in Python B, whose crew hands them out live. Week 2 has a loaner free, and the demo parent's Maya
  -- holds a Week 2 spot with no laptop yet, so a visitor can request one and release it.
  IF to_regclass('public.laptop_loans') IS NOT NULL THEN
    IF demo_parent IS NOT NULL THEN
      INSERT INTO registrations (student_id, section_id, status)
      SELECT st2.id, s.id, 'confirmed' FROM students st2, sections s JOIN classes c ON c.id = s.class_id
      WHERE st2.parent_id = demo_parent AND st2.first_name = 'Maya' AND c.name = 'Intro to Java' AND s.week = 2;
    END IF;
    INSERT INTO laptop_loans (registration_id, status, requested_at, handed_out_at)
    SELECT x.id,
           CASE WHEN x.n > CASE WHEN x.week = 1 THEN 6 ELSE 99 END THEN 'queued'
                WHEN x.week = 1 AND w1_start <= today AND x.label <> 'PY-B' THEN 'handed_out'
                ELSE 'reserved' END,
           x.created_at + interval '1 day',
           CASE WHEN x.n <= 6 AND x.week = 1 AND w1_start <= today AND x.label <> 'PY-B'
                THEN (today + time '08:45') AT TIME ZONE 'America/Denver' END
    FROM (SELECT r.id, r.created_at, s.week, s.label,
                 row_number() OVER (PARTITION BY s.week ORDER BY s.label = 'PY-B' DESC, r.created_at, r.id) AS n
            FROM registrations r JOIN sections s ON s.id = r.section_id JOIN students st2 ON st2.id = r.student_id
           WHERE r.status IN ('confirmed', 'pending') AND st2.parent_id IS DISTINCT FROM demo_parent
             AND (st2.laptop_available IS FALSE
                  OR r.id IN (SELECT r2.id FROM registrations r2 JOIN sections s2 ON s2.id = r2.section_id
                               WHERE s2.label = 'PY-B' AND s2.week = 1 AND r2.status = 'confirmed'
                               ORDER BY r2.created_at, r2.id LIMIT 2))) x;
    UPDATE sessions SET laptop_loaners = 6 WHERE id = w1;
    UPDATE sessions SET laptop_loaners = 1 + (SELECT count(*) FROM laptop_loans l JOIN registrations r ON r.id = l.registration_id
                                              JOIN sections s ON s.id = r.section_id WHERE s.session_id = w2)
     WHERE id = w2;
  END IF;

  -- ── 11. Pickups and walk-home consent (spec 36) ──
  -- Every camper present at a past dismissal went home with their parent. The demo family lists an
  -- aunt for any day and a grandmother for Wednesday of Week 1 only, and Maya may walk home every
  -- day of Week 2. In Python B (the demo volunteer's room) a grandfather collects one camper today
  -- only, a carpool neighbour collects another any day, and a third may walk home all week.
  IF to_regclass('public.authorized_pickups') IS NOT NULL THEN
    UPDATE roll_call_marks SET released_mode = 'parent'
     WHERE roll_call = 'dismissal' AND present AND day < today;
    IF demo_parent IS NOT NULL THEN
      INSERT INTO authorized_pickups (student_id, name, relation, phone, days)
      SELECT st2.id, x.name, x.relation, x.phone, x.days
        FROM students st2,
             (VALUES ('Morgan Brooks', 'Aunt', '720-555-0199', NULL::date[]),
                     ('Ruth Brooks', 'Grandmother', '303-555-0142', ARRAY[w1_start + 2])) AS x(name, relation, phone, days)
       WHERE st2.parent_id = demo_parent AND st2.first_name = 'Maya';
      INSERT INTO release_consents (student_id, session_id, mode, note, consented_by)
      SELECT st2.id, w2, 'walk', 'She walks home with her friend Ava. We live four blocks away.', demo_parent
        FROM students st2 WHERE st2.parent_id = demo_parent AND st2.first_name = 'Maya';
    END IF;
    FOR reg IN SELECT r.student_id, st2.parent_id, st2.last_name, row_number() OVER (ORDER BY st2.full_name) AS n
                 FROM registrations r JOIN sections s ON s.id = r.section_id JOIN students st2 ON st2.id = r.student_id
                WHERE s.label = 'PY-B' AND s.week = 1 AND r.status = 'confirmed'
                ORDER BY st2.full_name LIMIT 3 LOOP
      IF reg.n = 1 THEN
        INSERT INTO authorized_pickups (student_id, name, relation, phone, days)
        VALUES (reg.student_id, 'Grandpa ' || reg.last_name, 'Grandfather', '303-555-0151', ARRAY[GREATEST(today, w1_start)]);
      ELSIF reg.n = 2 THEN
        INSERT INTO authorized_pickups (student_id, name, relation, phone)
        VALUES (reg.student_id, 'Dana Whitfield', 'Carpool neighbour', '303-555-0152');
      ELSE
        INSERT INTO release_consents (student_id, session_id, mode, consented_by)
        VALUES (reg.student_id, w1, 'walk', reg.parent_id);
      END IF;
    END LOOP;
  END IF;

  RETURN format('demo reset: %s families, %s campers, %s registrations, %s volunteers, %s applications',
    (SELECT count(*) FROM parent_profiles), (SELECT count(*) FROM students), (SELECT count(*) FROM registrations),
    (SELECT count(*) FROM volunteers), (SELECT count(*) FROM volunteer_applications));
END;
$$;
REVOKE ALL ON FUNCTION private.reset_demo() FROM PUBLIC, anon, authenticated;

-- ── Kept accounts are off-limits to demo visitors ─────────────
-- The public demo admin is a real admin, so it could otherwise demote or delete the owner's own
-- logins (private.demo_keep_users) and read their real email on Users & roles. Kept accounts
-- can still manage themselves and each other.

CREATE OR REPLACE FUNCTION private.guard_demo_keep_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM private.demo_keep_users WHERE id = OLD.id)
     AND NOT EXISTS (SELECT 1 FROM private.demo_keep_users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'This account is protected in the demo and can''t be changed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.guard_demo_keep_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard_demo_keep ON profiles;
CREATE TRIGGER profiles_guard_demo_keep BEFORE UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION private.guard_demo_keep_profile();

-- Replaces the version in migration_security_hardening.sql (apply this file after it): same
-- admin-only list, with kept accounts' email and last sign-in blanked for everyone else.
CREATE OR REPLACE FUNCTION public.admin_user_emails()
RETURNS TABLE (id UUID, email TEXT, last_sign_in_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  caller_kept BOOLEAN := EXISTS (SELECT 1 FROM private.demo_keep_users k WHERE k.id = auth.uid());
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id,
           CASE WHEN k.id IS NULL OR caller_kept THEN u.email::text END,
           CASE WHEN k.id IS NULL OR caller_kept THEN u.last_sign_in_at END
    FROM auth.users u LEFT JOIN private.demo_keep_users k ON k.id = u.id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_emails() TO authenticated;
REVOKE ALL ON FUNCTION private.demo_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Nightly at 03:00 Denver (09:00 UTC).
SELECT cron.unschedule('reset-demo-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-demo-nightly');
SELECT cron.schedule('reset-demo-nightly', '0 9 * * *', $cron$SELECT private.reset_demo()$cron$);

-- Demo only: reset_demo() rewrites the whole camp every night, which adds ~1,000 rows to audit.log
-- (migration_audit_log.sql). Keep a week of them so the admin History strip has something to show,
-- and drop the rest. Production keeps its log under the retention policy instead (spec L4).
DO $$
BEGIN
  IF to_regclass('audit.log') IS NOT NULL THEN
    PERFORM cron.unschedule('trim-demo-audit-log') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trim-demo-audit-log');
    PERFORM cron.schedule('trim-demo-audit-log', '30 9 * * *', $cron$DELETE FROM audit.log WHERE at < now() - interval '7 days'$cron$);
  END IF;
END $$;
