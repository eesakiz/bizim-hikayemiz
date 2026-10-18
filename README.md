# Bizim Hikâyemiz

A private, PIN-protected couple website: a live "together since" counter, our story, a
timeline, a photo gallery, open-when letters, reasons, playlists, a memory map, countdowns
and a calendar, an engagement/wedding planner, a bucket list and a shared notebook.

**No personal content lives in this repository.** Names, texts, dates and photos are stored
in Firebase (Firestore) behind authentication; this repo is only the static "engine" served by
GitHub Pages. The Firebase web config in `js/config.js` is public by design.

## How it works

- `index.html`, `css/styles.css`, `js/**` — vanilla JS, no build step.
- `vendor/firebase.js` — the Firebase SDK (app, auth, firestore) bundled with esbuild.
- `vendor/leaflet/` — Leaflet 1.9.4 (map). Tiles from CARTO/OpenStreetMap.
- `vendor/fonts/` — self-hosted Cormorant Garamond, Manrope, Great Vibes (latin + latin-ext).
- `firestore.rules` — the security rules deployed to the Firebase project.

Two Firebase Auth accounts gate the content: a **viewer** account (the surprise PIN) and an
**editor** account (the second PIN). Password = PIN + the public suffix in `config.js`.
Self sign-up is disabled on the Firebase project, so no other accounts can be created.

- Viewer: reads everything; can write to the collaborative collections (planner, calendar,
  bucket list, notebook, activity) and can mark letters as opened.
- Editor: can edit everything (story, timeline, photos, letters, reasons, music, places, settings).

Edits are saved automatically and sync in real time to every open device.

## Local development

Open `index.html?local` through any static server (e.g. `python3 -m http.server`). With `?local`
the site uses an in-browser IndexedDB store instead of Firebase (PINs from `LOCAL_PINS`).

## Rebuilding the Firebase bundle

```
npm i firebase esbuild
npx esbuild firebase-entry.js --bundle --format=esm --minify --target=es2020 --outfile=vendor/firebase.js
```

`firebase-entry.js` re-exports the functions used by `js/store.js`.

## Custom domain

Add a `CNAME` file with the domain and point the DNS at GitHub Pages; nothing else changes.
