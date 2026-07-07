<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="dialog">
        <!-- Step 1: upload / parsing -->
        <template v-if="step === 'idle'">
          <h2>导入 Apple 健康数据</h2>
          <p class="hint">
            iPhone → 健康 App → 右上角头像 → 拉到底部「导出所有健康数据」→ 导出 zip 文件
          </p>
          <div
            class="dropzone"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
            @click="fileInput?.click()"
          >
            <input ref="fileInput" type="file" accept=".zip" style="display:none" @change="onFileChange" />
            <div class="drop-label">拖入 export.zip，或点击选择</div>
          </div>
        </template>

        <template v-else-if="step === 'parsing'">
          <h2>正在解析…</h2>
          <p class="hint">从 zip 中读取轨迹文件，请稍候</p>
          <div class="spinner" />
        </template>

        <template v-else-if="step === 'error'">
          <h2>解析失败</h2>
          <p class="error-msg">{{ errorMsg }}</p>
          <button class="btn-secondary" @click="reset">重试</button>
        </template>

        <!-- Step 2: filter & select -->
        <template v-else-if="step === 'select'">
          <h2>选择轨迹</h2>

          <!-- Filter mode tabs -->
          <div class="filter-tabs">
            <button
              v-for="m in FILTER_MODES"
              :key="m.id"
              :class="['tab', { active: filterMode === m.id }]"
              @click="filterMode = m.id; refreshFiltered()"
            >
              {{ m.label }}
            </button>
          </div>

          <!-- Latest -->
          <div v-if="filterMode === 'latest'" class="filter-section">
            <p class="hint">自动选中最新一条轨迹</p>
          </div>

          <!-- By year/month -->
          <div v-else-if="filterMode === 'month'" class="filter-section filter-row">
            <select v-model="selYear" @change="onYearChange">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
            </select>
            <select v-model="selMonth" @change="refreshFiltered">
              <option :value="null">全年</option>
              <option v-for="m in availableMonths" :key="m" :value="m">{{ m }} 月</option>
            </select>
          </div>

          <!-- By week -->
          <div v-else-if="filterMode === 'week'" class="filter-section filter-row">
            <select v-model="selYear" @change="onYearChange">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
            </select>
            <select v-model="selWeek" @change="refreshFiltered">
              <option v-for="w in availableWeeks" :key="w" :value="w">第 {{ w }} 周</option>
            </select>
          </div>

          <!-- By distance -->
          <div v-else-if="filterMode === 'distance'" class="filter-section filter-row">
            <select v-model="selDistRange" @change="refreshFiltered">
              <option value="">全部距离</option>
              <option value="0-5">0–5 km</option>
              <option value="5-15">5–15 km</option>
              <option value="15-30">15–30 km</option>
              <option value="30+">30+ km</option>
            </select>
          </div>

          <!-- Track list -->
          <div class="track-list">
            <div v-if="filtered.length === 0" class="empty">该范围内没有轨迹</div>
            <label
              v-for="t in filtered"
              :key="t.filename"
              :class="['track-row', { selected: selectedFiles.has(t.filename) }]"
            >
              <input
                type="checkbox"
                :checked="selectedFiles.has(t.filename)"
                @change="toggleSelect(t)"
              />
              <div class="track-info">
                <div class="track-name">{{ t.name }}</div>
                <div class="track-meta">
                  {{ formatDate(t.date) }}
                  <span v-if="t.durationMin > 0"> · {{ formatDuration(t.durationMin) }}</span>
                  <span v-if="t.distanceKm > 0"> · ~{{ t.distanceKm }} km</span>
                </div>
              </div>
            </label>
          </div>

          <div class="dialog-footer">
            <span class="selected-count">已选 {{ selectedFiles.size }} 条</span>
            <button class="btn-secondary" @click="close">取消</button>
            <button
              class="btn-primary"
              :disabled="selectedFiles.size === 0"
              @click="importSelected"
            >
              导入
            </button>
          </div>
        </template>

        <!-- Step 3: importing -->
        <template v-else-if="step === 'importing'">
          <h2>导入中…</h2>
          <p class="hint">{{ importProgress }}</p>
          <div class="spinner" />
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  parseHealthZip,
  filterByYearMonth,
  filterByWeek,
  getAvailableYears,
  getAvailableMonths,
  getAvailableWeeks,
  type TrackMeta,
} from '@/lib/zipImporter'
import { parseGpx, sha1 } from '@/lib/gpxParser'
import { calcStats } from '@/lib/stats'
import { saveTrack, listTracks } from '@/lib/storage'
import { useTrackStore } from '@/state/trackStore'
import { nextTick } from 'vue'

