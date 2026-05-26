import { computed, ref } from 'vue'
import type { LegacySnapshot } from '../types/legacy'

const STORAGE_KEY = 'point_cloud_scene_v1'
const snapshotVersion = ref(0)
let listenersInstalled = false

const bump = () => {
  snapshotVersion.value += 1
}

const installListeners = () => {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true

  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === STORAGE_KEY) {
      bump()
    }
  })

  window.addEventListener('focus', bump)
}

installListeners()

const readLocalSnapshot = (): LegacySnapshot | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const readBridgeSnapshot = (): LegacySnapshot | null => {
  const bridge = window.__CAR_LEGACY_API__
  if (!bridge?.getSnapshot) return null

  try {
    return bridge.getSnapshot()
  } catch {
    return null
  }
}

export const useLegacySnapshot = () => {
  const snapshot = computed(() => {
    snapshotVersion.value
    return readBridgeSnapshot() ?? readLocalSnapshot()
  })

  const hasLegacy = computed(() => !!window.__CAR_LEGACY_APP__)

  const refresh = () => bump()

  const patchSnapshot = (patch: Partial<LegacySnapshot>) => {
    const current = readLocalSnapshot() ?? readBridgeSnapshot() ?? {}
    const next = { ...current, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    bump()
    return next as LegacySnapshot
  }

  const setReadOnlyOverlay = (enabled: boolean) => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('legacy-readonly', enabled)
  }

  return {
    snapshot,
    hasLegacy,
    refresh,
    patchSnapshot,
    setReadOnlyOverlay,
  }
}
