'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Plus,
  RefreshCw,
  QrCode,
  FileText,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Upload,
  Coins,
  History,
  Info,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Eye,
  Send,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import {
  LeaguePlayerWallet,
  FinancialTransaction,
  CreditDestination,
} from '@/types/finance';
import {
  getLeagueWallet,
  getUserLeagueTransactions,
  transferWalletToCaixinha,
  informMatchPayment,
  formatCurrency,
} from '@/lib/financeHelper';
import { generatePixPayload, getPixQrCodeUrl } from '@/lib/pix';
import { subscribeToTables } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface MyWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLeagueId?: string | null;
}

export const MyWalletModal: React.FC<MyWalletModalProps> = ({
  isOpen,
  onClose,
  initialLeagueId,
}) => {
  const { user } = useAuth();
  const { leagues, currentLeague, selectLeague } = useLeague();

  const activeLeagueId = useMemo(() => {
    return initialLeagueId || currentLeague?.id || (leagues.length > 0 ? leagues[0].id : null);
  }, [initialLeagueId, currentLeague, leagues]);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(activeLeagueId);
  const [wallet, setWallet] = useState<LeaguePlayerWallet | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'donate' | 'deposit'>('overview');

  // Doação para Caixinha
  const [donateAmount, setDonateAmount] = useState<string>('');
  const [donateMessage, setDonateMessage] = useState<string>('');
  const [isSubmittingDonate, setIsSubmittingDonate] = useState(false);

  // Depósito / Adicionar Crédito via PIX
  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [depositProofUrl, setDepositProofUrl] = useState<string | null>(null);
  const [depositObs, setDepositObs] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [copiedPixCode, setCopiedPixCode] = useState(false);
  const [copiedPixKey, setCopiedPixKey] = useState(false);
  const [isViewingProofLarge, setIsViewingProofLarge] = useState(false);

  const selectedLeague = useMemo(() => {
    return leagues.find((l) => l.id === selectedLeagueId) || currentLeague || leagues[0] || null;
  }, [leagues, selectedLeagueId, currentLeague]);

  const caixinhaName = selectedLeague?.caixinha_name || 'Caixinha da Resenha';
  const chavePix = selectedLeague?.chave_pix_padrao || '';
  const nomeRecebedor = selectedLeague?.nome_recebedor_pix || selectedLeague?.name || 'F&V Sports';

  // Cálculo e geração dinâmica do PIX
  const parsedDepositAmount = useMemo(() => {
    const val = parseFloat(depositAmount.replace(',', '.'));
    return isNaN(val) ? 0 : Math.max(0, val);
  }, [depositAmount]);

  const pixPayload = useMemo(() => {
    if (!chavePix || parsedDepositAmount <= 0) return '';
    try {
      return generatePixPayload({
        key: chavePix,
        name: nomeRecebedor,
        city: 'BRASIL',
        amount: parsedDepositAmount,
        description: 'Credito no Caixa',
      });
    } catch (err) {
      console.warn('Erro ao gerar payload PIX:', err);
      return '';
    }
  }, [chavePix, nomeRecebedor, parsedDepositAmount]);

  const pixQrCodeUrl = useMemo(() => {
    if (!pixPayload) return '';
    return getPixQrCodeUrl(pixPayload, 280);
  }, [pixPayload]);

  const loadWalletData = useCallback(async () => {
    if (!user?.id || !selectedLeagueId) return;
    setIsLoading(true);
    try {
      const [walletData, txsData] = await Promise.all([
        getLeagueWallet(selectedLeagueId, user.id),
        supabase
          .from('financial_transactions')
          .select('*, match:match_id(*)')
          .eq('league_id', selectedLeagueId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setWallet(walletData);
      setTransactions((txsData.data || []) as FinancialTransaction[]);
    } catch (err) {
      console.error('Erro ao carregar dados do meu caixa:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, selectedLeagueId]);

  useEffect(() => {
    if (isOpen && selectedLeagueId) {
      void loadWalletData();

      // Realtime subscription
      const unsub = subscribeToTables(
        `wallet-modal-${user?.id}-${selectedLeagueId}`,
        [
          { table: 'league_player_wallets' },
          { table: 'financial_transactions' },
          { table: 'league_caixinha_transactions' },
        ],
        () => {
          void loadWalletData();
        }
      );

      return () => {
        unsub();
      };
    }
  }, [isOpen, selectedLeagueId, user?.id, loadWalletData]);

  // Copiar código Copia e Cola
  const handleCopyPixCode = async () => {
    if (!pixPayload) {
      toast.error('Informe um valor para gerar o código PIX.');
      return;
    }
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopiedPixCode(true);
      toast.success('Código PIX Copia e Cola copiado com sucesso! 📋 Cole no seu banco.');
      setTimeout(() => setCopiedPixCode(false), 3000);
    } catch (err) {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  // Copiar apenas a chave PIX
  const handleCopyPixKey = async () => {
    if (!chavePix) return;
    try {
      await navigator.clipboard.writeText(chavePix);
      setCopiedPixKey(true);
      toast.success('Chave PIX copiada! 🔑');
      setTimeout(() => setCopiedPixKey(false), 3000);
    } catch (err) {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  // Executar doação para a caixinha
  const handleTransferToCaixinha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLeagueId) return;

    const numAmount = parseFloat(donateAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Informe um valor válido para doar.');
      return;
    }

    if (!wallet || wallet.saldo_disponivel < numAmount) {
      toast.error(`Saldo insuficiente. Saldo disponível: ${formatCurrency(wallet?.saldo_disponivel || 0)}`);
      return;
    }

    setIsSubmittingDonate(true);
    const res = await transferWalletToCaixinha({
      leagueId: selectedLeagueId,
      userId: user.id,
      amount: numAmount,
      description: donateMessage.trim() || `Contribuição de ${user.apelido || user.nome} para a ${caixinhaName}`,
    });
    setIsSubmittingDonate(false);

    if (res.success) {
      toast.success(`Parabéns! Você doou ${formatCurrency(numAmount)} para a ${caixinhaName}! 🎉`);
      setDonateAmount('');
      setDonateMessage('');
      setActiveTab('overview');
      void loadWalletData();
    } else {
      toast.error(res.error || 'Erro ao realizar transferência.');
    }
  };

  // Upload de comprovante de depósito
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedLeagueId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setIsUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `receipts/deposits/${selectedLeagueId}/${user.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('match-media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error('Erro ao enviar imagem. Tente novamente.');
      } else {
        const { data: urlData } = supabase.storage.from('match-media').getPublicUrl(filePath);
        setDepositProofUrl(urlData.publicUrl);
        toast.success('Comprovante anexado com sucesso! ✅');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro no upload.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Enviar depósito/crédito informado
  const handleInformDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLeagueId) return;

    if (parsedDepositAmount <= 0) {
      toast.error('Informe um valor de crédito válido maior que zero.');
      return;
    }

    setIsSubmittingDeposit(true);
    const res = await informMatchPayment({
      leagueId: selectedLeagueId,
      userId: user.id,
      valorPartida: 0,
      valorInformado: parsedDepositAmount,
      destinoExcedente: 'wallet',
      comprovanteUrl: depositProofUrl,
      observacoes: depositObs.trim() || 'Depósito antecipado para crédito no caixa.',
      userName: user.apelido || user.nome,
      matchTitle: 'Depósito em Carteira',
    });
    setIsSubmittingDeposit(false);

    if (res.success) {
      toast.success('Solicitação de crédito enviada! O Administrador irá conferir o PIX e liberar o saldo em breve. ⏳');
      setDepositAmount('50');
      setDepositProofUrl(null);
      setDepositObs('');
      setActiveTab('overview');
      void loadWalletData();
    } else {
      toast.error(res.error || 'Não foi possível registrar o pagamento.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Header com Seletor de Liga */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  Meu Caixa
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] uppercase border border-emerald-500/20">
                  Individual
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Controle financeiro isolado por liga
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

        {/* Seletor de Liga (Caso tenha mais de uma liga) */}
        {leagues.length > 1 && (
          <div className="px-4 sm:px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-300">
              Liga Ativa:
            </span>
            <select
              value={selectedLeagueId || ''}
              onChange={(e) => {
                setSelectedLeagueId(e.target.value);
                selectLeague(e.target.value);
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {leagues.map((lg) => (
                <option key={lg.id} value={lg.id}>
                  {lg.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navegação de Abas */}
        <div className="flex items-center px-4 sm:px-5 pt-3 gap-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-2 text-xs font-black transition-all border-b-2 shrink-0 ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Visão Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-2 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Extrato ({transactions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`pb-2.5 px-2 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'deposit'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Crédito</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('donate')}
            className={`pb-2.5 px-2 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'donate'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Doar p/ Caixinha</span>
          </button>
        </div>

        {/* Conteúdo Principal Scrollável */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* CARD PRINCIPAL DO SALDO DISPONÍVEL */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 sm:p-6 shadow-xl shadow-emerald-500/20">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-100 block">
                      Saldo Disponível na Liga
                    </span>
                    <span className="text-3xl sm:text-4xl font-black tracking-tight mt-1 block">
                      {formatCurrency(wallet?.saldo_disponivel || 0)}
                    </span>
                    <p className="text-xs text-emerald-100/90 font-medium mt-1">
                      {selectedLeague?.name || 'Liga selecionada'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                    <Coins className="w-6 h-6" />
                  </div>
                </div>

                <div className="relative z-10 mt-5 pt-4 border-t border-white/15 flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('deposit')}
                    className="flex-1 py-2.5 px-3 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>Adicionar Saldo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('donate')}
                    className="flex-1 py-2.5 px-3 bg-emerald-950/40 hover:bg-emerald-950/60 text-white rounded-xl font-extrabold text-xs border border-white/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Doar p/ {caixinhaName}</span>
                  </button>
                </div>
              </div>

              {/* GRID DE MÉTRICAS DETALHADAS */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {/* Pagamentos Pendentes */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Pendentes de Confirmação
                    </span>
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <span className="text-lg font-black text-amber-700 dark:text-amber-400 block">
                    {formatCurrency(wallet?.total_pendente || 0)}
                  </span>
                  <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium block">
                    Aguardando conferência
                  </span>
                </div>

                {/* Total Pago */}
                <div className="bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Total Pago Confirmado
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-400 block">
                    {formatCurrency(wallet?.total_pago || 0)}
                  </span>
                  <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium block">
                    Investido nesta liga
                  </span>
                </div>

                {/* Total Utilizado em Partidas */}
                <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Utilizado em Partidas
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <span className="text-lg font-black text-purple-700 dark:text-purple-400 block">
                    {formatCurrency(wallet?.total_utilizado_partidas || 0)}
                  </span>
                  <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 font-medium block">
                    Taxas de jogos
                  </span>
                </div>

                {/* Total Contribuído para a Caixinha */}
                <div className="bg-orange-500/10 border border-orange-500/20 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400">
                      Doado p/ {caixinhaName}
                    </span>
                    <Gift className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  <span className="text-lg font-black text-orange-700 dark:text-orange-400 block">
                    {formatCurrency(wallet?.total_contribuido_caixinha || 0)}
                  </span>
                  <span className="text-[10px] text-orange-600/80 dark:text-orange-400/80 font-medium block">
                    Contribuições coletivas
                  </span>
                </div>
              </div>

              {/* ÚLTIMAS MOVIMENTAÇÕES COMPACTAS */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Últimas Movimentações
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Ver todas ({transactions.length})
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <div className="p-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-400">
                    Nenhuma movimentação registrada nesta liga.
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {transactions.slice(0, 4).map((tx) => (
                      <div key={tx.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              tx.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-600'
                                : tx.status === 'rejected'
                                ? 'bg-red-500/10 text-red-600'
                                : tx.type === 'wallet_to_caixinha'
                                ? 'bg-orange-500/10 text-orange-600'
                                : tx.type === 'wallet_deposit'
                                ? 'bg-blue-500/10 text-blue-600'
                                : 'bg-emerald-500/10 text-emerald-600'
                            }`}
                          >
                            {tx.status === 'pending' ? (
                              <Clock className="w-4 h-4" />
                            ) : tx.type === 'wallet_to_caixinha' ? (
                              <Gift className="w-4 h-4" />
                            ) : tx.type === 'wallet_deposit' ? (
                              <Plus className="w-4 h-4" />
                            ) : (
                              <Coins className="w-4 h-4" />
                            )}
                          </div>
                          <div className="truncate">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                              {tx.type === 'match_payment'
                                ? `Partida: ${tx.match?.titulo || 'Jogo'}`
                                : tx.type === 'wallet_deposit'
                                ? 'Adição de Crédito'
                                : tx.type === 'wallet_usage'
                                ? `Pago c/ Saldo: ${tx.match?.titulo || 'Jogo'}`
                                : tx.type === 'wallet_to_caixinha'
                                ? `Doação para ${caixinhaName}`
                                : 'Ajuste Administrativo'}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {new Date(tx.created_at).toLocaleDateString('pt-BR')} • {new Date(tx.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-black block ${
                              tx.status === 'pending'
                                ? 'text-amber-600 dark:text-amber-400'
                                : tx.status === 'rejected'
                                ? 'text-red-500 line-through'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatCurrency(tx.valor_confirmado ?? tx.valor_informado)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase inline-block ${
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
                              ? 'Aguardando'
                              : 'Recusado'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXTRATO COMPLETO */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Extrato Completo ({transactions.length})
                </span>
                <button
                  type="button"
                  onClick={() => loadWalletData()}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Atualizar"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-400 space-y-2">
                  <Wallet className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>Nenhuma transação encontrada no seu histórico desta liga.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {transactions.map((tx) => {
                    const isConfirmed = tx.status === 'confirmed';
                    const isPending = tx.status === 'pending';
                    const isRejected = tx.status === 'rejected';

                    return (
                      <div
                        key={tx.id}
                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                              {tx.type === 'match_payment'
                                ? `Pagamento de Partida: ${tx.match?.titulo || 'Partida'}`
                                : tx.type === 'wallet_deposit'
                                ? 'Adição de Crédito no Caixa'
                                : tx.type === 'wallet_usage'
                                ? `Abatimento com Saldo: ${tx.match?.titulo || 'Partida'}`
                                : tx.type === 'wallet_to_caixinha'
                                ? `Doação para ${caixinhaName}`
                                : 'Ajuste Manual do Administrador'}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {new Date(tx.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(tx.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-sm font-black block ${
                                isConfirmed
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isPending
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-500'
                              }`}
                            >
                              {formatCurrency(tx.valor_confirmado ?? tx.valor_informado)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase inline-block border ${
                                isConfirmed
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : isPending
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-600 border-red-500/20'
                              }`}
                            >
                              {isConfirmed ? 'Confirmado ✅' : isPending ? 'Aguardando Aprovação ⏳' : 'Rejeitado ❌'}
                            </span>
                          </div>
                        </div>

                        {/* Detalhamento de valores */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <div>
                            <span>Valor Informado: </span>
                            <strong className="text-slate-800 dark:text-slate-200">
                              {formatCurrency(tx.valor_informado)}
                            </strong>
                          </div>
                          {tx.valor_confirmado !== null && tx.valor_confirmado !== undefined && (
                            <div>
                              <span>Valor Confirmado: </span>
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(tx.valor_confirmado)}
                              </strong>
                            </div>
                          )}
                          {tx.valor_excedente > 0 && tx.type === 'match_payment' && (
                            <div className="col-span-2 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                              Sobra de <strong>{formatCurrency(tx.valor_excedente)}</strong> destinada para:{' '}
                              <strong>{tx.destino_excedente === 'caixinha' ? caixinhaName : 'Seu Caixa'}</strong>
                            </div>
                          )}
                        </div>

                        {tx.motivo_rejeicao && (
                          <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl text-[11px] text-red-600 dark:text-red-400">
                            <strong>Motivo da recusa:</strong> {tx.motivo_rejeicao}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADICIONAR CRÉDITO VIA PIX (EXPERIÊNCIA COMPLETA E INTUITIVA) */}
          {activeTab === 'deposit' && (
            <form onSubmit={handleInformDeposit} className="space-y-4">
              {/* Banner de Introdução */}
              <div className="bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-emerald-500/10 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Adicionar Crédito no Caixa
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase">
                    PIX Instantâneo
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  Adicione saldo para pagar partidas futuras com 1 clique. O valor pago será conferido e liberado pelo Administrador da liga.
                </p>
              </div>

              {/* 1. Escolha ou Digitação do Valor */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>1. Quanto deseja adicionar?</span>
                  <span className="text-[10px] text-slate-400 font-normal">Selecione ou digite abaixo</span>
                </label>

                {/* Sugestões de Valores Rápidos */}
                <div className="grid grid-cols-4 gap-2">
                  {[15, 25, 50, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDepositAmount(val.toString())}
                      className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        parsedDepositAmount === val
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      R$ {val}
                    </button>
                  ))}
                </div>

                {/* Input de Valor Manual */}
                <div className="relative pt-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Outro valor (ex: 75,00)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 2. Área de Pagamento PIX (QR Code e Copia e Cola) */}
              <div className="space-y-3 pt-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  2. Efetue o Pagamento via PIX
                </label>

                {chavePix ? (
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-4">
                    {/* QR Code Centralizado */}
                    {pixQrCodeUrl ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-200 inline-block">
                          <img
                            src={pixQrCodeUrl}
                            alt="QR Code PIX"
                            className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-xl"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          Escaneie com a câmera do seu aplicativo de banco
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Digite um valor acima para gerar o QR Code.
                      </div>
                    )}

                    {/* Botão Copiar Código PIX (Copia e Cola) */}
                    <button
                      type="button"
                      onClick={handleCopyPixCode}
                      disabled={!pixPayload}
                      className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                        copiedPixCode
                          ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      }`}
                    >
                      {copiedPixCode ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Código PIX Copiado com Sucesso! ✅</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Código PIX (Copia e Cola)</span>
                        </>
                      )}
                    </button>

                    {/* Detalhes do Recebedor & Chave Individual */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Recebedor:</span>
                        <strong className="text-slate-900 dark:text-white font-extrabold truncate max-w-[200px]">
                          {nomeRecebedor}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Chave PIX:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-900 dark:text-white font-mono font-extrabold text-[11px] truncate max-w-[170px]">
                            {chavePix}
                          </strong>
                          <button
                            type="button"
                            onClick={handleCopyPixKey}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Copiar Chave"
                          >
                            {copiedPixKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Valor a Transferir:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                          {formatCurrency(parsedDepositAmount)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>Chave PIX da Liga Não Configurada</span>
                    </div>
                    <p className="text-amber-800/80 dark:text-amber-300/80">
                      O organizador desta liga ainda não cadastrou a chave PIX padrão. Entre em contato diretamente com o administrador para solicitar a chave e anexe o comprovante abaixo.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Anexo do Comprovante */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>3. Envie o Comprovante (Foto ou Print)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional, mas agiliza a aprovação</span>
                </label>

                {depositProofUrl ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/5 shrink-0 border border-emerald-500/30">
                        <img
                          src={depositProofUrl}
                          alt="Comprovante"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block truncate">
                          Comprovante Anexado ✅
                        </span>
                        <a
                          href={depositProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver em tamanho real</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer transition-all">
                        Trocar
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofUpload}
                          disabled={isUploadingProof}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setDepositProofUrl(null)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer transition-all text-center group">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isUploadingProof ? 'Enviando imagem...' : 'Clique para selecionar foto ou print do banco'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      PNG, JPG ou JPEG até 10MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofUpload}
                      disabled={isUploadingProof}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 4. Observação Opcional */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                  Observações para o Administrador (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pagamento referente aos próximos jogos..."
                  value={depositObs}
                  onChange={(e) => setDepositObs(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 5. Botão de Envio */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingDeposit || isUploadingProof || parsedDepositAmount <= 0}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingDeposit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando confirmação...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Informar Pagamento ao Administrador</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: DOAR PARA CAIXINHA */}
          {activeTab === 'donate' && (
            <form onSubmit={handleTransferToCaixinha} className="space-y-4">
              <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-orange-500/10 border border-orange-500/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Contribuir para a {caixinhaName}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Transfira instantaneamente do seu saldo disponível para a caixinha coletiva da liga (churrasco, resenha, bebidas ou melhorias).
                </p>
                <div className="pt-2 flex items-center justify-between text-xs border-t border-orange-500/20">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Seu Saldo Disponível:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                    {formatCurrency(wallet?.saldo_disponivel || 0)}
                  </strong>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                    Valor da Doação (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                      R$
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 10,00"
                      value={donateAmount}
                      onChange={(e) => setDonateAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Sugestões de valor rápido */}
                <div className="flex items-center gap-2">
                  {[5, 10, 20, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDonateAmount(val.toString())}
                      className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-extrabold text-xs text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      R$ {val}
                    </button>
                  ))}
                  {wallet && wallet.saldo_disponivel > 0 && (
                    <button
                      type="button"
                      onClick={() => setDonateAmount(wallet.saldo_disponivel.toString())}
                      className="flex-1 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-black text-xs transition-colors"
                    >
                      Tudo
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                    Mensagem ou Recado (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Contribuição para a cerveja da resenha! 🍻"
                    value={donateMessage}
                    onChange={(e) => setDonateMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingDonate || (wallet?.saldo_disponivel || 0) <= 0}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  <span>{isSubmittingDonate ? 'Transferindo...' : 'Confirmar Transferência'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
