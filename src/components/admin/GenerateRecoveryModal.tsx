"use client";

import React, { useState } from "react";
import { Profile } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  X,
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  AlertCircle,
  ShieldAlert,
  Clock,
  Sparkles,
  User,
} from "lucide-react";
import { formatPhoneDisplay, cleanPhoneNumber } from "@/lib/phoneUtils";

interface GenerateRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  onSuccess: () => void;
}

export const GenerateRecoveryModal: React.FC<GenerateRecoveryModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !targetUser) return null;

  const handleGenerate = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc(
        "admin_generate_password_recovery",
        {
          p_target_profile_id: targetUser.id,
        }
      );

      if (error) {
        console.error("Erro na RPC de recuperação:", error);
        toast.error(error.message || "Erro ao gerar código de recuperação.");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Não foi possível gerar a recuperação.");
        return;
      }

      setGeneratedCode(data.code);
      setExpiresAt(data.expires_at);
      toast.success("Código de recuperação gerado com sucesso!");
      onSuccess();
    } catch (err) {
      console.error("Exceção ao gerar recuperação:", err);
      toast.error("Ocorreu um erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setIsCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error("Erro ao copiar:", err);
      toast.error("Falha ao copiar.");
    }
  };

  const handleSendWhatsApp = () => {
    if (!generatedCode || !targetUser.whatsapp) return;
    const cleanPhone = cleanPhoneNumber(targetUser.whatsapp);
    const message = encodeURIComponent(
      `Olá ${targetUser.nome}, seu código temporário para redefinir sua senha no F&V Sports é: *${generatedCode}*.\n\nEle é válido por 30 minutos. Acesse o aplicativo na tela de login, clique em "Esqueci minha senha" e informe o código.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  const handleClose = () => {
    setGeneratedCode(null);
    setExpiresAt(null);
    setIsCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        {/* Topo */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {generatedCode ? "Código Gerado" : "Recuperação de Senha"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acesso administrativo restrito
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

        {/* Card do Usuário Alvo */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0 font-black">
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
        </div>

        {generatedCode ? (
          /* Exibição do Código Gerado */
          <div className="space-y-4 text-center py-1">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Código Temporário de 6 Dígitos
              </span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-amber-600 dark:text-amber-400 select-all">
                {generatedCode}
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Válido por 30 minutos (até 5 tentativas de uso)</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 text-left space-y-1">
              <p>• O código anterior deste usuário foi invalidado automaticamente.</p>
              <p>• O código expira após o primeiro uso bem-sucedido.</p>
              <p>• A alteração de senha afetará a conta Auth existente sem recriar perfil.</p>
            </div>

            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyCode}
                  className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendWhatsApp}
                  disabled={!targetUser.whatsapp}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar no Whats</span>
                </motion.button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Confirmação Prévia */
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Esta ação gerará um código seguro de uso único para que o usuário
                possa redefinir sua senha. Qualquer código anterior ainda pendente
                será invalidado.
              </span>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancelar
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleGenerate}
                disabled={isSubmitting || !targetUser.auth_id}
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-extrabold rounded-2xl shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Gerar Código</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
