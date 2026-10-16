-- ==============================================================================
-- MIGRAÇÃO: SISTEMA FINANCEIRO POR JOGADOR, POR LIGA E CAIXINHA DA RESENHA
-- ==============================================================================

-- 1. Atualizar tabela organizations (Ligas) com configurações da Caixinha
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS caixinha_name TEXT DEFAULT 'Caixinha da Resenha';

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS caixinha_description TEXT DEFAULT 'Caixa coletivo da liga para resenhas, confraternizações e churrascos.';

-- Atualizar ligas existentes com nome padrão se estiver nulo
UPDATE organizations 
SET caixinha_name = 'Caixinha da Resenha' 
WHERE caixinha_name IS NULL OR caixinha_name = '';


-- 2. Tabela de Caixas / Carteiras Individuais por Liga (league_player_wallets)
CREATE TABLE IF NOT EXISTS league_player_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    saldo_disponivel NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_pago NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_utilizado_partidas NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_contribuido_caixinha NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_pendente NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_league_user_wallet UNIQUE (league_id, user_id)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_wallets_league_user ON league_player_wallets(league_id, user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON league_player_wallets(user_id);


-- 3. Atualizar tabela match_participants para suporte a valores informados e confirmados
ALTER TABLE match_participants 
ADD COLUMN IF NOT EXISTS amount_informed NUMERIC(10,2);

ALTER TABLE match_participants 
ADD COLUMN IF NOT EXISTS amount_confirmed NUMERIC(10,2);

ALTER TABLE match_participants 
ADD COLUMN IF NOT EXISTS credit_destination TEXT DEFAULT 'wallet'; -- 'wallet' | 'caixinha'

ALTER TABLE match_participants 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix'; -- 'pix' | 'wallet' | 'cash' | 'admin'


-- 4. Tabela Principal de Transações Financeiras (financial_transactions)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    match_participant_id UUID REFERENCES match_participants(id) ON DELETE SET NULL,
    
    -- Tipos:
    -- 'match_payment': Pagamento de partida informado pelo jogador
    -- 'wallet_deposit': Adição antecipada de crédito pelo jogador
    -- 'wallet_usage': Abatimento de partida utilizando saldo disponível da carteira
    -- 'wallet_to_caixinha': Transferência voluntária do saldo do jogador para a caixinha
    -- 'admin_credit_adjust': Adição manual de crédito pelo Administrador
    -- 'admin_debit_adjust': Débito manual pelo Administrador
    -- 'caixinha_direct_entry': Entrada avulsa direta na caixinha (ex: patrocínio)
    type TEXT NOT NULL,
    
    valor_partida NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_informado NUMERIC(10,2) NOT NULL,
    valor_confirmado NUMERIC(10,2),
    valor_utilizado_partida NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_excedente NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    destino_excedente TEXT DEFAULT 'wallet', -- 'wallet' | 'caixinha' | 'pending_choice'
    
    -- Status:
    -- 'pending': Aguardando conferência do Administrador
    -- 'confirmed': Confirmado oficialmente pelo Administrador
    -- 'rejected': Rejeitado pelo Administrador
    -- 'adjusted': Corrigido administrativamente após confirmação
    status TEXT NOT NULL DEFAULT 'pending',
    
    comprovante_url TEXT,
    motivo_rejeicao TEXT,
    observacoes TEXT,
    confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para transações
CREATE INDEX IF NOT EXISTS idx_transactions_league ON financial_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_match ON financial_transactions(match_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON financial_transactions(status);


-- 5. Tabela de Movimentações da Caixinha Coletiva da Liga (league_caixinha_transactions)
CREATE TABLE IF NOT EXISTS league_caixinha_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'entry' (Entrada/Contribuição/Sobra) | 'expense' (Despesa) | 'adjustment' (Ajuste)
    descricao TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    categoria TEXT DEFAULT 'outros', -- 'churrasco' | 'bebidas' | 'quadra' | 'materiais' | 'premiacao' | 'contribuicao' | 'outros'
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Jogador que contribuiu (se aplicável)
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Admin que registrou despesa/movimentação
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    financial_transaction_id UUID REFERENCES financial_transactions(id) ON DELETE CASCADE,
    comprovante_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixinha_league ON league_caixinha_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_caixinha_type ON league_caixinha_transactions(type);


-- 6. Tabela de Logs de Auditoria Financeira Imutável (financial_audit_logs)
CREATE TABLE IF NOT EXISTS financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    financial_transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
    caixinha_transaction_id UUID REFERENCES league_caixinha_transactions(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_league ON financial_audit_logs(league_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON financial_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON financial_audit_logs(created_at DESC);


-- 7. Função RPC: Obter ou criar carteira do jogador na liga
CREATE OR REPLACE FUNCTION get_or_create_league_wallet(p_league_id UUID, p_user_id UUID)
RETURNS league_player_wallets AS $$
DECLARE
    v_wallet league_player_wallets;
BEGIN
    SELECT * INTO v_wallet 
    FROM league_player_wallets 
    WHERE league_id = p_league_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO league_player_wallets (league_id, user_id, saldo_disponivel, total_pago, total_utilizado_partidas, total_contribuido_caixinha, total_pendente)
        VALUES (p_league_id, p_user_id, 0.00, 0.00, 0.00, 0.00, 0.00)
        RETURNING * INTO v_wallet;
    END IF;

    RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Função RPC: Recalcular saldos de uma carteira específica com base nas transações confirmadas
CREATE OR REPLACE FUNCTION recalculate_user_league_wallet(p_league_id UUID, p_user_id UUID)
RETURNS league_player_wallets AS $$
DECLARE
    v_saldo NUMERIC(10,2) := 0.00;
    v_pago NUMERIC(10,2) := 0.00;
    v_utilizado NUMERIC(10,2) := 0.00;
    v_contribuido NUMERIC(10,2) := 0.00;
    v_pendente NUMERIC(10,2) := 0.00;
    v_wallet league_player_wallets;
BEGIN
    -- Garantir que a carteira existe
    PERFORM get_or_create_league_wallet(p_league_id, p_user_id);

    -- 1. Total Pago (todas as transações confirmadas de entrada direta do jogador)
    SELECT COALESCE(SUM(valor_confirmado), 0.00)
    INTO v_pago
    FROM financial_transactions
    WHERE league_id = p_league_id 
      AND user_id = p_user_id 
      AND status = 'confirmed'
      AND type IN ('match_payment', 'wallet_deposit');

    -- 2. Total Utilizado em Partidas
    SELECT COALESCE(SUM(valor_utilizado_partida), 0.00)
    INTO v_utilizado
    FROM financial_transactions
    WHERE league_id = p_league_id 
      AND user_id = p_user_id 
      AND status = 'confirmed';

    -- Somar também se pagou diretamente com saldo (wallet_usage)
    SELECT v_utilizado + COALESCE(SUM(valor_confirmado), 0.00)
    INTO v_utilizado
    FROM financial_transactions
    WHERE league_id = p_league_id 
      AND user_id = p_user_id 
      AND status = 'confirmed'
      AND type = 'wallet_usage';

    -- 3. Total Contribuído para a Caixinha
    SELECT COALESCE(SUM(valor), 0.00)
    INTO v_contribuido
    FROM league_caixinha_transactions
    WHERE league_id = p_league_id 
      AND user_id = p_user_id 
      AND type = 'entry';

    -- 4. Total Pendente (valores informados aguardando confirmação)
    SELECT COALESCE(SUM(valor_informado), 0.00)
    INTO v_pendente
    FROM financial_transactions
    WHERE league_id = p_league_id 
      AND user_id = p_user_id 
      AND status = 'pending';

    -- 5. Saldo Disponível: Créditos excedentes + Depósitos + Ajustes positivos - Abatimentos - Doações para caixinha - Ajustes negativos
    SELECT 
      COALESCE(SUM(
        CASE 
          -- Pagamento de partida onde sobrou crédito e destino foi carteira
          WHEN type = 'match_payment' AND destino_excedente = 'wallet' THEN valor_excedente
          -- Depósito direto na carteira
          WHEN type = 'wallet_deposit' THEN valor_confirmado
          -- Ajuste positivo do admin
          WHEN type = 'admin_credit_adjust' THEN valor_confirmado
          -- Uso do saldo para abater partida
          WHEN type = 'wallet_usage' THEN -valor_confirmado
          -- Transferência voluntária da carteira para caixinha
          WHEN type = 'wallet_to_caixinha' THEN -valor_confirmado
          -- Ajuste negativo do admin
          WHEN type = 'admin_debit_adjust' THEN -valor_confirmado
          ELSE 0.00
        END
      ), 0.00)
    INTO v_saldo
    FROM financial_transactions
    WHERE league_id = p_league_id 
      AND user_id = p_user_id 
      AND status = 'confirmed';

    -- Atualizar carteira
    UPDATE league_player_wallets
    SET 
      saldo_disponivel = GREATEST(v_saldo, 0.00),
      total_pago = v_pago,
      total_utilizado_partidas = v_utilizado,
      total_contribuido_caixinha = v_contribuido,
      total_pendente = v_pendente,
      updated_at = now()
    WHERE league_id = p_league_id AND user_id = p_user_id
    RETURNING * INTO v_wallet;

    RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Habilitar Realtime para as tabelas financeiras no Supabase
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'league_player_wallets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE league_player_wallets;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'financial_transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE financial_transactions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'league_caixinha_transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE league_caixinha_transactions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'financial_audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE financial_audit_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
