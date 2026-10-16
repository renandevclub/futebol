'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Trash2, Save, Users, DollarSign, Upload, Check, AlertCircle } from 'lucide-react';
import { updateTournamentTeam, deleteTournamentTeam, fetchLeagueMembersForSelection } from '@/lib/tournamentsHelper';
import { AVAILABLE_TEAM_COLORS, validatePngFile } from '@/lib/teamsHelper';
import { Tournament, TournamentTeam, TournamentTeamRegistrationStatus, TournamentTeamPaymentStatus, Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface EditTournamentTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TournamentTeam;
  tournament?: Tournament;
  leagueId?: string;
  onTeamUpdated?: () => void;
  onTeamDeleted?: () => void;
  onTeamRemoved?: () => void;
}

export const EditTournamentTeamModal: React.FC<EditTournamentTeamModalProps> = ({
  isOpen,
  onClose,
  team,
  tournament,
  leagueId,
  onTeamUpdated,
  onTeamDeleted,
  onTeamRemoved,
}) => {
  const actualLeagueId = tournament?.league_id || leagueId || '';
  const [name, setName] = useState(team.name);
  const [selectedColorId, setSelectedColorId] = useState(team.color || 'blue');
  const [badgePreviewUrl, setBadgePreviewUrl] = useState<string | null>(team.badge_url || null);
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [coachId, setCoachId] = useState<string>(team.coach_id);
  const [regStatus, setRegStatus] = useState<TournamentTeamRegistrationStatus>(team.registration_status);
  const [payStatus, setPayStatus] = useState<TournamentTeamPaymentStatus>(team.payment_status);
  const [payAmount, setPayAmount] = useState<number>(team.payment_amount || 0);

  const [leagueMembers, setLeagueMembers] = useState<Profile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setSelectedColorId(team.color || 'blue');
      setBadgePreviewUrl(team.badge_url || null);
      setCoachId(team.coach_id);
      setRegStatus(team.registration_status);
      setPayStatus(team.payment_status);
      setPayAmount(team.payment_amount || 0);
    }
  }, [team]);

  useEffect(() => {
    if (isOpen && actualLeagueId) {
      fetchLeagueMembersForSelection(actualLeagueId).then((members) => {
        setLeagueMembers(members);
      });
    }
  }, [isOpen, actualLeagueId]);

  const handleBadgeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validatePngFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo de escudo inválido. Apenas PNG é aceito.');
      return;
    }

    setBadgeFile(file);
    const objectUrl = URL.createObjectURL(file);
    setBadgePreviewUrl(objectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da equipe.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalBadgeUrl = badgePreviewUrl;

      if (badgeFile) {
        setIsUploading(true);
        const fileExt = 'png';
        const filePath = `team-badges/badge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, badgeFile, { upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          finalBadgeUrl = publicUrlData.publicUrl;
        }
        setIsUploading(false);
      }

      const res = await updateTournamentTeam(team.id, {
        name: name.trim(),
        badge_url: finalBadgeUrl,
        color: selectedColorId,
        coach_id: coachId,
        registration_status: regStatus,
        payment_status: payStatus,
        payment_amount: Number(payAmount) || 0,
        approved_at: regStatus === 'approved' ? (team.approved_at || new Date().toISOString()) : null,
      });

      if (res.success) {
        onClose();
        if (onTeamUpdated) onTeamUpdated();
      } else {
        toast.error(res.error || 'Erro ao atualizar equipe.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Tem certeza que deseja remover a equipe "${team.name}" do campeonato?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteTournamentTeam(team.id);
      if (res.success) {
        onClose();
        if (onTeamDeleted) onTeamDeleted();
        if (onTeamRemoved) onTeamRemoved();
      } else {
        toast.error(res.error || 'Erro ao remover equipe.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Editar Equipe</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Admin
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gerenciamento de dados, técnico, aprovação e pagamento
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Nome da Equipe */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Nome da Equipe *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
              />
            </div>

            {/* Escudo e Upload */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Escudo / Emblema (PNG)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 shrink-0">
                  {badgePreviewUrl ? (
                    <img src={badgePreviewUrl} alt="Escudo" className="w-full h-full object-contain" />
                  ) : (
                    <Shield className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{badgeFile ? 'Trocar arquivo PNG' : 'Alterar Escudo (.PNG)'}</span>
                    <input
                      type="file"
                      accept=".png,image/png"
                      onChange={handleBadgeChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium">Apenas imagens em formato PNG</p>
                </div>
              </div>
            </div>

            {/* Cor Principal */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Cor Principal da Equipe
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TEAM_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedColorId(c.id)}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      selectedColorId === c.id ? 'ring-2 ring-emerald-500 ring-offset-2 scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColorId === c.id && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Técnico Oficial (Coach) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Técnico Responsável Oficial
              </label>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value={team.coach_id}>
                  {team.coach?.nome ? `${team.coach.nome} (Atual)` : 'Técnico Atual'}
                </option>
                {leagueMembers
                  .filter((m) => m.id !== team.coach_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} {m.apelido ? `(${m.apelido})` : ''} - {m.whatsapp || ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Status de Inscrição e Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Status da Inscrição
                </label>
                <select
                  value={regStatus}
                  onChange={(e) => setRegStatus(e.target.value as TournamentTeamRegistrationStatus)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="approved">🟢 Aprovada (Oficial)</option>
                  <option value="pending">🟡 Pendente (Aguardando)</option>
                  <option value="rejected">🔴 Recusada</option>
                  <option value="cancelled">⚪ Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Status do Pagamento
                </label>
                <select
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value as TournamentTeamPaymentStatus)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="paid">✅ Pago</option>
                  <option value="pending">⏳ Pendente</option>
                  <option value="refunded">↩️ Estornado</option>
                  <option value="cancelled">❌ Cancelado</option>
                </select>
              </div>
            </div>

            {/* Valor Pago */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Valor da Taxa / Pago (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
              />
            </div>

            {/* Botões de Ação */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
                className="px-4 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Removendo...' : 'Remover Equipe'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting || isDeleting}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting || isUploading}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Equipe'}</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
