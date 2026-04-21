import { useState, useEffect, useMemo, useRef, useCallback } from "react";

const FONT = `'Plus Jakarta Sans', -apple-system, sans-serif`;
const SERIF = `'Fraunces', Georgia, serif`;

function injectGlobal() {
  if (document.getElementById("pf-g")) return;
  const lk = document.createElement("link");
  lk.rel = "stylesheet";
  lk.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
  document.head.appendChild(lk);
  const s = document.createElement("style");
  s.id = "pf-g";
  s.innerHTML = `
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    body{margin:0;background:#080B14;overscroll-behavior:none}
    ::-webkit-scrollbar{display:none}
    @keyframes su{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    @keyframes fl{0%,100%{transform:scaleY(1) rotate(-2deg)}33%{transform:scaleY(1.1) rotate(2deg)}66%{transform:scaleY(.96) rotate(-1deg)}}
    @keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
    @keyframes ring{0%{transform:translate(-50%,-50%) scale(.5);opacity:.9}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
    @keyframes cf{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(160px) rotate(720deg);opacity:0}}
    @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(50px,-40px) scale(1.1)}}
    @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-40px,50px) scale(.9)}}
    @keyframes slideRew{0%{opacity:0;transform:translate(-50%,-50%) scale(.75)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
    @keyframes lvlUp{0%{opacity:0;transform:scale(0) rotate(-15deg)}60%{transform:scale(1.15) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}
    @keyframes shine{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    .su{animation:su .45s cubic-bezier(.16,1,.3,1) both}
    .fi{animation:fi .3s ease both}
    .card{transition:transform .2s cubic-bezier(.34,1.56,.64,1),opacity .25s}
    .card:active{transform:scale(.96)!important}
    .float{animation:float 3s ease-in-out infinite}
  `;
  document.head.appendChild(s);
}

// ── AUDIO ──────────────────────────────────────────────────────────────────
let _ac = null;
function sfx(type) {
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    const t = _ac.currentTime;
    if (type === "done") {
      o.type = "sine";
      o.frequency.setValueAtTime(440, t);
      o.frequency.setValueAtTime(660, t + .08);
      o.frequency.setValueAtTime(880, t + .16);
      g.gain.setValueAtTime(.05, t); g.gain.linearRampToValueAtTime(0, t + .3);
      o.start(t); o.stop(t + .3);
    } else {
      o.type = "sine"; o.frequency.setValueAtTime(520, t);
      g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
      o.start(t); o.stop(t + .06);
    }
  } catch (_) {}
}

