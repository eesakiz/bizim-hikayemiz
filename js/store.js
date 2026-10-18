// Data layer: a Firebase (Firestore + Auth) adapter and a local (IndexedDB) adapter behind
// one small API, plus a Store facade that keeps live copies of every collection.
import { AUTH, LOCAL_PINS, SITE_ID } from "./config.js";
import { uid } from "./util.js";

export const COLLECTIONS = ["timeline", "photos", "letters", "reasons", "music", "places", "countdowns", "planning", "bucket", "notes", "events", "presence"];

// Field-value sentinels (adapter-independent)
export const FV = {
  arrayUnion: (...items) => ({ __fv: "arrayUnion", items }),
  increment: (n = 1) => ({ __fv: "increment", n }),
  delete: () => ({ __fv: "delete" }),
};

const roleOfEmail = (email) => email === AUTH.emails.editor ? "editor" : email === AUTH.emails.viewer ? "viewer" : null;

/* ------------------------------------------------------------------ Firebase */
export class FirebaseAdapter {
  constructor(config) { this.config = config; this.kind = "firebase"; }
  async init() {
    const FB = await import("../vendor/firebase.js");
    this.FB = FB;
    this.app = FB.initializeApp(this.config);
    try {
      this.db = FB.initializeFirestore(this.app, { localCache: FB.persistentLocalCache({ tabManager: FB.persistentSingleTabManager() }) });
    } catch (e) { console.warn("persistent cache unavailable", e); this.db = FB.getFirestore(this.app); }
    this.auth = FB.getAuth(this.app);
    try { await FB.setPersistence(this.auth, FB.browserSessionPersistence); } catch (e) { console.warn(e); }
  }
  onAuth(cb) { return this.FB.onAuthStateChanged(this.auth, (u) => cb(u ? roleOfEmail(u.email) : null)); }
  get role() { const u = this.auth.currentUser; return u ? roleOfEmail(u.email) : null; }
  async signIn(role, pin) {
    const email = AUTH.emails[role];
    try { await this.FB.signInWithEmailAndPassword(this.auth, email, pin + AUTH.suffix); }
    catch (e) { throw normalizeAuthError(e); }
    return role;
  }
  async signOut() { await this.FB.signOut(this.auth); }
  async changePin(role, oldPin, newPin) {
    const cred = await this.FB.signInWithEmailAndPassword(this.auth, AUTH.emails[role], oldPin + AUTH.suffix).catch(e => { throw normalizeAuthError(e); });
    await this.FB.updatePassword(cred.user, newPin + AUTH.suffix);
  }
  _conv(data) { // map sentinels to Firestore field values
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && v.__fv) {
        if (v.__fv === "arrayUnion") out[k] = this.FB.arrayUnion(...v.items);
        else if (v.__fv === "increment") out[k] = this.FB.increment(v.n);
        else if (v.__fv === "delete") out[k] = this.FB.deleteField();
      } else out[k] = v;
    }
    return out;
  }
  subDoc(path, cb) {
    return this.FB.onSnapshot(this.FB.doc(this.db, path), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), (err) => cb(null, err));
  }
  subCol(path, cb) {
    return this.FB.onSnapshot(this.FB.collection(this.db, path), (s) => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => cb([], err));
  }
  async get(path) { const s = await this.FB.getDoc(this.FB.doc(this.db, path)); return s.exists() ? { id: s.id, ...s.data() } : null; }
  async getCol(path) { const s = await this.FB.getDocs(this.FB.collection(this.db, path)); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
  async set(path, data, merge = true) { await this.FB.setDoc(this.FB.doc(this.db, path), this._conv(data), { merge }); }
  async update(path, data) { await this.FB.updateDoc(this.FB.doc(this.db, path), this._conv(data)); }
  async add(colPath, data) { const ref = this.FB.doc(this.FB.collection(this.db, colPath)); await this.FB.setDoc(ref, this._conv(data)); return ref.id; }
  async del(path) { await this.FB.deleteDoc(this.FB.doc(this.db, path)); }
  async batch(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = this.FB.writeBatch(this.db);
      for (const op of ops.slice(i, i + 400)) {
        const ref = this.FB.doc(this.db, op.path);
        if (op.type === "delete") b.delete(ref);
        else if (op.type === "update") b.update(ref, this._conv(op.data));
        else b.set(ref, this._conv(op.data), { merge: op.merge !== false });
      }
      await b.commit();
    }
  }
}

