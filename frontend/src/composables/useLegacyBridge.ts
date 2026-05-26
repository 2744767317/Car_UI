export const useLegacyBridge = () => {
  const api = () => window.__CAR_LEGACY_API__ || null

  const call = async (
    fn: keyof NonNullable<typeof window.__CAR_LEGACY_API__>,
    ...args: unknown[]
  ): Promise<unknown | null> => {
    const bridge = api()
    const handler = bridge?.[fn]
    if (typeof handler !== 'function') return null
    return await (handler as (...handlerArgs: unknown[]) => unknown)(...args)
  }

  return {
    api,
    call,
  }
}
