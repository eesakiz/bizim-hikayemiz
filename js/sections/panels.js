// Panels: settings (editor), notifications drawer, identity chooser, backup import/export.
import { esc, icons, relTime, download, fmtDateTime } from "../util.js";
import { openModal, openForm, toast, confirmDialog } from "../ui.js";

export const THEMES = { gece: "🌙 Gece & zarif", romantik: "🌸 Romantik & yumuşak", minimal: "◻️ Minimal & modern", botanik: "🌿 Botanik & sulu boya" };

export function openSettings(ctx) {
  const s = ctx.site || {}; const a = s.couple?.a || {}, b = s.couple?.b || {}; const nf = s.notify || {};
  return openForm({
    title: "Site ayarları", size: "lg", autosave: true,
    value: { title: s.title || "", heroLine: s.heroLine || "", pinHint: s.pinHint || "", theme: s.theme || "gece", aName: a.name || "", aFull: a.full || "", aBday: a.bday || "", bName: b.name || "", bFull: b.full || "", bBday: b.bday || "", reasonsTitle: s.reasonsTitle || "", reasonsLead: s.reasonsLead || "", ntfyA: nf.a?.ntfy || "", emailA: nf.a?.email || "", ntfyB: nf.b?.ntfy || "", emailB: nf.b?.email || "" },
    fields: [
      { key: "title", label: "Site başlığı", placeholder: "Hatice & Ensar", half: true },
      { key: "theme", label: "Varsayılan tema", type: "select", half: true, options: Object.entries(THEMES).map(([v, l]) => ({ value: v, label: l })) },
      { key: "heroLine", label: "Sayaç üstü satır (boşsa otomatik)", placeholder: "28 Mart 2026 · 04.40'tan beri", half: true },
      { key: "pinHint", label: "Şifre ekranı ipucu", placeholder: "İlk konuştuğumuz gün (GGAA)", half: true },
      { key: "aName", label: "1. kişi — ad", half: true }, { key: "aBday", label: "Doğum günü", type: "date", half: true },
      { key: "aFull", label: "1. kişi — ad soyad" },
      { key: "bName", label: "2. kişi — ad", half: true }, { key: "bBday", label: "Doğum günü", type: "date", half: true },
      { key: "bFull", label: "2. kişi — ad soyad" },
      { key: "reasonsTitle", label: "'Sebepler' bölüm başlığı", placeholder: "Seni sevme sebeplerim", half: true },
      { key: "reasonsLead", label: "'Sebepler' alt metni", half: true },
      { key: "ntfyA", label: `${a.name || "1. kişi"} — ntfy konusu`, placeholder: "ör. bh-hatice-x7k2p", half: true, help: "Telefona anlık bildirim için <b>ntfy</b> uygulamasını kurup bu konuya abone ol." },
      { key: "emailA", label: `${a.name || "1. kişi"} — bildirim e-postası`, type: "email", half: true },
      { key: "ntfyB", label: `${b.name || "2. kişi"} — ntfy konusu`, placeholder: "ör. bh-ensar-q9m4z", half: true },
      { key: "emailB", label: `${b.name || "2. kişi"} — bildirim e-postası`, type: "email", half: true },
    ],
    onSave: (v) => ctx.store.saveSite({
      title: v.title, heroLine: v.heroLine, pinHint: v.pinHint, theme: v.theme, reasonsTitle: v.reasonsTitle, reasonsLead: v.reasonsLead,
      couple: { a: { name: v.aName, full: v.aFull, bday: v.aBday }, b: { name: v.bName, full: v.bFull, bday: v.bBday } },
      notify: { a: { ntfy: v.ntfyA.trim(), email: v.emailA.trim() }, b: { ntfy: v.ntfyB.trim(), email: v.emailB.trim() } },
    }),
  });
}

