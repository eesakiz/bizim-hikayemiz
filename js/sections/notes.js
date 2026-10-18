// "Not Defteri": sticky notes the two of us leave for each other (collaborative).
import { esc, nl2br, relTime, fmtDateTime, icons } from "../util.js";
import { sectionHead, emptyState, confirmDialog, toast } from "../ui.js";

const COLORS = ["gold", "rose", "sky", "mint", "lilac"];

export function render(el, ctx) {
  const notes = ctx.data.notes || []; const can = ctx.signedIn;
  const nameOf = (k) => ctx.people.find(p => p.key === k)?.name || "";
  el.innerHTML = `
    ${sectionHead("defter", "Birbirimize", "Not Defteri", "Küçük notlar, büyük anlamlar. İkimiz de yazabiliriz.")}
    ${can ? `<form class="note-form card" data-note-form>
      <textarea name="text" rows="3" placeholder="${esc(ctx.otherName ? `${ctx.otherName}'a bir not bırak…` : "Bir not bırak…")}" required></textarea>
      <div class="note-form-row"><div class="color-dots">${COLORS.map((c, i) => `<label class="dot ${c}"><input type="radio" name="color" value="${c}" ${i === 0 ? "checked" : ""}><span></span></label>`).join("")}</div><button class="btn primary" type="submit">${icons.send} Bırak</button></div>
    </form>` : ""}
    ${notes.length ? `<div class="notes-grid">${notes.map(n => `
      <article class="note ${esc(n.color || "gold")} ${n.by === ctx.me ? "mine" : ""}" data-id="${n.id}" style="--tilt:${((hash(n.id) % 5) - 2) * 0.8}deg">
        <div class="note-text">${nl2br(n.text)}</div>
        <div class="note-foot"><span class="script note-by">${esc(nameOf(n.by) || "—")}</span><time title="${fmtDateTime(n.at)}">${relTime(n.at)}</time>${can && (n.by === ctx.me || ctx.isEditor) ? `<button class="tool danger" data-act="del" aria-label="Sil">${icons.trash}</button>` : ""}</div>
      </article>`).join("")}</div>` : emptyState("Henüz not yok.", can ? "İlk notu sen bırak." : "")}`;

  el.querySelector("[data-note-form]")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target; const text = f.text.value.trim(); if (!text) return;
    const color = f.color.value; f.querySelector("button").disabled = true;
    try {
      await ctx.store.upsert("notes", null, { text, color, by: ctx.me || "", at: new Date().toISOString() });
      f.reset(); toast("Not bırakıldı 💛");
      if (ctx.otherKey) ctx.notify({ type: "note", to: ctx.otherKey, title: `${ctx.meName} sana bir not bıraktı 📝`, text: text.slice(0, 140) });
    } finally { f.querySelector("button").disabled = false; }
  });
  el.onclick = async (e) => {
    const act = e.target.closest("[data-act=del]"); if (!act) return;
    const id = e.target.closest("[data-id]")?.dataset.id; if (!id) return;
    if (await confirmDialog("Bu not silinsin mi?", { ok: "Sil", danger: true })) await ctx.store.remove("notes", id);
  };
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
