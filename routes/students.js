// const express = require("express");
// const router = express.Router();
// const jwt = require("jsonwebtoken");
// const Student = require("../models/Student");
// const Application = require("../models/Application");

// // Generate 6-digit OTP
// function genOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

// // Simple email sender (console log for demo - replace with nodemailer in prod)
// async function sendOTPEmail(email, otp, type) {
//   // In production replace with actual nodemailer/sendgrid
//   console.log(`\n📧 OTP EMAIL to ${email}`);
//   console.log(`   Type: ${type}`);
//   console.log(`   OTP: ${otp}`);
//   console.log(`   (In production this would be sent via email)\n`);
//   return true;
// }

// // REGISTER - step 1: send OTP
// router.post("/register", async (req, res) => {
//   try {
//     const { name, studentId, email, phone, program, year, password } = req.body;
//     if (!name || !studentId || !email || !program || !password)
//       return res.status(400).json({ error: "All fields required" });
//     if (password.length < 6)
//       return res.status(400).json({ error: "Password must be at least 6 characters" });
//     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
//       return res.status(400).json({ error: "Invalid email address" });

//     const existing = await Student.findOne({ $or: [{ studentId }, { email }] });
//     if (existing) return res.status(400).json({ error: "Student ID or Email already exists" });

//     const otp = genOTP();
//     const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

//     // Delete any unverified previous attempt
//     await Student.deleteOne({ email, isVerified: false });

//     const student = new Student({ name, studentId, email, phone, program, year, password, otp, otpExpiry, isVerified: false });
//     await student.save();
//     await sendOTPEmail(email, otp, "Email Verification");

//     res.json({ success: true, message: "OTP sent to your email. Please verify.", requireOTP: true, email });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Registration failed" });
//   }
// });

// // VERIFY OTP (registration)
// router.post("/verify-otp", async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const student = await Student.findOne({ email, isVerified: false });
//     if (!student) return res.status(400).json({ error: "No pending verification for this email" });
//     if (student.otp !== otp) return res.status(400).json({ error: "Invalid OTP. Please try again." });
//     if (new Date() > student.otpExpiry) return res.status(400).json({ error: "OTP expired. Please register again." });

//     student.isVerified = true;
//     student.otp = null;
//     student.otpExpiry = null;
//     await student.save();

//     const token = jwt.sign({ studentId: student.studentId, id: student._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
//     res.json({ success: true, token, student: { name: student.name, studentId: student.studentId, email: student.email, program: student.program, year: student.year } });
//   } catch (err) {
//     res.status(500).json({ error: "Verification failed" });
//   }
// });

// // RESEND OTP
// router.post("/resend-otp", async (req, res) => {
//   try {
//     const { email } = req.body;
//     const student = await Student.findOne({ email, isVerified: false });
//     if (!student) return res.status(400).json({ error: "No pending verification found" });
//     const otp = genOTP();
//     student.otp = otp;
//     student.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
//     await student.save();
//     await sendOTPEmail(email, otp, "Email Verification");
//     res.json({ success: true, message: "OTP resent successfully" });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to resend OTP" });
//   }
// });

// // LOGIN
// router.post("/login", async (req, res) => {
//   try {
//     const { studentId, password } = req.body;
//     const student = await Student.findOne({ studentId });
//     if (!student) return res.status(400).json({ error: "Student ID not found" });
//     if (!student.isVerified) return res.status(400).json({ error: "Email not verified. Please complete registration." });
//     const match = await student.comparePassword(password);
//     if (!match) return res.status(400).json({ error: "Wrong password" });
//     const token = jwt.sign({ studentId: student.studentId, id: student._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
//     res.json({ success: true, token, student: { name: student.name, studentId: student.studentId, email: student.email, program: student.program, year: student.year } });
//   } catch (err) {
//     res.status(500).json({ error: "Login failed" });
//   }
// });

