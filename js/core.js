/* ============================================================
   HIDECOR SiteLog Mobile — core
   Helpers, offline storage (IndexedDB), data model, photo pipeline.
   ============================================================ */
"use strict";

/* ---------------- helpers ---------------- */
const uid = (p) => (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const inr = (n) => { n = num(n); const s = Math.abs(r0(n)).toString(); let x = s.length > 3 ? s.slice(0, -3) : ""; const y = s.slice(-3); x = x.replace(/\B(?=(\d{2})+(?!\d))/g, ","); return (n < 0 ? "-" : "") + (x ? x + "," : "") + y; };
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const nowHM = () => new Date().toTimeString().slice(0, 5);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtD = (d) => { if (!d) return "—"; const p = String(d).slice(0, 10).split("-"); return p.length < 3 ? d : p[2] + "-" + MON[+p[1] - 1] + "-" + p[0]; };
const fmtShort = (d) => { if (!d) return "—"; const p = String(d).slice(0, 10).split("-"); return p[2] + " " + MON[+p[1] - 1]; };
const days = (a, b) => (!a || !b) ? 0 : Math.round((new Date(b) - new Date(a)) / 864e5);
const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const dow = (d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(d + "T00:00:00").getDay()];
const kb = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";

function csvCell(v) { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(rows) { return "﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"); }
function parseDelim(text) {
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const d = (t.match(/\t/g) || []).length >= (t.match(/,/g) || []).length ? "\t" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell);
  if (row.some(x => String(x).trim() !== "")) rows.push(row);
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}

/* ---------------- offline storage: IndexedDB ----------------
   store "kv"     — the project database (one JSON record)
   store "photos" — one record per photo { id, pid, date, blob, ... }
   IndexedDB is used rather than localStorage because a day of site
   photos runs to several MB, well past the 5 MB localStorage ceiling. */
const DB_NAME = "hidecor_sitelog";
const IDB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("photos")) {
          const s = db.createObjectStore("photos", { keyPath: "id" });
          s.createIndex("byDay", ["pid", "date"], { unique: false });
          s.createIndex("byProject", "pid", { unique: false });
        }
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      try { out = fn(s); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    get: (k) => tx("kv", "readonly", s => s.get(k)),
    set: (k, v) => tx("kv", "readwrite", s => s.put(v, k)),
    addPhoto: (rec) => tx("photos", "readwrite", s => s.put(rec)),
    putPhoto: (rec) => tx("photos", "readwrite", s => s.put(rec)),
    delPhoto: (id) => tx("photos", "readwrite", s => s.delete(id)),
    getPhoto: (id) => tx("photos", "readonly", s => s.get(id)),
    dayPhotos: (pid, date) => tx("photos", "readonly", s => s.index("byDay").getAll([pid, date])),
    projectPhotos: (pid) => tx("photos", "readonly", s => s.index("byProject").getAll(pid)),
    allPhotos: () => tx("photos", "readonly", s => s.getAll()),
    clearPhotos: () => tx("photos", "readwrite", s => s.clear())
  };
})();

