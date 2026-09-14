-- 20260617080041_956028d3-6a3a-4433-bbb9-e0995476c52c.sql

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  kiosk_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  is_pro BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: owner read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: owner insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: owner update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================================
-- Helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, kiosk_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'kiosk_name', 'Meu Quiosque'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  expiry_date DATE,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products owner all" ON public.products FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_products_user ON public.products(user_id);

-- =========================================================
-- TRANSACTIONS
-- =========================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transactions owner all" ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tx_user_date ON public.transactions(user_id, created_at DESC);

-- =========================================================
-- SALE ITEMS
-- =========================================================
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sale items owner all" ON public.sale_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sale_items_tx ON public.sale_items(transaction_id);

-- =========================================================
-- STOCK MOVEMENTS
-- =========================================================
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','adjustment')),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock owner all" ON public.stock_movements FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- EMPLOYEES / ATTENDANCE / PAYMENTS
-- =========================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'helper',
  daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees owner all" ON public.employees FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  hours_worked NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance owner all" ON public.attendance FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payments owner all" ON public.payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- MENU ITEMS
-- =========================================================
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'food',
  photo_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Menu owner all" ON public.menu_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_menu_updated BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- SUPPLIERS
-- =========================================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  product_description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers owner all" ON public.suppliers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.supplier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  items TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_purchases TO authenticated;
GRANT ALL ON public.supplier_purchases TO service_role;
ALTER TABLE public.supplier_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supplier purchases owner all" ON public.supplier_purchases FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- ALERTS & REMINDERS
-- =========================================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  priority TEXT NOT NULL DEFAULT 'medium',
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alerts owner all" ON public.alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reminder_date TIMESTAMPTZ NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'once',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reminders owner all" ON public.reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260617080132_aa6fcf46-d2a3-434c-bd92-78b13749f509.sql

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 20260617080154_592a7fd3-d03a-4c17-94dc-60d7c8c3cdc4.sql

CREATE POLICY "Kiosk photos read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kiosk photos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kiosk photos update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kiosk photos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 20260617085222_303677ed-ee92-46f9-9d1c-07d73439b6a3.sql

-- Public read for menu items (cardÃ¡pio via QR Code)
CREATE POLICY "Menu public read available" ON public.menu_items
  FOR SELECT TO anon
  USING (is_available = true);
GRANT SELECT ON public.menu_items TO anon;

-- Public read minimal profile info for kiosk name
CREATE POLICY "Profiles public read kiosk info" ON public.profiles
  FOR SELECT TO anon
  USING (true);
GRANT SELECT ON public.profiles TO anon;

-- 20260617085245_0e38fb20-d39c-4af7-82ba-e9b2e1406d2c.sql

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, kiosk_name, avatar_url) ON public.profiles TO anon;

-- 20260617092746_ff2d1c52-365e-4d85-903f-f2072dff2260.sql

-- 1. CÃ³digo do garÃ§om no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS waiter_code TEXT NOT NULL DEFAULT lpad((floor(random()*1000000))::text, 6, '0');

-- 2. Tabela de pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','preparando','pronto','entregue','cancelado')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own orders" ON public.orders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own order items" ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- 4. RPC pÃºblica: valida cÃ³digo do garÃ§om e cria pedido atomicamente
CREATE OR REPLACE FUNCTION public.place_order(
  _kiosk_user_id UUID,
  _table_number TEXT,
  _customer_name TEXT,
  _customer_phone TEXT,
  _customer_cpf TEXT,
  _waiter_code TEXT,
  _items JSONB,
  _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expected TEXT;
  _order_id UUID;
  _total NUMERIC(10,2) := 0;
  _it JSONB;
  _price NUMERIC(10,2);
  _name TEXT;
BEGIN
  IF _table_number IS NULL OR length(trim(_table_number)) = 0 THEN
    RAISE EXCEPTION 'Mesa obrigatÃ³ria';
  END IF;
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Nome do cliente obrigatÃ³rio';
  END IF;
  IF _customer_cpf IS NULL OR length(regexp_replace(_customer_cpf,'\D','','g')) < 11 THEN
    RAISE EXCEPTION 'CPF invÃ¡lido';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  SELECT waiter_code INTO _expected FROM public.profiles WHERE id = _kiosk_user_id;
  IF _expected IS NULL OR _expected <> _waiter_code THEN
    RAISE EXCEPTION 'CÃ³digo do garÃ§om invÃ¡lido';
  END IF;

  INSERT INTO public.orders (user_id, table_number, customer_name, customer_phone, customer_cpf, notes)
  VALUES (_kiosk_user_id, _table_number, _customer_name, _customer_phone, regexp_replace(_customer_cpf,'\D','','g'), _notes)
  RETURNING id INTO _order_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT price, name INTO _price, _name FROM public.menu_items
      WHERE id = (_it->>'menu_item_id')::uuid AND user_id = _kiosk_user_id AND is_available = true;
    IF _price IS NULL THEN
      RAISE EXCEPTION 'Item indisponÃ­vel';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
    VALUES (_order_id, (_it->>'menu_item_id')::uuid, _name, _price, (_it->>'quantity')::int, _it->>'notes');
    _total := _total + _price * (_it->>'quantity')::int;
  END LOOP;

  UPDATE public.orders SET total = _total WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT) TO anon, authenticated;

