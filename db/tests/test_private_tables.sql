BEGIN;

-- Model a hosted Data API client even when its DB role has table grants.
CREATE ROLE synthetic_data_api_client NOLOGIN;
GRANT USAGE ON SCHEMA public TO synthetic_data_api_client;
GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA public TO synthetic_data_api_client;

INSERT INTO public.app_user (oidc_subject, name, email, role)
VALUES ('synthetic-subject', 'Synthetic Instructor', 'instructor@example.test', 'instructor');
INSERT INTO public.sim_case (title) VALUES ('Synthetic private case');
INSERT INTO public.case_version (case_id, version_number, content)
SELECT id, 1, '{"title":"Synthetic case version"}' FROM public.sim_case;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'An application table is missing row-level security';
  END IF;
END $$;

SET LOCAL ROLE synthetic_data_api_client;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sim_case)
    OR EXISTS (SELECT 1 FROM public.case_version)
    OR EXISTS (SELECT 1 FROM public.app_user) THEN
    RAISE EXCEPTION 'Direct Data API role could read private records';
  END IF;
  UPDATE public.app_user SET role = 'instructor';
  IF FOUND THEN
    RAISE EXCEPTION 'Direct Data API role could change account access';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;
