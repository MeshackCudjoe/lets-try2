import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDB9IFwLC17Sv30GFwYVa_SIGpFKbGmOpk",
  authDomain: "test-115d3.firebaseapp.com",
  projectId: "test-115d3",
  storageBucket: "test-115d3.firebasestorage.app",
  messagingSenderId: "851620524871",
  appId: "1:851620524871:web:a6c72a96720d31ade75262",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
