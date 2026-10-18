// "Galeri": photo grid with lightbox; editor can upload, caption, reorder, delete, set covers.
import { esc, fmtDate, icons, compressImage, readExifDate, toISODate } from "../util.js";
import { sectionHead, openForm, itemTools, emptyState, openLightbox, toast, confirmDialog } from "../ui.js";

export function render(el, ctx) {
  const photos = ctx.data.photos || []; const cover = ctx.site?.cover || {};
  const sortMode = el.dataset.curSort || "order";
  const list = [...photos].sort(sortMode === "date" ? (a, b) => String(a.date || "").localeCompare(String(b.date || "")) : (a, b) => (a.order ?? 0) - (b.order ?? 0));
  el.innerHTML = `
    ${sectionHead("galeri", "Anılarımız", "Galeri", photos.length ? `${photos.length} fotoğraf` : "", `
      <div class="seg" role="tablist"><button class="seg-btn ${sortMode === "order" ? "on" : ""}" data-sort="order">Sıralı</button><button class="seg-btn ${sortMode === "date" ? "on" : ""}" data-sort="date">Tarihe göre</button></div>
      ${ctx.isEditor ? `<label class="btn add-btn">${icons.upload} Fotoğraf yükle<input type="file" accept="image/*" multiple hidden data-upload></label>` : ""}`)}
    ${list.length ? `<div class="masonry">${list.map((p, i) => `
      <figure class="ph ${ctx.isEditor ? "editable" : ""}" data-id="${p.id}" data-i="${i}">
        <button class="ph-btn" aria-label="${esc(p.caption || "Fotoğraf")}"><img src="${p.thumb}" alt="${esc(p.caption || "")}" loading="lazy" width="${p.w || ""}" height="${p.h || ""}"></button>
        ${(p.caption || p.date) ? `<figcaption><span>${esc(p.caption || "")}</span>${p.date ? `<time>${fmtDate(p.date)}</time>` : ""}</figcaption>` : ""}
        ${cover.wide === p.id || cover.tall === p.id ? `<span class="ph-badge">${icons.star} kapak</span>` : ""}
        ${ctx.isEditor ? itemTools({ edit: true, up: i > 0, down: i < list.length - 1, del: true }) : ""}
      </figure>`).join("")}</div>` : emptyState("Henüz fotoğraf yok.", ctx.isEditor ? "Sağ üstten fotoğraf yükleyebilirsin." : "")}`;

  el.onclick = async (e) => {
    const seg = e.target.closest("[data-sort]"); if (seg) { el.dataset.curSort = seg.dataset.sort; render(el, ctx); return; }
    const fig = e.target.closest(".ph"); const p = fig ? photos.find(x => x.id === fig.dataset.id) : null;
    const act = e.target.closest("[data-act]");
    if (act && p && ctx.isEditor) {
      if (act.dataset.act === "edit") return editPhoto(ctx, p);
      if (act.dataset.act === "del") return delPhoto(ctx, p);
      if (act.dataset.act === "up" || act.dataset.act === "down") {
        const ids = list.map(x => x.id); const i = ids.indexOf(p.id); const j = act.dataset.act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await ctx.store.reorder("photos", ids); return;
      }
      return;
    }
    if (fig && e.target.closest(".ph-btn")) { const idx = list.findIndex(x => x.id === p.id); openLightbox(list, idx, { getFull: (id) => ctx.store.getFull(id), onEdit: ctx.isEditor ? (ph) => editPhoto(ctx, ph) : null }); }
  };
  el.querySelector("[data-upload]")?.addEventListener("change", (e) => upload(ctx, Array.from(e.target.files || [])));
}

export async function upload(ctx, files) {
  if (!files.length) return;
  let order = ctx.store.nextOrder("photos"); let n = 0;
  toast(`${files.length} fotoğraf işleniyor…`);
  for (const f of files) {
    try {
      const [full, thumb, exifDate] = await Promise.all([compressImage(f, { maxSide: 1600, targetKB: 330 }), compressImage(f, { maxSide: 480, targetKB: 48, quality: 0.8 }), readExifDate(f)]);
      const id = await ctx.store.upsert("photos", null, { thumb: thumb.dataUrl, w: full.w, h: full.h, caption: "", date: exifDate ? exifDate.slice(0, 10) : "", place: "", order: order++, addedAt: new Date().toISOString(), addedBy: ctx.me || "" });
      await ctx.store.setFull(id, full.dataUrl); n++;
    } catch (err) { console.error(err); toast(`${esc(f.name)} yüklenemedi`, { type: "error" }); }
  }
  if (n) toast(`${n} fotoğraf eklendi ✓`, { type: "ok" });
}

export function editPhoto(ctx, p) {
  const cover = ctx.site?.cover || {};
  return openForm({
    title: "Fotoğrafı düzenle", autosave: true, ctx,
    value: { caption: p.caption || "", date: toISODate(p.date), place: p.place || "", coverWide: cover.wide === p.id, coverTall: cover.tall === p.id },
    fields: [
      { key: "caption", label: "Başlık / not" },
      { key: "date", label: "Tarih", type: "date", half: true },
      { key: "place", label: "Yer", half: true },
      { key: "coverWide", label: "Kapak fotoğrafı (yatay / masaüstü)", type: "checkbox" },
      { key: "coverTall", label: "Kapak fotoğrafı (dikey / telefon)", type: "checkbox" },
    ],
    onSave: async (v) => {
      await ctx.store.update("photos", p.id, { caption: v.caption, date: v.date, place: v.place });
      const c = { ...(ctx.site?.cover || {}) };
      if (v.coverWide) c.wide = p.id; else if (c.wide === p.id) c.wide = "";
      if (v.coverTall) c.tall = p.id; else if (c.tall === p.id) c.tall = "";
      if (JSON.stringify(c) !== JSON.stringify(ctx.site?.cover || {})) await ctx.store.saveSite({ cover: c });
    },
    onDelete: () => delPhoto(ctx, p, true),
  });
}

async function delPhoto(ctx, p, skipConfirm = false) {
  if (!skipConfirm && !(await confirmDialog("Bu fotoğraf galeriden silinecek.", { ok: "Sil", danger: true }))) return;
  await ctx.store.remove("photos", p.id); await ctx.store.removeFull(p.id).catch(() => { });
  toast("Fotoğraf silindi");
}
