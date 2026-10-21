"use client";

import React, { useState } from "react";
import { Profile } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  X,
  Ban,
  Unlock,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phoneUtils";

interface ToggleBlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  onSuccess: () => void;
}

export const ToggleBlockUserModal: React.FC<ToggleBlockUserModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetUser) return null;

  const isBlocked = targetUser.account_status === "blocked";

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const rpcName = isBlocked ? "admin_unblock_user" : "admin_block_user";
      const { data, error } = await supabase.rpc(rpcName, {
        p_target_id: targetUser.id,
        p_reason: reason.trim() || null,
      });

      if (error) {
        console.error("Erro na RPC de bloqueio/desbloqueio:", error);
        toast.error(error.message || "Erro ao processar ação.");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Ação não permitida.");
        return;
      }

      toast.success(
        isBlocked
          ? `Conta de ${targetUser.nome} foi reativada!`
          : `Conta de ${targetUser.nome} foi bloqueada!`
      );
      setReason("");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Exceção:", err);
      toast.error("Ocorreu um erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        {/* Topo */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isBlocked
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              {isBlocked ? (
                <Unlock className="w-5 h-5" />
              ) : (
                <Ban className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {isBlocked ? "Reativar Usuário" : "Bloquear Usuário"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isBlocked
                  ? "Restaurar acesso e permissões do jogador"
                  : "Suspender acesso sem apagar dados ou histórico"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informações do Usuário */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 font-black text-slate-700 dark:text-slate-200">
            {targetUser.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
              {targetUser.nome}
            </h4>
            <p className="text-[11px] text-slate-500 truncate">
              WhatsApp: {formatPhoneDisplay(targetUser.whatsapp) || "Não cadastrado"}
            </p>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isBlocked
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {isBlocked ? "Bloqueado" : "Ativo"}
          </span>
        </div>

        {/* Alerta de Preservação de Dados */}
        <div
          className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-medium ${
            isBlocked
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
          }`}
        >
          {isBlocked ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          )}
          <span>
            {isBlocked
              ? "Ao reativar, o usuário poderá fazer login imediatamente com sua senha cadastrada."
              : "O bloqueio encerra a sessão ativa do usuário e impede novos logins. Nenhum dado, histórico de partidas ou estatísticas será apagado."}
          </span>
        </div>

        {/* Formulário com Justificativa */}
        <form onSubmit={handleAction} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Motivo ou Justificativa <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Conduta inadequada na partida, solicitação do titular, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Ficará registrado no log de auditoria administrativa.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancelar
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3.5 text-white font-extrabold rounded-2xl shadow-lg transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2 cursor-pointer ${
                isBlocked
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/25"
                  : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 shadow-red-500/25"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  {isBlocked ? (
                    <Unlock className="w-4 h-4" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>{isBlocked ? "Confirmar Reativação" : "Confirmar Bloqueio"}</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
};
