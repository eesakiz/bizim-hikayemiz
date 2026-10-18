// App bootstrap: PIN gate → auth → live data → sections.
import { FIREBASE_CONFIG, AUTH } from "./config.js";
import { Store, FirebaseAdapter, LocalAdapter } from "./store.js";
import { $, $$, esc, icons, debounce, relTime, toISODate } from "./util.js";
import { Ambient, burst } from "./particles.js";
import { openModal, toast, confirmDialog } from "./ui.js";
import * as hero from "./sections/hero.js";
import * as story from "./sections/story.js";
import * as timeline from "./sections/timeline.js";
import * as gallery from "./sections/gallery.js";
import * as letters from "./sections/letters.js";
import * as reasons from "./sections/reasons.js";
import * as music from "./sections/music.js";
import * as places from "./sections/places.js";
import * as countdowns from "./sections/countdowns.js";
import * as planning from "./sections/planning.js";
import * as bucket from "./sections/bucket.js";
import * as notes from "./sections/notes.js";
import { openSettings, openBackup, openPinChange, openNotifications, chooseIdentity, THEMES } from "./sections/panels.js";

const SECTIONS = [
  { id: "top", mod: hero, nav: false, deps: ["site", "photos", "places", "countdowns"], cls: "hero" },
  { id: "hikaye", mod: story, label: "Hikâyemiz", icon: "📖", deps: ["site"] },
  { id: "zaman", mod: timeline, label: "Zaman Tüneli", icon: "🕰️", deps: ["timeline", "photos", "site"] },
  { id: "galeri", mod: gallery, label: "Galeri", icon: "📸", deps: ["photos", "site"] },
  { id: "mektuplar", mod: letters, label: "Mektuplar", icon: "💌", deps: ["letters", "site"] },
  { id: "sebepler", mod: reasons, label: "Sebepler", icon: "💛", deps: ["reasons", "site"] },
  { id: "muzik", mod: music, label: "Müzik", icon: "🎶", deps: ["music", "site"] },
  { id: "yerler", mod: places, label: "Yerlerimiz", icon: "🗺️", deps: ["places", "photos", "site"] },
  { id: "takvim", mod: countdowns, label: "Takvim", icon: "🗓️", deps: ["countdowns", "site"] },
  { id: "plan", mod: planning, label: "Planlayıcı", icon: "💍", deps: ["planning", "planmedia", "site", "photos"] },
  { id: "hayaller", mod: bucket, label: "Hayaller", icon: "🌟", deps: ["bucket", "site"] },
  { id: "defter", mod: notes, label: "Not Defteri", icon: "📝", deps: ["notes", "site"] },
];

const state = { store: null, me: localStorage.getItem("bh_me") || "", unlocked: false, ambient: null, lastEventCount: null };

const ctxBase = () => {
  const store = state.store; const site = store.data.site || {};
  const people = [
    { key: "a", name: site.couple?.a?.name || "", full: site.couple?.a?.full || "", bday: site.couple?.a?.bday || "" },
    { key: "b", name: site.couple?.b?.name || "", full: site.couple?.b?.full || "", bday: site.couple?.b?.bday || "" },
  ];
  const me = state.me; const meP = people.find(p => p.key === me); const other = people.find(p => p.key !== me && me);
  const items = [...(store.data.countdowns || [])];
  // birthdays as implicit yearly countdowns
  for (const p of people) if (p.bday) items.push({ id: "bday-" + p.key, title: `${p.name} — doğum günü`, emoji: "🎂", date: p.bday, recurrence: "yearly", kind: "dogumgunu", implicit: true });
  const upcoming = countdowns.computeUpcoming(items, new Date());
  return {
    store, data: store.data, site, people, me, meName: meP?.name || "", otherKey: other?.key || "", otherName: other?.name || "",
    isEditor: store.isEditor, signedIn: store.signedIn, themeDark: isDarkTheme(currentTheme()), upcoming, countdownItems: items,
    notify: (ev) => notify(ev),
  };
};

