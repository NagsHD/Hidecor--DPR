/* ============================================================
   PDF writer — a real A4 PDF with no external library.
   Base-14 Helvetica (nothing to embed), JPEG photos via DCTDecode.
   Images are passed in as raw binary strings read from Blobs.
   ============================================================ */
"use strict";
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
function pdfSafe(s) {
  return String(s == null ? "" : s)
    .replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/·/g, "-").replace(/⚠/g, "!").replace(/×/g, "x").replace(/•/g, "-").replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, " ");
}
function tw(s, size, bold) {
  const t = pdfSafe(s); const T = bold ? HB : HW; let w = 0;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i) - 32; w += (c >= 0 && c < T.length ? T[c] : 556); }
  return w * size / 1000;
}
function wrap(s, width, size, bold) {
  const words = pdfSafe(s).split(/\s+/).filter(x => x !== "");
  if (!words.length) return [""];
  const out = []; let line = "";
  words.forEach(w => {
    let cand = line ? line + " " + w : w;
    if (tw(cand, size, bold) <= width) { line = cand; return; }
    if (line) out.push(line);
    if (tw(w, size, bold) <= width) { line = w; return; }
    let chunk = "";
    for (const ch of w) { if (tw(chunk + ch, size, bold) > width) { out.push(chunk); chunk = ch; } else chunk += ch; }
    line = chunk;
  });
  if (line) out.push(line);
  return out;
}
function jpegInfo(bin) {
  let i = 2;
  while (i < bin.length) {
    if (bin.charCodeAt(i) !== 0xFF) { i++; continue; }
    const m = bin.charCodeAt(i + 1);
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = (bin.charCodeAt(i + 2) << 8) | bin.charCodeAt(i + 3);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: (bin.charCodeAt(i + 5) << 8) | bin.charCodeAt(i + 6), w: (bin.charCodeAt(i + 7) << 8) | bin.charCodeAt(i + 8), comp: bin.charCodeAt(i + 9), bin: bin };
    }
    i += 2 + len;
  }
  return null;
}
function PDF(opts) {
  opts = opts || {};
  const W = 595.28, H = 841.89, M = opts.margin || 22;
  const pages = []; let cur = null, y = 0;
  const imgs = []; const seen = {}; const st = { header: null, footer: null };
  const api = {
    W, H, M, get y() { return y; }, set y(v) { y = v; },
    get width() { return W - 2 * M; },
    newPage() {
      cur = { ops: [] }; pages.push(cur); y = M;
      if (st.header) st.header(api);
      return cur;
    },
    space() { return H - M - 26 - y; },
    need(h) { if (!cur || y + h > H - M - 22) { api.newPage(); return true; } return false; },
    rect(x, yy, w, h, fill) { cur.ops.push(fill.join(" ") + " rg " + f(x) + " " + f(H - yy - h) + " " + f(w) + " " + f(h) + " re f"); },
    line(x1, y1, x2, y2, gray, lw) { cur.ops.push((gray == null ? 0.25 : gray) + " G " + (lw || 0.5) + " w " + f(x1) + " " + f(H - y1) + " m " + f(x2) + " " + f(H - y2) + " l S"); },
    text(s, x, yy, size, bold, color, align, boxW) {
      const t = pdfSafe(s); if (!t) return;
      let xx = x;
      if (align === "c") xx = x + (boxW - tw(t, size, bold)) / 2;
      if (align === "r") xx = x + boxW - tw(t, size, bold);
      cur.ops.push("BT " + (color || [0, 0, 0]).join(" ") + " rg /" + (bold ? "F2" : "F1") + " " + size + " Tf " + f(xx) + " " + f(H - yy - size) + " Td (" + t.replace(/[\\()]/g, c => "\\" + c) + ") Tj ET");
    },
    image(bin, x, yy, w, h) {
      let id = seen[bin];
      if (!id) {
        const info = jpegInfo(bin); if (!info) return false;
        id = "I" + (imgs.length + 1); seen[bin] = id;
        imgs.push({ id, data: info.bin, w: info.w, h: info.h, gray: info.comp === 1 });
      }
      cur.ops.push("q " + f(w) + " 0 0 " + f(h) + " " + f(x) + " " + f(H - yy - h) + " cm /" + id + " Do Q");
      return true;
    },
    imgAspect(bin) { const i = jpegInfo(bin); return i ? i.w / i.h : 1.4; },
    onHeader(fn) { st.header = fn; },
    build() {
      const objs = []; const add = (s) => { objs.push(s); return objs.length; };
      const fontN = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
      const fontB = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
      const imgN = {};
      imgs.forEach(im => {
        imgN[im.id] = add("<< /Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h +
          " /ColorSpace /Device" + (im.gray ? "Gray" : "RGB") + " /BitsPerComponent 8 /Filter /DCTDecode /Length " + im.data.length + " >>\nstream\n" + im.data + "\nendstream");
      });
      const total = pages.length;
      const pageIds = []; const contentIds = [];
      pages.forEach((p, i) => {
        const c = p.ops.join("\n");
        contentIds.push(add("<< /Length " + c.length + " >>\nstream\n" + c + "\nendstream"));
      });
      const pagesId = objs.length + pages.length + 1;
      pages.forEach((p, i) => {
        const xo = imgs.length ? " /XObject << " + imgs.map(im => "/" + im.id + " " + imgN[im.id] + " 0 R").join(" ") + " >>" : "";
        pageIds.push(add("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + f(W) + " " + f(H) + "] /Resources << /Font << /F1 " + fontN + " 0 R /F2 " + fontB + " 0 R >>" + xo + " >> /Contents " + contentIds[i] + " 0 R >>"));
      });
      const pid = add("<< /Type /Pages /Count " + total + " /Kids [" + pageIds.map(i => i + " 0 R").join(" ") + "] >>");
      const info = add("<< /Title (" + pdfSafe(opts.title || "Daily Progress Report").replace(/[\\()]/g, c => "\\" + c) + ") /Author (" + pdfSafe(opts.author || "HIDECOR") + ") /Creator (HIDECOR SiteLog) >>");
      const cat = add("<< /Type /Catalog /Pages " + pid + " 0 R >>");
      let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
      const xref = out.length;
      out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
      offs.forEach(o => { out += String(o).padStart(10, "0") + " 00000 n \n"; });
      out += "trailer\n<< /Size " + (objs.length + 1) + " /Root " + cat + " 0 R /Info " + info + " 0 R >>\nstartxref\n" + xref + "\n%%EOF";
      const u8 = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 0xFF;
      return new Blob([u8], { type: "application/pdf" });
    }
  };
  function f(n) { return (Math.round(n * 100) / 100).toString(); }
  return api;
}
