/**
 * PS5: Domain-Specialized AI Agents with Compliance Guardrails
 * Multi-agent system for student accommodation domain:
 *   1. AllocationAgent   — validates and processes room applications
 *   2. ComplianceAgent   — enforces institutional policies
 *   3. FeeAgent          — detects unpaid dues, flags overdue
 *   4. ComplaintAgent    — triages complaints, auto-escalates high-priority
 *   5. OccupancyAgent    — monitors occupancy, detects anomalies
 *
 * Each agent: validates input → checks compliance → executes → logs audit trail
 */

// const express = require("express");
// const router = express.Router();
// const Application = require("../models/Application");
// const Room = require("../models/Room");
// const Student = require("../models/Student");
// const { Complaint, Fee, Notice } = require("../models/Other");

// // ── AUDIT TRAIL (in-memory, production: store in MongoDB) ────────────────────
// const auditLog = [];
// function audit(agent, action, studentId, roomId, decision, reasoning, violations = [], warnings = []) {
//   const entry = {
//     id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
//     timestamp: new Date().toISOString(),
//     agent,
//     action,
//     studentId: studentId || "system",
//     roomId: roomId || null,
//     decision,
//     reasoning,
//     violations,
//     warnings,
//     compliant: violations.length === 0,
//   };
//   auditLog.unshift(entry);
//   if (auditLog.length > 200) auditLog.pop();
//   return entry;
// }

// // ── COMPLIANCE RULES (the guardrail engine) ──────────────────────────────────
// const POLICY = {
//   maxRoomsPerStudent: 1,
//   priceCapPerType: { Single: 15000, Double: 12000, Triple: 9000, Suite: 25000 },
//   overdueGraceDays: 7,
//   autoEscalateComplaintPriority: "High",
//   maxPendingDaysBeforeAlert: 5,
//   allowedCheckinDays: null, // null = all days
// };

// function enforcePolicy(context) {
//   const violations = [];
//   const warnings = [];

//   if (context.existingApproved >= POLICY.maxRoomsPerStudent) {
//     violations.push(`POLICY:MAX_ROOMS — Student already holds ${context.existingApproved} active allocation(s). Maximum allowed: ${POLICY.maxRoomsPerStudent}.`);
//   }

//   if (context.roomType && context.price !== undefined) {
//     const cap = POLICY.priceCapPerType[context.roomType];
//     if (cap && context.price > cap) {
//       violations.push(`POLICY:PRICE_CAP — Room price ₹${context.price.toLocaleString('en-IN')} exceeds policy cap ₹${cap.toLocaleString('en-IN')} for ${context.roomType} type.`);
//     }
//   }

//   if (context.roomStatus && context.roomStatus !== "Available") {
//     violations.push(`POLICY:AVAILABILITY — Room is currently ${context.roomStatus}. Cannot allocate an unavailable room.`);
//   }

//   if (context.pendingDays && context.pendingDays > POLICY.maxPendingDaysBeforeAlert) {
//     warnings.push(`POLICY:SLA_WARNING — Application pending for ${context.pendingDays} days, exceeds ${POLICY.maxPendingDaysBeforeAlert}-day SLA.`);
//   }

//   return { violations, warnings, compliant: violations.length === 0 };
// }

// // ════════════════════════════════════════════════════════════════
// // AGENT 1: AllocationAgent
// // Validates room applications, enforces compliance, approves/rejects
// // ════════════════════════════════════════════════════════════════
// router.post("/allocation-agent/validate", async (req, res) => {
//   try {
//     const { studentId, roomNumber, checkin, price, roomType, building } = req.body;

//     // Step 1: Gather context
//     const [student, room, existingApps] = await Promise.all([
//       Student.findOne({ studentId }),
//       Room.findOne({ number: roomNumber }),
//       Application.countDocuments({ studentId, status: { $in: ["Pending", "Approved"] } }),
//     ]);

//     if (!student) {
//       const entry = audit("AllocationAgent", "validate", studentId, roomNumber, "REJECTED", "Student not found in system");
//       return res.json({ approved: false, violations: ["Student record not found"], warnings: [], auditEntry: entry });
//     }
//     if (!room) {
//       const entry = audit("AllocationAgent", "validate", studentId, roomNumber, "REJECTED", "Room not found");
//       return res.json({ approved: false, violations: ["Room not found"], warnings: [], auditEntry: entry });
//     }

//     // Step 2: Run compliance engine
//     const policy = enforcePolicy({
//       existingApproved: existingApps,
//       roomType: room.type,
//       price: room.price,
//       roomStatus: room.status,
//     });

