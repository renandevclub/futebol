-- ==============================================================================
-- 🔐 MIGRAÇÃO: CONTROLE COMPLETO DE ACESSO ADMINISTRATIVO POR LIGA (RLS SPORTS)
-- ==============================================================================

-- 1. ESTRUTURA DA TABELA organization_members (se não existir) E ÍNDICES
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'player', -- 'owner' | 'admin' | 'moderator' | 'player' | 'member'
    nivel_qualidade NUMERIC(3,1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_organization UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_user ON organization_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_role ON organization_members(user_id, role);
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON organization_members(organization_id, role);

-- 2. MIGRAÇÃO RETROATIVA SEGURA DE ADMINISTRADORES EXISTENTES
-- Garante que o criador/owner de qualquer organização existente esteja registrado como 'owner' na tabela de membros
INSERT INTO organization_members (organization_id, user_id, role)
SELECT id AS organization_id, owner_id AS user_id, 'owner' AS role
FROM organizations
WHERE owner_id IS NOT NULL
ON CONFLICT (organization_id, user_id) 
DO UPDATE SET role = CASE 
    WHEN organization_members.role = 'player' THEN 'owner' 
    ELSE organization_members.role 
END;


-- ==============================================================================
-- 3. FUNÇÕES SQL CENTRAIS DE AUTORIZAÇÃO (SECURITY DEFINER)
-- ==============================================================================

-- 3.1. Verifica se o usuário autenticado ou fornecido é Super Administrador
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE (auth_id = auth.uid() OR id = auth.uid()) 
      AND role = 'super_admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE (auth_id = p_user_id OR id = p_user_id) 
      AND role = 'super_admin'
  );
END;
$$;


-- 3.2. Verifica se o usuário tem permissão administrativa em uma Liga específica
CREATE OR REPLACE FUNCTION can_manage_league(
    p_user_id UUID,
    p_league_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_super BOOLEAN;
    v_is_owner BOOLEAN;
    v_has_admin_role BOOLEAN;
BEGIN
    IF p_user_id IS NULL OR p_league_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Super Administrador possui acesso global a todas as ligas
    IF is_super_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    -- 2. É o criador / owner direto da Liga na tabela organizations
    SELECT EXISTS (
        SELECT 1 FROM organizations 
        WHERE id = p_league_id AND owner_id = p_user_id
    ) INTO v_is_owner;

    IF v_is_owner THEN
        RETURN TRUE;
    END IF;

    -- 3. Possui cargo de 'owner' ou 'admin' na tabela organization_members para esta liga
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_league_id 
          AND user_id = p_user_id 
          AND role IN ('owner', 'admin')
    ) INTO v_has_admin_role;

    RETURN v_has_admin_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 3.3. Verifica se o usuário pode administrar uma Partida específica
CREATE OR REPLACE FUNCTION can_manage_match(
    p_user_id UUID,
    p_match_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF p_user_id IS NULL OR p_match_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF is_super_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    SELECT organization_id INTO v_org_id
    FROM matches
    WHERE id = p_match_id;

    IF v_org_id IS NULL THEN
        RETURN is_super_admin(p_user_id);
    END IF;

    RETURN can_manage_league(p_user_id, v_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 3.4. Verifica se o usuário pode administrar um Confronto/Jogo específico
CREATE OR REPLACE FUNCTION can_manage_game(
    p_user_id UUID,
    p_game_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_match_id UUID;
BEGIN
    IF p_user_id IS NULL OR p_game_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT match_id INTO v_match_id
    FROM match_games
    WHERE id = p_game_id;

    IF v_match_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN can_manage_match(p_user_id, v_match_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ==============================================================================
-- 4. HABILITAÇÃO E DEFINIÇÃO DE ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 4.1. TABELA: organizations (Ligas)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select_all" ON organizations;
CREATE POLICY "organizations_select_all"
ON organizations FOR SELECT
USING (true);

DROP POLICY IF EXISTS "organizations_insert_admin" ON organizations;
CREATE POLICY "organizations_insert_admin"
ON organizations FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        is_super_admin(auth.uid()) OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
              AND role IN ('super_admin', 'admin') 
              AND (can_create_leagues IS NULL OR can_create_leagues = true)
        )
    )
);

DROP POLICY IF EXISTS "organizations_update_league_admin" ON organizations;
CREATE POLICY "organizations_update_league_admin"
ON organizations FOR UPDATE
USING (can_manage_league(auth.uid(), id))
WITH CHECK (can_manage_league(auth.uid(), id));

DROP POLICY IF EXISTS "organizations_delete_league_admin" ON organizations;
CREATE POLICY "organizations_delete_league_admin"
ON organizations FOR DELETE
USING (can_manage_league(auth.uid(), id));


-- 4.2. TABELA: organization_members (Membros e Administradores de Ligas)
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select_all" ON organization_members;
CREATE POLICY "org_members_select_all"
ON organization_members FOR SELECT
USING (true);

DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
CREATE POLICY "org_members_insert"
ON organization_members FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        user_id = auth.uid() OR 
        can_manage_league(auth.uid(), organization_id)
    )
);

