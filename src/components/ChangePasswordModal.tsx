'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Lock, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage('A nova senha deve conter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('A confirmação de senha não coincide com a nova senha digitada.');
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Erro ao alterar senha:', error);
        setErrorMessage(error.message || 'Falha ao atualizar a senha.');
        toast.error('Erro ao atualizar a senha.');
        return;
      }

      toast.success('Sua senha foi alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      console.error('Exceção ao alterar senha:', err);
      setErrorMessage('Ocorreu um erro ao alterar sua senha.');
      toast.error('Erro ao atualizar senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 relative"
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pt-1">
          <div className="w-14 h-14 bg-gradient-to-tr from-brand-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/25 text-white">
            <KeyRound className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Alterar Minha Senha
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Defina uma nova senha segura para acessar sua conta
          </p>
        </div>

        {/* Mensagem de Erro */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nova Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                placeholder="Mínimo de 8 caracteres"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Confirmar Nova Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3.5 text-xs font-extrabold text-white bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Atualizar Senha</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
