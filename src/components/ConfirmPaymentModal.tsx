'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  User,
  Calendar,
  DollarSign,
  ShieldCheck,
  Eye,
  Gift,
  Wallet,
} from 'lucide-react';
import { FinancialTransaction, CreditDestination } from '@/types/finance';
import { confirmPayment, rejectPayment, formatCurrency } from '@/lib/financeHelper';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ConfirmPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FinancialTransaction | null;
  caixinhaName?: string;
  onSuccess?: () => void;
}

export const ConfirmPaymentModal: React.FC<ConfirmPaymentModalProps> = ({
  isOpen,
  onClose,
  transaction,
  caixinhaName = 'Caixinha da Resenha',
  onSuccess,
}) => {
  const { user } = useAuth();
  const [confirmedAmount, setConfirmedAmount] = useState<string>('');
  const [destination, setDestination] = useState<CreditDestination>('wallet');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewingProof, setIsViewingProof] = useState(false);

  // Inicializar formulário quando a transação mudar
  React.useEffect(() => {
    if (transaction) {
      setConfirmedAmount(transaction.valor_informado?.toString() || '0');
      setDestination(transaction.destino_excedente || 'wallet');
      setObservacoes(transaction.observacoes || '');
      setIsRejecting(false);
      setRejectReason('');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const valorPartida = Number(transaction.valor_partida || 0);
  const parsedConfirmed = parseFloat(confirmedAmount.replace(',', '.')) || 0;
  const valorExcedente = Math.max(0, parsedConfirmed - valorPartida);
  const playerName = transaction.user?.apelido
    ? `${transaction.user.nome} (${transaction.user.apelido})`
    : transaction.user?.nome || transaction.participant?.guest_name || 'Jogador';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (parsedConfirmed <= 0) {
      toast.error('Informe um valor de pagamento confirmado válido.');
      return;
    }

    setIsSubmitting(true);
    const res = await confirmPayment({
      transactionId: transaction.id,
      confirmedAmount: parsedConfirmed,
      adminId: user.id,
      creditDestination: destination,
      observacoes: observacoes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.success(`Pagamento de ${formatCurrency(parsedConfirmed)} confirmado com sucesso! 💵`);
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast.error(res.error || 'Erro ao confirmar pagamento.');
    }
  };

  const handleReject = async () => {
    if (!user) return;
    if (!rejectReason.trim()) {
      toast.error('Informe o motivo da recusa do pagamento.');
      return;
    }

    setIsSubmitting(true);
    const res = await rejectPayment({
      transactionId: transaction.id,
      adminId: user.id,
      motivo: rejectReason.trim(),
    });
    setIsSubmitting(false);

    if (res.success) {
      toast.info('Pagamento recusado.');
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast.error(res.error || 'Erro ao rejeitar.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Conferência de Pagamento
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Validação oficial administrativa
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

        {/* Corpo Scrollável */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Card com Detalhes do Jogador & Partida */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-brand-500" />
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {playerName}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {new Date(transaction.created_at).toLocaleDateString('pt-BR')} às{' '}
                {new Date(transaction.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {transaction.match ? (
              <div className="text-slate-600 dark:text-slate-300 font-medium flex items-center justify-between">
                <span>Partida: <strong>{transaction.match.titulo}</strong></span>
                <span>Taxa Oficial: <strong>{formatCurrency(valorPartida)}</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-extrabold text-[11px]">
                <Wallet className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Solicitação de Adição de Saldo no Caixa Individual do Jogador</span>
              </div>
            )}

            {transaction.observacoes && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
                <span className="font-bold">Observação do Jogador:</span> {transaction.observacoes}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <span className="font-bold text-slate-500">Valor Informado pelo Jogador:</span>
              <strong className="text-sm font-black text-amber-600 dark:text-amber-400">
                {formatCurrency(transaction.valor_informado)}
              </strong>
            </div>
          </div>

          {/* Miniatura do Comprovante (Se houver) */}
          {transaction.comprovante_url && (
            <div className="space-y-1.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                Comprovante Anexado
              </span>
              <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-48 bg-black/5 flex items-center justify-center">
                <img
                  src={transaction.comprovante_url}
                  alt="Comprovante de pagamento"
                  className="w-full h-44 object-contain"
                />
                <a
                  href={transaction.comprovante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-extrabold text-xs backdrop-blur-xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>Ver em Tamanho Real</span>
                </a>
              </div>
            </div>
          )}

          {!isRejecting ? (
            <form onSubmit={handleConfirm} className="space-y-4 pt-1">
              {/* Campo de Valor Confirmado */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                  Valor Efetivamente Confirmado (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    required
                    value={confirmedAmount}
                    onChange={(e) => setConfirmedAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {parsedConfirmed !== Number(transaction.valor_informado) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                    ⚠️ Atenção: Você está alterando o valor informado de {formatCurrency(transaction.valor_informado)} para {formatCurrency(parsedConfirmed)}.
                  </p>
                )}
                {transaction.type === 'wallet_deposit' && parsedConfirmed > 0 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatCurrency(parsedConfirmed)} será creditado 100% no saldo disponível de {playerName}.</span>
                  </p>
                )}
              </div>

              {/* Se houver sobra / excedente (somente para partidas) */}
              {transaction.type === 'match_payment' && valorExcedente > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                      Crédito Excedente Calculado:
                    </span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-black text-sm">
                      + {formatCurrency(valorExcedente)}
                    </strong>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                    Destino da Sobra:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDestination('wallet')}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        destination === 'wallet'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Caixa do Jogador</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestination('caixinha')}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        destination === 'caixinha'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>{caixinhaName}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Observação Opcional */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                  Observações Internas (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Confirmado via extrato bancário Nubank..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Confirmando...' : `Confirmar ${formatCurrency(parsedConfirmed)}`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                >
                  Recusar este pagamento
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-extrabold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Recusar Pagamento Informado</span>
                </div>
                <p className="text-xs text-red-700/80 dark:text-red-300/80 font-medium">
                  O jogador será notificado sobre o motivo da recusa e o valor não entrará no caixa.
                </p>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                  Motivo da Recusa *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Comprovante ilegível, valor não caiu na conta, etc."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-red-300 dark:border-red-900/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recusando...' : 'Confirmar Recusa'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
