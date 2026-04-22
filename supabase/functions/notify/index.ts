import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import WebPush from "https://esm.sh/web-push@3.4.5"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // 1. Configuración de tus llaves VAPID
  const VAPID_PUBLIC_KEY = "TU_PUBLIC_KEY"; // Reemplaza con tu llave pública
  const VAPID_PRIVATE_KEY = "TU_PRIVATE_KEY"; // Reemplaza con tu llave secreta

  WebPush.setVapidDetails(
    'mailto:tu@correo.com', // Reemplaza con tu correo
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  // 2. Conexión a Supabase usando variables de entorno automáticas de Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();

  // 3. Buscamos tareas que estén ocurriendo JUSTO AHORA
  const { data: activeTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .lte('start_time', now.toISOString()) // Ya empezó
    .gte('end_time', now.toISOString());  // No ha terminado

  if (error) {
    console.error("Error al buscar tareas:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Función auxiliar para enviar la notificación y atrapar errores
  const sendPush = async (subscription, title, body) => {
    try {
      await WebPush.sendNotification(subscription, JSON.stringify({ title, body }));
      return true;
    } catch (err) {
      console.error("Error enviando push (suscripción expirada o inválida):", err);
      return false;
    }
  };

  let notificationsSent = 0;

  // 4. Lógica Inteligente para cada tarea activa
  if (activeTasks && activeTasks.length > 0) {
    for (const task of activeTasks) {
      // Validar que la tarea tenga una suscripción guardada
      if (!task.subscription) continue;

      const start = new Date(task.start_time);
      const end = new Date(task.end_time);
      const totalDuration = end.getTime() - start.getTime();
      const halfTime = new Date(start.getTime() + totalDuration / 2);
      const fiveMinBefore = new Date(end.getTime() - 5 * 60000);

      // ¿Es momento de la notificación de MITAD?
      if (now >= halfTime && !task.notified_half) {
        const success = await sendPush(task.subscription, "¡Vas por la mitad!", `Sigue con: ${task.title}. ¡Tú puedes!`);
        if (success) {
          await supabase.from('tasks').update({ notified_half: true }).eq('id', task.id);
          notificationsSent++;
        }
      }

      // ¿Faltan 5 minutos para terminar?
      if (now >= fiveMinBefore && !task.notified_end) {
        const success = await sendPush(task.subscription, "¡Casi terminas!", `Faltan 5 min para cerrar: ${task.title}`);
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
})