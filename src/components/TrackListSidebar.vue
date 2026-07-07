<template>
  <div class="track-list">
    <div class="list-header">
      <span class="section-title">History</span>
      <button :class="['merge-btn', { active: mergeMode }]" @click="toggleMergeMode">
        {{ mergeMode ? 'Cancel' : 'Merge' }}
      </button>
    </div>

    <div v-if="mergeMode" class="merge-panel">
      <p class="merge-hint">Select 2 tracks whose endpoints are within 5 km of each other</p>
      <div v-if="mergeError" class="merge-error">{{ mergeError }}</div>
      <button
        v-if="mergeSelection.size === 2 && canMerge"
        class="btn-confirm-merge"
        :disabled="merging"
        @click="doMerge"
      >{{ merging ? 'Merging…' : 'Confirm merge' }}</button>
    </div>

    <div v-if="store.syncStatus === 'syncing'" class="sync-banner syncing">
      Syncing{{ store.syncMessage ? ` — ${store.syncMessage}` : '…' }}
    </div>
    <div v-else-if="store.syncStatus === 'done'" class="sync-banner done">
      Synced
    </div>
    <div v-else-if="store.syncStatus === 'error'" class="sync-banner error">
      Sync failed — using local data
    </div>

    <div v-if="!mergeMode && store.savedTracks.length > 0" class="filters">
      <select v-model="filterYear">
        <option value="">All years</option>
        <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
      </select>
      <select v-model="filterMonth">
        <option value="">All months</option>
        <option v-for="m in availableMonths" :key="m" :value="m">{{ m }}月</option>
      </select>
      <select v-model="filterDist">
        <option value="">All distances</option>
        <option value="0-5">0–5 km</option>
        <option value="5-15">5–15 km</option>
        <option value="15-30">15–30 km</option>
        <option value="30+">30+ km</option>
      </select>
    </div>

    <div v-if="store.savedTracks.length === 0" class="empty">No tracks yet</div>
    <div v-else-if="filteredTracks.length === 0" class="empty">No matching tracks</div>

    <div
      v-for="t in filteredTracks"
      :key="t.id"
      :class="['track-item', {
        active: !mergeMode && store.activeId === t.id,
        'merge-selected': mergeMode && mergeSelection.has(t.id)
      }]"
      @click="mergeMode ? toggleMergeSelect(t) : loadTrack(t)"
    >
      <div class="track-name">{{ t.name }}</div>
      <div class="track-meta">
        {{ t.stats.distanceKm.toFixed(1) }} km &nbsp;·&nbsp; ↑{{ t.stats.elevationGainM }}m &nbsp;·&nbsp; {{ formatDate(t) }}
      </div>
      <button v-if="!mergeMode" class="del-btn" @click.stop="removeTrack(t.id)" title="Delete">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 2l8 8M10 2l-8 8" stroke-linecap="round"/>
        </svg>
      </button>
      <span v-else-if="mergeSelection.has(t.id)" class="check-badge">✓</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTrackStore } from '@/state/trackStore'
import { listTracks, deleteTrack, saveTrack } from '@/lib/storage'
import { parseGpx, sha1 } from '@/lib/gpxParser'
import { calcStats } from '@/lib/stats'
import type { StoredTrack } from '@/lib/storage'

const store = useTrackStore()
const filterYear = ref<number | ''>('')
const filterMonth = ref<number | ''>('')
const filterDist = ref<'' | '0-5' | '5-15' | '15-30' | '30+'>('')
const mergeMode = ref(false)
const mergeSelection = ref<Set<string>>(new Set())
const mergeError = ref('')
const merging = ref(false)

function toggleMergeMode() {
  mergeMode.value = !mergeMode.value
  mergeSelection.value = new Set()
  mergeError.value = ''
}

