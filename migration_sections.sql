-- Migration: classes → sections model
-- A class is now a course descriptor; sections are individual offerings with
-- their own age range, capacity, week, and crew (lead/support).
-- Registrations and attendance attach to a section, not a class.
-- Apply in Supabase Dashboard > SQL Editor (after migration_auth_roles.sql)

-- ── 1. Create sections table ──────────────────────────────────

CREATE TABLE sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    age_min     SMALLINT NOT NULL CHECK (age_min > 0 AND age_min < 18),
    age_max     SMALLINT NOT NULL CHECK (age_max >= age_min AND age_max < 18),
    capacity    SMALLINT NOT NULL CHECK (capacity > 0),
    week        SMALLINT CHECK (week IN (1, 2)),
    lead_id     UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    support_id  UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON sections (class_id);

-- ── 2. Backfill: one default section per existing class ───────
-- Copy age_group → label, capacity → capacity, lead/support → section crew.
-- This preserves existing data before we drop those columns.

INSERT INTO sections (class_id, label, age_min, age_max, capacity, lead_id, support_id)
SELECT
    id,
    COALESCE(age_group, 'All Ages'),
    -- Parse a simple "8-10" style age_group if possible; default to 8/13 range
    CASE WHEN age_group ~ '^\d+\s*[-–]\s*\d+$'
         THEN CAST(split_part(regexp_replace(age_group, '[^0-9\-]', '', 'g'), '-', 1) AS SMALLINT)
         ELSE 8
    END,
    CASE WHEN age_group ~ '^\d+\s*[-–]\s*\d+$'
         THEN CAST(split_part(regexp_replace(age_group, '[^0-9\-]', '', 'g'), '-', 2) AS SMALLINT)
         ELSE 13
    END,
    capacity,
    lead_id,
    support_id
FROM classes;

-- ── 3. Drop policies that depend on classes.lead_id / support_id ─
-- These must be removed BEFORE the columns are dropped.
-- They are all recreated in §7 below (section-aware versions).

DROP POLICY IF EXISTS "volunteer_read_students"          ON students;
DROP POLICY IF EXISTS "volunteer_read_assigned_classes"  ON classes;
DROP POLICY IF EXISTS "volunteer_read_registrations"     ON registrations;
DROP POLICY IF EXISTS "volunteer_insert_attendance"      ON attendance_logs;
DROP POLICY IF EXISTS "volunteer_read_attendance"        ON attendance_logs;

-- ── 4. Alter classes: add description, drop old columns ───────

ALTER TABLE classes ADD COLUMN description TEXT;

ALTER TABLE classes
    DROP COLUMN age_group,
    DROP COLUMN capacity,
    DROP COLUMN lead_id,
    DROP COLUMN support_id;

-- ── 5. Migrate registrations to section_id ────────────────────

ALTER TABLE registrations ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE CASCADE;

-- Backfill: map each registration's class_id to the default section created above
UPDATE registrations r
SET section_id = s.id
FROM sections s
WHERE s.class_id = r.class_id;

-- Now enforce NOT NULL and repoint to section
ALTER TABLE registrations ALTER COLUMN section_id SET NOT NULL;
ALTER TABLE registrations DROP CONSTRAINT registrations_student_id_class_id_key;
ALTER TABLE registrations DROP COLUMN class_id;
ALTER TABLE registrations ADD CONSTRAINT registrations_student_section_key UNIQUE (student_id, section_id);
CREATE INDEX ON registrations (section_id);

-- ── 6. Migrate attendance_logs to section_id ──────────────────

ALTER TABLE attendance_logs ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE CASCADE;

UPDATE attendance_logs al
SET section_id = s.id
FROM sections s
WHERE s.class_id = al.class_id;

ALTER TABLE attendance_logs ALTER COLUMN section_id SET NOT NULL;
ALTER TABLE attendance_logs DROP COLUMN class_id;
CREATE INDEX ON attendance_logs (section_id);

-- ── 7. RLS for sections ───────────────────────────────────────

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_sections" ON sections FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "parent_read_sections" ON sections FOR SELECT
    USING (auth_user_role() = 'parent');

CREATE POLICY "volunteer_read_assigned_sections" ON sections FOR SELECT
    USING (lead_id = auth.uid() OR support_id = auth.uid());

-- ── 8. SECURITY DEFINER helpers (break RLS circular references) ─
-- volunteer_read_students reads registrations; parent_own_registrations reads students.
-- Direct EXISTS subqueries in policies would create an infinite loop.
-- SECURITY DEFINER functions bypass RLS on their inner queries — same pattern as auth_user_role().

CREATE OR REPLACE FUNCTION auth_volunteer_has_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM registrations r
    JOIN sections sec ON sec.id = r.section_id
    WHERE r.student_id = p_student_id
      AND (sec.lead_id = auth.uid() OR sec.support_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION auth_volunteer_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections sec
    WHERE sec.id = p_section_id
      AND (sec.lead_id = auth.uid() OR sec.support_id = auth.uid())
  );
$$;

-- ── 9. Recreate policies (section-aware, recursion-safe) ──────

DROP POLICY IF EXISTS "volunteer_read_students" ON students;
CREATE POLICY "volunteer_read_students" ON students
    FOR SELECT
    USING (auth_volunteer_has_student(id));

DROP POLICY IF EXISTS "volunteer_read_assigned_classes" ON classes;
CREATE POLICY "volunteer_read_classes_via_sections" ON classes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sections s
            WHERE s.class_id = classes.id
              AND (s.lead_id = auth.uid() OR s.support_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "volunteer_read_registrations" ON registrations;
CREATE POLICY "volunteer_read_registrations" ON registrations
    FOR SELECT
    USING (auth_volunteer_has_section(section_id));

DROP POLICY IF EXISTS "volunteer_insert_attendance" ON attendance_logs;
CREATE POLICY "volunteer_insert_attendance" ON attendance_logs
    FOR INSERT
    WITH CHECK (auth_volunteer_has_section(section_id));

DROP POLICY IF EXISTS "volunteer_read_attendance" ON attendance_logs;
CREATE POLICY "volunteer_read_attendance" ON attendance_logs
    FOR SELECT
    USING (auth_volunteer_has_section(section_id));

-- ── 10. Helpful fill-count view ───────────────────────────────

CREATE VIEW section_fill AS
    SELECT s.*,
           COUNT(r.id) FILTER (WHERE r.status IN ('confirmed', 'pending')) AS registered_count
    FROM sections s
    LEFT JOIN registrations r ON r.section_id = s.id
    GROUP BY s.id;
