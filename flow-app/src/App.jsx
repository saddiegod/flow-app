import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── ESTILOS GLOBALES Y ANIMACIONES (Inyectados dinámicamente) ──────────────
const injectStyles = () => {
  if (document.getElementById("app-styles")) return;
  const style = document.createElement("style");
  style.id = "app-styles";
  style.innerHTML = `
    @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes popIn { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .task-item { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .task-done { opacity: 0.5; transform: scale(0.98); }
    ::-webkit-scrollbar { width: 0px; background: transparent; }
  `;
  document.head.appendChild(style);
};

// ─── SONIDOS NATIVOS ────────────────────────────────────────────────────────
let audioCtx = null;
const playSound = (type) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'click') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'notify') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(500, now); osc.frequency.setValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  } catch(e) {}
};

// ─── CONSTANTES ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "work", label: "Trabajo", icon: "💻" },
  { id: "personal", label: "Personal", icon: "👤" },
  { id: "itinerary", label: "Itinerario", icon: "✈️" },
  { id: "study", label: "Estudio", icon: "📚" }
];

const HABITS_LIST = [
  { id: "meditar", label: "Meditar", icon: "🧘" },
  { id: "leer", label: "Leer 20m", icon: "📖" },
  { id: "agua", label: "Agua", icon: "💧" },
  { id: "ejercicio", label: "Ejercicio", icon: "🏃" }
];

const QUICK_TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

const ACCENT_PRESETS = [
  { name: "Blue iOS", v: "#007AFF" }, { name: "Green iOS", v: "#34C759" },
  { name: "Orange iOS", v: "#FF9500" }, { name: "Purple iOS", v: "#AF52DE" },
  { name: "Pink iOS", v: "#FF2D55" }, { name: "Teal iOS", v: "#5AC8FA" },
];

const fmtElapsed = (ms) => {
  const totalSecs = Math.floor(ms / 1000); const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60); const s = totalSecs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getTodayStr = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
const getMonthStr = () => new Date().toLocaleDateString("es-MX", { month: "short" });

const makeC = (accent = "#007AFF") => ({
  bg: "#F2F2F7", surface: "#FFFFFF", card: "#FFFFFF", border: "#E5E5EA",
  green: "#34C759", greenD: "#E5F9EA", red: "#FF3B30", redD: "#FFECEB",
  accent, accentDim: accent + "1A", gold: "#FF9500", 
  text: "#1C1C1E", textDim: "#8E8E93", muted: "#AEAEB2",
});

