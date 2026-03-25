const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },
  room:        { type: String, default: "N/A" },
  subject:     { type: String, required: true },
  description: { type: String, required: true },
  priority:    { type: String, enum: ["Low","Medium","High"], default: "Low" },
  status:      { type: String, enum: ["Pending","In Progress","Resolved"], default: "Pending" },
}, { timestamps: true });

const feeSchema = new mongoose.Schema({
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },
  room:        { type: String, default: "—" },
  amount:      { type: Number, required: true },
  month:       { type: String, required: true },
  mode:        { type: String, default: "Cash" },
  notes:       { type: String, default: "" },
  status:      { type: String, default: "Paid" },
}, { timestamps: true });

const noticeSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  category: { type: String, enum: ["General","Maintenance","Event","Fee","Urgent"], default: "General" },
  content:  { type: String, required: true },
}, { timestamps: true });

module.exports.Complaint = mongoose.model("Complaint", complaintSchema);
module.exports.Fee       = mongoose.model("Fee", feeSchema);
module.exports.Notice    = mongoose.model("Notice", noticeSchema);
