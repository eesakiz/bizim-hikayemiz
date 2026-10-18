// Hero: names, live counter since the first conversation, quick stats.
import { esc, elapsed, fmtDate, fmtTime, parseLocal, daysBetween, icons, plural } from "../util.js";

let timer = null;

export function render(el, ctx) {
  const site = ctx.site || {}; const a = ctx.people[0], b = ctx.people[1];
  const anchors = site.anchors || {};
  const start = anchors.firstTalk || "2026-03-28T04:40";
  const startD = parseLocal(start);
  const cover = pickCover(ctx);
  el.innerHTML = `
    <div class="hero-bg ${cover ? "has-photo" : ""}">${cover ? `<img class="hero-photo" src="${cover}" alt="">` : ""}<div class="hero-vignette"></div></div>
    <div class="hero-inner">
      <div class="monogram script">${esc(initial(a.name))} <span class="amp">&amp;</span> ${esc(initial(b.name))}</div>
      <h1 class="hero-title"><span>${esc(a.name)}</span><span class="amp script">&amp;</span><span>${esc(b.name)}</span></h1>
      <p class="hero-sub">${esc(site.heroLine || `${fmtDate(startD)} · ${fmtTime(startD)}'tan beri`)}</p>
      <div class="counter" aria-live="off">
        ${["days", "hours", "minutes", "seconds"].map(k => `<div class="count-cell"><div class="count-num" data-k="${k}">0</div><div class="count-lab">${{ days: "gün", hours: "saat", minutes: "dakika", seconds: "saniye" }[k]}</div></div>`).join("")}
      </div>
      <p class="counter-alt" data-alt></p>
      <div class="hero-stats">
        ${statCard("💞", "sevgiliyiz", anchors.couple ? `${daysBetween(anchors.couple)} gün` : "—", anchors.couple ? `${fmtDate(anchors.couple)}'ten beri` : "")}
        ${statCard("📸", "anı", `${(ctx.data.photos || []).length}`, "fotoğraf")}
        ${statCard("📍", "yer", `${(ctx.data.places || []).length}`, "haritada")}
        ${nextEventCard(ctx)}
      </div>
      <a class="scroll-cue" href="#hikaye" aria-label="Aşağı kaydır"><span></span></a>
    </div>`;

  // Upgrade the cover from thumbnail to full resolution once available.
  const coverId = pickCoverId(ctx);
  if (coverId) {
    const img = el.querySelector(".hero-photo");
    if (fullCache.has(coverId)) { if (img) img.src = fullCache.get(coverId); }
    else ctx.store.getFull(coverId).then(f => { if (f?.data) { fullCache.set(coverId, f.data); const im = el.querySelector(".hero-photo"); if (im) im.src = f.data; } }).catch(() => { });
  }

  const nums = {}; el.querySelectorAll(".count-num").forEach(n => nums[n.dataset.k] = n);
  const alt = el.querySelector("[data-alt]");
  const tick = () => {
    const e = elapsed(startD);
    nums.days.textContent = e.days.toLocaleString("tr-TR");
    nums.hours.textContent = String(e.hours).padStart(2, "0");
    nums.minutes.textContent = String(e.minutes).padStart(2, "0");
    nums.seconds.textContent = String(e.seconds).padStart(2, "0");
    const parts = [];
    if (e.years) parts.push(plural(e.years, "yıl"));
    if (e.months) parts.push(plural(e.months, "ay"));
    parts.push(plural(e.calDays, "gün"));
    alt.textContent = `yani ${parts.join(" ")} — ${e.weeks.toLocaleString("tr-TR")} hafta, ${e.totalSeconds.toLocaleString("tr-TR")} saniye`;
  };
  clearInterval(timer); tick(); timer = setInterval(tick, 1000);
}

function statCard(emoji, label, value, sub) {
  return `<div class="stat"><div class="stat-emoji">${emoji}</div><div class="stat-val">${esc(value)}</div><div class="stat-lab">${esc(label)}</div>${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ""}</div>`;
}

function nextEventCard(ctx) {
  const ev = (ctx.upcoming || [])[0];
  if (!ev) return statCard("🗓️", "yaklaşan", "—", "");
  return statCard(ev.emoji || "🗓️", ev.title, ev.days === 0 ? "bugün!" : `${ev.days} gün`, ev.approx ? ev.approx : fmtDate(ev.when));
}

function initial(name) { return (name || "?").trim().charAt(0).toLocaleUpperCase("tr-TR"); }

const fullCache = new Map();
function pickCoverId(ctx) {
  const cover = ctx.site?.cover || {};
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  return (portrait && cover.tall) ? cover.tall : (cover.wide || cover.tall || "");
}
function pickCover(ctx) {
  const id = pickCoverId(ctx); const p = (ctx.data.photos || []).find(x => x.id === id);
  return p ? (fullCache.get(p.id) || p.thumb) : "";
}
