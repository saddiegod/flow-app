import { useState, useRef, useCallback, memo } from "react";
import { CATS, PRIORITIES, FONT, SERIF } from "../utils/constants.js";
import { durLabel } from "../utils/dates.js";
import { sfx } from "../utils/helpers.js";
import { Confetti } from "./shared.jsx";

const SWIPE_DELETE  = -78;
const SWIPE_SNOOZE  =  72; // right → snooze (swipe right)
const SWIPE_CONFIRM = -48;
const SNAP_BACK     = 18;

const TaskCard = memo(function TaskCard({ task, onToggle, onDelete, onFocus, onSnooze, dragHandleProps }) {
  const done   = task.status === "done";
  const catObj = CATS.find(c => c.id === task.category);
  const prObj  = PRIORITIES.find(p => p.id === task.priority);
  const dur    = durLabel(task.time_start, task.time_end);

  const [pop,    setPop]    = useState(false);
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis   = useRef(null);

  const onTouchStart = e => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
  };

  const onTouchMove = e => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!axis.current && (Math.abs(dx) > SNAP_BACK || Math.abs(dy) > SNAP_BACK)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (axis.current === "h") {
      e.preventDefault();
      setOffset(Math.max(Math.min(dx, 100), -120));
    }
  };

  const onTouchEnd = () => {
    if (axis.current === "h") {
      if (offset <= SWIPE_DELETE) {
        sfx("click"); onDelete(task.id, task.type); setOffset(0);
      } else if (offset >= SWIPE_SNOOZE && onSnooze && task.type !== "recurring") {
        sfx("click"); onSnooze(task.id); setOffset(0);
      } else {
        setOffset(0);
      }
    }
    axis.current = null;
  };

  const handleTap = useCallback(() => {
    if (Math.abs(offset) > 10) return;
    if (!done) { setPop(true); setTimeout(()=>setPop(false), 700); sfx("done"); }
    else sfx("click");
    onToggle(task.id, task.type, task.date);
  }, [offset, done, task.id, task.type, task.date, onToggle]);

  const showRed   = offset <= SWIPE_CONFIRM;
  const showSnooze = offset >= 40;

  return (
    <div style={{ position:"relative", marginBottom:8, borderRadius:16, overflow:"hidden" }}>
      {/* Left hint: snooze */}
      {onSnooze && task.type !== "recurring" && (
        <div style={{
          position:"absolute",left:0,top:0,bottom:0,width:80,
          background:"#007AFF",display:"flex",alignItems:"center",justifyContent:"center",
          borderRadius:"16px 0 0 16px",fontSize:18,
          opacity:showSnooze?1:0,transition:"opacity .15s",
        }}>⏰</div>
      )}
      {/* Right hint: delete */}
      <div style={{
        position:"absolute",right:0,top:0,bottom:0,width:80,
        background:"#FF3B30",display:"flex",alignItems:"center",justifyContent:"center",
        borderRadius:"0 16px 16px 0",fontSize:18,
        opacity:showRed?1:0,transition:"opacity .15s",
      }}>🗑</div>

      {/* Card */}
      <div
        className="tap"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
        style={{
          position:"relative",overflow:"hidden",
          display:"flex",alignItems:"center",gap:12,
          padding:"13px 14px",borderRadius:16,cursor:"pointer",
          background:done?"rgba(255,255,255,.022)":"rgba(255,255,255,.057)",
          borderLeft:catObj&&!done?`3px solid ${catObj.color}`:undefined,
          border:done?"1px solid rgba(255,255,255,.035)":catObj?undefined:"1px solid rgba(255,255,255,.08)",
          transform:`translateX(${offset}px)`,
          transition:axis.current==="h"?"none":"transform .3s cubic-bezier(.16,1,.3,1)",
          willChange:"transform",
        }}
      >
        <Confetti on={pop}/>
        {pop&&<div style={{position:"absolute",left:26,top:"50%",width:22,height:22,borderRadius:"50%",border:"2px solid rgba(255,255,255,.5)",animation:"ring .65s ease-out forwards",pointerEvents:"none"}}/>}

        {dragHandleProps && (
          <div {...dragHandleProps} style={{color:"rgba(255,255,255,.15)",fontSize:14,cursor:"grab",touchAction:"none",flexShrink:0,padding:"0 2px"}} onClick={e=>e.stopPropagation()}>⠿</div>
        )}

        {/* Checkbox */}
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

        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{
            fontSize:15,fontWeight:700,
            color:done?"rgba(255,255,255,.26)":"#F8F9FF",
            textDecoration:done?"line-through":"none",
            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
            transition:"color .3s",display:"flex",alignItems:"center",gap:6,
          }}>
            {/* Priority flag (P1/P2 only shown when pending) */}
            {!done && prObj && prObj.id <= 2 && (
              <span style={{fontSize:10,flexShrink:0}}>{prObj.icon}</span>
            )}
            {task.title}
          </div>
          {!done && (task.time_start||task.notes||task.snoozedFrom) && (
            <div style={{fontSize:11,color:"rgba(255,255,255,.33)",marginTop:2,fontWeight:600,display:"flex",gap:6,overflow:"hidden",flexWrap:"wrap"}}>
              {task.snoozedFrom && <span style={{color:"#007AFF",fontSize:10}}>⏰ Pospuesta</span>}
              {task.time_start && <span>🕐 {task.time_start}{task.time_end?` → ${task.time_end}`:""}{dur?` · ${dur}`:""}</span>}
              {task.notes&&!task.time_start&&<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.notes}</span>}
            </div>
          )}
        </div>

        {/* Right badges */}
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {task.type==="recurring"&&!done&&(
            <span style={{fontSize:9,color:"rgba(255,255,255,.28)",background:"rgba(255,255,255,.07)",borderRadius:5,padding:"2px 7px",fontWeight:700}}>↻</span>
          )}
          {!done&&onFocus&&(
            <button onClick={e=>{e.stopPropagation();onFocus(task);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.22)",fontSize:14,padding:"1px 3px",lineHeight:1}} title="Modo Focus">▶</button>
          )}
        </div>
      </div>
    </div>
  );
});

export default TaskCard;