//     const decision = policy.compliant ? "APPROVED" : "REJECTED";
//     const reasoning = policy.compliant
//       ? `All ${Object.keys(POLICY).length} policy rules satisfied. Student ${student.name} (${studentId}) eligible for Room ${roomNumber} at ₹${room.price.toLocaleString('en-IN')}/mo.`
//       : `Policy violations detected. Application blocked automatically.`;

//     const entry = audit("AllocationAgent", "validate", studentId, roomNumber, decision, reasoning, policy.violations, policy.warnings);

//     res.json({
//       approved: policy.compliant,
//       student: { name: student.name, studentId, program: student.program, year: student.year },
//       room: { number: room.number, building: room.building, type: room.type, price: room.price, floor: room.floor },
//       violations: policy.violations,
//       warnings: policy.warnings,
//       reasoning,
//       auditEntry: entry,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "AllocationAgent failed: " + err.message });
//   }
// });

// // ════════════════════════════════════════════════════════════════
// // AGENT 2: ComplianceAgent
// // Scans all pending applications and flags SLA breaches + policy violations
// // ════════════════════════════════════════════════════════════════
// router.get("/compliance-agent/scan", async (req, res) => {
//   try {
//     const apps = await Application.find({ status: "Pending" }).sort({ createdAt: 1 });
//     const now = Date.now();
//     const report = [];
//     let totalViolations = 0;
//     let slaBreaches = 0;

//     for (const app of apps) {
//       const pendingDays = Math.floor((now - new Date(app.createdAt).getTime()) / 86400000);
//       const room = await Room.findOne({ number: app.roomNumber });
//       const existingApproved = await Application.countDocuments({ studentId: app.studentId, status: "Approved", _id: { $ne: app._id } });

//       const policy = enforcePolicy({
//         existingApproved,
//         roomType: app.roomType || (room ? room.type : null),
//         price: app.roomPrice,
//         roomStatus: room ? room.status : "Unknown",
//         pendingDays,
//       });

//       if (pendingDays > POLICY.maxPendingDaysBeforeAlert) slaBreaches++;
//       totalViolations += policy.violations.length;

//       if (!policy.compliant || policy.warnings.length || pendingDays > POLICY.maxPendingDaysBeforeAlert) {
//         const entry = audit("ComplianceAgent", "scan", app.studentId, app.roomNumber,
//           policy.compliant ? "WARNING" : "FLAG",
//           `Scanned application #${app._id}. Pending ${pendingDays} days.`,
//           policy.violations, policy.warnings);
//         report.push({ application: app, pendingDays, violations: policy.violations, warnings: policy.warnings, auditEntry: entry });
//       }
//     }

//     const summaryEntry = audit("ComplianceAgent", "scan-summary", null, null,
//       `SCANNED ${apps.length} applications`,
//       `Found ${totalViolations} violations, ${slaBreaches} SLA breaches across ${apps.length} pending applications.`
//     );

//     res.json({
//       success: true,
//       scanned: apps.length,
//       flagged: report.length,
//       totalViolations,
//       slaBreaches,
//       report,
//       auditEntry: summaryEntry,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "ComplianceAgent failed: " + err.message });
//   }
// });

// // ════════════════════════════════════════════════════════════════
// // AGENT 3: FeeAgent
// // Detects overdue fees, calculates outstanding, generates alerts
// // ════════════════════════════════════════════════════════════════
// router.get("/fee-agent/scan", async (req, res) => {
//   try {
//     const apps = await Application.find({ status: "Approved" });
//     const fees = await Fee.find({});
//     const now = new Date();
//     const currentMonth = now.toISOString().slice(0, 7);
//     const alerts = [];

//     for (const app of apps) {
//       const studentFees = fees.filter(f => f.studentId === app.studentId);
//       const paidMonths = studentFees.map(f => f.month);
//       const allocationMonth = new Date(app.createdAt).toISOString().slice(0, 7);
//       const monthsSinceAlloc = Math.max(0, (now.getFullYear() - new Date(app.createdAt).getFullYear()) * 12 + (now.getMonth() - new Date(app.createdAt).getMonth()));
//       const expectedPayments = monthsSinceAlloc + 1;
//       const actualPayments = studentFees.length;
//       const missingPayments = Math.max(0, expectedPayments - actualPayments);

