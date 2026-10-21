'use client';

import { motion, PanInfo } from 'framer-motion';

import React, { useState, useEffect } from 'react';
import { Profile, Post, PostVisibility } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { compressImage } from '@/lib/mediaCompressor';
import { UploadProgress } from '@/components/UploadProgress';
import { X, Image as ImageIcon, Video, Send, Sparkles, Smile, MapPin, Users, Lock, Globe, Pencil, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  targetUserId?: string; // Se preenchido, publica no mural deste usuário
  postToEdit?: Post | null;
  leagueId?: string | null;
  leagueName?: string | null;
}

const COMMON_EMOJIS = ['🏐', '🔥', '👏', '😍', '💪', '🏆', '🎉', '💯', '❤️', '⚡', '🥇', '⭐'];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  targetUserId,
  postToEdit,
  leagueId,
  leagueName,
}) => {
  const { user } = useAuth();
  const { currentLeague, leagues } = useLeague();
  
  const effectiveLeagueId = leagueId || postToEdit?.organization_id || (!targetUserId ? currentLeague?.id : null) || null;
  const effectiveLeague = effectiveLeagueId ? (leagues.find((l) => l.id === effectiveLeagueId) || currentLeague) : null;
  const displayLeagueName = leagueName || effectiveLeague?.name || null;
  const [texto, setTexto] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [visibilidade, setVisibilidade] = useState<PostVisibility>('publica');
  const [location, setLocation] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTagUsers, setShowTagUsers] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (postToEdit) {
        setTexto(postToEdit.texto || '');
        setLocation(postToEdit.location || '');
        setVisibilidade(postToEdit.visibilidade || 'publica');
        setSelectedTagIds(postToEdit.tagged_user_ids || []);
        setPreviewUrl(postToEdit.imagem_url || postToEdit.video_url || null);
        setMediaType(postToEdit.imagem_url ? 'image' : postToEdit.video_url ? 'video' : null);
      } else {
        setTexto('');
        setFile(null);
        setMediaType(null);
        setPreviewUrl(null);
        setVisibilidade('publica');
        setLocation('');
        setSelectedTagIds([]);
      }

      const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*').order('nome');
        if (data) setAllProfiles(data.filter((p) => p.id !== user?.id));
      };
      fetchProfiles();
    }
  }, [isOpen, user?.id, postToEdit]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type.startsWith('image/')) {
      setMediaType('image');
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } else if (selectedFile.type.startsWith('video/')) {
      setMediaType('video');
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      toast.error('Selecione uma imagem ou vídeo válido.');
    }
  };

  const toggleTagUser = (profileId: string) => {
    if (selectedTagIds.includes(profileId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== profileId));
    } else {
      setSelectedTagIds([...selectedTagIds, profileId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Identifique-se para publicar.');
      return;
    }

    if (!texto.trim() && !file) {
      toast.error('Escreva uma mensagem ou selecione uma mídia.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);

      let imagemUrl: string | null = null;
      let videoUrl: string | null = null;

      if (file) {
        setUploadProgress(40);
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;

        if (mediaType === 'image') {
          const compressed = await compressImage(file);
          const { error: uploadErr } = await supabase.storage
            .from('posts')
            .upload(fileName, compressed);

          if (uploadErr) throw uploadErr;
          const { data: publicUrl } = supabase.storage.from('posts').getPublicUrl(fileName);
          imagemUrl = publicUrl.publicUrl;
        } else if (mediaType === 'video') {
          const { error: uploadErr } = await supabase.storage
            .from('videos')
            .upload(fileName, file);

          if (uploadErr) throw uploadErr;
          const { data: publicUrl } = supabase.storage.from('videos').getPublicUrl(fileName);
          videoUrl = publicUrl.publicUrl;
        }
      }

      setUploadProgress(80);

      if (postToEdit) {
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            organization_id: postToEdit.organization_id || effectiveLeagueId,
            texto: texto.trim() || null,
            imagem_url: imagemUrl || postToEdit.imagem_url,
            video_url: videoUrl || postToEdit.video_url,
            visibilidade: visibilidade,
            location: location.trim() || null,
            tagged_user_ids: selectedTagIds,
          })
          .eq('id', postToEdit.id);

        if (updateError) throw updateError;
        toast.success('Publicação atualizada!');
      } else {
        const { data: createdPost, error: insertError } = await supabase
          .from('posts')
          .insert({
            author_id: user.id,
            organization_id: effectiveLeagueId,
            target_user_id: targetUserId || null,
            texto: texto.trim() || null,
            imagem_url: imagemUrl,
            video_url: videoUrl,
            visibilidade: visibilidade,
            location: location.trim() || null,
            tagged_user_ids: selectedTagIds,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        // Se houver foto/vídeo, registrar também na timeline_events
        if (imagemUrl || videoUrl) {
          await supabase.from('timeline_events').insert({
            user_id: user.id,
            event_type: videoUrl ? 'posted_video' : 'posted_photo',
            title: videoUrl ? 'Publicou um novo vídeo' : 'Publicou uma nova foto',
            description: texto.trim() || undefined,
            metadata: { post_id: createdPost.id, url: videoUrl || imagemUrl },
          });
        }
        toast.success('Publicação criada com sucesso!');
      }

      setUploadProgress(100);
      setTexto('');
      setFile(null);
      setMediaType(null);
      setPreviewUrl(null);
      setLocation('');
      setSelectedTagIds([]);
      onPostCreated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar publicação.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto space-y-4 pb-safe"
      >
        {/* Alça visual de arraste para Mobile */}
        <div className="pt-0.5 pb-2 sm:hidden flex justify-center cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              {postToEdit ? 'Editar Publicação' : targetUserId ? 'Publicar no Mural' : 'Criar Publicação'}
            </h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {displayLeagueName && !targetUserId && (
          <div className="flex items-center gap-2 px-3.5 py-2 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/80 rounded-2xl text-xs font-bold text-brand-700 dark:text-brand-300">
            <Shield className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="truncate">Publicação no feed de: <strong>{displayLeagueName}</strong></span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seletor de Visibilidade */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-500" />
              <span>Visibilidade:</span>
            </span>
            <select
              value={visibilidade}
              onChange={(e) => setVisibilidade(e.target.value as PostVisibility)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold px-3 py-1 rounded-xl focus:outline-none"
            >
              <option value="publica">🏐 Visível para toda a Liga</option>
              <option value="participantes">🛡️ Somente Participantes Oficiais</option>
              <option value="amigos">👥 Somente Amigos</option>
              <option value="privada">🔒 Somente Eu (Privada)</option>
            </select>
          </div>

          {/* Campo de Texto */}
          <textarea
            rows={4}
            placeholder="No que você está pensando?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white resize-none"
          />

          {/* Preview da Mídia */}
          {previewUrl && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 max-h-52 flex items-center justify-center border border-slate-700">
              {mediaType === 'image' && <img src={previewUrl} alt="Preview" className="max-h-52 object-contain" />}
              {mediaType === 'video' && <video src={previewUrl} controls className="max-h-52 object-contain" />}
              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                type="button"
                onClick={() => {
                  setFile(null);
                  setMediaType(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          )}

          {/* Emojis Rápidos */}
          {showEmojiPicker && (
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              {COMMON_EMOJIS.map((emoji) => (
                <motion.button
                  whileTap={{ scale: 0.75 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  key={emoji}
                  type="button"
                  onClick={() => setTexto((prev) => prev + ' ' + emoji)}
                  className="text-lg p-1 hover:scale-125 transition-transform"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          )}

          {/* Marcar Participantes */}
          {showTagUsers && (
            <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                Marcar participantes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {allProfiles.map((p) => {
                  const isSelected = selectedTagIds.includes(p.id);
                  return (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      key={p.id}
                      type="button"
                      onClick={() => toggleTagUser(p.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {p.nome}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campo de Localização */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
            <input
              type="text"
              placeholder="Localização opcional (Ex: Campo Society 10, Arena Futsal)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Barra de Opções e Mídia */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center gap-1">
              {/* Botão Upload Foto */}
              <label
                className="p-2 text-slate-500 hover:text-brand-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Adicionar Foto/Vídeo"
              >
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              </label>

              {/* Botão Emoji */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-slate-500 hover:text-amber-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Inserir Emoji"
              >
                <Smile className="w-5 h-5" />
              </motion.button>

              {/* Botão Marcar Amigos */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                type="button"
                onClick={() => setShowTagUsers(!showTagUsers)}
                className="p-2 text-slate-500 hover:text-brand-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Marcar Participantes"
              >
                <Users className="w-5 h-5" />
              </motion.button>
            </div>

            <span className="text-[11px] text-slate-400 font-semibold">
              {mediaType ? mediaType.toUpperCase() : 'Sem mídia'}
            </span>
          </div>

          {uploadProgress !== null && <UploadProgress progress={uploadProgress} label="Publicando mídia..." />}

          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            type="submit"
            disabled={isUploading}
            className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/25 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{postToEdit ? 'Salvar Alterações' : 'Publicar no Feed'}</span>
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};
