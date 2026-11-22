# Security boundaries — Prompt 9

PHANTOM is an experimental, local DOS runner, **not a secure malware sandbox**.
Treat imported programs, documents, names, profiles, archives and disk metadata as
hostile. Header recognition does not establish safety or executable compatibility.
The [acceptance record](evidence/prompt-9.md) identifies tested assets, browsers,
network traces and failures; it is not a penetration-test certification.

## Threats and controls

| Threat | Boundary / response |
| --- | --- |
| Corrupt PE/MZ/ELF, impossible offsets and unusual images | Bounded reads and numeric range validation; fixed diagnostics. Images are inspected as opaque files; no image mount/boot action is offered. Windows, ELF/Linux, Mac and disk execution stay unavailable. |
| ZIP bombs, dishonest lengths, many tiny entries | Preflight every local/central record; then streamed actual-size, ratio and CRC checks in a terminable worker. Reject the entire import on failure. No recursive extraction, archive scripts or supplied emulator configuration. |
| ZIP-slip, symlinks, device files, Unicode/case aliases | Reject absolute/drive/UNC/traversal paths, controls/bidi markers, unsafe names and collisions. Reject ZIP links/special files. Files go into a virtual package, never a host path. Folder intake reads only the browser-selected File objects; browser link/empty-folder metadata is unavailable. |
| Metadata injection / command injection | React text nodes and form values only; no imported HTML, URL or DOM markup. Strict relative paths and closed JSON schemas; DOS accepts a narrow 8.3 path alphabet, no user shell arguments/config. Guest replies are shape-checked and file paths/size/count/aliases are checked before display/export. |
| Hostile program or emulator flaw | DOS runs in an opaque iframe with only `allow-scripts allow-pointer-lock`, then a real WASM worker. No same-origin, popups, downloads, top navigation or host directory grant. Only selected bytes, fixed assets and narrow MessageChannel commands cross the boundary. |
| Infinite execution, silent worker death, refresh | One session, deadlines, explicit stop and bounded forced disposal. A documented `asyncifyStats()` round trip detects a silently dead worker. `pagehide` synchronously removes the guest, including history-cache entry; fresh reload never auto-runs. Uncaptured guest writes are lost. |
| Data exfiltration / privileged APIs | Fixed same-origin static downloads only; guest `connect-src 'none'`, disabled IPX/serial and network API guards. Guest clipboard, storage, service workers and host picker APIs are absent/denied. Main copy is explicit write-only; no clipboard reads. |

The selected C: mount is an in-memory copy. A DOS command referring to a host-like
path can at most address the emulator's virtual filesystem; no native mount or
FileSystemHandle is supplied. The app has no upload endpoint, accounts, native
helper, guest proxy, remote disk, telemetry, crash reporter or CSP report endpoint.
A launched program can still interpret hostile companion files or exercise guest
engine features. Static inspection is not a safety validator for those code paths.

## Enforced budgets

| Resource | Limit |
| --- | --- |
| Selected or extracted file / package | 64 MiB / 128 MiB; 2,048 entries including virtual directories |
| Header reads | 1 MiB/file, 64 KiB/slice, 32 reads; 8 MiB/package |
| ZIP | 100:1 per entry; 2 MiB directory; 4 KiB compressed chunks; 30-second processing/worker deadline |
| Paths | 1,024 UTF-8 bytes, 255 bytes/segment, depth 32; 1 MiB explicit path metadata |
| DOS intake / memory | 32 MiB package; 16–64 MiB guest RAM; 256 MiB WASM linear-memory ceiling |
| Guest writes | 32 MiB/file, 64 MiB cumulative growth, 4,096 newly created VFS nodes; deleted growth is not refunded |
| Live import / export | One new root 8.3 file ≤8 MiB / one file ≤32 MiB; at most four pending bridge requests |
| Runtime fetch | ≤2 MiB actual streamed response per pinned asset; abort/cancel and SHA-256 verification before use |
| Lifecycle | 45-second preparation budget, 30-second frame startup; 1–30 minute session; 1.5-second forced-stop fallback; health checks every 2 seconds with a 5-second reply deadline |
| Profiles / workspace | 2 MiB JSON; 128 MiB explicit saved bytes, ≤32 MiB working files; 1 MiB storage chunks |

These are application budgets, **not an OS-level browser CPU or total-heap quota**.
Inflation has transient chunk allocations; cloning, JS heaps, canvas/audio and GC
add overhead. A compromised engine could bypass JavaScript VFS guards. Background
timer throttling, device sleep or browser hangs delay deadlines; the elapsed-time
check applies when the UI resumes. Closing the tab/browser remains the last resort.

## Hosting, downloads and browser privileges

