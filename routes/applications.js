const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Room = require("../models/Room");

// GET all (admin)
router.get("/", async (req, res) => {
  try { res.json(await Application.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: "Failed to fetch" }); }
});

// APPLY for a room (student)
router.post("/", async (req, res) => {
  try {
    const existing = await Application.findOne({ studentId: req.body.studentId, status: { $in: ["Pending","Approved"] } });
    if (existing) return res.status(400).json({ error: "You already have an active application" });
    const room = await Room.findOne({ number: req.body.roomNumber });
    if (!room || room.status === "Occupied") return res.status(400).json({ error: "Room not available" });
    const app = await new Application(req.body).save();
    res.json({ success: true, application: app });
  } catch (err) { res.status(500).json({ error: "Failed to apply" }); }
});

// APPROVE / REJECT (admin)
router.patch("/:id", async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const application = await Application.findByIdAndUpdate(req.params.id, { status, adminNote }, { new: true });
    if (status === "Approved") {
      await Room.findOneAndUpdate({ number: application.roomNumber }, { status: "Occupied" });
    }
    if (status === "Rejected") {
      // check if another approved app holds the room
      const otherApproved = await Application.findOne({ roomNumber: application.roomNumber, status: "Approved", _id: { $ne: application._id } });
      if (!otherApproved) await Room.findOneAndUpdate({ number: application.roomNumber }, { status: "Available" });
    }
    res.json({ success: true, application });
  } catch (err) { res.status(500).json({ error: "Failed to update" }); }
});

// DELETE (admin)
router.delete("/:id", async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

module.exports = router;
