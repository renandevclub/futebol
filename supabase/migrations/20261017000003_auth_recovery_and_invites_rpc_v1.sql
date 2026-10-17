-- ============================================================
-- MIGRAÇÃO: auth_recovery_and_invites_rpc_v1
-- Sistema: F&V Sports
-- Escopo: RPCs completas para criação/revogação de convites e geração/uso de recuperação de senha
-- ============================================================

-- 1. Função administrativa para criar convite
CREATE OR REPLACE FUNCTION public.admin_create_invite(
  p_note TEXT DEFAULT NULL,
  p_days_valid INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_raw_code TEXT;
  v_code_hash TEXT;
  v_code_hint TEXT;
  v_invite_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Super Administradores podem gerar convites.');
  END IF;

  SELECT id INTO v_caller_id
  FROM public.profiles
  WHERE (auth_id = auth.uid() OR id = auth.uid())
  LIMIT 1;

  -- Gera código no formato FV-XXXXXX (6 caracteres alfanuméricos em caixa alta)
  v_raw_code := 'FV-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
  v_code_hash := encode(digest(v_raw_code, 'sha256'), 'hex');
  v_code_hint := substring(v_raw_code from 1 for 5) || '...';
  v_expires_at := now() + (COALESCE(p_days_valid, 7) || ' days')::INTERVAL;

  INSERT INTO public.user_invites (
    code_hash,
    code_hint,
    created_by,
    created_at,
    expires_at,
    status,
    max_uses,
    use_count,
    note
  ) VALUES (
    v_code_hash,
    v_code_hint,
    v_caller_id,
    now(),
    v_expires_at,
    'available',
    1,
    0,
    p_note
  )
  RETURNING id INTO v_invite_id;

  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    success
  ) VALUES (
    v_caller_id,
    'create_invite',
    'user_invites',
    v_invite_id::text,
    jsonb_build_object('code_hint', v_code_hint, 'expires_at', v_expires_at, 'note', p_note),
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'code', v_raw_code,
    'code_hint', v_code_hint,
    'expires_at', v_expires_at
  );
END;
$$;

-- 2. Função administrativa para revogar convite
CREATE OR REPLACE FUNCTION public.admin_revoke_invite(
  p_invite_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_invite public.user_invites;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Super Administradores podem revogar convites.');
  END IF;

  SELECT id INTO v_caller_id
  FROM public.profiles
  WHERE (auth_id = auth.uid() OR id = auth.uid())
  LIMIT 1;

  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE id = p_invite_id;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado.');
  END IF;

  IF v_invite.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este convite já foi utilizado e não pode ser revogado.');
  END IF;

  UPDATE public.user_invites
  SET 
    status = 'revoked',
    revoked_at = now(),
    revoked_by = v_caller_id
  WHERE id = p_invite_id;

  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    success
  ) VALUES (
    v_caller_id,
    'revoke_invite',
    'user_invites',
    p_invite_id::text,
    jsonb_build_object('code_hint', v_invite.code_hint),
    true
  );

  RETURN jsonb_build_object('success', true, 'message', 'Convite revogado com sucesso.');
END;
$$;

-- 3. Função administrativa para gerar código de recuperação de senha
CREATE OR REPLACE FUNCTION public.admin_generate_password_recovery(
  p_target_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_target_profile public.profiles;
  v_plain_code TEXT;
  v_code_hash TEXT;
  v_recovery_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Super Administradores podem gerar códigos de recuperação.');
  END IF;

  SELECT id INTO v_caller_id
  FROM public.profiles
  WHERE (auth_id = auth.uid() OR id = auth.uid())
  LIMIT 1;

  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_profile_id;

  IF v_target_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  END IF;

  IF v_target_profile.auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este usuário ainda não concluiu o cadastro no sistema (sem conta de autenticação vinculada).');
  END IF;

  -- Invalida solicitações anteriores ainda pendentes para esta conta
  UPDATE public.password_recovery_requests
  SET 
    status = 'invalidated',
    invalidated_at = now()
  WHERE target_profile_id = p_target_profile_id AND status = 'pending';

  -- Gera código numérico de 6 dígitos de alta entropia (100000 a 999999)
  v_plain_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');
  v_code_hash := encode(digest(v_plain_code, 'sha256'), 'hex');
  v_expires_at := now() + INTERVAL '30 minutes';

  INSERT INTO public.password_recovery_requests (
    target_profile_id,
    code_hash,
    created_by,
    created_at,
    expires_at,
    status,
    attempt_count,
    max_attempts
  ) VALUES (
    p_target_profile_id,
    v_code_hash,
    v_caller_id,
    now(),
    v_expires_at,
    'pending',
    0,
    5
  )
  RETURNING id INTO v_recovery_id;

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
    p_target_profile_id,
    'generate_password_recovery',
    'password_recovery_requests',
    v_recovery_id::text,
    jsonb_build_object('expires_at', v_expires_at, 'target_nome', v_target_profile.nome),
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'recovery_id', v_recovery_id,
    'code', v_plain_code,
    'expires_at', v_expires_at,
    'target_nome', v_target_profile.nome,
    'target_whatsapp', v_target_profile.whatsapp
  );
