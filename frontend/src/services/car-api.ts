import { runtimeAppConfig } from '../config/app-config'
import { requestJson, withBaseUrl } from './http'

export interface GpsPayload {
  x?: number
  y?: number
  lon?: number
  lat?: number
  longitude?: number
  latitude?: number
  posX?: number
  posY?: number
  positionX?: number
  positionY?: number
  east?: number
  north?: number
  easting?: number
  northing?: number
  [key: string]: unknown
}

export interface RouteSubmitPayload {
  start: { x: number; y: number }
  end: { x: number; y: number }
  path: Array<{ x: number; y: number }>
  timestamp: number
}

export const carApi = {
  async getGpsCurrent(): Promise<GpsPayload> {
    const { backend } = runtimeAppConfig
    if (!backend.gpsEndpoint) {
      throw new Error('GPS 接口未配置')
    }

    const url = withBaseUrl(backend.apiBaseUrl, backend.gpsEndpoint)
    return requestJson<GpsPayload>(url, {
      method: backend.gpsMethod || 'GET',
      headers: backend.headers,
    })
  },

  async submitRoute(payload: RouteSubmitPayload): Promise<void> {
    const { backend } = runtimeAppConfig
    if (!backend.routeEndpoint) return

    const url = withBaseUrl(backend.apiBaseUrl, backend.routeEndpoint)
    await requestJson<void>(url, {
      method: 'POST',
      headers: backend.headers,
      json: payload,
    })
  },
}

export type CarApi = typeof carApi
