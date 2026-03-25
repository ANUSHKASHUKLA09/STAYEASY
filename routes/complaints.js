// complaints.js
const express = require("express");
const r1 = express.Router();
const { Complaint } = require("../models/Other");
r1.get("/", async (req, res) => { try { res.json(await Complaint.find().sort({ createdAt: -1 })); } catch { res.status(500).json({ error: "Failed" }); } });
r1.post("/", async (req, res) => { try { res.json({ success: true, complaint: await new Complaint(req.body).save() }); } catch { res.status(500).json({ error: "Failed" }); } });
r1.patch("/:id/status", async (req, res) => { try { res.json({ success: true, complaint: await Complaint.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }) }); } catch { res.status(500).json({ error: "Failed" }); } });
r1.delete("/:id", async (req, res) => { try { await Complaint.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch { res.status(500).json({ error: "Failed" }); } });
module.exports = r1;
