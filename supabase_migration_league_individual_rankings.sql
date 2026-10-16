-- ==============================================================================
-- 🏆 MIGRAÇÃO: RANKINGS INDIVIDUAIS POR LIGA + CRAQUE (MVP) & ANINGA 🐍
-- ==============================================================================

-- 1. ADIÇÃO DE CAMPOS NA TABELA matches
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS mvp_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS aninga_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS mvp_notes TEXT,
ADD COLUMN IF NOT EXISTS aninga_notes TEXT;

-- 2. ADIÇÃO DE CAMPOS NA TABELA match_participants
ALTER TABLE match_participants
ADD COLUMN IF NOT EXISTS is_mvp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_aninga BOOLEAN DEFAULT false;

-- 3. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_matches_org_id ON matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_matches_mvp ON matches(mvp_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_aninga ON matches(aninga_player_id);
CREATE INDEX IF NOT EXISTS idx_match_game_goals_player ON match_game_goals(player_id);
CREATE INDEX IF NOT EXISTS idx_match_game_goals_assist ON match_game_goals(assist_player_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user_match ON match_participants(user_id, match_id);

-- 4. RPC PARA ELEGER/REGISTRAR DESTAQUES DA PARTIDA (MVP E ANINGA)
DROP FUNCTION IF EXISTS set_match_highlights(UUID, UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION set_match_highlights(
    p_match_id UUID,
    p_mvp_user_id UUID DEFAULT NULL,
    p_aninga_user_id UUID DEFAULT NULL,
    p_mvp_notes TEXT DEFAULT NULL,
    p_aninga_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Validar se o usuário tem permissão para administrar esta partida
    IF NOT can_manage_match(v_caller_id, p_match_id) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui permissão para definir os destaques desta partida.';
    END IF;

    -- Atualizar tabela matches
    UPDATE matches
    SET 
        mvp_player_id = p_mvp_user_id,
        aninga_player_id = p_aninga_user_id,
        mvp_notes = p_mvp_notes,
        aninga_notes = p_aninga_notes
    WHERE id = p_match_id;

    -- Atualizar flags na tabela match_participants
    UPDATE match_participants
    SET is_mvp = (user_id = p_mvp_user_id)
    WHERE match_id = p_match_id;

    UPDATE match_participants
    SET is_aninga = (user_id = p_aninga_user_id)
    WHERE match_id = p_match_id;

    RETURN jsonb_build_object(
        'success', true, 
        'match_id', p_match_id, 
        'mvp_player_id', p_mvp_user_id, 
        'aninga_player_id', p_aninga_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
