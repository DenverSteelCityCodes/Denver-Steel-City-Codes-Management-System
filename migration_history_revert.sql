-- Migration: admin history + revert (spec 15, #84)
-- Apply in Supabase Dashboard > SQL Editor (or via MCP / the Management API). Safe to re-run.
-- Order: after migration_audit_log.sql, migration_soft_cancel.sql and migration_edit_conflicts.sql.
--
-- admin_camper_history(student): the camper's own changes plus every change to their
-- registrations, newest first (the History strip on Students).
-- admin_revert(audit_id): undoes one logged UPDATE on students, registrations or sections by
-- writing the old values back, as a new logged change (reason 'revert:<id>'). Nothing is erased.
-- It refuses when the record has changed again since (revert the newer change first), and when
-- restoring a seat would overfill its section.

CREATE OR REPLACE FUNCTION public.admin_camper_history(p_student_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
    id BIGINT, at TIMESTAMPTZ, actor_id UUID, actor_name TEXT, actor_role TEXT,
    table_name TEXT, row_id TEXT, action TEXT, old JSONB, new JSONB, reason TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, audit AS $$
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT l.id, l.at, l.actor_id, p.display_name, l.actor_role, l.table_name, l.row_id, l.action, l.old, l.new, l.reason
    FROM audit.log l
    LEFT JOIN profiles p ON p.id = l.actor_id
    WHERE (l.table_name = 'students' AND l.row_id = p_student_id::text)
       OR (l.table_name = 'registrations'
           AND coalesce(l.new ->> 'student_id', l.old ->> 'student_id') = p_student_id::text)
    ORDER BY l.at DESC, l.id DESC
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_camper_history(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_camper_history(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revert(p_audit_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, audit AS $$
DECLARE
  e        audit.log%ROWTYPE;
  cur      JSONB;
  cols     TEXT[];
  k        TEXT;
  sec      RECORD;
  taken    INT;
  -- Columns the database manages itself; never written back, never compared.
  managed  TEXT[] := ARRAY['updated_at', 'cancelled_at', 'cancelled_by'];
BEGIN
  IF private.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM audit.log WHERE audit.log.id = p_audit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That history entry no longer exists' USING ERRCODE = 'P0001';
  END IF;
  IF e.action <> 'UPDATE' OR e.table_name NOT IN ('students', 'registrations', 'sections') THEN
    RAISE EXCEPTION 'Only edits to campers, registrations and sections can be reverted here' USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1::uuid FOR UPDATE', e.table_name)
    INTO cur USING e.row_id;
  IF cur IS NULL THEN
    RAISE EXCEPTION 'That record no longer exists' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(key) INTO cols
  FROM jsonb_object_keys(e.new) AS key
  WHERE e.old -> key IS DISTINCT FROM e.new -> key AND NOT key = ANY (managed);
  IF cols IS NULL THEN
    RAISE EXCEPTION 'Nothing to revert in that entry' USING ERRCODE = 'P0001';
  END IF;

  -- Only revert if nobody has changed those fields since.
  FOREACH k IN ARRAY cols LOOP
    IF cur -> k IS DISTINCT FROM e.new -> k THEN
      RAISE EXCEPTION 'This was changed again after that entry. Revert the newer change first.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Restoring a seat (e.g. undoing a cancel or a move) must fit.
  IF e.table_name = 'registrations'
     AND (e.old ->> 'status') IN ('confirmed', 'pending', 'offered')
     AND ((e.new ->> 'status') NOT IN ('confirmed', 'pending', 'offered')
          OR (e.old ->> 'section_id') IS DISTINCT FROM (e.new ->> 'section_id')) THEN
    SELECT s.* INTO sec FROM sections s WHERE s.id = (e.old ->> 'section_id')::uuid FOR UPDATE;
    SELECT count(*) INTO taken FROM registrations r
     WHERE r.section_id = sec.id AND r.status::text IN ('confirmed', 'pending', 'offered') AND r.id::text <> e.row_id;
    IF sec.id IS NULL OR sec.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'That section was cancelled, so the seat can''t be restored. Place the camper somewhere else.' USING ERRCODE = 'P0001';
    END IF;
    IF taken >= sec.capacity THEN
      RAISE EXCEPTION 'That section is full now (% of %), so the seat can''t be restored. Use Move or a status change to place the camper anyway.', taken, sec.capacity USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM private.set_reason('revert:' || p_audit_id);
  EXECUTE format(
    'UPDATE public.%1$I t SET (%2$s) = (SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)) WHERE t.id = $2::uuid',
    e.table_name,
    (SELECT string_agg(format('%I', c), ', ') FROM unnest(cols) c))
    USING e.old, e.row_id;
  PERFORM private.set_reason(NULL);
  RETURN array_to_string(cols, ', ');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revert(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revert(BIGINT) TO authenticated;
