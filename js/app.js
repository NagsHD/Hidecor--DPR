/* ============================================================
   HIDECOR SiteLog Mobile — interface
   Five thumb-reachable tabs. Site photos with descriptions are the
   centre of the app; everything else feeds the same daily report.
   ============================================================ */
"use strict";

let VIEW = "today";
let UIS = { trade: "", photoTrade: "Interior", photoFloor: "", sheetOnClose: null };

/* ---------------- feedback ---------------- */
function toast(m, bad) {
  const t = $("#toast");
  t.textContent = m;
  t.style.background = bad ? "#A33421" : "#1E2138";
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2400);
}
function busy(on, msg) {
  const b = $("#busy");
  if (on) { $("#busyMsg").textContent = msg || "Working…"; b.classList.add("on"); }
  else b.classList.remove("on");
}
function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { } }

/* ---------------- bottom sheet ---------------- */
function sheet(title, body, foot, onClose) {
  $("#sheetTitle").textContent = title;
  $("#sheetBody").innerHTML = body;
  $("#sheetFoot").innerHTML = foot || '<button class="btn sec" onclick="closeSheet()">Close</button>';
  $("#sheetbg").classList.add("on");
  UIS.sheetOnClose = onClose || null;
  document.body.style.overflow = "hidden";
}
function closeSheet(skip) {
  $("#sheetbg").classList.remove("on");
  document.body.style.overflow = "";
  const f = UIS.sheetOnClose; UIS.sheetOnClose = null;
  if (f && !skip) f();
}
function confirmSheet(title, msg, okLabel, fn, danger) {
  window.__confirmFn = fn;
  sheet(title, '<p style="margin:0;line-height:1.5">' + msg + "</p>",
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button>' +
    '<button class="btn ' + (danger ? "del" : "") + '" onclick="closeSheet(1);window.__confirmFn&&window.__confirmFn()">' + esc(okLabel) + "</button>");
}

/* ---------------- navigation ---------------- */
/* Inline SVG rather than Unicode glyphs: symbols such as ⎙ and ▥ are
   missing from the default iOS font and render as blank boxes. */
const ICON = {
  today: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
  photos: '<path d="M3 8.5A1.5 1.5 0 014.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5z"/><circle cx="12" cy="12.5" r="3.4"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  report: '<path d="M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M14 4v5h5M9 13h6M9 17h4"/>',
  more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>'
};
const svgIcon = (k) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + "</svg>";
const TABS = [
  { k: "today", t: "Today" },
  { k: "photos", t: "Photos" },
  { k: "progress", t: "Progress" },
  { k: "report", t: "Report" },
  { k: "more", t: "More" }
];
function go(v) {
  VIEW = v;
  render();
  window.scrollTo({ top: 0 });
  haptic(6);
}
function renderNav() {
  const p = P();
  $("#nav").innerHTML = TABS.map(t => {
    let n = 0;
    if (p) {
      if (t.k === "photos") n = (p.reports[DB.curDate] || {}).photos || 0;
      if (t.k === "more") n = openApprovals(p).length;
    }
    return '<button class="' + (VIEW === t.k ? "on" : "") + '" onclick="go(\'' + t.k + '\')" aria-label="' + t.t + '">' +
      svgIcon(t.k) + t.t +
      (n ? '<span class="dot">' + (n > 99 ? "99+" : n) + "</span>" : "") + "</button>";
  }).join("");
}
function renderTop() {
  const p = P();
  const o = p ? overall(p) : { actual: 0 };
  $("#topTitle").innerHTML = (TABS.find(t => t.k === VIEW) || {}).t +
    "<small>" + esc(p ? p.name : "") + " · " + r1(o.actual) + "%</small>";
  $("#datePill").textContent = fmtShort(DB.curDate);
}
function render() {
  const p = P();
  renderNav(); renderTop();
  const V = { today: vToday, photos: vPhotos, progress: vProgress, report: vReport, more: vMore };
  $("#view").innerHTML = (V[VIEW] || vToday)();
  if (VIEW === "photos") mountPhotos();
  if (VIEW === "report") mountPreview();
}

