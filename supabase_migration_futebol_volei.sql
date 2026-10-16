-- ==============================================================================
-- MIGRAÇÃO DE SUPORTE A FUTEBOL E VÔLEI (FutResenha / Multi-Esportes)
-- ==============================================================================

-- 1. Tabela organizations (Ligas): adicionar modalidade esportiva
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS sport_type TEXT DEFAULT 'futebol';

-- Atualizar ligas existentes para 'futebol' caso estejam nulas
UPDATE organizations 
SET sport_type = 'futebol' 
WHERE sport_type IS NULL;


-- 2. Tabela matches (Partidas): adicionar modalidade esportiva herdada da liga e limites de gênero
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS sport_type TEXT DEFAULT 'futebol';

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS max_homens_por_time INTEGER;

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS max_mulheres_por_time INTEGER;

-- Atualizar partidas existentes com base na liga correspondente ou padrão 'futebol'
UPDATE matches m
SET sport_type = COALESCE(o.sport_type, 'futebol')
FROM organizations o
WHERE m.organization_id = o.id AND (m.sport_type IS NULL OR m.sport_type = '');

UPDATE matches
SET sport_type = 'futebol'
WHERE sport_type IS NULL;


-- 3. Tabela profiles (Perfis de Usuários): adicionar preferências e fichas técnicas
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS sport_types TEXT[] DEFAULT ARRAY['futebol']::TEXT[];

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS futebol_position TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS futebol_dominant_foot TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS volei_position TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS volei_dominant_hand TEXT;

-- Sincronizar dados legados para manter total compatibilidade com usuários existentes
UPDATE profiles 
SET 
  sport_types = ARRAY['futebol']::TEXT[],
  futebol_position = COALESCE(futebol_position, posicao),
  futebol_dominant_foot = COALESCE(futebol_dominant_foot, pe_dominante)
WHERE sport_types IS NULL;


-- 4. Tabela match_game_goals (Gols e Pontos): adicionar tipo de pontuação
ALTER TABLE match_game_goals 
ADD COLUMN IF NOT EXISTS point_type TEXT DEFAULT 'goal';

-- Fim da Migração