/* ---------------- trades, agencies, standard WBS ---------------- */
const TRADES = ["Civil", "Interior", "Electrical", "HVAC", "Plumbing", "Fire Fighting", "FAPA", "ELV", "Closeout", "Builder Scope", "Others"];
const AGENCIES = ["HIDECOR", "Civil", "Carpentry", "Painting", "Flooring", "Electrical", "HVAC", "Plumbing", "Fire Fighting", "FAPA", "ELV / Networking", "Furniture", "Housekeeping"];
const TEMPLATE = [
  ["Civil", "Civil Works", ["Site mobilisation & barricading", "Demolition & dismantling", "Carting out of debris", "AAC block wall - 100mm", "AAC block wall - 150mm", "AAC block wall - 200mm", "RCC lintel", "Plastering", "RCC lintel plastering", "POP punning", "Plain cement concrete (PCC)", "Self levelling screed", "Core cutting", "Floor cutting & chipping for raceway", "Raceway filling concrete", "Water proofing"]],
  ["Interior", "Partition & Skinning", ["Drywall partition - GI framework", "Rockwool acoustic infill", "Gypsum skinning 12.5mm", "Gypsum partition closing - both sides", "Column cladding with gypsum", "Pelmet work", "Partition putty work", "Partition primer work", "Partition first coat painting", "Partition final coat painting"]],
  ["Interior", "Glazed Partition & Doors", ["Full height glazed partition - Al section", "Curved glass partition", "Glass door - single / double leaf", "Laminate flush door with frame", "Fire rated door", "Door hardware & closers", "Door lamination"]],
  ["Interior", "Ceiling", ["Gypsum ceiling framing", "Gypsum ceiling board closing", "Gypsum cove / hanging ceiling", "Grid ceiling / metal ceiling", "Acoustic cloud ceiling", "MS structural ceiling / frames", "Ceiling putty work", "Ceiling primer work", "Ceiling painting work", "MS frames & angles painting"]],
  ["Interior", "Flooring", ["Floor tiles installation", "Wall tiles / dado installation", "Grouting work", "Vitrified / stone flooring", "LVT installation", "Carpet installation", "Anti-static vinyl flooring", "Skirting & transition profiles"]],
  ["Interior", "Wall Panelling & Finishes", ["Wooden fluted panelling", "WPC / acoustic panelling", "Laminate wall panelling", "Plywood cladding", "Lacquered glass", "Texture paint", "Wall paper", "Vinyl graphics", "Frosting film", "Signage installation"]],
  ["Interior", "Carpentry & Furniture", ["Carpentry storages work", "Storage shutters installation", "Pantry counter & overhead storage", "Washbasin counter with granite", "Reception table", "Phonebooth table work", "Planter boxing", "Workstations assembling", "Meeting room tables", "Cabin tables", "Chairs", "Loose furniture", "Center table", "Blinds installation"]],
  ["Electrical", "Electrical", ["Temporary light & power arrangement", "Floor raceway installation", "Ceiling raceway installation", "Point wiring conduiting", "Back box installation", "Point wiring", "Circuit wiring", "Wiring from panel to DB", "Wiring from DB to user end", "Panel installation", "Panel termination", "DB installation & termination", "Cable tray installation", "LT cable laying & end termination", "Earthing - electrodes & strips", "Light fixtures installation", "Switch & socket installation", "UPS installation", "Lift electrical work", "Testing & commissioning", "Demo & training"]],
  ["HVAC", "HVAC", ["ODU installation", "IDU installation", "Copper piping - laying", "IDU & ODU copper pipe termination", "Refrigerant pressure testing", "Gas charging", "Drain line installation & slope test", "Ducting - GI fabrication & erection", "Duct insulation", "Grills & diffusers installation", "Fresh air / exhaust fan installation", "Ventilation & dampers", "Communication cabling", "Control panel / BMS", "Testing & commissioning", "Demo & training"]],
  ["Plumbing", "Plumbing", ["CPVC installation", "PVC installation", "PVC vertical line installation", "Pressure testing for CPVC", "PVC slope test", "Sanitary fixtures installation", "CP fixtures installation", "Water proofing - toilets", "Sink & pantry plumbing", "Testing & commissioning"]],
  ["Fire Fighting", "Sprinkler & FPS", ["GI pipe laying", "Sprinkler installation / relocation", "Dummy head & pendent modification", "Flexible hose pipe installation", "Fire extinguishers & stands", "Hydrostatic pressure testing", "Testing & commissioning"]],
  ["FAPA", "Fire Alarm & PA", ["FA cabling", "PA cabling", "Detector installation", "MCP installation", "Hooter installation", "Speaker installation", "Response indicator installation", "Exit signage installation", "Fire evacuation map installation", "FACP / panel installation", "Testing & commissioning", "Demo & training"]],
  ["ELV", "ACS, CCTV & Networking", ["ACS cabling", "CCTV cabling", "Network cabling", "IO crimping", "Faceplate installation", "Rack installation", "ACS device installation", "CCTV camera installation", "Active components installation", "Testing & commissioning", "Demo & training"]],
  ["Closeout", "Handover", ["Snag / punch list closure", "Deep cleaning", "Floor protection removal", "As-built drawings", "O&M manuals & warranties", "Client walkthrough", "HOD documents submission", "Handover & sign-off"]]
];
function templateActivities() {
  const out = [];
  TEMPLATE.forEach(([trade, section, items]) => items.forEach(n => out.push({ id: uid("a"), trade, section, name: n, weight: 1 })));
  return out;
}

