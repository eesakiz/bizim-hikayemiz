// "Zaman Tüneli": milestones sorted by date.
import { esc, nl2br, fmtDate, fmtTime, icons, toISODate } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState, openLightbox } from "../ui.js";

export function render(el, ctx) {
  const items = ctx.data.timeline || []; const photos = ctx.data.photos || [];
  const byId = Object.fromEntries(photos.map(p => [p.id, p]));
  el.innerHTML = `
    ${sectionHead("zaman", "Kilometre taşları", "Zaman Tüneli", "", ctx.isEditor ? addButton("Anı ekle") : "")}
    ${items.length ? `<ol class="timeline">${items.map((it, i) => {
      const p = it.photo ? byId[it.photo] : null; const hasTime = /T\d{2}:\d{2}/.test(it.date || "");
      return `<li class="tl-item ${i % 2 ? "right" : "left"}" data-id="${it.id}">
        <div class="tl-dot">${esc(it.emoji || "✦")}</div>
        <article class="card tl-card">
          <div class="tl-date">${fmtDate(it.date, { weekday: true })}${hasTime ? ` · ${fmtTime(it.date)}` : ""}</div>
          <h3 class="tl-title">${esc(it.title)}</h3>
          ${it.place ? `<div class="tl-place">${icons.pin} ${esc(it.place)}</div>` : ""}
          ${it.text ? `<p class="tl-text">${nl2br(it.text)}</p>` : ""}
          ${p ? `<button class="tl-photo" data-photo="${p.id}" aria-label="Fotoğrafı büyüt"><img src="${p.thumb}" alt="${esc(it.title)}" loading="lazy"></button>` : ""}
          ${ctx.isEditor ? itemTools({ edit: true, del: true }) : ""}
        </article></li>`;
    }).join("")}</ol>` : emptyState("Zaman tüneli boş.", ctx.isEditor ? "Sağ üstten ilk anıyı ekle." : "")}`;

  el.onclick = (e) => {
    const ph = e.target.closest("[data-photo]");
    if (ph) { const i = photos.findIndex(p => p.id === ph.dataset.photo); if (i >= 0) openLightbox(photos, i, { getFull: (id) => ctx.store.getFull(id) }); return; }
    const act = e.target.closest("[data-act]"); if (!act || !ctx.isEditor) return;
    const li = e.target.closest("[data-id]"); const item = li ? items.find(x => x.id === li.dataset.id) : null;
    if (act.dataset.act === "add") edit(ctx, null);
    if (act.dataset.act === "edit" && item) edit(ctx, item);
    if (act.dataset.act === "del" && item) edit(ctx, item, true);
  };
}

export function edit(ctx, item, askDelete = false) {
  const isNew = !item;
  const fields = [
    { key: "title", label: "Başlık", required: true },
    { key: "date", label: "Tarih", type: "date", half: true, required: true },
    { key: "time", label: "Saat (isteğe bağlı)", type: "time", half: true },
    { key: "emoji", label: "Simge", type: "emoji", half: true },
    { key: "place", label: "Yer", half: true },
    { key: "text", label: "Anlatım", type: "textarea", rows: 4 },
    { key: "photo", label: "Fotoğraf", type: "photo" },
  ];
  const cur = item ? { ...item, date: toISODate(item.date), time: /T(\d{2}:\d{2})/.test(item.date || "") ? item.date.match(/T(\d{2}:\d{2})/)[1] : "" } : { emoji: "✦" };
  const save = async (v) => {
    const data = { title: v.title, date: v.time ? `${v.date}T${v.time}` : v.date, emoji: v.emoji || "", place: v.place || "", text: v.text || "", photo: v.photo || "", order: item?.order ?? ctx.store.nextOrder("timeline") };
    const id = await ctx.store.upsert("timeline", item?.id, data); if (!item) item = { id, ...data };
  };
  return openForm({ title: isNew ? "Anı ekle" : "Anıyı düzenle", fields, value: cur, autosave: !isNew, onSave: save, ctx: { photos: ctx.data.photos }, onDelete: item ? () => ctx.store.remove("timeline", item.id) : undefined });
}
