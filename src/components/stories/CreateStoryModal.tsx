'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UploadCloud, 
  Camera, 
  Type, 
  Smile, 
  Sparkles, 
  Clock, 
  Layers, 
  Trash2, 
  Check, 
  ChevronDown,
  Image as ImageIcon
} from 'lucide-react';
import { publishStory } from '@/lib/storiesHelper';
import { Story, StoryOverlay, OverlayStyle } from '@/types/stories';
import { toast } from 'sonner';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  userAvatar?: string | null;
  userName?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  onStoryCreated?: (newStory: Story) => void;
}

// Catálogo de figurinhas esportivas pré-definidas
const SPORT_STICKERS = [
  { id: 'st_gol', label: 'Golaço!', icon: '⚽', bgColor: 'bg-emerald-600', textColor: 'text-white' },
  { id: 'st_mvp', label: 'MVP da Rodada', icon: '🏆', bgColor: 'bg-amber-500', textColor: 'text-slate-950 font-black' },
  { id: 'st_resenha', label: 'Resenha Pura', icon: '🔥', bgColor: 'bg-rose-600', textColor: 'text-white' },
  { id: 'st_lider', label: 'Segue o Líder!', icon: '💥', bgColor: 'bg-blue-600', textColor: 'text-white' },
  { id: 'st_paredao', label: 'Paredão!', icon: '🧤', bgColor: 'bg-cyan-600', textColor: 'text-white' },
  { id: 'st_gaveta', label: 'Na Gaveta!', icon: '🎯', bgColor: 'bg-purple-600', textColor: 'text-white' },
  { id: 'st_craque', label: 'Craque do Jogo', icon: '⚡', bgColor: 'bg-yellow-400', textColor: 'text-slate-900 font-black' },
  { id: 'st_volei', label: 'Ponto de Vôlei!', icon: '🏐', bgColor: 'bg-orange-500', textColor: 'text-white' },
  { id: 'st_churras', label: 'Churrasco Pós-Jogo', icon: '🥩', bgColor: 'bg-amber-700', textColor: 'text-white' },
  { id: 'st_cerveja', label: 'Sextou na Resenha', icon: '🍻', bgColor: 'bg-emerald-500', textColor: 'text-white' },
  { id: 'st_campeao', label: 'Campeão!', icon: '🥇', bgColor: 'bg-gradient-to-r from-amber-400 to-yellow-500', textColor: 'text-black' },
  { id: 'st_recado', label: 'RECADO DO CAMPEÃO!', icon: '📢', bgColor: 'bg-emerald-500', textColor: 'text-white' },
];

const SPORT_EMOJIS = [
  '⚽', '🏐', '🏆', '🔥', '💥', '⚡', '🥇', '🎯', '🚀', '👟', '🧤', '🍻', '🥩', '👑', '😎', '👏', '💪', '🇧🇷', '🤙', '🤩'
];

