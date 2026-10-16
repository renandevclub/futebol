'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  Smartphone,
  Shield,
  Check,
  Calendar,
  DollarSign,
  Users,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { UserNotificationPreferences } from '@/types/database';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@/lib/notificationPreferences';
import {
  isPushSupported,
  getNotificationPermissionState,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from '@/lib/pushSubscriptionHelper';
import { toast } from 'sonner';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (isOpen && userId) {
      setPushStatus(getNotificationPermissionState());
      setLoading(true);
      void getUserNotificationPreferences(userId).then((data) => {
        setPrefs(data);
        setLoading(false);
      });
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof Omit<UserNotificationPreferences, 'user_id' | 'updated_at'>) => {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      [key]: !prefs[key],
    });
  };

  const handleSave = async () => {
    if (!prefs || !userId) return;
    setSaving(true);
    const success = await updateUserNotificationPreferences(userId, prefs);
    setSaving(false);

    if (success) {
      toast.success('Preferências de notificação salvas com sucesso!');
      onClose();
    } else {
      toast.error('Erro ao salvar preferências de notificação.');
    }
  };

  const handleTogglePushMaster = async () => {
    if (pushStatus === 'granted') {
      const unsub = await unsubscribeUserFromPush(userId);
      if (unsub) {
        setPushStatus('default');
        toast.info('Inscrição de notificações push deste aparelho foi desativada.');
      }
    } else {
      const res = await subscribeUserToPush(userId);
      if (res.success) {
        setPushStatus('granted');
        toast.success('🔔 Notificações no celular ativadas com sucesso!');
      } else {
        toast.error(res.error || 'Não foi possível ativar push no navegador.');
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-brand-400">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Preferências de Alertas
                </h2>
                <p className="text-xs text-slate-400">
                  Escolha o que você quer receber no site e no celular
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {loading || !prefs ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Carregando configurações...</span>
              </div>
            ) : (
              <>
                {/* Switch Master de Notificação no Dispositivo */}
                {isPushSupported() && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-950 border border-emerald-500/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Notificações no Celular / PWA</h4>
                        <p className="text-xs text-slate-400">
                          {pushStatus === 'granted'
                            ? 'Este aparelho está registrado para receber push nativo.'
                            : 'Ative para receber avisos mesmo com a tela bloqueada.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleTogglePushMaster}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                        pushStatus === 'granted'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                      }`}
                    >
                      {pushStatus === 'granted' ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                )}

                {/* Seção de Notificações por Categoria */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Canais e Categorias de Notificação
                  </h3>

                  {/* 1. Partidas */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-sky-400" />
                      <span className="text-sm font-bold text-white">Partidas e Presença</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Avisos de partidas agendadas, alterações, confirmações de vaga e cancelamento.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.in_app_matches}
                          onChange={() => handleToggle('in_app_matches')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">No App / Sino</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.push_matches}
                          onChange={() => handleToggle('push_matches')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">Push Celular</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. Pagamentos */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white">Pagamentos & PIX</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Confirmação de comprovantes, aprovações e cobranças de taxa de jogo.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.in_app_payments}
                          onChange={() => handleToggle('in_app_payments')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">No App / Sino</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.push_payments}
                          onChange={() => handleToggle('push_payments')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">Push Celular</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Times & Raspadinha */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold text-white">Times, Sorteio & Placar</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Sorteio de times liberado, início dos jogos da noite, gols e time campeão.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.in_app_teams}
                          onChange={() => handleToggle('in_app_teams')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">No App / Sino</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.push_teams}
                          onChange={() => handleToggle('push_teams')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">Push Celular</span>
                      </label>
                    </div>
                  </div>

                  {/* 4. Feed & Social */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-bold text-white">Feed Social & Comentários</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Comentários e interações nas fotos e resenhas publicadas por você.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.in_app_feed}
                          onChange={() => handleToggle('in_app_feed')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">No App / Sino</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs.push_feed}
                          onChange={() => handleToggle('push_feed')}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span className="text-slate-300">Push Celular</span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-brand-500/20 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Preferências</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
