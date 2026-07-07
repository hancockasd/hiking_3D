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
  gap: 5px;
  flex-wrap: wrap;
  padding: 12px 16px;
}
.btn {
  padding: 4px 10px;
  border: 1px solid var(--sb-border);
  background: transparent;
  color: var(--sb-ink3);
  font-size: 12px;
  border-radius: var(--r);
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover { border-color: var(--sb-ink3); color: var(--sb-ink); }
.btn.active { border-color: var(--sb-blue-bd); background: var(--sb-blue-lt); color: var(--sb-blue); }
</style>