// ── DATA ────────────────────────────────────────────────────────────────────
const QUICK_TASKS = ["Escribir poema","Avanzar código","Sesión de póker","Jugar ajedrez","Hacer ejercicio","Leer 30 mins","Estudiar GTO","Meditar","Tarea urgente"];
const QUICK_TIMES = ["07:00","08:00","09:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

const LEVEL_TIERS = [
  { min: 0,    max: 99,       name: "Novato",     emoji: "🌱", color: "#8E8E93" },
  { min: 100,  max: 299,      name: "Explorador", emoji: "⚡", color: "#30D158" },
  { min: 300,  max: 699,      name: "Guerrero",   emoji: "🔷", color: "#007AFF" },
  { min: 700,  max: 1499,     name: "Maestro",    emoji: "💫", color: "#AF52DE" },
  { min: 1500, max: Infinity, name: "Leyenda",    emoji: "👑", color: "#F4C430" },
];

const HABIT_BADGES = [
  { days: 3,   icon: "🔥", name: "Encendido",   color: "#FF6B35", glow: "rgba(255,107,53,.4)"  },
  { days: 7,   icon: "⚡", name: "Una Semana",  color: "#FFD60A", glow: "rgba(255,214,10,.35)" },
  { days: 14,  icon: "💪", name: "Dos Semanas", color: "#30D158", glow: "rgba(48,209,88,.35)"  },
  { days: 30,  icon: "🏆", name: "Mensual",     color: "#007AFF", glow: "rgba(0,122,255,.35)"  },
  { days: 60,  icon: "💎", name: "Diamante",    color: "#AF52DE", glow: "rgba(175,82,222,.35)" },
  { days: 100, icon: "👑", name: "Centurion",   color: "#F4C430", glow: "rgba(244,196,48,.4)"  },
];

const REWARD_MSGS = [
  { emoji: "⚡", msg: "¡En racha!",          sub: "Nada te para hoy",       grad: "135deg, #1a1a2e, #16213e, #0f3460" },
  { emoji: "🎯", msg: "¡Objetivo cumplido!", sub: "Un paso más hacia la cima", grad: "135deg, #0f0c29, #302b63, #24243e" },
  { emoji: "🔥", msg: "¡Imparable!",         sub: "Sigue con esa energía",   grad: "135deg, #2c1810, #7a2300, #a83228" },
  { emoji: "✨", msg: "¡Excelente!",          sub: "Cada tarea vale oro",     grad: "135deg, #0d1117, #1a2332, #1e3a5f" },
  { emoji: "🚀", msg: "¡Despegando!",         sub: "No mires atrás",          grad: "135deg, #0a1628, #122548, #1a3868" },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────
const getTier  = xp => LEVEL_TIERS.find(t => xp >= t.min && xp <= t.max) || LEVEL_TIERS[0];
const getLvlPct = xp => { const t = getTier(xp); return t.max === Infinity ? 100 : Math.round(((xp - t.min) / (t.max - t.min + 1)) * 100); };
const daysClean = ts => Math.floor((Date.now() - ts) / 86400000);
const currBadge = d => [...HABIT_BADGES].reverse().find(b => d >= b.days) || null;
const nextBadge = d => HABIT_BADGES.find(b => b.days > d) || null;
const fmtDate  = d => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
const todayStr  = () => fmtDate(new Date());
const calDays   = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i - 3);
  return { str: fmtDate(d), num: d.getDate(), name: d.toLocaleDateString("es-MX", { weekday: "short" }).slice(0, 2).toUpperCase() };
});
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; }
}

// ── FLAME SVG ───────────────────────────────────────────────────────────────
function Flame({ days = 0, size = 34 }) {
  const i = Math.min(days / 30, 1);
  const id = `fg${size}${days}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ animation: "fl 1.8s ease-in-out infinite", flexShrink: 0 }}>
      <defs>
        <radialGradient id={id} cx="50%" cy="80%" r="65%">
          <stop offset="0%" stopColor="#FFE580" />
          <stop offset="40%" stopColor={`hsl(${30 - i * 15},100%,55%)`} />
          <stop offset="100%" stopColor="#E02020" />
        </radialGradient>
      </defs>
      <path d="M16 2C16 2 21 9 18.5 13C22.5 10 25 5 25 5C25 5 31 13 29 21C27 27 22 31 16 31C10 31 5 27 3 21C1 13 7 7 7 7C7 7 9.5 11 12 13C9.5 8.5 16 2 16 2Z" fill={`url(#${id})`} />
      <path d="M16 14C16 14 18.5 17.5 17.5 20C20 18.5 21 16 21 16C21 16 23 19.5 22 22.5C21 25 18.5 27 16 27C13.5 27 11 25 10 22.5C9 19.5 11 16 11 16C11 16 12.5 18.5 14 20C12.5 17 16 14 16 14Z" fill="rgba(255,240,100,.85)" />
    </svg>
  );
}

