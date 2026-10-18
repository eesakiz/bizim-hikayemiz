// Small shared helpers (no dependencies).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Escape, then turn line breaks into <br> (for user-written multi-line text).
export function nl2br(s) {
  return esc(s).replace(/\r?\n/g, "<br>");
}

export function uid(prefix = "") {
  const a = new Uint8Array(8); crypto.getRandomValues(a);
  return prefix + Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
}

export function debounce(fn, ms = 500) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// ---------- Dates (Turkish) ----------
export const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
export const MONTHS_TR_SHORT = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
export const DAYS_TR = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
export const DAYS_TR_SHORT = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"]; // Monday-first

// Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" as LOCAL time (never UTC).
export function parseLocal(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  if (typeof s === "number") return new Date(s);
  if (typeof s === "object" && typeof s.toDate === "function") return s.toDate(); // Firestore Timestamp
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

export function toISODate(d) {
  d = parseLocal(d); if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function toISODateTime(d) {
  d = parseLocal(d); if (!d) return "";
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDate(s, opts = {}) {
  const d = parseLocal(s); if (!d) return "";
  const day = d.getDate(), mon = MONTHS_TR[d.getMonth()], yr = d.getFullYear();
  let out = `${day} ${mon}${opts.noYear ? "" : " " + yr}`;
  if (opts.weekday) out = `${out}, ${DAYS_TR[d.getDay()]}`;
  return out;
}
export function fmtTime(s) {
  const d = parseLocal(s); if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}
export function fmtDateTime(s) {
  const d = parseLocal(s); if (!d) return "";
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

export function relTime(s) {
  const d = parseLocal(s); if (!d) return "";
  const diff = Date.now() - d.getTime(); const m = Math.round(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60); if (h < 24) return `${h} sa önce`;
  const dd = Math.round(h / 24); if (dd < 7) return `${dd} gün önce`;
  return fmtDate(d, { noYear: d.getFullYear() === new Date().getFullYear() });
}

export function daysBetween(a, b = new Date()) {
  const da = parseLocal(a), db = parseLocal(b);
  const A = new Date(da.getFullYear(), da.getMonth(), da.getDate());
  const B = new Date(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((B - A) / 86400000);
}

// Full elapsed breakdown between two dates (years, months, days, h, m, s).
export function elapsed(from, to = new Date()) {
  const a = parseLocal(from), b = parseLocal(to);
  let ms = b - a; if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  // calendar months/days
  let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
  if (d < 0) { m -= 1; const prev = new Date(b.getFullYear(), b.getMonth(), 0); d += prev.getDate(); }
  if (m < 0) { y -= 1; m += 12; }
  return { days, hours, minutes, seconds, totalSeconds, weeks: Math.floor(days / 7), years: y, months: m, calDays: d, totalMonths: y * 12 + m };
}

// Next occurrence of a (possibly recurring) date.
export function nextOccurrence(dateStr, recurrence = "none", time = "", now = new Date()) {
  const base = parseLocal(dateStr + (time ? "T" + time : "T00:00"));
  if (!base) return null;
  if (recurrence === "yearly") {
    let d = new Date(now.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), base.getMinutes());
    if (d <= now) d = new Date(now.getFullYear() + 1, base.getMonth(), base.getDate(), base.getHours(), base.getMinutes());
    return d;
  }
  if (recurrence === "monthly") {
    let d = new Date(now.getFullYear(), now.getMonth(), base.getDate(), base.getHours(), base.getMinutes());
    if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, base.getDate(), base.getHours(), base.getMinutes());
    return d;
  }
  return base;
}

export function plural(n, one, many = one) { return `${n} ${n === 1 ? one : many}`; }

// Turkish-aware "lower" for comparisons
export function trLower(s) { return String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase(); }

// ---------- Media ----------
export function readFileAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}

export function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

// Resize/compress an image file to a JPEG data URL under targetKB (approx).
export async function compressImage(file, { maxSide = 1600, targetKB = 330, quality = 0.86 } = {}) {
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { bitmap = await loadImage(await readFileAsDataURL(file)); }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0, w, h);
  let q = quality, out = canvas.toDataURL("image/jpeg", q);
  while (out.length * 0.75 / 1024 > targetKB && q > 0.5) { q -= 0.07; out = canvas.toDataURL("image/jpeg", q); }
  return { dataUrl: out, w, h };
}

// Try to read EXIF DateTimeOriginal from a JPEG file -> "YYYY-MM-DDTHH:MM" or "".
export async function readExifDate(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return "";
    let off = 2;
    while (off < v.byteLength - 4) {
      const marker = v.getUint16(off); const len = v.getUint16(off + 2);
      if (marker === 0xFFE1) {
        const start = off + 4;
        if (v.getUint32(start) !== 0x45786966) { off += 2 + len; continue; } // "Exif"
        const tiff = start + 6; const little = v.getUint16(tiff) === 0x4949;
        const u16 = (p) => v.getUint16(p, little), u32 = (p) => v.getUint32(p, little);
        const readIFD = (p) => {
          const n = u16(p); const tags = {};
          for (let i = 0; i < n; i++) { const e = p + 2 + i * 12; tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), valOff: e + 8 }; }
          return tags;
        };
        const readAscii = (t) => { const p = t.count > 4 ? tiff + u32(t.valOff) : t.valOff; let s = ""; for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
        const ifd0 = readIFD(tiff + u32(tiff + 4));
        let dt = ifd0[0x0132] ? readAscii(ifd0[0x0132]) : "";
        if (ifd0[0x8769]) { const exif = readIFD(tiff + u32(ifd0[0x8769].valOff)); if (exif[0x9003]) dt = readAscii(exif[0x9003]); }
        const m = dt.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/);
        return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : "";
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      off += 2 + len;
    }
  } catch { /* ignore */ }
  return "";
}

