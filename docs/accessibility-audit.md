# Accessibility Audit: PHANTOM OS guided launch

**Standard:** WCAG 2.1 AA target | **Date:** 2026-11-22

## Summary

**Remediation findings:** 4 | **Critical:** 0 | **Major:** 3 | **Minor:** 1.
The four shell findings below were addressed in Prompt 8. This is a scoped review,
not a WCAG conformance certification. The original DOS application's pixel UI has
an inherent assistive-technology limitation. Human screen-reader speech, physical
phone input and the novice usability protocol remain unverified.

The review used the design accessibility-review checklist. Evidence comes from
real Chrome 157.0.8103.79 on macOS, desktop and Pixel 7 layout emulation:
[acceptance report](evidence/prompt-8.md). DOM roles and keyboard tests are not a
substitute for listening with VoiceOver/NVDA.

## Findings

### Perceivable

| # | Issue | WCAG criterion | Severity | Resolution / remaining work |
| --- | --- | --- | --- | --- |
| 1 | Low-contrast field outlines and very small secondary copy | 1.4.3, 1.4.11 | Major | Raised caption size to 12px; stronger input/button outlines; sampled text ≥4.5:1 and fields ≥3:1 pass. Native checkbox appearance and every guest color are not covered by this calculation. |

### Operable

| # | Issue | WCAG criterion | Severity | Resolution / remaining work |
| --- | --- | --- | --- | --- |
| 2 | Cross-frame focus could race with the initiating button's blur | 2.1.1, 2.1.2, 2.4.7 | Major | Start no longer captures input. Focus explicitly enters the browsing context, then the canvas after Chrome applies focus. Actual focus/blur drives the status and border. Ctrl+Alt+Esc, Release keyboard and Tab are exercised; browser controls stay reachable. |

### Understandable

| # | Issue | WCAG criterion | Severity | Resolution / remaining work |
| --- | --- | --- | --- | --- |
| 3 | Launch configuration and file-export instructions were difficult to discover | 3.3.2 | Minor | Distinct Configure route, visible four-step progression, two licensed demos and exact export commands beside the player. Human comprehension/time remains to be measured. |

### Robust

| # | Issue | WCAG criterion | Severity | Resolution / remaining work |
| --- | --- | --- | --- | --- |
| 4 | New clipboard/full-screen actions depend on optional browser APIs | 4.1.2, 4.1.3 | Major | Native buttons and labeled status messages; clipboard denial opens a focused/selectable textarea and Download report; full-screen denial retains the working viewport and export path. |

## Color contrast check

Calculated from rendered CSS with inherited opaque backgrounds. Measurements cover
visible text on Home, Compatibility and Configure (including expanded settings),
excluding disabled/hidden controls. They do not analyze guest framebuffer colors.

| Element | Foreground | Background | Ratio | Required | Result |
| --- | --- | --- | --- | --- | --- |
| Lowest sampled Home text | Rendered CSS | Nearest opaque ancestor | 5.14:1 | 4.5:1 | Passed |
| Lowest sampled Compatibility/Configure text | Rendered CSS | Nearest opaque ancestor | 4.89:1 | 4.5:1 | Passed |
| Configure field outlines | `#738269` | `#111510` | 4.50:1 | 3:1 | Passed |

[Machine-readable observations](evidence/prompt-8-accessibility.json) retain counts
and field measurements. Focus outlines use the pale green accent; focus is also
communicated in text. Reduced-motion mode disables transitions/animations. Native
progress reports actual work; no fake terminal activity was added.

## Keyboard navigation

| Element | Tab order / activation | Escape / arrows |
| --- | --- | --- |
| Skip link, navigation, primary open button | Skip link focuses main; next Tab reaches Open on Home; Enter activates routes and moves focus to the destination heading | Normal browser behavior |
| Entrypoints / disclosure / settings | Native radio buttons, details, labels and selects; Space chooses the program | Native radio/select arrow behavior |
| Runtime canvas | Explicit Focus program or screen click; outer/frame focus status changes | Ctrl+Alt+Esc releases all held keys; Tab moves to controls; on-screen Tab sends DOS Tab |
| Full-screen player | Enter/click expands the real player panel; Exit full screen remains inside it | Normal browser Escape; explicit exit button tested |
| Copy/export | User action only; denial focuses selectable report text | No focus trap |

44px targets are used for primary/session buttons and main navigation; native
radio/checkbox choices have clickable labels. Six routes have no horizontal page
overflow at desktop/phone widths; expanded Configure passes 200% **CSS zoom** and
320 CSS-pixel reflow. Browser-menu zoom and all platform font settings were not
independently exercised.

## Screen reader

| Element | DOM accessible name/role checked | Speech test status |
| --- | --- | --- |
| Main navigation and launch steps | Named navigation, current page/step | Not listened to with VoiceOver/NVDA |
| File/ZIP/folder/profile selection | Explicit accessible labels and semantic controls | Not listened to |
| Inspection, errors, download and focus | Headings, native progress/status/alert and labeled report textarea | Not listened to |
| DOS canvas | “DOS program screen”, release instructions and pixel-UI limitation | Guest content has no semantic tree; text export is a separate reading route |

The shell cannot make an arbitrary original DOS application screen-reader
accessible. Do not claim otherwise or synthesize a replacement application UI.

## Priority validation and novice tester protocol

1. **Human assistive-technology check:** run VoiceOver in Chrome/macOS, then NVDA
   with a supported Windows browser, listening through intake, radio choices,
   Configure, focus release, clipboard fallback and export. Record exact versions,
   unexpected announcements and any trap before expanding the accessibility claim.
2. **Three first-time testers:** recruit people unfamiliar with emulators. Keep the
   source closed; supply only the local app URL and these tasks: launch a supplied
   demo, explain why a PE32+/Windows example cannot run, and export a result.
   Use the [product-spec warm-asset protocol](product-spec.md#measurable-acceptance-targets),
   record individual selection-to-interaction (≤60s) and selection-to-export (≤120s)
   times and assistance. Zero completed human participants are claimed here.
3. **Physical devices and zoom:** verify mobile touch/physical keyboard, real 200%
   browser-menu zoom and screen-reader focus after native fullscreen. Current
   phone-sized tests inject physical key events on desktop Chrome; there is no
   complete on-screen DOS text keyboard.

Automated timings in the evidence are engineering checks, not human results.
