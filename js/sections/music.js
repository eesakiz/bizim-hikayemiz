// "Müziklerimiz": several lists (love / engagement / wedding …), each either a live Spotify
// playlist embed or a site-managed track list (each track optionally a Spotify embed).
import { esc, icons, spotifyInfo, uid } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState, toast, confirmDialog } from "../ui.js";

export function render(el, ctx) {
  const lists = ctx.data.music || [];
  let cur = el.dataset.curList; if (!lists.some(l => l.id === cur)) cur = lists[0]?.id || ""; el.dataset.curList = cur;
  const L = lists.find(l => l.id === cur);
  const dark = ctx.themeDark ? 0 : 1;
  el.innerHTML = `
    ${sectionHead("muzik", "Çalma listelerimiz", "Müziklerimiz", "", ctx.isEditor ? addButton("Liste ekle", "add-list") : "")}
    ${lists.length ? `<div class="tabs" role="tablist">${lists.map(l => `<button class="tab ${l.id === cur ? "on" : ""}" role="tab" data-list="${l.id}">${esc(l.emoji || "🎶")} ${esc(l.title)}</button>`).join("")}</div>` : ""}
    ${L ? renderList(L, ctx, dark) : emptyState("Henüz çalma listesi yok.", ctx.isEditor ? "Sağ üstten bir liste ekle." : "")}`;

  el.onclick = async (e) => {
    const tab = e.target.closest("[data-list]"); if (tab) { el.dataset.curList = tab.dataset.list; return render(el, ctx); }
    const act = e.target.closest("[data-act]"); if (!act) return;
    const row = e.target.closest("[data-track]"); const t = row && L ? (L.tracks || []).find(x => x.id === row.dataset.track) : null;
    switch (act.dataset.act) {
      case "play": { if (!t) return; const inf = spotifyInfo(t.url); if (!inf) return; const open = row.querySelector(".track-embed"); if (open) { open.remove(); row.classList.remove("playing"); return; } el.querySelectorAll(".track-embed").forEach(x => { x.remove(); x.closest("[data-track]")?.classList.remove("playing"); }); const d = document.createElement("div"); d.className = "track-embed"; d.innerHTML = `<iframe src="https://open.spotify.com/embed/${inf.type}/${inf.id}?utm_source=generator&theme=${dark}" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="${esc(t.title)}"></iframe>`; row.appendChild(d); row.classList.add("playing"); return; }
      case "add": if (!ctx.isEditor) return; return act.classList.contains("add-list") ? editList(ctx, null) : editTrack(ctx, L, null);
      case "edit-list": return ctx.isEditor && L && editList(ctx, L);
      case "edit": return ctx.isEditor && t && editTrack(ctx, L, t);
      case "del": return ctx.isEditor && t && removeTrack(ctx, L, t);
      case "up": case "down": { if (!ctx.isEditor || !t) return; const arr = [...(L.tracks || [])]; const i = arr.findIndex(x => x.id === t.id), j = act.dataset.act === "up" ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; return ctx.store.update("music", L.id, { tracks: arr }); }
    }
  };
}

function renderList(L, ctx, dark) {
  const inf = L.mode === "playlist" ? spotifyInfo(L.playlistUrl) : null;
  const head = `<div class="list-head"><div><h3 class="list-title">${esc(L.emoji || "🎶")} ${esc(L.title)}</h3>${L.subtitle ? `<p class="muted">${esc(L.subtitle)}</p>` : ""}</div>${ctx.isEditor ? `<div class="list-tools"><button class="btn small ghost" data-act="edit-list">${icons.pencil} Listeyi düzenle</button>${L.mode !== "playlist" ? addButton("Şarkı ekle", "small") : ""}</div>` : ""}</div>`;
  if (L.mode === "playlist") {
    if (!inf) return head + emptyState("Spotify çalma listesi bağlantısı eksik.", ctx.isEditor ? "Listeyi düzenle → Spotify bağlantısını yapıştır." : "");
    return head + `<div class="playlist-embed"><iframe src="https://open.spotify.com/embed/${inf.type}/${inf.id}?utm_source=generator&theme=${dark}" width="100%" height="420" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="${esc(L.title)}"></iframe><a class="muted small ext" href="${esc(L.playlistUrl)}" target="_blank" rel="noopener">Spotify'da aç ${icons.external}</a></div>`;
  }
  const tracks = L.tracks || [];
  if (!tracks.length) return head + emptyState("Bu listede henüz şarkı yok.");
  return head + `<ol class="tracks">${tracks.map((t, i) => {
    const sp = spotifyInfo(t.url); const q = encodeURIComponent(`${t.artist || ""} ${t.title || ""}`.trim());
    return `<li class="track" data-track="${t.id}">
      <span class="track-n">${i + 1}</span>
      <button class="track-play ${sp ? "" : "disabled"}" data-act="play" aria-label="Çal" ${sp ? "" : "disabled"}>${icons.play}</button>
      <div class="track-main"><div class="track-title">${esc(t.title)}</div><div class="track-artist">${esc(t.artist || "")}</div>${t.note ? `<div class="track-note">${esc(t.note)}</div>` : ""}</div>
      ${sp ? `<a class="track-link" href="${esc(t.url)}" target="_blank" rel="noopener" aria-label="Spotify'da aç">${icons.external}</a>` : `<a class="track-link" href="https://open.spotify.com/search/${q}" target="_blank" rel="noopener" aria-label="Spotify'da ara">${icons.external}</a>`}
      ${ctx.isEditor ? itemTools({ edit: true, up: i > 0, down: i < tracks.length - 1, del: true }) : ""}
    </li>`;
  }).join("")}</ol>`;
}

