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

//     const SELF = `http://127.0.0.1:${process.env.PORT || 3000}`;
//     const [complianceRes, feeRes, complaintRes, occupancyRes] = await Promise.all([
//       fetch(`${SELF}/api/agents/compliance-agent/scan`).then(r => r.json()).catch(() => ({ flagged: 0 })),
//       fetch(`${SELF}/api/agents/fee-agent/scan`).then(r => r.json()).catch(() => ({ alerts: [] })),
//       fetch(`${SELF}/api/agents/complaint-agent/triage`).then(r => r.json()).catch(() => ({ escalations: 0 })),
//       fetch(`${SELF}/api/agents/occupancy-agent/report`).then(r => r.json()).catch(() => ({ anomalies: [] })),
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
 * Stayo — Multi-Agent System (PS5: Domain AI + Compliance Guardrails)
 *
 * FIX 1: PERSISTENT AUDIT TRAIL   — every decision saved to MongoDB (survives restarts)
 * FIX 2: AGENT CHAINING           — agents trigger each other downstream
 * FIX 3: CONFIDENCE ESCALATION    — agents escalate when outside confidence range
 *
 * Agent Pipeline (with chaining):
 *   AllocationAgent  → [approved]   → FeeAgent (auto-creates pending fee)
 *   ComplianceAgent  → [violation]  → NoticeAgent (auto-posts alert)
 *   FeeAgent         → [critical]   → NoticeAgent (auto-posts urgent notice)
 *   ComplaintAgent   → [SLA breach] → NoticeAgent (auto-posts escalation notice)
 *   OccupancyAgent   → [anomaly]    → chains to ComplianceAgent for follow-up
 *   Any Agent        → [low conf.]  → ESCALATE_TO_HUMAN
 */

// const express = require("express");
// const router  = express.Router();
// const Application  = require("../models/Application");
// const Room         = require("../models/Room");
// const Student      = require("../models/Student");
// const AuditLog     = require("../models/AuditLog");
// const { Complaint, Fee, Notice } = require("../models/Other");

// // ════════════════════════════════════════════════════════════════════════════
// // FIX 1: PERSISTENT AUDIT TRAIL — saves to MongoDB, survives restarts
// // ════════════════════════════════════════════════════════════════════════════
// async function audit(agent, action, studentId, roomId, decision, reasoning,
//                      violations=[], warnings=[], chainedFrom=null, chainedTo=[], metadata={}) {
//   const entry = {
//     id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
//     agent, action,
//     studentId:   studentId || "system",
//     roomId:      roomId    || null,
//     decision, reasoning, violations, warnings,
//     compliant:   violations.length === 0,
//     chainedFrom, chainedTo, metadata,
//   };
//   try {
//     await AuditLog.create(entry);
//   } catch (e) {
//     console.error("[AuditLog] DB persist failed:", e.message);
//   }
//   return entry;
// }

// // ════════════════════════════════════════════════════════════════════════════
// // COMPLIANCE POLICY ENGINE — central guardrail
// // ════════════════════════════════════════════════════════════════════════════
// const POLICY = {
//   maxRoomsPerStudent:        1,
//   priceCapPerType:           { Single: 30000, Double: 20000, Triple: 15000, Suite: 50000 },
//   overdueGraceDays:          7,
//   maxPendingDaysBeforeAlert: 5,
//   minConfidenceThreshold:    0.7,
// };

// function enforcePolicy(context) {
//   const violations = [], warnings = [];
//   let confidence = 1.0;

//   if (context.existingApproved >= POLICY.maxRoomsPerStudent)
//     violations.push(`POLICY:MAX_ROOMS — Student already holds ${context.existingApproved} allocation(s). Max: ${POLICY.maxRoomsPerStudent}.`);

//   if (context.roomType && context.price !== undefined) {
//     const cap = POLICY.priceCapPerType[context.roomType];
//     if (cap && context.price > cap)
//       violations.push(`POLICY:PRICE_CAP — Rs.${context.price.toLocaleString("en-IN")} exceeds cap Rs.${cap.toLocaleString("en-IN")} for ${context.roomType}.`);
//   }

//   if (context.roomStatus && context.roomStatus !== "Available")
//     violations.push(`POLICY:AVAILABILITY — Room is ${context.roomStatus}. Cannot allocate.`);

//   if (context.pendingDays > POLICY.maxPendingDaysBeforeAlert)
//     warnings.push(`POLICY:SLA_WARNING — Pending ${context.pendingDays} days, exceeds ${POLICY.maxPendingDaysBeforeAlert}-day SLA.`);

//   if (!context.studentVerified) { confidence -= 0.2; warnings.push("CONFIDENCE:LOW — Student email not verified."); }
//   if (context.roomType && !POLICY.priceCapPerType[context.roomType]) { confidence -= 0.15; warnings.push(`CONFIDENCE:UNKNOWN_TYPE — Room type "${context.roomType}" not in policy.`); }

//   return { violations, warnings, compliant: violations.length === 0, confidence };
// }

// // ════════════════════════════════════════════════════════════════════════════
// // FIX 3: CONFIDENCE ESCALATION — agents escalate when uncertain
// // ════════════════════════════════════════════════════════════════════════════
// function checkConfidence(confidence, context, agentName) {
//   if (confidence < POLICY.minConfidenceThreshold) {
//     return {
//       shouldEscalate: true,
//       reason: `${agentName}: Confidence ${(confidence*100).toFixed(0)}% below threshold ${(POLICY.minConfidenceThreshold*100).toFixed(0)}%. ` +
//               `Scenario outside agent confidence range — escalating to human review.`,
//     };
//   }
//   return { shouldEscalate: false };
// }

