# CrowdFlow — Project Context Document

> **One-line pitch:** A Philippine-based dynamic itinerary planner that builds you a day plan, watches how crowded each spot is, and automatically reroutes you to a similar, emptier place when somewhere gets packed.

**Document status:** Living document — the single source of truth for what we're building and why.
**Last updated:** 2026-06-02
**Build target:** Functional demo (capstone / thesis)
**Context:** Capstone / thesis demo project

> ✅ **Tech stack is now locked and the core app is built.** Frontend (**Next.js**), deployment (**Vercel**), AI (**Google Gemini**), and weather (**OpenWeather**) are all decided and wired. **No database/backend is used** — the deliverable is a **demo** on a single screen, so all data lives in-browser behind a swappable data layer. A real backend could be added later, but it is intentionally out of scope.

---

## 1. The Problem

Popular Philippine tourist destinations (Intramuros, SM Mall of Asia, Kawasan Falls, Boracay, etc.) suffer from **overcrowding during peak hours**. Travelers waste time in long queues and crowded sites, which ruins the experience.

Traditional itinerary planners are **static** — they hand you a fixed schedule and never react to real-world conditions. If your 12pm stop is mobbed, the planner doesn't care.

**CrowdFlow** solves this with a **Dynamic Rerouting Engine**: when a spot exceeds a comfort threshold, the app automatically suggests an interest-aligned, less-crowded alternative nearby — giving a smoother, queue-free experience.

---

## 2. The Core Challenge (and Our Honest Answer)

**There is no free, reliable API that reports real-time crowd levels for Philippine tourist spots.**

- Google Maps *displays* "Popular Times" and live busyness, but **does not expose this through any API**. Developers cannot pull it.
- **BestTime.app** (paid 3rd-party) estimates busyness, but its Philippine coverage is weak — most tourist sites return no data.
- Foursquare / Placer.ai foot-traffic data is paid and US/Western-focused.

This data gap is a **real-world limitation**, and our design is the correct engineering response to it. Instead of one unreliable source, CrowdFlow **estimates** crowd levels by blending three free, explainable signals:

```
Crowd Score (0–100) =
    ( 0.6 × time-of-day popularity curve   (the "smart calendar")
    + 0.4 × recent crowdsourced reports )   (real people tapping a button)
    × weather modifier                       (OpenWeather — sunny/rain adjustment)
```

This works even with zero users (the time curve always returns a value), gets smarter as people report, and every number can be explained to a thesis panel — no black box.

---

## 3. Scope

### In Scope (built)
- **AI Itinerary Generation** — Google Gemini generates a custom day plan from user interests + available hours + city, with automatic fallback to an offline generator.
- **Crowd Estimation** — per-spot crowd score from time-of-day curve + crowdsourced reports + live weather.
- **Crowdsourced Reporting** — a "How crowded is it?" button (Quiet / Busy / Packed); reports update the score live in-session.
- **Dynamic Rerouting Engine** — when a spot's score exceeds the threshold, suggest a nearby, interest-matched, less-crowded alternative; user taps "Swap" to update the plan.
- **Map View** — spots shown on a free Leaflet/OpenStreetMap full-screen map with numbered, color-coded crowd pins.
- **Weather-aware rerouting** — during rain, outdoor scores drop and indoor venues (malls/museums) rise, so the engine steers users indoors.
- **Mobile-first UI** — full-screen map background with a slide-up, minimizable bottom sheet, splash screen, and an in-app crowd-score explainer tooltip.

### Out of Scope (documented as Future Work)
- ❌ User accounts / login — anonymous, in-session only
- ⏭️ **Live GPS "you're here" pin** — planned next feature (browser Geolocation; works once deployed on HTTPS)
- ❌ Google Places live search — we pre-load a curated spot list instead
- ❌ Real-time crowd APIs (BestTime, etc.) — architecture is designed to plug one in later
- ❌ Database / cross-device sync, payments, bookings, multi-day trips, social features

---

## 4. Limitations (for the thesis paper)

- **Data accuracy** — Crowd levels are *estimates*, not sensor-measured truth. Accuracy improves with more user reports.
- **Spot coverage** — Limited to the ~36 pre-loaded Philippine spots in v1, not every location nationwide.
- **Connectivity** — Requires internet for itinerary generation, weather, and rerouting.
- **Crowdsource cold-start** — With few users, the estimate leans almost entirely on the time-of-day model.
- **No persistence** — Reports and itineraries live only in the current browser session (by design — no DB).
- **Privacy compliance** — Any future location tracking must respect the PH Data Privacy Act (RA 10173).

---

## 5. Tech Stack

> Everything below is decided and implemented. AI generation and weather sit behind a swappable data layer with automatic mock fallback, so providers can change without touching the UI.