export function editList(ctx, L) {
  const isNew = !L;
  return openForm({
    title: isNew ? "Liste ekle" : "Listeyi düzenle", value: L || { mode: "tracks", emoji: "🎶" }, autosave: !isNew,
    fields: [
      { key: "title", label: "Liste adı", required: true, half: true },
      { key: "emoji", label: "Simge", type: "emoji", half: true, options: ["🎶", "💞", "💍", "💒", "🎻", "🎹", "🌙", "✨", "🎤", "🎧"] },
      { key: "subtitle", label: "Alt başlık", placeholder: "Bizim şarkılarımız" },
      { key: "mode", label: "Tür", type: "select", options: [{ value: "tracks", label: "Sitede yönetilen şarkı listesi" }, { value: "playlist", label: "Canlı Spotify çalma listesi (Spotify'daki değişiklikler otomatik yansır)" }] },
      { key: "playlistUrl", label: "Spotify çalma listesi bağlantısı", type: "url", placeholder: "https://open.spotify.com/playlist/…", help: "Liste <b>Herkese Açık</b> olmalı (profilden kaldırılmış olabilir)." },
    ],
    onSave: async (v) => { const data = { title: v.title, emoji: v.emoji || "🎶", subtitle: v.subtitle || "", mode: v.mode, playlistUrl: v.playlistUrl || "", order: L?.order ?? ctx.store.nextOrder("music") }; if (!L) data.tracks = []; const id = await ctx.store.upsert("music", L?.id, data); if (!L) L = { id, ...data }; },
    onDelete: L ? () => ctx.store.remove("music", L.id) : undefined,
  });
}

export function editTrack(ctx, L, t) {
  const isNew = !t;
  return openForm({
    title: isNew ? "Şarkı ekle" : "Şarkıyı düzenle", value: t || {}, autosave: false, saveLabel: isNew ? "Ekle" : "Kaydet",
    fields: [
      { key: "url", label: "Spotify şarkı bağlantısı (isteğe bağlı)", type: "url", placeholder: "https://open.spotify.com/track/…", help: "Bağlantı verirsen şarkı sitede çalınabilir." },
      { key: "title", label: "Şarkı", required: true, half: true },
      { key: "artist", label: "Sanatçı", half: true },
      { key: "note", label: "Not", placeholder: "İlk buluşmamızda çalıyordu…" },
    ],
    onSave: async (v) => {
      let title = v.title, artist = v.artist || "";
      const arr = [...(L.tracks || [])];
      const item = { id: t?.id || uid("t"), url: v.url || "", title, artist, note: v.note || "" };
      const i = arr.findIndex(x => x.id === item.id); if (i >= 0) arr[i] = item; else arr.push(item);
      await ctx.store.update("music", L.id, { tracks: arr });
    },
    onDelete: t ? () => removeTrack(ctx, L, t, true) : undefined,
  });
}

async function removeTrack(ctx, L, t, skip = false) {
  if (!skip && !(await confirmDialog(`"${esc(t.title)}" listeden çıkarılsın mı?`, { ok: "Çıkar", danger: true }))) return;
  await ctx.store.update("music", L.id, { tracks: (L.tracks || []).filter(x => x.id !== t.id) }); toast("Şarkı çıkarıldı");
}
