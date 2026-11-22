-- More fixed photo places on the public site (FR-21): the Menu page header photo, the About page photo and
-- the logo. Same table, same RLS, same audit and publish path as home_hero / og_share: only the list of
-- allowed slot keys grows.
alter table public.page_images drop constraint page_images_slot_key_check;
alter table public.page_images add constraint page_images_slot_key_check
  check (slot_key in ('home_hero', 'og_share', 'menu_header', 'about_main', 'logo'));
