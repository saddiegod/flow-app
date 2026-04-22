import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { todayISO, toISO, calDays, recurApplies, uid, migrateTasks, recurLabel } from "./utils/dates.js";
import { sfx, load, save, fireNotif, requestNotifPerm } from "./utils/helpers.js";
import { FONT, SERIF, BOARD_COLORS, BOARD_EMOJIS } from "./utils/constants.js";
// 👇 IMPORTAMOS SUPABASE 👇
import { supabase } from "./utils/supabase.js"; 
import { injectGlobal, StatsBar } from "./components/shared.jsx";
import TaskCard       from "./components/TaskCard.jsx";
import Timeline       from "./components/Timeline.jsx";
import HabitCard      from "./components/HabitCard.jsx";
import AddForm        from "./components/AddForm.jsx";
import FocusMode      from "./components/FocusMode.jsx";
import Heatmap        from "./components/Heatmap.jsx";
import Settings       from "./components/Settings.jsx";
import Journal        from "./components/Journal.jsx";
import { BoardCard, BoardDetail } from "./components/Vision.jsx";

const KEY = { tasks:"tasks", rec:"recurring", habits:"habits", boards:"boards" };

// ── Ambient orbs ──────────────────────────────────────────────────────────────
const Orbs = () => (
  <>
    <div style={{ position:"fixed",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(123,104,238,.09),transparent)",top:-150,left:-130,pointerEvents:"none",animation:"orb1 9s ease-in-out infinite" }}/>
    <div style={{ position:"fixed",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(244,196,48,.06),transparent)",bottom:60,right:-90,pointerEvents:"none",animation:"orb2 11s ease-in-out infinite" }}/>
  </>
);

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounced(value, delay = 400) {
  const ref = useRef(value);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { ref.current = value; }, delay);
    return () => clearTimeout(timer.current);
  }, [value, delay]);
  return ref;
}

