# SANJEEVANI — Voice-First AI Health Companion

## Current implementation

The application is now a clean JavaScript stack: **Frontend: React + JavaScript + JSX + Vite + CSS**; **Backend: Node.js + Express + JavaScript**; **Database: MongoDB with in-memory fallback**; **Realtime: Socket.io**; **AI: Groq with deterministic safety fallback**; **Speech: Groq Whisper when configured**; **PWA: Service Worker + LocalStorage**.

Run it with `npm install`, `npm --prefix client install`, `npm --prefix server install`, then `npm run dev`. Build with `npm run build`; production preview/start uses `npm start`.

Sanjeevani maintains multilingual voice triage, a fallback tactical map and seeded facility data, simulated SOS dispatch events, and five offline first-aid procedures. It is never a substitute for professional diagnosis or emergency services; call 112 in India (or your local emergency number) for life-threatening symptoms.

# ECHOAID

> **Your Voice. Your Lifeline.**

ECHOAID is an **AI-powered, voice-first healthcare and emergency response platform** developed as a hackathon project. It is designed to make healthcare and emergency assistance more accessible, especially for people in rural, semi-urban, and underserved communities.

The platform enables users to communicate through voice, receive AI-powered symptom guidance and first-aid assistance, discover nearby healthcare services, and quickly access emergency SOS support when every second matters.

---

## 🚀 Problem Statement

During medical emergencies, people may face challenges such as:

* Difficulty explaining symptoms in English
* Lack of immediate medical guidance
* Limited awareness of nearby hospitals and healthcare facilities
* Delays in accessing emergency assistance
* Communication barriers for elderly and non-technical users

ECHOAID aims to reduce these barriers through a simple, accessible, and voice-first experience.

---

## 💡 Our Solution

ECHOAID provides an intelligent healthcare assistance platform that combines:

* 🎙️ Voice-first interaction
* 🤖 AI-powered symptom guidance
* 🩹 Basic first-aid assistance
* 🌐 Multilingual accessibility
* 🏥 Nearby healthcare service discovery
* 🩸 Blood bank discovery
* 🚨 One-tap SOS emergency support

The goal is to help users move quickly from **describing a problem to taking the right action**.

---

## ✨ Key Features

### 🎙️ Voice-First Interaction

Users can communicate naturally using their voice, making the platform easier to use for people who may not be comfortable with typing.

### 🤖 AI Symptom Guidance

AI analyzes user-provided symptoms and provides helpful guidance and possible next steps.

### 🩹 First-Aid Assistance

Provides basic first-aid instructions during emergency situations.

### 🌐 Multilingual Support

Designed to support users in multiple languages and reduce language barriers in healthcare access.

### 🏥 Nearby Healthcare Discovery

Helps users find nearby hospitals, clinics, and other healthcare facilities.

### 🩸 Blood Bank Locator

Assists users in finding relevant blood banks and blood-related emergency services.

### 🚨 Instant SOS Support

Allows users to quickly initiate emergency assistance when immediate help is required.

---

## 🔄 How ECHOAID Works

```text
User Voice Input
       ↓
Voice Processing
       ↓
AI Understanding & Symptom Analysis
       ↓
Healthcare Guidance / First Aid
       ↓
Nearby Hospital / Blood Bank Discovery
       ↓
Emergency SOS Assistance
```

---

## 🛠️ Tech Stack

### Frontend

* React.js
* JavaScript
* HTML5
* CSS3
* Tailwind CSS

### Backend

* Node.js
* Express.js

### AI & APIs

* AI/LLM API
* Speech Recognition API
* Text-to-Speech API
* Maps & Location API

> The final API integrations and technologies may evolve during the hackathon development process.

---

## 🎯 Target Users

* Rural and semi-urban communities
* Elderly users
* Non-English speakers
* Users with limited technical knowledge
* Individuals requiring quick healthcare guidance
* People facing emergency situations

---

## ⚠️ Disclaimer

ECHOAID is designed to provide **general informational guidance and emergency support assistance**. It is **not a replacement for professional medical diagnosis, treatment, or emergency services**.

In case of a serious or life-threatening emergency, users should immediately contact their local emergency services or qualified healthcare professionals.

---

## 🏆 Hackathon Project

