import { supabase } from './supabase';
import {
  LeaguePlayerWallet,
  FinancialTransaction,
  FinancialTransactionType,
  FinancialTransactionStatus,
  CreditDestination,
  CaixinhaTransaction,
  CaixinhaCategory,
  FinancialAuditLog,
  LeagueFinancialSummary,
} from '@/types/finance';
import { createNotification } from './notifications';

/**
 * Formata um valor numérico para o padrão de moeda brasileiro (R$ 0,00)
 */
export function formatCurrency(amount: number | null | undefined): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Cria um registro no log imutável de auditoria financeira
 */
export async function logFinancialAudit(params: {
  leagueId: string;
  actorId: string;
  action: string;
  description: string;
  financialTransactionId?: string | null;
  caixinhaTransactionId?: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
}): Promise<void> {
  try {
    await supabase.from('financial_audit_logs').insert({
      league_id: params.leagueId,
      actor_id: params.actorId,
      action: params.action,
      description: params.description,
      financial_transaction_id: params.financialTransactionId || null,
      caixinha_transaction_id: params.caixinhaTransactionId || null,
      old_data: params.oldData || null,
      new_data: params.newData || null,
    });
  } catch (err) {
    console.error('Erro ao registrar log de auditoria financeira:', err);
  }
}

/**
 * Busca ou inicializa o caixa individual do jogador em uma liga específica
 */
export async function getLeagueWallet(
  leagueId: string,
  userId: string
): Promise<LeaguePlayerWallet | null> {
  try {
    const { data, error } = await supabase
      .from('league_player_wallets')
      .select('*, user:user_id(*), league:league_id(*)')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Erro ao buscar carteira do jogador:', error);
    }

    if (data) {
      return data as LeaguePlayerWallet;
    }

    // Se não existir, criar com saldo zero
    const { data: newWallet, error: insertError } = await supabase
      .from('league_player_wallets')
      .insert({
        league_id: leagueId,
        user_id: userId,
        saldo_disponivel: 0,
        total_pago: 0,
        total_utilizado_partidas: 0,
        total_contribuido_caixinha: 0,
        total_pendente: 0,
      })
      .select('*, user:user_id(*), league:league_id(*)')
      .maybeSingle();

    if (insertError) {
      // Se houver conflito de duplicidade concorrente, tenta buscar novamente
      const { data: retryData } = await supabase
        .from('league_player_wallets')
        .select('*, user:user_id(*), league:league_id(*)')
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .maybeSingle();
      return (retryData as LeaguePlayerWallet) || null;
    }

    return (newWallet as LeaguePlayerWallet) || null;
  } catch (err) {
    console.error('Exceção ao buscar carteira:', err);
    return null;
  }
}

/**
 * Busca todas as carteiras do jogador em todas as ligas
 */
export async function getUserWallets(userId: string): Promise<LeaguePlayerWallet[]> {
  try {
    const { data, error } = await supabase
      .from('league_player_wallets')
      .select('*, user:user_id(*), league:league_id(*)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar carteiras do usuário:', error);
      return [];
    }

    return (data || []) as LeaguePlayerWallet[];
  } catch (err) {
    console.error('Exceção em getUserWallets:', err);
    return [];
  }
}

/**
 * Busca todos os caixas dos jogadores cadastrados em uma liga
 */
export async function getLeagueWallets(leagueId: string): Promise<LeaguePlayerWallet[]> {
  try {
    const { data, error } = await supabase
      .from('league_player_wallets')
      .select('*, user:user_id(*)')
      .eq('league_id', leagueId)
      .order('saldo_disponivel', { ascending: false });

    if (error) {
      console.error('Erro ao buscar caixas da liga:', error);
      return [];
    }

    return (data || []) as LeaguePlayerWallet[];
  } catch (err) {
    console.error('Exceção em getLeagueWallets:', err);
    return [];
  }
}

/**
 * Recalcula o saldo e os totalizadores da carteira de um jogador na liga
 */
export async function recalculateWallet(leagueId: string, userId: string): Promise<LeaguePlayerWallet | null> {
  try {
    // 1. Tentar chamar a RPC segura do banco caso esteja disponível
    const { data: rpcWallet, error: rpcError } = await supabase.rpc('recalculate_user_league_wallet', {
      p_league_id: leagueId,
      p_user_id: userId,
    });

    if (!rpcError && rpcWallet) {
      return rpcWallet as LeaguePlayerWallet;
    }

    // 2. Fallback direto via queries caso a RPC não esteja compilada
    const { data: txs } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    const { data: caixinhaTxs } = await supabase
      .from('league_caixinha_transactions')
      .select('*')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .eq('type', 'entry');

    const transactions = txs || [];
    const caixinhaEntries = caixinhaTxs || [];

    let totalPago = 0;
    let totalUtilizado = 0;
    let totalPendente = 0;
    let saldo = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'pending') {
        totalPendente += Number(tx.valor_informado || 0);
      } else if (tx.status === 'confirmed') {
        const conf = Number(tx.valor_confirmado || 0);
        const excedente = Number(tx.valor_excedente || 0);
        const gastoPartida = Number(tx.valor_utilizado_partida || 0);

        if (tx.type === 'match_payment' || tx.type === 'wallet_deposit') {
          totalPago += conf;
        }

        totalUtilizado += gastoPartida;

        if (tx.type === 'wallet_usage') {
          totalUtilizado += conf;
          saldo -= conf;
        } else if (tx.type === 'match_payment') {
          if (tx.destino_excedente === 'wallet') {
            saldo += excedente;
          }
        } else if (tx.type === 'wallet_deposit' || tx.type === 'admin_credit_adjust') {
          saldo += conf;
        } else if (tx.type === 'wallet_to_caixinha' || tx.type === 'admin_debit_adjust') {
          saldo -= conf;
        }
      }
    });

    const totalContribuido = caixinhaEntries.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);

    const cleanSaldo = Math.max(0, Number(saldo.toFixed(2)));
    const cleanPago = Number(totalPago.toFixed(2));
    const cleanUtilizado = Number(totalUtilizado.toFixed(2));
    const cleanContribuido = Number(totalContribuido.toFixed(2));
    const cleanPendente = Number(totalPendente.toFixed(2));

    const { data: updatedWallet } = await supabase
      .from('league_player_wallets')
      .upsert(
        {
          league_id: leagueId,
          user_id: userId,
          saldo_disponivel: cleanSaldo,
          total_pago: cleanPago,
          total_utilizado_partidas: cleanUtilizado,
          total_contribuido_caixinha: cleanContribuido,
          total_pendente: cleanPendente,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'league_id,user_id' }
      )
      .select('*, user:user_id(*), league:league_id(*)')
      .maybeSingle();

    return (updatedWallet as LeaguePlayerWallet) || null;
  } catch (err) {
    console.error('Erro ao recalcular carteira do jogador:', err);
    return null;
  }
}