function toggleMergeSelect(t: StoredTrack) {
  mergeError.value = ''
  const sel = mergeSelection.value
  if (sel.has(t.id)) { sel.delete(t.id) }
  else if (sel.size < 2) { sel.add(t.id) }
  else { mergeError.value = 'Select only 2 tracks' }
  mergeSelection.value = new Set(sel)
}

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371, dLat = ((lat2-lat1)*Math.PI)/180, dLon = ((lon2-lon1)*Math.PI)/180
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const canMerge = computed(() => {
  if (mergeSelection.value.size !== 2) return false
  const [id1, id2] = [...mergeSelection.value]
  const t1 = store.savedTracks.find(t => t.id === id1)
  const t2 = store.savedTracks.find(t => t.id === id2)
  if (!t1 || !t2) return false
  const p1 = t1.parsedTrack.points, p2 = t2.parsedTrack.points
  return haversineKm(p1[p1.length-1].lon, p1[p1.length-1].lat, p2[0].lon, p2[0].lat) < 5 ||
         haversineKm(p2[p2.length-1].lon, p2[p2.length-1].lat, p1[0].lon, p1[0].lat) < 5
})

async function doMerge() {
  if (!canMerge.value) { mergeError.value = 'Endpoints are more than 5 km apart'; return }
  merging.value = true; mergeError.value = ''
  try {
    const [id1, id2] = [...mergeSelection.value]
    const t1 = store.savedTracks.find(t => t.id === id1)!
    const t2 = store.savedTracks.find(t => t.id === id2)!
    const p1 = t1.parsedTrack.points, p2 = t2.parsedTrack.points
    let first = t1, second = t2
    if (haversineKm(p1[p1.length-1].lon, p1[p1.length-1].lat, p2[0].lon, p2[0].lat) >= 5) { first = t2; second = t1 }
    const mergedGpx = buildMergedGpx(first, second)
    const mergedId = await sha1(mergedGpx)
    const mergedTrack = parseGpx(mergedGpx)
    const mergedStats = calcStats(mergedTrack.points, mergedTrack.geojson)
    await saveTrack({ id: mergedId, name: mergedTrack.name, importedAt: Date.now(), workoutDate: first.workoutDate, rawGpxText: mergedGpx, parsedTrack: mergedTrack, stats: mergedStats })
    store.savedTracks = await listTracks()
    store.setActiveTrack(mergedTrack, mergedStats, mergedId)
    toggleMergeMode()
  } catch (e: any) { mergeError.value = e.message || 'Merge failed' }
  finally { merging.value = false }
}

function buildMergedGpx(first: StoredTrack, second: StoredTrack): string {
  const pts1 = first.parsedTrack.points, pts2 = second.parsedTrack.points
  const toTrkpt = (p: typeof pts1[0]) => `      <trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele.toFixed(1)}</ele>${p.time ? `<time>${new Date(p.time).toISOString()}</time>` : ''}</trkpt>`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Hiking3D Merge">\n  <trk>\n    <name>${first.name} + ${second.name}</name>\n    <trkseg>\n${[...pts1,...pts2].map(toTrkpt).join('\n')}\n    </trkseg>\n  </trk>\n</gpx>`
}

function getWorkoutDate(t: StoredTrack): Date {
  if (t.workoutDate) return new Date(t.workoutDate)
  const m = t.name.match(/(\d{4}-\d{2}-\d{2})/)
  if (m) { const d = new Date(m[1]); if (!isNaN(d.getTime())) return d }
  return new Date(t.importedAt)
}

const availableYears = computed(() => [...new Set(store.savedTracks.map(t => getWorkoutDate(t).getFullYear()))].sort((a,b) => b-a))
const availableMonths = computed(() => {
  const base = filterYear.value ? store.savedTracks.filter(t => getWorkoutDate(t).getFullYear() === filterYear.value) : store.savedTracks
  return [...new Set(base.map(t => getWorkoutDate(t).getMonth()+1))].sort((a,b) => a-b)
})
const filteredTracks = computed(() => store.savedTracks.filter(t => {
  const d = getWorkoutDate(t)
  if (filterYear.value && d.getFullYear() !== filterYear.value) return false
  if (filterMonth.value && d.getMonth()+1 !== filterMonth.value) return false
  if (filterDist.value) {
    const km = t.stats.distanceKm
    if (filterDist.value === '0-5' && km >= 5) return false
    if (filterDist.value === '5-15' && (km < 5 || km >= 15)) return false
    if (filterDist.value === '15-30' && (km < 15 || km >= 30)) return false
    if (filterDist.value === '30+' && km < 30) return false
  }
  return true
}))

