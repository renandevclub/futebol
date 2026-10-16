-- ==============================================================================
-- ⚽ MIGRAÇÃO: CADASTRO E GERENCIAMENTO DE JOGADORES NA LISTA DA PARTIDA DE FUTEBOL
-- ==============================================================================

-- 1. RPC: Adicionar jogador à lista da partida pelo Administrador da Liga
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

    -- Obter a liga da partida
    SELECT organization_id INTO v_org_id
    FROM matches
    WHERE id = p_match_id;

    -- 1. Verificar se já existe um perfil com esse nome na mesma liga ou com o mesmo whatsapp
    IF p_whatsapp IS NOT NULL AND length(trim(p_whatsapp)) > 0 THEN
        SELECT id INTO v_target_user_id
        FROM profiles
        WHERE whatsapp = trim(p_whatsapp)
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
            NULLIF(trim(p_whatsapp), ''),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RPC: Editar o nome de um jogador cadastrado
CREATE OR REPLACE FUNCTION admin_update_match_player_name(
    p_match_id UUID,
    p_user_id UUID,
    p_new_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_clean_name TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para editar jogadores desta partida.';
    END IF;

    v_clean_name := trim(p_new_name);
    IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Nome do jogador não pode ficar vazio.';
    END IF;

    -- Atualiza o nome no perfil do jogador
    UPDATE profiles
    SET nome = v_clean_name
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Nome do jogador atualizado com sucesso.',
        'user_id', p_user_id,
        'nome', v_clean_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: Remover jogador da partida
CREATE OR REPLACE FUNCTION admin_remove_match_player(
    p_match_id UUID,
    p_participant_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para remover jogadores desta partida.';
    END IF;

    DELETE FROM match_participants
    WHERE id = p_participant_id AND match_id = p_match_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Jogador removido da partida com sucesso.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