function normalizeAuthError(e) {
  const code = e && e.code || "";
  const err = new Error(code || e.message || "auth");
  err.code = code;
  if (/wrong-password|invalid-credential|invalid-login-credentials|user-not-found|invalid-email/.test(code)) err.kind = "wrong";
  else if (/too-many-requests/.test(code)) err.kind = "throttled";
  else if (/network-request-failed/.test(code)) err.kind = "network";
  else err.kind = "other";
  return err;
}

/* --------------------------------------------------------------------- Local */
// IndexedDB-backed adapter for development / demo mode (no Firebase config).
export class LocalAdapter {
  constructor(dbName = "bizim-hikayemiz-local") { this.dbName = dbName; this.kind = "local"; this.docs = new Map(); this.listeners = new Set(); this.authCbs = new Set(); this._role = null; }
  async init() {
    this.idb = await new Promise((res, rej) => {
      const r = indexedDB.open(this.dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("docs");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const all = await this._tx("readonly", (st) => { const req = st.openCursor(); const out = []; return new Promise((res) => { req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); }; }); });
    for (const [k, v] of all) this.docs.set(k, v);
    this.bc = ("BroadcastChannel" in window) ? new BroadcastChannel(this.dbName) : null;
    if (this.bc) this.bc.onmessage = (ev) => { const { path, data } = ev.data; if (data === null) this.docs.delete(path); else this.docs.set(path, data); this._emit(path); };
  }
  _tx(mode, fn) { return new Promise((res, rej) => { const tx = this.idb.transaction("docs", mode); const st = tx.objectStore("docs"); Promise.resolve(fn(st)).then(res, rej); tx.onerror = () => rej(tx.error); }); }
  async _put(path, data) { this.docs.set(path, data); await this._tx("readwrite", (st) => st.put(data, path)); this.bc && this.bc.postMessage({ path, data }); this._emit(path); }
  async _remove(path) { this.docs.delete(path); await this._tx("readwrite", (st) => st.delete(path)); this.bc && this.bc.postMessage({ path, data: null }); this._emit(path); }
  _emit(path) {
    for (const l of this.listeners) {
      if (l.kind === "doc" && l.path === path) l.cb(this._doc(path));
      if (l.kind === "col" && path.startsWith(l.path + "/") && !path.slice(l.path.length + 1).includes("/")) l.cb(this._col(l.path));
    }
  }
  _doc(path) { const d = this.docs.get(path); return d ? { id: path.split("/").pop(), ...d } : null; }
  _col(path) { const out = []; for (const [k, v] of this.docs) if (k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")) out.push({ id: k.split("/").pop(), ...v }); return out; }
  onAuth(cb) { this.authCbs.add(cb); cb(this._role); return () => this.authCbs.delete(cb); }
  get role() { return this._role; }
  async signIn(role, pin) { if (LOCAL_PINS[role] !== pin) { const e = new Error("wrong"); e.kind = "wrong"; throw e; } this._role = role; this.authCbs.forEach(cb => cb(role)); return role; }
  async signOut() { this._role = null; this.authCbs.forEach(cb => cb(null)); }
  async changePin(role, oldPin, newPin) { if (LOCAL_PINS[role] !== oldPin) { const e = new Error("wrong"); e.kind = "wrong"; throw e; } LOCAL_PINS[role] = newPin; }
  _apply(existing, data) {
    const out = { ...(existing || {}) };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && v.__fv) {
        if (v.__fv === "arrayUnion") { const arr = Array.isArray(out[k]) ? [...out[k]] : []; for (const it of v.items) if (!arr.some(x => JSON.stringify(x) === JSON.stringify(it))) arr.push(it); out[k] = arr; }
        else if (v.__fv === "increment") out[k] = (typeof out[k] === "number" ? out[k] : 0) + v.n;
        else if (v.__fv === "delete") delete out[k];
      } else out[k] = v;
    }
    return out;
  }
  subDoc(path, cb) { const l = { kind: "doc", path, cb }; this.listeners.add(l); queueMicrotask(() => cb(this._doc(path))); return () => this.listeners.delete(l); }
  subCol(path, cb) { const l = { kind: "col", path, cb }; this.listeners.add(l); queueMicrotask(() => cb(this._col(path))); return () => this.listeners.delete(l); }
  async get(path) { return this._doc(path); }
  async getCol(path) { return this._col(path); }
  async set(path, data, merge = true) { await this._put(path, merge ? this._apply(this.docs.get(path), data) : this._apply({}, data)); }
  async update(path, data) { await this._put(path, this._apply(this.docs.get(path), data)); }
  async add(colPath, data) { const id = uid(); await this.set(`${colPath}/${id}`, data, false); return id; }
  async del(path) { await this._remove(path); }
  async batch(ops) { for (const op of ops) { if (op.type === "delete") await this.del(op.path); else if (op.type === "update") await this.update(op.path, op.data); else await this.set(op.path, op.data, op.merge !== false); } }
}

/* --------------------------------------------------------------------- Store */
export class Store extends EventTarget {
  constructor(adapter) {
    super();
    this.adapter = adapter;
    this.base = `sites/${SITE_ID}`;
    this.data = { site: null };
    for (const c of COLLECTIONS) this.data[c] = [];
    this.loaded = new Set();
    this.unsubs = [];
    this.role = null;
    this.errors = [];
  }
  get kind() { return this.adapter.kind; }
  get isEditor() { return this.role === "editor"; }
  get signedIn() { return !!this.role; }

