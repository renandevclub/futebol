-- ==============================================================================
-- MIGRAÇÃO: IMPLEMENTAÇÃO COMPLETA DO SISTEMA FINANCEIRO DA LIGA
-- ==============================================================================

-- 1. Adicionar colunas na tabela league_caixinha_transactions
ALTER TABLE public.league_caixinha_transactions 
ADD COLUMN IF NOT EXISTS doador_nome TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 2. Função RPC Atômica para Adição de Crédito na Carteira do Membro pelo Administrador
CREATE OR REPLACE FUNCTION public.admin_add_wallet_credit(
    p_league_id UUID,
    p_user_id UUID,
    p_admin_id UUID,
    p_amount NUMERIC,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_authorized BOOLEAN := false;
    v_tx_id UUID;
    v_wallet public.league_player_wallets;
    v_clean_amount NUMERIC(10,2);
BEGIN
    -- Validar valor
    v_clean_amount := ROUND(p_amount, 2);
    IF v_clean_amount IS NULL OR v_clean_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Informe um valor válido e positivo.');
    END IF;

    -- Validar autorização do admin
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'super_admin'
        UNION
        SELECT 1 FROM public.organizations WHERE id = p_league_id AND owner_id = p_admin_id
        UNION
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = p_league_id AND user_id = p_admin_id AND role IN ('owner', 'admin')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Você não possui permissão administrativa nesta liga.');
    END IF;

    -- Inserir transação de crédito administrativo confirmada
    INSERT INTO public.financial_transactions (
        league_id,
        user_id,
        type,
        valor_partida,
        valor_informado,
        valor_confirmado,
        valor_utilizado_partida,
        valor_excedente,
        destino_excedente,
        status,
        confirmed_by,
        confirmed_at,
        observacoes
    ) VALUES (
        p_league_id,
        p_user_id,
        'admin_credit_adjust',
        0.00,
        v_clean_amount,
        v_clean_amount,
        0.00,
        0.00,
        'wallet',
        'confirmed',
        p_admin_id,
        now(),
        COALESCE(NULLIF(trim(p_reason), ''), 'Crédito adicionado pelo administrador.')
    ) RETURNING id INTO v_tx_id;

    -- Recalcular a carteira do usuário de forma segura
    SELECT * INTO v_wallet FROM public.recalculate_user_league_wallet(p_league_id, p_user_id);

    -- Registrar log de auditoria financeira
    INSERT INTO public.financial_audit_logs (
        league_id,
        actor_id,
        financial_transaction_id,
        action,
        description,
        new_data
    ) VALUES (
        p_league_id,
        p_admin_id,
        v_tx_id,
        'admin_add_wallet_credit',
        'Crédito de R$ ' || to_char(v_clean_amount, 'FM999G999D00') || ' adicionado pelo administrador.',
        jsonb_build_object('user_id', p_user_id, 'amount', v_clean_amount, 'reason', p_reason, 'novo_saldo', v_wallet.saldo_disponivel)
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'saldo_disponivel', v_wallet.saldo_disponivel
    );
END;
$$;

-- 3. Função RPC Atômica para Adição de Doação / Crédito à Caixinha da Liga
CREATE OR REPLACE FUNCTION public.admin_add_caixinha_donation(
    p_league_id UUID,
    p_admin_id UUID,
    p_amount NUMERIC,
    p_donor_name TEXT,
    p_observation TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_authorized BOOLEAN := false;
    v_tx_id UUID;
    v_clean_amount NUMERIC(10,2);
    v_clean_donor TEXT;
BEGIN
    -- Validar valor
    v_clean_amount := ROUND(p_amount, 2);
    IF v_clean_amount IS NULL OR v_clean_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Informe um valor válido e positivo.');
    END IF;

    -- Validar nome do doador (obrigatório)
    v_clean_donor := trim(COALESCE(p_donor_name, ''));
    IF v_clean_donor = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Informe o nome de quem realizou a doação.');
    END IF;

    -- Validar autorização do admin
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'super_admin'
        UNION
        SELECT 1 FROM public.organizations WHERE id = p_league_id AND owner_id = p_admin_id
        UNION
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = p_league_id AND user_id = p_admin_id AND role IN ('owner', 'admin')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Você não possui permissão administrativa nesta liga.');
    END IF;

    -- Inserir movimentação na Caixinha da Liga
    INSERT INTO public.league_caixinha_transactions (
        league_id,
        type,
        descricao,
        valor,
        categoria,
        user_id,
        admin_id,
        doador_nome,
        observacoes
    ) VALUES (
        p_league_id,
        'entry',
        'Doação de ' || v_clean_donor,
        v_clean_amount,
        'contribuicao',
        p_user_id,
        p_admin_id,
        v_clean_donor,
        NULLIF(trim(p_observation), '')
    ) RETURNING id INTO v_tx_id;

    -- Registrar log de auditoria financeira
    INSERT INTO public.financial_audit_logs (
        league_id,
        actor_id,
        caixinha_transaction_id,
        action,
        description,
        new_data
    ) VALUES (
        p_league_id,
        p_admin_id,
        v_tx_id,
        'admin_add_caixinha_donation',
        'Doação de R$ ' || to_char(v_clean_amount, 'FM999G999D00') || ' realizada por ' || v_clean_donor || ' registrada na Caixinha.',
        jsonb_build_object('donor_name', v_clean_donor, 'amount', v_clean_amount, 'observation', p_observation)
    );

    RETURN jsonb_build_object(
        'success', true,
        'caixinha_transaction_id', v_tx_id,
        'valor', v_clean_amount,
        'doador_nome', v_clean_donor
    );
END;
$$;

-- 4. Função RPC Atômica para Pagamento de Coleta da Partida com a Carteira do Jogador
CREATE OR REPLACE FUNCTION public.pay_match_with_wallet_atomic(
    p_match_id UUID,
    p_league_id UUID,
    p_user_id UUID,
    p_participant_id UUID,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_amount NUMERIC(10,2);
    v_wallet public.league_player_wallets;
    v_is_already_paid BOOLEAN := false;
    v_participant_match_id UUID;
    v_participant_user_id UUID;
    v_tx_id UUID;
BEGIN
    v_clean_amount := ROUND(p_amount, 2);
    IF v_clean_amount IS NULL OR v_clean_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valor da coleta inválido.');
    END IF;

    -- 1. Validar e travar o participante para evitar concorrência/duplo clique
    SELECT paid, match_id, user_id
    INTO v_is_already_paid, v_participant_match_id, v_participant_user_id
    FROM public.match_participants
    WHERE id = p_participant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inscrição na partida não encontrada.');
    END IF;

    IF v_participant_user_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'A inscrição não pertence a este usuário.');
    END IF;

    IF v_is_already_paid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta coleta já foi paga anteriormente.');
    END IF;

    -- 2. Garantir que a carteira existe e travar com FOR UPDATE para consistência atômica
    PERFORM public.get_or_create_league_wallet(p_league_id, p_user_id);

    SELECT * INTO v_wallet
    FROM public.league_player_wallets
    WHERE league_id = p_league_id AND user_id = p_user_id
    FOR UPDATE;

    -- 3. Validar se há saldo suficiente (sem desconto parcial)
    IF v_wallet.saldo_disponivel < v_clean_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Saldo insuficiente para pagar a coleta.',
            'saldo_disponivel', v_wallet.saldo_disponivel,
            'valor_coleta', v_clean_amount
        );
    END IF;

    -- 4. Inserir a transação confirmada de uso de saldo (wallet_usage)
    INSERT INTO public.financial_transactions (
        league_id,
        user_id,
        match_id,
        match_participant_id,
        type,
        valor_partida,
        valor_informado,
        valor_confirmado,
        valor_utilizado_partida,
        valor_excedente,
        status,
        confirmed_by,
        confirmed_at,
        observacoes
    ) VALUES (
        p_league_id,
        p_user_id,
        p_match_id,
        p_participant_id,
        'wallet_usage',
        v_clean_amount,
        v_clean_amount,
        v_clean_amount,
        v_clean_amount,
        0.00,
        'confirmed',
        p_user_id,
        now(),
        'Pagamento da coleta realizado com saldo da carteira.'
    ) RETURNING id INTO v_tx_id;

    -- 5. Atualizar o participante da partida como PAGO
    UPDATE public.match_participants
    SET 
        paid = true,
        paid_at = now(),
        payment_status = 'approved',
        payment_method = 'wallet',
        amount_confirmed = v_clean_amount
    WHERE id = p_participant_id;

    -- 6. Recalcular a carteira do usuário de forma segura
    SELECT * INTO v_wallet FROM public.recalculate_user_league_wallet(p_league_id, p_user_id);

    -- 7. Registrar log de auditoria financeira
    INSERT INTO public.financial_audit_logs (
        league_id,
        actor_id,
        financial_transaction_id,
        action,
        description,
        new_data
    ) VALUES (
        p_league_id,
        p_user_id,
        v_tx_id,
        'pay_match_with_wallet',
        'Jogador utilizou R$ ' || to_char(v_clean_amount, 'FM999G999D00') || ' do seu saldo para pagar a coleta da partida.',
        jsonb_build_object(
            'match_id', p_match_id,
            'participant_id', p_participant_id,
            'valor_pago', v_clean_amount,
            'saldo_restante', v_wallet.saldo_disponivel
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'saldo_restante', v_wallet.saldo_disponivel,
        'valor_pago', v_clean_amount
    );
END;
$$;