/* ---------------- data model ---------------- */
function newProject(name) {
  return {
    id: uid("p"), name: name || "New Project", client: "", location: "", area: "",
    startDate: today(), completionDate: addDays(today(), 90), handoverDate: "",
    revision: "R0", pm: "", siteIncharge: "", scope: "Design & Build — Interior, Civil & MEP",
    activities: [], boq: [], approvals: [], issues: [], snags: [], changeOrders: [],
    reports: {}, created: today()
  };
}
function blankReport(d) {
  return {
    date: d, weather: "Clear", shiftFrom: "09:00", shiftTo: "18:00",
    progress: {}, boqDay: {}, manpower: [], staff: [], nextDay: [], materials: [], machinery: [],
    safety: { toolbox: "Yes", topic: "", observations: "", incidents: "None", nearMiss: "None", ppe: "Compliant" },
    quality: "", visitors: "", remarks: "", builderScope: "", photos: 0,
    plannedPct: null, submittedBy: "", reviewedBy: "", distribution: "", locked: false
  };
}

let DB = {
  version: 1,
  settings: { showRates: false, stampPhotos: true, geotag: false, photoQuality: "balanced" },
  company: { name: "HIDECOR Private Limited", tag: "VISION TO REALITY", address: "Koramangala, Bengaluru", scopeLine: "DESIGN & BUILT: HIDECOR" },
  projects: [], currentId: null, curDate: today()
};
let dirty = false;

const P = () => DB.projects.find(x => x.id === DB.currentId);
function rep(d) {
  const p = P(); if (!p) return null;
  d = d || DB.curDate;
  if (!p.reports[d]) p.reports[d] = blankReport(d);
  return p.reports[d];
}
const repDates = () => { const p = P(); return p ? Object.keys(p.reports).sort() : []; };

