import { computed, ref } from 'vue'
import { useVehicleBridge } from './useVehicleBridge'

export const useGpsControl = () => {
  const bridge = useVehicleBridge()

  const busy = ref(false)
  const error = ref('')
  const lastAction = ref('')

  const gpsSource = computed(() => bridge.gpsState.value.source)
  const calibration = computed(() =>
    bridge.gpsState.value.calibrationReady ? ({ ready: true } as const) : null,
  )
  const currentPoint = computed(() => bridge.gpsState.value.currentPoint)
  const trackingEnabled = computed(() => bridge.gpsState.value.trackingEnabled)
  const providerKind = computed(() => bridge.providerKind.value)

  const syncStartPoint = async () => {
    busy.value = true
    error.value = ''
    try {
      const ok = await bridge.syncStartPoint()
      lastAction.value = ok ? '已同步起点到桥接层' : '未找到可同步起点'
      return ok
    } catch (err) {
      error.value = err instanceof Error ? err.message : '同步起点失败'
      return false
    } finally {
      busy.value = false
    }
  }

  const calibrateAtCurrentPoint = async () => {
    busy.value = true
    error.value = ''
    try {
      const ok = await bridge.calibrateAtCurrentPoint()
      lastAction.value = ok ? 'GPS校准已触发' : 'GPS校准未执行'
      return ok
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'GPS校准失败'
      return false
    } finally {
      busy.value = false
    }
  }

  const toggleTracking = async () => {
    busy.value = true
    error.value = ''
    try {
      const wasEnabled = trackingEnabled.value
      const ok = await bridge.toggleTracking()
      if (ok) {
        lastAction.value = wasEnabled ? '关闭GPS跟踪' : '开启GPS跟踪'
      } else {
        lastAction.value = 'GPS跟踪未切换'
      }
      return ok
    } catch (err) {
      error.value = err instanceof Error ? err.message : '切换GPS跟踪失败'
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    error,
    lastAction,
    gpsSource,
    calibration,
    currentPoint,
    trackingEnabled,
    providerKind,
    syncStartPoint,
    calibrateAtCurrentPoint,
    toggleTracking,
  }
}
