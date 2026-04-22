// ─────────────────────────────────────────────────────────────────────────────
// notifications.js — Sistema completo de notificaciones de Focus
//
// Arquitectura:
//   · En iOS con PWA instalada: PUSH desde Supabase Edge Function (sw.js las muestra)
//   · En navegador abierto:     setTimeout en el cliente (fireNotif)
//   · El SW también los programa si la app está cerrada pero el SW vivo (pocos min)
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase.js";
import { todayISO, fromISO } from "./dates.js";

// ── Textos por categoría ──────────────────────────────────────────────────────

const MORNING_MSGS = [
  { title:"☀️ Buenos días", body:"Hoy es un nuevo día. ¿Cuál es la tarea más importante?" },
  { title:"🌅 Empieza con fuerza", body:"La energía de la mañana marca el ritmo del día entero." },
  { title:"☕ Buen día", body:"Revisa tus tareas de hoy y elige tu primera victoria." },
  { title:"🚀 A por ello", body:"Los grandes días empiezan con una sola decisión: arrancar." },
  { title:"🌤️ Buenos días", body:"Tienes 24 horas nuevas. Úsalas con intención." },
];

const MIDDAY_MSGS = [
  { title:"🌞 Pausa de mediodía", body:"¿Cómo van las tareas? Ajusta el rumbo si necesitas." },
  { title:"⚡ Check-in de mediodía", body:"Mitad del día. Revisa qué falta y elimina lo no esencial." },
  { title:"🍽️ Hora de cargar pilas", body:"Un descanso consciente ahora vale por dos horas más tarde." },
  { title:"📊 ¿Cómo vas hoy?", body:"Abre Focus y revisa tu progreso. Todavía hay tiempo." },
];

const EVENING_MSGS = [
  { title:"🌙 Buenas noches", body:"Un gran día merece un gran diario. ¿Escribiste hoy?" },
  { title:"✨ Termina bien el día", body:"Anota tus tres victorias antes de dormir. Te lo mereces." },
  { title:"📔 Hora del diario", body:"¿Cómo te sentiste hoy? Escríbelo antes de cerrar el día." },
  { title:"🌃 Reflexión nocturna", body:"El día termina, pero tus avances quedan. Anótalos." },
];

const ENCOURAGEMENT_MSGS = [
  { title:"💪 ¡Tú puedes!", body:"Recuerda por qué empezaste. Cada pequeño paso cuenta." },
  { title:"🔥 En racha", body:"La consistencia es más poderosa que la motivación. Sigue." },
  { title:"🎯 Foco total", body:"Un solo bloque de concentración puede cambiar tu día." },
  { title:"⭐ Recuerda tu visión", body:"¿Cada tarea de hoy te acerca a tu meta grande?" },
  { title:"🧘 Respira", body:"Calidad sobre cantidad. Haz menos, pero hazlo bien." },
];

const STREAK_MSGS = [
  "¡Llevas {n} días sin recaer! No rompas la cadena.",
  "Racha de {n} días. Cada día que aguantas te hace más fuerte.",
  "{n} días limpio/a. Estás construyendo algo real.",
  "¡{n} días! Tu yo del futuro te lo agradecerá.",
];

const DIARY_REMINDER_MSGS = [
  { title:"📓 ¿Ya escribiste hoy?", body:"Solo 2 minutos. Tus victorias, tu reto, tu gratitud." },
  { title:"📔 Tu diario te espera", body:"Registrar el día es un regalo que le haces a tu futuro yo." },
  { title:"✍️ Un momento para ti", body:"Abre el diario y deja ir lo que cargo el día." },
];

// Seleccionar mensaje aleatorio de un array
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ── Helpers de tiempo ─────────────────────────────────────────────────────────

/** Convierte "HH:MM" a milisegundos desde ahora. Negativo = ya pasó. */
function msUntil(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return target.getTime() - Date.now();
}

/** Duración en minutos entre dos "HH:MM" strings. */
function durationMins(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── Disparo local (navegador abierto) ────────────────────────────────────────

function fireLocal(title, body, tag = "pf") {
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag, icon: "/icon-192.png", badge: "/badge.png" }); }
  catch {}
}

