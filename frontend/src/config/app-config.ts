export type GpsSource = 'browser' | 'backend'
export type BridgeMode = 'legacy' | 'mock-ros2' | 'ros2-webbridge'

export interface BackendConfig {
  apiBaseUrl: string
  gpsEndpoint: string
  routeEndpoint: string
  gpsMethod: string
  headers: Record<string, string>
  useGpsOnSetEndpoint: boolean
  gpsSource: GpsSource
}

export interface ScenePreset {
  pcdFile: string
  osmFile: string
  startPoint: { x: number; y: number } | null
  osmSettings: {
    visible: boolean
    opacity: number
    scalePercent: number
    rotationDeg: number
    offsetX: number
    offsetY: number
  }
}

export interface RuntimeAppConfig {
  backend: BackendConfig
  scene: ScenePreset
  bridge: {
    mode: BridgeMode
    endpoint: string
    routeTopic: string
    gpsTopic: string
  }
}

const env = import.meta.env

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === null || value.trim() === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const toNum = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseJsonObject = (
  value: string | undefined,
  fallback: Record<string, string>,
): Record<string, string> => {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback

    const headers: Record<string, string> = {}
    for (const [key, raw] of Object.entries(parsed)) {
      if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
        headers[key] = String(raw)
      }
    }
    return headers
  } catch {
    return fallback
  }
}

const joinBase = (baseUrl: string | undefined, path: string): string => {
  if (!baseUrl || !baseUrl.trim()) return path
  if (/^https?:\/\//i.test(path)) return path

  const base = baseUrl.trim().replace(/\/+$/, '')
  const sub = path.startsWith('/') ? path : `/${path}`
  return `${base}${sub}`
}

const normalizeGpsSource = (value: string | undefined): GpsSource => {
  const normalized = (value || '').trim().toLowerCase()
  return normalized === 'backend' ? 'backend' : 'browser'
}

const normalizeBridgeMode = (value: string | undefined): BridgeMode => {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'mock-ros2') return 'mock-ros2'
  if (normalized === 'ros2-webbridge') return 'ros2-webbridge'
  return 'legacy'
}

export const runtimeAppConfig: RuntimeAppConfig = {
  backend: {
    apiBaseUrl: env.VITE_API_BASE_URL?.trim() || '',
    gpsEndpoint: joinBase(env.VITE_API_BASE_URL, env.VITE_GPS_ENDPOINT || '/api/gps/current'),
    routeEndpoint: joinBase(env.VITE_API_BASE_URL, env.VITE_ROUTE_ENDPOINT || '/api/route/submit'),
    gpsMethod: (env.VITE_GPS_METHOD || 'GET').toUpperCase(),
    headers: parseJsonObject(env.VITE_API_HEADERS_JSON, {}),
    useGpsOnSetEndpoint: toBool(env.VITE_USE_GPS_ON_SET_ENDPOINT, false),
    gpsSource: normalizeGpsSource(env.VITE_GPS_SOURCE),
  },
  scene: {
    pcdFile: env.VITE_SCENE_PCD_FILE || 'pointcloud_map.pcd',
    osmFile: env.VITE_SCENE_OSM_FILE || 'lanelet2_map.osm',
    startPoint: {
      x: toNum(env.VITE_SCENE_START_X, 0),
      y: toNum(env.VITE_SCENE_START_Y, 0),
    },
    osmSettings: {
      visible: toBool(env.VITE_OSM_VISIBLE, true),
      opacity: Math.max(0, Math.min(1, toNum(env.VITE_OSM_OPACITY, 0.8))),
      scalePercent: Math.max(1, toNum(env.VITE_OSM_SCALE_PERCENT, 100)),
      rotationDeg: toNum(env.VITE_OSM_ROTATION_DEG, 0),
      offsetX: toNum(env.VITE_OSM_OFFSET_X, 0),
      offsetY: toNum(env.VITE_OSM_OFFSET_Y, 0),
    },
  },
  bridge: {
    mode: normalizeBridgeMode(env.VITE_VEHICLE_BRIDGE_MODE),
    endpoint: env.VITE_ROS2_BRIDGE_ENDPOINT?.trim() || 'ws://127.0.0.1:9090',
    routeTopic: env.VITE_ROS2_ROUTE_TOPIC?.trim() || '/planning/mission_planning/route',
    gpsTopic: env.VITE_ROS2_GPS_TOPIC?.trim() || '/localization/kinematic_state',
  },
}
