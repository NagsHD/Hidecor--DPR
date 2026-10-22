/* ============================================================
   DPR document model + PDF renderer.
   One model, rendered to PDF for the client and to HTML for preview.
   Rates are OFF by default: the client copy carries quantities and
   percentages only.
   ============================================================ */
"use strict";
const showRates = () => !!(DB.settings && DB.settings.showRates);
function C(v, s, a, span) { return { v: v == null ? "" : String(v), s: s || "", a: a || "l", span: span || 1 }; }
function T(title, widths, head, rows) { return { type: "table", title: title, widths: widths, head: head, rows: rows }; }

async function dprModel(d) {
  const p = P(); d = d || DB.curDate;
  const r = p.reports[d] || blankReport(d);
  const photos = await IDB.dayPhotos(p.id, d);
  const o = overall(p, d), tot = days(p.startDate, p.completionDate) || 1;
  const planned = r.plannedSnap != null ? num(r.plannedSnap) : r1(o.planned);
  const actual = r.actualSnap != null ? num(r.actualSnap) : r1(o.actual);
  const snap = snapAt(p, d);
  const should = clamp(days(p.startDate, d) / tot * 100, 0, 100);
  const dly = Math.max(0, Math.round((should - actual) / 100 * tot));
  const cumNow = boqStats(p, d).cum;
  const B = [];
  const pc = (v) => r1(v) + "%";

  /* programme information */
  B.push(T(null, [30, 12, 30, 28], [C("Particulars", "th"), C("Area in Sft.", "th", "c"), C("Construction Programme Information", "th", "c", 2)], [
    [C("Total area excluding common areas"), C(p.area || "—", "b", "c"), C("Project start", "sub"), C(fmtD(p.startDate), "", "c")],
    [C(p.location || p.scope || ""), C("", ""), C("Project completion", "sub"), C(fmtD(p.completionDate), "yel b", "c")],
    [C("Handing over date with HOD documents", "grn b"), C(fmtD(p.handoverDate || p.completionDate), "", "c"), C("Actual delay as on date (day's)", "sub"), C(String(dly), "pct", "c")],
    [C("Revision / report no.", "grn b"), C(p.revision || "R0", "", "c"), C("Arrested delay", "sub"), C(String(r.arrested || 0), "", "c")]
  ]));

  /* physical progress */
  const prows = [[C("Overall project progress", "b"), C(pc(planned), "b", "c"), C(pc(actual), "pct", "c"), C((actual - planned > 0 ? "+" : "") + r1(actual - planned) + "%", "b", "c"), C(actual - planned >= 0 ? "On track" : "Behind plan — recovery in progress", "", "l", 2)]];
  [...new Set(p.activities.filter(a => !a.excluded).map(a => a.trade))].forEach(t => {
    const a = activityPct(p, t, d);
    if (!a.actual && !a.planned) return;
    prows.push([C(t), C(pc(a.planned), "", "c"), C(pc(a.actual), "pct", "c"), C(r1(a.actual - a.planned) + "%", "", "c"), C(a.actual >= 100 ? "Completed" : a.actual >= a.planned ? "On track" : "Under progress", "", "l", 2)]);
  });
  B.push(T(null, [26, 11, 11, 11, 41], [C("Physical progress status", "th"), C("Planned", "th", "c"), C("Actual", "th", "c"), C("Variation", "th", "c"), C("Status / change orders track", "th", "l", 2)], prows));
  const co = p.changeOrders || [];
  if (co.length) B.push(T("CHANGE ORDERS TRACK", showRates() ? [42, 14, 14, 14, 16] : [56, 14, 14, 16],
    showRates() ? [C("Change order", "th"), C("Amount Rs.", "th", "r"), C("Raised on", "th", "c"), C("Status", "th", "c"), C("Remarks", "th")] : [C("Change order", "th"), C("Raised on", "th", "c"), C("Status", "th", "c"), C("Remarks", "th")],
    co.map(c => showRates() ? [C(c.desc), C(inr(c.amount), "", "r"), C(fmtD(c.raisedOn), "", "c"), C(c.status, "", "c"), C(c.remarks)] : [C(c.desc), C(fmtD(c.raisedOn), "", "c"), C(c.status, "", "c"), C(c.remarks)])));

  /* daily activities */
  const arows = []; let lastSec = "";
  p.activities.forEach(a => {
    if (a.excluded) return;
    const s = snap[a.id] || {}, cur = (r.progress || {})[a.id] || {};
    const prev = progVal(p, a.id, addDays(d, -1));
    const av = num(s.actual), pv = num(s.planned);
    if (!av && !pv && !cur.remark) return;
    const sec = (a.trade + " — " + a.section).toUpperCase();
    if (sec !== lastSec) { arows.push([C(sec, "sub", "l", 5)]); lastSec = sec; }
    arows.push([C(a.name), C(pv ? pc(pv) : "", "", "c"), C(pc(av), "pct", "c"), C(av - prev.actual > 0 ? "+" + r1(av - prev.actual) + "%" : "", "", "c"), C(cur.remark || "")]);
  });
  if (!arows.length) arows.push([C("No progress recorded for this date.", "", "c", 5)]);
  B.push(T("DAILY ACTIVITIES — PROGRESS AS ON " + fmtD(d).toUpperCase(), [42, 10, 10, 9, 29],
    [C("Activity", "th"), C("Planned %", "th", "c"), C("Actual %", "th", "c"), C("Today", "th", "c"), C("Remark / location", "th")], arows));

  /* quantities executed */
  const bl = p.boq.filter(b => num((r.boqDay || {})[b.id]) !== 0);
  if (bl.length) {
    const w = [10, 34, 8, 11, 11, 12, 8, 6];
    B.push(T("QUANTITIES EXECUTED TODAY — BOQ LINE ITEM TRACKING", w,
      [C("Code", "th"), C("BOQ item", "th"), C("Unit", "th", "c"), C("BOQ qty", "th", "r"), C("Today", "th", "r"), C("Cumulative", "th", "r"), C("Balance", "th", "r"), C("%", "th", "c")],
      bl.map(b => { const t = num(r.boqDay[b.id]), c = num(cumNow[b.id]), q = num(b.qty); return [C(b.code), C(b.desc.slice(0, 150)), C(b.unit, "", "c"), C(inr(q), "", "r"), C(r2(t), "b", "r"), C(r2(c), "", "r"), C(r2(q - c), "", "r"), C(r1(clamp(c / (q || 1) * 100, 0, 100)) + "%", "pct", "c")]; })));
  }

  /* tomorrow */
  B.push(T("TOMORROW PLANNED ACTIVITIES — " + fmtD(addDays(d, 1)).toUpperCase(), [50, 14, 20, 16],
    [C("Planned activity", "th"), C("Trade", "th"), C("Area / floor", "th"), C("Agency", "th")],
    (r.nextDay || []).length ? r.nextDay.map(x => [C(x.desc), C(x.trade || ""), C(x.area || ""), C(x.agency || "")]) : [[C("Not recorded", "", "c", 4)]]));

  /* manpower */
  const mrows = (r.manpower || []).length ? (r.manpower || []).map(m => [C(m.agency), C(m.trade), C(num(m.skilled) || "", "", "c"), C(num(m.unskilled) || "", "", "c"), C(num(m.count) || "", "b", "c"), C(m.area || ""), C(m.remarks || "")]) : [[C("Not recorded", "", "c", 7)]];
  if ((r.staff || []).length) {
    mrows.push([C("STAFF & SUPERVISION", "sub", "l", 7)]);
    r.staff.forEach(s => mrows.push([C(s.role), C(s.name || "", "", "l", 3), C(num(s.count) || "", "b", "c"), C(s.remarks || "", "", "l", 2)]));
  }
  mrows.push([C("Total manpower on site", "grn b", "r", 4), C(String(manpowerTotal(r)), "grn b", "c"), C("Weather: " + (r.weather || "") + " · Shift " + (r.shiftFrom || "") + "-" + (r.shiftTo || ""), "grn", "l", 2)]);
  B.push(T("MANPOWER REPORT", [17, 22, 8, 9, 8, 17, 19],
    [C("Agency / contractor", "th"), C("Trade / work", "th"), C("Skilled", "th", "c"), C("Unskilled", "th", "c"), C("Total", "th", "c"), C("Working area", "th"), C("Remarks", "th")], mrows));

  /* approvals */
  const ap = p.approvals.filter(a => !["Approved", "Closed"].includes(a.status) && (!a.raisedOn || a.raisedOn <= d));
  B.push(T("PENDING APPROVALS REQUIRED FROM CLIENT", [28, 14, 11, 11, 6, 12, 18],
    [C("Item awaiting approval", "th"), C("Type", "th"), C("Raised on", "th", "c"), C("Required by", "th", "c"), C("Age", "th", "c"), C("With whom", "th"), C("Impact / remarks", "th")],
    ap.length ? ap.map(a => [C(a.item), C(a.type || ""), C(fmtD(a.raisedOn), "", "c"), C(fmtD(a.requiredBy), "", "c"), C(days(a.raisedOn, d) + "d", "b", "c"), C(a.owner || "Client"), C([a.impact, a.remarks].filter(Boolean).join(" — "))]) : [[C("No approvals pending as on date", "", "c", 7)]]));

  /* issues */
  const iss = p.issues.filter(a => a.status !== "Closed" && (!a.raisedOn || a.raisedOn <= d));
  B.push(T("CRITICAL ISSUES / HINDRANCES", [32, 15, 11, 6, 12, 24],
    [C("Issue", "th"), C("Type", "th"), C("Raised on", "th", "c"), C("Age", "th", "c"), C("Status", "th"), C("Impact / remarks", "th")],
    iss.length ? iss.map(a => [C(a.item), C(a.type || ""), C(fmtD(a.raisedOn), "", "c"), C(days(a.raisedOn, d) + "d", "", "c"), C(a.status), C([a.impact, a.remarks].filter(Boolean).join(" — "))]) : [[C("None", "", "c", 6)]]));

  if (r.builderScope) B.push(T("BUILDER / BASE-BUILD WORKS FOLLOW-UP", [100], [C("Point", "th")], r.builderScope.split(/\n/).filter(Boolean).map(l => [C("- " + l)])));

  if ((r.materials || []).length) B.push(T("MATERIAL RECEIVED AT SITE", [32, 10, 8, 22, 14, 14],
    [C("Material", "th"), C("Qty", "th", "r"), C("Unit", "th", "c"), C("Supplier / DC no.", "th"), C("Status", "th"), C("Remarks", "th")],
    r.materials.map(m => [C(m.material), C(m.qty, "", "r"), C(m.unit, "", "c"), C(m.source), C(m.status), C(m.remarks)])));
  if ((r.machinery || []).length) B.push(T("MACHINERY & EQUIPMENT DEPLOYED", [42, 10, 18, 30],
    [C("Item", "th"), C("Nos.", "th", "c"), C("Status", "th"), C("Remarks", "th")],
    r.machinery.map(m => [C(m.item), C(m.count, "", "c"), C(m.status), C(m.remarks)])));

  const s = r.safety || {};
  const grows = [
    [C("Tool box talk", "grn b"), C((s.toolbox || "—") + (s.topic ? " — " + s.topic : "")), C("PPE compliance", "grn b"), C(s.ppe || "—")],
    [C("Incidents", "grn b"), C(s.incidents || "None"), C("Near miss", "grn b"), C(s.nearMiss || "None")]
  ];
  if (s.observations) grows.push([C("Safety observations", "grn b"), C(s.observations, "", "l", 3)]);
  if (r.quality) grows.push([C("Quality / inspections", "grn b"), C(r.quality, "", "l", 3)]);
  if (r.visitors) grows.push([C("Site visitors", "grn b"), C(r.visitors, "", "l", 3)]);
  if (r.remarks) grows.push([C("Remarks", "grn b"), C(r.remarks, "", "l", 3)]);
  B.push(T("EHS, QUALITY & GENERAL", [18, 32, 18, 32], null, grows));

  /* commercial — internal copy only */
  if (showRates() && p.boq.length) {
    const bs = boqStats(p, d);
    B.push(T("COMMERCIAL POSITION (INTERNAL COPY)", [40, 20, 20, 20],
      [C("Particulars", "th"), C("BOQ value Rs.", "th", "r"), C("Value earned Rs.", "th", "r"), C("Balance Rs.", "th", "r")],
      [[C("Contract works as per BOQ"), C(inr(bs.value), "", "r"), C(inr(bs.earned), "b", "r"), C(inr(bs.value - bs.earned), "", "r")]]));
  }

  if (photos.length) photos.sort((a, b) => (a.order || 0) - (b.order || 0));
    const items = [];
    for (const x of photos) items.push({ bin: await blobToBinary(x.blob), cap: [x.floor, x.caption].filter(Boolean).join(" — ") || "Site photograph", trade: x.trade || "", url: URL.createObjectURL(x.blob) });
    B.push({ type: "photos", title: "SITE PHOTOGRAPHS — " + fmtD(d).toUpperCase(), items });

  B.push({
    type: "sign", cols: [
      { label: "Prepared by", value: r.submittedBy || p.siteIncharge || "" },
      { label: "Reviewed by", value: r.reviewedBy || p.pm || "" },
      { label: "Distribution", value: r.distribution || p.client || "" }
    ]
  });

  return {
    meta: {
      project: p.name, client: p.client || "", scope: p.scope || "", date: d,
      dateText: fmtD(d) + " · " + dow(d), rev: p.revision || "R0",
      foot: DB.company.scopeLine + " · " + DB.company.name + " · " + DB.company.address + " · Generated " + fmtD(today()) + (showRates() ? " · INTERNAL COPY" : "")
    }, blocks: B
  };
}

