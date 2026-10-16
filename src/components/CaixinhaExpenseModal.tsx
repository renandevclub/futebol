'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  TrendingDown,
  TrendingUp,
  Plus,
  Upload,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { CaixinhaCategory } from '@/types/finance';
import { addCaixinhaExpense, formatCurrency } from '@/lib/financeHelper';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CaixinhaExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  caixinhaName?: string;
  onSuccess?: () => void;
}

const CATEGORIES: { id: CaixinhaCategory; label: string; emoji: string }[] = [
  { id: 'churrasco', label: 'Churrasco & Carnes', emoji: '🥩' },
  { id: 'bebidas', label: 'Bebidas & Gelo', emoji: '🍻' },
  { id: 'quadra', label: 'Aluguel Quadra / Campo', emoji: '🏟️' },
  { id: 'materiais', label: 'Bolas, Coletes & Redes', emoji: '⚽' },
  { id: 'premiacao', label: 'Troféus & Medalhas', emoji: '🏆' },
  { id: 'contribuicao', label: 'Entrada / Patrocínio', emoji: '💰' },
  { id: 'outros', label: 'Outros Gastos', emoji: '📋' },
];

export const CaixinhaExpenseModal: React.FC<CaixinhaExpenseModalProps> = ({
  isOpen,
  onClose,
  leagueId,
  caixinhaName = 'Caixinha da Resenha',
  onSuccess,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<'expense' | 'entry'>('expense');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<CaixinhaCategory>('churrasco');
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !leagueId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `receipts/caixinha/${leagueId}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('match-media')
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast.error('Erro ao enviar imagem.');
      } else {
        const { data: urlData } = supabase.storage.from('match-media').getPublicUrl(filePath);
        setComprovanteUrl(urlData.publicUrl);
        toast.success('Comprovante/Nota fiscal anexada com sucesso! ✅');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro no upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leagueId) return;

    const numValor = parseFloat(valor.replace(',', '.'));
    if (isNaN(numValor) || numValor <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    if (!descricao.trim()) {
      toast.error('Informe a descrição.');
      return;
    }

    setIsSubmitting(true);
    if (type === 'expense') {
      const res = await addCaixinhaExpense({
        leagueId,
        adminId: user.id,
        descricao: descricao.trim(),
        valor: numValor,
        categoria,
        comprovanteUrl,
      });

      setIsSubmitting(false);
      if (res.success) {
        toast.success(`Despesa de ${formatCurrency(numValor)} lançada na ${caixinhaName}!`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.error || 'Erro ao lançar despesa.');
      }
    } else {
      // Entrada direta / Patrocínio na caixinha
      const { error } = await supabase.from('league_caixinha_transactions').insert({
        league_id: leagueId,
        type: 'entry',
        descricao: descricao.trim(),
        valor: numValor,
        categoria: categoria || 'contribuicao',
        admin_id: user.id,
        comprovante_url: comprovanteUrl || null,
      });

      setIsSubmitting(false);
      if (error) {
        toast.error('Erro ao registrar entrada.');
      } else {
        toast.success(`Entrada de ${formatCurrency(numValor)} registrada na ${caixinhaName}! 🎉`);
        if (onSuccess) onSuccess();
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                type === 'expense'
                  ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              }`}
            >
              {type === 'expense' ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {type === 'expense' ? 'Lançar Despesa' : 'Lançar Entrada Avulsa'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {caixinhaName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo de Operação (Despesa vs Entrada) */}
        <div className="px-4 sm:px-6 pt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border ${
              type === 'expense'
                ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Despesa / Gasto</span>
          </button>
          <button
            type="button"
            onClick={() => setType('entry')}
            className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border ${
              type === 'entry'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Entrada / Doação</span>
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              Descrição do Lançamento *
            </label>
            <input
              type="text"
              required
              placeholder={type === 'expense' ? 'Ex: 10kg de Picanha e Carvão' : 'Ex: Patrocínio Padaria Silva'}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                Valor (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs">
                  R$
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: 150,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CaixinhaCategory)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Anexo de Foto/Nota Fiscal */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              Comprovante ou Nota Fiscal (Opcional)
            </label>
            <label className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer transition-all">
              <Upload className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isUploading
                  ? 'Enviando...'
                  : comprovanteUrl
                  ? 'Foto anexada ✅ (clique para alterar)'
                  : 'Anexar foto do recibo/nota'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className={`w-full py-3 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                type === 'expense'
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : type === 'expense' ? 'Lançar Despesa no Caixa' : 'Registrar Entrada'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