| Layer | Status | Choice | Why / notes |
|-------|--------|--------|-------------|
| Frontend framework | 🔒 Firm | **Next.js 16 (App Router) + TypeScript + React 19** | Pairs natively with Vercel; API routes host the server-side AI/weather calls. |
| Styling | 🔒 Firm | **Tailwind CSS v4** | Fast UI, no design overhead. |
| Map | 🔒 Firm | **Leaflet + react-leaflet + OpenStreetMap** | Free, no billing, no API key. Loaded client-side only (SSR-incompatible). |
| Deployment | 🔒 Firm | **Vercel** | One-click deploy, free tier, native Next.js support, free HTTPS. |
| Data source | 🔒 Firm | **In-browser mock data behind a swappable `dataService`** | Single-screen demo — no shared/persistent data needed. |
| Backend / DB / Realtime | 🔒 Firm | **None (intentionally out of scope)** | A DB would only add cross-device shared reports, which a single-screen demo never shows. Skipped. |
| AI provider | 🔒 Firm | **Google Gemini (`gemini-2.5-flash`, free tier)** | Server-side `/api/itinerary` route; structured JSON output; retries on transient 429/503; falls back to the offline generator on any error. |
| Weather | 🔒 Firm | **OpenWeather (Current Weather API)** | Server-side `/api/weather` route; live condition + temp; falls back to a sunny default on any error. |

**Key decisions:**
- ✅ **Next.js + Vercel** — framework and deployment.
- ✅ **Swappable data layer** — all data access goes through one interface so the backend/AI can change without touching the UI.
- ✅ **Server-side API keys** — Gemini and OpenWeather are called from server routes; keys never reach the browser.
- ✅ **Graceful fallback everywhere** — the demo can't break even if an external API is down.
- ✅ Skip Google Places, skip database, anonymous sessions.

---

## 6. Architecture Overview

```
                ┌─────────────────────────────┐
   User ───────▶│   Next.js UI (React + TW)   │
                │  - Interest/time/city form  │
                │  - Full-screen Leaflet map  │
                │  - Slide-up itinerary sheet │
                │  - Crowd report button      │
                │  - Swap suggestion banner   │
                └───────────┬─────────────────┘
                            │  (all data via dataService)
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                         ▼
 /api/itinerary        in-browser mock          /api/weather
 → Google Gemini       - 36 PH spots            → OpenWeather
 → ordered plan        - crowd reports          → condition + temp
 (fallback: mock)        (session state)        (fallback: sunny)
                            │
                            ▼
              ┌──────────────────────────────┐
              │   Dynamic Rerouting Engine   │
              │   (pure function)            │
              │  crowdScore(spot, {hour,     │
              │     dayIndex, reports,       │
              │     weather})                │
              │  if score > THRESHOLD (70):  │
              │    find nearest interest-    │
              │    matched spot with         │
              │    score < THRESHOLD         │
              └──────────────────────────────┘
```

The **Rerouting Engine is a pure function** — testable, deterministic, and independent of any flaky external feed. This is the defensible core of the thesis.

---

## 7. The Crowd Score Model (detailed)

Each spot stores a **base popularity curve**: an expected-busyness value (0–100) per hour, per day of week, generated from peak hours via summed Gaussians with a weekend boost.

**Step 1 — Time guess:** Look up the curve for the current weekday + hour.
**Step 2 — Crowdsource:** Average the in-session crowd reports (level 1–5, scaled to 0–100); if none, weight shifts to the time guess.
**Step 3 — Weather modifier:**
- ☀️ Clear → outdoor scores nudge **up**, indoor slightly down
- 🌧️ Rain / ⛈️ storm → outdoor scores drop sharply, indoor venues (malls) rise (everyone moves indoors)

**Weights:** time 0.6, reports 0.4, then × weather modifier, clamped 0–100.

**Final score → color band:**
- 🟢 0–40 — Quiet, go now
- 🟡 41–70 — Filling up
- 🔴 71–100 — Packed → triggers rerouting suggestion

**Threshold (default):** 70. Configurable in `src/lib/crowd.ts` (`CROWD_THRESHOLD`).

---

## 8. Dynamic Rerouting Engine (logic)

```
for each spot in itinerary:
    score = crowdScore(spot, { hour, dayIndex, reports, weather })
    if score > THRESHOLD:
        candidates = spots where:
            category == spot.category OR category ∈ user.interests
            AND not already in the itinerary
            AND distance(spot, candidate) < radius (default 20 km)
            AND crowdScore(candidate, ...) < THRESHOLD
        suggest top candidate (same-category first, then least crowded, then closest)
        → user taps "Swap" → itinerary + map update live
```

Implemented in `src/lib/reroute.ts` (`findAlternative`), using the Haversine `distanceKm` helper in `src/lib/crowd.ts`.

