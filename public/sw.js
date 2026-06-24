// Handler fetch « pass-through » : sa présence est requise par Chrome pour juger l'app
// installable et émettre beforeinstallprompt. On ne sert rien hors-ligne pour l'instant,
// on laisse simplement le navigateur gérer la requête normalement.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'BoxBox', {
      body: data.body ?? '',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const url = event.notification.data.url
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) return client.focus()
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