/**
 * Busca todas as movimentações da Caixinha Coletiva da liga
 */
export async function getCaixinhaTransactions(leagueId: string): Promise<CaixinhaTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('league_caixinha_transactions')
      .select('*, user:user_id(*), admin:admin_id(*), match:match_id(*)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar extrato da caixinha:', error);
      return [];
    }

    return (data || []) as CaixinhaTransaction[];
  } catch (err) {
    console.error('Exceção em getCaixinhaTransactions:', err);
    return [];
  }
}

/**
 * Busca lista de transações com filtros
 */
export async function getLeagueTransactions(
  leagueId: string,
  options?: {
    status?: FinancialTransactionStatus;
    type?: FinancialTransactionType;
    userId?: string;
    matchId?: string;
    limit?: number;
  }
): Promise<FinancialTransaction[]> {
  try {
    let query = supabase
      .from('financial_transactions')
      .select('*, user:user_id(*), admin:confirmed_by(*), match:match_id(*), participant:match_participant_id(*)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.type) query = query.eq('type', options.type);
    if (options?.userId) query = query.eq('user_id', options.userId);
    if (options?.matchId) query = query.eq('match_id', options.matchId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar transações da liga:', error);
      return [];
    }

    return (data || []) as FinancialTransaction[];
  } catch (err) {
    console.error('Exceção em getLeagueTransactions:', err);
    return [];
  }
}

/**
 * Busca todas as transações de um jogador em uma liga específica
 */
export async function getUserLeagueTransactions(
  leagueId: string,
  userId: string,
): Promise<FinancialTransaction[]> {
  return getLeagueTransactions(leagueId, { userId });
}

/**
 * Retorna o resumo consolidado financeiro de uma liga
 */
export async function getLeagueFinancialSummary(leagueId: string): Promise<LeagueFinancialSummary> {
  try {
    const [
      { data: leagueData },
      { data: caixinhaTxs },
      { data: wallets },
      { data: pendingTxs },
      { data: confirmedMatchTxs },
      { data: matchExpenses },
      { data: leagueMatches },
    ] = await Promise.all([
      supabase.from('organizations').select('name, caixinha_name').eq('id', leagueId).maybeSingle(),
      supabase.from('league_caixinha_transactions').select('type, valor').eq('league_id', leagueId),
      supabase.from('league_player_wallets').select('saldo_disponivel').eq('league_id', leagueId),
      supabase.from('financial_transactions').select('valor_informado').eq('league_id', leagueId).eq('status', 'pending'),
      supabase.from('financial_transactions').select('valor_confirmado, valor_utilizado_partida').eq('league_id', leagueId).eq('status', 'confirmed').eq('type', 'match_payment'),
      supabase.from('match_expenses').select('valor, match:match_id(organization_id)'),
      supabase.from('matches').select('custo_aluguel').eq('organization_id', leagueId),
    ]);

    const caixinhaName = leagueData?.caixinha_name || 'Caixinha da Resenha';

    let caixinhaEntradas = 0;
    let caixinhaDespesas = 0;
    (caixinhaTxs || []).forEach((t) => {
      if (t.type === 'entry') caixinhaEntradas += Number(t.valor || 0);
      else if (t.type === 'expense') caixinhaDespesas += Number(t.valor || 0);
    });

    const caixinhaSaldo = Math.max(0, caixinhaEntradas - caixinhaDespesas);

    const totalCreditosJogadores = (wallets || []).reduce((acc, curr) => acc + Number(curr.saldo_disponivel || 0), 0);

    const pendingList = pendingTxs || [];
    const totalPendentesCount = pendingList.length;
    const totalPendentesValor = pendingList.reduce((acc, curr) => acc + Number(curr.valor_informado || 0), 0);

    const totalArrecadadoPartidas = (confirmedMatchTxs || []).reduce((acc, curr) => acc + Number(curr.valor_confirmado || 0), 0);

    const filteredExpenses = (matchExpenses || []).filter((e: any) => e.match?.organization_id === leagueId);
    const totalDespesasAvulsas = filteredExpenses.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
    const totalAlugueisArena = (leagueMatches || []).reduce((acc, curr: any) => acc + Number(curr.custo_aluguel || 0), 0);
    const totalDespesasPartidas = totalDespesasAvulsas + totalAlugueisArena;

    const balancoGeral = caixinhaSaldo + (totalArrecadadoPartidas - totalDespesasPartidas);

    return {
      league_id: leagueId,
      caixinha_name: caixinhaName,
      caixinha_saldo: Number(caixinhaSaldo.toFixed(2)),
      caixinha_total_arrecadado: Number(caixinhaEntradas.toFixed(2)),
      caixinha_total_despesas: Number(caixinhaDespesas.toFixed(2)),
      total_creditos_jogadores: Number(totalCreditosJogadores.toFixed(2)),
      total_pagamentos_pendentes_count: totalPendentesCount,
      total_pagamentos_pendentes_valor: Number(totalPendentesValor.toFixed(2)),
      total_arrecadado_partidas: Number(totalArrecadadoPartidas.toFixed(2)),
      total_despesas_partidas: Number(totalDespesasPartidas.toFixed(2)),
      balanco_geral: Number(balancoGeral.toFixed(2)),
    };
  } catch (err) {
    console.error('Erro ao calcular resumo financeiro da liga:', err);
    return {
      league_id: leagueId,
      caixinha_name: 'Caixinha da Resenha',
      caixinha_saldo: 0,
      caixinha_total_arrecadado: 0,
      caixinha_total_despesas: 0,
      total_creditos_jogadores: 0,
      total_pagamentos_pendentes_count: 0,
      total_pagamentos_pendentes_valor: 0,
      total_arrecadado_partidas: 0,
      total_despesas_partidas: 0,
      balanco_geral: 0,
    };
  }
}

/**
 * O jogador informa que realizou um pagamento (PIX ou depósito)
 * Registra a transação com status PENDENTE até aprovação do Administrador.
 */
export async function informMatchPayment(params: {
  matchId?: string | null;
  leagueId: string;
  userId: string;
  participantId?: string | null;
  valorPartida: number;
  valorInformado: number;
  destinoExcedente?: CreditDestination;
  comprovanteUrl?: string | null;
  observacoes?: string | null;
  userName?: string;
  matchTitle?: string;
}): Promise<{ success: boolean; transaction?: FinancialTransaction; error?: string }> {
  try {
    const {
      matchId,
      leagueId,
      userId,
      participantId,
      valorPartida,
      valorInformado,
      destinoExcedente = 'wallet',
      comprovanteUrl,
      observacoes,
    } = params;

    if (!valorInformado || valorInformado <= 0) {
      return { success: false, error: 'Informe um valor de pagamento válido.' };
    }

    const valorExcedente = Math.max(0, valorInformado - valorPartida);
    const txType: FinancialTransactionType = matchId ? 'match_payment' : 'wallet_deposit';

    // 1. Inserir na tabela de transações financeiras com status PENDENTE
    const { data: newTx, error: txError } = await supabase
      .from('financial_transactions')
      .insert({
        league_id: leagueId,
        user_id: userId,
        match_id: matchId || null,
        match_participant_id: participantId || null,
        type: txType,
        valor_partida: valorPartida,
        valor_informado: valorInformado,
        valor_confirmado: null, // Nulo até confirmação oficial do admin!
        valor_utilizado_partida: 0,
        valor_excedente: valorExcedente,
        destino_excedente: destinoExcedente,
        status: 'pending',
        comprovante_url: comprovanteUrl || null,
        observacoes: observacoes || null,
      })
      .select('*, user:user_id(*), match:match_id(*)')
      .single();

    if (txError) {
      console.error('Erro ao registrar transação pendente:', txError);
      return { success: false, error: 'Não foi possível registrar o pagamento informado.' };
    }

    // 2. Atualizar participante da partida com status de aguardando aprovação
    if (participantId) {
      await supabase
        .from('match_participants')
        .update({
          payment_status: 'waiting_approval',
          amount_informed: valorInformado,
          credit_destination: destinoExcedente,
          payment_proof_url: comprovanteUrl || null,
        })
        .eq('id', participantId);
    }

    // 3. Recalcular saldo e pendências da carteira
    await recalculateWallet(leagueId, userId);

    // 4. Log de auditoria
    await logFinancialAudit({
      leagueId,
      actorId: userId,
      financialTransactionId: newTx.id,
      action: 'inform_payment',
      description: matchId
        ? `Jogador informou pagamento de ${formatCurrency(valorInformado)} (Partida: ${formatCurrency(valorPartida)}). Aguardando confirmação.`
        : `Jogador solicitou adição de crédito no valor de ${formatCurrency(valorInformado)} no caixa. Aguardando confirmação.`,
      newData: {
        valor_informado: valorInformado,
        valor_partida: valorPartida,
        destino_excedente: destinoExcedente,
      },
    });

    // 5. Notificar os administradores da liga
    const { data: admins } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', leagueId)
      .in('role', ['owner', 'admin']);

    if (admins && admins.length > 0) {
      const pName = params.userName || 'Jogador';
      const mTitle = params.matchTitle || 'Partida';
      const notifTitle = matchId ? 'Novo Pagamento para Conferir 💵' : 'Nova Solicitação de Crédito no Caixa 💰';
      const notifMessage = matchId
        ? `${pName} informou o pagamento de ${formatCurrency(valorInformado)} para "${mTitle}".`
        : `${pName} solicitou adição de crédito de ${formatCurrency(valorInformado)} no caixa da liga.`;

      for (const adm of admins) {
        if (adm.user_id !== userId) {
          void createNotification({
            userId: adm.user_id,
            type: 'payment_pending',
            category: 'payments',
            priority: 'high',
            title: notifTitle,
            message: notifMessage,
            link: `/administracao/financeiro?league=${leagueId}&tab=pending`,
            metadata: {
              transaction_id: newTx.id,
              league_id: leagueId,
              amount_informed: valorInformado,
              type: txType,
            },
          });
        }
      }
    }

    return { success: true, transaction: newTx as FinancialTransaction };
  } catch (err: any) {
    console.error('Exceção ao informar pagamento:', err);
    return { success: false, error: err.message || 'Erro ao processar transação.' };
  }
}

/**
 * O jogador paga a partida usando o saldo disponível do seu caixa na liga
 * Abate instantaneamente do saldo sem necessidade de PIX
 */
export async function payMatchWithWallet(params: {
  matchId: string;
  leagueId: string;
  userId: string;
  participantId: string;
  valorPartida: number;
}): Promise<{ success: boolean; error?: string; saldoRestante?: number }> {
  try {
    const { matchId, leagueId, userId, participantId, valorPartida } = params;

    // 1. Tentar executar via RPC atômica no banco de dados (com FOR UPDATE e garantia ACID)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('pay_match_with_wallet_atomic', {
      p_match_id: matchId,
      p_league_id: leagueId,
      p_user_id: userId,
      p_participant_id: participantId,
      p_amount: valorPartida,
    });

    if (!rpcErr && rpcRes) {
      if (rpcRes.success) {
        return { success: true, saldoRestante: rpcRes.saldo_restante };
      } else {
        return { success: false, error: rpcRes.error || 'Erro ao processar pagamento com saldo.' };
      }
    }

    // 2. Fallback caso RPC não esteja disponível
    const wallet = await getLeagueWallet(leagueId, userId);
    if (!wallet || wallet.saldo_disponivel < valorPartida) {
      return {
        success: false,
        error: `Saldo insuficiente para pagar a coleta. Você possui ${formatCurrency(wallet?.saldo_disponivel || 0)} de saldo nesta liga.`,
      };
    }

    // Verificar se já está pago
    const { data: part } = await supabase
      .from('match_participants')
      .select('paid')
      .eq('id', participantId)
      .maybeSingle();

    if (part?.paid) {
      return { success: false, error: 'Esta coleta já foi paga anteriormente.' };
    }

    // Criar transação confirmada de uso de saldo (wallet_usage)
    const { data: tx, error: txError } = await supabase
      .from('financial_transactions')
      .insert({
        league_id: leagueId,
        user_id: userId,
        match_id: matchId,
        match_participant_id: participantId,
        type: 'wallet_usage',
        valor_partida: valorPartida,
        valor_informado: valorPartida,
        valor_confirmado: valorPartida,
        valor_utilizado_partida: valorPartida,
        valor_excedente: 0,
        status: 'confirmed',
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
        observacoes: 'Pagamento da coleta realizado com saldo da carteira.',
      })
      .select()
      .single();

    if (txError) {
      console.error('Erro ao registrar transação de uso de saldo:', txError);
      return { success: false, error: 'Erro ao debitar saldo da carteira.' };
    }

    // Atualizar participante como PAGO via carteira
    await supabase
      .from('match_participants')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        payment_status: 'approved',
        payment_method: 'wallet',
        amount_confirmed: valorPartida,
      })
      .eq('id', participantId);

    // Recalcular carteira
    const updatedWallet = await recalculateWallet(leagueId, userId);

    // Auditoria
    await logFinancialAudit({
      leagueId,
      actorId: userId,
      financialTransactionId: tx.id,
      action: 'pay_with_wallet',
      description: `Jogador utilizou ${formatCurrency(valorPartida)} do seu saldo em carteira para pagar a coleta da partida.`,
      newData: {
        match_id: matchId,
        participant_id: participantId,
        valor_pago: valorPartida,
        saldo_restante: updatedWallet?.saldo_disponivel,
      },
    });

    return { success: true, saldoRestante: updatedWallet?.saldo_disponivel };
  } catch (err: any) {
    console.error('Exceção ao pagar com saldo:', err);
    return { success: false, error: err.message || 'Erro ao processar pagamento com saldo.' };
  }
}

