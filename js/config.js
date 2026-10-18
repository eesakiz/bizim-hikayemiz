// Site configuration.
// NOTE: Nothing personal lives in this repository. Names, texts, dates and photos are
// stored in Firebase (Firestore) behind authentication. This file only holds the public
// Firebase web config (which is safe to publish) and the login scheme.

export const SITE_ID = "main";

// Public Firebase web app config. Leave the object empty ({}) to run in "local" mode
// (data is kept in this browser only; useful for development).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCJd298B3I6SjCjCaysP539YRXVwN07Bwo",
  authDomain: "bizim-hikayemiz-5f8ec.firebaseapp.com",
  projectId: "bizim-hikayemiz-5f8ec",
  storageBucket: "bizim-hikayemiz-5f8ec.firebasestorage.app",
  messagingSenderId: "574270552932",
  appId: "1:574270552932:web:1cb2960d9bff122c82d871",
};

// Two Firebase Auth accounts gate the content: a viewer account (the surprise PIN) and
// an editor account (the second, hidden PIN). The password is "<PIN><suffix>".
// The suffix is public; security relies on the PIN plus Firebase's sign-in rate limiting
// and the fact that self sign-up is disabled on the project.
export const AUTH = {
  emails: {
    viewer: "goruntule@bizimhikayemiz.app",
    editor: "duzenle@bizimhikayemiz.app",
  },
  suffix: "-bizim-hikayemiz-2026",
  pinLength: 4,
};

// PINs used only when FIREBASE_CONFIG is empty (local/demo mode).
export const LOCAL_PINS = { viewer: "2803", editor: "1306" };

// The two people. Keys are used for identity ("who am I on this device").
export const PEOPLE = ["a", "b"];
