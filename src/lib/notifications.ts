import { supabase } from '@/lib/supabase';
import { AppNotification, NotificationCategory, NotificationPriority, NotificationType } from '@/types/database';
import { triggerExternalPushNotification } from '@/lib/pushSubscriptionHelper';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, any> | null;
  sendPush?: boolean;
}

/**
 * Mapeia o tipo de notificação para sua respectiva categoria e prioridade padrão
 */
export function inferCategoryAndPriority(type: NotificationType): {
  category: NotificationCategory;
  priority: NotificationPriority;
} {
  switch (type) {
    case 'match_cancelled':
      return { category: 'matches', priority: 'critical' };
    case 'match_update':
    case 'match_created':
    case 'match_reminder':
    case 'player_joined':
    case 'player_left':
    case 'waitlist_promoted':
      return { category: 'matches', priority: 'high' };
    case 'payment_pending':
    case 'payment_rejected':
      return { category: 'payments', priority: 'high' };
    case 'payment_confirmed':
      return { category: 'payments', priority: 'normal' };
    case 'teams_drawn':
    case 'team_assigned':
    case 'game_started':
    case 'goal_scored':
    case 'champion_declared':
      return { category: 'teams', priority: 'normal' };
    case 'comment':
    case 'post_reaction':
    case 'friend_request':
      return { category: 'feed', priority: 'normal' };
    case 'badge_earned':
    case 'role_updated':
    case 'system_announcement':
    case 'system':
    default:
      return { category: 'system', priority: 'normal' };
  }
}

/**
 * Busca as notificações do usuário logado ordenadas por data decrescente com suporte a filtros.
 */
export async function getNotifications(
  userId: string,
  limit = 50,
  options?: { category?: NotificationCategory; unreadOnly?: boolean }
): Promise<AppNotification[]> {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options?.unreadOnly) {
      query = query.eq('read', false);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[Notifications] Erro ao buscar notificações:', error.message);
      return [];
    }

    return (data as AppNotification[]) || [];
  } catch (err) {
    console.error('[Notifications] Erro ao buscar notificações:', err);
    return [];
  }
}

// Cache em memória de curta duração (5s) para evitar chamadas duplicadas simultâneas (Header + BottomNav)
const unreadCountCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_TTL_MS = 5000;

export function invalidateNotificationCountCache(userId?: string) {
  if (userId) {
    unreadCountCache.delete(userId);
  } else {
    unreadCountCache.clear();
  }
}

/**
 * Retorna a quantidade de notificações não lidas com cache de curta duração.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const cached = unreadCountCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.count;
  }

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) return 0;
    const finalCount = count || 0;
    unreadCountCache.set(userId, { count: finalCount, timestamp: now });
    return finalCount;
  } catch {
    return 0;
  }
}

/**
 * Retorna a quantidade de notificações não lidas filtradas por categoria.
 * Útil para exibir badges específicos por seção (Partidas, Resenha, etc).
 */
export async function getUnreadNotificationCountByCategory(
  userId: string,
  category: NotificationCategory
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
      .eq('category', category);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Retorna as contagens de notificações não lidas para múltiplas categorias de uma vez.
 * Otimizado para uso no menu inferior, evitando múltiplas chamadas separadas.
 */
export async function getUnreadNotificationCountsByCategories(
  userId: string,
  categories: NotificationCategory[]
): Promise<Record<NotificationCategory, number>> {
  const result: Record<string, number> = {};
  categories.forEach((c) => { result[c] = 0; });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('category')
      .eq('user_id', userId)
      .eq('read', false)
      .in('category', categories);

    if (error || !data) return result as Record<NotificationCategory, number>;

    data.forEach((row) => {
      if (row.category && result[row.category] !== undefined) {
        result[row.category]++;
      }
    });

    return result as Record<NotificationCategory, number>;
  } catch {
    return result as Record<NotificationCategory, number>;
  }
}

/**
 * Marca uma notificação como lida.
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (!error) invalidateNotificationCountCache();
    return !error;
  } catch {
    return false;
  }
}

/**
 * Marca todas as notificações de um usuário como lidas.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);

    if (!error) invalidateNotificationCountCache(userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Marca todas as notificações não lidas de uma categoria específica como lidas.
 * Usado para limpar badges por seção (ex: ao clicar em Partidas, limpa notificações de 'matches').
 */
export async function markAllNotificationsAsReadByCategory(
  userId: string,
  category: NotificationCategory
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)
      .eq('category', category);

    if (!error) invalidateNotificationCountCache(userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Exclui uma notificação específica.
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Cria e dispara uma notificação para um usuário específico (com verificação de idempotência e Push).
 */
export async function createNotification(params: CreateNotificationParams): Promise<boolean> {
  try {
    const { category: defaultCategory, priority: defaultPriority } = inferCategoryAndPriority(params.type);
    const category = params.category || defaultCategory;
    const priority = params.priority || defaultPriority;

    const record = {
      user_id: params.userId,
      type: params.type,
      category,
      priority,
      title: params.title,
      message: params.message,
      link: params.link || null,
      read: false,
      idempotency_key: params.idempotencyKey || null,
      expires_at: params.expiresAt || null,
      metadata: params.metadata || null,
    };

    const { error } = await supabase.from('notifications').insert(record);

    if (error) {
      // Se for violação de chave única de idempotência, não é erro crítico (já foi enviada)
      if (error.code === '23505') {
        console.log(`[Notifications] Notificação duplicada ignorada (idempotency_key=${params.idempotencyKey})`);
        return true;
      }
      console.warn('[Notifications] Não foi possível salvar notificação:', error.message);
      return false;
    }

    // Disparar Web Push externo se solicitado (padrão true)
    if (params.sendPush !== false) {
      void triggerExternalPushNotification({
        userId: params.userId,
        category,
        title: params.title,
        message: params.message,
        link: params.link || '/',
        data: params.metadata || {},
      });
    }

    return true;
  } catch (err) {
    console.error('[Notifications] Erro ao criar notificação:', err);
    return false;
  }
}

/**
 * Cria notificações em lote para múltiplos usuários (ex: todos os participantes de uma partida).
 */
export async function createBatchNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<boolean> {
  if (!userIds || userIds.length === 0) return true;

  try {
    const uniqueUserIds = Array.from(new Set(userIds));
    const { category: defaultCategory, priority: defaultPriority } = inferCategoryAndPriority(params.type);
    const category = params.category || defaultCategory;
    const priority = params.priority || defaultPriority;

    const records = uniqueUserIds.map((userId) => ({
      user_id: userId,
      type: params.type,
      category,
      priority,
      title: params.title,
      message: params.message,
      link: params.link || null,
      read: false,
      idempotency_key: params.idempotencyKey ? `${params.idempotencyKey}_${userId}` : null,
      expires_at: params.expiresAt || null,
      metadata: params.metadata || null,
    }));

    const { error } = await supabase.from('notifications').insert(records);

    if (error) {
      console.warn('[Notifications] Erro ao inserir notificações em lote:', error.message);
      return false;
    }

    // Disparar Web Push para o lote
    if (params.sendPush !== false) {
      void triggerExternalPushNotification({
        userIds: uniqueUserIds,
        category,
        title: params.title,
        message: params.message,
        link: params.link || '/',
        data: params.metadata || {},
      });
    }

    return true;
  } catch (err) {
    console.error('[Notifications] Erro ao criar notificações em lote:', err);
    return false;
  }
}
