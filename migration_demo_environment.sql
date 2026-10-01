-- Migration: demo / test environment (applied to rdckxazvoeixgwtjhrlf via MCP on 2026-09-30)
--
-- private.reset_demo() wipes all camp data and reseeds a realistic summer: 4 courses across
-- Week 1/2, ~45 families / ~60 campers, ~20 volunteers with crews and duties, applications in
-- every state, interview slots relative to "now", and four one-click demo accounts.
-- It runs nightly (pg_cron) so public demo visitors can't break it for the next person.
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
CREATE OR REPLACE FUNCTION private.demo_user(p_email TEXT, p_name TEXT, p_role TEXT, p_password TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth, extensions AS $$
DECLARE
  uid UUID := md5('scc-demo:' || lower(p_email))::uuid;
  pw  TEXT := crypt(coalesce(p_password, gen_random_uuid()::text), gen_salt('bf'));
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = uid) THEN
    UPDATE auth.users SET encrypted_password = pw, email = lower(p_email),
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
  c_py UUID; c_java UUID; c_web UUID; c_micro UUID;
  sec RECORD; s_id UUID;
  fam INT; kid INT := 0; nkids INT; k INT;
  parent_id UUID; student_id UUID; g TEXT; age INT; yr INT; ln TEXT; pf TEXT;
  wk INT; st registration_status; taken INT; cap INT;
  vol_ids UUID[] := '{}'; v UUID; i INT; d DATE; t RECORD;
  demo RECORD; demo_parent UUID; demo_vol UUID; demo_app UUID; demo_admin UUID;
  app_id UUID; slot_id UUID;
