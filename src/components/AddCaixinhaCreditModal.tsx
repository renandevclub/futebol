'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, HeartHandshake, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { adminAddCaixinhaDonation, formatCurrency } from '@/lib/financeHelper';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface AddCaixinhaCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  caixinhaName?: string;
  currentBalance?: number;
  onSuccess?: () => void;
}

export const AddCaixinhaCreditModal: React.FC<AddCaixinhaCreditModalProps> = ({
  isOpen,
  onClose,
  leagueId,
  caixinhaName = 'Caixinha da Liga',
  currentBalance = 0,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [observation, setObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount.replace(',', '.')) || 0;
  const newBalance = currentBalance + numAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leagueId || isSubmitting) return;

    if (numAmount <= 0) {
      toast.error('Informe um valor de doação válido e maior que zero.');
      return;
    }

    if (!donorName.trim()) {
      toast.error('Informe o nome de quem realizou a doação (campo obrigatório).');
      return;
    }

    setIsSubmitting(true);
    const res = await adminAddCaixinhaDonation({
      leagueId,
      adminId: user.id,
      amount: numAmount,
      donorName: donorName.trim(),
      observation: observation.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(
        `Doação de +${formatCurrency(numAmount)} registrada com sucesso na ${caixinhaName}! Doador: ${donorName.trim()}`
      );
      if (onSuccess) onSuccess();
      onClose();
      setAmount('');
      setDonorName('');
      setObservation('');
    } else {
      toast.error(res.error || 'Erro ao registrar doação na caixinha.');
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
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-500/10 dark:bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  Adicionar Crédito à Caixinha
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {caixinhaName}
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
            {/* Saldo Atual da Caixinha */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <HeartHandshake className="w-4 h-4 text-emerald-500" />
                <span className="font-bold">Saldo Atual da Caixinha:</span>
              </div>
              <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(currentBalance)}
              </strong>
            </div>

            {/* Valor da Doação */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Valor da Doação / Crédito (R$) *
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

            {/* Atalhos de Valor */}
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 200].map((val) => (
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

            {/* Quem realizou a doação (OBRIGATÓRIO) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Quem realizou a doação? *
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Obrigatório
                </span>
              </div>
              <input
                type="text"
                placeholder="Ex: João Silva, Patrocinador XYZ, Renan..."
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Pode ser membro da liga ou pessoa externa/patrocinador.
              </p>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Observação / Finalidade (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Contribuição para churrasco, bolas novas..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Preview em Tempo Real */}
            {numAmount > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Saldo anterior da Caixinha:</span>
                  <span className="font-bold">{formatCurrency(currentBalance)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Doação registrada:</span>
                  <span>+ {formatCurrency(numAmount)}</span>
                </div>
                <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Novo Saldo da Caixinha:
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
                disabled={isSubmitting || numAmount <= 0 || !donorName.trim()}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando...' : 'Confirmar Doação'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
