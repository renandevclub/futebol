"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserInvite } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  User,
  Calendar,
  Copy,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateInviteModal } from "./CreateInviteModal";

interface InvitesTabSectionProps {
  onDataChanged?: () => void;
}

export const InvitesTabSection: React.FC<InvitesTabSectionProps> = ({
  onDataChanged,
}) => {
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "used" | "expired" | "revoked"
  >("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inviteToRevoke, setInviteToRevoke] = useState<UserInvite | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchInvites = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_invites")
        .select("*, creator:created_by(id, nome), consumer:used_by(id, nome)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar convites:", error);
        toast.error("Erro ao carregar lista de convites.");
        return;
      }

      setInvites((data as UserInvite[]) || []);
    } catch (err) {
      console.error("Exceção ao listar convites:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleRevoke = async () => {
    if (!inviteToRevoke) return;
    setIsRevoking(true);
    try {
      const { data, error } = await supabase.rpc("admin_revoke_invite", {
        p_invite_id: inviteToRevoke.id,
      });

      if (error) {
        toast.error(error.message || "Erro ao revogar convite.");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Não foi possível revogar.");
        return;
      }

      toast.success("Convite revogado com sucesso!");
      setInviteToRevoke(null);
      fetchInvites();
      onDataChanged?.();
    } catch (err) {
      console.error("Exceção:", err);
      toast.error("Ocorreu um erro inesperado.");
    } finally {
      setIsRevoking(false);
    }
  };

  const filteredInvites = useMemo(() => {
    return invites.filter((inv) => {
      const matchesSearch =
        searchQuery === "" ||
        (inv.code_hint &&
          inv.code_hint.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.note &&
          inv.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.consumer?.nome &&
          inv.consumer.nome.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.creator?.nome &&
          inv.creator.nome.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = inv.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [invites, searchQuery, statusFilter]);

  const counters = useMemo(() => {
    return {
      total: invites.length,
      available: invites.filter((i) => i.status === "available").length,
      used: invites.filter((i) => i.status === "used").length,
      expired: invites.filter((i) => i.status === "expired").length,
      revoked: invites.filter((i) => i.status === "revoked").length,
    };
  }, [invites]);

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
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
            <Ticket className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-emerald-500/20 rounded-2xl flex items-center justify-between bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
              Disponíveis
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {counters.available}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-blue-500/20 rounded-2xl flex items-center justify-between bg-gradient-to-br from-blue-500/5 to-transparent">
          <div>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block">
              Utilizados
            </span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">
              {counters.used}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">
              Expirados / Revogados
            </span>
            <span className="text-xl font-black text-slate-700 dark:text-slate-300">
              {counters.expired + counters.revoked}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Ação Criar Convite */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por código, nota ou usuário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInvites()}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreateModalOpen(true)}
              className="py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Convite</span>
            </motion.button>
          </div>
        </div>

        {/* Abas de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          {[
            { id: "all", label: "Todos" },
            { id: "available", label: "Disponíveis" },
            { id: "used", label: "Utilizados" },
            { id: "expired", label: "Expirados" },
            { id: "revoked", label: "Revogados" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`py-1.5 px-3 rounded-xl transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Tabela */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-bold">Carregando convites...</span>
        </div>
      ) : filteredInvites.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
          <Ticket className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs text-slate-500 font-bold">Nenhum convite encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Visualização em Cards (Totalmente Responsivo para Mobile e Desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredInvites.map((inv) => {
              const isAvailable = inv.status === "available";
              const isUsed = inv.status === "used";
              const isExpired = inv.status === "expired";
              const isRevoked = inv.status === "revoked";

              return (
                <div
                  key={inv.id}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                          {inv.code_hint || "FV-••••••"}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isAvailable
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : isUsed
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : isRevoked
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        }`}
                      >
                        {isAvailable
                          ? "Disponível"
                          : isUsed
                          ? "Utilizado"
                          : isRevoked
                          ? "Revogado"
                          : "Expirado"}
                      </span>
                    </div>

                    {inv.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {inv.note}
                      </p>
                    )}

                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <div>
                        Criado em:{" "}
                        <strong>
                          {format(new Date(inv.created_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </strong>
                      </div>
                      <div>
                        Expira em:{" "}
                        <strong>
                          {format(new Date(inv.expires_at), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </strong>
                      </div>
                      {isUsed && inv.consumer && (
                        <div className="text-blue-600 dark:text-blue-400 font-bold">
                          Utilizado por: {inv.consumer.nome}
                        </div>
                      )}
                    </div>
                  </div>

                  {isAvailable && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end">
                      <button
                        onClick={() => setInviteToRevoke(inv)}
                        className="py-1 px-3 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Revogar Convite</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Criar Convite */}
      <CreateInviteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchInvites();
          onDataChanged?.();
        }}
      />

      {/* Modal Confirmar Revogação */}
      {inviteToRevoke && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Revogar Convite
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza de que deseja invalidar o convite{" "}
                <strong>{inviteToRevoke.code_hint}</strong>? Ele não poderá mais ser
                utilizado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInviteToRevoke(null)}
                className="py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRevoking}
                onClick={handleRevoke}
                className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-2xl text-xs transition-colors cursor-pointer shadow-md shadow-red-600/20"
              >
                {isRevoking ? "Revogando..." : "Confirmar Revogação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
