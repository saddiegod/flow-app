import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import WebPush from "https://esm.sh/web-push@3.4.5"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // 1. Configuración de tus llaves VAPID
  const VAPID_PUBLIC_KEY = "sb_publishable_7jTGeLC-FP-D7n8e_mD1SQ_UPfXPqDY"; // Reemplaza con tu llave pública
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

  WebPush.setVapidDetails(
    'dominguezdiego2004@gmail.com', // Reemplaza con tu correo
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  // 2. Conexión a Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  
  // 3. Ajustamos el reloj a tu zona horaria para que las notificaciones de rutina sean exactas
  const timeStr = now.toLocaleTimeString('es-MX', { 
    timeZone: 'America/Mexico_City', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  let notificationsSent = 0;

  // Función auxiliar para enviar push
  const sendPush = async (subscription, title, body) => {
    try {
      await WebPush.sendNotification(subscription, JSON.stringify({ title, body }));
      return true;
    } catch (err) {
      console.error("Error enviando push:", err);
      return false;
    }
  };

  // ─── A. RUTINA DIARIA (Globales) ──────────────────────────────────────────
  
  // Obtenemos todas las suscripciones guardadas para mandar los mensajes generales
  const { data: globalSubs } = await supabase.from('push_subscriptions').select('subscription');
  
  const sendGlobalPush = async (title, body) => {
    if (globalSubs) {
      for (const subRow of globalSubs) {
        if (subRow.subscription) {
          await sendPush(subRow.subscription, title, body);
          notificationsSent++;
        }
      }
    }
  };

  if (timeStr === "08:00") {
    await sendGlobalPush("🌅 ¡Buen día, Diego!", "Un nuevo día para fluir. ¿Qué vamos a lograr hoy?");
  } else if (timeStr === "14:00") {
    await sendGlobalPush("✨ Mitad de jornada", "Recuerda hidratarte y respirar. Vas muy bien.");
  } else if (timeStr === "22:30") {
    await sendGlobalPush("🌙 Tiempo de descansar", "Es hora de desconectar. El descanso es parte del proceso.");
  }

  // ─── B. NOTIFICACIONES DE TAREAS (Inteligentes) ──────────────────────────
  
  const { data: activeTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .lte('start_time', now.toISOString())
    .gte('end_time', now.toISOString());

  if (error) {
    console.error("Error al buscar tareas:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Banco de frases motivacionales para no aburrirte
  const halfPhrases = [
    "Mantén el enfoque, lo estás haciendo genial. 🔥",
    "El momento es ahora. Sigue así. 🧠",
    "Ya pasaste lo más difícil. ¡Termina fuerte! ⚡",
    "Un pequeño esfuerzo más. Tú puedes. 🎯"
  ];

  if (activeTasks && activeTasks.length > 0) {
    for (const task of activeTasks) {
      if (!task.subscription) continue;

      const start = new Date(task.start_time);
      const end = new Date(task.end_time);
      const totalDuration = end.getTime() - start.getTime();
      const halfTime = new Date(start.getTime() + totalDuration / 2);
      const fiveMinBefore = new Date(end.getTime() - 5 * 60000);

      // 1. INICIO DE LA TAREA
      if (now >= start && !task.notified_start) {
        const success = await sendPush(task.subscription, "🚀 ¡A darle!", `Inicia ahora: ${task.title}`);
        if (success) {
          await supabase.from('tasks').update({ notified_start: true }).eq('id', task.id);
          notificationsSent++;
        }
      }

      // 2. MITAD DE LA TAREA (Con frases aleatorias)
      if (now >= halfTime && !task.notified_half) {
        const randomPhrase = halfPhrases[Math.floor(Math.random() * halfPhrases.length)];
        const success = await sendPush(task.subscription, "Mitad del camino", randomPhrase);
        if (success) {
          await supabase.from('tasks').update({ notified_half: true }).eq('id', task.id);
          notificationsSent++;
        }
      }

      // 3. FINAL DE LA TAREA (5 min antes)
      if (now >= fiveMinBefore && !task.notified_end) {
        const success = await sendPush(task.subscription, "🏁 Recta final", `Faltan 5 min para cerrar: ${task.title}`);
        if (success) {
          await supabase.from('tasks').update({ notified_end: true }).eq('id', task.id);
          notificationsSent++;
        }
      }
    }
  }

  // 5. Respuesta del servidor
  return new Response(JSON.stringify({ 
    done: true, 
    tasksChecked: activeTasks?.length || 0,
    notificationsSent 
  }), {
    headers: { "Content-Type": "application/json" },
  });
});