onMounted(async () => { store.savedTracks = await listTracks() })

async function loadTrack(t: StoredTrack) {
  const freshTrack = parseGpx(t.rawGpxText)
  const stats = calcStats(freshTrack.points, freshTrack.geojson)
  store.setActiveTrack(freshTrack, stats, t.id)
}

async function removeTrack(id: string) {
  await deleteTrack(id)
  store.savedTracks = await listTracks()
  if (store.activeId === id) store.clearActiveTrack()
}

function formatDate(t: StoredTrack): string {
  return getWorkoutDate(t).toLocaleDateString('en-CA')
}
</script>

<style scoped>
.track-list {
  padding: 12px 16px;
  border-bottom: 1px solid var(--sb-border);
  flex: 1;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sb-ink3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.merge-btn {
  font-size: 12px;
  padding: 3px 10px;
  border: 1px solid var(--sb-border);
  border-radius: var(--r);
  background: transparent;
  color: var(--sb-ink3);
  cursor: pointer;
  transition: all 0.15s;
}
.merge-btn:hover { border-color: var(--sb-ink3); color: var(--sb-ink); }
.merge-btn.active { border-color: var(--sb-ink3); background: var(--sb-active); color: var(--sb-ink); }

.merge-panel {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--sb-border);
  border-radius: var(--r);
  padding: 10px 12px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.merge-hint { font-size: 12px; color: var(--sb-ink3); line-height: 1.5; }
.merge-error { font-size: 12px; color: var(--sb-danger); }

.btn-confirm-merge {
  padding: 5px 12px;
  background: var(--sb-blue);
  border: none;
  border-radius: var(--r);
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-start;
}
.btn-confirm-merge:hover { background: #3a7ef0; }
.btn-confirm-merge:disabled { background: rgba(255,255,255,0.1); cursor: not-allowed; }

.sync-banner {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: var(--r);
  margin-bottom: 8px;
  border: 1px solid;
}
.sync-banner.syncing { background: var(--sb-blue-lt); border-color: var(--sb-blue-bd); color: var(--sb-blue); }
.sync-banner.done    { background: var(--sb-green-lt); border-color: rgba(74,222,128,0.3); color: var(--sb-green); }
.sync-banner.error   { background: var(--sb-danger-lt); border-color: rgba(248,113,113,0.3); color: var(--sb-danger); }

.filters {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.filters select {
  flex: 1;
  min-width: 0;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--sb-border);
  border-radius: var(--r);
  color: var(--sb-ink2);
  padding: 4px 6px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.filters select:focus { border-color: var(--sb-blue); }

.empty { font-size: 13px; color: var(--sb-ink3); padding: 8px 0; }

.track-item {
  position: relative;
  padding: 8px 28px 8px 8px;
  border-radius: var(--r);
  cursor: pointer;
  transition: background 0.1s;
  margin: 0 -8px;
}
.track-item:hover { background: var(--sb-hover); }
.track-item.active { background: var(--sb-active); }
.track-item.merge-selected { background: var(--sb-blue-lt); outline: 1px solid var(--sb-blue-bd); }

.track-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--sb-ink);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-meta { font-size: 11px; color: var(--sb-ink3); }

.del-btn {
  position: absolute;
  right: 6px; top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  background: none;
  border: none;
  color: var(--sb-ink3);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  transition: all 0.1s;
}
.track-item:hover .del-btn { opacity: 1; }
.del-btn:hover { color: var(--sb-danger); background: var(--sb-danger-lt); }

.check-badge {
  position: absolute;
  right: 8px; top: 50%;
  transform: translateY(-50%);
  color: var(--sb-blue);
  font-size: 13px;
  font-weight: 700;
}
</style>