/* --------------------------------------------------------------- Theme */
function currentTheme() { return localStorage.getItem("bh_theme") || state.store?.data?.site?.theme || "gece"; }
function isDarkTheme(t) { return t === "gece"; }
function applyTheme() {
  const t = currentTheme(); document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a0f1f");
  state.ambient?.setMode({ gece: "stars", romantik: "petals", botanik: "leaves", minimal: "none" }[t] || "none");
}

/* ------------------------------------------------------------- Notify */
async function notify(ev) {
  const store = state.store; const site = store.data.site || {};
  try { await store.addEvent({ type: ev.type, by: state.me, to: ev.to || "", title: ev.title, text: ev.text || "" }); } catch (e) { console.warn("event failed", e); }
  const target = ev.to && site.notify?.[ev.to];
  if (target && (target.ntfy || target.email)) {
    try {
      const body = { topic: target.ntfy || `bh-${ev.to}-${(site.title || "site").toLowerCase().replace(/[^a-z0-9]+/g, "")}`, title: ev.title, message: ev.text || ev.title, tags: ["heart"], click: location.href.split("#")[0] };
      if (target.email) body.email = target.email;
      await fetch("https://ntfy.sh/", { method: "POST", body: JSON.stringify(body) });
    } catch (e) { console.warn("ntfy failed", e); }
  }
}

/* --------------------------------------------------------------- Gate */
function renderGate(onUnlock) {
  const gate = $("#gate"); gate.hidden = false; $("#app").hidden = true;
  const hint = sessionStorage.getItem("bh_hint") || "";
  gate.innerHTML = `
    <div class="gate-inner">
      <div class="gate-mono script">${esc(hint ? "" : "")}<span class="gate-heart">${icons.heartFill}</span></div>
      <h1 class="gate-title">Bizim Hikâyemiz</h1>
      <p class="gate-sub">Devam etmek için şifreyi gir</p>
      <div class="pin-dots" aria-live="polite">${Array.from({ length: AUTH.pinLength }, () => `<span class="pin-dot"></span>`).join("")}</div>
      <p class="gate-hint" data-hint>${esc(hint)}</p>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-k="${n}">${n}</button>`).join("")}<button class="key soft" data-k="hint" aria-label="İpucu">?</button><button class="key" data-k="0">0</button><button class="key soft" data-k="del" aria-label="Sil">⌫</button></div>
      <p class="gate-msg" data-msg></p>
      <p class="gate-foot">${state.store?.kind === "local" ? "yerel mod" : ""}</p>
    </div>`;
  let pin = ""; let busy = false;
  const dots = $$(".pin-dot", gate), msg = $("[data-msg]", gate), hintEl = $("[data-hint]", gate);
  const draw = () => dots.forEach((d, i) => d.classList.toggle("on", i < pin.length));
  const submit = async () => {
    if (busy || pin.length < 4) return; busy = true; gate.classList.add("busy");
    try {
      await state.store.signIn("viewer", pin);
      sessionStorage.setItem("bh_vpin", pin);
      dots.forEach(d => d.classList.add("ok")); msg.textContent = "";
      setTimeout(() => onUnlock(), 350);
    } catch (e) {
      gate.classList.add("shake"); setTimeout(() => gate.classList.remove("shake"), 500);
      msg.textContent = e.kind === "throttled" ? "Çok fazla deneme — biraz bekle." : e.kind === "network" ? "Bağlantı yok gibi görünüyor." : "Olmadı… tekrar dene.";
      pin = ""; draw();
    } finally { busy = false; gate.classList.remove("busy"); }
  };
  gate.onclick = (e) => {
    const k = e.target.closest("[data-k]"); if (!k) return;
    const v = k.dataset.k;
    if (v === "del") { pin = pin.slice(0, -1); draw(); return; }
    if (v === "hint") { hintEl.textContent = hintEl.textContent ? "" : (sessionStorage.getItem("bh_hint") || DEFAULT_HINT); return; }
    if (pin.length >= 8) return;
    pin += v; draw(); msg.textContent = "";
    if (pin.length === AUTH.pinLength) submit();
  };
  document.onkeydown = (e) => { if (gate.hidden) return; if (/^\d$/.test(e.key)) { if (pin.length < 8) { pin += e.key; draw(); if (pin.length === AUTH.pinLength) submit(); } } else if (e.key === "Backspace") { pin = pin.slice(0, -1); draw(); } else if (e.key === "Enter") submit(); };
}
const DEFAULT_HINT = "İlk konuştuğumuz gün — gün ve ay (GGAA)";

/* ---------------------------------------------------------------- App */
async function unlock() {
  const store = state.store; $("#gate").hidden = true; const app = $("#app"); app.hidden = false;
  document.onkeydown = null;
  burst($("#fx"));
  store.start();
  renderShell();
  await waitReady(store);
  const site = store.data.site;
  if (site?.pinHint) sessionStorage.setItem("bh_hint", site.pinHint);
  applyTheme();
  if (!state.me && site?.couple) { const k = await chooseIdentity(ctxBase(), { force: true }); if (k) { state.me = k; localStorage.setItem("bh_me", k); } }
  else if (!state.me) state.needIdentity = true; // ask once the names are known
  renderAll();
  setupObservers();
  presence();
  visitEvent();
  announceNewEvents(); // sets the baseline so only *new* events are announced
  state.unlocked = true;
  emptyNotice();
}

// Shown while the database is still empty (first run).
function emptyNotice() {
  const store = state.store; let n = $("#empty-notice");
  if (store.data.site) { n?.remove(); return; }
  if (!n) { n = document.createElement("div"); n.id = "empty-notice"; n.className = "empty-notice"; document.body.appendChild(n); }
  n.innerHTML = store.isEditor
    ? `<b>Henüz içerik yüklenmedi.</b> Hazır içerik dosyasını yüklemek için <button class="btn primary small" data-import>${icons.upload} Yedekten içe aktar</button>`
    : `<b>Sayfa hazırlanıyor…</b> İçerik henüz yüklenmedi. <span class="muted">Düzenleme PIN'i ile giriş yapıp içeriği içe aktarabilirsin.</span>`;
  n.querySelector("[data-import]")?.addEventListener("click", () => openBackup(ctxBase()));
}

