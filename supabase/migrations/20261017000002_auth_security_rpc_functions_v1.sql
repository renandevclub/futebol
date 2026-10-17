-- ============================================================
-- MIGRAÇÃO: auth_security_rpc_functions_v1
-- Sistema: F&V Sports
-- Escopo: RPCs de normalização, convites, bloqueio e auditoria
-- ============================================================

-- 1. Função determinística para normalização de telefone brasileiro
CREATE OR REPLACE FUNCTION public.normalize_phone_br(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  
  -- Se tiver DDI 55 com 12 ou 13 dígitos, remove o prefixo 55
  IF length(v_digits) >= 12 AND starts_with(v_digits, '55') THEN
    v_digits := substring(v_digits from 3);
  END IF;

  IF length(v_digits) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN v_digits;
END;
$$;

-- 2. Função de validação prévia de convite (segura, executada pelo cliente antes/durante cadastro)
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.user_invites;
BEGIN
  IF p_code_hash IS NULL OR trim(p_code_hash) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código de convite não fornecido.');
  END IF;

  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE code_hash = p_code_hash;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Convite inválido ou não encontrado.');
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este convite foi revogado.');
  END IF;

  IF v_invite.expires_at < now() OR v_invite.status = 'expired' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este convite expirou.');
  END IF;

  IF v_invite.use_count >= v_invite.max_uses OR v_invite.status = 'used' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este convite já foi utilizado.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invite_id', v_invite.id,
    'expires_at', v_invite.expires_at,
    'note', v_invite.note
  );
END;
$$;

-- 3. Função de consumo atômico de convite (com lock exclusivo de linha FOR UPDATE)
CREATE OR REPLACE FUNCTION public.consume_invite_atomic(
  p_code_hash TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.user_invites;
BEGIN
  IF p_code_hash IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parâmetros inválidos.');
  END IF;

  -- Lock pessimista na linha do convite para evitar condições de corrida em cadastros simultâneos
  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido.');
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite revogado.');
  END IF;

  IF v_invite.expires_at < now() OR v_invite.status = 'expired' THEN
    UPDATE public.user_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado.');
  END IF;

  IF v_invite.use_count >= v_invite.max_uses OR v_invite.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite já utilizado.');
  END IF;

  -- Consome o convite
  UPDATE public.user_invites
  SET 
    use_count = use_count + 1,
    status = 'used',
    used_at = now(),
    used_by = p_user_id
  WHERE id = v_invite.id;

  -- Registra na auditoria
  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    success
  ) VALUES (
    p_user_id,
    p_user_id,
    'consume_invite',
    'user_invites',
    v_invite.id::text,
    jsonb_build_object('invite_id', v_invite.id, 'code_hint', v_invite.code_hint),
    true
  );

  RETURN jsonb_build_object('success', true, 'invite_id', v_invite.id);
END;
$$;

-- 4. Função administrativa para bloquear usuário
CREATE OR REPLACE FUNCTION public.admin_block_user(
  p_target_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile public.profiles;
  v_target_profile public.profiles;
  v_superadmin_count INT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Super Administradores podem bloquear usuários.');
  END IF;

  SELECT * INTO v_caller_profile
  FROM public.profiles
  WHERE (auth_id = auth.uid() OR id = auth.uid())
  LIMIT 1;

  v_caller_id := v_caller_profile.id;

  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_id;

  IF v_target_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  END IF;

  IF v_target_profile.id = v_caller_id OR v_target_profile.auth_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode bloquear a sua própria conta de Super Administrador.');
  END IF;

  IF v_target_profile.role = 'super_admin' THEN
    SELECT count(*) INTO v_superadmin_count
    FROM public.profiles
    WHERE role = 'super_admin' AND account_status = 'active';

    IF v_superadmin_count <= 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não é permitido bloquear o único Super Administrador ativo do sistema.');
    END IF;
  END IF;

  UPDATE public.profiles
  SET 
    account_status = 'blocked',
    blocked_at = now(),
    blocked_by = v_caller_id,
    unblocked_at = NULL,
    unblocked_by = NULL,
    status_reason = p_reason,
    updated_at = now()
  WHERE id = p_target_id;

  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    success
  ) VALUES (
    v_caller_id,
    p_target_id,
    'block_user',
    'profiles',
    p_target_id::text,
    jsonb_build_object('reason', p_reason, 'target_nome', v_target_profile.nome, 'target_phone', v_target_profile.whatsapp),
    true
  );

  RETURN jsonb_build_object('success', true, 'message', 'Usuário bloqueado com sucesso.');
