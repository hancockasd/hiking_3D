<template>
  <div class="track-list">
    <h3>历史轨迹</h3>

    <!-- Sync status -->
    <div v-if="store.syncStatus === 'syncing'" class="sync-bar sync-syncing">
      ⏳ {{ store.syncMessage || '同步中...' }}
    </div>
    <div v-else-if="store.syncStatus === 'done'" class="sync-bar sync-done">
      ✅ 云端同步完成
    </div>
    <div v-else-if="store.syncStatus === 'error'" class="sync-bar sync-error">
      ⚠ 云端同步失败，使用本地数据
    </div>

    <!-- Filters -->
    <div v-if="store.savedTracks.length > 0" class="filters">
      <select v-model="filterYear">
        <option value="">全部年份</option>
        <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
      </select>
      <select v-model="filterMonth">
        <option value="">全部月份</option>
        <option v-for="m in availableMonths" :key="m" :value="m">{{ m }} 月</option>
      </select>
      <select v-model="filterDist">
        <option value="">全部距离</option>
        <option value="0-5">0–5 km</option>
        <option value="5-15">5–15 km</option>
        <option value="15-30">15–30 km</option>
        <option value="30+">30+ km</option>
      </select>
    </div>

    <div v-if="store.savedTracks.length === 0" class="empty">暂无记录</div>
    <div v-else-if="filteredTracks.length === 0" class="empty">无匹配轨迹</div>
    <div
      v-for="t in filteredTracks"
      :key="t.id"
      :class="['track-item', { active: store.activeId === t.id }]"
      @click="loadTrack(t)"
    >
      <div class="track-name">{{ t.name }}</div>
      <div class="track-meta">
        {{ t.stats.distanceKm.toFixed(1) }} km · {{ t.stats.elevationGainM }}m↑ ·
        {{ formatDate(t) }}
      </div>
      <button class="del-btn" @click.stop="removeTrack(t.id)">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTrackStore } from '@/state/trackStore'
import { listTracks, deleteTrack } from '@/lib/storage'
import { parseGpx } from '@/lib/gpxParser'
import { calcStats } from '@/lib/stats'
import type { StoredTrack } from '@/lib/storage'

const store = useTrackStore()

const filterYear = ref<number | ''>('')
const filterMonth = ref<number | ''>('')
const filterDist = ref<'' | '0-5' | '5-15' | '15-30' | '30+'>('')

// Derive workout date: prefer stored workoutDate, fall back to parsing name like "Route 2025-08-02 ..."
function getWorkoutDate(t: StoredTrack): Date {
  if (t.workoutDate) return new Date(t.workoutDate)
  const m = t.name.match(/(\d{4}-\d{2}-\d{2})/)
  if (m) {
    const d = new Date(m[1])
    if (!isNaN(d.getTime())) return d
  }
  return new Date(t.importedAt)
}

const availableYears = computed(() => {
  const years = store.savedTracks.map((t) => getWorkoutDate(t).getFullYear())
  return [...new Set(years)].sort((a, b) => b - a)
})

const availableMonths = computed(() => {
  const base = filterYear.value
    ? store.savedTracks.filter((t) => getWorkoutDate(t).getFullYear() === filterYear.value)
    : store.savedTracks
  const months = base.map((t) => getWorkoutDate(t).getMonth() + 1)
  return [...new Set(months)].sort((a, b) => a - b)
})

const filteredTracks = computed(() => {
  return store.savedTracks.filter((t) => {
    const d = getWorkoutDate(t)
    if (filterYear.value && d.getFullYear() !== filterYear.value) return false
    if (filterMonth.value && d.getMonth() + 1 !== filterMonth.value) return false
    if (filterDist.value) {
      const km = t.stats.distanceKm
      if (filterDist.value === '0-5' && !(km < 5)) return false
      if (filterDist.value === '5-15' && !(km >= 5 && km < 15)) return false
      if (filterDist.value === '15-30' && !(km >= 15 && km < 30)) return false
      if (filterDist.value === '30+' && !(km >= 30)) return false
    }
    return true
  })
})

onMounted(async () => {
  store.savedTracks = await listTracks()
})

async function loadTrack(t: StoredTrack) {
  // Re-parse from raw GPX so timestamps (coordTimes fix) are always fresh.
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
  return getWorkoutDate(t).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.track-list {
  background: #1f2937;
  border-radius: 8px;
  padding: 12px;
}
h3 {
  font-size: 13px;
  font-weight: 700;
  color: #f9fafb;
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sync-bar {
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 5px;
  margin-bottom: 8px;
}
.sync-syncing { background: #1e3a5f; color: #93c5fd; }
.sync-done { background: #14532d; color: #86efac; }
.sync-error { background: #7f1d1d30; color: #fca5a5; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.filters select {
  flex: 1;
  min-width: 0;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #f9fafb;
  padding: 4px 6px;
  font-size: 11px;
  cursor: pointer;
}
.empty { font-size: 12px; color: #6b7280; }
.track-item {
  position: relative;
  padding: 8px 28px 8px 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
}
.track-item:hover { background: #374151; }
.track-item.active { border-color: #3b82f6; background: #1e40af20; }
.track-name { font-size: 13px; color: #f9fafb; margin-bottom: 2px; }
.track-meta { font-size: 11px; color: #6b7280; }
.del-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 2px;
}
.del-btn:hover { color: #ef4444; }
</style>
