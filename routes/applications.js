// const express = require("express");
// const router = express.Router();
// const Application = require("../models/Application");
// const Room = require("../models/Room");

// // GET all (admin)
// router.get("/", async (req, res) => {
//   try { res.json(await Application.find().sort({ createdAt: -1 })); }
//   catch (err) { res.status(500).json({ error: "Failed to fetch" }); }
// });

// // APPLY for a room (student)
// router.post("/", async (req, res) => {
//   try {
//     const existing = await Application.findOne({ studentId: req.body.studentId, status: { $in: ["Pending","Approved"] } });
//     if (existing) return res.status(400).json({ error: "You already have an active application" });
//     const room = await Room.findOne({ number: req.body.roomNumber });
//     if (!room || room.status === "Occupied") return res.status(400).json({ error: "Room not available" });
//     const app = await new Application(req.body).save();
//     res.json({ success: true, application: app });
//   } catch (err) { res.status(500).json({ error: "Failed to apply" }); }
// });

// // APPROVE / REJECT (admin)
// router.patch("/:id", async (req, res) => {
//   try {
//     const { status, adminNote } = req.body;
//     const application = await Application.findByIdAndUpdate(req.params.id, { status, adminNote }, { new: true });
//     if (status === "Approved") {
//       await Room.findOneAndUpdate({ number: application.roomNumber }, { status: "Occupied" });
//     }
//     if (status === "Rejected") {
//       // check if another approved app holds the room
//       const otherApproved = await Application.findOne({ roomNumber: application.roomNumber, status: "Approved", _id: { $ne: application._id } });
//       if (!otherApproved) await Room.findOneAndUpdate({ number: application.roomNumber }, { status: "Available" });
//     }
//     res.json({ success: true, application });
//   } catch (err) { res.status(500).json({ error: "Failed to update" }); }
// });

// // DELETE (admin)
// router.delete("/:id", async (req, res) => {
//   try {
//     await Application.findByIdAndDelete(req.params.id);
//     res.json({ success: true });
//   } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
// });

// module.exports = router;





const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Room = require("../models/Room");

// GET all (admin)
router.get("/", async (req, res) => {
  try { res.json(await Application.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: "Failed to fetch" }); }
});

// APPLY for accommodation (student) — no specific room, just preferences
router.post("/", async (req, res) => {
  try {
    const existing = await Application.findOne({
      studentId: req.body.studentId,
      status: { $in: ["Pending", "Approved"] }
    });
    if (existing)
      return res.status(400).json({ error: "You already have an active application" });

    const app = await new Application(req.body).save();
    res.json({ success: true, application: app });
  } catch (err) { res.status(500).json({ error: "Failed to apply" }); }
});

// APPROVE with room assignment / REJECT (admin)
// Body: { status, adminNote, roomId? }   roomId required when status==="Approved"
router.patch("/:id", async (req, res) => {
  try {
    const { status, adminNote, roomId } = req.body;

    if (status === "Approved") {
      if (!roomId)
        return res.status(400).json({ error: "Please select a room to assign before approving" });

      const room = await Room.findById(roomId);
      if (!room)
        return res.status(404).json({ error: "Selected room not found" });
      if (room.status === "Occupied")
        return res.status(400).json({ error: "That room is already occupied — please pick another" });

      // Update application with the assigned room details
      const application = await Application.findByIdAndUpdate(
        req.params.id,
        { status, adminNote, roomNumber: room.number, building: room.building, roomPrice: room.price },
        { new: true }
      );

      // Mark room occupied
      await Room.findByIdAndUpdate(roomId, { status: "Occupied" });

      return res.json({ success: true, application });
    }

    if (status === "Rejected") {
      const application = await Application.findByIdAndUpdate(
        req.params.id,
        { status, adminNote },
        { new: true }
      );
      // Free the room only if one was previously assigned (e.g. re-reject after approve)
      if (application.roomNumber) {
        const otherApproved = await Application.findOne({
          roomNumber: application.roomNumber,
          status: "Approved",
          _id: { $ne: application._id }
        });
        if (!otherApproved)
          await Room.findOneAndUpdate({ number: application.roomNumber }, { status: "Available" });
      }
      return res.json({ success: true, application });
    }

    // Generic status update (shouldn't normally be needed)
    const application = await Application.findByIdAndUpdate(
      req.params.id, { status, adminNote }, { new: true }
    );
    res.json({ success: true, application });

  } catch (err) { res.status(500).json({ error: "Failed to update" }); }
});

// DELETE (admin)
router.delete("/:id", async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (app && app.roomNumber && app.status === "Approved") {
      // Free the room if we're deleting an approved application
      await Room.findOneAndUpdate({ number: app.roomNumber }, { status: "Available" });
    }
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

module.exports = router;