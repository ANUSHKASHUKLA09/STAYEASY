const express = require("express");
const router = express.Router();
const Room = require("../models/Room");

router.get("/", async (req, res) => {
  try { res.json(await Room.find().sort({ number: 1 })); }
  catch (err) { res.status(500).json({ error: "Failed to fetch rooms" }); }
});

router.post("/", async (req, res) => {
  try {
    if (await Room.findOne({ number: req.body.number }))
      return res.status(400).json({ error: "Room number already exists" });
    const room = await new Room(req.body).save();
    res.json({ success: true, room });
  } catch (err) { res.status(500).json({ error: "Failed to add room" }); }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, room });
  } catch (err) { res.status(500).json({ error: "Failed to update" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (room.status === "Occupied") return res.status(400).json({ error: "Cannot delete occupied room" });
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

module.exports = router;
