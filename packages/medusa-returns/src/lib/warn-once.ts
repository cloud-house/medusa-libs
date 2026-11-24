const warned = new Set<string>()

/**
 * Logs a warning once per key and process – a missing setting must be visible in the log without
 * repeating on every request.
 */
export function warnOnce(logger: { warn(message: string): void }, key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  logger.warn(message)
}
