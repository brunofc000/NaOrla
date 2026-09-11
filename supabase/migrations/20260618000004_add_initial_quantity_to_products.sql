-- Add initial_quantity column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS initial_quantity INTEGER;

-- Update existing products to set initial_quantity equal to current quantity
UPDATE public.products SET initial_quantity = quantity WHERE initial_quantity IS NULL;

-- Set default for new products
ALTER TABLE public.products ALTER COLUMN initial_quantity SET DEFAULT 0;