END;
$$;

-- 4. Função pública segura para aplicar recuperação de senha com código temporário
CREATE OR REPLACE FUNCTION public.consume_password_recovery(
  p_whatsapp TEXT,
  p_code TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_phone TEXT;
  v_code_hash TEXT;
  v_target_profile public.profiles;
  v_recovery public.password_recovery_requests;
  v_auth_user_id UUID;
BEGIN
  IF p_whatsapp IS NULL OR p_code IS NULL OR p_new_password IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Todos os campos são obrigatórios.');
  END IF;

  v_clean_phone := public.normalize_phone_br(p_whatsapp);
  IF v_clean_phone IS NULL OR length(v_clean_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Número de WhatsApp inválido.');
  END IF;

  IF length(trim(p_new_password)) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A nova senha deve ter no mínimo 8 caracteres.');
  END IF;

  -- Proibir senha igual ao número de telefone
  IF trim(p_new_password) = v_clean_phone THEN
    RETURN jsonb_build_object('success', false, 'error', 'A senha não pode ser igual ao seu número de telefone.');
  END IF;

  -- Localiza o perfil pelo WhatsApp normalizado
  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE (whatsapp_normalized = v_clean_phone OR whatsapp = v_clean_phone)
  LIMIT 1;

  IF v_target_profile.id IS NULL OR v_target_profile.auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não encontramos uma conta cadastrada para este número.');
  END IF;

  v_auth_user_id := v_target_profile.auth_id;

  -- Busca o pedido de recuperação pendente mais recente
  SELECT * INTO v_recovery
  FROM public.password_recovery_requests
  WHERE target_profile_id = v_target_profile.id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_recovery.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum código de recuperação ativo foi solicitado para esta conta. Solicite um novo código ao administrador.');
  END IF;

  IF v_recovery.expires_at < now() THEN
    UPDATE public.password_recovery_requests SET status = 'expired' WHERE id = v_recovery.id;
    RETURN jsonb_build_object('success', false, 'error', 'O código de recuperação expirou. Solicite um novo código ao administrador.');
  END IF;

  IF v_recovery.attempt_count >= v_recovery.max_attempts THEN
    UPDATE public.password_recovery_requests SET status = 'failed' WHERE id = v_recovery.id;
    RETURN jsonb_build_object('success', false, 'error', 'Número de tentativas excedido. Solicite um novo código ao administrador.');
  END IF;

  v_code_hash := encode(digest(trim(p_code), 'sha256'), 'hex');

  IF v_code_hash <> v_recovery.code_hash THEN
    UPDATE public.password_recovery_requests
    SET 
      attempt_count = attempt_count + 1,
      last_attempt_at = now()
    WHERE id = v_recovery.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Código de recuperação incorreto. Tentativas restantes: ' || (v_recovery.max_attempts - v_recovery.attempt_count - 1)
    );
  END IF;

  -- Atualiza senha em auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
    updated_at = now()
  WHERE id = v_auth_user_id;

  -- Marca recuperação como concluída
  UPDATE public.password_recovery_requests
  SET 
    status = 'used',
    used_at = now()
  WHERE id = v_recovery.id;

  -- Atualiza perfil
  UPDATE public.profiles
  SET 
    last_password_recovery_at = now(),
    account_status = 'active',
    updated_at = now()
  WHERE id = v_target_profile.id;

  -- Registra auditoria
  INSERT INTO public.admin_audit_logs (
    target_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    success
  ) VALUES (
    v_target_profile.id,
    'consume_password_recovery',
    'password_recovery_requests',
    v_recovery.id::text,
    jsonb_build_object('recovery_id', v_recovery.id, 'whatsapp', v_clean_phone),
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Senha redefinida com sucesso! Você já pode entrar com sua nova senha.'
  );
END;
$$;
