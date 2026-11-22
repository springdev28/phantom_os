/** Hosting policy, shared by preview and production acceptance. No user metadata. */
export function applicationPolicy(origin: string, hostPath: string): string {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin
    || !/^runtimes\/js-dos\/host-[a-f0-9]{16}\.html$/.test(hostPath)) throw new Error('Invalid static hosting configuration');
  const downloads = ['runtimes/js-dos/8.5.3/emulators.js', 'runtimes/js-dos/8.5.3/wdosbox.js',
    'runtimes/js-dos/8.5.3/wdosbox.wasm', 'demos/MEM.EXE', 'demos/FREECOM.ZIP'];
  return `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src ${origin}/${hostPath}; worker-src blob:; connect-src ${downloads.map(path => `${origin}/${path}`).join(' ')}; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'`;
}

// Portable defense for raw static hosts. HTTP headers above further narrow the
// exact fetch/frame paths; a meta policy cannot enforce frame-ancestors/permissions.
export const STATIC_META_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src 'self'; worker-src blob:; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'";
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), display-capture=(), usb=(), serial=(), hid=(), payment=(), clipboard-read=(), clipboard-write=(self), fullscreen=(self)';
export const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': PERMISSIONS_POLICY,
} as const;

export function productionHeaders(origin: string, hostPath: string, framePolicy?: string): Record<string, string> {
  return { ...COMMON_HEADERS,
    'Content-Security-Policy': framePolicy ? `${framePolicy}; frame-ancestors 'self'` : applicationPolicy(origin, hostPath),
    'X-Frame-Options': framePolicy ? 'SAMEORIGIN' : 'DENY',
    ...(!framePolicy ? { 'Cross-Origin-Opener-Policy': 'same-origin' } : {}),
  };
}
