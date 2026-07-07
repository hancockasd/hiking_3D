import { get, set, del, keys } from 'idb-keyval'
import type { ParsedTrack } from './gpxParser'
import type { TrackStats } from './stats'
import { parseGpx } from './gpxParser'
import { calcStats } from './stats'
import { isLoggedIn, apiSaveTrack, apiListTracks, apiDeleteTrack } from './api'

export interface StoredTrack {
  id: string // SHA-1 of GPX text
  name: string
  importedAt: number
  workoutDate?: number // unix ms of actual workout start; may be absent on old records
  rawGpxText: string
  parsedTrack: ParsedTrack
  stats: TrackStats
}

const PREFIX = 'track:'

// ── Local IndexedDB operations ─────────────────────

async function localSave(track: StoredTrack): Promise<void> {
  await set(PREFIX + track.id, track)
}

async function localDelete(id: string): Promise<void> {
  await del(PREFIX + id)
}

async function localList(): Promise<StoredTrack[]> {
  const allKeys = await keys<string>()
  const trackKeys = allKeys.filter((k) => k.startsWith(PREFIX))
  const tracks = await Promise.all(trackKeys.map((k) => get<StoredTrack>(k)))
  return (tracks.filter(Boolean) as StoredTrack[]).sort((a, b) => b.importedAt - a.importedAt)
}

// ── Cloud-aware public API ─────────────────────────

/**
 * 保存轨迹：始终写入本地 IndexedDB；若已登录则同步到 LeanCloud。
 * 云端同步失败不影响本地保存。
 */
export async function saveTrack(track: StoredTrack): Promise<void> {
  // Save locally — always
  await localSave(track)

  // Sync to cloud if logged in
  if (isLoggedIn()) {
    try {
      await apiSaveTrack({
        id: track.id,
        name: track.name,
        importedAt: track.importedAt,
        workoutDate: track.workoutDate,
        rawGpxText: track.rawGpxText,
        stats: track.stats,
      })
    } catch (e) {
      console.warn('云端同步保存失败，已保存到本地', e)
    }
  }
}

/**
 * 获取轨迹列表：从本地 IndexedDB 读取。
 * 登录状态下，建议先调用 syncFromCloud() 刷新本地缓存。
 */
export async function listTracks(): Promise<StoredTrack[]> {
  return localList()
}

/**
 * 加载单条轨迹（从本地）。
 */
export async function loadTrack(id: string): Promise<StoredTrack | undefined> {
  return get<StoredTrack>(PREFIX + id)
}

/**
 * 删除轨迹：始终删除本地；若已登录则同步删除云端。
 */
export async function deleteTrack(id: string): Promise<void> {
  await localDelete(id)

  if (isLoggedIn()) {
    try {
      await apiDeleteTrack(id)
    } catch (e) {
      console.warn('云端同步删除失败', e)
    }
  }
}

/**
 * 从 LeanCloud 云端拉取所有轨迹，并与本地 IndexedDB 合并。
 * LeanCloud list 接口已包含完整数据（含 rawGpxText），无需二次请求。
 * 仅在已登录时有效。
 *
 * @returns 同步后本地轨迹总数
 */
export async function syncFromCloud(
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<number> {
  if (!isLoggedIn()) return (await localList()).length

  // Fetch cloud state once
  const result = await apiListTracks()
  if (!result.ok || !result.data) {
    console.warn('云端轨迹列表加载失败:', result.error)
    return (await localList()).length
  }

  const cloudTracks = result.data
  const cloudIds = new Set(cloudTracks.map((t) => t.trackId))
  const localSnapshot = await localList()
  const localIds = new Set(localSnapshot.map((t) => t.id))

  // Step 1: push local-only tracks up to cloud
  const localOnly = localSnapshot.filter((t) => !cloudIds.has(t.id))
  for (const t of localOnly) {
    try {
      await apiSaveTrack({
        id: t.id,
        name: t.name,
        importedAt: t.importedAt,
        workoutDate: t.workoutDate,
        rawGpxText: t.rawGpxText,
        stats: t.stats,
      })
    } catch (e) {
      console.warn(`推送轨迹 "${t.name}" 到云端失败:`, e)
    }
  }

  // Step 2: reconcile local — remove deleted, download missing
  for (const local of localSnapshot) {
    if (!cloudIds.has(local.id)) {
      await localDelete(local.id)
    }
  }

  // Step 3: download cloud tracks missing from local
  let synced = 0
  for (let i = 0; i < cloudTracks.length; i++) {
    const ct = cloudTracks[i]
    onProgress?.(i + 1, cloudTracks.length, ct.name)

    if (localIds.has(ct.trackId)) {
      synced++
      continue
    }

    try {
      if (!ct.rawGpxText) continue
      const parsed = parseGpx(ct.rawGpxText)
      const stats = calcStats(parsed.points, parsed.geojson)
      await localSave({
        id: ct.trackId,
        name: ct.name,
        importedAt: ct.importedAt,
        workoutDate: ct.workoutDate,
        rawGpxText: ct.rawGpxText,
        parsedTrack: parsed,
        stats,
      })
      synced++
    } catch (e) {
      console.warn(`同步轨迹 "${ct.name}" 失败:`, e)
    }
  }

  return synced
}
