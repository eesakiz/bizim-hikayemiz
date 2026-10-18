// UI primitives: modals, forms (with autosave), toasts, confirm, lightbox, pickers.
import { esc, icons, debounce, uid, $, $$ } from "./util.js";

const layer = () => { let l = $("#modal-layer"); if (!l) { l = document.createElement("div"); l.id = "modal-layer"; document.body.appendChild(l); } return l; };

export function toast(msg, { type = "", ms = 2600 } = {}) {
  let host = $("#toast-host"); if (!host) { host = document.createElement("div"); host.id = "toast-host"; document.body.appendChild(host); }
  const t = document.createElement("div"); t.className = `toast ${type}`; t.innerHTML = msg; host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, ms);
}

export function openModal({ title = "", subtitle = "", content, actions = [], size = "md", onClose, closable = true, cls = "" } = {}) {
  const host = layer();
  const back = document.createElement("div"); back.className = "modal-back";
  const box = document.createElement("div"); box.className = `modal ${size} ${cls}`; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  box.innerHTML = `
    <div class="modal-head">
      <div><div class="modal-title">${title}</div>${subtitle ? `<div class="modal-sub">${subtitle}</div>` : ""}</div>
      ${closable ? `<button class="icon-btn modal-close" aria-label="Kapat">${icons.close}</button>` : ""}
    </div>
    <div class="modal-body"></div>
    <div class="modal-actions"></div>`;
  const body = $(".modal-body", box);
  if (typeof content === "string") body.innerHTML = content; else if (content) body.appendChild(content);
  const act = $(".modal-actions", box);
  for (const a of actions) {
    const b = document.createElement("button"); b.className = `btn ${a.cls || ""}`; b.innerHTML = a.label; b.type = "button";
    b.addEventListener("click", async () => { b.disabled = true; try { const r = await a.onClick?.(api); if (r !== false && a.close !== false) api.close(a.result); } finally { b.disabled = false; } });
    act.appendChild(b);
  }
  if (!actions.length) act.remove();
  back.appendChild(box); host.appendChild(back);
  document.body.classList.add("modal-open");
  let resolved = false; let resolveFn;
  const done = new Promise(r => resolveFn = r);
  const api = {
    el: box, body, back, done,
    close(result) { if (resolved) return; resolved = true; back.classList.add("out"); setTimeout(() => { back.remove(); if (!host.children.length) document.body.classList.remove("modal-open"); }, 220); onClose?.(result); resolveFn(result); },
  };
  if (closable) {
    $(".modal-close", box)?.addEventListener("click", () => api.close(null));
    back.addEventListener("click", (e) => { if (e.target === back) api.close(null); });
    const esc = (e) => { if (e.key === "Escape") { api.close(null); document.removeEventListener("keydown", esc); } }; document.addEventListener("keydown", esc);
  }
  requestAnimationFrame(() => back.classList.add("in"));
  return api;
}

export function confirmDialog(message, { ok = "Evet", cancel = "Vazgeç", danger = false, title = "Emin misin?" } = {}) {
  return new Promise((res) => {
    openModal({
      title, size: "sm", content: `<p class="confirm-text">${message}</p>`,
      actions: [{ label: cancel, cls: "ghost", onClick: () => { res(false); } }, { label: ok, cls: danger ? "danger" : "primary", onClick: () => { res(true); } }],
      onClose: (r) => { if (r === null) res(false); },
    });
  });
}

