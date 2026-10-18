// "Takvim": countdowns to the big days (editable by both) + a month calendar.
import { esc, nl2br, fmtDate, fmtTime, parseLocal, nextOccurrence, icons, MONTHS_TR, DAYS_TR_SHORT, toISODate, daysBetween } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState, openModal } from "../ui.js";

const KINDS = { nisan: { label: "Nişan", emoji: "💍" }, dugun: { label: "Düğün", emoji: "💒" }, dogumgunu: { label: "Doğum günü", emoji: "🎂" }, yildonumu: { label: "Yıl dönümü", emoji: "💞" }, aydonumu: { label: "Ay dönümü", emoji: "🌙" }, seyahat: { label: "Seyahat", emoji: "✈️" }, ozel: { label: "Özel gün", emoji: "✨" } };
let timer = null;

// Returns upcoming occurrences sorted by date: [{id, title, emoji, when:Date, days, approx, item}]
export function computeUpcoming(items, now = new Date()) {
  const out = [];
  for (const it of items) {
    if (!it.date) { if (it.approx) out.push({ id: it.id, title: it.title, emoji: it.emoji || KINDS[it.kind]?.emoji || "🗓️", when: null, days: null, approx: it.approx, item: it }); continue; }
    const when = nextOccurrence(it.date, it.recurrence || "none", it.time || "", now);
    if (!when) continue;
    if ((it.recurrence || "none") === "none" && when < now && daysBetween(when, now) > 0) continue; // past one-off
    out.push({ id: it.id, title: it.title, emoji: it.emoji || KINDS[it.kind]?.emoji || "🗓️", when, days: daysBetween(now, when), approx: "", item: it });
  }
  return out.sort((a, b) => { if (!a.when) return 1; if (!b.when) return -1; return a.when - b.when; });
}

export function render(el, ctx) {
  const items = ctx.countdownItems || ctx.data.countdowns || []; const now = new Date();
  const up = computeUpcoming(items, now);
  const featured = up.find(u => u.when); const rest = up.filter(u => u !== featured);
  const ym = el.dataset.curYm || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; el.dataset.curYm = ym;
  const past = items.filter(it => it.date && (it.recurrence || "none") === "none" && parseLocal(it.date) < now && daysBetween(it.date, now) > 0);

  el.innerHTML = `
    ${sectionHead("takvim", "Geri sayım", "Takvimimiz", "Tarihler ikimiz tarafından da düzenlenebilir.", ctx.signedIn ? addButton("Tarih ekle") : "")}
    ${featured ? `<article class="card featured-cd" data-id="${featured.id}">
      <div class="fcd-emoji">${featured.emoji}</div>
      <div class="fcd-main"><div class="kicker">en yakın</div><h3>${esc(featured.title)}</h3><div class="muted">${fmtDate(featured.when, { weekday: true })}${featured.item.time ? ` · ${fmtTime(featured.when)}` : ""}${featured.item.note ? ` · ${esc(featured.item.note)}` : ""}</div></div>
      <div class="fcd-count" data-target="${featured.when.toISOString()}">${["d", "h", "m", "s"].map(k => `<div class="cc"><b data-k="${k}">0</b><span>${{ d: "gün", h: "saat", m: "dk", s: "sn" }[k]}</span></div>`).join("")}</div>
      ${ctx.signedIn && !featured.item.implicit ? itemTools({ edit: true }) : ""}
    </article>` : ""}
    <div class="cd-grid">${rest.map(u => `
      <article class="card cd ${u.when ? "" : "approx"}" data-id="${u.id}">
        <div class="cd-emoji">${u.emoji}</div>
        <div class="cd-main"><h4>${esc(u.title)}</h4><div class="cd-when">${u.when ? fmtDate(u.when) : esc(u.approx)}${u.item.recurrence === "yearly" ? " · her yıl" : u.item.recurrence === "monthly" ? " · her ay" : ""}</div>${u.item.note ? `<div class="cd-note">${esc(u.item.note)}</div>` : ""}</div>
        <div class="cd-days">${u.when ? (u.days === 0 ? `<b>bugün</b>` : `<b>${u.days}</b><span>gün</span>`) : `<button class="btn small ghost" data-act="edit">${icons.calendar} Tarih belirle</button>`}</div>
        ${ctx.signedIn && !u.item.implicit ? itemTools({ edit: true, del: true }) : ""}
      </article>`).join("")}</div>
    ${!up.length ? emptyState("Henüz bir tarih yok.", "Nişan, düğün, doğum günleri…") : ""}
    ${past.length ? `<details class="past"><summary>Geçmiş tarihler (${past.length})</summary><ul>${past.map(it => `<li data-id="${it.id}">${esc(it.emoji || "")} ${esc(it.title)} — ${fmtDate(it.date)} ${ctx.signedIn ? itemTools({ edit: true, del: true }) : ""}</li>`).join("")}</ul></details>` : ""}
    <div class="calendar card">${renderCalendar(ym, items, ctx)}</div>`;

  // live counter for the featured card
  clearInterval(timer);
  const cnt = el.querySelector(".fcd-count");
  if (cnt) { const target = new Date(cnt.dataset.target); const q = (k) => cnt.querySelector(`[data-k=${k}]`); const tick = () => { let ms = Math.max(0, target - Date.now()); const d = Math.floor(ms / 864e5); ms -= d * 864e5; const h = Math.floor(ms / 36e5); ms -= h * 36e5; const m = Math.floor(ms / 6e4); ms -= m * 6e4; const s = Math.floor(ms / 1e3); q("d").textContent = d; q("h").textContent = String(h).padStart(2, "0"); q("m").textContent = String(m).padStart(2, "0"); q("s").textContent = String(s).padStart(2, "0"); }; tick(); timer = setInterval(tick, 1000); }

  el.onclick = (e) => {
    const nav = e.target.closest("[data-ym]"); if (nav) { el.dataset.curYm = nav.dataset.ym; return render(el, ctx); }
    const day = e.target.closest("[data-day]"); if (day && day.dataset.events) { return showDay(day.dataset.day, JSON.parse(day.dataset.events)); }
    const act = e.target.closest("[data-act]"); if (!act || !ctx.signedIn) return;
    const host = e.target.closest("[data-id]"); const it = host ? items.find(x => x.id === host.dataset.id && !x.implicit) : null;
    if (act.dataset.act === "add") return editCountdown(ctx, null);
    if (act.dataset.act === "edit" && it) return editCountdown(ctx, it);
    if (act.dataset.act === "del" && it) return editCountdown(ctx, it, true);
  };
}

