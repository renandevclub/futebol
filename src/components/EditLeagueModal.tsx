'use client';

import React, { useState, useEffect, useRef } from 'react';
import { League, SportType } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/mediaCompressor';
import { X, Trophy, FileText, QrCode, Trash2, CheckCircle2, AlertTriangle, Camera, ImagePlus, Upload, KeyRound, Lock, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface EditLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: League | null;
}

export const EditLeagueModal: React.FC<EditLeagueModalProps> = ({
  isOpen,
  onClose,
  league,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { updateLeague, deleteLeague } = useLeague();

  const [sportType, setSportType] = useState<SportType>('futebol');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados de Imagem (Logo e Capa)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputCoverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (league) {
      setSportType(league.sport_type || 'futebol');
      setName(league.name || '');
      setDescription(league.description || '');
      setChavePix(league.chave_pix_padrao || '');
      setNomeRecebedor(league.nome_recebedor_pix || '');
      setWhatsapp(league.organizer_whatsapp || '');
      setAccessPassword(league.access_password || '');
      setShowPassword(false);
      setCopiedPassword(false);
      setLogoPreview(league.logo_url || null);
      setCoverPreview(league.cover_url || null);
      setLogoFile(null);
      setCoverFile(null);
    }
  }, [league]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('A imagem de logo deve ter no máximo 15MB.');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('A imagem de capa deve ter no máximo 15MB.');
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  if (!isOpen || !league) return null;

  const isOwnerOrSuper = isSuperAdmin || (user && league.owner_id === user.id);
  if (!isOwnerOrSuper) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Informe o nome da Liga.');
      return;
    }

    try {
      setIsSubmitting(true);

      let finalLogoUrl = logoPreview;
      let finalCoverUrl = coverPreview;

      // 1. Upload do Logo se novo arquivo selecionado
      if (logoFile) {
        try {
          const compressedLogo = await compressImage(logoFile, 600, 600);
          const fileName = `league_logo_${league.id}_${Date.now()}.webp`;
          const { error: uploadLogoErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, compressedLogo, { upsert: true });

          if (!uploadLogoErr) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            finalLogoUrl = urlData.publicUrl;
          } else {
            console.error('Erro ao enviar logo:', uploadLogoErr);
          }
        } catch (e) {
          console.error('Erro ao processar logo:', e);
        }
      }

      // 2. Upload da Capa se novo arquivo selecionado
      if (coverFile) {
        try {
          const compressedCover = await compressImage(coverFile, 1920, 1080);
          const fileName = `league_cover_${league.id}_${Date.now()}.webp`;
          const { error: uploadCoverErr } = await supabase.storage
            .from('covers')
            .upload(fileName, compressedCover, { upsert: true });

          if (!uploadCoverErr) {
            const { data: urlData } = supabase.storage.from('covers').getPublicUrl(fileName);
            finalCoverUrl = urlData.publicUrl;
          } else {
            console.error('Erro ao enviar capa:', uploadCoverErr);
          }
        } catch (e) {
          console.error('Erro ao processar capa:', e);
        }
      }

      const res = await updateLeague(league.id, {
        name: name.trim(),
        sport_type: sportType,
        description: description.trim() || null,
        chave_pix_padrao: chavePix.trim() || null,
        nome_recebedor_pix: nomeRecebedor.trim() || null,
        organizer_whatsapp: whatsapp.trim() || null,
        access_password: accessPassword.trim() || null,
        logo_url: finalLogoUrl,
        cover_url: finalCoverUrl,
      });

      if (res.success) {
        onClose();
      }
    } catch (err) {
      console.error('Erro ao atualizar liga:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await deleteLeague(league.id);
      if (res.success) {
        onClose();
      }
    } catch (err) {
      console.error('Erro ao excluir liga:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Cabeçalho do Modal */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md shrink-0 ${
              sportType === 'volei'
                ? 'bg-amber-500 shadow-amber-500/25'
                : 'bg-emerald-500 shadow-emerald-500/25'
            }`}>
              {sportType === 'volei' ? '🏐' : '⚽'}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                Editar Liga
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Altere dados, modalidade e fotos mantendo todas as partidas preservadas
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SELEÇÃO DA MODALIDADE ESPORTIVA */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  🏅 Modalidade da Liga
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  sportType === 'volei'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {sportType === 'volei' ? '🏐 Vôlei' : '⚽ Futebol'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div
                  onClick={() => setSportType('futebol')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-1.5 ${
                    sportType === 'futebol'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">⚽</span>
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      Futebol
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Gols, cronômetro & saldo
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setSportType('volei')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-1.5 ${
                    sportType === 'volei'
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">🏐</span>
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      Vôlei
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Até 12 pts, sem empate
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO DE IDENTIDADE VISUAL: CAPA E LOGO */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                🎨 Identidade Visual (Capa e Logo da Liga)
              </span>

              {/* Upload da Imagem de Capa (Banner) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Imagem de Capa (Banner da Liga)
                </label>
                <div
                  onClick={() => fileInputCoverRef.current?.click()}
                  className="relative h-24 sm:h-28 w-full rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-slate-100 dark:bg-slate-800/80 cursor-pointer group transition-all flex items-center justify-center"
                >
                  {coverPreview ? (
                    <>
                      <img
                        src={coverPreview}
                        alt="Preview da Capa"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-4 h-4" />
                        <span>Trocar Capa</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 group-hover:text-amber-500 transition-colors">
                      <ImagePlus className="w-6 h-6 text-amber-500" />
                      <span className="text-xs font-bold">Toque para adicionar imagem de capa</span>
                      <span className="text-[10px] opacity-75">PNG, JPG ou WEBP (Recomendado 1920x1080)</span>
                    </div>
                  )}

                  {coverPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverFile(null);
                        setCoverPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-white shadow-md z-10 transition-colors"
                      title="Remover Capa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputCoverRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
              </div>

              {/* Upload da Foto / Logo de Identificação da Liga */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Logo / Foto de Identificação da Liga
                </label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => fileInputLogoRef.current?.click()}
                    className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 border-dashed border-amber-500/50 bg-slate-100 dark:bg-slate-800 hover:border-amber-500 cursor-pointer group flex items-center justify-center shrink-0 shadow-sm"
                  >
                    {logoPreview ? (
                      <>
                        <img
                          src={logoPreview}
                          alt="Preview do Logo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Camera className="w-4 h-4" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-amber-500">
                        <Camera className="w-5 h-5" />
                        <span className="text-[9px] font-bold mt-0.5">Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => fileInputLogoRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{logoPreview ? 'Alterar Logo' : 'Escolher Logo'}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Foto em destaque no card e cabeçalho da Liga (formato quadrado).
                    </p>
                  </div>

                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                      title="Remover Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputLogoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Nome da Liga */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Liga *
              </label>
              <div className="relative">
                <Trophy className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Observação / Descrição */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observação / Descrição da Liga
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* SENHA DE ACESSO EXCLUSIVA DA LIGA */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  🔒 Senha de Acesso Exclusiva da Liga
                </span>
                {accessPassword.trim() ? (
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                    Liga Protegida
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                    Liga Pública
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Você pode visualizar, alterar ou remover a senha da liga. Caso altere a senha, a nova senha passará a ser exigida para as próximas entradas de jogadores.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sem senha (liga pública) ou digite nova senha..."
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-medium"
                  />
                  {accessPassword && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {accessPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(accessPassword);
                      setCopiedPassword(true);
                      toast.success('Senha copiada para a área de transferência! 📋');
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="px-3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="Copiar Senha para Enviar aos Jogadores"
                  >
                    {copiedPassword ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copiada</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Dados PIX */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Dados Padrão de Pagamento PIX
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    placeholder="Chave PIX"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Nome do Titular
                  </label>
                  <input
                    type="text"
                    placeholder="Nome de quem recebe"
                    value={nomeRecebedor}
                    onChange={(e) => setNomeRecebedor(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Liga</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
