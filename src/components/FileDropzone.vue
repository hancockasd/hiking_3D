<template>
  <div class="dropzone-wrapper">
    <div
      class="dropzone"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <input ref="fileInput" type="file" accept=".gpx,.zip" style="display:none" @change="onFileChange" />
      <div v-if="loading" class="state-msg">解析中…</div>
      <div v-else-if="error" class="state-msg err">{{ error }}</div>
      <div v-else class="state-idle">
        <svg class="up-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10 13V7m0 0L7.5 9.5M10 7l2.5 2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.5 13.5A3.5 3.5 0 0 0 7 17h6a3.5 3.5 0 0 0 0-7h-.5A5 5 0 1 0 3.5 13.5Z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="drop-primary">Drop GPX / ZIP, or click to browse</div>
        <div class="drop-sub">.gpx &nbsp;·&nbsp; .zip (Apple Health, Strava, Garmin)</div>
      </div>
    </div>
    <button class="help-btn" @click.stop="showHelp = !showHelp">?</button>
    <div v-if="showHelp" class="help-popover">
      <button class="pop-close" @click="showHelp = false">✕</button>
      <div class="pop-title">Export from Apple Health</div>
      <ol class="pop-steps">
        <li>Open the iPhone <strong>Health app</strong></li>
        <li>Tap your <strong>profile picture</strong> (top right)</li>
        <li>Scroll down → <strong>"Export All Health Data"</strong></li>
        <li>Drag the <code>export.zip</code> here</li>
      </ol>
    </div>
  </div>
  <ZipImportDialog ref="zipDialog" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { parseGpx, sha1 } from '@/lib/gpxParser'
import { calcStats } from '@/lib/stats'
import { saveTrack, listTracks } from '@/lib/storage'
import { useTrackStore } from '@/state/trackStore'
import ZipImportDialog from '@/components/ZipImportDialog.vue'

const store = useTrackStore()
const fileInput = ref<HTMLInputElement>()
const zipDialog = ref<InstanceType<typeof ZipImportDialog>>()
const dragging = ref(false)
const loading = ref(false)
const error = ref('')
const showHelp = ref(false)

async function handleFile(file: File) {
  error.value = ''
  if (file.name.endsWith('.zip')) { zipDialog.value?.open(file); return }
  if (!file.name.endsWith('.gpx')) { error.value = 'Please upload a .zip or .gpx file'; return }
  loading.value = true
  try {
    const text = await file.text()
    const id = await sha1(text)
    const track = parseGpx(text)
    const stats = calcStats(track.points, track.geojson)
    await saveTrack({ id, name: track.name, importedAt: Date.now(), rawGpxText: text, parsedTrack: track, stats })
    store.savedTracks = await listTracks()
    store.setActiveTrack(track, stats, id)
  } catch (e) {
    error.value = (e as Error).message || 'Failed to parse GPX'
  } finally {
    loading.value = false
    dragging.value = false
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}
</script>

<style scoped>
.dropzone-wrapper {
  position: relative;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sb-border);
}

.dropzone {
  border: 1px dashed var(--sb-border);
  border-radius: var(--r);
  padding: 16px 12px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}
.dropzone:hover { border-color: var(--sb-blue); background: var(--sb-blue-lt); }
.dropzone.dragging { border-color: var(--sb-blue); background: var(--sb-blue-lt); }

.state-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.up-icon {
  width: 20px;
  height: 20px;
  color: var(--sb-ink3);
  margin-bottom: 2px;
}

.drop-primary {
  font-size: 13px;
  font-weight: 500;
  color: var(--sb-ink2);
}

.drop-sub {
  font-size: 11px;
  color: var(--sb-ink3);
}

.state-msg { font-size: 13px; color: var(--sb-ink3); }
.state-msg.err { color: var(--sb-danger); }

.help-btn {
  position: absolute;
  top: 17px;
  right: 22px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 1px solid var(--sb-border);
  background: rgba(255,255,255,0.06);
  color: var(--sb-ink3);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: border-color 0.15s;
}
.help-btn:hover { border-color: var(--sb-blue); color: var(--sb-blue); }

.help-popover {
  position: absolute;
  top: 36px;
  right: 16px;
  width: 240px;
  background: #2a3347;
  border: 1px solid var(--sb-border);
  border-radius: var(--r);
  padding: 14px;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.pop-close {
  position: absolute;
  top: 8px; right: 10px;
  background: none; border: none;
  color: var(--sb-ink3); font-size: 12px; cursor: pointer;
}
.pop-close:hover { color: var(--sb-ink); }

.pop-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sb-ink);
  margin-bottom: 10px;
  padding-right: 14px;
}

.pop-steps {
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.pop-steps li { font-size: 12px; color: var(--sb-ink2); line-height: 1.5; }
.pop-steps strong { color: var(--sb-ink); font-weight: 600; }
.pop-steps code {
  font-size: 11px;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--sb-border);
  border-radius: 3px;
  padding: 0 3px;
  color: var(--sb-ink2);
}
</style>