function waitReady(store) {
  return new Promise((res) => { if (store.ready) return res(); const t = setTimeout(res, 6000); const h = () => { if (store.ready) { clearTimeout(t); store.removeEventListener("change", h); res(); } }; store.addEventListener("change", h); });
}

function renderShell() {
  const app = $("#app");
  app.innerHTML = `
    <div class="progress" aria-hidden="true"><i></i></div>
    <header class="topbar">
      <a class="brand" href="#top" data-brand></a>
      <nav class="chips" aria-label="Bölümler">${SECTIONS.filter(s => s.nav !== false).map(s => `<a class="chip-link" href="#${s.id}" data-nav="${s.id}">${s.label}</a>`).join("")}</nav>
      <div class="top-actions">
        <button class="icon-btn" data-bell aria-label="Bildirimler">${icons.bell}<span class="badge-dot" hidden></span></button>
        <button class="icon-btn" data-menu aria-label="Menü">${icons.menu}</button>
      </div>
    </header>
    <main>${SECTIONS.map(s => `<section class="sec ${s.cls || ""} reveal" id="${s.id}" aria-labelledby="${s.id}-title"></section>`).join("")}</main>
    <footer class="foot">
      <div class="foot-line script" data-foot-line></div>
      <div class="foot-actions">
        <button class="btn ghost small" data-theme-btn>${icons.palette} Tema</button>
        <button class="btn ghost small" data-who-btn>${icons.user} <span data-who-name></span></button>
        <button class="btn ghost small" data-edit-btn>${icons.pencil} <span data-edit-label>Düzenleme</span></button>
        <button class="btn ghost small" data-lock-btn>${icons.lock} Kilitle</button>
      </div>
      <div class="foot-editor" data-editor-tools hidden>
        <button class="btn ghost small" data-settings-btn>${icons.settings} Ayarlar</button>
        <button class="btn ghost small" data-backup-btn>${icons.download} Yedek</button>
        <button class="btn ghost small" data-pin-btn>${icons.unlock} PIN değiştir</button>
      </div>
      <p class="foot-small">Sadece ikimiz için. <span data-presence></span></p>
    </footer>
    <div class="menu-overlay" data-menu-overlay hidden>
      <div class="menu-sheet"><div class="menu-head"><span class="brand" data-brand2></span><button class="icon-btn" data-menu-close aria-label="Kapat">${icons.close}</button></div>
        <nav class="menu-list">${SECTIONS.filter(s => s.nav !== false).map(s => `<a href="#${s.id}" data-menu-link><span class="menu-ico">${s.icon}</span>${s.label}</a>`).join("")}</nav>
      </div>
    </div>`;
  app.querySelector("[data-menu]").onclick = () => { app.querySelector("[data-menu-overlay]").hidden = false; document.body.classList.add("modal-open"); };
  const closeMenu = () => { app.querySelector("[data-menu-overlay]").hidden = true; document.body.classList.remove("modal-open"); };
  app.querySelector("[data-menu-close]").onclick = closeMenu;
  app.querySelector("[data-menu-overlay]").onclick = (e) => { if (e.target.hasAttribute("data-menu-overlay") || e.target.closest("[data-menu-link]")) closeMenu(); };
  app.querySelector("[data-bell]").onclick = () => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => { }); openNotifications(ctxBase()).then(updateBell); };
  app.querySelector("[data-theme-btn]").onclick = pickTheme;
  app.querySelector("[data-who-btn]").onclick = async () => { const k = await chooseIdentity(ctxBase()); if (k) { state.me = k; localStorage.setItem("bh_me", k); renderAll(); } };
  app.querySelector("[data-edit-btn]").onclick = toggleEdit;
  app.querySelector("[data-lock-btn]").onclick = lock;
  app.querySelector("[data-settings-btn]").onclick = () => openSettings(ctxBase());
  app.querySelector("[data-backup-btn]").onclick = () => openBackup(ctxBase());
  app.querySelector("[data-pin-btn]").onclick = () => openPinChange(ctxBase());
}

