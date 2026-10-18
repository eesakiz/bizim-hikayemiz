// "Hikâyemiz": the narrative and the key facts strip.
import { esc, nl2br, fmtDate, fmtTime, parseLocal, icons, daysBetween } from "../util.js";
import { sectionHead, openForm } from "../ui.js";

export function render(el, ctx) {
  const site = ctx.site || {}; const s = site.story || {}; const an = site.anchors || {};
  const paras = (s.text || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const facts = [
    an.instagram ? { icon: "📷", k: "İlk karşılaşma", v: fmtDate(an.instagram), sub: an.instagramNote || "Instagram" } : null,
    an.firstTalk ? { icon: "💬", k: "İlk konuşma", v: fmtDate(an.firstTalk), sub: `saat ${fmtTime(an.firstTalk)}${an.instagram ? ` · takibin ${daysBetween(an.instagram, an.firstTalk) + 1}. günü` : ""}` } : null,
    an.firstMeet ? { icon: "☕", k: "İlk buluşma", v: fmtDate(an.firstMeet), sub: an.firstMeetPlace || "" } : null,
    an.couple ? { icon: "💞", k: "Sevgili olduk", v: fmtDate(an.couple), sub: an.coupleNote || "" } : null,
    (s.cityA || s.cityB) ? { icon: "🗺️", k: "İki şehir", v: `${esc(s.cityA || "")} ↔ ${esc(s.cityB || "")}`, sub: s.midpoint ? `orta nokta: ${s.midpoint}` : "" } : null,
  ].filter(Boolean);

  el.innerHTML = `
    ${sectionHead("hikaye", "Nasıl başladı", s.heading || "Hikâyemiz", "", ctx.isEditor ? `<button class="btn ghost small" data-act="edit">${icons.pencil} Düzenle</button>` : "")}
    <div class="story-grid">
      <div class="story-text">
        ${paras.length ? paras.map((p, i) => `<p class="${i === 0 ? "dropcap" : ""}">${nl2br(p)}</p>`).join("") : `<p class="muted">Hikâye henüz yazılmadı.</p>`}
        ${s.quote ? `<blockquote class="story-quote">${icons.quote}<p>${nl2br(s.quote)}</p>${s.quoteBy ? `<cite>— ${esc(s.quoteBy)}</cite>` : ""}</blockquote>` : ""}
      </div>
      <aside class="facts">
        ${facts.map(f => `<div class="fact"><div class="fact-icon">${f.icon}</div><div><div class="fact-k">${esc(f.k)}</div><div class="fact-v">${f.v}</div>${f.sub ? `<div class="fact-sub">${esc(f.sub)}</div>` : ""}</div></div>`).join("")}
      </aside>
    </div>`;

  el.querySelector("[data-act=edit]")?.addEventListener("click", () => openForm({
    title: "Hikâyeyi düzenle", size: "lg", autosave: true,
    value: { heading: s.heading || "Hikâyemiz", text: s.text || "", quote: s.quote || "", quoteBy: s.quoteBy || "", cityA: s.cityA || "", cityB: s.cityB || "", midpoint: s.midpoint || "", instagram: an.instagram || "", instagramNote: an.instagramNote || "", firstTalk: an.firstTalk || "", firstMeet: an.firstMeet || "", firstMeetPlace: an.firstMeetPlace || "", couple: an.couple || "", coupleNote: an.coupleNote || "" },
    fields: [
      { key: "heading", label: "Başlık", half: true },
      { key: "midpoint", label: "Orta nokta (şehir)", half: true },
      { key: "cityA", label: `${ctx.people[0].name} nerede yaşıyor?`, half: true },
      { key: "cityB", label: `${ctx.people[1].name} nerede yaşıyor?`, half: true },
      { key: "text", label: "Hikâye metni", type: "textarea", rows: 12, help: "Paragrafları boş satırla ayır." },
      { key: "quote", label: "Alıntı / söz (isteğe bağlı)", type: "textarea", rows: 2, half: true },
      { key: "quoteBy", label: "Kimden", half: true },
      { key: "instagram", label: "İlk karşılaşma (Instagram) tarihi", type: "date", half: true },
      { key: "instagramNote", label: "Not", half: true },
      { key: "firstTalk", label: "İlk konuşma (sayaç başlangıcı)", type: "datetime", half: true, required: true },
      { key: "couple", label: "Sevgili olma tarihi", type: "date", half: true },
      { key: "firstMeet", label: "İlk buluşma tarihi", type: "date", half: true },
      { key: "firstMeetPlace", label: "İlk buluşma yeri", half: true },
      { key: "coupleNote", label: "Sevgili olma notu", half: true },
    ],
    onSave: (v) => ctx.store.saveSite({
      story: { heading: v.heading, text: v.text, quote: v.quote, quoteBy: v.quoteBy, cityA: v.cityA, cityB: v.cityB, midpoint: v.midpoint },
      anchors: { instagram: v.instagram, instagramNote: v.instagramNote, firstTalk: v.firstTalk, firstMeet: v.firstMeet, firstMeetPlace: v.firstMeetPlace, couple: v.couple, coupleNote: v.coupleNote },
    }),
  }));
}