/* ------------------------------------------------------------------ Forms */
// field: {key, label, type, value, options, placeholder, help, rows, required, half, min, max, step, accept}
// types: text, textarea, date, datetime, time, number, select, checkbox, color, url, emoji, photo, seal, tags, person
export function openForm({ title, subtitle, fields, value = {}, autosave = false, onSave, onDelete, saveLabel = "Kaydet", deleteLabel = "Sil", size = "md", ctx = {} }) {
  const values = { ...value };
  const form = document.createElement("form"); form.className = "form"; form.noValidate = true;
  form.addEventListener("submit", (e) => e.preventDefault());
  for (const f of fields) form.appendChild(renderField(f, values, ctx));
  const status = document.createElement("div"); status.className = "form-status";
  let dirty = false, saving = false, closedPromise;
  const doSave = async (closing = false) => {
    if (!onSave) return true;
    if (!validate(fields, values, form)) return false;
    saving = true; status.textContent = "Kaydediliyor…"; status.className = "form-status saving";
    try { await onSave(values, { closing }); dirty = false; status.textContent = "Kaydedildi ✓"; status.className = "form-status saved"; return true; }
    catch (e) { console.error(e); status.textContent = "Kaydedilemedi: " + (e.message || e); status.className = "form-status error"; toast("Kaydedilemedi", { type: "error" }); return false; }
    finally { saving = false; }
  };
  const autosaver = debounce(() => { if (dirty) doSave(false); }, 700);
  form.addEventListener("input", (e) => { collect(fields, values, form, e.target); dirty = true; if (autosave) { status.textContent = "Değişti…"; status.className = "form-status"; autosaver(); } });
  form.addEventListener("change", (e) => { collect(fields, values, form, e.target); dirty = true; if (autosave) autosaver(); });
  form.addEventListener("bh:fieldchange", () => { dirty = true; if (autosave) autosaver(); });

  const actions = [];
  if (onDelete) actions.push({ label: `${icons.trash} ${deleteLabel}`, cls: "danger ghost left", close: false, onClick: async (m) => { if (await confirmDialog("Bu öğe kalıcı olarak silinecek.", { ok: "Sil", danger: true })) { await onDelete(); m.close("deleted"); } } });
  actions.push({ label: autosave ? "Kapat" : "Vazgeç", cls: "ghost", onClick: () => { } });
  actions.push({ label: autosave ? "Tamam" : saveLabel, cls: "primary", close: false, onClick: async (m) => { if (dirty || !autosave) { const ok = await doSave(true); if (!ok) return false; } m.close(values); } });
  const wrap = document.createElement("div"); wrap.appendChild(form); wrap.appendChild(status);
  const m = openModal({ title, subtitle, content: wrap, actions, size, cls: "form-modal", onClose: () => { if (autosave && dirty && !saving) doSave(true); } });
  setTimeout(() => { const first = form.querySelector("input:not([type=hidden]):not([type=checkbox]), textarea, select"); first && first.focus(); }, 60);
  return m.done;
}

function validate(fields, values, form) {
  let ok = true;
  for (const f of fields) {
    const el = form.querySelector(`[data-field="${f.key}"]`); if (!el) continue;
    const v = values[f.key]; const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
    el.classList.toggle("invalid", !!(f.required && empty)); if (f.required && empty) ok = false;
  }
  if (!ok) toast("Zorunlu alanları doldur", { type: "error" });
  return ok;
}

function collect(fields, values, form, target) {
  for (const f of fields) {
    const el = form.querySelector(`[name="${f.key}"]`); if (!el) continue;
    if (f.type === "checkbox") values[f.key] = el.checked;
    else if (f.type === "number") values[f.key] = el.value === "" ? null : Number(el.value);
    else if (f.type === "tags") values[f.key] = el.value.split(",").map(s => s.trim()).filter(Boolean);
    else values[f.key] = el.value;
  }
}

