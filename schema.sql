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

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX ON students (parent_id);
CREATE INDEX ON registrations (student_id);
CREATE INDEX ON registrations (class_id);
CREATE INDEX ON registrations (status);
CREATE INDEX ON attendance_logs (student_id);
CREATE INDEX ON attendance_logs (class_id);
CREATE INDEX ON attendance_logs (timestamp);

-- ── Enable RLS ───────────────────────────────────────────────

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- ── Helper: role check ───────────────────────────────────────
-- auth_user_role() is used throughout policies (defined above).
-- It is SECURITY DEFINER so it bypasses RLS and avoids recursive policy evaluation.

-- ============================================================
-- profiles policies
-- ============================================================

-- Helper function: non-recursive role check via security definer
-- Reads the role from profiles without triggering RLS on the profiles table itself.
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Admin: full access
CREATE POLICY "admin_all_profiles" ON profiles
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- Volunteer / Parent: read & update own row only
CREATE POLICY "self_select_profile" ON profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "self_update_profile" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Allow new users to insert their own profile on sign-up
CREATE POLICY "self_insert_profile" ON profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================
-- students policies
-- ============================================================

-- Admin: full access
CREATE POLICY "admin_all_students" ON students
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- Parent: full access to their own students
CREATE POLICY "parent_own_students" ON students
    FOR ALL
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());

-- Volunteer: read students enrolled in their assigned class
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

-- Admin: full access
CREATE POLICY "admin_all_volunteers" ON volunteers
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- Volunteer: read & update own record
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

-- Admin: full access
CREATE POLICY "admin_all_classes" ON classes
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- Volunteer: read classes they are assigned to
CREATE POLICY "volunteer_read_assigned_classes" ON classes
    FOR SELECT
    USING (lead_id = auth.uid() OR support_id = auth.uid());

-- Parent: read all classes (needed to browse & register)
CREATE POLICY "parent_read_classes" ON classes
    FOR SELECT
    USING (auth_user_role() = 'parent');

-- ============================================================
-- registrations policies
-- ============================================================

-- Admin: full access
CREATE POLICY "admin_all_registrations" ON registrations
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- Parent: manage registrations for their own students
CREATE POLICY "parent_own_registrations" ON registrations
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.parent_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.parent_id = auth.uid())
    );

-- Volunteer: read registrations for their assigned classes
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

-- Admin: full access
CREATE POLICY "admin_all_attendance" ON attendance_logs
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

-- Volunteer: insert & read logs for students in their assigned classes
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

-- Parent: read attendance logs for their own students
CREATE POLICY "parent_read_attendance" ON attendance_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = student_id AND s.parent_id = auth.uid()
        )
    );
