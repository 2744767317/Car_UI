import { carApi } from '../../services/car-api'
import { useLegacySnapshot } from '../../composables/useLegacySnapshot'
import type { BridgeGpsState, BridgeRouteState, VehicleBridgeProvider } from '../types'

export const createLegacyProvider = (): VehicleBridgeProvider => {
  const { snapshot, patchSnapshot } = useLegacySnapshot()

  const getRouteState = (): BridgeRouteState => {
    const data = snapshot.value
    const start = data?.startPoint ?? null
    const end = data?.endPoint ?? null
    const pathPoints = Array.isArray(data?.pathPoints) ? data.pathPoints : []
    const pathDistance = Number(data?.pathDistance) || 0

    return {
      start,
      end,
      pathPoints,
      pathDistance,
      canSubmit: !!start && !!end && pathPoints.length >= 2,
    }
  }

  const getGpsState = (): BridgeGpsState => {
    const data = snapshot.value
    return {
      currentPoint: data?.selectedCoordinate ?? null,
      calibrationReady: !!data?.gpsCalibration,
      trackingEnabled: !!data?.gpsTrackingEnabled,
      source: 'legacy',
    }
  }

  const syncStartPoint = async () => {
    const data = snapshot.value
    const selected = data?.selectedCoordinate ?? data?.startPoint ?? null
    if (!selected) return false
    patchSnapshot({ startPoint: selected, carPosition: selected })
    return true
  }

  const calibrateAtCurrentPoint = async () => {
    patchSnapshot({ gpsCalibration: snapshot.value?.gpsCalibration ?? null })
    return true
  }

  const toggleTracking = async () => {
    const next = !getGpsState().trackingEnabled
    patchSnapshot({ gpsTrackingEnabled: next })
    return true
  }

  const submitRoute = async () => {
    const route = getRouteState()
    if (!route.canSubmit || !route.start || !route.end) return false

    await carApi.submitRoute({
      start: route.start,
      end: route.end,
      path: route.pathPoints,
      timestamp: Date.now(),
    })
    return true
  }

  return {
    kind: 'legacy-readwrite',
    getRouteState,
    getGpsState,
    syncStartPoint,
    calibrateAtCurrentPoint,
    toggleTracking,
    submitRoute,
  }
}
