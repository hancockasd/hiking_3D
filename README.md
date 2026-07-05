# 徒步轨迹 3D 回溯

Personal web app for replaying Apple Watch hiking routes in 3D terrain.

## Features

- Drag & drop GPX upload or Apple Health `export.zip` batch import
- 3D terrain rendering via MapLibre GL JS + AWS Terrarium DEM
- Gradient-colored track line (low→high elevation color scale)
- Flyover animation along the route with speed control
- Stats panel: distance, elevation gain/loss, duration, speed
- Elevation profile chart (uPlot)
- Track history with year/month/distance filters (IndexedDB)
- Basemap switcher: Amap satellite (default), OSM, MapLibre demo
- **User accounts**: email login/register via LeanCloud, tracks synced across devices

## Tech Stack

- **Frontend**: Vue 3 + Vite + Pinia + TypeScript + MapLibre GL
- **Backend**: LeanCloud (BaaS) — auth, cloud database, no server needed
- **Storage**: IndexedDB (local) + LeanCloud (cloud sync)

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # output → dist/
npx tsc --noEmit   # type check
```

### Environment

Copy `.env.example` to `.env` and fill in your LeanCloud credentials:

```bash
VITE_LEANCLOUD_APP_ID=your-app-id
VITE_LEANCLOUD_APP_KEY=your-app-key
VITE_LEANCLOUD_SERVER_URL=https://your-app-id.lc-cn-n1-shared.com
```

## Data flow

```
Apple Watch → HealthFit app → export GPX
  → drag/drop into app
  → @tmcw/togeojson parses to GeoJSON (WGS84)
  → stats computed (distance, elevation, speed, duration)
  → stored in IndexedDB (local cache) + LeanCloud (cloud, if logged in)
  → MapLibre renders; GCJ-02 basemaps get gcoord transform at render time only
```

## Architecture

```
LoginDialog → auth.ts → api.ts → LeanCloud SDK → LeanCloud Cloud
                                                  ├── _User (auth)
                                                  └── Track (data, ACL-isolated)

FileDropzone / ZipImportDialog
  → storage.ts (saveTrack)
      ├── IndexedDB (always, local cache)
      └── api.ts → LeanCloud (if logged in)

App.vue (on mount / on login)
  → syncFromCloud() → downloads all user tracks → IndexedDB
```

## Key implementation notes

- **Coordinate system**: Pinia store always WGS84. Conversion to GCJ-02 happens only in MapCanvas when an Amap basemap is active.
- **Elevation stats**: Apple Health records at ~1Hz. `rollingMedian(15) → ema(α=0.1)` smoothing; sum all positive/negative deltas — no per-step threshold (which would zero out real climbs at 1Hz).
- **Track load**: Always re-parse from `rawGpxText` in TrackListSidebar.vue — cached `parsedTrack` in IndexedDB may be stale.
- **togeojson v7**: timestamps are at `feature.properties.coordinateProperties.times`, not `coordTimes`.
- **uPlot**: elevation profile x-axis must have `scales.x.time: false` (values are km floats, not Unix timestamps).
- **line-gradient**: requires `lineMetrics: true` on the GeoJSON source.
- **Flyover**: use `map.jumpTo()` inside `requestAnimationFrame`, never `easeTo/flyTo` (they queue and stutter).
- **LeanCloud ACL**: each Track object's ACL restricts read/write to its owner — users can never see other users' data.

## Deploy

### 1. LeanCloud Setup

1. Go to [LeanCloud Console](https://console.leancloud.cn/)
2. Register with phone number → create app → choose **华北节点** + **开发版（免费）**
3. Go to **设置 → 应用 Key** → copy `AppID`, `AppKey`, `Server URL`
4. Paste into `.env`

### 2. Frontend

```bash
npm run build
# deploy dist/ to Cloudflare Pages (best CDN reach inside mainland China among free tiers)
```
