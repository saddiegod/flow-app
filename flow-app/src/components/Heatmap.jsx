import { useMemo } from "react";
import { SERIF, FONT } from "../utils/constants.js";
import { toISO, fromISO, recurApplies } from "../utils/dates.js";

const DAYS_SH = ["D","L","M","X","J","V","S"];

function cellColor(pct, hasData) {
  if (!hasData) return "rgba(255,255,255,.04)";
  if (pct === 0)    return "rgba(255,59,48,.25)";
  if (pct < 50)     return "rgba(255,150,0,.35)";
  if (pct < 100)    return "rgba(255,214,10,.4)";
  return "rgba(48,209,88,.55)";
}

export default function Heatmap({ tasks, recurring }) {
  // Build last 35 days (5 weeks), aligned to start on Sunday
  const cells = useMemo(() => {
    const today = new Date();
    // How many days back to fill a full grid (start on Sunday)
    const dow   = today.getDay(); // 0=Sun
    // Go back enough to have 35 cells ending today
    const start = new Date(today);
    start.setDate(today.getDate() - 34);

    return Array.from({ length: 35 }, (_, i) => {
      const d   = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISO(d);

      // Count tasks for this day
      const reg = tasks.filter(t => t.date === iso);
      const rec = recurring.filter(rt => rt.active && recurApplies(rt.recurrence, iso));
      const total = reg.length + rec.length;
      const done  = reg.filter(t=>t.status==="done").length
                  + rec.filter(rt=>(rt.completions||{})[iso]==="done").length;

      return {
        iso, day:d.getDate(), dow:d.getDay(),
        total, done,
        pct: total ? Math.round((done/total)*100) : 0,
        hasData: total > 0,
        isToday: iso === toISO(today),
        isFuture: d > today,
      };
    });
  }, [tasks, recurring]);

  // Group into weeks (columns of 7)
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i+7));
    return w;
  }, [cells]);

  // Stats summary
  const stats = useMemo(() => {
    const past = cells.filter(c => !c.isFuture && c.hasData);
    const perfect = past.filter(c => c.pct === 100).length;
    const streak  = (() => {
      let s = 0;
      for (let i = cells.length-1; i >= 0; i--) {
        const c = cells[i];
        if (c.isFuture) continue;
        if (c.hasData && c.pct === 100) s++;
        else break;
      }
      return s;
    })();
    return { perfect, streak, total:past.length };
  }, [cells]);

  return (
    <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:22,padding:22,marginBottom:24 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:800,color:"#F8F9FF",marginBottom:3 }}>📅 Últimas 5 semanas</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.3)",fontWeight:600 }}>
            {stats.perfect} días perfectos{stats.streak>1?` · 🔥 Racha: ${stats.streak}d`:""}
          </div>
        </div>
        {/* Legend */}
        <div style={{ display:"flex",gap:4,alignItems:"center" }}>
          {["rgba(255,255,255,.04)","rgba(255,150,0,.35)","rgba(255,214,10,.4)","rgba(48,209,88,.55)"].map((c,i)=>(
            <div key={i} style={{ width:11,height:11,borderRadius:3,background:c }}/>
          ))}
        </div>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display:"flex",gap:4,marginBottom:4 }}>
        {DAYS_SH.map(d=>(
          <div key={d} style={{ flex:1,textAlign:"center",fontSize:9,fontWeight:700,color:"rgba(255,255,255,.2)" }}>{d}</div>
        ))}
      </div>

      {/* Grid: each row is a week */}
      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{ display:"flex",gap:4 }}>
            {week.map((c,di)=>(
              <div
                key={c.iso}
                title={c.hasData ? `${c.done}/${c.total} tareas (${c.pct}%)` : c.isFuture ? "" : "Sin tareas"}
                style={{
                  flex:1,
                  aspectRatio:"1",
                  borderRadius:4,
                  background: c.isFuture ? "rgba(255,255,255,.02)" : cellColor(c.pct, c.hasData),
                  border: c.isToday ? "1.5px solid #F4C430" : "1px solid rgba(255,255,255,.04)",
                  transition:"transform .15s",
                  cursor:"default",
                  position:"relative",
                }}
              >
                {c.isToday && (
                  <div style={{ position:"absolute",inset:0,borderRadius:3,background:"rgba(244,196,48,.12)" }}/>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div style={{ marginTop:12,fontSize:10,color:"rgba(255,255,255,.2)",fontWeight:600,textAlign:"center" }}>
        {(() => {
          const f = fromISO(cells[0].iso);
          const l = fromISO(cells[34].iso);
          const fmt = d => d.toLocaleDateString("es-MX",{month:"short"});
          return f.getMonth()===l.getMonth() ? fmt(f) : `${fmt(f)} – ${fmt(l)}`;
        })()}
      </div>
    </div>
  );
}
