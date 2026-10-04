# Tealshot 0.1.0 — test report

Date: 2026-10-04.

## Executed here

- JavaScript syntax checks: `extension.js`, `prefs.js`, `core.js` — passed with Node.js 22.16.0.
- Pure JavaScript geometry/timer/color/PNG tests — 9 passed.
- Extension lifecycle tests with **GNOME API test doubles** — 20 passed.
- Python installer/shortcut-preservation/schema tests — 9 passed.
- Python bytecode syntax compilation — passed.
- Bash syntax checks for install/uninstall/doctor launchers — passed.
- GSettings schema compiled with `glib-compile-schemas --strict` — passed (GLib 2.84 tooling in this container).

**Total: 38 automated test cases passed.**

## Important tested behavior

- Selecting/holding a drag does not start a countdown or capture.
- The timer is anchored to mouse release, not invocation.
- Delayed ticks use a monotonic deadline rather than tick counting.
- The modal input grab is released before countdown.
- Countdown actors and their descendants are non-reactive in the tested construction.
- Overlay actors are removed before invoking native capture.
- A successful capture writes image/png once and closes the memory stream.
- Repeated shortcuts cancel, without changing the old clipboard.
- Escape, disable, monitor changes and lock cancel safely.
- Late native callbacks after disable/lock/cancel cannot overwrite the clipboard.
- Disable + re-enable does not revive a stale operation.
- Native failure, invalid bytes, synchronous errors and a timeout do not leave overlay actors behind.
- Old screenshot bindings are recognized narrowly; unrelated or subsequently modified bindings are not overwritten/restored.

## NOT executed here

This container does **not** have a running GNOME Shell 50 / Mutter / Wayland session or the user's NVIDIA RTX 5070 Ti display stack.

Accordingly, this report does **not** certify native GJS module loading, real gesture delivery, actual click-through behavior, the live screenshot backend, GTK preference rendering, actual clipboard paste, Clipboard Indicator retention, GPU stability, HDR color behavior, or mixed-DPI multi-monitor behavior. Native acceptance steps are in README.md. The program was not installed or executed on the user's machine remotely.

The test-double suite executes the extension's actual JavaScript control flow, but mocks the GNOME/Clutter/Gio native APIs. This is useful regression coverage, not an end-to-end desktop test.
