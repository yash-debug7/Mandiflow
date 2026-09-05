# MandiFlow

**Real-Time Farmer Procurement Slot, Queue & Status Platform**

Built for Smart India Hackathon 2026 · Problem Statement **SIH26032** · Ministry of Consumer Affairs, Food & Public Distribution

🔗 **Live App:** https://mandiflow-dvgp.vercel.app
🔗 **API (Backend):** https://mandiflow.onrender.com/docs

> Note: The backend runs on Render's free tier and may take 20–30 seconds to wake up after inactivity. Open the live app a minute before a demo to warm it up.

---

## The Problem

Farmers arriving at mandi (market) procurement centres today face long, unpredictable wait times with no visibility into queue status, no way to book a slot in advance, and no digital record tied to their payout. This disproportionately affects elderly farmers, those without smartphones, and those with perishable produce.

## The Solution

MandiFlow is an omnichannel slot-booking and live-queue platform that lets **every** farmer — regardless of the device they own — book a procurement slot, track their position in real time, and receive automatic status and payment (DBT) updates.

## Universal 3-Tier Inclusion Framework

| Tier | Who it's for | How it works |
|---|---|---|
| **1. Smartphone Farmers** | Farmers with a smartphone | Full interactive web app (PWA) with digital QR pass, GPS yard routing, a live 5-stage progress bar, and automated DBT tracking |
| **2. Feature / Keypad Phone** | Farmers with a basic phone, no data | Toll-free IVR line (**1800-889-2026**) in Hindi and regional languages; DTMF keypad booking with an SMS gate pass sent on confirmation |
| **3. Zero-Phone Farmers** | Farmers with no phone at all | Village Panchayat CSC / Mandi Gate Sahayak issues a physical thermal barcode slip via Aadhaar/biometric verification; token calls are broadcast over the mandi yard's PA loudspeakers |

## Key Views / Modules

- **Farmer App** — book a procurement centre, produce type, and time slot; generate a token pass
- **Procurement Desk** — official yard operations dashboard: live queue, weigh & grade, DBT payout release, no-show tracking
- **No-Phone Sahayak** — offline terminal for Gram Panchayat staff to register zero-phone farmers and print a physical thermal token slip
- **Gate Kiosk (TV)** — public token/queue display for the mandi yard
- **Ministry Oversight** — aggregated view for monitoring across centres
- **Call-to-Book (IVR)** — simulated + live keypad phone booking flow

## Tech Stack

**Backend** (`/backend`)
- FastAPI (REST + WebSockets)
- Uvicorn (ASGI server)
- aiosqlite (async SQLite persistence)
- Twilio (SMS / WhatsApp notifications — runs in **simulated mode** when no Twilio credentials are configured, so the demo works without live credentials)
- python-dotenv, httpx, pydantic

**Frontend** (`/frontend`)
- Vite + React
- Deployed as a static site on Vercel

**Deployment**
- Backend → Render (Web Service, free tier)
- Frontend → Vercel, configured with `VITE_API_URL` pointing at the Render backend

## API Overview

Full interactive API docs are available live at [`/docs`](https://mandiflow.onrender.com/docs) (Swagger UI). Highlights:

- `GET /api/centres` — list procurement centres
- `GET /api/slots` — list available time slots
- `POST /api/bookings` — create a booking
- `GET /api/bookings` / `GET /api/bookings/{booking_id}` — retrieve bookings
- `POST /api/ivr/voice/welcome`, `/language`, `/menu` — IVR voice flow (Twilio-compatible webhooks)
- `POST /api/ivr/simulator/action` — in-browser IVR simulator used for demos

## Running Locally

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Set `frontend/.env`:
```
VITE_API_URL=http://localhost:8000
```

## Repository Structure

```
Mandiflow/
├── backend/
│   ├── main.py            # FastAPI app, routes, CORS config
│   ├── ivr.py              # IVR / Twilio voice + simulator endpoints
│   ├── database.py         # aiosqlite data layer
│   ├── notifications.py    # SMS/WhatsApp dispatch (Twilio, with simulated fallback)
│   └── requirements.txt
└── frontend/
    ├── src/
    └── vite.config.js
```

---

*Built for Smart India Hackathon 2026 — Problem Statement SIH26032.*
