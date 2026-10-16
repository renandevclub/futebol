'use client';

import React, { useState } from 'react';
import { Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  X,
  AlertTriangle,
  Trash2,
  Lock,
  UserX,
  Loader2,
} from 'lucide-react';
import { formatPhoneDisplay } from '@/lib/phoneUtils';

interface DeleteUserConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  onUserDeleted: () => void;
  currentUserId?: string;
}

export const DeleteUserConfirmModal: React.FC<DeleteUserConfirmModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onUserDeleted,
  currentUserId,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !targetUser) return null;

  const isSelf = targetUser.id === currentUserId;

  const handleDelete = async () => {
    if (isSelf) {
      toast.error('Você não pode excluir sua própria conta de Super Administrador.');
      return;
    }

    if (confirmInput.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite a palavra EXCLUIR para confirmar.');
      return;
    }

    try {
      setIsDeleting(true);

      // 1. Remover associações de membros de liga primeiro
      await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', targetUser.id);

      // 2. Remover o perfil do usuário
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUser.id);

      if (error) {
        console.error('Erro ao excluir usuário:', error);
        toast.error('Não foi possível excluir o usuário: ' + error.message);
        return;
      }

      // 3. Registrar auditoria se possível
      try {
        await supabase.from('audit_logs').insert({
          action: 'DELETE_USER',
          resource_type: 'profile',
          resource_id: targetUser.id,
          user_id: currentUserId,
          metadata: {
            deleted_user_name: targetUser.nome,
            deleted_user_whatsapp: targetUser.whatsapp,
            deleted_user_role: targetUser.role,
          },
        });
      } catch (auditErr) {
        console.warn('Erro ao gravar log de auditoria de exclusão:', auditErr);
      }

      toast.success(`Usuário ${targetUser.nome} foi excluído com sucesso!`);
      setConfirmInput('');
      onClose();
      onUserDeleted();
    } catch (err: any) {
      console.error('Exceção ao excluir usuário:', err);
      toast.error('Ocorreu um erro ao excluir o usuário.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Excluir Usuário
              </h3>
              <span className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider">
                Ação Irreversível
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dados do Usuário */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 font-black text-sm shrink-0 overflow-hidden">
            {targetUser.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt={targetUser.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              targetUser.nome.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
              {targetUser.nome}
              {targetUser.apelido && (
                <span className="text-slate-400 font-semibold ml-1">
                  ({targetUser.apelido})
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              📱 {formatPhoneDisplay(targetUser.whatsapp)}
            </p>
          </div>
        </div>

        {/* Alerta de Confirmação */}
        {isSelf ? (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              Você não pode excluir sua própria conta de Super Administrador por questões de segurança.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Atenção:</span>
              </p>
              <p>
                Esta ação removerá o usuário, seus vínculos com ligas e seu perfil do sistema de forma permanente.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                Para confirmar, digite <strong className="text-red-500">EXCLUIR</strong> abaixo:
              </label>
              <input
                type="text"
                placeholder="Digite EXCLUIR"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          {!isSelf && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || confirmInput.trim().toUpperCase() !== 'EXCLUIR'}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
