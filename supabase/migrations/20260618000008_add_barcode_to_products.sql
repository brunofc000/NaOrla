-- Add barcode column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Create index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;

-- Add unique constraint per user (same user can't have duplicate barcodes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_barcode 
ON public.products(user_id, barcode) WHERE barcode IS NOT NULL;