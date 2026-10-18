// "Yerlerimiz": a map of the places we have been, with a grouped list.
import { esc, nl2br, fmtDate, icons, parseLatLng, toISODate } from "../util.js";
import { sectionHead, openForm, itemTools, addButton, emptyState, openLightbox } from "../ui.js";

const TYPES = { cami: { label: "Cami", emoji: "🕌" }, kafe: { label: "Kafe / restoran", emoji: "☕" }, sehir: { label: "Şehir", emoji: "🏙️" }, manzara: { label: "Manzara / doğa", emoji: "🌅" }, bulusma: { label: "Buluşma noktası", emoji: "💞" }, ev: { label: "Ev", emoji: "🏠" }, diger: { label: "Diğer", emoji: "📍" } };
let map = null, markers = {};

export function render(el, ctx) {
  const places = ctx.data.places || []; const photos = ctx.data.photos || [];
  const byId = Object.fromEntries(photos.map(p => [p.id, p]));
  const groups = {};
  for (const p of places) { const k = p.city || "Diğer"; (groups[k] ||= []).push(p); }
  el.innerHTML = `
    ${sectionHead("yerler", "Anı haritası", "Yerlerimiz", places.length ? `${places.length} yer · ${Object.keys(groups).length} şehir` : "", ctx.isEditor ? addButton("Yer ekle") : "")}
    <div class="map-wrap"><div id="map" class="map" role="region" aria-label="Harita"></div></div>
    ${places.length ? `<div class="place-groups">${Object.entries(groups).map(([city, arr]) => `
      <div class="place-group"><h3 class="place-city">${esc(city)} <span class="muted">(${arr.length})</span></h3>
        <ul class="place-list">${arr.map(p => { const ph = p.photo ? byId[p.photo] : null; const t = TYPES[p.type] || TYPES.diger; return `
          <li class="place" data-id="${p.id}"><button class="place-btn" data-fly="${p.id}"><span class="place-emoji">${t.emoji}</span><span class="place-main"><span class="place-name">${esc(p.name)}</span>${p.date ? `<span class="place-date">${fmtDate(p.date)}</span>` : ""}${p.note ? `<span class="place-note">${esc(p.note)}</span>` : ""}</span>${ph ? `<img class="place-thumb" src="${ph.thumb}" alt="" data-photo="${ph.id}">` : ""}</button>${ctx.isEditor ? itemTools({ edit: true, del: true }) : ""}</li>`; }).join("")}</ul></div>`).join("")}</div>` : emptyState("Haritada henüz yer yok.", ctx.isEditor ? "Sağ üstten yer ekle (Google Haritalar bağlantısı yapıştırman yeterli)." : "")}`;

  initMap(el.querySelector("#map"), places, ctx);

  el.onclick = (e) => {
    const act = e.target.closest("[data-act]"); const li = e.target.closest("[data-id]"); const p = li ? places.find(x => x.id === li.dataset.id) : null;
    if (act && ctx.isEditor) { if (act.dataset.act === "add") return editPlace(ctx, null); if (act.dataset.act === "edit" && p) return editPlace(ctx, p); if (act.dataset.act === "del" && p) return editPlace(ctx, p, true); return; }
    const img = e.target.closest("[data-photo]"); if (img) { e.stopPropagation(); const i = photos.findIndex(x => x.id === img.dataset.photo); if (i >= 0) openLightbox(photos, i, { getFull: (id) => ctx.store.getFull(id) }); return; }
    const fly = e.target.closest("[data-fly]"); if (fly && p && map) { map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 13), { duration: 0.8 }); markers[p.id]?.openPopup(); el.querySelector("#map").scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
}

function initMap(container, places, ctx) {
  if (!window.L || !container) return;
  if (map) { try { map.remove(); } catch { } map = null; markers = {}; }
  map = L.map(container, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  const dark = ctx.themeDark;
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', subdomains: "abcd", maxZoom: 19 }).addTo(map);
  const pts = [];
  for (const p of places) {
    if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    const t = TYPES[p.type] || TYPES.diger;
    const icon = L.divIcon({ className: "pin-icon", html: `<div class="pin"><span>${t.emoji}</span></div>`, iconSize: [36, 44], iconAnchor: [18, 42], popupAnchor: [0, -40] });
    const m = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
    m.bindPopup(`<div class="pop"><b>${esc(p.name)}</b>${p.city ? `<div class="muted">${esc(p.city)}</div>` : ""}${p.date ? `<div class="muted">${fmtDate(p.date)}</div>` : ""}${p.note ? `<div>${nl2br(p.note)}</div>` : ""}</div>`);
    markers[p.id] = m; pts.push([p.lat, p.lng]);
  }
  if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 }); else map.setView([40.75, 29.9], 7);
  map.once("focus", () => map.scrollWheelZoom.enable());
  setTimeout(() => map.invalidateSize(), 300);
}

export function editPlace(ctx, p) {
  const isNew = !p;
  return openForm({
    title: isNew ? "Yer ekle" : "Yeri düzenle", ctx: { photos: ctx.data.photos }, autosave: !isNew,
    value: p ? { ...p, coords: `${p.lat}, ${p.lng}`, date: toISODate(p.date) } : { type: "cami" },
    fields: [
      { key: "name", label: "Ad", required: true, half: true },
      { key: "city", label: "Şehir / ilçe", half: true },
      { key: "type", label: "Tür", type: "select", half: true, options: Object.entries(TYPES).map(([v, t]) => ({ value: v, label: `${t.emoji} ${t.label}` })) },
      { key: "date", label: "Tarih (isteğe bağlı)", type: "date", half: true },
      { key: "coords", label: "Konum", required: true, placeholder: "Google Haritalar bağlantısı ya da 40.76, 29.93", help: "Google Haritalar'da yeri aç → Paylaş → bağlantıyı kopyalayıp buraya yapıştır; ya da enlem, boylam yaz." },
      { key: "note", label: "Not", type: "textarea", rows: 2 },
      { key: "photo", label: "Fotoğraf", type: "photo" },
    ],
    onSave: async (v) => {
      let ll = parseLatLng(v.coords);
      if (!ll) { // fall back to geocoding the typed text (or name + city)
        const q = (v.coords && !/^https?:/.test(v.coords)) ? v.coords : `${v.name} ${v.city || ""}`;
        try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } }); const j = await r.json(); if (j[0]) ll = { lat: +j[0].lat, lng: +j[0].lon }; } catch { }
      }
      if (!ll) throw new Error("Konum çözümlenemedi — Google Haritalar'ın uzun bağlantısını ya da 'enlem, boylam' yaz.");
      const data = { name: v.name, city: v.city || "", type: v.type || "diger", date: v.date || "", lat: ll.lat, lng: ll.lng, note: v.note || "", photo: v.photo || "", order: p?.order ?? ctx.store.nextOrder("places") };
      const id = await ctx.store.upsert("places", p?.id, data); if (!p) p = { id, ...data };
    },
    onDelete: p ? () => ctx.store.remove("places", p.id) : undefined,
  });
}