const fontClean = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const INPUT_STYLE_BASE = {
  width: "100%", padding: "16px", borderRadius: 14, fontSize: 16, fontFamily: fontClean, 
  boxSizing: "border-box", outline: "none", background: "#F2F2F7", border: "none", color: "#1C1C1E", transition: "all 0.2s"
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState("dash");
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState({ meditar: false, agua: false, leer: false, ejercicio: false });
  const [form, setForm] = useState({ title: "", category: "work", note: "", priority: 1, time: "" });
  const [loaded, setLoaded] = useState(false);

  const [timerActive, setTimerActive] = useState(false);
  const [timerStart, setTimerStart] = useState(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [currentFocus, setCurrentFocus] = useState("");
  
  const [accent, setAccent] = useState("#007AFF");
  const [dailyGoal, setDailyGoal] = useState(5);
  const notifiedTasks = useRef(new Set()); // Para no repetir notificaciones

  const C = useMemo(() => makeC(accent), [accent]);

  useEffect(() => { injectStyles(); }, []);

  // ── Permisos de Notificación
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // ── Lógica de Notificaciones de Horario
  useEffect(() => {
    const checkAlarms = setInterval(() => {
      if (!tasks.length) return;
      const now = new Date();
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = getTodayStr();

      tasks.forEach(t => {
        if (t.date === todayStr && t.time_target === currentHM && t.status === "pending" && !notifiedTasks.current.has(t.id)) {
          playSound('notify');
          if (Notification.permission === "granted") {
            new Notification("¡Hora de empezar!", { body: t.title, icon: "/favicon.ico" });
          }
          notifiedTasks.current.add(t.id);
        }
      });
    }, 30000); // Revisa cada 30 segundos
    return () => clearInterval(checkAlarms);
  }, [tasks]);

  // ── Timer Logic
  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => setTimerElapsed(Date.now() - timerStart), 1000);
    return () => clearInterval(id);
  }, [timerActive, timerStart]);

  const toggleTimer = useCallback((e) => {
    if(e) e.preventDefault(); playSound('click');
    if (timerActive) setTimerActive(false);
    else if (timerElapsed > 0) { setTimerStart(Date.now() - timerElapsed); setTimerActive(true); }
    else { setTimerStart(Date.now()); setTimerActive(true); }
  }, [timerActive, timerElapsed]);

  // ── Auth & Load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      if (isLogin) { const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); if (error) throw error; }
      else { const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword }); if (error) throw error; alert("Cuenta creada."); }
    } catch (err) { alert(err.message); } finally { setAuthLoading(false); }
  };

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const meta = session.user.user_metadata;
      if (meta?.accent) setAccent(meta.accent);
      if (meta?.daily_goal) setDailyGoal(meta.daily_goal);

      const today = getTodayStr();
      const lastDate = localStorage.getItem("bk_last_date");
      if (lastDate && lastDate !== today) await supabase.from("daily_habits").delete().eq("user_id", session.user.id).neq("id", "dummy");
      localStorage.setItem("bk_last_date", today);

      const { data: tData } = await supabase.from("tasks").select("*").eq("user_id", session.user.id).order("id", { ascending: false });
      const { data: hData } = await supabase.from("daily_habits").select("*").eq("user_id", session.user.id);

      if (tData) setTasks(tData);
      if (hData) {
        const lH = { meditar: false, agua: false, leer: false, ejercicio: false };
        hData.forEach((item) => { if (lH[item.id] !== undefined) lH[item.id] = item.status; });
        setHabits(lH);
      }
    } catch (err) { console.error(err); }
    setLoaded(true);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const addTask = async (e) => {
    if(e) e.preventDefault();
    if (!form.title.trim()) { playSound('error'); return; }
    
    // Forzamos un ID numérico seguro para bigint
    const newId = Date.now();
    const payload = {
      id: newId, 
      user_id: session.user.id, title: form.title, category: form.category, note: form.note,
      date: getTodayStr(), time_target: form.time || null, priority: form.priority, status: "pending"
    };
    
    // Actualización optimista (Se muestra en pantalla al instante)
    setTasks((prev) => [payload, ...prev]);
    playSound('success');
    setTab("agenda");
    setForm({ title: "", category: "work", note: "", priority: 1, time: "" });

    // Guardado en BD silencioso
    const { error } = await supabase.from("tasks").insert([payload]);
    if (error) {
      alert(`Error al guardar en la nube: ${error.message}. Revisa las reglas RLS de Supabase.`);
      setTasks((prev) => prev.filter(t => t.id !== newId)); // Revertir si falla
    }
  };

  const toggleTaskStatus = async (task) => {
    playSound('click');
    const newStatus = task.status === "done" ? "pending" : "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
  };

  const deleteTask = async (id) => {
    if (!window.confirm("¿Eliminar tarea permanentemente?")) return;
    playSound('error');
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const toggleHabit = async (k) => {
    playSound('click');
    const nextStatus = !habits[k];
    setHabits((prev) => ({ ...prev, [k]: nextStatus }));
    await supabase.from("daily_habits").upsert({ id: k, user_id: session.user.id, status: nextStatus });
  };

  // ── ESTADO DERIVADO
  const todayStr = getTodayStr();
  const todaysTasks = useMemo(() => tasks.filter(t => t.date === todayStr), [tasks, todayStr]);
  const completedToday = useMemo(() => todaysTasks.filter(t => t.status === "done").length, [todaysTasks]);
  const progressPct = useMemo(() => Math.min((completedToday / dailyGoal) * 100, 100), [completedToday, dailyGoal]);

  const pendingTasks = useMemo(() => tasks.filter(t => t.status === "pending").sort((a,b) => b.priority - a.priority), [tasks]);
  
  // Tareas del día ordenadas cronológicamente para el Itinerario
  const timetableTasks = useMemo(() => {
    return todaysTasks.filter(t => t.time_target).sort((a, b) => a.time_target.localeCompare(b.time_target));
  }, [todaysTasks]);

  // ── LOGIN SCREEN ──
  if (!session) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: fontClean }}>
        <div className="animate-pop" style={{ background: C.surface, borderRadius: 24, padding: 40, width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🌊</div>
            <div style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>Flow & Focus</div>
            <div style={{ fontSize: 14, color: C.textDim, marginTop: 8, fontWeight: "500" }}>Sistema iOS de Productividad</div>
          </div>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Correo electrónico" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ ...INPUT_STYLE_BASE, marginBottom: 16 }} />
            <input type="password" placeholder="Contraseña" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ ...INPUT_STYLE_BASE, marginBottom: 28 }} />
            <button type="submit" disabled={authLoading} onClick={() => playSound('click')} style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: "700", cursor: "pointer", transition: "opacity 0.2s", opacity: authLoading ? 0.7 : 1 }}>
              {authLoading ? "Cargando..." : isLogin ? "Acceder" : "Crear cuenta"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button type="button" onClick={() => { playSound('click'); setIsLogin(!isLogin); }} style={{ background: "none", border: "none", color: C.accent, fontSize: 14, fontWeight: "600", cursor: "pointer" }}>
              {isLogin ? "¿No tienes cuenta? Regístrate" : "Ya tengo cuenta"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: fontClean, fontWeight: "600" }}>Cargando datos...</div>;

  const cardStyle = { background: C.card, borderRadius: 20, padding: 24, marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.03)" };
  const sectionLabelStyle = { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 16, fontFamily: fontClean };

  return (
    <div style={{ fontFamily: fontClean, background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 100 }}>
      {/* ── HEADER ── */}
      <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}88` }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: "600", color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{todayStr}</div>
          <div style={{ fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: "-0.5px" }}>Focus <span style={{ color: C.accent }}>🌊</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          {timerActive && <div className="animate-pop" style={{ fontSize: 16, color: C.accent, fontWeight: "700", fontFamily: "monospace", padding: "6px 12px", background: C.accentDim, borderRadius: 12 }}>⏱ {fmtElapsed(timerElapsed)}</div>}
        </div>
      </div>

      <div style={{ padding: "20px 20px", maxWidth: 540, margin: "0 auto" }}>

        {/* ══════════════════════════════════════════════════════════════
            INICIO (DASHBOARD)
        ══════════════════════════════════════════════════════════════ */}
        {tab === "dash" && <div className="animate-slide-up">
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={sectionLabelStyle}>Progreso Diario</div>
              <div style={{ fontSize: 15, color: completedToday >= dailyGoal ? C.green : C.textDim, fontWeight: "700" }}>{completedToday} de {dailyGoal}</div>
            </div>
            <div style={{ height: 10, background: C.bg, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 10, transition: "width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)", width: `${progressPct}%`, background: progressPct >= 100 ? C.green : C.accent }} />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Hábitos Rápido</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {HABITS_LIST.map((h) => (
                <button type="button" key={h.id} onClick={() => toggleHabit(h.id)} 
                  style={{ padding: "12px 18px", borderRadius: 20, border: "none", background: habits[h.id] ? C.accent : C.bg, color: habits[h.id] ? "#fff" : C.textDim, fontSize: 14, cursor: "pointer", fontWeight: "600", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{h.icon}</span> {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            AGENDA / LISTA Y TIMETABLE
        ══════════════════════════════════════════════════════════════ */}
        {tab === "agenda" && <div className="animate-slide-up">
          {/* VISTA DE ITINERARIO (TIMELINE) */}
          <div style={{ ...cardStyle, background: "transparent", border: "none", boxShadow: "none", padding: "0 0 20px 0" }}>
            <div style={{ ...sectionLabelStyle, color: C.textDim, paddingLeft: 8 }}>Horario del Día</div>
            {timetableTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.muted, fontSize: 14 }}>Sin horarios fijos hoy.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {timetableTasks.map((t) => (
                  <div key={`time-${t.id}`} className={`task-item ${t.status === "done" ? "task-done" : ""}`} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                    <div style={{ width: 50, textAlign: "right", color: t.status === "done" ? C.muted : C.text, fontWeight: "700", fontSize: 15, paddingTop: 16 }}>
                      {t.time_target}
                    </div>
                    <div style={{ width: 3, background: t.status === "done" ? C.border : C.accent, borderRadius: 3, opacity: 0.5 }} />
                    <div style={{ flex: 1, background: C.surface, padding: 16, borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                      <div style={{ fontWeight: "700", color: C.text, fontSize: 16 }}>{t.title}</div>
                      {t.note && <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>{t.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LISTA DE PENDIENTES */}
          <div style={{ ...sectionLabelStyle, marginBottom: 20, color: C.textDim, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>Cosas por hacer ({pendingTasks.length})</div>
          {pendingTasks.map((t) => (
            <div key={t.id} className="task-item animate-pop" style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "20px", background: C.surface, borderRadius: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.03)", marginBottom: 12 }}>
              <button onClick={() => toggleTaskStatus(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${C.accent}`, background: "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2, transition: "background 0.2s" }}></button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: "700", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                  {t.title} {t.priority > 1 && <span style={{ fontSize: 14 }}>{"🔥".repeat(t.priority)}</span>}
                </div>
                {(t.note || t.time_target) && (
                  <div style={{ fontSize: 14, color: C.textDim, marginTop: 6, lineHeight: 1.4, fontWeight: "500" }}>
                    {t.time_target && <span style={{ color: C.accent, fontWeight: "700", marginRight: 8, background: C.accentDim, padding: "4px 8px", borderRadius: 8 }}>{t.time_target}</span>}
                    {t.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            AGREGAR NUEVA
        ══════════════════════════════════════════════════════════════ */}
        {tab === "add" && <div className="animate-slide-up" style={cardStyle}>
          <div style={sectionLabelStyle}>Nueva Tarea</div>

          <input type="text" placeholder="¿Qué necesitas hacer?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} 
            style={{ ...INPUT_STYLE_BASE, fontSize: 20, fontWeight: "700", marginBottom: 16, padding: "20px 16px", background: "transparent", borderBottom: `2px solid ${C.bg}`, borderRadius: 0 }} />
          
          <div style={{ fontSize: 12, fontWeight: "600", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Horario (Opcional)</div>
          
          {/* SELECTOR RÁPIDO DE HORARIOS */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 12, WebkitOverflowScrolling: "touch" }}>
            {QUICK_TIMES.map(time => (
              <button key={time} type="button" onClick={() => { playSound('click'); setForm({ ...form, time }); }}
                style={{ padding: "8px 16px", borderRadius: 12, border: "none", background: form.time === time ? C.accent : C.bg, color: form.time === time ? "#fff" : C.textDim, fontWeight: "700", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                {time}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={{ ...INPUT_STYLE_BASE, flex: 1, color: form.time ? C.text : C.muted, fontWeight: "700" }} />
          </div>

          <textarea placeholder="Notas, detalles..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...INPUT_STYLE_BASE, marginBottom: 24, minHeight: 80, resize: "none" }} />

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: "600", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Prioridad</div>
            <StarRating value={form.priority} onChange={(r) => setForm({ ...form, priority: r })} C={C} />
          </div>

          <button type="button" onClick={addTask} style={{ width: "100%", padding: 18, borderRadius: 16, border: "none", cursor: "pointer", background: C.accent, color: "#fff", fontSize: 16, fontWeight: "700", boxShadow: `0 8px 20px ${C.accent}40`, transition: "transform 0.1s" }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.96)"} onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
            Guardar Tarea
          </button>
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            CONFIGURACIÓN
        ══════════════════════════════════════════════════════════════ */}
        {tab === "config" && <div className="animate-slide-up">
          <div style={cardStyle}>
            <div style={{ ...sectionLabelStyle, marginBottom: 24 }}>Ajustes y Personalización</div>
            
            <div style={{ fontSize: 14, color: C.text, marginBottom: 10, fontWeight: "600" }}>Color de Acento</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
              {ACCENT_PRESETS.map((p) => (
                <button type="button" key={p.v} onClick={(e) => { e.preventDefault(); setAccent(p.v); }}
                  style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${accent === p.v ? C.surface : "transparent"}`, background: p.v, cursor: "pointer", boxShadow: accent === p.v ? `0 0 0 3px ${p.v}66` : "none", transition: "all 0.2s" }} />
              ))}
            </div>

            <button type="button" onClick={() => saveConfig()} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: C.accentDim, color: C.accent, fontSize: 15, cursor: "pointer", fontWeight: "700" }}>Guardar Ajustes</button>
          </div>
        </div>}

      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}88`, display: "flex", justifyContent: "center", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 540 }}>
          {[
            { k: "dash",   icon: "◈", l: "Inicio" },
            { k: "agenda", icon: "≡", l: "Agenda" },
            { k: "add",    icon: "+", l: "Crear"  },
            { k: "config", icon: "⚙", l: "Ajustes"}
          ].map((t) => (
            <button type="button" key={t.k} onClick={() => { playSound('click'); setTab(t.k); }}
              style={{ flex: 1, padding: "14px 4px 10px", border: "none", background: "transparent", cursor: "pointer", color: tab === t.k ? C.accent : C.muted, transition: "color 0.2s" }}>
              <div style={{ fontSize: 20, marginBottom: 4, transition: "transform 0.2s", transform: tab === t.k ? "scale(1.15)" : "scale(1)" }}>{t.icon}</div>
              <div style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{t.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}