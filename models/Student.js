const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const studentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  studentId:   { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true },
  phone:       { type: String, default: "" },
  program:     { type: String, required: true },
  year:        { type: String, default: "1st Year" },
  password:    { type: String, required: true },
  isVerified:  { type: Boolean, default: false },
  otp:         { type: String, default: null },
  otpExpiry:   { type: Date, default: null },
  resetOtp:    { type: String, default: null },
  resetExpiry: { type: Date, default: null },
}, { timestamps: true });

studentSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

studentSchema.methods.comparePassword = function(pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model("Student", studentSchema);
