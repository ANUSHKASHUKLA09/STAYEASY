const mongoose = require("mongoose");
const roomSchema = new mongoose.Schema({
  number:      { type: String, required: true, unique: true },
  building:    { type: String, required: true },
  city:        { type: String, default: "" },
  floor:       { type: Number, required: true },
  type:        { type: String, enum: ["Single","Double","Triple","Suite"], default: "Single" },
  capacity:    { type: Number, required: true },
  price:       { type: Number, required: true },
  status:      { type: String, enum: ["Available","Occupied"], default: "Available" },
  amenities:   [{ type: String }],
  image:       { type: String, default: "" },
  description: { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose.models.Room || mongoose.model("Room", roomSchema);