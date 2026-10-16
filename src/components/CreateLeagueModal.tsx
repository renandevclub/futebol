'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/mediaCompressor';
import { X, Trophy, ShieldCheck, FileText, QrCode, Smartphone, Sparkles, CheckCircle2, Camera, ImagePlus, Trash2, Upload, Lock, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import { SportType } from '@/types/database';

interface CreateLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeagueCreated?: (leagueId: string) => void;
}

export const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({
  isOpen,
  onClose,
  onLeagueCreated,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { createLeague, canCreateLeagues } = useLeague();

  const [sportType, setSportType] = useState<SportType>('futebol');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Imagem (Logo e Capa)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputCoverRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && user) {
      setWhatsapp(user.whatsapp || '');
      if (typeof window !== 'undefined') {
        const savedKey = localStorage.getItem('futresenha_chave_pix');
        const savedName = localStorage.getItem('futresenha_nome_pix');
        if (savedKey) setChavePix(savedKey);
        if (savedName) setNomeRecebedor(savedName);
      }
    }
  }, [isOpen, user]);

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

  if (!isOpen || !user) return null;

  // Se a permissão para criar ligas estiver bloqueada pelo Super Administrador
  if (!canCreateLeagues) {
    const superAdminPhone = '5591993370456';
    const message = encodeURIComponent(
      'Olá, Super Administrador! Minha permissão para criar novas ligas no F&V Sports está bloqueada. Gostaria de solicitar esclarecimentos e a liberação da criação de ligas.'
    );
    const whatsappUrl = `https://wa.me/${superAdminPhone}?text=${message}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-center space-y-4"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
              Permissão Bloqueada
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white pt-2">
              Criação de Ligas Bloqueada
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
              Sua permissão para criar novas ligas foi temporariamente bloqueada pelo <strong>Super Administrador</strong>.
              Você ainda tem acesso normal às ligas que já administra.
            </p>
          </div>

          <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-700 dark:text-amber-300 font-medium text-left">
            💡 Para solicitar a reativação da sua permissão de criação, fale diretamente com o Super Administrador.
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Falar com o Super Administrador</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Informe o nome da sua Liga.');
      return;
    }

    if (!description.trim()) {
      toast.error('Informe uma breve observação ou descrição para a Liga.');
      return;
    }

    try {
      setIsSubmitting(true);

      let finalLogoUrl: string | null = null;
      let finalCoverUrl: string | null = null;

      // 1. Upload do Logo se selecionado
      if (logoFile) {
        try {
          const compressedLogo = await compressImage(logoFile, 600, 600);
          const fileName = `league_logo_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
          const { error: uploadLogoErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, compressedLogo, { upsert: true });

          if (!uploadLogoErr) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            finalLogoUrl = urlData.publicUrl;
          } else {
            console.error('Erro ao enviar logo da liga:', uploadLogoErr);
          }
        } catch (e) {
          console.error('Erro ao processar logo:', e);
        }
      }

      // 2. Upload da Capa se selecionada
      if (coverFile) {
        try {
          const compressedCover = await compressImage(coverFile, 1920, 1080);
          const fileName = `league_cover_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
          const { error: uploadCoverErr } = await supabase.storage
            .from('covers')
            .upload(fileName, compressedCover, { upsert: true });

          if (!uploadCoverErr) {
            const { data: urlData } = supabase.storage.from('covers').getPublicUrl(fileName);
            finalCoverUrl = urlData.publicUrl;
          } else {
            console.error('Erro ao enviar capa da liga:', uploadCoverErr);
          }
        } catch (e) {
          console.error('Erro ao processar capa:', e);
        }
      }

      const result = await createLeague({
        name: name.trim(),
        sport_type: sportType,
        description: description.trim(),
        chave_pix_padrao: chavePix.trim() || undefined,
        nome_recebedor_pix: nomeRecebedor.trim() || undefined,
        organizer_whatsapp: whatsapp.trim() || undefined,
        logo_url: finalLogoUrl || undefined,
        cover_url: finalCoverUrl || undefined,
        access_password: accessPassword.trim() || undefined,
      });

      if (result.success && result.league) {
        setName('');
        setDescription('');
        setSportType('futebol');
        setAccessPassword('');
        setShowPassword(false);
        setLogoFile(null);
        setLogoPreview(null);
        setCoverFile(null);
        setCoverPreview(null);
        onClose();
        if (onLeagueCreated) {
          onLeagueCreated(result.league.id);
        }
      }
    } catch (err) {
      console.error('Erro ao criar liga:', err);
    } finally {
      setIsSubmitting(false);
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
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md shrink-0 transition-all ${
              sportType === 'volei'
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-orange-500/25'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25'
            }`}>
              {sportType === 'volei' ? '🏐' : '⚽'}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                Criar Nova Liga
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione a modalidade e personalize as regras da competição
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SELEÇÃO OBRIGATÓRIA DA MODALIDADE ESPORTIVA */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  🏅 Modalidade da Liga (Obrigatório) *
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  sportType === 'volei'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {sportType === 'volei' ? '🏐 Liga de Vôlei' : '⚽ Liga de Futebol'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Opção Futebol */}
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

                {/* Opção Vôlei */}
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
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                🎨 Identidade Visual (Capa e Logo da Liga)
              </span>

              {/* Upload da Imagem de Capa (Banner) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Imagem de Capa (Banner da Liga)
                </label>
                <div
                  onClick={() => fileInputCoverRef.current?.click()}
                  className="relative h-24 sm:h-28 w-full rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-100 dark:bg-slate-800/80 cursor-pointer group transition-all flex items-center justify-center"
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
                    <div className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors">
                      <ImagePlus className="w-6 h-6 text-emerald-500" />
                      <span className="text-xs font-bold">Toque para enviar imagem de capa</span>
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
                    className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/50 bg-slate-100 dark:bg-slate-800 hover:border-emerald-500 cursor-pointer group flex items-center justify-center shrink-0 shadow-sm"
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
                      <div className="flex flex-col items-center justify-center text-emerald-500">
                        <Camera className="w-5 h-5" />
                        <span className="text-[9px] font-bold mt-0.5">Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => fileInputLogoRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
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

            {/* Administrador Responsável (Automático) */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                👤
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Administrador Vinculado (Automático)
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                  {user?.nome} {user?.apelido && `(${user.apelido})`}
                </span>
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
                  placeholder="Ex: Liga Resenha FC, Futebol da Galera..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Observação / Descrição da Liga */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observação / Descrição da Liga *
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Partidas semanais de futebol entre amigos e convidados."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* SENHA DE ACESSO EXCLUSIVA (OPCIONAL) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  🔒 Senha de Acesso Exclusiva (Opcional)
                </span>
                {accessPassword.trim() && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    Liga Protegida
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Defina uma senha se desejar que apenas os jogadores que receberem a senha possam entrar e participar desta liga. Se deixar em branco, a liga será pública.
              </p>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ex: resenha2026, fut123... (deixe em branco se pública)"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
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
            </div>

            {/* Configurações de PIX Opcionais */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Dados Padrão de Pagamento PIX (Opcional)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    placeholder="Chave PIX da Liga"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Botão de Envio */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-2xl text-white font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  sportType === 'volei'
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 shadow-orange-500/25'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25'
                }`}
              >
                {isSubmitting ? (
                  <span>Criando Liga...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{sportType === 'volei' ? 'Criar Liga de Vôlei 🏐' : 'Criar Liga de Futebol ⚽'}</span>
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