DROP POLICY IF EXISTS "org_members_update" ON organization_members;
CREATE POLICY "org_members_update"
ON organization_members FOR UPDATE
USING (can_manage_league(auth.uid(), organization_id))
WITH CHECK (can_manage_league(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org_members_delete" ON organization_members;
CREATE POLICY "org_members_delete"
ON organization_members FOR DELETE
USING (
    user_id = auth.uid() OR 
    can_manage_league(auth.uid(), organization_id)
);


-- 4.3. TABELA: matches (Partidas)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select_all" ON matches;
CREATE POLICY "matches_select_all"
ON matches FOR SELECT
USING (true);

DROP POLICY IF EXISTS "matches_insert_league_admin" ON matches;
CREATE POLICY "matches_insert_league_admin"
ON matches FOR INSERT
WITH CHECK (
    organization_id IS NOT NULL AND can_manage_league(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "matches_update_league_admin" ON matches;
CREATE POLICY "matches_update_league_admin"
ON matches FOR UPDATE
USING (can_manage_match(auth.uid(), id))
WITH CHECK (can_manage_match(auth.uid(), id));

DROP POLICY IF EXISTS "matches_delete_league_admin" ON matches;
CREATE POLICY "matches_delete_league_admin"
ON matches FOR DELETE
USING (can_manage_match(auth.uid(), id));


-- 4.4. TABELA: match_games (Confrontos / Jogos ao Vivo)
ALTER TABLE match_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_games_select_all" ON match_games;
CREATE POLICY "match_games_select_all"
ON match_games FOR SELECT
USING (true);

DROP POLICY IF EXISTS "match_games_insert_admin" ON match_games;
CREATE POLICY "match_games_insert_admin"
ON match_games FOR INSERT
WITH CHECK (can_manage_match(auth.uid(), match_id));

DROP POLICY IF EXISTS "match_games_update_admin" ON match_games;
CREATE POLICY "match_games_update_admin"
ON match_games FOR UPDATE
USING (can_manage_match(auth.uid(), match_id))
WITH CHECK (can_manage_match(auth.uid(), match_id));

DROP POLICY IF EXISTS "match_games_delete_admin" ON match_games;
CREATE POLICY "match_games_delete_admin"
ON match_games FOR DELETE
USING (can_manage_match(auth.uid(), match_id));


-- 4.5. TABELA: match_game_goals (Gols, Pontos e Cartões)
ALTER TABLE match_game_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_game_goals_select_all" ON match_game_goals;
CREATE POLICY "match_game_goals_select_all"
ON match_game_goals FOR SELECT
USING (true);

DROP POLICY IF EXISTS "match_game_goals_insert_admin" ON match_game_goals;
CREATE POLICY "match_game_goals_insert_admin"
ON match_game_goals FOR INSERT
WITH CHECK (can_manage_match(auth.uid(), match_id));

DROP POLICY IF EXISTS "match_game_goals_update_admin" ON match_game_goals;
CREATE POLICY "match_game_goals_update_admin"
ON match_game_goals FOR UPDATE
USING (can_manage_match(auth.uid(), match_id))
WITH CHECK (can_manage_match(auth.uid(), match_id));

DROP POLICY IF EXISTS "match_game_goals_delete_admin" ON match_game_goals;
CREATE POLICY "match_game_goals_delete_admin"
ON match_game_goals FOR DELETE
USING (can_manage_match(auth.uid(), match_id));


-- 4.6. TABELA: match_participants (Participantes da Partida)
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_participants_select_all" ON match_participants;
CREATE POLICY "match_participants_select_all"
ON match_participants FOR SELECT
USING (true);

DROP POLICY IF EXISTS "match_participants_insert" ON match_participants;
CREATE POLICY "match_participants_insert"
ON match_participants FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        user_id = auth.uid() OR 
        can_manage_match(auth.uid(), match_id)
    )
);

DROP POLICY IF EXISTS "match_participants_update" ON match_participants;
CREATE POLICY "match_participants_update"
ON match_participants FOR UPDATE
USING (
    user_id = auth.uid() OR 
    can_manage_match(auth.uid(), match_id)
)
WITH CHECK (
    user_id = auth.uid() OR 
    can_manage_match(auth.uid(), match_id)
);

DROP POLICY IF EXISTS "match_participants_delete" ON match_participants;
CREATE POLICY "match_participants_delete"
ON match_participants FOR DELETE
USING (
    user_id = auth.uid() OR 
    can_manage_match(auth.uid(), match_id)
);


-- 4.7. TABELAS FINANCEIRAS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_player_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_caixinha_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4.7.1. financial_transactions
DROP POLICY IF EXISTS "fin_tx_select" ON financial_transactions;
CREATE POLICY "fin_tx_select"
ON financial_transactions FOR SELECT
USING (
    user_id = auth.uid() OR 
    can_manage_league(auth.uid(), league_id)
);

DROP POLICY IF EXISTS "fin_tx_insert" ON financial_transactions;
CREATE POLICY "fin_tx_insert"
ON financial_transactions FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        user_id = auth.uid() OR 
        can_manage_league(auth.uid(), league_id)
    )
);

