# Schedula

**Booking trusted services shouldn't take five emails and a phone call.**
Schedula is an appointment-booking platform we built for the **VIT × Odoo Hackathon 2026** — a single place to discover providers, see real availability, and lock in a slot in under a minute. Healthcare, sports, counseling, events, mock interviews, virtual sessions — all running on the same flow.

It is *not* yet another calendar widget glued to a payment button. It's a full SaaS-style product: customers, organisers, and admins each get their own surface; bookings are race-safe under load; payments verify on the server with HMAC; credits, discounts, subscriptions and locations all compose into the price you actually pay.

---

## Watch it before you read it

Two short videos — these are the fastest way to see what we built:

> ### 📺 Demo / solution walkthrough
> **<https://drive.google.com/file/d/1t904ag11pgaV6CiDPxbMl0djOYP5WqXm/view?usp=drive_link>**
>
> A guided run-through of the booking flow end-to-end: discovering a service, picking a slot, paying, confirming, and reviewing.

> ### 📺 Schedula platform walkthrough
> **<https://drive.google.com/file/d/16iv33VRchUstvMA7w2nEdvjQM2TFTmdE/view?usp=sharing>**
>
> The wider platform tour — customer dashboard, organiser console, admin analytics, feedback feed, and the multi-tier subscription system.

If you only have two minutes, watch the first one. If you have five, watch both.

---

## Why we built it the way we did

Every appointment platform we used as students did one of two things badly:

1. **It lied about availability.** Slots showed open, then a human had to "confirm" them later by email.
2. **It buried the friction.** Fees showed up after you'd already entered a phone number; reschedules required calling.

So we kept three rules in mind while building Schedula:

- **What you see is what's bookable.** The grid only renders slots you can actually take. Booked slots aren't greyed out — they're hidden. The colour you see is the truth: 🟢 available, ⚫ selected, 🟡 premium-only.
- **Money is honest from step one.** Subtotal, GST, discount, credits and total are visible the moment you reach Details. No surprises on the payment screen.
- **Everything is reversible.** Cancel returns credits. Reschedule re-validates availability under a database lock. Reviews and profile pictures are editable. Bookings have an audit trail.

Those rules drove most of the architectural choices below.

---

## What's inside

### Three roles, three experiences

| Role | What they do |
|---|---|
| **Customer** | Discover services, book in 7 steps, pay, reschedule, cancel, leave reviews, manage credits & subscription, save favourites |
| **Organiser** | Create services, set weekly schedules or flexible windows, configure capacity / buffer / advance-payment rules, see calendar of bookings, manage virtual meeting links |
| **Admin** | System-wide analytics (14-day booking trends, peak hours, category mix, provider utilisation), user management, customer feedback feed |

### The booking flow (the heart of the app)

```
Service → Provider → Date → Slot → Details → Payment → Confirmation
```

- Slots are computed from `weekly_schedules` (recurring) **or** `availability_slots` (flexible windows) — never both at once
- Every slot calculation runs through `slotService.js` and respects **buffer time**, **capacity**, **calendar notes** (admin can mark a date "blocked"), and the user's **subscription tier** (Silver members can book within 14 days, Gold within 30, Platinum unlimited)
- Slot creation is **race-safe**: the booking insert sits inside a MySQL transaction with `SELECT … FOR UPDATE` on the resource and the slot row, so two customers tapping the same time at the same instant cannot both win
- Reschedules go through the *same* lock. Cancellation refunds credits used on the booking automatically.

### Pricing engine (everything composes correctly)

- **Discount codes** — percentage or flat, with min-order, expiry, total / per-user usage caps
- **Threshold-based GST** — only applies once subtotal exceeds the service's `tax_threshold`
- **Schedula credits** — 1 credit = ₹1; you earn 5% on every paid booking (2× as Gold, 5× as Platinum); capped at 50% of the order; expire 90 days from issue
- **Subscriptions** — Silver (free), Gold (₹299/mo), Platinum (₹799/mo); unlock priority slots, longer booking horizons, free reschedules and reward multipliers

The four stack in a deterministic order: `subtotal → minus discount → plus tax → minus credits = total`. No mystery in the math.

