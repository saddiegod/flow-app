import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── ESTILOS GLOBALES Y ANIMACIONES (Aesthetic iOS) ─────────────────────────
const injectStyles = () => {
  if (document.getElementById("app-styles")) return;
  const style = document.createElement("style");
  style.id = "app-styles";
  style.innerHTML = `
    @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade { animation: fadeIn 0.3s ease forwards; }
    .task-item { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .task-done { opacity: 0.6; transform: scale(0.98); background: #F2F2F7 !important; color: #8E8E93 !important; box-shadow: none !important; }
    ::-webkit-scrollbar { width: 0px; background: transparent; }
    body { margin: 0; background-color: #FAFAFC; -webkit-font-smoothing: antialiased; }
  `;
  document.head.appendChild(style);
};

// ─── SONIDOS ────────────────────────────────────────────────────────────────
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

// ─── CONSTANTES ─────────────────────────────────────────────────────────────
const QUICK_TASKS = ["Escribir poema", "Avanzar código", "Sesión de póker", "Jugar ajedrez", "Hacer ejercicio", "Leer 20 mins", "Estudiar sistemas"];
const QUICK_TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

const ACCENT_PRESETS = [
  { name: "Blue", v: "#007AFF" }, { name: "Green", v: "#34C759" },
  { name: "Orange", v: "#FF9500" }, { name: "Purple", v: "#AF52DE" },
  { name: "Pink", v: "#FF2D55" }, { name: "Dark", v: "#1C1C1E" },
];

const getStrFromDate = (d) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
const getTodayStr = () => getStrFromDate(new Date());

// Genera un arreglo de 7 días (3 atrás, hoy, 3 adelante) para el calendario
const getCalendarDays = () => {
  const days = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({ 
      dateStr: getStrFromDate(d), 
      dayNum: d.getDate(), 
      dayName: d.toLocaleDateString("es-MX", { weekday: "short" }).substring(0,3) 
    });
  }
  return days;
};

const makeC = (accent = "#007AFF") => ({
  bg: "#FAFAFC", surface: "#FFFFFF", border: "#E5E5EA",
  green: "#34C759", red: "#FF3B30", accent, accentDim: accent + "15", 
  text: "#1C1C1E", textDim: "#8E8E93", muted: "#C7C7CC",
});

const fontClean = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";