/**
 * O Administrador ou Super Administrador confirma um pagamento
 * Se o valor confirmado for maior que o valor da partida, destina a sobra para a carteira ou caixinha
 */
export async function confirmPayment(params: {
  transactionId: string;
  confirmedAmount: number;
  adminId: string;
  creditDestination?: CreditDestination;
  observacoes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { transactionId, confirmedAmount, adminId, creditDestination, observacoes } = params;

    // 1. Buscar a transação existente
    const { data: tx, error: fetchErr } = await supabase
      .from('financial_transactions')
      .select('*, match:match_id(*)')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !tx) {
      return { success: false, error: 'Transação financeira não encontrada.' };
    }

    const valorPartida = Number(tx.valor_partida || 0);
    const valorUtilizado = Math.min(confirmedAmount, valorPartida);
    const valorExcedente = Math.max(0, confirmedAmount - valorPartida);
    const destination: CreditDestination = creditDestination || tx.destino_excedente || 'wallet';

    // 2. Atualizar transação para CONFIRMADA
    const { error: updateErr } = await supabase
      .from('financial_transactions')
      .update({
        status: 'confirmed',
        valor_confirmado: confirmedAmount,
        valor_utilizado_partida: valorUtilizado,
        valor_excedente: valorExcedente,
        destino_excedente: destination,
        confirmed_by: adminId,
        confirmed_at: new Date().toISOString(),
        observacoes: observacoes || tx.observacoes,
      })
      .eq('id', transactionId);

    if (updateErr) {
      console.error('Erro ao atualizar transação para confirmada:', updateErr);
      return { success: false, error: 'Erro ao confirmar pagamento no banco de dados.' };
    }

    // 3. Se houver excedente e o destino for a Caixinha da Resenha, lançar na caixinha
    if (valorExcedente > 0 && destination === 'caixinha') {
      await supabase.from('league_caixinha_transactions').insert({
        league_id: tx.league_id,
        type: 'entry',
        descricao: `Contribuição de sobra de pagamento (Partida: ${tx.match?.titulo || 'Partida'})`,
        valor: valorExcedente,
        categoria: 'contribuicao',
        user_id: tx.user_id,
        admin_id: adminId,
        match_id: tx.match_id,
        financial_transaction_id: tx.id,
      });
    }

    // 4. Se houver match_participant vinculado, atualizar status para aprovado
    if (tx.match_participant_id) {
      await supabase
        .from('match_participants')
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          payment_status: 'approved',
          amount_confirmed: confirmedAmount,
        })
        .eq('id', tx.match_participant_id);
    }

    // 5. Recalcular a carteira do jogador
    await recalculateWallet(tx.league_id, tx.user_id);

    // 6. Registrar Auditoria
    await logFinancialAudit({
      leagueId: tx.league_id,
      actorId: adminId,
      financialTransactionId: tx.id,
      action: 'confirm_payment',
      description: `Administrador confirmou pagamento de ${formatCurrency(confirmedAmount)} (Informado: ${formatCurrency(tx.valor_informado)}). ${
        valorExcedente > 0
          ? `Sobra de ${formatCurrency(valorExcedente)} enviada para ${destination === 'caixinha' ? 'a Caixinha da Resenha' : 'o Caixa do Jogador'}.`
          : ''
      }`,
      oldData: { status: tx.status, valor_confirmado: tx.valor_confirmado },
      newData: { status: 'confirmed', valor_confirmado: confirmedAmount, destino_excedente: destination },
    });

    // 7. Notificar o jogador
    void createNotification({
      userId: tx.user_id,
      type: 'payment_confirmed',
      category: 'payments',
      priority: 'normal',
      title: 'Pagamento Confirmado! 💵',
      message: `Seu pagamento de ${formatCurrency(confirmedAmount)} foi validado pelo Administrador. ${
        valorExcedente > 0
          ? `Crédito excedente de ${formatCurrency(valorExcedente)} destinado para ${
              destination === 'caixinha' ? 'a Caixinha' : 'seu Caixa'
            }.`
          : ''
      }`,
      link: `/matches/${tx.match_id || ''}`,
      metadata: { transaction_id: tx.id, amount_confirmed: confirmedAmount },
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao confirmar pagamento:', err);
    return { success: false, error: err.message || 'Erro ao processar confirmação de pagamento.' };
  }
}