### Payments (mock by default, live with one env edit)

- Out of the box, the app runs in **demo mode** — full booking flow, no real charge, marked clearly with a yellow pill
- Drop `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` into `backend/.env`, restart, and the same flow now goes through live Razorpay checkout (Card · UPI · Net Banking · Wallets)
- Verification is HMAC-SHA256 on the server. A booking is **never** marked paid unless the signature checks out. Full setup walkthrough lives in [`RAZORPAY_SETUP.md`](./RAZORPAY_SETUP.md).
- A separate UPI QR path is always available for live demos — scan with any UPI app, the backend records the reference, and the booking flips to confirmed.

### Feedback that actually shows up

Reviews on Schedula aren't write-only. Once you submit one:

- It appears in **your profile** under "My feedback" — sortable by latest or highest rated, with a link back to the service and the booking
- It appears in the **admin feedback feed** — every review across the platform, with star rating, customer info, comment, and source booking. Admin can sort latest / highest rated.
- It bumps the **service's aggregate star rating** (auto-recomputed from `AVG(rating)` on every submit)

The user-facing review form is in `BookingConfirmed.jsx` — once your booking status is `completed`, a "Leave review" button appears.

### Profiles you can actually customise

- Editable full name, phone (with OTP verification), avatar
- **Profile picture upload** — click the avatar tile, pick an image (≤ 4 MB, PNG/JPG/WebP/GIF/SVG). Stored as a `MEDIUMBLOB` row in `uploaded_images` (no writable filesystem needed for deployment) and served via `/uploads/<filename>`.
- Sections for upcoming bookings, past bookings, submitted feedback, and credits balance — all live, all refresh on focus

### Service catalogue

- Six top-level categories: Healthcare · Sports · Counseling · Events · Interviews · Services
- Filter by category, free-text search, country / state / city, appointment type, max price
- "Near me" geolocation snaps state/city using the closest seeded city
- Personalized recommendations — top-rated near the user's stored city, falling back to platform-wide

### Appointment types

