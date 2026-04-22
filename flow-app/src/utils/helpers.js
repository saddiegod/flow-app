import { supabase } from "./supabase.js";

// ─── VAPID helper (Safari requiere Uint8Array, no string) ─────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

// ─── Push subscription (Supabase) ─────────────────────────────────────────────
export async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;

    // No duplicar si ya existe suscripción activa
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      localStorage.setItem("push_subscription", JSON.stringify(existing.toJSON()));
      return existing;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    });

    const subJSON = subscription.toJSON();

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert([{ subscription: subJSON, updated_at: new Date().toISOString() }], {
        onConflict: "subscription",
      });

    if (error) throw error;

    localStorage.setItem("push_subscription", JSON.stringify(subJSON));
    console.log("✅ Suscrito a push (Supabase)");
    return subscription;
  } catch (err) {
    console.error("❌ Error suscripción push:", err);
  }
}

// ─── Service Worker ───────────────────────────────────────────────────────────
let _sw = null;
export async function getSW() {
  if (_sw) return _sw;
  if (!("serviceWorker" in navigator)) return null;
  try {
    _sw = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return _sw;
  } catch (err) {
    console.error("SW registration failed:", err);
    return null;
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function requestNotifPerm() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const permission = await Notification.requestPermission();
  // Al aceptar, suscribir al push de Supabase inmediatamente
  if (permission === "granted") await subscribeToPush();
  return permission;
}

export function fireNotif(title, body, tag = "pf") {
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag, icon: "/icon-192.png" });
  } catch {}
}

// Nota: en iOS los timers del SW mueren si bloqueas el teléfono.
// Los recordatorios de "10 min antes" deben venir del servidor (Supabase Edge Function).
// scheduleNotif sirve solo para notificaciones inmediatas o en-app.
export async function scheduleNotif(id, title, body, delayMs) {
  if (Notification.permission !== "granted") return;
  const sw = await getSW();
  if (sw?.active) {
    sw.active.postMessage({ type: "SCHEDULE", id, title, body, delay: delayMs });
  }
}

// ─── Audio ────────────────────────────────────────────────────────────────────
let _ac = null;
export function sfx(type) {
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    const t = _ac.currentTime;

    if (type === "done") {
      o.type = "sine";
      o.frequency.setValueAtTime(440, t);
      o.frequency.setValueAtTime(580, t + 0.08);
      o.frequency.setValueAtTime(840, t + 0.16);
      g.gain.setValueAtTime(0.045, t);
      g.gain.linearRampToValueAtTime(0, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    } else if (type === "milestone") {
      o.type = "triangle";
      o.frequency.setValueAtTime(660, t);
      o.frequency.setValueAtTime(880, t + 0.1);
      o.frequency.setValueAtTime(1100, t + 0.2);
      g.gain.setValueAtTime(0.04, t);
      g.gain.linearRampToValueAtTime(0, t + 0.35);
      o.start(t); o.stop(t + 0.35);
    } else if (type === "pomodoro") {
      // Tres tonos descendentes al terminar
      [0, 0.15, 0.3].forEach((d, i) => {
        const oo = _ac.createOscillator(), gg = _ac.createGain();
        oo.connect(gg); gg.connect(_ac.destination);
        oo.type = "sine";
        oo.frequency.setValueAtTime([880, 660, 440][i], t + d);
        gg.gain.setValueAtTime(0.06, t + d);
        gg.gain.linearRampToValueAtTime(0, t + d + 0.15);
        oo.start(t + d); oo.stop(t + d + 0.15);
      });
      return;
    } else {
      // click — suave
      o.type = "sine";
      o.frequency.setValueAtTime(540, t);
      g.gain.setValueAtTime(0.018, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.start(t); o.stop(t + 0.05);
    }
  } catch {}
}

// ─── Storage (localStorage con namespace) ─────────────────────────────────────
const NS = "pf4_";

export function load(key, defaultValue) {
  try {
    return JSON.parse(localStorage.getItem(NS + key) ?? "null") ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {}
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────
export function exportBackup() {
  const keys = ["tasks", "recurring", "habits", "boards", "journal"];
  const data  = { version: 5, exportedAt: new Date().toISOString() };
  keys.forEach(k => { data[k] = load(k, []); });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `focus_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.tasks && !data.recurring) throw new Error("Formato de backup inválido");
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo el archivo"));
    reader.readAsText(file);
  });
}