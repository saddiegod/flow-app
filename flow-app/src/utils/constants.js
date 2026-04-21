// ─── Typography ───────────────────────────────────────────────────────────────
export const FONT  = `'Plus Jakarta Sans', -apple-system, sans-serif`;
export const SERIF = `'Fraunces', Georgia, serif`;

// ─── Data constants ────────────────────────────────────────────────────────────
export const DAYS_SH = ["D","L","M","X","J","V","S"];

export const CATS = [
  { id:"trabajo",  label:"Trabajo",  color:"#7B68EE" },
  { id:"personal", label:"Personal", color:"#FF6B35" },
  { id:"salud",    label:"Salud",    color:"#30D158" },
  { id:"estudio",  label:"Estudio",  color:"#FFD60A" },
  { id:"otro",     label:"Otro",     color:"#8E8E93" },
];

export const BADGES = [
  { days:3,   icon:"🔥", name:"Encendido",   color:"#FF6B35", glow:"rgba(255,107,53,.4)"  },
  { days:7,   icon:"⚡", name:"Una semana",  color:"#FFD60A", glow:"rgba(255,214,10,.35)" },
  { days:14,  icon:"💪", name:"Dos semanas", color:"#30D158", glow:"rgba(48,209,88,.35)"  },
  { days:30,  icon:"🏆", name:"Mensual",     color:"#007AFF", glow:"rgba(0,122,255,.35)"  },
  { days:60,  icon:"💎", name:"Diamante",    color:"#AF52DE", glow:"rgba(175,82,222,.35)" },
  { days:100, icon:"👑", name:"Centurión",   color:"#F4C430", glow:"rgba(244,196,48,.4)"  },
];

export const BOARD_COLORS = [
  "#7B68EE","#FF6B35","#30D158","#F4C430","#007AFF","#AF52DE","#FF2D55","#00C7FF",
];
export const BOARD_EMOJIS = ["🎯","📖","🚀","💡","🌟","💎","🏆","🎨","🌙","⚡","🔮","🌊"];

export const QUICK_TASKS = [
  "Escribir poema","Avanzar código","Sesión de póker","Jugar ajedrez",
  "Hacer ejercicio","Leer","Estudiar GTO","Meditar","Tarea urgente",
];

// 05:00 → 23:30, every 30 min
export const ALL_TIMES = Array.from({ length: 38 }, (_, i) => {
  const h = Math.floor(i / 2) + 5;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2,"0")}:${m}`;
});

export const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5–23

export const POMODORO_PRESETS = [
  { label:"25 / 5",   work:25, brk:5,  long:15 },
  { label:"50 / 10",  work:50, brk:10, long:20 },
  { label:"90 / 20",  work:90, brk:20, long:30 },
];
