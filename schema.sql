-- ============================================================
-- Steel City Codes Management System — Database Schema
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'volunteer', 'parent');
CREATE TYPE experience_level AS ENUM ('junior', 'senior');
CREATE TYPE registration_status AS ENUM ('pending', 'confirmed', 'waitlisted', 'cancelled');
CREATE TYPE attendance_action AS ENUM ('check_in', 'check_out');

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        user_role NOT NULL DEFAULT 'parent',
    display_name TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    full_name    TEXT NOT NULL,
    age          SMALLINT NOT NULL CHECK (age > 0 AND age < 18),
    medical_info TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE volunteers (
    id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    experience_level    experience_level NOT NULL,
    availability_week_1 BOOLEAN NOT NULL DEFAULT FALSE,
    availability_week_2 BOOLEAN NOT NULL DEFAULT FALSE,
    interview_notes     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    age_group  TEXT NOT NULL,
    capacity   SMALLINT NOT NULL CHECK (capacity > 0),
    lead_id    UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    support_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registrations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status     registration_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, class_id)
);

CREATE TABLE attendance_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    action     attendance_action NOT NULL,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE volunteer_applications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    first_name              TEXT NOT NULL,
    last_name               TEXT NOT NULL,
    email                   TEXT NOT NULL,
    phone                   TEXT NOT NULL,
    age                     SMALLINT NOT NULL,
    grade                   TEXT NOT NULL,
    school                  TEXT NOT NULL,
    shirt_size              TEXT NOT NULL,

    availability_week_1     BOOLEAN NOT NULL DEFAULT FALSE,
    availability_week_2     BOOLEAN NOT NULL DEFAULT FALSE,

    why_volunteer           TEXT NOT NULL,
    previous_scc_volunteer  BOOLEAN NOT NULL DEFAULT FALSE,
    cs_languages            TEXT[] NOT NULL DEFAULT '{}',
    cs_classes              TEXT,
    experience_children     TEXT,

    skill_python            SMALLINT CHECK (skill_python BETWEEN 1 AND 5),
    skill_java              SMALLINT CHECK (skill_java BETWEEN 1 AND 5),
    skill_html              SMALLINT CHECK (skill_html BETWEEN 1 AND 5),
    skill_css               SMALLINT CHECK (skill_css BETWEEN 1 AND 5),
    skill_javascript        SMALLINT CHECK (skill_javascript BETWEEN 1 AND 5),
    skill_microcontrollers  SMALLINT CHECK (skill_microcontrollers BETWEEN 1 AND 5),

    course_first_choice     TEXT NOT NULL,
    course_second_choice    TEXT NOT NULL,
    other_curricula         TEXT,

    volunteer_signature     TEXT NOT NULL,
    guardian_signature      TEXT,
    interview_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,

    status                  TEXT NOT NULL DEFAULT 'pending',
    admin_notes             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX ON students (parent_id);
CREATE INDEX ON registrations (student_id);
CREATE INDEX ON registrations (class_id);
CREATE INDEX ON registrations (status);
CREATE INDEX ON attendance_logs (student_id);
CREATE INDEX ON attendance_logs (class_id);
CREATE INDEX ON attendance_logs (timestamp);
CREATE INDEX ON volunteer_applications (status);
CREATE INDEX ON volunteer_applications (user_id);

-- ── Seed app_settings defaults ───────────────────────────────

INSERT INTO app_settings (key, value) VALUES ('volunteer_applications_open', 'false');

-- ── Enable RLS ───────────────────────────────────────────────

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

-- ── Helper: non-recursive role check ─────────────────────────
-- SECURITY DEFINER bypasses RLS so this function can read profiles
-- without triggering the policies on that table — avoids infinite recursion.

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- profiles policies
-- ============================================================
CREATE POLICY "admin_all_profiles" ON profiles
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "self_select_profile" ON profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "self_update_profile" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "self_insert_profile" ON profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================
-- students policies
-- ============================================================

CREATE POLICY "admin_all_students" ON students
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "parent_own_students" ON students
    FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "volunteer_read_students" ON students
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM registrations r
            JOIN classes c ON c.id = r.class_id
            WHERE r.student_id = students.id
              AND (c.lead_id = auth.uid() OR c.support_id = auth.uid())
        )
    );

-- ============================================================
-- volunteers policies
-- ============================================================

CREATE POLICY "admin_all_volunteers" ON volunteers
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "volunteer_select_self" ON volunteers
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "volunteer_update_self" ON volunteers
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "volunteer_insert_self" ON volunteers
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================
-- classes policies
-- ============================================================

CREATE POLICY "admin_all_classes" ON classes
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "volunteer_read_assigned_classes" ON classes
    FOR SELECT
    USING (lead_id = auth.uid() OR support_id = auth.uid());

CREATE POLICY "parent_read_classes" ON classes
    FOR SELECT
    USING (auth_user_role() = 'parent');

-- ============================================================
-- registrations policies
-- ============================================================

CREATE POLICY "admin_all_registrations" ON registrations
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "parent_own_registrations" ON registrations
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.parent_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.parent_id = auth.uid())
    );

CREATE POLICY "volunteer_read_registrations" ON registrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = class_id
              AND (c.lead_id = auth.uid() OR c.support_id = auth.uid())
        )
    );

-- ============================================================
-- attendance_logs policies
-- ============================================================

CREATE POLICY "admin_all_attendance" ON attendance_logs
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "volunteer_insert_attendance" ON attendance_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = class_id
              AND (c.lead_id = auth.uid() OR c.support_id = auth.uid())
        )
    );

CREATE POLICY "volunteer_read_attendance" ON attendance_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = class_id
              AND (c.lead_id = auth.uid() OR c.support_id = auth.uid())
        )
    );

CREATE POLICY "parent_read_attendance" ON attendance_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = student_id AND s.parent_id = auth.uid()
        )
    );

-- ============================================================
-- app_settings policies
-- ============================================================

-- Anyone (including unauthenticated) can read settings (e.g. is form open?)
CREATE POLICY "public_read_settings" ON app_settings
    FOR SELECT USING (true);

CREATE POLICY "admin_write_settings" ON app_settings
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- ============================================================
-- volunteer_applications policies
-- ============================================================

-- Anyone can submit an application (public form, no login required)
CREATE POLICY "public_insert_application" ON volunteer_applications
    FOR INSERT WITH CHECK (true);

-- Applicant can read their own application once logged in
CREATE POLICY "self_read_application" ON volunteer_applications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "admin_all_applications" ON volunteer_applications
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');
