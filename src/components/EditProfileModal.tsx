'use client';

import React, { useState } from 'react';
import { Profile, SportType, FutebolPosition, FutebolDominantFoot, VoleiPosition, VoleiDominantHand } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/mediaCompressor';
import { UploadProgress } from '@/components/UploadProgress';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { X, Camera, Image as ImageIcon, User, Lock, Save, Loader2, Phone, Instagram, Facebook, Shield, KeyRound, Check, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cleanPhoneNumber } from '@/lib/phoneUtils';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileUpdated: () => void;
}

const POSICOES_FUTEBOL: FutebolPosition[] = [
  'Goleiro',
  'Zagueiro',
  'Lateral',
  'Volante',
  'Meia',
  'Ponta',
  'Atacante',
];

const POSICOES_VOLEI: VoleiPosition[] = [
  'Levantador',
  'Oposto',
  'Ponteiro',
  'Central',
  'Líbero',
  'Outra',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}) => {
  const { refreshUser } = useAuth();

  const [nome, setNome] = useState(profile.nome || '');
  const [apelido, setApelido] = useState(profile.apelido || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp || '');

  // Modalidades Esportivas
  const [sportTypes, setSportTypes] = useState<SportType[]>(
    profile.sport_types && profile.sport_types.length > 0
      ? profile.sport_types
      : ['futebol']
  );

  // Ficha Técnica - Futebol
  const [futebolPosition, setFutebolPosition] = useState<FutebolPosition>(
    profile.futebol_position || profile.posicao || 'Atacante'
  );
  const [futebolDominantFoot, setFutebolDominantFoot] = useState<FutebolDominantFoot>(
    profile.futebol_dominant_foot || profile.pe_dominante || 'Destro'
  );

  // Ficha Técnica - Vôlei
  const [voleiPosition, setVoleiPosition] = useState<VoleiPosition>(
    profile.volei_position || 'Ponteiro'
  );
  const [voleiDominantHand, setVoleiDominantHand] = useState<VoleiDominantHand>(
    profile.volei_dominant_hand || 'Destro'
  );

  const [timeCoracao, setTimeCoracao] = useState(profile.time_coracao || '');
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [facebook, setFacebook] = useState(profile.facebook || '');
  const [genero, setGenero] = useState<'masculino' | 'feminino'>(profile.genero || 'masculino');
  const [isPrivate, setIsPrivate] = useState<boolean>(profile.is_private || false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_url || null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('O nome é obrigatório.');
      return;
    }

    if (bio.length > 300) {
      toast.error('A biografia deve ter no máximo 300 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress(10);

      let newAvatarUrl = profile.avatar_url;
      let newCoverUrl = profile.cover_url;

      if (avatarFile) {
        setUploadProgress(30);
        const compressedAvatar = await compressImage(avatarFile, 800, 800);
        const avatarName = `${profile.id}_avatar_${Date.now()}.webp`;

        const { error: avatarErr } = await supabase.storage
          .from('avatars')
          .upload(avatarName, compressedAvatar, { upsert: true });

        if (avatarErr) {
          console.error('Erro ao enviar foto de perfil:', avatarErr);
          toast.error('Erro ao enviar foto de perfil: ' + avatarErr.message);
        } else {
          const { data: avatarPublicUrl } = supabase.storage.from('avatars').getPublicUrl(avatarName);
          newAvatarUrl = avatarPublicUrl.publicUrl;
        }
      }

      if (coverFile) {
        setUploadProgress(60);
        const compressedCover = await compressImage(coverFile, 1920, 1080);
        const coverName = `${profile.id}_cover_${Date.now()}.webp`;

        const { error: coverErr } = await supabase.storage
          .from('covers')
          .upload(coverName, compressedCover, { upsert: true });

        if (coverErr) {
          console.error('Erro ao enviar foto de capa:', coverErr);
          toast.error('Erro ao enviar foto de capa: ' + coverErr.message);
        } else {
          const { data: coverPublicUrl } = supabase.storage.from('covers').getPublicUrl(coverName);
          newCoverUrl = coverPublicUrl.publicUrl;
        }
      }

      setUploadProgress(90);

      const cleanPhone = cleanPhoneNumber(whatsapp);
      const updatePayload: Record<string, any> = {
        nome: nome.trim(),
        apelido: apelido.trim() || null,
        bio: bio.trim() || null,
        whatsapp: cleanPhone || null,
        genero: genero,
        time_coracao: timeCoracao.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        is_private: isPrivate,
        avatar_url: newAvatarUrl,
        cover_url: newCoverUrl,
        sport_types: sportTypes,
        futebol_position: sportTypes.includes('futebol') ? futebolPosition : null,
        futebol_dominant_foot: sportTypes.includes('futebol') ? futebolDominantFoot : null,
        posicao: sportTypes.includes('futebol') ? futebolPosition : (profile.posicao || null),
        pe_dominante: sportTypes.includes('futebol') ? futebolDominantFoot : (profile.pe_dominante || null),
        volei_position: sportTypes.includes('volei') ? voleiPosition : null,
        volei_dominant_hand: sportTypes.includes('volei') ? voleiDominantHand : null,
      };

      let { error: updateErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id);

      // Fallback resiliente caso alguma coluna nova não exista na tabela profiles
      if (updateErr) {
        console.warn('Tentando salvar perfil com fallback de compatibilidade...', updateErr);
        delete updatePayload.sport_types;
        delete updatePayload.futebol_position;
        delete updatePayload.futebol_dominant_foot;
        delete updatePayload.volei_position;
        delete updatePayload.volei_dominant_hand;

        const { error: fallbackErr } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', profile.id);

        updateErr = fallbackErr;
      }

      if (updateErr) {
        console.error(updateErr);
        toast.error('Erro ao atualizar perfil no banco.');
      } else {
        toast.success('Perfil atualizado com sucesso!');
        await refreshUser();
        onProfileUpdated();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao atualizar.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const toggleSport = (sport: SportType) => {
    setSportTypes((prev) => {
      const exists = prev.includes(sport);
      if (exists) {
        if (prev.length === 1) {
          toast.info('Selecione pelo menos uma modalidade de interesse.');
          return prev;
        }
        return prev.filter((s) => s !== sport);
      } else {
        return [...prev, sport];
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 relative">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500" />
            <span>Editar Perfil Esportivo & Pessoal</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Foto de Capa */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Foto de Capa</span>
              <span className="text-[10px] text-slate-400">Recomendado 1920x1080</span>
            </label>
            <div className="relative h-32 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group">
              {coverPreview ? (
                <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                </div>
              )}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-bold text-xs cursor-pointer transition-opacity">
                <Camera className="w-5 h-5" />
                <span>Alterar Capa</span>
                <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Foto de Perfil */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-emerald-500 shrink-0 group">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-xl text-emerald-500">
                  {nome.charAt(0).toUpperCase()}
                </div>
              )}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                <Camera className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div className="text-xs space-y-1">
              <span className="font-extrabold text-slate-900 dark:text-white block">Foto de Perfil</span>
              <p className="text-slate-400">Clique sobre a foto para alterar. Recomendado formato quadrado.</p>
            </div>
          </div>

          {/* Nome e Apelido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Completo *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Apelido / Nome de Jogo</label>
              <input
                type="text"
                placeholder="Ex: Canhotinha, Paredão..."
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* SELEÇÃO DE MODALIDADES ESPORTIVAS */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-emerald-500" />
                <span>Modalidades Esportivas Praticadas</span>
              </label>
              <span className="text-[10px] text-slate-400">
                Selecione uma ou ambas
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Quais modalidades você pratica ou tem interesse? A seleção personaliza as fichas técnicas do seu perfil e não impede você de participar de nenhuma liga.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Checkbox Futebol */}
              <div
                onClick={() => toggleSport('futebol')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  sportTypes.includes('futebol')
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⚽</span>
                  <div>
                    <span className="text-xs font-black block text-slate-900 dark:text-white">Futebol</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Campo, society, futsal</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  sportTypes.includes('futebol')
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {sportTypes.includes('futebol') && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* Checkbox Vôlei */}
              <div
                onClick={() => toggleSport('volei')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  sportTypes.includes('volei')
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🏐</span>
                  <div>
                    <span className="text-xs font-black block text-slate-900 dark:text-white">Vôlei</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Quadra e areia</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  sportTypes.includes('volei')
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {sportTypes.includes('volei') && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>
          </div>

          {/* FICHA TÉCNICA DINÂMICA: FUTEBOL */}
          {sportTypes.includes('futebol') && (
            <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/20 space-y-3">
              <label className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>⚽</span>
                  <span>Ficha Técnica — Futebol</span>
                </span>
                <span className="text-[10px] text-emerald-500 font-medium">Futebol</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Posição Preferida no Futebol
                  </label>
                  <select
                    value={futebolPosition}
                    onChange={(e: any) => setFutebolPosition(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {POSICOES_FUTEBOL.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pé Dominante
                  </label>
                  <select
                    value={futebolDominantFoot}
                    onChange={(e: any) => setFutebolDominantFoot(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Destro">Destro (Pé Direito)</option>
                    <option value="Canhoto">Canhoto (Pé Esquerdo)</option>
                    <option value="Ambidestro">Ambidestro (Ambos os Pés)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* FICHA TÉCNICA DINÂMICA: VÔLEI */}
          {sportTypes.includes('volei') && (
            <div className="p-3.5 bg-amber-500/5 dark:bg-amber-950/20 rounded-2xl border border-amber-500/20 space-y-3">
              <label className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>🏐</span>
                  <span>Ficha Técnica — Vôlei</span>
                </span>
                <span className="text-[10px] text-amber-500 font-medium">Vôlei</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Posição Preferida no Vôlei
                  </label>
                  <select
                    value={voleiPosition}
                    onChange={(e: any) => setVoleiPosition(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {POSICOES_VOLEI.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mão Dominante
                  </label>
                  <select
                    value={voleiDominantHand}
                    onChange={(e: any) => setVoleiDominantHand(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Destro">Destro / Direita</option>
                    <option value="Canhoto">Canhoto / Esquerda</option>
                    <option value="Ambidestro">Ambidestro</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Time do Coração */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Time do Coração (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Flamengo, Palmeiras, Sada Cruzeiro..."
              value={timeCoracao}
              onChange={(e) => setTimeCoracao(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
            />
          </div>

          {/* Biografia */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Biografia</label>
              <span className={`text-[10px] ${bio.length > 300 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                {bio.length}/300
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={300}
              placeholder="Ex: Apaixonado por futebol desde criança. Atacante de velocidade nos jogos de fim de semana."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none resize-none"
            />
          </div>

          {/* Gênero */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gênero</label>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => setGenero('masculino')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  genero === 'masculino'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <span>♂ Masculino</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => setGenero('feminino')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  genero === 'feminino'
                    ? 'bg-pink-500/10 border-pink-500 text-pink-600 dark:text-pink-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <span>♀ Feminino</span>
              </motion.button>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Número de WhatsApp</span>
            </label>
            <input
              type="text"
              placeholder="Ex: (11) 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
            />
          </div>

          {/* Redes Sociais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-500" />
                <span>Link / Usuário do Instagram</span>
              </label>
              <input
                type="text"
                placeholder="Ex: @seu_instagram ou link"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-600" />
                <span>Link do Facebook</span>
              </label>
              <input
                type="text"
                placeholder="Ex: facebook.com/seu.perfil"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Privacidade */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-brand-500" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Perfil Privado</span>
                <span className="text-[10px] text-slate-400">
                  Somente amigos verão suas estatísticas e publicações.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          {/* Alterar Senha */}
          <div className="p-3 bg-gradient-to-r from-brand-50 to-emerald-50 dark:from-brand-950/30 dark:to-emerald-950/30 rounded-2xl border border-brand-200 dark:border-brand-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-brand-500" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Alterar Senha</span>
                <span className="text-[10px] text-slate-400">
                  Redefina a senha de acesso da sua conta.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-[11px] rounded-xl shadow-sm transition-all"
            >
              Alterar
            </button>
          </div>

          {uploadProgress !== null && <UploadProgress progress={uploadProgress} label="Atualizando perfil..." />}

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Modal de Alteração de Senha */}
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      </div>
    </div>
  );
};
