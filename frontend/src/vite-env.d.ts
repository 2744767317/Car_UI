/// <reference types="vite/client" />
import type { RuntimeAppConfig } from './config/app-config'
import type { CarApi } from './services/car-api'
import type { LegacySnapshot } from './types/legacy'

declare global {
  interface Window {
    __CAR_RUNTIME_APP_CONFIG__?: RuntimeAppConfig
    __CAR_SERVICES__?: {
      carApi: CarApi
    }
    CARServices?: {
      carApi: CarApi
    }
    __CAR_LEGACY_APP__?: unknown
    __CAR_LEGACY_API__?: {
      getSnapshot?: () => LegacySnapshot
      buildSnapshot?: () => LegacySnapshot
      updateStartPointFromConfiguredGPS?: (showError?: boolean) => Promise<boolean>
      calibrateGpsAtCurrentCoordinate?: () => Promise<void>
      toggleGpsTracking?: () => void
      submitRouteToBackend?: () => Promise<void>
      setDrivingMode?: (mode: string) => void
      applyStartPoint?: (point: { x: number; y: number }) => boolean
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GPS_ENDPOINT?: string
  readonly VITE_ROUTE_ENDPOINT?: string
  readonly VITE_GPS_METHOD?: string
  readonly VITE_GPS_SOURCE?: string
  readonly VITE_USE_GPS_ON_SET_ENDPOINT?: string
  readonly VITE_API_HEADERS_JSON?: string
  readonly VITE_VEHICLE_BRIDGE_MODE?: string
  readonly VITE_ROS2_BRIDGE_ENDPOINT?: string
  readonly VITE_ROS2_ROUTE_TOPIC?: string
  readonly VITE_ROS2_GPS_TOPIC?: string

  readonly VITE_SCENE_PCD_FILE?: string
  readonly VITE_SCENE_OSM_FILE?: string
  readonly VITE_SCENE_START_X?: string
  readonly VITE_SCENE_START_Y?: string

  readonly VITE_OSM_VISIBLE?: string
  readonly VITE_OSM_OPACITY?: string
  readonly VITE_OSM_SCALE_PERCENT?: string
  readonly VITE_OSM_ROTATION_DEG?: string
  readonly VITE_OSM_OFFSET_X?: string
  readonly VITE_OSM_OFFSET_Y?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