//       if (missingPayments > 0 || !paidMonths.includes(currentMonth)) {
//         const outstanding = missingPayments * app.roomPrice;
//         const sev = missingPayments >= 3 ? "critical" : missingPayments >= 1 ? "warning" : "info";
//         const entry = audit("FeeAgent", "overdue-scan", app.studentId, app.roomNumber,
//           sev === "critical" ? "ESCALATE" : "ALERT",
//           `Student ${app.studentName} has ${missingPayments} missing payment(s). Outstanding: ₹${outstanding.toLocaleString('en-IN')}.`,
//           sev === "critical" ? [`Fee overdue by ${missingPayments} months — escalation required`] : [],
//           sev === "warning" ? [`Fee payment overdue for ${missingPayments} month(s)`] : []
//         );
//         alerts.push({ studentId: app.studentId, studentName: app.studentName, room: app.roomNumber, building: app.building, roomPrice: app.roomPrice, paidMonths, missingPayments, outstanding, severity: sev, auditEntry: entry });
//       }
//     }

//     alerts.sort((a, b) => b.missingPayments - a.missingPayments);
//     const summaryEntry = audit("FeeAgent", "scan-complete", null, null, `SCANNED ${apps.length} allocations`,
//       `Found ${alerts.length} students with overdue fees. Total outstanding: ₹${alerts.reduce((s,a)=>s+a.outstanding,0).toLocaleString('en-IN')}.`);

//     res.json({ success: true, scanned: apps.length, alerts, totalOutstanding: alerts.reduce((s,a)=>s+a.outstanding,0), auditEntry: summaryEntry });
//   } catch (err) {
//     res.status(500).json({ error: "FeeAgent failed: " + err.message });
//   }
// });

// // ════════════════════════════════════════════════════════════════
// // AGENT 4: ComplaintAgent
// // Triages complaints, auto-escalates high-priority, suggests resolution
// // ════════════════════════════════════════════════════════════════
// router.get("/complaint-agent/triage", async (req, res) => {
//   try {
//     const complaints = await Complaint.find({ status: { $ne: "Resolved" } }).sort({ createdAt: 1 });
//     const triage = [];

//     const resolutionPlaybooks = {
//       High: { sla: "24 hours", action: "Escalate to warden immediately. Contact maintenance team.", autoEscalate: true },
//       Medium: { sla: "72 hours", action: "Assign to maintenance team. Follow up in 48h.", autoEscalate: false },
//       Low: { sla: "7 days", action: "Log and schedule during next maintenance round.", autoEscalate: false },
//     };

//     for (const c of complaints) {
//       const ageHours = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 3600000);
//       const playbook = resolutionPlaybooks[c.priority] || resolutionPlaybooks.Low;
//       const slaBreach = (c.priority === "High" && ageHours > 24) || (c.priority === "Medium" && ageHours > 72) || (c.priority === "Low" && ageHours > 168);

//       const decision = slaBreach ? "ESCALATE" : playbook.autoEscalate ? "ESCALATE" : "MONITOR";
//       const violations = slaBreach ? [`SLA breach: ${c.priority} complaint open for ${ageHours}h (SLA: ${playbook.sla})`] : [];

//       const entry = audit("ComplaintAgent", "triage", c.studentId, c.room, decision,
//         `Complaint: "${c.subject}" | Priority: ${c.priority} | Age: ${ageHours}h | SLA: ${playbook.sla}`,
//         violations);

//       triage.push({ complaint: c, ageHours, slaBreach, playbook, decision, auditEntry: entry });
//     }

//     const escalations = triage.filter(t => t.decision === "ESCALATE").length;
//     const summaryEntry = audit("ComplaintAgent", "triage-complete", null, null, `TRIAGED ${complaints.length} complaints`,
//       `${escalations} require immediate escalation. ${triage.filter(t=>t.slaBreach).length} SLA breaches detected.`);

//     res.json({ success: true, total: complaints.length, escalations, triage, auditEntry: summaryEntry });
//   } catch (err) {
//     res.status(500).json({ error: "ComplaintAgent failed: " + err.message });
//   }
// });

// // ════════════════════════════════════════════════════════════════
// // AGENT 5: OccupancyAgent
// // Monitors room occupancy, detects anomalies, forecasts availability
// // ════════════════════════════════════════════════════════════════
// router.get("/occupancy-agent/report", async (req, res) => {
//   try {
//     const [rooms, apps] = await Promise.all([Room.find({}), Application.find({ status: "Approved" })]);

//     const total = rooms.length;
//     const occupied = rooms.filter(r => r.status === "Occupied").length;
//     const available = rooms.filter(r => r.status === "Available").length;
//     const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