// // ════════════════════════════════════════════════════════════════════════════
// // FIX 2: AGENT CHAINING HELPERS
// // ════════════════════════════════════════════════════════════════════════════
// async function chainToFeeAgent(app, triggeredBy) {
//   try {
//     const currentMonth = new Date().toISOString().slice(0, 7);
//     const exists = await Fee.findOne({ studentId: app.studentId, month: currentMonth });
//     if (!exists) {
//       await Fee.create({
//         studentId: app.studentId, studentName: app.studentName,
//         room: app.roomNumber || "—", amount: app.roomPrice || 0,
//         month: currentMonth, mode: "Pending",
//         notes: `Auto-created by FeeAgent (chained from ${triggeredBy}).`,
//         status: "Pending",
//       });
//       await audit("FeeAgent", "chain-create-fee", app.studentId, app.roomNumber,
//         "FEE_RECORD_CREATED",
//         `Chained from ${triggeredBy}: auto-created pending fee Rs.${(app.roomPrice||0).toLocaleString("en-IN")} for ${currentMonth}.`,
//         [], [], triggeredBy, [], { amount: app.roomPrice, month: currentMonth });
//       return { chained: true, action: "Pending fee record created for current month" };
//     }
//     return { chained: false, action: "Fee record already exists" };
//   } catch (e) { return { chained: false, error: e.message }; }
// }

// async function chainToNoticeAgent(studentId, studentName, message, triggeredBy) {
//   try {
//     await Notice.create({ title: `Alert — ${studentName}`, category: "Urgent", content: message });
//     await audit("NoticeAgent", "chain-post-notice", studentId, null,
//       "NOTICE_POSTED",
//       `Chained from ${triggeredBy}: posted urgent notice for ${studentName}.`,
//       [], [], triggeredBy, [], { message });
//     return { chained: true, action: "Urgent notice posted for student" };
//   } catch (e) { return { chained: false, error: e.message }; }
// }

// // ════════════════════════════════════════════════════════════════════════════
// // AGENT 1: AllocationAgent — validates → chains to FeeAgent on approval
// // ════════════════════════════════════════════════════════════════════════════
// router.post("/allocation-agent/validate", async (req, res) => {
//   try {
//     const { studentId, roomNumber } = req.body;
//     const [student, room, existingApps] = await Promise.all([
//       Student.findOne({ studentId }),
//       Room.findOne({ number: roomNumber }),
//       Application.countDocuments({ studentId, status: { $in: ["Pending","Approved"] } }),
//     ]);

//     if (!student) {
//       const entry = await audit("AllocationAgent","validate",studentId,roomNumber,"REJECTED",
//         "Student not found in system.",["ENTITY:STUDENT_NOT_FOUND"],[]);
//       return res.json({ approved:false, escalate:false, violations:["Student not found"], warnings:[], auditEntry:entry });
//     }
//     if (!room) {
//       const entry = await audit("AllocationAgent","validate",studentId,roomNumber,"REJECTED",
//         "Room not found in system.",["ENTITY:ROOM_NOT_FOUND"],[]);
//       return res.json({ approved:false, escalate:false, violations:["Room not found"], warnings:[], auditEntry:entry });
//     }

//     const policy = enforcePolicy({
//       existingApproved: existingApps, roomType: room.type,
//       price: room.price, roomStatus: room.status, studentVerified: student.isVerified,
//     });

//     // FIX 3: Confidence check
//     const { shouldEscalate, reason } = checkConfidence(policy.confidence, { studentId, roomNumber }, "AllocationAgent");
//     if (shouldEscalate) {
//       const entry = await audit("AllocationAgent","validate",studentId,roomNumber,
//         "ESCALATE_TO_HUMAN", reason, [], policy.warnings, null, ["HumanReview"]);
//       return res.json({ approved:false, escalate:true, escalateReason:reason, violations:[], warnings:policy.warnings, auditEntry:entry });
//     }

//     // FIX 2: Chain to FeeAgent if approved
//     let chainResult = null, chainedTo = [];
//     if (policy.compliant) {
//       chainResult = await chainToFeeAgent(
//         { studentId, studentName: student.name, roomNumber, roomPrice: room.price }, "AllocationAgent"
//       );
//       if (chainResult.chained) chainedTo = ["FeeAgent"];
//     }

//     const decision = policy.compliant ? "APPROVED" : "REJECTED";
//     const reasoning = policy.compliant
//       ? `All policy rules passed. ${student.name} eligible for Room ${roomNumber} (${room.type}) at Rs.${room.price.toLocaleString("en-IN")}/mo.`
//       : `Policy violations detected. Allocation blocked.`;

//     const entry = await audit("AllocationAgent","validate",studentId,roomNumber,
//       decision, reasoning, policy.violations, policy.warnings, null, chainedTo,
//       { student:{name:student.name,program:student.program}, room:{type:room.type,price:room.price,building:room.building}, chainResult });

//     res.json({ approved:policy.compliant, escalate:false,
//       student:{name:student.name,studentId,program:student.program,year:student.year},
//       room:{number:room.number,building:room.building,type:room.type,price:room.price},
//       violations:policy.violations, warnings:policy.warnings, reasoning, chainedTo, chainResult, auditEntry:entry });
//   } catch (err) { res.status(500).json({ error:"AllocationAgent failed: "+err.message }); }
// });

// // ════════════════════════════════════════════════════════════════════════════
// // AGENT 2: ComplianceAgent — scans → chains to NoticeAgent on violation
// // ════════════════════════════════════════════════════════════════════════════
// router.get("/compliance-agent/scan", async (req, res) => {
//   try {
//     const apps = await Application.find({ status:"Pending" }).sort({ createdAt:1 });
//     const now = Date.now();
//     const report = [];
//     let totalViolations = 0, slaBreaches = 0;

//     for (const app of apps) {
//       const pendingDays = Math.floor((now - new Date(app.createdAt).getTime()) / 86400000);
//       const existingApproved = await Application.countDocuments({ studentId:app.studentId, status:"Approved", _id:{$ne:app._id} });

//       const policy = enforcePolicy({ existingApproved, roomType:app.roomType, price:app.roomPrice,
//         roomStatus:"Available", pendingDays, studentVerified:true });

//       if (pendingDays > POLICY.maxPendingDaysBeforeAlert) slaBreaches++;
//       totalViolations += policy.violations.length;

