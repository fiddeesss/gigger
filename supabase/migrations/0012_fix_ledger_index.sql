-- Fix: the wallet_ledger dedupe index was (kind, ref_id), but the invite
-- bonus legitimately writes TWO rows per invite (one per side) sharing the
-- same ref_id — the index rejected the inviter's row and broke approvals.
-- Correct semantics: uniqueness per USER per event.

drop index if exists wallet_ledger_kind_ref_unique;

create unique index wallet_ledger_user_kind_ref_unique
  on public.wallet_ledger (user_id, kind, ref_id) where ref_id is not null;