-- 5. Realtime para a tela da cozinha
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- 20260617095647_d84aa6fa-2033-4b8f-960d-ca1a9cb3ec49.sql

-- 1. Schema additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kiosk_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS employee_password TEXT;

-- Backfill kiosk_code for existing rows
UPDATE public.profiles
SET kiosk_code = 'NA-' || upper(substring(replace(id::text,'-',''),1,6))
WHERE kiosk_code IS NULL;

-- Update trigger to auto-generate kiosk_code on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, kiosk_name, phone, kiosk_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'kiosk_name', 'Meu Quiosque'),
    NEW.raw_user_meta_data->>'phone',
    'NA-' || upper(substring(replace(NEW.id::text,'-',''),1,6))
  );
  RETURN NEW;
END; $$;

-- 2. Employee login: validate credentials, return kiosk info
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code TEXT, _password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row RECORD;
BEGIN
  SELECT id, kiosk_name, kiosk_code, employee_password
    INTO _row
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Quiosque nÃ£o encontrado';
  END IF;
  IF _row.employee_password IS NULL OR length(_row.employee_password) = 0 THEN
    RAISE EXCEPTION 'O dono ainda nÃ£o definiu a senha de funcionÃ¡rio';
  END IF;
  IF _row.employee_password <> _password THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  RETURN jsonb_build_object(
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code
  );
END; $$;

-- Internal helper: verify credentials, return owner user_id
CREATE OR REPLACE FUNCTION public._verify_employee(_kiosk_code TEXT, _password TEXT)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _pwd TEXT;
BEGIN
  SELECT id, employee_password INTO _id, _pwd
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _id IS NULL OR _pwd IS NULL OR _pwd <> _password THEN
    RAISE EXCEPTION 'Credenciais invÃ¡lidas';
  END IF;
  RETURN _id;
END; $$;

-- 3. Employee: read menu
CREATE OR REPLACE FUNCTION public.employee_get_menu(_kiosk_code TEXT, _password TEXT)
RETURNS SETOF public.menu_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee(_kiosk_code, _password);
  RETURN QUERY SELECT * FROM public.menu_items WHERE user_id = _owner ORDER BY category, name;
END; $$;

-- 4. Employee: get kitchen orders with items
CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders(_kiosk_code TEXT, _password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _result jsonb;
BEGIN
  _owner := public._verify_employee(_kiosk_code, _password);
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at), '[]'::jsonb)
    INTO _result
  FROM (
    SELECT
      o.id, o.table_number, o.customer_name, o.customer_phone,
      o.status, o.total, o.notes, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'name', oi.name, 'quantity', oi.quantity,
          'price', oi.price, 'notes', oi.notes
        ))
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END; $$;