//       const { shouldEscalate, reason } = checkConfidence(policy.confidence, { studentId:app.studentId }, "ComplianceAgent");
//       const decision = shouldEscalate ? "ESCALATE_TO_HUMAN" : policy.compliant ? "WARNING" : "FLAG";

//       // FIX 2: Chain to NoticeAgent on violation
//       let chainResult = null, chainedTo = [];
//       if (!policy.compliant && policy.violations.length > 0) {
//         chainResult = await chainToNoticeAgent(app.studentId, app.studentName,
//           `Compliance issue on your application: ${policy.violations[0]} — Contact admin.`, "ComplianceAgent");
//         if (chainResult.chained) chainedTo = ["NoticeAgent"];
//       }

//       if (!policy.compliant || policy.warnings.length || pendingDays > POLICY.maxPendingDaysBeforeAlert || shouldEscalate) {
//         const entry = await audit("ComplianceAgent","scan",app.studentId,app.roomNumber||null,
//           decision, shouldEscalate ? reason : `${app.studentName} — pending ${pendingDays} day(s).`,
//           policy.violations, policy.warnings, null, chainedTo, { pendingDays, chainResult });
//         report.push({ application:app, pendingDays, violations:policy.violations, warnings:policy.warnings, chainedTo, auditEntry:entry });
//       }
//     }

//     const summaryEntry = await audit("ComplianceAgent","scan-summary",null,null,
//       `SCANNED ${apps.length} applications`,
//       `${totalViolations} violations, ${slaBreaches} SLA breaches found.`,
//       [],[],null,[],{ totalViolations, slaBreaches, flagged:report.length });

//     res.json({ success:true, scanned:apps.length, flagged:report.length, totalViolations, slaBreaches, report, auditEntry:summaryEntry });
//   } catch (err) { res.status(500).json({ error:"ComplianceAgent failed: "+err.message }); }
// });

// // ════════════════════════════════════════════════════════════════════════════
// // AGENT 3: FeeAgent — detects overdue → chains to NoticeAgent on critical
// // ════════════════════════════════════════════════════════════════════════════
// router.get("/fee-agent/scan", async (req, res) => {
//   try {
//     const apps = await Application.find({ status:"Approved" });
//     const fees = await Fee.find({});
//     const now  = new Date();
//     const currentMonth = now.toISOString().slice(0,7);
//     const alerts = [];

//     for (const app of apps) {
//       const studentFees = fees.filter(f => f.studentId === app.studentId);
//       const monthsSinceAlloc = Math.max(0,
//         (now.getFullYear()-new Date(app.createdAt).getFullYear())*12 +
//         (now.getMonth()-new Date(app.createdAt).getMonth()));
//       const missingPayments = Math.max(0, monthsSinceAlloc + 1 - studentFees.length);

//       if (missingPayments > 0 || !studentFees.map(f=>f.month).includes(currentMonth)) {
//         const outstanding = missingPayments * (app.roomPrice||0);
//         const sev = missingPayments >= 3 ? "critical" : missingPayments >= 1 ? "warning" : "info";

//         // FIX 2: Chain to NoticeAgent on critical
//         let chainResult = null, chainedTo = [];
//         if (sev === "critical") {
//           chainResult = await chainToNoticeAgent(app.studentId, app.studentName,
//             `URGENT: Fee overdue by ${missingPayments} month(s). Outstanding: Rs.${outstanding.toLocaleString("en-IN")}. Pay immediately.`,
//             "FeeAgent");
//           if (chainResult.chained) chainedTo = ["NoticeAgent"];
//         }

//         const entry = await audit("FeeAgent","overdue-scan",app.studentId,app.roomNumber||null,
//           sev==="critical"?"ESCALATE":"ALERT",
//           `${app.studentName}: ${missingPayments} missing payment(s). Outstanding Rs.${outstanding.toLocaleString("en-IN")}.`,
//           sev==="critical"?[`FEE:CRITICAL_OVERDUE — ${missingPayments} months unpaid`]:[],
//           sev==="warning"?[`FEE:OVERDUE — ${missingPayments} month(s)`]:[],
//           null, chainedTo, { missingPayments, outstanding, severity:sev, chainResult });

//         alerts.push({ studentId:app.studentId, studentName:app.studentName, room:app.roomNumber,
//           building:app.building, roomPrice:app.roomPrice, paidMonths:studentFees.map(f=>f.month),
//           missingPayments, outstanding, severity:sev, chainedTo, auditEntry:entry });
//       }
//     }

//     alerts.sort((a,b)=>b.missingPayments-a.missingPayments);
//     const totalOutstanding = alerts.reduce((s,a)=>s+a.outstanding,0);
//     const summaryEntry = await audit("FeeAgent","scan-complete",null,null,
//       `SCANNED ${apps.length} allocations`,
//       `${alerts.length} overdue. Total outstanding: Rs.${totalOutstanding.toLocaleString("en-IN")}.`,
//       [],[],null,[],{ alertCount:alerts.length, totalOutstanding });

//     res.json({ success:true, scanned:apps.length, alerts, totalOutstanding, auditEntry:summaryEntry });
//   } catch (err) { res.status(500).json({ error:"FeeAgent failed: "+err.message }); }
// });

// // ════════════════════════════════════════════════════════════════════════════
// // AGENT 4: ComplaintAgent — triages → chains to NoticeAgent on SLA breach
// // ════════════════════════════════════════════════════════════════════════════
// router.get("/complaint-agent/triage", async (req, res) => {
//   try {
//     const complaints = await Complaint.find({ status:{$ne:"Resolved"} }).sort({ createdAt:1 });
//     const triage = [];
//     const playbooks = {
//       High:   { sla:"24 hours",  action:"Escalate to warden immediately.", autoEscalate:true  },
//       Medium: { sla:"72 hours",  action:"Assign to maintenance. Follow up in 48h.", autoEscalate:false },
//       Low:    { sla:"7 days",    action:"Schedule in next maintenance round.", autoEscalate:false },
//     };

//     for (const c of complaints) {
//       const ageHours = Math.floor((Date.now()-new Date(c.createdAt).getTime())/3600000);