  async init() {
    await this.adapter.init();
    // Resolve once the initial auth state is known (restored session or none).
    await new Promise((res) => {
      let first = true; const t = setTimeout(res, 2500);
      this.adapter.onAuth((role) => { this.role = role; this.emit("auth", role); if (first) { first = false; clearTimeout(t); res(); } });
    });
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) { this.addEventListener(type, (e) => fn(e.detail)); }

  signIn(role, pin) { return this.adapter.signIn(role, pin); }
  signOut() { this.stop(); return this.adapter.signOut(); }
  changePin(role, oldPin, newPin) { return this.adapter.changePin(role, oldPin, newPin); }

  // Live subscriptions to everything.
  start() {
    this.stop();
    this.unsubs.push(this.adapter.subDoc(this.base, (doc, err) => {
      if (err) { this.errors.push(err); console.error(err); this.emit("error", err); return; }
      this.data.site = doc; this.loaded.add("site"); this.emit("change", "site");
    }));
    for (const c of COLLECTIONS) {
      this.unsubs.push(this.adapter.subCol(`${this.base}/${c}`, (docs, err) => {
        if (err) { this.errors.push(err); console.error(c, err); this.emit("error", err); return; }
        this.data[c] = sortDocs(c, docs); this.loaded.add(c); this.emit("change", c);
      }));
    }
  }
  stop() { for (const u of this.unsubs) try { u(); } catch { } this.unsubs = []; }
  get ready() { return this.loaded.has("site") && COLLECTIONS.every(c => this.loaded.has(c)); }

