import { auth, db, storage } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  query,
  where,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const addStudentForm = document.getElementById("add-student-form");
const universalRecordsForm = document.getElementById("universal-records-form");
const studentsTableBody = document.querySelector("#students-table tbody");
const scoreEntryCard = document.getElementById("score-entry-card");
const scoreEntryForm = document.getElementById("score-entry-form");
const subjectScoresContainer = document.getElementById(
  "subject-scores-container"
);
const studentNameHeader = document.getElementById("student-name-header");
const generateReportBtn = document.getElementById("generate-report-btn");
const uploadSignatureForm = document.getElementById("signature-upload-form");
const studentRecordsBtn = document.getElementById("student-records-btn");
const promotedToSelect = document.getElementById("promoted-to");

let currentTeacherData;
let currentStudentId;

const teacherNameElement = document.getElementById("teacher-name");

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
    fetchStudents(); // The `populatePromotedToDropdown()` function has been removed.
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut().then(() => {
    localStorage.clear();
    window.location.href = "index.html";
  });
});

addStudentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  toggleButtonLoading(addStudentForm, true);

  const studentName = addStudentForm["student-name"].value;
  const studentPhotoFile = addStudentForm["student-photo"].files[0];
  let photoBase64 = "";

  try {
    if (studentPhotoFile) {
      photoBase64 = await toBase64(studentPhotoFile);
    }

    await addDoc(collection(db, "students"), {
      name: studentName,
      teacherId: auth.currentUser.uid,
      class: currentTeacherData.assignedClass,
      photoBase64: photoBase64 || null,
      scores: {},
    });

    addStudentForm.reset();
    alert("Student added successfully!");
  } catch (error) {
    console.error("Error adding student:", error);
    alert("Error adding student. Please try again.");
  } finally {
    toggleButtonLoading(addStudentForm, false);
    fetchStudents();
  }
});

universalRecordsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  toggleButtonLoading(universalRecordsForm, true);

  const term = universalRecordsForm["term"].value;
  const totalAttendance = universalRecordsForm["total-attendance"].value;
  const vacationDate = universalRecordsForm["vacation-date"].value;
  const reopeningDate = universalRecordsForm["reopening-date"].value;
  const numberOnRoll = universalRecordsForm["number-on-roll"].value;

  const classId = currentTeacherData.assignedClass
    .replace(/\s+/g, "-")
    .toLowerCase();

  try {
    await setDoc(doc(db, "classes", classId, "terms", term), {
      totalAttendance: totalAttendance,
      vacationDate: vacationDate,
      reopeningDate: reopeningDate,
      numberOnRoll: numberOnRoll,
    });
    alert(
      "Universal records saved successfully for " +
        currentTeacherData.assignedClass +
        " - " +
        term
    );
  } catch (error) {
    console.error("Error saving universal records:", error);
    alert("Error saving universal records. Please try again.");
  } finally {
    toggleButtonLoading(universalRecordsForm, false);
  }
});

uploadSignatureForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("upload-signature-btn");
  toggleButtonLoading(uploadSignatureForm, true, submitBtn);

  const teacherSignatureFile =
    uploadSignatureForm["teacher-signature"].files[0];
  if (!teacherSignatureFile) {
    alert("Please select a file to upload.");
    toggleButtonLoading(uploadSignatureForm, false, submitBtn);
    return;
  }

  try {
    const signatureBase64 = await toBase64(teacherSignatureFile);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      signatureBase64: signatureBase64,
    });
    alert("Signature uploaded successfully!");
  } catch (error) {
    console.error("Error uploading signature:", error);
    alert("Error uploading signature. Please try again.");
  } finally {
    toggleButtonLoading(uploadSignatureForm, false, submitBtn);
  }
});