function renderCalendar(ym, items, ctx) {
  const [y, m] = ym.split("-").map(Number); const first = new Date(y, m - 1, 1); const daysIn = new Date(y, m, 0).getDate();
  const startIdx = (first.getDay() + 6) % 7; // Monday-first
  const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1);
  const fmtYM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const today = toISODate(new Date());
  // events per day in this month
  const ev = {};
  for (const it of items) {
    if (!it.date) continue; const base = parseLocal(it.date); if (!base) continue;
    const rec = it.recurrence || "none"; let d = null;
    if (rec === "none" && base.getFullYear() === y && base.getMonth() === m - 1) d = base.getDate();
    if (rec === "yearly" && base.getMonth() === m - 1) d = base.getDate();
    if (rec === "monthly") d = Math.min(base.getDate(), daysIn);
    if (d) (ev[d] ||= []).push({ title: it.title, emoji: it.emoji || KINDS[it.kind]?.emoji || "🗓️", note: it.note || "", time: it.time || "" });
  }
  let cells = "";
  for (let i = 0; i < startIdx; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysIn; d++) {
    const iso = `${ym}-${String(d).padStart(2, "0")}`; const e = ev[d];
    cells += `<div class="cal-cell ${iso === today ? "today" : ""} ${e ? "has" : ""}" data-day="${iso}" ${e ? `data-events='${esc(JSON.stringify(e))}'` : ""}><span class="cal-d">${d}</span>${e ? `<span class="cal-ev">${e.slice(0, 2).map(x => x.emoji).join("")}</span>` : ""}</div>`;
  }
  return `<div class="cal-head"><button class="icon-btn" data-ym="${fmtYM(prev)}" aria-label="Önceki ay">${icons.left}</button><h3>${MONTHS_TR[m - 1]} ${y}</h3><button class="icon-btn" data-ym="${fmtYM(next)}" aria-label="Sonraki ay">${icons.right}</button></div>
    <div class="cal-grid">${DAYS_TR_SHORT.map(d => `<div class="cal-wd">${d}</div>`).join("")}${cells}</div>`;
}

function showDay(iso, events) {
  openModal({ title: fmtDate(iso, { weekday: true }), size: "sm", content: `<ul class="day-events">${events.map(e => `<li><span>${e.emoji}</span><div><b>${esc(e.title)}</b>${e.time ? ` · ${esc(e.time)}` : ""}${e.note ? `<div class="muted">${esc(e.note)}</div>` : ""}</div></li>`).join("")}</ul>`, actions: [{ label: "Kapat", cls: "primary", onClick: () => { } }] });
}

export function editCountdown(ctx, it) {
  const isNew = !it;
  return openForm({
    title: isNew ? "Tarih ekle" : "Tarihi düzenle", autosave: !isNew,
    value: it ? { ...it, date: toISODate(it.date) } : { kind: "ozel", emoji: "✨", recurrence: "none" },
    fields: [
      { key: "title", label: "Başlık", required: true, half: true },
      { key: "kind", label: "Tür", type: "select", half: true, options: Object.entries(KINDS).map(([v, k]) => ({ value: v, label: `${k.emoji} ${k.label}` })) },
      { key: "emoji", label: "Simge", type: "emoji", half: true },
      { key: "recurrence", label: "Tekrar", type: "select", half: true, options: [{ value: "none", label: "Tek seferlik" }, { value: "yearly", label: "Her yıl" }, { value: "monthly", label: "Her ay" }] },
      { key: "date", label: "Tarih", type: "date", half: true, help: "Kesin tarih yoksa boş bırak, aşağıya tahmini yaz." },
      { key: "time", label: "Saat", type: "time", half: true },
      { key: "approx", label: "Tahmini zaman (tarih yoksa)", placeholder: "İlkbahar 2027", half: true },
      { key: "note", label: "Not", half: true },
    ],
    onSave: async (v) => { const data = { title: v.title, kind: v.kind, emoji: v.emoji || KINDS[v.kind]?.emoji || "", recurrence: v.recurrence || "none", date: v.date || "", time: v.time || "", approx: v.approx || "", note: v.note || "", order: it?.order ?? ctx.store.nextOrder("countdowns"), updatedBy: ctx.me || "", updatedAt: new Date().toISOString() }; const id = await ctx.store.upsert("countdowns", it?.id, data); if (!it) it = { id, ...data }; },
    onDelete: it ? () => ctx.store.remove("countdowns", it.id) : undefined,
  });
}
