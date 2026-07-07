<template>
  <div v-if="store.activeStats" class="stats-panel">
    <div class="section-title">Route Statistics</div>
    <table class="stats-table">
      <tbody>
        <tr><td class="lbl">Distance</td><td class="val">{{ store.activeStats.distanceKm.toFixed(2) }} <span class="unit">km</span></td></tr>
        <tr><td class="lbl">Elevation gain</td><td class="val">{{ store.activeStats.elevationGainM }} <span class="unit">m</span></td></tr>
        <tr><td class="lbl">Elevation loss</td><td class="val">{{ store.activeStats.elevationLossM }} <span class="unit">m</span></td></tr>
        <tr><td class="lbl">Max elevation</td><td class="val">{{ store.activeStats.maxEleM }} <span class="unit">m</span></td></tr>
        <tr><td class="lbl">Min elevation</td><td class="val">{{ store.activeStats.minEleM }} <span class="unit">m</span></td></tr>
        <tr><td class="lbl">Duration</td><td class="val">{{ formatDuration(store.activeStats.durationMs) }}</td></tr>
        <tr><td class="lbl">Avg speed</td><td class="val">{{ store.activeStats.avgSpeedKmh }} <span class="unit">km/h</span></td></tr>
        <tr><td class="lbl last">Max speed</td><td class="val last">{{ store.activeStats.maxSpeedKmh }} <span class="unit">km/h</span></td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useTrackStore } from '@/state/trackStore'
const store = useTrackStore()
function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
</script>

<style scoped>
.stats-panel {
  padding: 12px 16px;
  border-bottom: 1px solid var(--sb-border);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sb-ink3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
}

.stats-table td {
  padding: 5px 0;
  border-bottom: 1px solid var(--sb-border);
  font-size: 13px;
  vertical-align: middle;
}

.stats-table td.last { border-bottom: none; }

.lbl { color: var(--sb-ink3); width: 55%; }
.val { color: var(--sb-ink); text-align: right; font-variant-numeric: tabular-nums; }
.unit { color: var(--sb-ink3); font-size: 11px; }
</style>
