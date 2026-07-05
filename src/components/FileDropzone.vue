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

      <div v-if="loading" class="state-text">解析中…</div>
      <div v-else-if="error" class="state-text err">{{ error }}</div>
      <div v-else class="state-text">
        <div class="icon">⬆</div>
        <div class="primary">拖入文件，或点击上传</div>
        <div class="accepts">支持 <code>.zip</code> / <code>.gpx</code></div>
      </div>
    </div>

    <!-- Help button -->
    <button class="help-btn" @click.stop="showHelp = !showHelp" title="如何导出数据">?</button>

    <!-- Help popover -->
    <div v-if="showHelp" class="help-popover">
      <button class="close-btn" @click="showHelp = false">×</button>
      <div class="help-title">如何导出 Apple Health 数据</div>
      <ol class="help-steps">
        <li>打开 iPhone <strong>健康 App</strong></li>
        <li>点击右上角<strong>头像</strong></li>
        <li>滚动到底部，点击<strong>「导出所有健康数据」</strong></li>
        <li>将导出的 <code>export.zip</code> 拖到上传区</li>
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
  if (file.name.endsWith('.zip')) {
    zipDialog.value?.open(file)
    return
  }
  if (!file.name.endsWith('.gpx')) {
    error.value = '请上传 .zip 或 .gpx 文件'
    return
  }
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
    error.value = (e as Error).message || 'GPX 解析失败'
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
}
.dropzone {
  border: 2px dashed #374151;
  border-radius: 10px;
  padding: 20px 16px;
  cursor: pointer;
  background: #0f172a;
  transition: border-color 0.2s, background 0.2s;
}
.dropzone.dragging {
  border-color: #60a5fa;
  background: #1e40af20;
}
.dropzone:hover {
  border-color: #4b5563;
}
.state-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  text-align: center;
}
.icon {
  font-size: 20px;
  color: #4b5563;
  line-height: 1;
}
.primary {
  font-size: 13px;
  font-weight: 600;
  color: #d1d5db;
}
.accepts {
  font-size: 11px;
  color: #6b7280;
}
.accepts code {
  background: #1f2937;
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
  color: #9ca3af;
}
.state-text.err {
  font-size: 12px;
  color: #f87171;
}

/* Help button */
.help-btn {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid #374151;
  background: #1f2937;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s;
  z-index: 1;
}
.help-btn:hover {
  border-color: #60a5fa;
  color: #93c5fd;
}

/* Help popover */
.help-popover {
  position: absolute;
  top: 34px;
  right: 0;
  width: 240px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 14px 14px 12px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.close-btn {
  position: absolute;
  top: 6px;
  right: 8px;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
.close-btn:hover { color: #f9fafb; }
.help-title {
  font-size: 12px;
  font-weight: 700;
  color: #f9fafb;
  margin-bottom: 10px;
  padding-right: 16px;
}
.help-steps {
  padding-left: 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.help-steps li {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.5;
}
.help-steps strong {
  color: #d1d5db;
}
.help-steps code {
  background: #111827;
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
  color: #93c5fd;
}
</style>
