// "Hayal Listesi": things we want to do together (collaborative).
import { esc, fmtDate, icons } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState } from "../ui.js";

const CATS = { seyahat: "✈️ Seyahat", deneyim: "✨ Deneyim", ev: "🏠 Ev & yuva", kucuk: "☕ Küçük şeyler", buyuk: "🌟 Büyük hayaller" };

export function render(el, ctx) {
  const items = ctx.data.bucket || []; const can = ctx.signedIn;
  const open = items.filter(i => !i.done), done = items.filter(i => i.done);
  const card = (it) => `<li class="bucket-item ${it.done ? "done" : ""}" data-id="${it.id}">
      <button class="check" data-act="toggle" ${can ? "" : "disabled"} aria-label="Tamamlandı">${it.done ? icons.check : ""}</button>
      <div class="bucket-main"><div class="bucket-text">${esc(it.text)}</div><div class="bucket-meta">${it.cat ? `<span class="chip">${CATS[it.cat] || esc(it.cat)}</span>` : ""}${it.done && it.doneAt ? `<span class="muted small">${fmtDate(it.doneAt)} ✓</span>` : ""}${it.note ? `<span class="muted small">${esc(it.note)}</span>` : ""}</div></div>
      ${can ? itemTools({ edit: true, del: true }) : ""}
    </li>`;
  el.innerHTML = `
    ${sectionHead("hayaller", `${done.length}/${items.length} gerçekleşti`, "Hayal Listemiz", "Birlikte yapmak istediklerimiz.", can ? addButton("Hayal ekle") : "")}
    ${items.length ? `<div class="bucket-cols"><div><h4 class="task-cat">Sırada</h4><ul class="bucket">${open.map(card).join("") || `<li class="muted">Hepsi gerçekleşti 🎉</li>`}</ul></div>${done.length ? `<div><h4 class="task-cat">Gerçekleşenler</h4><ul class="bucket">${done.map(card).join("")}</ul></div>` : ""}</div>` : emptyState("Henüz hayal eklenmedi.")}`;
  el.onclick = async (e) => {
    const act = e.target.closest("[data-act]"); if (!act || !can) return;
    const li = e.target.closest("[data-id]"); const it = li ? items.find(x => x.id === li.dataset.id) : null;
    if (act.dataset.act === "add") return edit(ctx, null);
    if (!it) return;
    if (act.dataset.act === "edit") return edit(ctx, it);
    if (act.dataset.act === "del") return edit(ctx, it, true);
    if (act.dataset.act === "toggle") { const done = !it.done; await ctx.store.update("bucket", it.id, { done, doneAt: done ? new Date().toISOString() : "", doneBy: done ? ctx.me || "" : "" }); if (done && ctx.otherKey) ctx.notify({ type: "bucket_done", to: ctx.otherKey, title: `Bir hayal gerçekleşti 🌟`, text: `${ctx.meName} "${it.text}" maddesini işaretledi.` }); }
  };
}

function edit(ctx, it) {
  const isNew = !it;
  return openForm({
    title: isNew ? "Hayal ekle" : "Hayali düzenle", value: it || { cat: "deneyim" }, autosave: !isNew,
    fields: [{ key: "text", label: "Hayal", required: true }, { key: "cat", label: "Kategori", type: "select", options: Object.entries(CATS).map(([v, l]) => ({ value: v, label: l })), half: true }, { key: "note", label: "Not", half: true }],
    onSave: async (v) => { const data = { text: v.text, cat: v.cat || "", note: v.note || "", done: it?.done || false, doneAt: it?.doneAt || "", order: it?.order ?? ctx.store.nextOrder("bucket"), addedBy: it?.addedBy || ctx.me || "" }; const id = await ctx.store.upsert("bucket", it?.id, data); if (!it) it = { id, ...data }; },
    onDelete: it ? () => ctx.store.remove("bucket", it.id) : undefined,
  });
}