-- 5. Employee: update order status
CREATE OR REPLACE FUNCTION public.employee_update_order_status(
  _kiosk_code TEXT, _password TEXT, _order_id uuid, _status TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee(_kiosk_code, _password);
  IF _status NOT IN ('novo','preparando','pronto','entregue','cancelado') THEN
    RAISE EXCEPTION 'Status invÃ¡lido';
  END IF;
  UPDATE public.orders SET status = _status
    WHERE id = _order_id AND user_id = _owner;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido nÃ£o encontrado';
  END IF;
END; $$;

-- Grants: callable by anon (employees aren't authenticated)
GRANT EXECUTE ON FUNCTION public.employee_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_menu(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_kitchen_orders(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_update_order_status(TEXT, TEXT, uuid, TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._verify_employee(TEXT, TEXT) FROM anon, authenticated;

-- 20260617102338_b18c96d3-cdac-4eae-8038-ed7e560310df.sql
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
-- 20260617103502_faa5ca32-4e58-48c1-bf9f-e90d18ad1927.sql

-- 1) pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Tighten profiles column exposure to anon
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, display_name, kiosk_name) ON public.profiles TO anon;

-- Replace overly broad public-read policy with a column-agnostic one (column grants now enforce safety)
DROP POLICY IF EXISTS "Profiles public read kiosk info" ON public.profiles;
CREATE POLICY "Profiles public read minimal" ON public.profiles
  FOR SELECT TO anon USING (true);

-- 3) Drop realtime publication for sensitive tables
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.order_items;

-- 4) Hash existing employee passwords (clear plaintext; owners must reset)
UPDATE public.profiles SET employee_password = NULL WHERE employee_password IS NOT NULL;

-- Trigger to hash any plaintext on write
CREATE OR REPLACE FUNCTION public.hash_employee_password()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.employee_password IS NOT NULL
     AND NEW.employee_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.employee_password IS DISTINCT FROM OLD.employee_password)
     AND NEW.employee_password NOT LIKE '$2%$%' THEN
    NEW.employee_password := crypt(NEW.employee_password, gen_salt('bf'));
  END IF;
  IF NEW.employee_password = '' THEN NEW.employee_password := NULL; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_employee_password ON public.profiles;
CREATE TRIGGER trg_hash_employee_password
  BEFORE INSERT OR UPDATE OF employee_password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.hash_employee_password();

-- 5) Employee session tokens
CREATE TABLE IF NOT EXISTS public.employee_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours')
);
GRANT ALL ON public.employee_sessions TO service_role;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions touch this table.

-- 6) Replace verification helper to use token + bcrypt
CREATE OR REPLACE FUNCTION public._verify_employee_token(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT kiosk_user_id INTO _owner
    FROM public.employee_sessions
    WHERE token = _token AND expires_at > now();
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'SessÃ£o expirada';
  END IF;
  RETURN _owner;
END;
$$;
REVOKE ALL ON FUNCTION public._verify_employee_token(uuid) FROM PUBLIC, anon, authenticated;

-- Old helper: lock down
REVOKE ALL ON FUNCTION public._verify_employee(text, text) FROM PUBLIC, anon, authenticated;

-- 7) New employee_login: returns session token, uses bcrypt compare
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row RECORD;
  _token uuid;
BEGIN
  SELECT id, kiosk_name, kiosk_code, employee_password
    INTO _row
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Quiosque nÃ£o encontrado';
  END IF;
  IF _row.employee_password IS NULL OR length(_row.employee_password) = 0 THEN
    RAISE EXCEPTION 'O dono ainda nÃ£o definiu a senha de funcionÃ¡rio';
  END IF;
  IF _row.employee_password <> crypt(_password, _row.employee_password) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  INSERT INTO public.employee_sessions (kiosk_user_id) VALUES (_row.id) RETURNING token INTO _token;
  -- opportunistic cleanup
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code
  );
