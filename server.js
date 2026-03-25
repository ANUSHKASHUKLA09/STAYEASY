require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/rooms",        require("./routes/rooms"));
app.use("/api/students",     require("./routes/students"));
app.use("/api/applications", require("./routes/applications"));
app.use("/api/complaints",   require("./routes/complaints"));
app.use("/api/fees",         require("./routes/fees"));
app.use("/api/notices",      require("./routes/notices"));
app.use("/api/admin",        require("./routes/admin"));
app.use("/api/ai",           require("./routes/ai"));
app.use("/api/agents",       require("./routes/agents"));
app.use("/api/payments",     require("./routes/payments"));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(process.env.PORT || 3000, () =>
      console.log(`🚀 Server at http://localhost:${process.env.PORT || 3000}`)
    );
  })
  .catch(err => { console.error("❌ MongoDB failed:", err.message); process.exit(1); });