//       // FIX 3: Unknown priority → ESCALATE_TO_HUMAN
//       if (!playbooks[c.priority]) {
//         const entry = await audit("ComplaintAgent","triage",c.studentId,c.room,
//           "ESCALATE_TO_HUMAN",
//           `Unknown priority "${c.priority}" — outside confidence range. Escalating to human rather than applying wrong SLA.`,
//           [],[],null,["HumanReview"]);
//         triage.push({ complaint:c, ageHours, slaBreach:false, playbook:playbooks.Low, decision:"ESCALATE_TO_HUMAN", escalated:true, auditEntry:entry });
//         continue;
//       }

//       const playbook = playbooks[c.priority];
//       const slaBreach = (c.priority==="High"&&ageHours>24)||(c.priority==="Medium"&&ageHours>72)||(c.priority==="Low"&&ageHours>168);
//       const decision  = (slaBreach||playbook.autoEscalate) ? "ESCALATE" : "MONITOR";

//       // FIX 2: Chain to NoticeAgent on SLA breach
//       let chainResult = null, chainedTo = [];
//       if (decision==="ESCALATE" && slaBreach) {
//         chainResult = await chainToNoticeAgent(c.studentId, c.studentName,
//           `SLA BREACH: Your "${c.priority}" complaint "${c.subject}" has been open ${ageHours}h (limit: ${playbook.sla}). Auto-escalated to warden.`,
//           "ComplaintAgent");
//         if (chainResult.chained) chainedTo = ["NoticeAgent"];
//       }

//       const entry = await audit("ComplaintAgent","triage",c.studentId,c.room,decision,
//         `"${c.subject}" | ${c.priority} | ${ageHours}h open | SLA: ${playbook.sla}`,
//         slaBreach?[`SLA:BREACH — ${c.priority} open ${ageHours}h (limit: ${playbook.sla})`]:[],
//         [],[],chainedTo,{ ageHours, slaBreach, action:playbook.action, chainResult });

//       triage.push({ complaint:c, ageHours, slaBreach, playbook, decision, chainedTo, auditEntry:entry });
//     }

//     const escalations = triage.filter(t=>t.decision==="ESCALATE"||t.decision==="ESCALATE_TO_HUMAN").length;
//     const summaryEntry = await audit("ComplaintAgent","triage-complete",null,null,
//       `TRIAGED ${complaints.length} complaints`,
//       `${escalations} escalated. ${triage.filter(t=>t.slaBreach).length} SLA breaches.`,
//       [],[],null,[],{ total:complaints.length, escalations });

//     res.json({ success:true, total:complaints.length, escalations, triage, auditEntry:summaryEntry });
//   } catch (err) { res.status(500).json({ error:"ComplaintAgent failed: "+err.message }); }
// });

// // ════════════════════════════════════════════════════════════════════════════
// // AGENT 5: OccupancyAgent — detects anomalies → chains to ComplianceAgent
// // ════════════════════════════════════════════════════════════════════════════
// router.get("/occupancy-agent/report", async (req, res) => {
//   try {
//     const [rooms, apps] = await Promise.all([Room.find({}), Application.find({status:"Approved"})]);
//     const total     = rooms.length;
//     const occupied  = rooms.filter(r=>r.status==="Occupied").length;
//     const available = rooms.filter(r=>r.status==="Available").length;
//     const occupancyRate = total>0 ? Math.round((occupied/total)*100) : 0;

//     // FIX 3: Edge case — no rooms → ESCALATE_TO_HUMAN
//     if (total === 0) {
//       const entry = await audit("OccupancyAgent","report",null,null,
//         "ESCALATE_TO_HUMAN",
//         "No rooms in system. Cannot generate reliable report. Confidence: 0%. Escalating to human.",
//         [],[],null,["HumanReview"]);
//       return res.json({ success:true, escalated:true,
//         summary:{total:0,occupied:0,available:0,occupancyRate:0,healthStatus:"unknown"},
//         anomalies:[],allocationMismatches:[],buildings:{},
//         recommendations:["ESCALATE: No room data. Verify database integrity."], auditEntry:entry });
//     }

//     // Anomaly detection
//     const anomalies = [];
//     for (const room of rooms.filter(r=>r.status==="Occupied")) {
//       if (!apps.some(a=>a.roomNumber===room.number)) {
//         const entry = await audit("OccupancyAgent","anomaly-detect",null,room.number,"FLAG",
//           `Room ${room.number} (${room.building}) Occupied but no approved application found.`,
//           [`DATA_ANOMALY: Room ${room.number} occupied without allocation`],
//           [],[],["ComplianceAgent"],{ building:room.building });
//         anomalies.push({ room, auditEntry:entry });
//       }
//     }

//     const allocationMismatches = [];
//     for (const app of apps) {
//       if (!app.roomNumber) continue;
//       const room = rooms.find(r=>r.number===app.roomNumber);
//       if (room && room.status!=="Occupied") {
//         const entry = await audit("OccupancyAgent","mismatch-detect",app.studentId,app.roomNumber,"FLAG",
//           `Approved app for Room ${app.roomNumber} but room status is "${room.status}".`,
//           [`DATA_MISMATCH: Allocation approved but room not Occupied`],
//           [],[],["ComplianceAgent"],{ studentName:app.studentName });
//         allocationMismatches.push({ application:app, room, auditEntry:entry });
//       }
//     }

//     const buildings = {};
//     for (const room of rooms) {
//       if (!buildings[room.building]) buildings[room.building]={total:0,occupied:0,available:0};
//       buildings[room.building].total++;
//       room.status==="Occupied" ? buildings[room.building].occupied++ : buildings[room.building].available++;
//     }

//     const healthStatus = occupancyRate>90?"critical":occupancyRate>75?"warning":"healthy";
//     const summaryEntry = await audit("OccupancyAgent","report",null,null,
//       `OCCUPANCY ${occupancyRate}%`,
//       `Total:${total} | Occupied:${occupied} | Available:${available} | Anomalies:${anomalies.length} | ${healthStatus}`,
//       [],[],null, anomalies.length?["ComplianceAgent"]:[],
//       { occupancyRate, healthStatus, anomalyCount:anomalies.length });