// // FORGOT PASSWORD - send OTP
// router.post("/forgot-password", async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: "Email required" });
//     const student = await Student.findOne({ email, isVerified: true });
//     if (!student) return res.status(400).json({ error: "No verified account found with this email" });
//     const otp = genOTP();
//     student.resetOtp = otp;
//     student.resetExpiry = new Date(Date.now() + 10 * 60 * 1000);
//     await student.save();
//     await sendOTPEmail(email, otp, "Password Reset");
//     res.json({ success: true, message: "Password reset OTP sent to your email" });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to send reset OTP" });
//   }
// });

// // RESET PASSWORD with OTP
// router.post("/reset-password", async (req, res) => {
//   try {
//     const { email, otp, newPassword } = req.body;
//     if (!email || !otp || !newPassword) return res.status(400).json({ error: "All fields required" });
//     if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
//     const student = await Student.findOne({ email, isVerified: true });
//     if (!student) return res.status(400).json({ error: "Account not found" });
//     if (student.resetOtp !== otp) return res.status(400).json({ error: "Invalid OTP" });
//     if (new Date() > student.resetExpiry) return res.status(400).json({ error: "OTP expired. Please request again." });
//     student.password = newPassword;
//     student.resetOtp = null;
//     student.resetExpiry = null;
//     await student.save();
//     res.json({ success: true, message: "Password reset successfully. You can now login." });
//   } catch (err) {
//     res.status(500).json({ error: "Password reset failed" });
//   }
// });

// // GET student dashboard
// router.get("/dashboard/:studentId", async (req, res) => {
//   try {
//     const sid = req.params.studentId;
//     const student = await Student.findOne({ studentId: sid }).select("-password");
//     const application = await Application.findOne({ studentId: sid, status: "Approved" });
//     const applications = await Application.find({ studentId: sid }).sort({ createdAt: -1 });
//     const { Complaint, Fee, Notice } = require("../models/Other");
//     const complaints = await Complaint.find({ studentId: sid }).sort({ createdAt: -1 });
//     const fees = await Fee.find({ studentId: sid }).sort({ createdAt: -1 });
//     const notices = await Notice.find().sort({ createdAt: -1 }).limit(5);
//     res.json({ student, application, applications, complaints, fees, notices });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to load dashboard" });
//   }
// });

// // GET all students (admin)
// router.get("/", async (req, res) => {
//   try {
//     const students = await Student.find().select("-password").sort({ createdAt: -1 });
//     res.json(students);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch students" });
//   }
// });

// // DELETE student
// router.delete("/:id", async (req, res) => {
//   try {
//     await Student.findByIdAndDelete(req.params.id);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to delete" });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Application = require("../models/Application");

// ── HELPERS ──────────────────────────────────────────────────────────────────
function genOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

// ── OTP EMAIL SENDER (Console Log Only - Works Anywhere!) ─────────────────────
// This version logs OTP to console - perfect for hackathon demo!
// Evaluators can see OTP in Railway logs during demo
async function sendOTPEmail(email, otp, type) {
  const isReset = type === "Password Reset";
  const subject = isReset ? "🔐 Password Reset OTP" : "✅ Verify Your Email";
  
  // Log OTP to console - evaluators can see this in Railway logs
  console.log(`\n📧 =========================================`);
  console.log(`📧 TO: ${email}`);
  console.log(`📧 TYPE: ${type}`);
  console.log(`📧 OTP: ${otp}`);
  console.log(`📧 =========================================\n`);
  
  // For demo purposes, we return true (email is "sent" to console)
  // This way evaluators can see the OTP during your demo
  return true;
}

