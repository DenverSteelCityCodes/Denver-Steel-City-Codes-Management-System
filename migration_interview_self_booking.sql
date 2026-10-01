-- Migration: applicants book their own interview, SignUpGenius-style (applied to
-- rdckxazvoeixgwtjhrlf via MCP on 2026-09-30). Apply after migration_interviews.sql and
-- migration_security_hardening.sql.
--
-- open_interview_slots(): future, unbooked times. Callable signed-out (the /apply form) and
--   exposes no applicant data.
-- book_my_interview(slot, email): books — or moves — the caller's single interview. The applicant
--   is identified by their signed-in account, or (right after submitting /apply, before they've
--   confirmed their email) by a pending application with that email from the last hour. The slot
--   row is locked so two people can't take the same time.

CREATE OR REPLACE FUNCTION public.open_interview_slots()
RETURNS TABLE (id UUID, slot_datetime TIMESTAMPTZ, duration_minutes SMALLINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.slot_datetime, s.duration_minutes
  FROM interview_slots s
  WHERE s.slot_datetime > now()
    AND NOT EXISTS (SELECT 1 FROM interview_bookings b WHERE b.slot_id = s.id)
  ORDER BY s.slot_datetime;
$$;
REVOKE ALL ON FUNCTION public.open_interview_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_interview_slots() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.book_my_interview(p_slot_id UUID, p_email TEXT DEFAULT NULL)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  app_id    UUID;
  slot_time TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO app_id FROM volunteer_applications
    WHERE user_id = auth.uid() AND status <> 'rejected'
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF app_id IS NULL AND p_email IS NOT NULL THEN
    SELECT id INTO app_id FROM volunteer_applications
    WHERE lower(email) = lower(trim(p_email)) AND status = 'pending'
      AND created_at > now() - interval '1 hour'
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF app_id IS NULL THEN
    RAISE EXCEPTION 'We couldn''t find your application to attach the interview to' USING ERRCODE = 'P0001';
  END IF;

  SELECT slot_datetime INTO slot_time FROM interview_slots
  WHERE id = p_slot_id AND slot_datetime > now()
  FOR UPDATE;
  IF slot_time IS NULL THEN
    RAISE EXCEPTION 'That interview time is no longer available — please pick another' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM interview_bookings WHERE slot_id = p_slot_id AND application_id <> app_id) THEN
    RAISE EXCEPTION 'Someone just booked that time — please pick another' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM interview_bookings WHERE application_id = app_id AND slot_id <> p_slot_id;
  INSERT INTO interview_bookings (slot_id, application_id)
  VALUES (p_slot_id, app_id)
  ON CONFLICT (application_id) DO NOTHING;
  UPDATE volunteer_applications SET interview_confirmed = true WHERE id = app_id;
  RETURN slot_time;
END;
$$;
REVOKE ALL ON FUNCTION public.book_my_interview(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_my_interview(UUID, TEXT) TO anon, authenticated;