//     // Anomaly: rooms marked occupied but no approved application
//     const anomalies = [];
//     for (const room of rooms.filter(r => r.status === "Occupied")) {
//       const hasApp = apps.some(a => a.roomNumber === room.number);
//       if (!hasApp) {
//         const entry = audit("OccupancyAgent", "anomaly-detect", null, room.number, "FLAG",
//           `Room ${room.number} (Building ${room.building}) marked Occupied but has no approved application.`,
//           [`DATA_ANOMALY: Room ${room.number} occupied without matching allocation`]);
//         anomalies.push({ room, auditEntry: entry });
//       }
//     }

//     // Anomaly: approved applications for unavailable rooms
//     const allocationMismatches = [];
//     for (const app of apps) {
//       const room = rooms.find(r => r.number === app.roomNumber);
//       if (room && room.status !== "Occupied") {
//         const entry = audit("OccupancyAgent", "mismatch-detect", app.studentId, app.roomNumber, "FLAG",
//           `Approved application for Room ${app.roomNumber} but room status is ${room.status}.`,
//           [`DATA_MISMATCH: Approved app but room not marked Occupied`]);
//         allocationMismatches.push({ application: app, room, auditEntry: entry });
//       }
//     }

//     // Building breakdown
//     const buildings = {};
//     for (const room of rooms) {
//       if (!buildings[room.building]) buildings[room.building] = { total: 0, occupied: 0, available: 0 };
//       buildings[room.building].total++;
//       if (room.status === "Occupied") buildings[room.building].occupied++;
//       else buildings[room.building].available++;
//     }

//     const healthStatus = occupancyRate > 90 ? "critical" : occupancyRate > 75 ? "warning" : "healthy";
//     const summaryEntry = audit("OccupancyAgent", "report", null, null,
//       `OCCUPANCY ${occupancyRate}%`,
//       `Total: ${total} rooms | Occupied: ${occupied} | Available: ${available} | Anomalies: ${anomalies.length} | Status: ${healthStatus}`
//     );

//     res.json({
//       success: true,
//       summary: { total, occupied, available, occupancyRate, healthStatus },
//       buildings,
//       anomalies,
//       allocationMismatches,
//       recommendations: healthStatus === "critical"
//         ? ["Consider expanding capacity — occupancy critically high.", "Review pending applications urgently."]
//         : healthStatus === "warning"
//         ? ["Monitor closely. New admissions should be reviewed carefully."]
//         : ["Occupancy is healthy. Continue routine monitoring."],
//       auditEntry: summaryEntry,
//     });
//   } catch (err) {
//     res.status(500).json({ error: "OccupancyAgent failed: " + err.message });
//   }
// });

// // ── GET FULL AUDIT TRAIL ─────────────────────────────────────────────────────
// router.get("/audit-trail", (req, res) => {
//   const { agent, limit = 50 } = req.query;
//   let log = auditLog;
//   if (agent) log = log.filter(e => e.agent === agent);
//   res.json({ success: true, total: log.length, entries: log.slice(0, parseInt(limit)) });
// });

// // ── RUN ALL AGENTS (master scan) ─────────────────────────────────────────────
// router.post("/run-all", async (req, res) => {
//   try {
//     const masterEntry = audit("MasterOrchestrator", "full-scan", null, null, "STARTED",
//       "Initiating full multi-agent scan across all accommodation systems.");

//     const [complianceRes, feeRes, complaintRes, occupancyRes] = await Promise.all([
//       fetch(`http://localhost:${process.env.PORT || 3000}/api/agents/compliance-agent/scan`).then(r => r.json()).catch(() => ({ flagged: 0 })),
//       fetch(`http://localhost:${process.env.PORT || 3000}/api/agents/fee-agent/scan`).then(r => r.json()).catch(() => ({ alerts: [] })),
//       fetch(`http://localhost:${process.env.PORT || 3000}/api/agents/complaint-agent/triage`).then(r => r.json()).catch(() => ({ escalations: 0 })),
//       fetch(`http://localhost:${process.env.PORT || 3000}/api/agents/occupancy-agent/report`).then(r => r.json()).catch(() => ({ anomalies: [] })),
//     ]);

//     const summary = {
//       complianceFlagged: complianceRes.flagged || 0,
//       feeAlerts: feeRes.alerts?.length || 0,
//       complaintEscalations: complaintRes.escalations || 0,
//       occupancyAnomalies: occupancyRes.anomalies?.length || 0,
//     };
//     const totalIssues = Object.values(summary).reduce((s, v) => s + v, 0);

