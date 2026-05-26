import { runtimeAppConfig } from '../../config/app-config'
import { useLegacySnapshot } from '../../composables/useLegacySnapshot'
import type { LegacyPoint } from '../../types/legacy'
import type { BridgeGpsState, BridgeRouteState, VehicleBridgeProvider } from '../types'

type RosbridgeMessage = {
  op?: string
  topic?: string
  msg?: Record<string, unknown>
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const readNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

const toPointFromRosMsg = (msg: Record<string, unknown>): LegacyPoint | null => {
  const pose = asRecord(msg.pose)
  const posePose = asRecord(pose?.pose)
  const position = asRecord(posePose?.position)
  const directPosition = asRecord(msg.position)

  const x = readNumber(position?.x, directPosition?.x, msg.x)
  const y = readNumber(position?.y, directPosition?.y, msg.y)
  if (x === null || y === null) return null
  return { x, y }
}

const buildRoutePayload = (route: BridgeRouteState) => ({
  header: {
    stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 },
    frame_id: 'map',
  },
  route: route.pathPoints.map((point) => ({
    pose: {
      position: { x: point.x, y: point.y, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    },
  })),
  start: route.start,
  goal: route.end,
})

export const createRos2WebBridgeProvider = (): VehicleBridgeProvider => {
  const { snapshot } = useLegacySnapshot()
  const cfg = runtimeAppConfig.bridge

  let ws: WebSocket | null = null
  let wsConnected = false
  let trackingEnabled = false
  let lastGpsPoint: LegacyPoint | null = null

  const send = (payload: Record<string, unknown>) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(payload))
    return true
  }

  const ensureSocket = () => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    ws = new WebSocket(cfg.endpoint)

    ws.addEventListener('open', () => {
      wsConnected = true
      send({
        op: 'subscribe',
        topic: cfg.gpsTopic,
      })
    })

    ws.addEventListener('close', () => {
      wsConnected = false
    })

    ws.addEventListener('error', () => {
      wsConnected = false
    })

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(String(event.data || '{}')) as RosbridgeMessage
        if (data.topic !== cfg.gpsTopic) return
        const msg = asRecord(data.msg)
        if (!msg) return

        const point = toPointFromRosMsg(msg)
        if (point) {
          lastGpsPoint = point
        }
      } catch {
        // ignore malformed ROS bridge messages
      }
    })
  }

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
    const fallback = data?.selectedCoordinate ?? null

    return {
      currentPoint: lastGpsPoint ?? fallback,
      calibrationReady: !!data?.gpsCalibration,
      trackingEnabled,
      source: wsConnected ? 'ros2-webbridge' : 'ros2-webbridge(disconnected)',
    }
  }

  const syncStartPoint = async () => {
    const point = getGpsState().currentPoint
    if (!point) return false

    send({
      op: 'publish',
      topic: cfg.gpsTopic,
      msg: {
        position: { x: point.x, y: point.y, z: 0 },
      },
    })

    return true
  }

  const calibrateAtCurrentPoint = async () => true

  const toggleTracking = async () => {
    ensureSocket()
    trackingEnabled = !trackingEnabled

    if (!trackingEnabled) {
      send({ op: 'unsubscribe', topic: cfg.gpsTopic })
      return true
    }

    return send({ op: 'subscribe', topic: cfg.gpsTopic })
  }

  const submitRoute = async () => {
    ensureSocket()
    const route = getRouteState()
    if (!route.canSubmit) return false

    const payload = buildRoutePayload(route)
    return send({
      op: 'publish',
      topic: cfg.routeTopic,
      msg: payload,
    })
  }

  ensureSocket()

  return {
    kind: 'ros2-webbridge',
    getRouteState,
    getGpsState,
    syncStartPoint,
    calibrateAtCurrentPoint,
    toggleTracking,
    submitRoute,
  }
}