const COLOR_PRESETS = [
  { name: 'Verde', hex: '#22c55e', bg: 'bg-emerald-500', text: '#ffffff' },
  { name: 'Amarelo', hex: '#eab308', bg: 'bg-yellow-500', text: '#000000' },
  { name: 'Vermelho', hex: '#ef4444', bg: 'bg-rose-500', text: '#ffffff' },
  { name: 'Azul', hex: '#3b82f6', bg: 'bg-blue-500', text: '#ffffff' },
  { name: 'Roxo', hex: '#a855f7', bg: 'bg-purple-500', text: '#ffffff' },
  { name: 'Preto', hex: '#0f172a', bg: 'bg-slate-900', text: '#ffffff' },
  { name: 'Branco', hex: '#ffffff', bg: 'bg-white', text: '#000000' },
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  userAvatar,
  userName,
  leagueId,
  leagueName,
  onStoryCreated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [isLeagueExclusive, setIsLeagueExclusive] = useState(Boolean(leagueId));

  // Overlays (Textos e Figurinhas)
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Modais de ferramentas
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [isStickerDrawerOpen, setIsStickerDrawerOpen] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [editingColor, setEditingColor] = useState(COLOR_PRESETS[0]);
  const [editingStyle, setEditingStyle] = useState<OverlayStyle>('pill');

  // Upload status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state
  const draggingRef = useRef<{ id: string; startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleClose = () => {
    if (isUploading) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setOverlays([]);
    setSelectedOverlayId(null);
    setIsTextEditorOpen(false);
    setIsStickerDrawerOpen(false);
    setDurationSeconds(5);
    setUploadProgress(0);
    setStatusMessage('');
    onClose();
  };

  const handleSelectFile = (selectedFile: File) => {
    const isVid = selectedFile.type.startsWith('video/');
    const isImg = selectedFile.type.startsWith('image/');

    if (!isVid && !isImg) {
      toast.error('Formato de mídia não suportado. Envie uma foto ou vídeo.');
      return;
    }

    const maxSize = isVid ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(`Arquivo muito grande! Limite de ${isVid ? '50MB' : '15MB'}.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(selectedFile);
    setMediaType(isVid ? 'video' : 'image');
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  // ADICIONAR NOVO TEXTO
  const handleOpenTextEditor = () => {
    setEditingText('');
    setEditingColor(COLOR_PRESETS[0]);
    setEditingStyle('pill');
    setIsTextEditorOpen(true);
  };

  const handleSaveTextOverlay = () => {
    if (!editingText.trim()) {
      setIsTextEditorOpen(false);
      return;
    }

    const newOverlay: StoryOverlay = {
      id: `text_${Date.now()}`,
      type: 'text',
      text: editingText.trim(),
      color: editingColor.text,
      bgColor: editingColor.hex,
      style: editingStyle,
      fontSize: 18,
      x: 50, // Centro horizontal (50%)
      y: 45, // Meio (45%)
    };

    setOverlays((prev) => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    setIsTextEditorOpen(false);
    setEditingText('');
  };

  // ADICIONAR FIGURINHA
  const handleAddSticker = (sticker: { label: string; icon: string; bgColor: string; textColor: string }) => {
    const newOverlay: StoryOverlay = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      label: sticker.label,
      sticker: sticker.icon,
      bgColor: sticker.bgColor,
      color: sticker.textColor,
      style: 'pill',
      x: 50,
      y: 65,
    };

    setOverlays((prev) => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    setIsStickerDrawerOpen(false);
  };

  const handleAddEmoji = (emoji: string) => {
    const newOverlay: StoryOverlay = {
      id: `emoji_${Date.now()}`,
      type: 'sticker',
      sticker: emoji,
      x: 50,
      y: 55,
      fontSize: 48,
    };

    setOverlays((prev) => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    setIsStickerDrawerOpen(false);
  };

  const handleDeleteSelectedOverlay = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  // ARRASTAR OVERLAYS NA TELA
  const handleOverlayPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedOverlayId(id);

    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;

    draggingRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: overlay.x,
      initialY: overlay.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !previewContainerRef.current) return;

    const { id, startX, startY, initialX, initialY } = draggingRef.current;
    const rect = previewContainerRef.current.getBoundingClientRect();

    const deltaXPercent = ((e.clientX - startX) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - startY) / rect.height) * 100;

    const newX = Math.min(Math.max(initialX + deltaXPercent, 10), 90);
    const newY = Math.min(Math.max(initialY + deltaYPercent, 10), 90);

    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x: newX, y: newY } : o))
    );
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  // PUBLICAR O STORY
  const handlePublish = async () => {
    if (!file || !currentUserId) {
      toast.error('Selecione uma imagem ou vídeo para publicar.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);
      setStatusMessage('Otimizando mídia...');

      const newStory = await publishStory({
        file,
        durationSeconds: mediaType === 'image' ? durationSeconds : 15,
        organizationId: isLeagueExclusive ? leagueId : null,
        userId: currentUserId,
        overlays: overlays,
        onProgress: (p) => {
          setUploadProgress(p);
          if (p < 30) setStatusMessage('Otimizando mídia...');
          else if (p < 80) setStatusMessage('Enviando para a nuvem...');
          else setStatusMessage('Finalizando publicação...');
        },
      });

      toast.success('Story publicado com sucesso! 🚀');
      onStoryCreated?.(newStory);
      handleClose();
    } catch (err: any) {
      console.error('Erro ao publicar story:', err);
      toast.error(err.message || 'Erro ao publicar story.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
          className="hidden"
        />

        {/* =========================================================================
            ESTADO 1: ESCOLHER ARQUIVO INICIAL (SE NENHUM FOI SELECIONADO)
           ========================================================================= */}
        {!file ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl mx-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base text-white">Criar Story</h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-3xl p-10 cursor-pointer transition-all flex flex-col items-center justify-center gap-3 bg-slate-800/40 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="font-black text-sm text-white">Escolha uma foto ou vídeo</p>
                <p className="text-xs text-slate-400 mt-1">Fotos ou vídeos verticais de até 50MB</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Câmera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>Galeria</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* =========================================================================
             ESTADO 2: EDITOR COMPLETO ESTILO INSTAGRAM / FACEBOOK STORIES
             ========================================================================= */
          <div 
            ref={previewContainerRef}
            onClick={() => setSelectedOverlayId(null)}
            className="relative w-full h-full sm:h-[92vh] sm:max-w-md sm:max-h-[850px] bg-black sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl border-0 sm:border sm:border-slate-800"
          >
            {/* BARRA SUPERIOR DE FERRAMENTAS (X, Aa, Figurinhas) */}
            <div className="absolute top-0 inset-x-0 z-30 p-4 pt-4 sm:pt-5 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              {/* Botão Fechar / Trocar */}
              <button
                onClick={handleClose}
                disabled={isUploading}
                className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                title="Voltar / Descartar"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Ferramentas: Aa (Texto) e Figurinhas */}
              <div className="flex items-center gap-2.5">
                {/* Botão Aa (Texto Personalizado) */}
                <button
                  onClick={handleOpenTextEditor}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-white/20 text-white font-black text-sm flex items-center gap-1.5 backdrop-blur-md border border-white/10 transition-all cursor-pointer"
                  title="Adicionar texto no story"
                >
                  <Type className="w-4 h-4 text-emerald-400" />
                  <span>Aa</span>
                </button>

                {/* Botão Figurinhas / Stickers */}
                <button
                  onClick={() => setIsStickerDrawerOpen(true)}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-full bg-black/40 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer"
                  title="Figurinhas e Badges Esportivos"
                >
                  <Smile className="w-5 h-5 text-amber-400" />
                </button>
              </div>
            </div>

            {/* MÍDIA DE FUNDO (FOTO OU VÍDEO) */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {mediaType === 'video' ? (
                <video
                  src={previewUrl!}
                  controls={false}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain pointer-events-none"
                />
              ) : (
                <img
                  src={previewUrl!}
                  alt="Story preview"
                  className="w-full h-full object-contain pointer-events-none"
                />
              )}

              {/* OVERLAYS RENDERIZADOS NA TELA COM SUPORTE A ARRASTAR */}
              {overlays.map((ov) => {
                const isSelected = selectedOverlayId === ov.id;

                return (
                  <div
                    key={ov.id}
                    onPointerDown={(e) => handleOverlayPointerDown(ov.id, e)}
                    className="absolute cursor-grab active:cursor-grabbing transition-transform touch-none"
                    style={{
                      left: `${ov.x}%`,
                      top: `${ov.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: isSelected ? 40 : 20,
                    }}
                  >
                    <div
                      className={`relative group ${
                        isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
                      } rounded-2xl`}
                    >
                      {/* TEXTO OVERLAY */}
                      {ov.type === 'text' && (
                        <div
                          className={`px-4 py-2 rounded-2xl font-black text-sm sm:text-base leading-tight shadow-xl drop-shadow-md whitespace-pre-wrap select-none text-center ${
                            ov.style === 'pill'
                              ? 'bg-opacity-95'
                              : ov.style === 'neon'
                              ? 'border-2 border-emerald-400 text-emerald-400 bg-black/60 shadow-emerald-500/50'
                              : 'bg-black/60 text-white backdrop-blur-xs'
                          }`}
                          style={{
                            backgroundColor: ov.style === 'pill' ? ov.bgColor : undefined,
                            color: ov.color,
                          }}
                        >
                          {ov.text}
                        </div>
                      )}

                      {/* FIGURINHA / BADGE OVERLAY */}
                      {ov.type === 'sticker' && ov.label && (
                        <div
                          className={`px-3.5 py-1.5 rounded-full font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xl select-none ${
                            ov.bgColor || 'bg-emerald-500'
                          } ${ov.color || 'text-white'}`}
                        >
                          <span className="text-base sm:text-lg">{ov.sticker}</span>
                          <span>{ov.label}</span>
                        </div>
                      )}

                      {/* EMOJI GIGANTE */}
                      {ov.type === 'sticker' && !ov.label && (
                        <div className="text-5xl select-none filter drop-shadow-lg">
                          {ov.sticker}
                        </div>
                      )}

                      {/* Botão de Exclusão quando Selecionado */}
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSelectedOverlay(ov.id, e)}
                          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* BARRA INFERIOR (COMPARTILHAR STORY COM AVATAR DO USUÁRIO) */}
            <div className="absolute bottom-0 inset-x-0 z-30 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3">
              {/* Opções rápidas de duração e liga (se aplicável) */}
              <div className="flex items-center justify-between px-1">
                {mediaType === 'image' && (
                  <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-white text-[11px] font-bold">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Duração:</span>
                    {[3, 5, 10, 15].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDurationSeconds(s)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                          durationSeconds === s ? 'bg-emerald-500 text-white' : 'text-slate-300'
                        }`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                )}

                {leagueName && (
                  <button
                    type="button"
                    onClick={() => setIsLeagueExclusive((prev) => !prev)}
                    className={`ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                      isLeagueExclusive
                        ? 'bg-emerald-500/30 border-emerald-500 text-emerald-300'
                        : 'bg-black/50 border-white/10 text-slate-300'
                    }`}
                  >
                    <span>{isLeagueExclusive ? `Liga: ${leagueName}` : 'Público'}</span>
                  </button>
                )}
              </div>

              {/* Progresso durante envio */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-white px-1">
                    <span>{statusMessage}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* BOTÃO PRINCIPAL: PÍLULA ESTILO FACEBOOK/INSTAGRAM "Compartilhar story" */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={handlePublish}
                disabled={isUploading}
                className="w-full sm:w-auto mx-auto px-6 py-3 rounded-full bg-white text-slate-950 font-black text-xs sm:text-sm shadow-2xl flex items-center justify-center gap-2.5 cursor-pointer hover:bg-slate-100 transition-all border border-slate-200"
              >
                {/* Avatar do Usuário */}
                <div className="w-6 h-6 rounded-full overflow-hidden bg-emerald-500 flex items-center justify-center text-white text-xs font-black shrink-0">
                  {userAvatar ? (
                    <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    userName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <span>{isUploading ? 'Publicando...' : 'Compartilhar story'}</span>
              </motion.button>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL OVERLAY: EDITOR DE TEXTO (Aa)
           ========================================================================= */}
        <AnimatePresence>
          {isTextEditorOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 bg-black/90 backdrop-blur-lg"
              onClick={() => setIsTextEditorOpen(false)}
            >
              {/* Top Bar do Editor de Texto */}
              <div 
                className="w-full max-w-md flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  {(['pill', 'solid', 'neon'] as OverlayStyle[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditingStyle(st)}
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase transition-all ${
                        editingStyle === st ? 'bg-white text-black' : 'bg-white/10 text-white'
                      }`}
                    >
                      {st === 'pill' ? 'Pílula' : st === 'neon' ? 'Neon' : 'Sólido'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveTextOverlay}
                  className="px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1 shadow-lg"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluir</span>
                </button>
              </div>

              {/* Campo Central de Digitação */}
              <div 
                className="w-full max-w-md my-auto flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value.slice(0, 100))}
                  placeholder="Digite seu texto..."
                  rows={2}
                  className="w-full text-center bg-transparent border-none text-2xl sm:text-3xl font-black text-white placeholder:text-white/40 focus:outline-none resize-none px-4"
                  style={{
                    color: editingColor.text,
                    textShadow: editingStyle === 'neon' ? `0 0 20px ${editingColor.hex}` : '0 2px 10px rgba(0,0,0,0.8)',
                  }}
                />
              </div>

              {/* Paleta Inferior de Cores */}
              <div 
                className="w-full max-w-md flex items-center justify-center gap-2.5 pb-4 overflow-x-auto py-2"
                onClick={(e) => e.stopPropagation()}
              >
                {COLOR_PRESETS.map((cp) => (
                  <button
                    key={cp.name}
                    type="button"
                    onClick={() => setEditingColor(cp)}
                    className={`w-8 h-8 rounded-full ${cp.bg} border-2 transition-transform ${
                      editingColor.hex === cp.hex ? 'scale-125 border-white shadow-lg' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =========================================================================
            MODAL OVERLAY: GAVETA DE FIGURINHAS E BADGES ESPORTIVOS
           ========================================================================= */}
        <AnimatePresence>
          {isStickerDrawerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[75vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smile className="w-5 h-5 text-amber-400" />
                  <h3 className="font-extrabold text-sm text-white">Figurinhas & Badges</h3>
                </div>
                <button
                  onClick={() => setIsStickerDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-1 py-4 space-y-4">
                {/* Badges Esportivos */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    Badges do Jogo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SPORT_STICKERS.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleAddSticker(st)}
                        className={`px-3 py-1.5 rounded-full font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all ${st.bgColor} ${st.textColor}`}
                      >
                        <span>{st.icon}</span>
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emojis Rápidos */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    Emojis da Galera
                  </p>
                  <div className="grid grid-cols-5 gap-3">
                    {SPORT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleAddEmoji(emoji)}
                        className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-3xl flex items-center justify-center hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
