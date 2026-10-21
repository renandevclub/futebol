'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  Bell,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  UserPlus,
  UserMinus,
  MessageSquare,
  Award,
  Info,
  CheckCheck,
  Smartphone,
  ExternalLink,
  Sparkles,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { AppNotification } from '@/types/database';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/notifications';
import { subscribeToTables } from '@/lib/realtime';
import {
  isPushSupported,
  getNotificationPermissionState,
  subscribeUserToPush,
} from '@/lib/pushSubscriptionHelper';
import { toast } from 'sonner';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  onNotificationRead?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  userId,
  onNotificationRead,
}) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isActivatingPush, setIsActivatingPush] = useState(false);

  const loadNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    const data = await getNotifications(userId, 30);
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && userId) {
      void loadNotifications();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    setPushPermission(getNotificationPermissionState());
  }, [isOpen]);

  // Inscrição Realtime com filtro específico para o usuário logado
  useEffect(() => {
    if (!userId || !isOpen) return;

    const unsubscribe = subscribeToTables(
      `notification-modal-${userId}`,
      [{ table: 'notifications', filter: `user_id=eq.${userId}` }],
      () => {
        void loadNotifications();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, isOpen]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id: string, link?: string | null) => {
    const success = await markNotificationAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      if (onNotificationRead) onNotificationRead();
    }

    if (link) {
      onClose();
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    const success = await markAllNotificationsAsRead(userId);
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
      if (onNotificationRead) onNotificationRead();
    }
  };

  const handleEnablePush = async () => {
    if (!userId) return;
    setIsActivatingPush(true);
    const result = await subscribeUserToPush(userId);
    setIsActivatingPush(false);

    if (result.success) {
      setPushPermission('granted');
      toast.success('Notificações no celular ativadas com sucesso!');
    } else {
      toast.error(result.error || 'Permissão de notificações bloqueada pelo navegador');
      setPushPermission(getNotificationPermissionState());
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIconAndStyle = (type: string) => {
    switch (type) {
      case 'payment_confirmed':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          badge: 'Pagamento Confirmado',
        };
      case 'payment_pending':
      case 'payment_rejected':
        return {
          icon: <DollarSign className="w-5 h-5 text-rose-400" />,
          bg: 'bg-rose-500/10 border-rose-500/20',
          badge: type === 'payment_pending' ? 'Cobrança Pendente' : 'Pagamento Recusado',
        };
      case 'match_cancelled':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          bg: 'bg-rose-500/10 border-rose-500/20',
          badge: 'Partida Cancelada',
        };
      case 'match_update':
      case 'match_created':
      case 'match_reminder':
        return {
          icon: <Calendar className="w-5 h-5 text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20',
          badge: type === 'match_created' ? 'Nova Partida' : 'Aviso da Partida',
        };
      case 'teams_drawn':
      case 'team_assigned':
        return {
          icon: <Sparkles className="w-5 h-5 text-purple-400" />,
          bg: 'bg-purple-500/10 border-purple-500/20',
          badge: 'Sorteio de Times',
        };
      case 'goal_scored':
      case 'champion_declared':
        return {
          icon: <Flame className="w-5 h-5 text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20',
          badge: type === 'champion_declared' ? '🏆 Campeão' : '⚽ Gol Marcado',
        };
      case 'player_joined':
        return {
          icon: <UserPlus className="w-5 h-5 text-emerald-400" />,
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          badge: 'Novo Jogador',
        };
      case 'player_left':
        return {
          icon: <UserMinus className="w-5 h-5 text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20',
          badge: 'Saída de Jogador',
        };
      case 'comment':
        return {
          icon: <MessageSquare className="w-5 h-5 text-sky-400" />,
          bg: 'bg-sky-500/10 border-sky-500/20',
          badge: 'Novo Comentário',
        };
      case 'badge_earned':
        return {
          icon: <Award className="w-5 h-5 text-purple-400" />,
          bg: 'bg-purple-500/10 border-purple-500/20',
          badge: 'Conquista Desbloqueada',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-slate-400" />,
          bg: 'bg-slate-500/10 border-slate-500/20',
          badge: 'Aviso do Sistema',
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />
        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          className="relative z-10 w-full max-w-lg max-h-[88dvh] bg-slate-900 border-t sm:border border-slate-800 rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col pb-safe"
        >
          {/* Alça visual de arraste para Mobile */}
          <div className="pt-2.5 pb-1 sm:hidden flex justify-center cursor-grab active:cursor-grabbing shrink-0">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
          </div>

          {/* Header do Modal */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-2xl">
                <Bell className="w-6 h-6 text-brand-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white font-bold text-xs rounded-full flex items-center justify-center border-2 border-slate-900">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Notificações</h2>
                <p className="text-xs text-slate-400">Fique por dentro dos jogos e recados</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Banner de permissão Push para Mobile */}
          {pushPermission === 'default' && isPushSupported() && (
            <div className="mx-4 mt-4 p-3.5 bg-brand-500/10 border border-brand-500/30 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-brand-400 shrink-0" />
                <p className="text-xs text-slate-300">
                  Ative as <strong className="text-white">notificações no celular</strong> para receber avisos de jogos e cobranças PIX.
                </p>
              </div>
              <button
                onClick={handleEnablePush}
                disabled={isActivatingPush}
                className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shrink-0"
              >
                {isActivatingPush ? '...' : 'Ativar'}
              </button>
            </div>
          )}

          {/* Filtros e Ações */}
          <div className="px-5 py-3 border-b border-slate-800/60 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === 'unread'
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Não Lidas ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-400 font-medium transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Marcar lidas</span>
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Carregando notificações...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center p-6">
                <div className="p-4 bg-slate-800/50 rounded-full mb-3 text-slate-600">
                  <Bell className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-slate-300">Nenhuma notificação</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  {filter === 'unread'
                    ? 'Você leu todas as suas notificações recentes!'
                    : 'Você ainda não recebeu avisos ou novidades por aqui.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const style = getIconAndStyle(notif.type);
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleMarkAsRead(notif.id, notif.link)}
                    className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                      notif.read
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-75 hover:opacity-100 hover:border-slate-700'
                        : `${style.bg} shadow-lg shadow-black/20 hover:border-brand-500/40`
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 shrink-0">
                        {style.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {style.badge}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDate(notif.created_at)}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-white leading-snug">
                          {notif.title}
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                          {notif.message}
                        </p>

                        {notif.link && (
                          <div className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-brand-400 group-hover:underline">
                            <span>Ver detalhes</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {!notif.read && (
                        <div className="w-2.5 h-2.5 bg-brand-500 rounded-full shrink-0 self-center animate-pulse" />
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer do Modal com Link para a Central Completa */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">F&V Sports Notificações</span>
            <button
              onClick={() => {
                onClose();
                router.push('/notificacoes');
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors"
            >
              <span>Ver todas na página</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
