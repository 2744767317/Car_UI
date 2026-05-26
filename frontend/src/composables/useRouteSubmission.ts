import { computed, ref } from 'vue'
import { useVehicleBridge } from './useVehicleBridge'

export const useRouteSubmission = () => {
  const bridge = useVehicleBridge()
  const busy = ref(false)
  const error = ref('')
  const lastResult = ref('')

  const routeState = computed(() => bridge.routeState.value)
  const providerKind = computed(() => bridge.providerKind.value)

  const submitRoute = async () => {
    error.value = ''
    if (!routeState.value.canSubmit) {
      error.value = '当前没有可提交的路线'
      return false
    }

    busy.value = true
    try {
      const ok = await bridge.submitRoute()
      if (!ok) {
        error.value = '桥接层未接收路线'
        return false
      }
      lastResult.value = '路径已提交到桥接层'
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '路径提交失败'
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    error,
    lastResult,
    routeState,
    providerKind,
    submitRoute,
  }
}
