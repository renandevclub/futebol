'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Match } from '@/types/database';
import { supabase } from '@/lib/supabase';
import {
  AVAILABLE_TEAM_COLORS,
  DEFAULT_TEAM_CONFIGS,
  CustomTeamsConfig,
  validatePngFile,
} from '@/lib/teamsHelper';
import { TeamBadge } from '@/components/TeamBadge';
import {
  X,
  Palette,
  Save,
  RotateCcw,
  Check,
  Sparkles,
  Shield,
  Upload,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface EditTeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  onTeamsUpdated: () => void;
}

interface TeamEditItem {
  teamNumber: number;
  name: string;
  colorId: string;
  emoji: string;
  badge_url?: string | null;
  badgePreview?: string | null;
  badgeFile?: File | null;
  isBadgeRemoved?: boolean;
}

export const EditTeamsModal: React.FC<EditTeamsModalProps> = ({
  isOpen,
  onClose,
  match,
  onTeamsUpdated,
}) => {
  const [teamsState, setTeamsState] = useState<TeamEditItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTeamNumber, setUploadingTeamNumber] = useState<number | null>(null);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Inicializar estado dos times
  useEffect(() => {
    if (!match) return;

    const list: TeamEditItem[] = [];
    const customConfig = (match.teams_custom_config || {}) as CustomTeamsConfig;

    for (let t = 1; t <= match.num_times; t++) {
      const defaultIdx = (t - 1) % DEFAULT_TEAM_CONFIGS.length;
      const defaultConf = DEFAULT_TEAM_CONFIGS[defaultIdx] || {
        name: `Time ${t}`,
        colorId: 'blue',
        emoji: '⚽',
      };

      const custom = customConfig[t];

      list.push({
        teamNumber: t,
        name: custom?.name?.trim() || defaultConf.name,
        colorId: custom?.colorId || defaultConf.colorId,
        emoji: custom?.emoji || defaultConf.emoji,
        badge_url: custom?.badge_url || null,
        badgePreview: custom?.badge_url || null,
        badgeFile: null,
        isBadgeRemoved: false,
      });
    }

    setTeamsState(list);
  }, [match, isOpen]);

  if (!isOpen || !match) return null;

  const handleNameChange = (teamNumber: number, newName: string) => {
    setTeamsState((prev) =>
      prev.map((t) => (t.teamNumber === teamNumber ? { ...t, name: newName } : t))
    );
  };

  const handleColorChange = (teamNumber: number, colorId: string) => {
    const colorOpt = AVAILABLE_TEAM_COLORS.find((c) => c.id === colorId);
    setTeamsState((prev) =>
      prev.map((t) =>
        t.teamNumber === teamNumber
          ? {
              ...t,
              colorId,
              emoji: colorOpt?.emoji || t.emoji,
            }
          : t
      )
    );
  };

  // Upload e validação rigorosa de PNG
  const handleBadgeFileSelect = async (teamNumber: number, file?: File) => {
    if (!file) return;

    setUploadingTeamNumber(teamNumber);

    // Validação estrita de formato PNG e magic bytes
    const validation = await validatePngFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo inválido. Selecione uma imagem PNG legítima.');
      setUploadingTeamNumber(null);
      // Reset input
      if (fileInputRefs.current[teamNumber]) {
        fileInputRefs.current[teamNumber]!.value = '';
      }
      return;
    }

    // Criar preview local instantâneo
    const previewUrl = URL.createObjectURL(file);

    setTeamsState((prev) =>
      prev.map((t) =>
        t.teamNumber === teamNumber
          ? {
              ...t,
              badgePreview: previewUrl,
              badgeFile: file,
              isBadgeRemoved: false,
            }
          : t
      )
    );

    setUploadingTeamNumber(null);
    toast.success(`Emblema PNG do Time #${teamNumber} adicionado! Clique em Salvar para gravar.`);
  };

  // Remover emblema
  const handleRemoveBadge = (teamNumber: number) => {
    setTeamsState((prev) =>
      prev.map((t) =>
        t.teamNumber === teamNumber
          ? {
              ...t,
              badgePreview: null,
              badge_url: null,
              badgeFile: null,
              isBadgeRemoved: true,
            }
          : t
      )
    );
    if (fileInputRefs.current[teamNumber]) {
      fileInputRefs.current[teamNumber]!.value = '';
    }
    toast.info(`Emblema do Time #${teamNumber} removido.`);
  };

  // Restaurar padrões
  const handleResetToDefaults = () => {
    const list: TeamEditItem[] = [];
    for (let t = 1; t <= match.num_times; t++) {
      const defaultIdx = (t - 1) % DEFAULT_TEAM_CONFIGS.length;
      const defaultConf = DEFAULT_TEAM_CONFIGS[defaultIdx] || {
        name: `Time ${t}`,
        colorId: 'blue',
        emoji: '⚽',
      };
      list.push({
        teamNumber: t,
        name: defaultConf.name,
        colorId: defaultConf.colorId,
        emoji: defaultConf.emoji,
        badge_url: null,
        badgePreview: null,
        badgeFile: null,
        isBadgeRemoved: true,
      });
      if (fileInputRefs.current[t]) {
        fileInputRefs.current[t]!.value = '';
      }
    }
    setTeamsState(list);
    toast.info('Nomes, cores e emblemas restaurados para o padrão.');
  };

  // Salvar configurações com upload de novos emblemas
  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Salvando personalizações e emblemas dos times...');

    try {
      const configToSave: CustomTeamsConfig = {};

      for (const t of teamsState) {
        let finalBadgeUrl: string | null = t.badge_url || null;

        // Se houver novo arquivo PNG para fazer upload
        if (t.badgeFile) {
          const fileExt = 'png';
          const filePath = `team-badges/${match.id}/team_${t.teamNumber}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('match-media')
            .upload(filePath, t.badgeFile, {
              contentType: 'image/png',
              upsert: true,
            });

          if (uploadError) {
            console.error(`Erro ao fazer upload do emblema do time ${t.teamNumber}:`, uploadError);
            throw new Error(`Falha no upload do emblema do Time #${t.teamNumber}: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage.from('match-media').getPublicUrl(filePath);
          finalBadgeUrl = urlData.publicUrl;
        } else if (t.isBadgeRemoved) {
          finalBadgeUrl = null;
        }

        configToSave[t.teamNumber] = {
          name: t.name.trim() || `Time ${t.teamNumber}`,
          colorId: t.colorId,
          emoji: t.emoji,
          badge_url: finalBadgeUrl,
        };
      }

      const { error: dbError } = await supabase
        .from('matches')
        .update({
          teams_custom_config: configToSave,
        })
        .eq('id', match.id);

      if (dbError) {
        throw dbError;
      }

      toast.success('Times e emblemas salvos com sucesso! 🛡️🎨', { id: toastId });
      onTeamsUpdated();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar times:', err);
      toast.error(err.message || 'Erro ao salvar personalização dos times.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-black uppercase tracking-wider">
                  <Shield className="w-3 h-3" />
                  Painel do Administrador
                </div>
                <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                  Personalizar Emblemas, Nomes & Cores
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtítulo informativo */}
          <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                Adicione um <strong>emblema em formato PNG</strong> para cada um dos{' '}
                <strong className="text-brand-600 dark:text-brand-400">{match.num_times} times</strong>.
              </span>
            </div>
            <button
              onClick={handleResetToDefaults}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer shrink-0 ml-auto"
              title="Restaurar nomes, cores e emblemas originais"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar Padrão</span>
            </button>
          </div>

          {/* Lista de Times para Edição */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamsState.map((team) => {
                const activeColor =
                  AVAILABLE_TEAM_COLORS.find((c) => c.id === team.colorId) ||
                  AVAILABLE_TEAM_COLORS[0];

                const hasBadge = Boolean(team.badgePreview);
                const isUploadingThis = uploadingTeamNumber === team.teamNumber;

                return (
                  <div
                    key={team.teamNumber}
                    className={`p-4 rounded-3xl border-2 transition-all space-y-3.5 bg-slate-50/70 dark:bg-slate-800/40 ${activeColor.border} shadow-xs relative overflow-hidden`}
                  >
                    {/* Linha Superior: Emblema Padronizado + Nome */}
                    <div className="flex items-start gap-3">
                      {/* Container do Emblema Padronizado */}
                      <div className="relative group shrink-0">
                        <TeamBadge
                          teamInfo={{
                            name: team.name,
                            emoji: team.emoji,
                            badge_url: team.badgePreview,
                            color: activeColor.color,
                            border: activeColor.border,
                            lightBg: activeColor.lightBg,
                          }}
                          size="md"
                          rounded="2xl"
                          className="shadow-md"
                        />
                        {isUploadingThis && (
                          <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Nome do Time */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Time #{team.teamNumber}
                          </label>
                          {hasBadge && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                              PNG Ativo
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={team.name}
                          maxLength={30}
                          onChange={(e) => handleNameChange(team.teamNumber, e.target.value)}
                          placeholder={`Time ${team.teamNumber}`}
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Ações de Emblema (Upload / Substituir / Remover) */}
                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-brand-500" />
                          <span>Emblema do Time:</span>
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          Apenas .PNG
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Input de arquivo invisível */}
                        <input
                          ref={(el) => {
                            fileInputRefs.current[team.teamNumber] = el;
                          }}
                          type="file"
                          accept="image/png,.png"
                          onChange={(e) => handleBadgeFileSelect(team.teamNumber, e.target.files?.[0])}
                          className="hidden"
                          id={`badge-input-${team.teamNumber}`}
                        />

                        {/* Botão de Adicionar ou Substituir */}
                        <label
                          htmlFor={`badge-input-${team.teamNumber}`}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none ${
                            hasBadge
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                              : 'bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{hasBadge ? 'Substituir PNG' : 'Adicionar Emblema PNG'}</span>
                        </label>

                        {/* Botão de Remover Emblema (se houver) */}
                        {hasBadge && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBadge(team.teamNumber)}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors cursor-pointer shrink-0"
                            title="Remover emblema do time"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Paleta de Cores Selecionáveis */}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Cor de Identificação:
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {AVAILABLE_TEAM_COLORS.map((col) => {
                          const isSelected = team.colorId === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => handleColorChange(team.teamNumber, col.id)}
                              className={`h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${col.color} ${
                                isSelected
                                  ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-offset-slate-900 dark:ring-white scale-105 shadow-md'
                                  : 'opacity-70 hover:opacity-100 hover:scale-105'
                              }`}
                              title={col.name}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white drop-shadow-md" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer com Ações */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                Os emblemas aparecem com proporção 1:1 perfeita no Placar, Modo TV e Classificação.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={handleSave}
                disabled={isSaving}
                className="w-1/2 sm:w-auto px-5 py-2.5 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
