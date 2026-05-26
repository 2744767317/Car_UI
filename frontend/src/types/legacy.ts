export interface LegacyPoint {
  x: number
  y: number
}

export interface LegacySnapshot {
  version?: number
  updatedAt?: number
  pcdFile?: string
  osmFile?: string
  startPoint?: LegacyPoint | null
  endPoint?: LegacyPoint | null
  carPosition?: LegacyPoint | null
  pathPoints?: LegacyPoint[]
  pathDistance?: number
  drivingMode?: string
  obstacleAvoidanceEnabled?: boolean
  renderMode?: string
  pointSize?: number
  currentFrame?: number
  isPlaying?: boolean
  gpsCalibration?: {
    lat0?: number
    lon0?: number
    worldX0?: number
    worldY0?: number
  } | null
  osmGeoRef?: Record<string, number> | null
  effectiveBounds?: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null
  osmSettings?: Record<string, unknown>
  mapScale?: number
  mapOffset?: {
    x: number
    y: number
  }
  endpointPickMode?: boolean
  gpsTrackingEnabled?: boolean
  selectedCoordinate?: {
    x: number
    y: number
    z: number
  }
}