DROP POLICY IF EXISTS "fin_tx_update" ON financial_transactions;
CREATE POLICY "fin_tx_update"
ON financial_transactions FOR UPDATE
USING (can_manage_league(auth.uid(), league_id))
WITH CHECK (can_manage_league(auth.uid(), league_id));

DROP POLICY IF EXISTS "fin_tx_delete" ON financial_transactions;
CREATE POLICY "fin_tx_delete"
ON financial_transactions FOR DELETE
USING (can_manage_league(auth.uid(), league_id));


-- 4.7.2. league_player_wallets
DROP POLICY IF EXISTS "wallets_select" ON league_player_wallets;
CREATE POLICY "wallets_select"
ON league_player_wallets FOR SELECT
USING (
    user_id = auth.uid() OR 
    can_manage_league(auth.uid(), league_id)
);

DROP POLICY IF EXISTS "wallets_insert" ON league_player_wallets;
CREATE POLICY "wallets_insert"
ON league_player_wallets FOR INSERT
WITH CHECK (
    user_id = auth.uid() OR 
    can_manage_league(auth.uid(), league_id)
);

DROP POLICY IF EXISTS "wallets_update" ON league_player_wallets;
CREATE POLICY "wallets_update"
ON league_player_wallets FOR UPDATE
USING (can_manage_league(auth.uid(), league_id))
WITH CHECK (can_manage_league(auth.uid(), league_id));


-- 4.7.3. league_caixinha_transactions
DROP POLICY IF EXISTS "caixinha_select" ON league_caixinha_transactions;
CREATE POLICY "caixinha_select"
ON league_caixinha_transactions FOR SELECT
USING (true); -- Membros podem visualizar prestação de contas da caixinha

DROP POLICY IF EXISTS "caixinha_insert_admin" ON league_caixinha_transactions;
CREATE POLICY "caixinha_insert_admin"
ON league_caixinha_transactions FOR INSERT
WITH CHECK (can_manage_league(auth.uid(), league_id));

