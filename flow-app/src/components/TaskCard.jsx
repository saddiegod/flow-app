import { useState, useRef, useCallback } from "react";
import { CATS, FONT, SERIF } from "../constants.js";
import { durLabel, catOf } from "../utils/dates.js";
import { sfx } from "../utils/helpers.js";
import { Confetti } from "./shared.jsx";

// ─── Swipe thresholds ─────────────────────────────────────────────────────────
const SWIPE_DELETE  = -78; // left  → delete
const SWIPE_CONFIRM = -48; // shows red bg
const SNAP_BACK     = 18;  // px movement required to track

export default function TaskCard({ task, onToggle, onDelete, onFocus, dragHandleProps }) {
  const done   = task.status === "done";
  const cat    = catOf(task.id, CATS) ?? CATS.find(c => c.id === task.category);
  const catObj = CATS.find(c => c.id === task.category);
  const dur    = durLabel(task.time_start, task.time_end);

  const [pop,    setPop]    = useState(false);
  const [offset, setOffset] = useState(0);
  const [locked, setLocked] = useState(false); // true when fully swiped to delete
  const startX = useRef(0);
  const startY = useRef(0);
  const axis   = useRef(null); // "h" | "v" | null

  // ── Touch swipe ─────────────────────────────────────────────────────────────
  const onTouchStart = e => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current   = null;
  };

  const onTouchMove = e => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Determine axis on first significant move
    if (!axis.current && (Math.abs(dx) > SNAP_BACK || Math.abs(dy) > SNAP_BACK)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }

    if (axis.current === "h") {
      e.preventDefault(); // prevent scroll on horizontal swipe
      setOffset(Math.max(Math.min(dx, 0), -120));
    }
  };

  const onTouchEnd = () => {
    if (axis.current === "h") {
      if (offset <= SWIPE_DELETE) {
        sfx("click");
        onDelete(task.id, task.type);
        setOffset(0);
      } else {
        setOffset(0);
      }
    }
    axis.current = null;
  };

  // ── Tap to toggle ────────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (Math.abs(offset) > 10) return; // was a swipe, not a tap
    if (!done) { setPop(true); setTimeout(()=>setPop(false), 700); sfx("done"); }
    else sfx("click");
    onToggle(task.id, task.type, task.date);
  }, [offset, done, task.id, task.type, task.date, onToggle]);

  const showRed = offset <= SWIPE_CONFIRM;

  return (
    <div style={{ position:"relative", marginBottom:8, borderRadius:16, overflow:"hidden" }}>
      {/* Delete hint behind card */}
      <div style={{
        position:"absolute", right:0, top:0, bottom:0, width:80,
        background:"#FF3B30", display:"flex", alignItems:"center", justifyContent:"center",
        borderRadius:"0 16px 16px 0", fontSize:20,
        opacity: showRed ? 1 : 0, transition:"opacity .15s",
      }}>🗑</div>

      {/* Card body — slides left on swipe */}
      <div
        className="tap"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
        style={{
          position:"relative", overflow:"hidden",
          display:"flex", alignItems:"center", gap:12,
          padding:"13px 14px", borderRadius:16, cursor:"pointer",
          background: done ? "rgba(255,255,255,.022)" : "rgba(255,255,255,.057)",
          borderLeft: catObj && !done ? `3px solid ${catObj.color}` : undefined,
          border: done ? "1px solid rgba(255,255,255,.035)" : catObj ? undefined : "1px solid rgba(255,255,255,.08)",
          transform: `translateX(${offset}px)`,
          transition: axis.current === "h" ? "none" : "transform .3s cubic-bezier(.16,1,.3,1)",
          willChange: "transform",
        }}
      >
        <Confetti on={pop}/>
        {pop && (
          <div style={{ position:"absolute",left:26,top:"50%",width:22,height:22,borderRadius:"50%",border:"2px solid rgba(255,255,255,.5)",animation:"ring .65s ease-out forwards",pointerEvents:"none" }}/>
        )}

        {/* Drag handle (no-time tasks only) */}
        {dragHandleProps && (
          <div {...dragHandleProps} style={{ color:"rgba(255,255,255,.15)", fontSize:14, cursor:"grab", touchAction:"none", flexShrink:0, padding:"0 2px" }} onClick={e=>e.stopPropagation()}>
            ⠿
          </div>
        )}

        {/* Checkbox */}
        <div style={{
          width:24, height:24, borderRadius:"50%", flexShrink:0,
          border: done ? "none" : "2px solid rgba(255,255,255,.16)",
          background: done ? "#30D158" : "transparent",
          display:"flex", alignItems:"center", justifyContent:"center",
          animation: done ? "cg .55s ease" : "none",
          boxShadow: done ? "0 0 14px rgba(48,209,88,.38)" : "none",
          transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
        }}>
          {done && <span style={{ color:"#FFF",fontSize:12,fontWeight:800,animation:"pop .28s cubic-bezier(.34,1.56,.64,1)" }}>✓</span>}
        </div>

        {/* Content */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize:15, fontWeight:700,
            color: done ? "rgba(255,255,255,.26)" : "#F8F9FF",
            textDecoration: done ? "line-through" : "none",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            transition:"color .3s",
          }}>{task.title}</div>
          {!done && (task.time_start || task.notes) && (
            <div style={{ fontSize:11,color:"rgba(255,255,255,.33)",marginTop:2,fontWeight:600,display:"flex",gap:6,overflow:"hidden" }}>
              {task.time_start && (
                <span>🕐 {task.time_start}{task.time_end?` → ${task.time_end}`:""}{dur?` · ${dur}`:""}</span>
              )}
              {task.notes && !task.time_start && (
                <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{task.notes}</span>
              )}
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {task.type === "recurring" && !done && (
            <span style={{ fontSize:9,color:"rgba(255,255,255,.28)",background:"rgba(255,255,255,.07)",borderRadius:5,padding:"2px 7px",fontWeight:700 }}>↻</span>
          )}
          {/* Focus launcher */}
          {!done && onFocus && (
            <button
              onClick={e=>{ e.stopPropagation(); onFocus(task); }}
              style={{ background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.22)",fontSize:14,padding:"1px 3px",lineHeight:1 }}
              title="Modo Focus"
            >▶</button>
          )}
        </div>
      </div>
    </div>
  );
}
