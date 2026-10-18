// Ambient canvas background (stars / petals / leaves) and celebration bursts.

export class Ambient {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.mode = "none"; this.items = []; this.shooting = []; this.running = false;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize = this.resize.bind(this); this.tick = this.tick.bind(this);
    window.addEventListener("resize", this.resize, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.stop(); else this.start(); });
    this.resize();
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.c.style.width = this.w + "px"; this.c.style.height = this.h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.populate();
  }
  setMode(mode) { if (mode === this.mode) return; this.mode = mode; this.populate(); if (mode === "none") { this.stop(); this.ctx.clearRect(0, 0, this.w, this.h); } else this.start(); }
  populate() {
    const area = this.w * this.h; this.items = [];
    if (this.mode === "stars") {
      const n = Math.round(Math.min(420, area / 3800));
      for (let i = 0; i < n; i++) this.items.push({ x: Math.random() * this.w, y: Math.random() * this.h, r: Math.random() * 1.3 + 0.2, a: Math.random(), s: Math.random() * 0.02 + 0.004, p: Math.random() * Math.PI * 2, w: Math.random() < 0.08 });
    } else if (this.mode === "petals" || this.mode === "leaves") {
      const n = Math.round(Math.min(40, area / 38000));
      for (let i = 0; i < n; i++) this.items.push(this.spawnDrift(true));
    }
  }
  spawnDrift(anywhere = false) {
    return { x: Math.random() * this.w, y: anywhere ? Math.random() * this.h : -20, r: Math.random() * 7 + 5, vy: Math.random() * 0.35 + 0.25, vx: Math.random() * 0.4 - 0.2, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.02, a: Math.random() * 0.35 + 0.25, hue: Math.random() };
  }
  start() { if (this.running || this.mode === "none") return; this.running = true; this.last = performance.now(); requestAnimationFrame(this.tick); }
  stop() { this.running = false; }
  tick(now) {
    if (!this.running) return;
    const dt = Math.min(50, now - this.last); this.last = now;
    const ctx = this.ctx; ctx.clearRect(0, 0, this.w, this.h);
    if (this.mode === "stars") this.drawStars(ctx, dt, now); else this.drawDrift(ctx, dt);
    requestAnimationFrame(this.tick);
  }
  drawStars(ctx, dt, now) {
    const col = getComputedStyle(document.documentElement).getPropertyValue("--star") || "255,245,220";
    for (const s of this.items) {
      if (!this.reduced) s.p += s.s * dt / 16;
      const tw = 0.55 + 0.45 * Math.sin(s.p);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col},${(0.25 + 0.75 * s.a) * tw})`; ctx.fill();
      if (s.w) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(${col},${0.06 * tw})`; ctx.fill(); }
    }
    // occasional shooting star
    if (!this.reduced && Math.random() < 0.0025 * dt / 16 && this.shooting.length < 2) {
      this.shooting.push({ x: Math.random() * this.w * 0.8, y: Math.random() * this.h * 0.4, vx: 7 + Math.random() * 5, vy: 3 + Math.random() * 2, life: 1 });
    }
    for (const sh of this.shooting) {
      sh.x += sh.vx * dt / 16; sh.y += sh.vy * dt / 16; sh.life -= 0.012 * dt / 16;
      const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 14, sh.y - sh.vy * 14);
      g.addColorStop(0, `rgba(${col},${0.9 * sh.life})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 14, sh.y - sh.vy * 14); ctx.stroke();
    }
    this.shooting = this.shooting.filter(s => s.life > 0 && s.x < this.w + 50 && s.y < this.h + 50);
  }
  drawDrift(ctx, dt) {
    const petal = this.mode === "petals";
    const colors = petal ? ["233,150,170", "244,190,200", "214,120,140", "255,210,215"] : ["86,130,96", "150,110,70", "190,120,80", "110,150,110"];
    for (const p of this.items) {
      if (!this.reduced) { p.y += p.vy * dt / 16; p.x += p.vx * dt / 16 + Math.sin(p.y / 40) * 0.3; p.rot += p.vr * dt / 16; }
      if (p.y > this.h + 30) Object.assign(p, this.spawnDrift());
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${colors[Math.floor(p.hue * colors.length)]},${p.a})`;
      ctx.beginPath();
      if (petal) ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
      else { ctx.moveTo(0, -p.r); ctx.quadraticCurveTo(p.r, 0, 0, p.r); ctx.quadraticCurveTo(-p.r, 0, 0, -p.r); }
      ctx.fill(); ctx.restore();
    }
  }
}

// One-off celebration: hearts + sparks rising/falling from a point (or the screen center).
export function burst(canvas, { x, y, count = 90, colors = ["#e3c27a", "#f6e3b0", "#e8a0b4", "#ffffff"] } = {}) {
  const ctx = canvas.getContext("2d"); const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + "px"; canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  x = x ?? w / 2; y = y ?? h / 2;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
    parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 4, g: 0.12 + Math.random() * 0.08, r: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, heart: Math.random() < 0.45, c: colors[i % colors.length], life: 1, decay: 0.008 + Math.random() * 0.01 });
  }
  canvas.style.opacity = "1";
  let raf; const step = () => {
    ctx.clearRect(0, 0, w, h); let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue; alive++;
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.rot += p.vr; p.life -= p.decay;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      if (p.heart) drawHeart(ctx, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.45, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (alive) raf = requestAnimationFrame(step); else { ctx.clearRect(0, 0, w, h); canvas.style.opacity = "0"; }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

function drawHeart(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.35);
  ctx.fill();
}