function renderAll() { for (const s of SECTIONS) renderSection(s); updateChrome(); }
const pending = new Set();
function renderSection(s) {
  const el = $("#" + s.id); if (!el) return;
  if (el.contains(document.activeElement) && document.activeElement !== document.body) { pending.add(s.id); return; } // don't clobber typing
  try { s.mod.render(el, ctxBase()); } catch (e) { console.error("render", s.id, e); el.innerHTML = `<div class="empty">Bu bölüm yüklenemedi.</div>`; }
}
document.addEventListener("focusout", () => { setTimeout(() => { for (const id of [...pending]) { const s = SECTIONS.find(x => x.id === id); const el = $("#" + id); if (s && el && !el.contains(document.activeElement)) { pending.delete(id); renderSection(s); } } }, 50); });

function updateChrome() {
  const ctx = ctxBase(); const site = ctx.site;
  const title = site.title || [ctx.people[0].name, ctx.people[1].name].filter(Boolean).join(" & ") || "Bizim Hikâyemiz";
  document.title = title;
  $$("[data-brand],[data-brand2]").forEach(b => b.innerHTML = `<span class="brand-ini">${esc(initials(ctx.people))}</span><span class="brand-name">${esc(title)}</span>`);
  $("[data-foot-line]").textContent = site.footLine || `${ctx.people[0].name || ""} & ${ctx.people[1].name || ""}`;
  $("[data-who-name]").textContent = ctx.meName ? `Ben ${ctx.meName}` : "Ben kimim?";
  $("[data-edit-label]").textContent = ctx.isEditor ? "Düzenleme açık" : "Düzenleme";
  $("[data-edit-btn]").classList.toggle("on", ctx.isEditor);
  $("[data-editor-tools]").hidden = !ctx.isEditor;
  document.body.classList.toggle("editing", ctx.isEditor);
  updateBell(); updatePresence();
}
function initials(people) { return people.map(p => (p.name || "").charAt(0).toLocaleUpperCase("tr-TR")).filter(Boolean).join("&") || "♥"; }

