
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
  IF _order_id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF _delivered THEN RAISE EXCEPTION 'Item já entregue não pode ser removido'; END IF;
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
  IF _order_id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF _delivered THEN RAISE EXCEPTION 'Item já entregue não pode ser alterado'; END IF;
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
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND delivered = true)
    INTO _has_delivered;
  IF _has_delivered THEN
    RAISE EXCEPTION 'Não é possível cancelar: já há itens entregues';
  END IF;
  UPDATE public.orders SET status = 'cancelado' WHERE id = _order_id;
END;
$$;
