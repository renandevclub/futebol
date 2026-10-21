"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Ticket,
  Copy,
  Check,
  Calendar,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Send,
} from "lucide-react";

interface CreateInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInviteModal: React.FC<CreateInviteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [daysValid, setDaysValid] = useState<number>(7);
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    code: string;
    expires_at: string;
    code_hint: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("admin_create_invite", {
        p_note: note.trim() || null,
        p_days_valid: daysValid,
      });

      if (error) {
        console.error("Erro ao gerar convite:", error);
        toast.error(error.message || "Não foi possível gerar o convite.");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Erro ao gerar convite.");
        return;
      }

      setGeneratedResult({
        code: data.code,
        expires_at: data.expires_at,
        code_hint: data.code_hint,
      });
      toast.success("Código de convite gerado com sucesso!");
      onSuccess();
    } catch (err) {
      console.error("Exceção ao criar convite:", err);
      toast.error("Ocorreu um erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedResult?.code) return;
    try {
      await navigator.clipboard.writeText(generatedResult.code);
      setIsCopied(true);
      toast.success("Código de convite copiado para a área de transferência!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error("Falha ao copiar:", err);
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleClose = () => {
    setGeneratedResult(null);
    setNote("");
    setDaysValid(7);
    setIsCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {generatedResult ? "Convite Gerado" : "Gerar Novo Convite"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {generatedResult
                  ? "Compartilhe o código com o jogador convidado"
                  : "Convite oficial para cadastro no F&V Sports"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resultado: Código Gerado */}
        {generatedResult ? (
          <div className="space-y-4 py-1 text-center">
            <div className="p-4 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">
                Código Oficial de Acesso
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-brand-600 dark:text-brand-400 select-all">
                {generatedResult.code}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Válido por {daysValid} dias (expira em{" "}
                {new Date(generatedResult.expires_at).toLocaleDateString("pt-BR")}
                ).
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400 text-left font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                <strong>Atenção:</strong> Por segurança e criptografia, o código
                completo só é exibido nesta tela. Copie agora antes de fechar.
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleCopyCode}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/25 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Código do Convite</span>
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Criação */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Validade do Convite
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 7, 15, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDaysValid(days)}
                    className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      daysValid === days
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {days} dias
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nota ou Destinatário <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Convidado do Renan para a liga X"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={80}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Ajuda na auditoria e identificação de quem recebeu o convite.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-brand-600 dark:text-brand-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Regras do Convite:</span>
              </div>
              <p>• O código é de uso único e expira automaticamente.</p>
              <p>• A origem do cadastro ficará registrada como &quot;Com convite&quot;.</p>
              <p>• Você pode revogar o convite a qualquer momento antes do uso.</p>
            </div>

            <div className="pt-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Gerando Convite...</span>
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    <span>Gerar Código de Convite</span>
                  </>
                )}
              </motion.button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