const store = useTrackStore()

const visible = ref(false)
const step = ref<'idle' | 'parsing' | 'error' | 'select' | 'importing'>('idle')
const errorMsg = ref('')
const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()

const allTracks = ref<TrackMeta[]>([])
const filtered = ref<TrackMeta[]>([])
const selectedFiles = ref<Set<string>>(new Set())
const importProgress = ref('')

type FilterMode = 'latest' | 'month' | 'week' | 'distance'
const filterMode = ref<FilterMode>('latest')

const FILTER_MODES = [
  { id: 'latest' as FilterMode, label: '最新一条' },
  { id: 'month' as FilterMode, label: '按年月' },
  { id: 'week' as FilterMode, label: '按周' },
  { id: 'distance' as FilterMode, label: '按距离' },
]

type DistRange = '' | '0-5' | '5-15' | '15-30' | '30+'
const selDistRange = ref<DistRange>('')

const availableYears = computed(() => getAvailableYears(allTracks.value))
const availableMonths = computed(() => getAvailableMonths(allTracks.value, selYear.value ?? 0))
const availableWeeks = computed(() => getAvailableWeeks(allTracks.value, selYear.value ?? 0))

const selYear = ref<number>(new Date().getFullYear())
const selMonth = ref<number | null>(null)
const selWeek = ref<number>(1)

function open(file?: File) {
  visible.value = true
  if (file) processFile(file)
}
function close() { visible.value = false; reset() }
defineExpose({ open })

function reset() {
  step.value = 'idle'
  allTracks.value = []
  filtered.value = []
  selectedFiles.value = new Set()
  filterMode.value = 'latest'
  selDistRange.value = ''
  errorMsg.value = ''
}

function refreshFiltered() {
  selectedFiles.value = new Set()
  if (filterMode.value === 'latest') {
    filtered.value = allTracks.value.slice(0, 1)
  } else if (filterMode.value === 'month') {
    filtered.value = filterByYearMonth(allTracks.value, selYear.value, selMonth.value)
  } else if (filterMode.value === 'week') {
    filtered.value = filterByWeek(allTracks.value, selYear.value, selWeek.value)
  } else {
    filtered.value = allTracks.value.filter((t) => {
      const km = t.distanceKm
      if (selDistRange.value === '0-5') return km < 5
      if (selDistRange.value === '5-15') return km >= 5 && km < 15
      if (selDistRange.value === '15-30') return km >= 15 && km < 30
      if (selDistRange.value === '30+') return km >= 30
      return true
    })
  }
  // default: none selected (user picks what they want)
}

function onYearChange() {
  selMonth.value = null
  selWeek.value = availableWeeks.value[0] ?? 1
  refreshFiltered()
}

function toggleSelect(t: TrackMeta) {
  if (selectedFiles.value.has(t.filename)) {
    selectedFiles.value.delete(t.filename)
  } else {
    selectedFiles.value.add(t.filename)
  }
}

