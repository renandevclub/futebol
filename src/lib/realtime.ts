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

  let channel = supabase.channel(channelName);

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
      console.error(`[Realtime] ${channelName} ${status}`, error);
    }
  });

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabase.removeChannel(channel);
  };
};
