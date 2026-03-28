// const mongoose = require("mongoose");
// const applicationSchema = new mongoose.Schema({
//   studentId:   { type: String, required: true },
//   studentName: { type: String, required: true },
//   email:       { type: String, required: true },
//   phone:       { type: String, default: "" },
//   program:     { type: String, required: true },
//   year:        { type: String, required: true },
//   roomNumber:  { type: String, required: true },
//   building:    { type: String, required: true },
//   roomPrice:   { type: Number, required: true },
//   duration:    { type: String, default: "Monthly" },
//   checkin:     { type: String, required: true },
//   message:     { type: String, default: "" },
//   status:      { type: String, enum: ["Pending","Approved","Rejected"], default: "Pending" },
//   adminNote:   { type: String, default: "" },
// }, { timestamps: true });
// module.exports = mongoose.model("Application", applicationSchema);



const mongoose = require("mongoose");
const applicationSchema = new mongoose.Schema({
  studentId:   { type: String, required: true },
  studentName: { type: String, required: true },
  email:       { type: String, required: true },
  phone:       { type: String, default: "" },
  program:     { type: String, required: true },
  year:        { type: String, required: true },

  // Student preferences at apply time (no specific room locked in)
  preferredType:     { type: String, default: "" },
  preferredBuilding: { type: String, default: "" },
  preferredFloor:    { type: String, default: "" },

  // Assigned by admin on approval
  roomNumber:  { type: String, default: "" },
  building:    { type: String, default: "" },
  roomPrice:   { type: Number, default: 0 },

  duration:    { type: String, default: "Monthly" },
  checkin:     { type: String, required: true },
  message:     { type: String, default: "" },
  status:      { type: String, enum: ["Pending","Approved","Rejected"], default: "Pending" },
  adminNote:   { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose.model("Application", applicationSchema);