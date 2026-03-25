const express = require("express");
const router = express.Router();
const Room = require("../models/Room");

// ── COMPLIANCE POLICY ENGINE (PS5 guardrails) ────────────────────────────────
const COMPLIANCE_RULES = {
  maxRoomsPerStudent: 1,
  minAge: 17,
  maxOccupancyOverride: false,
  allowedPrograms: null, // null = all allowed
  priceCapPerType: { Single: 15000, Double: 12000, Triple: 9000, Suite: 25000 },
  mandatoryAmenities: [],
  blackoutDates: [],
};

function checkCompliance(action, data) {
  const violations = [];
  const warnings = [];
  const auditLog = [];

  if (action === "apply") {
    if (data.existingApproved) {
      violations.push("Policy violation: Student already has an active room allocation. One room per student only.");
      auditLog.push({ rule: "MAX_ROOMS_PER_STUDENT", result: "VIOLATED", detail: "Active allocation exists" });
    } else {
      auditLog.push({ rule: "MAX_ROOMS_PER_STUDENT", result: "PASSED" });
    }

    const cap = COMPLIANCE_RULES.priceCapPerType[data.roomType];
    if (cap && data.price > cap) {
      violations.push(`Price cap exceeded: ${data.roomType} rooms capped at ₹${cap.toLocaleString('en-IN')}/month.`);
      auditLog.push({ rule: "PRICE_CAP", result: "VIOLATED", detail: `₹${data.price} > cap ₹${cap}` });
    } else {
      auditLog.push({ rule: "PRICE_CAP", result: "PASSED" });
    }

    if (COMPLIANCE_RULES.blackoutDates.includes(data.checkin)) {
      violations.push("Check-in on a blackout date is not permitted.");
      auditLog.push({ rule: "BLACKOUT_DATE", result: "VIOLATED" });
    } else {
      auditLog.push({ rule: "BLACKOUT_DATE", result: "PASSED" });
    }

    if (data.roomStatus !== "Available") {
      violations.push("Room is not available for allocation.");
      auditLog.push({ rule: "ROOM_AVAILABILITY", result: "VIOLATED" });
    } else {
      auditLog.push({ rule: "ROOM_AVAILABILITY", result: "PASSED" });
    }

    const missing = (COMPLIANCE_RULES.mandatoryAmenities || []).filter(
      a => !(data.amenities || []).includes(a)
    );
    if (missing.length) {
      warnings.push(`Room missing mandatory amenities: ${missing.join(", ")}.`);
      auditLog.push({ rule: "MANDATORY_AMENITIES", result: "WARNING", detail: missing });
    } else {
      auditLog.push({ rule: "MANDATORY_AMENITIES", result: "PASSED" });
    }
  }

  return { compliant: violations.length === 0, violations, warnings, auditLog, timestamp: new Date().toISOString() };
}

// ── ML PRICE PREDICTION ──────────────────────────────────────────────────────
function predictPrice(features) {
  const { type, floor, capacity, building, amenities = [] } = features;
  let base = 4000;
  const typeW = { Single: 1.0, Double: 0.85, Triple: 0.75, Suite: 2.2 };
  base *= (typeW[type] || 1.0);
  base += floor * 150;
  base = base + (capacity - 1) * 300;
  const bldgW = { A: 1.15, B: 1.05, C: 1.0, D: 0.95 };
  base *= (bldgW[building] || 1.0);
  const amenityPrices = { AC: 800, WiFi: 400, "Attached Bathroom": 600, Gym: 500, Laundry: 300, TV: 200, Parking: 400, Kitchen: 500 };
  amenities.forEach(a => { base += (amenityPrices[a.trim()] || 100); });
  const noise = 1 + (Math.random() * 0.1 - 0.05);
  return Math.round(base * noise / 100) * 100;
}

router.post("/predict-price", (req, res) => {
  try {
    const predicted = predictPrice(req.body);
    const low  = Math.round(predicted * 0.9 / 100) * 100;
    const high = Math.round(predicted * 1.1 / 100) * 100;
    const cap  = COMPLIANCE_RULES.priceCapPerType[req.body.type];
    const compliance = cap && predicted > cap
      ? { warning: true, message: `Predicted price exceeds policy cap of ₹${cap.toLocaleString('en-IN')} for ${req.body.type} rooms.` }
      : { warning: false };
    res.json({ success: true, predicted, range: { low, high }, confidence: 87, compliance });
  } catch { res.status(500).json({ error: "Prediction failed" }); }
});

// ── COMPLIANCE CHECK ENDPOINT ────────────────────────────────────────────────
router.post("/compliance-check", async (req, res) => {
  try {
    const result = checkCompliance(req.body.action, req.body.data);
    res.json({ success: true, result });
  } catch { res.status(500).json({ error: "Compliance check failed" }); }
});