ECHOAID is being developed as part of a **hackathon**, where our team is building an innovative solution to improve healthcare accessibility and emergency response through **AI, voice technology, and location-based services**.

---

## 👥 Team

This project is developed by our hackathon team.

> Built with ❤️ for faster, simpler, and more accessible healthcare assistance.

---

# ECHOAID

### **Your Voice. Your Lifeline.**
# SANJEEVANI — Voice-First AI Health Companion

Sanjeevani is a dark, command-centre style health companion for multilingual voice triage, emergency coordination, nearby facilities, and offline first-aid guides. It is designed to remain useful without API keys, a database, browser GPS, a microphone, or Socket.io.

## Architecture

`client/` is a Vite + React + JavaScript PWA. `server/` is an Express + JavaScript API with Socket.io. MongoDB and Groq are optional enhancements; the server uses in-memory storage and rule-based safety triage when they are absent. Voice transcription is disabled unless Groq is configured.

## Features

- English, Hindi and Bengali voice or typed symptom triage
- Conservative Groq-powered triage with a deterministic red-flag fallback
- Groq Whisper transcription when configured; no invented patient speech
- Tactical simulated emergency map with seeded Kolkata hospitals and blood banks
- Confirmed SOS workflow, real-time demo dispatch events, and ambulance ETA
- Five first-aid guides cached in local storage and by service worker
- Responsive dark professional UI with accessibility labels and keyboard focus states

## Install and run

Requires Node.js 20+ and npm.

```bash
npm install
npm --prefix client install
npm --prefix server install
npm run dev
```

Open `http://localhost:5173`. The API is on `http://localhost:5000`.

For production builds, run `npm run build`, then `npm start`. You can also work in either package: `npm --prefix client run dev` or `npm --prefix server run dev`.

## Environment

Copy `server/.env.example` to `server/.env` and set optional values:

```env
PORT=5000
NODE_ENV=development
SERVICE_NAME=sanjeevani-api
LOG_LEVEL=info
MONGODB_URI=
GROQ_API_KEY=
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=
SUPABASE_URL=
SUPABASE_ANON_KEY=
ALLOW_DEMO_AUTH=false
ALLOW_MEMORY_DB=false
RATE_LIMIT_ENABLED=true
TRUST_PROXY=false
```

The Vite client also uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Patient accounts may sign up publicly. Hospital administrators must be created by a trusted project owner and assigned `app_metadata.role = "hospital_admin"`; there is no public admin signup.

Local demo mode can run without MongoDB or Groq. In production, missing MongoDB/Supabase/HTTPS CORS configuration blocks startup; a configured MongoDB failure is reported as unavailable and fails readiness instead of switching to memory. Set `ALLOW_MEMORY_DB=true` only for a deliberate disposable demo. Missing Groq enables deterministic rule-based triage, and voice transcription returns an unavailable response. Demo bearer tokens are only available outside production when Supabase is unconfigured, or when `ALLOW_DEMO_AUTH=true` is explicitly set.

Production requirements, backups, realtime limitations, and the go-live checklist are documented in [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) and [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md).

## API and socket events

- `POST /api/voice/transcribe`
- `POST /api/triage`
- `GET /api/facilities/nearby?latitude=&longitude=&radius=`
- `POST /api/sos`, `GET /api/sos/:id` (anonymous callers must use the one-time `accessToken` from the create response)
- `GET /api/health` (liveness), `GET /api/ready` (configuration and database readiness)
- `GET /api/health-tracker/history?limit=&offset=&includeArchived=`
- `GET /api/health-tracker/plans?limit=&offset=`
- `POST /api/health-tracker/history/:historyId/archive` and `/unarchive`

Socket events are `sos:created`, `sos:update`, and `sos:acknowledged`. Hospital administrators also send `sos:delivery-ack`. Clients must join `sos:<id>` with `{ id, token }` for anonymous alerts, or authenticate as the owner/admin. SOS dispatch is explicitly simulated in this app.

## Offline/PWA

The service worker caches the shell after the first successful load. First-aid content is persisted in local storage, so it remains available offline.

## Safety

Sanjeevani is not a medical diagnostic service and does not replace clinicians or emergency services. For life-threatening symptoms, call 112 (India) or your local emergency number immediately.