/* ---------------- date picker ---------------- */
function pickDate() {
  const p = P();
  const dts = repDates().slice().reverse().slice(0, 12);
  sheet("Report date",
    '<label class="f">Date</label><input type="date" id="dpDate" value="' + DB.curDate + '" max="' + addDays(today(), 1) + '">' +
    '<div class="row" style="margin-top:10px">' +
    '<button class="btn sec sm" onclick="$(\'#dpDate\').value=\'' + today() + '\'">Today</button>' +
    '<button class="btn sec sm" onclick="$(\'#dpDate\').value=\'' + addDays(today(), -1) + '\'">Yesterday</button></div>' +
    (dts.length ? '<label class="f" style="margin-top:16px">Recent reports</label>' +
      dts.map(d => '<div class="lrow tapr" onclick="jumpDate(\'' + d + '\')"><div class="t"><b>' + fmtD(d) + "</b><span>" +
        (p.reports[d].photos || 0) + " photos · " + manpowerTotal(p.reports[d]) + " manpower · " +
        (p.reports[d].actualSnap != null ? p.reports[d].actualSnap + "%" : "—") +
        '</span></div><span class="chev">›</span></div>').join("") : ""),
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="setDate($(\'#dpDate\').value)">Open date</button>');
}
function setDate(d) {
  if (!d) return;
  DB.curDate = d;
  markDirty(); closeSheet(1); render();
}
function jumpDate(d) { setDate(d); }

/* ---------------- TODAY ---------------- */
function vToday() {
  const p = P(); if (!p) return "";
  const r = rep(), o = overall(p);
  const varr = r1(o.actual - (r.plannedSnap != null ? num(r.plannedSnap) : o.planned));
  const dly = delayDays(p);
  const left = days(DB.curDate, p.completionDate);
  const mp = manpowerTotal(r);
  const ph = r.photos || 0;
  const isToday = DB.curDate === today();

  let h = "";
  if (!isToday) h += '<div class="note warn">Viewing <b>' + fmtD(DB.curDate) + "</b>, not today. Anything you enter is recorded against that date. " +
    '<button class="linkish" onclick="setDate(\'' + today() + '\')">Jump to today</button></div>';

  h += '<div class="grid g2" style="margin-bottom:12px">' +
    kpi("Actual", r1(o.actual) + "%", o.basis, varr >= 0 ? "ok" : "bad") +
    kpi("Variance", (varr > 0 ? "+" : "") + varr + "%", varr >= 0 ? "Ahead of plan" : "Behind plan", varr >= 0 ? "ok" : "bad") +
    kpi("Delay", dly + "d", dly ? "As on date" : "No delay", dly ? "bad" : "ok") +
    kpi("Days to go", left, left < 0 ? "Overrun" : fmtShort(p.completionDate), left < 0 ? "bad" : "") +
    "</div>";

  /* the day's capture checklist — what still needs doing before the DPR goes out */
  const steps = [
    { k: "Site photos", v: ph ? ph + " added" : "None yet", done: ph > 0, go: "photos" },
    { k: "Photo descriptions", v: "—", done: null, go: "photos", id: "capState" },
    { k: "Progress %", v: Object.keys(r.progress || {}).length + " activities", done: Object.keys(r.progress || {}).length > 0, go: "progress" },
    { k: "Manpower", v: mp ? mp + " on site" : "Not recorded", done: mp > 0, fn: "openManpower()" },
    { k: "Tomorrow's plan", v: (r.nextDay || []).length + " activities", done: (r.nextDay || []).length > 0, fn: "openNextDay()" }
  ];
  h += '<div class="card"><h3>Today\'s report<span class="sp"></span><span class="mini">' + dow(DB.curDate) + "</span></h3><div class='body tight'>" +
    steps.map(s => '<div class="lrow tapr" onclick="' + (s.fn || ("go('" + s.go + "')")) + '">' +
      '<span style="font-size:17px;width:22px;text-align:center">' + (s.done === null ? "○" : s.done ? "●" : "○") + "</span>" +
      '<div class="t"><b>' + s.k + '</b><span' + (s.id ? ' id="' + s.id + '"' : "") + ">" + esc(s.v) + "</span></div>" +
      '<span class="chev">›</span></div>').join("") +
    "</div></div>";

  h += '<div class="card"><h3>Capture</h3><div class="body">' +
    '<button class="btn acc big full" onclick="go(\'photos\');setTimeout(takePhoto,120)">' + camSvg() + ' Take site photo</button>' +
    '<div class="grid g2" style="margin-top:10px">' +
    '<button class="btn sec" onclick="openManpower()">Manpower</button>' +
    '<button class="btn sec" onclick="openNextDay()">Tomorrow\'s plan</button>' +
    '<button class="btn sec" onclick="openDayInfo()">Weather &amp; shift</button>' +
    '<button class="btn sec" onclick="openNotes()">Notes &amp; EHS</button>' +
    "</div></div></div>";

  const ap = openApprovals(p), iss = openIssues(p);
  h += '<div class="card"><h3>Pending with client<span class="sp"></span>' +
    '<button class="btn sm sec" onclick="addReg(\'approvals\')">+ Raise</button></h3><div class="body tight">' +
    (ap.length ? ap.slice(0, 6).map(a => regRow(p, "approvals", a)).join("") :
      '<div class="empty"><b>Nothing pending</b>All client approvals are closed.</div>') +
    (ap.length > 6 ? '<div class="lrow tapr" onclick="go(\'more\')"><div class="t"><b>' + (ap.length - 6) + ' more…</b></div><span class="chev">›</span></div>' : "") +
    "</div></div>";

  if (iss.length) h += '<div class="card"><h3>Open issues</h3><div class="body tight">' +
    iss.slice(0, 5).map(a => regRow(p, "issues", a)).join("") + "</div></div>";

  h += '<div class="card"><h3>Issue the report</h3><div class="body">' +
    '<button class="btn acc big full" onclick="exportPDF()">' + (canShareFiles() ? "Share DPR as PDF" : "Download DPR as PDF") + "</button>" +
    '<p class="mini" style="margin:9px 0 0">' +
    (DB.settings.showRates ? "<b style='color:var(--rust)'>Internal copy — includes rates.</b> " : "Client copy — no rates or values. ") +
    '<button class="linkish" onclick="go(\'report\')">Preview first</button></p></div></div>';
  return h;
}
const camSvg = () => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICON.photos + "</svg>";
const libSvg = () => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-4 4 3 3-2 6 5"/><circle cx="8.5" cy="9" r="1.4"/></svg>';
function kpi(k, v, s, cls) {
  return '<div class="kpi ' + (cls || "") + '"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + esc(s) + "</div></div>";
}
function regRow(p, kind, a) {
  const i = p[kind].indexOf(a), age = days(a.raisedOn, DB.curDate);
  return '<div class="lrow tapr" onclick="editReg(\'' + kind + "'," + i + ')">' +
    '<div class="t"><b>' + esc(a.item) + "</b><span>" + esc(a.type || "") + (a.owner ? " · " + esc(a.owner) : "") + "</span></div>" +
    '<span class="pill ' + (age > 7 ? "p-bad" : age > 3 ? "p-warn" : "p-mut") + '">' + age + "d</span></div>";
}

/* ============================================================
   PHOTOS — capture, describe, reorder, reuse
   ============================================================ */
let PH = [];           /* photos for the open date, with object URLs */
function revokePH() { PH.forEach(x => { try { URL.revokeObjectURL(x.url); } catch (e) { } }); }

function vPhotos() {
  const p = P(), r = rep();
  return '<div class="capbar">' +
    '<div class="grid g2">' +
    '<button class="btn acc big" onclick="takePhoto()">' + camSvg() + " Camera</button>" +
    '<button class="btn sec big" onclick="pickPhoto()">' + libSvg() + " Gallery</button>" +
    "</div>" +
    '<div class="row" style="margin-top:9px">' +
    '<select id="phTrade" style="flex:1" onchange="UIS.photoTrade=this.value">' +
    TRADES.map(t => '<option' + (UIS.photoTrade === t ? " selected" : "") + ">" + t + "</option>").join("") + "</select>" +
    '<input type="text" id="phFloor" placeholder="Floor / area" style="flex:1" value="' + esc(UIS.photoFloor) + '" oninput="UIS.photoFloor=this.value">' +
    "</div>" +
    '<p class="mini" style="margin:7px 2px 0">New photos take this trade and floor. Every photo needs a description before it reaches the client.</p>' +
    "</div>" +
    '<input type="file" id="fileCam" accept="image/*" capture="environment" multiple class="hide">' +
    '<input type="file" id="fileLib" accept="image/*" multiple class="hide">' +
    '<div id="phWrap"></div>';
}
async function mountPhotos() {
  const p = P();
  revokePH();
  const list = await IDB.dayPhotos(p.id, DB.curDate);
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  PH = list.map(x => Object.assign({}, x, { url: URL.createObjectURL(x.blob) }));
  const r = rep();
  if (r.photos !== PH.length) { r.photos = PH.length; markDirty(); }
  paintPhotos();
  $("#fileCam").onchange = (e) => { intake(e.target.files); e.target.value = ""; };
  $("#fileLib").onchange = (e) => { intake(e.target.files); e.target.value = ""; };
  const w = $("#phWrap");
  ["dragenter", "dragover"].forEach(ev => w.addEventListener(ev, e => { e.preventDefault(); const d = $("#dz"); if (d) d.classList.add("hot"); }));
  ["dragleave", "drop"].forEach(ev => w.addEventListener(ev, e => { e.preventDefault(); const d = $("#dz"); if (d) d.classList.remove("hot"); }));
  w.addEventListener("drop", e => { e.preventDefault(); intake(e.dataTransfer.files); });
}
function paintPhotos() {
  const missing = PH.filter(x => !x.caption).length;
  let h = "";
  if (!PH.length) {
    h = '<div class="dz" id="dz"><b style="display:block;color:var(--ink);font-size:15px;margin-bottom:4px">No photos for ' + fmtD(DB.curDate) + "</b>" +
      "Tap Camera to shoot the day's progress. Photos are stamped with the date, project and area, then stored on this phone — no signal needed.</div>";
  } else {
    if (missing) h += '<div class="note warn">' + missing + " photo" + (missing > 1 ? "s" : "") + " still " + (missing > 1 ? "need" : "needs") + " a description. Tap a photo to add one.</div>";
    else h += '<div class="note ok">All ' + PH.length + " photo" + (PH.length > 1 ? "s" : "") + " described and ready for the report.</div>";
    h += '<div class="phgrid" id="dz">' + PH.map((x, i) =>
      '<div class="ph" onclick="editPhoto(' + i + ')">' +
      '<img src="' + x.url + '" alt="' + esc(x.caption || "Site photo") + '" loading="lazy">' +
      '<span class="num">' + (i + 1) + "</span>" +
      (x.trade ? '<span class="tag">' + esc(x.trade) + "</span>" : "") +
      '<div class="meta"><b' + (x.caption ? "" : ' class="need"') + ">" + esc(x.caption || "Add description") + "</b>" +
      "<span>" + esc(x.floor || "No area set") + " · " + kb(x.size || 0) + "</span></div></div>").join("") + "</div>";
    h += '<div class="row" style="margin-top:12px">' +
      '<button class="btn sec sm" onclick="bulkDescribe()">Describe all</button>' +
      '<button class="btn sec sm" onclick="exportPhotoSheet()">Export photo sheet</button>' +
      "</div>";
  }
  $("#phWrap").innerHTML = h;
  const c = $("#capState");
  if (c) c.textContent = PH.length ? (missing ? missing + " still need a description" : "All described") : "—";
  renderNav();
}
function takePhoto() { const el = $("#fileCam"); if (el) el.click(); else { go("photos"); setTimeout(takePhoto, 150); } }
function pickPhoto() { const el = $("#fileLib"); if (el) el.click(); }
async function intake(files) {
  const n = (files || []).length;
  if (!n) return;
  busy(true, "Processing " + n + " photo" + (n > 1 ? "s" : "") + "…");
  const added = await addPhotoFiles(files, { trade: UIS.photoTrade, floor: UIS.photoFloor });
  busy(false);
  if (!added) { toast("No photos added", true); return; }
  haptic(14);
  await mountPhotos();
  const first = PH.length - added;
  if (added === 1) editPhoto(first);
  else toast(added + " photos added — tap each to describe");
}

/* --- single photo editor --- */
function editPhoto(i) {
  const x = PH[i]; if (!x) return;
  sheet("Photo " + (i + 1) + " of " + PH.length,
    '<img src="' + x.url + '" style="width:100%;border-radius:10px;margin-bottom:14px" alt="">' +
    '<label class="f">Work description <span style="color:var(--rust)">*</span></label>' +
    '<textarea id="pcCap" placeholder="e.g. false ceiling framing and gypsum closing work in progress" style="min-height:76px">' + esc(x.caption || "") + "</textarea>" +
    '<div class="quick" id="pcSug">' + suggestions(x.trade).map(s =>
      '<button type="button" onclick="setCap(this.textContent)">' + esc(s) + "</button>").join("") + "</div>" +
    '<div class="grid g2" style="margin-top:14px">' +
    '<div><label class="f">Floor / area</label><input type="text" id="pcFloor" placeholder="e.g. B7 GF" value="' + esc(x.floor || "") + '"></div>' +
    '<div><label class="f">Trade</label><select id="pcTrade">' + TRADES.map(t => '<option' + (x.trade === t ? " selected" : "") + ">" + t + "</option>").join("") + "</select></div>" +
    "</div>" +
    (x.gps ? '<p class="mini" style="margin-top:10px">Location: ' + esc(x.gps) + "</p>" : "") +
    '<div class="row" style="margin-top:16px">' +
    (i > 0 ? '<button class="btn sec sm" onclick="savePhoto(' + i + ',' + (i - 1) + ')">‹ Previous</button>' : "") +
    (i < PH.length - 1 ? '<button class="btn sec sm" onclick="savePhoto(' + i + ',' + (i + 1) + ')">Next ›</button>' : "") +
    '<button class="btn del sm" style="margin-left:auto" onclick="delPhoto(' + i + ')">Delete</button>' +
    "</div>",
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button>' +
    '<button class="btn" onclick="savePhoto(' + i + ')">Save</button>');
  setTimeout(() => { const t = $("#pcCap"); if (t && !t.value) t.focus(); }, 180);
}
function setCap(t) { const el = $("#pcCap"); el.value = el.value ? el.value : t; el.focus(); }
function suggestions(trade) {
  const M = {
    Civil: ["Block work in progress", "Plastering work in progress", "Carting out of debris"],
    Interior: ["False ceiling framing in progress", "Gypsum ceiling closing work", "Partition work in progress", "Painting work in progress", "Tile laying in progress"],
    Electrical: ["Conduiting work in progress", "Circuit laying work in progress", "Light fixture installation"],
    HVAC: ["Copper piping work in progress", "IDU installation in progress", "Ducting work in progress"],
    Plumbing: ["Vertical line installation", "CPVC line work in progress", "Sanitary fixture installation"],
    FAPA: ["FAPA cabling work in progress", "Detector installation in progress"],
    ELV: ["Network cabling work in progress", "CCTV installation in progress"],
    "Fire Fighting": ["Sprinkler piping in progress", "Pipe laying work in progress"],
    Closeout: ["Snag rectification in progress", "Deep cleaning in progress"]
  };
  return M[trade] || M.Interior;
}
async function savePhoto(i, next) {
  const x = PH[i]; if (!x) return;
  x.caption = $("#pcCap").value.trim();
  x.floor = $("#pcFloor").value.trim();
  x.trade = $("#pcTrade").value;
  UIS.photoTrade = x.trade;
  if (x.floor) UIS.photoFloor = x.floor;
  const { url, ...rec } = x;
  await IDB.putPhoto(rec);
  if (next != null) { paintPhotos(); editPhoto(next); return; }
  closeSheet(1);
  paintPhotos();
  toast("Photo saved");
}
function delPhoto(i) {
  const x = PH[i]; if (!x) return;
  confirmSheet("Delete photo", "Remove photo " + (i + 1) + " from " + fmtD(DB.curDate) + "? This cannot be undone.", "Delete", async () => {
    await IDB.delPhoto(x.id);
    const r = rep(); r.photos = Math.max(0, (r.photos || 1) - 1); markDirty();
    await mountPhotos();
    toast("Photo deleted");
  }, true);
}
function bulkDescribe() {
  const first = PH.findIndex(x => !x.caption);
  if (first < 0) { toast("Every photo already has a description"); return; }
  editPhoto(first);
}
async function exportPhotoSheet() {
  if (!PH.length) return;
  const rows = [["HIDECOR Site Photo Log"], ["Project", P().name], ["Date", DB.curDate], [],
  ["#", "Description", "Floor / area", "Trade", "Taken at", "Location"]];
  PH.forEach((x, i) => rows.push([i + 1, x.caption, x.floor, x.trade, (x.takenAt || "").slice(11, 16), x.gps || ""]));
  const blob = new Blob([toCSV(rows)], { type: "text/csv" });
  await shareOrDownload("PhotoLog_" + slug(P().name, 24) + "_" + DB.curDate + ".csv", blob, "Site photo log");
}

/* ============================================================
   PROGRESS — activity % for the day
   ============================================================ */
function vProgress() {
  const p = P(), r = rep();
  if (!p.activities.length) return '<div class="card"><div class="empty"><b>No activities yet</b>' +
    'Load the standard HIDECOR fit-out list — 160 activities across every trade — then switch off anything not in this project.<br><br>' +
    '<button class="btn" onclick="loadTemplate()">Load standard list</button></div></div>';
  const trades = [...new Set(p.activities.filter(a => !a.excluded).map(a => a.trade))];
  const f = UIS.trade;
  const o = overall(p);
  let h = '<div class="card"><div class="body" style="padding:12px">' +
    '<div class="row" style="justify-content:space-between"><b>Overall ' + r1(o.actual) + '%</b><span class="mini">' + o.basis + "</span></div>" +
    '<div class="bar" style="margin-top:8px"><i style="width:' + clamp(o.actual, 0, 100) + '%"></i><em style="left:' + clamp(o.planned, 0, 100) + '%"></em></div>' +
    '<div class="quick" style="margin-top:10px"><button class="' + (!f ? "on" : "") + '" onclick="UIS.trade=\'\';render()">All</button>' +
    trades.map(t => '<button class="' + (f === t ? "on" : "") + '" onclick="UIS.trade=\'' + esc(t) + '\';render()">' + esc(t) + "</button>").join("") + "</div></div></div>";

  const show = p.activities.filter(a => !a.excluded && (!f || a.trade === f));
  let lastSec = "", body = "";
  show.forEach(a => {
    const prev = progVal(p, a.id, addDays(DB.curDate, -1));
    const cur = (r.progress || {})[a.id] || {};
    const av = (cur.actual != null && cur.actual !== "") ? num(cur.actual) : prev.actual;
    const pv = (cur.planned != null && cur.planned !== "") ? num(cur.planned) : prev.planned;
    const sec = a.trade + " — " + a.section;
    if (sec !== lastSec) { body += '<div class="sechead">' + esc(sec) + "</div>"; lastSec = sec; }
    body += '<div class="act" id="act_' + a.id + '">' +
      '<div class="nm">' + esc(a.name) + (prev.actual ? ' <span class="mini">(was ' + r1(prev.actual) + "%)</span>" : "") + "</div>" +
      '<div class="ctl"><span class="lab">Actual</span>' +
      stepper("actual", a.id, av) +
      '<span class="lab" style="width:auto;margin-left:6px">Plan</span>' +
      '<input type="number" min="0" max="100" inputmode="numeric" value="' + (pv || "") + '" style="width:72px;text-align:center;font-family:var(--mono)" onchange="setProg(\'' + a.id + '\',\'planned\',this.value)">' +
      "</div>" +
      '<div class="pbar"><div class="bar"><i id="bar_' + a.id + '" style="width:' + clamp(av, 0, 100) + '%"></i><em style="left:' + clamp(pv, 0, 100) + '%"></em></div></div>' +
      '<div class="quick">' + [0, 25, 50, 75, 90, 100].map(v =>
        '<button onclick="setProg(\'' + a.id + '\',\'actual\',' + v + ',1)">' + v + "</button>").join("") + "</div>" +
      '<input type="text" placeholder="Location / remark" value="' + esc(cur.remark || "") + '" style="margin-top:8px" oninput="setProg(\'' + a.id + '\',\'remark\',this.value)">' +
      "</div>";
  });
  h += '<div class="card"><div class="body tight">' + body + "</div></div>";
  h += '<div class="row" style="margin-bottom:20px"><button class="btn sec" onclick="carryForward()">Carry forward yesterday</button>' +
    '<button class="btn sec" onclick="go(\'more\')">Manage activities</button></div>';
  return h;
}
function stepper(field, aid, v) {
  return '<div class="step" style="flex:1">' +
    '<button type="button" onclick="bumpProg(\'' + aid + '\',-5)" aria-label="minus">−</button>' +
    '<input type="number" min="0" max="100" inputmode="numeric" id="in_' + aid + '" value="' + (v || "") + '" onchange="setProg(\'' + aid + '\',\'actual\',this.value)">' +
    '<button type="button" onclick="bumpProg(\'' + aid + '\',5)" aria-label="plus">+</button></div>';
}
function bumpProg(aid, d) {
  const el = $("#in_" + aid);
  const v = clamp(num(el.value) + d, 0, 100);
  el.value = v;
  setProg(aid, "actual", v, 1);
  haptic(6);
}
function setProg(aid, field, v, repaint) {
  const r = rep();
  if (!r.progress[aid]) r.progress[aid] = {};
  r.progress[aid][field] = field === "remark" ? v : (v === "" ? "" : clamp(num(v), 0, 100));
  markDirty(); syncSnapshot();
  if (field === "actual") {
    const b = $("#bar_" + aid); if (b) b.style.width = clamp(num(v), 0, 100) + "%";
    const i = $("#in_" + aid); if (i && repaint) i.value = num(v);
  }
  renderTop();
}
function carryForward() {
  const p = P(), ds = repDates().filter(d => d < DB.curDate);
  if (!ds.length) return toast("No earlier report to carry forward", true);
  const src = p.reports[ds[ds.length - 1]], r = rep();
  Object.keys(src.progress || {}).forEach(k => {
    r.progress[k] = Object.assign({}, r.progress[k], {
      planned: src.progress[k].planned,
      actual: (r.progress[k] && r.progress[k].actual) || src.progress[k].actual
    });
  });
  if (!r.manpower.length) r.manpower = JSON.parse(JSON.stringify(src.manpower || []));
  if (!r.staff.length) r.staff = JSON.parse(JSON.stringify(src.staff || []));
  markDirty(); syncSnapshot(); render();
  toast("Carried forward from " + fmtD(ds[ds.length - 1]));
}
function loadTemplate() {
  const p = P();
  const add = templateActivities().filter(t => !p.activities.some(a => a.name === t.name && a.trade === t.trade));
  p.activities = p.activities.concat(add);
  markDirty(); render();
  toast(add.length + " activities loaded");
}

/* ============================================================
   DAY SHEETS — manpower, plan, weather, notes
   ============================================================ */
function openManpower() {
  const r = rep();
  const rows = (r.manpower || []).map((m, i) =>
    '<div class="lrow" style="padding:10px 0;border-bottom:1px solid var(--line-2)">' +
    '<div class="t"><b>' + esc(m.agency) + "</b>" +
    '<input type="text" placeholder="Trade / work" value="' + esc(m.trade || "") + '" style="min-height:38px;margin-top:5px;font-size:14px" onchange="setMan(' + i + ',\'trade\',this.value)">' +
    "</div>" +
    '<div style="width:122px">' +
    '<div class="step"><button type="button" onclick="bumpMan(' + i + ',-1)">−</button>' +
    '<input type="number" inputmode="numeric" id="mp_' + i + '" value="' + (num(m.count) || "") + '" onchange="setMan(' + i + ',\'count\',this.value)">' +
    '<button type="button" onclick="bumpMan(' + i + ',1)">+</button></div>' +
    '<button class="btn del sm full" style="margin-top:5px" onclick="delMan(' + i + ')">Remove</button></div></div>').join("");
  sheet("Manpower — " + fmtShort(DB.curDate),
    '<div class="row" style="margin-bottom:12px"><b style="font-size:17px">Total on site: <span id="mpTot" class="num">' + manpowerTotal(r) + "</span></b></div>" +
    '<div id="mpRows">' + (rows || '<p class="mini">No agencies added yet.</p>') + "</div>" +
    '<label class="f" style="margin-top:16px">Add agency</label>' +
    '<div class="row"><select id="mpNew" style="flex:1">' + AGENCIES.map(a => "<option>" + a + "</option>").join("") + "</select>" +
    '<button class="btn sm" onclick="addMan()">Add</button></div>' +
    '<button class="btn sec sm full" style="margin-top:9px" onclick="addAllAgencies()">Add every agency</button>' +
    '<label class="f" style="margin-top:18px">Staff &amp; supervision</label>' +
    '<div id="stRows">' + (r.staff || []).map((s, i) =>
      '<div class="row" style="margin-bottom:7px"><input type="text" value="' + esc(s.role) + '" style="flex:2" onchange="setStaff(' + i + ',\'role\',this.value)">' +
      '<input type="number" inputmode="numeric" value="' + (num(s.count) || "") + '" style="width:72px;text-align:center" onchange="setStaff(' + i + ',\'count\',this.value)">' +
      '<button class="btn del sm" onclick="delStaff(' + i + ')">×</button></div>').join("") + "</div>" +
    '<button class="btn sec sm" onclick="addStaff()">+ Add staff</button>',
    '<button class="btn" onclick="closeSheet()">Done</button>', () => render());
}
function setMan(i, k, v) { const r = rep(); r.manpower[i][k] = k === "count" ? num(v) : v; markDirty(); const t = $("#mpTot"); if (t) t.textContent = manpowerTotal(r); }
function bumpMan(i, d) { const el = $("#mp_" + i); el.value = Math.max(0, num(el.value) + d); setMan(i, "count", el.value); haptic(6); }
function delMan(i) { const r = rep(); r.manpower.splice(i, 1); markDirty(); openManpower(); }
function addMan() {
  const r = rep(), a = $("#mpNew").value;
  if (r.manpower.some(m => m.agency === a)) return toast(a + " is already listed", true);
  r.manpower.push({ agency: a, trade: "", skilled: 0, unskilled: 0, count: 0, area: "", remarks: "" });
  markDirty(); openManpower();
}
function addAllAgencies() {
  const r = rep();
  AGENCIES.forEach(a => { if (!r.manpower.some(m => m.agency === a)) r.manpower.push({ agency: a, trade: "", skilled: 0, unskilled: 0, count: 0, area: "", remarks: "" }); });
  markDirty(); openManpower();
}
function addStaff() { const r = rep(); r.staff.push({ role: "Site Engineer", name: "", count: 1, remarks: "" }); markDirty(); openManpower(); }
function setStaff(i, k, v) { const r = rep(); r.staff[i][k] = k === "count" ? num(v) : v; markDirty(); const t = $("#mpTot"); if (t) t.textContent = manpowerTotal(r); }
function delStaff(i) { const r = rep(); r.staff.splice(i, 1); markDirty(); openManpower(); }

function openNextDay() {
  const r = rep();
  const rows = (r.nextDay || []).map((x, i) =>
    '<div style="padding:10px 0;border-bottom:1px solid var(--line-2)">' +
    '<input type="text" value="' + esc(x.desc) + '" placeholder="Planned activity" onchange="setND(' + i + ',\'desc\',this.value)">' +
    '<div class="row" style="margin-top:7px">' +
    '<select style="flex:1" onchange="setND(' + i + ",'trade',this.value)\">" + TRADES.map(t => '<option' + (x.trade === t ? " selected" : "") + ">" + t + "</option>").join("") + "</select>" +
    '<input type="text" style="flex:1" placeholder="Area" value="' + esc(x.area || "") + '" onchange="setND(' + i + ',\'area\',this.value)">' +
    '<button class="btn del sm" onclick="delND(' + i + ')">×</button></div></div>').join("");
  sheet("Tomorrow's plan — " + fmtShort(addDays(DB.curDate, 1)),
    (rows || '<p class="mini">Nothing planned yet. Add the activities the crews will start tomorrow.</p>') +
    '<button class="btn sec full" style="margin-top:12px" onclick="addND()">+ Add activity</button>' +
    '<button class="btn sec sm full" style="margin-top:8px" onclick="planFromToday()">Copy today\'s active work</button>',
    '<button class="btn" onclick="closeSheet()">Done</button>', () => render());
}
function addND() { const r = rep(); r.nextDay.push({ desc: "", trade: "Interior", area: "", agency: "", qty: "" }); markDirty(); openNextDay(); }
function setND(i, k, v) { const r = rep(); r.nextDay[i][k] = v; markDirty(); }
function delND(i) { const r = rep(); r.nextDay.splice(i, 1); markDirty(); openNextDay(); }
function planFromToday() {
  const p = P(), r = rep();
  const moved = Object.keys(r.progress || {}).filter(k => {
    const v = r.progress[k];
    return v && v.actual !== "" && v.actual != null && num(v.actual) < 100;
  });
  let n = 0;
  moved.forEach(k => {
    const a = p.activities.find(x => x.id === k);
    if (!a || r.nextDay.some(x => x.desc === a.name)) return;
    r.nextDay.push({ desc: a.name, trade: a.trade, area: (r.progress[k].remark || ""), agency: "", qty: "" });
    n++;
  });
  markDirty(); openNextDay();
  toast(n ? n + " activities carried into tomorrow" : "Nothing in progress to carry over");
}

function openDayInfo() {
  const r = rep();
  sheet("Weather & shift",
    '<label class="f">Weather</label><select id="wxSel">' +
    ["Clear", "Cloudy", "Light rain", "Heavy rain", "Rain stoppage - part day", "Hot"].map(x => '<option' + (r.weather === x ? " selected" : "") + ">" + x + "</option>").join("") + "</select>" +
    '<div class="grid g2" style="margin-top:14px">' +
    '<div><label class="f">Shift from</label><input type="time" id="sfFrom" value="' + esc(r.shiftFrom) + '"></div>' +
    '<div><label class="f">Shift to</label><input type="time" id="sfTo" value="' + esc(r.shiftTo) + '"></div></div>' +
    '<label class="f" style="margin-top:14px">Planned % as on date <span style="text-transform:none;letter-spacing:0">(leave blank to calculate)</span></label>' +
    '<input type="number" step="0.1" inputmode="decimal" id="plPct" value="' + (r.plannedPct == null ? "" : r.plannedPct) + '">',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="saveDayInfo()">Save</button>');
}
function saveDayInfo() {
  const r = rep();
  r.weather = $("#wxSel").value; r.shiftFrom = $("#sfFrom").value; r.shiftTo = $("#sfTo").value;
  r.plannedPct = $("#plPct").value === "" ? null : num($("#plPct").value);
  markDirty(); syncSnapshot(); closeSheet(1); render(); toast("Saved");
}

function openNotes() {
  const r = rep(), s = r.safety || (r.safety = {});
  sheet("Notes, EHS & sign-off",
    '<label class="f">General remarks for the client</label><textarea id="nRem">' + esc(r.remarks || "") + "</textarea>" +
    '<label class="f" style="margin-top:14px">Builder / base-build pending <span style="text-transform:none;letter-spacing:0">(one per line)</span></label>' +
    '<textarea id="nBld">' + esc(r.builderScope || "") + "</textarea>" +
    '<label class="f" style="margin-top:14px">Site visitors</label><input type="text" id="nVis" value="' + esc(r.visitors || "") + '">' +
    '<label class="f" style="margin-top:14px">Quality checks / NCRs</label><textarea id="nQua" style="min-height:66px">' + esc(r.quality || "") + "</textarea>" +
    '<h4 style="margin:20px 0 10px">Safety</h4>' +
    '<div class="grid g2">' +
    '<div><label class="f">Tool box talk</label><select id="sTb">' + ["Yes", "No"].map(x => '<option' + (s.toolbox === x ? " selected" : "") + ">" + x + "</option>").join("") + "</select></div>" +
    '<div><label class="f">PPE</label><select id="sPpe">' + ["Compliant", "Partial - corrected", "Non-compliant"].map(x => '<option' + (s.ppe === x ? " selected" : "") + ">" + x + "</option>").join("") + "</select></div>" +
    '<div><label class="f">Incidents</label><select id="sInc">' + ["None", "First aid case", "Lost time injury", "Property damage"].map(x => '<option' + (s.incidents === x ? " selected" : "") + ">" + x + "</option>").join("") + "</select></div>" +
    '<div><label class="f">Near miss</label><select id="sNm">' + ["None", "Reported"].map(x => '<option' + (s.nearMiss === x ? " selected" : "") + ">" + x + "</option>").join("") + "</select></div>" +
    "</div>" +
    '<label class="f" style="margin-top:12px">Tool box talk topic</label><input type="text" id="sTop" value="' + esc(s.topic || "") + '">' +
    '<label class="f" style="margin-top:12px">Safety observations</label><textarea id="sObs" style="min-height:66px">' + esc(s.observations || "") + "</textarea>" +
    '<h4 style="margin:20px 0 10px">Sign-off</h4>' +
    '<div class="grid g2">' +
    '<div><label class="f">Prepared by</label><input type="text" id="nPre" value="' + esc(r.submittedBy || P().siteIncharge || "") + '"></div>' +
    '<div><label class="f">Reviewed by</label><input type="text" id="nRev" value="' + esc(r.reviewedBy || P().pm || "") + '"></div></div>',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="saveNotes()">Save</button>');
}
function saveNotes() {
  const r = rep(), s = r.safety;
  r.remarks = $("#nRem").value; r.builderScope = $("#nBld").value;
  r.visitors = $("#nVis").value; r.quality = $("#nQua").value;
  s.toolbox = $("#sTb").value; s.ppe = $("#sPpe").value; s.incidents = $("#sInc").value;
  s.nearMiss = $("#sNm").value; s.topic = $("#sTop").value; s.observations = $("#sObs").value;
  r.submittedBy = $("#nPre").value; r.reviewedBy = $("#nRev").value;
  markDirty(); closeSheet(1); render(); toast("Saved");
}

/* ============================================================
   REPORT — preview, rate switch, share
   ============================================================ */
function vReport() {
  const p = P(), r = rep();
  /* gaps are checked against the open date, not whatever the photo tab
     last loaded; the caption check is filled in by mountPreview */
  const gaps = [];
  if (!(r.photos || 0)) gaps.push("no site photos");
  if (!Object.keys(r.progress || {}).length) gaps.push("no progress recorded");
  if (!manpowerTotal(r)) gaps.push("no manpower");
  if (!(r.nextDay || []).length) gaps.push("no plan for tomorrow");

  let h = '<div class="card"><h3>DPR — ' + fmtD(DB.curDate) + "</h3><div class='body'>" +
    (DB.settings.showRates
      ? '<div class="note bad"><b>Internal copy.</b> Rates, amounts and the commercial position are included. Switch this off before sending to the client.</div>'
      : '<div class="note ok"><b>Client copy.</b> No rates, amounts or values anywhere — quantities and percentages only.</div>') +
    '<div class="switchrow" style="border:0;padding-top:0"><div class="t"><b>Include rates &amp; values</b><span class="mini">Internal office copy only</span></div>' +
    '<input type="checkbox" ' + (DB.settings.showRates ? "checked" : "") + ' onchange="DB.settings.showRates=this.checked;markDirty();render()"></div>' +
    '<div id="gapNote">' + (gaps.length ? '<div class="note warn" style="margin-top:4px">Still missing: ' + gaps.join(", ") + ".</div>" : "") + "</div>" +
    '<button class="btn acc big full" onclick="exportPDF()">' + (canShareFiles() ? "Share DPR as PDF" : "Download DPR as PDF") + "</button>" +
    '<div class="grid g2" style="margin-top:10px">' +
    '<button class="btn sec" onclick="exportDPRCsv()">Export data (CSV)</button>' +
    '<button class="btn sec" onclick="window.print()">Print</button>' +
    "</div></div></div>";
  h += '<div class="card"><h3>Preview<span class="sp"></span><span class="mini">Exactly what sends</span></h3>' +
    '<div class="body"><div id="prev"><div class="empty">Building preview…</div></div></div></div>';
  return h;
}
async function mountPreview() {
  const el = $("#prev"); if (!el) return;
  try {
    syncSnapshot();
    const undescribed = (await IDB.dayPhotos(P().id, DB.curDate)).filter(x => !x.caption).length;
    if (undescribed) {
      const g = $("#gapNote");
      if (g) g.innerHTML = '<div class="note warn" style="margin-top:4px">' + undescribed +
        " photo" + (undescribed > 1 ? "s have" : " has") + " no description — they print without a caption. " +
        "<button class='linkish' onclick=\"go('photos')\">Add them</button></div>" + g.innerHTML;
    }
    el.innerHTML = await buildDPR(DB.curDate);
  } catch (e) { el.innerHTML = '<div class="empty"><b>Preview failed</b>' + esc(e.message) + "</div>"; }
}
async function exportDPRCsv() {
  const p = P(), d = DB.curDate, r = p.reports[d] || blankReport(d), snap = snapAt(p, d);
  const rows = [["HIDECOR Daily Progress Report"], ["Project", p.name], ["Client", p.client], ["Date", d], [],
  ["ACTIVITY PROGRESS"], ["Trade", "Section", "Activity", "Planned %", "Actual %", "Remark"]];
  p.activities.forEach(a => {
    const s = snap[a.id] || {};
    if (!num(s.actual) && !num(s.planned)) return;
    rows.push([a.trade, a.section, a.name, num(s.planned), num(s.actual), ((r.progress || {})[a.id] || {}).remark || ""]);
  });
  rows.push([], ["MANPOWER"], ["Agency", "Trade", "Total", "Area"]);
  (r.manpower || []).forEach(m => rows.push([m.agency, m.trade, m.count, m.area]));
  rows.push([], ["TOMORROW'S PLAN"], ["Activity", "Trade", "Area"]);
  (r.nextDay || []).forEach(x => rows.push([x.desc, x.trade, x.area]));
  rows.push([], ["PENDING APPROVALS"], ["Item", "Type", "Raised", "Age", "Status", "Remarks"]);
  openApprovals(p).forEach(a => rows.push([a.item, a.type, a.raisedOn, days(a.raisedOn, d), a.status, a.remarks]));
  const blob = new Blob([toCSV(rows)], { type: "text/csv" });
  await shareOrDownload("DPR_" + slug(p.name, 24) + "_" + d + ".csv", blob, "DPR data");
}

/* ============================================================
   REGISTERS — approvals / issues / snags
   ============================================================ */
const REG = {
  approvals: {
    t: "Approvals", item: "Item awaiting approval",
    types: ["Drawing / GFC", "Material sample", "Shade / finish selection", "Mock-up", "Change order", "Design decision", "Commercial", "Vendor / make", "Access / permission", "Others"],
    status: ["Pending with client", "Under review", "Approved", "Hold", "Escalated", "Closed"],
    extra: { k: "impact", label: "Impact if delayed", ph: "e.g. blocks ceiling closing" }
  },
  issues: {
    t: "Issues", item: "Issue / hindrance",
    types: ["Builder / base build", "Client decision pending", "Material delay", "Manpower shortage", "Access restriction", "Design clash", "Statutory", "Payment", "Weather", "Others"],
    status: ["Open", "In progress", "Escalated", "Hold", "Closed"],
    extra: { k: "impact", label: "Impact", ph: "e.g. 3 days on ceiling" }
  },
  snags: {
    t: "Snags", item: "Snag description",
    types: ["Civil", "Interior", "Painting", "Flooring", "Electrical", "HVAC", "Plumbing", "FAPA", "ELV", "Cleaning"],
    status: ["Open", "In progress", "Rectified", "Closed"],
    extra: { k: "location", label: "Location / floor", ph: "e.g. FF meeting room 02" }
  }
};
function addReg(kind) {
  const c = REG[kind];
  window.__regKind = kind;
  sheet("New " + c.t.replace(/s$/, "").toLowerCase(),
    '<label class="f">' + c.item + '</label><input type="text" id="rgI" placeholder="Describe it in one line">' +
    '<label class="f" style="margin-top:14px">Type</label><select id="rgT">' + c.types.map(t => "<option>" + t + "</option>").join("") + "</select>" +
    '<div class="grid g2" style="margin-top:14px">' +
    '<div><label class="f">Raised on</label><input type="date" id="rgR" value="' + DB.curDate + '"></div>' +
    '<div><label class="f">Required by</label><input type="date" id="rgB" value="' + addDays(DB.curDate, 7) + '"></div></div>' +
    '<label class="f" style="margin-top:14px">With whom</label><input type="text" id="rgO" placeholder="Client / PMC / consultant">' +
    '<label class="f" style="margin-top:14px">' + c.extra.label + '</label><input type="text" id="rgE" placeholder="' + esc(c.extra.ph) + '">',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="doAddReg()">Add</button>');
  setTimeout(() => $("#rgI") && $("#rgI").focus(), 200);
}
function doAddReg() {
  const kind = window.__regKind, c = REG[kind], p = P();
  const it = $("#rgI").value.trim();
  if (!it) return toast("Describe it first", true);
  const o = {
    id: uid("r"), item: it, type: $("#rgT").value, raisedOn: $("#rgR").value,
    requiredBy: $("#rgB").value, owner: $("#rgO").value, status: c.status[0], remarks: ""
  };
  o[c.extra.k] = $("#rgE").value;
  p[kind].push(o);
  markDirty(); closeSheet(1); render(); toast("Added to the register");
}
function editReg(kind, i) {
  const c = REG[kind], p = P(), a = p[kind][i];
  if (!a) return;
  window.__regKind = kind; window.__regIdx = i;
  sheet(c.t.replace(/s$/, ""),
    '<label class="f">' + c.item + '</label><input type="text" id="egI" value="' + esc(a.item) + '">' +
    '<label class="f" style="margin-top:14px">Status</label><select id="egS">' + c.status.map(s => '<option' + (a.status === s ? " selected" : "") + ">" + s + "</option>").join("") + "</select>" +
    '<label class="f" style="margin-top:14px">' + c.extra.label + '</label><input type="text" id="egE" value="' + esc(a[c.extra.k] || "") + '">' +
    '<label class="f" style="margin-top:14px">Remarks</label><input type="text" id="egM" value="' + esc(a.remarks || "") + '">' +
    '<div class="grid g2" style="margin-top:14px">' +
    '<div><label class="f">Raised on</label><input type="date" id="egR" value="' + esc(a.raisedOn || "") + '"></div>' +
    '<div><label class="f">Required by</label><input type="date" id="egB" value="' + esc(a.requiredBy || "") + '"></div></div>' +
    '<label class="f" style="margin-top:14px">With whom</label><input type="text" id="egO" value="' + esc(a.owner || "") + '">' +
    '<p class="mini" style="margin-top:12px">Open ' + days(a.raisedOn, DB.curDate) + " days. It prints in every DPR until the status is closed.</p>" +
    '<button class="btn del sm full" style="margin-top:14px" onclick="delReg()">Delete</button>',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="saveReg()">Save</button>');
}
function saveReg() {
  const kind = window.__regKind, i = window.__regIdx, p = P(), a = p[kind][i], c = REG[kind];
  a.item = $("#egI").value; a.status = $("#egS").value; a[c.extra.k] = $("#egE").value;
  a.remarks = $("#egM").value; a.raisedOn = $("#egR").value; a.requiredBy = $("#egB").value; a.owner = $("#egO").value;
  if (["Approved", "Closed", "Rectified"].includes(a.status) && !a.closedOn) a.closedOn = DB.curDate;
  markDirty(); closeSheet(1); render(); toast("Saved");
}
function delReg() {
  const kind = window.__regKind, i = window.__regIdx;
  P()[kind].splice(i, 1);
  markDirty(); closeSheet(1); render(); toast("Deleted");
}
function vRegister(kind) {
  const p = P(), c = REG[kind];
  const open = kind === "approvals" ? openApprovals(p) : kind === "issues" ? openIssues(p) : openSnags(p);
  return '<div class="card"><h3>' + c.t + '<span class="sp"></span><button class="btn sm" onclick="addReg(\'' + kind + '\')">+ New</button></h3>' +
    '<div class="body tight">' + (open.length ? open.map(a => regRow(p, kind, a)).join("") :
      '<div class="empty"><b>Nothing open</b>Everything in this register is closed.</div>') + "</div></div>";
}

/* ============================================================
   MORE — project, BOQ, registers, backup, settings
   ============================================================ */
let MORE = "menu";
function vMore() {
  if (MORE !== "menu") {
    const V = { project: vProject, boq: vBOQ, approvals: () => vRegister("approvals"), issues: () => vRegister("issues"), snags: () => vRegister("snags"), activities: vActivities, backup: vBackup, settings: vSettings, history: vHistory };
    return '<button class="btn sec sm" style="margin-bottom:12px" onclick="MORE=\'menu\';render()">‹ Back</button>' + (V[MORE] || vMenu)();
  }
  return vMenu();
}
function vMenu() {
  const p = P();
  const items = [
    ["project", "Project setup", p.name + " · " + (p.client || "no client set")],
    ["activities", "Activities", p.activities.filter(a => !a.excluded).length + " in scope"],
    ["boq", "BOQ tracker", p.boq.length ? p.boq.length + " line items" : "Not loaded"],
    ["approvals", "Approvals", openApprovals(p).length + " open"],
    ["issues", "Issues", openIssues(p).length + " open"],
    ["snags", "Snag list", openSnags(p).length + " open"],
    ["history", "Report history", repDates().length + " daily reports"],
    ["backup", "Backup & restore", "Export everything to a file"],
    ["settings", "Settings", "Photos, rates, install"]
  ];
  let h = '<div class="card"><h3>Project</h3><div class="body tight">' +
    '<div class="lrow tapr" onclick="switchProject()"><div class="t"><b>' + esc(p.name) + "</b><span>Tap to switch or add a project</span></div><span class='chev'>›</span></div></div></div>";
  h += '<div class="card"><div class="body tight">' + items.map(([k, t, s]) =>
    '<div class="lrow tapr" onclick="MORE=\'' + k + '\';render()"><div class="t"><b>' + t + "</b><span>" + esc(s) + "</span></div><span class='chev'>›</span></div>").join("") + "</div></div>";
  h += '<p class="mini" style="text-align:center;padding:8px 0 24px">HIDECOR SiteLog · v' + APP_VERSION + "<br>Works offline. Data stays on this device until you export it.</p>";
  return h;
}
function vProject() {
  const p = P();
  const set = (k) => 'onchange="P().' + k + '=this.value;markDirty();renderTop()"';
  return '<div class="card"><h3>Project details</h3><div class="body stack">' +
    f("Project name", '<input type="text" value="' + esc(p.name) + '" ' + set("name") + ">") +
    f("Client", '<input type="text" value="' + esc(p.client) + '" ' + set("client") + ">") +
    f("Location / building", '<input type="text" value="' + esc(p.location) + '" ' + set("location") + ">") +
    f("Area in sft", '<input type="text" inputmode="numeric" value="' + esc(p.area) + '" ' + set("area") + ">") +
    '<div class="grid g2">' +
    f("Project start", '<input type="date" value="' + esc(p.startDate) + '" ' + set("startDate") + ">") +
    f("Completion", '<input type="date" value="' + esc(p.completionDate) + '" ' + set("completionDate") + ">") + "</div>" +
    f("Handover with HOD documents", '<input type="date" value="' + esc(p.handoverDate || "") + '" ' + set("handoverDate") + ">") +
    '<div class="grid g2">' +
    f("Project manager", '<input type="text" value="' + esc(p.pm) + '" ' + set("pm") + ">") +
    f("Site in-charge", '<input type="text" value="' + esc(p.siteIncharge) + '" ' + set("siteIncharge") + ">") + "</div>" +
    f("Revision", '<input type="text" value="' + esc(p.revision) + '" ' + set("revision") + ">") +
    "</div></div>" +
    '<div class="card"><h3>Manage</h3><div class="body stack">' +
    '<button class="btn sec full" onclick="newProjectFlow()">+ New project</button>' +
    '<button class="btn del full" onclick="delProject()">Delete this project</button>' +
    '<p class="mini">' + repDates().length + " reports · " + p.boq.length + " BOQ items · " + p.activities.length + " activities</p></div></div>";
}
function f(l, inner) { return '<div><label class="f">' + l + "</label>" + inner + "</div>"; }
function switchProject() {
  sheet("Projects",
    DB.projects.map(x => '<div class="lrow tapr" onclick="useProject(\'' + x.id + '\')">' +
      '<div class="t"><b>' + esc(x.name) + "</b><span>" + esc(x.client || "No client") + " · " + Object.keys(x.reports).length + " reports</span></div>" +
      (x.id === DB.currentId ? '<span class="pill p-ok">Open</span>' : '<span class="chev">›</span>') + "</div>").join(""),
    '<button class="btn sec" onclick="closeSheet(1)">Close</button><button class="btn" onclick="newProjectFlow()">+ New project</button>');
}
function useProject(id) {
  DB.currentId = id; invalidateSnap(); markDirty(); closeSheet(1); MORE = "menu"; go("today");
}
function newProjectFlow() {
  sheet("New project",
    '<label class="f">Project name</label><input type="text" id="npN" placeholder="e.g. Teradyne — Manyata Tech Park">' +
    '<label class="f" style="margin-top:14px">Client</label><input type="text" id="npC">' +
    '<label class="f" style="margin-top:14px">Area in sft</label><input type="text" inputmode="numeric" id="npA">' +
    '<div class="grid g2" style="margin-top:14px">' +
    '<div><label class="f">Start</label><input type="date" id="npS" value="' + today() + '"></div>' +
    '<div><label class="f">Completion</label><input type="date" id="npE" value="' + addDays(today(), 90) + '"></div></div>' +
    '<div class="switchrow" style="margin-top:10px"><div class="t"><b>Load standard activity list</b><span class="mini">160 fit-out activities</span></div>' +
    '<input type="checkbox" id="npT" checked></div>',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="doNewProject()">Create</button>');
  setTimeout(() => $("#npN") && $("#npN").focus(), 200);
}
function doNewProject() {
  const n = $("#npN").value.trim();
  if (!n) return toast("Name the project", true);
  const p = newProject(n);
  p.client = $("#npC").value; p.area = $("#npA").value;
  p.startDate = $("#npS").value; p.completionDate = $("#npE").value;
  if ($("#npT").checked) p.activities = templateActivities();
  DB.projects.push(p); DB.currentId = p.id;
  invalidateSnap(); markDirty(); closeSheet(1); MORE = "menu"; go("today");
  toast("Project created");
}
function delProject() {
  const p = P();
  if (DB.projects.length === 1) return toast("Keep at least one project", true);
  confirmSheet("Delete project", "Remove <b>" + esc(p.name) + "</b> with its " + repDates().length +
    " reports and all photos? Export a backup first if you might need it.", "Delete", async () => {
      const ph = await IDB.projectPhotos(p.id);
      for (const x of ph) await IDB.delPhoto(x.id);
      DB.projects = DB.projects.filter(x => x.id !== p.id);
      DB.currentId = DB.projects[0].id;
      invalidateSnap(); await saveDB(true); MORE = "menu"; go("today");
      toast("Project deleted");
    }, true);
}

/* --- activities --- */
function vActivities() {
  const p = P();
  const trades = [...new Set(p.activities.map(a => a.trade))];
  const f2 = UIS.trade;
  let h = '<div class="card"><div class="body" style="padding:12px">' +
    '<p class="mini" style="margin:0 0 9px">Switch off anything not in this project. Excluded activities drop out of the DPR and the percentages.</p>' +
    '<div class="quick"><button class="' + (!f2 ? "on" : "") + '" onclick="UIS.trade=\'\';render()">All</button>' +
    trades.map(t => '<button class="' + (f2 === t ? "on" : "") + '" onclick="UIS.trade=\'' + esc(t) + '\';render()">' + esc(t) + "</button>").join("") + "</div></div></div>";
  let rows = "", lastSec = "";
  p.activities.forEach((a, i) => {
    if (f2 && a.trade !== f2) return;
    const sec = a.trade + " — " + a.section;
    if (sec !== lastSec) { rows += '<div class="sechead">' + esc(sec) + "</div>"; lastSec = sec; }
    rows += '<div class="lrow"><div class="t" style="' + (a.excluded ? "opacity:.45" : "") + '"><b>' + esc(a.name) + "</b><span>weight " + (a.weight || 1) + "</span></div>" +
      '<input type="checkbox" ' + (a.excluded ? "" : "checked") + ' onchange="P().activities[' + i + '].excluded=!this.checked;markDirty();renderTop()"></div>';
  });
  h += '<div class="card"><div class="body tight">' + (rows || '<div class="empty">No activities</div>') + "</div></div>";
  h += '<div class="row" style="margin-bottom:20px"><button class="btn sec" onclick="loadTemplate()">Load standard list</button>' +
    '<button class="btn sec" onclick="addActivity()">+ Add activity</button></div>';
  return h;
}
function addActivity() {
  sheet("Add activity",
    '<label class="f">Activity name</label><input type="text" id="aaN" placeholder="e.g. Gypsum ceiling framing work">' +
    '<label class="f" style="margin-top:14px">Trade</label><select id="aaT">' + TRADES.map(t => "<option>" + t + "</option>").join("") + "</select>" +
    '<label class="f" style="margin-top:14px">Section</label><input type="text" id="aaS" placeholder="e.g. Ceiling">',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="doAddActivity()">Add</button>');
}
function doAddActivity() {
  const n = $("#aaN").value.trim();
  if (!n) return toast("Name the activity", true);
  P().activities.push({ id: uid("a"), trade: $("#aaT").value, section: $("#aaS").value || "General", name: n, weight: 1 });
  markDirty(); closeSheet(1); render(); toast("Activity added");
}

/* --- BOQ --- */
function vBOQ() {
  const p = P(), st = boqStats(p), cum = st.cum, r = rep();
  if (!p.boq.length) return '<div class="card"><div class="empty"><b>No BOQ loaded</b>' +
    "Import the BOQ once and every line item tracks itself from the quantities you book each day. Import is easiest on the desktop version, or paste a CSV here." +
    '<br><br><button class="btn" onclick="boqImport()">Import BOQ</button></div></div>';
  let h = '<div class="grid g2" style="margin-bottom:12px">' +
    kpi("Line items", p.boq.length, "Tracked") +
    kpi("Executed", r1(st.pct) + "%", DB.settings.showRates ? "₹ " + inr(st.earned) + " earned" : "Quantity weighted", "ok") + "</div>";
  h += '<div class="card"><h3>Book today\'s quantities<span class="sp"></span><button class="btn sm sec" onclick="boqImport()">Import</button></h3>' +
    '<div class="body" style="padding:12px"><input type="text" id="bqS" placeholder="Search item" oninput="UIS.bq=this.value;paintBOQ()"></div>' +
    '<div class="body tight" id="bqList"></div></div>';
  setTimeout(paintBOQ, 10);
  return h;
}
function paintBOQ() {
  const el = $("#bqList"); if (!el) return;
  const p = P(), r = rep();
  const prev = boqStats(p, addDays(DB.curDate, -1)).cum;
  const q = (UIS.bq || "").toLowerCase();
  const list = p.boq.filter(b => !q || (b.desc + " " + b.code).toLowerCase().includes(q)).slice(0, 60);
  el.innerHTML = list.length ? list.map((b, idx) => {
    const i = p.boq.indexOf(b);
    const pv = num(prev[b.id]), tdy = num((r.boqDay || {})[b.id]);
    const cum = pv + tdy, pct = clamp(cum / (num(b.qty) || 1) * 100, 0, 100);
    return '<div class="act"><div class="nm">' + esc(b.desc.slice(0, 110)) + "</div>" +
      '<div class="mini" style="margin-bottom:7px">BOQ ' + inr(b.qty) + " " + esc(b.unit) + " · done " + r2(cum) + " · balance " + r2(num(b.qty) - cum) + "</div>" +
      '<div class="ctl"><span class="lab">Today</span>' +
      '<div class="step" style="flex:1"><button type="button" onclick="bumpBoq(\'' + b.id + '\',-1)">−</button>' +
      '<input type="number" inputmode="decimal" step="any" id="bq_' + b.id + '" value="' + (tdy || "") + '" onchange="setBoqDay(\'' + b.id + '\',this.value)">' +
      '<button type="button" onclick="bumpBoq(\'' + b.id + '\',1)">+</button></div></div>' +
      '<div class="pbar"><div class="bar"><i style="width:' + pct + '%"></i></div></div></div>';
  }).join("") : '<div class="empty">No items match.</div>';
}
function setBoqDay(bid, v) {
  const r = rep();
  if (!r.boqDay) r.boqDay = {};
  if (num(v) === 0) delete r.boqDay[bid]; else r.boqDay[bid] = num(v);
  markDirty(); renderTop();
}
function bumpBoq(bid, d) {
  const el = $("#bq_" + bid);
  el.value = Math.max(0, num(el.value) + d);
  setBoqDay(bid, el.value); haptic(6);
}
function boqImport() {
  sheet("Import BOQ",
    '<div class="note ok">Open your BOQ in Excel, select the rows including the heading row, copy, and paste below. Columns are detected automatically.</div>' +
    '<label class="f">Paste BOQ</label><textarea id="biT" style="min-height:150px" placeholder="Sl. No.&#9;Description&#9;Unit&#9;Qty&#9;Rate&#9;Amount"></textarea>' +
    '<label class="f" style="margin-top:14px">Or choose a CSV file</label><input type="file" id="biF" accept=".csv,.tsv,.txt">' +
    '<label class="f" style="margin-top:14px">Trade for these rows</label><select id="biTr">' + TRADES.map(t => "<option>" + t + "</option>").join("") + "</select>" +
    '<div class="switchrow"><div class="t"><b>Add to existing BOQ</b><span class="mini">Off replaces everything</span></div><input type="checkbox" id="biA" checked></div>',
    '<button class="btn sec" onclick="closeSheet(1)">Cancel</button><button class="btn" onclick="doBoqImport()">Import</button>');
  setTimeout(() => {
    const fi = $("#biF");
    if (fi) fi.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const fr = new FileReader();
      fr.onload = () => { $("#biT").value = fr.result; toast("File loaded — press Import"); };
      fr.readAsText(file);
    };
  }, 150);
}
function doBoqImport() {
  const txt = $("#biT").value.trim();
  if (!txt) return toast("Paste the BOQ or choose a file", true);
  const rows = parseDelim(txt);
  if (rows.length < 2) return toast("Could not read any rows", true);
  let hdr = 0;
  rows.slice(0, 12).forEach((r, i) => {
    const s = r.join(" ").toLowerCase();
    if (/desc|item/.test(s) && /qty|quantity|unit/.test(s)) hdr = i;
  });
  const H = rows[hdr].map(c => String(c).toLowerCase());
  const find = (keys) => { for (let j = 0; j < H.length; j++) if (keys.some(k => H[j].includes(k))) return j; return -1; };
  const m = {
    code: find(["sl. no", "sl.no", "sl no", "sr", "code", "item no"]),
    desc: find(["description", "particular", "item"]),
    unit: find(["unit", "uom"]),
    qty: find(["total qty", "quantity", "qty"]),
    rate: find(["rate"]),
    amount: find(["amount", "value"])
  };
  if (m.desc < 0 || m.qty < 0) return toast("Could not find Description and Qty columns", true);
  const trade = $("#biTr").value, append = $("#biA").checked, p = P();
  const out = []; let section = "";
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i];
    const g = (j) => j >= 0 && r[j] != null ? String(r[j]).trim() : "";
    const desc = g(m.desc).replace(/\s+/g, " ");
    if (!desc) continue;
    const qty = num(g(m.qty)), rate = num(g(m.rate)), amt = num(g(m.amount));
    if (!qty && !amt) { if (desc.length < 90) section = desc.toUpperCase(); continue; }
    out.push({
      id: uid("b"), trade, section: section || "General", code: g(m.code),
      desc: desc.slice(0, 300), unit: g(m.unit) || "Nos", qty,
      rate: rate || (qty ? amt / qty : 0), amount: amt || qty * rate, added: DB.curDate
    });
  }
  if (!out.length) return toast("No priced lines found", true);
  if (!append) p.boq = [];
  p.boq = p.boq.concat(out);
  markDirty(); closeSheet(1); render();
  toast(out.length + " BOQ items imported");
}

/* --- history --- */
function vHistory() {
  const p = P(), ds = repDates().slice().reverse();
  if (!ds.length) return '<div class="card"><div class="empty"><b>No reports yet</b>Your daily entries build this history.</div></div>';
  return '<div class="card"><h3>Report history</h3><div class="body tight">' +
    ds.map(d => { const r = p.reports[d]; return '<div class="lrow tapr" onclick="jumpDate(\'' + d + '\');MORE=\'menu\';go(\'today\')">' +
      '<div class="t"><b>' + fmtD(d) + "</b><span>" + (r.photos || 0) + " photos · " + manpowerTotal(r) + " manpower</span></div>" +
      '<span class="v">' + (r.actualSnap != null ? r.actualSnap + "%" : "—") + "</span></div>"; }).join("") +
    "</div></div>" +
    '<button class="btn sec full" style="margin-bottom:20px" onclick="exportHistory()">Export progress history (CSV)</button>';
}
async function exportHistory() {
  const p = P();
  const rows = [["Date", "Planned %", "Actual %", "Variance %", "Manpower", "Photos"]];
  repDates().forEach(d => {
    const r = p.reports[d];
    rows.push([d, r.plannedSnap != null ? r.plannedSnap : "", r.actualSnap != null ? r.actualSnap : "",
    r.actualSnap != null && r.plannedSnap != null ? r1(r.actualSnap - r.plannedSnap) : "",
      manpowerTotal(r), r.photos || 0]);
  });
  await shareOrDownload("Progress_" + slug(p.name, 24) + ".csv", new Blob([toCSV(rows)], { type: "text/csv" }), "Progress history");
}

/* ============================================================
   BACKUP — the data lives on this device until it is exported
   ============================================================ */
function vBackup() {
  return '<div class="card"><h3>Backup</h3><div class="body stack">' +
    '<div class="note warn">Everything is stored on this phone. If the phone is lost, wiped, or the browser data is cleared, the reports and photos go with it. ' +
    "Export a backup each week and keep it in Drive or on the office computer.</div>" +
    '<button class="btn full" onclick="exportBackup()">Export full backup</button>' +
    '<button class="btn sec full" onclick="exportBackup(1)">Export without photos <span class="mini">(small file)</span></button>' +
    '<label class="f" style="margin-top:8px">Restore from a backup</label>' +
    '<input type="file" id="rsF" accept=".json" onchange="importBackup(this.files[0])">' +
    '<p class="mini">Restoring replaces everything currently on this device.</p>' +
    "</div></div>" +
    '<div class="card"><h3>Storage</h3><div class="body" id="stWrap"><p class="mini">Checking…</p></div></div>';
}
async function exportBackup(noPhotos) {
  busy(true, "Packing backup…");
  try {
    const out = { app: "HIDECOR SiteLog", version: APP_VERSION, exported: new Date().toISOString(), db: DB, photos: [] };
    if (!noPhotos) {
      const all = await IDB.allPhotos();
      for (const x of all) {
        const bin = await blobToBinary(x.blob);
        out.photos.push({
          id: x.id, pid: x.pid, date: x.date, caption: x.caption, floor: x.floor, trade: x.trade,
          gps: x.gps, takenAt: x.takenAt, order: x.order, w: x.w, h: x.h, b64: btoa(bin)
        });
      }
    }
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    busy(false);
    await shareOrDownload("SiteLog_Backup_" + today() + (noPhotos ? "_data" : "") + ".json", blob, "SiteLog backup");
    toast("Backup " + kb(blob.size));
  } catch (e) { busy(false); toast("Backup failed: " + e.message, true); }
}
function importBackup(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let o;
    try { o = JSON.parse(fr.result); } catch (e) { return toast("That file is not a SiteLog backup", true); }
    if (!o.db || !o.db.projects) return toast("That file is not a SiteLog backup", true);
    confirmSheet("Restore backup",
      "This backup holds <b>" + o.db.projects.length + " project(s)</b> and " + (o.photos || []).length +
      " photos, exported " + fmtD((o.exported || "").slice(0, 10)) + ". Restoring replaces everything on this device.",
      "Restore", async () => {
        busy(true, "Restoring…");
        try {
          DB = o.db;
          if (o.photos && o.photos.length) {
            await IDB.clearPhotos();
            for (const x of o.photos) {
              const bin = atob(x.b64);
              const u8 = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
              const blob = new Blob([u8], { type: "image/jpeg" });
              const { b64, ...rec } = x;
              await IDB.addPhoto(Object.assign(rec, { blob, size: blob.size }));
            }
          }
          invalidateSnap();
          await saveDB(true);
          busy(false); MORE = "menu"; go("today");
          toast("Backup restored");
        } catch (e) { busy(false); toast("Restore failed: " + e.message, true); }
      });
  };
  fr.readAsText(file);
}
async function paintStorage() {
  const el = $("#stWrap"); if (!el) return;
  let used = 0, quota = 0;
  try { const e = await navigator.storage.estimate(); used = e.usage || 0; quota = e.quota || 0; } catch (err) { }
  const all = await IDB.allPhotos();
  const bytes = all.reduce((s, x) => s + (x.size || 0), 0);
  let persist = "not requested";
  try { if (navigator.storage && navigator.storage.persisted) persist = (await navigator.storage.persisted()) ? "granted" : "not granted"; } catch (e) { }
  el.innerHTML =
    '<div class="lrow" style="padding:9px 0"><div class="t"><b>Photos stored</b><span>' + all.length + " across all projects</span></div><span class='v'>" + kb(bytes) + "</span></div>" +
    (quota ? '<div class="lrow" style="padding:9px 0"><div class="t"><b>App storage used</b><span>of ' + kb(quota) + " available</span></div><span class='v'>" + kb(used) + "</span></div>" : "") +
    '<div class="lrow" style="padding:9px 0;border:0"><div class="t"><b>Persistent storage</b><span>Stops the browser clearing data under pressure</span></div>' +
    (persist === "granted" ? '<span class="pill p-ok">On</span>' : '<button class="btn sm sec" onclick="askPersist()">Turn on</button>') + "</div>";
}
async function askPersist() {
  try {
    const ok = await navigator.storage.persist();
    toast(ok ? "Persistent storage granted" : "The browser declined — keep exporting backups", !ok);
  } catch (e) { toast("Not supported on this browser", true); }
  paintStorage();
}

/* ============================================================
   SETTINGS
   ============================================================ */
function vSettings() {
  const s = DB.settings;
  const sw = (k, title, sub) => '<div class="switchrow"><div class="t"><b>' + title + '</b><span class="mini">' + sub + "</span></div>" +
    '<input type="checkbox" ' + (s[k] ? "checked" : "") + ' onchange="DB.settings.' + k + '=this.checked;markDirty();render()"></div>';
  return '<div class="card"><h3>Photos</h3><div class="body">' +
    sw("stampPhotos", "Stamp photos", "Prints date, time, project and area onto each photo as it is taken") +
    sw("geotag", "Add GPS location", "Asks for location permission; adds coordinates to the stamp") +
    '<label class="f" style="margin-top:14px">Photo quality</label>' +
    '<div class="seg">' + [["fast", "Fast"], ["balanced", "Balanced"], ["high", "High"]].map(([k, t]) =>
      '<button class="' + (s.photoQuality === k ? "on" : "") + '" onclick="DB.settings.photoQuality=\'' + k + '\';markDirty();render()">' + t + "</button>").join("") + "</div>" +
    '<p class="mini" style="margin-top:8px">Balanced suits a site report: about 150 KB a photo, sharp enough to read a finish. High doubles that.</p>' +
    "</div></div>" +
    '<div class="card"><h3>Report</h3><div class="body">' +
    sw("showRates", "Include rates & values", "Internal copy only — never leave this on for a client report") +
    "</div></div>" +
    '<div class="card"><h3>App</h3><div class="body stack">' +
    '<div id="instWrap"></div>' +
    '<button class="btn sec full" onclick="checkUpdate()">Check for update</button>' +
    '<p class="mini">Version ' + APP_VERSION + " · " + (navigator.onLine ? "online" : "offline") + "</p>" +
    "</div></div>";
}
function paintInstall() {
  const el = $("#instWrap"); if (!el) return;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (standalone) { el.innerHTML = '<div class="note ok" style="margin:0"><b>Installed.</b> SiteLog is running as an app on this device.</div>'; return; }
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (deferredPrompt) el.innerHTML = '<button class="btn full" onclick="doInstall()">Install SiteLog on this device</button>';
  else if (iOS) el.innerHTML = '<div class="note" style="margin:0;background:var(--line-2)"><b>To install on iPhone or iPad:</b><br>' +
    "Tap the Share button in Safari, then <b>Add to Home Screen</b>.</div>";
  else el.innerHTML = '<p class="mini" style="margin:0">Use your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>';
}

/* ============================================================
   INSTALL + SERVICE WORKER
   ============================================================ */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const seen = localStorage.getItem("sl_install_dismissed");
  if (!seen) $("#install").classList.add("on");
  paintInstall();
});
async function doInstall() {
  $("#install").classList.remove("on");
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (outcome === "accepted") toast("Installing…");
  paintInstall();
}
function dismissInstall() {
  $("#install").classList.remove("on");
  try { localStorage.setItem("sl_install_dismissed", "1"); } catch (e) { }
}
window.addEventListener("appinstalled", () => { $("#install").classList.remove("on"); toast("SiteLog installed"); paintInstall(); });
async function checkUpdate() {
  if (!("serviceWorker" in navigator)) return toast("Not supported here", true);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return toast("No service worker registered", true);
    await reg.update();
    toast(reg.waiting ? "Update ready — close and reopen the app" : "You are on the latest version");
  } catch (e) { toast("Could not check", true); }
}