// ── BADGE RING ───────────────────────────────────────────────────────────────
function Badge({ b, size = 48 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `radial-gradient(circle at 38% 38%, ${b.color}28, ${b.color}0a)`,
      border: `1.5px solid ${b.color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * .44,
      boxShadow: `0 0 18px ${b.glow}, inset 0 1px 1px rgba(255,255,255,.08)`,
    }}>{b.icon}</div>
  );
}

// ── CONFETTI ─────────────────────────────────────────────────────────────────
function Confetti({ on }) {
  if (!on) return null;
  const pieces = Array.from({ length: 18 }, (_, i) => ({
    id: i, x: 15 + Math.random() * 70,
    color: ["#F4C430","#FF6B35","#7B68EE","#30D158","#FF2D55","#00C7FF"][i % 6],
    delay: Math.random() * .25, dur: .55 + Math.random() * .35, size: 5 + Math.random() * 7,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: "18%",
          width: p.size, height: p.size, background: p.color,
          borderRadius: p.id % 3 === 0 ? "50%" : "2px",
          animation: `cf ${p.dur}s ${p.delay}s ease-in both`,
        }} />
      ))}
    </div>
  );
}

// ── REWARD OVERLAY ────────────────────────────────────────────────────────────
function RewardOverlay({ xp: xpGained, onClose }) {
  const card = REWARD_MSGS[Math.floor(Math.random() * REWARD_MSGS.length)];
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.72)",
      backdropFilter: "blur(12px)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div ref={ref} style={{
        background: `linear-gradient(${card.grad})`,
        border: "1px solid rgba(255,255,255,.13)", borderRadius: 32,
        padding: "52px 44px", textAlign: "center", width: 300,
        animation: "slideRew .5s cubic-bezier(.16,1,.3,1) both",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 20%, rgba(244,196,48,.1), transparent 60%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 72, marginBottom: 16, animation: "pop .4s cubic-bezier(.34,1.56,.64,1) .1s both" }}>{card.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#F8F9FF", fontFamily: SERIF, marginBottom: 8, letterSpacing: "-.5px" }}>{card.msg}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", marginBottom: 28 }}>{card.sub}</div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(244,196,48,.12)", border: "1px solid rgba(244,196,48,.3)",
          borderRadius: 100, padding: "10px 24px",
        }}>
          <span style={{ fontSize: 15 }}>⚡</span>
          <span style={{ fontSize: 19, fontWeight: 900, color: "#F4C430", fontFamily: SERIF }}>+{xpGained} XP</span>
        </div>
      </div>
    </div>
  );
}

// ── LEVEL BAR ─────────────────────────────────────────────────────────────────
function LevelBar({ xp }) {
  const tier = getTier(xp);
  const pct  = getLvlPct(xp);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{tier.emoji}</span>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${tier.color}cc, ${tier.color})`, borderRadius: 3, transition: "width .8s cubic-bezier(.16,1,.3,1)" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: tier.color, minWidth: 52 }}>{tier.name}</span>
    </div>
  );
}

// ── TASK CARD ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, accent = "#7B68EE" }) {
  const done = task.status === "done";
  const [pop, setPop] = useState(false);

  const handle = () => {
    if (!done) { setPop(true); setTimeout(() => setPop(false), 700); }
    onToggle(task);
  };

  return (
    <div className="card" onClick={handle} style={{
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", gap: 14,
      padding: "15px 18px", borderRadius: 18, marginBottom: 10, cursor: "pointer",
      background: done ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.06)",
      border: `1px solid ${done ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.1)"}`,
      transition: "all .3s cubic-bezier(.16,1,.3,1)",
    }}>
      <Confetti on={pop} />
      {/* pulse ring on complete */}
      {pop && <div style={{ position: "absolute", left: 28, top: "50%", width: 26, height: 26, borderRadius: "50%", border: `2px solid ${accent}`, animation: "ring .6s ease-out forwards", pointerEvents: "none" }} />}
      <div style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        border: done ? "none" : "2px solid rgba(255,255,255,.18)",
        background: done ? "#30D158" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .3s cubic-bezier(.34,1.56,.64,1)",
        boxShadow: done ? "0 0 14px rgba(48,209,88,.45)" : "none",
      }}>
        {done && <span style={{ color: "#FFF", fontSize: 13, fontWeight: 800, animation: "pop .3s cubic-bezier(.34,1.56,.64,1)" }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: done ? "rgba(255,255,255,.28)" : "#F8F9FF",
          textDecoration: done ? "line-through" : "none", transition: "all .3s",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{task.title}</div>
        {task.time_target && !done && <div style={{ fontSize: 11, color: "rgba(255,255,255,.33)", marginTop: 3, fontWeight: 600 }}>🕐 {task.time_target}</div>}
      </div>
    </div>
  );
}

// ── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline({ tasks, date, onToggle }) {
  const now = new Date();
  const isToday = date === todayStr();
  const ch = now.getHours();

  const byHour = useMemo(() => {
    const m = {};
    tasks.filter(t => t.date === date && t.time_target).forEach(t => {
      const h = parseInt(t.time_target);
      (m[h] || (m[h] = [])).push(t);
    });
    return m;
  }, [tasks, date]);

  const noTime = tasks.filter(t => t.date === date && !t.time_target);

  return (
    <div>
      {noTime.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.25)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Sin hora</div>
          {noTime.map(t => <TaskCard key={t.id} task={t} onToggle={onToggle} />)}
        </div>
      )}
      {HOURS.map(h => {
        const ts  = byHour[h] || [];
        const isCur = isToday && h === ch;
        const isPast = isToday && h < ch && !ts.length;
        return (
          <div key={h} style={{ display: "flex", gap: 14, marginBottom: ts.length ? 14 : 2, opacity: isPast ? .2 : 1, transition: "opacity .3s" }}>
            <div style={{ width: 42, flexShrink: 0, paddingTop: 3, textAlign: "right", fontSize: 11, fontWeight: 700, fontFamily: SERIF, color: isCur ? "#F4C430" : "rgba(255,255,255,.22)", transition: "color .3s" }}>
              {String(h).padStart(2, "0")}:00
            </div>
            <div style={{ flex: 1, paddingLeft: 16, borderLeft: `1px solid ${isCur ? "#F4C430" : "rgba(255,255,255,.05)"}`, minHeight: 24, position: "relative", paddingBottom: ts.length ? 2 : 0 }}>
              {isCur && (
                <div style={{ position: "absolute", left: -5, top: 4, width: 8, height: 8, borderRadius: "50%", background: "#F4C430", boxShadow: "0 0 10px #F4C430" }} />
              )}
              {ts.map(t => <TaskCard key={t.id} task={t} onToggle={onToggle} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── HABIT CARD ────────────────────────────────────────────────────────────────
function HabitCard({ habit, onReset, onDelete }) {
  const d   = daysClean(habit.lastResetDate);
  const cb  = currBadge(d);
  const nb  = nextBadge(d);
  const pct = nb ? Math.min((d / nb.days) * 100, 100) : 100;

  return (
    <div className="card" style={{
      background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
      borderRadius: 24, padding: 22, marginBottom: 14, position: "relative", overflow: "hidden",
    }}>
      {d > 0 && cb && <div style={{ position: "absolute", top: -50, right: -50, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${cb.glow}, transparent 70%)`, pointerEvents: "none" }} />}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Flame days={d} size={36} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#F8F9FF" }}>{habit.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)", marginTop: 3, fontWeight: 600 }}>
              {d === 0 ? "Empieza hoy 💪" : `${d} día${d !== 1 ? "s" : ""} sin recaer`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cb && <Badge b={cb} size={44} />}
          <button onClick={e => { e.stopPropagation(); onDelete(habit.id); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,.18)", fontSize: 20, padding: "2px 6px", lineHeight: 1 }}>×</button>
        </div>
      </div>

      {nb && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .8 }}>Próximo: {nb.icon} {nb.name}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", fontWeight: 700 }}>{nb.days - d} días restantes</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 3 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${nb.color}99, ${nb.color})`, borderRadius: 3, transition: "width .9s cubic-bezier(.16,1,.3,1)" }} />
          </div>
        </div>
      )}

      {!nb && cb && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ height: 3, flex: 1, background: `linear-gradient(90deg, ${cb.color}66, ${cb.color})`, borderRadius: 3 }} />
          <span style={{ fontSize: 10, color: cb.color, fontWeight: 700 }}>MÁXIMO LOGRO 🏆</span>
        </div>
      )}

      <button onClick={e => { e.stopPropagation(); sfx("click"); onReset(habit.id); }} style={{
        marginTop: 16, padding: "9px 16px", borderRadius: 12,
        background: "rgba(255,59,48,.08)", border: "1px solid rgba(255,59,48,.18)",
        color: "#FF6B6B", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
      }}>😔 Recaí — reiniciar contador</button>
    </div>
  );
}

// ── STATS BAR ─────────────────────────────────────────────────────────────────
function StatsBar({ tasks, date }) {
  const all  = tasks.filter(t => t.date === date);
  const done = all.filter(t => t.status === "done").length;
  const pct  = all.length ? Math.round((done / all.length) * 100) : 0;
  if (!all.length) return null;
  return (
    <div style={{
      display: "flex", gap: 1, marginBottom: 22,
      background: "rgba(255,255,255,.03)", borderRadius: 18,
      border: "1px solid rgba(255,255,255,.05)", overflow: "hidden",
    }}>
      {[
        { val: all.length,  label: "Tareas",   col: "#F4C430" },
        { val: done,        label: "Hechas",   col: "#30D158" },
        { val: `${pct}%`,   label: "Progreso", col: "#7B68EE" },
      ].map((s, i) => (
        <div key={i} style={{ flex: 1, padding: "14px 0", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: SERIF, color: s.col, lineHeight: 1 }}>{s.val}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.28)", textTransform: "uppercase", letterSpacing: .8, marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  useEffect(() => { injectGlobal(); }, []);

  const [tab,    setTab]    = useState("today");
  const [tasks,  setTasks]  = useState(() => load("pf_tasks",  []));
  const [habits, setHabits] = useState(() => load("pf_habits", []));
  const [xp,     setXP]     = useState(() => load("pf_xp",     0));
  const [vision, setVision] = useState(() => load("pf_vision", { goal: "", action: "" }));
  const [date,   setDate]   = useState(todayStr);
  const [reward, setReward] = useState(null);
  const [form,   setForm]   = useState({ title: "", time: "" });
  const [newHabit, setNewHabit] = useState("");

  const cal = useMemo(() => calDays(), []);
  const tier = getTier(xp);

  useEffect(() => { localStorage.setItem("pf_tasks",  JSON.stringify(tasks));  }, [tasks]);
  useEffect(() => { localStorage.setItem("pf_habits", JSON.stringify(habits)); }, [habits]);
  useEffect(() => { localStorage.setItem("pf_xp",     JSON.stringify(xp));     }, [xp]);
  useEffect(() => { localStorage.setItem("pf_vision", JSON.stringify(vision)); }, [vision]);

  const toggleTask = useCallback(task => {
    const wasDone = task.status === "done";
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: wasDone ? "pending" : "done" } : t));
    if (!wasDone) { sfx("done"); setXP(p => p + 10); setReward(true); }
    else          { sfx("click"); setXP(p => Math.max(0, p - 10)); }
  }, []);

  const addTask = e => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setTasks(p => [{ id: Date.now(), title: form.title.trim(), date, time_target: form.time || null, status: "pending" }, ...p]);
    setForm({ title: "", time: "" }); setTab("today"); sfx("click");
  };

  const addHabit = e => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    setHabits(p => [...p, { id: Date.now(), name: newHabit.trim(), lastResetDate: Date.now() }]);
    setNewHabit(""); sfx("done");
  };

  const IS = {
    width: "100%", padding: "14px 18px", borderRadius: 14,
    background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
    color: "#F8F9FF", fontSize: 15, fontWeight: 600, fontFamily: FONT,
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: FONT, background: "#080B14", minHeight: "100vh", color: "#F8F9FF", position: "relative", overflowX: "hidden", maxWidth: 480, margin: "0 auto" }}>

      {/* ambient orbs */}
      <div style={{ position: "fixed", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(123,104,238,.11), transparent)", top: -160, left: -140, pointerEvents: "none", animation: "orb1 9s ease-in-out infinite" }} />
      <div style={{ position: "fixed", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(244,196,48,.07), transparent)", bottom: 60, right: -100, pointerEvents: "none", animation: "orb2 11s ease-in-out infinite" }} />

      {/* reward overlay */}
      {reward && <RewardOverlay xp={10} onClose={() => setReward(null)} />}

      {/* ── HEADER ── */}
      <div style={{
        padding: "50px 22px 14px", position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,11,20,.85)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 900, fontFamily: SERIF, letterSpacing: "-.5px" }}>Focus.</span>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(244,196,48,.1)", border: "1px solid rgba(244,196,48,.22)",
            borderRadius: 100, padding: "6px 14px",
          }}>
            <span style={{ fontSize: 13 }}>{tier.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#F4C430", fontFamily: SERIF }}>{xp} XP</span>
          </div>
        </div>
        <LevelBar xp={xp} />
      </div>

      <div style={{ padding: "20px 20px 110px" }}>

        {/* ════ HOY ════ */}
        {tab === "today" && (
          <div className="fi">
            {/* Calendar strip */}
            <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto", paddingBottom: 2 }}>
              {cal.map(d => {
                const sel = d.str === date;
                return (
                  <button key={d.str} onClick={() => { sfx("click"); setDate(d.str); }} style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "10px 0", minWidth: 46, borderRadius: 18, border: "none", cursor: "pointer",
                    background: sel ? "#F4C430" : "rgba(255,255,255,.04)",
                    boxShadow: sel ? "0 8px 22px rgba(244,196,48,.3)" : "none",
                    transition: "all .25s cubic-bezier(.34,1.56,.64,1)",
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: sel ? "#000" : "rgba(255,255,255,.3)", textTransform: "uppercase", marginBottom: 5, letterSpacing: .5 }}>{d.name}</span>
                    <span style={{ fontSize: 19, fontWeight: 900, fontFamily: SERIF, color: sel ? "#000" : "#F8F9FF" }}>{d.num}</span>
                  </button>
                );
              })}
            </div>

            <StatsBar tasks={tasks} date={date} />

            {tasks.filter(t => t.date === date).length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 20px" }}>
                <div className="float" style={{ fontSize: 52, marginBottom: 18 }}>🌙</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: SERIF, color: "rgba(255,255,255,.5)" }}>Día despejado</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.25)", marginTop: 8 }}>Agrega tareas o disfruta el descanso</div>
              </div>
            ) : (
              <Timeline tasks={tasks} date={date} onToggle={toggleTask} />
            )}
          </div>
        )}

        {/* ════ AGREGAR ════ */}
        {tab === "add" && (
          <div className="su">
            <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 28, padding: 26 }}>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: SERIF, marginBottom: 26, letterSpacing: "-.4px" }}>Nueva tarea</div>
              <form onSubmit={addTask}>
                <input type="text" placeholder="¿Qué harás hoy?" autoFocus
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  style={{ ...IS, fontSize: 20, fontWeight: 800, padding: "14px 0", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,.1)", borderRadius: 0, marginBottom: 26 }}
                />
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.28)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Un clic</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 24 }}>
                  {QUICK_TASKS.map(t => (
                    <button key={t} type="button" onClick={() => { sfx("click"); setForm({ ...form, title: t }); }} style={{
                      padding: "9px 14px", borderRadius: 13, border: "none", whiteSpace: "nowrap",
                      cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FONT,
                      background: form.title === t ? "#F4C430" : "rgba(255,255,255,.06)",
                      color: form.title === t ? "#000" : "rgba(255,255,255,.65)",
                      transition: "all .2s",
                    }}>{t}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.28)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Hora (opcional)</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 28 }}>
                  {QUICK_TIMES.map(t => (
                    <button key={t} type="button" onClick={() => { sfx("click"); setForm({ ...form, time: t }); }} style={{
                      padding: "9px 14px", borderRadius: 13, whiteSpace: "nowrap",
                      cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FONT,
                      background: form.time === t ? "rgba(123,104,238,.3)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${form.time === t ? "#7B68EE" : "rgba(255,255,255,.06)"}`,
                      color: form.time === t ? "#A695FF" : "rgba(255,255,255,.45)",
                      transition: "all .2s",
                    }}>{t}</button>
                  ))}
                </div>
                <button type="submit" style={{
                  width: "100%", padding: 19, borderRadius: 20, border: "none",
                  background: "#F8F9FF", color: "#080B14", fontSize: 16, fontWeight: 800,
                  cursor: "pointer", fontFamily: FONT, letterSpacing: "-.3px",
                  boxShadow: "0 8px 28px rgba(248,249,255,.1)", transition: "transform .15s",
                }}>Guardar tarea ✓</button>
              </form>
            </div>
          </div>
        )}

        {/* ════ METAS ════ */}
        {tab === "goals" && (
          <div className="fi">
            {/* Vision board */}
            <div style={{
              background: "linear-gradient(135deg, rgba(123,104,238,.14), rgba(244,196,48,.06))",
              border: "1px solid rgba(123,104,238,.2)", borderRadius: 28, padding: 26, marginBottom: 24,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7B68EE", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>👁 Visión</div>
              <input type="text" placeholder="Mi gran objetivo..." value={vision.goal}
                onChange={e => setVision({ ...vision, goal: e.target.value })}
                style={{ ...IS, background: "rgba(0,0,0,.2)", marginBottom: 12, fontSize: 18, fontWeight: 800, color: "#A695FF" }}
              />
              <textarea placeholder="¿Qué hice hoy para lograrlo?" value={vision.action}
                onChange={e => setVision({ ...vision, action: e.target.value })}
                style={{ ...IS, minHeight: 80, resize: "none" }}
              />
            </div>

            {/* Habits */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>🔥 Control de hábitos</div>

            {habits.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 20px", color: "rgba(255,255,255,.2)", marginBottom: 20 }}>
                <div className="float" style={{ fontSize: 44, marginBottom: 12 }}>🚫</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Agrega hábitos que quieras eliminar</div>
              </div>
            )}

            {habits.map(h => <HabitCard key={h.id} habit={h} onReset={id => { sfx("click"); setHabits(p => p.map(x => x.id === id ? { ...x, lastResetDate: Date.now() } : x)); }} onDelete={id => setHabits(p => p.filter(x => x.id !== id))} />)}

            <form onSubmit={addHabit} style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <input type="text" placeholder="Ej: Fumar, azúcar, redes..." value={newHabit}
                onChange={e => setNewHabit(e.target.value)}
                style={{ ...IS, flex: 1 }}
              />
              <button type="submit" style={{
                padding: "0 22px", borderRadius: 14, border: "none",
                background: "#F8F9FF", color: "#080B14", fontWeight: 800, fontSize: 18,
                cursor: "pointer", fontFamily: FONT,
              }}>+</button>
            </form>
          </div>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: "rgba(8,11,20,.92)", backdropFilter: "blur(28px)",
        borderTop: "1px solid rgba(255,255,255,.05)",
        display: "flex", padding: "8px 20px calc(env(safe-area-inset-bottom, 0px) + 8px)",
        zIndex: 60,
      }}>
        {[
          { k: "today", icon: "📅", l: "Hoy" },
          { k: "add",   icon: "✦",  l: "Añadir" },
          { k: "goals", icon: "🔥", l: "Metas" },
        ].map(({ k, icon, l }) => (
          <button key={k} onClick={() => { sfx("click"); setTab(k); }} style={{
            flex: 1, padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <div style={{
              fontSize: 22, opacity: tab === k ? 1 : .28,
              transform: tab === k ? "scale(1.18)" : "scale(1)",
              transition: "all .25s cubic-bezier(.34,1.56,.64,1)",
            }}>{icon}</div>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: FONT, letterSpacing: .5, color: tab === k ? "#F4C430" : "rgba(255,255,255,.28)" }}>
              {l.toUpperCase()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}