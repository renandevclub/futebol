-- ==============================================================================
-- ⚽ MIGRAÇÃO: GERENCIAMENTO COMPLETO DE JOGADORES DA LIGA E CONVIDADOS NA PARTIDA
-- Permite ao Administrador da Liga:
-- 1. Adicionar membros cadastrados da liga diretamente à partida
-- 2. Adicionar convidados avulsos (sem conta/cadastro) via guest_name sem poluir profiles
-- 3. Adicionar múltiplos membros ou múltiplos convidados em lote
-- 4. Validar duplicidade e respeitar limites de vagas da partida
-- 5. Alternar status de pagamento dos participantes
-- ==============================================================================

-- 1. RPC: Adicionar membro cadastrado da liga à partida
CREATE OR REPLACE FUNCTION admin_add_league_member_to_match(
    p_match_id UUID,
    p_user_id UUID,
    p_team INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_org_id UUID;
    v_max_participants INT;
    v_current_count INT;
    v_participant_id UUID;
    v_is_member BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Validar se o chamador pode administrar a partida
    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para gerenciar jogadores desta partida.';
    END IF;

    -- Obter dados da partida
    SELECT 
        organization_id, 
        COALESCE(limite_participantes, num_times * jogadores_por_time)
    INTO 
        v_org_id, 
        v_max_participants
    FROM matches
    WHERE id = p_match_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Partida não encontrada.';
    END IF;

    -- Verificar se o usuário pertence à liga
    SELECT EXISTS (
        SELECT 1 
        FROM organization_members 
        WHERE organization_id = v_org_id AND user_id = p_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        -- Auto-vincular o jogador à liga se ainda não estiver na organization_members
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'player')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;

    -- Verificar se já está inscrito na partida (Controle de Duplicidade)
    SELECT id INTO v_participant_id
    FROM match_participants
    WHERE match_id = p_match_id AND user_id = p_user_id
    LIMIT 1;

    IF v_participant_id IS NOT NULL THEN
        -- Atualizar time se fornecido
        IF p_team IS NOT NULL THEN
            UPDATE match_participants
            SET team = p_team
            WHERE id = v_participant_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Jogador já estava na lista da partida.',
            'participant_id', v_participant_id,
            'already_joined', true
        );
    END IF;

    -- Verificar limite de vagas da partida
    IF v_max_participants IS NOT NULL AND v_max_participants > 0 THEN
        SELECT count(*) INTO v_current_count
        FROM match_participants
        WHERE match_id = p_match_id;

        IF v_current_count >= v_max_participants THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'A partida já atingiu a lotação máxima de vagas (' || v_max_participants || ').'
            );
        END IF;
    END IF;

    -- Inserir participante vinculado ao perfil cadastrado
    INSERT INTO match_participants (
        id,
        match_id,
        user_id,
        guest_name,
        team,
        paid,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_match_id,
        p_user_id,
        NULL,
        p_team,
        false,
        now()
    )
    RETURNING id INTO v_participant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Jogador adicionado à partida com sucesso.',
        'participant_id', v_participant_id,
        'already_joined', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RPC: Adicionar jogador convidado (SEM CADASTRO / AVULSO) à partida
CREATE OR REPLACE FUNCTION admin_add_guest_player_to_match(
    p_match_id UUID,
    p_guest_name TEXT,
    p_team INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_clean_name TEXT;
    v_max_participants INT;
    v_current_count INT;
    v_participant_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para gerenciar jogadores desta partida.';
    END IF;

    v_clean_name := trim(p_guest_name);
    IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'O nome do convidado é obrigatório.'
        );
    END IF;

    -- Obter limite de vagas da partida
    SELECT COALESCE(limite_participantes, num_times * jogadores_por_time)
    INTO v_max_participants
    FROM matches
    WHERE id = p_match_id;

    -- Verificar limite de vagas
    IF v_max_participants IS NOT NULL AND v_max_participants > 0 THEN
        SELECT count(*) INTO v_current_count
        FROM match_participants
        WHERE match_id = p_match_id;

        IF v_current_count >= v_max_participants THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'A partida já atingiu a lotação máxima de vagas (' || v_max_participants || ').'
            );
        END IF;
    END IF;

    -- Verificar duplicidade: se já existe convidado com o mesmo nome nesta partida
    SELECT id INTO v_participant_id
    FROM match_participants
    WHERE match_id = p_match_id 
      AND user_id IS NULL 
      AND lower(trim(guest_name)) = lower(v_clean_name)
    LIMIT 1;

    IF v_participant_id IS NOT NULL THEN
        IF p_team IS NOT NULL THEN
            UPDATE match_participants
            SET team = p_team
            WHERE id = v_participant_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Convidado com este nome já estava na partida.',
            'participant_id', v_participant_id,
            'already_joined', true
        );
    END IF;

    -- Inserir participante CONVIDADO (user_id IS NULL, guest_name preenchido)
    -- NÃO cria perfil fantasma na tabela profiles!
    INSERT INTO match_participants (
        id,
        match_id,
        user_id,
        guest_name,
        team,
        paid,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_match_id,
        NULL,
        v_clean_name,
        p_team,
        false,
        now()
    )
    RETURNING id INTO v_participant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Convidado "' || v_clean_name || '" adicionado à partida!',
        'participant_id', v_participant_id,
        'already_joined', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: Adicionar múltiplos membros da liga de uma vez à partida