/* ============================================================
   BOOT
   ============================================================ */
const APP_VERSION = "1.0.0";
async function boot() {
  try { await loadDB(); }
  catch (e) {
    document.body.innerHTML = '<div style="padding:30px;font-family:sans-serif"><h2>Storage unavailable</h2>' +
      "<p>SiteLog needs on-device storage. If you are in a private window, open it in a normal tab.</p></div>";
    return;
  }
  $("#datePill").onclick = pickDate;
  $("#btnPdf").onclick = () => exportPDF();
  $("#sheetbg").addEventListener("click", (e) => { if (e.target.id === "sheetbg") closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  window.addEventListener("online", () => toast("Back online"));
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("visibilitychange", () => { if (document.hidden && dirty) saveDB(true); });

  /* observe the More sub-pages that need an async paint */
  const mo = new MutationObserver(() => {
    if ($("#stWrap")) paintStorage();
    if ($("#instWrap")) paintInstall();
  });
  mo.observe($("#view"), { childList: true });

  /* home-screen shortcuts land here with ?action= */
  const act = new URLSearchParams(location.search).get("action");
  if (act === "photo") { go("photos"); setTimeout(takePhoto, 400); }
  else if (act === "report") go("report");
  else render();
  if (act) history.replaceState({}, "", location.pathname);

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw && nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) toast("Update ready — reopen the app");
        });
      });
    } catch (e) { console.warn("sw failed", e); }
  }
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { }
}
document.addEventListener("DOMContentLoaded", boot);
