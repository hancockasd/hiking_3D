<template>
  <div class="app">
    <aside :class="['sidebar', { collapsed: sidebarCollapsed }]">
      <div class="sidebar-header">
        <h1 v-if="!sidebarCollapsed">徒步轨迹 3D</h1>
        <UserMenu v-if="!sidebarCollapsed" />
      </div>
      <div v-if="!sidebarCollapsed" class="sidebar-body">
        <FileDropzone />
        <TrackListSidebar />
        <StatsPanel />
        <ElevationChart />
        <FlyoverControls />
        <BasemapSwitcher />
      </div>
    </aside>

    <!-- Toggle button sits on the border between sidebar and map -->
    <button
      class="sidebar-toggle"
      :style="{ left: sidebarCollapsed ? '0px' : '300px' }"
      :class="{ 'collapsed-side': sidebarCollapsed }"
      @click="sidebarCollapsed = !sidebarCollapsed"
      :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
    >
      {{ sidebarCollapsed ? '▶' : '◀' }}
    </button>

    <main class="map-area">
      <MapCanvas />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
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
const sidebarCollapsed = ref(false)

onMounted(async () => {
  await auth.initAuth()
  store.savedTracks = await listTracks()

  // Sync from cloud whenever logged in (covers both page load and fresh login)
  if (auth.loggedIn.value) {
    triggerCloudSync()
  }
})

async function triggerCloudSync() {
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

watch(
  () => auth.loggedIn.value,
  async (loggedIn) => {
    if (loggedIn) triggerCloudSync()
  },
)
</script>

<style scoped>
.app {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  position: relative;
  background: var(--bg);
}
.sidebar {
  width: 300px;
  min-width: 300px;
  height: 100%;
  overflow-y: auto;
  background: var(--sb);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--sb-border);
  transition: width 0.2s ease, min-width 0.2s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}
.sidebar.collapsed {
  width: 0;
  min-width: 0;
  overflow: hidden;
  border-right: none;
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--sb-border);
  gap: 8px;
  flex-shrink: 0;
  background: var(--sb-header);
}
.sidebar-header h1 {
  font-size: 15px;
  font-weight: 600;
  color: var(--sb-ink);
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.sidebar-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.sidebar-toggle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  width: 16px;
  height: 40px;
  background: var(--sb);
  border: 1px solid var(--sb-border);
  border-left: none;
  border-radius: 0 4px 4px 0;
  color: var(--sb-ink3);
  font-size: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 0.2s ease, background 0.15s;
  padding: 0;
  line-height: 1;
  box-shadow: 2px 0 6px rgba(0,0,0,0.2);
}
.sidebar-toggle:hover {
  background: var(--sb-hover);
  color: var(--sb-ink);
}
.sidebar-toggle.collapsed-side {
  border-left: 1px solid var(--border);
  border-right: none;
  border-radius: 4px 0 0 4px;
  background: var(--white);
  color: var(--ink4);
}
.app:has(.sidebar.collapsed) .sidebar-toggle {
  left: 0;
  border-left: 1px solid var(--border);
  border-right: none;
  border-radius: 4px 0 0 4px;
  background: var(--white);
  color: var(--ink4);
}
.map-area {
  flex: 1;
  height: 100%;
  min-width: 0;
}
</style>

