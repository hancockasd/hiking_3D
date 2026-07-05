import type { BasemapId } from '@/lib/coords'
import type { StyleSpecification } from 'maplibre-gl'

export interface BasemapOption {
  id: BasemapId
  label: string
  style: string | StyleSpecification
  coordSystem: 'WGS84' | 'GCJ02'
}

const AMAP_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'amap-satellite': {
      type: 'raster',
      tiles: [
        'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        'https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        'https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '© 高德地图 AutoNavi（个人使用）',
    },
  },
  layers: [{ id: 'amap-satellite', type: 'raster', source: 'amap-satellite' }],
}

export const BASEMAPS: BasemapOption[] = [
  {
    id: 'maplibre',
    label: 'MapLibre 地形',
    style: 'https://demotiles.maplibre.org/style.json',
    coordSystem: 'WGS84',
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    coordSystem: 'WGS84',
  },
  {
    id: 'amap-satellite',
    label: '高德卫星（推荐）',
    style: AMAP_SATELLITE_STYLE,
    coordSystem: 'GCJ02',
  },
]
