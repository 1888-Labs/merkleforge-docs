// Small helpers shared by the demo components.

/** `0x1234…cdef` for long hex strings. */
export function short(hex: string, keep = 10): string {
  return hex.length > 2 * keep + 4 ? `${hex.slice(0, keep)}…${hex.slice(-keep + 2)}` : hex
}

/** Milliseconds or microseconds, whichever reads better. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '–'
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 1)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`
  return `${(n / 1024 / 1024).toFixed(1)} MiB`
}

/** Lets React paint between long synchronous steps. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Saves `text` as a file in the browser. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Browser name and version from the user agent, for labelling results. */
export function describeBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const match =
    ua.match(/(Edg|OPR|Firefox|SamsungBrowser)\/([\d.]+)/) ??
    ua.match(/(Chrome|CriOS)\/([\d.]+)/) ??
    ua.match(/Version\/([\d.]+).*(Safari)/)
  let name = 'Browser'
  let version = ''
  if (match) {
    if (match[2] === 'Safari') {
      name = 'Safari'
      version = match[1] ?? ''
    } else {
      name = { Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome' }[match[1] as string] ?? (match[1] as string)
      version = match[2] ?? ''
    }
  }
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return `${name} ${version.split('.')[0]}${os ? ` on ${os}` : ''}`
}
