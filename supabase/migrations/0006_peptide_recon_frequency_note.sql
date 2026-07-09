-- Peptides tab: structured reconstitution math (vial size / BAC water / dose
-- amount, replacing manually-typed recon text going forward for 'peptide'
-- kind rows), a dosing frequency selector, and a free-form per-compound note.

alter table public.peptide_inventory
  add column if not exists vial_mg numeric not null default 0,
  add column if not exists bac_ml numeric not null default 0,
  add column if not exists dose_mcg numeric not null default 0,
  add column if not exists frequency text not null default 'daily' check (frequency in ('daily', 'everyN', 'weekdays', 'asNeeded')),
  add column if not exists frequency_n integer not null default 1,
  add column if not exists frequency_days text not null default '',
  add column if not exists note text not null default '';
