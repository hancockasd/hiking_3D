# 徒步轨迹 3D 回溯

Personal web app for replaying Apple Watch hiking routes in 3D terrain.

**Live**: https://hiking3d.pages.dev

## Features

- Drag & drop GPX upload or Apple Health `export.zip` batch import
- 3D terrain rendering via MapLibre GL JS + AWS Terrarium DEM
- Gradient-colored track line (low→high elevation color scale)
- Flyover animation along the route with speed control
- Stats panel: distance, elevation gain/loss, duration, speed
- Elevation profile chart (uPlot)
- Track history with year/month/distance filters
- Basemap switcher: Amap satellite (default), OSM, MapLibre demo
- Track merge: join two tracks whose endpoints are within 5 km
- **User accounts**: email login/register, cloud-synced tracks per user
- **Bidirectional sync**: on login, pushes local-only tracks up and pulls cloud-only tracks down; deletions propagate across devices

## Tech Stack

- **Frontend**: Vue 3 + Vite + Pinia + TypeScript + MapLibre GL
- **Backend**: Cloudflare Pages Functions (file-based API routes at `/api/*`)
- **Database**: Cloudflare D1 (serverless SQLite, bound via `DB` binding)
- **Storage**: IndexedDB (local cache always) + D1 (cloud sync when logged in)
- **Auth**: Token-based (SHA-256 password hashing, UUID session tokens)

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # output → dist/
npx tsc --noEmit   # type check
```

### Environment

No env vars needed. The API is served from the same Pages domain (`/api/*` → `functions/api/*`).

## Architecture

```
LoginDialog → auth.ts → api.ts → fetch() → /api/auth/*      → Pages Functions → D1
                                                  ├── _User (auth)
                                                  └── Track (data, per-user isolation)

FileDropzone / ZipImportDialog
  → storage.ts (saveTrack)
      ├── IndexedDB (always, local cache)
      └── api.ts → /api/tracks (if logged in)

App.vue (on mount / on login)
  → syncFromCloud() → GET /api/tracks → IndexedDB
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account, return token |
| POST | `/api/auth/login` | No | Login, return token |
| POST | `/api/auth/logout` | Bearer | Delete session |
| POST | `/api/auth/change-password` | Bearer | Change password (oldPassword, newPassword) |
| GET | `/api/tracks` | Bearer | List user's tracks |
| POST | `/api/tracks` | Bearer | Save/update a track |
| GET | `/api/tracks/:id` | Bearer | Get single track |
| DELETE | `/api/tracks/:id` | Bearer | Delete a track |

## Key implementation notes

- **Coordinate system**: Pinia store always WGS84. Conversion to GCJ-02 happens only in MapCanvas when an Amap basemap is active.
- **Elevation stats**: Apple Health records at ~1Hz. `rollingMedian(15) → ema(α=0.1)` smoothing; sum all positive/negative deltas — no per-step threshold (which would zero out real climbs at 1Hz).
- **Track load**: Always re-parse from `rawGpxText` in TrackListSidebar.vue — cached `parsedTrack` in IndexedDB may be stale.
- **togeojson v7**: timestamps are at `feature.properties.coordinateProperties.times`, not `coordTimes`.
- **uPlot**: elevation profile x-axis must have `scales.x.time: false` (values are km floats, not Unix timestamps).
- **line-gradient**: requires `lineMetrics: true` on the GeoJSON source.
- **Flyover**: use `map.jumpTo()` inside `requestAnimationFrame`, never `easeTo/flyTo` (they queue and stutter).
- **Login form**: email input uses `type="text" inputmode="email"` — browser HTML5 `type="email"` validation intercepts form submission with cryptic "pattern mismatch" errors before the field renders.
- **D1 auth**: each track row is scoped to `user_id`; API enforces ownership via `requireAuth()` — users can never see other users' data.
- **Cloud sync** (`syncFromCloud` in `storage.ts`): single API call fetches the full cloud list, then (1) pushes local-only tracks up, (2) deletes local tracks absent from cloud, (3) downloads cloud-only tracks. Ensures all devices stay identical after login.
- **Avatar**: stored as base64 data URL in `localStorage` key `user_avatar`; synced to D1 `users.avatar` via `POST /api/auth/update-avatar`. Dispatches `avatar-updated` window event so UserMenu refreshes reactively.
- **UI theme**: dark Slate Navy sidebar (`#1e2535` / `#161c2d` header) with `--sb-*` CSS variable family; map area stays white. All sidebar components use `var(--sb-*)` tokens, not the light `var(--ink/--border)` tokens.

## Deploy

### One-time setup

```bash
# 1. Create D1 database (Cloudflare Dashboard → Workers & Pages → D1)
#    Name: hiking_db

# 2. Run schema
npx wrangler d1 execute hiking_db --file=schema.sql --remote

# 3. Create Pages project
npx wrangler pages project create hiking3d --production-branch main
```

### Every deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name hiking3d
```

> **Why CLI deploy instead of git push?** D1 binding is configured in local `wrangler.toml` (not in git — it triggers Worker deploy mode on Cloudflare). The CLI deploy reads the local toml and applies bindings automatically.

### D1 binding (if UI is broken)

The Cloudflare Dashboard "Add binding" button is known to be unresponsive. Use the API instead:

```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/hiking3d" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deployment_configs":{"production":{"d1_databases":{"DB":{"id":"<DB_ID>"}}},"preview":{"d1_databases":{"DB":{"id":"<DB_ID>"}}}}}'
```

Or just use `wrangler pages deploy` from local — it reads bindings from wrangler.toml automatically.