---

## 9. Conceptual Data Model (NOT implemented — reference only)

> ⚠️ There is **no database** in this project. The shapes below are the conceptual schema a future backend would use; today these live as in-memory TypeScript types (`src/types/index.ts`) and mock data (`src/data/spots.ts`).

**Spot** — `id`, `name`, `category`, `city`, `lat`, `lng`, `isIndoor`, `description`, `popularityCurve` (per-day hourly array).
**Itinerary** — `id`, `city`, `interests`, `startHour`, `endHour`, ordered `stops` (spotId + visit hours), `createdAt`.
**CrowdReport** — `id`, `spotId`, `level` (1 quiet – 5 packed), `createdAt`.

---

## 10. Pre-loaded Spots (seed data)

**36 curated real Philippine tourist spots** in `src/data/spots.ts`, hand-tagged with category, lat/lng, city, indoor/outdoor flag, and a generated popularity curve. Spread across Manila, Metro Manila, Tagaytay, Cebu, Bohol, Palawan, Boracay, Vigan, and Baguio. Examples:

| Name | Category | City | Indoor |
|------|----------|------|--------|
| Intramuros | history | Manila | No |
| Fort Santiago | history | Manila | No |
| National Museum | museum | Manila | Yes |
| SM Mall of Asia | shopping | Metro Manila | Yes |
| Magellan's Cross | history | Cebu | No |
| Kawasan Falls | nature | Cebu | No |
| ... (~30 more across the listed cities) | | | |

Curated data guarantees the demo never breaks on a bad API response, and lets us guarantee an overcrowding event fires during the presentation.

---

## 11. Build Status

**Phase A — Frontend with mock data:** ✅ Done
- Scaffold, types, 36-spot dataset, swappable `dataService`
- Interest/time/city form, itinerary cards, Leaflet map with color-coded pins
- `crowdScore` pure function, live "report crowd" updates, rerouting UI + Swap

**Phase B — Real integrations:** ✅ Done
- ✅ Google Gemini wired for AI itinerary generation (server-side, with fallback)
- ✅ OpenWeather wired for the live weather modifier (server-side, with fallback)

**Phase C — UI polish:** ✅ Done
- ✅ Splash screen
- ✅ Full-screen map background with slide-up, minimizable bottom sheet
- ✅ Circular back button
- ✅ Crowd-score explainer tooltip (cards + map popups)

**Phase D — Deployment:** ✅ Done
- Live on Vercel: **https://crowdflowph.vercel.app** (GitHub repo: `peewweee/CrowdFlow-itinerary-planner`; every push to `main` auto-deploys). Env vars set in Vercel.

**Next up (optional):**
- ⏭️ "You're here" live location pin (browser Geolocation; needs the HTTPS Vercel URL)
- ⏭️ PWA polish (manifest + apple-touch-icon) for clean iOS "Add to Home Screen"

---

## 12. Demo Script (for the defense)

1. App opens with the splash screen, then the full-screen map + slide-up planner.
2. Pick interests (history + food) + 9am–5pm in Manila → Gemini builds the itinerary.
3. Show the map + crowd pins; a packed spot shows red.
4. Tap "Packed" on a stop a few times → badge flips red **live** (crowdsourcing).
5. Engine pops a banner: *"Fort Santiago is packed — visit [nearby alternative] instead?"*
6. Tap **Swap** → itinerary + map reroute instantly → **the thesis "wow" moment.**
7. Show weather effect: when a city is rainy (live OpenWeather), outdoor spots drop and the engine favors indoor venues.

---

## 13. Key Talking Points for the Panel

- **"Real-time crowd APIs don't cover Philippine tourist destinations"** — so CrowdFlow combines a popularity-time model + community reports + weather, and is designed to plug into a paid API (e.g. BestTime) later if coverage improves.
- **The rerouting engine is a pure, deterministic function** — testable and explainable, not a black box.
- **The system degrades gracefully** — works with zero users via the time model, improves with each report, and falls back to mocks if any external API fails.
- **Weather-aware rerouting** — during rain, users are guided from outdoor sites to indoor venues, using live OpenWeather data.

---

## 14. Environment / Keys Needed

Set these in `.env.local` for local dev, and in **Vercel → Project → Settings → Environment Variables** for production:

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | Yes (for live AI) | Free from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it, the offline generator is used. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-2.5-flash`. |
| `OPENWEATHER_API_KEY` | Yes (for live weather) | Free from [openweathermap.org](https://home.openweathermap.org/api_keys). New keys take ~1–2 h to activate. Without it, a sunny default is used. |

> No Google Maps key, no Anthropic key, and no Supabase/database credentials are needed — those were intentionally dropped from the design.
