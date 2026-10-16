'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  PlusCircle,
  MinusCircle,
  DollarSign,
  User,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Profile } from '@/types/database';
import { addManualBalanceAdjust, formatCurrency } from '@/lib/financeHelper';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ManualBalanceAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  leagueId: string;
  leagueName?: string;
  onSuccess?: () => void;
}

export const ManualBalanceAdjustModal: React.FC<ManualBalanceAdjustModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  leagueId,
  leagueName,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetUser) return null;

  const playerName = targetUser.apelido
    ? `${targetUser.nome} (${targetUser.apelido})`
    : targetUser.nome || 'Jogador';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leagueId) return;

    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Informe um valor de ajuste válido.');
      return;
    }

    if (!reason.trim()) {
      toast.error('Informe o motivo do ajuste manual.');
      return;
    }

    setIsSubmitting(true);
    const res = await addManualBalanceAdjust({
      leagueId,
      userId: targetUser.id,
      adminId: user.id,
      type,
      amount: numAmount,
      reason: reason.trim(),
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        `Ajuste de ${type === 'credit' ? '+' : '-'}${formatCurrency(numAmount)} realizado com sucesso no caixa de ${playerName}!`
      );
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast.error(res.error || 'Erro ao realizar ajuste.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                type === 'credit'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}
            >
              {type === 'credit' ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Ajuste Manual de Saldo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {leagueName || 'Liga Selecionada'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Jogador Selecionado */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3 text-xs">
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
              {targetUser.avatar_url ? (
                <img src={targetUser.avatar_url} alt={playerName} className="w-full h-full object-cover" />
              ) : (
                targetUser.nome.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                {playerName}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                Caixa individual da liga
              </span>
            </div>
          </div>
        </div>

        {/* Alternador de Tipo */}
        <div className="px-4 sm:px-6 pt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('credit')}
            className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border ${
              type === 'credit'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Adicionar Crédito (+)</span>
          </button>
          <button
            type="button"
            onClick={() => setType('debit')}
            className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border ${
              type === 'debit'
                ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>Lançar Débito (-)</span>
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              Valor do Ajuste (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                R$
              </span>
              <input
                type="text"
                required
                placeholder="Ex: 20,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              Motivo ou Justificativa do Ajuste *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Pagamento recebido em dinheiro, acerto de taxa..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
              type === 'credit'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Salvando Ajuste...' : `Confirmar Ajuste de ${type === 'credit' ? '+' : '-'}${amount || '0,00'}`}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};
