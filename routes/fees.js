const express = require("express");
const router = express.Router();
const { Fee } = require("../models/Other");
router.get("/", async (req, res) => { try { res.json(await Fee.find().sort({ createdAt: -1 })); } catch { res.status(500).json({ error: "Failed" }); } });
router.post("/", async (req, res) => { try { res.json({ success: true, fee: await new Fee(req.body).save() }); } catch { res.status(500).json({ error: "Failed" }); } });
router.delete("/:id", async (req, res) => { try { await Fee.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch { res.status(500).json({ error: "Failed" }); } });
module.exports = router;
