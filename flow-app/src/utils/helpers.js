// ─── Audio ────────────────────────────────────────────────────────────────────
let _ac = null;
export function sfx(type) {
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
    } else if (type === "pomodoro") {
      // Three descending tones
      [0, .15, .30].forEach((d, i) => {
        const oo = _ac.createOscillator(), gg = _ac.createGain();
        oo.connect(gg); gg.connect(_ac.destination);
        oo.type = "sine";
        oo.frequency.setValueAtTime([880,660,440][i], t+d);
        gg.gain.setValueAtTime(.06, t+d); gg.gain.linearRampToValueAtTime(0, t+d+.15);
        oo.start(t+d); oo.stop(t+d+.15);
      });
      return;
    } else {
      o.type = "sine"; o.frequency.setValueAtTime(540,t);
      g.gain.setValueAtTime(.018,t); g.gain.exponentialRampToValueAtTime(.001,t+.05);
      o.start(t); o.stop(t+.05);
    }
  } catch {}
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const NS = "pf4_";

export function load(k, def) {
  try { return JSON.parse(localStorage.getItem(NS+k) ?? "null") ?? def; }
  catch { return def; }
}

export function save(k, v) {
  try { localStorage.setItem(NS+k, JSON.stringify(v)); } catch {}
}

// Export all app data as a JSON blob download
export function exportBackup() {
  const keys = ["tasks","recurring","habits","boards"];
  const data  = { version:4, exportedAt: new Date().toISOString() };
  keys.forEach(k => { data[k] = load(k, []); });
  data.boards = load("boards", []);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `focus_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Import from a JSON File object; returns parsed data or throws
export async function importBackup(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (!d.tasks && !d.recurring) throw new Error("Formato inválido");
        res(d);
      } catch(err) { rej(err); }
    };
    r.onerror = () => rej(new Error("Error leyendo archivo"));
    r.readAsText(file);
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────
const SW_CODE = `
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
  if(e.data?.type!=='SCHEDULE')return;
  const{id,title,body,delay}=e.data;
  setTimeout(()=>{
    self.registration.showNotification(title,{
      body,icon:'/icon-192.png',badge:'/badge.png',
      tag:id,renotify:true,data:{url:self.location.origin},
    });
  },Math.max(0,delay));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url||'/'));
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

export async function requestNotifPerm() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const r = await Notification.requestPermission();
  return r;
}

export function fireNotif(title, body, tag = "pf") {
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag, icon:"/icon-192.png" }); } catch {}
}

export async function scheduleNotif(id, title, body, delayMs) {
  if (Notification.permission !== "granted" || delayMs < 0) return;
  const sw = await getSW();
  if (sw?.active) {
    sw.active.postMessage({ type:"SCHEDULE", id, title, body, delay:delayMs });
  } else {
    setTimeout(() => fireNotif(title, body, id), delayMs);
  }
}