export function openBackup(ctx) {
  const wrap = document.createElement("div"); wrap.className = "backup";
  wrap.innerHTML = `
    <p class="muted">Tüm içeriği (fotoğraflar dahil) tek bir JSON dosyası olarak indirebilir ya da bir yedeği geri yükleyebilirsin.</p>
    <div class="backup-row"><button class="btn primary" data-exp>${icons.download} Yedek indir</button><label class="btn ghost">${icons.upload} Yedekten içe aktar<input type="file" accept="application/json,.json" hidden data-imp></label></div>
    <label class="field check" style="margin-top:10px"><input type="checkbox" data-replace><span class="field-label">İçe aktarırken mevcut içeriği tamamen değiştir (sil ve yükle)</span></label>
    <div class="form-status" data-st></div>`;
  const m = openModal({ title: "Yedekleme", content: wrap, size: "md" });
  const st = wrap.querySelector("[data-st]");
  wrap.querySelector("[data-exp]").onclick = async (e) => { e.target.disabled = true; st.textContent = "Hazırlanıyor…"; try { const j = await ctx.store.exportAll(); download(`bizim-hikayemiz-yedek-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(j)); st.textContent = "İndirildi ✓"; } catch (err) { st.textContent = "Hata: " + err.message; } finally { e.target.disabled = false; } };
  wrap.querySelector("[data-imp]").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const replace = wrap.querySelector("[data-replace]").checked;
    if (replace && !(await confirmDialog("Mevcut tüm içerik silinip yedekteki içerik yüklenecek. Emin misin?", { ok: "Evet, değiştir", danger: true }))) return;
    try {
      st.textContent = "Okunuyor…"; const json = JSON.parse(await f.text());
      const n = await ctx.store.importAll(json, { replace, onProgress: (d, t) => { st.textContent = `Yükleniyor… ${d}/${t}`; } });
      st.textContent = `Tamamlandı ✓ (${n} kayıt)`; toast("İçe aktarıldı ✓", { type: "ok" });
    } catch (err) { console.error(err); st.textContent = "Hata: " + (err.message || err); }
  };
  return m.done;
}

export function openPinChange(ctx) {
  const wrap = document.createElement("form"); wrap.className = "form";
  wrap.innerHTML = `
    <label class="field half"><span class="field-label">Hangi PIN?</span><select name="role"><option value="viewer">Giriş PIN'i (sürpriz şifresi)</option><option value="editor">Düzenleme PIN'i</option></select></label>
    <label class="field half"><span class="field-label">Mevcut PIN</span><input name="old" inputmode="numeric" pattern="[0-9]*" maxlength="8" required></label>
    <label class="field half"><span class="field-label">Yeni PIN (4-8 rakam)</span><input name="n1" inputmode="numeric" pattern="[0-9]*" maxlength="8" required></label>
    <label class="field half"><span class="field-label">Yeni PIN (tekrar)</span><input name="n2" inputmode="numeric" pattern="[0-9]*" maxlength="8" required></label>
    <p class="muted small">PIN değişince diğer cihazlarda yeniden giriş gerekir. Düzenleme PIN'ini değiştirirsen bu oturum kapanır.</p>`;
  return openModal({
    title: "PIN değiştir", content: wrap, actions: [{ label: "Vazgeç", cls: "ghost" }, {
      label: "Değiştir", cls: "primary", close: false, onClick: async (m) => {
        const f = wrap; const role = f.role.value, o = f.old.value.trim(), n1 = f.n1.value.trim(), n2 = f.n2.value.trim();
        if (!/^\d{4,8}$/.test(n1)) { toast("Yeni PIN 4-8 rakam olmalı", { type: "error" }); return false; }
        if (n1 !== n2) { toast("Yeni PIN'ler eşleşmiyor", { type: "error" }); return false; }
        try { await ctx.store.changePin(role, o, n1); toast("PIN değiştirildi ✓", { type: "ok" }); m.close(true); setTimeout(() => location.reload(), 800); }
        catch (e) { toast(e.kind === "wrong" ? "Mevcut PIN yanlış" : "Değiştirilemedi: " + (e.message || e), { type: "error" }); return false; }
      }
    }],
  }).done;
}

export function openNotifications(ctx) {
  const evs = (ctx.data.events || []).slice(0, 60);
  const nameOf = (k) => ctx.people.find(p => p.key === k)?.name || "";
  const html = evs.length ? `<ul class="ev-list">${evs.map(e => `<li class="ev ${(e.seenBy || []).includes(ctx.me) ? "" : "new"}"><div class="ev-ico">${evIcon(e.type)}</div><div><div class="ev-title">${esc(e.title || "")}</div>${e.text ? `<div class="ev-text">${esc(e.text)}</div>` : ""}<div class="ev-meta">${esc(nameOf(e.by))} · <time title="${fmtDateTime(e.at)}">${relTime(e.at)}</time></div></div></li>`).join("")}</ul>` : `<p class="muted">Henüz bir hareket yok.</p>`;
  const m = openModal({ title: "Bildirimler", content: html, size: "md", actions: [{ label: "Tamam", cls: "primary", onClick: () => { } }] });
  ctx.store.markSeen(ctx.me).catch(() => { });
  return m.done;
}
function evIcon(t) { return { letter_opened: "💌", note: "📝", bucket_done: "🌟", comment: "💬", visit: "👋", photo: "📸", plan: "📋" }[t] || "✨"; }

export function chooseIdentity(ctx, { force = false } = {}) {
  const [a, b] = ctx.people;
  return new Promise((res) => {
    const wrap = document.createElement("div"); wrap.className = "who";
    wrap.innerHTML = `<p class="muted">Notlar ve bildirimler doğru kişiye gitsin diye: bu cihazı kim kullanıyor?</p><div class="who-btns"><button class="who-btn" data-k="a"><span class="who-ini">${esc((a.name || "A").charAt(0))}</span>${esc(a.name || "1. kişi")}</button><button class="who-btn" data-k="b"><span class="who-ini">${esc((b.name || "B").charAt(0))}</span>${esc(b.name || "2. kişi")}</button></div>`;
    const m = openModal({ title: "Sen kimsin?", content: wrap, size: "sm", closable: !force, onClose: (r) => { if (r === null) res(null); } });
    wrap.onclick = (e) => { const bt = e.target.closest("[data-k]"); if (!bt) return; m.close(bt.dataset.k); res(bt.dataset.k); };
  });
}
