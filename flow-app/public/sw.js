// Focus App — Service Worker v6 (Optimized for iOS)
const CACHE_NAME = "focus-v6";
const STATIC = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/badge.png"];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC))
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (cache-first para estáticos) ────────────────────────────────────────
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.includes("supabase.co")) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ── Push Notifications (LA ÚNICA FORMA FIABLE EN FONDO) ────────────────────────
// public/sw.js - Versión 6.1 (Blindada para iOS)

self.addEventListener("push", e => {
  console.log("[SW] Push recibido en segundo plano");

  // Envolvemos todo en una sola promesa para que iOS no corte la energía
  e.waitUntil(
    (async () => {
      if (!e.data) return;

      let data;
      try {
        data = e.data.json();
      } catch (err) {
        data = { title: "Focus", body: e.data.text() };
      }

      const options = {
        body:      data.body || "Tienes una tarea pendiente",
        icon:      "/icon-192.png",
        badge:     "/badge.png",
        tag:       data.tag  || "focus-notif", // Tag fijo para evitar duplicados
        renotify:  true,
        vibrate:   [100, 50, 100],
        data:      { url: data.url || "/" },
      };

      // Esta es la línea que despierta la pantalla de bloqueo
      return self.registration.showNotification(data.title || "Focus", options);
    })()
  );
});

// ── Message Handler ──────────────────────────────────────────────────────────
// IMPORTANTE: Los timers aquí fallarán si el SW se duerme. 
// Para el Pomodoro, lo mejor es que el servidor mande un PUSH al terminar.
let pomodoroInterval = null;

self.addEventListener("message", e => {
  const { type, data } = e.data || {};

  if (type === "POMO_START") {
    handlePomodoro(e.data);
  }

  if (type === "POMO_STOP") {
    clearInterval(pomodoroInterval);
    self.registration.getNotifications({ tag: "pomo-live" }).then(ns => ns.forEach(n => n.close()));
  }

  // App Badge
  if (type === "SET_BADGE" && "setAppBadge" in self) {
    self.setAppBadge(e.data.count || 0).catch(() => {});
  }
});

// Simulación de "Live Activity" (Se mantendrá viva mientras el SW no sea purgado)
function handlePomodoro({ taskTitle, totalSecs, mode }) {
  let remaining = totalSecs;
  const startedAt = Date.now();

  const updateNotif = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    remaining = Math.max(0, totalSecs - elapsed);
    const remMins = Math.ceil(remaining / 60);
    const modeLabel = mode === "work" ? "🎯 Foco" : "☕ Descanso";

    if (remaining <= 0) {
      clearInterval(pomodoroInterval);
      self.registration.showNotification("⏰ ¡Tiempo!", {
        body: mode === "work" ? "¡Pomodoro completo!" : "¡Vuelve al foco!",
        tag: "pomo-done",
        renotify: true,
        vibrate: [200, 100, 200]
      });
      return;
    }

    self.registration.showNotification(`${modeLabel} — ${remMins} min`, {
      body: taskTitle || "Temporizador activo",
      tag: "pomo-live",
      silent: true,
      renotify: false
    });
  };

  updateNotif();
  if (pomodoroInterval) clearInterval(pomodoroInterval);
  // Nota: Esto fallará en iOS si bloqueas el móvil mucho tiempo.
  pomodoroInterval = setInterval(updateNotif, 60000); 
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(all => {
      const existing = all.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});