CREATE OR REPLACE FUNCTION admin_add_multiple_league_members_to_match(
    p_match_id UUID,
    p_user_ids UUID[],
    p_team INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_user_id UUID;
    v_added_count INT := 0;
    v_existing_count INT := 0;
    v_error_count INT := 0;
    v_res JSONB;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para gerenciar jogadores desta partida.';
    END IF;

    IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum jogador selecionado.'
        );
    END IF;

    FOREACH v_user_id IN ARRAY p_user_ids
    LOOP
        v_res := admin_add_league_member_to_match(p_match_id, v_user_id, p_team);
        IF (v_res->>'success')::boolean = true THEN
            IF (v_res->>'already_joined')::boolean = true THEN
                v_existing_count := v_existing_count + 1;
            ELSE
                v_added_count := v_added_count + 1;
            END IF;
        ELSE
            v_error_count := v_error_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', (v_added_count > 0 OR v_existing_count > 0),
        'added_count', v_added_count,
        'existing_count', v_existing_count,
        'error_count', v_error_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Atualização da função legada admin_add_match_player para NUNCA criar perfis fantasmas
CREATE OR REPLACE FUNCTION admin_add_match_player(
    p_match_id UUID,
    p_player_name TEXT,
    p_whatsapp TEXT DEFAULT NULL,
    p_team INT DEFAULT NULL
)
RETURNS JSONB AS $$
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

    -- 1. Verificar se já existe um perfil cadastrado com esse whatsapp
    IF v_clean_phone IS NOT NULL THEN
        SELECT id INTO v_target_user_id
        FROM profiles
        WHERE whatsapp = v_clean_phone
        LIMIT 1;
    END IF;

    -- 2. Se não achou por whatsapp, verifica se já existe membro da liga com o mesmo nome
    IF v_target_user_id IS NULL AND v_org_id IS NOT NULL THEN
        SELECT p.id INTO v_target_user_id
        FROM profiles p
        INNER JOIN organization_members om ON om.user_id = p.id
        WHERE om.organization_id = v_org_id
          AND lower(trim(p.nome)) = lower(v_clean_name)
        LIMIT 1;
    END IF;

    -- 3. Se encontrou perfil cadastrado: adicionar como membro
    IF v_target_user_id IS NOT NULL THEN
        RETURN admin_add_league_member_to_match(p_match_id, v_target_user_id, p_team);
    END IF;

    -- 4. Se NÃO encontrou perfil existente: adicionar como CONVIDADO AVULSO
    -- NÃO cria perfil em profiles, preservando o cadastro de usuários limpo!
    RETURN admin_add_guest_player_to_match(p_match_id, v_clean_name, p_team);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC: Alternar status de pagamento do participante diretamente pelo Administrador
CREATE OR REPLACE FUNCTION admin_toggle_participant_paid(
    p_match_id UUID,
    p_participant_id UUID,
    p_paid BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para gerenciar pagamentos desta partida.';
    END IF;

    UPDATE match_participants
    SET 
        paid = p_paid,
        payment_status = CASE WHEN p_paid THEN 'approved' ELSE 'pending' END,
        paid_at = CASE WHEN p_paid THEN now() ELSE NULL END
    WHERE id = p_participant_id AND match_id = p_match_id;

    RETURN jsonb_build_object(
        'success', true,
        'paid', p_paid,
        'message', CASE WHEN p_paid THEN 'Participante marcado como pago.' ELSE 'Participante marcado como pagamento pendente.' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
