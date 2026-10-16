import { supabase } from '@/lib/supabase';
import { UserNotificationPreferences } from '@/types/database';

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<UserNotificationPreferences, 'user_id' | 'updated_at'> = {
  in_app_matches: true,
  in_app_payments: true,
  in_app_teams: true,
  in_app_feed: true,
  in_app_system: true,
  push_matches: true,
  push_payments: true,
  push_teams: true,
  push_feed: false,
  push_system: true,
};

/**
 * Busca as preferências de notificação do usuário
 */
export async function getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return {
        user_id: userId,
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        updated_at: new Date().toISOString(),
      };
    }

    return data as UserNotificationPreferences;
  } catch (err) {
    console.error('Erro ao buscar preferências de notificação:', err);
    return {
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Atualiza ou insere as preferências de notificação do usuário
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: Partial<Omit<UserNotificationPreferences, 'user_id' | 'updated_at'>>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Erro ao salvar preferências de notificação:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro inesperado ao salvar preferências:', err);
    return false;
  }
}