Use `npm run build && npm run preview` on loopback for the audited local build.
Preview and production acceptance use [the same header policy](../src/security/policy.ts):
main scripts/styles/images are same-origin, workers are Blob-only, frame loading
allows the exact hashed DOS host, and connections allow only three fixed emulator
assets plus two explicit public demos. There is no general eval in the main app.
Referrer-Policy, nosniff, anti-framing and Permissions-Policy restrict clipboard
reading, cameras, microphones, location, screen capture, USB, serial, HID and payment.
Copy/report export and fullscreen remain explicit main-app actions.

The guest has its own hash-bound script/style policy, Blob scripts/workers, no
connections, images, media, forms or child frames. Its pinned 8.5.3 loader requires
`unsafe-eval`: a real startup trial with only `wasm-unsafe-eval` failed, so that
permission remains **only in the opaque guest context**. Worker fetch/XHR, sockets,
WebRTC/WebTransport and importScripts are blocked before engine startup; local
facades resolve only audited bytes. An optional credentialless-frame trial broke
cached offline relaunch in Chrome and was not retained. The static host navigation
can carry origin cookies; use a dedicated cookie-free origin. The app sets no cookies,
has no accounts and uses `credentials: 'omit'` for asset/demo fetches. See [browser sandbox semantics](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
and [CSP evaluation controls](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

The build also includes a conservative meta CSP for plain static hosts, but it
cannot enforce Permissions-Policy/anti-framing and has broader same-origin fetch
and frame permissions. Such hosting is **not the verified configuration**. Other
hosts must reproduce the response headers, with their fixed origin, and rerun
acceptance. Do not apply the main script policy to the runtime document. CSP path
allowlists are not a query/body information-flow filter; fixed URL construction,
no upload code and observed requests are separate checks. Do not share this origin
with unrelated apps. Vite development permits source transforms and its fixed HMR
socket; use the production preview for hostile-input testing.

Runtime and demo bytes are self-hosted, exact-version/hash checked, and independent
of selected names/contents. The npm package has unused cloud/network code; only the
audited classic worker path is enabled. Application source maps are disabled. One
exact hash-pinned upstream `emulators.js.map` remains in the retained public source
bundle for license/source provenance; it contains upstream code, no app state or
user data. The immutable vendor loader retains a relative map comment; no map fetch
occurs in acceptance. Developer tools may request a public map. Logging retains
at most 100 fixed event/error codes in memory; it excludes
file names/paths, output, raw exceptions and stacks. Vendor stdout/console is drained
or suppressed, not forwarded. No error/analytics request is configured.

## Storage, residual risk and supported platforms

Temporary mode writes no software or documents to persistent storage. Startup may
read an existing origin-local manifest; saving requires explicit enablement and
separate software/document choices. OPFS never grants access to arbitrary host
directories. No persistent-storage permission is requested. Hashes validate byte
integrity, not trust/authenticity; saved content is not encrypted. Same-origin code,
extensions or someone with the browser profile can access it. Quota/permission
denial preserves temporary operation and explicit downloads. Browser eviction,
user clearing and interruptions can lose data; use Export backup/Delete workspace.
Downloaded guest files remain untrusted and are never executed on the host by PHANTOM.

The detailed policy/escape-surface probes are recorded in **Chrome on macOS/arm64**,
including phone-sized Chrome emulation; this is not a physical-phone test. Prompt 10
adds real DOS/input/I/O/OPFS and fallback checks in pinned Playwright Firefox, with
observed local traffic; see [exact scope](compatibility-results.md). It does not
claim that Chrome's Permissions-Policy probes ran unchanged in Firefox. OPFS requires
a secure local/HTTPS origin and Web Locks. Feature absence has explicit fallbacks;
stock Firefox, Safari, real Android/iOS and older browsers are not verified. Permissions
Policy support varies; it supplements the opaque sandbox, not replaces it.
[Browser policy support](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy).

Residual risks include emulator/browser/driver vulnerabilities, native browser
escape, same-origin supply-chain compromise, extension access, CPU/memory denial
of service, navigation channels after a runtime compromise and deceptive guest
pixels. Hashes cannot protect against an attacker who changes both the app and
its pins. No antivirus, DRM inspection, perfect isolation or permanent retention
is claimed. Do not interpret the tested lack of outgoing data as proof against
every possible exploit. Public distribution still has the separate license/source
rebuild gate; this stage adds no runtime, OS image or deployment.

Run `npm run check` for unit, browser and production safety regressions. Tests cover
corrupt headers/ZIPs, traversal, links, dishonest output size, high ratios/counts,
inert strings, refresh, real worker termination, a real one-minute deadline,
storage denial, offline relaunch and a guest network attempt. Production records
page/worker traffic including method, URL, body and headers, and separately probes
CSP/permissions with fixed test strings. See [results and limitations](evidence/prompt-9.md).
