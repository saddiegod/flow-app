import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// import { supabase } from "./supabase"; // ← descomenta para sincronización en la nube

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES Y CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════════════════════
const FONT  = `'Plus Jakarta Sans', -apple-system, sans-serif`;
const SERIF = `'Fraunces', Georgia, serif`;
const V     = "pf3_";

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);
const DAYS_SH = ["D","L","M","X","J","V","S"];
const MONTH_MAP = { ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11 };

const CATS = [
  { id:"trabajo",  label:"Trabajo",  color:"#7B68EE" },
  { id:"personal", label:"Personal", color:"#FF6B35" },
  { id:"salud",    label:"Salud",    color:"#30D158" },
  { id:"estudio",  label:"Estudio",  color:"#FFD60A" },
  { id:"otro",     label:"Otro",     color:"#8E8E93" },
];

const ALL_TIMES = Array.from({ length: 37 }, (_, i) => {
  const h = Math.floor(i / 2) + 5;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2,"0")}:${m}`;
});

const QUICK_TASKS = [
  "Escribir poema","Avanzar código","Sesión de póker","Jugar ajedrez",
  "Hacer ejercicio","Leer","Estudiar GTO","Meditar","Tarea urgente",
];

const BADGES = [
  { days:3,   icon:"🔥", name:"Encendido",   color:"#FF6B35", glow:"rgba(255,107,53,.4)"  },
  { days:7,   icon:"⚡", name:"Una semana",  color:"#FFD60A", glow:"rgba(255,214,10,.35)" },
  { days:14,  icon:"💪", name:"Dos semanas", color:"#30D158", glow:"rgba(48,209,88,.35)"  },
  { days:30,  icon:"🏆", name:"Mensual",     color:"#007AFF", glow:"rgba(0,122,255,.35)"  },
  { days:60,  icon:"💎", name:"Diamante",    color:"#AF52DE", glow:"rgba(175,82,222,.35)" },
  { days:100, icon:"👑", name:"Centurión",   color:"#F4C430", glow:"rgba(244,196,48,.4)"  },
];

const BOARD_COLORS = [
  "#7B68EE","#FF6B35","#30D158","#F4C430","#007AFF","#AF52DE","#FF2D55","#00C7FF",
];

const BOARD_EMOJIS = ["🎯","📖","🚀","💡","🌟","💎","🏆","🎨","🌙","⚡","🔮","🌊"];

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const fmtDate   = d => d.toLocaleDateString("es-MX", { day:"2-digit", month:"short" });
const todayStr  = () => fmtDate(new Date());
const daysClean = ts => Math.floor((Date.now() - ts) / 86400000);
const currBadge = d => [...BADGES].reverse().find(b => d >= b.days) || null;
const nextBadge = d => BADGES.find(b => b.days > d) || null;
const catOf     = id => CATS.find(c => c.id === id);
const uid       = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

function load(k, def) {
  try { return JSON.parse(localStorage.getItem(V+k) ?? "null") ?? def; } catch { return def; }
}
function save(k, v) {
  try { localStorage.setItem(V+k, JSON.stringify(v)); } catch {}
}

// ── Parseo de fecha corregido (fix bug recurring) ──────────────────────────
function parseDateStr(ds) {
  try {
    const parts = ds.trim().toLowerCase().replace(/\./g,"").split(/\s+/);
    const day = parseInt(parts[0]);
    const mon = MONTH_MAP[parts[1]];
    if (mon === undefined || isNaN(day)) return null;
    return new Date(new Date().getFullYear(), mon, day);
  } catch { return null; }
}
function getDOW(ds) { const d = parseDateStr(ds); return d ? d.getDay() : -1; }

function recurApplies(rec, ds) {
  if (!rec) return false;
  const dow = getDOW(ds);
  if (dow === -1) return false;
  if (rec.type === "daily")    return true;
  if (rec.type === "weekdays") return dow >= 1 && dow <= 5;
  if (rec.type === "weekends") return dow === 0 || dow === 6;
  if (rec.type === "custom")   return Array.isArray(rec.days) && rec.days.includes(dow);
  return false;
}

function durLabel(s, e) {
  if (!s || !e) return null;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const t = (eh*60+em)-(sh*60+sm);
  if (t <= 0) return null;
  const h = Math.floor(t/60), m = t%60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function streakColor(d) {
  if (d === 0) return "#FF3B30";
  if (d < 3)   return "#FF9500";
  if (d < 7)   return "#FFD60A";
  if (d < 14)  return "#30D158";
  if (d < 30)  return "#007AFF";
  if (d < 60)  return "#AF52DE";
  return "#F4C430";
}

function recurLabel(rec) {
  if (!rec) return "";
  if (rec.type === "daily")    return "Cada día";
  if (rec.type === "weekdays") return "Lunes – Viernes";
  if (rec.type === "weekends") return "Sáb – Dom";
  if (rec.type === "custom")   return (rec.days||[]).sort().map(i=>DAYS_SH[i]).join(" · ");
  return "";
}

const calDays = () => Array.from({ length:7 }, (_,i) => {
  const d = new Date(); d.setDate(d.getDate()+i-3);
  return { str:fmtDate(d), num:d.getDate(), name:d.toLocaleDateString("es-MX",{weekday:"short"}).slice(0,2).toUpperCase() };
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER + NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════════════════
const SW_CODE = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  if (e.data?.type !== 'SCHEDULE') return;
  const { id, title, body, delay } = e.data;
  setTimeout(() => {
    self.registration.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/badge.png',
      tag: id, renotify: true,
      data: { url: self.location.origin },
    });
  }, Math.max(0, delay));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
`;

let _sw = null;
async function getSW() {
  if (_sw) return _sw;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const blob = new Blob([SW_CODE], { type:"application/javascript" });
    const url  = URL.createObjectURL(blob);
    _sw = await navigator.serviceWorker.register(url, { scope:"/" });
    await navigator.serviceWorker.ready;
    return _sw;
  } catch { return null; }
}

async function requestNotifPerm() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const r = await Notification.requestPermission();
  return r;
}

function fireNotif(title, body, tag="pf") {
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag, icon:"/icon-192.png" }); } catch {}
}

