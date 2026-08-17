
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
