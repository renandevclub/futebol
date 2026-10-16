'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Profile, Match, Post, Badge, League, OrganizationMember } from '@/types/database';
import { useLeague } from '@/context/LeagueContext';
import { CreateLeagueModal } from '@/components/CreateLeagueModal';
import { EditLeagueModal } from '@/components/EditLeagueModal';
import { PlayerRatingModal } from '@/components/PlayerRatingModal';
import { getPlayerRating, getRatingTier } from '@/lib/playerRatingHelper';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import {
  X,
  ShieldAlert,
  Users,
  Calendar,
  MessageSquare,
  Trash2,
  Search,
  Award,
  Star,
  Trophy,
  Medal,
  Plus,
  Edit3,
  Crown,
  PlusCircle,
  Filter,
  ShieldCheck,
  UserCheck,
  Radio,
  Sliders,
  UserMinus,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscribeToTables } from '@/lib/realtime';
import { EditMatchModal } from '@/components/EditMatchModal';
import { notifyMatchCancelled } from '@/lib/notificationDispatcher';

export interface LeagueParticipantDisplay {
  id: string; // member id
  user_id: string;
  organization_id: string;
  league_name: string;
  role: string;
  nivel_qualidade?: number | null;
  user: Profile;
}

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ isOpen, onClose }) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { leagues, myLeagues, refreshLeagues, deleteLeague, canManageLeague, canManageMatch } = useLeague();

  const [tab, setTab] = useState<'leagues' | 'matches' | 'participants' | 'posts'>('leagues');

  const [matches, setMatches] = useState<Match[]>([]);
  const [leagueParticipants, setLeagueParticipants] = useState<LeagueParticipantDisplay[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchLeagueFilter, setMatchLeagueFilter] = useState<string>('all');
  const [participantLeagueFilter, setParticipantLeagueFilter] = useState<string>('all');

  // Modais de Liga
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isEditLeagueOpen, setIsEditLeagueOpen] = useState(false);
  const [leagueToEdit, setLeagueToEdit] = useState<League | null>(null);

  // Modal de Avaliação de Qualidade
  const [ratingTargetUser, setRatingTargetUser] = useState<Profile | null>(null);
  const [ratingTargetLeagueId, setRatingTargetLeagueId] = useState<string | null>(null);
  const [ratingTargetLeagueName, setRatingTargetLeagueName] = useState<string | null>(null);
  const [ratingTargetInitial, setRatingTargetInitial] = useState<number | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  // Atribuição de Badges
  const [selectedUserForBadge, setSelectedUserForBadge] = useState<Profile | null>(null);
  const [selectedBadgeCode, setSelectedBadgeCode] = useState<string>('mvp');

  // Edição de Partidas
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const visibleLeagues = useMemo(() => {
    return isSuperAdmin ? leagues : myLeagues;
  }, [isSuperAdmin, leagues, myLeagues]);

  const loadAdminData = async (showLoader = false) => {
    if (!isAdmin || !user) return;
    if (showLoader) setLoading(true);
    try {
      if (isSuperAdmin) {
        // SUPER ADMIN: Acesso irrestrito a todos os dados do sistema
        const [{ data: mData }, { data: membersData }, { data: poData }, { data: bData }] = await Promise.all([
          supabase.from('matches').select('*').order('data', { ascending: false }),
          supabase.from('organization_members').select('*, user:user_id(*), organization:organization_id(*)'),
          supabase.from('posts').select('*, author:author_id(*)').order('created_at', { ascending: false }),
          supabase.from('badges').select('*').order('name'),
        ]);

        setMatches(mData || []);
        setPosts(poData || []);
        setBadges(bData || []);

        const formattedMembers: LeagueParticipantDisplay[] = (membersData || [])
          .filter((m: any) => m.user)
          .map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            organization_id: m.organization_id,
            league_name: m.organization?.name || 'Liga',
            role: m.role,
            nivel_qualidade: m.nivel_qualidade ?? m.user?.nivel_qualidade,
            user: m.user,
          }));

        setLeagueParticipants(formattedMembers);
      } else {
        // ADMINISTRADOR DA LIGA: Apenas dados sob sua administração
        const myLeagueIds = myLeagues.map((l) => l.id);

        if (myLeagueIds.length === 0) {
          setMatches([]);
          setPosts([]);
          setLeagueParticipants([]);
          setBadges([]);
          return;
        }

        // 1. Partidas das ligas deste administrador
        const { data: mData } = await supabase
          .from('matches')
          .select('*')
          .in('organization_id', myLeagueIds)
          .order('data', { ascending: false });

        // 2. Posts criados pelo administrador
        const { data: poData } = await supabase
          .from('posts')
          .select('*, author:author_id(*)')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false });

        // 3. Badges disponíveis
        const { data: bData } = await supabase.from('badges').select('*').order('name');

        // 4. Membros participantes vinculados exclusivamente às ligas deste administrador
        const { data: membersData } = await supabase
          .from('organization_members')
          .select('*, user:user_id(*), organization:organization_id(*)')
          .in('organization_id', myLeagueIds);

        const formattedMembers: LeagueParticipantDisplay[] = (membersData || [])
          .filter((m: any) => m.user)
          .map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            organization_id: m.organization_id,
            league_name: m.organization?.name || 'Liga',
            role: m.role,
            nivel_qualidade: m.nivel_qualidade ?? m.user?.nivel_qualidade,
            user: m.user,
          }));

        setMatches(mData || []);
        setPosts(poData || []);
        setBadges(bData || []);
        setLeagueParticipants(formattedMembers);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do painel:', e);
      toast.error('Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAdmin) {
      void loadAdminData(true);

      return subscribeToTables(
        'admin_panel_realtime',
        [
          { table: 'matches' },
          { table: 'profiles' },
          { table: 'posts' },
          { table: 'user_badges' },
          { table: 'timeline_events' },
          { table: 'organizations' },
          { table: 'organization_members' },
        ],
        () => loadAdminData(),
      );
    }

    return undefined;
  }, [isOpen, isAdmin, myLeagues.length, isSuperAdmin]);

  const handleDeleteMatch = async (matchId: string) => {
    toast('Deseja excluir permanentemente esta partida?', {
      description: 'Todos os participantes, jogos e dados vinculados serão removidos.',
      action: {
        label: '🗑️ Excluir',
        onClick: async () => {
          // Buscar participantes e dados da partida antes de excluir para notificar
          const matchObj = matches.find((m) => m.id === matchId);
          const { data: parts } = await supabase
            .from('match_participants')
            .select('user_id')
            .eq('match_id', matchId);

          const { error } = await supabase.rpc('delete_match', { target_match_id: matchId });
          if (error) {
            console.error('Erro ao excluir partida:', error);
            toast.error('Erro ao excluir partida: ' + error.message);
          } else {
            toast.success('Partida excluída com sucesso.');
            setMatches((prev) => prev.filter((m) => m.id !== matchId));

            if (matchObj && parts && parts.length > 0) {
              const participantIds = parts.map((p) => p.user_id).filter(Boolean);
              void notifyMatchCancelled(matchObj, participantIds, `A partida "${matchObj.titulo}" foi cancelada e removida pelo organizador.`);
            }
          }
        },
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const handleToggleMatchStatus = async (match: Match) => {
    const nextStatus = match.status === 'agendada' ? 'cancelada' : 'agendada';
    const { error } = await supabase
      .from('matches')
      .update({ status: nextStatus })
      .eq('id', match.id);

    if (error) {
      toast.error('Erro ao atualizar status: ' + error.message);
    } else {
      toast.success(`Status da partida alterado para ${nextStatus}.`);
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, status: nextStatus } : m))
      );

      // Notificar participantes se o status mudou para cancelada
      if (nextStatus === 'cancelada') {
        void (async () => {
          const { data: parts } = await supabase
            .from('match_participants')
            .select('user_id')
            .eq('match_id', match.id);

          if (parts && parts.length > 0) {
            const participantIds = parts.map((p) => p.user_id).filter(Boolean);
            void notifyMatchCancelled(match, participantIds, `A partida "${match.titulo}" foi cancelada pelo organizador.`);
          }
        })();
      }
    }
  };

  const handleRemoveMemberFromLeague = async (member: LeagueParticipantDisplay) => {
    toast(`Remover ${member.user.nome} da liga "${member.league_name}"?`, {
      description: 'O usuário não constará mais como participante desta liga.',
      action: {
        label: '🗑️ Remover da Liga',
        onClick: async () => {
          const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('id', member.id);

          if (error) {
            toast.error('Erro ao remover participante da liga: ' + error.message);
          } else {
            toast.success(`${member.user.nome} removido da liga com sucesso.`);
            setLeagueParticipants((prev) => prev.filter((p) => p.id !== member.id));
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

  const handleDeletePost = async (postId: string) => {
    toast('Excluir esta postagem do feed?', {
      description: 'A postagem será removida permanentemente.',
      action: {
        label: '🗑️ Excluir',
        onClick: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', postId);
          if (error) {
            toast.error('Erro ao excluir post: ' + error.message);
          } else {
            toast.success('Postagem excluída.');
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          }
        },
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const handleAssignBadge = async () => {
    if (!selectedUserForBadge) return;
    const badge = badges.find((b) => b.code === selectedBadgeCode);
    if (!badge) return;

    try {
      const { error: bErr } = await supabase.from('user_badges').insert({
        user_id: selectedUserForBadge.id,
        badge_id: badge.id,
      });

      if (bErr && bErr.code !== '23505') {
        throw bErr;
      }

      const eventType = badge.code === 'mvp' ? 'became_mvp' : badge.code === 'campeao' ? 'became_champion' : 'earned_badge';
      await supabase.from('timeline_events').insert({
        user_id: selectedUserForBadge.id,
        event_type: eventType,
        title: `Recebeu a conquista "${badge.name}"`,
        description: badge.description,
        metadata: { badge_code: badge.code },
      });

      toast.success(`Conquista "${badge.name}" atribuída a ${selectedUserForBadge.nome}!`);
      setSelectedUserForBadge(null);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atribuir conquista.');
    }
  };

  // Abrir Modal de Avaliação para o participante na liga específica
  const handleOpenRating = (member: LeagueParticipantDisplay) => {
    setRatingTargetUser(member.user);
    setRatingTargetLeagueId(member.organization_id);
    setRatingTargetLeagueName(member.league_name);
    setRatingTargetInitial(member.nivel_qualidade || getPlayerRating(member.user));
    setIsRatingModalOpen(true);
  };

  const handleRatingUpdatedCallback = (userId: string, newRating: number, targetLeagueId?: string | null) => {
    setLeagueParticipants((prev) =>
      prev.map((item) => {
        if (item.user_id === userId && (!targetLeagueId || item.organization_id === targetLeagueId)) {
          return {
            ...item,
            nivel_qualidade: newRating,
            user: { ...item.user, nivel_qualidade: newRating },
          };
        }
        return item;
      })
    );
  };

  const filteredParticipants = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return leagueParticipants.filter((p) => {
      if (participantLeagueFilter !== 'all' && p.organization_id !== participantLeagueFilter) {
        return false;
      }
      const matchName = p.user.nome?.toLowerCase().includes(q);
      const matchNick = p.user.apelido?.toLowerCase().includes(q);
      const matchPhone = p.user.whatsapp?.includes(q.replace(/\D/g, ''));
      return matchName || matchNick || matchPhone;
    });
  }, [leagueParticipants, participantLeagueFilter, searchQuery]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (matchLeagueFilter !== 'all') {
        return m.organization_id === matchLeagueFilter;
      }
      return true;
    });
  }, [matches, matchLeagueFilter]);

  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl p-4 sm:p-6 shadow-2xl relative max-h-[92vh] sm:max-h-[88vh] flex flex-col space-y-3 sm:space-y-4">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho com identificação do nível de acesso */}
        <div className="flex items-start sm:items-center gap-3 pr-8">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 ${
            isSuperAdmin ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/25' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25'
          }`}>
            {isSuperAdmin ? <Crown className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                {isSuperAdmin ? 'Painel Super Administrador' : 'Painel de Controle Administrador'}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                isSuperAdmin
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              }`}>
                {isSuperAdmin ? 'Acesso Global' : 'Minhas Ligas'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
              {isSuperAdmin
                ? 'Gestão global de todas as ligas, partidas, participantes e avaliações'
                : 'Gerenciamento dos participantes, partidas e avaliações da sua liga'}
            </p>
          </div>
        </div>

        {/* Modal de Concessão de Badges */}
        {selectedUserForBadge && (
          <div className="p-3.5 sm:p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 truncate">
                Atribuir Badge para <strong>{selectedUserForBadge.nome}</strong>
              </span>
              <button onClick={() => setSelectedUserForBadge(null)} className="text-amber-500 hover:text-amber-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedBadgeCode}
                onChange={(e) => setSelectedBadgeCode(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none"
              >
                {badges.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.name} - {b.description}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignBadge}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Conceder
              </button>
            </div>
          </div>
        )}

        {/* Banner de Atalho para o Sistema Financeiro Completo */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-3 text-white flex items-center justify-between gap-2 shadow-md shadow-emerald-600/20">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">💰</span>
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-wider block text-emerald-100">
                Novo Sistema Financeiro & Caixinha
              </span>
              <p className="text-[11px] text-emerald-100/90 font-medium truncate">
                Conferência de pagamentos, caixas individuais e Caixinha da Resenha
              </p>
            </div>
          </div>
          <Link
            href="/administracao/financeiro"
            onClick={onClose}
            className="px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl font-black text-xs shadow-sm transition-all whitespace-nowrap shrink-0"
          >
            Abrir Financeiro ➔
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-[11px] sm:text-xs font-bold gap-0.5">
          <button
            onClick={() => setTab('leagues')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              tab === 'leagues'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Ligas ({visibleLeagues.length})</span>
          </button>
          <button
            onClick={() => setTab('matches')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              tab === 'matches'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Partidas ({matches.length})</span>
          </button>
          <button
            onClick={() => setTab('participants')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              tab === 'participants'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Jogadores ({leagueParticipants.length})</span>
          </button>
          <button
            onClick={() => setTab('posts')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              tab === 'posts'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Feed ({posts.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs">
          {loading ? (
            <p className="text-center py-8 text-slate-400">Carregando painel...</p>
          ) : tab === 'leagues' ? (
            /* Ligas Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {isSuperAdmin ? 'Todas as Ligas do Sistema' : 'Minhas Ligas Criadas e Administradas'}
                </span>
                <button
                  onClick={() => setIsCreateLeagueOpen(true)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Nova Liga</span>
                </button>
              </div>

              {visibleLeagues.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 p-4">
                  <p className="text-slate-500 dark:text-slate-400 font-bold">
                    {isSuperAdmin
                      ? 'Nenhuma Liga cadastrada no sistema.'
                      : 'Você ainda não possui nenhuma Liga criada sob sua administração.'}
                  </p>
                  <button
                    onClick={() => setIsCreateLeagueOpen(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Criar Minha Primeira Liga</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleLeagues.map((league) => (
                    <div
                      key={league.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-base shadow-sm shrink-0 overflow-hidden">
                          {league.logo_url ? (
                            <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
                          ) : (
                            '⚽'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                              {league.name}
                            </h4>
                            {league.has_password && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                🔒 Com Senha
                              </span>
                            )}
                            {league.is_blocked && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                                🚫 Bloqueada
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate">
                            {league.description || 'Sem descrição cadastrada'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                        <Link
                          href={`/administracao/financeiro?leagueId=${league.id}`}
                          onClick={onClose}
                          className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold rounded-xl text-xs border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Abrir Gestão Financeira desta Liga"
                        >
                          <span>💰 Financeiro</span>
                        </Link>
                        <button
                          onClick={() => {
                            setLeagueToEdit(league);
                            setIsEditLeagueOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => deleteLeague(league.id)}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                          title="Excluir Liga"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'matches' ? (
            /* Partidas Tab */
            <div className="space-y-3">
              {/* Filtro por Liga */}
              {visibleLeagues.length > 1 && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-500">Filtrar:</span>
                  <select
                    value={matchLeagueFilter}
                    onChange={(e) => setMatchLeagueFilter(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold px-2 py-1 focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="all">Todas as Minhas Ligas</option>
                    {visibleLeagues.map((lg) => (
                      <option key={lg.id} value={lg.id}>
                        ⚽ {lg.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filteredMatches.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-slate-400 font-medium">
                    {isSuperAdmin
                      ? 'Nenhuma partida cadastrada nesta categoria.'
                      : 'Nenhuma partida encontrada nas suas ligas.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMatches.map((m) => {
                    const league = leagues.find((l) => l.id === m.organization_id);
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base leading-tight break-words">
                                {m.titulo}
                              </h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${
                              m.status === 'agendada'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : m.status === 'finalizada'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-500/20'
                            }`}>
                              {m.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                            {league && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                <span>⚽</span>
                                <span className="truncate max-w-[150px]">{league.name}</span>
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              📍 {m.local} • 📅 {m.data} às {m.horario ? m.horario.substring(0, 5) : '--:--'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex-wrap">
                          <Link
                            href={`/matches/${m.id}/control`}
                            onClick={onClose}
                            className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            title="Abrir Mesa de Controle da Partida ao Vivo"
                          >
                            <Radio className="w-3.5 h-3.5" />
                            <span>Mesa de Controle</span>
                          </Link>

                          <button
                            onClick={() => {
                              setEditingMatch(m);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500/30 transition-colors cursor-pointer"
                            title="Editar Partida"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleMatchStatus(m)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                              m.status === 'agendada'
                                ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                                : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {m.status === 'agendada' ? 'Cancelar' : 'Reativar'}
                          </button>

                          <button
                            onClick={() => handleDeleteMatch(m.id)}
                            className="p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-500/30 transition-colors cursor-pointer"
                            title="Excluir Partida"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : tab === 'participants' ? (
            /* Participantes da Liga Tab */
            <div className="space-y-3">
              {/* Barra de Busca e Filtro de Ligas */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar participante por nome ou WhatsApp..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                {/* Filtro por Liga */}
                {visibleLeagues.length > 1 && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Liga:</span>
                    <select
                      value={participantLeagueFilter}
                      onChange={(e) => setParticipantLeagueFilter(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold px-2 py-1 focus:outline-none text-slate-900 dark:text-white"
                    >
                      <option value="all">Todas as Minhas Ligas ({leagueParticipants.length} jogadores)</option>
                      {visibleLeagues.map((lg) => {
                        const countInLeague = leagueParticipants.filter((lp) => lp.organization_id === lg.id).length;
                        return (
                          <option key={lg.id} value={lg.id}>
                            ⚽ {lg.name} ({countInLeague} participantes)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Botão de Atalho para Gestão de Usuários (Super Admin) */}
              {isSuperAdmin && (
                <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      Gerenciamento Global de Usuários e Cargos
                    </span>
                  </div>
                  <Link
                    href="/administracao/usuarios"
                    onClick={onClose}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] rounded-xl shadow-sm transition-all"
                  >
                    Acessar
                  </Link>
                </div>
              )}

              {filteredParticipants.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-slate-400 font-medium">
                    {isSuperAdmin
                      ? 'Nenhum jogador encontrado com os filtros pesquisados.'
                      : 'Nenhum jogador cadastrado nesta liga ainda.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredParticipants.map((p) => {
                    const ratingValue = p.nivel_qualidade ?? getPlayerRating(p.user);
                    const tier = getRatingTier(ratingValue);

                    return (
                      <div
                        key={p.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 transition-all hover:border-amber-500/30"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950 border border-brand-300 dark:border-brand-800 flex items-center justify-center font-black text-brand-600 dark:text-brand-400 shrink-0 overflow-hidden text-xs">
                            {p.user.avatar_url ? (
                              <img src={p.user.avatar_url} alt={p.user.nome} className="w-full h-full object-cover" />
                            ) : (
                              p.user.nome.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                                {p.user.nome}
                              </span>
                              {p.user.apelido && (
                                <span className="text-slate-400 text-xs font-medium">({p.user.apelido})</span>
                              )}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                ⚽ {p.league_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                              <span>📱 {formatPhoneDisplay(p.user.whatsapp)}</span>
                              {p.user.posicao && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  • {p.user.posicao}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badge de Qualidade e Ações */}
                        <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60 flex-wrap">
                          {/* Badge Interativo com a Nota na Liga */}
                          <button
                            onClick={() => handleOpenRating(p)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="Alterar Avaliação de Qualidade (1 a 10) nesta Liga"
                          >
                            <span>{tier.emoji}</span>
                            <span>Nível {ratingValue}</span>
                            <span className="text-[10px] opacity-75 font-semibold">({tier.label})</span>
                            <Star className="w-3 h-3 fill-amber-500 ml-0.5" />
                          </button>

                          <button
                            onClick={() => setSelectedUserForBadge(p.user)}
                            className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                            title="Atribuir Conquista / MVP / Badge"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            <span>Premiar</span>
                          </button>

                          <button
                            onClick={() => handleRemoveMemberFromLeague(p)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                            title="Remover participante desta liga"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Posts Tab */
            posts.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-slate-400 font-medium">
                  {isSuperAdmin ? 'Nenhum post publicado no feed.' : 'Nenhuma postagem criada por você no feed.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs break-words">
                        {post.texto || '[Publicação com Mídia]'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                        <span>📅 {new Date(post.created_at).toLocaleDateString()}</span>
                        {isSuperAdmin && post.author?.nome && (
                          <span>• 👤 {post.author.nome}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer shrink-0"
                      title="Excluir Post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal de Avaliação de Qualidade */}
      <PlayerRatingModal
        isOpen={isRatingModalOpen}
        onClose={() => {
          setIsRatingModalOpen(false);
          setRatingTargetUser(null);
          setRatingTargetLeagueId(null);
          setRatingTargetLeagueName(null);
          setRatingTargetInitial(null);
        }}
        targetUser={ratingTargetUser}
        leagueId={ratingTargetLeagueId}
        leagueName={ratingTargetLeagueName}
        initialRating={ratingTargetInitial}
        onRatingUpdated={handleRatingUpdatedCallback}
      />

      <EditMatchModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingMatch(null);
        }}
        match={editingMatch}
        onMatchUpdated={() => void loadAdminData()}
      />

      <CreateLeagueModal
        isOpen={isCreateLeagueOpen}
        onClose={() => setIsCreateLeagueOpen(false)}
        onLeagueCreated={() => {
          setIsCreateLeagueOpen(false);
          void refreshLeagues();
        }}
      />

      <EditLeagueModal
        isOpen={isEditLeagueOpen}
        onClose={() => {
          setIsEditLeagueOpen(false);
          setLeagueToEdit(null);
        }}
        league={leagueToEdit}
      />
    </div>
  );
};