function renderField(f, values, ctx) {
  const wrap = document.createElement("label"); wrap.className = `field ${f.half ? "half" : ""} type-${f.type || "text"}`; wrap.dataset.field = f.key;
  const v = values[f.key] ?? f.value ?? "";
  const lab = f.label ? `<span class="field-label">${esc(f.label)}${f.required ? " *" : ""}</span>` : "";
  const help = f.help ? `<span class="field-help">${f.help}</span>` : "";
  const t = f.type || "text";
  if (t === "textarea") wrap.innerHTML = `${lab}<textarea name="${f.key}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>${help}`;
  else if (t === "select") wrap.innerHTML = `${lab}<select name="${f.key}">${(f.options || []).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>${help}`;
  else if (t === "checkbox") { wrap.className += " check"; wrap.innerHTML = `<input type="checkbox" name="${f.key}" ${v ? "checked" : ""}><span class="field-label">${esc(f.label)}</span>${help}`; }
  else if (t === "emoji") {
    const EMO = f.options || ["💍", "💒", "🎂", "❤️", "💌", "✨", "🌙", "⭐", "🌸", "🌹", "☕", "✈️", "🏠", "🎉", "🕌", "📸", "🎶", "🗓️", "🌅", "🚆", "🍰", "🎁", "💐", "🕯️", "🌊", "🏔️", "🐾", "📍", "💑", "🥂"];
    wrap.innerHTML = `${lab}<div class="emoji-row"><input type="text" name="${f.key}" value="${esc(v)}" maxlength="4" class="emoji-input" placeholder="✨"><div class="emoji-grid">${EMO.map(e => `<button type="button" class="emoji-opt" data-e="${e}">${e}</button>`).join("")}</div></div>${help}`;
    wrap.addEventListener("click", (e) => { const b = e.target.closest(".emoji-opt"); if (!b) return; e.preventDefault(); const inp = wrap.querySelector("input"); inp.value = b.dataset.e; values[f.key] = b.dataset.e; inp.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  else if (t === "seal") {
    const COLORS = f.options || ["#b3263a", "#e3c27a", "#7a4ab3", "#2a7a6b", "#c86b4a", "#2f5fb3", "#d4698a", "#3c3c3c"];
    wrap.innerHTML = `${lab}<div class="seal-row">${COLORS.map(c => `<button type="button" class="seal-opt ${c === v ? "sel" : ""}" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}<input type="hidden" name="${f.key}" value="${esc(v)}"></div>${help}`;
    wrap.addEventListener("click", (e) => { const b = e.target.closest(".seal-opt"); if (!b) return; e.preventDefault(); $$(".seal-opt", wrap).forEach(x => x.classList.toggle("sel", x === b)); const inp = wrap.querySelector("input"); inp.value = b.dataset.c; values[f.key] = b.dataset.c; wrap.dispatchEvent(new CustomEvent("bh:fieldchange", { bubbles: true })); });
  }
  else if (t === "photo") {
    const photos = ctx.photos || [];
    const render = () => { const p = photos.find(x => x.id === values[f.key]); wrap.innerHTML = `${lab}<div class="photo-field">${p ? `<img src="${p.thumb}" alt="">` : `<div class="photo-empty">${icons.camera}</div>`}<div class="photo-field-btns"><button type="button" class="btn small ghost pick">Fotoğraf seç</button>${p ? `<button type="button" class="btn small ghost clear">Kaldır</button>` : ""}</div><input type="hidden" name="${f.key}" value="${esc(values[f.key] || "")}"></div>${help}`; };
    render();
    wrap.addEventListener("click", async (e) => {
      if (e.target.closest(".pick")) { e.preventDefault(); const id = await pickPhoto(photos, values[f.key]); if (id !== undefined) { values[f.key] = id || ""; render(); wrap.dispatchEvent(new CustomEvent("bh:fieldchange", { bubbles: true })); } }
      if (e.target.closest(".clear")) { e.preventDefault(); values[f.key] = ""; render(); wrap.dispatchEvent(new CustomEvent("bh:fieldchange", { bubbles: true })); }
    });
  }
  else if (t === "person") {
    const people = ctx.people || [];
    wrap.innerHTML = `${lab}<select name="${f.key}">${[{ value: "", label: "—" }, ...people.map(p => ({ value: p.key, label: p.name })), ...(f.allowBoth ? [{ value: "both", label: "İkimiz" }] : [])].map(o => `<option value="${o.value}" ${o.value === v ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>${help}`;
  }
  else if (t === "tags") wrap.innerHTML = `${lab}<input type="text" name="${f.key}" value="${esc(Array.isArray(v) ? v.join(", ") : v)}" placeholder="${esc(f.placeholder || "virgülle ayır")}">${help}`;
  else {
    const type = t === "datetime" ? "datetime-local" : t;
    const extra = [f.min != null ? `min="${f.min}"` : "", f.max != null ? `max="${f.max}"` : "", f.step != null ? `step="${f.step}"` : ""].join(" ");
    wrap.innerHTML = `${lab}<input type="${type}" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${extra} ${t === "color" ? 'class="color-input"' : ""}>${help}`;
  }
  return wrap;
}

/* ------------------------------------------------------------- Photo picker */
export function pickPhoto(photos, current) {
  return new Promise((res) => {
    const grid = document.createElement("div"); grid.className = "pick-grid";
    grid.innerHTML = photos.map(p => `<button type="button" class="pick-item ${p.id === current ? "sel" : ""}" data-id="${p.id}"><img src="${p.thumb}" alt="" loading="lazy"></button>`).join("") || `<p class="muted">Henüz fotoğraf yok. Önce galeriye fotoğraf ekle.</p>`;
    const m = openModal({ title: "Fotoğraf seç", content: grid, size: "lg", actions: [{ label: "Fotoğrafsız", cls: "ghost", onClick: () => res("") }], onClose: (r) => { if (r === null) res(undefined); } });
    grid.addEventListener("click", (e) => { const b = e.target.closest(".pick-item"); if (!b) return; res(b.dataset.id); m.close(b.dataset.id); });
  });
}

/* ----------------------------------------------------------------- Lightbox */
export function openLightbox(photos, index, { getFull, onEdit } = {}) {
  let i = index; const cache = new Map();
  const box = document.createElement("div"); box.className = "lightbox";
  box.innerHTML = `
    <button class="lb-close icon-btn" aria-label="Kapat">${icons.close}</button>
    <button class="lb-nav prev icon-btn" aria-label="Önceki">${icons.left}</button>
    <button class="lb-nav next icon-btn" aria-label="Sonraki">${icons.right}</button>
    <figure class="lb-fig"><div class="lb-img-wrap"><img class="lb-img" alt=""><div class="lb-spin"></div></div><figcaption class="lb-cap"></figcaption></figure>`;
  document.body.appendChild(box); document.body.classList.add("modal-open");
  const img = $(".lb-img", box), cap = $(".lb-cap", box), spin = $(".lb-spin", box);
  const show = async () => {
    const p = photos[i]; if (!p) return;
    img.src = p.thumb; img.classList.add("blur"); spin.style.display = "block";
    cap.innerHTML = `<div class="lb-cap-text">${esc(p.caption || "")}</div><div class="lb-cap-meta">${[p.date ? fmtShort(p.date) : "", p.place || ""].filter(Boolean).map(esc).join(" · ")}</div>${onEdit ? `<button class="btn small ghost lb-edit">${icons.pencil} Düzenle</button>` : ""}<div class="lb-count">${i + 1} / ${photos.length}</div>`;
    let full = cache.get(p.id);
    if (!full && getFull) { try { const f = await getFull(p.id); full = f?.data; if (full) cache.set(p.id, full); } catch (e) { console.warn(e); } }
    if (photos[i] !== p) return;
    if (full) { await new Promise(r => { const t = new Image(); t.onload = r; t.onerror = r; t.src = full; }); if (photos[i] === p) img.src = full; }
    img.classList.remove("blur"); spin.style.display = "none";
    // preload neighbours
    for (const j of [i + 1, i - 1]) { const q = photos[j]; if (q && getFull && !cache.has(q.id)) getFull(q.id).then(f => f?.data && cache.set(q.id, f.data)).catch(() => { }); }
  };
  const close = () => { box.remove(); if (!$("#modal-layer")?.children.length) document.body.classList.remove("modal-open"); document.removeEventListener("keydown", keys); };
  const go = (d) => { i = (i + d + photos.length) % photos.length; show(); };
  const keys = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
  document.addEventListener("keydown", keys);
  $(".lb-close", box).onclick = close; $(".prev", box).onclick = () => go(-1); $(".next", box).onclick = () => go(1);
  box.addEventListener("click", (e) => { if (e.target === box || e.target.classList.contains("lb-fig")) close(); if (e.target.closest(".lb-edit")) { onEdit?.(photos[i]); } });
  let sx = 0, sy = 0; box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener("touchend", (e) => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 50 && Math.abs(dy) < 80) go(dx < 0 ? 1 : -1); else if (dy > 90 && Math.abs(dx) < 60) close(); });
  if (photos.length < 2) { $(".prev", box).style.display = "none"; $(".next", box).style.display = "none"; }
  show();
  return { close };
}
function fmtShort(s) { const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); }

/* ------------------------------------------------------------ Edit controls */
// Small toolbar shown on items in edit mode: edit / up / down / delete.
export function itemTools({ edit, up, down, del, extra = "" } = {}) {
  return `<div class="item-tools" data-tools>${extra}${edit ? `<button class="tool" data-act="edit" aria-label="Düzenle">${icons.pencil}</button>` : ""}${up ? `<button class="tool" data-act="up" aria-label="Yukarı">${icons.up}</button>` : ""}${down ? `<button class="tool" data-act="down" aria-label="Aşağı">${icons.down}</button>` : ""}${del ? `<button class="tool danger" data-act="del" aria-label="Sil">${icons.trash}</button>` : ""}</div>`;
}

export function addButton(label = "Ekle", cls = "") { return `<button class="btn add-btn ${cls}" data-act="add">${icons.plus} ${esc(label)}</button>`; }

export function emptyState(text, sub = "") { return `<div class="empty">${icons.sparkle}<p>${text}</p>${sub ? `<p class="muted small">${sub}</p>` : ""}</div>`; }

// Section header helper
export function sectionHead(id, kicker, title, lead = "", right = "") {
  return `<header class="sec-head"><div><div class="kicker">${kicker}</div><h2 class="sec-title" id="${id}-title">${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ""}</div>${right ? `<div class="sec-right">${right}</div>` : ""}</header>`;
}

export { uid };
