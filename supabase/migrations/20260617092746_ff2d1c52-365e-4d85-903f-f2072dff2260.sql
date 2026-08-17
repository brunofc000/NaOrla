
-- 1. Código do garçom no perfil
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

-- 4. RPC pública: valida código do garçom e cria pedido atomicamente
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
    RAISE EXCEPTION 'Mesa obrigatória';
  END IF;
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Nome do cliente obrigatório';
  END IF;
  IF _customer_cpf IS NULL OR length(regexp_replace(_customer_cpf,'\D','','g')) < 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  SELECT waiter_code INTO _expected FROM public.profiles WHERE id = _kiosk_user_id;
  IF _expected IS NULL OR _expected <> _waiter_code THEN
    RAISE EXCEPTION 'Código do garçom inválido';
  END IF;

  INSERT INTO public.orders (user_id, table_number, customer_name, customer_phone, customer_cpf, notes)
  VALUES (_kiosk_user_id, _table_number, _customer_name, _customer_phone, regexp_replace(_customer_cpf,'\D','','g'), _notes)
  RETURNING id INTO _order_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT price, name INTO _price, _name FROM public.menu_items
      WHERE id = (_it->>'menu_item_id')::uuid AND user_id = _kiosk_user_id AND is_available = true;
    IF _price IS NULL THEN
      RAISE EXCEPTION 'Item indisponível';
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
