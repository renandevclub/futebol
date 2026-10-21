'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import Link from 'next/link';
import {
  X,
  DollarSign,
  CheckCircle2,
  Clock,
  Receipt,
  Users,
  FileText,
  Plus,
  Trash2,
  TrendingDown,
  MessageSquare,
  QrCode,
  Building2,
  Edit2,
  Save,
  Check,
} from 'lucide-react';
import { Match, MatchParticipant, MatchExpense } from '@/types/database';
import { FinancialTransaction } from '@/types/finance';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { createNotification } from '@/lib/notifications';
import { formatCurrency, confirmPayment } from '@/lib/financeHelper';
import { toast } from 'sonner';
import { WhatsAppNotifierModal } from './WhatsAppNotifierModal';
import { PixPaymentModal } from './PixPaymentModal';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';
import { subscribeToTables } from '@/lib/realtime';

interface MatchFinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participants: MatchParticipant[];
  onUpdate: () => void;
}

export const MatchFinanceModal: React.FC<MatchFinanceModalProps> = ({
  isOpen,
  onClose,
  match,
  participants,
  onUpdate,
}) => {
  const { isSuperAdmin } = useAuth();
  const { canManageMatch } = useLeague();
  const isAdmin = isSuperAdmin || canManageMatch(match);
  const [expenses, setExpenses] = useState<MatchExpense[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [confirmModalTx, setConfirmModalTx] = useState<FinancialTransaction | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Estado do Aluguel da Arena
  const [aluguelArena, setAluguelArena] = useState<number>(Number(match.custo_aluguel || 0));
  const [isEditingAluguel, setIsEditingAluguel] = useState(false);
  const [tempAluguel, setTempAluguel] = useState(match.custo_aluguel !== undefined && match.custo_aluguel !== null ? String(match.custo_aluguel) : '0');
  const [isSavingAluguel, setIsSavingAluguel] = useState(false);

  // Form para nova despesa
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const fetchFinanceData = async () => {
    try {
      const [{ data: expData }, { data: txData }, { data: matchData }] = await Promise.all([
        supabase
          .from('match_expenses')
          .select('*')
          .eq('match_id', match.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('financial_transactions')
          .select('*, user:user_id(*)')
          .eq('match_id', match.id),
        supabase
          .from('matches')
          .select('custo_aluguel')
          .eq('id', match.id)
          .maybeSingle(),
      ]);

      if (expData) setExpenses(expData);
      if (txData) setTransactions(txData as FinancialTransaction[]);
      if (matchData && matchData.custo_aluguel !== undefined && matchData.custo_aluguel !== null) {
        setAluguelArena(Number(matchData.custo_aluguel));
        setTempAluguel(String(matchData.custo_aluguel));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAluguelArena(Number(match.custo_aluguel || 0));
      setTempAluguel(match.custo_aluguel !== undefined && match.custo_aluguel !== null ? String(match.custo_aluguel) : '0');
      setIsEditingAluguel(false);
      void fetchFinanceData();

      return subscribeToTables(
        `match_finance_${match.id}`,
        [{ table: 'match_expenses' }, { table: 'financial_transactions' }, { table: 'matches' }],
        () => fetchFinanceData(),
      );
    }

    return undefined;
  }, [isOpen, match.id, match.custo_aluguel]);

  if (!isOpen) return null;

  // Mapa de transações por usuário
  const userTxMap: Record<string, FinancialTransaction> = {};
  transactions.forEach((t) => {
    userTxMap[t.user_id] = t;
  });

  // Cálculos Financeiros
  const pricePerParticipant = Number(match.valor || 0);
  const totalConfirmed = participants.length;
  const expectedTotal = totalConfirmed * pricePerParticipant;

  const paidParticipants = participants.filter((p) => {
    const tx = p.user_id ? userTxMap[p.user_id] : undefined;
    return p.paid || tx?.status === 'confirmed';
  });

  const pendingParticipants = participants.filter((p) => {
    const tx = p.user_id ? userTxMap[p.user_id] : undefined;
    return !p.paid && tx?.status !== 'confirmed';
  });

  // 1. 💰 Total Arrecadado dos Jogadores
  let totalCollectedReal = 0;
  paidParticipants.forEach((p) => {
    const tx = p.user_id ? userTxMap[p.user_id] : undefined;
    if (tx?.valor_confirmado) {
      totalCollectedReal += Number(tx.valor_confirmado);
    } else {
      totalCollectedReal += pricePerParticipant;
    }
  });

  let totalPending = 0;
  pendingParticipants.forEach((p) => {
    const tx = p.user_id ? userTxMap[p.user_id] : undefined;
    if (tx?.valor_informado) {
      totalPending += Number(tx.valor_informado);
    } else {
      totalPending += pricePerParticipant;
    }
  });

  // 2. 🏟️ Valor do Aluguel da Arena / Society
  const custoAluguelArena = Number(aluguelArena || 0);

  // 3. 💸 Outras Despesas Avulsas
  const otherExpensesTotal = expenses.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);

  // Total Geral de Despesas (Aluguel da Arena + Outras Despesas)
  const totalExpenses = custoAluguelArena + otherExpensesTotal;

  // 4. 📊 Saldo Final da Partida
  const netBalance = totalCollectedReal - totalExpenses;

  // Salvar alteração rápida do valor de aluguel
  const handleSaveAluguel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;

    const numVal = parseFloat(tempAluguel.replace(',', '.'));
    const safeVal = isNaN(numVal) ? 0 : Math.max(0, numVal);

    setIsSavingAluguel(true);
    const { error } = await supabase
      .from('matches')
      .update({ custo_aluguel: safeVal })
      .eq('id', match.id);
    setIsSavingAluguel(false);

    if (error) {
      toast.error('Erro ao atualizar aluguel da arena.');
    } else {
      setAluguelArena(safeVal);
      setIsEditingAluguel(false);
      toast.success('Valor do aluguel da arena atualizado com sucesso! 🏟️');
      onUpdate();
    }
  };

  // Alternar pagamento do participante
  const handleTogglePayment = async (participant: MatchParticipant) => {
    if (!isAdmin) return;

    const tx = participant.user_id ? userTxMap[participant.user_id] : undefined;
    if (tx && tx.status === 'pending') {
      // Se há transação pendente, abrir o modal de conferência
      setConfirmModalTx(tx);
      setIsConfirmModalOpen(true);
      return;
    }

    const newPaidStatus = !participant.paid;
    const paidAt = newPaidStatus ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('match_participants')
      .update({
        paid: newPaidStatus,
        paid_at: paidAt,
        payment_status: newPaidStatus ? 'approved' : 'pending',
      })
      .eq('id', participant.id);

    if (error) {
      toast.error('Erro ao atualizar status de pagamento.');
    } else {
      const pName = participant.user?.apelido || participant.user?.nome || participant.guest_name || 'Jogador';
      if (newPaidStatus) {
        toast.success(`Pagamento de ${pName} confirmado! 💵`);
        if (participant.user_id) {
          void createNotification({
            userId: participant.user_id,
            type: 'payment_confirmed',
            title: 'Pagamento Confirmado! 💵',
            message: `Seu pagamento para a partida "${match.titulo}" foi confirmado com sucesso. Bom jogo!`,
            link: `/matches/${match.id}`,
            metadata: { match_id: match.id, amount: pricePerParticipant },
          });
        }
      } else {
        toast.info(`Pagamento de ${pName} marcado como pendente.`);
      }
      void fetchFinanceData();
      onUpdate();
    }
  };

  // Adicionar despesa
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !novaDescricao.trim() || !novoValor.trim()) return;

    const valorNum = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Informe um valor de despesa válido.');
      return;
    }

    setIsSubmittingExpense(true);
    const { error } = await supabase.from('match_expenses').insert({
      match_id: match.id,
      descricao: novaDescricao.trim(),
      valor: valorNum,
    });
    setIsSubmittingExpense(false);

    if (error) {
      toast.error('Erro ao adicionar despesa.');
    } else {
      toast.success('Despesa lançada!');
      setNovaDescricao('');
      setNovoValor('');
      void fetchFinanceData();
    }
  };

  // Remover despesa
  const handleDeleteExpense = async (expenseId: string) => {
    if (!isAdmin) return;

    const { error } = await supabase
      .from('match_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      toast.error('Erro ao remover despesa.');
    } else {
      toast.success('Despesa removida!');
      void fetchFinanceData();
    }
  };

  // GERAR E EXPORTAR RELATÓRIO PDF DA PARTIDA
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão. Permita pop-ups no seu navegador.');
      return;
    }

    const dateParts = match.data.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const generatedAt = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Resumo Financeiro - ${match.titulo}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; font-size: 13px; }
          .header { border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .brand { font-size: 22px; font-weight: 900; color: #0f172a; }
          .brand span { color: #f97316; }
          .subtitle { font-size: 12px; font-weight: 700; color: #64748b; margin-top: 2px; }
          .meta { font-size: 11px; color: #64748b; text-align: right; line-height: 1.4; }
          
          .summary-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
          .card-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; }
          .card-value { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 4px; }
          .card-desc { font-size: 10px; color: #166534; font-weight: 700; margin-top: 2px; }
          
          .table-title { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 16px; margin-bottom: 8px; border-left: 4px solid #f97316; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 8px 10px; font-weight: 800; font-size: 11px; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #fafafa; }
          
          .status { font-weight: 800; font-size: 10px; padding: 3px 8px; border-radius: 12px; display: inline-block; }
          .status-paid { background: #dcfce7; color: #15803d; }
          .status-pending { background: #fef3c7; color: #b45309; }
          
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">F&V<span>Sports</span></div>
            <div class="subtitle">Resumo Financeiro • ${match.titulo}</div>
          </div>
          <div class="meta">
            <div>Data: <strong>${formattedDate} às ${match.horario.substring(0, 5)}</strong></div>
            <div>Local: <strong>${match.local}</strong></div>
            <div>Emitido em: ${generatedAt}</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="card">
            <div class="card-title">1. Total Arrecadado</div>
            <div class="card-value" style="color: #059669;">R$ ${totalCollectedReal.toFixed(2)}</div>
            <div class="card-desc">${paidParticipants.length} de ${totalConfirmed} pagaram</div>
          </div>
          <div class="card">
            <div class="card-title">2. Aluguel Arena/Society</div>
            <div class="card-value" style="color: #d97706;">R$ ${custoAluguelArena.toFixed(2)}</div>
            <div class="card-desc" style="color: #64748b;">${match.local || 'Locação de Quadra'}</div>
          </div>
          <div class="card">
            <div class="card-title">3. Outras Despesas</div>
            <div class="card-value" style="color: #dc2626;">R$ ${otherExpensesTotal.toFixed(2)}</div>
            <div class="card-desc" style="color: #64748b;">${expenses.length} item(ns) avulso(s)</div>
          </div>
          <div class="card">
            <div class="card-title">4. Saldo Final</div>
            <div class="card-value" style="color: ${netBalance >= 0 ? '#059669' : '#dc2626'};">R$ ${netBalance.toFixed(2)}</div>
            <div class="card-desc" style="color: #64748b;">Gastos: R$ ${totalExpenses.toFixed(2)}</div>
          </div>
        </div>

        <div class="table-title">1. Lista de Pagamento dos Participantes</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Nome do Participante</th>
              <th>Valor Devido</th>
              <th style="text-align: right;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${participants.map((p, index) => {
              const name = p.user?.apelido ? `${p.user.nome} (${p.user.apelido})` : p.user?.nome || p.guest_name || 'Jogador';
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${name}</strong></td>
                  <td>R$ ${pricePerParticipant.toFixed(2)}</td>
                  <td style="text-align: right;">
                    ${p.paid 
                      ? `<span class="status status-paid">PAGO ✅</span>` 
                      : `<span class="status status-pending">PENDENTE ⏳</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="table-title">2. Demonstrativo de Custos & Despesas</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Descrição do Custo</th>
              <th>Categoria</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td><strong>Aluguel da Arena / Society (${match.local || 'Quadra'})</strong></td>
              <td><span style="font-size: 10px; font-weight: 700; color: #d97706;">🏟️ Custo de Locação</span></td>
              <td style="text-align: right; font-weight: 800; color: #dc2626;">- R$ ${custoAluguelArena.toFixed(2)}</td>
            </tr>
            ${expenses.map((exp, idx) => `
              <tr>
                <td>${idx + 2}</td>
                <td>${exp.descricao}</td>
                <td><span style="font-size: 10px; font-weight: 700; color: #64748b;">💸 Despesa Avulsa</span></td>
                <td style="text-align: right; font-weight: 800; color: #dc2626;">- R$ ${Number(exp.valor).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          F&V Sports • Documento Oficial de Fechamento Financeiro • ${match.titulo}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const filteredParticipants = participants.filter((p) => {
    if (filter === 'paid') return p.paid;
    if (filter === 'pending') return !p.paid;
    return true;
  });

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl w-full max-w-lg max-h-[90dvh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl pb-safe"
      >
        {/* Alça visual de arraste no mobile */}
        <div className="pt-3 pb-1 sm:hidden flex justify-center cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Conteúdo com rolagem isolada */}
        <div className="overflow-y-auto overscroll-contain flex-1 touch-pan-y p-4 sm:p-6 space-y-4 sm:space-y-5 relative">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                Resumo Financeiro
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px] sm:max-w-xs">
                {match.titulo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPixModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
              title="Gerar QR Code e Código PIX Copia e Cola"
            >
              <QrCode className="w-4 h-4" />
              <span>PIX</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
                title="Disparar Mensagens WhatsApp para Participantes"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
              title="Gerar PDF do Resumo Financeiro"
            >
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* SUBHEADER COM METADADOS DE PREÇO */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="font-bold">Valor / Participante:</span>
            <span className="font-black text-slate-900 dark:text-white">
              {pricePerParticipant > 0 ? `R$ ${pricePerParticipant.toFixed(2)}` : 'Grátis'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="font-bold">Total Previsto:</span>
            <span className="font-black text-brand-600 dark:text-brand-400">
              R$ {expectedTotal.toFixed(2)} ({totalConfirmed} atletas)
            </span>
          </div>
        </div>

        {/* CARDS DE RESUMO DIRETO - 4 PILARES FINANCEIROS */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* 1. 💰 Total Arrecadado */}
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 p-3 sm:p-3.5 rounded-2xl border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                💰 Total Arrecadado
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                Entradas
              </span>
            </div>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight">
              R$ {totalCollectedReal.toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-bold block truncate">
              {paidParticipants.length} de {totalConfirmed} pagaram
            </span>
          </div>

          {/* 2. 🏟️ Aluguel da Arena */}
          <div className="bg-amber-500/10 dark:bg-amber-950/40 p-3 sm:p-3.5 rounded-2xl border border-amber-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                🏟️ Aluguel da Arena
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                Custo Fixo
              </span>
            </div>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 block tracking-tight">
              R$ {custoAluguelArena.toFixed(2)}
            </span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-bold block truncate" title={match.local}>
              {match.local || 'Locação de Quadra'}
            </span>
          </div>

          {/* 3. 💸 Outras Despesas */}
          <div className="bg-slate-100 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                💸 Outras Despesas
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {expenses.length} item(ns)
              </span>
            </div>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100 block tracking-tight">
              R$ {otherExpensesTotal.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block truncate">
              {expenses.length > 0 ? `${expenses.length} gasto(s) avulso(s)` : 'Sem gastos extras'}
            </span>
          </div>

          {/* 4. 📊 Saldo Final */}
          <div className={`p-3 sm:p-3.5 rounded-2xl border space-y-1 ${
            netBalance >= 0
              ? 'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-gradient-to-br from-red-500/15 to-rose-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider">
                📊 Saldo Final
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'
              }`}>
                {netBalance >= 0 ? 'POSITIVO' : 'NEGATIVO'}
              </span>
            </div>
            <span className="text-xl font-black block tracking-tight">
              R$ {netBalance.toFixed(2)}
            </span>
            <span className="text-[10px] font-semibold block opacity-85 truncate">
              Despesas Totais: R$ {totalExpenses.toFixed(2)}
            </span>
          </div>
        </div>

        {/* LISTA DE QUEM PAGOU E QUEM NÃO PAGOU */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-500" />
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                Lista de Pagamentos
              </h3>
            </div>

            {/* Filtros Simples */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex-1 sm:flex-initial px-2 py-1 rounded-lg transition-all text-center ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Todos ({totalConfirmed})
              </button>
              <button
                type="button"
                onClick={() => setFilter('paid')}
                className={`flex-1 sm:flex-initial px-2 py-1 rounded-lg transition-all text-center ${
                  filter === 'paid'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Pagos ({paidParticipants.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`flex-1 sm:flex-initial px-2 py-1 rounded-lg transition-all text-center ${
                  filter === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Pendentes ({pendingParticipants.length})
              </button>
            </div>
          </div>

          {/* Lista de Participantes */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
            {filteredParticipants.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400 font-medium">
                Nenhum participante encontrado neste filtro.
              </div>
            ) : (
              filteredParticipants.map((p, index) => {
                const name = p.user?.apelido
                  ? `${p.user.nome} (${p.user.apelido})`
                  : p.user?.nome || p.guest_name || 'Jogador';
                const participantKey = p.id?.trim() || p.user_id || p.guest_name?.trim() || 'participant';

                return (
                  <div
                    key={`${participantKey}-${index}`}
                    className="p-2.5 flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {index + 1}
                      </span>
                      {p.user_id ? (
                        <Link
                          href={`/profile/${p.user_id}`}
                          onClick={onClose}
                          className="group/player flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-all cursor-pointer"
                          title={`Ver perfil de ${name}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 group-hover/player:ring-2 group-hover/player:ring-emerald-500 group-hover/player:scale-105 transition-all">
                            {p.user?.avatar_url ? (
                              <img src={p.user.avatar_url} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              (p.user?.nome || p.guest_name)?.charAt(0).toUpperCase() || 'J'
                            )}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block truncate group-hover/player:text-emerald-500 dark:group-hover/player:text-emerald-400 group-hover/player:underline decoration-emerald-500/50 underline-offset-2 transition-colors">
                              {name}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              R$ {pricePerParticipant.toFixed(2)}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-400 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                            {(p.user?.nome || p.guest_name)?.charAt(0).toUpperCase() || 'J'}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                                {name}
                              </span>
                              <span className="px-1.5 py-px rounded-md text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Avulso
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              R$ {pricePerParticipant.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status de Pagamento & Ação Admin */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const tx = p.user_id ? userTxMap[p.user_id] : undefined;
                        const isWalletPaid = p.payment_method === 'wallet' || tx?.type === 'wallet_usage';
                        const isConfirmed = p.paid || tx?.status === 'confirmed';
                        const isPendingApproval = tx?.status === 'pending' || p.payment_status === 'waiting_approval';

                        if (isWalletPaid) {
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-extrabold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Pago (Saldo)</span>
                            </span>
                          );
                        }

                        if (isConfirmed) {
                          const confVal = tx?.valor_confirmado || pricePerParticipant;
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-extrabold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Pago {confVal !== pricePerParticipant ? `(${formatCurrency(confVal)})` : ''}</span>
                            </span>
                          );
                        }

                        if (isPendingApproval) {
                          const infVal = tx?.valor_informado || pricePerParticipant;
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-extrabold text-[10px] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Aguardando {formatCurrency(infVal)}</span>
                            </span>
                          );
                        }

                        return (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-extrabold text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Pendente</span>
                          </span>
                        );
                      })()}

                      {/* Botão de Alteração pelo Admin */}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {p.user_id && userTxMap[p.user_id] && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModalTx(userTxMap[p.user_id!]);
                                setIsConfirmModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-xl text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                              title="Conferir / Ajustar Pagamento"
                            >
                              Conferir
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTogglePayment(p)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all shadow-sm ${
                              p.paid
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-500 hover:text-white'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            }`}
                            title={p.paid ? 'Marcar como Pendente' : 'Confirmar Pagamento'}
                          >
                            {p.paid ? 'Desfazer' : 'Marcar Pago'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SEÇÃO DE GASTOS / DESPESAS (SEPARADO EM ALUGUEL E DESPESAS AVULSAS) */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                Gastos & Despesas da Partida
              </h3>
            </div>
            <span className="text-[11px] font-black text-red-600 dark:text-red-400">
              Total: - R$ {totalExpenses.toFixed(2)}
            </span>
          </div>

          {/* 1. CARD EXCLUSIVO: ALUGUEL DA ARENA / SOCIETY */}
          <div className="p-3 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm shrink-0">
                  🏟️
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      Aluguel da Arena / Society
                    </span>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 uppercase">
                      Custo Fixo
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    {match.local || 'Local não informado'}
                  </span>
                </div>
              </div>

              {!isEditingAluguel && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-red-600 dark:text-red-400">
                    - R$ {custoAluguelArena.toFixed(2)}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setTempAluguel(String(custoAluguelArena));
                        setIsEditingAluguel(true);
                      }}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-lg transition-all"
                      title="Alterar Valor do Aluguel"
                    >
                      Ajustar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Formulário Inline de Ajuste do Aluguel */}
            {isEditingAluguel && (
              <form onSubmit={handleSaveAluguel} className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={tempAluguel}
                    onChange={(e) => setTempAluguel(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-500/50 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingAluguel}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingAluguel(false)}
                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-300 transition-all"
                >
                  Cancelar
                </button>
              </form>
            )}
          </div>

          {/* 2. OUTRAS DESPESAS AVULSAS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>💸 Outras Despesas Avulsas</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Subtotal: - R$ {otherExpensesTotal.toFixed(2)}
              </span>
            </div>

            {/* Lançamento pelo Admin */}
            {isAdmin && (
              <form onSubmit={handleAddExpense} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: Bolas, Coletes, Água, Gelo, Juiz..."
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="w-full sm:flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="R$ (ex: 50.00)"
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    className="flex-1 sm:w-28 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingExpense}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lançar</span>
                  </button>
                </div>
              </form>
            )}

            {/* Lista de Gastos Avulsos */}
            {expenses.length > 0 ? (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-36 overflow-y-auto">
                {expenses.map((exp, index) => (
                  <div
                    key={`${exp.id?.trim() || exp.created_at || exp.descricao || 'expense'}-${index}`}
                    className="p-2 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {exp.descricao}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-red-600 dark:text-red-400">
                        - R$ {Number(exp.valor).toFixed(2)}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                          title="Remover Despesa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Nenhuma despesa extra lançada além do aluguel.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
    </div>

      {/* MODAL DE DISPARO DE MENSAGENS WHATSAPP */}
      <WhatsAppNotifierModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        match={match}
        participants={participants}
      />

      {/* MODAL DE PAGAMENTO PIX */}
      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        match={match}
        onUpdate={onUpdate}
      />

      {/* MODAL DE CONFERÊNCIA DE PAGAMENTO */}
      <ConfirmPaymentModal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setConfirmModalTx(null);
        }}
        transaction={confirmModalTx}
        caixinhaName={match.organization?.caixinha_name || 'Caixinha da Resenha'}
        onSuccess={() => {
          void fetchFinanceData();
          onUpdate();
        }}
      />
    </AnimatePresence>
  );
};
