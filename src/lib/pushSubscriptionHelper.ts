import { VAPID_PUBLIC_KEY } from '@/lib/vapidKeys';

/**
 * Converte chave base64 URL em Uint8Array para uso na PushManager API
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica se o dispositivo/navegador atual tem suporte completo a Web Push
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Retorna o status de permissão atual de notificação
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Inscreve o dispositivo do usuário para receber notificações Web Push
 */
export async function subscribeUserToPush(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Notificações push não são suportadas neste navegador.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permissão para notificações não foi concedida.' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Se já existe uma subscription, cancela e recria para garantir a chave VAPID atualizada
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey.buffer as ArrayBuffer,
      });
    }

    // Enviar dados para o backend salvar na tabela push_subscriptions
    const userAgent = navigator.userAgent;
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription,
        userAgent,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Falha ao registrar subscription no servidor.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[PushSubscription] Erro ao inscrever:', err);
    return { success: false, error: err.message || 'Erro ao ativar notificações push.' };
  }
}

/**
 * Cancela a inscrição de Web Push do dispositivo atual
 */
export async function unsubscribeUserFromPush(userId?: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notificar backend para remover
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          userId,
        }),
      });
    }

    return true;
  } catch (err) {
    console.error('[PushSubscription] Erro ao cancelar inscrição:', err);
    return false;
  }
}

/**
 * Dispara envio de push via backend para um ou mais usuários
 */
export async function triggerExternalPushNotification(params: {
  userIds?: string[];
  userId?: string;
  category?: string;
  title: string;
  message: string;
  link?: string | null;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (e) {
    console.warn('[PushDispatcher] Falha silenciosa ao chamar API push:', e);
  }
}
