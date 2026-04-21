import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── ESTILOS GLOBALES Y ANIMACIONES (Aesthetic iOS) ─────────────────────────
const injectStyles = () => {
  if (document.getElementById("app-styles")) return;
  const style = document.createElement("style");
  style.id = "app-styles";
  style.innerHTML = `
    @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade { animation: fadeIn 0.4s ease forwards; }
    .task-item { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .task-done { opacity: 0.4; transform: scale(0.98); filter: grayscale(100%); }
    ::-webkit-scrollbar { width: 0px; background: transparent; }
    body { margin: 0; background-color: #FAFAFC; -webkit-font-smoothing: antialiased; }
    input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
  `;
  document.head.appendChild(style);
};

// ─── SONIDOS NATIVOS ────────────────────────────────────────────────────────
let audioCtx = null;
const playSound = (type) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'click') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now); osc.stop(now + 0.04);
    } else if (type === 'success') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.04, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    }
  } catch(e) {}
};

// ─── CONSTANTES Y DATOS RÁPIDOS ─────────────────────────────────────────────
const CATEGORIES = [
  { id: "work", label: "Trabajo", icon: "💻" },
  { id: "personal", label: "Personal", icon: "👤" },
  { id: "itinerary", label: "Viaje/Ruta", icon: "✈️" },
  { id: "study", label: "Estudio", icon: "📚" }
];

const QUICK_TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
const QUICK_TASKS = ["Responder correos", "Leer 20 mins", "Hacer ejercicio", "Revisar pendientes", "Comprar despensa", "Meditar", "Avanzar proyecto"];

const ACCENT_PRESETS = [
  { name: "Blue iOS", v: "#007AFF" }, { name: "Green iOS", v: "#34C759" },
  { name: "Orange iOS", v: "#FF9500" }, { name: "Purple iOS", v: "#AF52DE" },
  { name: "Pink iOS", v: "#FF2D55" }, { name: "Dark", v: "#1C1C1E" },
];

const getTodayStr = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

const makeC = (accent = "#007AFF") => ({
  bg: "#FAFAFC", surface: "#FFFFFF", border: "#E5E5EA",
  green: "#34C759", red: "#FF3B30",
  accent, accentDim: accent + "15", 
  text: "#1C1C1E", textDim: "#8E8E93", muted: "#C7C7CC",
});

const fontClean = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, sans-serif";

