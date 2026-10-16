'use client';

import React, { useState, useMemo } from 'react';
import { Profile, League } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Crown,
  Shield,
  ShieldCheck,
  User,
  Users,
  Trophy,
  ArrowRightLeft,
  Trash2,
  PlusCircle,
  Check,
  Loader2,
  AlertTriangle,
  Info,
  Layers,
} from 'lucide-react';

export interface UserLeagueMembership {
  league_id: string;
  league_name: string;
  role: 'admin' | 'owner' | 'player' | 'member';
  rating?: number | null;
}

interface ManageUserLeaguesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  userMemberships: UserLeagueMembership[];
  allLeagues: League[];
  onMembershipsUpdated: () => void;
}

export const ManageUserLeaguesModal: React.FC<ManageUserLeaguesModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  userMemberships,
  allLeagues,
  onMembershipsUpdated,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Estado para Adicionar Nova Liga
  const [selectedNewLeagueId, setSelectedNewLeagueId] = useState<string>('');
  const [selectedNewRole, setSelectedNewRole] = useState<'admin' | 'player'>('player');

  // Estado para Transferir Liga
  const [transferringFromLeagueId, setTransferringFromLeagueId] = useState<string | null>(null);
  const [transferTargetLeagueId, setTransferTargetLeagueId] = useState<string>('');

  // Ligas disponíveis para vincular (as que o usuário ainda não é membro)
  const availableLeaguesToAdd = useMemo(() => {
    const currentLeagueIds = new Set(userMemberships.map((m) => m.league_id));
    return allLeagues.filter((lg) => !currentLeagueIds.has(lg.id));
  }, [allLeagues, userMemberships]);

  // Ligas disponíveis para transferir
  const availableLeaguesToTransfer = useMemo(() => {
    if (!transferringFromLeagueId) return [];
    return allLeagues.filter((lg) => lg.id !== transferringFromLeagueId);
  }, [allLeagues, transferringFromLeagueId]);

  if (!isOpen || !targetUser) return null;

  // 1. Ação: Adicionar Usuário a uma Liga com papel
  const handleAddLeague = async () => {
    if (!selectedNewLeagueId) {
      toast.info('Selecione uma liga para vincular.');
      return;
    }

    try {
      setIsProcessing(true);
      const { data, error } = await supabase.rpc('manage_user_league_membership', {
        p_user_id: targetUser.id,
        p_league_id: selectedNewLeagueId,
        p_role: selectedNewRole,
        p_action: 'add',
      });

      if (error) {
        toast.error('Erro ao vincular à liga: ' + error.message);
        return;
      }

      if (data && typeof data === 'object') {
        const res = data as { success: boolean; message?: string };
        if (res.success) {
          toast.success(res.message || 'Vínculo criado com sucesso!');
          setSelectedNewLeagueId('');
          onMembershipsUpdated();
        } else {
          toast.error(res.message || 'Falha ao vincular à liga.');
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado ao vincular à liga.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Ação: Alternar Papel (Administrador da Liga <-> Participante)
  const handleToggleRole = async (membership: UserLeagueMembership) => {
    const nextRole: 'admin' | 'player' = membership.role === 'admin' || membership.role === 'owner' ? 'player' : 'admin';
    const roleText = nextRole === 'admin' ? 'Administrador da Liga' : 'Participante';

    try {
      setIsProcessing(true);
      const { data, error } = await supabase.rpc('manage_user_league_membership', {
        p_user_id: targetUser.id,
        p_league_id: membership.league_id,
        p_role: nextRole,
        p_action: 'update_role',
      });

      if (error) {
        toast.error('Erro ao atualizar papel: ' + error.message);
        return;
      }

      if (data && typeof data === 'object') {
        const res = data as { success: boolean; message?: string };
        if (res.success) {
          toast.success(res.message || `Papel alterado para ${roleText}!`);
          onMembershipsUpdated();
        } else {
          toast.error(res.message || 'Falha ao alterar papel.');
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado ao alterar papel.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Ação: Transferir Participante de uma Liga para Outra
  const handleExecuteTransfer = async () => {
    if (!transferringFromLeagueId || !transferTargetLeagueId) {
      toast.info('Selecione a liga de destino para realizar a transferência.');
      return;
    }

    const currentMem = userMemberships.find((m) => m.league_id === transferringFromLeagueId);
    const roleToKeep = (currentMem?.role === 'admin' || currentMem?.role === 'owner') ? 'admin' : 'player';

    try {
      setIsProcessing(true);
      const { data, error } = await supabase.rpc('manage_user_league_membership', {
        p_user_id: targetUser.id,
        p_league_id: transferringFromLeagueId,
        p_role: roleToKeep,
        p_action: 'transfer',
        p_new_league_id: transferTargetLeagueId,
      });

      if (error) {
        toast.error('Erro ao transferir participante: ' + error.message);
        return;
      }

      if (data && typeof data === 'object') {
        const res = data as { success: boolean; message?: string };
        if (res.success) {
          toast.success(res.message || 'Participante transferido com sucesso!');
          setTransferringFromLeagueId(null);
          setTransferTargetLeagueId('');
          onMembershipsUpdated();
        } else {
          toast.error(res.message || 'Falha na transferência.');
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado ao transferir participante.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Ação: Remover Vínculo da Liga
  const handleRemoveMembership = async (membership: UserLeagueMembership) => {
    toast(`Desvincular ${targetUser.nome} da liga "${membership.league_name}"?`, {
      description: 'O usuário não constará mais como membro desta liga.',
      action: {
        label: '🗑️ Desvincular',
        onClick: async () => {
          try {
            setIsProcessing(true);
            const { data, error } = await supabase.rpc('manage_user_league_membership', {
              p_user_id: targetUser.id,
              p_league_id: membership.league_id,
              p_role: 'player',
              p_action: 'remove',
            });

            if (error) {
              toast.error('Erro ao remover vínculo: ' + error.message);
              return;
            }

            if (data && typeof data === 'object') {
              const res = data as { success: boolean; message?: string };
              if (res.success) {
                toast.success(res.message || 'Vínculo removido com sucesso!');
                onMembershipsUpdated();
              } else {
                toast.error(res.message || 'Falha ao remover vínculo.');
              }
            }
          } catch (e) {
            console.error(e);
            toast.error('Erro ao remover da liga.');
          } finally {
            setIsProcessing(false);
          }
        },
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
      duration: 8000,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[92vh] space-y-4"
        >
          {/* Botão Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Cabeçalho */}
          <div className="flex items-center gap-3 pr-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Super Admin
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Central de Vínculos
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight mt-0.5">
                Gerenciar Ligas e Funções do Usuário
              </h2>
            </div>
          </div>

          {/* Perfil do Usuário Alvo */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950 border border-brand-300 dark:border-brand-800 flex items-center justify-center font-black text-brand-600 dark:text-brand-400 shrink-0 overflow-hidden text-xs">
              {targetUser.avatar_url ? (
                <img src={targetUser.avatar_url} alt={targetUser.nome} className="w-full h-full object-cover" />
              ) : (
                targetUser.nome.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                {targetUser.nome} {targetUser.apelido && `(${targetUser.apelido})`}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                📱 {formatPhoneDisplay(targetUser.whatsapp)}
              </p>
            </div>
          </div>

          {/* Seção 1: Ligas Vinculadas Atualmente */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Ligas Vinculadas ({userMemberships.length})</span>
              </span>
            </div>

            {userMemberships.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center">
                <p className="text-xs text-slate-400 font-medium">
                  Este usuário ainda não está vinculado a nenhuma liga.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {userMemberships.map((membership) => {
                  const isAdminRole = membership.role === 'admin' || membership.role === 'owner';

                  return (
                    <div
                      key={membership.league_id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">⚽</span>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {membership.league_name}
                            </h4>
                          </div>
                        </div>

                        {/* Badge de Função na Liga */}
                        <div className="shrink-0">
                          {isAdminRole ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Admin da Liga</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>Participante</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Linha de Ações de Gestão de Vínculo */}
                      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap">
                        {/* Alternar Função */}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleToggleRole(membership)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            isAdminRole
                              ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-xs'
                          }`}
                          title={isAdminRole ? 'Rebaixar para Participante desta Liga' : 'Promover a Administrador desta Liga'}
                        >
                          {isAdminRole ? (
                            <>
                              <User className="w-3 h-3" />
                              <span>Tornar Participante</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              <span>Tornar Administrador</span>
                            </>
                          )}
                        </button>

                        {/* Botão de Transferir */}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            if (transferringFromLeagueId === membership.league_id) {
                              setTransferringFromLeagueId(null);
                            } else {
                              setTransferringFromLeagueId(membership.league_id);
                              setTransferTargetLeagueId('');
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                          title="Transferir jogador para outra liga"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-emerald-500" />
                          <span>Transferir</span>
                        </button>

                        {/* Botão Desvincular */}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRemoveMembership(membership)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                          title="Desvincular participante desta liga"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Painel Expansível de Transferência */}
                      {transferringFromLeagueId === membership.league_id && (
                        <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500/30 space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            Mover de <strong>{membership.league_name}</strong> para:
                          </span>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={transferTargetLeagueId}
                              onChange={(e) => setTransferTargetLeagueId(e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                            >
                              <option value="">Selecione a Liga de Destino...</option>
                              {availableLeaguesToTransfer.map((lg) => (
                                <option key={lg.id} value={lg.id}>
                                  ⚽ {lg.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={isProcessing || !transferTargetLeagueId}
                              onClick={handleExecuteTransfer}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirmar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção 2: Adicionar a uma Nova Liga */}
          {availableLeaguesToAdd.length > 0 && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Vincular a uma Nova Liga</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">Liga:</label>
                  <select
                    value={selectedNewLeagueId}
                    onChange={(e) => setSelectedNewLeagueId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="">Selecione uma liga...</option>
                    {availableLeaguesToAdd.map((lg) => (
                      <option key={lg.id} value={lg.id}>
                        ⚽ {lg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">Função nesta Liga:</label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="player">⚽ Participante / Jogador</option>
                    <option value="admin">🛡️ Administrador da Liga</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={isProcessing || !selectedNewLeagueId}
                onClick={handleAddLeague}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Adicionar Vínculo com a Liga</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Botão Fechar no rodapé */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
            >
              Fechar Gerenciador
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
