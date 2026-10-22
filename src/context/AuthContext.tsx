'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { subscribeToTables } from '@/lib/realtime';
import {
  getNationalDigits,
  getSupabaseAuthEmail,
  validatePhoneNumber,
  normalizePhoneDb,
  cleanPhoneNumber,
  sha256Hex,
  normalizeInviteCode,
} from '@/lib/phoneUtils';

export interface SignupParams {
  nome: string;
  whatsapp: string;
  password: string;
  apelido?: string;
  genero?: 'masculino' | 'feminino';
  inviteCode?: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  authUser: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isBlocked: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<AuthResponse>;
  signup: (params: SignupParams) => Promise<AuthResponse>;
  recoverPassword: (phone: string, code: string, newPassword: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Métodos legados mantidos para compatibilidade retroativa
  loginParticipant?: (whatsapp: string) => Promise<boolean>;
  registerParticipant?: (nome: string, whatsapp: string, apelido?: string, genero?: 'masculino' | 'feminino') => Promise<boolean>;
  loginAdmin?: (pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeProfileFetchRef = React.useRef<Map<string, Promise<Profile | null>>>(new Map());

  /**
   * Busca e sincroniza o perfil associado ao usuário do Supabase Auth
   */
  const fetchProfileForUser = useCallback(async (user: User): Promise<Profile | null> => {
    // Se já existe uma requisição em andamento para este usuário, reutiliza a mesma promessa
    const existingPromise = activeProfileFetchRef.current.get(user.id);
    if (existingPromise) {
      return existingPromise;
    }

    const fetchPromise = (async (): Promise<Profile | null> => {
      try {
        let resolvedProfile: Profile | null = null;

        // 1. Tenta buscar pelo auth_id (vínculo oficial)
        const { data: profileByAuthId, error: errAuthId } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (profileByAuthId && !errAuthId) {
        resolvedProfile = profileByAuthId;
      } else {
        // 2. Se não encontrou por auth_id, busca pelo telefone normalizado
        const rawPhone = user.user_metadata?.whatsapp || user.phone || '';
        const nationalPhone = getNationalDigits(rawPhone);

        if (nationalPhone) {
          const { data: profileByPhone, error: errPhone } = await supabase
            .from('profiles')
            .select('*')
            .or(`whatsapp_normalized.eq.${nationalPhone},whatsapp.eq.${nationalPhone},whatsapp.eq.55${nationalPhone}`)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (profileByPhone && !errPhone) {
            // Vincula o auth_id ao perfil existente e atualiza normalização
            const { data: updatedProfile } = await supabase
              .from('profiles')
              .update({
                auth_id: user.id,
                whatsapp_normalized: nationalPhone,
                last_login_at: new Date().toISOString(),
              })
              .eq('id', profileByPhone.id)
              .select()
              .single();

            resolvedProfile = updatedProfile || profileByPhone;
          }
        }

        // 3. Fallback: chamar RPC segura do banco para criar ou sincronizar
        if (!resolvedProfile) {
          const { data: rpcProfile } = await supabase.rpc('sync_profile_for_auth_user');
          if (rpcProfile) {
            resolvedProfile = rpcProfile as Profile;
          }
        }
      }

      // 4. Verificação de Bloqueio Efetivo: se o usuário estiver bloqueado, revoga a sessão imediatamente
      if (resolvedProfile && resolvedProfile.account_status === 'blocked') {
        console.warn('Conta bloqueada detectada. Revogando sessão do usuário:', resolvedProfile.id);
        await supabase.auth.signOut();
        setSession(null);
        setAuthUser(null);
        setProfile(null);
        toast.error('Sua conta está bloqueada pela administração do sistema.');
        return null;
      }

      return resolvedProfile;
    } catch (err) {
      console.error('Erro ao carregar perfil do usuário:', err);
      return null;
    } finally {
      activeProfileFetchRef.current.delete(user.id);
    }
    })();

    activeProfileFetchRef.current.set(user.id, fetchPromise);
    return fetchPromise;
  }, []);

  /**
   * Inicialização e ouvinte de estado de autenticação oficial do Supabase
   */
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao obter sessão inicial:', error);
        }

        if (initialSession?.user && isMounted) {
          setSession(initialSession);
          setAuthUser(initialSession.user);
          const userProfile = await fetchProfileForUser(initialSession.user);
          if (isMounted) {
            if (userProfile && userProfile.account_status !== 'blocked') {
              setProfile(userProfile);
            } else {
              setProfile(null);
              setSession(null);
              setAuthUser(null);
            }
          }
        }
      } catch (err) {
        console.error('Erro na inicialização da autenticação:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    // Listener para mudanças no estado de autenticação (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        setSession(currentSession);
        setAuthUser(currentSession?.user || null);

        if (currentSession?.user) {
          const userProfile = await fetchProfileForUser(currentSession.user);
          if (isMounted) {
            if (userProfile && userProfile.account_status !== 'blocked') {
              setProfile(userProfile);
            } else {
              setProfile(null);
              setSession(null);
              setAuthUser(null);
            }
          }
        } else {
          if (isMounted) setProfile(null);
        }

        if (isMounted) setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileForUser]);

