// "Planlayıcı": engagement / wedding planning — tasks, venues (with comments), budget, guests, notes.
// Collaborative: both people can edit (no editor PIN needed).
import { esc, nl2br, fmtDate, icons, uid, toISODate, daysBetween, parseLocal, relTime, compressImage } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState, confirmDialog, toast, openLightbox } from "../ui.js";

const STATUS = { aday: { label: "Aday", cls: "s-aday" }, favori: { label: "Favori", cls: "s-fav" }, gorusuldu: { label: "Görüşüldü", cls: "s-talk" }, secildi: { label: "Seçildi ✓", cls: "s-ok" }, elendi: { label: "Elendi", cls: "s-no" } };
const GSTATUS = { bekliyor: "Bekliyor", geliyor: "Geliyor", gelmiyor: "Gelmiyor" };
const TL = (n) => (Number(n) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";
function thumbs(ids, ctx, cls = "") {
  const media = ctx.data.planmedia || []; const list = (ids || []).map(id => media.find(m => m.id === id)).filter(Boolean);
  if (!list.length) return "";
  return `<div class="thumbs ${cls}">${list.map(m => `<button type="button" class="thumb" data-media="${m.id}" aria-label="Görseli büyüt"><img src="${m.thumb}" alt="" loading="lazy"></button>`).join("")}</div>`;
}
function openMedia(ctx, ids, id) {
  const media = ctx.data.planmedia || []; const list = (ids || []).map(x => media.find(m => m.id === x)).filter(Boolean);
  const i = Math.max(0, list.findIndex(m => m.id === id));
  openLightbox(list.map(m => ({ ...m, caption: m.caption || "" })), i, { getFull: (mid) => ctx.store.getFullIn("planmediaFull", mid) });
}

export function render(el, ctx) {
  const plans = ctx.data.planning || [];
  let cur = el.dataset.curPlan; if (!plans.some(p => p.id === cur)) cur = plans[0]?.id || ""; el.dataset.curPlan = cur;
  const P = plans.find(p => p.id === cur);
  const sub = el.dataset.curSub || "tasks";
  const can = ctx.signedIn;
  el.innerHTML = `
    ${sectionHead("plan", "Birlikte planlıyoruz", "Planlayıcı", "Yapılacaklar, mekânlar, bütçe ve davetliler — ikimiz de düzenleyebiliriz, her değişiklik anında kaydolur.", can ? addButton("Etkinlik ekle", "add-plan") : "")}
    ${plans.length ? `<div class="tabs" role="tablist">${plans.map(p => `<button class="tab ${p.id === cur ? "on" : ""}" data-plan="${p.id}">${esc(p.emoji || "📋")} ${esc(p.title)}</button>`).join("")}</div>` : ""}
    ${P ? renderPlan(P, sub, ctx) : emptyState("Henüz bir etkinlik planı yok.", can ? "Sağ üstten Nişan / Düğün ekle." : "")}`;

  el.onclick = async (e) => {
    const tab = e.target.closest("[data-plan]"); if (tab) { el.dataset.curPlan = tab.dataset.plan; return render(el, ctx); }
    const st = e.target.closest("[data-sub]"); if (st) { el.dataset.curSub = st.dataset.sub; return render(el, ctx); }
    const th = e.target.closest("[data-media]");
    if (th && P) { const row = e.target.closest("[data-row]"); const subNow = el.dataset.curSub || "tasks"; const list = { tasks: P.tasks || [], venues: P.venues || [] }[subNow] || []; const item = list.find(x => x.id === row?.dataset.row); openMedia(ctx, item?.images || [th.dataset.media], th.dataset.media); return; }
    const act = e.target.closest("[data-act]"); if (!act) return;
    if (!can) return;
    const a = act.dataset.act;
    if (a === "add" && act.classList.contains("add-plan")) return editPlan(ctx, null);
    if (!P) return;
    if (a === "edit-plan") return editPlan(ctx, P);
    const row = e.target.closest("[data-row]"); const rid = row?.dataset.row;
    const list = { tasks: P.tasks || [], venues: P.venues || [], budget: P.budget || [], guests: P.guests || [] }[sub] || [];
    const item = list.find(x => x.id === rid);
    const save = (arr) => ctx.store.update("planning", P.id, { [sub]: arr, updatedAt: new Date().toISOString(), updatedBy: ctx.me || "" });
    switch (a) {
      case "add": return openItemForm(ctx, P, sub, null);
      case "edit": return item && openItemForm(ctx, P, sub, item);
      case "del": if (item && await confirmDialog("Silinsin mi?", { ok: "Sil", danger: true })) { for (const mid of item.images || []) { ctx.store.remove("planmedia", mid).catch(() => { }); ctx.store.removeFullIn("planmediaFull", mid).catch(() => { }); } return save(list.filter(x => x.id !== rid)); } return;
      case "toggle": if (item) { const done = !item.done; return save(list.map(x => x.id === rid ? { ...x, done, doneAt: done ? new Date().toISOString() : "", doneBy: done ? ctx.me || "" : "" } : x)); } return;
      case "paid": if (item) return save(list.map(x => x.id === rid ? { ...x, paid: !x.paid } : x)); return;
      case "status": if (item) { const s = act.dataset.status; const arr = list.map(x => x.id === rid ? { ...x, status: s } : (s === "secildi" && x.status === "secildi" ? { ...x, status: "favori" } : x)); return save(arr); } return;
      case "comment": { if (!item) return; const inp = row.querySelector("input[data-comment]"); const text = (inp?.value || "").trim(); if (!text) return; const c = { id: uid("c"), by: ctx.me || "", at: new Date().toISOString(), text }; await save(list.map(x => x.id === rid ? { ...x, comments: [...(x.comments || []), c] } : x)); if (item.addedBy && item.addedBy !== ctx.me) ctx.notify({ type: "comment", to: item.addedBy, title: `${ctx.meName} bir mekâna yorum yaptı 💬`, text: `${item.name}: "${text}"` }); return; }
      case "delcomment": { if (!item) return; const cid = act.dataset.cid; return save(list.map(x => x.id === rid ? { ...x, comments: (x.comments || []).filter(c => c.id !== cid) } : x)); }
      case "filter": el.dataset.curFilter = act.dataset.filter; return render(el, ctx);
      case "up": case "down": { if (!item) return; const arr = [...list]; const i = arr.indexOf(item), j = a === "up" ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; return save(arr); }
    }
  };
  el.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches("input[data-comment]")) { e.preventDefault(); e.target.closest("[data-row]")?.querySelector("[data-act=comment]")?.click(); } };
  // notes autosave
  const ta = el.querySelector("textarea[data-notes]");
  if (ta && P) { let t; ta.addEventListener("input", () => { clearTimeout(t); el.querySelector("[data-notes-status]").textContent = "…"; t = setTimeout(async () => { await ctx.store.update("planning", P.id, { notes: ta.value, updatedAt: new Date().toISOString(), updatedBy: ctx.me || "" }); el.querySelector("[data-notes-status]").textContent = "Kaydedildi ✓"; }, 800); }); }
}