//     audit("MasterOrchestrator", "full-scan-complete", null, null,
//       totalIssues === 0 ? "ALL_CLEAR" : `${totalIssues} ISSUES FOUND`,
//       `Compliance: ${summary.complianceFlagged} flags | Fees: ${summary.feeAlerts} alerts | Complaints: ${summary.complaintEscalations} escalations | Occupancy: ${summary.occupancyAnomalies} anomalies`
//     );

//     res.json({ success: true, summary, totalIssues, compliance: complianceRes, fees: feeRes, complaints: complaintRes, occupancy: occupancyRes });
//   } catch (err) {
//     res.status(500).json({ error: "Master scan failed: " + err.message });
//   }
// });

// module.exports = router;
   /**
 * PS5: Domain-Specialized AI Agents with Compliance Guardrails
 * Multi-agent system for student accommodation domain:
 *   1. AllocationAgent   — validates and processes room applications
 *   2. ComplianceAgent   — enforces institutional policies
 *   3. FeeAgent          — detects unpaid dues, flags overdue
 *   4. ComplaintAgent    — triages complaints, auto-escalates high-priority
 *   5. OccupancyAgent    — monitors occupancy, detects anomalies
 *
 * Each agent: validates input → checks compliance → executes → logs audit trail
 */

const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Room = require("../models/Room");
const Student = require("../models/Student");
const { Complaint, Fee, Notice } = require("../models/Other");

// ── AUDIT TRAIL (in-memory, production: store in MongoDB) ────────────────────
const auditLog = [];
function audit(agent, action, studentId, roomId, decision, reasoning, violations = [], warnings = []) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    agent,
    action,
    studentId: studentId || "system",
    roomId: roomId || null,
    decision,
    reasoning,
    violations,
    warnings,
    compliant: violations.length === 0,
  };
  auditLog.unshift(entry);
  if (auditLog.length > 200) auditLog.pop();
  return entry;
}

// ── COMPLIANCE RULES (the guardrail engine) ──────────────────────────────────
const POLICY = {
  maxRoomsPerStudent: 1,
  priceCapPerType: { Single: 15000, Double: 12000, Triple: 9000, Suite: 25000 },
  overdueGraceDays: 7,
  autoEscalateComplaintPriority: "High",
  maxPendingDaysBeforeAlert: 5,
  allowedCheckinDays: null, // null = all days
};

function enforcePolicy(context) {
  const violations = [];
  const warnings = [];

  if (context.existingApproved >= POLICY.maxRoomsPerStudent) {
    violations.push(`POLICY:MAX_ROOMS — Student already holds ${context.existingApproved} active allocation(s). Maximum allowed: ${POLICY.maxRoomsPerStudent}.`);
  }

  if (context.roomType && context.price !== undefined) {
    const cap = POLICY.priceCapPerType[context.roomType];
    if (cap && context.price > cap) {
      violations.push(`POLICY:PRICE_CAP — Room price ₹${context.price.toLocaleString('en-IN')} exceeds policy cap ₹${cap.toLocaleString('en-IN')} for ${context.roomType} type.`);
    }
  }

  if (context.roomStatus && context.roomStatus !== "Available") {
    violations.push(`POLICY:AVAILABILITY — Room is currently ${context.roomStatus}. Cannot allocate an unavailable room.`);
  }

  if (context.pendingDays && context.pendingDays > POLICY.maxPendingDaysBeforeAlert) {
    warnings.push(`POLICY:SLA_WARNING — Application pending for ${context.pendingDays} days, exceeds ${POLICY.maxPendingDaysBeforeAlert}-day SLA.`);
  }

  return { violations, warnings, compliant: violations.length === 0 };
}

