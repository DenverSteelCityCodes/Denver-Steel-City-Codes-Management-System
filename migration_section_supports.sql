-- Migration: multiple supports per section (Issue #26)
-- Apply in Supabase Dashboard > SQL Editor (after migration_sections.sql)

-- ── 1. Create section_supports join table ─────────────────────

CREATE TABLE IF NOT EXISTS section_supports (
    section_id   UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    PRIMARY KEY (section_id, volunteer_id)
);

CREATE INDEX ON section_supports (volunteer_id);

-- ── 2. Migrate existing support_id data ──────────────────────

INSERT INTO section_supports (section_id, volunteer_id)
SELECT id, support_id
FROM sections
WHERE support_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 3. Drop support_id from sections ─────────────────────────

ALTER TABLE sections DROP COLUMN IF EXISTS support_id;

-- ── 4. RLS for section_supports ──────────────────────────────

ALTER TABLE section_supports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_section_supports" ON section_supports;
DROP POLICY IF EXISTS "read_section_supports"      ON section_supports;

CREATE POLICY "admin_all_section_supports" ON section_supports
    FOR ALL
    USING (auth_user_role() = 'admin')
    WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "read_section_supports" ON section_supports
    FOR SELECT USING (true);

-- ── 5. Update volunteer policy on sections ────────────────────

DROP POLICY IF EXISTS "volunteer_read_assigned_sections" ON sections;

CREATE POLICY "volunteer_read_assigned_sections" ON sections
    FOR SELECT
    USING (
        lead_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM section_supports ss
            WHERE ss.section_id = sections.id
              AND ss.volunteer_id = auth.uid()
        )
    );

-- ── 6. Update SECURITY DEFINER helpers ───────────────────────
-- These functions previously referenced support_id; update to use section_supports.

CREATE OR REPLACE FUNCTION auth_volunteer_has_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM registrations r
    JOIN sections sec ON sec.id = r.section_id
    LEFT JOIN section_supports ss ON ss.section_id = sec.id AND ss.volunteer_id = auth.uid()
    WHERE r.student_id = p_student_id
      AND (sec.lead_id = auth.uid() OR ss.volunteer_id IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION auth_volunteer_has_section(p_section_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections sec
    LEFT JOIN section_supports ss ON ss.section_id = sec.id AND ss.volunteer_id = auth.uid()
    WHERE sec.id = p_section_id
      AND (sec.lead_id = auth.uid() OR ss.volunteer_id IS NOT NULL)
  );
$$;

-- ── 7. Update classes volunteer policy ───────────────────────

DROP POLICY IF EXISTS "volunteer_read_classes_via_sections" ON classes;

CREATE POLICY "volunteer_read_classes_via_sections" ON classes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sections s
            LEFT JOIN section_supports ss ON ss.section_id = s.id AND ss.volunteer_id = auth.uid()
            WHERE s.class_id = classes.id
              AND (s.lead_id = auth.uid() OR ss.volunteer_id IS NOT NULL)
        )
    );
