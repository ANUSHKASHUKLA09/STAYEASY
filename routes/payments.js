const express = require("express");
const router = express.Router();
const { Fee } = require("../models/Other");

// Simulated UPI payment (in production integrate Razorpay/PhonePe/Paytm)
// Generate payment order
router.post("/create-order", async (req, res) => {
  try {
    const { studentId, studentName, amount, month, room, mode } = req.body;
    if (!studentId || !amount || !month) return res.status(400).json({ error: "Missing required fields" });

    // Simulate order ID (in prod: Razorpay order ID)
    const orderId = "ORD_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const upiId   = "stayeasy@upi"; // Your UPI VPA
    const upiLink = `upi://pay?pa=${upiId}&pn=StayEasy&am=${amount}&cu=INR&tn=Hostel+Fee+${month}&tr=${orderId}`;

    res.json({ success: true, orderId, amount, upiId, upiLink, qrData: upiLink, mode });
  } catch (err) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Verify & record payment
router.post("/verify", async (req, res) => {
  try {
    const { studentId, studentName, room, amount, month, mode, orderId, utrNumber, notes } = req.body;
    if (!studentId || !amount || !month) return res.status(400).json({ error: "Missing fields" });

    // In production: verify UTR/transaction ID with payment gateway
    // For demo: accept if UTR provided or mode is cash
    const paymentNotes = mode === "UPI"
      ? `UPI Ref: ${utrNumber || "Pending verification"} | Order: ${orderId}`
      : notes || "";

    const fee = new Fee({
      studentId, studentName, room: room || "—",
      amount: +amount, month, mode,
      notes: paymentNotes, status: "Paid"
    });
    await fee.save();
    res.json({ success: true, fee, message: "Payment recorded successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Payment verification failed" });
  }
});

module.exports = router;
