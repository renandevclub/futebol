'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Service Worker registrado com sucesso:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SW] Falha ao registrar Service Worker:', err);
        });
    }
  }, []);

  return null;
}
