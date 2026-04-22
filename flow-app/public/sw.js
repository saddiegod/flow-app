// Focus App — Service Worker v7
// Maneja: Push de Supabase, mensajes de la app, Pomodoro Live Activity, badge de app

const CACHE_NAME = "focus-v7";
const STATIC = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/badge.png"];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — cache-first para estáticos, intercepta /__widget
self.addEventListener("fetch", e => {
  // Widget endpoint para Atajos de iPhone
  if (e.request.url.includes("/__widget")) {
    e.respondWith((async () => {
      const payload = widgetData || { message: "Sin tareas activas", task: null };
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    })());
    return;
  }
  if (e.request.method !== "GET" || e.request.url.includes("supabase.co")) return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      })
    )
  );
});

// PUSH — Notificación real desde Supabase Edge Function
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    if (!e.data) return;
    let data;
    try { data = e.data.json(); }
    catch { data = { title: "Focus", body: e.data.text() }; }

    return self.registration.showNotification(data.title || "Focus", {
      body:     data.body    || "Tienes actividad en Focus",
      icon:     "/icon-192.png",
      badge:    "/badge.png",
      tag:      data.tag     || "focus-push",
      renotify: data.renotify ?? true,
      vibrate:  data.vibrate ?? [100, 50, 100],
      data:     { url: data.url || "/" },
      actions:  data.actions || [],
    });
  })());
});

// MENSAJES desde la app
const swTimers = new Map();
let widgetData = null;

self.addEventListener("message", e => {
  const msg = e.data || {};

  if (msg.type === "SCHEDULE") {
    const { id, title, body, delay, actions = [] } = msg;
    if (swTimers.has(id)) clearTimeout(swTimers.get(id));
    const t = setTimeout(() => {
      self.registration.showNotification(title, {
        body, icon: "/icon-192.png", badge: "/badge.png",
        tag: id, renotify: true, vibrate: [100, 50, 100], actions, data: { url: "/" },
      });
      swTimers.delete(id);
    }, Math.max(0, delay));
    swTimers.set(id, t);
  }

  if (msg.type === "CANCEL") {
    if (swTimers.has(msg.id)) { clearTimeout(swTimers.get(msg.id)); swTimers.delete(msg.id); }
  }
  if (msg.type === "CANCEL_ALL") { swTimers.forEach(t => clearTimeout(t)); swTimers.clear(); }

  if (msg.type === "POMO_START") handlePomodoro(msg);
  if (msg.type === "POMO_STOP")  stopPomodoro();

  if (msg.type === "SET_BADGE"   && "setAppBadge"   in self) self.setAppBadge(msg.count || 0).catch(() => {});
  if (msg.type === "CLEAR_BADGE" && "clearAppBadge" in self) self.clearAppBadge().catch(() => {});

  if (msg.type === "UPDATE_WIDGET") widgetData = msg.data || null;
});

// POMODORO Live Activity
let pomodoroInterval = null;
let pomodoroMeta     = null;

function handlePomodoro({ taskTitle, totalSecs, mode }) {
  stopPomodoro();
  pomodoroMeta = { taskTitle, totalSecs, mode, startedAt: Date.now() };
  const ml = mode === "work" ? "🎯 Foco" : "☕ Descanso";

  self.registration.showNotification(`${ml} — ${Math.ceil(totalSecs / 60)} min`, {
    body: taskTitle ? `Trabajando en: ${taskTitle}` : "Temporizador activo",
    icon: "/icon-192.png", badge: "/badge.png",
    tag: "pomo-live", silent: true, renotify: false, data: { url: "/?tab=today" },
  });

  pomodoroInterval = setInterval(() => {
    if (!pomodoroMeta) return clearInterval(pomodoroInterval);
    const elapsed   = Math.floor((Date.now() - pomodoroMeta.startedAt) / 1000);
    const remaining = Math.max(0, pomodoroMeta.totalSecs - elapsed);
    const remMins   = Math.ceil(remaining / 60);

    if (remaining <= 0) {
      stopPomodoro();
      self.registration.showNotification("⏰ ¡Tiempo completado!", {
        body: mode === "work" ? "🍅 ¡Pomodoro completo! Descansa." : "⚡ Vuelve al foco.",
        icon: "/icon-192.png", badge: "/badge.png",
        tag: "pomo-done", renotify: true, vibrate: [200, 100, 200, 100, 200], data: { url: "/?tab=today" },
      });
      return;
    }
    const label = pomodoroMeta.mode === "work" ? "🎯 Foco" : "☕ Descanso";
    self.registration.showNotification(`${label} — ${remMins} min restantes`, {
      body: pomodoroMeta.taskTitle || "Temporizador activo",
      icon: "/icon-192.png", badge: "/badge.png",
      tag: "pomo-live", silent: true, renotify: false, data: { url: "/?tab=today" },
    });
  }, 60_000);
}

function stopPomodoro() {
  if (pomodoroInterval) { clearInterval(pomodoroInterval); pomodoroInterval = null; }
  pomodoroMeta = null;
  self.registration.getNotifications({ tag: "pomo-live" }).then(ns => ns.forEach(n => n.close()));
}

// Notification click
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(all => {
      const existing = all.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => { if (url !== "/") c.navigate(url); });
      return clients.openWindow(url);
    })
  );
});

// Periodic Background Sync
self.addEventListener("periodicsync", e => {
  if (e.tag === "daily-reminder") {
    e.waitUntil(
      self.registration.showNotification("📅 Focus — Organiza tu día", {
        body: "Revisa tus tareas y escribe en tu diario.",
        icon: "/icon-192.png", badge: "/badge.png",
        tag: "periodic-reminder",
        actions: [{ action: "today", title: "Ver tareas" }, { action: "journal", title: "Diario" }],
        data: { url: "/" },
      })
    );
  }
});