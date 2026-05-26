import { computed } from 'vue'
import { runtimeAppConfig } from '../config/app-config'

export const useRuntimeConfig = () => {
  const config = runtimeAppConfig

  const backend = computed(() => config.backend)
  const scene = computed(() => config.scene)
  const bridge = computed(() => config.bridge)

  return {
    config,
    backend,
    scene,
    bridge,
  }
}
