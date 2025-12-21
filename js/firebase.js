// ============================================================
// 1. IMPORT LIBRARY
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    setDoc, 
    updateDoc, 
    doc, 
    getDoc, 
    deleteDoc,
    query, 
    where, 
    runTransaction,
    orderBy, 
    limit, 
    writeBatch, 
    serverTimestamp,
    Timestamp, // <--- TAMBAHAN PENTING (IMPORT)
    startAfter, 
    startAt, 
    endBefore, 
    endAt, 
    limitToLast,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


import { 
    getStorage, 
    ref as storageRef, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================
// 2. KONFIGURASI 
// ============================================================
const firebaseConfig = {
    // ... PASTE_CONFIG_DARI_FIREBASE_DISINI ...
    apiKey: "AIzaSyAO9senFKdObEBwAmxrs72oIdJYPBO0XvM",
    authDomain: "simpel-kgb-bangka.firebaseapp.com",
    projectId: "simpel-kgb-bangka",
    storageBucket: "simpel-kgb-bangka.firebasestorage.app",
    messagingSenderId: "1062867802614",
    appId: "1:1062867802614:web:05994b5f872c6e69240fd7"
};

// ============================================================
// 3. INISIALISASI
// ============================================================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// ============================================================
// 4. EXPORT (AGAR BISA DIPAKAI DI FILE LAIN)
// ============================================================
export { 
    // Instance
    db, 
    auth, 
    storage,
    
    // Firestore Core
    collection, 
    getDocs, 
    addDoc, 
    setDoc, 
    updateDoc, 
    doc, 
    getDoc, 
    deleteDoc,
    
    // Firestore Query & Helpers
    query, 
    where, 
    orderBy, 
    limit, 
    writeBatch, 
    serverTimestamp,
    Timestamp, // <--- TAMBAHAN PENTING (EXPORT)
    getCountFromServer,

    // Firestore Pagination
    startAfter, 
    startAt, 
    endBefore, 
    endAt, 
    limitToLast,
    runTransaction,
    // Auth
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,

    // Storage
    storageRef, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject
};

