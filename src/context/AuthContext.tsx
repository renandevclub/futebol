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
} from '@/lib/phoneUtils';

export interface SignupParams {
  nome: string;
  whatsapp: string;
  password: string;
  apelido?: string;
  genero?: 'masculino' | 'feminino';
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
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<AuthResponse>;
  signup: (params: SignupParams) => Promise<AuthResponse>;
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

  /**
   * Busca e sincroniza o perfil associado ao usuário do Supabase Auth
   */
  const fetchProfileForUser = useCallback(async (user: User): Promise<Profile | null> => {
    try {
      // 1. Tenta buscar pelo auth_id (vínculo oficial)
      const { data: profileByAuthId, error: errAuthId } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (profileByAuthId && !errAuthId) {
        return profileByAuthId;
      }

      // 2. Se não encontrou por auth_id, busca pelo telefone normalizado
      const rawPhone = user.user_metadata?.whatsapp || user.phone || '';
      const nationalPhone = getNationalDigits(rawPhone);

      if (nationalPhone) {
        const { data: profileByPhone, error: errPhone } = await supabase
          .from('profiles')
          .select('*')
          .or(`whatsapp.eq.${nationalPhone},whatsapp.eq.55${nationalPhone}`)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (profileByPhone && !errPhone) {
          // Vincula o auth_id ao perfil existente
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .update({ auth_id: user.id })
            .eq('id', profileByPhone.id)
            .select()
            .single();

          return updatedProfile || profileByPhone;
        }
      }

      // 3. Fallback: chamar RPC segura do banco para criar ou sincronizar
      const { data: rpcProfile } = await supabase.rpc('sync_profile_for_auth_user');
      if (rpcProfile) {
        return rpcProfile as Profile;
      }

      return null;
    } catch (err) {
      console.error('Erro ao carregar perfil do usuário:', err);
      return null;
    }
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
          if (isMounted) setProfile(userProfile);
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
          if (isMounted) setProfile(userProfile);
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

      const authEmail = getSupabaseAuthEmail(phone);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: password,
      });

      if (error) {
        console.error('Erro no login Supabase Auth:', error.message);
        // Mensagem unificada para evitar enumeração de usuários
        const genericError = 'Telefone ou senha incorretos.';
        toast.error(genericError);
        return { success: false, error: genericError };
      }

      if (data.user) {
        setAuthUser(data.user);
        setSession(data.session);
        const userProfile = await fetchProfileForUser(data.user);
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
   * Cadastro de Novo Jogador com Telefone e Senha
   */
  const signup = async ({
    nome,
    whatsapp,
    password,
    apelido,
    genero = 'masculino',
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

      const authEmail = getSupabaseAuthEmail(whatsapp);
      const nationalPhone = getNationalDigits(whatsapp);

      // Verificar se já existe perfil cadastrado com este telefone que já possui auth_id
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, nome, auth_id')
        .or(`whatsapp.eq.${nationalPhone},whatsapp.eq.55${nationalPhone}`)
        .maybeSingle();

      if (existingProfile?.auth_id) {
        const errorMsg = 'Já existe uma conta cadastrada para este número. Faça login.';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Criação oficial do usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: password,
        options: {
          data: {
            nome: nome.trim(),
            apelido: apelido?.trim() || null,
            whatsapp: nationalPhone,
            genero: genero,
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
        isAuthenticated: !!session && !!profile,
        isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',
        isSuperAdmin: profile?.role === 'super_admin',
        isLoading,
        login,
        signup,
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
