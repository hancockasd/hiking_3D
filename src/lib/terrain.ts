import type { RasterDEMSourceSpecification, TerrainSpecification } from 'maplibre-gl'

export const AWS_TERRARIUM_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 15,
  attribution: '© Mapzen, USGS, SRTM, EU-DEM',
}

export const TERRAIN_CONFIG: TerrainSpecification = {
  source: 'terrain-dem',
  exaggeration: 1.5,
}
