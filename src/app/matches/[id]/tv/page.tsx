'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import { Match, MatchGame, MatchGameGoal, MatchParticipant, TeamStanding, PlayerScorer } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { subscribeToTables } from '@/lib/realtime';
import { getTeamInfo as getTeamInfoFromHelper } from '@/lib/teamsHelper';
import {
  Trophy,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  ArrowLeft,
  Flame,
  Clock,
  Swords,
  Award,
  Sparkles,
  Shield,
  Activity,
  Users,
  MessageCircle,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamBadge } from '@/components/TeamBadge';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';

export default function MatchTvBroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [allGames, setAllGames] = useState<MatchGame[]>([]);
  const [activeGame, setActiveGame] = useState<MatchGame | null>(null);
  const [currentGoals, setCurrentGoals] = useState<MatchGameGoal[]>([]);
  const [allGoals, setAllGoals] = useState<MatchGameGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modo Tela Cheia e Som
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<'standings' | 'scorers' | 'queue'>('standings');

  // Estado do Modal de Visualização Ampliada (Lightbox)
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  const openImagePreview = (previewData: Omit<LightboxPreviewData, 'isOpen'>) => {
    setLightboxData({ ...previewData, isOpen: true });
  };

  const closeImagePreview = () => {
    setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null));
  };

  // Cronômetro interpolado
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Alerta de Gol Especial
  const [latestGoalAlert, setLatestGoalAlert] = useState<{
    playerNome: string;
    teamName: string;
    teamColor: string;
    minute: number;
    teamEmoji: string;
  } | null>(null);

  const previousGoalCountRef = useRef<number>(0);

  // Buscar dados completos da partida
  const fetchTvData = async () => {
    try {
      // 1. Dados da partida
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single();

      if (matchData) setMatch(matchData);

      // 2. Participantes
      const { data: partsData } = await supabase
        .from('match_participants')
        .select(`
          *,
          user:user_id(*)
        `)
        .eq('match_id', id);

      if (partsData) setParticipants(partsData);

      // 3. Todos os Jogos
      const { data: gamesData } = await supabase
        .from('match_games')
        .select('*')
        .eq('match_id', id)
        .order('game_number', { ascending: false });

      setAllGames(gamesData || []);

      // Jogo ativo = o mais recente não finalizado ou o primeiro da lista
      const curGame = gamesData?.find((g) => g.status !== 'finished') || gamesData?.[0] || null;
      setActiveGame(curGame);

      // 4. Buscar todos os gols da partida
      const { data: allGoalsData } = await supabase
        .from('match_game_goals')
        .select(`
          *,
          player:player_id(*)
        `)
        .eq('match_id', id)
        .order('created_at', { ascending: true });

      setAllGoals(allGoalsData || []);

      // Gols do jogo ativo
      if (curGame) {
        const gameGoals = (allGoalsData || []).filter((g) => g.game_id === curGame.id);
        setCurrentGoals(gameGoals);

        // Detectar novo gol para animação de GOOOOL!
        if (
          previousGoalCountRef.current > 0 &&
          gameGoals.length > previousGoalCountRef.current
        ) {
          const newest = gameGoals[gameGoals.length - 1];
          const teamInfo = getTeamInfo(newest.team);
          setLatestGoalAlert({
            playerNome: newest.player?.nome || 'Jogador',
            teamName: teamInfo.name,
            teamColor: teamInfo.color,
            minute: newest.minute,
            teamEmoji: teamInfo.emoji,
          });

          // Tocar som sintético de celebração se habilitado
          if (soundEnabled) {
            playGoalCelebrationSound();
          }

          setTimeout(() => {
            setLatestGoalAlert(null);
          }, 4500);
        }
        previousGoalCountRef.current = gameGoals.length;
      }
    } catch (e) {
      console.error('Erro ao buscar dados do telão:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTvData();

    const unsubscribe = subscribeToTables(
      `tv_broadcast_${id}`,
      [
        { table: 'matches', filter: `id=eq.${id}` },
        { table: 'match_games', filter: `match_id=eq.${id}` },
        { table: 'match_game_goals', filter: `match_id=eq.${id}` },
        { table: 'match_participants', filter: `match_id=eq.${id}` },
      ],
      () => {
        void fetchTvData();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [id, soundEnabled]);

  // Cronômetro em tempo real
  useEffect(() => {
    if (!activeGame) {
      setCurrentSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const calculateCurrentTime = () => {
      if (activeGame.timer_is_running && activeGame.timer_started_at) {
        const elapsed = Math.floor(
          (Date.now() - new Date(activeGame.timer_started_at).getTime()) / 1000
        );
        return Math.max(0, activeGame.duration_seconds + elapsed);
      }
      return activeGame.duration_seconds;
    };

    setCurrentSeconds(calculateCurrentTime());

    if (activeGame.timer_is_running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCurrentSeconds(calculateCurrentTime());
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeGame?.timer_is_running, activeGame?.timer_started_at, activeGame?.duration_seconds]);

  // Alternância automática de abas no painel lateral a cada 12 segundos para TV
  useEffect(() => {
    const tabs: ('standings' | 'scorers' | 'queue')[] = ['standings', 'scorers', 'queue'];
    const interval = setInterval(() => {
      setActiveSideTab((prev) => {
        const nextIndex = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIndex];
      });
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // Formatação de Tempo MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTeamInfo = (teamNum: number) => {
    return getTeamInfoFromHelper(match, teamNum);
  };

  // Som sintético de apito / comemoração via Web Audio API (sem dependência externa)
  const playGoalCelebrationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.6);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.9);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } catch (e) {
      // Audio context policy
    }
  };

  // Toggle Tela Cheia Nativo
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => console.error(err));
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => console.error(err));
    }
  };

  const isVolei = match?.sport_type === 'volei';

  // ═══════════════════════════════════════════════════════════════════
  // CÁLCULO DA CLASSIFICAÇÃO AO VIVO
  // ═══════════════════════════════════════════════════════════════════
  const standings: TeamStanding[] = useMemo(() => {
    const numTeams = match?.num_times || 4;
    const statsMap: Record<number, TeamStanding> = {};

    for (let t = 1; t <= numTeams; t++) {
      const info = getTeamInfo(t);
      statsMap[t] = {
        team: t,
        teamName: info.name,
        teamColor: info.color,
        teamEmoji: info.emoji,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [],
      };
    }

    allGames
      .filter((g) => g.status === 'finished')
      .forEach((g) => {
        const teamA = statsMap[g.team_a];
        const teamB = statsMap[g.team_b];

        if (teamA) {
          teamA.matchesPlayed += 1;
          teamA.goalsFor += g.score_a;
          teamA.goalsAgainst += g.score_b;
          teamA.goalDifference = teamA.goalsFor - teamA.goalsAgainst;
        }

        if (teamB) {
          teamB.matchesPlayed += 1;
          teamB.goalsFor += g.score_b;
          teamB.goalsAgainst += g.score_a;
          teamB.goalDifference = teamB.goalsFor - teamB.goalsAgainst;
        }

        if (!isVolei && (g.is_draw || g.score_a === g.score_b)) {
          if (teamA) {
            teamA.draws += 1;
            teamA.points += 1;
            teamA.form.push('D');
          }
          if (teamB) {
            teamB.draws += 1;
            teamB.points += 1;
            teamB.form.push('D');
          }
        } else if (g.score_a > g.score_b) {
          if (teamA) {
            teamA.wins += 1;
            teamA.points += 3;
            teamA.form.push('W');
          }
          if (teamB) {
            teamB.losses += 1;
            teamB.form.push('L');
          }
        } else {
          if (teamB) {
            teamB.wins += 1;
            teamB.points += 3;
            teamB.form.push('W');
          }
          if (teamA) {
            teamA.losses += 1;
            teamA.form.push('L');
          }
        }
      });

    return Object.values(statsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  }, [allGames, match?.num_times, isVolei]);

  // ═══════════════════════════════════════════════════════════════════
  // ARTILHARIA GERAL DA RODADA
  // ═══════════════════════════════════════════════════════════════════
  const topScorers: PlayerScorer[] = useMemo(() => {
    const scorerMap: Record<string, { player: any; team: number; goalsCount: number }> = {};

    allGoals.forEach((g) => {
      if (!g.player_id || !g.player) return;
      if (!scorerMap[g.player_id]) {
        scorerMap[g.player_id] = {
          player: g.player,
          team: g.team,
          goalsCount: 0,
        };
      }
      scorerMap[g.player_id].goalsCount += 1;
    });

    return Object.entries(scorerMap)
      .map(([playerId, val]) => ({
        playerId,
        player: val.player,
        team: val.team,
        goalsCount: val.goalsCount,
      }))
      .sort((a, b) => b.goalsCount - a.goalsCount);
  }, [allGoals]);

  const teamAInfo = activeGame ? getTeamInfo(activeGame.team_a) : null;
  const teamBInfo = activeGame ? getTeamInfo(activeGame.team_b) : null;

  // Compartilhar Transmissão no WhatsApp
  const handleShareWhatsApp = () => {
    if (!match) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rls-sports.netlify.app';
    const broadcastUrl = `${origin}/matches/${id}/tv`;

    const dateFormatted = match.data
      ? (() => {
          const p = match.data.split('-');
          return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : match.data;
        })()
      : 'Hoje';

    const scoreInfo = activeGame
      ? `\n🔥 *JOGO #${activeGame.game_number}:* ${teamAInfo?.name || `Time ${activeGame.team_a}`} *${activeGame.score_a} × ${activeGame.score_b}* ${teamBInfo?.name || `Time ${activeGame.team_b}`}`
      : '';

    const sportEmoji = isVolei ? '🏐' : '⚽';
    const pointsLabel = isVolei ? 'os pontos' : 'os gols';
    const text = `🔴 *TRANSMISSÃO AO VIVO DO PLACAR* ${sportEmoji}\n\n🏆 *${match.titulo}*\n📍 *Local:* ${match.local}\n📅 *Data:* ${dateFormatted} às ${match.horario ? match.horario.substring(0, 5) : '--:--'}h${scoreInfo}\n\n📲 *Acompanhe ${pointsLabel} e o placar em tempo real:*\n${broadcastUrl}\n\n_Atualizações automáticas ao vivo sem precisar recarregar a página!_`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col justify-between overflow-x-hidden select-none font-sans relative">
      {/* Luzes de Fundo Estilo Estádio / Arena Esportiva */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.15),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_90%,rgba(59,130,246,0.1),transparent_60%)]" />

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER DA TRANSMISSÃO (TV HUD) — Responsivo & Moderno
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="relative z-10 px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Lado Esquerdo: Botão Voltar + Informações da Partida */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <Link
              href={`/matches/${id}`}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all shrink-0 border border-slate-700/60 shadow-xs"
              title="Voltar para a Partida"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden min-[480px]:inline">Voltar</span>
            </Link>

            <div className="h-5 w-px bg-slate-800 shrink-0 hidden min-[480px]:block" />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
                  AO VIVO
                </span>
                {match?.local && (
                  <>
                    <span className="text-slate-600 text-xs">•</span>
                    <span className="text-[11px] text-slate-400 font-bold truncate max-w-[140px] sm:max-w-[220px]">
                      {match.local}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-sm sm:text-base lg:text-lg font-black text-white leading-tight truncate">
                {match?.titulo || 'Partida'}
              </h1>
            </div>
          </div>

          {/* Lado Direito: Controles de TV e Compartilhar */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Compartilhar WhatsApp */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-black shadow-xs transition-all cursor-pointer"
              title="Compartilhar transmissão no WhatsApp"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Compartilhar</span>
            </motion.button>

            {/* Controle de Som */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
              title={soundEnabled ? 'Som ativado (Comemorações)' : 'Som desativado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </motion.button>

            {/* Tela Cheia */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
            </motion.button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          CORPO PRINCIPAL (PLACAR GIGANTE + PAINEL LATERAL DINÂMICO)
      ═══════════════════════════════════════════════════════════════════ */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full items-start lg:items-center">
        
        {/* LADO ESQUERDO / CENTRAL: PLACAR AO VIVO GIGANTE (8 Colunas no desktop) */}
        <div className="lg:col-span-8 flex flex-col justify-center space-y-4 sm:space-y-6">
          {activeGame ? (
            <div className="relative bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800/90 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
              {/* Badge do Confronto */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <Swords className="w-3.5 h-3.5" />
                    Jogo #{activeGame.game_number}
                  </span>
                  {isVolei ? (
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      12 Pts para Vencer 🏐
                    </span>
                  ) : activeGame.two_goals_rule ? (
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      Regra de 2 Gols
                    </span>
                  ) : null}
                </div>

                {/* Status do Cronômetro */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`h-2.5 w-2.5 rounded-full ${activeGame.timer_is_running ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-xs font-bold text-slate-300 uppercase">
                    {activeGame.status === 'finished'
                      ? 'Encerrado'
                      : activeGame.timer_is_running
                      ? 'Em Andamento'
                      : 'Pausado'}
                  </span>
                </div>
              </div>

              {/* CONFRONTO PRINCIPAL GIGANTE */}
              <div className="grid grid-cols-11 items-center gap-2 sm:gap-4 my-2 sm:my-4">
                {/* TIME A */}
                <div className="col-span-4 flex flex-col items-center text-center space-y-2.5 sm:space-y-3">
                  <TeamBadge
                    teamInfo={teamAInfo}
                    size="xl"
                    rounded="3xl"
                    className="shadow-2xl shadow-brand-500/20 border-2 border-white/20"
                    onClick={(e) => {
                      if (teamAInfo?.badge_url) {
                        e.stopPropagation();
                        openImagePreview({
                          imageUrl: teamAInfo.badge_url,
                          title: teamAInfo.name,
                          subtitle: 'Emblema Oficial • Modo Telão',
                          type: 'team_badge',
                          badge: 'Transmissão Ao Vivo',
                        });
                      }
                    }}
                  />
                  <div>
                    <h2 className="text-base sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                      {teamAInfo?.name || `Time ${activeGame.team_a}`}
                    </h2>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase mt-0.5 block">
                      Mandante
                    </span>
                  </div>
                </div>

                {/* PLACAR NUMÉRICO & CRONÔMETRO CENTRAL */}
                <div className="col-span-3 flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-2 sm:gap-4 bg-slate-950/90 px-3.5 py-2 sm:px-6 sm:py-3 rounded-2xl border border-slate-800 shadow-inner">
                    <motion.span
                      key={`score-a-${activeGame.score_a}`}
                      initial={{ scale: 1.4, color: '#10b981' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      transition={{ duration: 0.4 }}
                      className="text-3xl sm:text-6xl lg:text-7xl font-black font-mono tracking-tighter"
                    >
                      {activeGame.score_a}
                    </motion.span>
                    <span className="text-xl sm:text-4xl font-bold text-slate-600">x</span>
                    <motion.span
                      key={`score-b-${activeGame.score_b}`}
                      initial={{ scale: 1.4, color: '#10b981' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      transition={{ duration: 0.4 }}
                      className="text-3xl sm:text-6xl lg:text-7xl font-black font-mono tracking-tighter"
                    >
                      {activeGame.score_b}
                    </motion.span>
                  </div>

                  {/* CRONÔMETRO GIGANTE (APENAS FUTEBOL) / META DE PONTOS (VÔLEI) */}
                  <div className="mt-3 sm:mt-4 flex flex-col items-center">
                    {!isVolei ? (
                      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-slate-800/90 border border-slate-700/80 shadow-md">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-base sm:text-2xl font-black font-mono tracking-wider text-emerald-400">
                          {formatTime(currentSeconds)}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold">
                          / {activeGame.target_duration_minutes}m
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 shadow-md">
                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-black tracking-wider text-amber-300">
                          Meta: {activeGame.target_duration_minutes || 12} Pontos 🏐
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* TIME B */}
                <div className="col-span-4 flex flex-col items-center text-center space-y-2.5 sm:space-y-3">
                  <TeamBadge
                    teamInfo={teamBInfo}
                    size="xl"
                    rounded="3xl"
                    className="shadow-2xl shadow-blue-500/20 border-2 border-white/20"
                    onClick={(e) => {
                      if (teamBInfo?.badge_url) {
                        e.stopPropagation();
                        openImagePreview({
                          imageUrl: teamBInfo.badge_url,
                          title: teamBInfo.name,
                          subtitle: 'Emblema Oficial • Modo Telão',
                          type: 'team_badge',
                          badge: 'Transmissão Ao Vivo',
                        });
                      }
                    }}
                  />
                  <div>
                    <h2 className="text-base sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                      {teamBInfo?.name || `Time ${activeGame.team_b}`}
                    </h2>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase mt-0.5 block">
                      Visitante
                    </span>
                  </div>
                </div>
              </div>

              {/* TIMELINE DE GOLS/PONTOS DO JOGO ATUAL */}
              <div className="mt-6 sm:mt-8 border-t border-slate-800/80 pt-3 sm:pt-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    {isVolei ? 'Pontos do Jogo 🏐' : 'Gols do Jogo ⚽'}
                  </span>
                  <span>{currentGoals.length} {isVolei ? 'pontos marcados' : 'gols marcados'}</span>
                </div>

                {currentGoals.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    {isVolei
                      ? 'Nenhum ponto registrado até o momento. Disputa equilibrada! 🏐'
                      : 'Nenhum gol marcado até o momento. Jogo disputado! ⚽'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {currentGoals.map((g, idx) => {
                      const tInfo = getTeamInfo(g.team);
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs shadow-sm"
                        >
                          <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />
                          <strong className="text-white font-bold">{g.player?.nome || 'Ponto Geral'}</strong>
                          <span className="text-[10px] text-emerald-400 font-extrabold">{g.minute}&apos;</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-bold">
                            {tInfo.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CARD DE ESPERA (QUANDO NÃO HÁ JOGO ATIVO) — Elegante & Informativo */
            <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800/90 rounded-3xl p-6 sm:p-10 text-center space-y-4 shadow-2xl backdrop-blur-xl">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto text-amber-400 shadow-md shadow-amber-500/10">
                <Trophy className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Nenhum confronto ativo no momento
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
                  Aguardando a organização iniciar a próxima partida na mesa de controle da quadra.
                </p>
              </div>

              {/* Estatísticas Rápidas da Partida */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto pt-2 text-left">
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
                    Total de Jogos
                  </span>
                  <span className="font-black text-base sm:text-lg text-white">
                    {allGames.length} {allGames.length === 1 ? 'partida' : 'partidas'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
                    {isVolei ? 'Pontos Totais' : 'Gols Totais'}
                  </span>
                  <span className="font-black text-base sm:text-lg text-emerald-400">
                    {allGoals.length} {isVolei ? '🏐' : '⚽'}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
                    Times
                  </span>
                  <span className="font-black text-base sm:text-lg text-purple-400">
                    {match?.num_times || 2} equipes
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LADO DIREITO: PAINEL LATERAL DINÂMICO (4 Colunas no desktop) */}
        <div className="lg:col-span-4 flex flex-col space-y-3.5 h-full">
          {/* Alternador de Abas do Painel */}
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-black shadow-inner">
            <button
              onClick={() => setActiveSideTab('standings')}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSideTab === 'standings'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setActiveSideTab('scorers')}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSideTab === 'scorers'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>{isVolei ? 'Pontos' : 'Artilharia'}</span>
            </button>
            <button
              onClick={() => setActiveSideTab('queue')}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSideTab === 'queue'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Jogos</span>
            </button>
          </div>

          {/* CONTEÚDO DA ABA LATERAL */}
          <div className="flex-1 bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-md overflow-hidden">
            {/* ABA 1: TABELA DE CLASSIFICAÇÃO */}
            {activeSideTab === 'standings' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    {isVolei ? 'Classificação do Vôlei 🏐' : 'Classificação Geral ⚽'}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold">{isVolei ? 'P | V | SP' : 'P | V | SG'}</span>
                </div>

                <div className="space-y-2">
                  {standings.map((st, idx) => (
                    <div
                      key={st.team}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                        idx === 0
                          ? 'bg-amber-500/10 border-amber-500/30 shadow-xs'
                          : 'bg-slate-800/40 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 text-xs font-black text-center ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {idx + 1}º
                        </span>
                        <TeamBadge
                          teamInfo={getTeamInfo(st.team)}
                          size="2xs"
                          rounded="md"
                          showBorder={false}
                        />
                        <span className="text-xs font-extrabold text-white truncate">
                          {st.teamName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                        <span className="font-black text-emerald-400 w-5 text-right">{st.points}</span>
                        <span className="text-slate-400 w-4 text-right">{st.wins}</span>
                        <span className={`w-6 text-right font-bold ${st.goalDifference > 0 ? 'text-emerald-400' : st.goalDifference < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 2: ARTILHARIA / MAIORES PONTUADORES */}
            {activeSideTab === 'scorers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    {isVolei ? 'Maiores Pontuadores 🏐' : 'Top Artilheiros ⚽'}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold">{isVolei ? 'Pontos' : 'Gols'}</span>
                </div>

                {topScorers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">
                    {isVolei ? 'Ainda não foram registrados pontos na rodada.' : 'Ainda não saíram gols na rodada.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {topScorers.slice(0, 5).map((sc, idx) => {
                      const tInfo = getTeamInfo(sc.team);
                      return (
                        <div
                          key={sc.playerId}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/40 border border-slate-800"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-4 text-xs font-black text-amber-400">{idx + 1}º</span>
                            <div className="h-7 w-7 rounded-full bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white">
                              {sc.player?.avatar_url ? (
                                <img src={sc.player.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                sc.player?.nome?.charAt(0).toUpperCase() || 'U'
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">
                                {sc.player?.nome}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />
                                <span className="text-[10px] text-slate-400 truncate">
                                  {tInfo.name}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg shrink-0">
                            {sc.goalsCount} {isVolei ? '🏐' : '⚽'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: HISTÓRICO DE JOGOS */}
            {activeSideTab === 'queue' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    Histórico de Jogos
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold">{allGames.length} jogos</span>
                </div>

                <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar">
                  {allGames.map((g) => {
                    const tA = getTeamInfo(g.team_a);
                    const tB = getTeamInfo(g.team_b);
                    return (
                      <div
                        key={g.id}
                        className="p-2.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="font-extrabold text-slate-400">#{g.game_number}</span>
                        <div className="flex items-center gap-1.5 font-bold truncate">
                          <div className="flex items-center gap-1">
                            <TeamBadge teamInfo={tA} size="2xs" rounded="md" showBorder={false} />
                            <span className="truncate">{tA.name}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-slate-900 font-mono text-white font-black shrink-0">
                            {g.score_a} - {g.score_b}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="truncate">{tB.name}</span>
                            <TeamBadge teamInfo={tB} size="2xs" rounded="md" showBorder={false} />
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${g.status === 'finished' ? 'text-slate-500' : 'text-emerald-400 bg-emerald-500/10'}`}>
                          {g.status === 'finished' ? 'Fim' : 'Ao vivo'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER COM TICKER DE TRANSMISSÃO
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-950/95 border-t border-slate-900 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-extrabold text-slate-300">F&V Sports</span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span>Placar sincronizado em tempo real</span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium text-center sm:text-right">
          Dica: Pressione <strong className="text-slate-300 font-bold">F11</strong> para Tela Cheia no televisor
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════
          POPUP DE PONTO / GOOOOOOL! ANIMADO
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {latestGoalAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4"
          >
            <div className={`p-1 rounded-3xl max-w-lg w-full animate-bounce ${
              isVolei
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500 shadow-[0_0_80px_rgba(245,158,11,0.8)]'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 shadow-[0_0_80px_rgba(16,185,129,0.8)]'
            }`}>
              <div className="bg-slate-950/95 p-8 rounded-[22px] text-center space-y-3">
                <span className="text-5xl">{isVolei ? '🏐🔥' : '⚽🔥'}</span>
                <h2 className={`text-4xl sm:text-5xl font-black text-transparent bg-clip-text uppercase tracking-wider ${
                  isVolei
                    ? 'bg-gradient-to-r from-amber-400 via-orange-300 to-white'
                    : 'bg-gradient-to-r from-emerald-400 via-amber-300 to-white'
                }`}>
                  {isVolei ? 'PONTOOO!' : 'GOOOOOOL!'}
                </h2>
                <p className="text-xl font-black text-white">
                  {latestGoalAlert.playerNome}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-sm font-bold text-slate-300">
                  <TeamBadge
                    teamInfo={{
                      name: latestGoalAlert.teamName,
                      emoji: latestGoalAlert.teamEmoji,
                    }}
                    size="2xs"
                    rounded="md"
                    showBorder={false}
                  />
                  <span>{latestGoalAlert.teamName}</span>
                  <span className="text-emerald-400 font-extrabold">• {latestGoalAlert.minute}&apos;</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox para Visualização Ampliada de Imagens */}
      <ImageLightboxModal
        data={lightboxData}
        onClose={closeImagePreview}
      />
    </div>
  );
}
