"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLeague } from "@/context/LeagueContext";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { LoginModal } from "@/components/LoginModal";
import { CreatePostModal } from "@/components/CreatePostModal";
import { CreateMatchModal } from "@/components/CreateMatchModal";
import { AdminPanelModal } from "@/components/AdminPanelModal";
import { ConfirmPaymentModal } from "@/components/ConfirmPaymentModal";
import { CaixinhaExpenseModal } from "@/components/CaixinhaExpenseModal";
import { ManualBalanceAdjustModal } from "@/components/ManualBalanceAdjustModal";
import { AddMemberCreditModal } from "@/components/AddMemberCreditModal";
import { AddCaixinhaCreditModal } from "@/components/AddCaixinhaCreditModal";
import { MemberWalletHistoryModal } from "@/components/MemberWalletHistoryModal";
import {
  FinancialTransaction,
  LeaguePlayerWallet,
  CaixinhaTransaction,
  FinancialAuditLog,
  LeagueFinancialSummary,
} from "@/types/finance";
import { League, Profile } from "@/types/database";
import {
  getLeagueFinancialSummary,
  getLeagueTransactions,
  getLeagueWallets,
  getLeagueMembersWithWallets,
  getCaixinhaTransactions,
  getFinancialAuditLogs,
  updateLeagueCaixinhaName,
  deleteCaixinhaExpense,
  confirmPayment,
  formatCurrency,
} from "@/lib/financeHelper";
import { subscribeToTables } from "@/lib/realtime";
import {
  Wallet,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Gift,
  Plus,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Trash2,
  Edit3,
  Users,
  Coins,
  ArrowLeft,
  Eye,
  AlertTriangle,
  History,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

function AdminFinanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isSuperAdmin, isLoading: isAuthLoading } = useAuth();
  const { leagues, myLeagues, currentLeague, canManageLeague } = useLeague();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Liga selecionada no painel (apenas ligas com permissão)
  const initialLeagueFromUrl = searchParams.get("league");
  const initialTabFromUrl = searchParams.get("tab") as any;

  const accessibleLeagues = useMemo(() => {
    return isSuperAdmin ? leagues : myLeagues;
  }, [isSuperAdmin, leagues, myLeagues]);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(() => {
    if (
      initialLeagueFromUrl &&
      accessibleLeagues.some((l) => l.id === initialLeagueFromUrl)
    ) {
      return initialLeagueFromUrl;
    }
    if (currentLeague && accessibleLeagues.some((l) => l.id === currentLeague.id)) {
      return currentLeague.id;
    }
    return accessibleLeagues[0]?.id || "";
  });

  // Manter selectedLeagueId sincronizado com accessibleLeagues
  useEffect(() => {
    if (accessibleLeagues.length > 0) {
      if (!selectedLeagueId || !accessibleLeagues.some((l) => l.id === selectedLeagueId)) {
        setSelectedLeagueId(accessibleLeagues[0].id);
      }
    }
  }, [accessibleLeagues, selectedLeagueId]);

  const selectedLeague = useMemo(() => {
    return (
      accessibleLeagues.find((l) => l.id === selectedLeagueId) ||
      accessibleLeagues[0] ||
      null
    );
  }, [accessibleLeagues, selectedLeagueId]);

  const [activeTab, setActiveTab] = useState<
    "pending" | "caixinha" | "wallets" | "history" | "audit"
  >(
    initialTabFromUrl &&
      ["pending", "caixinha", "wallets", "history", "audit"].includes(
        initialTabFromUrl,
      )
      ? initialTabFromUrl
      : "pending",
  );

  // Estados de Dados
  const [summary, setSummary] = useState<LeagueFinancialSummary | null>(null);
  const [pendingTxs, setPendingTxs] = useState<FinancialTransaction[]>([]);
  const [allTxs, setAllTxs] = useState<FinancialTransaction[]>([]);
  const [caixinhaTxs, setCaixinhaTxs] = useState<CaixinhaTransaction[]>([]);
  const [wallets, setWallets] = useState<LeaguePlayerWallet[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Filtros e Buscas
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modais de Ação
  const [confirmModalTx, setConfirmModalTx] =
    useState<FinancialTransaction | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState<Profile | null>(
    null,
  );
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Novos modais do sistema financeiro da liga
  const [isAddCreditModalOpen, setIsAddCreditModalOpen] = useState(false);
  const [addCreditTargetUser, setAddCreditTargetUser] = useState<Profile | null>(null);
  const [addCreditCurrentBalance, setAddCreditCurrentBalance] = useState(0);

  const [isAddCaixinhaModalOpen, setIsAddCaixinhaModalOpen] = useState(false);

  const [isMemberHistoryModalOpen, setIsMemberHistoryModalOpen] = useState(false);
  const [historyTargetUser, setHistoryTargetUser] = useState<Profile | null>(null);
  const [historyCurrentBalance, setHistoryCurrentBalance] = useState(0);

  // Edição do Nome da Caixinha
  const [isEditingCaixinhaName, setIsEditingCaixinhaName] = useState(false);
  const [newCaixinhaName, setNewCaixinhaName] = useState("");

  // Carregar todos os dados da liga ativa
  const loadFinanceData = useCallback(async () => {
    if (!selectedLeagueId) return;
    setIsLoadingData(true);
    try {
      const [sum, txs, caixinha, playerWallets, logs] = await Promise.all([
        getLeagueFinancialSummary(selectedLeagueId),
        getLeagueTransactions(selectedLeagueId),
        getCaixinhaTransactions(selectedLeagueId),
        getLeagueMembersWithWallets(selectedLeagueId),
        getFinancialAuditLogs(selectedLeagueId),
      ]);

      setSummary(sum);
      setAllTxs(txs);
      setPendingTxs(txs.filter((t) => t.status === "pending"));
      setCaixinhaTxs(caixinha);
      setWallets(playerWallets);
      setAuditLogs(logs);
      setNewCaixinhaName(sum.caixinha_name);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros da liga:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedLeagueId]);



  useEffect(() => {
    if (selectedLeagueId) {
      void loadFinanceData();

      const unsub = subscribeToTables(
        `admin-finance-${selectedLeagueId}`,
        [
          { table: "financial_transactions" },
          { table: "league_player_wallets" },
          { table: "league_caixinha_transactions" },
          { table: "financial_audit_logs" },
        ],
        () => {
          void loadFinanceData();
        },
      );

      return () => {
        unsub();
      };
    }
  }, [selectedLeagueId, loadFinanceData]);

  // Ação de confirmação rápida do valor informado exato
  const handleQuickConfirm = async (tx: FinancialTransaction) => {
    if (!user || !selectedLeagueId) return;

    if (!canManageLeague(selectedLeagueId)) {
      toast.error("Acesso negado: Você não possui permissão para gerenciar finanças desta liga.");
      return;
    }

    const res = await confirmPayment({
      transactionId: tx.id,
      confirmedAmount: Number(tx.valor_informado),
      adminId: user.id,
      creditDestination: tx.destino_excedente || "wallet",
    });

    if (res.success) {
      toast.success(
        tx.type === "wallet_deposit"
          ? `Crédito de ${formatCurrency(tx.valor_informado)} liberado para o jogador! 💰`
          : `Pagamento de ${formatCurrency(tx.valor_informado)} aprovado! 💵`,
      );
      void loadFinanceData();
    } else {
      toast.error(res.error || "Erro ao confirmar.");
    }
  };

  // Salvar novo nome da caixinha
  const handleSaveCaixinhaName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeagueId || !newCaixinhaName.trim() || !user) return;

    if (!canManageLeague(selectedLeagueId)) {
      toast.error("Acesso negado: Você não possui permissão para editar as configurações desta liga.");
      return;
    }

    const res = await updateLeagueCaixinhaName(
      selectedLeagueId,
      newCaixinhaName.trim(),
      undefined,
      user.id,
    );
    if (res.success) {
      toast.success("Nome da Caixinha atualizado com sucesso! 🎉");
      setIsEditingCaixinhaName(false);
      void loadFinanceData();
    } else {
      toast.error("Erro ao renomear caixinha.");
    }
  };

  // Excluir despesa da caixinha
  const handleDeleteExpense = async (expenseId: string) => {
    if (!user || !selectedLeagueId) return;

    if (!canManageLeague(selectedLeagueId)) {
      toast.error("Acesso negado: Você não possui permissão para remover despesas desta liga.");
      return;
    }

    if (
      confirm(
        "Deseja realmente remover esta despesa? O saldo da caixinha será restaurado.",
      )
    ) {
      const res = await deleteCaixinhaExpense(expenseId, user.id);
      if (res.success) {
        toast.success("Despesa removida!");
        void loadFinanceData();
      } else {
        toast.error("Erro ao remover despesa.");
      }
    }
  };

  // Filtragem de Pagamentos na Fila de Conferência e Histórico
  const filteredTxs = useMemo(() => {
    return allTxs.filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const pName = (tx.user?.apelido || tx.user?.nome || "").toLowerCase();
        const mTitle = (tx.match?.titulo || "").toLowerCase();
        return pName.includes(query) || mTitle.includes(query);
      }
      return true;
    });
  }, [allTxs, statusFilter, searchTerm]);

  // Filtragem de Carteiras de Jogadores
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const pName = (w.user?.apelido || w.user?.nome || "").toLowerCase();
        return pName.includes(query);
      }
      return true;
    });
  }, [wallets, searchTerm]);

  // EXPORTAR RELATÓRIO DA CAIXINHA EM PDF
  const handleExportCaixinhaPDF = () => {
    if (!selectedLeague) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permita pop-ups no seu navegador para exportar o PDF.");
      return;
    }

    const caixinhaName = summary?.caixinha_name || "Caixinha da Resenha";
    const generatedAt =
      new Date().toLocaleDateString("pt-BR") +
      " às " +
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Extrato Oficial • ${caixinhaName} - ${selectedLeague.name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; font-size: 13px; }
          .header { border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .brand { font-size: 22px; font-weight: 900; color: #0f172a; }
          .brand span { color: #10b981; }
          .subtitle { font-size: 13px; font-weight: 700; color: #64748b; margin-top: 2px; }
          .meta { font-size: 11px; color: #64748b; text-align: right; line-height: 1.4; }
          
          .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; }
          .card-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
          .card-value { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px; }
          
          .table-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 20px; margin-bottom: 8px; border-left: 4px solid #10b981; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 8px 10px; font-weight: 800; font-size: 11px; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #fafafa; }
          
          .type-entry { color: #059669; font-weight: 800; }
          .type-expense { color: #dc2626; font-weight: 800; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Fut<span>Resenha</span></div>
            <div class="subtitle">Extrato da ${caixinhaName} • ${selectedLeague.name}</div>
          </div>
          <div class="meta">
            <div>Emitido em: <strong>${generatedAt}</strong></div>
            <div>Responsável: <strong>${user?.nome || "Administrador"}</strong></div>
          </div>
        </div>

        <div class="summary-box">
          <div class="card">
            <div class="card-title">Saldo Atual em Caixa</div>
            <div class="card-value" style="color: #059669;">${formatCurrency(summary?.caixinha_saldo || 0)}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Arrecadado</div>
            <div class="card-value" style="color: #0284c7;">${formatCurrency(summary?.caixinha_total_arrecadado || 0)}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Despesas</div>
            <div class="card-value" style="color: #dc2626;">${formatCurrency(summary?.caixinha_total_despesas || 0)}</div>
          </div>
        </div>

        <div class="table-title">Histórico Detalhado de Entradas & Saídas</div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Data</th>
              <th>Descrição da Movimentação</th>
              <th>Categoria / Responsável</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${caixinhaTxs
              .map((tx) => {
                const dt = new Date(tx.created_at).toLocaleDateString("pt-BR");
                const isEntry = tx.type === "entry";
                return `
                <tr>
                  <td>${dt}</td>
                  <td><strong>${tx.descricao}</strong></td>
                  <td>${tx.categoria || "Geral"} ${tx.user ? `• ${tx.user.nome}` : ""}</td>
                  <td style="text-align: right;" class="${isEntry ? "type-entry" : "type-expense"}">
                    ${isEntry ? "+ " : "- "}${formatCurrency(tx.valor)}
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>

        <div class="footer">
          F&V Sports • Relatório Financeiro Oficial da Caixinha • ${selectedLeague.name}
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Tela de Acesso Não Permitido (403 Amigável)
  if (!isAuthLoading && (!user || (!isSuperAdmin && accessibleLeagues.length === 0))) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          onOpenLogin={() => setIsLoginOpen(true)}
          onOpenCreatePost={() => setIsCreatePostOpen(true)}
          onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
          onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">Acesso Não Permitido</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-2">
            Você não possui permissão de administrador para acessar o painel financeiro de nenhuma liga.
          </p>
          <p className="text-xs text-slate-500 max-w-md mb-6">
            Entre em uma liga que você administra ou solicite autorização ao Super Administrador.
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all"
          >
            Voltar para a Página Inicial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenCreatePost={() => setIsCreatePostOpen(true)}
        onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Breadcrumb & Título */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/administracao/usuarios"
              className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm transition-all"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Controle Financeiro da Liga
                </h1>
                {isSuperAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[10px] uppercase border border-purple-500/20">
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Gestão de caixas individuais, conferência de pagamentos e
                Caixinha da Resenha
              </p>
            </div>
          </div>

          {/* Seletor de Liga */}
          {accessibleLeagues.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 pl-2">
                Liga:
              </span>
              <select
                value={selectedLeagueId}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-extrabold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {accessibleLeagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>
                    {lg.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* CARDS DE RESUMO FINANCEIRO PRINCIPAL */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Caixinha Coletiva */}
          <div className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                {summary?.caixinha_name || "Caixinha da Resenha"}
              </span>
              <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 block">
              {formatCurrency(summary?.caixinha_saldo || 0)}
            </span>
            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700/80 dark:text-emerald-400/80 pt-1">
              <span>
                Arrecadado:{" "}
                {formatCurrency(summary?.caixinha_total_arrecadado || 0)}
              </span>
              <span>
                Gastos: {formatCurrency(summary?.caixinha_total_despesas || 0)}
              </span>
            </div>
          </div>

          {/* Card 2: Pagamentos Pendentes de Conferência */}
          <div
            onClick={() => setActiveTab("pending")}
            className={`border rounded-3xl p-4 sm:p-5 space-y-1 cursor-pointer transition-all ${
              (summary?.total_pagamentos_pendentes_count || 0) > 0
                ? "bg-amber-500/15 border-amber-500/40 shadow-lg shadow-amber-500/10"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Aguardando Conferência
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 block">
                {summary?.total_pagamentos_pendentes_count || 0}
              </span>
              <span className="text-xs font-extrabold text-amber-600">
                (
                {formatCurrency(summary?.total_pagamentos_pendentes_valor || 0)}
                )
              </span>
            </div>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-bold block pt-1">
              {(summary?.total_pagamentos_pendentes_count || 0) > 0
                ? "Clique para conferir comprovantes"
                : "Nenhum pagamento pendente"}
            </span>
          </div>

          {/* Card 3: Saldo Total dos Jogadores (Créditos em Carteira) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Créditos dos Jogadores
              </span>
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white block">
              {formatCurrency(summary?.total_creditos_jogadores || 0)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block pt-1">
              Saldos individuais disponíveis para partidas
            </span>
          </div>

          {/* Card 4: Balanço Geral da Liga */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Balanço Geral da Liga
              </span>
              <Coins className="w-4 h-4 text-purple-500" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white block">
              {formatCurrency(summary?.balanco_geral || 0)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block pt-1">
              Caixinha + Arrecadação de partidas
            </span>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex items-center gap-1 sm:gap-2 overflow-x-auto shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`py-2 px-3 sm:px-4 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "pending"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Fila de Conferência</span>
            {pendingTxs.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-amber-600 font-black text-[10px] flex items-center justify-center">
                {pendingTxs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("caixinha")}
            className={`py-2 px-3 sm:px-4 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "caixinha"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>{summary?.caixinha_name || "Caixinha da Resenha"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wallets")}
            className={`py-2 px-3 sm:px-4 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "wallets"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Carteiras dos Membros ({wallets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-2 px-3 sm:px-4 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "history"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Todos os Pagamentos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`py-2 px-3 sm:px-4 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "audit"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Auditoria & Logs</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {/* ABA 1: FILA DE CONFERÊNCIA (PAGAMENTOS PENDENTES) */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>
                  Pagamentos Informados Aguardando Conferência (
                  {pendingTxs.length})
                </span>
              </h2>

              <button
                type="button"
                onClick={() => loadFinanceData()}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-colors"
                title="Recarregar"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoadingData ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {pendingTxs.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                  Tudo em dia!
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Nenhum jogador informou pagamento pendente de aprovação nesta
                  liga no momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingTxs.map((tx) => {
                  const valorPartida = Number(tx.valor_partida || 0);
                  const valorInformado = Number(tx.valor_informado || 0);
                  const playerName = tx.user?.apelido
                    ? `${tx.user.nome} (${tx.user.apelido})`
                    : tx.user?.nome || "Jogador";

                  return (
                    <div
                      key={tx.id}
                      className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                            {tx.user?.avatar_url ? (
                              <img
                                src={tx.user.avatar_url}
                                alt={playerName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              tx.user?.nome?.charAt(0).toUpperCase() || "J"
                            )}
                          </div>
                          <div>
                            <span className="font-black text-sm text-slate-900 dark:text-white block leading-tight">
                              {playerName}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {new Date(tx.created_at).toLocaleDateString(
                                "pt-BR",
                              )}{" "}
                              às{" "}
                              {new Date(tx.created_at).toLocaleTimeString(
                                "pt-BR",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {tx.type === "wallet_deposit" ? (
                            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase border border-blue-500/20">
                              💰 Adição de Crédito
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase border border-amber-500/20">
                              Aguardando
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Informações da Partida & Valores */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 space-y-2 text-xs">
                        {tx.match ? (
                          <>
                            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                              <span className="font-bold">Partida:</span>
                              <span className="font-extrabold truncate">
                                {tx.match.titulo}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>Valor Oficial da Partida:</span>
                              <strong>{formatCurrency(valorPartida)}</strong>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-extrabold text-[11px]">
                            <Wallet className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>Depósito direto para o Caixa Individual</span>
                          </div>
                        )}

                        {tx.observacoes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                            <span className="font-bold">Observação:</span>{" "}
                            {tx.observacoes}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="font-black text-slate-900 dark:text-white">
                            Valor Informado:
                          </span>
                          <strong className="text-base font-black text-amber-600 dark:text-amber-400">
                            {formatCurrency(valorInformado)}
                          </strong>
                        </div>
                        {valorInformado > valorPartida &&
                          tx.type === "match_payment" && (
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20 flex items-center justify-between">
                              <span>Sobra de crédito:</span>
                              <strong>
                                +{" "}
                                {formatCurrency(valorInformado - valorPartida)}{" "}
                                (
                                {tx.destino_excedente === "caixinha"
                                  ? summary?.caixinha_name
                                  : "Caixa"}
                                )
                              </strong>
                            </div>
                          )}
                      </div>

                      {/* Miniatura do Comprovante */}
                      {tx.comprovante_url && (
                        <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-32 bg-black/5 flex items-center justify-center">
                          <img
                            src={tx.comprovante_url}
                            alt="Comprovante"
                            className="w-full h-28 object-contain"
                          />
                          <a
                            href={tx.comprovante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-extrabold text-xs"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Ver Comprovante</span>
                          </a>
                        </div>
                      )}

                      {/* Ações Administrativas */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleQuickConfirm(tx)}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprovar {formatCurrency(valorInformado)}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModalTx(tx);
                            setIsConfirmModalOpen(true);
                          }}
                          className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Conferir / Ajustar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CAIXINHA COLETIVA DA LIGA */}
        {activeTab === "caixinha" && (
          <div className="space-y-5">
            {/* Header da Caixinha com Renomeação e Ações */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {isEditingCaixinhaName ? (
                      <form
                        onSubmit={handleSaveCaixinhaName}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={newCaixinhaName}
                          onChange={(e) => setNewCaixinhaName(e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-base text-slate-900 dark:text-white"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingCaixinhaName(false)}
                          className="px-2 py-1.5 text-xs text-slate-400"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">
                          {summary?.caixinha_name || "Caixinha da Resenha"}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setIsEditingCaixinhaName(true)}
                          className="text-slate-400 hover:text-brand-500 p-1"
                          title="Alterar nome da caixinha"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Caixa coletivo para confraternizações, churrascos, bebidas e
                    despesas da liga
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsAddCaixinhaModalOpen(true)}
                    className="flex-1 sm:flex-initial py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Crédito à Caixinha</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>Lançar Despesa</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCaixinhaPDF}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    title="Exportar Relatório PDF"
                  >
                    <FileText className="w-4 h-4" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              {/* Mini cards de saldo da caixinha */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 block">
                    Saldo Atual
                  </span>
                  <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 block mt-0.5">
                    {formatCurrency(summary?.caixinha_saldo || 0)}
                  </span>
                </div>

                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                  <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-400 block">
                    Total Arrecadado
                  </span>
                  <span className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 block mt-0.5">
                    {formatCurrency(summary?.caixinha_total_arrecadado || 0)}
                  </span>
                </div>

                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <span className="text-[10px] font-black uppercase text-red-800 dark:text-red-400 block">
                    Total Utilizado
                  </span>
                  <span className="text-lg sm:text-xl font-black text-red-700 dark:text-red-400 block mt-0.5">
                    {formatCurrency(summary?.caixinha_total_despesas || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Extrato da Caixinha */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Extrato Completo da Caixinha ({caixinhaTxs.length})
                </h3>
              </div>

              {caixinhaTxs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhuma movimentação registrada na caixinha.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {caixinhaTxs.map((tx) => {
                    const isEntry = tx.type === "entry";
                    return (
                      <div
                        key={tx.id}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                              isEntry
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {isEntry ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                          </div>
                          <div className="truncate">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                              {tx.descricao}
                            </span>
                            <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                              <span>
                                {new Date(tx.created_at).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </span>
                              {tx.doador_nome && (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  • Doador: {tx.doador_nome}
                                </span>
                              )}
                              {!tx.doador_nome && tx.user && (
                                <span>
                                  • Por: {tx.user.apelido || tx.user.nome}
                                </span>
                              )}
                              {tx.admin && (
                                <span>
                                  • Registrado por: {tx.admin.apelido || tx.admin.nome || 'Admin'}
                                </span>
                              )}
                              {tx.categoria && (
                                <span className="capitalize">
                                  • {tx.categoria}
                                </span>
                              )}
                            </div>
                            {tx.observacoes && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                                "{tx.observacoes}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`font-black text-sm ${
                              isEntry
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {isEntry ? "+" : "-"} {formatCurrency(tx.valor)}
                          </span>

                          {!isEntry && (
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(tx.id)}
                              className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                              title="Remover Despesa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 3: CAIXAS DOS JOGADORES */}
        {activeTab === "wallets" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Carteiras Individuais dos Membros ({wallets.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visualize os saldos e adicione créditos individuais a cada membro da liga
                </p>
              </div>

              {/* Busca */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar jogador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {filteredWallets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum jogador encontrado com os filtros informados.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2.5 px-3">Jogador</th>
                      <th className="py-2.5 px-3">Saldo Disponível</th>
                      <th className="py-2.5 px-3">Total Pago</th>
                      <th className="py-2.5 px-3">Gasto em Jogos</th>
                      <th className="py-2.5 px-3">Doado p/ Caixinha</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredWallets.map((w) => {
                      const pName = w.user?.apelido
                        ? `${w.user.nome} (${w.user.apelido})`
                        : w.user?.nome || "Jogador";

                      return (
                        <tr
                          key={w.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                                {w.user?.avatar_url ? (
                                  <img
                                    src={w.user.avatar_url}
                                    alt={pName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  w.user?.nome?.charAt(0).toUpperCase() || "J"
                                )}
                              </div>
                              <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[150px]">
                                {pName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                              {formatCurrency(w.saldo_disponivel)}
                            </strong>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                            {formatCurrency(w.total_pago)}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                            {formatCurrency(w.total_utilizado_partidas)}
                          </td>
                          <td className="py-3 px-3 text-orange-600 dark:text-orange-400 font-bold">
                            {formatCurrency(w.total_contribuido_caixinha)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (w.user) {
                                    setAddCreditTargetUser(w.user);
                                    setAddCreditCurrentBalance(w.saldo_disponivel || 0);
                                    setIsAddCreditModalOpen(true);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Adicionar Crédito</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (w.user) {
                                    setHistoryTargetUser(w.user);
                                    setHistoryCurrentBalance(w.saldo_disponivel || 0);
                                    setIsMemberHistoryModalOpen(true);
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all shrink-0"
                                title="Ver Extrato da Carteira"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 4: HISTÓRICO GERAL DE PAGAMENTOS */}
        {activeTab === "history" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Histórico de Todos os Pagamentos ({filteredTxs.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transações confirmadas, pendentes e rejeitadas
                </p>
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">Todos os Status</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="pending">Pendentes</option>
                  <option value="rejected">Rejeitados</option>
                </select>

                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {filteredTxs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum pagamento encontrado com os filtros selecionados.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTxs.map((tx) => {
                  const isConfirmed = tx.status === "confirmed";
                  const isPending = tx.status === "pending";
                  const playerName = tx.user?.apelido
                    ? `${tx.user.nome} (${tx.user.apelido})`
                    : tx.user?.nome || "Jogador";

                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-600"
                              : isPending
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {isConfirmed ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isPending ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="truncate">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                            {playerName} •{" "}
                            {tx.type === "match_payment"
                              ? tx.match?.titulo || "Partida"
                              : tx.type === "wallet_deposit"
                                ? "Depósito Antecipado"
                                : tx.type === "wallet_usage"
                                  ? "Pago c/ Saldo"
                                  : "Ajuste"}
                          </span>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>
                              {new Date(tx.created_at).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                            {tx.admin && (
                              <span>• Validado por: {tx.admin.nome}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-black text-sm block ${
                            isConfirmed
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isPending
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-500 line-through"
                          }`}
                        >
                          {formatCurrency(
                            tx.valor_confirmado ?? tx.valor_informado,
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-block border ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : isPending
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-red-500/10 text-red-600 border-red-500/20"
                          }`}
                        >
                          {isConfirmed
                            ? "Confirmado"
                            : isPending
                              ? "Pendente"
                              : "Rejeitado"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 5: AUDITORIA & LOGS */}
        {activeTab === "audit" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Logs de Auditoria Financeira Imutável ({auditLogs.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Histórico de quem realizou cada confirmação, ajuste ou despesa
                no sistema
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum log de auditoria registrado ainda nesta liga.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-black uppercase">
                          {log.action}
                        </span>
                        <strong className="text-slate-900 dark:text-white">
                          {log.actor?.nome || "Administrador"}
                        </strong>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleDateString("pt-BR")}{" "}
                        às{" "}
                        {new Date(log.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                      {log.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE CONFERÊNCIA DE PAGAMENTO */}
      <ConfirmPaymentModal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setConfirmModalTx(null);
        }}
        transaction={confirmModalTx}
        caixinhaName={summary?.caixinha_name || "Caixinha da Resenha"}
        onSuccess={() => void loadFinanceData()}
      />

      {/* MODAL DE LANÇAMENTO DE DESPESA / ENTRADA NA CAIXINHA */}
      <CaixinhaExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        leagueId={selectedLeagueId}
        caixinhaName={summary?.caixinha_name || "Caixinha da Resenha"}
        onSuccess={() => void loadFinanceData()}
      />

      {/* MODAL DE AJUSTE MANUAL DE SALDO DO JOGADOR */}
      <ManualBalanceAdjustModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustTargetUser(null);
        }}
        targetUser={adjustTargetUser}
        leagueId={selectedLeagueId}
        leagueName={selectedLeague?.name}
        onSuccess={() => void loadFinanceData()}
      />

      {/* MODAL DE ADICIONAR CRÉDITO À CARTEIRA DO MEMBRO */}
      <AddMemberCreditModal
        isOpen={isAddCreditModalOpen}
        onClose={() => {
          setIsAddCreditModalOpen(false);
          setAddCreditTargetUser(null);
        }}
        targetUser={addCreditTargetUser}
        currentBalance={addCreditCurrentBalance}
        leagueId={selectedLeagueId}
        leagueName={selectedLeague?.name}
        onSuccess={() => void loadFinanceData()}
      />

      {/* MODAL DE ADICIONAR CRÉDITO / DOAÇÃO À CAIXINHA */}
      <AddCaixinhaCreditModal
        isOpen={isAddCaixinhaModalOpen}
        onClose={() => setIsAddCaixinhaModalOpen(false)}
        leagueId={selectedLeagueId}
        caixinhaName={summary?.caixinha_name || "Caixinha da Liga"}
        currentBalance={summary?.caixinha_saldo || 0}
        onSuccess={() => void loadFinanceData()}
      />

      {/* MODAL DE EXTRATO INDIVIDUAL DO MEMBRO */}
      <MemberWalletHistoryModal
        isOpen={isMemberHistoryModalOpen}
        onClose={() => {
          setIsMemberHistoryModalOpen(false);
          setHistoryTargetUser(null);
        }}
        targetUser={historyTargetUser}
        currentBalance={historyCurrentBalance}
        leagueId={selectedLeagueId}
        leagueName={selectedLeague?.name}
      />

      {/* MODAIS GLOBAIS DE CABEÇALHO */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={() => void loadFinanceData()}
      />
      <CreateMatchModal
        isOpen={isCreateMatchOpen}
        onClose={() => setIsCreateMatchOpen(false)}
        onMatchCreated={() => void loadFinanceData()}
      />
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
      />
    </div>
  );
}

export default function AdminFinancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Carregando módulo financeiro...
          </p>
        </div>
      }
    >
      <AdminFinanceContent />
    </Suspense>
  );
}
