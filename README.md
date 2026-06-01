# CrowdFlow 🧭

**A dynamic, crowd-aware itinerary planner for the Philippines.**

CrowdFlow builds you a day plan, estimates how crowded each spot is, and automatically reroutes you to a similar but emptier place when somewhere gets packed — so you skip the queues and enjoy the trip.

### 🔗 Live app: **[crowdflowph.vercel.app](https://crowdflowph.vercel.app)**

> Capstone / thesis demo project. For the full design rationale, see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).

---

## ✨ Features

- **AI itinerary generation** — Google Gemini builds a custom day plan from your interests, available hours, and city.
- **Crowd estimation** — every spot gets a 0–100 crowd score from a time-of-day model + live crowd reports + weather.
- **Crowdsourced reporting** — tap *Quiet / Busy / Packed* on any stop to update its score live.
- **Dynamic rerouting** — when a stop is packed (score > 70), the app suggests a nearby, interest-matched, less-crowded alternative; one tap to swap.
- **Weather-aware** — live OpenWeather data shifts crowds (rain pushes people indoors, so the engine favors malls/museums).
- **Full-screen map UI** — Leaflet + OpenStreetMap with numbered, color-coded pins and a slide-up, minimizable itinerary sheet.

Everything degrades gracefully: if Gemini or OpenWeather is unavailable, the app falls back to an offline generator and a default forecast, so the demo never breaks.

---

## 🛠 Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS v4 |
| Map | Leaflet + react-leaflet + OpenStreetMap (free, no key) |
| AI | Google Gemini (`gemini-2.5-flash`) via a server-side API route |
| Weather | OpenWeather Current Weather API via a server-side API route |
| Deployment | Vercel |

There is **no database** — all data lives in-browser behind a swappable `dataService` layer (by design; the deliverable is a single-screen demo).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (developed on Node 22)
- npm

### 1. Install
```bash
npm install
```

### 2. Configure environment
Create a `.env.local` file in the project root:

```bash
# Google Gemini — free key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash

# OpenWeather — free key at https://home.openweathermap.org/api_keys
OPENWEATHER_API_KEY=your_openweather_key_here
```

> Both keys are **optional** for a first run — without them the app uses the offline itinerary generator and a sunny default forecast. Add them to enable the live AI and weather.
>
> ⚠️ New OpenWeather keys can take ~1–2 hours to activate.

### 3. Run the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 📜 Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## ☁️ Deployment

The app is deployed on Vercel at **[crowdflowph.vercel.app](https://crowdflowph.vercel.app)**, connected to the `peewweee/CrowdFlow-itinerary-planner` GitHub repo. **Every push to `main` auto-deploys.**

To reproduce the setup from scratch:

1. Push to GitHub.
2. On [vercel.com](https://vercel.com), **Add New → Project** and import the repo (Next.js is auto-detected).
3. Add the environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENWEATHER_API_KEY`) under **Settings → Environment Variables** — `.env.local` is gitignored, so these must be re-entered.
4. Deploy.

---

## 📂 Project Structure

```
src/
├─ app/
│  ├─ page.tsx              # Main client orchestrator (state, layout)
│  ├─ layout.tsx           # Root layout + metadata
│  ├─ globals.css          # Theme + animations
│  └─ api/
│     ├─ itinerary/route.ts # Server-side Gemini call (+ fallback)
│     └─ weather/route.ts   # Server-side OpenWeather call (+ fallback)
├─ components/
│  ├─ MapView.tsx          # Leaflet map (client-only)
│  ├─ ItineraryForm.tsx    # City / interests / time input
│  ├─ SpotCard.tsx         # Timeline card + report + reroute banner
│  ├─ CrowdBadge.tsx       # Crowd score chip + explainer tooltip
│  ├─ WeatherBar.tsx       # Weather summary
│  └─ SplashScreen.tsx     # Branded intro overlay
├─ lib/
│  ├─ crowd.ts             # crowdScore() + threshold + Haversine
│  ├─ reroute.ts           # findAlternative() rerouting engine
│  ├─ dataService.ts       # Swappable data layer (mock + AI fetch)
│  └─ ui.ts                # Crowd-band styling + formatting
├─ data/
│  └─ spots.ts             # 36 curated PH spots + popularity curves
└─ types/
   └─ index.ts             # Domain types
```

---

## 🧠 How the crowd score works

```
Crowd Score (0–100) =
    ( 0.6 × time-of-day curve + 0.4 × recent reports ) × weather modifier
```

- 🟢 **0–40** quiet · 🟡 **41–70** filling up · 🔴 **71–100** packed (triggers a reroute suggestion)

The score and the rerouting engine are pure, deterministic functions — explainable, testable, and independent of any flaky external feed. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the full model.

---

## ⚠️ Limitations

- Crowd levels are **estimates**, not sensor-measured truth (no public crowd API covers PH spots).
- Coverage is limited to the ~36 pre-loaded spots.
- No persistence — reports and plans live only in the current browser session.
