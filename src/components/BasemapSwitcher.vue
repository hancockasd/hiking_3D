<template>
  <div class="basemap-switcher">
    <button
      v-for="b in BASEMAPS"
      :key="b.id"
      :class="['btn', { active: store.activeBasemap === b.id }]"
      @click="store.activeBasemap = b.id"
    >
      {{ b.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTrackStore } from '@/state/trackStore'
import { BASEMAPS } from '@/styles/mapStyles'

const store = useTrackStore()
</script>

<style scoped>
.basemap-switcher {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.btn {
  padding: 4px 10px;
  border: 1px solid #374151;
  border-radius: 16px;
  background: #1f2937;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover { border-color: #60a5fa; color: #f9fafb; }
.btn.active { border-color: #3b82f6; background: #1e40af; color: white; }
</style>
