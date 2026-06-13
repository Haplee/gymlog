self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // El data.url de una notificación es dato no confiable: solo se navega
  // a URLs del propio origen; cualquier otra cosa cae al fallback '/'.
  const fallback = new URL('/', self.location.origin).href;
  let urlToOpen = fallback;
  try {
    const u = new URL(event.notification.data?.url || '/', self.location.origin);
    if (u.origin === self.location.origin && (u.protocol === 'https:' || u.protocol === 'http:')) {
      urlToOpen = u.href;
    }
  } catch {
    // URL inválida → fallback
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
