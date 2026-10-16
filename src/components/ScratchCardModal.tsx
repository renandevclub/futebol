'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Sparkles, Trophy, RotateCcw, PartyPopper, AlertCircle } from 'lucide-react';

import { Match, MatchParticipant } from '@/types/database';
import { getTeamInfo } from '@/lib/teamsHelper';
import { getPlayerRating } from '@/lib/playerRatingHelper';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TeamBadge } from '@/components/TeamBadge';

interface ScratchCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participants: MatchParticipant[];
  currentParticipant?: MatchParticipant | null;
  onSelectTeam: (teamNumber: number) => Promise<void>;
}

export const TEAM_COLORS = [
  { name: 'Time A', color: 'bg-red-500', border: 'border-red-400', lightBg: 'bg-red-500/10', text: 'text-red-500', emoji: '🔴' },
  { name: 'Time B', color: 'bg-blue-500', border: 'border-blue-400', lightBg: 'bg-blue-500/10', text: 'text-blue-500', emoji: '🔵' },
  { name: 'Time C', color: 'bg-green-500', border: 'border-green-400', lightBg: 'bg-green-500/10', text: 'text-green-500', emoji: '🟢' },
  { name: 'Time D', color: 'bg-yellow-500', border: 'border-yellow-400', lightBg: 'bg-yellow-500/10', text: 'text-yellow-500', emoji: '🟡' },
  { name: 'Time E', color: 'bg-purple-500', border: 'border-purple-400', lightBg: 'bg-purple-500/10', text: 'text-purple-500', emoji: '🟣' },
  { name: 'Time F', color: 'bg-orange-500', border: 'border-orange-400', lightBg: 'bg-orange-500/10', text: 'text-orange-500', emoji: '🟠' },
  { name: 'Time G', color: 'bg-pink-500', border: 'border-pink-400', lightBg: 'bg-pink-500/10', text: 'text-pink-500', emoji: '🩷' },
  { name: 'Time H', color: 'bg-cyan-500', border: 'border-cyan-400', lightBg: 'bg-cyan-500/10', text: 'text-cyan-500', emoji: '🩵' },
  { name: 'Time I', color: 'bg-indigo-500', border: 'border-indigo-400', lightBg: 'bg-indigo-500/10', text: 'text-indigo-500', emoji: '💜' },
  { name: 'Time J', color: 'bg-teal-500', border: 'border-teal-400', lightBg: 'bg-teal-500/10', text: 'text-teal-500', emoji: '💚' },
];

interface ScratchTile {
  id: number;
  type: 'team' | 'try_again';
  teamNumber?: number;
  teamName?: string;
  emoji?: string;
  badge_url?: string | null;
  revealed: boolean;
}

