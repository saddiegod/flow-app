import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import WebPush from "https://esm.sh/web-push@3.4.5"

serve(async (req) => {
  // Configuración de tus llaves (Las que generaste antes)
  const VAPID_PUBLIC_KEY = "TU_PUBLIC_KEY";
  const VAPID_PRIVATE_KEY = "TU_PRIVATE_KEY"; // AQUÍ va la secreta

  WebPush.setVapidDetails(
    'mailto:tu@correo.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  // 1. Conectar a la DB y buscar tareas que empiecen en los próximos 10 min
  // Aquí es donde la lógica de tu App se vuelve "inteligente"
  // Por ahora, simularemos el envío a todas las suscripciones:
  
  // (Este es un ejemplo simplificado, aquí harías un fetch a tu tabla push_subscriptions)
  const subscriptions = []; // Aquí cargarías las de Supabase

  const notifications = subscriptions.map(sub => {
    return WebPush.sendNotification(sub, JSON.stringify({
      title: "¡Es hora de enfocarse!",
      body: "Tienes una tarea pendiente en 10 minutos.",
    }));
  });

  await Promise.all(notifications);

  return new Response(JSON.stringify({ done: true }), {
    headers: { "Content-Type": "application/json" },
  });
})