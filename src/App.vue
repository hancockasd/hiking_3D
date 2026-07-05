<template>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>🥾 徒步轨迹 3D</h1>
        <UserMenu />
      </div>
      <FileDropzone />
      <TrackListSidebar />
      <StatsPanel />
      <ElevationChart />
      <FlyoverControls />
      <BasemapSwitcher />
    </aside>
    <main class="map-area">
      <MapCanvas />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import MapCanvas from '@/components/MapCanvas.vue'
import FileDropzone from '@/components/FileDropzone.vue'
import FlyoverControls from '@/components/FlyoverControls.vue'
import StatsPanel from '@/components/StatsPanel.vue'
import ElevationChart from '@/components/ElevationChart.vue'
import BasemapSwitcher from '@/components/BasemapSwitcher.vue'
import TrackListSidebar from '@/components/TrackListSidebar.vue'
import UserMenu from '@/components/UserMenu.vue'
import { useAuth } from '@/lib/auth'
import { useTrackStore } from '@/state/trackStore'
import { listTracks, syncFromCloud } from '@/lib/storage'

const auth = useAuth()
const store = useTrackStore()

onMounted(async () => {
  // Init auth — check for existing token
  await auth.initAuth()

  // Load local tracks first (fast, from IndexedDB)
  store.savedTracks = await listTracks()

  // If logged in, sync from cloud in background
  if (auth.loggedIn.value) {
    store.syncStatus = 'syncing'
    try {
      await syncFromCloud((current, total, name) => {
        store.syncMessage = `同步 ${current}/${total}: ${name}`
      })
      store.savedTracks = await listTracks()
      store.syncStatus = 'done'
    } catch {
      store.syncStatus = 'error'
    }
  }
})

// When user logs in, trigger cloud sync
watch(
  () => auth.loggedIn.value,
  async (loggedIn) => {
    if (loggedIn) {
      store.syncStatus = 'syncing'
      try {
        await syncFromCloud((current, total, name) => {
          store.syncMessage = `同步 ${current}/${total}: ${name}`
        })
        store.savedTracks = await listTracks()
        store.syncStatus = 'done'
      } catch {
        store.syncStatus = 'error'
      }
    }
  },
)
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #111827; color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; }
</style>

<style scoped>
.app {
  display: flex;
  height: 100dvh;
  overflow: hidden;
}
.sidebar {
  width: 300px;
  min-width: 300px;
  height: 100%;
  overflow-y: auto;
  background: #0f172a;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-right: 1px solid #1f2937;
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sidebar-header h1 {
  font-size: 16px;
  font-weight: 700;
  color: #f9fafb;
  white-space: nowrap;
}
.map-area {
  flex: 1;
  height: 100%;
}
</style>
