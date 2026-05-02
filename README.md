# Appointment Booking System

A complete appointment booking platform with three roles: **Customer**, **Organiser**, **Admin**.

## Stack
- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** MySQL 8 (InnoDB, transactional)

## Features

### Customer
- Email/password signup with OTP verification (demo OTP returned in API response)
- Forgot password / reset (demo token returned in API response)
- Browse published services
- Booking flow: service → resource → date → real-time slots → capacity → questions → payment → confirmation
- Reschedule (date/time only) and cancel
- Profile: update details, view upcoming/past appointments

### Organiser
- Create/update appointment types (services)
- Set duration, venue, price, taxes
- Add/remove resources or providers
- Add booking questions
- Weekly schedules OR flexible date/time windows
- Booking rules: max bookings per slot, advance payment, manual confirmation, auto/manual assignment
- Publish / unpublish (with shareable link `/services/share/<token>`)
- Visual calendar of bookings
- Reports: total, peak hours, provider utilization

### Admin
- Dashboard (total users, providers, appointments, services)
- View all users
- Activate / deactivate accounts
- Role management
- System-level reports

## Booking Engine Guarantees
- Real-time slot availability (no static JSON)
- Race-safe via MySQL transactions + `SELECT ... FOR UPDATE` on competing booking rows for the same resource/slot
- Capacity enforced at the DB layer in the same transaction as the insert
- Reschedule re-validates the new slot under a fresh lock
- Cancel marks the booking cancelled, freeing capacity for that slot

## Setup

### 1. MySQL
- Install MySQL 8 and start the server
- Create a user with privileges (defaults: `root` / `root`)
- The init script will create the `appointment_app` database

### 2. Backend
```bash
cd backend
cp .env.example .env       # adjust DB credentials if needed
npm install
npm run db:init            # runs schema.sql + seed.sql
npm run dev                # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`.

### Seed accounts (password: `password123`)
- `admin@app.com` (admin)
- `organiser@app.com` (organiser, owns Dental Care + Yoga services)
- `customer@app.com` (customer)
- `watson@app.com` (organiser)

## API Surface

### Auth (`/api/auth`)
- `POST /register` — create user (returns demo OTP)
- `POST /verify-otp` — verify
- `POST /login` — JWT
- `POST /forgot` — start reset (returns demo token)
- `POST /reset` — finish reset
- `GET /me` / `PUT /me`

### Services (`/api/services`)
- `GET /` — public list
- `GET /:id` — detail (resources, questions, schedules)
- `GET /:id/slots?date=YYYY-MM-DD&resource_id=` — real-time slots
- `GET /share/:token` — preview unpublished (share link)
- `GET /mine/list` — organiser-owned services
- `POST /` / `PUT /:id` / `PUT /:id/publish` — manage
- `POST /:id/resources` / `DELETE /:id/resources/:rid`
- `PUT /:id/weekly` / `PUT /:id/flexible` / `PUT /:id/questions`
- `GET /:id/calendar?from=&to=` / `GET /:id/bookings`

### Bookings (`/api/bookings`)
- `GET /mine` — current user's bookings
- `GET /:id` — detail (with answers + payments)
- `POST /` — create booking (transaction-safe)
- `POST /:id/pay` — confirm payment
- `POST /:id/reschedule` — change date/time
- `POST /:id/cancel` — cancel
- `POST /:id/confirm` — organiser/admin manual confirm

### Admin (`/api/admin`)
- `GET /dashboard`, `GET /users`
- `PUT /users/:id/active`, `PUT /users/:id/role`
- `GET /reports` (also for organisers, scoped to their services)

## Project Layout
```
backend/
  db/
    schema.sql           # MySQL schema (FKs, indexes, transaction-safe)
    seed.sql             # demo users + services
  src/
    config/db.js
    controllers/
    services/            # slotService, bookingService (race-safe)
    middlewares/         # auth, error
    routes/
    utils/
    server.js

frontend/
  src/
    api/client.js
    context/AuthContext.jsx
    pages/               # Login, Register, VerifyOtp, Forgot, Reset,
                         # Dashboard, ServiceDetail, BookingFlow,
                         # BookingConfirmed, Payment, Reschedule,
                         # Profile, OrganiserPanel, OrganiserNew,
                         # OrganiserService, AdminPanel
    App.jsx, main.jsx, styles.css
```