/* ---------------- renderer: PDF ---------------- */
const PDFC = { hd: [0.96, 0.79, 0.66], sub: [0.906, 0.92, 0.949], grn: [0.863, 0.902, 0.835], yel: [1, 0.949, 0.659], th: [0.863, 0.902, 0.835], rust: [0.64, 0.20, 0.13] };
function modelToPdf(m) {
  const doc = PDF({ title: "DPR " + m.meta.project + " " + m.meta.date, author: "HIDECOR" });
  const FS = 7.2, LH = 8.6, PAD = 2.4, HFS = 7.2;
  const CW = doc.width;
  let pageNo = 0;
  doc.onHeader((D) => {
    pageNo++;
    const top = D.M;
    D.rect(D.M, top, CW, 30, [1, 1, 1]);
    try { if (window.LOGO_BIN) D.image(window.LOGO_BIN, D.M + 2, top + 7, 78, 14); } catch (e) { }
    D.text("DAILY PROGRESS REPORT", D.M + 90, top + 3, 11, true, [0.19, 0.21, 0.32]);
    D.text(m.meta.project, D.M + 90, top + 15, 8.5, true, [0, 0, 0]);
    D.text(m.meta.client ? "Client: " + m.meta.client : "", D.M + 90, top + 24, 7.2, false, [0.25, 0.25, 0.3]);
    D.text(m.meta.dateText, D.M, top + 15, 8, true, [0.64, 0.20, 0.13], "r", CW);
    D.text("Rev " + m.meta.rev + "   Page " + pageNo, D.M, top + 24, 7, false, [0.35, 0.35, 0.4], "r", CW);
    D.line(D.M, top + 32, D.M + CW, top + 32, 0.45, 1.1);
    D.y = top + 38;
  });
  doc.newPage();

  const fillOf = (s) => s.includes("hd") ? PDFC.hd : s.includes("sub") ? PDFC.sub : s.includes("yel") ? PDFC.yel : s.includes("grn") ? PDFC.grn : s.includes("th") ? PDFC.th : null;
  const colorOf = (s) => s.includes("pct") ? PDFC.rust : [0, 0, 0];
  const boldOf = (s) => s.includes("b") || s.includes("th") || s.includes("hd") || s.includes("sub") || s.includes("pct");

  function colXs(widths) { const xs = []; let x = doc.M; widths.forEach(w => { xs.push(x); x += CW * w / 100; }); xs.push(x); return xs; }
  function drawRow(row, widths, xs) {
    const spans = []; let ci = 0;
    row.forEach(c => { const sp = Math.min(c.span || 1, widths.length - ci); spans.push({ c, i: ci, w: xs[ci + sp] - xs[ci] }); ci += sp; });
    let lines = 1;
    spans.forEach(s => { s.lines = wrap(s.c.v, s.w - 2 * PAD, FS, boldOf(s.c.s)); lines = Math.max(lines, s.lines.length); });
    const hgt = lines * LH + 2 * PAD;
    if (doc.y + hgt > doc.H - doc.M - 16) { doc.newPage(); return { broke: true, hgt: 0 }; }
    spans.forEach(s => {
      const f = fillOf(s.c.s);
      if (f) doc.rect(xs[s.i], doc.y, s.w, hgt, f);
    });
    doc.line(doc.M, doc.y, doc.M + CW, doc.y, 0.35);
    doc.line(doc.M, doc.y + hgt, doc.M + CW, doc.y + hgt, 0.35);
    spans.forEach(s => { doc.line(xs[s.i], doc.y, xs[s.i], doc.y + hgt, 0.55); });
    doc.line(doc.M + CW, doc.y, doc.M + CW, doc.y + hgt, 0.55);
    spans.forEach(s => {
      s.lines.forEach((ln, k) => doc.text(ln, xs[s.i] + PAD, doc.y + PAD + k * LH, FS, boldOf(s.c.s), colorOf(s.c.s), s.c.a, s.w - 2 * PAD));
    });
    doc.y += hgt;
    return { broke: false, hgt: hgt };
  }
  function drawTable(b) {
    const xs = colXs(b.widths);
    const headRow = b.head ? b.head.map(c => C(c.v, "th", c.a, c.span)) : null;
    const titleRow = b.title ? [C(b.title, "hd", "c", b.widths.length)] : null;
    if (doc.y + 42 > doc.H - doc.M - 16) doc.newPage();
    if (titleRow) drawRow(titleRow, b.widths, xs);
    if (headRow) drawRow(headRow, b.widths, xs);
    b.rows.forEach(row => {
      const before = doc.y;
      let res = drawRow(row, b.widths, xs);
      if (res.broke) { if (headRow) drawRow(headRow, b.widths, xs); drawRow(row, b.widths, xs); }
    });
    doc.y += 5;
  }
  function drawPhotos(b) {
    doc.newPage();
    const xs = colXs([50, 50]);
    drawRow([C(b.title, "hd", "c", 2)], [50, 50], xs);
    const cw = CW / 2 - 4;
    for (let i = 0; i < b.items.length; i += 2) {
      const pair = [b.items[i], b.items[i + 1]].filter(Boolean);
      let ih = 0;
      pair.forEach(x => { const asp = doc.imgAspect(x.bin); ih = Math.max(ih, Math.min(cw / asp, 168)); });
      const capH = Math.max.apply(null, pair.map(x => wrap(x.cap, cw - 4, FS, true).length)) * LH + 2 * PAD;
      if (doc.y + ih + capH + 8 > doc.H - doc.M - 16) { doc.newPage(); drawRow([C(b.title + " (contd.)", "hd", "c", 2)], [50, 50], xs); }
      const yTop = doc.y;
      pair.forEach((x, k) => {
        const asp = doc.imgAspect(x.bin);
        const w = Math.min(cw, ih * asp), h = Math.min(ih, cw / asp);
        const cx = doc.M + k * (CW / 2) + (CW / 2 - w) / 2;
        try { doc.image(x.bin, cx, yTop + 2, w, h); } catch (e) { }
      });
      doc.y = yTop + ih + 4;
      drawRow(pair.map(x => C(x.cap, "grn b", "c")).concat(pair.length === 1 ? [C("", "", "c")] : []), [50, 50], xs);
      doc.y += 4;
    }
  }
  m.blocks.forEach(b => {
    if (b.type === "table") drawTable(b);
    else if (b.type === "photos") drawPhotos(b);
    else if (b.type === "sign") {
      if (doc.y + 46 > doc.H - doc.M - 16) doc.newPage();
      const xs = colXs([34, 33, 33]);
      drawRow(b.cols.map(c => C(c.label, "grn b", "c")), [34, 33, 33], xs);
      drawRow(b.cols.map(() => C("", "", "c")), [34, 33, 33], xs);
      drawRow(b.cols.map(c => C(c.value || " ", "b", "c")), [34, 33, 33], xs);
      doc.y += 6;
      doc.text(m.meta.foot, doc.M, doc.y, 6.4, false, [0.4, 0.4, 0.45], "c", CW);
    }
  });
  return doc.build();
}
function modelToHtml(m) {
  const cls = (c) => (c.s || "").split(" ").filter(x => x && x !== "th").join(" ");
  const cell = (c) => { const tag = c.s.includes("th") ? "th" : "td";
    return "<" + tag + (c.span > 1 ? ' colspan="' + c.span + '"' : "") + ' class="' + cls(c) +
      '" style="text-align:' + ({ l: "left", c: "center", r: "right" }[c.a]) + '">' + esc(c.v).replace(/\n/g, "<br>") + "</" + tag + ">"; };
  let h = '<div class="pr">';
  h += '<table style="margin-bottom:0"><tr>' +
    '<td style="width:16%;text-align:center;padding:6pt"><img src="icons/icon-192.png" style="height:26pt"></td>' +
    '<td style="width:52%;text-align:center;font-size:12pt;font-weight:700">Daily Progress Report<div style="font-size:9.5pt;font-weight:600">' + esc(m.meta.project) + "</div></td>" +
    '<td style="width:32%"><b>Client :</b> ' + esc(m.meta.client) + '<div><b>Date :</b> ' + esc(m.meta.dateText) + '</div><div style="font-size:7.5pt">' + esc(m.meta.scope) + "</div></td></tr></table>";
  m.blocks.forEach(b => {
    if (b.type === "table") {
      h += '<table style="margin-top:5pt">';
      if (b.title) h += '<tr><td class="hd" colspan="' + b.widths.length + '">' + esc(b.title) + "</td></tr>";
      if (b.head) h += "<tr>" + b.head.map((c, i) => '<th style="width:' + b.widths[i] + "%;text-align:" + ({ l: "left", c: "center", r: "right" }[c.a]) + '"' + (c.span > 1 ? ' colspan="' + c.span + '"' : "") + ">" + esc(c.v) + "</th>").join("") + "</tr>";
      b.rows.forEach(row => { h += "<tr>" + row.map(c => cell(c)).join("") + "</tr>"; });
      h += "</table>";
    } else if (b.type === "photos") {
      h += '<table class="brk" style="margin-top:5pt"><tr><td class="hd" colspan="2">' + esc(b.title) + "</td></tr>";
      for (let i = 0; i < b.items.length; i += 2) {
        const a = b.items[i], z = b.items[i + 1];
        h += '<tr class="avoid"><td style="width:50%;padding:2pt"><img class="ph" src="' + a.url + '"></td>' + (z ? '<td style="width:50%;padding:2pt"><img class="ph" src="' + z.url + '"></td>' : "<td></td>") + "</tr>" +
          '<tr class="avoid"><td class="grn" style="text-align:center;font-weight:600">' + esc(a.cap) + "</td>" + (z ? '<td class="grn" style="text-align:center;font-weight:600">' + esc(z.cap) + "</td>" : "<td></td>") + "</tr>";
      }
      h += "</table>";
    } else if (b.type === "sign") {
      h += '<table style="margin-top:8pt"><tr>' + b.cols.map(c => "<td>" + esc(c.label) + "<br><br><b>" + esc(c.value) + "</b></td>").join("") + "</tr></table>";
    }
  });
  h += '<div style="margin-top:6pt;font-size:7pt;text-align:center">' + esc(m.meta.foot) + " · " + esc(m.meta.rev) + "</div></div>";
  return h;
}