BEGIN
  -- ── 1. Wipe camp data (keeps duty types, demo accounts and owner logins) ──
  DELETE FROM attendance_logs; DELETE FROM registrations; DELETE FROM students;
  DELETE FROM duty_assignments; DELETE FROM duty_slots;
  DELETE FROM interview_bookings; DELETE FROM interview_slots; DELETE FROM volunteer_applications;
  DELETE FROM section_supports; DELETE FROM sections; DELETE FROM classes;
  DELETE FROM volunteers; DELETE FROM parent_profiles; DELETE FROM sessions;
  -- Every account except the demo logins and the kept owner logins (also removes visitor sign-ups).
  DELETE FROM auth.users
  WHERE id NOT IN (SELECT id FROM private.demo_keep_users)
    AND lower(email) NOT IN (SELECT lower(email) FROM private.demo_accounts);

  UPDATE form_configs SET config = jsonb_build_object('enabled', true, 'fields', '{}'::jsonb), updated_at = now();
  INSERT INTO app_settings (key, value, updated_at) VALUES ('volunteer_applications_open', 'true', now())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();

  -- ── 2. Camp weeks and courses ──
  INSERT INTO sessions (name, year, start_date, end_date, is_active) VALUES ('Week 1', 2027, '2027-06-07', '2027-06-11', true) RETURNING id INTO w1;
  INSERT INTO sessions (name, year, start_date, end_date, is_active) VALUES ('Week 2', 2027, '2027-06-14', '2027-06-18', true) RETURNING id INTO w2;

  INSERT INTO classes (name, description) VALUES ('Intro to Python',
    'First steps in programming: variables, loops and functions, building small games and art with Python.') RETURNING id INTO c_py;
  INSERT INTO classes (name, description) VALUES ('Intro to Java',
    'Object-oriented programming fundamentals in Java. Recommended for campers who have tried some coding before.') RETURNING id INTO c_java;
  INSERT INTO classes (name, description) VALUES ('Web Development',
    'Build and publish a personal website with HTML, CSS and a little JavaScript.') RETURNING id INTO c_web;
  INSERT INTO classes (name, description) VALUES ('Microcontrollers',
    'Program real hardware — LEDs, sensors and buttons — with CircuitPython. For campers entering grades 7–9 with some Python experience.') RETURNING id INTO c_micro;

  INSERT INTO sections (class_id, label, age_min, age_max, capacity, week, session_id) VALUES
    (c_py,    'PY-A',              9, 10, 12, 1, w1),
    (c_py,    'PY-B',             11, 13, 16, 1, w1),
    (c_py,    'PY-A',              9, 10, 14, 2, w2),
    (c_py,    'PY-B',             11, 13, 16, 2, w2),
    (c_java,  'JAVA-1',           11, 14, 14, 1, w1),
    (c_java,  'JAVA-1',           11, 14, 14, 2, w2),
    (c_web,   'WEB-1',            10, 13, 18, 1, w1),
    (c_micro, 'MC-1',             12, 14, 10, 1, w1),
    (c_micro, 'MC-1',             12, 14, 10, 2, w2);

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
    INSERT INTO volunteers (id, experience_level, availability_week_1, availability_week_2, interview_notes)
    VALUES (v, CASE WHEN i <= 8 THEN 'senior' ELSE 'junior' END::experience_level,
            i % 5 <> 0, i % 4 <> 1,
            CASE WHEN i <= 8 THEN 'Returning volunteer, comfortable leading a room.' ELSE 'Great energy; pair with a senior lead.' END);
  END LOOP;
  IF demo_vol IS NOT NULL THEN
    INSERT INTO volunteers (id, experience_level, availability_week_1, availability_week_2, interview_notes)
    VALUES (demo_vol, 'senior', true, true, 'Taught Python at a library coding club; strong with younger campers.');
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
      -- the demo volunteer leads Python B; fictional seniors before the owner's own account
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

  -- ── 6. Families and campers ──
  FOR fam IN 1..array_length(last_names, 1) LOOP
    ln := last_names[fam]; pf := parent_first[fam];
    parent_id := private.demo_user(lower(pf || '.' || ln) || '@example.com', pf || ' ' || ln, 'parent');
    INSERT INTO parent_profiles (id, email, phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
    VALUES (parent_id, lower(pf || '.' || ln) || '@example.com', '303-555-01' || lpad(fam::text, 2, '0'),
            (ARRAY['Grandma','Grandpa','Aunt','Uncle'])[1 + fam % 4] || ' ' || ln, '720-555-01' || lpad(fam::text, 2, '0'),
            (ARRAY['Grandparent','Grandparent','Aunt','Uncle'])[1 + fam % 4]);
    nkids := CASE WHEN fam % 7 = 0 THEN 3 WHEN fam % 3 = 0 THEN 2 ELSE 1 END;
    yr := CASE WHEN fam % 8 = 0 THEN 2026 ELSE 2027 END;   -- returning families who still need to confirm
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
        yr = 2026 OR kid % 4 = 0, true, kid_first[1 + (kid - 1) % 60] || ' ' || ln, pf || ' ' || ln,
        now() - interval '30 days', yr)
      RETURNING id INTO student_id;

      CONTINUE WHEN yr = 2026;   -- returning camper who hasn't confirmed for this summer yet
      -- Register into an eligible section of their week — the emptier one, with a little noise so
      -- it isn't perfectly even. A third of campers come both weeks.
      FOR wk IN SELECT unnest(CASE WHEN kid % 3 = 0 THEN ARRAY[1, 2] WHEN kid % 3 = 2 THEN ARRAY[2] ELSE ARRAY[1] END) LOOP
        SELECT s.id, s.capacity INTO s_id, cap FROM sections s JOIN classes c ON c.id = s.class_id
        WHERE s.week = wk AND age BETWEEN s.age_min AND s.age_max
          AND (c.name <> 'Microcontrollers' OR g IN ('7th','8th','9th'))
        ORDER BY (SELECT count(*) FROM registrations r WHERE r.section_id = s.id)::numeric / s.capacity
                 + abs(hashtext(student_id::text || c.name) % 5) / 25.0
        LIMIT 1;
        CONTINUE WHEN s_id IS NULL;
        SELECT count(*) INTO taken FROM registrations WHERE section_id = s_id AND status IN ('confirmed','pending');
        st := CASE WHEN taken >= cap THEN 'waitlisted'
                   WHEN kid % 17 = 0 THEN 'cancelled'
                   WHEN kid % 4 = 0 THEN 'pending'
                   ELSE 'confirmed' END;
        INSERT INTO registrations (student_id, section_id, status, created_at)
        VALUES (student_id, s_id, st, now() - ((60 - kid) || ' days')::interval);
      END LOOP;
    END LOOP;
  END LOOP;

  -- The demo parent: one camper set, one waitlisted, one returning camper to confirm.
  -- Popular sections fill up: Python A and Microcontrollers in Week 1 are full with a waitlist.
  FOR sec IN SELECT s.id, s.capacity, s.age_min, s.age_max, c.name FROM sections s JOIN classes c ON c.id = s.class_id
             WHERE s.week = 1 AND ((c.name = 'Intro to Python' AND s.label = 'PY-A') OR c.name = 'Microcontrollers') LOOP
    FOR k IN 1..(sec.capacity + 3) LOOP
      SELECT count(*) INTO taken FROM registrations WHERE section_id = sec.id AND status IN ('confirmed','pending');
      SELECT count(*) INTO cap FROM registrations WHERE section_id = sec.id AND status = 'waitlisted';
      EXIT WHEN taken >= sec.capacity AND cap >= 2;
      SELECT st2.id INTO student_id FROM students st2
      WHERE st2.age BETWEEN sec.age_min AND sec.age_max AND st2.registration_year = 2027
        AND (sec.name <> 'Microcontrollers' OR st2.grade IN ('7th','8th','9th'))
        -- not already booked anywhere in Week 1 (a camper can't be in two rooms at once)
        AND NOT EXISTS (SELECT 1 FROM registrations r JOIN sections s4 ON s4.id = r.section_id
                        WHERE r.student_id = st2.id AND s4.week = 1 AND r.status <> 'cancelled')
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
       false, true, 'Maya Brooks', 'Taylor Brooks', now() - interval '20 days', 2027),
      (demo_parent, 'Eli', 'Brooks', 'Eli Brooks', 9, '4th', 'Cherry Creek School District', 'Cottonwood Creek Elementary', 'S',
       false, 'Taylor Brooks', '303-555-0199', 'Morgan Brooks', '720-555-0199', 'Aunt', 'None', 'None', 'Friend or family',
       false, true, 'Eli Brooks', 'Taylor Brooks', now() - interval '20 days', 2027),
      (demo_parent, 'Noor', 'Brooks', 'Noor Brooks', 13, '8th', 'Cherry Creek School District', 'Campus Middle School', 'L',
       true, 'Taylor Brooks', '303-555-0199', 'Morgan Brooks', '720-555-0199', 'Aunt', 'None',
       'Asthma — inhaler in backpack', 'Returning camper', true, true, 'Noor Brooks', 'Taylor Brooks', now() - interval '380 days', 2026);
    INSERT INTO registrations (student_id, section_id, status)
    SELECT st2.id, s.id, 'confirmed' FROM students st2, sections s JOIN classes c ON c.id = s.class_id
    WHERE st2.parent_id = demo_parent AND st2.first_name = 'Maya' AND c.name = 'Web Development';
    INSERT INTO registrations (student_id, section_id, status)
    SELECT st2.id, s.id, 'waitlisted' FROM students st2, sections s JOIN classes c ON c.id = s.class_id
    WHERE st2.parent_id = demo_parent AND st2.first_name = 'Eli' AND c.name = 'Intro to Python' AND s.label = 'PY-A' AND s.week = 1;
  END IF;

  -- ── 7. Duty schedule: four duties each camp day; volunteers have claimed most spots ──
  FOR d IN SELECT gs::date FROM generate_series(date '2027-06-07', date '2027-06-18', interval '1 day') gs LOOP
    CONTINUE WHEN extract(isodow FROM d) > 5;
    FOR t IN SELECT id, name FROM duty_types ORDER BY name LOOP
      INSERT INTO duty_slots (duty_type_id, session_id, slot_date, capacity)
      VALUES (t.id, CASE WHEN d <= date '2027-06-11' THEN w1 ELSE w2 END, d, 2)
      RETURNING id INTO slot_id;
      INSERT INTO duty_assignments (duty_slot_id, volunteer_id)
      SELECT slot_id, vo.id FROM volunteers vo
      WHERE CASE WHEN d <= date '2027-06-11' THEN vo.availability_week_1 ELSE vo.availability_week_2 END
        AND vo.id IS DISTINCT FROM demo_vol
      ORDER BY hashtext(vo.id::text || d::text || t.name) LIMIT (hashtext(d::text || t.name) & 1) + 1;
    END LOOP;
  END LOOP;
  -- The demo volunteer has signed up for a couple of duties and has open ones to try.
  INSERT INTO duty_assignments (duty_slot_id, volunteer_id)
  SELECT ds.id, demo_vol FROM duty_slots ds JOIN duty_types dt ON dt.id = ds.duty_type_id
  WHERE demo_vol IS NOT NULL AND dt.name = 'Morning Check-In' AND ds.slot_date IN ('2027-06-07', '2027-06-09')
    AND (SELECT count(*) FROM duty_assignments da WHERE da.duty_slot_id = ds.id) < ds.capacity;

  RETURN format('demo reset: %s families, %s campers, %s registrations, %s volunteers, %s applications',
    (SELECT count(*) FROM parent_profiles), (SELECT count(*) FROM students), (SELECT count(*) FROM registrations),
    (SELECT count(*) FROM volunteers), (SELECT count(*) FROM volunteer_applications));
END;
$$;
REVOKE ALL ON FUNCTION private.reset_demo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.demo_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Nightly at 03:00 Denver (09:00 UTC).
SELECT cron.unschedule('reset-demo-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-demo-nightly');
SELECT cron.schedule('reset-demo-nightly', '0 9 * * *', $cron$SELECT private.reset_demo()$cron$);