async function scheduleViaWorker(id, title, body, delayMs) {
  if (Notification.permission !== "granted" || delayMs < 0) return;
  const sw = await getSW();
  if (sw?.active) {
    sw.active.postMessage({ type:"SCHEDULE", id, title, body, delay:delayMs });
  } else {
    setTimeout(() => fireNotif(title, body, id), delayMs);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO
// ══════════════════════════════════════════════════════════════════════════════
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
      o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(580,t+.08); o.frequency.setValueAtTime(840,t+.16);
      g.gain.setValueAtTime(.045,t); g.gain.linearRampToValueAtTime(0,t+.3);
      o.start(t); o.stop(t+.3);
    } else if (type === "milestone") {
      o.type = "triangle";
      o.frequency.setValueAtTime(660,t); o.frequency.setValueAtTime(880,t+.1); o.frequency.setValueAtTime(1100,t+.2);
      g.gain.setValueAtTime(.04,t); g.gain.linearRampToValueAtTime(0,t+.35);
      o.start(t); o.stop(t+.35);
    } else {
      o.type = "sine"; o.frequency.setValueAtTime(540,t);
      g.gain.setValueAtTime(.018,t); g.gain.exponentialRampToValueAtTime(.001,t+.05);
      o.start(t); o.stop(t+.05);
    }
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS GLOBALES
// ══════════════════════════════════════════════════════════════════════════════
function injectGlobal() {
  if (document.getElementById("pf3-g")) return;
  const lk = document.createElement("link");
  lk.rel = "stylesheet";
  lk.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
  document.head.appendChild(lk);
  const s = document.createElement("style"); s.id = "pf3-g";
  s.innerHTML = `
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    body{margin:0;background:#080B14;overscroll-behavior:none}
    ::-webkit-scrollbar{display:none}
    @keyframes su{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    @keyframes fl{0%,100%{transform:scaleY(1) rotate(-2deg)}33%{transform:scaleY(1.08) rotate(2deg)}66%{transform:scaleY(.96) rotate(-1deg)}}
    @keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.28)}100%{transform:scale(1)}}
    @keyframes ring{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(4);opacity:0}}
    @keyframes cf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(150px) rotate(720deg)}}
    @keyframes orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(55px,-40px)}}
    @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,55px)}}
    @keyframes dd{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}
    @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes cg{0%{box-shadow:0 0 0 0 rgba(48,209,88,.7)}70%{box-shadow:0 0 0 14px rgba(48,209,88,0)}100%{box-shadow:0 0 0 0 rgba(48,209,88,0)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
    .su{animation:su .42s cubic-bezier(.16,1,.3,1) both}
    .fi{animation:fi .28s ease both}
    .up{animation:up .38s cubic-bezier(.16,1,.3,1) both}
    .card-tap{transition:transform .18s cubic-bezier(.34,1.56,.64,1),opacity .18s}
    .card-tap:active{transform:scale(.963)!important;opacity:.85}
    .float{animation:float 3.2s ease-in-out infinite}
    .pulse{animation:pulse 2s ease-in-out infinite}
    input::placeholder,textarea::placeholder{color:rgba(248,249,255,.2)}
    select option{background:#12131F;color:#F8F9FF}
  `;
  document.head.appendChild(s);
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES BASE
// ══════════════════════════════════════════════════════════════════════════════

// ── Progress Ring ─────────────────────────────────────────────────────────────
function Ring({ pct=0, size=64, stroke=5, color="#7B68EE", bg="rgba(255,255,255,.06)", children }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", position:"absolute", inset:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ-(pct/100)*circ}
          strokeLinecap="round" style={{ transition:"stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {children}
      </div>
    </div>
  );
}

// ── Flame ─────────────────────────────────────────────────────────────────────
function Flame({ days=0, size=32 }) {
  const i  = Math.min(days/30,1);
  const id = `fg${size}_${days}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ animation:"fl 1.9s ease-in-out infinite", flexShrink:0 }}>
      <defs>
        <radialGradient id={id} cx="50%" cy="80%" r="65%">
          <stop offset="0%" stopColor="#FFE580"/>
          <stop offset="40%" stopColor={`hsl(${30-i*15},100%,55%)`}/>
          <stop offset="100%" stopColor="#E02020"/>
        </radialGradient>
      </defs>
      <path d="M16 2C16 2 21 9 18.5 13C22.5 10 25 5 25 5C25 5 31 13 29 21C27 27 22 31 16 31C10 31 5 27 3 21C1 13 7 7 7 7C7 7 9.5 11 12 13C9.5 8.5 16 2 16 2Z" fill={`url(#${id})`}/>
      <path d="M16 14C16 14 18.5 17.5 17.5 20C20 18.5 21 16 21 16C21 16 23 19.5 22 22.5C21 25 18.5 27 16 27C13.5 27 11 25 10 22.5C9 19.5 11 16 11 16C11 16 12.5 18.5 14 20C12.5 17 16 14 16 14Z" fill="rgba(255,240,100,.85)"/>
    </svg>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function BadgePill({ b, size=44 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`radial-gradient(circle at 38% 38%, ${b.color}26, ${b.color}08)`,
      border:`1.5px solid ${b.color}55`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*.43, boxShadow:`0 0 20px ${b.glow}`,
    }}>{b.icon}</div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ on }) {
  if (!on) return null;
  return (
    <div style={{ position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",borderRadius:"inherit" }}>
      {Array.from({length:16},(_,i)=>({
        id:i, x:15+Math.random()*70,
        col:["#F4C430","#FF6B35","#7B68EE","#30D158","#FF2D55","#00C7FF"][i%6],
        del:Math.random()*.22, dur:.5+Math.random()*.3, sz:4+Math.random()*7,
      })).map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:`${p.x}%`,top:"20%",
          width:p.sz,height:p.sz,background:p.col,
          borderRadius:p.id%3===0?"50%":"2px",
          animation:`cf ${p.dur}s ${p.del}s ease-in both`,
        }}/>
      ))}
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard = ({ task, onToggle, onDelete }) => {
  const done = task.status === "done";
  const [pop, setPop] = useState(false);
  const cat = catOf(task.category);
  const dur = durLabel(task.time_start, task.time_end);

  const handle = useCallback(() => {
    if (!done) { setPop(true); setTimeout(()=>setPop(false),700); sfx("done"); }
    else sfx("click");
    onToggle(task.id, task.type, task.date);
  }, [done, task.id, task.type, task.date, onToggle]);

  const handleDel = useCallback(e => {
    e.stopPropagation();
    onDelete(task.id, task.type);
  }, [task.id, task.type, onDelete]);

  return (
    <div className="card-tap" onClick={handle} style={{
      position:"relative", overflow:"hidden",
      display:"flex", alignItems:"center", gap:12,
      padding:"13px 14px", borderRadius:16, marginBottom:8, cursor:"pointer",
      background:done?"rgba(255,255,255,.022)":"rgba(255,255,255,.057)",
      borderLeft:cat&&!done?`3px solid ${cat.color}`:"1px solid transparent",
      border:done?"1px solid rgba(255,255,255,.035)":cat?undefined:"1px solid rgba(255,255,255,.08)",
    }}>
      <Confetti on={pop}/>
      {pop&&<div style={{position:"absolute",left:26,top:"50%",width:22,height:22,borderRadius:"50%",border:"2px solid rgba(255,255,255,.5)",animation:"ring .65s ease-out forwards",pointerEvents:"none"}}/>}
      <div style={{
        width:24,height:24,borderRadius:"50%",flexShrink:0,
        border:done?"none":"2px solid rgba(255,255,255,.16)",
        background:done?"#30D158":"transparent",
        display:"flex",alignItems:"center",justifyContent:"center",
        animation:done?"cg .55s ease":"none",
        boxShadow:done?"0 0 14px rgba(48,209,88,.38)":"none",
        transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
      }}>
        {done&&<span style={{color:"#FFF",fontSize:12,fontWeight:800,animation:"pop .28s cubic-bezier(.34,1.56,.64,1)"}}>✓</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{
          fontSize:15,fontWeight:700,
          color:done?"rgba(255,255,255,.26)":"#F8F9FF",
          textDecoration:done?"line-through":"none",
          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
          transition:"color .3s",
        }}>{task.title}</div>
        {!done&&(task.time_start||task.notes)&&(
          <div style={{fontSize:11,color:"rgba(255,255,255,.33)",marginTop:2,fontWeight:600,display:"flex",gap:6}}>
            {task.time_start&&<span>🕐 {task.time_start}{task.time_end?` → ${task.time_end}`:""}{dur?` · ${dur}`:""}</span>}
            {task.notes&&!task.time_start&&<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.notes}</span>}
          </div>
        )}
      </div>
      {task.type==="recurring"&&!done&&(
        <span style={{fontSize:9,color:"rgba(255,255,255,.26)",background:"rgba(255,255,255,.06)",borderRadius:5,padding:"2px 6px",fontWeight:700,flexShrink:0}}>↻</span>
      )}
      <button onClick={handleDel} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.12)",fontSize:17,padding:"2px 5px",flexShrink:0,lineHeight:1}}>×</button>
    </div>
  );
};

// ── Timeline ──────────────────────────────────────────────────────────────────
const Timeline = ({ allTasks, date, onToggle, onDelete }) => {
  const now=new Date(), isToday=date===todayStr(), ch=now.getHours();
  const byHour = useMemo(()=>{
    const m={};
    allTasks.filter(t=>t.time_start).forEach(t=>{
      const h=parseInt(t.time_start);
      (m[h]=m[h]||[]).push(t);
    });
    return m;
  },[allTasks]);
  const noTime = useMemo(()=>allTasks.filter(t=>!t.time_start),[allTasks]);

  return (
    <div>
      {noTime.length>0&&(
        <div style={{marginBottom:22}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Sin hora</div>
          {noTime.map(t=><TaskCard key={t.id+t.date} task={t} onToggle={onToggle} onDelete={onDelete}/>)}
        </div>
      )}
      {HOURS.map(h=>{
        const ts=byHour[h]||[], isCur=isToday&&h===ch, isPast=isToday&&h<ch&&!ts.length;
        return (
          <div key={h} style={{display:"flex",gap:14,marginBottom:ts.length?10:1,opacity:isPast?.14:1,transition:"opacity .4s"}}>
            <div style={{width:36,flexShrink:0,paddingTop:2,textAlign:"right",fontSize:11,fontWeight:700,fontFamily:SERIF,color:isCur?"#F4C430":"rgba(255,255,255,.16)",transition:"color .3s"}}>
              {String(h).padStart(2,"0")}
            </div>
            <div style={{flex:1,borderLeft:`1px solid ${isCur?"rgba(244,196,48,.4)":"rgba(255,255,255,.05)"}`,paddingLeft:14,minHeight:20,position:"relative"}}>
              {isCur&&<div style={{position:"absolute",left:-5,top:2,width:8,height:8,borderRadius:"50%",background:"#F4C430",boxShadow:"0 0 10px rgba(244,196,48,.8)",animation:"pulse 2s ease-in-out infinite"}}/>}
              {ts.map(t=><TaskCard key={t.id+t.date} task={t} onToggle={onToggle} onDelete={onDelete}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Stats Bar ─────────────────────────────────────────────────────────────────
const StatsBar = ({ all }) => {
  const done = all.filter(t=>t.status==="done").length;
  const pct  = all.length ? Math.round((done/all.length)*100) : 0;
  if (!all.length) return null;
  return (
    <div style={{display:"flex",marginBottom:20,background:"rgba(255,255,255,.03)",borderRadius:16,border:"1px solid rgba(255,255,255,.05)",overflow:"hidden"}}>
      {[{v:all.length,l:"Tareas",c:"#F4C430"},{v:done,l:"Hechas",c:"#30D158"},{v:`${pct}%`,l:"Logrado",c:"#7B68EE"}].map((s,i)=>(
        <div key={i} style={{flex:1,padding:"12px 0",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,.05)":"none"}}>
          <div style={{fontSize:20,fontWeight:900,fontFamily:SERIF,color:s.c,lineHeight:1}}>{s.v}</div>
          <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>{s.l}</div>
        </div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// VISION BOARD — componentes
// ══════════════════════════════════════════════════════════════════════════════

// ── Board Card (lista) ─────────────────────────────────────────────────────────
const BoardCard = ({ board, onClick }) => {
  const total = board.milestones?.length || 0;
  const done  = board.milestones?.filter(m=>m.done).length || 0;
  const pct   = total ? Math.round((done/total)*100) : 0;

  return (
    <div className="card-tap" onClick={onClick} style={{
      background:"rgba(255,255,255,.04)",
      border:`1px solid ${board.color}28`,
      borderRadius:22, padding:20, cursor:"pointer",
      position:"relative", overflow:"hidden",
    }}>
      <div style={{position:"absolute",top:-40,right:-40,width:120,height:120,borderRadius:"50%",background:`radial-gradient(circle, ${board.color}18, transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontSize:28,marginBottom:8}}>{board.emoji}</div>
          <div style={{fontSize:16,fontWeight:800,color:"#F8F9FF",marginBottom:3}}>{board.title}</div>
          {board.description&&<div style={{fontSize:12,color:"rgba(255,255,255,.35)",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{board.description}</div>}
        </div>
        <Ring pct={pct} size={60} stroke={4} color={board.color}>
          <span style={{fontSize:13,fontWeight:900,fontFamily:SERIF,color:board.color}}>{pct}%</span>
        </Ring>
      </div>
      {total>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:600}}>{done}/{total} hitos</span>
            {pct===100&&<span style={{fontSize:11,color:board.color,fontWeight:800}}>✓ Completado</span>}
          </div>
          <div style={{height:3,background:"rgba(255,255,255,.06)",borderRadius:3}}>
            <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${board.color}88,${board.color})`,borderRadius:3,transition:"width .9s cubic-bezier(.16,1,.3,1)"}}/>
          </div>
        </div>
      )}
      {!total&&<div style={{fontSize:12,color:"rgba(255,255,255,.22)",fontStyle:"italic"}}>Toca para añadir hitos →</div>}
    </div>
  );
};

// ── Board Detail (modal) ───────────────────────────────────────────────────────
const BoardDetail = ({ board, onChange, onClose, onDelete }) => {
  const [title,   setTitle]   = useState(board.title);
  const [desc,    setDesc]    = useState(board.description||"");
  const [action,  setAction]  = useState(board.action||"");
  const [emoji,   setEmoji]   = useState(board.emoji);
  const [color,   setColor]   = useState(board.color);
  const [newM,    setNewM]    = useState("");
  const [showPick,setShowPick]= useState(false);

  const milestones = board.milestones || [];
  const done  = milestones.filter(m=>m.done).length;
  const total = milestones.length;
  const pct   = total ? Math.round((done/total)*100) : 0;

  const push = (changes) => onChange({ ...board, ...changes });

  const addMilestone = () => {
    if (!newM.trim()) return;
    sfx("click");
    push({ milestones:[...milestones,{id:uid(),text:newM.trim(),done:false}] });
    setNewM("");
  };

  const toggleM = (id) => {
    const updated = milestones.map(m=>m.id===id?{...m,done:!m.done}:m);
    const wasDone = milestones.find(m=>m.id===id)?.done;
    if (!wasDone) sfx("milestone");
    push({ milestones:updated });
  };

  const deleteM = (id) => push({ milestones:milestones.filter(m=>m.id!==id) });

  const saveHeader = () => push({ title:title.trim()||board.title, description:desc, action, emoji, color });

  const IS = {
    width:"100%", padding:"11px 14px", borderRadius:12,
    background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
    color:"#F8F9FF", fontSize:14, fontWeight:600, fontFamily:FONT,
    outline:"none", boxSizing:"border-box",
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(16px)",zIndex:200,overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#0E1120",border:`1px solid ${color}28`,
        borderRadius:"28px 28px 0 0",padding:"28px 22px 48px",
        minHeight:"70vh",marginTop:"auto",
        animation:"up .4s cubic-bezier(.16,1,.3,1) both",
        position:"relative",marginTop:80,
      }}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={()=>setShowPick(p=>!p)} style={{fontSize:28,background:"rgba(255,255,255,.06)",border:`1px solid ${color}44`,borderRadius:14,width:52,height:52,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{emoji}</button>
            <div>
              <input value={title} onChange={e=>{setTitle(e.target.value);push({title:e.target.value});}}
                style={{...IS,padding:"6px 0",background:"transparent",border:"none",fontSize:20,fontWeight:900,fontFamily:SERIF,letterSpacing:"-.3px",width:"auto"}}
              />
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onDelete} style={{background:"rgba(255,59,48,.08)",border:"1px solid rgba(255,59,48,.18)",borderRadius:10,padding:"8px 12px",color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>Eliminar</button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",color:"rgba(255,255,255,.5)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
        </div>

        {/* Emoji picker */}
        {showPick&&(
          <div style={{background:"rgba(255,255,255,.05)",borderRadius:18,padding:16,marginBottom:20,display:"flex",flexWrap:"wrap",gap:10}}>
            {BOARD_EMOJIS.map(e=>(
              <button key={e} onClick={()=>{setEmoji(e);push({emoji:e});setShowPick(false);}} style={{fontSize:24,background:emoji===e?`${color}33`:"transparent",border:emoji===e?`1px solid ${color}`:"1px solid transparent",borderRadius:12,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {e}
              </button>
            ))}
            <div style={{width:"100%",display:"flex",gap:8,marginTop:4}}>
              {BOARD_COLORS.map(c=>(
                <button key={c} onClick={()=>{setColor(c);push({color:c});}} style={{width:28,height:28,borderRadius:"50%",background:c,border:color===c?"2px solid #FFF":"2px solid transparent",cursor:"pointer"}}/>
              ))}
            </div>
          </div>
        )}

        {/* Progress ring grande */}
        <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:24,background:"rgba(255,255,255,.03)",border:`1px solid ${color}22`,borderRadius:20,padding:18}}>
          <Ring pct={pct} size={76} stroke={6} color={color}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,fontFamily:SERIF,color,lineHeight:1}}>{pct}%</div>
            </div>
          </Ring>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:900,fontFamily:SERIF,color:"#F8F9FF",marginBottom:4}}>
              {pct===100?"✨ Meta lograda":pct>50?"¡Vas muy bien!":pct>0?"En progreso...":"Empieza hoy"}
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>
              {done} de {total} hitos completados
            </div>
          </div>
        </div>

        {/* Descripción */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>Descripción</div>
          <textarea placeholder="¿Qué significa esta meta para ti?" value={desc}
            onChange={e=>{setDesc(e.target.value);push({description:e.target.value});}}
            style={{...IS,minHeight:68,resize:"none"}}
          />
        </div>

        {/* Acción de hoy */}
        <div style={{marginBottom:24,background:`${color}12`,border:`1px solid ${color}28`,borderRadius:16,padding:16}}>
          <div style={{fontSize:10,fontWeight:700,color:color,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>⚡ ¿Qué hice hoy para lograrlo?</div>
          <textarea placeholder="Escribe tu acción de hoy..." value={action}
            onChange={e=>{setAction(e.target.value);push({action:e.target.value});}}
            style={{...IS,background:"rgba(0,0,0,.2)",minHeight:60,resize:"none"}}
          />
        </div>

        {/* Milestones */}
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>Hitos y pasos clave</div>

        {milestones.map(m=>(
          <div key={m.id} className="card-tap" onClick={()=>toggleM(m.id)} style={{
            display:"flex",alignItems:"center",gap:12,
            padding:"13px 14px",borderRadius:14,marginBottom:8,cursor:"pointer",
            background:m.done?"rgba(48,209,88,.06)":"rgba(255,255,255,.04)",
            border:`1px solid ${m.done?"rgba(48,209,88,.2)":"rgba(255,255,255,.07)"}`,
          }}>
            <div style={{
              width:22,height:22,borderRadius:"50%",flexShrink:0,
              border:m.done?"none":"2px solid rgba(255,255,255,.18)",
              background:m.done?"#30D158":"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:m.done?"0 0 10px rgba(48,209,88,.35)":"none",
              transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
            }}>
              {m.done&&<span style={{color:"#FFF",fontSize:11,fontWeight:800}}>✓</span>}
            </div>
            <div style={{flex:1,fontSize:14,fontWeight:600,color:m.done?"rgba(255,255,255,.38)":"#F8F9FF",textDecoration:m.done?"line-through":"none",transition:"all .3s"}}>{m.text}</div>
            <button onClick={e=>{e.stopPropagation();deleteM(m.id);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.13)",fontSize:16,lineHeight:1}}>×</button>
          </div>
        ))}

        <div style={{display:"flex",gap:10,marginTop:8}}>
          <input type="text" placeholder="Nuevo hito..." value={newM} onChange={e=>setNewM(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addMilestone()}
            style={{...IS,flex:1}}
          />
          <button onClick={addMilestone} style={{padding:"0 20px",borderRadius:12,border:"none",background:"#F8F9FF",color:"#080B14",fontWeight:800,fontSize:18,cursor:"pointer",fontFamily:FONT}}>+</button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// HABIT CARD
// ══════════════════════════════════════════════════════════════════════════════
const HabitCard = ({ habit, onReset, onDelete }) => {
  const d=daysClean(habit.lastResetDate), cb=currBadge(d), nb=nextBadge(d);
  const pct=nb?Math.min((d/nb.days)*100,100):100, sc=streakColor(d);
  return (
    <div className="card-tap" style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:22,padding:22,marginBottom:14,position:"relative",overflow:"hidden"}}>
      {d>0&&cb&&<div style={{position:"absolute",top:-50,right:-50,width:130,height:130,borderRadius:"50%",background:`radial-gradient(circle, ${cb.glow}, transparent 70%)`,pointerEvents:"none"}}/>}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Flame days={d} size={32}/>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#F8F9FF",marginBottom:6}}>{habit.name}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontSize:56,fontWeight:900,fontFamily:SERIF,color:sc,lineHeight:1}}>{d}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.38)"}}>día{d!==1?"s":""}</div>
                <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.24)"}}>sin recaer</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          {cb&&<BadgePill b={cb} size={42}/>}
          <button onClick={()=>onDelete(habit.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.16)",fontSize:17,lineHeight:1}}>×</button>
        </div>
      </div>
      {nb&&(
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>{nb.icon} {nb.name} — {nb.days}d</span>
            <span style={{fontSize:11,color:nb.color,fontWeight:700}}>{nb.days-d} restantes</span>
          </div>
          <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:4,overflow:"hidden"}}>
            <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${nb.color}88,${nb.color})`,borderRadius:4,transition:"width .9s cubic-bezier(.16,1,.3,1)"}}/>
          </div>
        </div>
      )}
      {!nb&&cb&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div style={{flex:1,height:3,background:`linear-gradient(90deg,${cb.color}44,${cb.color})`,borderRadius:3}}/>
        <span style={{fontSize:10,color:cb.color,fontWeight:700,flexShrink:0}}>👑 NIVEL MÁXIMO</span>
      </div>}
      <button onClick={()=>{sfx("click");onReset(habit.id);}} style={{
        padding:"9px 16px",borderRadius:11,
        background:"rgba(255,59,48,.07)",border:"1px solid rgba(255,59,48,.18)",
        color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT,
      }}>😔 Recaí — reiniciar contador</button>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ADD FORM
// ══════════════════════════════════════════════════════════════════════════════
const AddForm = ({ onSave, selectedDate }) => {
  const [mode,  setMode]  = useState("once");
  const [title, setTitle] = useState("");
  const [ts,    setTs]    = useState("");
  const [te,    setTe]    = useState("");
  const [cat,   setCat]   = useState("");
  const [notes, setNotes] = useState("");
  const [rType, setRType] = useState("daily");
  const [rDays, setRDays] = useState([1,2,3,4,5]);

  const IS = {
    width:"100%",padding:"11px 14px",borderRadius:13,
    background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.09)",
    color:"#F8F9FF",fontSize:14,fontWeight:600,fontFamily:FONT,
    outline:"none",boxSizing:"border-box",
  };

  const toggleDay = useCallback(d => setRDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]),[]);

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title:title.trim(), timeStart:ts, timeEnd:te, cat, notes, mode, rType, rDays });
    setTitle(""); setTs(""); setTe(""); setCat(""); setNotes("");
  },[title,ts,te,cat,notes,mode,rType,rDays,onSave]);

  return (
    <div className="su" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:28,padding:24}}>
      <div style={{fontSize:22,fontWeight:900,fontFamily:SERIF,marginBottom:20,letterSpacing:"-.4px"}}>Nueva tarea</div>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="¿Qué harás?" autoFocus value={title} onChange={e=>setTitle(e.target.value)}
          style={{...IS,fontSize:19,fontWeight:800,padding:"11px 0",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.09)",borderRadius:0,marginBottom:20}}
        />
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Un clic</div>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12,marginBottom:18}}>
          {QUICK_TASKS.map(t=>(
            <button key={t} type="button" onClick={()=>{sfx("click");setTitle(t);}} style={{
              padding:"8px 13px",borderRadius:11,border:"none",whiteSpace:"nowrap",
              cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:FONT,
              background:title===t?"#F4C430":"rgba(255,255,255,.06)",
              color:title===t?"#000":"rgba(255,255,255,.6)",transition:"all .18s",
            }}>{t}</button>
          ))}
        </div>

        {/* Mode */}
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {[["once","📌 Una vez"],["recurring","↻ Repetir"]].map(([m,l])=>(
            <button key={m} type="button" onClick={()=>{sfx("click");setMode(m);}} style={{
              flex:1,padding:"11px",borderRadius:13,border:"none",cursor:"pointer",
              fontWeight:700,fontSize:13,fontFamily:FONT,
              background:mode===m?"#F8F9FF":"rgba(255,255,255,.05)",
              color:mode===m?"#080B14":"rgba(255,255,255,.45)",transition:"all .2s",
            }}>{l}</button>
          ))}
        </div>

        {/* Recurring */}
        {mode==="recurring"&&(
          <div style={{background:"rgba(123,104,238,.08)",border:"1px solid rgba(123,104,238,.18)",borderRadius:16,padding:16,marginBottom:18}}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(163,149,255,.8)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Frecuencia</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:rType==="custom"?14:0}}>
              {[["daily","Cada día"],["weekdays","L – V"],["weekends","S – D"],["custom","Elegir días"]].map(([k,l])=>(
                <button key={k} type="button" onClick={()=>{sfx("click");setRType(k);}} style={{
                  padding:"8px 13px",borderRadius:10,border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:700,fontFamily:FONT,whiteSpace:"nowrap",
                  background:rType===k?"#7B68EE":"rgba(255,255,255,.07)",
                  color:rType===k?"#FFF":"rgba(255,255,255,.45)",transition:"all .18s",
                }}>{l}</button>
              ))}
            </div>
            {rType==="custom"&&(
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {DAYS_SH.map((d,i)=>(
                  <button key={i} type="button" onClick={()=>toggleDay(i)} style={{
                    width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",
                    fontSize:12,fontWeight:800,fontFamily:FONT,
                    background:rDays.includes(i)?"#7B68EE":"rgba(255,255,255,.08)",
                    color:rDays.includes(i)?"#FFF":"rgba(255,255,255,.35)",transition:"all .18s",
                  }}>{d}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Start / End */}
        <div style={{display:"flex",gap:10,marginBottom:18}}>
          {[["Inicio",ts,setTs],["Fin",te,setTe]].map(([l,val,set])=>(
            <div key={l} style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:7}}>{l}</div>
              <select value={val} onChange={e=>set(e.target.value)} style={{...IS,padding:"10px 12px"}}>
                <option value="">— sin hora —</option>
                {ALL_TIMES.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Category */}
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.26)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Categoría</div>
        <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
          {CATS.map(c=>(
            <button key={c.id} type="button" onClick={()=>{sfx("click");setCat(cat===c.id?"":c.id);}} style={{
              padding:"7px 12px",borderRadius:10,border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:FONT,
              background:cat===c.id?c.color:"rgba(255,255,255,.06)",
              color:cat===c.id?"#FFF":"rgba(255,255,255,.45)",transition:"all .18s",
            }}>● {c.label}</button>
          ))}
        </div>

        {/* Notes */}
        <input type="text" placeholder="Nota opcional" value={notes} onChange={e=>setNotes(e.target.value)}
          style={{...IS,marginBottom:22}}
        />

        <button type="submit" style={{
          width:"100%",padding:17,borderRadius:17,border:"none",
          background:"#F8F9FF",color:"#080B14",fontSize:15,fontWeight:800,
          cursor:"pointer",fontFamily:FONT,letterSpacing:"-.2px",
          boxShadow:"0 8px 22px rgba(248,249,255,.07)",
        }}>Guardar ✓</button>
      </form>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS / NOTIFICACIONES PANEL
// ══════════════════════════════════════════════════════════════════════════════
const Settings = ({ onClose, session, onLogin, onLogout, notifPerm, onRequestNotif }) => {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");

  const IS = {
    width:"100%",padding:"11px 14px",borderRadius:12,
    background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",
    color:"#F8F9FF",fontSize:14,fontWeight:600,fontFamily:FONT,
    outline:"none",boxSizing:"border-box",marginBottom:10,
  };

  const doLogin = async () => {
    if (!email||!pass) return;
    setLoading(true); setMsg("");
    try { await onLogin(email,pass); setMsg("✓ Conectado"); }
    catch(e) { setMsg("Error: "+(e.message||"verifica tus datos")); }
    finally { setLoading(false); }
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.68)",backdropFilter:"blur(16px)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#0E1120",border:"1px solid rgba(255,255,255,.08)",
        borderRadius:"0 0 28px 28px",padding:"28px 22px 36px",
        width:"100%",maxWidth:480,animation:"dd .3s ease both",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:26}}>
          <span style={{fontSize:18,fontWeight:800,fontFamily:SERIF}}>Configuración</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,.35)",fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* ── NOTIFICACIONES ── */}
        <div style={{marginBottom:26}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>🔔 Notificaciones</div>

          {notifPerm==="unsupported"&&(
            <div style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:16,fontSize:13,color:"rgba(255,255,255,.4)"}}>
              Tu navegador no soporta notificaciones.
            </div>
          )}

          {notifPerm==="granted"&&(
            <div style={{background:"rgba(48,209,88,.07)",border:"1px solid rgba(48,209,88,.2)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#30D158",marginBottom:4}}>🔔 Notificaciones activas</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Recibirás recordatorios 10 min antes de cada tarea.</div>
            </div>
          )}

          {(notifPerm==="default"||notifPerm==="denied")&&(
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:16}}>
              {notifPerm==="denied"&&<div style={{fontSize:12,color:"#FF9500",marginBottom:10,fontWeight:600}}>⚠ Notificaciones bloqueadas en ajustes del sistema.</div>}
              <button onClick={onRequestNotif} style={{
                width:"100%",padding:"12px",borderRadius:12,border:"none",
                background:notifPerm==="denied"?"rgba(255,255,255,.06)":"#F8F9FF",
                color:notifPerm==="denied"?"rgba(255,255,255,.4)":"#080B14",
                fontSize:14,fontWeight:800,cursor:notifPerm==="denied"?"not-allowed":"pointer",fontFamily:FONT,
              }} disabled={notifPerm==="denied"}>
                Activar notificaciones
              </button>
              <div style={{fontSize:11,color:"rgba(255,255,255,.2)",textAlign:"center",marginTop:10}}>
                📱 En iPhone: instala como PWA (Compartir → Añadir a inicio) para notificaciones en segundo plano.
              </div>
            </div>
          )}
        </div>

        {/* ── SINCRONIZACIÓN ── */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>☁ Sincronización en la nube</div>

          {session?(
            <div style={{background:"rgba(48,209,88,.07)",border:"1px solid rgba(48,209,88,.2)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#30D158",marginBottom:4}}>✓ Sincronizado</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.38)",marginBottom:12}}>{session.user?.email}</div>
              <button onClick={onLogout} style={{background:"rgba(255,59,48,.08)",border:"1px solid rgba(255,59,48,.2)",borderRadius:10,padding:"8px 16px",color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>Cerrar sesión</button>
            </div>
          ):(
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:16}}>
              <input type="email"    placeholder="Correo electrónico" value={email} onChange={e=>setEmail(e.target.value)} style={IS}/>
              <input type="password" placeholder="Contraseña"         value={pass}  onChange={e=>setPass(e.target.value)}  style={{...IS,marginBottom:msg?8:0}}/>
              {msg&&<div style={{fontSize:12,color:msg.startsWith("✓")?"#30D158":"#FF6B6B",marginBottom:8}}>{msg}</div>}
              <button onClick={doLogin} disabled={loading} style={{
                width:"100%",padding:"11px",borderRadius:12,border:"none",
                background:"#F8F9FF",color:"#080B14",fontSize:14,fontWeight:800,
                cursor:loading?"default":"pointer",fontFamily:FONT,opacity:loading?.6:1,marginTop:6,
              }}>{loading?"Conectando...":"Iniciar sesión"}</button>
              <div style={{fontSize:11,color:"rgba(255,255,255,.18)",textAlign:"center",marginTop:10}}>
                La app funciona sin cuenta. Todo se guarda en tu dispositivo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  useEffect(()=>{ injectGlobal(); },[]);

  const [tab,       setTab]       = useState("today");
  const [date,      setDate]      = useState(todayStr);
  const [showCfg,   setShowCfg]   = useState(false);
  const [session,   setSession]   = useState(null);
  const [notifPerm, setNotifPerm] = useState(()=>"Notification" in window ? Notification.permission : "unsupported");
  const [activeBd,  setActiveBd]  = useState(null); // board en detalle

  const [tasks,     setTasks]     = useState(()=>load("tasks",     []));
  const [recurring, setRecurring] = useState(()=>load("recurring", []));
  const [habits,    setHabits]    = useState(()=>load("habits",    []));
  const [boards,    setBoards]    = useState(()=>load("boards",    []));

  const notifTimers = useRef([]);
  const cal = useMemo(()=>calDays(),[]);

  // ── Persistencia ──────────────────────────────────────────────────────────
  useEffect(()=>{ save("tasks",     tasks);     },[tasks]);
  useEffect(()=>{ save("recurring", recurring); },[recurring]);
  useEffect(()=>{ save("habits",    habits);    },[habits]);
  useEffect(()=>{ save("boards",    boards);    },[boards]);

  // ── Merge tareas para la fecha seleccionada ───────────────────────────────
  const allTasksForDate = useMemo(()=>{
    const reg = tasks.filter(t=>t.date===date).map(t=>({...t,type:"once"}));
    const rec = recurring
      .filter(rt=>rt.active && recurApplies(rt.recurrence, date))
      .map(rt=>({
        id:rt.id, type:"recurring", title:rt.title, date,
        time_start:rt.time_start||null, time_end:rt.time_end||null,
        category:rt.category||null, notes:rt.notes||"",
        status:(rt.completions||{})[date]==="done"?"done":"pending",
      }));
    return [...reg,...rec].sort((a,b)=>{
      if(!a.time_start&&!b.time_start) return 0;
      if(!a.time_start) return 1; if(!b.time_start) return -1;
      return a.time_start.localeCompare(b.time_start);
    });
  },[tasks,recurring,date]);

  // ── Dots de completitud ───────────────────────────────────────────────────
  const calDots = useMemo(()=>{
    const m={};
    cal.forEach(d=>{
      const reg=tasks.filter(t=>t.date===d.str);
      const rec=recurring.filter(rt=>rt.active&&recurApplies(rt.recurrence,d.str));
      const total=reg.length+rec.length;
      if(!total){m[d.str]=null;return;}
      const done=reg.filter(t=>t.status==="done").length+rec.filter(rt=>(rt.completions||{})[d.str]==="done").length;
      m[d.str]=Math.round((done/total)*100);
    });
    return m;
  },[tasks,recurring,cal]);

  // ── Notificaciones: programar al cargar / cuando cambian las tareas ───────
  useEffect(()=>{
    if (notifPerm!=="granted") return;
    notifTimers.current.forEach(clearTimeout);
    notifTimers.current=[];
    const today=todayStr();
    allTasksForDate.filter(t=>t.time_start&&t.status!=="pending").forEach(t=>{
      const [h,m]=t.time_start.split(":").map(Number);
      const alertAt=new Date(); alertAt.setHours(h,m-10,0,0);
      const delay=alertAt.getTime()-Date.now();
      if(delay>0){
        const id=setTimeout(()=>fireNotif(`⏰ En 10 min: ${t.title}`,`Empieza a las ${t.time_start}`,"pf_"+t.id),delay);
        notifTimers.current.push(id);
      }
    });
  },[allTasksForDate,notifPerm]);

  // ── Toggle tarea ─────────────────────────────────────────────────────────
  const toggleTask = useCallback((id,type,taskDate)=>{
    if(type==="recurring"){
      setRecurring(p=>p.map(rt=>{
        if(rt.id!==id) return rt;
        const cur=(rt.completions||{})[taskDate];
        if(!cur||cur!=="done") sfx("done"); else sfx("click");
        return {...rt,completions:{...(rt.completions||{}),[taskDate]:cur==="done"?null:"done"}};
      }));
    } else {
      setTasks(p=>p.map(t=>{
        if(t.id!==id) return t;
        if(t.status!=="done") sfx("done"); else sfx("click");
        return {...t,status:t.status==="done"?"pending":"done"};
      }));
    }
  },[]);

  // ── Eliminar tarea ────────────────────────────────────────────────────────
  const deleteTask = useCallback((id,type)=>{
    sfx("click");
    if(type==="recurring") setRecurring(p=>p.filter(rt=>rt.id!==id));
    else setTasks(p=>p.filter(t=>t.id!==id));
  },[]);

  // ── Guardar nueva tarea / rutina ──────────────────────────────────────────
  const saveTask = useCallback(({title,timeStart,timeEnd,cat,notes,mode,rType,rDays})=>{
    sfx("click");
    if(mode==="recurring"){
      setRecurring(p=>[...p,{
        id:uid(), title, active:true,
        time_start:timeStart||null, time_end:timeEnd||null,
        category:cat||null, notes:notes||"",
        recurrence:{ type:rType, days:rType==="custom"?[...rDays]:[] },
        completions:{},
      }]);
    } else {
      setTasks(p=>[...p,{
        id:uid(), title, date, status:"pending",
        time_start:timeStart||null, time_end:timeEnd||null,
        category:cat||null, notes:notes||"",
      }]);
    }
    setTab("today");
  },[date]);

  // ── Vision Boards ─────────────────────────────────────────────────────────
  const createBoard = useCallback(()=>{
    sfx("click");
    const nb={
      id:uid(), title:"Nueva visión", emoji:BOARD_EMOJIS[boards.length%BOARD_EMOJIS.length],
      color:BOARD_COLORS[boards.length%BOARD_COLORS.length],
      description:"", action:"", milestones:[],
    };
    setBoards(p=>[...p,nb]);
    setActiveBd(nb);
  },[boards.length]);

  const updateBoard = useCallback(b=>{
    setBoards(p=>p.map(x=>x.id===b.id?b:x));
    setActiveBd(b);
  },[]);

  const deleteBoard = useCallback(id=>{
    sfx("click");
    setBoards(p=>p.filter(b=>b.id!==id));
    setActiveBd(null);
  },[]);

  // ── Solicitar permisos de notificación ────────────────────────────────────
  const handleRequestNotif = useCallback(async()=>{
    const p=await requestNotifPerm();
    setNotifPerm(p);
    if(p==="granted") fireNotif("✅ Focus App","Notificaciones activas. Te avisaré antes de tus tareas.");
  },[]);

  // ── Auth stubs ────────────────────────────────────────────────────────────
  const handleLogin  = async(email,pass)=>{ throw new Error("Descomenta el import de Supabase para activar."); };
  const handleLogout = ()=>setSession(null);

  // ── Board activo del state actualizado ───────────────────────────────────
  const activeBoard = activeBd ? boards.find(b=>b.id===activeBd.id)||null : null;

  return (
    <div style={{fontFamily:FONT,background:"#080B14",minHeight:"100vh",color:"#F8F9FF",maxWidth:480,margin:"0 auto",position:"relative",overflowX:"hidden"}}>

      {/* Orbes */}
      <div style={{position:"fixed",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(123,104,238,.09),transparent)",top:-150,left:-130,pointerEvents:"none",animation:"orb1 9s ease-in-out infinite"}}/>
      <div style={{position:"fixed",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(244,196,48,.06),transparent)",bottom:60,right:-90,pointerEvents:"none",animation:"orb2 11s ease-in-out infinite"}}/>

      {/* Settings overlay */}
      {showCfg&&<Settings onClose={()=>setShowCfg(false)} session={session} onLogin={handleLogin} onLogout={handleLogout} notifPerm={notifPerm} onRequestNotif={handleRequestNotif}/>}

      {/* Board detail overlay */}
      {activeBoard&&(
        <BoardDetail
          board={activeBoard}
          onChange={updateBoard}
          onClose={()=>setActiveBd(null)}
          onDelete={()=>deleteBoard(activeBoard.id)}
        />
      )}

      {/* ── HEADER ── */}
      <div style={{padding:"48px 20px 13px",position:"sticky",top:0,zIndex:50,background:"rgba(8,11,20,.9)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:28,fontWeight:900,fontFamily:SERIF,letterSpacing:"-.5px"}}>Focus.</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {notifPerm==="granted"&&<div className="pulse" style={{width:7,height:7,borderRadius:"50%",background:"#FF6B35",boxShadow:"0 0 8px rgba(255,107,53,.6)"}}/>}
            {session&&<div style={{width:7,height:7,borderRadius:"50%",background:"#30D158",boxShadow:"0 0 8px rgba(48,209,88,.55)"}}/>}
            <button onClick={()=>setShowCfg(true)} style={{
              background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",
              borderRadius:"50%",width:36,height:36,cursor:"pointer",
              color:"rgba(255,255,255,.45)",fontSize:15,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>⚙</button>
          </div>
        </div>
      </div>

      <div style={{padding:"18px 18px 110px"}}>

        {/* ════ HOY ════ */}
        {tab==="today"&&(
          <div className="fi">
            {/* Calendario */}
            <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:4}}>
              {cal.map(d=>{
                const sel=d.str===date, pct=calDots[d.str];
                return (
                  <button key={d.str} onClick={()=>{sfx("click");setDate(d.str);}} style={{
                    display:"flex",flexDirection:"column",alignItems:"center",
                    padding:"9px 0",minWidth:44,borderRadius:16,border:"none",cursor:"pointer",
                    background:sel?"#F4C430":"rgba(255,255,255,.04)",
                    boxShadow:sel?"0 8px 20px rgba(244,196,48,.28)":"none",
                    transition:"all .22s cubic-bezier(.34,1.56,.64,1)",
                  }}>
                    <span style={{fontSize:9,fontWeight:700,color:sel?"#000":"rgba(255,255,255,.28)",textTransform:"uppercase",marginBottom:4,letterSpacing:.5}}>{d.name}</span>
                    <span style={{fontSize:18,fontWeight:900,fontFamily:SERIF,color:sel?"#000":"#F8F9FF"}}>{d.num}</span>
                    <div style={{marginTop:5,width:5,height:5,borderRadius:"50%",
                      background:pct===null?(sel?"rgba(0,0,0,.18)":"rgba(255,255,255,.07)"):
                                 sel?"rgba(0,0,0,.35)":
                                 pct===100?"#30D158":pct>50?"#FFD60A":"#FF9500",
                    }}/>
                  </button>
                );
              })}
            </div>
            <StatsBar all={allTasksForDate}/>
            {allTasksForDate.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div className="float" style={{fontSize:50,marginBottom:16}}>🌙</div>
                <div style={{fontSize:18,fontWeight:800,fontFamily:SERIF,color:"rgba(255,255,255,.4)"}}>Día despejado</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.2)",marginTop:8}}>Añade tareas o disfruta el descanso</div>
              </div>
            ):(
              <Timeline allTasks={allTasksForDate} date={date} onToggle={toggleTask} onDelete={deleteTask}/>
            )}
          </div>
        )}

        {/* ════ AGREGAR ════ */}
        {tab==="add"&&<AddForm onSave={saveTask} selectedDate={date}/>}

        {/* ════ METAS ════ */}
        {tab==="goals"&&(
          <div className="fi">

            {/* ── VISION BOARDS ── */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5}}>🎯 Vision Boards</div>
                {boards.length>0&&<div style={{fontSize:12,color:"rgba(255,255,255,.22)",marginTop:3}}>{boards.length} meta{boards.length!==1?"s":""} activa{boards.length!==1?"s":""}</div>}
              </div>
              <button onClick={createBoard} style={{
                padding:"8px 16px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",
                background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.6)",
                fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT,
                display:"flex",alignItems:"center",gap:6,
              }}>+ Nueva visión</button>
            </div>

            {boards.length===0?(
              <div onClick={createBoard} className="card-tap" style={{
                textAlign:"center",padding:"44px 20px",marginBottom:28,cursor:"pointer",
                background:"rgba(123,104,238,.06)",border:"1px dashed rgba(123,104,238,.25)",
                borderRadius:22,
              }}>
                <div className="float" style={{fontSize:44,marginBottom:14}}>🎯</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:SERIF,color:"rgba(255,255,255,.45)"}}>Define tu primera visión</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.22)",marginTop:6}}>Toca para crear tu primer vision board</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
                {boards.map(b=>(
                  <BoardCard key={b.id} board={b} onClick={()=>{sfx("click");setActiveBd(b);}}/>
                ))}
              </div>
            )}

            {/* Divider */}
            <div style={{height:1,background:"rgba(255,255,255,.06)",marginBottom:28}}/>

            {/* ── RUTINAS ACTIVAS ── */}
            {recurring.filter(r=>r.active).length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>↻ Rutinas activas</div>
                {recurring.filter(r=>r.active).map(r=>(
                  <div key={r.id} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"13px 15px",borderRadius:15,marginBottom:8,
                    background:"rgba(123,104,238,.07)",border:"1px solid rgba(123,104,238,.14)",
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#F8F9FF"}}>{r.title}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.33)",marginTop:2,fontWeight:600}}>
                        {recurLabel(r.recurrence)}
                        {r.time_start?`  ·  ${r.time_start}${r.time_end?` → ${r.time_end}`:""}` :""}
                      </div>
                    </div>
                    <button onClick={()=>{sfx("click");setRecurring(p=>p.map(x=>x.id===r.id?{...x,active:false}:x));}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.18)",fontSize:16,padding:"4px 8px",lineHeight:1,flexShrink:0}}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── HÁBITOS ── */}
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>🔥 Hábitos a superar</div>
            {habits.length===0&&(
              <div style={{textAlign:"center",padding:"32px 20px",color:"rgba(255,255,255,.18)",marginBottom:20}}>
                <div className="float" style={{fontSize:40,marginBottom:10}}>🚫</div>
                <div style={{fontWeight:700,fontSize:14}}>Agrega hábitos que quieras eliminar</div>
              </div>
            )}
            {habits.map(h=>(
              <HabitCard key={h.id} habit={h}
                onReset={id=>{sfx("click");setHabits(p=>p.map(x=>x.id===id?{...x,lastResetDate:Date.now()}:x));}}
                onDelete={id=>setHabits(p=>p.filter(x=>x.id!==id))}
              />
            ))}
            <form onSubmit={e=>{
              e.preventDefault();
              const v=e.target.h.value.trim();
              if(!v)return;
              setHabits(p=>[...p,{id:uid(),name:v,lastResetDate:Date.now()}]);
              e.target.h.value=""; sfx("done");
            }} style={{display:"flex",gap:10,marginTop:8}}>
              <input name="h" type="text" placeholder="Ej: Fumar, azúcar, redes..." style={{
                flex:1,padding:"11px 14px",borderRadius:13,
                background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",
                color:"#F8F9FF",fontSize:14,fontWeight:600,fontFamily:FONT,outline:"none",
              }}/>
              <button type="submit" style={{padding:"0 20px",borderRadius:13,border:"none",background:"#F8F9FF",color:"#080B14",fontWeight:800,fontSize:18,cursor:"pointer",fontFamily:FONT}}>+</button>
            </form>
          </div>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div style={{
        position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:480,
        background:"rgba(8,11,20,.96)",backdropFilter:"blur(28px)",
        borderTop:"1px solid rgba(255,255,255,.05)",
        display:"flex",padding:"8px 18px calc(env(safe-area-inset-bottom,0px) + 8px)",
        zIndex:60,
      }}>
        {[
          {k:"today",icon:"📅",l:"Hoy"},
          {k:"add",  icon:"✦", l:"Añadir"},
          {k:"goals",icon:"🎯",l:"Metas"},
        ].map(({k,icon,l})=>(
          <button key={k} onClick={()=>{sfx("click");setTab(k);}} style={{
            flex:1,padding:"9px 4px",border:"none",background:"transparent",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:4,
          }}>
            <div style={{fontSize:21,opacity:tab===k?1:.25,transform:tab===k?"scale(1.15)":"scale(1)",transition:"all .22s cubic-bezier(.34,1.56,.64,1)"}}>{icon}</div>
            <div style={{fontSize:9,fontWeight:700,fontFamily:FONT,letterSpacing:.5,color:tab===k?"#F4C430":"rgba(255,255,255,.26)"}}>{l.toUpperCase()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}