END;
$$;

-- 5. Função administrativa para reativar usuário
CREATE OR REPLACE FUNCTION public.admin_unblock_user(
  p_target_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile public.profiles;
  v_target_profile public.profiles;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Super Administradores podem reativar usuários.');
  END IF;

  SELECT * INTO v_caller_profile
  FROM public.profiles
  WHERE (auth_id = auth.uid() OR id = auth.uid())
  LIMIT 1;

  v_caller_id := v_caller_profile.id;

  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_id;

  IF v_target_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  END IF;

  UPDATE public.profiles
  SET 
    account_status = 'active',
    unblocked_at = now(),
    unblocked_by = v_caller_id,
    status_reason = p_reason,
    updated_at = now()
  WHERE id = p_target_id;

  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    success
  ) VALUES (
    v_caller_id,
    p_target_id,
    'unblock_user',
    'profiles',
    p_target_id::text,
    jsonb_build_object('reason', p_reason, 'target_nome', v_target_profile.nome),
    true
  );

  RETURN jsonb_build_object('success', true, 'message', 'Usuário reativado com sucesso.');
END;
$$;

-- 6. Atualização de sync_profile_for_auth_user para compatibilidade com whatsapp_normalized e status
CREATE OR REPLACE FUNCTION public.sync_profile_for_auth_user()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_meta JSONB;
  v_phone TEXT;
  v_clean_phone TEXT;
  v_nome TEXT;
  v_signup_origin TEXT;
  v_invite_id_str TEXT;
  v_invite_id UUID;
  v_profile public.profiles;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Primeiro tenta buscar se já tem profile com este auth_id
  SELECT * INTO v_profile FROM public.profiles WHERE auth_id = v_user_id LIMIT 1;
  IF v_profile.id IS NOT NULL THEN
    -- Atualiza último login
    UPDATE public.profiles SET last_login_at = now() WHERE id = v_profile.id;
    RETURN v_profile;
  END IF;

  -- 2. Busca dados de auth.users
  SELECT raw_user_meta_data, phone INTO v_user_meta, v_phone FROM auth.users WHERE id = v_user_id;
  v_clean_phone := public.normalize_phone_br(COALESCE(v_user_meta->>'whatsapp', v_phone, ''));
  v_nome := COALESCE(v_user_meta->>'nome', split_part(COALESCE(v_user_meta->>'email', ''), '@', 1), 'Jogador');
  v_signup_origin := COALESCE(v_user_meta->>'signup_origin', 'without_invite');
  v_invite_id_str := v_user_meta->>'invite_id';
  
  IF v_invite_id_str IS NOT NULL AND v_invite_id_str <> '' THEN
    BEGIN
      v_invite_id := v_invite_id_str::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_invite_id := NULL;
    END;
  END IF;

  -- 3. Tenta localizar perfil existente pelo telefone normalizado
  IF v_clean_phone IS NOT NULL AND v_clean_phone <> '' THEN
    SELECT * INTO v_profile 
    FROM public.profiles 
    WHERE (whatsapp_normalized = v_clean_phone OR whatsapp = v_clean_phone)
      AND (auth_id IS NULL OR auth_id = v_user_id)
    ORDER BY created_at ASC 
    LIMIT 1;

    IF v_profile.id IS NOT NULL THEN
      UPDATE public.profiles
      SET 
        auth_id = v_user_id,
        whatsapp_normalized = COALESCE(whatsapp_normalized, v_clean_phone),
        signup_origin = CASE WHEN v_invite_id IS NOT NULL THEN 'with_invite' ELSE signup_origin END,
        invite_id = COALESCE(invite_id, v_invite_id),
        last_login_at = now(),
        updated_at = now()
      WHERE id = v_profile.id
      RETURNING * INTO v_profile;
      
      RETURN v_profile;
    END IF;
  END IF;

  -- 4. Se não existir perfil, cria um novo respeitando a normalização
  INSERT INTO public.profiles (
    id,
    auth_id,
    nome,
    apelido,
    whatsapp,
    whatsapp_normalized,
    genero,
    role,
    account_status,
    signup_origin,
    invite_id,
    last_login_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_nome,
    v_user_meta->>'apelido',
    v_clean_phone,
    v_clean_phone,
    COALESCE(v_user_meta->>'genero', 'masculino'),
    'participant',
    'active',
    v_signup_origin,
    v_invite_id,
    now(),
    now(),
    now()
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;
