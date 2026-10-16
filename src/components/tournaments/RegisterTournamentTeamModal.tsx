'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Upload, AlertCircle, Check, Users, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { registerTeamInTournament, createTeamManuallyByAdmin, fetchLeagueMembersForSelection } from '@/lib/tournamentsHelper';
import { AVAILABLE_TEAM_COLORS, validatePngFile } from '@/lib/teamsHelper';
import { Tournament, Profile, TournamentTeamRegistrationStatus, TournamentTeamPaymentStatus } from '@/types/database';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface RegisterTournamentTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  isAdminMode?: boolean;
  onTeamRegistered?: () => void;
}

export const RegisterTournamentTeamModal: React.FC<RegisterTournamentTeamModalProps> = ({
  isOpen,
  onClose,
  tournament,
  isAdminMode = false,
  onTeamRegistered,
}) => {
  const { user } = useAuth();
  const { currentLeague } = useLeague();

  const [teamName, setTeamName] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('blue');
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [badgePreviewUrl, setBadgePreviewUrl] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string>(user?.id || '');
  const [regStatus, setRegStatus] = useState<TournamentTeamRegistrationStatus>('approved');
  const [payStatus, setPayStatus] = useState<TournamentTeamPaymentStatus>('paid');
  const [leagueMembers, setLeagueMembers] = useState<Profile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen && currentLeague?.id) {
      setCoachId(user?.id || '');
      if (isAdminMode) {
        fetchLeagueMembersForSelection(currentLeague.id).then(setLeagueMembers);
      }
    }
  }, [isOpen, currentLeague?.id, isAdminMode, user?.id]);

  const handleBadgeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validatePngFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo de emblema inválido. Apenas PNG é aceito.');
      return;
    }

    setBadgeFile(file);
    const objectUrl = URL.createObjectURL(file);
    setBadgePreviewUrl(objectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !currentLeague?.id) {
      toast.error('Usuário ou liga inválida.');
      return;
    }

    if (!teamName.trim()) {
      toast.error('Informe o nome da sua equipe.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalBadgeUrl: string | null = null;

      // Se enviou arquivo de emblema, fazer upload para o bucket 'avatars' ou 'media'
      if (badgeFile) {
        setIsUploading(true);
        const fileExt = 'png';
        const filePath = `tournament-badges/${tournament.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, badgeFile, { upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalBadgeUrl = publicUrlData.publicUrl;
        } else {
          console.warn('Erro ao fazer upload do escudo para avatars:', uploadError);
        }
        setIsUploading(false);
      }

      let res;
      if (isAdminMode) {
        res = await createTeamManuallyByAdmin({
          tournament_id: tournament.id,
          league_id: currentLeague.id,
          name: teamName.trim(),
          badge_url: finalBadgeUrl,
          color: selectedColorId,
          coach_id: coachId || user.id,
          registration_status: regStatus,
          payment_status: payStatus,
        });
      } else {
        res = await registerTeamInTournament({
          tournament_id: tournament.id,
          league_id: currentLeague.id,
          name: teamName.trim(),
          badge_url: finalBadgeUrl,
          color: selectedColorId,
          coach_id: user.id,
          coach_profile: user,
        });
      }

      if (res.success) {
        onClose();
        if (onTeamRegistered) {
          onTeamRegistered();
        }
      } else {
        toast.error(res.error || 'Erro ao inscrever equipe.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{isAdminMode ? 'Cadastrar Equipe Manualmente' : 'Inscrever Equipe'}</span>
                  {isAdminMode && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Admin
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {tournament.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
            {isAdminMode ? (
              <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Inscrição Manual pelo Administrador</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Técnico Responsável Oficial
                  </label>
                  <select
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={user?.id}>Eu mesmo ({user?.nome || 'Admin'})</option>
                    {leagueMembers
                      .filter((m) => m.id !== user?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} {m.apelido ? `(${m.apelido})` : ''} - {m.whatsapp || ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Status da Inscrição
                    </label>
                    <select
                      value={regStatus}
                      onChange={(e) => setRegStatus(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      <option value="approved">🟢 Aprovada</option>
                      <option value="pending">🟡 Pendente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Taxa de Inscrição
                    </label>
                    <select
                      value={payStatus}
                      onChange={(e) => setPayStatus(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      <option value="paid">✅ Pago</option>
                      <option value="pending">⏳ Pendente</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* Aviso de Responsabilidade do Técnico */
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1 font-medium">
                  <strong className="font-bold text-blue-900 dark:text-blue-200 block">
                    Você será o Técnico Oficial desta equipe!
                  </strong>
                  Após a aprovação pelo administrador, você terá autoridade exclusiva para escalar, adicionar e gerenciar os jogadores da sua equipe neste campeonato.
                </div>
              </div>
            )}

            {/* Nome da Equipe */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Nome da Equipe *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Resenha F.C."
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            {/* Cor da Equipe */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Cor Predominante da Equipe
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {AVAILABLE_TEAM_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColorId(col.id)}
                    className={`h-9 rounded-xl border flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                      selectedColorId === col.id
                        ? 'ring-2 ring-blue-500 scale-105 border-blue-500'
                        : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: `${col.hex}25` }}
                  >
                    <span>{col.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Escudo / Emblema (PNG Opcional) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Escudo da Equipe (.PNG Opcional)
              </label>
              <div className="flex items-center gap-4">
                {badgePreviewUrl ? (
                  <div className="relative w-14 h-14 rounded-2xl border-2 border-dashed border-blue-500 p-1 flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0">
                    <img
                      src={badgePreviewUrl}
                      alt="Escudo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                    <Shield className="w-6 h-6 opacity-40" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{badgeFile ? 'Trocar Escudo' : 'Carregar Imagem PNG'}</span>
                    <input
                      type="file"
                      accept=".png"
                      onChange={handleBadgeChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Arquivo PNG com fundo transparente (máx. 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Regras e Limites */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 space-y-1 font-medium">
              <div>• Máximo de jogadores permitidos: <strong>{tournament.players_per_team} jogadores</strong></div>
              <div>• Valor da inscrição: <strong>R$ {tournament.entry_fee.toFixed(2)}</strong></div>
              <div>• Status da inscrição: Inicialmente <strong>Aguardando aprovação</strong> do organizador</div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-600/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Inscrevendo time...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Inscrição</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