/* ---------------- logo for the PDF header ----------------
   The PDF embeds JPEG only, so the mark is fetched once and kept as a
   binary string for the page-header draw. */
async function loadLogoBin() {
  if (window.LOGO_BIN) return;
  try {
    const r = await fetch("icons/pdf-logo.jpg");
    if (!r.ok) return;
    window.LOGO_BIN = await blobToBinary(await r.blob());
  } catch (e) { /* header simply renders without the mark */ }
}

/* ---------------- build + deliver ---------------- */
async function buildDPR(d) { return modelToHtml(await dprModel(d)); }

async function makeDPRBlob(d) {
  await loadLogoBin();
  syncSnapshot(d);
  const m = await dprModel(d || DB.curDate);
  const blob = modelToPdf(m);
  (m.blocks.find(b => b.type === "photos") || { items: [] }).items.forEach(x => { try { URL.revokeObjectURL(x.url); } catch (e) { } });
  return blob;
}
function dprFilename(d) {
  const p = P();
  return "DPR_" + slug(p.name, 28) + "_" + (d || DB.curDate) + (DB.settings.showRates ? "_INTERNAL" : "") + ".pdf";
}
async function exportPDF(d) {
  const p = P(); if (!p) return;
  d = d || DB.curDate;
  await saveDB(true);
  busy(true, "Building PDF…");
  try {
    const blob = await makeDPRBlob(d);
    busy(false);
    const name = dprFilename(d);
    const how = await shareOrDownload(name, blob,
      "DPR " + p.name + " " + fmtD(d),
      "Daily Progress Report — " + p.name + " — " + fmtD(d));
    if (how === "shared") toast("Shared");
    else if (how === "downloaded") toast("PDF saved (" + kb(blob.size) + ")");
  } catch (e) {
    busy(false);
    toast("PDF failed: " + e.message, true);
  }
}
