BEGIN;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS system_role TEXT NOT NULL DEFAULT 'user';

-- Applying the migration never guesses who should be privileged. The first
-- authenticated identity is promoted atomically by the application.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'app_user_system_role_check'
       AND conrelid = 'app_user'::regclass
  ) THEN
    ALTER TABLE app_user
      ADD CONSTRAINT app_user_system_role_check
      CHECK (system_role IN ('user', 'admin', 'owner'));
  END IF;
END $$;

COMMIT;
