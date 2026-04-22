import { supabase } from "./supabase.js";

// Función auxiliar para Safari (Convierte la llave VAPID de texto a Buffer)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // 1. Verificar si ya existe una suscripción para no duplicar
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log('Ticket existente encontrado:', existingSub);
      // Guardamos en local por si acaso y salimos
      localStorage.setItem('push_subscription', JSON.stringify(existingSub.toJSON()));
      return existingSub;
    }

    // 2. Pedir nuevo ticket (Safari requiere el formato Uint8Array)
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    const subJSON = subscription.toJSON();

    // 3. Guardar en Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert([{ 
        subscription: subJSON,
        updated_at: new Date().toISOString() 
      }], { onConflict: 'subscription' });

    localStorage.setItem('push_subscription', JSON.stringify(subJSON));

    if (error) throw error;
    console.log('✅ iPhone suscrito con ticket nuevo');
    return subscription;

  } catch (err) {
    console.error('❌ Error en suscripción:', err);
  }
}

// ─── Service Worker Management ──────────────────────────────────────────────
let _sw = null;
export async function getSW() {
  if (_sw) return _sw;
  if (!("serviceWorker" in navigator)) return null;
  try {
    // Registramos el archivo físico /public/sw.js
    _sw = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return _sw;
  } catch (err) {
    console.error("SW Registration failed:", err);
    return null;
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function requestNotifPerm() {
  if (!("Notification" in window)) return "unsupported";
  const permission = await Notification.requestPermission();
  
  // Si aceptó, aprovechamos para suscribirlo al Push del servidor inmediatamente
  if (permission === "granted") {
    await subscribeToPush();
  }
  return permission;
}

export async function scheduleNotif(id, title, body, delayMs) {
  if (Notification.permission !== "granted") return;
  
  // Recordatorio de Ingeniería: 
  // En iOS, el setTimeout del SW morirá si bloqueas el teléfono.
  // Esta función solo sirve para notificaciones "in-app" o inmediatas.
  // Las de "en 10 minutos" DEBEN venir de Supabase vía Push.
  const sw = await getSW();
  if (sw?.active) {
    sw.active.postMessage({ type: "SCHEDULE", id, title, body, delay: delayMs });
  }
}

// ... (Tus funciones de Audio y Storage se mantienen igual)