//     res.json({ success:true,
//       summary:{total,occupied,available,occupancyRate,healthStatus},
//       buildings, anomalies, allocationMismatches,
//       recommendations: healthStatus==="critical"
//         ?["CRITICAL: Expand capacity urgently.","Review all pending applications."]
//         :healthStatus==="warning"?["Monitor closely. Limit new admissions."]
//         :["Occupancy healthy. Routine monitoring sufficient."],
//       auditEntry:summaryEntry });
//   } catch (err) { res.status(500).json({ error:"OccupancyAgent failed: "+err.message }); }
// });

// // ════════════════════════════════════════════════════════════════════════════
// // PERSISTENT AUDIT TRAIL — reads from MongoDB (survives restarts)
// // ════════════════════════════════════════════════════════════════════════════
// router.get("/audit-trail", async (req, res) => {
//   try {
//     const { agent, limit=50, studentId } = req.query;
//     const filter = {};
//     if (agent)     filter.agent     = agent;
//     if (studentId) filter.studentId = studentId;
//     const entries = await AuditLog.find(filter).sort({createdAt:-1}).limit(parseInt(limit)).lean();
//     const total   = await AuditLog.countDocuments(filter);
//     res.json({ success:true, total, entries });
//   } catch (err) { res.status(500).json({ error:"Audit trail failed: "+err.message }); }
// });

// // ════════════════════════════════════════════════════════════════════════════
// // MASTER ORCHESTRATOR — parallel execution + aggregate
// // ════════════════════════════════════════════════════════════════════════════
// router.post("/run-all", async (req, res) => {
//   try {
//     await audit("MasterOrchestrator","full-scan",null,null,"STARTED",
//       "Initiating full parallel multi-agent scan.",
//       [],[],null,["ComplianceAgent","FeeAgent","ComplaintAgent","OccupancyAgent"]);

//     const BASE = `http://127.0.0.1:${process.env.PORT||3000}`;
//     const [complianceRes,feeRes,complaintRes,occupancyRes] = await Promise.all([
//       fetch(`${BASE}/api/agents/compliance-agent/scan`).then(r=>r.json()).catch(e=>({flagged:0,error:e.message})),
//       fetch(`${BASE}/api/agents/fee-agent/scan`).then(r=>r.json()).catch(e=>({alerts:[],error:e.message})),
//       fetch(`${BASE}/api/agents/complaint-agent/triage`).then(r=>r.json()).catch(e=>({escalations:0,error:e.message})),
//       fetch(`${BASE}/api/agents/occupancy-agent/report`).then(r=>r.json()).catch(e=>({anomalies:[],error:e.message})),
//     ]);

//     const summary = {
//       complianceFlagged:    complianceRes.flagged||0,
//       feeAlerts:            feeRes.alerts?.length||0,
//       complaintEscalations: complaintRes.escalations||0,
//       occupancyAnomalies:   (occupancyRes.anomalies?.length||0)+(occupancyRes.allocationMismatches?.length||0),
//     };
//     const totalIssues = Object.values(summary).reduce((s,v)=>s+v,0);

//     await audit("MasterOrchestrator","full-scan-complete",null,null,
//       totalIssues===0?"ALL_CLEAR":`${totalIssues} ISSUES FOUND`,
//       `Compliance:${summary.complianceFlagged} | Fees:${summary.feeAlerts} | Complaints:${summary.complaintEscalations} | Occupancy:${summary.occupancyAnomalies}`,
//       [],[],null,[],summary);

//     res.json({ success:true, summary, totalIssues,
//       compliance:complianceRes, fees:feeRes, complaints:complaintRes, occupancy:occupancyRes });
//   } catch (err) { res.status(500).json({ error:"MasterOrchestrator failed: "+err.message }); }
// });

// module.exports = router;

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

//     const SELF = `http://127.0.0.1:${process.env.PORT || 3000}`;
//     const [complianceRes, feeRes, complaintRes, occupancyRes] = await Promise.all([
//       fetch(`${SELF}/api/agents/compliance-agent/scan`).then(r => r.json()).catch(() => ({ flagged: 0 })),
//       fetch(`${SELF}/api/agents/fee-agent/scan`).then(r => r.json()).catch(() => ({ alerts: [] })),
//       fetch(`${SELF}/api/agents/complaint-agent/triage`).then(r => r.json()).catch(() => ({ escalations: 0 })),
//       fetch(`${SELF}/api/agents/occupancy-agent/report`).then(r => r.json()).catch(() => ({ anomalies: [] })),
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
const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Room = require("../models/Room");
const Student = require("../models/Student");
const { Complaint, Fee, Notice } = require("../models/Other");
const AuditLog = require("../models/AuditLog");

// ── AUDIT (persists to MongoDB) ───────────────────────────────────────────────
async function audit(agent, action, studentId, roomId, decision, reasoning, violations = [], warnings = []) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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
  try {
    await AuditLog.create(entry);
  } catch (e) {
    console.error("Audit DB write failed:", e.message);
  }
  return entry;
}

