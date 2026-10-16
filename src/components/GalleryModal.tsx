'use client';

import { motion } from 'framer-motion';

import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export interface GalleryMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  title?: string;
}

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: GalleryMediaItem[];
  initialIndex?: number;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];

  const handlePrev = () => {
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentItem.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `futebol_media_${currentItem.id}.${currentItem.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download iniciado!');
    } catch (e) {
      console.error(e);
      window.open(currentItem.url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Controles Superiores */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        {currentItem.type === 'image' && (
          <>
            <motion.button
              whileTap={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={handleZoomIn}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={handleZoomOut}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-5 h-5" />
            </motion.button>
          </>
        )}
        <motion.button
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={handleDownload}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          title="Baixar Mídia"
        >
          <Download className="w-5 h-5" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={onClose}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Navegação Prev / Next */}
      {items.length > 1 && (
        <>
          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110 z-50"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110 z-50"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </>
      )}

      {/* Exibição da Mídia */}
      <div className="max-w-5xl max-h-[85vh] p-4 flex items-center justify-center overflow-auto">
        {currentItem.type === 'video' ? (
          <video
            src={currentItem.url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
          />
        ) : (
          <img
            src={currentItem.url}
            alt={currentItem.title || 'Mídia da Galeria'}
            style={{ transform: `scale(${zoomLevel})` }}
            className="max-w-full max-h-[80vh] object-contain rounded-2xl transition-transform duration-200 shadow-2xl"
          />
        )}
      </div>

      {/* Indicador de Quantidade */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs text-white font-bold">
        {currentIndex + 1} de {items.length}
      </div>
    </div>
  );
};
