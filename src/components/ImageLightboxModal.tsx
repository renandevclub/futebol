'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Shield, User, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export interface LightboxPreviewData {
  isOpen: boolean;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  type?: 'team_badge' | 'avatar' | 'media' | 'league_logo';
}

interface ImageLightboxModalProps {
  data: LightboxPreviewData | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  data,
  onClose,
}) => {
  // Fechar no ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (data?.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data?.isOpen, onClose]);

  if (!data || !data.isOpen || !data.imageUrl) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(data.imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanTitle = (data.title || 'imagem')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      link.download = `${cleanTitle}_${Date.now()}.${data.type === 'team_badge' || data.type === 'league_logo' ? 'png' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download concluído!');
    } catch (err) {
      console.error(err);
      window.open(data.imageUrl, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 select-none"
      >
        {/* Painel do Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-lg w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col items-center text-center text-white"
        >
          {/* Efeitos de Iluminação de Fundo */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Barra Superior de Ações */}
          <div className="w-full flex items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-800 relative z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              {data.type === 'team_badge' ? (
                <>
                  <Shield className="w-4 h-4 text-brand-400" />
                  <span>Emblema do Time</span>
                </>
              ) : data.type === 'league_logo' ? (
                <>
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Foto de Perfil da Liga</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>Foto de Perfil</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Baixar Imagem"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área da Imagem Ampliada (Preservando Proporção 1:1 e Dimensões Originais) */}
          <div className="w-full max-h-[62vh] min-h-[220px] flex items-center justify-center p-3 relative z-10">
            {data.type === 'team_badge' || data.type === 'league_logo' ? (
              <div className="relative p-4 rounded-3xl bg-slate-950/70 border border-slate-800/90 shadow-inner max-w-full max-h-[55vh] flex items-center justify-center">
                <img
                  src={data.imageUrl}
                  alt={data.title || 'Foto da Liga'}
                  className="max-h-[48vh] max-w-full object-contain rounded-2xl drop-shadow-2xl transition-transform hover:scale-[1.02] duration-300"
                />
              </div>
            ) : (
              <div className="relative p-2 rounded-full bg-slate-950/70 border-2 border-slate-700/80 shadow-2xl overflow-hidden aspect-square max-w-[280px] sm:max-w-[320px] max-h-[48vh] flex items-center justify-center">
                <img
                  src={data.imageUrl}
                  alt={data.title || 'Foto de Perfil'}
                  className="w-full h-full object-cover rounded-full drop-shadow-2xl"
                />
              </div>
            )}
          </div>

          {/* Rodapé Informativo / Legenda */}
          <div className="w-full pt-3 mt-2 border-t border-slate-800/80 space-y-1 relative z-10">
            {data.title && (
              <h3 className="font-black text-base sm:text-lg text-white truncate">
                {data.title}
              </h3>
            )}
            {data.subtitle && (
              <p className="text-xs text-slate-400 font-medium">
                {data.subtitle}
              </p>
            )}
            {data.badge && (
              <div className="inline-block mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  {data.badge}
                </span>
              </div>
            )}
          </div>

          {/* Dica para Fechar */}
          <p className="text-[10px] text-slate-400 mt-3 relative z-10">
            Toque fora da imagem ou pressione ESC para fechar
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