/**
 * O Administrador rejeita um pagamento informado
 */
export async function rejectPayment(params: {
  transactionId: string;
  adminId: string;
  motivo: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { transactionId, adminId, motivo } = params;

    const { data: tx, error: fetchErr } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !tx) {
      return { success: false, error: 'Transação não encontrada.' };
    }

    // Atualizar transação para rejeitada
    const { error: updateErr } = await supabase
      .from('financial_transactions')
      .update({
        status: 'rejected',
        motivo_rejeicao: motivo,
        confirmed_by: adminId,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (updateErr) {
      return { success: false, error: 'Erro ao rejeitar pagamento.' };
    }

    // Se houver participante vinculado, atualizar status para rejeitado
    if (tx.match_participant_id) {
      await supabase
        .from('match_participants')
        .update({
          paid: false,
          payment_status: 'rejected',
        })
        .eq('id', tx.match_participant_id);
    }

    // Recalcular carteira
    await recalculateWallet(tx.league_id, tx.user_id);

    // Auditoria
    await logFinancialAudit({
      leagueId: tx.league_id,
      actorId: adminId,
      financialTransactionId: tx.id,
      action: 'reject_payment',
      description: `Administrador rejeitou pagamento de ${formatCurrency(tx.valor_informado)}. Motivo: ${motivo}`,
      oldData: { status: tx.status },
      newData: { status: 'rejected', motivo_rejeicao: motivo },
    });

    // Notificar jogador
    void createNotification({
      userId: tx.user_id,
      type: 'payment_rejected',
      category: 'payments',
      priority: 'high',
      title: 'Pagamento Não Confirmado ⚠️',
      message: `Seu pagamento de ${formatCurrency(tx.valor_informado)} foi recusado. Motivo: ${motivo}`,
      link: tx.match_id ? `/matches/${tx.match_id}` : undefined,
      metadata: { transaction_id: tx.id, motivo },
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao rejeitar pagamento:', err);
    return { success: false, error: err.message || 'Erro ao rejeitar pagamento.' };
  }
}

/**
 * O jogador transfere parte ou total do seu saldo disponível para a Caixinha Coletiva da Liga
 */
export async function transferWalletToCaixinha(params: {
  leagueId: string;
  userId: string;
  amount: number;
  description?: string;
  adminId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { leagueId, userId, amount, description, adminId } = params;

    if (!amount || amount <= 0) {
      return { success: false, error: 'Informe um valor válido para transferência.' };
    }

    const wallet = await getLeagueWallet(leagueId, userId);
    if (!wallet || wallet.saldo_disponivel < amount) {
      return {
        success: false,
        error: `Saldo insuficiente. Saldo disponível: ${formatCurrency(wallet?.saldo_disponivel || 0)}`,
      };
    }

    // 1. Criar transação de débito no caixa do jogador (wallet_to_caixinha)
    const { data: tx, error: txError } = await supabase
      .from('financial_transactions')
      .insert({
        league_id: leagueId,
        user_id: userId,
        type: 'wallet_to_caixinha',
        valor_partida: 0,
        valor_informado: amount,
        valor_confirmado: amount,
        valor_utilizado_partida: 0,
        valor_excedente: 0,
        destino_excedente: 'caixinha',
        status: 'confirmed',
        confirmed_by: adminId || userId,
        confirmed_at: new Date().toISOString(),
        observacoes: description || 'Transferência voluntária para a Caixinha da Resenha.',
      })
      .select()
      .single();

    if (txError) {
      console.error('Erro ao debitar carteira para caixinha:', txError);
      return { success: false, error: 'Erro ao transferir valor para a caixinha.' };
    }

    // 2. Criar entrada na Caixinha da Resenha
    await supabase.from('league_caixinha_transactions').insert({
      league_id: leagueId,
      type: 'entry',
      descricao: description || 'Contribuição voluntária do jogador',
      valor: amount,
      categoria: 'contribuicao',
      user_id: userId,
      admin_id: adminId || null,
      financial_transaction_id: tx.id,
    });

    // 3. Recalcular carteira do jogador
    await recalculateWallet(leagueId, userId);

    // 4. Auditoria
    await logFinancialAudit({
      leagueId,
      actorId: adminId || userId,
      financialTransactionId: tx.id,
      action: 'transfer_to_caixinha',
      description: `Transferência de ${formatCurrency(amount)} do saldo do jogador para a Caixinha da Resenha.`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exceção em transferWalletToCaixinha:', err);
    return { success: false, error: err.message || 'Erro na transferência.' };
  }
}

/**
 * Lançar uma despesa da Caixinha Coletiva da Liga
 */
export async function addCaixinhaExpense(params: {
  leagueId: string;
  adminId: string;
  descricao: string;
  valor: number;
  categoria?: CaixinhaCategory | string;
  comprovanteUrl?: string | null;
  matchId?: string | null;
}): Promise<{ success: boolean; transaction?: CaixinhaTransaction; error?: string }> {
  try {
    const { leagueId, adminId, descricao, valor, categoria = 'outros', comprovanteUrl, matchId } = params;

    if (!descricao.trim()) return { success: false, error: 'Informe a descrição da despesa.' };
    if (!valor || valor <= 0) return { success: false, error: 'Informe um valor de despesa válido.' };

    const { data: newExpense, error } = await supabase
      .from('league_caixinha_transactions')
      .insert({
        league_id: leagueId,
        admin_id: adminId,
        type: 'expense',
        descricao: descricao.trim(),
        valor: valor,
        categoria: categoria,
        comprovante_url: comprovanteUrl || null,
        match_id: matchId || null,
      })
      .select('*, admin:admin_id(*)')
      .single();

    if (error) {
      console.error('Erro ao lançar despesa na caixinha:', error);
      return { success: false, error: 'Erro ao registrar despesa na caixinha.' };
    }

    // Auditoria
    await logFinancialAudit({
      leagueId,
      actorId: adminId,
      caixinhaTransactionId: newExpense.id,
      action: 'add_caixinha_expense',
      description: `Despesa de ${formatCurrency(valor)} lançada na Caixinha (${descricao.trim()}).`,
      newData: { descricao, valor, categoria },
    });

    return { success: true, transaction: newExpense as CaixinhaTransaction };
  } catch (err: any) {
    console.error('Exceção em addCaixinhaExpense:', err);
    return { success: false, error: err.message || 'Erro ao lançar despesa.' };
  }
}

/**
 * Remove uma despesa da Caixinha
 */
export async function deleteCaixinhaExpense(
  expenseId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: exp, error: fetchErr } = await supabase
      .from('league_caixinha_transactions')
      .select('*')
      .eq('id', expenseId)
      .single();

    if (fetchErr || !exp) return { success: false, error: 'Despesa não encontrada.' };

    const { error: delErr } = await supabase
      .from('league_caixinha_transactions')
      .delete()
      .eq('id', expenseId);

    if (delErr) return { success: false, error: 'Erro ao remover despesa.' };

    // Auditoria
    await logFinancialAudit({
      leagueId: exp.league_id,
      actorId: adminId,
      action: 'delete_caixinha_expense',
      description: `Despesa de ${formatCurrency(exp.valor)} removida (${exp.descricao}).`,
      oldData: exp,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exceção em deleteCaixinhaExpense:', err);
    return { success: false, error: err.message || 'Erro ao excluir despesa.' };
  }
}

/**
 * Ajuste administrativo manual de crédito ou débito na carteira do jogador
 */
export async function addManualBalanceAdjust(params: {
  leagueId: string;
  userId: string;
  adminId: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { leagueId, userId, adminId, type, amount, reason } = params;

    if (!amount || amount <= 0) return { success: false, error: 'Informe um valor válido.' };
    if (!reason.trim()) return { success: false, error: 'Informe o motivo do ajuste.' };

    const txType: FinancialTransactionType = type === 'credit' ? 'admin_credit_adjust' : 'admin_debit_adjust';

    const { data: tx, error: txErr } = await supabase
      .from('financial_transactions')
      .insert({
        league_id: leagueId,
        user_id: userId,
        type: txType,
        valor_partida: 0,
        valor_informado: amount,
        valor_confirmado: amount,
        valor_utilizado_partida: 0,
        valor_excedente: 0,
        status: 'confirmed',
        confirmed_by: adminId,
        confirmed_at: new Date().toISOString(),
        observacoes: `Ajuste administrativo (${type === 'credit' ? 'Crédito' : 'Débito'}): ${reason.trim()}`,
      })
      .select()
      .single();

    if (txErr) return { success: false, error: 'Erro ao inserir ajuste.' };

    // Recalcular carteira
    await recalculateWallet(leagueId, userId);

    // Auditoria
    await logFinancialAudit({
      leagueId,
      actorId: adminId,
      financialTransactionId: tx.id,
      action: type === 'credit' ? 'admin_credit_adjust' : 'admin_debit_adjust',
      description: `Ajuste manual de ${type === 'credit' ? '+' : '-'}${formatCurrency(amount)} na carteira do jogador. Motivo: ${reason}`,
      newData: { type, amount, reason },
    });

    // Notificar jogador
    void createNotification({
      userId,
      type: 'payment_confirmed',
      category: 'payments',
      priority: 'normal',
      title: `Ajuste de Saldo (${type === 'credit' ? 'Crédito Adicionado' : 'Débito Lançado'}) 💳`,
      message: `Foi realizado um ajuste de ${type === 'credit' ? '+' : '-'}${formatCurrency(amount)} no seu caixa. Motivo: ${reason}`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exceção em addManualBalanceAdjust:', err);
    return { success: false, error: err.message || 'Erro ao realizar ajuste manual.' };
  }
}

/**
 * Atualiza o nome e descrição da Caixinha Coletiva da liga
 */
export async function updateLeagueCaixinhaName(
  leagueId: string,
  name: string,
  description?: string,
  adminId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanName = name.trim() || 'Caixinha da Resenha';
    const { error } = await supabase
      .from('organizations')
      .update({
        caixinha_name: cleanName,
        caixinha_description: description?.trim() || null,
      })
      .eq('id', leagueId);

    if (error) return { success: false, error: 'Erro ao salvar nome da caixinha.' };

    if (adminId) {
      await logFinancialAudit({
        leagueId,
        actorId: adminId,
        action: 'rename_caixinha',
        description: `Nome da caixinha alterado para "${cleanName}".`,
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao renomear caixinha:', err);
    return { success: false, error: err.message || 'Erro ao renomear.' };
  }
}

/**
 * Busca o histórico de logs de auditoria financeira
 */
export async function getFinancialAuditLogs(leagueId: string, limit = 100): Promise<FinancialAuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('financial_audit_logs')
      .select('*, actor:actor_id(*)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao carregar logs de auditoria:', error);
      return [];
    }

    return (data || []) as FinancialAuditLog[];
  } catch (err) {
    console.error('Exceção em getFinancialAuditLogs:', err);
    return [];
  }
}

/**
 * O Administrador adiciona crédito diretamente à carteira do membro da liga
 */
export async function adminAddWalletCredit(params: {
  leagueId: string;
  userId: string;
  adminId: string;
  amount: number;
  reason?: string;
}): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { leagueId, userId, adminId, amount, reason } = params;

    if (!amount || amount <= 0) {
      return { success: false, error: 'Informe um valor de crédito válido e positivo.' };
    }

    // 1. Chamar RPC atômica no banco de dados
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_add_wallet_credit', {
      p_league_id: leagueId,
      p_user_id: userId,
      p_admin_id: adminId,
      p_amount: amount,
      p_reason: reason?.trim() || null,
    });

    if (!rpcErr && rpcRes) {
      if (rpcRes.success) {
        // Notificar jogador
        void createNotification({
          userId,
          type: 'payment_confirmed',
          category: 'payments',
          priority: 'normal',
          title: 'Crédito Adicionado à Carteira! 💰',
          message: `O administrador adicionou +${formatCurrency(amount)} à sua carteira nesta liga. Saldo atual: ${formatCurrency(rpcRes.saldo_disponivel)}.`,
        });

        return { success: true, newBalance: rpcRes.saldo_disponivel };
      } else {
        return { success: false, error: rpcRes.error || 'Erro ao adicionar crédito.' };
      }
    }

    // 2. Fallback manual caso RPC falhe
    const { data: tx, error: txErr } = await supabase
      .from('financial_transactions')
      .insert({
        league_id: leagueId,
        user_id: userId,
        type: 'admin_credit_adjust',
        valor_partida: 0,
        valor_informado: amount,
        valor_confirmado: amount,
        valor_utilizado_partida: 0,
        valor_excedente: 0,
        destino_excedente: 'wallet',
        status: 'confirmed',
        confirmed_by: adminId,
        confirmed_at: new Date().toISOString(),
        observacoes: reason?.trim() || 'Crédito adicionado pelo administrador.',
      })
      .select()
      .single();

    if (txErr) {
      return { success: false, error: 'Erro ao registrar crédito na carteira.' };
    }

    const updatedWallet = await recalculateWallet(leagueId, userId);

    await logFinancialAudit({
      leagueId,
      actorId: adminId,
      financialTransactionId: tx.id,
      action: 'admin_add_wallet_credit',
      description: `Crédito de +${formatCurrency(amount)} adicionado pelo administrador à carteira do membro. Motivo: ${reason || 'Sem observação'}`,
      newData: { user_id: userId, amount, reason, novo_saldo: updatedWallet?.saldo_disponivel },
    });

    void createNotification({
      userId,
      type: 'payment_confirmed',
      category: 'payments',
      priority: 'normal',
      title: 'Crédito Adicionado à Carteira! 💰',
      message: `O administrador adicionou +${formatCurrency(amount)} à sua carteira nesta liga.`,
    });

    return { success: true, newBalance: updatedWallet?.saldo_disponivel };
  } catch (err: any) {
    console.error('Exceção em adminAddWalletCredit:', err);
    return { success: false, error: err.message || 'Erro ao adicionar crédito à carteira.' };
  }
}

/**
 * O Administrador registra uma doação/crédito na Caixinha da Liga com Doador Obrigatório
 */
export async function adminAddCaixinhaDonation(params: {
  leagueId: string;
  adminId: string;
  amount: number;
  donorName: string;
  observation?: string;
  userId?: string | null;
}): Promise<{ success: boolean; transaction?: CaixinhaTransaction; error?: string }> {
  try {
    const { leagueId, adminId, amount, donorName, observation, userId } = params;

    if (!amount || amount <= 0) {
      return { success: false, error: 'Informe um valor de doação válido e positivo.' };
    }

    const cleanDonor = donorName?.trim();
    if (!cleanDonor) {
      return { success: false, error: 'Informe quem realizou a doação (campo obrigatório).' };
    }

    // 1. Tentar chamar RPC atômica
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_add_caixinha_donation', {
      p_league_id: leagueId,
      p_admin_id: adminId,
      p_amount: amount,
      p_donor_name: cleanDonor,
      p_observation: observation?.trim() || null,
      p_user_id: userId || null,
    });

    if (!rpcErr && rpcRes) {
      if (rpcRes.success) {
        return { success: true };
      } else {
        return { success: false, error: rpcRes.error || 'Erro ao registrar doação na caixinha.' };
      }
    }

    // 2. Fallback direto
    const { data: newEntry, error: insertErr } = await supabase
      .from('league_caixinha_transactions')
      .insert({
        league_id: leagueId,
        type: 'entry',
        descricao: `Doação de ${cleanDonor}`,
        valor: amount,
        categoria: 'contribuicao',
        admin_id: adminId,
        user_id: userId || null,
        doador_nome: cleanDonor,
        observacoes: observation?.trim() || null,
      })
      .select('*, admin:admin_id(*)')
      .single();

    if (insertErr) {
      console.error('Erro ao registrar doação na caixinha:', insertErr);
      return { success: false, error: 'Erro ao registrar doação na caixinha.' };
    }

    await logFinancialAudit({
      leagueId,
      actorId: adminId,
      caixinhaTransactionId: newEntry.id,
      action: 'admin_add_caixinha_donation',
      description: `Doação de ${formatCurrency(amount)} realizada por ${cleanDonor} registrada na Caixinha.`,
      newData: { doador_nome: cleanDonor, valor: amount, observacoes: observation },
    });

    return { success: true, transaction: newEntry as CaixinhaTransaction };
  } catch (err: any) {
    console.error('Exceção em adminAddCaixinhaDonation:', err);
    return { success: false, error: err.message || 'Erro ao registrar doação na caixinha.' };
  }
}

