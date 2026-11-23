-- Rollback of 20261123000012: removes the extra places (their assignments are deleted; the photos stay in the library).
delete from public.page_images where slot_key in ('menu_header', 'about_main', 'logo');
alter table public.page_images drop constraint page_images_slot_key_check;
alter table public.page_images add constraint page_images_slot_key_check
  check (slot_key in ('home_hero', 'og_share'));
