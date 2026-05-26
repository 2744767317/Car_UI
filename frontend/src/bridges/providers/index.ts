import { runtimeAppConfig } from '../../config/app-config'
import type { VehicleBridgeProvider } from '../types'
import { createLegacyProvider } from './legacy-provider'
import { createMockRos2Provider } from './mock-ros2-provider'
import { createRos2WebBridgeProvider } from './ros2-webbridge-provider'

export const createVehicleBridgeProvider = (): VehicleBridgeProvider => {
  const mode = runtimeAppConfig.bridge.mode
  if (mode === 'mock-ros2') return createMockRos2Provider()
  if (mode === 'ros2-webbridge') return createRos2WebBridgeProvider()
  return createLegacyProvider()
}
