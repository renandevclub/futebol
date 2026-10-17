"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  X,
  Smartphone,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  Ticket,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPhoneDisplay, validatePhoneNumber, cleanPhoneNumber } from "@/lib/phoneUtils";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, signup, recoverPassword } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");

  // Campos de Cadastro
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [genero, setGenero] = useState<"masculino" | "feminino">("masculino");
  const [inviteCode, setInviteCode] = useState("");

  // Campos Comuns
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Estados Visuais
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Fluxo de Recuperação
  const [recoveryTab, setRecoveryTab] = useState<"code" | "whatsapp">("code");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setPhone(formatted);
    if (errorMessage) setErrorMessage(null);
  };

  const handleRecoveryPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setRecoveryPhone(formatted);
    if (recoveryError) setRecoveryError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      setErrorMessage(validation.error || "Número de telefone inválido.");
      return;
    }

    if (!password) {
      setErrorMessage("Por favor, informe sua senha de acesso.");
      return;
    }

    setIsSubmitting(true);
    const result = await login(phone, password);
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || "Telefone ou senha incorretos.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!nome.trim()) {
      setErrorMessage("Por favor, informe seu nome completo.");
      return;
    }

    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      setErrorMessage(validation.error || "Número de telefone inválido.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("A senha deve conter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "A confirmação de senha não coincide com a senha digitada.",
      );
      return;
    }

    setIsSubmitting(true);
    const result = await signup({
      nome: nome.trim(),
      apelido: apelido.trim() || undefined,
      whatsapp: phone,
      password: password,
      genero: genero,
      inviteCode: inviteCode.trim() || undefined,
    });
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || "Não foi possível realizar o cadastro.");
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    const validation = validatePhoneNumber(recoveryPhone);
    if (!validation.isValid) {
      setRecoveryError(validation.error || "Número de WhatsApp inválido.");
      return;
    }

    const cleanCode = recoveryCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setRecoveryError("O código de recuperação deve conter 6 dígitos.");
      return;
    }

    if (recoveryPassword.length < 8) {
      setRecoveryError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (recoveryPassword !== recoveryConfirmPassword) {
      setRecoveryError("A confirmação de senha não confere com a nova senha digitada.");
      return;
    }

    setIsRecoverySubmitting(true);
    const result = await recoverPassword(recoveryPhone, cleanCode, recoveryPassword);
    setIsRecoverySubmitting(false);

    if (result.success) {
      setShowForgotModal(false);
      setPhone(recoveryPhone);
      setPassword("");
      setMode("login");
    } else {
      setRecoveryError(result.error || "Não foi possível redefinir sua senha.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Botão Fechar */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header com Logo em Destaque */}
        <div className="text-center pt-1">
          <div className="flex items-center justify-center mb-2">
            <img
              src="/logo.png"
              alt="F&V Sports Logo"
              className="w-36 h-36 sm:w-40 sm:h-40 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 duration-300"
              onError={(e) => {
                // Fallback visual se a logo demorar a carregar
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {mode === "login" ? "Acesse sua Conta" : "Crie sua Conta"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === "login"
              ? "Entre com seu telefone e senha para acessar suas partidas e ligas"
              : "Cadastre-se para participar dos jogos e acompanhar suas estatísticas"}
          </p>
        </div>

        {/* Alternador de Modo: Entrar / Cadastrar */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-bold">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === "login"
                ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Entrar</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              setMode("register");
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === "register"
                ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Criar Conta</span>
          </motion.button>
        </div>

        {/* Mensagem de Erro Amigável */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span>{errorMessage}</span>
                {mode === "login" && errorMessage.includes("incorretos") && (
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="text-brand-600 dark:text-brand-400 font-extrabold underline block hover:opacity-80"
                  >
                    Ainda não definiu sua senha? Clique aqui para criar sua
                    conta.
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formulário de Login */}
        {mode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Telefone (WhatsApp) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder="(91) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg"
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar no F&V Sports</span>
                </>
              )}
            </motion.button>
          </form>
        ) : (
          /* Formulário de Cadastro */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Apelido (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlinhos"
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Gênero <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setGenero("masculino")}
                    className={`py-1.5 text-xs font-bold rounded-xl transition-all ${
                      genero === "masculino"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    ♂ Masc
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenero("feminino")}
                    className={`py-1.5 text-xs font-bold rounded-xl transition-all ${
                      genero === "feminino"
                        ? "bg-pink-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    ♀ Fem
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Telefone (WhatsApp) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder="(91) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Se você já jogou partidas conosco, seu histórico será vinculado
                automaticamente.
              </p>
            </div>

            {/* Campo Opcional de Convite */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Código de Convite <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Não obrigatório
                </span>
              </div>
              <div className="relative">
                <Ticket className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Ex: FV-9K3M7A (deixe em branco se não tiver)"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Possui convite do Super Administrador? Digite aqui para vincular sua origem.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Criar Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Mín. 8 dígitos"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirmar Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2 mt-3 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Finalizar Cadastro</span>
                </>
              )}
            </motion.button>
          </form>
        )}

        {/* Modal Interativo de Recuperação de Senha com Código Temporário */}
        {showForgotModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Recuperação de Senha
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Código temporário fornecido pelo Administrador
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Seletor de Modo: Tenho Código / Pedir Código */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTab("code");
                    setRecoveryError(null);
                  }}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    recoveryTab === "code"
                      ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Digitar Código</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTab("whatsapp");
                    setRecoveryError(null);
                  }}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    recoveryTab === "whatsapp"
                      ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Pedir Código</span>
                </button>
              </div>

              {recoveryError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoveryTab === "code" ? (
                /* Formulário de Redefinição com Código */
                <form onSubmit={handleRecoverySubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Telefone (WhatsApp) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        required
                        placeholder="(91) 99999-9999"
                        value={recoveryPhone}
                        onChange={handleRecoveryPhoneChange}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Código de 6 Dígitos <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        placeholder="Ex: 842915"
                        value={recoveryCode}
                        onChange={(e) => {
                          setRecoveryCode(e.target.value.replace(/\D/g, ""));
                          if (recoveryError) setRecoveryError(null);
                        }}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold tracking-widest text-slate-900 dark:text-white"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Válido por 30 minutos após a geração pelo Administrador.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nova Senha <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showRecoveryPassword ? "text" : "password"}
                        required
                        placeholder="Mínimo 8 caracteres"
                        value={recoveryPassword}
                        onChange={(e) => setRecoveryPassword(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showRecoveryPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                        type={showRecoveryPassword ? "text" : "password"}
                        required
                        placeholder="Repita a nova senha"
                        value={recoveryConfirmPassword}
                        onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    disabled={isRecoverySubmitting}
                    className="w-full py-3 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-2 mt-3 cursor-pointer"
                  >
                    {isRecoverySubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Redefinindo Senha...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar Nova Senha</span>
                      </>
                    )}
                  </motion.button>
                </form>
              ) : (
                /* Solicitar Código ao Administrador no WhatsApp */
                <div className="space-y-3 text-center">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed text-left">
                    Para garantir a segurança da sua conta, o código de recuperação é gerado individualmente pelo <strong>Super Administrador</strong>.
                  </p>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 text-left space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-brand-600 dark:text-brand-400">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Como funciona:</span>
                    </div>
                    <p>1. Clique no botão abaixo para abrir a conversa oficial no WhatsApp.</p>
                    <p>2. O Administrador confirmará seu cadastro e gerará um código de 6 dígitos.</p>
                    <p>3. Volte nesta tela na aba &quot;Digitar Código&quot; e defina sua nova senha.</p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <a
                      href="https://wa.me/5591993370456?text=Ol%C3%A1%2C%20preciso%20de%20um%20c%C3%B3digo%20de%20recupera%C3%A7%C3%A3o%20de%20senha%20no%20F%26V%20Sports."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Falar com o Organizador no WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
