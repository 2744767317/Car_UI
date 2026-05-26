import { computed, ref } from 'vue'
import { createVehicleBridgeProvider } from '../bridges/providers'

const provider = createVehicleBridgeProvider()
const revision = ref(0)

const bump = () => {
  revision.value += 1
}

const run = async (job: () => Promise<boolean>) => {
  const ok = await job()
  bump()
  return ok
}

export const useVehicleBridge = () => {
  const providerKind = computed(() => {
    revision.value
    return provider.kind
  })

  const routeState = computed(() => {
    revision.value
    return provider.getRouteState()
  })

  const gpsState = computed(() => {
    revision.value
    return provider.getGpsState()
  })

  return {
    providerKind,
    routeState,
    gpsState,
    syncStartPoint: () => run(provider.syncStartPoint),
    calibrateAtCurrentPoint: () => run(provider.calibrateAtCurrentPoint),
    toggleTracking: () => run(provider.toggleTracking),
    submitRoute: () => run(provider.submitRoute),
    refresh: bump,
  }
}