- **In-person** — service has a venue + city
- **Virtual** — auto-generated meeting link per booking (Jitsi by default, also supports the organiser's Meet/Zoom URL). Customers see a "Join virtual meeting" button that becomes active 5 minutes before the start.

### Auth (defensive by default)

- Email + password with 6-digit OTP email verification
- Phone OTP for SMS reminders (logged server-side in demo mode)
- Forgot-password / reset via signed email token
- Generic responses for forgot/email-lookup paths so attackers can't enumerate accounts
- JWT session with bcrypt-hashed passwords

### UX & UI (the recent overhaul)

- Editorial design system — Plus Jakarta Sans display, Fraunces serif italic accents, Inter body
- Warm cream canvas (`ink-50` is `#faf9f5`), refined indigo `brand`, warm coral `accent`, sage `success` palettes
- Mobbin-inspired clean cards (image-on-top, white panel below, subtle borders, no heavy gradient overlays) and SimplyBook-inspired booking flow polish (progress strip, sage-tinted slot grid)
- Framer Motion route transitions, marquee for recommended services, animated FAQ accordion
- Recharts admin dashboard — area chart for 14-day trends, bar chart for peak hours, pie chart for category mix
- Multi-language switcher — English · हिन्दी · मराठी
- AI chatbot widget (bottom-right on every authenticated page)
- Mobile bottom-nav, collapsible sidebar, paper-grade backdrop-blur topbar

### Notifications

- In-app bell with unread badge, polled every 30 s, dismissible per-item
- Email on every state transition (booking created · rescheduled · cancelled · paid)

### Locations

- India-wide Country → State → District → City tree (seeded)
- `GET /api/locations/nearest?lat=&lng=` returns the closest seeded city by haversine

---

## Tech stack

**Frontend**
React 18 · Vite · React Router v6 · Tailwind CSS 3 · Framer Motion · Recharts · Lucide icons · canvas-confetti · qrcode.react

**Backend**
Node.js · Express · MySQL 8 (InnoDB, transactional) · mysql2 · bcryptjs · jsonwebtoken · multer · nodemailer · razorpay · uuid

**Database**
MySQL 8 — explicit schema with foreign keys, named indexes, and a forward-compatible migrations folder

---

## Setup

You'll need: **Node 18+**, **MySQL 8** running locally, and a terminal.

### 1. MySQL

Install MySQL 8 (defaults: `root`, no password). The init script creates the `appointment_app` database and seeds it with realistic demo data.

### 2. Backend

```bash
cd backend
cp .env.example .env       # adjust DB credentials if your MySQL isn't password-less root
npm install
npm run db:init            # runs schema.sql + seed.sql
npm run dev                # http://localhost:4000
```

If you already have the DB and just want to apply the latest migration (e.g., the `avatar_url` column added recently):

```bash
mysql appointment_app < db/migrations/001_add_avatar_url.sql
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Vite proxies `/api/*` to `http://localhost:4000`, so the two run side-by-side without CORS gymnastics.

### Seed accounts

All passwords are `password123`.

| Email | Role | Notes |
|---|---|---|
| `admin@app.com` | admin | full system access |
| `organiser@app.com` | organiser | owns Dental Care, Yoga, Hair & Beauty |
| `watson@app.com` | organiser | owns Therapy, Mock Interview |
| `maria@app.com` | organiser | owns Personal Training, Photo Studio |
| `customer@app.com` | customer | Gold subscription, 700 credits |
| `akash@app.com` | customer | 100 credits, no subscription |

---

## Project layout

```
backend/
  db/
    schema.sql              # extended MySQL schema (categories, plans, credits, …)
    seed.sql                # demo users, services, bookings, reviews
    migrations/
      001_add_avatar_url.sql
  scripts/
    seedLarge.js            # 200+ services for stress-testing UI
    trimServices.js
    fixMeetingLinks.js
  src/
    config/db.js
    controllers/            # auth · services · bookings · payment · admin
                            # categories · locations · subscriptions · credits
                            # discounts · notifications · chat · upload · saved
    services/               # slotService · bookingService · reminderService
                            # mailer · emailTemplates       (race-safe core)
    middlewares/            # auth · error · multer (upload)
    routes/                 # one router per resource
    utils/                  # asyncHandler · initDb · jwt
    server.js

frontend/
  src/
    api/client.js           # tiny fetch wrapper (auth header, JSON, multipart)
    components/             # Layout · Calendar · ServiceCard · ChatbotWidget
                            # AuthShell · PasswordInput · ImageUploader
                            # SearchAutocomplete · MobileBottomNav
                            # FaqSection · UpcomingMeetingBanner
                            # JoinMeetingButton · UpiQrModal · Toast · Field
    context/AuthContext.jsx
    data/categories.js
    pages/                  # Login / Register / VerifyOtp / Forgot / Reset
                            # Dashboard / SearchPage / ServicesPage / ServiceDetail
                            # BookingFlow / Payment / BookingConfirmed / Reschedule
                            # Profile / Plans / Credits / Saved
                            # OrganiserPanel / OrganiserService / OrganiserNew
                            # OrganiserMeetings / AdminPanel
    styles/
      category.css          # category-card hover/animation primitives
    utils/                  # format · validators · razorpay · serviceVisuals
    styles.css              # Tailwind base + design tokens
    App.jsx · main.jsx
  tailwind.config.js
  postcss.config.js
  index.html
```

---

## API surface (selected)

### Auth (`/api/auth`)
`POST /register` · `POST /verify-otp` · `POST /resend-otp` · `POST /login`
`POST /forgot` · `POST /reset` · `GET /me` · `PUT /me` (now accepts `avatar_url`)
`POST /phone/send-otp` · `POST /phone/verify-otp`

### Services (`/api/services`)
`GET /` (filters: `category`, `q`, `city`, `state`, `country`, `appointment_type`, `max_price`) · `GET /search` · `GET /recommended`
`GET /reviews/mine?sort=latest|highest` *(new — current user's submitted reviews)*
`GET /:id` (resources, questions, weekly, flex, reviews, calendar_notes) · `GET /:id/slots?date=&resource_id=` · `GET /share/:token` · `POST /:id/review`

**Organiser-only:** `GET /mine/list` · `POST /` · `PUT /:id` · `DELETE /:id` · `PUT /:id/publish`
`POST /:id/resources` · `DELETE /:id/resources/:rid` · `PUT /:id/weekly` · `PUT /:id/flexible`
`PUT /:id/questions` · `PUT /:id/calendar-notes` · `GET /:id/calendar` · `GET /:id/bookings`

### Bookings (`/api/bookings`)
`GET /mine` · `GET /:id` · `POST /` (accepts `discount_code`, `credits_to_use`, `purpose`, `booked_for_*`) · `POST /:id/reschedule` · `POST /:id/cancel` · `POST /:id/confirm` (organiser)

### Payment (`/api/payment`)
`GET /config` · `POST /create-order` · `POST /verify` · `POST /fail` · `POST /upi-confirm`

### Subscriptions / Credits / Discounts
`GET /api/subscriptions/plans` · `GET /api/subscriptions/mine` · `POST /api/subscriptions/subscribe` · `POST /api/subscriptions/cancel`
`GET /api/credits/me` · `POST /api/credits/grant` (admin)
`GET /api/discounts` · `POST /api/discounts/validate`

### Categories / Locations / Saved
`GET /api/categories`
`GET /api/locations` (full tree) · `GET /api/locations/search?q=` · `GET /api/locations/nearest?lat=&lng=`
`GET /api/saved` · `GET /api/saved/ids` · `POST /api/saved/:serviceId` · `DELETE /api/saved/:serviceId`

### Notifications / Chat / Uploads
`GET /api/notifications` · `PUT /api/notifications/:id/read` · `PUT /api/notifications/read-all` · `DELETE /api/notifications` · `DELETE /api/notifications/:id`
`GET /api/chat/history` · `POST /api/chat/send`
`POST /api/uploads` (multipart, ≤ 4 MB images) · `GET /uploads/:filename`

### Admin (`/api/admin`)
`GET /dashboard` (stats + 14-day trend + peak hours + category pie + provider utilisation)
`GET /users` · `PUT /users/:id/active` · `PUT /users/:id/role`
`GET /reviews?sort=latest|highest&service_id=&limit=` *(new — full feedback feed)*
`GET /reports`

---

## Things we're proud of

- **Race-safety isn't a footnote.** `bookingService.js` runs every booking under a transaction with row-level locks. Two users hitting "Confirm" on the same slot at the same millisecond will see exactly one win and exactly one error — never two confirmed bookings for the same chair at the same time.
- **The slot grid tells the truth.** A slot is rendered if and only if it's bookable now (or unlockable via subscription upgrade). Booked, blocked, beyond-horizon — all hidden, never just greyed out. The colour legend (Available / Selected / Premium-only) is built into the UI.
- **Payments fail safe.** Even in demo mode the path through `payment/create-order → checkout → payment/verify` is identical to live. The HMAC verification is the *only* path that flips a booking to paid. Cancelled modals call `payment/fail` so orphaned pending rows are cleaned up.
- **Feedback is end-to-end.** A customer leaves a review on `BookingConfirmed`; it shows up immediately in their profile, in the admin feedback feed, and in the service's aggregate rating. Admins can sort by latest or highest rated.
- **Multi-language without the bloat.** EN / HI / MR are toggled from a single context, with translation keys grouped by surface. No i18n library — just a tiny `useTranslation()` hook.
- **The design system pays for itself.** Custom Tailwind tokens (`ink`, `brand`, `accent`, `sage`), reusable component classes (`.card`, `.btn-primary`, `.eyebrow`, `.section-title`), Plus Jakarta + Fraunces for editorial type. Every page uses the same 8 primitives — the result feels intentional rather than slapped together.

---

## What's next (if we keep going)

- A reminder pipeline that actually sends SMS (currently logged-only)
- Calendar sync (.ics export → push to Google Calendar / Apple Calendar)
- Provider-side messaging (extend the existing chat to be 1-to-1 instead of just bot)
- Per-service availability heatmap on the organiser console
- A second tax model (per-line items rather than threshold-based) for hybrid services

---

## Built with care for the VIT × Odoo Hackathon 2026

Made by a team that genuinely got tired of phone-confirming dentist appointments. If you find a bug, treat it as feedback — open the in-app chat, drop a review, or just push a fix.
