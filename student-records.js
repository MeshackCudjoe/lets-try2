import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const teacherNameElement = document.getElementById("teacher-name");
const backToDashboardBtn = document.getElementById("back-to-dashboard-btn");
const termSelect = document.getElementById("term-select");
const fetchRecordsBtn = document.getElementById("fetch-records-btn");
const recordsTableContainer = document.querySelector(
  ".records-table-container"
);
const recordsTableHead = document.querySelector("#records-table thead tr");
const recordsTableBody = document.querySelector("#records-table tbody");

let currentTeacherData;
let currentStudents = [];
let sortDirection = {};

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  const userDocRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userDocRef);
  if (!docSnap.exists() || docSnap.data().role !== "teacher") {
    await auth.signOut();
    window.location.href = "index.html";
  } else {
    currentTeacherData = docSnap.data();
    teacherNameElement.textContent = currentTeacherData.name;
  }
});

backToDashboardBtn.addEventListener("click", () => {
  window.location.href = "teacher.html";
});

fetchRecordsBtn.addEventListener("click", async () => {
  const selectedTerm = termSelect.value;
  if (!selectedTerm) {
    alert("Please select a term.");
    return;
  }
  await fetchStudentRecords(selectedTerm);
});

async function fetchStudentRecords(term) {
  recordsTableBody.innerHTML = "";
  recordsTableHead.innerHTML = `
    <th data-sort="name">Student Name</th>
  `;
  recordsTableContainer.style.display = "none";

  try {
    const q = query(
      collection(db, "students"),
      where("teacherId", "==", auth.currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    currentStudents = [];
    let subjects = new Set();

    querySnapshot.forEach((doc) => {
      const student = doc.data();
      const termScores = student.scores?.[term] || null;
      if (termScores) {
        currentStudents.push({ id: doc.id, ...student, termScores });
        Object.keys(termScores).forEach((key) => {
          if (
            key !== "attendanceMade" &&
            key !== "promotedTo" &&
            key !== "remarks" &&
            key !== "conduct" &&
            key !== "attitude" &&
            key !== "totalScore" &&
            key !== "classPosition"
          ) {
            subjects.add(key);
          }
        });
      }
    });

    if (currentStudents.length === 0) {
      alert("No records found for the selected term.");
      return;
    }

    const sortedSubjects = Array.from(subjects).sort();
    sortedSubjects.forEach((subject) => {
      recordsTableHead.innerHTML += `
        <th data-sort="${subject}">${subject} 100%</th>
      `;
    });
    recordsTableHead.innerHTML += `
      <th data-sort="totalScore">Total Score</th>
      <th data-sort="classPosition">Position</th>
    `;

    populateTable(currentStudents, sortedSubjects);
    recordsTableContainer.style.display = "block";
    addSortingListeners();
  } catch (error) {
    console.error("Error fetching student records:", error);
    alert("Error fetching records. Please try again.");
  }
}

function toOrdinal(n) {
  if (typeof n !== "number" || n % 1 !== 0) return n;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function populateTable(students, subjects) {
  recordsTableBody.innerHTML = "";
  students.forEach((student) => {
    const row = document.createElement("tr");
    let rowContent = `<td>${student.name}</td>`;
    subjects.forEach((subject) => {
      const score = student.termScores[subject]?.Total || "N/A";
      rowContent += `<td>${score}</td>`;
    });
    const position = student.termScores.classPosition || "N/A";
    const formattedPosition =
      typeof position === "number" ? toOrdinal(position) : position;

    rowContent += `
      <td>${student.termScores.totalScore || "N/A"}</td>
      <td>${formattedPosition}</td>
    `;
    row.innerHTML = rowContent;
    recordsTableBody.appendChild(row);
  });
}

function addSortingListeners() {
  document.querySelectorAll("#records-table th").forEach((header) => {
    header.addEventListener("click", () => {
      const sortKey = header.dataset.sort;
      if (sortKey) {
        sortStudents(sortKey, header);
      }
    });
  });
}

function sortStudents(sortKey, header) {
  const isAsc = sortDirection[sortKey] === "asc";
  const direction = isAsc ? "desc" : "asc";

  currentStudents.sort((a, b) => {
    let aValue, bValue;

    if (sortKey === "name") {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (sortKey === "totalScore" || sortKey === "classPosition") {
      aValue = parseFloat(a.termScores[sortKey] || 0);
      bValue = parseFloat(b.termScores[sortKey] || 0);
    } else {
      aValue = parseFloat(a.termScores[sortKey]?.Total || 0);
      bValue = parseFloat(b.termScores[sortKey]?.Total || 0);
    }

    if (aValue < bValue) {
      return direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  document
    .querySelectorAll("#records-table th")
    .forEach((h) => h.classList.remove("asc", "desc"));
  header.classList.add(direction);
  sortDirection = {};
  sortDirection[sortKey] = direction;

  const sortedSubjects = Array.from(
    document.querySelectorAll("#records-table thead th")
  )
    .slice(1, -2)
    .map((th) => th.dataset.sort);
  populateTable(currentStudents, sortedSubjects);
}