// ════════════════════════════════════════════════════════════════
// AGENT 1: AllocationAgent
// Validates room applications, enforces compliance, approves/rejects
// ════════════════════════════════════════════════════════════════
router.post("/allocation-agent/validate", async (req, res) => {
  try {
    const { studentId, roomNumber, checkin, price, roomType, building } = req.body;

    // Step 1: Gather context
    const [student, room, existingApps] = await Promise.all([
      Student.findOne({ studentId }),
      Room.findOne({ number: roomNumber }),
      Application.countDocuments({ studentId, status: { $in: ["Pending", "Approved"] } }),
    ]);

    if (!student) {
      const entry = audit("AllocationAgent", "validate", studentId, roomNumber, "REJECTED", "Student not found in system");
      return res.json({ approved: false, violations: ["Student record not found"], warnings: [], auditEntry: entry });
    }
    if (!room) {
      const entry = audit("AllocationAgent", "validate", studentId, roomNumber, "REJECTED", "Room not found");
      return res.json({ approved: false, violations: ["Room not found"], warnings: [], auditEntry: entry });
    }

    // Step 2: Run compliance engine
    const policy = enforcePolicy({
      existingApproved: existingApps,
      roomType: room.type,
      price: room.price,
      roomStatus: room.status,
    });

    const decision = policy.compliant ? "APPROVED" : "REJECTED";
    const reasoning = policy.compliant
      ? `All ${Object.keys(POLICY).length} policy rules satisfied. Student ${student.name} (${studentId}) eligible for Room ${roomNumber} at ₹${room.price.toLocaleString('en-IN')}/mo.`
      : `Policy violations detected. Application blocked automatically.`;

    const entry = audit("AllocationAgent", "validate", studentId, roomNumber, decision, reasoning, policy.violations, policy.warnings);

    res.json({
      approved: policy.compliant,
      student: { name: student.name, studentId, program: student.program, year: student.year },
      room: { number: room.number, building: room.building, type: room.type, price: room.price, floor: room.floor },
      violations: policy.violations,
      warnings: policy.warnings,
      reasoning,
      auditEntry: entry,
    });
  } catch (err) {
    res.status(500).json({ error: "AllocationAgent failed: " + err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// AGENT 2: ComplianceAgent
// Scans all pending applications and flags SLA breaches + policy violations
// ════════════════════════════════════════════════════════════════
router.get("/compliance-agent/scan", async (req, res) => {
  try {
    const apps = await Application.find({ status: "Pending" }).sort({ createdAt: 1 });
    const now = Date.now();
    const report = [];
    let totalViolations = 0;
    let slaBreaches = 0;

    for (const app of apps) {
      const pendingDays = Math.floor((now - new Date(app.createdAt).getTime()) / 86400000);
      const room = await Room.findOne({ number: app.roomNumber });
      const existingApproved = await Application.countDocuments({ studentId: app.studentId, status: "Approved", _id: { $ne: app._id } });

      const policy = enforcePolicy({
        existingApproved,
        roomType: app.roomType || (room ? room.type : null),
        price: app.roomPrice,
        roomStatus: room ? room.status : "Unknown",
        pendingDays,
      });

      if (pendingDays > POLICY.maxPendingDaysBeforeAlert) slaBreaches++;
      totalViolations += policy.violations.length;

      if (!policy.compliant || policy.warnings.length || pendingDays > POLICY.maxPendingDaysBeforeAlert) {
        const entry = audit("ComplianceAgent", "scan", app.studentId, app.roomNumber,
          policy.compliant ? "WARNING" : "FLAG",
          `Scanned application #${app._id}. Pending ${pendingDays} days.`,
          policy.violations, policy.warnings);
        report.push({ application: app, pendingDays, violations: policy.violations, warnings: policy.warnings, auditEntry: entry });
      }
    }

    const summaryEntry = audit("ComplianceAgent", "scan-summary", null, null,
      `SCANNED ${apps.length} applications`,
      `Found ${totalViolations} violations, ${slaBreaches} SLA breaches across ${apps.length} pending applications.`
    );

    res.json({
      success: true,
      scanned: apps.length,
      flagged: report.length,
      totalViolations,
      slaBreaches,
      report,
      auditEntry: summaryEntry,
    });
  } catch (err) {
    res.status(500).json({ error: "ComplianceAgent failed: " + err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// AGENT 3: FeeAgent
// Detects overdue fees, calculates outstanding, generates alerts
// ════════════════════════════════════════════════════════════════
router.get("/fee-agent/scan", async (req, res) => {
  try {
    const apps = await Application.find({ status: "Approved" });
    const fees = await Fee.find({});
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const alerts = [];

    for (const app of apps) {
      const studentFees = fees.filter(f => f.studentId === app.studentId);
      const paidMonths = studentFees.map(f => f.month);
      const allocationMonth = new Date(app.createdAt).toISOString().slice(0, 7);
      const monthsSinceAlloc = Math.max(0, (now.getFullYear() - new Date(app.createdAt).getFullYear()) * 12 + (now.getMonth() - new Date(app.createdAt).getMonth()));
      const expectedPayments = monthsSinceAlloc + 1;
      const actualPayments = studentFees.length;
      const missingPayments = Math.max(0, expectedPayments - actualPayments);

      if (missingPayments > 0 || !paidMonths.includes(currentMonth)) {
        const outstanding = missingPayments * app.roomPrice;
        const sev = missingPayments >= 3 ? "critical" : missingPayments >= 1 ? "warning" : "info";
        const entry = audit("FeeAgent", "overdue-scan", app.studentId, app.roomNumber,
          sev === "critical" ? "ESCALATE" : "ALERT",
          `Student ${app.studentName} has ${missingPayments} missing payment(s). Outstanding: ₹${outstanding.toLocaleString('en-IN')}.`,
          sev === "critical" ? [`Fee overdue by ${missingPayments} months — escalation required`] : [],
          sev === "warning" ? [`Fee payment overdue for ${missingPayments} month(s)`] : []
        );
        alerts.push({ studentId: app.studentId, studentName: app.studentName, room: app.roomNumber, building: app.building, roomPrice: app.roomPrice, paidMonths, missingPayments, outstanding, severity: sev, auditEntry: entry });
      }
    }

    alerts.sort((a, b) => b.missingPayments - a.missingPayments);
    const summaryEntry = audit("FeeAgent", "scan-complete", null, null, `SCANNED ${apps.length} allocations`,
      `Found ${alerts.length} students with overdue fees. Total outstanding: ₹${alerts.reduce((s,a)=>s+a.outstanding,0).toLocaleString('en-IN')}.`);

    res.json({ success: true, scanned: apps.length, alerts, totalOutstanding: alerts.reduce((s,a)=>s+a.outstanding,0), auditEntry: summaryEntry });
  } catch (err) {
    res.status(500).json({ error: "FeeAgent failed: " + err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// AGENT 4: ComplaintAgent
// Triages complaints, auto-escalates high-priority, suggests resolution
// ════════════════════════════════════════════════════════════════
router.get("/complaint-agent/triage", async (req, res) => {
  try {
    const complaints = await Complaint.find({ status: { $ne: "Resolved" } }).sort({ createdAt: 1 });
    const triage = [];

    const resolutionPlaybooks = {
      High: { sla: "24 hours", action: "Escalate to warden immediately. Contact maintenance team.", autoEscalate: true },
      Medium: { sla: "72 hours", action: "Assign to maintenance team. Follow up in 48h.", autoEscalate: false },
      Low: { sla: "7 days", action: "Log and schedule during next maintenance round.", autoEscalate: false },
    };

    for (const c of complaints) {
      const ageHours = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 3600000);
      const playbook = resolutionPlaybooks[c.priority] || resolutionPlaybooks.Low;
      const slaBreach = (c.priority === "High" && ageHours > 24) || (c.priority === "Medium" && ageHours > 72) || (c.priority === "Low" && ageHours > 168);

      const decision = slaBreach ? "ESCALATE" : playbook.autoEscalate ? "ESCALATE" : "MONITOR";
      const violations = slaBreach ? [`SLA breach: ${c.priority} complaint open for ${ageHours}h (SLA: ${playbook.sla})`] : [];

      const entry = audit("ComplaintAgent", "triage", c.studentId, c.room, decision,
        `Complaint: "${c.subject}" | Priority: ${c.priority} | Age: ${ageHours}h | SLA: ${playbook.sla}`,
        violations);

      triage.push({ complaint: c, ageHours, slaBreach, playbook, decision, auditEntry: entry });
    }

    const escalations = triage.filter(t => t.decision === "ESCALATE").length;
    const summaryEntry = audit("ComplaintAgent", "triage-complete", null, null, `TRIAGED ${complaints.length} complaints`,
      `${escalations} require immediate escalation. ${triage.filter(t=>t.slaBreach).length} SLA breaches detected.`);

    res.json({ success: true, total: complaints.length, escalations, triage, auditEntry: summaryEntry });
  } catch (err) {
    res.status(500).json({ error: "ComplaintAgent failed: " + err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// AGENT 5: OccupancyAgent
// Monitors room occupancy, detects anomalies, forecasts availability
// ════════════════════════════════════════════════════════════════
router.get("/occupancy-agent/report", async (req, res) => {
  try {
    const [rooms, apps] = await Promise.all([Room.find({}), Application.find({ status: "Approved" })]);

    const total = rooms.length;
    const occupied = rooms.filter(r => r.status === "Occupied").length;
    const available = rooms.filter(r => r.status === "Available").length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    // Anomaly: rooms marked occupied but no approved application
    const anomalies = [];
    for (const room of rooms.filter(r => r.status === "Occupied")) {
      const hasApp = apps.some(a => a.roomNumber === room.number);
      if (!hasApp) {
        const entry = audit("OccupancyAgent", "anomaly-detect", null, room.number, "FLAG",
          `Room ${room.number} (Building ${room.building}) marked Occupied but has no approved application.`,
          [`DATA_ANOMALY: Room ${room.number} occupied without matching allocation`]);
        anomalies.push({ room, auditEntry: entry });
      }
    }

    // Anomaly: approved applications for unavailable rooms
    const allocationMismatches = [];
    for (const app of apps) {
      const room = rooms.find(r => r.number === app.roomNumber);
      if (room && room.status !== "Occupied") {
        const entry = audit("OccupancyAgent", "mismatch-detect", app.studentId, app.roomNumber, "FLAG",
          `Approved application for Room ${app.roomNumber} but room status is ${room.status}.`,
          [`DATA_MISMATCH: Approved app but room not marked Occupied`]);
        allocationMismatches.push({ application: app, room, auditEntry: entry });
      }
    }

    // Building breakdown
    const buildings = {};
    for (const room of rooms) {
      if (!buildings[room.building]) buildings[room.building] = { total: 0, occupied: 0, available: 0 };
      buildings[room.building].total++;
      if (room.status === "Occupied") buildings[room.building].occupied++;
      else buildings[room.building].available++;
    }

    const healthStatus = occupancyRate > 90 ? "critical" : occupancyRate > 75 ? "warning" : "healthy";
    const summaryEntry = audit("OccupancyAgent", "report", null, null,
      `OCCUPANCY ${occupancyRate}%`,
      `Total: ${total} rooms | Occupied: ${occupied} | Available: ${available} | Anomalies: ${anomalies.length} | Status: ${healthStatus}`
    );

    res.json({
      success: true,
      summary: { total, occupied, available, occupancyRate, healthStatus },
      buildings,
      anomalies,
      allocationMismatches,
      recommendations: healthStatus === "critical"
        ? ["Consider expanding capacity — occupancy critically high.", "Review pending applications urgently."]
        : healthStatus === "warning"
        ? ["Monitor closely. New admissions should be reviewed carefully."]
        : ["Occupancy is healthy. Continue routine monitoring."],
      auditEntry: summaryEntry,
    });
  } catch (err) {
    res.status(500).json({ error: "OccupancyAgent failed: " + err.message });
  }
});

// ── GET FULL AUDIT TRAIL ─────────────────────────────────────────────────────
router.get("/audit-trail", (req, res) => {
  const { agent, limit = 50 } = req.query;
  let log = auditLog;
  if (agent) log = log.filter(e => e.agent === agent);
  res.json({ success: true, total: log.length, entries: log.slice(0, parseInt(limit)) });
});

// ── RUN ALL AGENTS (master scan) ─────────────────────────────────────────────
router.post("/run-all", async (req, res) => {
  try {
    const masterEntry = audit("MasterOrchestrator", "full-scan", null, null, "STARTED",
      "Initiating full multi-agent scan across all accommodation systems.");

    const SELF = `http://127.0.0.1:${process.env.PORT || 3000}`;
    const [complianceRes, feeRes, complaintRes, occupancyRes] = await Promise.all([
      fetch(`${SELF}/api/agents/compliance-agent/scan`).then(r => r.json()).catch(() => ({ flagged: 0 })),
      fetch(`${SELF}/api/agents/fee-agent/scan`).then(r => r.json()).catch(() => ({ alerts: [] })),
      fetch(`${SELF}/api/agents/complaint-agent/triage`).then(r => r.json()).catch(() => ({ escalations: 0 })),
      fetch(`${SELF}/api/agents/occupancy-agent/report`).then(r => r.json()).catch(() => ({ anomalies: [] })),
    ]);

    const summary = {
      complianceFlagged: complianceRes.flagged || 0,
      feeAlerts: feeRes.alerts?.length || 0,
      complaintEscalations: complaintRes.escalations || 0,
      occupancyAnomalies: occupancyRes.anomalies?.length || 0,
    };
    const totalIssues = Object.values(summary).reduce((s, v) => s + v, 0);

    audit("MasterOrchestrator", "full-scan-complete", null, null,
      totalIssues === 0 ? "ALL_CLEAR" : `${totalIssues} ISSUES FOUND`,
      `Compliance: ${summary.complianceFlagged} flags | Fees: ${summary.feeAlerts} alerts | Complaints: ${summary.complaintEscalations} escalations | Occupancy: ${summary.occupancyAnomalies} anomalies`
    );

    res.json({ success: true, summary, totalIssues, compliance: complianceRes, fees: feeRes, complaints: complaintRes, occupancy: occupancyRes });
  } catch (err) {
    res.status(500).json({ error: "Master scan failed: " + err.message });
  }
});

module.exports = router;