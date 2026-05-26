import type { LegacyPoint } from '../types/legacy'

export interface BridgeRouteState {
  start: LegacyPoint | null
  end: LegacyPoint | null
  pathPoints: LegacyPoint[]
  pathDistance: number
  canSubmit: boolean
}

export interface BridgeGpsState {
  currentPoint: LegacyPoint | null
  calibrationReady: boolean
  trackingEnabled: boolean
  source: string
}

export interface VehicleBridgeProvider {
  readonly kind: string
  getRouteState: () => BridgeRouteState
  getGpsState: () => BridgeGpsState
  syncStartPoint: () => Promise<boolean>
  calibrateAtCurrentPoint: () => Promise<boolean>
  toggleTracking: () => Promise<boolean>
  submitRoute: () => Promise<boolean>
}
