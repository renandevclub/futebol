"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminAuditLog } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Ticket,
  KeyRound,
  Ban,
  Unlock,
  Shield,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExtendedAuditLog extends Omit<AdminAuditLog, "actor" | "target"> {
  actor?: { id: string; nome: string } | null;
  target?: { id: string; nome: string } | null;
}

const ACTION_LABELS: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  create_invite: {
    label: "Criou Convite",
    icon: <Ticket className="w-3.5 h-3.5" />,
    color: "text-brand-600 bg-brand-500/10 border-brand-500/20",
  },
  revoke_invite: {
    label: "Revogou Convite",
    icon: <Ban className="w-3.5 h-3.5" />,
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  consume_invite: {
    label: "Usou Convite",
    icon: <Ticket className="w-3.5 h-3.5" />,
    color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
  generate_password_recovery: {
    label: "Gerou Recuperação",
    icon: <KeyRound className="w-3.5 h-3.5" />,
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  consume_password_recovery: {
    label: "Trocou Senha",
    icon: <KeyRound className="w-3.5 h-3.5" />,
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
  block_user: {
    label: "Bloqueou Usuário",
    icon: <Ban className="w-3.5 h-3.5" />,
    color: "text-red-600 bg-red-500/10 border-red-500/20",
  },
  unblock_user: {
    label: "Reativou Usuário",
    icon: <Unlock className="w-3.5 h-3.5" />,
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
};

export const AdminAuditTabSection: React.FC = () => {
  const [logs, setLogs] = useState<ExtendedAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select(
          "*, actor:actor_user_id(id, nome), target:target_user_id(id, nome)"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Erro ao carregar auditoria:", error);
        toast.error("Erro ao carregar registros de auditoria.");
        return;
      }

      setLogs((data as ExtendedAuditLog[]) || []);
    } catch (err) {
      console.error("Exceção:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchesSearch =
        searchQuery === "" ||
        (l.actor?.nome &&
          l.actor.nome.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.target?.nome &&
          l.target.nome.toLowerCase().includes(searchQuery.toLowerCase())) ||
        l.action.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesAction = true;
      if (actionFilter !== "all") {
        matchesAction = l.action === actionFilter;
      }

      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, actionFilter]);

  return (
    <div className="space-y-4">
      {/* Barra de Busca e Filtros */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por ator, alvo ou ação..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs()}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filtros de Ação */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          {[
            { id: "all", label: "Todas Ações" },
            { id: "create_invite", label: "Criar Convite" },
            { id: "revoke_invite", label: "Revogar Convite" },
            { id: "consume_invite", label: "Uso de Convite" },
            { id: "generate_password_recovery", label: "Gerar Recuperação" },
            { id: "consume_password_recovery", label: "Troca de Senha" },
            { id: "block_user", label: "Bloqueio" },
            { id: "unblock_user", label: "Reativação" },
          ].map((act) => (
            <button
              key={act.id}
              onClick={() => setActionFilter(act.id)}
              className={`py-1.5 px-3 rounded-xl transition-all shrink-0 cursor-pointer ${
                actionFilter === act.id
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Logs */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-3 border-slate-500/30 border-t-slate-500 rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-bold">
            Carregando registros de auditoria...
          </span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
          <History className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs text-slate-500 font-bold">
            Nenhum registro de auditoria encontrado.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || {
              label: log.action,
              icon: <Shield className="w-3.5 h-3.5" />,
              color: "text-slate-600 bg-slate-500/10 border-slate-500/20",
            };

            return (
              <div
                key={log.id}
                className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${actionInfo.color}`}
                  >
                    {actionInfo.icon}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {actionInfo.label}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                          log.success
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        }`}
                      >
                        {log.success ? "Sucesso" : "Falhou"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {log.actor?.nome && (
                        <span>
                          Por: <strong>{log.actor.nome}</strong>{" "}
                        </span>
                      )}
                      {log.target?.nome && (
                        <span>
                          • Alvo: <strong>{log.target.nome}</strong>{" "}
                        </span>
                      )}
                      {log.metadata?.reason && (
                        <span>
                          • Motivo: <em>&quot;{log.metadata.reason}&quot;</em>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-medium shrink-0 text-left sm:text-right">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                    locale: ptBR,
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