const INPUT_STYLE = {
  width: "100%", padding: "18px 20px", borderRadius: 16, fontSize: 16, fontFamily: fontClean, 
  boxSizing: "border-box", outline: "none", background: "#F2F2F7", border: "none", color: "#1C1C1E", fontWeight: "500"
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("agenda");
  const [loaded, setLoaded] = useState(false);
  
  // Datos Core
  const [tasks, setTasks] = useState([]);
  const [accent, setAccent] = useState("#1C1C1E"); // Dark por defecto, muy Old Money
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [form, setForm] = useState({ title: "", time: "" });

  // Nuevas Funciones: Metas y Malos Hábitos
  const [visionBoard, setVisionBoard] = useState({ goal: "", actionToday: "" });
  const [badHabits, setBadHabits] = useState([]); // { id, name, lastResetDate }
  const [newHabitName, setNewHabitName] = useState("");

  const C = useMemo(() => makeC(accent), [accent]);
  const calendarDays = useMemo(() => getCalendarDays(), []);

  useEffect(() => { injectStyles(); }, []);

  // ─── CARGA HÍBRIDA ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      // 1. Cargar configuración local (Vision board, malos hábitos, colores)
      const localAccent = localStorage.getItem("flow_accent");
      const localVision = localStorage.getItem("flow_vision");
      const localBadHabits = localStorage.getItem("flow_badhabits");
      
      if (localAccent) setAccent(localAccent);
      if (localVision) setVisionBoard(JSON.parse(localVision));
      if (localBadHabits) setBadHabits(JSON.parse(localBadHabits));

      // 2. Cargar tareas
      if (session) {
        const { data } = await supabase.from("tasks").select("*").eq("user_id", session.user.id).order("id", { ascending: false });
        if (data) setTasks(data);
      } else {
        const localTasks = localStorage.getItem("flow_tasks");
        if (localTasks) setTasks(JSON.parse(localTasks));
      }
      setLoaded(true);
    };
    loadData();
  }, [session]);

  // Autoguardado local de funciones nuevas
  useEffect(() => {
    if (loaded) {
      if (!session) localStorage.setItem("flow_tasks", JSON.stringify(tasks));
      localStorage.setItem("flow_accent", accent);
      localStorage.setItem("flow_vision", JSON.stringify(visionBoard));
      localStorage.setItem("flow_badhabits", JSON.stringify(badHabits));
    }
  }, [tasks, accent, visionBoard, badHabits, session, loaded]);

  // ─── FUNCIONES DE TAREAS ───
  const addTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { playSound('error'); return; }
    
    const newId = Date.now();
    const payload = {
      id: newId, user_id: session ? session.user.id : "local", 
      title: form.title.trim(), date: selectedDate, time_target: form.time || null, status: "pending"
    };
    
    setTasks(prev => [payload, ...prev]);
    playSound('success');
    setForm({ title: "", time: "" });
    setTab("agenda");

    if (session) {
      const { error } = await supabase.from("tasks").insert([payload]);
      if (error) alert("Error: " + error.message);
    }
  };

  const toggleTask = async (task) => {
    playSound('click');
    const newStatus = task.status === "done" ? "pending" : "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    if (session) await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
  };

  // ─── FUNCIONES DE MALOS HÁBITOS ───
  const addBadHabit = (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    setBadHabits(prev => [...prev, { id: Date.now(), name: newHabitName.trim(), lastResetDate: Date.now() }]);
    setNewHabitName("");
    playSound('success');
  };

  const resetHabit = (id) => {
    playSound('click');
    setBadHabits(prev => prev.map(h => h.id === id ? { ...h, lastResetDate: Date.now() } : h));
  };

  const deleteHabit = (id) => {
    setBadHabits(prev => prev.filter(h => h.id !== id));
  };

  const getDaysClean = (timestamp) => {
    const diff = Date.now() - timestamp;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // ─── FILTROS PARA EL CALENDARIO ───
  const currentTasks = tasks.filter(t => t.date === selectedDate);
  const pendingTasks = currentTasks.filter(t => t.status === "pending");
  const doneTasks = currentTasks.filter(t => t.status === "done");

  if (!loaded) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: fontClean }}>Cargando...</div>;

  return (
    <div style={{ fontFamily: fontClean, background: C.bg, minHeight: "100vh", color: C.text }}>
      
      {/* ─── HEADER ─── */}
      <div style={{ background: "rgba(250, 250, 252, 0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50, padding: "24px 20px 10px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 32, fontWeight: "900", letterSpacing: "-1px" }}>Focus.</div>
      </div>

      <div style={{ padding: "20px 20px 100px", maxWidth: 600, margin: "0 auto" }}>
        
        {/* ══════════════════════════════════════════════════════════════
            PESTAÑA 1: CALENDARIO Y TAREAS (LLAMATIVAS)
        ══════════════════════════════════════════════════════════════ */}
        {tab === "agenda" && <div className="animate-fade">
          
          {/* SELECTOR DE DÍAS TIPO CALENDARIO */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
            {calendarDays.map(day => {
              const isSelected = day.dateStr === selectedDate;
              return (
                <button key={day.dateStr} onClick={() => { playSound('click'); setSelectedDate(day.dateStr); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", width: "13%", borderRadius: 16, border: "none", background: isSelected ? C.accent : "transparent", color: isSelected ? "#FFF" : C.textDim, cursor: "pointer", transition: "all 0.2s", boxShadow: isSelected ? `0 8px 16px ${C.accent}40` : "none" }}>
                  <span style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>{day.dayName}</span>
                  <span style={{ fontSize: 18, fontWeight: "800" }}>{day.dayNum}</span>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 16, fontWeight: "800", color: C.textDim, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {selectedDate === getTodayStr() ? "Tareas de Hoy" : `Tareas del ${selectedDate}`}
          </div>

          {currentTasks.length === 0 && <div style={{ textAlign: "center", padding: 40, border: `2px dashed ${C.border}`, borderRadius: 24, color: C.muted, fontWeight: "600" }}>Día libre. Disfruta o planea algo nuevo. ☕</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingTasks.map(t => (
              <div key={t.id} className="task-item" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px", background: C.accent, borderRadius: 20, boxShadow: `0 8px 24px ${C.accent}40` }}>
                <button onClick={() => toggleTask(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid #FFF`, background: "transparent", cursor: "pointer", flexShrink: 0 }}></button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: "700", color: "#FFF", letterSpacing: "-0.3px" }}>{t.title}</div>
                  {t.time_target && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4, fontWeight: "600" }}>🕒 {t.time_target}</div>}
                </div>
              </div>
            ))}

            {doneTasks.map(t => (
              <div key={t.id} className="task-done task-item" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 20 }}>
                <button onClick={() => toggleTask(t)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: C.textDim, color: "#FFF", cursor: "pointer", fontWeight: "bold" }}>✓</button>
                <div style={{ flex: 1, textDecoration: "line-through", fontSize: 16, fontWeight: "600" }}>{t.title}</div>
              </div>
            ))}
          </div>
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            PESTAÑA 2: AGREGAR RÁPIDO
        ══════════════════════════════════════════════════════════════ */}
        {tab === "add" && <div className="animate-slide-up" style={{ background: C.surface, borderRadius: 28, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.04)" }}>
          <form onSubmit={addTask}>
            <input type="text" placeholder="Nueva tarea..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} 
              style={{ ...INPUT_STYLE, fontSize: 24, fontWeight: "800", padding: "10px 0", background: "transparent", borderRadius: 0, marginBottom: 24, letterSpacing: "-0.5px" }} />
            
            <div style={{ fontSize: 12, fontWeight: "800", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Un click</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
              {QUICK_TASKS.map(task => (
                <button key={task} type="button" onClick={() => { playSound('click'); setForm({ ...form, title: task }); }}
                  style={{ padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: form.title === task ? C.text : "transparent", color: form.title === task ? "#fff" : C.text, fontWeight: "600", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + {task}
                </button>
              ))}
            </div>
            
            <div style={{ fontSize: 12, fontWeight: "800", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>Horario (Opcional)</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 24 }}>
              {QUICK_TIMES.map(time => (
                <button key={time} type="button" onClick={() => { playSound('click'); setForm({ ...form, time }); }}
                  style={{ padding: "10px 16px", borderRadius: 14, border: "none", background: form.time === time ? C.accent : C.bg, color: form.time === time ? "#fff" : C.textDim, fontWeight: "700", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {time}
                </button>
              ))}
            </div>

            <button type="submit" style={{ width: "100%", padding: 20, borderRadius: 20, border: "none", cursor: "pointer", background: C.text, color: "#fff", fontSize: 17, fontWeight: "800" }}>
              Guardar Tarea
            </button>
          </form>
        </div>}

        {/* ══════════════════════════════════════════════════════════════
            PESTAÑA 3: METAS Y MALOS HÁBITOS (STREAKS)
        ══════════════════════════════════════════════════════════════ */}
        {tab === "goals" && <div className="animate-fade">
          
          {/* VISION BOARD */}
          <div style={{ background: C.surface, borderRadius: 28, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.04)", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>👁️ Vision Board</div>
            
            <div style={{ fontSize: 12, fontWeight: "700", color: C.textDim, marginBottom: 8, textTransform: "uppercase" }}>Mi Gran Meta</div>
            <input type="text" placeholder="Ej: Publicar mi poemario..." value={visionBoard.goal} onChange={e => setVisionBoard({...visionBoard, goal: e.target.value})} style={{ ...INPUT_STYLE, marginBottom: 20, fontWeight: "700", fontSize: 18, color: C.accent, backgroundColor: C.accentDim }} />

            <div style={{ fontSize: 12, fontWeight: "700", color: C.textDim, marginBottom: 8, textTransform: "uppercase" }}>¿Qué hice hoy para conseguirlo?</div>
            <textarea placeholder="Ej: Escribí 2 páginas..." value={visionBoard.actionToday} onChange={e => setVisionBoard({...visionBoard, actionToday: e.target.value})} style={{ ...INPUT_STYLE, minHeight: 80, resize: "none" }} />
          </div>

          {/* MALOS HÁBITOS (STREAKS) */}
          <div style={{ background: C.surface, borderRadius: 28, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>🚫 Control de Hábitos</div>
            
            {badHabits.map(habit => (
              <div key={habit.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: C.bg, borderRadius: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: "800", color: C.text }}>{habit.name}</div>
                  <div style={{ fontSize: 13, color: C.textDim, fontWeight: "600", marginTop: 4 }}>
                    Llevas <span style={{ color: C.green, fontWeight: "800", fontSize: 15 }}>{getDaysClean(habit.lastResetDate)}</span> días limpio
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => resetHabit(habit.id)} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: "700", color: C.text }}>Recaí</button>
                  <button onClick={() => deleteHabit(habit.id)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: C.red }}>✕</button>
                </div>
              </div>
            ))}

            <form onSubmit={addBadHabit} style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <input type="text" placeholder="Ej: Fumar, Azúcar..." value={newHabitName} onChange={e => setNewHabitName(e.target.value)} style={{ ...INPUT_STYLE, padding: "14px", flex: 1 }} />
              <button type="submit" style={{ background: C.text, color: "#FFF", border: "none", borderRadius: 16, padding: "0 20px", fontWeight: "700", cursor: "pointer" }}>Añadir</button>
            </form>
          </div>
        </div>}

      </div>

      {/* ─── TAB BAR ─── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(250, 250, 252, 0.8)", backdropFilter: "blur(24px)", borderTop: `1px solid rgba(0,0,0,0.04)`, display: "flex", justifyContent: "center", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 600, padding: "4px 8px" }}>
          {[
            { k: "agenda", icon: "📅", l: "Agenda" },
            { k: "add",    icon: "＋", l: "Agregar"  },
            { k: "goals",  icon: "🎯", l: "Metas"}
          ].map((t) => (
            <button type="button" key={t.k} onClick={() => { playSound('click'); setTab(t.k); }}
              style={{ flex: 1, padding: "12px 4px", border: "none", background: "transparent", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ fontSize: 24, marginBottom: 4, opacity: tab === t.k ? 1 : 0.4, transform: tab === t.k ? "scale(1.15)" : "scale(1)" }}>{t.icon}</div>
              <div style={{ fontSize: 11, fontWeight: "700", color: tab === t.k ? C.text : C.muted }}>{t.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}