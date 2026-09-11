-- Adicionar campos de plano e status na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- Criar política para o admin ver todos os perfis
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  auth.jwt()->>'email' = 'brunodfreitas02@gmail.com'
);

-- Criar política para o admin atualizar qualquer perfil
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (
  auth.jwt()->>'email' = 'brunodfreitas02@gmail.com'
);

-- Criar política para o admin deletar perfis
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated 
USING (
  auth.jwt()->>'email' = 'brunodfreitas02@gmail.com'
);