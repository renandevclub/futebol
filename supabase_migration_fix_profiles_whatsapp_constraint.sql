-- ==============================================================================
-- ⚽ MIGRAÇÃO: CORREÇÃO DA CONSTRAINT profiles_whatsapp_key
-- Permite cadastro de jogadores avulsos sem WhatsApp sem colidir na constraint UNIQUE
-- ==============================================================================

-- 1. Permitir que whatsapp seja NULL na tabela profiles
ALTER TABLE public.profiles ALTER COLUMN whatsapp DROP NOT NULL;

-- 2. Converter perfis legados com whatsapp em branco/vazio para NULL
UPDATE public.profiles 
SET whatsapp = NULL 
WHERE whatsapp IS NOT NULL AND trim(whatsapp) = '';

-- 3. Função e trigger para garantir que strings vazias sejam sempre salvas como NULL
CREATE OR REPLACE FUNCTION public.trg_normalize_profile_whatsapp()
RETURNS trigger AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL AND length(trim(NEW.whatsapp)) = 0 THEN
    NEW.whatsapp := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_profile_whatsapp ON public.profiles;
CREATE TRIGGER trg_clean_profile_whatsapp
BEFORE INSERT OR UPDATE OF whatsapp ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_profile_whatsapp();

-- 4. Atualizar RPC admin_add_match_player para salvar NULLIF(trim(p_whatsapp), '')
CREATE OR REPLACE FUNCTION public.admin_add_match_player(
    p_match_id uuid, 
    p_player_name text, 
    p_whatsapp text DEFAULT NULL::text, 
    p_team integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_caller_id UUID := auth.uid();
    v_org_id UUID;
    v_target_user_id UUID;
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_participant_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Validar se o chamador pode administrar a partida
    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para gerenciar jogadores desta partida.';
    END IF;

    v_clean_name := trim(p_player_name);
    IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Nome do jogador é obrigatório.';
    END IF;

    v_clean_phone := NULLIF(trim(p_whatsapp), '');

    -- Obter a liga da partida
    SELECT organization_id INTO v_org_id
    FROM matches
    WHERE id = p_match_id;

    -- 1. Verificar se já existe um perfil com esse whatsapp
    IF v_clean_phone IS NOT NULL THEN
        SELECT id INTO v_target_user_id
        FROM profiles
        WHERE whatsapp = v_clean_phone
        LIMIT 1;
    END IF;

    -- Se não achou por whatsapp, verifica se já existe membro da liga com o mesmo nome exato
    IF v_target_user_id IS NULL AND v_org_id IS NOT NULL THEN
        SELECT p.id INTO v_target_user_id
        FROM profiles p
        INNER JOIN organization_members om ON om.user_id = p.id
        WHERE om.organization_id = v_org_id
          AND lower(trim(p.nome)) = lower(v_clean_name)
        LIMIT 1;
    END IF;

    -- 2. Se não encontrou perfil existente, cria um novo perfil de jogador
    IF v_target_user_id IS NULL THEN
        INSERT INTO profiles (
            id,
            nome,
            whatsapp,
            role,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_clean_name,
            v_clean_phone,
            'player',
            now()
        )
        RETURNING id INTO v_target_user_id;
    END IF;

    -- 3. Vincular à liga na tabela organization_members (se a partida tiver liga)
    IF v_org_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (v_org_id, v_target_user_id, 'player')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;

    -- 4. Verificar se já está inscrito nesta partida
    SELECT id INTO v_participant_id
    FROM match_participants
    WHERE match_id = p_match_id AND user_id = v_target_user_id
    LIMIT 1;

    IF v_participant_id IS NOT NULL THEN
        -- Se já existe, atualiza time se fornecido
        IF p_team IS NOT NULL THEN
            UPDATE match_participants
            SET team = p_team
            WHERE id = v_participant_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Jogador já estava na lista e foi atualizado.',
            'participant_id', v_participant_id,
            'user_id', v_target_user_id,
            'already_joined', true
        );
    END IF;

    -- 5. Inserir na tabela match_participants
    INSERT INTO match_participants (
        id,
        match_id,
        user_id,
        team,
        paid,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_match_id,
        v_target_user_id,
        p_team,
        false,
        now()
    )
    RETURNING id INTO v_participant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Jogador adicionado à lista da partida com sucesso.',
        'participant_id', v_participant_id,
        'user_id', v_target_user_id,
        'already_joined', false
    );
END;
$function$;
