import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import WebPush from "https://esm.sh/web-push@3.4.5"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // Llaves VAPID (Asegúrate de que sean las tuyas)
  const VAPID_PUBLIC_KEY = "BCxNAVbAFYfYxOue7-1Rae3EgU2oHFpsfkxKWSDibvjWvrPIa1WlKWqcWBSLTb4dwtQOoD3_xU_b6jI68Ct1gwQ";
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

  WebPush.setVapidDetails('dominguezdiego2004@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  
  const now = new Date();
  // Hora en CDMX para las notificaciones globales
  const timeMX = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false, hour: '2-digit', minute: '2-digit' });

  console.log(`[LOG] Ejecutando cartero a las: ${now.toISOString()} (MX: ${timeMX})`);

  // --- 1. NOTIFICACIONES DE RUTINA ---
  const sendGlobal = async (title, body) => {
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription');
    if (subs) {
      for (const s of subs) {
        await WebPush.sendNotification(s.subscription, JSON.stringify({ title, body })).catch(e => console.error("Error global:", e));
      }
    }
  };

  if (timeMX === "08:00") await sendGlobal("🌅 Buenos días", "Es momento de arrancar con enfoque.");
  if (timeMX === "14:00") await sendGlobal("✨ Mitad del día", "Haz una pausa y respira. Vas muy bien.");
  if (timeMX === "22:30") await sendGlobal("🌙 Hora de dormir", "Buen trabajo hoy. Descansa para recuperar energía.");

  // --- 2. NOTIFICACIONES DE TAREAS ---
  // Buscamos tareas que DEBERÍAN estar activas en este rango de tiempo
  const { data: tasks, error } = await supabase.from('tasks').select('*')
    .lte('start_time', now.toISOString())
    .gte('end_time', now.toISOString());

  if (error) return new Response(JSON.stringify({ error }));

  console.log(`[LOG] Tareas encontradas para procesar: ${tasks?.length || 0}`);

  if (tasks) {
    for (const task of tasks) {
      if (!task.subscription) {
        console.log(`[ALERTA] La tarea ${task.id} no tiene suscripción.`);
        continue;
      }

      const start = new Date(task.start_time);
      const end = new Date(task.end_time);
      const half = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
      const tMinus5 = new Date(end.getTime() - 5 * 60000);

      // INICIO
      if (!task.notified_start) {
        await WebPush.sendNotification(task.subscription, JSON.stringify({ title: "🚀 ¡Inicia ahora!", body: task.title })).catch(() => {});
        await supabase.from('tasks').update({ notified_start: true }).eq('id', task.id);
      }
      // MITAD
      if (now >= half && !task.notified_half) {
        await WebPush.sendNotification(task.subscription, JSON.stringify({ title: "🔥 Vas a la mitad", body: `Sigue con: ${task.title}` })).catch(() => {});
        await supabase.from('tasks').update({ notified_half: true }).eq('id', task.id);
      }
      // FIN (T-5)
      if (now >= tMinus5 && !task.notified_end) {
        await WebPush.sendNotification(task.subscription, JSON.stringify({ title: "🏁 Casi terminas", body: `5 min para cerrar: ${task.title}` })).catch(() => {});
        await supabase.from('tasks').update({ notified_end: true }).eq('id', task.id);
      }
    }
  }

  return new Response(JSON.stringify({ status: "ok", processed: tasks?.length }));
});