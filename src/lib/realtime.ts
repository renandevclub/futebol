import { supabase } from '@/lib/supabase';

interface RealtimeTable {
  table: string;
  filter?: string;
}

/**
 * Inscreve uma tela nas tabelas que podem alterá-la.
 *
 * O callback é agrupado em uma pequena janela para que operações em lote
 * (como distribuir vários jogadores entre os times) não provoquem várias
 * consultas concorrentes nem exibam um novo estado de carregamento.
 */
export const subscribeToTables = (
  channelName: string,
  tables: RealtimeTable[],
  onChange: () => void | Promise<void>,
) => {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRefresh = () => {
    if (refreshTimer) return;

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void onChange();
    }, 120);
  };

  // Gera um identificador único para evitar colisões entre instâncias de componentes e remounts do React
  const uniqueChannelId = `${channelName}_${Math.random().toString(36).substring(2, 8)}`;
  let channel = supabase.channel(uniqueChannelId);

  tables.forEach(({ table, filter }) => {
    if (filter) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        scheduleRefresh,
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleRefresh,
      );
    }
  });

  channel.subscribe((status, error) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      const errorMessage = error instanceof Error ? error.message : String(error || '');
      const isTransient =
        errorMessage.includes('1006') ||
        errorMessage.includes('socket closed') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isTransient) {
        // Desconexões temporárias normais tratadas automaticamente com reconexão pelo Supabase
        console.warn(`[Realtime] ${channelName} em reconexão (${status}): ${errorMessage}`);
      } else {
        console.error(`[Realtime] ${channelName} ${status}:`, error);
      }
    }
  });

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabase.removeChannel(channel);
  };
};
