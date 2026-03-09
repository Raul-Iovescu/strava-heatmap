# 🗺️ Strava Personal Heatmap

Free alternative to Strava Summit heatmap. Runs 100% locally.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure .env
Open `.env` and add your Strava Client Secret:
```
STRAVA_CLIENT_ID=209535
STRAVA_CLIENT_SECRET=your_client_secret_here
PORT=3000
```

### 3. Start the server
```bash
npm start
```

### 4. Open in browser
```
http://localhost:3000
```

### 5. Click "Connect with Strava" and authorize

---

## How it works

1. **OAuth flow** — Standard Strava OAuth2, read-only access
2. **Activity fetch** — Pulls all your activities via Strava API (paginated)
3. **Polyline decode** — Decodes Google Encoded Polyline from activity summaries
4. **Heatmap render** — Leaflet.js + leaflet-heat on a dark CartoDB basemap

## Features

- 🔥 Real heatmap with adjustable radius, intensity, blur
- 🎨 4 color themes (Strava orange, Fire, Ocean, Neon)
- 🏃 Filter by activity type (Run, Ride, Hike, Walk, Swim)
- 📊 Live stats: activities, GPS points, total km
- 🔒 All data stays on your machine

## Stack

- **Backend:** Node.js + Express
- **Auth:** Strava OAuth2
- **Map:** Leaflet.js + CartoDB dark tiles
- **Heatmap:** leaflet-heat
- **Fonts:** Bebas Neue + DM Mono
