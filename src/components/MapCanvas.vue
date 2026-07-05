<template>
  <div ref="mapContainer" class="map-container">
    <div v-if="tileError" class="tile-error-banner">
      ⚠ 地图瓦片加载失败，请检查网络连接
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useTrackStore } from '@/state/trackStore'
import { AWS_TERRARIUM_SOURCE, TERRAIN_CONFIG } from '@/lib/terrain'
import { BASEMAPS } from '@/styles/mapStyles'
import { convertCoords, needsConversion, wgs84ToGcj02 } from '@/lib/coords'
import { flyoverEngine, buildSamples } from '@/lib/flyover'
import type { Feature, LineString } from 'geojson'

const store = useTrackStore()
const mapContainer = ref<HTMLDivElement>()
const tileError = ref(false)
let map: maplibregl.Map | null = null

function getBasemapStyle() {
  return BASEMAPS.find((b) => b.id === store.activeBasemap)?.style ?? BASEMAPS[0].style
}

function buildTrackGeojson(): Feature<LineString> {
  const pts = store.activeTrack!.points
  const coords = pts.map((p): [number, number, number] => [p.lon, p.lat, p.ele])
  const converted = convertCoords(coords, store.activeBasemap)
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: converted },
  }
}

let startMarker: maplibregl.Marker | null = null
let endMarker: maplibregl.Marker | null = null

function addTrackLayers() {
  if (!map || !store.activeTrack) return

  const geojson = buildTrackGeojson()

  // Update or create the GeoJSON source
  if (map.getSource('track')) {
    ;(map.getSource('track') as maplibregl.GeoJSONSource).setData(geojson)
  } else {
    map.addSource('track', {
      type: 'geojson',
      data: geojson,
      lineMetrics: true,
    })

    map.addLayer({
      id: 'track-outline',
      type: 'line',
      source: 'track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.4 },
    })

    map.addLayer({
      id: 'track-line',
      type: 'line',
      source: 'track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': 4,
        'line-gradient': [
          'interpolate',
          ['linear'],
          ['line-progress'],
          0, '#3b82f6',
          0.25, '#22d3ee',
          0.5, '#84cc16',
          0.75, '#f59e0b',
          1, '#ef4444',
        ],
      },
    })
  }

  // Replace start / end markers
  startMarker?.remove()
  endMarker?.remove()
  const pts = store.activeTrack.points
  const start = pts[0]
  const end = pts[pts.length - 1]
  const startCoords = needsConversion(store.activeBasemap)
    ? convertCoords([[start.lon, start.lat, start.ele]], store.activeBasemap)[0]
    : [start.lon, start.lat, start.ele]
  const endCoords = needsConversion(store.activeBasemap)
    ? convertCoords([[end.lon, end.lat, end.ele]], store.activeBasemap)[0]
    : [end.lon, end.lat, end.ele]

  startMarker = new maplibregl.Marker({ color: '#22c55e' })
    .setLngLat([startCoords[0], startCoords[1]])
    .addTo(map)
  endMarker = new maplibregl.Marker({ color: '#ef4444' })
    .setLngLat([endCoords[0], endCoords[1]])
    .addTo(map)

  // Fit map to new track
  const allCoords = (geojson.geometry as LineString).coordinates
  const lngs = allCoords.map((c) => c[0])
  const lats = allCoords.map((c) => c[1])
  map.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 60, duration: 800 },
  )
}

function addTerrainLayers() {
  if (!map) return
  if (!map.getSource('terrain-dem')) {
    map.addSource('terrain-dem', AWS_TERRARIUM_SOURCE as maplibregl.RasterDEMSourceSpecification)
  }
  map.setTerrain(TERRAIN_CONFIG as maplibregl.TerrainSpecification)
  // sky layer removed (sky type not in MapLibre v5 style spec)
}

function initMap() {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: getBasemapStyle(),
    center: [104.0, 35.0],
    zoom: 4,
    pitch: 45,
    bearing: 0,
  })

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')

  map.on('load', () => {
    addTerrainLayers()
    if (store.activeTrack) addTrackLayers()
  })

  map.on('error', (e) => {
    if (e.error?.message?.includes('tiles')) tileError.value = true
  })
}

onMounted(initMap)

onUnmounted(() => {
  flyoverEngine.destroy()
  removeHikerMarker()
  startMarker?.remove()
  endMarker?.remove()
  map?.remove()
})

// React to basemap change
watch(() => store.activeBasemap, (newId) => {
  if (!map) return
  const style = BASEMAPS.find((b) => b.id === newId)?.style ?? BASEMAPS[0].style
  map.setStyle(style)
  map.once('style.load', () => {
    addTerrainLayers()
    if (store.activeTrack) addTrackLayers()
  })
})

// React to new track — watch sequence counter so every setActiveTrack() fires this,
// even if the same id is set twice or reference equality tricks Vue's shallow watch
watch(() => store.trackChangeSeq, () => {
  if (!map || !store.activeTrack) return
  flyoverInitializedForTrackId = null
  if (map.loaded()) {
    addTrackLayers()
  } else {
    map.once('load', addTrackLayers)
  }
})

let hikerMarker: maplibregl.Marker | null = null

function createHikerMarker() {
  if (!map) return
  const el = document.createElement('div')
  el.style.cssText = 'font-size:28px;line-height:1;user-select:none;pointer-events:none;'
  el.textContent = '🧍'
  hikerMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([0, 0])
    .addTo(map)
}

function removeHikerMarker() {
  hikerMarker?.remove()
  hikerMarker = null
}

let flyoverInitializedForTrackId: string | null = null

// React to flyover play/pause
watch(() => store.isFlyoverPlaying, (playing) => {
  if (!map || !store.activeTrack) return
  if (playing) {
    const needsInit = flyoverInitializedForTrackId !== store.activeId

    if (needsInit) {
      const wgs84Geojson = store.activeTrack.geojson
      const samples = buildSamples(wgs84Geojson)
      flyoverEngine.speedMultiplier = store.flyoverSpeed
      flyoverEngine.onProgress = (p) => { store.flyoverProgress = p }
      flyoverEngine.onPositionUpdate = (lon, lat) => {
        if (!hikerMarker) return
        const [mapLon, mapLat] = needsConversion(store.activeBasemap)
          ? wgs84ToGcj02(lon, lat)
          : [lon, lat]
        hikerMarker.setLngLat([mapLon, mapLat])
      }
      flyoverEngine.init(map, samples)
      flyoverInitializedForTrackId = store.activeId
      createHikerMarker()
      // Snap marker to start position before first play
      if (samples.length > 0) {
        const [startLon, startLat] = needsConversion(store.activeBasemap)
          ? wgs84ToGcj02(samples[0].lon, samples[0].lat)
          : [samples[0].lon, samples[0].lat]
        hikerMarker?.setLngLat([startLon, startLat])
      }
    } else {
      // Resuming — just ensure marker exists
      if (!hikerMarker) createHikerMarker()
    }
    flyoverEngine.play()
  } else {
    flyoverEngine.pause()
    removeHikerMarker()
  }
})

watch(() => store.flyoverSpeed, (s) => { flyoverEngine.speedMultiplier = s })

defineExpose({ map })
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
}
.tile-error-banner {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444cc;
  color: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 10;
}
</style>
