# Tealshot 0.1.1 test report

## Executed in the build container

- Node.js v22.16.0: **38/38 tests passed**.
  - 9 core tests.
  - 20 lifecycle tests using explicit GNOME API test doubles.
  - 9 minimal-UI tests: one number only, no selection text, unchanged
    frame/corners, transparent holder styling, correct countdown sequence,
    silent success even with the old confirmation preference set, settings
    preservation, positioning, and overlay cleanup.
- Python unittest: **9/9 tests passed** (installer pure functions and metadata).
- `node --check`: extension.js, prefs.js and core.js passed.
- `bash -n`: install.sh, uninstall.sh and doctor.sh passed.
- XML parsed successfully with ElementTree.

Total automated tests: **47 passed**. The complete outputs are in
`js-tests.txt`, `python-tests.txt` and `syntax-tests.txt`.

## Source checks

The original extension.js, stylesheet.css and prefs.js in the supplied 0.1.0
archive matched the Git blob hashes read from Miko997/tealshot main before
editing. The outline construction and styling methods and modal-selection
release method were checked byte-for-byte unchanged. The native capture
method is unchanged except that the optional success-banner call is removed.

## Not executed

This container does not have a native GNOME Shell 50 / NVIDIA / Wayland
session, GJS, or glib-compile-schemas. The installer compiles the schema
strictly on the target Ubuntu system. Mocked lifecycle tests and static CSS
checks do not prove the real font rendering, monitor scaling, clipboard
integration, or compositing behavior.

## Target-machine acceptance test

After installation, save work and log out/in once. Press Ctrl+Windows+S:
select an area, verify no top instruction banner; release and verify only
5,4,3,2,1 appears over the desktop with no box or progress bar. Check that
the original cyan frame is unchanged and apps remain interactive. Paste the
image; the timer/frame must not be captured and no success banner should
appear. Change countdown/color in preferences and repeat.
