\set ON_ERROR_STOP on
\ir helpers.sql

BEGIN;

INSERT INTO app_user (oidc_subject, name, email, role)
VALUES ('auth-user-1', 'Synthetic User', 'auth-user@example.test', 'educator');

SELECT is(
  (SELECT system_role FROM app_user WHERE oidc_subject = 'auth-user-1'),
  'user',
  'new users receive the least-privileged system role'
);

SELECT throws_ok(
  $$UPDATE app_user SET system_role = 'superuser' WHERE oidc_subject = 'auth-user-1'$$,
  '23514',
  NULL,
  'unknown system roles are rejected'
);

ROLLBACK;
