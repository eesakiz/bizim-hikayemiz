export { initializeApp } from "firebase/app";
export {
  getAuth, signInWithEmailAndPassword, signOut, setPersistence,
  browserSessionPersistence, browserLocalPersistence, inMemoryPersistence,
  onAuthStateChanged, updatePassword
} from "firebase/auth";
export {
  getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache,
  doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, getDoc, getDocs,
  writeBatch, serverTimestamp, deleteField, arrayUnion, arrayRemove, increment, query, orderBy, limit, where
} from "firebase/firestore";