function updateBell() {
  const n = state.store.unseenCount(state.me); const dot = $(".badge-dot"); if (!dot) return;
  dot.hidden = !n; dot.textContent = n > 9 ? "9+" : n;
}
function updatePresence() {
  const el = $("[data-presence]"); if (!el) return; const ctx = ctxBase();
  const other = (state.store.data.presence || []).find(p => p.id === ctx.otherKey);
  el.textContent = other?.lastSeen ? `${ctx.otherName} en son ${relTime(other.lastSeen)} buradaydı.` : "";
}

function setupObservers() {
  // reveal on scroll
  const io = new IntersectionObserver((ents) => ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  $$(".reveal").forEach(el => io.observe(el));
  // scroll spy + progress
  const spy = new IntersectionObserver((ents) => { for (const en of ents) if (en.isIntersecting) { $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === en.target.id)); const a = $(`[data-nav="${en.target.id}"]`); a?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); } }, { rootMargin: "-40% 0px -55% 0px" });
  $$("main .sec").forEach(el => spy.observe(el));
  const bar = $(".progress i");
  const onScroll = () => { const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); if (bar) bar.style.width = (p * 100).toFixed(2) + "%"; document.body.classList.toggle("scrolled", h.scrollTop > 40); };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
}

function presence() {
  const ping = () => state.me && state.store.setPresence(state.me, { ua: navigator.userAgent.slice(0, 60) });
  ping(); setInterval(ping, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) ping(); });
}
function visitEvent() {
  if (!state.me) return; const key = "bh_visit_" + state.me; const today = toISODate(new Date());
  if (localStorage.getItem(key) === today) return; localStorage.setItem(key, today);
  const ctx = ctxBase(); if (!ctx.otherKey) return;
  const first = !localStorage.getItem("bh_visited_" + state.me); localStorage.setItem("bh_visited_" + state.me, "1");
  state.store.addEvent({ type: "visit", by: state.me, to: ctx.otherKey, title: first ? `${ctx.meName} siteyi ilk kez açtı 🎉` : `${ctx.meName} bugün siteye baktı 👋`, text: "" }).catch(() => { });
}

/* -------------------------------------------------------- Edit / lock */
async function toggleEdit() {
  const store = state.store;
  if (store.isEditor) {
    const vp = sessionStorage.getItem("bh_vpin");
    if (!vp) { await store.signOut(); return location.reload(); }
    try { await store.signIn("viewer", vp); toast("Düzenleme kapatıldı"); } catch { location.reload(); }
    return;
  }
  const pin = await askPin("Düzenleme PIN'i", "Her şeyi yerinde düzenleyebilmek için ikinci PIN'i gir.");
  if (!pin) return;
  try { await store.signIn("editor", pin); toast("Düzenleme modu açık ✎", { type: "ok" }); }
  catch (e) { toast(e.kind === "wrong" ? "PIN yanlış" : "Giriş yapılamadı", { type: "error" }); }
}
function askPin(title, sub) {
  return new Promise((res) => {
    const wrap = document.createElement("div"); wrap.className = "pin-modal";
    wrap.innerHTML = `<p class="muted">${esc(sub)}</p><input class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-label="PIN">`;
    const m = openModal({ title, content: wrap, size: "sm", actions: [{ label: "Vazgeç", cls: "ghost", onClick: () => res("") }, { label: "Aç", cls: "primary", onClick: () => res(wrap.querySelector("input").value.trim()) }], onClose: (r) => { if (r === null) res(""); } });
    const inp = wrap.querySelector("input"); setTimeout(() => inp.focus(), 80);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { res(inp.value.trim()); m.close(inp.value.trim()); } });
  });
}
async function lock() {
  if (!(await confirmDialog("Site kilitlenecek; tekrar görmek için şifre gerekecek.", { ok: "Kilitle", title: "Kilitle" }))) return;
  sessionStorage.removeItem("bh_vpin"); await state.store.signOut(); location.reload();
}
function pickTheme() {
  const cur = currentTheme();
  const wrap = document.createElement("div"); wrap.className = "theme-pick";
  wrap.innerHTML = Object.entries(THEMES).map(([k, l]) => `<button class="theme-opt ${k === cur ? "on" : ""}" data-t="${k}"><span class="swatch t-${k}"></span>${l}</button>`).join("") + `<p class="muted small">Bu seçim sadece bu cihaz için. Varsayılan tema Ayarlar'dan değiştirilir.</p>`;
  const m = openModal({ title: "Tema", content: wrap, size: "sm" });
  wrap.onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b) return; if (b.dataset.t === (state.store.data.site?.theme || "gece")) localStorage.removeItem("bh_theme"); else localStorage.setItem("bh_theme", b.dataset.t); applyTheme(); renderAll(); m.close(); };
}

