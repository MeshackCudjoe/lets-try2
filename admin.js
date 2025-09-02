import { auth, db, storage } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const addTeacherForm = document.getElementById("add-teacher-form");
const teachersTableBody = document.querySelector("#teachers-table tbody");
const loadingMessage = document.getElementById("loading-message");
const statusMessage = document.getElementById("status-message");
const signatureUploadForm = document.getElementById("signature-upload-form");
const adminNameDisplay = document.getElementById("admin-name");
const teacherDepartmentSelect = document.getElementById("teacher-department");
const teacherClassSelect = document.getElementById("teacher-class");

const subjects = {
  PreSchool: ["O.W.O.P", "Literacy", "Creativity", "Numeracy", "Writing"],
  Primary: [
    "O.W.O.P",
    "English",
    "Creative Arts",
    "Mathematics",
    "Science",
    "R.M.E",
    "French",
    "Ghanaian Language",
    "History",
    "Computing",
  ],
  JHS: [
    "Social Studies",
    "English Language",
    "Creative Arts and Design",
    "Mathematics",
    "Science",
    "R.M.E",
    "French",
    "Ghanaian Language",
    "Career Tech.",
    "Computing",
  ],
};

const classes = {
  PreSchool: ["Creche", "Nursery 1", "Nursery 2", "K.G. 1", "K.G. 2"],
  Primary: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  JHS: ["J.H.S. 1", "J.H.S. 2", "J.H.S. 3"],
};

teacherDepartmentSelect.addEventListener("change", () => {
  const selectedDepartment = teacherDepartmentSelect.value;
  teacherClassSelect.innerHTML = '<option value="">Select Class</option>';
  if (selectedDepartment && classes[selectedDepartment]) {
    classes[selectedDepartment].forEach((className) => {
      const option = document.createElement("option");
      option.value = className;
      option.textContent = className;
      teacherClassSelect.appendChild(option);
    });
  }
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  const userDocRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userDocRef);
  if (!docSnap.exists() || docSnap.data().role !== "admin") {
    await auth.signOut();
    window.location.href = "index.html";
  } else {
    adminNameDisplay.textContent = docSnap.data().name || "Admin";
    fetchTeachers();
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut().then(() => {
    localStorage.clear();
    window.location.href = "index.html";
  });
});

addTeacherForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loadingMessage.style.display = "flex";
  statusMessage.textContent = "";

  const name = addTeacherForm["teacher-name"].value;
  const email = addTeacherForm["teacher-email"].value;
  const password = addTeacherForm["teacher-password"].value;
  const assignedDepartment = teacherDepartmentSelect.value;
  const assignedClass = teacherClassSelect.value;
  const assignedSubjects = subjects[assignedDepartment];

  try {
    const adminUser = auth.currentUser;

    // 1. Create the user authentication record.
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const newTeacherUser = userCredential.user;

    // 2. Re-authenticate the admin to restore their session.
    // This is the crucial step to prevent the admin from being logged out.
    // For this to work, you need to get the admin's password securely.
    // A simple prompt is shown here for demonstration.
    const adminPassword = prompt(
      "Please enter your admin password to confirm:"
    );
    if (!adminPassword) {
      // If the admin cancels, delete the newly created user and abort.
      await newTeacherUser.delete();
      statusMessage.textContent =
        "Admin password not provided. Teacher not added.";
      statusMessage.style.color = "red";
      return;
    }

    await signInWithEmailAndPassword(auth, adminUser.email, adminPassword);

    // 3. Save the teacher's data to the 'users' collection using the new user's UID as the document ID.
    await setDoc(doc(db, "users", newTeacherUser.uid), {
      name: name,
      email: email,
      role: "teacher",
      assignedDepartment: assignedDepartment,
      assignedClass: assignedClass,
      assignedSubjects: assignedSubjects,
      signatureURL: "",
    });

    statusMessage.textContent = "Teacher account created successfully!";
    statusMessage.style.color = "green";
    addTeacherForm.reset();
    fetchTeachers(); // Refresh the teacher list
  } catch (error) {
    statusMessage.textContent = "Error: " + error.message;
    statusMessage.style.color = "red";
    console.error("Error creating teacher:", error);

    // In case of an error during account creation, try to restore the admin's session.
    if (auth.currentUser && auth.currentUser.uid !== adminUser.uid) {
      try {
        await auth.currentUser.delete(); // Delete the incomplete user
        await signInWithEmailAndPassword(auth, adminUser.email, password); // Restore admin's session
      } catch (e) {
        console.error("Failed to restore admin session:", e);
      }
    }
  } finally {
    loadingMessage.style.display = "none";
  }
});

async function fetchTeachers() {
  teachersTableBody.innerHTML = "";
  // Query the 'users' collection for documents where the role is 'teacher'.
  const q = query(collection(db, "users"), where("role", "==", "teacher"));
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach((doc) => {
    const teacher = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${teacher.name}</td>
        <td>${teacher.email}</td>
        <td>${teacher.assignedClass || "N/A"}</td>
        <td>
          <button class="delete-btn" data-id="${doc.id}">Delete</button>
        </td>
      `;
    teachersTableBody.appendChild(row);
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this teacher?")) {
        const teacherId = btn.dataset.id;
        try {
          await deleteDoc(doc(db, "users", teacherId));
          alert("Teacher deleted successfully!");
          fetchTeachers();
        } catch (error) {
          alert("Error deleting teacher: " + error.message);
        }
      }
    });
  });
}

// FIX: Change the signature upload logic to save to the admin's user document
signatureUploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = signatureUploadForm["admin-signature"].files[0];
  if (!file) {
    alert("Please select a file to upload.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (event) => {
    const base64String = event.target.result;
    try {
      const adminId = auth.currentUser.uid;
      await updateDoc(doc(db, "users", adminId), {
        signatureBase64: base64String,
      });
      alert("Admin signature uploaded successfully!");
    } catch (error) {
      alert("Failed to upload signature: " + error.message);
    }
  };
  reader.readAsDataURL(file);
});
