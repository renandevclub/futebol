-- ==============================================================================
-- 🏆 MIGRAÇÃO: SISTEMA COMPLETO DE TORNEIOS E CAMPEONATOS DENTRO DAS LIGAS
-- ==============================================================================

-- 1. TABELA PRINCIPAL DE TORNEIOS/CAMPEONATOS
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sport_type TEXT NOT NULL DEFAULT 'futebol', -- 'futebol' | 'volei'
    start_date DATE,
    end_date DATE,
    max_teams INT NOT NULL DEFAULT 8,
    players_per_team INT NOT NULL DEFAULT 10,
    format TEXT NOT NULL DEFAULT 'knockout', -- 'round_robin' (pontos corridos) | 'knockout' (mata-mata)
    entry_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- Valor de inscrição por time
    society_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- Custo da society/arena
    rules TEXT, -- Regulamento e informações adicionais
    status TEXT NOT NULL DEFAULT 'registration_open', -- 'registration_open' | 'registration_closed' | 'in_progress' | 'finished'
    champion_team_id UUID,
    runner_up_team_id UUID,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_league ON tournaments(league_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- 2. TABELA DE TIMES INSCRITOS NO TORNEIO
CREATE TABLE IF NOT EXISTS tournament_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    badge_url TEXT,
    color TEXT DEFAULT 'blue',
    coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT, -- Usuário responsável / técnico oficial
    registration_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'cancelled'
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'cancelled' | 'refunded'
    payment_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_proof_url TEXT,
    payment_notes TEXT,
    rejection_reason TEXT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_t_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_t_teams_league ON tournament_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_t_teams_coach ON tournament_teams(coach_id);
CREATE INDEX IF NOT EXISTS idx_t_teams_reg_status ON tournament_teams(registration_status);

-- Adicionar foreign key de campeão e vice em tournaments após criar tournament_teams
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tournaments_champion'
    ) THEN
        ALTER TABLE tournaments
            ADD CONSTRAINT fk_tournaments_champion
            FOREIGN KEY (champion_team_id) REFERENCES tournament_teams(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tournaments_runner_up'
    ) THEN
        ALTER TABLE tournaments
            ADD CONSTRAINT fk_tournaments_runner_up
            FOREIGN KEY (runner_up_team_id) REFERENCES tournament_teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. TABELA DE JOGADORES DO ELENCO DO TIME NO TORNEIO
CREATE TABLE IF NOT EXISTS tournament_team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    tournament_team_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    number INT,
    position TEXT,
    is_captain BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_player_per_tournament UNIQUE (tournament_id, user_id),
    CONSTRAINT unique_player_per_team UNIQUE (tournament_team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_t_players_tournament ON tournament_team_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_t_players_team ON tournament_team_players(tournament_team_id);
CREATE INDEX IF NOT EXISTS idx_t_players_user ON tournament_team_players(user_id);

-- 4. TABELA DE PARTIDAS DO TORNEIO
CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phase TEXT NOT NULL DEFAULT 'rodada_1', -- 'rodada_1', 'rodada_2'... ou 'oitavas', 'quartas', 'semifinal', 'final'
    round_number INT NOT NULL DEFAULT 1,
    bracket_match_number INT, -- Identificador da posição na chave eliminatória
    next_match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL, -- Próxima partida no chaveamento
    home_team_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
    away_team_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
    home_score INT NOT NULL DEFAULT 0,
    away_score INT NOT NULL DEFAULT 0,
    penalty_home_score INT,
    penalty_away_score INT,
    winner_team_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
    match_date DATE,
    match_time TIME,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'in_progress' | 'finished' | 'cancelled'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_t_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_t_matches_league ON tournament_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_t_matches_phase ON tournament_matches(phase);
CREATE INDEX IF NOT EXISTS idx_t_matches_status ON tournament_matches(status);

-- 5. TABELA DE EVENTOS DA PARTIDA (Gols, Cartões, Pontos)
CREATE TABLE IF NOT EXISTS tournament_match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assist_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'point'
    minute INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_t_events_match ON tournament_match_events(tournament_match_id);
CREATE INDEX IF NOT EXISTS idx_t_events_player ON tournament_match_events(player_id);

-- ==============================================================================
-- 6. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- ==============================================================================

-- Função auxiliar para mapear auth.uid() para o profile_id correspondente
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 6.1. RLS: tournaments
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments_select_all" ON tournaments;
CREATE POLICY "tournaments_select_all"
ON tournaments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "tournaments_insert_league_admin" ON tournaments;
CREATE POLICY "tournaments_insert_league_admin"
ON tournaments FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND can_manage_league(auth.uid(), league_id)
);

DROP POLICY IF EXISTS "tournaments_update_league_admin" ON tournaments;
CREATE POLICY "tournaments_update_league_admin"
ON tournaments FOR UPDATE
USING (can_manage_league(auth.uid(), league_id))
WITH CHECK (can_manage_league(auth.uid(), league_id));

DROP POLICY IF EXISTS "tournaments_delete_league_admin" ON tournaments;
CREATE POLICY "tournaments_delete_league_admin"
ON tournaments FOR DELETE
USING (can_manage_league(auth.uid(), league_id));


