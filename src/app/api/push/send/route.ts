import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '@/lib/supabase';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '@/lib/vapidKeys';
import { NotificationCategory } from '@/types/database';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface SendPushPayload {
  userIds?: string[];
  userId?: string;
  category?: NotificationCategory;
  title: string;
  message: string;
  link?: string | null;
  tag?: string;
  data?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendPushPayload = await request.json();
    const { userIds, userId, category = 'system', title, message, link, tag, data } = body;

    const targetUserIds = userIds || (userId ? [userId] : []);

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'Nenhum destinatário informado.' }, { status: 400 });
    }

    // 1. Buscar preferências dos usuários
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .in('user_id', targetUserIds);

    const prefMap = new Map<string, any>();
    if (preferences) {
      preferences.forEach((p) => prefMap.set(p.user_id, p));
    }

    // Filtrar usuários que permitiram a categoria de Push
    const eligibleUserIds = targetUserIds.filter((uid) => {
      const pref = prefMap.get(uid);
      if (!pref) return true; // Default habilitado
      if (category === 'matches' && pref.push_matches === false) return false;
      if (category === 'payments' && pref.push_payments === false) return false;
      if (category === 'teams' && pref.push_teams === false) return false;
      if (category === 'feed' && pref.push_feed === false) return false;
      if (category === 'system' && pref.push_system === false) return false;
      return true;
    });

    if (eligibleUserIds.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'Nenhum usuário com preferência ativa.' });
    }

    // 2. Buscar todas as subscriptions ativas para os usuários elegíveis
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', eligibleUserIds);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        message: 'Nenhum dispositivo registrado para os usuários informados.',
      });
    }

    // 3. Montar payload do Push
    const pushPayload = JSON.stringify({
      title: title || 'F&V Sports 🏆',
      body: message || 'Você tem uma nova atualização no F&V Sports!',
      url: link || '/',
      tag: tag || 'fv-sports-notification',
      data: {
        link: link || '/',
        ...data,
      },
    });

    // 4. Enviar para cada inscrição em paralelo
    const invalidEndpoints: string[] = [];
    let sentSuccessCount = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload, {
            TTL: 86400, // 24 horas
            urgency: 'high',
          });
          sentSuccessCount++;
        } catch (err: any) {
          // Se o endpoint expirou ou foi cancelado pelo navegador (410 Gone / 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            invalidEndpoints.push(sub.endpoint);
          } else {
            console.warn(`[API Push Send] Erro no envio para ${sub.endpoint.substring(0, 30)}:`, err.message);
          }
        }
      })
    );

    // 5. Limpar subscriptions inválidas / expiradas
    if (invalidEndpoints.length > 0) {
      void supabase.from('push_subscriptions').delete().in('endpoint', invalidEndpoints);
    }

    return NextResponse.json({
      success: true,
      sentCount: sentSuccessCount,
      totalDevices: subscriptions.length,
      invalidCleaned: invalidEndpoints.length,
    });
  } catch (err: any) {
    console.error('[API Push Send] Erro inesperado ao enviar push:', err);
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
