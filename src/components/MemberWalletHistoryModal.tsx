'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, TrendingUp, TrendingDown, Clock, ShieldCheck, Wallet, RefreshCw } from 'lucide-react';
import { Profile } from '@/types/database';
import { FinancialTransaction } from '@/types/finance';
import { getUserLeagueTransactions, formatCurrency } from '@/lib/financeHelper';

interface MemberWalletHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  currentBalance: number;
  leagueId: string;
  leagueName?: string;
}

export const MemberWalletHistoryModal: React.FC<MemberWalletHistoryModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentBalance = 0,
  leagueId,
  leagueName,
}) => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const playerName = targetUser?.apelido
    ? `${targetUser.nome} (${targetUser.apelido})`
    : targetUser?.nome || 'Jogador';

  const loadHistory = async () => {
    if (!targetUser || !leagueId) return;
    setIsLoading(true);
    const txs = await getUserLeagueTransactions(leagueId, targetUser.id);
    setTransactions(txs);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen && targetUser && leagueId) {
      loadHistory();
    }
  }, [isOpen, targetUser?.id, leagueId]);

  if (!isOpen || !targetUser) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  Extrato da Carteira
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[220px]">
                  {playerName} • {leagueName || 'Liga'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadHistory}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                title="Recarregar extrato"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Saldo Atual */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-500/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="font-bold">Saldo Atual Disponível:</span>
            </div>
            <strong className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(currentBalance)}
            </strong>
          </div>

          {/* Lista de Movimentações */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Carregando movimentações...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma movimentação financeira registrada para este jogador nesta liga.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => {
                  const isCredit =
                    tx.type === 'admin_credit_adjust' ||
                    tx.type === 'wallet_deposit' ||
                    (tx.type === 'match_payment' && tx.destino_excedente === 'wallet' && tx.valor_excedente > 0);

                  let label = 'Movimentação';
                  if (tx.type === 'admin_credit_adjust') label = 'Crédito adicionado pelo administrador';
                  else if (tx.type === 'wallet_usage') label = 'Pagamento de Coleta';
                  else if (tx.type === 'wallet_deposit') label = 'Adição de Crédito';
                  else if (tx.type === 'wallet_to_caixinha') label = 'Transferência para Caixinha';
                  else if (tx.type === 'match_payment') label = 'Pagamento de Partida';
                  else if (tx.type === 'admin_debit_adjust') label = 'Débito administrativo';

                  const amount =
                    tx.type === 'match_payment' && tx.destino_excedente === 'wallet' && tx.valor_excedente > 0
                      ? tx.valor_excedente
                      : tx.valor_confirmado || tx.valor_informado || 0;

                  return (
                    <div key={tx.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isCredit
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isCredit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                            {label}
                          </span>
                          {tx.match && (
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 block truncate font-medium">
                              Partida: {tx.match.titulo}
                            </span>
                          )}
                          {tx.observacoes && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block italic">
                              "{tx.observacoes}"
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>
                              {new Date(tx.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(tx.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {tx.admin && (
                              <span>• Por: {tx.admin.apelido || tx.admin.nome || 'Admin'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-black text-xs block ${
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isCredit ? '+' : '-'} {formatCurrency(amount)}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                            tx.status === 'confirmed'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : tx.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-red-500/10 text-red-600'
                          }`}
                        >
                          {tx.status === 'confirmed'
                            ? 'Confirmado'
                            : tx.status === 'pending'
                            ? 'Pendente'
                            : 'Rejeitado'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-6 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
