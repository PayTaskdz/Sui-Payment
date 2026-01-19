ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payout_fee_rate numeric(9,6),
  ADD COLUMN IF NOT EXISTS payout_fee_amount_fiat numeric(18,2),
  ADD COLUMN IF NOT EXISTS payout_fee_base_fiat_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS payout_fee_final_fiat_amount numeric(18,2);

