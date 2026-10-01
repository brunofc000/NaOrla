-- ============================================================
-- Venda avulsa (dono + garçom) + Clientes fiéis / fiado (só dono)
-- ============================================================

-- 1. Tabela de clientes (fiéis) — gerenciada apenas pelo dono
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_user ON public.customers(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers owner all" ON public.customers;
CREATE POLICY "Customers owner all" ON public.customers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Colunas de cliente / fiado / vendedor em transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_fiado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fiado_paid_at TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by_employee TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_customer ON public.transactions(customer_id);

-- 3. Garçom: listar produtos do estoque (para venda avulsa)
CREATE OR REPLACE FUNCTION public.employee_get_products_v2(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE _owner uuid; _result jsonb;
BEGIN
  _owner := public._verify_employee_token(_token);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'barcode', p.barcode,
    'sell_price', p.sell_price, 'quantity', p.quantity,
    'unit', p.unit, 'category', p.category
  ) ORDER BY p.name), '[]'::jsonb) INTO _result
  FROM public.products p
  WHERE p.user_id = _owner AND p.is_active = true;
  RETURN _result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.employee_get_products_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_get_products_v2(uuid) TO anon, authenticated;

-- 4. Venda avulsa: cria a transação + itens + baixa estoque.
--    Dono: auth.uid() (pode usar fiado e cliente fiel).
--    Garçom: _token (NUNCA pode vender fiado nem vincular cliente fiel).
CREATE OR REPLACE FUNCTION public.create_walkin_sale(
  _items jsonb,                 -- [{kind: 'product'|'menu', id: uuid, name: text, quantity: int, price: numeric}]
  _payment_method text,         -- dinheiro | pix | cartao | outro | fiado
  _customer_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _token uuid DEFAULT NULL,     -- preenchido = garçom
  _seller_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  _owner uuid;
  _tx_id uuid;
  _total numeric(10,2) := 0;
  _item jsonb;
  _qty integer;
  _price numeric(10,2);
  _product record;
  _new_qty integer;
BEGIN
  IF _payment_method NOT IN ('dinheiro','pix','cartao','outro','fiado') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF _token IS NOT NULL THEN
    _owner := public._verify_employee_token(_token);
    IF _payment_method = 'fiado' THEN
      RAISE EXCEPTION 'Apenas o dono pode vender fiado';
    END IF;
    _customer_id := NULL; -- venda para cliente fiel é exclusiva do dono
  ELSE
    _owner := auth.uid();
    IF _owner IS NULL THEN
      RAISE EXCEPTION 'Sessão inválida';
    END IF;
  END IF;

  IF _payment_method = 'fiado' AND _customer_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o cliente para vender fiado';
  END IF;

  IF COALESCE(jsonb_array_length(_items), 0) = 0 THEN
    RAISE EXCEPTION 'Venda sem itens';
  END IF;

  -- Calcula o total e valida quantidades
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'quantity')::integer, 0);
    _price := COALESCE((_item->>'price')::numeric, 0);
    IF _qty < 1 THEN
      RAISE EXCEPTION 'Quantidade inválida';
    END IF;
    _total := _total + (_qty * _price);
  END LOOP;

  INSERT INTO public.transactions
    (user_id, type, amount, description, category, payment_method, customer_id, is_fiado, created_by_employee)
  VALUES
    (_owner, 'income', _total,
     COALESCE('Venda avulsa — ' || NULLIF(trim(_notes), ''), 'Venda avulsa'),
     'venda',
     _payment_method,
     _customer_id,
     (_payment_method = 'fiado'),
     NULLIF(trim(COALESCE(_seller_name, '')), ''))
  RETURNING id INTO _tx_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::integer;
    _price := COALESCE((_item->>'price')::numeric, 0);

    INSERT INTO public.sale_items
      (transaction_id, user_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES
      (_tx_id, _owner,
       CASE WHEN _item->>'kind' = 'product' THEN (_item->>'id')::uuid ELSE NULL END,
       _item->>'name', _qty, _price, _qty * _price);

    -- Baixa de estoque
    _product := NULL;
    IF _item->>'kind' = 'product' THEN
      SELECT * INTO _product FROM public.products
      WHERE id = (_item->>'id')::uuid AND user_id = _owner;
    ELSE
      -- Item do cardápio: baixa o produto de mesmo nome (mesma lógica do close_order)
      SELECT * INTO _product FROM public.products
      WHERE user_id = _owner AND lower(name) = lower(_item->>'name') AND is_active = true
      LIMIT 1;
    END IF;

    IF _product.id IS NOT NULL THEN
      _new_qty := _product.quantity - _qty;
      UPDATE public.products SET quantity = _new_qty WHERE id = _product.id;

      INSERT INTO public.stock_history
        (product_id, user_id, quantity_change, previous_quantity, new_quantity, reason, notes)
      VALUES
        (_product.id, _owner, -_qty, _product.quantity, _new_qty, 'sale', 'Venda avulsa');
    END IF;
  END LOOP;

  RETURN _tx_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_walkin_sale(jsonb, text, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_walkin_sale(jsonb, text, uuid, text, uuid, text) TO anon, authenticated;