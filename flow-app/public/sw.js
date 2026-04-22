// Focus App — Service Worker v5
// Handles: push notifications, background sync, Pomodoro Live Activity simulation

const CACHE_NAME = "focus-v5";
const STATIC = ["/", "/index.html", "/manifest.json"];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
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

// ── Fetch (cache-first for static, network-first for API) ─────────────────────
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("supabase.co")) return; // never cache API calls

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ── Push notifications (Viene de Supabase) ──────────────────────────
self.addEventListener("push", e => {
  console.log("[SW] Push recibido");
  
  // Si no hay datos, no hacemos nada
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch (err) {
    // Si el servidor manda texto plano en lugar de JSON, lo manejamos
    data = { title: "Focus", body: e.data.text() };
  }

  const options = {
    body:      data.body || "",
    icon:      "/icon-192.png",
    badge:     "/badge.png",
    tag:       data.tag  || "focus-alert", // Tag para agrupar
    renotify:  true,
    vibrate:   [100, 50, 100],
    data:      { url: data.url || "/" },
  };

  e.waitUntil(
    self.registration.showNotification(data.title || "Focus", options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type:"window", includeUncontrolled:true }).then(all => {
      const existing = all.find(c => c.url === url);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ── Message handler (from App) ────────────────────────────────────────────────
// Handles: scheduled notifications, Pomodoro Live Activity, badge updates

let pomodoroInterval = null;
let pomodoroData     = null;

self.addEventListener("message", e => {
  const { type } = e.data || {};

  // ── Scheduled task reminder ──────────────────────────────────────────────
  if (type === "SCHEDULE") {
    const { id, title, body, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon:  "/icon-192.png",
        badge: "/badge.png",
        tag:   id,
        renotify: true,
        data:  { url: "/" },
      });
    }, Math.max(0, delay));
  }

  // ── Pomodoro Live Activity start ─────────────────────────────────────────
  // Shows a persistent notification that updates every minute (simulates Dynamic Island)
  if (type === "POMO_START") {
    const { taskTitle, totalSecs, mode } = e.data;
    pomodoroData = { taskTitle, totalSecs, mode, startedAt: Date.now() };

    const modeLabel = mode === "work" ? "🎯 Foco" : "☕ Descanso";
    const totalMins = Math.ceil(totalSecs / 60);

    self.registration.showNotification(`${modeLabel} — ${totalMins} min`, {
      body:    taskTitle ? `Trabajando en: ${taskTitle}` : "Temporizador activo",
      icon:    "/icon-192.png",
      badge:   "/badge.png",
      tag:     "pomo-live",
      renotify: false,
      silent:  true,
      data:    { url: "/?tab=today" },
      // Note: persistent notifications need user to dismiss — closest to Live Activity on web
    });

    // Update every minute
    if (pomodoroInterval) clearInterval(pomodoroInterval);
    pomodoroInterval = setInterval(() => {
      if (!pomodoroData) return clearInterval(pomodoroInterval);
      const elapsed = Math.floor((Date.now() - pomodoroData.startedAt) / 1000);
      const remaining = Math.max(0, pomodoroData.totalSecs - elapsed);
      const remMins   = Math.ceil(remaining / 60);

      if (remaining <= 0) {
        clearInterval(pomodoroInterval);
        pomodoroData = null;
        self.registration.showNotification("⏰ ¡Tiempo!", {
          body:    mode === "work" ? "¡Pomodoro completo! Hora de descansar." : "¡Descanso terminado! Vuelve al foco.",
          icon:    "/icon-192.png",
          badge:   "/badge.png",
          tag:     "pomo-done",
          renotify: true,
          vibrate: [200, 100, 200, 100, 200],
          data:    { url: "/?tab=today" },
        });
        return;
      }

      const ml = mode === "work" ? "🎯 Foco" : "☕ Descanso";
      self.registration.showNotification(`${ml} — ${remMins} min restantes`, {
        body:    pomodoroData.taskTitle || "Temporizador activo",
        icon:    "/icon-192.png",
        badge:   "/badge.png",
        tag:     "pomo-live",
        renotify: false,
        silent:  true,
        data:    { url: "/?tab=today" },
      });
    }, 60_000);
  }

  // ── Pomodoro stop ────────────────────────────────────────────────────────
  if (type === "POMO_STOP") {
    clearInterval(pomodoroInterval);
    pomodoroData = null;
    self.registration.getNotifications({ tag:"pomo-live" }).then(ns => ns.forEach(n => n.close()));
  }

  // ── App badge (unread tasks count) ──────────────────────────────────────
  if (type === "SET_BADGE" && "setAppBadge" in self) {
    self.setAppBadge(e.data.count || 0).catch(() => {});
  }
  if (type === "CLEAR_BADGE" && "clearAppBadge" in self) {
    self.clearAppBadge().catch(() => {});
  }

  // ── Background sync trigger (called before closing app) ─────────────────
  if (type === "SYNC_NOW") {
    // Supabase sync would happen here if session exists
    // The app handles sync directly — this is a hook for future use
    self.clients.matchAll().then(all => {
      all.forEach(c => c.postMessage({ type:"SYNC_ACK" }));
    });
  }
});

// ── Background Sync (for offline → online task saves) ─────────────────────────
self.addEventListener("sync", e => {
  if (e.tag === "sync-tasks") {
    e.waitUntil(
      // In production: read from IndexedDB queue and POST to Supabase
      // For now: notify the client to trigger its own sync
      self.clients.matchAll().then(all =>
        all.forEach(c => c.postMessage({ type:"DO_SYNC" }))
      )
    );
  }
});

// ── Periodic Background Sync (daily reminder if enabled) ──────────────────────
self.addEventListener("periodicsync", e => {
  if (e.tag === "daily-reminder") {
    e.waitUntil(
      self.registration.showNotification("📅 Focus — ¿Cómo va tu día?", {
        body:  "Revisa tus tareas y escribe en tu diario.",
        icon:  "/icon-192.png",
        badge: "/badge.png",
        tag:   "daily-reminder",
        data:  { url: "/" },
        actions: [
          { action:"open-today",   title:"Ver tareas" },
          { action:"open-journal", title:"Abrir diario" },
        ],
      })
    );
  }
});
