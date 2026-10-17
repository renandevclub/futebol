"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PasswordRecoveryRequest, Profile } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  KeyRound,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Plus,
  ShieldCheck,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneDisplay } from "@/lib/phoneUtils";
import { GenerateRecoveryModal } from "./GenerateRecoveryModal";

interface ExtendedRecoveryRequest extends PasswordRecoveryRequest {
  target?: {
    id: string;
    nome: string;
    whatsapp?: string | null;
  } | null;
}

export const RecoveriesTabSection: React.FC = () => {
  const [recoveries, setRecoveries] = useState<ExtendedRecoveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "used" | "expired" | "invalidated"
  >("all");

  const [selectedUserForRecovery, setSelectedUserForRecovery] =
    useState<Profile | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  const fetchRecoveries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("password_recovery_requests")
        .select(
          "*, target:target_profile_id(id, nome, whatsapp), creator:created_by(id, nome)"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Erro ao buscar histórico de recuperação:", error);
        toast.error("Erro ao carregar histórico de recuperação.");
        return;
      }

      setRecoveries((data as ExtendedRecoveryRequest[]) || []);
    } catch (err) {
      console.error("Exceção:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecoveries();
  }, []);

  const filteredRecoveries = useMemo(() => {
    return recoveries.filter((rec) => {
      const matchesSearch =
        searchQuery === "" ||
        (rec.target?.nome &&
          rec.target.nome.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rec.target?.whatsapp &&
          rec.target.whatsapp.includes(searchQuery));

      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = rec.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [recoveries, searchQuery, statusFilter]);

  const counters = useMemo(() => {
    return {
      total: recoveries.length,
      pending: recoveries.filter((r) => r.status === "pending").length,
      used: recoveries.filter((r) => r.status === "used").length,
      expiredOrInvalidated: recoveries.filter(
        (r) => r.status === "expired" || r.status === "invalidated" || r.status === "failed"
      ).length,
    };
  }, [recoveries]);

  return (
    <div className="space-y-4">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Total</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {counters.total}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <KeyRound className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-amber-500/20 rounded-2xl flex items-center justify-between bg-gradient-to-br from-amber-500/5 to-transparent">
          <div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
              Ativos / Pendentes
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
              {counters.pending}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-emerald-500/20 rounded-2xl flex items-center justify-between bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
              Redefinidos com Sucesso
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {counters.used}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">
              Invalidados / Expirados
            </span>
            <span className="text-xl font-black text-slate-700 dark:text-slate-300">
              {counters.expiredOrInvalidated}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por jogador ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRecoveries()}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Abas de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          {[
            { id: "all", label: "Todos" },
            { id: "pending", label: "Pendentes (Ativos)" },
            { id: "used", label: "Concluídos" },
            { id: "expired", label: "Expirados" },
            { id: "invalidated", label: "Invalidados" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`py-1.5 px-3 rounded-xl transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-bold">
            Carregando histórico de recuperação...
          </span>
        </div>
      ) : filteredRecoveries.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
          <KeyRound className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs text-slate-500 font-bold">
            Nenhuma solicitação de recuperação encontrada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRecoveries.map((rec) => {
            const isPending = rec.status === "pending";
            const isUsed = rec.status === "used";
            const isExpired = rec.status === "expired";
            const isInvalidated = rec.status === "invalidated";
            const isFailed = rec.status === "failed";

            return (
              <div
                key={rec.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {rec.target?.nome || "Usuário"}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {formatPhoneDisplay(rec.target?.whatsapp) || "Sem telefone"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isPending
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : isUsed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : isFailed
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                    }`}
                  >
                    {isPending
                      ? "Pendente (30 min)"
                      : isUsed
                      ? "Redefinida"
                      : isFailed
                      ? "Tentativas Excedidas"
                      : isInvalidated
                      ? "Invalidado"
                      : "Expirado"}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex justify-between">
                    <span>Gerado em:</span>
                    <strong>
                      {format(new Date(rec.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tentativas:</span>
                    <strong>
                      {rec.attempt_count} de {rec.max_attempts}
                    </strong>
                  </div>
                  {rec.used_at && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>Utilizado em:</span>
                      <span>
                        {format(new Date(rec.used_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Gerar Nova Recuperação */}
      {selectedUserForRecovery && (
        <GenerateRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => {
            setIsRecoveryModalOpen(false);
            setSelectedUserForRecovery(null);
          }}
          targetUser={selectedUserForRecovery}
          onSuccess={() => fetchRecoveries()}
        />
      )}
    </div>
  );
};
