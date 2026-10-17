-- ============================================================
-- MIGRAÇÃO: auth_foundation_security_v1
-- Sistema: F&V Sports
-- Escopo: Tabelas de convites, recuperação, auditoria e colunas em profiles
-- ============================================================

-- 1. Criação da tabela de convites (user_invites)
CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  code_hint TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'revoked')),
  max_uses INTEGER NOT NULL DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_invites_code_hash ON public.user_invites(code_hash);
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON public.user_invites(status);
CREATE INDEX IF NOT EXISTS idx_user_invites_created_by ON public.user_invites(created_by);

-- 2. Criação da tabela de recuperação de senha administrativa (password_recovery_requests)
CREATE TABLE IF NOT EXISTS public.password_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired', 'invalidated', 'failed')),
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_pwd_recovery_target ON public.password_recovery_requests(target_profile_id);
CREATE INDEX IF NOT EXISTS idx_pwd_recovery_code_hash ON public.password_recovery_requests(code_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_recovery_status ON public.password_recovery_requests(status);

-- 3. Criação da tabela de auditoria administrativa (admin_audit_logs)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs(created_at DESC);

-- 4. Adição de colunas compatíveis em public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_normalized TEXT,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'blocked', 'pending')),
  ADD COLUMN IF NOT EXISTS signup_origin TEXT NOT NULL DEFAULT 'without_invite' CHECK (signup_origin IN ('with_invite', 'without_invite')),
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES public.user_invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unblocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_password_recovery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 5. Atualização dos perfis existentes com whatsapp normalizado e status ativo
UPDATE public.profiles
SET 
  whatsapp_normalized = regexp_replace(whatsapp, '^55', ''),
  account_status = COALESCE(account_status, 'active'),
  signup_origin = COALESCE(signup_origin, 'without_invite'),
  updated_at = now()
WHERE whatsapp IS NOT NULL AND (whatsapp_normalized IS NULL OR whatsapp_normalized = '');

UPDATE public.profiles
SET 
  account_status = COALESCE(account_status, 'active'),
  signup_origin = COALESCE(signup_origin, 'without_invite'),
  updated_at = now()
WHERE whatsapp IS NULL AND account_status IS NULL;

-- 6. Índice único para telefone normalizado (ignora nulos para convidados avulsos sem WhatsApp)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_whatsapp_normalized_unique 
  ON public.profiles(whatsapp_normalized) 
  WHERE whatsapp_normalized IS NOT NULL;

-- 7. Habilitar RLS em todas as novas tabelas
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Políticas de RLS para as novas tabelas
CREATE POLICY "Superadmin full access to user_invites"
  ON public.user_invites
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Superadmin full access to password_recovery_requests"
  ON public.password_recovery_requests
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Superadmin read access to admin_audit_logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Authenticated insert to admin_audit_logs"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