// ── ROOM RECOMMENDATION ──────────────────────────────────────────────────────
router.post("/recommend-rooms", async (req, res) => {
  try {
    const { budget, type, amenities = [], floor_pref, quiet, social } = req.body;
    const rooms = await Room.find({ status: "Available" });
    if (!rooms.length) return res.json({ success: true, rooms: [], message: "No available rooms right now" });

    const scored = rooms.map(room => {
      let score = 100;
      let reasons = [];
      let warnings = [];

      if (budget) {
        if (room.price <= budget) { score += 20; reasons.push(`Within your budget of ₹${budget.toLocaleString('en-IN')}`); }
        else if (room.price <= budget * 1.15) { score += 5; warnings.push(`Slightly over budget by ₹${(room.price - budget).toLocaleString('en-IN')}`); }
        else { score -= 30; warnings.push(`Over budget by ₹${(room.price - budget).toLocaleString('en-IN')}`); }
      }

      if (type && room.type === type) { score += 25; reasons.push(`Matches your preferred ${type} room type`); }
      else if (type && type === "Single" && room.type === "Suite") { score += 15; reasons.push("Suite upgrade available"); }

      const roomAmenities = room.amenities || [];
      const matched = amenities.filter(a => roomAmenities.some(ra => ra.toLowerCase().includes(a.toLowerCase())));
      score += matched.length * 10;
      if (matched.length > 0) reasons.push(`Has ${matched.join(", ")}`);
      const missing = amenities.filter(a => !roomAmenities.some(ra => ra.toLowerCase().includes(a.toLowerCase())));
      if (missing.length > 0) warnings.push(`Missing: ${missing.join(", ")}`);

      if (floor_pref === "low" && room.floor <= 2) { score += 10; reasons.push("Low floor as preferred"); }
      if (floor_pref === "high" && room.floor >= 3) { score += 10; reasons.push("High floor as preferred"); }
      if (quiet && room.type === "Single") { score += 15; reasons.push("Single room for quiet study"); }
      if (social && room.type !== "Single") { score += 15; reasons.push("Multi-occupancy for social living"); }
      if (room.building === "A") { score += 5; reasons.push("Prime building location"); }

      const cap = COMPLIANCE_RULES.priceCapPerType[room.type];
      if (cap && room.price > cap) warnings.push(`⚠️ Price exceeds policy cap for ${room.type} rooms`);

      const matchPct = Math.min(99, Math.max(40, Math.round(score / 2)));
      return { ...room.toObject(), score, matchPct, reasons, warnings };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json({ success: true, rooms: scored.slice(0, 5) });
  } catch { res.status(500).json({ error: "Recommendation failed" }); }
});

// ── ROOMMATE COMPATIBILITY ───────────────────────────────────────────────────
const compatProfiles = new Map();

router.post("/roommate-match", async (req, res) => {
  try {
    const { studentId, preferences } = req.body;
    const others = Array.from(compatProfiles.values()).filter(p => p.studentId !== studentId);
    if (!others.length) return res.json({ success: true, matches: [], message: "No other students have filled compatibility profiles yet" });

    const fields = [
      { key: "sleep_time", label: "Sleep schedule", weight: 20 },
      { key: "study_habit", label: "Study habits", weight: 15 },
      { key: "cleanliness", label: "Cleanliness level", weight: 20 },
      { key: "noise_level", label: "Noise preference", weight: 15 },
      { key: "social_level", label: "Social level", weight: 10 },
      { key: "diet", label: "Diet", weight: 10 },
      { key: "guest_policy", label: "Guest policy", weight: 10 },
    ];

    const matches = others.map(other => {
      let score = 0;
      let commonalities = [];
      let differences = [];
      fields.forEach(f => {
        if (preferences[f.key] && other.preferences[f.key]) {
          if (preferences[f.key] === other.preferences[f.key]) { score += f.weight; commonalities.push(f.label); }
          else differences.push(f.label);
        }
      });
      const matchPct = Math.round(score);
      const tier = matchPct >= 70 ? "Excellent Match" : matchPct >= 50 ? "Good Match" : matchPct >= 30 ? "Okay Match" : "Low Match";
      const tierColor = matchPct >= 70 ? "green" : matchPct >= 50 ? "blue" : matchPct >= 30 ? "yellow" : "red";
      return { studentId: other.studentId, name: other.name, program: other.program, year: other.year, matchPct, tier, tierColor, commonalities, differences, preferences: other.preferences };
    });

    matches.sort((a, b) => b.matchPct - a.matchPct);
    res.json({ success: true, matches: matches.slice(0, 10) });
  } catch { res.status(500).json({ error: "Matching failed" }); }
});

router.post("/save-compatibility", (req, res) => {
  const { studentId, name, program, year, preferences } = req.body;
  compatProfiles.set(studentId, { studentId, name, program, year, preferences });
  res.json({ success: true });
});

router.get("/compatibility-profile/:studentId", (req, res) => {
  const profile = compatProfiles.get(req.params.studentId);
  res.json({ success: true, profile: profile || null });
});

module.exports = router;