END;
$$;
REVOKE ALL ON FUNCTION public.employee_login(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_login(text, text) TO anon;

-- 8) Token-based RPCs replacing the password-based ones
CREATE OR REPLACE FUNCTION public.employee_logout(_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.employee_sessions WHERE token = _token;
$$;
REVOKE ALL ON FUNCTION public.employee_logout(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_logout(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_get_menu_v2(_token uuid)
RETURNS SETOF public.menu_items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee_token(_token);
  RETURN QUERY SELECT * FROM public.menu_items WHERE user_id = _owner ORDER BY category, name;
END;
$$;
REVOKE ALL ON FUNCTION public.employee_get_menu_v2(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_menu_v2(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders_v2(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _result jsonb;
BEGIN
  _owner := public._verify_employee_token(_token);
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at), '[]'::jsonb)
    INTO _result
  FROM (
    SELECT
      o.id, o.table_number, o.customer_name, o.customer_phone,
      o.status, o.total, o.notes, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'name', oi.name, 'quantity', oi.quantity,
          'price', oi.price, 'notes', oi.notes
        ))
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.employee_get_kitchen_orders_v2(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_kitchen_orders_v2(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_update_order_status_v2(_token uuid, _order_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _status NOT IN ('novo','preparando','pronto','entregue','cancelado') THEN
    RAISE EXCEPTION 'Status invÃ¡lido';
  END IF;
  UPDATE public.orders SET status = _status WHERE id = _order_id AND user_id = _owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nÃ£o encontrado'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.employee_update_order_status_v2(uuid, uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_update_order_status_v2(uuid, uuid, text) TO anon;

-- 9) Drop legacy password-based RPCs
DROP FUNCTION IF EXISTS public.employee_get_menu(text, text);
DROP FUNCTION IF EXISTS public.employee_get_kitchen_orders(text, text);
DROP FUNCTION IF EXISTS public.employee_update_order_status(text, text, uuid, text);

-- 10) place_order stays callable by anon (public ordering); make explicit
REVOKE ALL ON FUNCTION public.place_order(uuid, text, text, text, text, text, jsonb, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, text, text, text, text, jsonb, text) TO anon;

-- 20260617105128_b2fc334d-2681-4ea3-a6a1-87bb43a1548f.sql

CREATE OR REPLACE FUNCTION public.hash_employee_password()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.employee_password IS NOT NULL
     AND NEW.employee_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.employee_password IS DISTINCT FROM OLD.employee_password)
     AND NEW.employee_password NOT LIKE '$2%$%' THEN
    NEW.employee_password := extensions.crypt(NEW.employee_password, extensions.gen_salt('bf'));
  END IF;
  IF NEW.employee_password = '' THEN NEW.employee_password := NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _row RECORD;
  _token uuid;
BEGIN
  SELECT id, kiosk_name, kiosk_code, employee_password
    INTO _row
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Quiosque nÃ£o encontrado';
  END IF;
  IF _row.employee_password IS NULL OR length(_row.employee_password) = 0 THEN
    RAISE EXCEPTION 'O dono ainda nÃ£o definiu a senha de funcionÃ¡rio';
  END IF;
  IF _row.employee_password <> extensions.crypt(_password, _row.employee_password) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  INSERT INTO public.employee_sessions (kiosk_user_id) VALUES (_row.id) RETURNING token INTO _token;
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code
  );
END;
$$;

-- 20260617105559_8dc0964c-1ceb-4d4b-ac34-6ec561fa41bc.sql
CREATE OR REPLACE FUNCTION public.revoke_employee_sessions_on_password_clear()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_password IS NULL AND OLD.employee_password IS NOT NULL THEN
    DELETE FROM public.employee_sessions WHERE kiosk_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_employee_sessions ON public.profiles;
CREATE TRIGGER trg_revoke_employee_sessions
AFTER UPDATE OF employee_password ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.revoke_employee_sessions_on_password_clear();
-- 20260617105616_26bd8661-ebee-4e0a-bad3-741831578f90.sql
REVOKE EXECUTE ON FUNCTION public.revoke_employee_sessions_on_password_clear() FROM PUBLIC, anon, authenticated;
-- 20260617110102_713f48bf-287e-4255-832f-93eea9b4c800.sql
CREATE OR REPLACE FUNCTION public.employee_place_order_v2(
  _token uuid,
  _table_number text,
  _customer_name text,
  _items jsonb,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _order_id uuid;
  _total numeric(10,2) := 0;
  _it jsonb;
  _price numeric(10,2);
  _name text;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _table_number IS NULL OR length(trim(_table_number)) = 0 THEN
    RAISE EXCEPTION 'Mesa obrigatÃ³ria';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido vazio';
  END IF;

  INSERT INTO public.orders (user_id, table_number, customer_name, notes)
  VALUES (_owner, _table_number, COALESCE(NULLIF(trim(_customer_name),''), 'Mesa ' || _table_number), _notes)
  RETURNING id INTO _order_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT price, name INTO _price, _name FROM public.menu_items
      WHERE id = (_it->>'menu_item_id')::uuid AND user_id = _owner AND is_available = true;
    IF _price IS NULL THEN
      RAISE EXCEPTION 'Item indisponÃ­vel';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
    VALUES (_order_id, (_it->>'menu_item_id')::uuid, _name, _price, (_it->>'quantity')::int, _it->>'notes');
    _total := _total + _price * (_it->>'quantity')::int;
  END LOOP;

  UPDATE public.orders SET total = _total WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.employee_place_order_v2(uuid, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_place_order_v2(uuid, text, text, jsonb, text) TO anon, authenticated;
-- 20260617111000_330436f1-6f02-4b0b-a82f-d810e8d91c5a.sql
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN customer_cpf DROP NOT NULL;
-- 20260617111512_a5d50b66-f405-456a-b979-113e0a930f75.sql
-- 1. New column for kitchen password
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kitchen_password text;

-- 2. Role column on sessions
ALTER TABLE public.employee_sessions ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'garcom';
ALTER TABLE public.employee_sessions DROP CONSTRAINT IF EXISTS employee_sessions_role_check;
ALTER TABLE public.employee_sessions ADD CONSTRAINT employee_sessions_role_check CHECK (role IN ('garcom','cozinha'));

-- 3. Hash trigger updated to also hash kitchen_password
CREATE OR REPLACE FUNCTION public.hash_employee_password()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.employee_password IS NOT NULL
     AND NEW.employee_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.employee_password IS DISTINCT FROM OLD.employee_password)
     AND NEW.employee_password NOT LIKE '$2%$%' THEN
    NEW.employee_password := extensions.crypt(NEW.employee_password, extensions.gen_salt('bf'));
  END IF;
  IF NEW.employee_password = '' THEN NEW.employee_password := NULL; END IF;

  IF NEW.kitchen_password IS NOT NULL
     AND NEW.kitchen_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.kitchen_password IS DISTINCT FROM OLD.kitchen_password)
     AND NEW.kitchen_password NOT LIKE '$2%$%' THEN
    NEW.kitchen_password := extensions.crypt(NEW.kitchen_password, extensions.gen_salt('bf'));
  END IF;
  IF NEW.kitchen_password = '' THEN NEW.kitchen_password := NULL; END IF;

  RETURN NEW;
END;
$$;

-- 4. Revoke trigger handles both passwords
CREATE OR REPLACE FUNCTION public.revoke_employee_sessions_on_password_clear()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_password IS NULL AND OLD.employee_password IS NOT NULL THEN
    DELETE FROM public.employee_sessions WHERE kiosk_user_id = NEW.id AND role = 'garcom';
  END IF;
  IF NEW.kitchen_password IS NULL AND OLD.kitchen_password IS NOT NULL THEN
    DELETE FROM public.employee_sessions WHERE kiosk_user_id = NEW.id AND role = 'cozinha';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_employee_sessions ON public.profiles;
CREATE TRIGGER trg_revoke_employee_sessions
AFTER UPDATE OF employee_password, kitchen_password ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.revoke_employee_sessions_on_password_clear();

-- 5. New login with role
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text, _role text DEFAULT 'garcom')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _row RECORD;
  _token uuid;
  _hash text;
BEGIN
  IF _role NOT IN ('garcom','cozinha') THEN
    RAISE EXCEPTION 'Cargo invÃ¡lido';
  END IF;
  SELECT id, kiosk_name, kiosk_code, employee_password, kitchen_password
    INTO _row
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Quiosque nÃ£o encontrado';
  END IF;
  _hash := CASE WHEN _role = 'cozinha' THEN _row.kitchen_password ELSE _row.employee_password END;
  IF _hash IS NULL OR length(_hash) = 0 THEN
    RAISE EXCEPTION 'O dono ainda nÃ£o definiu a senha para este cargo';
  END IF;
  IF _hash <> extensions.crypt(_password, _hash) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  INSERT INTO public.employee_sessions (kiosk_user_id, role) VALUES (_row.id, _role) RETURNING token INTO _token;
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code,
    'role', _role
  );
