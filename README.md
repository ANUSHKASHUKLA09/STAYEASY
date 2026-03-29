# 🏠 Stayo — AI-Powered Student Accommodation System

> **ET AI Hackathon 2026 | PS5: Domain-Specialized AI Agents with Compliance Guardrails**

Stayo is a compliance-aware, multi-agent student accommodation management system that automates the full lifecycle — from room browsing to fee recovery — while enforcing institutional policies at every step and maintaining a full auditable trail of every agent decision.

---

## 🚀 Live Demo

| | |
|---|---|
| 🌐 **Live App** | [stayeasy-production.up.railway.app](https://stayeasy-production.up.railway.app) |
| 🤖 **Admin Panel** | [stayeasy-production.up.railway.app/admin](https://stayeasy-production.up.railway.app/admin) |

> **Quick access:** Press `Ctrl + Shift + A` on any page to open the admin login

---


### Test Student Account (Use this to Sign in!)
- **Student ID:** TEST12
- **Password:** TEST123

> ⚠️ **Note:** New student registration requires OTP verification.
> OTP is printed in the Railway server terminal (demo mode).
> Please use the test account above to directly explore the student dashboard!

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [Agent Architecture](#-agent-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [Agent Details](#-agent-details)
- [Compliance Policy Engine](#-compliance-policy-engine)
- [API Reference](#-api-reference)
- [Impact Model](#-impact-model)
- [Demo Walkthrough](#-demo-walkthrough)

---

## 🎯 Problem Statement

Student hostels in India are managed manually — spreadsheets, WhatsApp messages, physical registers. This leads to:

- **Fee defaults** going undetected for months
- **SLA breaches** on complaints with no accountability
- **Double room allocations** and data inconsistencies
- **Zero audit trail** — no record of who decided what and why
- **Admin overload** — staff spending 15+ hours/week on routine checks AI can handle

**Stayo solves this with 5 domain-specialized AI agents that run automatically, enforce policy, chain to each other, and escalate intelligently — with every decision persisted to MongoDB.**

---

## 💡 Solution Overview

```
Student Browses Buildings → Selects Room Type → Submits Application
         ↓
ComplianceAgent auto-scans (SLA + policy violations)
         ↓
Admin Reviews → Selects specific room → Approves
         ↓
AllocationAgent validates → chains to → FeeAgent (auto-creates fee record)
         ↓
FeeAgent monitors monthly → chains to → NoticeAgent (if overdue)
         ↓
ComplaintAgent triages → chains to → NoticeAgent (if SLA breached)
         ↓
OccupancyAgent detects anomalies → flags → ComplianceAgent
         ↓
All decisions → Persistent Audit Trail (MongoDB, survives restarts)
```

---

## 🏗️ Agent Architecture

### Pipeline

```
📥 Application Submitted
      ↓
🏠 AllocationAgent  ──[APPROVED]───→  💳 FeeAgent        (auto-creates pending fee)
✅ ComplianceAgent  ──[VIOLATION]──→  📢 NoticeAgent     (auto-posts alert to student)
💳 FeeAgent         ──[CRITICAL]───→  📢 NoticeAgent     (urgent payment notice)
⚠️ ComplaintAgent   ──[SLA BREACH]─→  📢 NoticeAgent     (escalation notice)
📊 OccupancyAgent   ──[ANOMALY]────→  ✅ ComplianceAgent (flags for follow-up)
Any Agent           ──[LOW CONF.]──→  👤 HumanReview     (escalates when uncertain)
      ↓
📋 Persistent Audit Trail (MongoDB — indexed, queryable, survives restarts)
```

### MasterOrchestrator

Runs all 5 agents in parallel via `Promise.all()`, aggregates results, writes a master summary to the audit trail. One click = full system health check.

---

## ✨ Features

### Student Side
- 🏢 Browse buildings (one card per building, not one per room)
- 🔍 Filter by city and room type (Single / Double / Triple / Suite)
- 📝 Apply by selecting room type — admin allocates the specific room on approval
- 💳 Pay fees via UPI simulation
- ⚠️ Submit complaints with priority levels
- 📢 View notice board and compliance alerts
- 🤖 **AI Room Recommender** — Enter budget, room type, floor preference, 
  lifestyle and amenities — Groq LLaMA finds best matching rooms
- 💰 **ML Price Predictor** — Predicts fair rent based on room type, 
  building, floor, capacity and amenities
- 🤝 **Roommate Compatibility Matcher** — Matches based on sleep schedule, 
  study habits, cleanliness, noise level, social level, diet and guest policy
- 💬 **AI Chatbot** — Answers hostel queries powered by Groq LLaMA

### Admin Side
- 🏢 Rooms grouped by building with full room table inside each
- 👥 Student management
- 📋 Applications — select and assign a specific room when approving
- ✅ AI Agent Control Center (PS5 core feature)
- 💰 Fee recording and tracking
- 📢 Notice board management
- 📊 Dashboard with live stats

### AI Agent Control Center
- 🛡️ Active Compliance Guardrails banner (6 rules visible)
- ⚡ MasterOrchestrator — run all agents in one click
- 🔄 Agent pipeline visualization diagram
- 📋 Live Audit Trail — persistent, filterable by agent/student
- Per-agent result cards with reasoning and chaining info shown

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla JS, HTML5, CSS3 — Single Page Application |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **AI / LLM** | Groq API (LLaMA 3.3 70B) |
| **Auth** | JWT + bcryptjs + OTP email verification |
| **Agents** | Custom domain-specific multi-agent framework |
| **Audit Trail** | MongoDB AuditLog collection (persistent + indexed) |
| **Deployment** | Railway |
| **Payments** | UPI simulation (Razorpay-ready for production) |

---

## 📁 Project Structure

```
stayo/
├── server.js                  # Express entry point
├── package.json
├── .env                       # Environment variables (not committed)
│
├── models/
│   ├── Student.js             # OTP auth, bcrypt password hashing
│   ├── Room.js                # Building, floor, type, amenities, status
│   ├── Application.js         # Preferences at apply time, room assigned on approval
│   ├── AuditLog.js            # ★ Persistent agent audit trail
│   └── Other.js               # Complaint, Fee, Notice schemas
│
├── routes/
│   ├── admin.js               # Admin JWT login
│   ├── students.js            # Register, login, OTP verify, forgot password
│   ├── rooms.js               # Room CRUD
│   ├── applications.js        # Apply (type only) → Admin assigns room on approve
│   ├── complaints.js          # Complaint CRUD + status update
│   ├── fees.js                # Fee records CRUD
│   ├── notices.js             # Notice board CRUD
│   ├── payments.js            # UPI payment simulation
│   ├── agents.js              # ★ All 5 AI agents + MasterOrchestrator
│   └── ai.js                  # Groq: room recommender, chatbot, roommate matcher
│
└── public/
    └── index.html             # Complete single-page frontend (student + admin)
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Groq API key — free at [console.groq.com](https://console.groq.com)

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/stayo.git
cd stayo
```

### 2. Install

```bash
npm install
```

### 3. Configure `.env`

```bash
cp .env.example .env
# Fill in your values
```

### 4. Run

```bash
npm run dev     # development (nodemon)
npm start       # production
```

### 5. Open

```
http://localhost:3000           # Student app
http://localhost:3000/admin     # Admin panel
# Or press Ctrl+Shift+A anywhere on the page
```

---

## 🔑 Demo Access

**Live App:** https://stayeasy-production.up.railway.app   


**Admin Panel:** https://stayeasy-production.up.railway.app/admin



**Admin Password:** admin123


**Quick Access:** Press Ctrl+Shift+A on any page

## 🔐 Environment Variables

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/stayo
# Atlas: mongodb+srv://username:password@cluster.mongodb.net/stayo

# Server
PORT=3000

# Auth
JWT_SECRET=your_long_random_secret_here

# Admin
ADMIN_PASSWORD=your_admin_password

# Groq AI — free at console.groq.com
GROQ_API_KEY=gsk_your_groq_api_key_here

# Email (optional — OTP prints to terminal in demo mode)
# RESEND_API_KEY=re_your_resend_key_here
```

---

## 🤖 Agent Details

### 1. 🏠 AllocationAgent
**`POST /api/agents/allocation-agent/validate`**

Validates a student-room pair against all policy rules before admin approves.

**Checks:** Student exists and is verified · Room is Available · Max 1 room per student · Price within cap for type

**Edge cases handled:**
- Student not found → `REJECTED` + `ENTITY:STUDENT_NOT_FOUND`
- Room not found → `REJECTED` + `ENTITY:ROOM_NOT_FOUND`
- Confidence < 70% → `ESCALATE_TO_HUMAN` (never guesses)

**Chaining:** On `APPROVED` → triggers **FeeAgent** to auto-create pending fee record for current month

---

### 2. ✅ ComplianceAgent
**`GET /api/agents/compliance-agent/scan`**

Scans ALL pending applications for policy violations and SLA breaches without human trigger.

**Detects:** Applications pending > 5 days · Duplicate active applications · Policy-violating prices

**Chaining:** On `VIOLATION` → triggers **NoticeAgent** to post urgent alert to student

---

### 3. 💳 FeeAgent
**`GET /api/agents/fee-agent/scan`**

Detects missing payments by comparing expected monthly payments vs actual fee records. Calculates exact outstanding per student.

| Severity | Condition | Action |
|---|---|---|
| `info` | Current month unpaid | ALERT |
| `warning` | 1–2 months overdue | ALERT |
| `critical` | 3+ months overdue | ESCALATE |

**Chaining:** On `CRITICAL` → triggers **NoticeAgent** to post urgent payment notice

---

### 4. ⚠️ ComplaintAgent
**`GET /api/agents/complaint-agent/triage`**

Triages all open complaints by priority and SLA. Auto-escalates breaches. Generates resolution playbooks.

| Priority | SLA | Auto-Escalate |
|---|---|---|
| High | 24 hours | ✅ Yes |
| Medium | 72 hours | ❌ No |
| Low | 7 days | ❌ No |

**Edge cases:** Unknown priority → `ESCALATE_TO_HUMAN` (refuses to apply wrong SLA)

**Chaining:** On `SLA BREACH` → triggers **NoticeAgent** with escalation notice to student

---

### 5. 📊 OccupancyAgent
**`GET /api/agents/occupancy-agent/report`**

Monitors real-time occupancy. Detects two types of data anomalies automatically.

| Anomaly | Condition | Response |
|---|---|---|
| `DATA_ANOMALY` | Room = Occupied, no approved application | FLAG + chain to ComplianceAgent |
| `DATA_MISMATCH` | Application approved, room still Available | FLAG + chain to ComplianceAgent |

**Health:** > 90% → 🔴 CRITICAL · > 75% → 🟡 WARNING · ≤ 75% → 🟢 HEALTHY

**Edge case:** Zero rooms in DB → `ESCALATE_TO_HUMAN` (possible data integrity issue)

---

### 6. ⚡ MasterOrchestrator
**`POST /api/agents/run-all`**

Runs all 5 agents in parallel. Aggregates results. Writes summary entry to audit trail.

---

## 🛡️ Compliance Policy Engine

Central `enforcePolicy()` function — called by AllocationAgent and ComplianceAgent:

```javascript
const POLICY = {
  maxRoomsPerStudent:        1,
  priceCapPerType: {
    Single: 30000,   // Max ₹30,000/mo
    Double: 20000,   // Max ₹20,000/mo
    Triple: 15000,   // Max ₹15,000/mo
    Suite:  50000,   // Max ₹50,000/mo
  },
  overdueGraceDays:          7,    // 7-day grace period
  maxPendingDaysBeforeAlert: 5,    // SLA: review within 5 days
  minConfidenceThreshold:    0.7,  // Below 70% → ESCALATE_TO_HUMAN
};
```

**Confidence scoring** — agents reduce their own confidence on ambiguous inputs:
```
Unverified student email  →  -0.20 confidence
Unknown room type          →  -0.15 confidence
Score below 0.70           →  ESCALATE_TO_HUMAN (never guesses)
```

---

## 📡 API Reference

### Agent Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agents/allocation-agent/validate` | Validate student + room |
| `GET` | `/api/agents/compliance-agent/scan` | Scan pending applications |
| `GET` | `/api/agents/fee-agent/scan` | Detect overdue fees |
| `GET` | `/api/agents/complaint-agent/triage` | Triage complaints |
| `GET` | `/api/agents/occupancy-agent/report` | Occupancy + anomalies |
| `POST` | `/api/agents/run-all` | Run all (MasterOrchestrator) |
| `GET` | `/api/agents/audit-trail` | Query audit log |

**Audit trail filters:**
```
?agent=FeeAgent        filter by agent name
?studentId=STU001      filter by student
?limit=20              limit results
```

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/students/register` | Register + send OTP |
| `POST` | `/api/students/verify-otp` | Verify OTP → JWT |
| `POST` | `/api/students/login` | Password login |
| `GET` | `/api/rooms` | All rooms |
| `POST` | `/api/applications` | Submit application |
| `PATCH` | `/api/applications/:id` | Approve (with roomId) or Reject |
| `DELETE` | `/api/applications/:id` | Delete (frees room if approved) |
| `GET` | `/api/fees` | Fee records |
| `POST` | `/api/fees` | Record payment |
| `GET` | `/api/complaints` | All complaints |
| `POST` | `/api/complaints` | Submit complaint |
| `PATCH` | `/api/complaints/:id/status` | Update status |
| `GET` | `/api/notices` | All notices |
| `POST` | `/api/notices` | Post notice |
| `POST` | `/api/payments/create-order` | Generate UPI order |
| `POST` | `/api/payments/verify` | Verify + record payment |

---

## 📊 Impact Model

**Base case: 1 hostel · 200 students · 2 admin staff @ ₹25,000/month**

| Agent | Problem Solved | Annual Impact |
|---|---|---|
| AllocationAgent | 20 min/application → instant | ₹10,452 saved |
| ComplianceAgent | 2 hrs/week manual review → 0 | ₹16,224 saved |
| FeeAgent | 72% → 88% collection rate | ₹2,56,000 recovered |
| ComplaintAgent | 4.2 days → <24hr resolution | ₹7,68,000 retention |
| OccupancyAgent | Ghost rooms undetected | ₹24,000 recovered |
| Admin time (all) | 352 hrs/year → automated | ₹54,912 saved |
| **TOTAL** | | **₹11,02,912/year** |

### National Scale

| Deployment | Hostels | Annual Impact |
|---|---|---|
| Single hostel | 1 | ₹11 Lakhs |
| City cluster | 10 | ₹1.1 Crore |
| State level | 100 | ₹11 Crore |
| National SaaS | 1,000 | ₹110 Crore |

---

## 🎬 Demo Walkthrough

**0:00 – 0:30 | The Problem**
> "2 crore students in Indian hostels — all managed on spreadsheets. Fee defaults, missed SLAs, zero audit trail. We built Stayo."

**0:30 – 1:30 | Live Demo**
1. Open [stayeasy-production.up.railway.app](https://stayeasy-production.up.railway.app)
2. Show building cards — "One building, one card — shows all available room types and prices"
3. Click Apply → 2-step modal — "Student picks type, admin allocates the exact room"
4. Go to Admin → AI Agents
5. Click **Run All Agents** — stats populate live
6. Point to FeeAgent — "Detected outstanding dues automatically, without anyone asking"
7. Point to ComplaintAgent — "SLA breached, auto-escalated, notice sent to student"
8. Show Audit Trail — "Every decision in MongoDB — this is still here after a server restart"

**1:30 – 2:30 | Architecture**
1. Point to the pipeline diagram
2. "AllocationAgent approves → FeeAgent is automatically triggered → pending fee created"
3. "If agent confidence drops below 70%, it says ESCALATE_TO_HUMAN. It never guesses."
4. "6 compliance rules enforced on every allocation — no human can bypass them"

**2:30 – 3:00 | Impact**
> "₹11 Lakhs saved per hostel per year. 1000 hostels — ₹110 Crore. Full math in our architecture document."

---

## 📦 Key Dependencies

```json
{
  "express": "^4.22.1",
  "mongoose": "^7.8.9",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.3",
  "groq-sdk": "^1.1.2",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5",
  "nodemon": "^3.0.1"
}
```

---

## 👥 Team

Built for **ET AI Hackathon 2026**
Track: **PS5 — Domain-Specialized AI Agents with Compliance Guardrails**
Knowledge Partner: **Avataar.ai**

---

*"We didn't just build a hostel app. We built a compliance-enforcing, self-auditing, multi-agent system that could run a hostel autonomously."*
