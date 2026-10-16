import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, subscription, userAgent } = body;

    if (!userId || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Dados de inscrição incompletos.' },
        { status: 400 }
      );
    }

    const { endpoint, keys } = subscription;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!p256dh || !auth) {
      return NextResponse.json(
        { error: 'Chaves de criptografia inválidas na subscription.' },
        { status: 400 }
      );
    }

    // Upsert na tabela push_subscriptions por endpoint
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single();

    if (error) {
      console.error('[API Push Subscribe] Erro ao salvar subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[API Push Subscribe] Erro inesperado:', err);
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, userId } = body;

    if (!endpoint && !userId) {
      return NextResponse.json(
        { error: 'Endpoint ou userId é obrigatório para cancelamento.' },
        { status: 400 }
      );
    }

    let query = supabase.from('push_subscriptions').delete();

    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
