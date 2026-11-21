-- Shared fixtures for the test files: four auth users and the admin rows. All values synthetic.
-- Admin A: active owner. Admin B: active staff. C: user with an INACTIVE admin row. D: signed in, not an admin.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'admin.a@example.test'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'admin.b@example.test'),
  ('cccccccc-0000-4000-8000-00000000000c', 'inactive.c@example.test'),
  ('dddddddd-0000-4000-8000-00000000000d', 'nonadmin.d@example.test');
insert into public.admin_users (user_id, display_name, role, is_active) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'Admin A (test)', 'owner', true),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Admin B (test)', 'staff', true),
  ('cccccccc-0000-4000-8000-00000000000c', 'Inactive C (test)', 'staff', false);