const INPUT_STYLE = {
  width: "100%", padding: "18px 20px", borderRadius: 16, fontSize: 16, fontFamily: fontClean, 
  boxSizing: "border-box", outline: "none", background: "#F2F2F7", border: "none", color: "#1C1C1E", fontWeight: "500", transition: "all 0.2s"
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════
const StarRating = ({ value, onChange, C }) => (
  <div style={{ display: "flex", gap: 6 }}>
    {[1, 2, 3].map((n) => (
      <button key={n} type="button" onClick={(e) => { e.preventDefault(); playSound('click'); onChange(n === value ? 0 : n); }}
        style={{ background: n <= value ? "#FF950022" : C.bg, border: "none", cursor: "pointer", fontSize: 18, color: n <= value ? "#FF9500" : C.muted, padding: "10px", borderRadius: "50%", lineHeight: 1, transition: "all 0.2s", transform: n <= value ? "scale(1.05)" : "scale(1)" }}>
        🔥
      </button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ─── ESTADOS ───
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState("agenda");
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: "", category: "work", priority: 1, time: "" });
  const [loaded, setLoaded] = useState(false);
  const [accent, setAccent] = useState("#007AFF");

  const C = useMemo(() => makeC(accent), [accent]);

  useEffect(() => { injectStyles(); }, []);

  // ─── AUTENTICACIÓN Y CARGA DE DATOS (LOCAL VS NUBE) ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (session) {
        // Carga desde la nube (Supabase)
        const meta = session.user.user_metadata;
        if (meta?.accent) setAccent(meta.accent);

        const { data, error } = await supabase.from("tasks").select("*").eq("user_id", session.user.id).order("id", { ascending: false });
        if (!error && data) setTasks(data);
      } else {
        // Carga Local (Sin cuenta)
        const localTasks = localStorage.getItem("flow_tasks");
        const localAccent = localStorage.getItem("flow_accent");
        if (localTasks) setTasks(JSON.parse(localTasks));
        if (localAccent) setAccent(localAccent);
      }
      setLoaded(true);
    };
    loadData();
  }, [session]);

  // Guardado automático en LocalStorage si no hay sesión
  useEffect(() => {
    if (!session && loaded) {
      localStorage.setItem("flow_tasks", JSON.stringify(tasks));
      localStorage.setItem("flow_accent", accent);
    }
  }, [tasks, accent, session, loaded]);

  // ─── FUNCIONES DE AUTENTICACIÓN ───
  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      if (isLogin) { 
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); 
        if (error) throw error; 
      } else { 
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword }); 
        if (error) throw error; 
        alert("Cuenta creada. Ya puedes iniciar sesión."); 
      }
      // Al iniciar sesión, borramos la data local para usar la de la nube
      localStorage.removeItem("flow_tasks");
    } catch (err) { alert(err.message); } finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    playSound('click');
    await supabase.auth.signOut();
    setTasks([]); // Limpia la pantalla al salir
  };

  // ─── LÓGICA CRUD (HÍBRIDA: LOCAL / NUBE) ───
  const addTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { playSound('error'); return; }
    
    const newId = Date.now();
    const payload = {
      id: newId, 
      user_id: session ? session.user.id : "local-user", 
      title: form.title.trim(), 
      category: form.category || "work", 
      date: getTodayStr(), 
      time_target: form.time || null, 
      priority: form.priority || 1, 
      status: "pending"
    };
    
    // 1. Actualización instantánea en pantalla
    setTasks(prev => [payload, ...prev]);
    playSound('success');
    setForm({ title: "", category: "work", priority: 1, time: "" });
    setTab("agenda");

    // 2. Si hay sesión, guarda en la nube
    if (session) {
      const { error } = await supabase.from("tasks").insert([payload]);
      if (error) {
        alert("Error en la nube: " + error.message);
        setTasks(prev => prev.filter(t => t.id !== newId)); // Revierte si falla
      }
    }
  };

  const toggleTaskStatus = async (task) => {
    playSound('click');
    const newStatus = task.status === "done" ? "pending" : "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    
    if (session) {
      await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    }
  };

  const deleteTask = async (id) => {
    playSound('click');
    setTasks(prev => prev.filter(t => t.id !== id));
    if (session) {
      await supabase.from("tasks").delete().eq("id", id);
    }
  };

  const updateAccent = async (newAccent) => {
    playSound('click');
    setAccent(newAccent);
    if (session) await supabase.auth.updateUser({ data: { accent: newAccent } });
  };

  // ─── DERIVADOS ───
  const todayStr = getTodayStr();
  const pendingTasks = tasks.filter(t => t.status === "pending").sort((a,b) => b.priority - a.priority);
  const doneTasks = tasks.filter(t => t.status === "done").slice(0, 10); // Mostramos solo las últimas 10
  const timetableTasks = tasks.filter(t => t.date === todayStr && t.time_target).sort((a, b) => a.time_target.localeCompare(b.time_target));

  // ─── ESTILOS COMPARTIDOS ───
  const cardStyle = { background: C.surface, borderRadius: 28, padding: 28, marginBottom: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.04)" };
  const sectionLabelStyle = { fontSize: 14, fontWeight: "800", color: C.textDim, marginBottom: 16, fontFamily: fontClean, textTransform: "uppercase", letterSpacing: 0.5 };

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: fontClean, fontWeight: "600" }}>Cargando...</div>;

  return (
    <div style={{ fontFamily: fontClean, background: C.bg, minHeight: "100vh", color: C.text }}>
      
      {/* ─── CABECERA FLOTANTE (GLASSMORPHISM MÁS LIMPIO) ─── */}
      <div style={{ background: "rgba(250, 250, 252, 0.75)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 50, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1px solid rgba(0,0,0,0.03)` }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: "700", color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{todayStr}</div>
          <div style={{ fontSize: 34, fontWeight: "900", color: C.text, letterSpacing: "-1px", lineHeight: 1 }}>Focus.</div>
        </div>
        {!session && <div style={{ fontSize: 12, fontWeight: "700", color: C.accent, background: C.accentDim, padding: "6px 12px", borderRadius: 12 }}>Modo Local</div>}
      </div>

      <div style={{ padding: "24px 20px 100px", maxWidth: 600, margin: "0 auto" }}>
        
        {/* ══════════════════════════════════════════════════════════════
            PÉSTAÑA 1: AGENDA Y TIMETABLE
        ══════════════════════════════════════════════════════════════ */}
        {tab === "agenda" && <div className="animate-fade">
          
          {/* ITINERARIO VISUAL */}
          {timetableTasks.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ ...sectionLabelStyle, paddingLeft: 4 }}>Mi Horario</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {timetableTasks.map((t) => (
                  <div key={`time-${t.id}`} className={`task-item ${t.status === "done" ? "task-done" : ""}`} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                    <div style={{ width: 52, textAlign: "right", color: t.status === "done" ? C.muted : C.text, fontWeight: "800", fontSize: 16, paddingTop: 18 }}>
                      {t.time_target}
                    </div>
                    <div style={{ width: 4, background: t.status === "done" ? C.border : C.accent, borderRadius: 4, opacity: t.status === "done" ? 0.5 : 1 }} />
                    <div style={{ flex: 1, background: C.surface, padding: "18px 20px", borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: "700", color: C.text, fontSize: 17, letterSpacing: "-0.3px" }}>{t.title}</div>
                        <div style={{ fontSize: 13, color: C.textDim, marginTop: 4, fontWeight: "600" }}>{CATEGORIES.find(c => c.id === t.category)?.label}</div>
                      </div>
                      <div onClick={() => toggleTaskStatus(t)} style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${t.status === "done" ? C.text : C.border}`, background: t.status === "done" ? C.text : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", transition: "all 0.2s" }}>
                        {t.status === "done" && "✓"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAREAS PENDIENTES */}
          <div style={{ ...sectionLabelStyle, paddingLeft: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Pendientes</span>
            <span style={{ background: C.border, color: C.textDim, padding: "2px 8px", borderRadius: 10, fontSize: 12 }}>{pendingTasks.length}</span>
          </div>
          {pendingTasks.length === 0 && <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted, fontWeight: "600", fontSize: 16, background: C.surface, borderRadius: 28, border: `1px dashed ${C.border}` }}>Nada pendiente. Estás al día. ✨</div>}
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingTasks.map((t) => (
              <div key={t.id} className="task-item" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: C.surface, borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                <button onClick={() => toggleTaskStatus(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${C.textDim}`, background: "transparent", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}></button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: "700", color: C.text, display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.3px" }}>
                    {t.title} {t.priority > 1 && <span style={{ fontSize: 14 }}>{"🔥".repeat(t.priority)}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.textDim, marginTop: 6, fontWeight: "600", display: "flex", gap: 10, alignItems: "center" }}>
                    {t.time_target && <span style={{ color: C.text, background: C.bg, padding: "4px 8px", borderRadius: 8 }}>🕒 {t.time_target}</span>}
                    <span>{CATEGORIES.find(c => c.id === t.category)?.label || t.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* TAREAS COMPLETADAS */}
          {doneTasks.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{ ...sectionLabelStyle, paddingLeft: 4 }}>Completadas</div>
              {doneTasks.map((t) => (
                <div key={t.id} className="task-done" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "transparent", borderRadius: 20, marginBottom: 8 }}>
                  <button onClick={() => toggleTaskStatus(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: C.text, cursor: "pointer", color: "#fff", fontSize: 15, fontWeight: "bold" }}>✓</button>
                  <div style={{ flex: 1, textDecoration: "line-through", color: C.textDim, fontSize: 16, fontWeight: "600", letterSpacing: "-0.3px" }}>{t.title}</div>
                  <button onClick={() => deleteTask(t.id)} style={{ background: C.border, border: "none", color: C.text, cursor: "pointer", padding: "8px 14px", borderRadius: 12, fontWeight: "700", fontSize: 12 }}>Borrar</button>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            PÉSTAÑA 2: AGREGAR TAREA (FORMULARIO OPTIMIZADO)
        ══════════════════════════════════════════════════════════════ */}
        {tab === "add" && <div className="animate-slide-up" style={cardStyle}>
          <form onSubmit={addTask}>
            <input type="text" placeholder="¿Qué vamos a hacer?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} 
              style={{ ...INPUT_STYLE, fontSize: 24, fontWeight: "800", padding: "10px 0", background: "transparent", borderRadius: 0, marginBottom: 24, letterSpacing: "-0.5px" }} />
            
            {/* TAREAS RÁPIDAS (NUEVO) */}
            <div style={{ fontSize: 12, fontWeight: "800", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Ideas Rápidas</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16, WebkitOverflowScrolling: "touch" }}>
              {QUICK_TASKS.map(task => (
                <button key={task} type="button" onClick={() => { playSound('click'); setForm({ ...form, title: task }); }}
                  style={{ padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: form.title === task ? C.text : "transparent", color: form.title === task ? "#fff" : C.text, fontWeight: "600", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                  + {task}
                </button>
              ))}
            </div>
            
            <div style={{ fontSize: 12, fontWeight: "800", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Horario (Opcional)</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 12, WebkitOverflowScrolling: "touch" }}>
              {QUICK_TIMES.map(time => (
                <button key={time} type="button" onClick={() => { playSound('click'); setForm({ ...form, time }); }}
                  style={{ padding: "10px 16px", borderRadius: 14, border: "none", background: form.time === time ? C.accent : C.bg, color: form.time === time ? "#fff" : C.textDim, fontWeight: "700", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                  {time}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 28, alignItems: "center" }}>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={{ ...INPUT_STYLE, flex: 1, padding: "14px 18px", color: form.time ? C.text : C.muted, fontWeight: "700" }} />
              <div style={{ background: C.bg, padding: "4px 12px", borderRadius: 16 }}>
                <StarRating value={form.priority} onChange={(r) => setForm({ ...form, priority: r })} C={C} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap" }}>
              {CATEGORIES.map(c => (
                <button type="button" key={c.id} onClick={() => { playSound('click'); setForm({ ...form, category: c.id }); }} 
                  style={{ flex: "1 1 calc(50% - 10px)", padding: "14px", borderRadius: 16, border: "none", cursor: "pointer", background: form.category === c.id ? C.accentDim : C.bg, color: form.category === c.id ? C.accent : C.textDim, fontSize: 14, fontWeight: "700", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>

            <button type="submit" style={{ width: "100%", padding: 20, borderRadius: 20, border: "none", cursor: "pointer", background: C.text, color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: "-0.3px", transition: "transform 0.1s", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"} onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
              Guardar Tarea
            </button>
          </form>
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            PÉSTAÑA 3: AJUSTES Y NUBE
        ══════════════════════════════════════════════════════════════ */}
        {tab === "config" && <div className="animate-fade">
          
          {/* PERSONALIZACIÓN */}
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Color de la App</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {ACCENT_PRESETS.map((p) => (
                <button type="button" key={p.v} onClick={() => updateAccent(p.v)}
                  style={{ width: 48, height: 48, borderRadius: "50%", border: `4px solid ${accent === p.v ? C.bg : "transparent"}`, background: p.v, cursor: "pointer", boxShadow: accent === p.v ? `0 0 0 2px ${p.v}` : "none", transition: "all 0.2s" }} />
              ))}
            </div>
          </div>

          {/* SECCIÓN DE SINCRONIZACIÓN / CUENTA */}
          <div style={cardStyle}>
            <div style={{ ...sectionLabelStyle, display: "flex", alignItems: "center", gap: 8 }}>
              ☁️ Sincronización
            </div>
            
            {session ? (
              <div>
                <p style={{ color: C.textDim, fontSize: 14, fontWeight: "500", lineHeight: 1.5, marginBottom: 20 }}>Tus datos se están guardando de forma segura en la nube. Puedes acceder desde cualquier dispositivo.</p>
                <div style={{ padding: "16px", background: C.bg, borderRadius: 16, fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 24 }}>
                  Sesión activa: {session.user.email}
                </div>
                <button onClick={handleLogout} style={{ width: "100%", padding: 18, borderRadius: 16, background: C.redD, border: "none", color: C.red, fontSize: 15, cursor: "pointer", fontWeight: "800" }}>
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: C.textDim, fontSize: 14, fontWeight: "500", lineHeight: 1.5, marginBottom: 24 }}>
                  Estás usando la app en Modo Local. Tus tareas se guardan en este dispositivo. Inicia sesión para guardar en la nube y sincronizar.
                </p>
                <form onSubmit={handleAuth}>
                  <input type="email" placeholder="Correo electrónico" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ ...INPUT_STYLE, marginBottom: 12 }} />
                  <input type="password" placeholder="Contraseña" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ ...INPUT_STYLE, marginBottom: 20 }} />
                  <button type="submit" disabled={authLoading} onClick={() => playSound('click')} style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: "800", cursor: "pointer", opacity: authLoading ? 0.7 : 1, boxShadow: `0 8px 24px ${C.accent}40` }}>
                    {authLoading ? "Cargando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
                  </button>
                </form>
                <button type="button" onClick={() => { playSound('click'); setIsLogin(!isLogin); }} style={{ width: "100%", background: "none", border: "none", marginTop: 20, color: C.accent, fontSize: 14, fontWeight: "700", cursor: "pointer" }}>
                  {isLogin ? "¿No tienes cuenta? Crea una" : "Ya tengo cuenta"}
                </button>
              </div>
            )}
          </div>
        </div>}

      </div>

      {/* ─── NAVEGACIÓN INFERIOR (TAB BAR TIPO IOS) ─── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(250, 250, 252, 0.8)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: `1px solid rgba(0,0,0,0.04)`, display: "flex", justifyContent: "center", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 600, padding: "4px 8px" }}>
          {[
            { k: "agenda", icon: "📋", l: "Tareas" },
            { k: "add",    icon: "＋", l: "Agregar"  },
            { k: "config", icon: "⚙️", l: "Ajustes"}
          ].map((t) => (
            <button type="button" key={t.k} onClick={() => { playSound('click'); setTab(t.k); }}
              style={{ flex: 1, padding: "12px 4px", border: "none", background: "transparent", cursor: "pointer", color: tab === t.k ? C.accent : C.muted, transition: "all 0.2s" }}>
              <div style={{ fontSize: 24, marginBottom: 4, filter: tab === t.k ? "none" : "grayscale(100%)", opacity: tab === t.k ? 1 : 0.5, transition: "transform 0.2s", transform: tab === t.k ? "scale(1.15)" : "scale(1)" }}>{t.icon}</div>
              <div style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: tab === t.k ? C.text : C.muted }}>{t.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}