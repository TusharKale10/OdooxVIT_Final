# Schedula — Appointment Booking Platform

A production-grade SaaS-style appointment booking platform with real-time slots,
multi-step booking, payments, subscriptions, credits, and an analytics dashboard.

## Stack
- **Frontend:** React 18 + Vite + React Router + Tailwind CSS + Recharts + Framer Motion + Lucide
- **Backend:** Node.js + Express
- **Database:** MySQL 8 (InnoDB, transactional)

## Roles
- **Customer** — browse & book services
- **Organiser** — create services, manage schedules, confirm bookings
- **Admin** — system-level analytics + user management

## Feature highlights

### Booking flow (strict)
Service → Provider → Date → Slot → Details → Payment → Confirmation

- Real-time slots from `weekly_schedules` or `availability_slots`
- Buffer time between slots
- Capacity-based slots (group / 1-to-1)
- Calendar UI with blocked dates & admin notes
- Race-safe via MySQL transactions + `SELECT ... FOR UPDATE`
- Reschedule re-validates the new slot under a fresh lock
- Cancel marks the booking cancelled and refunds credits used

### Pricing
- Discount codes (% or flat, with min-order, expiry, usage caps)
- Threshold-based tax (only kicks in above `tax_threshold`)
- Schedula credits (1 credit = ₹1; expire after 90 days; 5% back on every paid booking)
- Subscription plans (Silver / Gold / Platinum) with priority booking & multiplier rewards
- Payment methods: Card · UPI · Google Pay (demo gateway)

### Service catalogue
- Six categories: Healthcare, Sports, Counseling, Events, Interviews, Services
- Filter by category, search query, state, city, appointment type, max price
- Personalized recommendations (city-based + top-rated)
- Reviews & ratings with auto-aggregated star average

### Appointment types
- In-person (with venue & city)
- Virtual (auto-generated Google Meet / Zoom link per booking)

### Auth
- Email + password with 6-digit OTP verification
- Phone OTP (request + verify on profile page)
- Forgot password / reset via email token
- JWT session

### UX & UI
- Modern Tailwind SaaS dashboard with sidebar layout
- Animated transitions (Framer Motion)
- Multi-step booking with sticky order summary
- Calendar component with disabled/blocked dates and notes
- Admin dashboard with Recharts (trend area, peak-hour bar, category pie)
- AI chatbot widget on every authenticated page
- Multi-language support (EN / HI / MR) — switchable from topbar

### Notifications
- In-app bell with unread badge & polling
- Email notifications (booking created / rescheduled / cancelled / paid)

### Locations
- India-wide Country → State → District → City tree
- User profile stores city, state for personalized recommendations

## Setup

### 1. MySQL
- Install MySQL 8 (defaults: `root` / no password)
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

Vite proxies `/api/*` to `http://localhost:4000`.

### Seed accounts (password: `password123`)
- `admin@app.com` (admin)
- `organiser@app.com` (organiser, owns Dental Care + Yoga + Hair & Beauty)
- `watson@app.com` (organiser, owns Therapy + Mock Interview)
- `maria@app.com` (organiser, owns Personal Training + Photo Studio)
- `customer@app.com` (customer with Gold subscription, 700 credits)
- `akash@app.com` (customer with 100 credits)

## API surface (selected)

### Auth (`/api/auth`)
- `POST /register` — create user
- `POST /verify-otp` / `POST /resend-otp`
- `POST /login`
- `POST /forgot` / `POST /reset`
- `GET /me` / `PUT /me`
- `POST /phone/send-otp` / `POST /phone/verify-otp`

### Services (`/api/services`)
- `GET /` (filters: `category`, `q`, `city`, `state`, `country`, `appointment_type`, `max_price`)
- `GET /recommended`
- `GET /:id` (resources, questions, weekly, flex, reviews, calendar_notes)
- `GET /:id/slots?date=&resource_id=`
- `GET /share/:token`
- `POST /:id/review`
- (organiser) `GET /mine/list`, `POST /`, `PUT /:id`, `PUT /:id/publish`,
  `POST /:id/resources`, `DELETE /:id/resources/:rid`,
  `PUT /:id/weekly`, `PUT /:id/flexible`,
  `PUT /:id/questions`, `PUT /:id/calendar-notes`,
  `GET /:id/calendar`, `GET /:id/bookings`

### Bookings (`/api/bookings`)
- `GET /mine`, `GET /:id`
- `POST /` — accepts `discount_code`, `credits_to_use`, `purpose`, `booked_for_*`
- `POST /:id/pay` — methods: `card`, `upi`, `google_pay`, …
- `POST /:id/reschedule`, `POST /:id/cancel`
- `POST /:id/confirm` (organiser)

### Categories / Locations
- `GET /api/categories`
- `GET /api/locations` (full tree), `GET /api/locations/search?q=`

### Subscriptions
- `GET /api/subscriptions/plans`
- `GET /api/subscriptions/mine`
- `POST /api/subscriptions/subscribe` { plan_key }
- `POST /api/subscriptions/cancel`

### Credits / Discounts
- `GET /api/credits/me`
- `POST /api/credits/grant` (admin)
- `GET /api/discounts`, `POST /api/discounts/validate` { code, subtotal }

### Notifications / Chat
- `GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`
- `GET /api/chat/history`, `POST /api/chat/send`

### Admin
- `GET /api/admin/dashboard` (stats + 14-day trend + peak hours + category pie + provider util)
- `GET /api/admin/users`, `PUT /api/admin/users/:id/active|role`
- `GET /api/admin/reports`

## Project layout
```
backend/
  db/
    schema.sql           # extended MySQL schema (categories, plans, credits, …)
    seed.sql             # demo users + services + bookings + reviews
  src/
    config/db.js
    controllers/         # auth, services, bookings, admin, categories,
                         # locations, subscriptions, credits, discounts,
                         # notifications, chat
    services/            # slotService, bookingService (race-safe)
    middlewares/
    routes/
    utils/
    server.js

frontend/
  src/
    api/client.js
    components/          # Layout, Calendar, ServiceCard, ChatbotWidget,
                         # AuthShell, PasswordInput
    context/AuthContext.jsx
    i18n.jsx             # EN / HI / MR
    pages/
    styles.css           # Tailwind base
    App.jsx, main.jsx
  tailwind.config.js
  postcss.config.js
```
