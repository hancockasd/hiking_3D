<template>
  <div v-if="store.activeStats?.elevationProfile.length" class="elevation-chart">
    <h3>Elevation Profile</h3>
    <div ref="chartEl" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useTrackStore } from '@/state/trackStore'

const store = useTrackStore()
const chartEl = ref<HTMLDivElement>()
let uplot: uPlot | null = null

async function buildChart() {
  if (!store.activeStats) return
  // Wait for DOM layout so clientWidth is non-zero
  await nextTick()
  if (!chartEl.value) return
  uplot?.destroy()

  const profile = store.activeStats.elevationProfile
  const xs = new Float64Array(profile.map((p) => p.cumDistKm))
  const ys = new Float64Array(profile.map((p) => p.ele))

  const width = chartEl.value.clientWidth || 252

  uplot = new uPlot(
    {
      width,
      height: 100,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [
        { label: 'km', labelSize: 12, font: '10px -apple-system, sans-serif', stroke: '#9ca3af', grid: { stroke: '#e5e5e5', width: 0.5 } },
        { label: 'm', labelSize: 12, font: '10px -apple-system, sans-serif', stroke: '#9ca3af', grid: { stroke: '#e5e5e5', width: 0.5 } },
      ],
      series: [
        {},
        {
          stroke: '#1558d6',
          fill: 'rgba(21,88,214,0.08)',
          width: 1.5,
        },
      ],
    },
    [xs, ys],
    chartEl.value,
  )
}

onMounted(() => {
  if (store.activeStats) buildChart()
})

watch(() => store.activeStats, (stats) => {
  if (stats) buildChart()
})

onUnmounted(() => { uplot?.destroy() })
</script>

<style scoped>
.elevation-chart {
  padding: 12px 16px;
  border-bottom: 1px solid var(--sb-border);
}
h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--sb-ink3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 8px;
}
</style>