/* --------------------------------------------------------------- Boot */
async function boot() {
  // "?local" forces the in-browser (IndexedDB) adapter — handy for development without Firebase.
  const useFirebase = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !new URLSearchParams(location.search).has("local");
  const adapter = useFirebase ? new FirebaseAdapter(FIREBASE_CONFIG) : new LocalAdapter();
  const store = new Store(adapter); state.store = store;
  state.ambient = new Ambient($("#bg")); applyTheme();
  try { await store.init(); } catch (e) { console.error(e); $("#gate").innerHTML = `<div class="gate-inner"><p>Bağlantı kurulamadı. ${esc(e.message || "")}</p></div>`; return; }

  const scheduled = new Map();
  store.on("change", (col) => {
    if (!state.unlocked) return;
    for (const s of SECTIONS) if (s.deps.includes(col)) { clearTimeout(scheduled.get(s.id)); scheduled.set(s.id, setTimeout(() => renderSection(s), 40)); }
    if (col === "site") {
      applyTheme(); updateChrome(); emptyNotice();
      if (state.needIdentity && store.data.site?.couple) { state.needIdentity = false; chooseIdentity(ctxBase(), { force: true }).then(k => { if (k) { state.me = k; localStorage.setItem("bh_me", k); renderAll(); visitEvent(); } }); }
    }
    if (col === "events") { updateBell(); announceNewEvents(); }
    if (col === "presence") updatePresence();
  });
  store.on("auth", () => { if (state.unlocked) { renderAll(); emptyNotice(); } });
  store.on("error", (err) => { if (err?.code === "permission-denied") toast("Erişim reddedildi — yeniden giriş yapmayı dene.", { type: "error" }); });

  // Already signed in (same-tab reload)? Skip the gate.
  if (store.role) unlock(); else renderGate(unlock);
  window.__bh = { store, state, ctx: ctxBase, unlock, renderAll }; // for debugging / seeding
}

let seenEventIds = null;
function announceNewEvents() {
  const evs = state.store.data.events || [];
  if (seenEventIds === null) { seenEventIds = new Set(evs.map(e => e.id)); return; }
  for (const e of evs) {
    if (seenEventIds.has(e.id)) continue; seenEventIds.add(e.id);
    if (e.by === state.me || (e.to && e.to !== state.me)) continue;
    toast(`${esc(e.title || "Yeni bildirim")}`, { type: "ok", ms: 5000 });
    if ("Notification" in window && Notification.permission === "granted") { try { new Notification(e.title || "Bizim Hikâyemiz", { body: e.text || "", icon: "assets/icon-192.png" }); } catch { } }
  }
}

boot();