// ── REGISTER — step 1: send OTP ──────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, studentId, email, phone, program, year, password } = req.body;
    if (!name || !studentId || !email || !program || !password)
      return res.status(400).json({ error: "All fields required" });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Invalid email address" });

    const existing = await Student.findOne({ $or: [{ studentId }, { email }] });
    if (existing && existing.isVerified)
      return res.status(400).json({ error: "Student ID or Email already registered" });

    const otp = genOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Remove any unverified leftover attempt
    await Student.deleteOne({ email, isVerified: false });

    const student = new Student({
      name, studentId, email, phone, program, year,
      password, otp, otpExpiry, isVerified: false,
    });
    await student.save();

    await sendOTPEmail(email, otp, "Email Verification");

    res.json({ success: true, message: "OTP sent to your email. Please verify.", requireOTP: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ── VERIFY OTP (registration) ─────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const student = await Student.findOne({ email, isVerified: false });
    if (!student) return res.status(400).json({ error: "No pending verification for this email" });
    if (student.otp !== otp) return res.status(400).json({ error: "Invalid OTP. Please try again." });
    if (new Date() > student.otpExpiry) return res.status(400).json({ error: "OTP expired. Please register again." });

    student.isVerified = true;
    student.otp = null;
    student.otpExpiry = null;
    await student.save();

    const token = jwt.sign(
      { studentId: student.studentId, id: student._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      success: true, token,
      student: { name: student.name, studentId: student.studentId, email: student.email, program: student.program, year: student.year },
    });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ── RESEND OTP ────────────────────────────────────────────────────────────────
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const student = await Student.findOne({ email, isVerified: false });
    if (!student) return res.status(400).json({ error: "No pending verification found" });

    const otp = genOTP();
    student.otp = otp;
    student.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await student.save();

    await sendOTPEmail(email, otp, "Email Verification");
    res.json({ success: true, message: "OTP resent successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to resend OTP" });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { studentId, password } = req.body;
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(400).json({ error: "Student ID not found" });
    if (!student.isVerified) return res.status(400).json({ error: "Email not verified. Please complete registration." });
    const match = await student.comparePassword(password);
    if (!match) return res.status(400).json({ error: "Wrong password" });
    const token = jwt.sign(
      { studentId: student.studentId, id: student._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      success: true, token,
      student: { name: student.name, studentId: student.studentId, email: student.email, program: student.program, year: student.year },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// ── FORGOT PASSWORD — send OTP ────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const student = await Student.findOne({ email, isVerified: true });
    if (!student) return res.status(400).json({ error: "No verified account found with this email" });

    const otp = genOTP();
    student.resetOtp = otp;
    student.resetExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await student.save();

    await sendOTPEmail(email, otp, "Password Reset");
    res.json({ success: true, message: "Password reset OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send reset OTP" });
  }
});

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: "All fields required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const student = await Student.findOne({ email, isVerified: true });
    if (!student) return res.status(400).json({ error: "Account not found" });
    if (student.resetOtp !== otp) return res.status(400).json({ error: "Invalid OTP" });
    if (new Date() > student.resetExpiry) return res.status(400).json({ error: "OTP expired. Please request again." });
    student.password = newPassword;
    student.resetOtp = null;
    student.resetExpiry = null;
    await student.save();
    res.json({ success: true, message: "Password reset successfully. You can now login." });
  } catch (err) {
    res.status(500).json({ error: "Password reset failed" });
  }
});

// ── STUDENT DASHBOARD ─────────────────────────────────────────────────────────
router.get("/dashboard/:studentId", async (req, res) => {
  try {
    const sid = req.params.studentId;
    const student = await Student.findOne({ studentId: sid }).select("-password");
    const application = await Application.findOne({ studentId: sid, status: "Approved" });
    const applications = await Application.find({ studentId: sid }).sort({ createdAt: -1 });
    const { Complaint, Fee, Notice } = require("../models/Other");
    const complaints = await Complaint.find({ studentId: sid }).sort({ createdAt: -1 });
    const fees = await Fee.find({ studentId: sid }).sort({ createdAt: -1 });
    const notices = await Notice.find().sort({ createdAt: -1 }).limit(5);
    res.json({ student, application, applications, complaints, fees, notices });
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ── GET ALL STUDENTS (admin) ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().select("-password").sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// ── DELETE STUDENT ────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

module.exports = router;