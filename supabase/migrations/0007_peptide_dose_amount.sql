-- Peptides tab: replace whole-dose-count inventory with real amount-in-mg
-- tracking, a single per-compound dose (mg), a cycling "on break" pause, and
-- last-taken tracking for a "time since last dose" display.
--
-- `vial_mg` (added in 0006) is repurposed as "amount per unit (mg)" for both
-- kinds going forward, not just peptide vial size — so `amount_left_mg` is
-- backfilled from `vials * vial_mg` for any row (peptide or supplement) that
-- already has both set, not just kind = 'peptide'.

alter table public.peptide_inventory
  add column if not exists dose_mg numeric not null default 0,
  add column if not exists amount_left_mg numeric not null default 0,
  add column if not exists on_break boolean not null default false,
  add column if not exists last_taken_at timestamptz;

update public.peptide_inventory
  set amount_left_mg = vials * vial_mg
  where amount_left_mg = 0 and vials * vial_mg > 0;
