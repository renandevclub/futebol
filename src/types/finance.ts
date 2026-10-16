import { Profile, League, Match, MatchParticipant } from './database';

export type FinancialTransactionType =
  | 'match_payment'         // Pagamento de partida informado pelo jogador
  | 'wallet_deposit'         // Adição de crédito antecipado
  | 'wallet_usage'           // Uso de saldo disponível para pagar partida
  | 'wallet_to_caixinha'     // Transferência de crédito do jogador para a caixinha
  | 'admin_credit_adjust'    // Crédito manual inserido pelo Administrador
  | 'admin_debit_adjust'     // Débito manual inserido pelo Administrador
  | 'caixinha_expense'       // Despesa da caixinha
  | 'caixinha_direct_entry'; // Entrada avulsa direta na caixinha

export type FinancialTransactionStatus =
  | 'pending'    // Aguardando conferência do Administrador
  | 'confirmed'  // Confirmado oficialmente
  | 'rejected'   // Rejeitado pelo Administrador
  | 'adjusted';  // Corrigido administrativamente

export type CreditDestination = 'wallet' | 'caixinha' | 'pending_choice';

export interface LeaguePlayerWallet {
  id: string;
  league_id: string;
  user_id: string;
  saldo_disponivel: number;
  total_pago: number;
  total_utilizado_partidas: number;
  total_contribuido_caixinha: number;
  total_pendente: number;
  created_at: string;
  updated_at: string;
  user?: Profile;
  league?: League;
}

export interface FinancialTransaction {
  id: string;
  league_id: string;
  user_id: string;
  match_id?: string | null;
  match_participant_id?: string | null;
  type: FinancialTransactionType;
  valor_partida: number;
  valor_informado: number;
  valor_confirmado?: number | null;
  valor_utilizado_partida: number;
  valor_excedente: number;
  destino_excedente?: CreditDestination | null;
  status: FinancialTransactionStatus;
  comprovante_url?: string | null;
  motivo_rejeicao?: string | null;
  observacoes?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
  admin?: Profile;
  match?: Match;
  league?: League;
  participant?: MatchParticipant;
}

export type CaixinhaTransactionType = 'entry' | 'expense' | 'adjustment';

export type CaixinhaCategory =
  | 'churrasco'
  | 'bebidas'
  | 'quadra'
  | 'materiais'
  | 'premiacao'
  | 'contribuicao'
  | 'outros';

export interface CaixinhaTransaction {
  id: string;
  league_id: string;
  type: CaixinhaTransactionType;
  descricao: string;
  valor: number;
  categoria?: CaixinhaCategory | string;
  user_id?: string | null;
  admin_id?: string | null;
  match_id?: string | null;
  financial_transaction_id?: string | null;
  comprovante_url?: string | null;
  doador_nome?: string | null;
  observacoes?: string | null;
  created_at: string;
  user?: Profile | null;
  admin?: Profile | null;
  match?: Match | null;
  league?: League | null;
}

export interface FinancialAuditLog {
  id: string;
  league_id: string;
  actor_id: string;
  financial_transaction_id?: string | null;
  caixinha_transaction_id?: string | null;
  action: string;
  description: string;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  created_at: string;
  actor?: Profile;
  league?: League;
}

export interface LeagueFinancialSummary {
  league_id: string;
  caixinha_name: string;
  caixinha_saldo: number;
  caixinha_total_arrecadado: number;
  caixinha_total_despesas: number;
  total_creditos_jogadores: number;
  total_pagamentos_pendentes_count: number;
  total_pagamentos_pendentes_valor: number;
  total_arrecadado_partidas: number;
  total_despesas_partidas: number;
  balanco_geral: number;
}
