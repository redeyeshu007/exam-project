# Hallocate — E-Exam Hall Allocation System

**Hallocate** is a full-stack web application built for the **Department of Computer Science and Engineering, PSNA College of Engineering & Technology**, to automate examination hall allocation, seating arrangement, and attendance management for departmental examinations.

It replaces the manual, spreadsheet-driven process of assigning students to exam halls with a single guided workflow — from designing a hall's physical bench layout, to allocating students against real capacity, to generating conflict-aware seating charts, to printing the final hall plan and attendance sheets.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Core Workflow](#core-workflow)
- [Security](#security)
- [Developed By](#developed-by)
- [Handover Note](#handover-note)

---

## Overview

Every examination cycle, the department needs to decide **which students sit in which hall, on which bench, next to whom** — while avoiding seating students from the same class or elective next to each other, respecting each hall's actual bench capacity, and producing print-ready hall plans and attendance sheets for invigilators. Hallocate turns this into a repeatable, auditable digital process:

1. **Design** each hall's exact bench layout (Small Bench / Big Bench, row & column position) once, in the Hall Designer.
2. **Plan** an allocation by uploading or entering student lists (by roll range, or by Excel upload for elective-based exams) against those halls.
3. **Generate** a seating arrangement automatically, using a deterministic, conflict-aware seat-filling algorithm.
4. **Review & print** the seating chart, hall plan, and attendance sheet — on screen or as PDF — ready to post outside each exam hall.

## Key Features

- **Hall Designer** — visually build a hall's bench grid (rows × columns), marking each bench as a Small Bench (1 seat) or Big Bench (2 seats, expandable to 3 in labs), saved per hall and reusable across every future exam.
- **Allocation Wizard** — a step-by-step flow to create an allocation: exam details → hall selection → student sections/roll ranges or Excel upload (for elective subjects) → review.
- **Automated Seating Allocation** — a deterministic, greedy seat-filling algorithm that:
  - Sorts students by year → section → roll number, and benches by column/row position.
  - Fills every bench's first seat, then every Big Bench's second seat, then falls back to a second seat on Small Benches only if capacity is needed.
  - In **labs only** (any hall whose name contains "lab"), seats a third student in the middle of an already-full Big Bench rather than leaving anyone unseated.
  - Actively avoids seating two students from the same year (and, for elective exams, the same elective) next to each other wherever possible.
- **Common Exam Groups** — allocations sharing the same exam name, date, and session are automatically grouped, so multiple student batches (e.g. two different years) can be seated together across the same set of halls in a single seating run.
- **Seating Chart** — an interactive, color-coded screen view of every hall's seating, plus a print-optimized layout that correctly renders 1, 2, or 3 occupants per bench.
- **Hall Plan & Attendance Printing** — generates print-ready PDFs per hall: seating charts with invigilator signature blocks, and attendance sheets.
- **History** — browse, reopen, and reprint any past allocation's hall plan or attendance sheet.
- **Admin Authentication** — email/OTP-backed admin login with escalating account lockout (5 / 10 / 15 failed attempts) and automatic suspicious-activity email alerts.
- **Legal & Compliance Pages** — Privacy Policy, Terms & Conditions, and Contact pages, scoped to departmental/institutional use.

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 19, Vite, React Router, Framer Motion, Bootstrap, React-Toastify |
| Backend    | Node.js, Express 5, MongoDB with Mongoose |
| Auth & Security | JWT, bcrypt, Helmet, CORS allow-listing, custom NoSQL-injection sanitization, per-route rate limiting |
| Documents  | react-to-print, html2pdf.js, xlsx (Excel import/export) |
| Email      | Nodemailer (SMTP) for OTP and security alerts |
| Logging    | Winston (structured success/error logs) |

## Project Structure

```
NEWEXAM/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Pages & feature components (Hall Designer, Wizard, Seating Chart, etc.)
│   │   └── ...
│   └── package.json
└── server/                 # Express + MongoDB backend
    ├── config/             # Database connection
    ├── middleware/         # Auth & request middleware
    ├── models/              # Mongoose schemas (Admin, Hall, HallLayout, Allocation, ...)
    ├── routes/              # REST API routes (auth, halls, hall-layouts, allocations, timetable, drafts)
    ├── utils/               # Core logic, including the seat allocation algorithm
    ├── logger.js
    ├── server.js
    └── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB instance (local or Atlas)

### Installation

```bash
# Clone the repository
git clone https://github.com/vijaykasthurik/HALLOCATE-E-EXAM-HALL-SYSTEM.git
cd HALLOCATE-E-EXAM-HALL-SYSTEM

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Configuration

Create a `.env` file inside `server/` and `client/` (see [Environment Variables](#environment-variables) below).

### Running locally

```bash
# Start the backend (from /server)
npm run dev    # or: node server.js

# Start the frontend (from /client, in a separate terminal)
npm run dev
```

The client runs on `http://localhost:5173` by default and talks to the API defined by `VITE_API_URL`.

## Environment Variables

**`server/.env`**

| Variable | Description |
|---|---|
| `PORT` | Port the API server listens on |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign admin auth tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed credentials for the initial admin account |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS` | SMTP settings for OTP and security-alert emails |

**`client/.env`**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

> `.env` files are git-ignored and must never be committed. Rotate any credential that is ever accidentally exposed.

## Core Workflow

```
Hall Designer  →  Allocation Wizard  →  Seating Allotment  →  Seating Chart / Hall Plan / Attendance (screen + print)
   (define             (define who's          (run the                (review & distribute)
   bench layout)        being seated)          algorithm)
```

## Security

- Passwords are hashed with bcrypt; JWTs are signed server-side only.
- Admin login is protected by a dedicated rate limiter plus escalating account lockout, with automatic email alerts on repeated failures.
- CORS is restricted to an explicit allow-list rather than reflecting arbitrary origins.
- All request bodies/params/queries are sanitized against NoSQL-injection payloads.
- Security headers are applied via Helmet on every response.

## Developed By

- **Vijay Kasthuri K**
- **Dinny Paul Navis C**

Handed over to the **Department of Computer Science and Engineering, PSNA College of Engineering & Technology**, for departmental examination administration.

## Handover Note

This project is handed over as a complete, self-contained system for the department's exam cell to operate and maintain. Please retain this README, keep `.env` credentials private and rotated periodically, and route any future feature requests or bug reports through the department's examination cell.

---

<p align="center"><sub>Hallocate — built for the Department of Computer Science and Engineering, PSNA College of Engineering & Technology.</sub></p>
