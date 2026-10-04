# Implementation references

Reviewed 2026-10-04. The implementation is a new, local GNOME extension, not a repackaging of Flameshot or gnome-screenshot.

## GNOME Shell 50 source (primary reference)

- https://github.com/GNOME/gnome-shell/blob/gnome-50/js/ui/screenshot.js
  Blob reviewed: `f4353845a380411b152d021c64e7d4a0b75759aa`.
  Verified: Clutter.PanGesture selection API, per-actor cursor type, Shell.Screenshot async methods, MemoryOutputStream, PNG clipboard mechanism.
- https://github.com/GNOME/gnome-shell/blob/gnome-50/src/shell-screenshot.c
  Blob reviewed: `076eb2c9f2141cea20276ed8ad9054a4047ee5bc`.
  Verified: screenshot_area(x, y, width, height, stream, callback), no cursor flag for region captures, screenshot_area_finish return handling, asynchronous PNG output.
- https://github.com/GNOME/gnome-shell/blob/gnome-50/js/ui/main.js
  Blob reviewed: `3f8bbf57601557e2464f2c2a800ec53f1f0a19b0`.
  Verified: pushModal/popModal, focus restoration, screenshot selection must relinquish the grab before ordinary app interaction.

## Official API / extension documentation

- https://gjs.guide/extensions/upgrading/gnome-shell-50.html
- https://gjs.guide/extensions/development/preferences.html
- https://gjs.guide/extensions/development/debugging.html
- https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/method.Screenshot.screenshot_area.html
- https://gnome.pages.gitlab.gnome.org/gnome-shell/st/method.Clipboard.set_content.html
- https://docs.gtk.org/gio/method.MemoryOutputStream.steal_as_bytes.html
- https://docs.gtk.org/gtk4/func.accelerator_parse.html

The rolling Shell API website displayed version 51 during review. The **GNOME 50 branch source above** was used to verify the target-version native calls rather than assuming the rolling documentation was sufficient.

## Clipboard Indicator compatibility

- https://github.com/Tudmotu/gnome-shell-extension-clipboard-indicator

Its README documents image support, private mode, app exclusions, and a possible short freeze when copying large images. Tealshot makes a standard image/png clipboard write; it does not call this extension's private internals or guarantee its history behavior.