-- 6.2. RLS: tournament_teams
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament_teams_select_all" ON tournament_teams;
CREATE POLICY "tournament_teams_select_all"
ON tournament_teams FOR SELECT
USING (true);

DROP POLICY IF EXISTS "tournament_teams_insert_member" ON tournament_teams;
CREATE POLICY "tournament_teams_insert_member"
ON tournament_teams FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        coach_id = current_profile_id() OR can_manage_league(auth.uid(), league_id)
    )
);

DROP POLICY IF EXISTS "tournament_teams_update" ON tournament_teams;
CREATE POLICY "tournament_teams_update"
ON tournament_teams FOR UPDATE
USING (
    coach_id = current_profile_id() OR can_manage_league(auth.uid(), league_id)
)
WITH CHECK (
    coach_id = current_profile_id() OR can_manage_league(auth.uid(), league_id)
);

DROP POLICY IF EXISTS "tournament_teams_delete" ON tournament_teams;
CREATE POLICY "tournament_teams_delete"
ON tournament_teams FOR DELETE
USING (
    coach_id = current_profile_id() OR can_manage_league(auth.uid(), league_id)
);


-- 6.3. RLS: tournament_team_players
ALTER TABLE tournament_team_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_team_players_select_all" ON tournament_team_players;
CREATE POLICY "t_team_players_select_all"
ON tournament_team_players FOR SELECT
USING (true);

DROP POLICY IF EXISTS "t_team_players_insert_coach_or_admin" ON tournament_team_players;
CREATE POLICY "t_team_players_insert_coach_or_admin"
ON tournament_team_players FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM tournament_teams tt
            WHERE tt.id = tournament_team_id
              AND (tt.coach_id = current_profile_id() OR can_manage_league(auth.uid(), tt.league_id))
        )
    )
);

DROP POLICY IF EXISTS "t_team_players_update_coach_or_admin" ON tournament_team_players;
CREATE POLICY "t_team_players_update_coach_or_admin"
ON tournament_team_players FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM tournament_teams tt
        WHERE tt.id = tournament_team_id
          AND (tt.coach_id = current_profile_id() OR can_manage_league(auth.uid(), tt.league_id))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tournament_teams tt
        WHERE tt.id = tournament_team_id
          AND (tt.coach_id = current_profile_id() OR can_manage_league(auth.uid(), tt.league_id))
    )
);

DROP POLICY IF EXISTS "t_team_players_delete_coach_or_admin" ON tournament_team_players;
CREATE POLICY "t_team_players_delete_coach_or_admin"
ON tournament_team_players FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM tournament_teams tt
        WHERE tt.id = tournament_team_id
          AND (tt.coach_id = current_profile_id() OR can_manage_league(auth.uid(), tt.league_id))
    )
);


-- 6.4. RLS: tournament_matches
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_matches_select_all" ON tournament_matches;
CREATE POLICY "t_matches_select_all"
ON tournament_matches FOR SELECT
USING (true);

DROP POLICY IF EXISTS "t_matches_insert_league_admin" ON tournament_matches;
CREATE POLICY "t_matches_insert_league_admin"
ON tournament_matches FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND can_manage_league(auth.uid(), league_id)
);

DROP POLICY IF EXISTS "t_matches_update_league_admin" ON tournament_matches;
CREATE POLICY "t_matches_update_league_admin"
ON tournament_matches FOR UPDATE
USING (can_manage_league(auth.uid(), league_id))
WITH CHECK (can_manage_league(auth.uid(), league_id));

DROP POLICY IF EXISTS "t_matches_delete_league_admin" ON tournament_matches;
CREATE POLICY "t_matches_delete_league_admin"
ON tournament_matches FOR DELETE
USING (can_manage_league(auth.uid(), league_id));


-- 6.5. RLS: tournament_match_events
ALTER TABLE tournament_match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_match_events_select_all" ON tournament_match_events;
CREATE POLICY "t_match_events_select_all"
ON tournament_match_events FOR SELECT
USING (true);

DROP POLICY IF EXISTS "t_match_events_insert_admin" ON tournament_match_events;
CREATE POLICY "t_match_events_insert_admin"
ON tournament_match_events FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM tournament_matches tm
        WHERE tm.id = tournament_match_id
          AND can_manage_league(auth.uid(), tm.league_id)
    )
);

DROP POLICY IF EXISTS "t_match_events_update_admin" ON tournament_match_events;
CREATE POLICY "t_match_events_update_admin"
ON tournament_match_events FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM tournament_matches tm
        WHERE tm.id = tournament_match_id
          AND can_manage_league(auth.uid(), tm.league_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tournament_matches tm
        WHERE tm.id = tournament_match_id
          AND can_manage_league(auth.uid(), tm.league_id)
    )
);

DROP POLICY IF EXISTS "t_match_events_delete_admin" ON tournament_match_events;
CREATE POLICY "t_match_events_delete_admin"
ON tournament_match_events FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM tournament_matches tm
        WHERE tm.id = tournament_match_id
          AND can_manage_league(auth.uid(), tm.league_id)
    )
);