// ── POLICY ENGINE ─────────────────────────────────────────────────────────────
const POLICY = {
  maxRoomsPerStudent: 1,
  priceCapPerType: { Single: 15000, Double: 12000, Triple: 9000, Suite: 25000 },
  overdueGraceDays: 7,
  autoEscalateComplaintPriority: "High",
  maxPendingDaysBeforeAlert: 5,
  allowedCheckinDays: null,
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
      violations.push(`POLICY:PRICE_CAP — Room price ₹${context.price} exceeds policy cap ₹${cap} for ${context.roomType} type.`);
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

// ── AGENT 1: AllocationAgent ──────────────────────────────────────────────────
router.post("/allocation-agent/validate", async (req, res) => {
  try {
    const { studentId, roomNumber } = req.body;

    const [student, room, existingApps] = await Promise.all([
      Student.findOne({ studentId }),
      Room.findOne({ number: roomNumber }),
      Application.countDocuments({ studentId, status: { $in: ["Pending", "Approved"] } }),
    ]);

    if (!student) {
      const entry = await audit("AllocationAgent", "validate", studentId, roomNumber, "REJECTED", "Student not found in system.", ["Student record missing"]);
      return res.json({ approved: false, violations: ["Student record not found"], warnings: [], auditEntry: entry });
    }
    if (!room) {
      const entry = await audit("AllocationAgent", "validate", studentId, roomNumber, "REJECTED", "Room not found.", ["Room record missing"]);
      return res.json({ approved: false, violations: ["Room not found"], warnings: [], auditEntry: entry });
    }

    const policy = enforcePolicy({
      existingApproved: existingApps,
      roomType: room.type,
      price: room.price,
      roomStatus: room.status,
    });

    const decision = policy.compliant ? "APPROVED" : "REJECTED";
    const reasoning = policy.compliant
      ? `All policy rules satisfied. Student ${student.name} (${studentId}) eligible for Room ${roomNumber} at ₹${room.price}/mo.`
      : `Policy violations detected. Application blocked automatically.`;

    const entry = await audit("AllocationAgent", "validate", studentId, roomNumber, decision, reasoning, policy.violations, policy.warnings);

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

// ── AGENT 2: ComplianceAgent ──────────────────────────────────────────────────
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
        const entry = await audit("ComplianceAgent", "scan", app.studentId, app.roomNumber,
          policy.compliant ? "WARNING" : "FLAG",
          `Scanned application #${app._id}. Pending ${pendingDays} days.`,
          policy.violations, policy.warnings);
        report.push({ application: app, pendingDays, violations: policy.violations, warnings: policy.warnings, auditEntry: entry });
      }
    }

    const summaryEntry = await audit("ComplianceAgent", "scan-summary", null, null,
      `SCANNED ${apps.length} applications`,
      `Found ${totalViolations} violations, ${slaBreaches} SLA breaches across ${apps.length} pending applications.`
    );

    res.json({ success: true, scanned: apps.length, flagged: report.length, totalViolations, slaBreaches, report, auditEntry: summaryEntry });
  } catch (err) {
    res.status(500).json({ error: "ComplianceAgent failed: " + err.message });
  }
});

// ── AGENT 3: FeeAgent ─────────────────────────────────────────────────────────
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
      const monthsSinceAlloc = Math.max(0,
        (now.getFullYear() - new Date(app.createdAt).getFullYear()) * 12 +
        (now.getMonth() - new Date(app.createdAt).getMonth()));
      const missingPayments = Math.max(0, (monthsSinceAlloc + 1) - studentFees.length);

      if (missingPayments > 0 || !paidMonths.includes(currentMonth)) {
        const outstanding = missingPayments * (app.roomPrice || 0);
        const sev = missingPayments >= 3 ? "critical" : missingPayments >= 1 ? "warning" : "info";
        const entry = await audit("FeeAgent", "overdue-scan", app.studentId, app.roomNumber,
          sev === "critical" ? "ESCALATE" : "ALERT",
          `Student ${app.studentName} has ${missingPayments} missing payment(s). Outstanding: ₹${outstanding}.`,
          sev === "critical" ? [`Fee overdue by ${missingPayments} months — escalation required`] : [],
          sev === "warning" ? [`Fee payment overdue for ${missingPayments} month(s)`] : []
        );
        alerts.push({ studentId: app.studentId, studentName: app.studentName, room: app.roomNumber, building: app.building, roomPrice: app.roomPrice, paidMonths, missingPayments, outstanding, severity: sev, auditEntry: entry });
      }
    }

    alerts.sort((a, b) => b.missingPayments - a.missingPayments);
    const totalOutstanding = alerts.reduce((s, a) => s + a.outstanding, 0);
    const summaryEntry = await audit("FeeAgent", "scan-complete", null, null,
      `SCANNED ${apps.length} allocations`,
      `Found ${alerts.length} students with overdue fees. Total outstanding: ₹${totalOutstanding}.`
    );

    res.json({ success: true, scanned: apps.length, alerts, totalOutstanding, auditEntry: summaryEntry });
  } catch (err) {
    res.status(500).json({ error: "FeeAgent failed: " + err.message });
  }
});

// ── AGENT 4: ComplaintAgent ───────────────────────────────────────────────────
router.get("/complaint-agent/triage", async (req, res) => {
  try {
    const complaints = await Complaint.find({ status: { $ne: "Resolved" } }).sort({ createdAt: 1 });
    const triage = [];

    const resolutionPlaybooks = {
      High:   { sla: "24 hours", action: "Escalate to warden immediately.", autoEscalate: true  },
      Medium: { sla: "72 hours", action: "Assign to maintenance team.",     autoEscalate: false },
      Low:    { sla: "7 days",   action: "Schedule in next maintenance round.", autoEscalate: false },
    };

    for (const c of complaints) {
      const ageHours = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 3600000);
      const playbook = resolutionPlaybooks[c.priority] || resolutionPlaybooks.Low;
      const slaBreach = (c.priority === "High" && ageHours > 24) ||
                        (c.priority === "Medium" && ageHours > 72) ||
                        (c.priority === "Low" && ageHours > 168);

      const decision = slaBreach || playbook.autoEscalate ? "ESCALATE" : "MONITOR";
      const violations = slaBreach ? [`SLA breach: ${c.priority} complaint open for ${ageHours}h (SLA: ${playbook.sla})`] : [];

      const entry = await audit("ComplaintAgent", "triage", c.studentId, c.room, decision,
        `Complaint: "${c.subject}" | Priority: ${c.priority} | Age: ${ageHours}h | SLA: ${playbook.sla}`,
        violations);

      triage.push({ complaint: c, ageHours, slaBreach, playbook, decision, auditEntry: entry });
    }

    const escalations = triage.filter(t => t.decision === "ESCALATE").length;
    const summaryEntry = await audit("ComplaintAgent", "triage-complete", null, null,
      `TRIAGED ${complaints.length} complaints`,
      `${escalations} require immediate escalation. ${triage.filter(t => t.slaBreach).length} SLA breaches detected.`
    );

    res.json({ success: true, total: complaints.length, escalations, triage, auditEntry: summaryEntry });
  } catch (err) {
    res.status(500).json({ error: "ComplaintAgent failed: " + err.message });
  }
});

