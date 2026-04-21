// ─── ISO date helpers ──────────────────────────────────────────────────────────
// Using "YYYY-MM-DD" internally is bulletproof across all browsers/OSes.
// The old locale-string format ("21 abr.") was the root cause of the recurring bug:
// toLocaleDateString output varies between Chrome/Safari/iOS/Android.

export const toISO = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayISO = () => toISO(new Date());

// Build a local Date from ISO without timezone shift
export const fromISO = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const getDOW = iso => fromISO(iso).getDay(); // 0=Sun … 6=Sat

export const displayDate = iso =>
  fromISO(iso).toLocaleDateString("es-MX", { day:"2-digit", month:"short" });

export const calDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 3);
    return {
      iso:  toISO(d),
      num:  d.getDate(),
      name: d.toLocaleDateString("es-MX", { weekday:"short" }).slice(0,2).toUpperCase(),
    };
  });

// ─── Recurring logic ───────────────────────────────────────────────────────────
export const recurApplies = (rec, iso) => {
  if (!rec || !iso) return false;
  const dow = getDOW(iso);
  if (rec.type === "daily")    return true;
  if (rec.type === "weekdays") return dow >= 1 && dow <= 5;
  if (rec.type === "weekends") return dow === 0 || dow === 6;
  if (rec.type === "custom") {
    // Guard against stored strings vs numbers
    const days = (rec.days || []).map(Number);
    return days.includes(dow);
  }
  return false;
};

export const recurLabel = rec => {
  const DS = ["D","L","M","X","J","V","S"];
  if (!rec) return "";
  if (rec.type === "daily")    return "Cada día";
  if (rec.type === "weekdays") return "Lun – Vie";
  if (rec.type === "weekends") return "Sáb – Dom";
  if (rec.type === "custom")
    return (rec.days||[]).map(Number).sort((a,b)=>a-b).map(i=>DS[i]).join(" · ");
  return "";
};

// ─── Duration ─────────────────────────────────────────────────────────────────
export const durLabel = (s, e) => {
  if (!s || !e) return null;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const t = (eh * 60 + em) - (sh * 60 + sm);
  if (t <= 0) return null;
  const h = Math.floor(t / 60), m = t % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// ─── Streak helpers ────────────────────────────────────────────────────────────
export const daysClean = (ts, pauseMs = 0) =>
  Math.floor((Date.now() - ts - pauseMs) / 86400000);

export const streakColor = d => {
  if (d === 0) return "#FF3B30";
  if (d < 3)   return "#FF9500";
  if (d < 7)   return "#FFD60A";
  if (d < 14)  return "#30D158";
  if (d < 30)  return "#007AFF";
  if (d < 60)  return "#AF52DE";
  return "#F4C430";
};

// ─── Misc ─────────────────────────────────────────────────────────────────────
export const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

export const catOf = (id, CATS) => CATS.find(c => c.id === id);

// ─── One-time migration: old "21 abr." format → ISO ───────────────────────────
const OLD_MON = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
export const migrateDate = ds => {
  if (!ds || ds.includes("-")) return ds; // already ISO
  try {
    const parts = ds.trim().toLowerCase().replace(/\./g,"").split(/\s+/);
    const day = parseInt(parts[0]);
    const mon = OLD_MON[parts[1]];
    if (isNaN(day) || mon === undefined) return ds;
    return toISO(new Date(new Date().getFullYear(), mon, day));
  } catch { return ds; }
};

export const migrateTasks = tasks =>
  tasks.map(t => t.date && !t.date.includes("-") ? { ...t, date: migrateDate(t.date) } : t);
