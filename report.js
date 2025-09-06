import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const reportCardContent = document.getElementById("report-card-content");
const generatePdfBtn = document.getElementById("generate-pdf-btn");
const pdfLoadingSpinner = document.getElementById("pdf-loading-spinner");

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString.replace(/-/g, "/"));
  const options = { year: "numeric", month: "long", day: "numeric" };
  const formattedDate = date.toLocaleDateString("en-US", options);
  const day = date.getDate();
  const getPositionSuffix = (d) => {
    const j = d % 10,
      k = d % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };
  return formattedDate.replace(/\d+/, `${day}${getPositionSuffix(day)}`);
}

function getGradeAndRemarks(score) {
  if (score >= 80) return { grade: "A1", remarks: "Excellent" };
  if (score >= 75) return { grade: "B2", remarks: "Very Good" };
  if (score >= 70) return { grade: "B3", remarks: "Good" };
  if (score >= 64) return { grade: "C4", remarks: "Credit" };
  if (score >= 60) return { grade: "C5", remarks: "Credit" };
  if (score >= 55) return { grade: "C6", remarks: "Credit" };
  if (score >= 50) return { grade: "D7", remarks: "Pass" };
  if (score >= 45) return { grade: "E8", remarks: "Pass" };
  return { grade: "F9", remarks: "Fail" };
}

async function generateReportCard() {
  const reportData = JSON.parse(sessionStorage.getItem("reportData"));
  if (!reportData) {
    alert("No report data found. Please go back to the teacher dashboard.");
    window.location.href = "teacher.html";
    return;
  }

  const { studentId, teacherId, term } = reportData;

  const studentDocRef = doc(db, "students", studentId);
  const teacherDocRef = doc(db, "users", teacherId);
  const adminsQuery = query(
    collection(db, "users"),
    where("role", "==", "admin")
  );

  const [studentSnap, teacherSnap, adminsSnap] = await Promise.all([
    getDoc(studentDocRef),
    getDoc(teacherDocRef),
    getDocs(adminsQuery),
  ]);

  const studentData = studentSnap.data();
  const teacherData = teacherSnap.data();
  const adminData =
    adminsSnap.docs.length > 0 ? adminsSnap.docs[0].data() : null;

  const classId = studentData.class.replace(/\s+/g, "-").toLowerCase();
  const universalRecordsDocRef = doc(db, "classes", classId, "terms", term);
  const universalRecordsSnap = await getDoc(universalRecordsDocRef);
  const universalRecordsData = universalRecordsSnap.exists()
    ? universalRecordsSnap.data()
    : {};

  if (!studentData || !teacherData) {
    alert("Required data not found. Please contact support.");
    return;
  }

  const currentTermScores =
    (studentData.scores && studentData.scores[term]) || {};
  let totalScore = 0;
  let subjectsCount = 0;

  document.getElementById("student-name").textContent = studentData.name;
  document.getElementById("term").textContent = term;
  document.getElementById("student-class").textContent = studentData.class;
  document.getElementById("reopening-date").textContent = formatDate(
    universalRecordsData.reopeningDate
  );
  document.getElementById("vacation-date").textContent = formatDate(
    universalRecordsData.vacationDate
  );
  // CORRECTED: Accessing universal records for these fields
  document.getElementById("number-on-roll").textContent =
    universalRecordsData.numberOnRoll || "N/A";
  document.getElementById("overall-attendance").textContent =
    universalRecordsData.totalAttendance || "N/A";
  document.getElementById("attendance-made").textContent =
    currentTermScores.attendanceMade || "N/A";
  document.getElementById("promoted-to").textContent =
    currentTermScores.promotedTo || "N/A";
  document.getElementById("conduct").textContent =
    currentTermScores.conduct || "N/A";
  document.getElementById("attitude").textContent =
    currentTermScores.attitude || "N/A";
  document.getElementById("remarks").textContent =
    currentTermScores.remarks || "N/A";

  const studentPosition = currentTermScores.classPosition || "N/A";
  document.getElementById("position").textContent =
    typeof studentPosition === "number"
      ? `${studentPosition}${getPositionSuffix(studentPosition)}`
      : "N/A";

  if (studentData.photoBase64) {
    document.getElementById("student-photo").src = studentData.photoBase64;
  }
  if (teacherData.signatureBase64) {
    document.getElementById("teacher-signature").src =
      teacherData.signatureBase64;
  }
  if (adminData && adminData.signatureBase64) {
    document.getElementById("admin-signature").src = adminData.signatureBase64;
  }

  const scoresTableBody = document.getElementById("scores-table-body");
  scoresTableBody.innerHTML = "";

  for (const subject in currentTermScores) {
    const scores = currentTermScores[subject];
    if (scores && scores.Total !== undefined) {
      const continuousAssessment = scores.CA || "N/A";
      // Using the calculated 50% exam score
      const examScore50 = scores.Exam || "N/A";
      const finalScore = scores.Total || "N/A";
      totalScore += finalScore;
      subjectsCount++;

      const { grade, remarks } = getGradeAndRemarks(finalScore);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${subject}</td>
        <td>${continuousAssessment}</td>
        <td>${examScore50}</td>
        <td>${Math.round(finalScore)}</td>
        <td>${grade}</td>
        <td>${remarks}</td>
      `;
      scoresTableBody.appendChild(row);
    }
  }

  document.getElementById("total-score").textContent = Math.round(totalScore);
  document.getElementById("average-score").textContent = (
    totalScore / (subjectsCount || 1)
  ).toFixed(2);
}

function getPositionSuffix(i) {
  const j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

generatePdfBtn.addEventListener("click", async () => {
  pdfLoadingSpinner.style.display = "flex";
  const studentDoc = await getDoc(
    doc(
      db,
      "students",
      JSON.parse(sessionStorage.getItem("reportData")).studentId
    )
  );
  const studentName = studentDoc.data().name || "student-report";

  const element = document.getElementById("report-card-content");
  const options = {
    margin: [-2, -2],
    filename: `${studentName}-report.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 1, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css"] },
    windowWidth: 900,
  };

  html2pdf()
    .set(options)
    .from(element)
    .save()
    .finally(() => {
      pdfLoadingSpinner.style.display = "none";
    });
});

document.addEventListener("DOMContentLoaded", generateReportCard);