// ── Programar notificación via Service Worker (funciona con app cerrada) ──────

async function scheduleViaSW(id, title, body, delayMs, actions = []) {
  if (Notification.permission !== "granted" || delayMs < 0) return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: "SCHEDULE", id, title, body, delay: Math.round(delayMs), actions });
    }
  } catch {}
  // Fallback: setTimeout local (morirá si se cierra la app, pero cubre el caso in-app)
  return setTimeout(() => fireLocal(title, body, id), delayMs);
}

// ── Enviar al servidor para PUSH real (Supabase Edge Function) ────────────────
// Esta es la forma fiable para iOS en segundo plano.

async function schedulePush({ id, title, body, scheduledAt, tag = "pf", actions = [] }) {
  try {
    const subStr = localStorage.getItem("push_subscription");
    if (!subStr) return; // sin suscripción no podemos mandar push
    const subscription = JSON.parse(subStr);

    await supabase.functions.invoke("schedule-notification", {
      body: { id, title, body, scheduledAt, tag, actions, subscription },
    });
  } catch (err) {
    console.warn("[notifications] schedulePush error:", err);
  }
}

// ── Calcular timestamp ISO de hoy a una hora dada ─────────────────────────────
function todayAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 1 — Notificaciones de ciclo de vida de tarea
//   · Al inicio exacto de la tarea
//   · A la mitad del tiempo (ánimos)
//   · 5 minutos antes del fin (aviso de cierre)
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleTaskLifecycle(tasks, usePush = false) {
  const pending = tasks.filter(t => t.time_start && t.status !== "done");
  const timers  = [];

  for (const task of pending) {
    const startMs   = msUntil(task.time_start);
    const durMin    = durationMins(task.time_start, task.time_end);
    const halfwayMs = task.time_end ? (msUntil(task.time_start) + durationMins(task.time_start, task.time_end) * 60 * 500) : null;
    const endMs     = task.time_end ? msUntil(task.time_end) : null;

    // ── 1. Al inicio ──────────────────────────────────────────────────────────
    if (startMs > 0 && startMs < 24 * 60 * 60 * 1000) {
      const payload = {
        id:    `start_${task.id}`,
        title: `▶ Empieza ahora: ${task.title}`,
        body:  task.time_end
          ? `Tienes ${durMin} min. ¡A por ello!`
          : "Tu próxima tarea comienza. ¡Foco!",
        tag:   `task_start_${task.id}`,
        actions: [{ action: "open", title: "Abrir Focus" }],
      };
      if (usePush) {
        await schedulePush({ ...payload, scheduledAt: todayAt(task.time_start) });
      } else {
        const t = await scheduleViaSW(payload.id, payload.title, payload.body, startMs, payload.actions);
        if (t) timers.push(t);
      }
    }

    // ── 2. A la mitad (solo si hay hora de fin y duración > 20 min) ───────────
    if (task.time_end && durMin >= 20 && halfwayMs > 0) {
      const encouragements = [
        `Llevas la mitad. ¡Vas muy bien con "${task.title}"!`,
        `Mitad del camino. Sigue con esa energía 🔥`,
        `${Math.round(durMin / 2)} min más y listo. ¡Tú puedes!`,
        `Casi en la recta final. Mantén el foco un poco más.`,
      ];
      const payload = {
        id:    `half_${task.id}`,
        title: "⚡ ¡A mitad camino!",
        body:  pick(encouragements),
        tag:   `task_half_${task.id}`,
      };
      if (usePush) {
        const halfTime = new Date(new Date(todayAt(task.time_start)).getTime() + durMin * 30 * 1000);
        await schedulePush({ ...payload, scheduledAt: halfTime.toISOString() });
      } else {
        const t = await scheduleViaSW(payload.id, payload.title, payload.body, halfwayMs);
        if (t) timers.push(t);
      }
    }

    // ── 3. Cinco minutos antes del fin ────────────────────────────────────────
    if (endMs !== null && endMs > 5 * 60 * 1000) {
      const fiveBeforeMs = endMs - 5 * 60 * 1000;
      const payload = {
        id:    `end5_${task.id}`,
        title: `⏳ 5 min para cerrar: ${task.title}`,
        body:  "Empieza a concluir. Ya casi terminas.",
        tag:   `task_end_${task.id}`,
      };
      if (usePush) {
        const fiveBeforeTime = new Date(new Date(todayAt(task.time_end)).getTime() - 5 * 60 * 1000);
        await schedulePush({ ...payload, scheduledAt: fiveBeforeTime.toISOString() });
      } else {
        const t = await scheduleViaSW(payload.id, payload.title, payload.body, fiveBeforeMs);
        if (t) timers.push(t);
      }
    }
  }

  return timers; // devuelve IDs para poder cancelarlos con clearTimeout
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 2 — Rituales diarios (Buenos días / Mediodía / Buenas noches)
//   · Se programan una vez al día vía PUSH (Supabase)
//   · Si no hay push: se programan con SW al abrir la app
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_TIMES = {
  morning:   "07:30",
  midday:    "13:00",
  evening:   "21:30",
  diary:     "22:00",  // Recordatorio de diario
  encourage: "17:00",  // Ánimos de media tarde
};

/**
 * Programar todos los rituales del día.
 * Llama esto una vez al día (cuando el usuario abre la app).
 * Guarda en localStorage la fecha para no reprogramar hasta mañana.
 */
export async function scheduleDailyRituals(usePush = false) {
  const today    = todayISO();
  const lastRun  = localStorage.getItem("pf4_daily_rituals_date");
  if (lastRun === today) return; // ya programados hoy

  const tasks   = [];
  const timers  = [];
  const now     = Date.now();

  const schedule = async (id, title, body, hhmm, tag) => {
    const ms = msUntil(hhmm);
    if (ms <= 0) return; // ya pasó esta hora hoy

    if (usePush) {
      await schedulePush({ id, title, body, scheduledAt: todayAt(hhmm), tag });
    } else {
      const t = await scheduleViaSW(id, title, body, ms);
      if (t) timers.push(t);
    }
  };

  // ── Buenos días ────────────────────────────────────────────────────────────
  const morning = pick(MORNING_MSGS);
  await schedule("daily_morning", morning.title, morning.body, DAILY_TIMES.morning, "ritual_morning");

  // ── Mediodía ───────────────────────────────────────────────────────────────
  const midday = pick(MIDDAY_MSGS);
  await schedule("daily_midday", midday.title, midday.body, DAILY_TIMES.midday, "ritual_midday");

  // ── Ánimos de tarde ────────────────────────────────────────────────────────
  const enc = pick(ENCOURAGEMENT_MSGS);
  await schedule("daily_encourage", enc.title, enc.body, DAILY_TIMES.encourage, "ritual_encourage");

  // ── Recordatorio de diario ────────────────────────────────────────────────
  const diary = pick(DIARY_REMINDER_MSGS);
  await schedule("daily_diary", diary.title, diary.body, DAILY_TIMES.diary, "ritual_diary");

  // ── Buenas noches ─────────────────────────────────────────────────────────
  const evening = pick(EVENING_MSGS);
  await schedule("daily_evening", evening.title, evening.body, DAILY_TIMES.evening, "ritual_evening");

  localStorage.setItem("pf4_daily_rituals_date", today);
  return timers;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 3 — Notificaciones de hábitos (streak en riesgo)
//   · Si el usuario no ha abierto la app y tiene racha activa > 3 días
//   · Enviar recordatorio al mediodía para que no rompa la racha
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleHabitReminders(habits, usePush = false) {
  if (!habits?.length) return;

  const today    = todayISO();
  const lastRun  = localStorage.getItem("pf4_habit_reminder_date");
  if (lastRun === today) return;

  for (const h of habits) {
    if (h.frozen) continue;
    const days = Math.floor((Date.now() - h.lastResetDate) / 86400000);
    if (days < 3) continue; // solo recordar si tiene racha relevante

    const template = pick(STREAK_MSGS).replace("{n}", days);
    const payload = {
      id:    `habit_${h.id}`,
      title: `🔥 Racha de ${days} días — ${h.name}`,
      body:  template,
      tag:   `habit_${h.id}`,
      scheduledAt: todayAt("11:00"),
    };

    if (usePush) {
      await schedulePush(payload);
    } else {
      const ms = msUntil("11:00");
      if (ms > 0) await scheduleViaSW(payload.id, payload.title, payload.body, ms);
    }
  }

  localStorage.setItem("pf4_habit_reminder_date", today);
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 4 — Notificación de tarea vencida (no completada)
//   · Si hay tareas del día anterior sin completar, notificar a las 9am
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleOverdueReminder(tasks, usePush = false) {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;

  const overdue = tasks.filter(t => t.date === yISO && t.status !== "done");
  if (!overdue.length) return;

  const ms = msUntil("09:00");
  if (ms <= 0) return;

  const payload = {
    id:    "overdue_tasks",
    title: `📋 ${overdue.length} tarea${overdue.length > 1 ? "s" : ""} de ayer sin completar`,
    body:  overdue.length === 1
      ? `"${overdue[0].title}" quedó pendiente. ¿La agendas para hoy?`
      : `"${overdue[0].title}" y ${overdue.length - 1} más. Revísalas en Focus.`,
    tag:   "overdue",
    scheduledAt: todayAt("09:00"),
  };

  if (usePush) {
    await schedulePush(payload);
  } else {
    await scheduleViaSW(payload.id, payload.title, payload.body, ms);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO 5 — Notificación de semana productiva (domingos)
//   · Cada domingo, un resumen motivacional para arrancar la semana
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleWeeklyMotivation(tasks, usePush = false) {
  const today = new Date();
  if (today.getDay() !== 0) return; // solo domingos

  const lastRun = localStorage.getItem("pf4_weekly_date");
  if (lastRun === todayISO()) return;

  // Contar tareas completadas esta semana
  const weekDone = tasks.filter(t => {
    if (t.status !== "done") return false;
    const d = new Date(t.date);
    const diff = (today - d) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  const msgs = [
    { title:"📅 Planea tu semana", body: weekDone > 0 ? `Terminaste ${weekDone} tareas esta semana. ¿Qué lograrás esta semana?` : "Una semana nueva empieza. Define tus 3 objetivos clave." },
    { title:"🗓 Domingo de planificación", body:"5 minutos hoy ahorran horas de confusión mañana." },
    { title:"🚀 Nueva semana, nueva oportunidad", body:"Abre Focus y organiza tu semana antes de que empiece." },
  ];

  const m = pick(msgs);
  const payload = { id: "weekly_motivation", title: m.title, body: m.body, tag: "weekly", scheduledAt: todayAt("19:00") };

  if (usePush) {
    await schedulePush(payload);
  } else {
    const ms = msUntil("19:00");
    if (ms > 0) await scheduleViaSW(payload.id, payload.title, payload.body, ms);
  }

  localStorage.setItem("pf4_weekly_date", todayISO());
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRADOR PRINCIPAL
// Llama a esto desde useEffect en App.jsx cuando notifPerm === "granted"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {Array}  opts.tasks      - todas las tareas
 * @param {Array}  opts.habits     - todos los hábitos
 * @param {Array}  opts.todayTasks - tareas del día actual ya filtradas
 * @param {boolean} opts.usePush   - true si hay sesión Supabase y push_subscription en localStorage
 * @returns {Array} timers - array de setTimeout IDs para cancelar al desmontar
 */
export async function scheduleAllNotifications({ tasks, habits, todayTasks, usePush }) {
  const allTimers = [];

  try {
    // 1. Rituales diarios (una vez por día)
    const dailyTimers = await scheduleDailyRituals(usePush);
    if (dailyTimers) allTimers.push(...dailyTimers);

    // 2. Ciclo de vida de cada tarea de hoy
    const taskTimers = await scheduleTaskLifecycle(todayTasks, usePush);
    if (taskTimers) allTimers.push(...taskTimers);

    // 3. Recordatorios de hábitos (una vez por día)
    await scheduleHabitReminders(habits, usePush);

    // 4. Tareas vencidas de ayer
    await scheduleOverdueReminder(tasks, usePush);

    // 5. Motivación semanal (solo domingos)
    await scheduleWeeklyMotivation(tasks, usePush);

  } catch (err) {
    console.warn("[notifications] Error en scheduleAllNotifications:", err);
  }

  return allTimers;
}
