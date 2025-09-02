import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const loadingSpinner = document.getElementById("loading-spinner");
const errorMessage = document.getElementById("error-message");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginBtn.style.display = "none";
  loadingSpinner.style.display = "flex";
  errorMessage.textContent = "";

  const email = loginForm.email.value;
  const password = loginForm.password.value;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const role = userData.role;
      localStorage.setItem("userRole", role);
      localStorage.setItem("currentUserUid", user.uid);

      if (role === "admin") {
        window.location.href = "admin.html";
      } else if (role === "teacher") {
        window.location.href = "teacher.html";
      } else {
        errorMessage.textContent =
          "Your role is not recognized. Please contact the administrator.";
        await auth.signOut();
      }
    } else {
      errorMessage.textContent = "User data not found. Please contact support.";
      await auth.signOut();
    }
  } catch (error) {
    errorMessage.textContent = "Login failed: " + error.message;
  } finally {
    loginBtn.style.display = "block";
    loadingSpinner.style.display = "none";
  }
});