// ── Calendar day button ────────────────────────────────────────────────────────
function CalDay({ d, selected, dot, onSelect }) {
  const sel = d.iso === selected;
  return (
    <button onClick={() => { sfx("click"); onSelect(d.iso); }} style={{
      display:"flex",flexDirection:"column",alignItems:"center",
      padding:"9px 0",minWidth:44,borderRadius:16,border:"none",cursor:"pointer",
      background:sel?"#F4C430":"rgba(255,255,255,.04)",
      boxShadow:sel?"0 8px 20px rgba(244,196,48,.28)":"none",
      transition:"all .22s cubic-bezier(.34,1.56,.64,1)",
    }}>
      <span style={{fontSize:9,fontWeight:700,color:sel?"#000":"rgba(255,255,255,.28)",textTransform:"uppercase",marginBottom:4,letterSpacing:.5}}>{d.name}</span>
      <span style={{fontSize:18,fontWeight:900,fontFamily:SERIF,color:sel?"#000":"#F8F9FF"}}>{d.num}</span>
      <div style={{marginTop:5,width:5,height:5,borderRadius:"50%",
        background:dot===null?(sel?"rgba(0,0,0,.18)":"rgba(255,255,255,.07)"):
                   sel?"rgba(0,0,0,.35)":
                   dot===100?"#30D158":dot>50?"#FFD60A":"#FF9500",
      }}/>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => { injectGlobal(); }, []);

  const [tab,       setTab]       = useState("today");
  const [date,      setDate]      = useState(todayISO);
  const [showCfg,   setShowCfg]   = useState(false);
  const [session,   setSession]   = useState(null);
  const [notifPerm, setNotifPerm] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [focusTask, setFocusTask] = useState(null);
  const [activeBd,  setActiveBd]  = useState(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [tasks,     setTasks]     = useState(() => migrateTasks(load(KEY.tasks,  [])));
  const [recurring, setRecurring] = useState(() => load(KEY.rec,    []));
  const [habits,    setHabits]    = useState(() => load(KEY.habits,  []));
  const [boards,    setBoards]    = useState(() => load(KEY.boards,  []));

  const cal = useMemo(() => calDays(), []);

  // ── Debounced saves (avoid hammering localStorage on every keystroke) ───────
  useEffect(() => { const t=setTimeout(()=>save(KEY.tasks,tasks),350); return()=>clearTimeout(t); }, [tasks]);
  useEffect(() => { const t=setTimeout(()=>save(KEY.rec,recurring),350); return()=>clearTimeout(t); }, [recurring]);
  useEffect(() => { save(KEY.habits,habits); }, [habits]);
  useEffect(() => { save(KEY.boards,boards); }, [boards]);

  // ── Tasks for selected date (memoized, performance-optimised) ──────────────
  const allTasksForDate = useMemo(() => {
    // Only scan once tasks - filter by exact date match
    const reg = tasks.filter(t => t.date === date).map(t => ({...t, type:"once"}));

    const rec = recurring.filter(rt => rt.active && recurApplies(rt.recurrence, date)).map(rt => ({
      id:rt.id, type:"recurring", title:rt.title, date,
      time_start:rt.time_start||null, time_end:rt.time_end||null,
      category:rt.category||null, notes:rt.notes||"",
      priority:rt.priority||3,
      status:(rt.completions||{})[date]==="done"?"done":"pending",
    }));

    return [...reg,...rec].sort((a,b) => {
      // Sort by priority first (among same time bucket), then time
      if (!a.time_start&&!b.time_start) return (a.priority||3)-(b.priority||3);
      if (!a.time_start) return 1;
      if (!b.time_start) return -1;
      return a.time_start.localeCompare(b.time_start);
    });
  }, [tasks, recurring, date]);

  // ── Calendar dots (limited to 7 days visible) ─────────────────────────────
  const calDots = useMemo(() => {
    const m = {};
    cal.forEach(d => {
      const reg   = tasks.filter(t => t.date === d.iso);
      const rec   = recurring.filter(rt => rt.active && recurApplies(rt.recurrence, d.iso));
      const total = reg.length + rec.length;
      if (!total) { m[d.iso] = null; return; }
      const done = reg.filter(t=>t.status==="done").length
                 + rec.filter(rt=>(rt.completions||{})[d.iso]==="done").length;
      m[d.iso] = Math.round((done/total)*100);
    });
    return m;
  }, [tasks, recurring, cal]);

  // ── Notification scheduling ────────────────────────────────────────────────
  const notifTimers = useRef([]);
  useEffect(() => {
    if (notifPerm !== "granted" || date !== todayISO()) return;
    notifTimers.current.forEach(clearTimeout);
    notifTimers.current = [];
    allTasksForDate.filter(t => t.time_start && t.status !== "done").forEach(t => {
      const [h, mi] = t.time_start.split(":").map(Number);
      const alertAt = new Date(); alertAt.setHours(h, mi-10, 0, 0);
      const delay = alertAt.getTime() - Date.now();
      if (delay > 0) {
        notifTimers.current.push(setTimeout(() =>
          fireNotif(`⏰ En 10 min: ${t.title}`, `Empieza a las ${t.time_start}`, "pf_"+t.id), delay
        ));
      }
    });
    return () => notifTimers.current.forEach(clearTimeout);
  }, [allTasksForDate, notifPerm, date]);

  // ── Task actions ──────────────────────────────────────────────────────────
  const toggleTask = useCallback((id, type, taskDate) => {
    if (type === "recurring") {
      setRecurring(p => p.map(rt => {
        if (rt.id !== id) return rt;
        const cur = (rt.completions||{})[taskDate];
        if (!cur || cur !== "done") sfx("done"); else sfx("click");
        return {...rt, completions:{...(rt.completions||{}),[taskDate]:cur==="done"?null:"done"}};
      }));
    } else {
      setTasks(p => p.map(t => {
        if (t.id !== id) return t;
        if (t.status !== "done") sfx("done"); else sfx("click");
        return {...t, status:t.status==="done"?"pending":"done"};
      }));
    }
  }, []);

  const deleteTask = useCallback((id, type) => {
    sfx("click");
    if (type === "recurring") setRecurring(p=>p.filter(rt=>rt.id!==id));
    else setTasks(p=>p.filter(t=>t.id!==id));
  }, []);

  // ── Snooze: push task to tomorrow ────────────────────────────────────────
  const snoozeTask = useCallback(id => {
    sfx("click");
    setTasks(p => p.map(t => {
      if (t.id !== id) return t;
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
      return {...t, date:toISO(tomorrow), snoozedFrom:t.date||todayISO(), status:"pending"};
    }));
    fireNotif("⏰ Tarea pospuesta", "Movida a mañana.", "snooze");
  }, []);

  // ── Save new task (CON SINCRONIZACIÓN A SUPABASE) ─────────────────────────
  const saveTask = useCallback(async ({ title, timeStart, timeEnd, category, notes, priority, mode, rType, rDays, notified_start, notified_half, notified_end, subscription }) => {
    sfx("click");
    if (mode === "recurring") {
      setRecurring(p => [...p, {
        id:uid(), title, active:true,
        time_start:timeStart||null, time_end:timeEnd||null,
        category:category||null, notes:notes||"",
        priority:priority||3,
        recurrence:{ type:rType, days:rDays.map(Number) },
        completions:{},
      }]);
    } else {
      // 1. Armamos la tarea
      const newTask = {
        id:uid(), title, date, status:"pending",
        time_start:timeStart||null, time_end:timeEnd||null,
        category:category||null, notes:notes||"",
        priority:priority||3,
        notified_start: notified_start || false,
        notified_half: notified_half || false,
        notified_end: notified_end || false,
        subscription: subscription || null
      };

      // 2. Guardamos localmente
      setTasks(p => [...p, newTask]);

      // 3. Subimos a Supabase en segundo plano
      if (newTask.time_start && newTask.time_end) {
        // ⚡ FIX: Convertimos tu hora local a formato global (UTC) para Supabase
        const startUtc = new Date(`${newTask.date}T${newTask.time_start}:00`).toISOString();
        const endUtc = new Date(`${newTask.date}T${newTask.time_end}:00`).toISOString();

        const { error } = await supabase.from('tasks').insert([{
          id: newTask.id,
          title: newTask.title,
          start_time: startUtc,
          end_time: endUtc,
          notified_start: newTask.notified_start,
          notified_half: newTask.notified_half,
          notified_end: newTask.notified_end,
          subscription: newTask.subscription
        }]);
        
        if (error) console.error("Error sincronizando con la nube:", error);
      }
    } // 👈 ¡Esta era la llave fugitiva!
    setTab("today");
  }, [date]);

  // ── Reorder no-time tasks ─────────────────────────────────────────────────
  const reorderTasks = useCallback(orderedIds => {
    setTasks(prev => {
      const other   = prev.filter(t => t.date !== date);
      const timed   = prev.filter(t => t.date === date && t.time_start);
      const noTime  = prev.filter(t => t.date === date && !t.time_start);
      const reordered = orderedIds.map(id => noTime.find(t=>t.id===id)).filter(Boolean);
      return [...other, ...timed, ...reordered];
    });
  }, [date]);

  // ── Habits ────────────────────────────────────────────────────────────────
  const resetHabit = useCallback(id => {
    sfx("click");
    setHabits(p=>p.map(h=>h.id===id?{...h,lastResetDate:Date.now(),pausedMs:0,frozen:false,frozenAt:null}:h));
  }, []);

  const togglePauseHabit = useCallback(id => {
    setHabits(p=>p.map(h=>{
      if(h.id!==id) return h;
      if(h.frozen) return {...h,frozen:false,frozenAt:null,pausedMs:(h.pausedMs||0)+(Date.now()-(h.frozenAt||Date.now()))};
      return {...h,frozen:true,frozenAt:Date.now()};
    }));
  }, []);

  // ── Vision Boards ─────────────────────────────────────────────────────────
  const createBoard = useCallback(() => {
    sfx("click");
    const nb = { id:uid(), title:"Nueva visión", emoji:BOARD_EMOJIS[boards.length%BOARD_EMOJIS.length], color:BOARD_COLORS[boards.length%BOARD_COLORS.length], description:"", action:"", milestones:[] };
    setBoards(p=>[...p,nb]); setActiveBd(nb.id);
  }, [boards.length]);

  const updateBoard   = useCallback(b=>setBoards(p=>p.map(x=>x.id===b.id?b:x)),[]);
  const deleteBoard   = useCallback(id=>{sfx("click");setBoards(p=>p.filter(b=>b.id!==id));setActiveBd(null);},[]);

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = useCallback(data => {
    if(data.tasks)     setTasks(migrateTasks(data.tasks));
    if(data.recurring) setRecurring(data.recurring);
    if(data.habits)    setHabits(data.habits);
    if(data.boards)    setBoards(data.boards);
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin  = async () => { throw new Error("Configura Supabase en helpers.js para activar."); };
  const handleLogout = () => setSession(null);

  const activeBoard = activeBd ? boards.find(b=>b.id===activeBd)||null : null;

  // ── Tab bar config ────────────────────────────────────────────────────────
  const TABS = [
    { k:"today",   icon:"📅", l:"Hoy"     },
    { k:"add",     icon:"✦",  l:"Añadir"  },
    { k:"goals",   icon:"🎯", l:"Metas"   },
    { k:"journal", icon:"📔", l:"Diario"  },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:FONT,background:"#080B14",minHeight:"100vh",color:"#F8F9FF",maxWidth:480,margin:"0 auto",position:"relative",overflowX:"hidden"}}>
      <Orbs/>

      {focusTask  && <FocusMode task={focusTask} onClose={()=>setFocusTask(null)}/>}
      {showCfg    && <Settings onClose={()=>setShowCfg(false)} session={session} onLogin={handleLogin} onLogout={handleLogout} notifPerm={notifPerm} setNotifPerm={setNotifPerm} onImport={handleImport}/>}
      {activeBoard && <BoardDetail board={activeBoard} onChange={updateBoard} onClose={()=>setActiveBd(null)} onDelete={()=>deleteBoard(activeBoard.id)}/>}

      {/* ── Header ── */}
      <div style={{padding:"48px 20px 13px",position:"sticky",top:0,zIndex:50,background:"rgba(8,11,20,.92)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:28,fontWeight:900,fontFamily:SERIF,letterSpacing:"-.5px"}}>Focus.</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {notifPerm==="granted"&&<div className="pulse" style={{width:7,height:7,borderRadius:"50%",background:"#FF6B35",boxShadow:"0 0 8px rgba(255,107,53,.6)"}}/>}
            {session&&<div style={{width:7,height:7,borderRadius:"50%",background:"#30D158",boxShadow:"0 0 8px rgba(48,209,88,.55)"}}/>}
            <button onClick={()=>setShowCfg(true)} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:"50%",width:36,height:36,cursor:"pointer",color:"rgba(255,255,255,.45)",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>⚙</button>
          </div>
        </div>
      </div>

      {/* ── Content (SAME padding for ALL tabs — matches Today) ── */}
      <div style={{padding:"18px 18px 110px"}}>

        {/* ════ HOY ════ */}
        {tab==="today"&&(
          <div className="fi">
            <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:4}}>
              {cal.map(d=>(
                <CalDay key={d.iso} d={d} selected={date} dot={calDots[d.iso]??null} onSelect={setDate}/>
              ))}
            </div>
            <StatsBar all={allTasksForDate}/>
            {allTasksForDate.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div className="float" style={{fontSize:50,marginBottom:16}}>🌙</div>
                <div style={{fontSize:18,fontWeight:800,fontFamily:SERIF,color:"rgba(255,255,255,.4)"}}>Día despejado</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.2)",marginTop:8}}>Añade tareas o disfruta el descanso</div>
              </div>
            ):(
              <Timeline allTasks={allTasksForDate} date={date} onToggle={toggleTask} onDelete={deleteTask} onFocus={t=>setFocusTask(t)} onSnooze={snoozeTask} onReorder={reorderTasks}/>
            )}
          </div>
        )}

        {/* ════ AÑADIR ════ */}
        {tab==="add"&&(
          <div className="fi">
            <AddForm onSave={saveTask} selectedDate={date}/>
          </div>
        )}

        {/* ════ METAS ════ */}
        {tab==="goals"&&(
          <div className="fi">
            <Heatmap tasks={tasks} recurring={recurring}/>

            {/* Vision Boards */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5}}>🎯 Vision Boards</div>
                {boards.length>0&&<div style={{fontSize:12,color:"rgba(255,255,255,.22)",marginTop:3}}>{boards.length} meta{boards.length!==1?"s":""} activa{boards.length!==1?"s":""}</div>}
              </div>
              <button onClick={createBoard} style={{padding:"8px 16px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.6)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>+ Nueva visión</button>
            </div>
            {boards.length===0?(
              <div onClick={createBoard} className="tap" style={{textAlign:"center",padding:"44px 20px",marginBottom:28,cursor:"pointer",background:"rgba(123,104,238,.06)",border:"1px dashed rgba(123,104,238,.25)",borderRadius:22}}>
                <div className="float" style={{fontSize:44,marginBottom:14}}>🎯</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:SERIF,color:"rgba(255,255,255,.45)"}}>Define tu primera visión</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.22)",marginTop:6}}>Toca para crear tu primer vision board</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
                {boards.map(b=><BoardCard key={b.id} board={b} onClick={()=>{sfx("click");setActiveBd(b.id);}}/>)}
              </div>
            )}

            <div style={{height:1,background:"rgba(255,255,255,.06)",marginBottom:28}}/>

            {/* Active routines */}
            {recurring.filter(r=>r.active).length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>↻ Rutinas activas</div>
                {recurring.filter(r=>r.active).map(r=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 15px",borderRadius:15,marginBottom:8,background:"rgba(123,104,238,.07)",border:"1px solid rgba(123,104,238,.14)"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#F8F9FF"}}>{r.title}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.33)",marginTop:2,fontWeight:600}}>
                        {recurLabel(r.recurrence)}{r.time_start?`  ·  ${r.time_start}${r.time_end?` → ${r.time_end}`:""}`:""}
                      </div>
                    </div>
                    <button onClick={()=>{sfx("click");setRecurring(p=>p.map(x=>x.id===r.id?{...x,active:false}:x));}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.18)",fontSize:16,padding:"4px 8px",lineHeight:1,flexShrink:0}}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Habits */}
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>🔥 Hábitos a superar</div>
            {habits.length===0&&(
              <div style={{textAlign:"center",padding:"32px 20px",color:"rgba(255,255,255,.18)",marginBottom:20}}>
                <div className="float" style={{fontSize:40,marginBottom:10}}>🚫</div>
                <div style={{fontWeight:700,fontSize:14}}>Agrega hábitos que quieras eliminar</div>
              </div>
            )}
            {habits.map(h=>(
              <HabitCard key={h.id} habit={h} onReset={resetHabit} onDelete={id=>setHabits(p=>p.filter(x=>x.id!==id))} onTogglePause={togglePauseHabit}/>
            ))}
            <form onSubmit={e=>{
              e.preventDefault();
              const v=e.target.h.value.trim(); if(!v) return;
              setHabits(p=>[...p,{id:uid(),name:v,lastResetDate:Date.now(),pausedMs:0,frozen:false}]);
              e.target.h.value=""; sfx("done");
            }} style={{display:"flex",gap:10,marginTop:8}}>
              <input name="h" type="text" placeholder="Ej: Fumar, azúcar, redes..." style={{flex:1,padding:"11px 14px",borderRadius:13,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",color:"#F8F9FF",fontSize:14,fontWeight:600,fontFamily:FONT,outline:"none"}}/>
              <button type="submit" style={{padding:"0 20px",borderRadius:13,border:"none",background:"#F8F9FF",color:"#080B14",fontWeight:800,fontSize:18,cursor:"pointer",fontFamily:FONT}}>+</button>
            </form>
          </div>
        )}

        {/* ════ DIARIO ════ */}
        {tab==="journal"&&(
          <Journal date={date} setDate={setDate}/>
        )}

      </div>

      {/* ── Tab Bar ── */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(8,11,20,.96)",backdropFilter:"blur(28px)",borderTop:"1px solid rgba(255,255,255,.05)",display:"flex",padding:"8px 10px calc(env(safe-area-inset-bottom,0px) + 8px)",zIndex:60}}>
        {TABS.map(({k,icon,l})=>(
          <button key={k} onClick={()=>{sfx("click");setTab(k);}} style={{flex:1,padding:"9px 4px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{fontSize:20,opacity:tab===k?1:.25,transform:tab===k?"scale(1.15)":"scale(1)",transition:"all .22s cubic-bezier(.34,1.56,.64,1)"}}>{icon}</div>
            <div style={{fontSize:9,fontWeight:700,fontFamily:FONT,letterSpacing:.4,color:tab===k?"#F4C430":"rgba(255,255,255,.26)"}}>{l.toUpperCase()}</div>
          </button>
        ))}
      </div>
    </div>
  );
}