END;
$$;
-- 20260617112140_8f290dad-2d0c-47a4-9218-08117386b8fe.sql

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.employee_set_item_delivered_v2(_token uuid, _item_id uuid, _delivered boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee_token(_token);
  UPDATE public.order_items oi
     SET delivered = _delivered
   FROM public.orders o
   WHERE oi.id = _item_id
     AND oi.order_id = o.id
     AND o.user_id = _owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item nÃ£o encontrado'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders_v2(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _result jsonb;
BEGIN
  _owner := public._verify_employee_token(_token);
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at), '[]'::jsonb)
    INTO _result
  FROM (
    SELECT
      o.id, o.table_number, o.customer_name, o.customer_phone,
      o.status, o.total, o.notes, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'name', oi.name, 'quantity', oi.quantity,
          'price', oi.price, 'notes', oi.notes, 'delivered', oi.delivered
        ))
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END;
$$;

-- 20260617112440_2cf8f470-4042-4a41-af3d-14bda2e99680.sql

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.employee_close_order_v2(_token uuid, _order_id uuid, _payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _total numeric(10,2); _table text;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _payment_method NOT IN ('dinheiro','pix','cartao','outro') THEN
    RAISE EXCEPTION 'Forma de pagamento invÃ¡lida';
  END IF;
  SELECT total, table_number INTO _total, _table
    FROM public.orders WHERE id = _order_id AND user_id = _owner;
  IF _total IS NULL THEN RAISE EXCEPTION 'Pedido nÃ£o encontrado'; END IF;

  UPDATE public.orders
     SET status = 'entregue',
         payment_method = _payment_method,
         closed_at = now()
   WHERE id = _order_id AND user_id = _owner;

  INSERT INTO public.transactions (user_id, type, amount, description, category)
  VALUES (_owner, 'income', _total, 'Mesa ' || _table || ' â€” ' || _payment_method, 'venda');
END;
$$;

-- 20260617112508_baf1dd13-ec17-4652-ba59-f6ac69deb9cb.sql

CREATE OR REPLACE FUNCTION public.employee_close_order_v2(_token uuid, _order_id uuid, _payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _total numeric(10,2); _table text;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _payment_method NOT IN ('dinheiro','pix','cartao','outro') THEN
    RAISE EXCEPTION 'Forma de pagamento invÃ¡lida';
  END IF;
  SELECT total, table_number INTO _total, _table
    FROM public.orders WHERE id = _order_id AND user_id = _owner;
  IF _total IS NULL THEN RAISE EXCEPTION 'Pedido nÃ£o encontrado'; END IF;

  UPDATE public.orders
     SET status = 'entregue',
         payment_method = _payment_method,
         closed_at = now()
   WHERE id = _order_id AND user_id = _owner;

  INSERT INTO public.transactions (user_id, type, amount, description, category, payment_method)
  VALUES (_owner, 'income', _total, 'Mesa ' || _table, 'venda', _payment_method);
END;
$$;

-- 20260617113004_eab3ba25-d7c4-47f0-aa74-062143ad1338.sql

CREATE OR REPLACE FUNCTION public.employee_place_order_v2(_token uuid, _table_number text, _customer_name text, _items jsonb, _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _order_id uuid;
  _total numeric(10,2) := 0;
  _added numeric(10,2) := 0;
  _it jsonb;
  _price numeric(10,2);
  _name text;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _table_number IS NULL OR length(trim(_table_number)) = 0 THEN
    RAISE EXCEPTION 'Mesa obrigatÃ³ria';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido vazio';
  END IF;

  -- Reusa pedido em aberto da mesma mesa, se houver
  SELECT id, total INTO _order_id, _total
    FROM public.orders
   WHERE user_id = _owner
     AND table_number = _table_number
     AND status IN ('novo','preparando','pronto')
   ORDER BY created_at DESC
   LIMIT 1;

  IF _order_id IS NULL THEN
    INSERT INTO public.orders (user_id, table_number, customer_name, notes)
    VALUES (_owner, _table_number, COALESCE(NULLIF(trim(_customer_name),''), 'Mesa ' || _table_number), _notes)
    RETURNING id INTO _order_id;
    _total := 0;
  ELSIF _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN
    UPDATE public.orders
       SET notes = CASE WHEN notes IS NULL OR notes = '' THEN _notes ELSE notes || E'\n' || _notes END
     WHERE id = _order_id;
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT price, name INTO _price, _name FROM public.menu_items
      WHERE id = (_it->>'menu_item_id')::uuid AND user_id = _owner AND is_available = true;
    IF _price IS NULL THEN
      RAISE EXCEPTION 'Item indisponÃ­vel';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
    VALUES (_order_id, (_it->>'menu_item_id')::uuid, _name, _price, (_it->>'quantity')::int, _it->>'notes');
    _added := _added + _price * (_it->>'quantity')::int;
  END LOOP;

  -- Volta a mesa para 'novo' se jÃ¡ estava pronta/preparando, para a cozinha ver os novos itens
  UPDATE public.orders SET total = _total + _added, status = 'novo' WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders_v2(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _result jsonb;
BEGIN
  _owner := public._verify_employee_token(_token);
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at), '[]'::jsonb)
    INTO _result
  FROM (
    SELECT
      o.id, o.table_number, o.customer_name, o.customer_phone,
      o.status, o.total, o.notes, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'name', oi.name, 'quantity', oi.quantity,
          'price', oi.price, 'notes', oi.notes, 'delivered', oi.delivered,
          'created_at', oi.created_at
        ) ORDER BY oi.created_at)
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END;
$$;

-- 20260617113359_361a3206-1099-45cd-bce8-7432b9d998b4.sql

CREATE OR REPLACE FUNCTION public._recalc_order_total(_order_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.orders SET total = COALESCE((
    SELECT SUM(price * quantity) FROM public.order_items WHERE order_id = _order_id
  ), 0) WHERE id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.employee_remove_order_item_v2(_token uuid, _item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _owner uuid; _order_id uuid; _delivered boolean;
BEGIN
  _owner := public._verify_employee_token(_token);
  SELECT oi.order_id, oi.delivered INTO _order_id, _delivered
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
   WHERE oi.id = _item_id AND o.user_id = _owner;
  IF _order_id IS NULL THEN RAISE EXCEPTION 'Item nÃ£o encontrado'; END IF;
  IF _delivered THEN RAISE EXCEPTION 'Item jÃ¡ entregue nÃ£o pode ser removido'; END IF;
  DELETE FROM public.order_items WHERE id = _item_id;
  PERFORM public._recalc_order_total(_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_update_item_quantity_v2(_token uuid, _item_id uuid, _quantity int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _owner uuid; _order_id uuid; _delivered boolean;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _quantity < 1 THEN RAISE EXCEPTION 'Quantidade deve ser ao menos 1'; END IF;
  SELECT oi.order_id, oi.delivered INTO _order_id, _delivered
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
   WHERE oi.id = _item_id AND o.user_id = _owner;
  IF _order_id IS NULL THEN RAISE EXCEPTION 'Item nÃ£o encontrado'; END IF;
  IF _delivered THEN RAISE EXCEPTION 'Item jÃ¡ entregue nÃ£o pode ser alterado'; END IF;
  UPDATE public.order_items SET quantity = _quantity WHERE id = _item_id;
  PERFORM public._recalc_order_total(_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_cancel_order_v2(_token uuid, _order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _owner uuid; _has_delivered boolean;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND user_id = _owner) THEN
    RAISE EXCEPTION 'Pedido nÃ£o encontrado';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND delivered = true)
    INTO _has_delivered;
  IF _has_delivered THEN
    RAISE EXCEPTION 'NÃ£o Ã© possÃ­vel cancelar: jÃ¡ hÃ¡ itens entregues';
  END IF;
  UPDATE public.orders SET status = 'cancelado' WHERE id = _order_id;
END;
$$;

-- 20260617114928_a643726e-4da3-4112-9b9a-be23e5ba6468.sql

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_table_status ON public.orders (user_id, table_number, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_delivered ON public.order_items (order_id) WHERE delivered = false;
CREATE INDEX IF NOT EXISTS idx_menu_items_user ON public.menu_items (user_id, is_available);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_token ON public.employee_sessions (token);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_kiosk ON public.employee_sessions (kiosk_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_kiosk_code ON public.profiles (upper(kiosk_code));
CREATE INDEX IF NOT EXISTS idx_products_user_active ON public.products (user_id) WHERE is_active = true;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.menu_items;
ANALYZE public.transactions;

