const mongoose = require("mongoose");
const applicationSchema = new mongoose.Schema({
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },
  email:       { type: String, required: true },
  phone:       { type: String, default: "" },
  program:     { type: String, required: true },
  year:        { type: String, required: true },
  roomNumber:  { type: String, required: true },
  building:    { type: String, required: true },
  roomPrice:   { type: Number, required: true },
  duration:    { type: String, default: "Monthly" },
  checkin:     { type: String, required: true },
  message:     { type: String, default: "" },
  status:      { type: String, enum: ["Pending","Approved","Rejected"], default: "Pending" },
  adminNote:   { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose.model("Application", applicationSchema);