/**
 * Busca todos os membros ativos da liga cruzando com suas carteiras.
 * Garante que mesmo membros sem movimentações prévias apareçam na listagem com saldo R$ 0,00.
 */
export async function getLeagueMembersWithWallets(leagueId: string): Promise<LeaguePlayerWallet[]> {
  try {
    // 1. Buscar membros da organização/liga
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('user_id, role, user:user_id(*)')
      .eq('organization_id', leagueId);

    if (membersError) {
      console.error('Erro ao buscar membros da liga:', membersError);
      return getLeagueWallets(leagueId);
    }

    // 2. Buscar todas as carteiras existentes desta liga
    const wallets = await getLeagueWallets(leagueId);
    const walletMap = new Map<string, LeaguePlayerWallet>();
    wallets.forEach((w) => walletMap.set(w.user_id, w));

    // 3. Montar lista combinada completa
    const fullList: LeaguePlayerWallet[] = [];
    const seenUserIds = new Set<string>();

    (members || []).forEach((m: any) => {
      if (!m.user_id || seenUserIds.has(m.user_id)) return;
      seenUserIds.add(m.user_id);

      const existingWallet = walletMap.get(m.user_id);
      if (existingWallet) {
        if (!existingWallet.user && m.user) {
          existingWallet.user = m.user;
        }
        fullList.push(existingWallet);
      } else {
        fullList.push({
          id: `virtual_${m.user_id}`,
          league_id: leagueId,
          user_id: m.user_id,
          saldo_disponivel: 0,
          total_pago: 0,
          total_utilizado_partidas: 0,
          total_contribuido_caixinha: 0,
          total_pendente: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user: m.user,
        });
      }
    });

    // Adicionar carteiras que porventura existam sem estar em organization_members
    wallets.forEach((w) => {
      if (!seenUserIds.has(w.user_id)) {
        seenUserIds.add(w.user_id);
        fullList.push(w);
      }
    });

    // Ordenar: primeiro quem tem saldo positivo, depois por nome
    return fullList.sort((a, b) => {
      if (b.saldo_disponivel !== a.saldo_disponivel) {
        return b.saldo_disponivel - a.saldo_disponivel;
      }
      const nameA = a.user?.nome || '';
      const nameB = b.user?.nome || '';
      return nameA.localeCompare(nameB);
    });
  } catch (err) {
    console.error('Exceção em getLeagueMembersWithWallets:', err);
    return getLeagueWallets(leagueId);
  }
}

