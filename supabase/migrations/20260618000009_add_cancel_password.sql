-- Add cancel_password to profiles for PDV cancellation security
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cancel_password TEXT;