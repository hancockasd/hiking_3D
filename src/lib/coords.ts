import gcoord from 'gcoord'

export type BasemapId = 'maplibre' | 'osm' | 'amap-satellite' | 'mapbox-satellite'

// GCJ-02 basemaps that need coordinate conversion
const GCJ02_BASEMAPS = new Set<BasemapId>(['amap-satellite'])

export function needsConversion(basemap: BasemapId): boolean {
  return GCJ02_BASEMAPS.has(basemap)
}

export function wgs84ToGcj02(lon: number, lat: number): [number, number] {
  const result = gcoord.transform([lon, lat], gcoord.WGS84, gcoord.GCJ02)
  return [result[0], result[1]]
}

export function convertCoords(
  coords: [number, number, number][],
  basemap: BasemapId,
): [number, number, number][] {
  if (!needsConversion(basemap)) return coords
  return coords.map(([lon, lat, ele]) => {
    const [clon, clat] = wgs84ToGcj02(lon, lat)
    return [clon, clat, ele]
  })
}