  // --- writes ---
  saveSite(partial) { return this.adapter.set(this.base, partial, true); }
  upsert(col, id, data) { if (!id) return this.adapter.add(`${this.base}/${col}`, data); return this.adapter.set(`${this.base}/${col}/${id}`, data, true).then(() => id); }
  update(col, id, data) { return this.adapter.update(`${this.base}/${col}/${id}`, data); }
  remove(col, id) { return this.adapter.del(`${this.base}/${col}/${id}`); }
  getFull(photoId) { return this.adapter.get(`${this.base}/photoFull/${photoId}`); }
  setFull(photoId, data) { return this.adapter.set(`${this.base}/photoFull/${photoId}`, { data }, false); }
  removeFull(photoId) { return this.adapter.del(`${this.base}/photoFull/${photoId}`); }
  // Reorder: assign order = index for given ids
  async reorder(col, ids) {
    await this.adapter.batch(ids.map((id, i) => ({ type: "update", path: `${this.base}/${col}/${id}`, data: { order: i } })));
  }
  nextOrder(col) { const arr = this.data[col] || []; return arr.length ? Math.max(...arr.map(x => x.order ?? 0)) + 1 : 0; }

  // --- events / notifications ---
  async addEvent(ev) {
    const data = { at: new Date().toISOString(), seenBy: [ev.by], ...ev };
    return this.adapter.add(`${this.base}/events`, data);
  }
  async markSeen(me) {
    const unseen = (this.data.events || []).filter(e => !(e.seenBy || []).includes(me));
    if (!unseen.length) return;
    await this.adapter.batch(unseen.map(e => ({ type: "update", path: `${this.base}/events/${e.id}`, data: { seenBy: FV.arrayUnion(me) } })));
  }
  unseenCount(me) { return (this.data.events || []).filter(e => e.by !== me && !(e.seenBy || []).includes(me)).length; }
  setPresence(me, extra = {}) { return this.adapter.set(`${this.base}/presence/${me}`, { lastSeen: new Date().toISOString(), ...extra }, true).catch(() => { }); }

  // --- backup ---
  async exportAll({ includePhotos = true } = {}) {
    const out = { version: 2, exportedAt: new Date().toISOString(), site: this.data.site || {}, collections: {} };
    for (const c of COLLECTIONS) out.collections[c] = (this.data[c] || []).map(d => ({ ...d }));
    if (includePhotos) {
      out.collections.photoFull = [];
      for (const p of this.data.photos || []) { const f = await this.getFull(p.id); if (f) out.collections.photoFull.push({ id: p.id, data: f.data }); }
    }
    return out;
  }
  async importAll(json, { replace = false, onProgress } = {}) {
    const ops = [];
    if (replace) {
      for (const c of COLLECTIONS) for (const d of this.data[c] || []) ops.push({ type: "delete", path: `${this.base}/${c}/${d.id}` });
      for (const p of this.data.photos || []) ops.push({ type: "delete", path: `${this.base}/photoFull/${p.id}` });
    }
    if (json.site) { const { id, ...site } = json.site; ops.push({ type: "set", path: this.base, data: site, merge: !replace }); }
    const cols = json.collections || {};
    for (const [c, docs] of Object.entries(cols)) {
      if (!Array.isArray(docs)) continue;
      for (const d of docs) { const { id, ...data } = d; ops.push({ type: "set", path: `${this.base}/${c}/${id || uid()}`, data, merge: false }); }
    }
    // delete ops first, then sets; chunk by count AND payload size (Firestore batches max 10 MiB / 500 writes)
    const dels = ops.filter(o => o.type === "delete"), sets = ops.filter(o => o.type !== "delete");
    const all = [...dels, ...sets]; let done = 0;
    const MAX_BYTES = 6 * 1024 * 1024, MAX_OPS = 200;
    let chunk = [], bytes = 0;
    const flush = async () => { if (!chunk.length) return; await this.adapter.batch(chunk); done += chunk.length; onProgress && onProgress(done, all.length); chunk = []; bytes = 0; };
    for (const op of all) {
      const size = op.data ? JSON.stringify(op.data).length : 64;
      if (chunk.length && (bytes + size > MAX_BYTES || chunk.length >= MAX_OPS)) await flush();
      chunk.push(op); bytes += size;
    }
    await flush();
    return all.length;
  }
}

function sortDocs(col, docs) {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  switch (col) {
    case "timeline": return docs.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || byOrder(a, b));
    case "notes": case "events": return docs.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    case "planning": return docs.sort(byOrder);
    default: return docs.sort(byOrder);
  }
}
