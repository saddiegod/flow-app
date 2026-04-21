import { useMemo, useRef, useState } from "react";
import { HOURS, SERIF } from "../utils/constants.js";
import { todayISO } from "../utils/dates.js";
import { sfx } from "../utils/helpers.js";
import TaskCard from "./TaskCard.jsx";

export default function Timeline({ allTasks, date, onToggle, onDelete, onFocus, onReorder }) {
  const isToday = date === todayISO();
  const ch      = new Date().getHours();

  // ── Split timed vs no-time ─────────────────────────────────────────────────
  const { byHour, noTime } = useMemo(() => {
    const m = {};
    const nt = [];
    allTasks.forEach(t => {
      if (t.time_start) {
        const h = parseInt(t.time_start);
        (m[h] = m[h] || []).push(t);
      } else {
        nt.push(t);
      }
    });
    return { byHour:m, noTime:nt };
  }, [allTasks]);

  // ── Drag state (no-time tasks) ─────────────────────────────────────────────
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const handleDragStart = i => { dragIdx.current = i; };
  const handleDragEnter = i => setDragOver(i);
  const handleDragEnd   = () => {
    if (dragIdx.current !== null && dragOver !== null && dragIdx.current !== dragOver) {
      const arr = [...noTime];
      const [removed] = arr.splice(dragIdx.current, 1);
      arr.splice(dragOver, 0, removed);
      onReorder(arr.map(t => t.id));
      sfx("click");
    }
    dragIdx.current = null;
    setDragOver(null);
  };

  return (
    <div>
      {/* ── No-time tasks (draggable) ── */}
      {noTime.length > 0 && (
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.2)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10 }}>Sin hora — mantén para reordenar</div>
          {noTime.map((t, i) => (
            <div
              key={t.id+t.date}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{
                opacity: dragOver === i && dragIdx.current !== i ? .5 : 1,
                transform: dragOver === i && dragIdx.current !== i ? "scale(1.02)" : "none",
                transition: "opacity .15s, transform .15s",
              }}
            >
              <TaskCard
                task={t}
                onToggle={onToggle}
                onDelete={onDelete}
                onFocus={onFocus}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: (e) => { e.stopPropagation(); handleDragStart(i); },
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Hourly timeline ── */}
      {HOURS.map(h => {
        const ts    = byHour[h] || [];
        const isCur = isToday && h === ch;
        const isPast = isToday && h < ch && !ts.length;

        return (
          <div key={h} style={{ display:"flex",gap:14,marginBottom:ts.length?10:1,opacity:isPast?.13:1,transition:"opacity .4s" }}>
            <div style={{
              width:34, flexShrink:0, paddingTop:2, textAlign:"right",
              fontSize:11, fontWeight:700, fontFamily:SERIF,
              color: isCur ? "#F4C430" : "rgba(255,255,255,.15)",
              transition:"color .3s",
            }}>
              {String(h).padStart(2,"0")}
            </div>
            <div style={{ flex:1,borderLeft:`1px solid ${isCur?"rgba(244,196,48,.4)":"rgba(255,255,255,.05)"}`,paddingLeft:14,minHeight:20,position:"relative" }}>
              {isCur && (
                <div style={{ position:"absolute",left:-5,top:2,width:8,height:8,borderRadius:"50%",background:"#F4C430",boxShadow:"0 0 10px rgba(244,196,48,.8)" }} className="pulse"/>
              )}
              {ts.map(t => (
                <TaskCard key={t.id+t.date} task={t} onToggle={onToggle} onDelete={onDelete} onFocus={onFocus}/>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