  /**
   * Sincronização em tempo real quando o perfil sofrer alterações no banco
   */
  useEffect(() => {
    if (!profile?.id) return;

    return subscribeToTables(
      `auth_session_profile_${profile.id}`,
      [{ table: 'profiles', filter: `id=eq.${profile.id}` }],
      async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.id)
          .single();

        if (data) {
          if (data.account_status === 'blocked') {
            await supabase.auth.signOut();
            setSession(null);
            setAuthUser(null);
            setProfile(null);
            toast.error('Sua conta foi suspensa pela administração.');
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
            return;
          }
          setProfile(data);
        }
      }
    );
  }, [profile?.id]);

  /**
   * Login com Telefone e Senha através do Supabase Auth
   */
  const login = async (phone: string, password: string): Promise<AuthResponse> => {
    try {
      setIsLoading(true);

      const phoneValidation = validatePhoneNumber(phone);
      if (!phoneValidation.isValid) {
        const errorMsg = phoneValidation.error || 'Telefone inválido.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!password || password.length < 6) {
        const errorMsg = 'A senha informada é inválida.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      const nationalPhone = getNationalDigits(phone);

      // Pré-verificação se o perfil associado ao WhatsApp está bloqueado
      const { data: checkProfile } = await supabase
        .from('profiles')
        .select('id, account_status')
        .or(`whatsapp_normalized.eq.${nationalPhone},whatsapp.eq.${nationalPhone},whatsapp.eq.55${nationalPhone}`)
        .maybeSingle();

      if (checkProfile && checkProfile.account_status === 'blocked') {
        const blockedMsg = 'Sua conta está suspensa pela administração. Entre em contato com o organizador.';
        toast.error(blockedMsg);
        return { success: false, error: blockedMsg };
      }

      const authEmail = getSupabaseAuthEmail(phone);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: password,
      });

      if (error) {
        console.error('Erro no login Supabase Auth:', error.message);
        const genericError = 'Telefone ou senha incorretos.';
        toast.error(genericError);
        return { success: false, error: genericError };
      }

      if (data.user) {
        const userProfile = await fetchProfileForUser(data.user);
        if (!userProfile || userProfile.account_status === 'blocked') {
          await supabase.auth.signOut();
          setSession(null);
          setAuthUser(null);
          setProfile(null);
          const blockedMsg = 'Sua conta está suspensa pela administração. Entre em contato com o organizador.';
          toast.error(blockedMsg);
          return { success: false, error: blockedMsg };
        }

        setAuthUser(data.user);
        setSession(data.session);
        setProfile(userProfile);
        toast.success(`Bem-vindo(a) de volta, ${userProfile?.nome || 'Craque'}!`);
        return { success: true };
      }

      return { success: false, error: 'Não foi possível iniciar a sessão.' };
    } catch (err) {
      console.error('Exceção no login:', err);
      const genericError = 'Ocorreu um erro ao realizar o login. Tente novamente.';
      toast.error(genericError);
      return { success: false, error: genericError };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cadastro de Novo Jogador com Telefone, Senha e Convite Opcional
   */
  const signup = async ({
    nome,
    whatsapp,
    password,
    apelido,
    genero = 'masculino',
    inviteCode,
  }: SignupParams): Promise<AuthResponse> => {
    try {
      setIsLoading(true);

      if (!nome.trim()) {
        toast.error('Por favor, informe seu nome completo.');
        return { success: false, error: 'Nome obrigatório.' };
      }

      const phoneValidation = validatePhoneNumber(whatsapp);
      if (!phoneValidation.isValid) {
        const errorMsg = phoneValidation.error || 'Telefone inválido.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!password || password.length < 8) {
        const errorMsg = 'A senha deve ter no mínimo 8 caracteres.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Impede senha igual ao próprio número de telefone
      const cleanPhone = cleanPhoneNumber(whatsapp);
      if (password.trim() === cleanPhone || password.trim() === getNationalDigits(whatsapp)) {
        const errorMsg = 'A senha não pode ser igual ao seu número de telefone.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      const nationalPhone = getNationalDigits(whatsapp);

      // Validação prévia de convite (se fornecido)
      let resolvedInviteId: string | null = null;
      let resolvedCodeHash: string | null = null;

      if (inviteCode && inviteCode.trim()) {
        const normalizedCode = normalizeInviteCode(inviteCode);
        const codeHash = await sha256Hex(normalizedCode);
        resolvedCodeHash = codeHash;

        const { data: inviteValidation, error: inviteErr } = await supabase.rpc('validate_invite_code', {
          p_code_hash: codeHash,
        });

        if (inviteErr) {
          console.error('Erro ao validar convite:', inviteErr);
          toast.error('Erro ao validar convite. Tente novamente.');
          return { success: false, error: 'Erro ao validar convite.' };
        }

        if (!inviteValidation?.valid) {
          const inviteMsg = inviteValidation?.error || 'Código de convite inválido ou expirado.';
          toast.error(inviteMsg);
          return { success: false, error: inviteMsg };
        }

        resolvedInviteId = inviteValidation.invite_id;
      }

      // Verificar se já existe perfil cadastrado com este telefone que já possui auth_id
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, nome, auth_id, account_status')
        .or(`whatsapp_normalized.eq.${nationalPhone},whatsapp.eq.${nationalPhone},whatsapp.eq.55${nationalPhone}`)
        .maybeSingle();

      if (existingProfile?.auth_id) {
        const errorMsg = 'Já existe uma conta cadastrada para este número. Faça login.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (existingProfile?.account_status === 'blocked') {
        const errorMsg = 'Este número de telefone está temporariamente bloqueado.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      const authEmail = getSupabaseAuthEmail(whatsapp);

      // Criação oficial do usuário no Supabase Auth com metadados de rastreabilidade
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: password,
        options: {
          data: {
            nome: nome.trim(),
            apelido: apelido?.trim() || null,
            whatsapp: nationalPhone,
            genero: genero,
            signup_origin: resolvedInviteId ? 'with_invite' : 'without_invite',
            invite_id: resolvedInviteId,
          },
        },
      });

      if (authError) {
        console.error('Erro no cadastro Supabase Auth:', authError);
        if (authError.message.includes('already registered') || authError.status === 422) {
          const errorMsg = 'Este número já possui uma conta ativa. Faça login com sua senha.';
          toast.error(errorMsg);
          return { success: false, error: errorMsg };
        }
        const errorMsg = 'Erro ao realizar o cadastro. Tente novamente.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (authData.user) {
        setAuthUser(authData.user);
        setSession(authData.session);

        // Se o Supabase não retornar sessão imediata (caso de confirmação), tenta login automático
        if (!authData.session) {
          const { data: loginData } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: password,
          });
          if (loginData.session) {
            setSession(loginData.session);
            setAuthUser(loginData.user);
          }
        }

        const userProfile = await fetchProfileForUser(authData.user);
        setProfile(userProfile);

        // Se utilizou convite, consome atomicamente no banco
        if (resolvedCodeHash && userProfile?.id) {
          const { error: consumeErr } = await supabase.rpc('consume_invite_atomic', {
            p_code_hash: resolvedCodeHash,
            p_user_id: userProfile.id,
          });
          if (consumeErr) {
            console.warn('Aviso: falha ao marcar convite como consumido:', consumeErr);
          }
        }

        toast.success(`Cadastro realizado com sucesso! Bem-vindo(a), ${nome.trim()}!`);
        return { success: true };
      }

      return { success: false, error: 'Não foi possível concluir o cadastro.' };
    } catch (err) {
      console.error('Exceção no cadastro:', err);
      const genericError = 'Ocorreu um erro no cadastro.';
      toast.error(genericError);
      return { success: false, error: genericError };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Recuperação de senha utilizando código temporário gerado pelo Superadmin
   */
  const recoverPassword = async (
    phone: string,
    code: string,
    newPassword: string
  ): Promise<AuthResponse> => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.rpc('consume_password_recovery', {
        p_whatsapp: phone,
        p_code: code.trim(),
        p_new_password: newPassword,
      });

      if (error) {
        console.error('Erro na RPC consume_password_recovery:', error);
        const msg = error.message || 'Erro ao processar a recuperação de senha.';
        toast.error(msg);
        return { success: false, error: msg };
      }

      if (!data?.success) {
        const msg = data?.error || 'Código inválido ou expirado.';
        toast.error(msg);
        return { success: false, error: msg };
      }

      toast.success(data.message || 'Senha redefinida com sucesso! Você já pode entrar.');
      return { success: true };
    } catch (err) {
      console.error('Exceção ao recuperar senha:', err);
      const generic = 'Ocorreu um erro inesperado ao redefinir a senha.';
      toast.error(generic);
      return { success: false, error: generic };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Encerramento de Sessão oficial do Supabase Auth
   */
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      setAuthUser(null);
      setProfile(null);
      toast.info('Você saiu da sua conta.');
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Recarrega o perfil do banco
   */
  const refreshUser = async (): Promise<void> => {
    if (authUser) {
      const updatedProfile = await fetchProfileForUser(authUser);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: profile,
        profile: profile,
        authUser,
        session,
        isAuthenticated: !!session && !!profile && profile.account_status !== 'blocked',
        isAdmin: (profile?.role === 'admin' || profile?.role === 'super_admin') && profile?.account_status !== 'blocked',
        isSuperAdmin: profile?.role === 'super_admin' && profile?.account_status !== 'blocked',
        isBlocked: profile?.account_status === 'blocked',
        isLoading,
        login,
        signup,
        recoverPassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
