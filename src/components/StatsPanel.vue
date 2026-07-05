<template>
  <div v-if="store.activeStats" class="stats-panel">
    <h3>路线统计</h3>
    <div class="grid">
      <div class="stat">
        <div class="label">总距离</div>
        <div class="value">{{ store.activeStats.distanceKm.toFixed(2) }} km</div>
      </div>
      <div class="stat">
        <div class="label">累计爬升</div>
        <div class="value">{{ store.activeStats.elevationGainM }} m</div>
      </div>
      <div class="stat">
        <div class="label">累计下降</div>
        <div class="value">{{ store.activeStats.elevationLossM }} m</div>
      </div>
      <div class="stat">
        <div class="label">最高海拔</div>
        <div class="value">{{ store.activeStats.maxEleM }} m</div>
      </div>
      <div class="stat">
        <div class="label">最低海拔</div>
        <div class="value">{{ store.activeStats.minEleM }} m</div>
      </div>
      <div class="stat">
        <div class="label">运动时长</div>
        <div class="value">{{ formatDuration(store.activeStats.durationMs) }}</div>
      </div>
      <div class="stat">
        <div class="label">平均速度</div>
        <div class="value">{{ store.activeStats.avgSpeedKmh }} km/h</div>
      </div>
      <div class="stat">
        <div class="label">最大速度</div>
        <div class="value">{{ store.activeStats.maxSpeedKmh }} km/h</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTrackStore } from '@/state/trackStore'

const store = useTrackStore()

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m} 分钟`
}
</script>

<style scoped>
.stats-panel {
  background: #1f2937;
  border-radius: 8px;
  padding: 12px;
}
h3 {
  font-size: 13px;
  font-weight: 700;
  color: #f9fafb;
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stat {
  background: #111827;
  border-radius: 6px;
  padding: 8px;
}
.label {
  font-size: 10px;
  color: #6b7280;
  margin-bottom: 2px;
}
.value {
  font-size: 15px;
  font-weight: 700;
  color: #f9fafb;
}
</style>
