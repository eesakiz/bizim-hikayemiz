// "Mektuplar": open-when envelopes and time-locked letters.
import { esc, nl2br, fmtDateTime, fmtDate, parseLocal, icons, relTime, toISODateTime } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState, openModal, toast } from "../ui.js";
import { FV } from "../store.js";

let tickTimer = null;

export function render(el, ctx) {
  const letters = ctx.data.letters || []; const now = Date.now();
  const nameOf = (k) => ctx.people.find(p => p.key === k)?.name || "";
  el.innerHTML = `
    ${sectionHead("mektuplar", "Şu zaman aç", "Mektuplar", "Her zarf bir an için yazıldı. Zamanı geldiğinde mührü kır.", ctx.isEditor ? addButton("Zarf ekle") : "")}
    ${letters.length ? `<div class="envelopes">${letters.map((L, i) => {
      const unlock = L.unlockAt ? parseLocal(L.unlockAt) : null; const locked = unlock && unlock.getTime() > now;
      const opened = (L.opens || []).length; const mine = L.author === ctx.me;
      const lastOpen = L.lastOpenedAt ? relTime(L.lastOpenedAt) : "";
      return `<article class="env ${locked ? "locked" : ""} ${opened ? "opened" : ""}" data-id="${L.id}" style="--seal:${esc(L.seal || "#b3263a")}" tabindex="0" role="button" aria-label="${esc(L.title)}">
        <div class="env-paper"></div>
        <div class="env-flap"></div>
        <div class="env-body"></div>
        <div class="env-seal">${locked ? icons.lock : `<span>${esc(L.emoji || "💌")}</span>`}</div>
        <div class="env-text">
          ${locked ? `<div class="env-kicker">kilitli</div>` : ""}
          <h3 class="env-title">${esc(L.title)}</h3>
          ${locked ? `<div class="env-hint" data-unlock="${esc(L.unlockAt)}">${fmtDate(unlock)} tarihinde açılır</div>` : (L.hint ? `<div class="env-hint">${esc(L.hint)}</div>` : "")}
          <div class="env-meta">${L.author ? `${esc(nameOf(L.author))}'dan` : ""}${opened && (mine || ctx.isEditor) ? ` · ${opened} kez açıldı${lastOpen ? `, son: ${lastOpen}` : ""}` : ""}</div>
        </div>
        ${ctx.isEditor ? itemTools({ edit: true, up: i > 0, down: i < letters.length - 1, del: true }) : ""}
      </article>`;
    }).join("")}</div>` : emptyState("Henüz zarf yok.", ctx.isEditor ? "İlk zarfı sağ üstten ekle." : "")}`;

  el.onclick = async (e) => {
    const act = e.target.closest("[data-act]"); const card = e.target.closest(".env"); const L = card ? letters.find(x => x.id === card.dataset.id) : null;
    if (act && ctx.isEditor) {
      if (act.dataset.act === "add") return editLetter(ctx, null);
      if (!L) return;
      if (act.dataset.act === "edit") return editLetter(ctx, L);
      if (act.dataset.act === "del") return editLetter(ctx, L, true);
      if (act.dataset.act === "up" || act.dataset.act === "down") { const ids = letters.map(x => x.id); const i = ids.indexOf(L.id), j = act.dataset.act === "up" ? i - 1 : i + 1; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; return ctx.store.reorder("letters", ids); }
      return;
    }
    if (L) openLetter(ctx, L);
  };
  el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { const card = e.target.closest(".env"); if (card) { e.preventDefault(); const L = letters.find(x => x.id === card.dataset.id); L && openLetter(ctx, L); } } };

  // countdown refresh for locked envelopes (once a minute)
  clearInterval(tickTimer);
  if (letters.some(L => L.unlockAt && parseLocal(L.unlockAt) > new Date())) tickTimer = setInterval(() => { if (letters.some(L => L.unlockAt && parseLocal(L.unlockAt) <= new Date() && el.querySelector(`.env.locked[data-id="${L.id}"]`))) render(el, ctx); }, 60000);
}

export async function openLetter(ctx, L) {
  const unlock = L.unlockAt ? parseLocal(L.unlockAt) : null;
  if (unlock && unlock > new Date()) {
    const ms = unlock - new Date(); const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    openModal({ title: `${icons.lock} Henüz zamanı değil`, size: "sm", content: `<p class="confirm-text">Bu zarf <b>${fmtDateTime(unlock)}</b> tarihinde açılacak.<br><span class="muted">${d} gün ${h} saat ${m} dakika kaldı.</span></p>`, actions: [{ label: "Tamam", cls: "primary", onClick: () => { } }] });
    return;
  }
  const nameOf = (k) => ctx.people.find(p => p.key === k)?.name || "";
  const wrap = document.createElement("div"); wrap.className = "letter-open";
  wrap.innerHTML = `
    <div class="letter-env" style="--seal:${esc(L.seal || "#b3263a")}">
      <div class="le-back"></div><div class="le-paper"><div class="le-paper-inner"><div class="le-emoji">${esc(L.emoji || "💌")}</div><h3>${esc(L.title)}</h3><div class="le-body">${nl2br(L.body || "")}</div>${L.author ? `<div class="le-sign script">${esc(nameOf(L.author))}</div>` : ""}</div></div><div class="le-front"></div><div class="le-flap"></div><div class="le-seal">${esc(L.emoji || "💌")}</div>
    </div>
    <p class="le-cue">Mührü kırmak için dokun</p>`;
  const m = openModal({ title: "", content: wrap, size: "lg", cls: "letter-modal" });
  const env = wrap.querySelector(".letter-env");
  let opened = false;
  const doOpen = async () => {
    if (opened) return; opened = true;
    env.classList.add("open"); wrap.querySelector(".le-cue").textContent = "";
    setTimeout(() => env.classList.add("read"), 900);
    // record + notify
    try {
      const rec = { by: ctx.me || "", at: new Date().toISOString() };
      await ctx.store.update("letters", L.id, { opens: FV.arrayUnion(rec), openCount: FV.increment(1), lastOpenedAt: rec.at });
      if (L.author && L.author !== ctx.me) ctx.notify({ type: "letter_opened", to: L.author, title: `${ctx.meName} bir zarfı açtı 💌`, text: `"${L.title}" zarfı ${fmtDateTime(rec.at)} tarihinde açıldı.` });
    } catch (e) { console.warn("open record failed", e); }
  };
  env.addEventListener("click", doOpen); wrap.querySelector(".le-cue").addEventListener("click", doOpen);
  return m.done;
}

export function editLetter(ctx, L, askDelete = false) {
  const isNew = !L;
  const fields = [
    { key: "title", label: "Zarfın üstündeki başlık", placeholder: "Beni özlediğinde aç", required: true },
    { key: "hint", label: "Küçük ipucu (isteğe bağlı)", placeholder: "Gece geç saatte okumak için", half: true },
    { key: "author", label: "Yazan", type: "person", half: true },
    { key: "emoji", label: "Mühür simgesi", type: "emoji", half: true },
    { key: "seal", label: "Mühür rengi", type: "seal", half: true },
    { key: "unlockAt", label: "Belirli bir tarihte açılsın (isteğe bağlı)", type: "datetime", help: "Boş bırakırsan her zaman açılabilir." },
    { key: "body", label: "Mektup", type: "textarea", rows: 10, required: true },
  ];
  const cur = L ? { ...L, unlockAt: L.unlockAt ? toISODateTime(L.unlockAt) : "" } : { emoji: "💌", seal: "#b3263a", author: ctx.me || "" };
  const save = async (v) => {
    const data = { title: v.title, hint: v.hint || "", author: v.author || "", emoji: v.emoji || "💌", seal: v.seal || "#b3263a", unlockAt: v.unlockAt || "", body: v.body || "", order: L?.order ?? ctx.store.nextOrder("letters") };
    if (isNew && !L) data.opens = [], data.openCount = 0;
    const id = await ctx.store.upsert("letters", L?.id, data); if (!L) L = { id, ...data };
  };
  return openForm({ title: isNew ? "Zarf ekle" : "Zarfı düzenle", size: "lg", fields, value: cur, autosave: !isNew, onSave: save, ctx, onDelete: L ? () => ctx.store.remove("letters", L.id) : undefined });
}
