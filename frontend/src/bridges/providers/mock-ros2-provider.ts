import type { VehicleBridgeProvider } from '../types'

export const createMockRos2Provider = (): VehicleBridgeProvider => {
  let trackingEnabled = false

  return {
    kind: 'mock-ros2',
    getRouteState: () => ({
      start: { x: 0, y: 0 },
      end: { x: 10, y: 8 },
      pathPoints: [
        { x: 0, y: 0 },
        { x: 4, y: 3 },
        { x: 10, y: 8 },
      ],
      pathDistance: 12.8,
      canSubmit: true,
    }),
    getGpsState: () => ({
      currentPoint: { x: 4.2, y: 3.1 },
      calibrationReady: true,
      trackingEnabled,
      source: 'ros2-bridge',
    }),
    syncStartPoint: async () => true,
    calibrateAtCurrentPoint: async () => true,
    toggleTracking: async () => {
      trackingEnabled = !trackingEnabled
      return true
    },
    submitRoute: async () => true,
  }
}
