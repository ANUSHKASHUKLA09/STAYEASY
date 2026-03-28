const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  id:         { type: String, required: true, unique: true },
  agent:      { type: String, required: true },
  action:     { type: String, required: true },
  studentId:  { type: String, default: "system" },
  roomId:     { type: String, default: null },
  decision:   { type: String, required: true },
  reasoning:  { type: String, required: true },
  violations: [{ type: String }],
  warnings:   [{ type: String }],
  compliant:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("AuditLog", auditLogSchema);