async function loadDB() {
  try {
    const raw = await IDB.get("db");
    if (raw) DB = Object.assign(DB, typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch (e) { console.warn("load failed", e); }
  if (!DB.settings) DB.settings = { showRates: false, stampPhotos: true, geotag: false, photoQuality: "balanced" };
  if (!DB.projects.length) {
    const p = newProject("My First Project");
    p.activities = templateActivities();
    DB.projects.push(p); DB.currentId = p.id;
  }
  if (!DB.currentId || !DB.projects.find(x => x.id === DB.currentId)) DB.currentId = DB.projects[0].id;
  DB.curDate = DB.curDate || today();
}
let _saveT;
async function saveDB(quiet) {
  DB.updated = new Date().toISOString();
  try { await IDB.set("db", JSON.stringify(DB)); dirty = false; if (!quiet) toast("Saved"); return true; }
  catch (e) { toast("Could not save — storage may be full", true); return false; }
}
function markDirty() { dirty = true; invalidateSnap(); clearTimeout(_saveT); _saveT = setTimeout(() => saveDB(true), 700); }

/* ---------------- progress snapshots (carry-forward) ----------------
   Each report records only what changed that day. The position on any
   date is the latest value recorded on or before it, so a missed day
   never resets the site. */
let _snap = {};
function invalidateSnap() { _snap = {}; }
function snapAt(p, d) {
  const key = p.id + "|" + d + "|" + Object.keys(p.reports).length + "|" + (DB.updated || "");
  if (_snap[key]) return _snap[key];
  const out = {};
  Object.keys(p.reports).sort().forEach(dd => {
    if (dd > d) return;
    const pr = p.reports[dd].progress || {};
    Object.keys(pr).forEach(k => {
      const v = pr[k];
      if (v && v.actual !== "" && v.actual != null) out[k] = Object.assign({}, out[k], { actual: num(v.actual) });
      if (v && v.planned !== "" && v.planned != null) out[k] = Object.assign({}, out[k], { planned: num(v.planned) });
    });
  });
  _snap[key] = out;
  return out;
}
function progVal(p, aid, d) { const s = snapAt(p, d || DB.curDate)[aid] || {}; return { actual: num(s.actual), planned: num(s.planned) }; }
function activityPct(p, tradeFilter, d) {
  const snap = snapAt(p, d || DB.curDate);
  let w = 0, aw = 0, pw = 0;
  p.activities.forEach(a => {
    if (tradeFilter && a.trade !== tradeFilter) return;
    if (a.excluded) return;
    const s = snap[a.id] || {}, wt = num(a.weight) || 1;
    w += wt; aw += wt * clamp(num(s.actual), 0, 100); pw += wt * clamp(num(s.planned), 0, 100);
  });
  return { actual: w ? aw / w : 0, planned: w ? pw / w : 0, count: w };
}
function boqStats(p, uptoDate) {
  const cum = {};
  Object.keys(p.reports).sort().filter(d => !uptoDate || d <= uptoDate).forEach(d => {
    const bd = p.reports[d].boqDay || {};
    Object.keys(bd).forEach(k => cum[k] = (cum[k] || 0) + num(bd[k]));
  });
  let val = 0, earned = 0;
  p.boq.forEach(b => {
    const a = num(b.amount) || num(b.qty) * num(b.rate);
    val += a;
    earned += a * clamp(num(cum[b.id]) / (num(b.qty) || 1), 0, 1);
  });
  return { value: val, earned, pct: val ? earned / val * 100 : 0, cum };
}
function overall(p, d) {
  const b = boqStats(p, d), a = activityPct(p, null, d);
  const useBoq = p.boq.length > 0 && b.value > 0;
  return { actual: useBoq ? b.pct : a.actual, planned: a.planned, basis: useBoq ? "BOQ earned value" : "Activity weighted", boq: b, act: a };
}
function delayDays(p, d) {
  d = d || DB.curDate;
  const tot = days(p.startDate, p.completionDate);
  if (!tot || tot <= 0) return 0;
  const should = clamp(days(p.startDate, d) / tot * 100, 0, 100);
  return Math.max(0, Math.round((should - overall(p, d).actual) / 100 * tot));
}
function syncSnapshot(d) {
  const p = P(); if (!p) return;
  d = d || DB.curDate;
  const r = p.reports[d]; if (!r) return;
  const o = overall(p, d);
  r.actualSnap = r1(o.actual);
  r.plannedSnap = (r.plannedPct != null && r.plannedPct !== "") ? num(r.plannedPct) : r1(Math.max(o.planned, 0));
}
const openApprovals = (p) => p.approvals.filter(a => a.status !== "Approved" && a.status !== "Closed");
const openIssues = (p) => p.issues.filter(a => a.status !== "Closed");
const openSnags = (p) => p.snags.filter(a => a.status !== "Closed" && a.status !== "Rectified");
const manpowerTotal = (r) => (r.manpower || []).reduce((s, m) => s + num(m.count), 0) + (r.staff || []).reduce((s, m) => s + num(m.count), 0);

/* ---------------- photo pipeline ----------------
   Site photos are the heart of the mobile app: captured from the camera,
   resized and compressed on device, optionally stamped with date, time,
   project and location the way a site camera app would, then stored as a
   JPEG blob in IndexedDB alongside its description. */
const QUALITY = {
  fast: { w: 900, q: 0.62 },
  balanced: { w: 1280, q: 0.72 },
  high: { w: 1800, q: 0.82 }
};
function loadImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = fr.result; };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
function stampCanvas(ctx, W, H, lines) {
  const pad = Math.round(W * 0.016);
  const fs = Math.max(11, Math.round(W * 0.026));
  ctx.font = "600 " + fs + "px -apple-system, Segoe UI, Roboto, sans-serif";
  const widths = lines.map(l => ctx.measureText(l).width);
  const bw = Math.max.apply(null, widths) + pad * 2;
  const bh = lines.length * (fs + 4) + pad * 1.4;
  const x = pad, y = H - bh - pad;
  ctx.fillStyle = "rgba(10,12,22,0.62)";
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 6); ctx.fill(); }
  else ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad * 0.7 + i * (fs + 4)));
}
async function processPhoto(file, meta) {
  const prof = QUALITY[DB.settings.photoQuality] || QUALITY.balanced;
  const img = await loadImage(file);
  const sc = Math.min(1, prof.w / Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width * sc)), H = Math.max(1, Math.round(img.height * sc));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
  x.drawImage(img, 0, 0, W, H);
  if (DB.settings.stampPhotos) {
    const p = P();
    const t = new Date();
    const lines = [
      fmtD(meta.date) + "  " + t.toTimeString().slice(0, 5),
      (p ? p.name : "").slice(0, 34)
    ];
    if (meta.floor) lines.push(meta.floor.slice(0, 34));
    if (meta.gps) lines.push(meta.gps);
    stampCanvas(x, W, H, lines);
  }
  const blob = await new Promise(res => c.toBlob(res, "image/jpeg", prof.q));
  return { blob, w: W, h: H };
}
function blobToBinary(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const b = new Uint8Array(fr.result);
      let s = "";
      const CH = 8192;
      for (let i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
      res(s);
    };
    fr.onerror = rej;
    fr.readAsArrayBuffer(blob);
  });
}
function getGPS(timeoutMs) {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    const t = setTimeout(() => res(null), timeoutMs || 6000);
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(t); res(p.coords.latitude.toFixed(5) + ", " + p.coords.longitude.toFixed(5)); },
      () => { clearTimeout(t); res(null); },
      { enableHighAccuracy: true, timeout: timeoutMs || 6000, maximumAge: 60000 }
    );
  });
}
async function addPhotoFiles(files, opts) {
  const p = P(); if (!p) return 0;
  const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
  if (!list.length) return 0;
  opts = opts || {};
  let gps = null;
  if (DB.settings.geotag) gps = await getGPS(5000);
  let n = 0;
  for (const f of list) {
    try {
      const meta = { date: DB.curDate, floor: opts.floor || "", gps };
      const { blob, w, h } = await processPhoto(f, meta);
      await IDB.addPhoto({
        id: uid("ph"), pid: p.id, date: DB.curDate, blob, w, h,
        caption: "", floor: opts.floor || "", trade: opts.trade || "Interior",
        gps: gps || "", takenAt: new Date().toISOString(), size: blob.size, order: Date.now() + n
      });
      n++;
    } catch (e) { console.warn("photo failed", e); }
  }
  const r = rep();
  r.photos = (await IDB.dayPhotos(p.id, DB.curDate)).length;
  markDirty();
  return n;
}

/* ---------------- file out ---------------- */
function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const canShareFiles = () => !!(navigator.canShare && navigator.share);
async function shareOrDownload(filename, blob, title, text) {
  if (canShareFiles()) {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title || filename, text: text || "" });
        return "shared";
      }
    } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  }
  download(filename, blob);
  return "downloaded";
}
const slug = (s, n) => String(s || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, n || 30);
