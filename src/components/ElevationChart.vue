<template>
  <div v-if="store.activeStats?.elevationProfile.length" class="elevation-chart">
    <h3>海拔剖面</h3>
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
        { label: 'km', labelSize: 12, font: '10px sans-serif', stroke: '#9ca3af', grid: { stroke: '#374151', width: 0.5 } },
        { label: 'm', labelSize: 12, font: '10px sans-serif', stroke: '#9ca3af', grid: { stroke: '#374151', width: 0.5 } },
      ],
      series: [
        {},
        {
          stroke: '#60a5fa',
          fill: 'rgba(96,165,250,0.2)',
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
</style>
