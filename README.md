# Earth Anomaly Observatory

A real-time Earth anomaly monitoring dashboard built with React, TypeScript, Vite, and Leaflet. The interface integrates data from four authoritative Earth science APIs (USGS, NASA EONET, NOAA SWPC, UN GDACS) and uses AI/LLM analysis to generate scientific assessments across a trilingual (English / French / Spanish) UI.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Architecture Notes](#architecture-notes)

---

## Overview

The observatory dashboard provides operators with:

- **Interactive World Map** - real-time event visualization using Leaflet + OpenStreetMap tiles with color-coded markers by anomaly domain (earthquake, wildfire, storm, flood, volcano, ice, space weather), zoom/pan controls, and event detail popups
- **Canonical Event Aggregation** - intelligent deduplication of duplicate reports from multiple data sources into single authoritative event records
- **Domain-Based Anomaly Scores** - per-domain risk scoring (0–100) with historical baseline comparisons and trend indicators
- **Global Anomaly Index** - composite risk gauge combining weighted anomaly scores across seven domains
- **AI-Driven Assessment** - LLM-powered scientific analysis identifying key developments, cross-domain correlations, data quality warnings, and analytical priorities
- **Real-Time Data Feeds** - automated parallel ingestion from USGS (earthquakes), NASA EONET (wildfires, storms, floods, ice), NOAA SWPC (geomagnetic storms, solar radiation), and UN GDACS (flood/volcano events)

The UI supports English, French (Canadian), and Spanish with live language switching and persistent preferences.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18.0 + React Router 7.9.5 |
| Language | TypeScript ~5.9 |
| Build Tool | Vite 8.2.2 |
| Styling | Tailwind CSS 3.4.11 + CSS custom properties |
| Component Library | Radix UI primitives + shadcn/ui |
| Maps & Visualization | Leaflet 1.9.4 + OpenStreetMap tiles |
| Data Fetching | Native fetch API + Promise.allSettled |
| AI/LLM Integration | Anna Runtime (LLM-powered analysis) |
| Internationalization | Context API + localStorage |
| Error Tracking | Sentry |
| Package Manager | pnpm 9.x |
| Linter / Formatter | Biome 2.4.5 |
| Testing | Vitest + React Testing Library |

---

## Project Structure

```
anna-earth-observer/
+-- index.html                  # HTML entry point
+-- package.json
+-- vite.config.ts
+-- tailwind.config.js
+-- tsconfig.app.json
+-- src/
    +-- main.tsx                # Application bootstrap
    +-- App.tsx                 # Root router
    +-- routes.tsx              # Route definitions
    +-- index.css               # Global styles and design tokens
    +-- components/
    |   +-- common/             # Shared utility components
    |   +-- observatory/        # Dashboard-specific components
    |   |   +-- TopBar.tsx
    |   |   +-- PageHeading.tsx
    |   |   +-- LeftColumn.tsx
    |   |   +-- CenterColumn.tsx
    |   |   +-- RightColumn.tsx
    |   |   +-- EarthBackground.tsx
    |   +-- ui/                 # shadcn/ui component library
    +-- contexts/               # React context providers
    +-- db/                     # Supabase client configuration
    +-- hooks/                  # Custom React hooks
    +-- i18n/                   # Internationalisation (en / fr / es)
    +-- lib/                    # Shared utilities
    +-- pages/                  # Page-level components
    +-- services/               # API / data-access layer
    +-- types/                  # Shared TypeScript types
```

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9

```bash
node -v   # v20.x.x or later
pnpm -v   # 9.x.x or later
```

To install pnpm:

```bash
npm install -g pnpm
```

---

## Getting Started

```bash
# 1. Clone the repository
git clone <repository-url>
cd anna-earth-observer

# 2. Install dependencies
pnpm install

# 3. Copy the environment template and fill in your values
cp .env.example .env.local

# 4. Start the development server
pnpm dev
```

The app will be available at http://localhost:5173.

---

## Environment Variables

Create a .env.local file in the project root (optional):

```env
# Sentry (optional) — for error tracking
VITE_SENTRY_DSN=https://<key>@sentry.io/<project>
```

**Note:** Earth data is fetched directly from public APIs (USGS, NASA EONET, NOAA SWPC, UN GDACS) with no authentication required. AI assessment is provided by the Anna Runtime environment when running inside the Anna host, or disabled in standalone mode.

All runtime environment variables must be prefixed with VITE_ to be exposed to the browser bundle.

---

## Available Scripts

| Command | Description |
|---|---|
| pnpm dev | Start the Vite development server |
| pnpm build | Type-check and produce a production bundle |
| pnpm preview | Serve the production build locally |
| pnpm lint | Run Biome linting and Tailwind CSS checks |

## Architecture Notes

### Data Pipeline

**Real-Time Data Ingestion** - The `useEarthData` hook executes parallel fetches from four authoritative sources:
- **USGS** (earthquake.usgs.gov): Earthquakes M≥4.5 from the past 7 days
- **NASA EONET** (eonet.gsfc.nasa.gov): Wildfires, storms, floods, volcanoes, and ice events (14-day window)
- **NOAA SWPC** (services.swpc.noaa.gov): Geomagnetic storms, solar radiation events, and solar flares
- **UN GDACS** (gdacs.org): Disaster alerts for floods and volcanoes

All four requests run in parallel using `Promise.allSettled()` to maximize responsiveness even if one source is temporarily unavailable.

### Canonical Event Model

Raw API responses are normalized into a canonical data model:
- **Deduplication** - Multiple reports of the same physical event are merged (e.g., EONET + GDACS both reporting the same flood) into a single `CanonicalEvent` record
- **Enrichment** - Each event includes source tracking, magnitude, confidence score, and age calculations
- **Type Guard** - `SpaceWeatherEpisode` represents grouped SWPC bulletins into cohesive space-weather events

### Domain Scoring & Global Anomaly Index

**Domain Scores** (0–100 per domain) are calculated using:
- **Event Count** - Current active events normalized against historical baseline
- **Severity Proxy** - Maximum magnitude/scale observed in that domain
- **Temporal Trend** - Rising, stable, or falling activity pattern

**Global Anomaly Index** combines seven domain scores using fixed weights:
- Earthquake (20%), Wildfire (15%), Storm (18%), Flood (15%), Volcano (7%), Ice (5%), Space Weather (20%)

### AI/LLM Assessment Layer

The `useAIAssessment` hook:
1. Serializes the top 20 priority events and active space-weather episodes
2. Sends to the Anna Runtime LLM with a strict system prompt
3. Receives structured JSON containing:
   - **Executive Summary** - Factual overview of current conditions
   - **Top Developments** - Ranked by importance with evidence citations
   - **Cross-Domain Observations** - Correlational (never causal) patterns
   - **Data Quality Warnings** - Coverage gaps and feed limitations
   - **Key Uncertainties** - Explicitly stated unknowns
   - **Analyst Priorities** - Recommended focus areas

**AI Safety** - The system prompt enforces strict rules: no causal claims without evidence, no probabilistic forecasts without calibrated models, and preservation of source units and NOAA scales.

### Internationalization (i18n)

All UI copy lives in `src/i18n/messages.ts` organized by feature (dashboard, gaiModal, detail, ai, etc.) with full EN/FR/ES translations. Components access translations via the `useLanguage()` hook, which provides a `t(key, vars?)` helper and language switching with localStorage persistence ("lumi-workbench-lang" key).

### World Map

The `WorldMap` component renders an interactive Leaflet map with:
- **OpenStreetMap base tiles** with proper attribution
- **Custom markers** (24×24 px) color-coded by domain with domain-specific colors
- **Zoom/Pan** - Supports zoom levels 2-19, scroll wheel zoom, drag pan, and double-click zoom
- **Event Filtering** - Shows all events or filters by active domain
- **Selection Highlighting** - Selected markers display larger borders
- **Popup Details** - Click markers to view event name, domain, and region
- **Dark Theme** - CSS filters dim tile layer brightness and apply dark backgrounds to popups

### Styling & Design System

CSS custom properties (`--canvas-deep`, `--accent-purple`, `--line-hairline`, etc.) defined in `index.css` provide the design system foundation. Tailwind utilities handle layout and responsive design; bespoke CSS selectors manage animations (pulse rings, earth video parallax, etc.) and theme effects (blur, opacity, gradient overlays).

### Performance & Offline Mode

When all data sources are unavailable, the dashboard displays static fallback events and indicates "Offline Mode". This ensures UX continuity even when the network is unreliable.

### Anna Runtime Integration

When running inside the Anna host environment, the app gains access to an LLM via `getAnnaRuntime()`. This enables AI assessment. In standalone mode (e.g., local dev), the runtime returns null and AI features gracefully degrade.
