// Service Worker Moderno para Web Push e PWA — F&V Sports

const SW_VERSION = "v2.2.1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Suporte a PWA com tratamento resiliente de falhas de rede e requisições abortadas
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Ignorar esquemas que não sejam http/https (como extensões chrome-extension://)
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      // Se a requisição falhar (offline, cancelada/abortada ou oscilação de rede),
      // tenta recuperar do cache local ou devolve uma resposta segura sem erro não capturado
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return new Response(null, {
          status: 504,
          statusText: "Offline or request aborted",
        });
      });
    })
  );
});

// Escuta eventos de Push nativos enviados pelo servidor VAPID
self.addEventListener("push", (event) => {
  let data = {
    title: "F&V Sports ⚽🏐",
    body: "Você recebeu um novo aviso no F&V Sports!",
    url: "/",
    tag: "fvsports-notification",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const targetUrl = data.url || data.data?.link || "/";

  const options = {
    body: data.body,
    icon: "/logo_192x192.png",
    badge: "/logo_72x72.png",
    vibrate: [150, 80, 150],
    tag: data.tag || "fvsports-alert",
    renotify: true,
    data: {
      url: targetUrl,
      time: Date.now(),
    },
    actions: [
      { action: "open", title: "👀 Ver no App" },
      { action: "close", title: "✖ Fechar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Clique na notificação (celular / desktop)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Se já existe uma janela aberta do F&V Sports, foca nela e navega para a URL de destino
        for (const client of clientList) {
          if (client.url.includes(self.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Se não há janela aberta, abre uma nova janela
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