// ── AGENT 5: OccupancyAgent ───────────────────────────────────────────────────
router.get("/occupancy-agent/report", async (req, res) => {
  try {
    const [rooms, apps] = await Promise.all([Room.find({}), Application.find({ status: "Approved" })]);

    const total = rooms.length;
    const occupied = rooms.filter(r => r.status === "Occupied").length;
    const available = rooms.filter(r => r.status === "Available").length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const anomalies = [];
    for (const room of rooms.filter(r => r.status === "Occupied")) {
      const hasApp = apps.some(a => a.roomNumber === room.number);
      if (!hasApp) {
        const entry = await audit("OccupancyAgent", "anomaly-detect", null, room.number, "FLAG",
          `Room ${room.number} (Building ${room.building}) marked Occupied but has no approved application.`,
          [`DATA_ANOMALY: Room ${room.number} occupied without matching allocation`]);
        anomalies.push({ room, auditEntry: entry });
      }
    }

    const allocationMismatches = [];
    for (const app of apps) {
      const room = rooms.find(r => r.number === app.roomNumber);
      if (room && room.status !== "Occupied") {
        const entry = await audit("OccupancyAgent", "mismatch-detect", app.studentId, app.roomNumber, "FLAG",
          `Approved application for Room ${app.roomNumber} but room status is ${room.status}.`,
          [`DATA_MISMATCH: Approved app but room not marked Occupied`]);
        allocationMismatches.push({ application: app, room, auditEntry: entry });
      }
    }

    const buildings = {};
    for (const room of rooms) {
      if (!buildings[room.building]) buildings[room.building] = { total: 0, occupied: 0, available: 0 };
      buildings[room.building].total++;
      if (room.status === "Occupied") buildings[room.building].occupied++;
      else buildings[room.building].available++;
    }

    const healthStatus = occupancyRate > 90 ? "critical" : occupancyRate > 75 ? "warning" : "healthy";
    const summaryEntry = await audit("OccupancyAgent", "report", null, null,
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

// ── AUDIT TRAIL (from MongoDB) ────────────────────────────────────────────────
router.get("/audit-trail", async (req, res) => {
  try {
    const { agent, limit = 50 } = req.query;
    const filter = agent ? { agent } : {};
    const entries = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit));
    const total = await AuditLog.countDocuments(filter);
    res.json({ success: true, total, entries });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit trail: " + err.message });
  }
});

// ── RUN ALL AGENTS ────────────────────────────────────────────────────────────
router.post("/run-all", async (req, res) => {
  try {
    await audit("MasterOrchestrator", "full-scan", null, null, "STARTED",
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

    await audit("MasterOrchestrator", "full-scan-complete", null, null,
      totalIssues === 0 ? "ALL_CLEAR" : `${totalIssues} ISSUES FOUND`,
      `Compliance: ${summary.complianceFlagged} flags | Fees: ${summary.feeAlerts} alerts | Complaints: ${summary.complaintEscalations} escalations | Occupancy: ${summary.occupancyAnomalies} anomalies`
    );

    res.json({ success: true, summary, totalIssues, compliance: complianceRes, fees: feeRes, complaints: complaintRes, occupancy: occupancyRes });
  } catch (err) {
    res.status(500).json({ error: "Master scan failed: " + err.message });
  }
});

// ── EDGE CASE 1: Double allocation block ──────────────────────────────────────
router.post("/demo/double-allocation", async (req, res) => {
  try {
    const { studentId = "STU_DEMO_001", studentName = "Riya Sharma" } = req.body;
    const steps = [];

    steps.push({ step: 1, agent: "AllocationAgent", action: "Application request received",
      detail: `Student ${studentName} (${studentId}) requesting accommodation` });

    const existing = await Application.findOne({ studentId, status: { $in: ["Pending", "Approved"] } });

    steps.push({ step: 2, agent: "ComplianceAgent", action: "Checking POLICY:MAX_ROOMS_PER_STUDENT",
      detail: existing
        ? `Active application found. ID: ${existing._id} | Status: ${existing.status}. Policy cap: 1.`
        : "No active application found. Policy satisfied." });

    const isViolation = !!existing;
    const decision = isViolation ? "REJECTED" : "ELIGIBLE";
    const reasoning = isViolation
      ? `POLICY:MAX_ROOMS — Student ${studentId} already has an active ${existing.status} application. Duplicate blocked.`
      : `Student ${studentId} has no active allocations. Eligible to proceed.`;

    const auditEntry = await audit("AllocationAgent", "double-allocation-check", studentId, null, decision, reasoning,
      isViolation ? [`POLICY:MAX_ROOMS — active application exists`] : []);

    steps.push({ step: 3, agent: "AllocationAgent", action: `Decision: ${decision}`, detail: reasoning });
    steps.push({ step: 4, agent: "AuditAgent", action: "Decision persisted to MongoDB", detail: `Audit ID: ${auditEntry.id}` });

    res.json({
      success: true,
      edgeCase: "double-allocation",
      scenario: "Student attempts to apply while already having an active application",
      decision,
      policyTriggered: isViolation ? "POLICY:MAX_ROOMS_PER_STUDENT" : "None",
      steps,
      auditEntry,
      outcome: isViolation
        ? "Application BLOCKED — agent enforced single-room policy and logged violation."
        : "No existing application — student is eligible.",
    });
  } catch (err) {
    res.status(500).json({ error: "Demo failed: " + err.message });
  }
});

// ── EDGE CASE 2: Occupied room approval block ─────────────────────────────────
router.post("/demo/occupied-room-approval", async (req, res) => {
  try {
    const { roomNumber } = req.body;
    const steps = [];

    steps.push({ step: 1, agent: "AllocationAgent", action: "Approval request received",
      detail: `Admin attempting to assign Room ${roomNumber || "(not provided)"}` });

    if (!roomNumber) {
      return res.json({ success: false, message: "Provide roomNumber in body. Example: { roomNumber: '101' }" });
    }

    const room = await Room.findOne({ number: roomNumber });

    steps.push({ step: 2, agent: "ComplianceAgent", action: "Fetching room status from DB",
      detail: room
        ? `Room ${roomNumber} found. Status: ${room.status} | Building: ${room.building} | Type: ${room.type}`
        : `Room ${roomNumber} not found.` });

    if (!room) {
      const auditEntry = await audit("ComplianceAgent", "room-not-found", null, roomNumber, "BLOCKED",
        `Room ${roomNumber} does not exist.`, [`Room ${roomNumber} not found`]);
      return res.json({ success: true, edgeCase: "occupied-room-approval", decision: "BLOCKED", steps, auditEntry, outcome: "Room not found — assignment blocked." });
    }

    const isOccupied = room.status === "Occupied";
    const decision = isOccupied ? "BLOCKED" : "PERMITTED";
    const reasoning = isOccupied
      ? `POLICY:AVAILABILITY — Room ${roomNumber} is Occupied. Double-booking prevented automatically.`
      : `Room ${roomNumber} is Available. Assignment is policy-compliant.`;

    const auditEntry = await audit("ComplianceAgent", "room-availability-check", null, roomNumber, decision, reasoning,
      isOccupied ? [`POLICY:AVAILABILITY — Room ${roomNumber} is Occupied`] : []);

    steps.push({ step: 3, agent: "ComplianceAgent", action: `Decision: ${decision}`, detail: reasoning });
    steps.push({ step: 4, agent: "AuditAgent", action: "Decision persisted to MongoDB", detail: `Audit ID: ${auditEntry.id}` });

    res.json({
      success: true,
      edgeCase: "occupied-room-approval",
      scenario: "Admin tries to assign an already-occupied room to a new student",
      decision,
      room: { number: room.number, status: room.status, building: room.building, type: room.type },
      policyTriggered: isOccupied ? "POLICY:ROOM_AVAILABILITY" : "None",
      steps,
      auditEntry,
      outcome: isOccupied
        ? `Room assignment BLOCKED — agent prevented double-booking of Room ${roomNumber}.`
        : `Room ${roomNumber} is available — assignment permitted.`,
    });
  } catch (err) {
    res.status(500).json({ error: "Demo failed: " + err.message });
  }
});

// ── EDGE CASE 3: SLA breach auto-escalation ───────────────────────────────────
router.post("/demo/sla-breach-escalation", async (req, res) => {
  try {
    const steps = [];

    steps.push({ step: 1, agent: "ComplaintAgent", action: "SLA monitoring scan triggered",
      detail: "Scanning all unresolved complaints for SLA breach" });

    const complaints = await Complaint.find({ status: { $ne: "Resolved" } });
    const now = Date.now();

    const breached = complaints.filter(c => {
      const ageHours = (now - new Date(c.createdAt).getTime()) / 3600000;
      return (c.priority === "High" && ageHours > 24) ||
             (c.priority === "Medium" && ageHours > 72) ||
             (c.priority === "Low" && ageHours > 168);
    });

    steps.push({ step: 2, agent: "ComplaintAgent", action: `SLA scan complete — ${breached.length} breach(es) found`,
      detail: breached.length
        ? breached.map(c => `"${c.subject}" (${c.priority}, ${Math.floor((now - new Date(c.createdAt).getTime()) / 3600000)}h old)`).join(" | ")
        : "All complaints within SLA window." });

    const escalationNotices = [];

    for (const c of breached) {
      const ageHours = Math.floor((now - new Date(c.createdAt).getTime()) / 3600000);
      const slaHours = c.priority === "High" ? 24 : c.priority === "Medium" ? 72 : 168;

      steps.push({ step: steps.length + 1, agent: "ComplaintAgent", action: `Escalating: "${c.subject}"`,
        detail: `Priority: ${c.priority} | Open: ${ageHours}h | SLA: ${slaHours}h | Overdue by: ${ageHours - slaHours}h` });

      const notice = await new Notice({
        title: `AUTO-ESCALATION: ${c.subject}`,
        category: "Urgent",
        content: `SLA BREACH: Complaint "${c.subject}" (Priority: ${c.priority}) from ${c.studentName} in room ${c.room} unresolved for ${ageHours}h. SLA: ${slaHours}h. Overdue by ${ageHours - slaHours}h. Immediate action required.`,
      }).save();

      const auditEntry = await audit("ComplaintAgent", "sla-auto-escalate", c.studentId, c.room, "ESCALATED",
        `Complaint "${c.subject}" open ${ageHours}h vs ${slaHours}h SLA. Notice created (ID: ${notice._id}).`,
        [`SLA_BREACH: ${ageHours - slaHours}h overdue`]);

      steps.push({ step: steps.length + 1, agent: "NoticeAgent", action: "Urgent notice published",
        detail: `Notice ID: ${notice._id} posted to admin board` });

      escalationNotices.push({ complaint: c, ageHours, slaHours, noticeCreated: notice._id, auditEntry });
    }

    steps.push({ step: steps.length + 1, agent: "MasterOrchestrator", action: "Escalation cycle complete",
      detail: `${escalationNotices.length} notice(s) created and logged to audit trail` });

    res.json({
      success: true,
      edgeCase: "sla-breach-escalation",
      scenario: "System detects complaints exceeding SLA window and auto-escalates",
      decision: breached.length > 0 ? "ESCALATED" : "ALL_CLEAR",
      breachesFound: breached.length,
      escalationNotices,
      steps,
      outcome: breached.length > 0
        ? `${breached.length} SLA breach(es) detected. Notices auto-created and published.`
        : "No SLA breaches found — all complaints within SLA window.",
    });
  } catch (err) {
    res.status(500).json({ error: "Demo failed: " + err.message });
  }
});

module.exports = router;