function renderPlan(P, sub, ctx) {
  const tasks = P.tasks || [], venues = P.venues || [], budget = P.budget || [], guests = P.guests || [];
  const done = tasks.filter(t => t.done).length; const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const planned = budget.reduce((s, b) => s + (Number(b.planned) || 0), 0), actual = budget.reduce((s, b) => s + (Number(b.actual) || 0), 0);
  const chosen = venues.find(v => v.status === "secildi");
  const guestCount = guests.filter(g => g.status !== "gelmiyor").reduce((s, g) => s + (Number(g.count) || 1), 0);
  const days = P.date ? daysBetween(new Date(), P.date) : null;
  const can = ctx.signedIn;
  const summary = `
    <div class="plan-summary card">
      <div class="ps-main"><div class="ps-emoji">${esc(P.emoji || "📋")}</div><div><h3>${esc(P.title)}</h3><div class="muted">${P.date ? `${fmtDate(P.date, { weekday: true })}${days != null ? ` · ${days > 0 ? days + " gün kaldı" : days === 0 ? "bugün!" : Math.abs(days) + " gün önce"}` : ""}` : esc(P.approx || "Tarih henüz belirlenmedi")}${chosen ? ` · ${icons.pin} ${esc(chosen.name)}` : ""}</div></div>${can ? `<button class="btn small ghost" data-act="edit-plan">${icons.pencil} Düzenle</button>` : ""}</div>
      <div class="ps-stats">
        <div class="ps-stat"><b>${pct}%</b><span>${done}/${tasks.length} görev</span><div class="bar"><i style="width:${pct}%"></i></div></div>
        <div class="ps-stat"><b>${TL(actual)}</b><span>harcanan / ${TL(planned)} plan</span><div class="bar"><i style="width:${planned ? Math.min(100, actual / planned * 100) : 0}%"></i></div></div>
        <div class="ps-stat"><b>${venues.length}</b><span>mekân adayı</span></div>
        <div class="ps-stat"><b>${guestCount}</b><span>davetli</span></div>
      </div>
    </div>
    <div class="subtabs">${[["tasks", "Yapılacaklar", tasks.length], ["venues", "Mekânlar", venues.length], ["budget", "Bütçe", budget.length], ["guests", "Davetliler", guests.length], ["notes", "Notlar", P.notes ? "•" : ""]].map(([k, l, n]) => `<button class="subtab ${sub === k ? "on" : ""}" data-sub="${k}">${l}${n !== "" && n != null ? ` <span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>`;
  const body = { tasks: renderTasks, venues: renderVenues, budget: renderBudget, guests: renderGuests, notes: renderNotes }[sub](P, ctx);
  return summary + `<div class="plan-body">${body}</div>`;
}

function who(ctx, k) { if (k === "both") return "ikimiz"; return ctx.people.find(p => p.key === k)?.name || ""; }

function renderTasks(P, ctx) {
  const tasks = P.tasks || []; const can = ctx.signedIn; const filter = document.getElementById("plan")?.dataset.curFilter || "open";
  const shown = tasks.filter(t => filter === "all" ? true : filter === "done" ? t.done : !t.done);
  const cats = {}; for (const t of shown) (cats[t.cat || "Genel"] ||= []).push(t);
  const today = toISODate(new Date());
  return `<div class="plan-toolbar"><div class="seg">${[["open", "Açık"], ["done", "Tamamlanan"], ["all", "Tümü"]].map(([k, l]) => `<button class="seg-btn ${filter === k ? "on" : ""}" data-act="filter" data-filter="${k}">${l}</button>`).join("")}</div>${can ? addButton("Görev ekle", "small") : ""}</div>
    ${shown.length ? Object.entries(cats).map(([cat, arr]) => `<div class="task-group"><h4 class="task-cat">${esc(cat)} <span class="muted">${arr.filter(t => t.done).length}/${arr.length}</span></h4><ul class="tasks">${arr.map(t => `
      <li class="task ${t.done ? "done" : ""} ${t.due && !t.done && t.due < today ? "late" : ""}" data-row="${t.id}">
        <button class="check" data-act="toggle" aria-label="Tamamla" ${can ? "" : "disabled"}>${t.done ? icons.check : ""}</button>
        <div class="task-main"><div class="task-text">${esc(t.text)}</div><div class="task-meta">${t.due ? `<span class="chip">${icons.calendar} ${fmtDate(t.due, { noYear: true })}</span>` : ""}${t.who ? `<span class="chip who-${t.who}">${esc(who(ctx, t.who))}</span>` : ""}${t.note ? `<span class="task-note">${esc(t.note)}</span>` : ""}${t.done && t.doneBy ? `<span class="muted small">${esc(who(ctx, t.doneBy))} tamamladı</span>` : ""}</div>${thumbs(t.images, ctx, "small")}</div>
        ${can ? itemTools({ edit: true, del: true }) : ""}
      </li>`).join("")}</ul></div>`).join("") : emptyState(filter === "done" ? "Henüz tamamlanan görev yok." : filter === "open" ? "Açık görev yok 🎉" : "Görev yok.")}`;
}

function renderVenues(P, ctx) {
  const venues = P.venues || []; const can = ctx.signedIn; const photos = ctx.data.photos || [];
  return `<div class="plan-toolbar"><p class="muted">Adayları karşılaştırın, yorum bırakın, birini seçin.</p>${can ? addButton("Mekân ekle", "small") : ""}</div>
    ${venues.length ? `<div class="venues">${venues.map(v => { const s = STATUS[v.status] || STATUS.aday; return `
      <article class="card venue ${v.status === "secildi" ? "chosen" : ""} ${v.status === "elendi" ? "out" : ""}" data-row="${v.id}">
        <div class="venue-head"><div><h4>${esc(v.name)}</h4><div class="muted">${[v.city, v.capacity ? `${esc(v.capacity)} kişi` : "", v.price].filter(Boolean).map(esc).join(" · ")}</div></div><span class="badge ${s.cls}">${s.label}</span></div>
        ${v.note ? `<p class="venue-note">${nl2br(v.note)}</p>` : ""}
        ${thumbs(v.images, ctx)}
        <div class="venue-links">${v.url ? `<a class="btn small ghost" href="${esc(v.url)}" target="_blank" rel="noopener">${icons.external} Bağlantı</a>` : ""}${v.maps ? `<a class="btn small ghost" href="${esc(v.maps)}" target="_blank" rel="noopener">${icons.pin} Harita</a>` : ""}</div>
        ${can ? `<div class="status-row">${Object.entries(STATUS).map(([k, st]) => `<button class="chip-btn ${v.status === k ? "on" : ""}" data-act="status" data-status="${k}">${st.label}</button>`).join("")}</div>` : ""}
        <div class="comments">${(v.comments || []).map(c => `<div class="comment ${c.by === ctx.me ? "mine" : ""}"><div class="c-head"><b>${esc(who(ctx, c.by) || "—")}</b><span class="muted">${relTime(c.at)}</span>${can && c.by === ctx.me ? `<button class="tool danger" data-act="delcomment" data-cid="${c.id}" aria-label="Yorumu sil">${icons.trash}</button>` : ""}</div><div>${nl2br(c.text)}</div></div>`).join("")}
          ${can ? `<div class="comment-add"><input type="text" data-comment placeholder="Yorum yaz…"><button class="icon-btn" data-act="comment" aria-label="Gönder">${icons.send}</button></div>` : ""}</div>
        ${can ? itemTools({ edit: true, del: true }) : ""}
      </article>`; }).join("")}</div>` : emptyState("Henüz mekân adayı yok.")}`;
}

function renderBudget(P, ctx) {
  const b = P.budget || []; const can = ctx.signedIn;
  const planned = b.reduce((s, x) => s + (Number(x.planned) || 0), 0), actual = b.reduce((s, x) => s + (Number(x.actual) || 0), 0), paid = b.filter(x => x.paid).reduce((s, x) => s + (Number(x.actual || x.planned) || 0), 0);
  return `<div class="plan-toolbar"><div class="budget-totals"><span>Plan <b>${TL(planned)}</b></span><span>Gerçekleşen <b>${TL(actual)}</b></span><span>Ödenen <b>${TL(paid)}</b></span></div>${can ? addButton("Kalem ekle", "small") : ""}</div>
    ${b.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Kalem</th><th>Kategori</th><th class="num">Plan</th><th class="num">Gerçekleşen</th><th>Ödendi</th><th></th></tr></thead><tbody>${b.map(x => `
      <tr data-row="${x.id}" class="${x.paid ? "paid" : ""}"><td>${esc(x.item)}${x.note ? `<div class="muted small">${esc(x.note)}</div>` : ""}</td><td class="muted">${esc(x.cat || "")}</td><td class="num">${TL(x.planned)}</td><td class="num">${x.actual ? TL(x.actual) : "—"}</td><td><button class="check small" data-act="paid" ${can ? "" : "disabled"} aria-label="Ödendi">${x.paid ? icons.check : ""}</button></td><td>${can ? itemTools({ edit: true, del: true }) : ""}</td></tr>`).join("")}</tbody></table></div>` : emptyState("Henüz bütçe kalemi yok.")}`;
}

function renderGuests(P, ctx) {
  const g = P.guests || []; const can = ctx.signedIn;
  const total = g.reduce((s, x) => s + (Number(x.count) || 1), 0), coming = g.filter(x => x.status === "geliyor").reduce((s, x) => s + (Number(x.count) || 1), 0);
  const sides = { a: ctx.people[0].name, b: ctx.people[1].name, ortak: "Ortak" };
  const groups = {}; for (const x of g) (groups[x.side || "ortak"] ||= []).push(x);
  return `<div class="plan-toolbar"><div class="budget-totals"><span>Toplam <b>${total}</b></span><span>Geliyor <b>${coming}</b></span><span>Liste <b>${g.length}</b></span></div>${can ? addButton("Davetli ekle", "small") : ""}</div>
    ${g.length ? Object.entries(groups).map(([side, arr]) => `<div class="task-group"><h4 class="task-cat">${esc(sides[side] || side)} tarafı <span class="muted">${arr.reduce((s, x) => s + (Number(x.count) || 1), 0)} kişi</span></h4><ul class="guests">${arr.map(x => `
      <li class="guest" data-row="${x.id}"><span class="guest-name">${esc(x.name)}${(Number(x.count) || 1) > 1 ? ` <span class="muted">×${x.count}</span>` : ""}</span><span class="badge g-${x.status || "bekliyor"}">${GSTATUS[x.status] || "Bekliyor"}</span>${x.note ? `<span class="muted small">${esc(x.note)}</span>` : ""}${can ? itemTools({ edit: true, del: true }) : ""}</li>`).join("")}</ul></div>`).join("") : emptyState("Henüz davetli yok.")}`;
}

function renderNotes(P, ctx) {
  const can = ctx.signedIn;
  return `<div class="notes-wrap"><p class="muted">Serbest notlar — iCloud notlarınızı buraya yapıştırabilirsiniz. Otomatik kaydedilir.</p>${can ? `<textarea data-notes rows="14" placeholder="Notlar…">${esc(P.notes || "")}</textarea><div class="form-status" data-notes-status></div>` : `<div class="notes-read">${nl2br(P.notes || "—")}</div>`}</div>`;
}

export function editPlan(ctx, P) {
  const isNew = !P;
  return openForm({
    title: isNew ? "Etkinlik ekle" : "Etkinliği düzenle", autosave: !isNew,
    value: P ? { ...P, date: toISODate(P.date) } : { emoji: "💍" },
    fields: [
      { key: "title", label: "Ad", required: true, placeholder: "Nişan", half: true },
      { key: "emoji", label: "Simge", type: "emoji", half: true, options: ["💍", "💒", "🎉", "🥂", "🎂", "✈️", "🏠", "📋"] },
      { key: "date", label: "Tarih (belliyse)", type: "date", half: true },
      { key: "approx", label: "Tahmini zaman", placeholder: "İlkbahar 2027", half: true },
    ],
    onSave: async (v) => { const id = P?.id || v.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uid(); const data = { title: v.title, emoji: v.emoji || "📋", date: v.date || "", approx: v.approx || "", order: P?.order ?? ctx.store.nextOrder("planning") }; if (!P) Object.assign(data, { tasks: [], venues: [], budget: [], guests: [], notes: "" }); await ctx.store.upsert("planning", id, data); if (!P) P = { id, ...data }; },
    onDelete: P ? () => ctx.store.remove("planning", P.id) : undefined,
  });
}

function openItemForm(ctx, P, sub, item) {
  const isNew = !item; const list = [...(P[sub] || [])];
  const people = ctx.people;
  const defs = {
    tasks: { title: "Görev", fields: [
      { key: "text", label: "Görev", required: true },
      { key: "cat", label: "Kategori", placeholder: "Mekân, Kıyafet, Davetiye…", half: true, help: `Mevcut: ${[...new Set(list.map(x => x.cat).filter(Boolean))].map(esc).join(", ") || "—"}` },
      { key: "due", label: "Son tarih", type: "date", half: true },
      { key: "who", label: "Kim ilgilenecek", type: "person", allowBoth: true, half: true },
      { key: "note", label: "Not", half: true },
      { key: "images", label: "Görseller", type: "images" },
    ], make: (v, old) => ({ id: old?.id || uid("t"), text: v.text, cat: v.cat || "", due: v.due || "", who: v.who || "", note: v.note || "", images: v.images || [], done: old?.done || false, doneAt: old?.doneAt || "", doneBy: old?.doneBy || "" }) },
    venues: { title: "Mekân", fields: [
      { key: "name", label: "Mekân adı", required: true, half: true },
      { key: "city", label: "Şehir / ilçe", half: true },
      { key: "status", label: "Durum", type: "select", half: true, options: Object.entries(STATUS).map(([k, s]) => ({ value: k, label: s.label })) },
      { key: "capacity", label: "Kapasite", half: true },
      { key: "price", label: "Fiyat / teklif", half: true },
      { key: "url", label: "Web / Instagram", type: "url", half: true },
      { key: "maps", label: "Google Haritalar bağlantısı", type: "url" },
      { key: "note", label: "Notlar (artılar, eksiler)", type: "textarea", rows: 3 },
      { key: "images", label: "Görseller", type: "images" },
    ], make: (v, old) => ({ id: old?.id || uid("v"), name: v.name, city: v.city || "", status: v.status || "aday", capacity: v.capacity || "", price: v.price || "", url: v.url || "", maps: v.maps || "", note: v.note || "", images: v.images || [], comments: old?.comments || [], addedBy: old?.addedBy || ctx.me || "" }) },
    budget: { title: "Bütçe kalemi", fields: [
      { key: "item", label: "Kalem", required: true, half: true },
      { key: "cat", label: "Kategori", half: true },
      { key: "planned", label: "Planlanan (₺)", type: "number", min: 0, half: true },
      { key: "actual", label: "Gerçekleşen (₺)", type: "number", min: 0, half: true },
      { key: "paid", label: "Ödendi", type: "checkbox" },
      { key: "note", label: "Not" },
    ], make: (v, old) => ({ id: old?.id || uid("b"), item: v.item, cat: v.cat || "", planned: Number(v.planned) || 0, actual: Number(v.actual) || 0, paid: !!v.paid, note: v.note || "" }) },
    guests: { title: "Davetli", fields: [
      { key: "name", label: "Ad", required: true, half: true },
      { key: "count", label: "Kişi sayısı", type: "number", min: 1, half: true },
      { key: "side", label: "Taraf", type: "select", half: true, options: [{ value: "a", label: people[0].name }, { value: "b", label: people[1].name }, { value: "ortak", label: "Ortak" }] },
      { key: "status", label: "Durum", type: "select", half: true, options: Object.entries(GSTATUS).map(([k, l]) => ({ value: k, label: l })) },
      { key: "note", label: "Not" },
    ], make: (v, old) => ({ id: old?.id || uid("g"), name: v.name, count: Number(v.count) || 1, side: v.side || "ortak", status: v.status || "bekliyor", note: v.note || "" }) },
  }[sub];
  if (!defs) return;
  const uploadMedia = async (files) => {
    const ids = [];
    for (const f of files) {
      const [full, thumb] = await Promise.all([compressImage(f, { maxSide: 1400, targetKB: 300 }), compressImage(f, { maxSide: 480, targetKB: 45, quality: 0.8 })]);
      const id = await ctx.store.upsert("planmedia", null, { thumb: thumb.dataUrl, w: full.w, h: full.h, plan: P.id, ref: `${sub}:${item?.id || ""}`, order: Date.now(), addedBy: ctx.me || "" });
      await ctx.store.setFullIn("planmediaFull", id, full.dataUrl); ids.push(id);
    }
    return ids;
  };
  const removeMedia = (id) => { ctx.store.remove("planmedia", id).catch(() => { }); ctx.store.removeFullIn("planmediaFull", id).catch(() => { }); };
  return openForm({
    title: `${defs.title} ${isNew ? "ekle" : "düzenle"}`, fields: defs.fields, value: item || (sub === "guests" ? { count: 1, side: "ortak", status: "bekliyor" } : sub === "venues" ? { status: "aday" } : {}), autosave: !isNew, ctx: { people, media: ctx.data.planmedia || [], uploadMedia, removeMedia },
    onSave: async (v) => { const obj = defs.make(v, item); const i = list.findIndex(x => x.id === obj.id); if (i >= 0) list[i] = obj; else list.push(obj); item = obj; await ctx.store.update("planning", P.id, { [sub]: list, updatedAt: new Date().toISOString(), updatedBy: ctx.me || "" }); },
    onDelete: item ? () => ctx.store.update("planning", P.id, { [sub]: list.filter(x => x.id !== item.id) }) : undefined,
  });
}
