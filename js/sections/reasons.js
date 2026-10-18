// "Seni sevme sebeplerim": a deck of reasons; draw one at random or see them all.
import { esc, nl2br, icons } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState } from "../ui.js";

export function render(el, ctx) {
  const items = ctx.data.reasons || []; const site = ctx.site || {};
  const title = site.reasonsTitle || `Seni sevme sebeplerim`;
  const showAll = el.dataset.all === "1";
  let current = Number(el.dataset.cur ?? -1); if (current < 0 || current >= items.length) current = items.length ? Math.floor(Math.random() * items.length) : -1;
  el.dataset.cur = current;
  el.innerHTML = `
    ${sectionHead("sebepler", `${items.length ? items.length + " sebep" : ""}`, title, site.reasonsLead || "", ctx.isEditor ? addButton("Sebep ekle") : "")}
    ${items.length ? `
      <div class="reason-stage">
        <div class="reason-card" key="${current}">
          <div class="reason-num">№ ${current + 1}</div>
          <p class="reason-text">${nl2br(items[current].text)}</p>
        </div>
        <div class="reason-btns"><button class="btn primary" data-act="draw">${icons.shuffle} Başka bir sebep</button><button class="btn ghost" data-act="toggle">${showAll ? "Desteyi kapat" : "Hepsini gör"}</button></div>
      </div>
      ${showAll ? `<ol class="reason-list">${items.map((r, i) => `<li class="reason-item" data-id="${r.id}"><span class="reason-i">${i + 1}</span><span>${nl2br(r.text)}</span>${ctx.isEditor ? itemTools({ edit: true, up: i > 0, down: i < items.length - 1, del: true }) : ""}</li>`).join("")}</ol>` : ""}`
      : emptyState("Henüz sebep yazılmadı.", ctx.isEditor ? "Sağ üstten ilk sebebi ekle." : "")}`;

  el.onclick = async (e) => {
    const act = e.target.closest("[data-act]"); if (!act) return;
    const li = e.target.closest("[data-id]"); const r = li ? items.find(x => x.id === li.dataset.id) : null;
    switch (act.dataset.act) {
      case "draw": { if (items.length < 2) return; let n; do { n = Math.floor(Math.random() * items.length); } while (n === current); el.dataset.cur = n; const card = el.querySelector(".reason-card"); card.classList.add("flip"); setTimeout(() => render(el, ctx), 260); return; }
      case "toggle": el.dataset.all = showAll ? "0" : "1"; return render(el, ctx);
      case "add": return editReason(ctx, null);
      case "edit": return r && editReason(ctx, r);
      case "del": return r && editReason(ctx, r, true);
      case "up": case "down": { if (!r) return; const ids = items.map(x => x.id); const i = ids.indexOf(r.id), j = act.dataset.act === "up" ? i - 1 : i + 1; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; return ctx.store.reorder("reasons", ids); }
    }
  };
}

export function editReason(ctx, r) {
  const isNew = !r;
  return openForm({
    title: isNew ? "Sebep ekle" : "Sebebi düzenle", value: r || {}, autosave: !isNew,
    fields: [{ key: "text", label: "Sebep", type: "textarea", rows: 3, required: true, placeholder: "…çünkü" }],
    onSave: async (v) => { const data = { text: v.text, order: r?.order ?? ctx.store.nextOrder("reasons") }; const id = await ctx.store.upsert("reasons", r?.id, data); if (!r) r = { id, ...data }; },
    onDelete: r ? () => ctx.store.remove("reasons", r.id) : undefined,
  });
}