export const ScratchCardModal: React.FC<ScratchCardModalProps> = ({
  isOpen,
  onClose,
  match,
  participants,
  currentParticipant,
  onSelectTeam,
}) => {
  const [tiles, setTiles] = useState<ScratchTile[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [wonTeam, setWonTeam] = useState<{ number: number; name: string; emoji: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Efeito nativo de Confetes
  const triggerNativeConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 400;
    canvas.height = canvas.parentElement?.clientHeight || 500;

    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number }[] = [];
    const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      });
    }

    let animationFrame: number;
    let frames = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravidade
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      frames++;
      if (frames < 90) {
        animationFrame = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();
  };

  // Identificar se a partida é de vôlei e os limites de gênero
  const isMatchVolei = match.sport_type === 'volei' || (match as any).organization?.sport_type === 'volei';
  const customGenderLimits = (match.teams_custom_config as any)?.gender_limits;
  const maxMenLimit = match.max_homens_por_time ?? customGenderLimits?.max_homens_por_time;
  const maxFemLimit = match.max_mulheres_por_time ?? customGenderLimits?.max_mulheres_por_time;
  const participantGender = currentParticipant?.user?.genero;

  // Calcular vagas disponíveis por time
  const availableTeams = useMemo(() => {
    const teamCounts: Record<number, number> = {};
    const teamMenCounts: Record<number, number> = {};
    const teamFemCounts: Record<number, number> = {};

    participants.forEach((p) => {
      if (p.team != null && p.team >= 1 && p.team <= match.num_times) {
        teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        if (p.user?.genero === 'feminino') {
          teamFemCounts[p.team] = (teamFemCounts[p.team] || 0) + 1;
        } else {
          teamMenCounts[p.team] = (teamMenCounts[p.team] || 0) + 1;
        }
      }
    });

    const available: number[] = [];
    for (let t = 1; t <= match.num_times; t++) {
      const currentCount = teamCounts[t] || 0;
      if (currentCount >= match.jogadores_por_time) continue;

      if (isMatchVolei && (maxMenLimit !== undefined || maxFemLimit !== undefined)) {
        if (participantGender === 'feminino' && maxFemLimit !== undefined) {
          if ((teamFemCounts[t] || 0) < maxFemLimit) {
            available.push(t);
          }
        } else if (participantGender !== 'feminino' && maxMenLimit !== undefined) {
          if ((teamMenCounts[t] || 0) < maxMenLimit) {
            available.push(t);
          }
        } else {
          available.push(t);
        }
      } else {
        available.push(t);
      }
    }
    return available;
  }, [participants, match, isMatchVolei, maxMenLimit, maxFemLimit, participantGender]);

  // Gerar os 12 blocos da raspadinha com distribuição ponderada e aleatória
  useEffect(() => {
    if (!isOpen) return;

    setIsWon(false);
    setWonTeam(null);
    setIsSubmitting(false);

    const totalTiles = 12;
    const maxCapacity = match.jogadores_por_time || 6;
    const numTeams = match.num_times || 2;

    // 1. Calcular contagem atual, contagem por gênero e soma de qualidade por time
    const teamCounts: Record<number, number> = {};
    const teamMenCounts: Record<number, number> = {};
    const teamFemCounts: Record<number, number> = {};
    const teamRatingSums: Record<number, number> = {};

    for (let t = 1; t <= numTeams; t++) {
      teamCounts[t] = 0;
      teamMenCounts[t] = 0;
      teamFemCounts[t] = 0;
      teamRatingSums[t] = 0;
    }

    participants.forEach((p) => {
      if (p.team != null && p.team >= 1 && p.team <= numTeams) {
        teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        if (p.user?.genero === 'feminino') {
          teamFemCounts[p.team] = (teamFemCounts[p.team] || 0) + 1;
        } else {
          teamMenCounts[p.team] = (teamMenCounts[p.team] || 0) + 1;
        }
        teamRatingSums[p.team] = (teamRatingSums[p.team] || 0) + getPlayerRating(p.user);
      }
    });

    // 2. Construir piscina ponderada de vagas disponíveis por time
    const openSlotsPool: number[] = [];
    for (let t = 1; t <= numTeams; t++) {
      const current = teamCounts[t] || 0;
      const openTotal = Math.max(0, maxCapacity - current);

      let openForUser = openTotal;
      if (isMatchVolei && (maxMenLimit !== undefined || maxFemLimit !== undefined)) {
        if (participantGender === 'feminino' && maxFemLimit !== undefined) {
          const openFem = Math.max(0, maxFemLimit - (teamFemCounts[t] || 0));
          openForUser = Math.min(openTotal, openFem);
        } else if (participantGender !== 'feminino' && maxMenLimit !== undefined) {
          const openMen = Math.max(0, maxMenLimit - (teamMenCounts[t] || 0));
          openForUser = Math.min(openTotal, openMen);
        }
      }

      for (let k = 0; k < openForUser; k++) {
        openSlotsPool.push(t);
      }
    }

    const generated: ScratchTile[] = [];

    // Se não houver vagas disponíveis em nenhum time
    if (openSlotsPool.length === 0) {
      for (let i = 0; i < totalTiles; i++) {
        generated.push({ id: i, type: 'try_again', revealed: false });
      }
      setTiles(generated);
      return;
    }

    // 3. Embaralhar a piscina de vagas abertas (Fisher-Yates)
    const shuffledPool = [...openSlotsPool];
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }

    // 4. Selecionar blocos de time para a raspadinha proporcionalmente às vagas abertas
    const maxTeamTilesOnCard = Math.min(6, Math.max(numTeams, shuffledPool.length));
    const selectedTeamsForCard = shuffledPool.slice(0, maxTeamTilesOnCard);

    selectedTeamsForCard.forEach((teamNum, idx) => {
      const tInfo = getTeamInfo(match, teamNum);
      generated.push({
        id: idx,
        type: 'team',
        teamNumber: teamNum,
        teamName: tInfo.name,
        emoji: tInfo.emoji,
        badge_url: tInfo.badge_url,
        revealed: false,
      });
    });

    // 5. Preencher o restante até 12 blocos com 'try_again'
    const remainingCount = totalTiles - generated.length;
    for (let i = 0; i < remainingCount; i++) {
      generated.push({
        id: generated.length,
        type: 'try_again',
        revealed: false,
      });
    }

    // 6. Embaralhar totalmente os 12 blocos da raspadinha (Fisher-Yates)
    for (let i = generated.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [generated[i], generated[j]] = [generated[j], generated[i]];
    }

    const finalTiles = generated.map((tile, idx) => ({ ...tile, id: idx }));
    setTiles(finalTiles);
  }, [isOpen, match, participants]);

  if (!isOpen) return null;

  const isAlreadyAssigned = currentParticipant?.team != null;

  const handleTileClick = async (tileId: number) => {
    if (isWon || isSubmitting || isAlreadyAssigned) return;

    const tileIndex = tiles.findIndex((t) => t.id === tileId);
    if (tileIndex === -1 || tiles[tileIndex].revealed) return;

    // Revelar o bloco
    const updatedTiles = [...tiles];
    updatedTiles[tileIndex].revealed = true;
    setTiles(updatedTiles);

    const tile = updatedTiles[tileIndex];

    if (tile.type === 'try_again') {
      toast.info('Tente novamente! Escolha outro bloco da raspadinha.', { duration: 1500 });
    } else if (tile.type === 'team' && tile.teamNumber) {
      setIsWon(true);
      const tInfo = TEAM_COLORS[tile.teamNumber - 1] || { name: `Time ${tile.teamNumber}`, emoji: '🏐' };
      setWonTeam({ number: tile.teamNumber, name: tInfo.name, emoji: tInfo.emoji });

      // Disparar confete nativo
      triggerNativeConfetti();

      // Atribuir o time no banco de dados
      try {
        setIsSubmitting(true);
        await onSelectTeam(tile.teamNumber);
        toast.success(`Parabéns! Você foi sorteado para o ${tInfo.name}! 🚀`);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao salvar seu time no sorteio.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-brand-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden text-center text-white space-y-5">
        {/* Canvas Nativo de Confetes */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-20" />

        {/* Efeitos de fundo reluzente */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors z-30"
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Cabeçalho */}
        <div className="space-y-1 pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Raspadinha da Sorte Virtual</span>
          </div>
          <h2 className="text-xl font-black text-white">
            Qual será o seu Time? 🏐
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {availableTeams.length > 0
              ? `Raspe os blocos abaixo até revelar em qual time você vai jogar nesta partida!`
              : 'Não há vagas disponíveis nos times no momento.'}
          </p>
        </div>

        {/* Alerta se o participante já realizou o sorteio */}
        {isAlreadyAssigned ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs text-emerald-400">
            <Trophy className="w-6 h-6 shrink-0 text-emerald-400" />
            <span className="font-extrabold text-sm text-white">Sorteio Concluído!</span>
            <span className="text-center text-slate-300">
              Você já realizou a raspadinha desta partida e seu time foi definido no banco de dados. O sorteio não pode ser repetido.
            </span>
          </div>
        ) : availableTeams.length === 0 ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Todos os times já estão com as vagas totalmente preenchidas!</span>
          </div>
        ) : (
          /* Grade de 12 Blocos (4 colunas x 3 linhas) */
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-3 bg-slate-950/60 rounded-2xl border border-slate-800 relative z-10">
            {tiles.map((tile) => {
              const teamConfig = tile.teamNumber ? TEAM_COLORS[tile.teamNumber - 1] : null;

              return (
                <motion.button
                  key={tile.id}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleTileClick(tile.id)}
                  disabled={tile.revealed || isWon || isSubmitting}
                  className={`h-20 rounded-xl relative overflow-hidden font-extrabold text-xs transition-all flex flex-col items-center justify-center p-1.5 select-none ${
                    !tile.revealed
                      ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 border border-amber-300 shadow-md cursor-pointer'
                      : tile.type === 'team'
                      ? `${teamConfig?.lightBg || 'bg-brand-500/20'} ${teamConfig?.border || 'border-brand-500'} border-2 scale-100 animate-in zoom-in-50 duration-200`
                      : 'bg-slate-800/80 border border-slate-700 text-slate-500'
                  }`}
                >
                  {!tile.revealed ? (
                    /* Película da Raspadinha (Não revelado) */
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-950">
                      <Sparkles className="w-5 h-5 text-slate-900/80 animate-pulse" />
                      <span className="text-[10px] font-black tracking-wider uppercase">Raspar</span>
                    </div>
                  ) : tile.type === 'team' ? (
                    /* Time Revelado! */
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <TeamBadge
                        teamInfo={{
                          name: tile.teamName || '',
                          emoji: tile.emoji,
                          badge_url: tile.badge_url,
                        }}
                        size="2xs"
                        rounded="md"
                        showBorder={false}
                      />
                      <span className={`text-[10px] font-black leading-tight truncate max-w-[80px] ${teamConfig?.text || 'text-white'}`}>
                        {tile.teamName}
                      </span>
                    </div>
                  ) : (
                    /* Tente Novamente! */
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
                      <RotateCcw className="w-4 h-4 opacity-50" />
                      <span className="text-[9px] font-bold text-center leading-none">Tente novamente!</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Mensagem de Vitória / Conclusão */}
        {isWon && wonTeam && (
          <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 rounded-2xl space-y-2 animate-in slide-in-from-bottom duration-300 relative z-30">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-extrabold text-base">
              <PartyPopper className="w-5 h-5" />
              <span>Você foi sorteado para o {wonTeam.name}! {wonTeam.emoji}</span>
            </div>
            <p className="text-xs text-slate-300">
              Seu time já foi atribuído e salvo com sucesso na partida. Boa sorte no jogo!
            </p>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
            >
              Concluir e Ver Minha Escalação
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};
