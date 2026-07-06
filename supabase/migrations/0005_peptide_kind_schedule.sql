-- Peptides tab: group inventory + today's schedule into peptide/supplement
-- subsections, and move dose scheduling to live on the inventory item
-- (an inventory row's `schedule_amount`/`schedule_time_label` is what gets
-- copied into a `peptide_doses` row for today when the user edits it).

alter table public.peptide_doses
  add column if not exists kind text not null default 'peptide' check (kind in ('peptide', 'supplement'));

alter table public.peptide_inventory
  add column if not exists kind text not null default 'peptide' check (kind in ('peptide', 'supplement')),
  add column if not exists schedule_amount text not null default '',
  add column if not exists schedule_time_label text not null default '';