async function fetchStudents() {
  studentsTableBody.innerHTML = "";
  const q = query(
    collection(db, "students"),
    where("teacherId", "==", auth.currentUser.uid)
  );
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    const student = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${student.name}</td>
      <td>${student.class}</td>
      <td>
        <button class="score-btn" data-id="${doc.id}">Enter Scores</button>
        <button class="delete-btn" data-id="${doc.id}">Delete</button>
      </td>
    `;
    studentsTableBody.appendChild(row);
  });

  document.querySelectorAll(".score-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentStudentId = btn.dataset.id;
      scoreEntryCard.style.display = "block";
      const studentName = btn
        .closest("tr")
        .querySelector("td:first-child").textContent;
      studentNameHeader.textContent = studentName;
      populateScoreForm();
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this student?")) {
        const studentIdToDelete = btn.dataset.id;
        try {
          await deleteDoc(doc(db, "students", studentIdToDelete));
          alert("Student deleted successfully!");
          fetchStudents();
        } catch (error) {
          console.error("Error deleting student:", error);
          alert("Error deleting student. Please try again.");
        }
      }
    });
  });
}

async function populateScoreForm() {
  subjectScoresContainer.innerHTML = "";
  const assignedSubjects = currentTeacherData.assignedSubjects || [];
  const studentDoc = await getDoc(doc(db, "students", currentStudentId));
  const studentData = studentDoc.data();
  const studentScores = studentData.scores || {};

  const term = universalRecordsForm.term.value;

  if (!term) {
    alert("Please select a term in the Universal Records form first.");
    return;
  }

  for (const subject of assignedSubjects) {
    const subjectGroup = document.createElement("div");
    subjectGroup.classList.add("score-input-group");
    const scores = (studentScores[term] || {})[subject] || {};

    subjectGroup.innerHTML = `
      <label>${subject}</label>
      <input type="number" class="score-field" name="Quiz-${subject}" placeholder="Quiz (out of 20)" min="0" max="20" value="${
      scores.Quiz || ""
    }" required>
      <input type="number" class="score-field" name="Test1-${subject}" placeholder="Test 1 (out of 10)" min="0" max="10" value="${
      scores.Test1 || ""
    }" required>
      <input type="number" class="score-field" name="Test2-${subject}" placeholder="Test 2 (out of 10)" min="0" max="10" value="${
      scores.Test2 || ""
    }" required>
      <input type="number" class="score-field" name="Test3-${subject}" placeholder="Test 3 (out of 10)" min="0" max="10" value="${
      scores.Test3 || ""
    }" required>
      <input type="number" class="score-field" name="Project-${subject}" placeholder="Project (out of 30)" min="0" max="30" value="${
      scores.Project || ""
    }" required>
      <input type="number" class="score-field" name="Exam-${subject}" placeholder="Exam (out of 100)" min="0" max="100" value="${
      scores.Exam || ""
    }" required>
    `;
    subjectScoresContainer.appendChild(subjectGroup);
  }

  scoreEntryForm["attendance-made"].value =
    (studentScores[term] || {}).attendanceMade || ""; // This line is not needed as the HTML has hard-coded options // scoreEntryForm["promoted-to"].value = //   (studentScores[term] || {}).promotedTo || "";
  scoreEntryForm["remarks"].value = (studentScores[term] || {}).remarks || "";
  scoreEntryForm["conduct"].value = (studentScores[term] || {}).conduct || "";
  scoreEntryForm["attitude"].value = (studentScores[term] || {}).attitude || "";
}

scoreEntryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  toggleButtonLoading(scoreEntryForm, true);

  const term = universalRecordsForm.term.value;
  if (!term) {
    alert("Please select a term in the Universal Records form first.");
    toggleButtonLoading(scoreEntryForm, false);
    return;
  }

  try {
    const scores = {};
    const inputs = scoreEntryForm.querySelectorAll(".score-field");
    inputs.forEach((input) => {
      const [type, subject] = input.name.split("-");
      if (!scores[subject]) {
        scores[subject] = {};
      }
      scores[subject][type] = parseFloat(input.value);
    });

    for (const subject in scores) {
      const s = scores[subject];
      const caTotal =
        (s.Quiz / 20) * 10 +
        (s.Test1 / 10) * 10 +
        (s.Test2 / 10) * 10 +
        (s.Test3 / 10) * 10 +
        (s.Project / 30) * 10;

      const examScore = (s.Exam / 100) * 50;
      const totalScore = caTotal + examScore;

      scores[subject].CA = Math.round(caTotal);
      scores[subject].Exam = Math.round(examScore);
      scores[subject].Total = Math.round(totalScore);
    }

    const studentDocRef = doc(db, "students", currentStudentId);
    const allStudentsQuery = query(
      collection(db, "students"),
      where("teacherId", "==", auth.currentUser.uid)
    );
    const allStudentsSnapshot = await getDocs(allStudentsQuery);
    const studentDataList = [];
    allStudentsSnapshot.forEach((d) => {
      studentDataList.push({ id: d.id, ...d.data() });
    });

    const allStudentTermScores = {};
    for (const s of studentDataList) {
      const termScores = s.scores?.[term] || {};
      let total = 0;
      for (const subject in termScores) {
        if (termScores[subject].Total) {
          total += termScores[subject].Total;
        }
      }
      allStudentTermScores[s.id] = { total, name: s.name, scores: termScores };
    }

    const currentStudentTotal = Object.values(scores).reduce(
      (sum, s) => sum + (s.Total || 0),
      0
    );
    allStudentTermScores[currentStudentId].total = currentStudentTotal;

    const sortedStudents = Object.values(allStudentTermScores).sort(
      (a, b) => b.total - a.total
    );

    const updatedStudentData = {};
    sortedStudents.forEach((s, index) => {
      const rank = index + 1;
      const student = studentDataList.find((d) => d.name === s.name);
      updatedStudentData[student.id] = {
        [`scores.${term}.classPosition`]: rank,
        [`scores.${term}.totalScore`]: s.total,
        ...student.scores,
      };

      if (student.id === currentStudentId) {
        updatedStudentData[student.id][`scores.${term}`] = {
          ...scores,
          attendanceMade: scoreEntryForm["attendance-made"].value,
          promotedTo: promotedToSelect.value,
          remarks: scoreEntryForm["remarks"].value,
          conduct: scoreEntryForm["conduct"].value,
          attitude: scoreEntryForm["attitude"].value,
          totalScore: currentStudentTotal,
          classPosition: rank,
        };
      }
    });

    for (const id in updatedStudentData) {
      await updateDoc(doc(db, "students", id), updatedStudentData[id]);
    }

    alert("Scores and info saved successfully!");
  } catch (error) {
    console.error("Error saving data:", error);
    alert("Error saving data. Please try again.");
  } finally {
    toggleButtonLoading(scoreEntryForm, false);
  }
});

generateReportBtn.addEventListener("click", () => {
  const term = universalRecordsForm.term.value;
  if (!term) {
    alert("Please select a term in the Universal Records form first.");
    return;
  }
  sessionStorage.setItem(
    "reportData",
    JSON.stringify({
      studentId: currentStudentId,
      teacherId: auth.currentUser.uid,
      term: term,
    })
  );
  window.location.href = "report.html";
});

studentRecordsBtn.addEventListener("click", () => {
  window.location.href = "student-records.html";
});

scoreEntryForm.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const fields = Array.from(
      scoreEntryForm.querySelectorAll(
        "input.score-field, input[required], select[required]"
      )
    );
    const focusedIndex = fields.indexOf(document.activeElement);

    if (focusedIndex > -1) {
      e.preventDefault();
      let nextIndex;
      if (e.key === "ArrowRight") {
        nextIndex = focusedIndex + 1;
        if (nextIndex >= fields.length) {
          nextIndex = 0;
        }
      } else if (e.key === "ArrowLeft") {
        nextIndex = focusedIndex - 1;
        if (nextIndex < 0) {
          nextIndex = fields.length - 1;
        }
      }

      fields[nextIndex].focus();
    }
  }
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

function toggleButtonLoading(form, isLoading, submitBtn) {
  const btn = submitBtn || form.querySelector('button[type="submit"]');

  if (!btn) return;

  const btnText = btn.querySelector(".btn-text");
  const loadingText = btn.querySelector(".loading-text");

  if (isLoading) {
    btn.disabled = true;
    if (btnText) btnText.style.display = "none";
    if (loadingText) loadingText.style.display = "inline-block";
  } else {
    btn.disabled = false;
    if (btnText) btnText.style.display = "inline-block";
    if (loadingText) loadingText.style.display = "none";
  }
}
