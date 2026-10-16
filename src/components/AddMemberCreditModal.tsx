'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlusCircle, Coins, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { Profile } from '@/types/database';
import { adminAddWalletCredit, formatCurrency } from '@/lib/financeHelper';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface AddMemberCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  currentBalance: number;
  leagueId: string;
  leagueName?: string;
  onSuccess?: () => void;
}

export const AddMemberCreditModal: React.FC<AddMemberCreditModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentBalance = 0,
  leagueId,
  leagueName,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetUser) return null;

  const playerName = targetUser.apelido
    ? `${targetUser.nome} (${targetUser.apelido})`
    : targetUser.nome || 'Jogador';

  const numAmount = parseFloat(amount.replace(',', '.')) || 0;
  const newBalance = currentBalance + numAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leagueId || isSubmitting) return;

    if (numAmount <= 0) {
      toast.error('Informe um valor de crédito válido e maior que zero.');
      return;
    }

    setIsSubmitting(true);
    const res = await adminAddWalletCredit({
      leagueId,
      userId: targetUser.id,
      adminId: user.id,
      amount: numAmount,
      reason: reason.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        `Crédito de +${formatCurrency(numAmount)} adicionado com sucesso! Novo saldo de ${playerName}: ${formatCurrency(res.newBalance || newBalance)}`
      );
      if (onSuccess) onSuccess();
      onClose();
      setAmount('');
      setReason('');
    } else {
      toast.error(res.error || 'Erro ao adicionar crédito.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  Adicionar Crédito à Carteira
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {leagueName || 'Liga Selecionada'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Informações do Jogador e Saldo Atual */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                  {targetUser.avatar_url ? (
                    <img src={targetUser.avatar_url} alt={playerName} className="w-full h-full object-cover" />
                  ) : (
                    targetUser.nome?.charAt(0).toUpperCase() || 'J'
                  )}
                </div>
                <div className="truncate">
                  <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                    {playerName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Membro da liga
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Saldo Atual
                </span>
                <strong className="text-sm font-black text-slate-900 dark:text-white">
                  {formatCurrency(currentBalance)}
                </strong>
              </div>
            </div>

            {/* Input de Valor a Adicionar */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Valor a Adicionar (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0,0-9.]/g, ''))}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Botões Rápidos de Valor */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 30, 50].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Observação / Motivo */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Observação / Motivo (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Crédito antecipado, premiação, acerto de PIX..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Preview do Saldo: Cálculo em Tempo Real */}
            {numAmount > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Saldo anterior:</span>
                  <span className="font-bold">{formatCurrency(currentBalance)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Crédito adicionado:</span>
                  <span>+ {formatCurrency(numAmount)}</span>
                </div>
                <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Novo Saldo:
                  </span>
                  <strong className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(newBalance)}
                  </strong>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs transition-all"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || numAmount <= 0}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Adicionando...' : 'Adicionar Crédito'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
