import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ParsedTrack } from '@/lib/gpxParser'
import type { TrackStats } from '@/lib/stats'
import type { StoredTrack } from '@/lib/storage'
import type { BasemapId } from '@/lib/coords'

export const useTrackStore = defineStore('track', () => {
  // Active track (WGS84 always)
  const activeTrack = ref<ParsedTrack | null>(null)
  const activeStats = ref<TrackStats | null>(null)
  const activeId = ref<string | null>(null)

  // Saved track list (from IndexedDB — refreshed via listTracks / syncFromCloud)
  const savedTracks = ref<StoredTrack[]>([])

  // Cloud sync status
  const syncStatus = ref<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const syncMessage = ref('')

  // UI state
  const activeBasemap = ref<BasemapId>('amap-satellite')
  const isFlyoverPlaying = ref(false)
  const flyoverProgress = ref(0) // 0..1
  const flyoverSpeed = ref(1)
  const trackChangeSeq = ref(0) // increments on every setActiveTrack call

  const hasTrack = computed(() => activeTrack.value !== null)

  function setActiveTrack(track: ParsedTrack, stats: TrackStats, id: string) {
    activeTrack.value = track
    activeStats.value = stats
    activeId.value = id
    trackChangeSeq.value++
  }

  function clearActiveTrack() {
    activeTrack.value = null
    activeStats.value = null
    activeId.value = null
    isFlyoverPlaying.value = false
    flyoverProgress.value = 0
  }

  return {
    activeTrack,
    activeStats,
    activeId,
    savedTracks,
    syncStatus,
    syncMessage,
    activeBasemap,
    isFlyoverPlaying,
    flyoverProgress,
    flyoverSpeed,
    trackChangeSeq,
    hasTrack,
    setActiveTrack,
    clearActiveTrack,
  }
})