DROP POLICY IF EXISTS "caixinha_update_admin" ON league_caixinha_transactions;
CREATE POLICY "caixinha_update_admin"
ON league_caixinha_transactions FOR UPDATE
USING (can_manage_league(auth.uid(), league_id))
WITH CHECK (can_manage_league(auth.uid(), league_id));

DROP POLICY IF EXISTS "caixinha_delete_admin" ON league_caixinha_transactions;
CREATE POLICY "caixinha_delete_admin"
ON league_caixinha_transactions FOR DELETE
USING (can_manage_league(auth.uid(), league_id));


-- 4.7.4. financial_audit_logs
DROP POLICY IF EXISTS "audit_logs_select" ON financial_audit_logs;
CREATE POLICY "audit_logs_select"
ON financial_audit_logs FOR SELECT
USING (can_manage_league(auth.uid(), league_id));

DROP POLICY IF EXISTS "audit_logs_insert" ON financial_audit_logs;
CREATE POLICY "audit_logs_insert"
ON financial_audit_logs FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND 
    can_manage_league(auth.uid(), league_id)
);


-- ==============================================================================
-- 5. RPCs DE MUTAÇÃO COM VALIDAÇÃO RÍGIDA DE SERVIDOR
-- ==============================================================================

-- 5.1. Exclusão Segura de Partida
DROP FUNCTION IF EXISTS delete_match(UUID);
CREATE OR REPLACE FUNCTION delete_match(target_match_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_match(v_caller_id, target_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão de administrador para excluir esta partida.';
    END IF;

    -- Excluir registros dependentes em cascata
    DELETE FROM match_game_goals WHERE match_id = target_match_id;
    DELETE FROM match_games WHERE match_id = target_match_id;
    DELETE FROM match_participants WHERE match_id = target_match_id;
    DELETE FROM match_expenses WHERE match_id = target_match_id;
    DELETE FROM matches WHERE id = target_match_id;

    RETURN jsonb_build_object('success', true, 'message', 'Partida excluída com sucesso.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5.2. Atualização Segura de Avaliação de Qualidade de Participante de Liga
DROP FUNCTION IF EXISTS update_league_participant_rating(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION update_league_participant_rating(
    p_organization_id UUID,
    p_target_user_id UUID,
    p_rating NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    IF NOT can_manage_league(v_caller_id, p_organization_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão de administrador para esta liga.';
    END IF;

    -- Atualiza ou insere a avaliação na tabela organization_members
    INSERT INTO organization_members (organization_id, user_id, role, nivel_qualidade)
    VALUES (p_organization_id, p_target_user_id, 'player', p_rating)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET nivel_qualidade = p_rating;

    RETURN jsonb_build_object('success', true, 'rating', p_rating);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5.3. Gerenciamento Seguro de Vínculos de Liga (manage_user_league_membership)
DROP FUNCTION IF EXISTS manage_user_league_membership(UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION manage_user_league_membership(
    p_target_user_id UUID,
    p_organization_id UUID,
    p_role TEXT,
    p_action TEXT -- 'add' | 'remove' | 'update_role'
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Apenas Super Admin ou Admin da Liga pode gerenciar membros da liga
    IF NOT can_manage_league(v_caller_id, p_organization_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para gerenciar vínculos desta liga.';
    END IF;

    -- Promover para admin/owner de liga exige que quem promove seja Super Admin ou Owner da Liga
    IF p_role IN ('owner', 'admin') AND NOT (is_super_admin(v_caller_id) OR EXISTS (SELECT 1 FROM organizations WHERE id = p_organization_id AND owner_id = v_caller_id)) THEN
        RAISE EXCEPTION 'Acesso negado: Apenas o criador da liga ou o Super Administrador pode conceder cargo de administrador.';
    END IF;

    IF p_action = 'remove' THEN
        DELETE FROM organization_members 
        WHERE organization_id = p_organization_id AND user_id = p_target_user_id;
    ELSIF p_action IN ('add', 'update_role') THEN
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (p_organization_id, p_target_user_id, COALESCE(p_role, 'player'))
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET role = COALESCE(p_role, organization_members.role);
    END IF;

    RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FIM DA MIGRAÇÃO