// ---------- Links ----------
export function spotifyInfo(url) {
  const m = String(url || "").match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|playlist|album|episode)\/([A-Za-z0-9]+)/);
  if (m) return { type: m[1], id: m[2] };
  const u = String(url || "").match(/^spotify:(track|playlist|album):([A-Za-z0-9]+)$/);
  if (u) return { type: u[1], id: u[2] };
  return null;
}

// Extract lat/lng from a Google Maps URL or "lat, lng" text.
export function parseLatLng(s) {
  s = String(s || "").trim();
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = s.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/); if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}

export function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type }); const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------- Icons (inline SVG, currentColor) ----------
const I = (d, extra = "") => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icons = {
  heart: I('<path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.4 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.8 3.4 4.5 6.7C19.5 16.4 12 21 12 21z"/>'),
  heartFill: I('<path fill="currentColor" stroke="none" d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.4 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.8 3.4 4.5 6.7C19.5 16.4 12 21 12 21z"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  pencil: I('<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  up: I('<path d="M6 15l6-6 6 6"/>'),
  down: I('<path d="M6 9l6 6 6-6"/>'),
  left: I('<path d="M15 6l-6 6 6 6"/>'),
  right: I('<path d="M9 6l6 6-6 6"/>'),
  bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  moon: I('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  palette: I('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/><path d="M12 21c-1.5-2 .5-3.5 2-3.5h2.5a3 3 0 0 0 0-6"/>'),
  camera: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  mail: I('<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>'),
  music: I('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>'),
  pin: I('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  calendar: I('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  list: I('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
  check: I('<path d="M5 12l5 5L20 7"/>'),
  star: I('<path d="M12 3l2.7 6 6.3.6-4.8 4.2 1.5 6.2L12 16.8 6.3 20l1.5-6.2L3 9.6 9.3 9z"/>'),
  sparkle: I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>'),
  book: I('<path d="M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  ring: I('<circle cx="12" cy="14" r="6"/><path d="M9 6l3-3 3 3-3 2z"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  unlock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
  play: I('<path fill="currentColor" stroke="none" d="M8 5v14l11-7z"/>'),
  external: I('<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  download: I('<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>'),
  upload: I('<path d="M12 15V4M7 9l5-5 5 5M4 20h16"/>'),
  logout: I('<path d="M10 4H5v16h5M14 8l5 4-5 4M19 12H9"/>'),
  quote: I('<path d="M7 7h4v5H7zM13 7h4v5h-4zM7 12c0 3-1 4-3 5M13 12c0 3-1 4-3 5"/>'),
  seal: I('<circle cx="12" cy="12" r="8"/><path d="M12 8l1.2 2.5 2.8.4-2 2 .5 2.8L12 14.4 9.5 15.7l.5-2.8-2-2 2.8-.4z"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  grid: I('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
  shuffle: I('<path d="M4 7h3l10 10h3M20 17l-3 3M20 17l-3-3M4 17h3l3-3M14 7h3l3 3M20 7l-3-3"/>'),
  send: I('<path d="M4 12l16-8-6 16-2-6z"/>'),
  eye: I('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  flag: I('<path d="M5 21V4h12l-2 4 2 4H5"/>'),
  wallet: I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7"/>'),
  home: I('<path d="M4 11l8-7 8 7v9H4z"/>'),
};
