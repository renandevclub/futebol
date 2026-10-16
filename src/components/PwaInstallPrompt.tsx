'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Download, Plus, Share, Smartphone, X, Zap } from 'lucide-react';

const INSTALL_DISMISSED_KEY = 'futresenha:pwa-install-dismissed-at';
const INSTALL_CONFIRMED_KEY = 'futresenha:pwa-installed';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type InstallMethod = 'native' | 'ios';

function isRunningAsInstalledApp() {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent;
  const isIosDevice =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|FBAN|FBAV|Instagram|Line|Twitter|TikTok|MicroMessenger/i.test(userAgent);

  return isIosDevice && isSafari;
}

function hasDismissedRecently() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markAsDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  } catch {
    // O modo privado ou políticas do navegador podem bloquear o localStorage.
  }
}

function markAsInstalled() {
  try {
    localStorage.setItem(INSTALL_CONFIRMED_KEY, 'true');
    localStorage.removeItem(INSTALL_DISMISSED_KEY);
  } catch {
    // A detecção por display-mode e pelo evento appinstalled continua funcionando.
  }
}

function wasPreviouslyInstalled() {
  try {
    return localStorage.getItem(INSTALL_CONFIRMED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const scheduleRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [installMethod, setInstallMethod] = useState<InstallMethod>('native');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalledApp() || wasPreviouslyInstalled()) {
      markAsInstalled();
      return;
    }

    const clearSchedule = () => {
      if (scheduleRef.current !== null) {
        window.clearTimeout(scheduleRef.current);
        scheduleRef.current = null;
      }
    };

    const showWhenReady = (method: InstallMethod) => {
      if (hasDismissedRecently()) return;

      clearSchedule();
      setInstallMethod(method);
      scheduleRef.current = window.setTimeout(() => {
        scheduleRef.current = null;

        if (
          isRunningAsInstalledApp() ||
          wasPreviouslyInstalled() ||
          hasDismissedRecently() ||
          (method === 'native' && !deferredPromptRef.current)
        ) {
          return;
        }

        setIsOpen(true);
      }, 4500);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      showWhenReady('native');
    };

    const handleAppInstalled = () => {
      clearSchedule();
      deferredPromptRef.current = null;
      markAsInstalled();
      setIsInstalling(false);
      setIsOpen(false);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === INSTALL_CONFIRMED_KEY && event.newValue === 'true') {
        handleAppInstalled();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('storage', handleStorageChange);

    if (isIosSafari()) {
      showWhenReady('ios');
    }

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      if (isRunningAsInstalledApp()) handleAppInstalled();
    };

    if (displayModeQuery.addEventListener) {
      displayModeQuery.addEventListener('change', handleDisplayModeChange);
    } else {
      displayModeQuery.addListener(handleDisplayModeChange);
    }

    return () => {
      clearSchedule();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('storage', handleStorageChange);
      if (displayModeQuery.removeEventListener) {
        displayModeQuery.removeEventListener('change', handleDisplayModeChange);
      } else {
        displayModeQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        markAsDismissed();
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleDismiss = () => {
    markAsDismissed();
    setIsOpen(false);
  };

  const handleInstall = async () => {
    if (installMethod === 'ios') {
      handleDismiss();
      return;
    }

    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) {
      handleDismiss();
      return;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPromptRef.current = null;

      if (choice.outcome === 'accepted') {
        markAsInstalled();
        setIsOpen(false);
      } else {
        handleDismiss();
      }
    } catch {
      handleDismiss();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleDismiss();
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />

            <div className="relative p-5 sm:p-6">
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Fechar convite de instalação"
                className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-3 pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                  {installMethod === 'ios' ? (
                    <Smartphone className="h-6 w-6" />
                  ) : (
                    <Download className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                    F&V Sports no seu celular
                  </p>
                  <h2 id="pwa-install-title" className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    Instale o app e fique mais perto da resenha
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Abra suas partidas mais rápido, direto da tela inicial, com uma experiência leve e sem precisar procurar pelo navegador.
              </p>

              {installMethod === 'ios' ? (
                <ol className="mt-4 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-200">1</span>
                    Toque em <Share className="h-3.5 w-3.5 text-sky-500" /> <span className="text-slate-900 dark:text-white">Compartilhar</span>.
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-200">2</span>
                    Escolha <Plus className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-slate-900 dark:text-white">Adicionar à Tela de Início</span>.
                  </li>
                </ol>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                    Acesso mais rápido
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    Ícone na tela inicial
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white shadow-lg shadow-emerald-500/25 transition-colors hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60"
                >
                  {installMethod === 'ios' ? (
                    'Entendi'
                  ) : isInstalling ? (
                    'Abrindo instalação...'
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Instalar agora
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="min-h-11 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  Agora não
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