async function processFile(file: File) {
  step.value = 'parsing'
  try {
    const tracks = await parseHealthZip(file)
    if (tracks.length === 0) {
      errorMsg.value = 'zip 中未找到轨迹文件（workout-routes/*.gpx）。请确认是从 iPhone 健康 App 导出的完整 zip。'
      step.value = 'error'
      return
    }
    allTracks.value = tracks
    // Wait for computed (availableYears/availableMonths/availableWeeks) to
    // re-evaluate against the new allTracks before reading their values
    await nextTick()
    selYear.value = availableYears.value[0] ?? new Date().getFullYear()
    selMonth.value = null
    selWeek.value = availableWeeks.value[0] ?? 1
    step.value = 'select'
    refreshFiltered()
  } catch (e) {
    errorMsg.value = (e as Error).message || '解析失败'
    step.value = 'error'
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) processFile(file)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}

async function importSelected() {
  const toImport = allTracks.value.filter((t) => selectedFiles.value.has(t.filename))
  if (toImport.length === 0) return
  step.value = 'importing'
  let lastImported: { track: ReturnType<typeof parseGpx>; stats: ReturnType<typeof calcStats>; id: string } | null = null

  for (let i = 0; i < toImport.length; i++) {
    const meta = toImport[i]
    importProgress.value = `${i + 1} / ${toImport.length}：${meta.name}`
    try {
      const id = await sha1(meta.gpxText)
      const track = parseGpx(meta.gpxText)
      const stats = calcStats(track.points, track.geojson)
      await saveTrack({ id, name: track.name, importedAt: Date.now(), workoutDate: meta.date.getTime(), rawGpxText: meta.gpxText, parsedTrack: track, stats })
      lastImported = { track, stats, id }
    } catch {
      // skip broken files silently
    }
  }

  store.savedTracks = await listTracks()
  if (lastImported) {
    store.setActiveTrack(lastImported.track, lastImported.stats, lastImported.id)
  }
  close()
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const WEEKDAYS = ['日','一','二','三','四','五','六']

function formatDate(d: Date): string {
  if (d.getTime() === 0) return '未知日期'
  return `${d.getFullYear()} 年 ${MONTHS[d.getMonth()]} ${d.getDate()} 日（周${WEEKDAYS[d.getDay()]}）`
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m}m` : `${m} 分钟`
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #1f2937;
  border-radius: 12px;
  padding: 24px;
  width: 520px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}
h2 {
  font-size: 18px;
  font-weight: 700;
  color: #f9fafb;
  margin: 0;
}
.hint {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.error-msg {
  font-size: 13px;
  color: #f87171;
  line-height: 1.5;
}
.dropzone {
  border: 2px dashed #4b5563;
  border-radius: 8px;
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  background: #11182740;
  transition: border-color 0.2s, background 0.2s;
}
.dropzone.dragging { border-color: #60a5fa; background: #1e40af30; }
.drop-label { font-size: 14px; color: #9ca3af; }

.filter-tabs {
  display: flex;
  gap: 6px;
}
.tab {
  padding: 5px 14px;
  border: 1px solid #374151;
  border-radius: 16px;
  background: #111827;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.tab:hover { border-color: #60a5fa; color: #f9fafb; }
.tab.active { border-color: #3b82f6; background: #1e40af; color: white; }

.filter-section { min-height: 32px; }
.filter-row {
  display: flex;
  gap: 8px;
}
select {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #f9fafb;
  padding: 5px 10px;
  font-size: 13px;
  cursor: pointer;
}

.track-list {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}
.empty { font-size: 13px; color: #6b7280; padding: 12px 0; }
.track-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s;
}
.track-row:hover { background: #374151; }
.track-row.selected { border-color: #3b82f640; background: #1e40af20; }
.track-row input[type=checkbox] { margin-top: 3px; accent-color: #3b82f6; flex-shrink: 0; }
.track-info { flex: 1; min-width: 0; }
.track-name { font-size: 13px; color: #f9fafb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-meta { font-size: 11px; color: #6b7280; margin-top: 2px; }

.dialog-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #374151;
}
.selected-count { flex: 1; font-size: 12px; color: #6b7280; }
.btn-secondary, .btn-primary {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-secondary { background: #374151; color: #d1d5db; }
.btn-secondary:hover { background: #4b5563; }
.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { background: #1e3a5f; color: #6b7280; cursor: not-allowed; }

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #374151;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 16px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
