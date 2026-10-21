"use client";

import React, { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X } from "lucide-react";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: "emerald" | "amber" | "blue" | "purple" | "rose";
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  badgeColor = "emerald",
  children,
  footer,
  maxWidth = "max-w-lg",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();
  // Travar o scroll da página enquanto o modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      window.requestAnimationFrame(() => dialogRef.current?.focus());
      return () => {
        document.body.style.overflow = originalStyle;
        returnFocusRef.current?.focus();
      };
    }
  }, [isOpen]);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    // Se arrastar para baixo mais de 100px ou com velocidade suficiente, fecha a folha
    if (info.offset.y > 100 || info.velocity.y > 400) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);

    if (focusableElements.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const badgeColorClasses = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  }[badgeColor];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
          {/* Backdrop Escurecido com Desfoque */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Container do Bottom Sheet (Mobile: desliza de baixo; Desktop: modal centralizado) */}
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={subtitle ? subtitleId : undefined}
            aria-label={title ? undefined : "Janela de diálogo"}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={`relative z-10 w-full ${maxWidth} bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] overflow-hidden`}
          >
            {/* Alça visual de arraste (Drag Handle) no Mobile */}
            <div className="pt-3 pb-1 sm:hidden flex justify-center cursor-grab active:cursor-grabbing shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Cabeçalho do Bottom Sheet */}
            {(title || icon) && (
              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && <div className="shrink-0">{icon}</div>}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {typeof title === "string" ? (
                        <h3 id={titleId} className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight truncate">
                          {title}
                        </h3>
                      ) : (
                        title
                      )}
                      {badge && (
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColorClasses}`}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    {subtitle && (
                      <p id={subtitleId} className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Botão de Fechar */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
                  aria-label="Fechar janela"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Conteúdo com rolagem suave isolada e suporte a teclado */}
            <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 overflow-y-auto overscroll-contain flex-1 touch-pan-y space-y-4">
              {children}
            </div>

            {/* Rodapé Fixo (Ações e Confirmações imunes ao corte de teclado) */}
            {footer && (
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md pb-safe shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
