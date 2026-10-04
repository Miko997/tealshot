# Tealshot 0.1.1

**Select an area → prepare during a visible countdown → paste the fresh screenshot.**

A small, local GNOME Shell **50 / Wayland** extension built for a dark cyan/teal desktop. This is a separate screenshot project, not a component of Metriplane. See [ALOITA-TASTA.md](ALOITA-TASTA.md) for Finnish installation instructions.

## What it does

1. Press **Ctrl + Windows + S** (the installer-configured shortcut).
2. Drag a rectangle. No screenshot or countdown starts while you are choosing.
3. Release the mouse. **Now** the 5-second countdown starts.
4. A thin cyan border and bright corner marks show the fixed capture area. A top-center timer shows time remaining. The selection grab has been released: you can click, type, move windows, open a menu, or hover a tooltip.
5. At expiry, Tealshot removes its own overlays, allows about 100 ms for the overlay-free scene to render, and requests a **fresh** capture of the selected screen coordinates.
6. The PNG is copied to the standard clipboard. Paste with **Ctrl+V** in an application that accepts images. There is no additional confirmation dialog or save step.

The mouse pointer itself is excluded. Screenshots are not stored in Tealshot's files or uploaded. The only text shown during normal capture is the countdown number. Selection has no instruction banner; the countdown has no background, branding or progress bar. Successful copying is silent. Failure messages remain visible.

## Install

Download the project ZIP to your Downloads directory, then:

```bash
cd "$(xdg-user-dir DOWNLOAD)"
unzip tealshot-0.1.1.zip
cd tealshot-0.1.1
bash install.sh
```

Type `y` when the installer lists its changes and asks for confirmation. Do **not** run it with sudo.

Save your work and **log out and back in once**, or restart normally. This starts a fresh GNOME Shell process and discovers the newly installed extension. The installer does not force logout or stop your applications. If user extensions are disabled globally, turn on **Use Extensions** in Extension Manager.

Then use **Ctrl + Windows + S**.

### Exactly what installation changes

- Installs under `$XDG_DATA_HOME/gnome-shell/extensions/tealshot@miko.local` (normally `~/.local/share/...`).
- Compiles its GSettings schema locally and queues/enables the extension for your user.
- Configures Ctrl+Super+S only after installation consent. The packaged schema itself has no default shortcut.
- Backs up and clears an existing GNOME custom binding for **that same key combination**, but **only** when its command is a legacy Flameshot or gnome-screenshot command. It does not remove the old apps or the other custom bindings.
- Refuses to overwrite an unrelated custom shortcut using the same keys.
- Adds a **Tealshot Settings** application launcher with startup notification disabled.
- Keeps local installer backups in `~/.local/state/tealshot/` (or your XDG state directory), mode 0700. Backup JSON files are mode 0600.

It does not change your NVIDIA driver, BIOS, GNOME security settings, extension version validation, screenshots portal policy, Clipboard Indicator configuration, or Ctrl+Alt+V binding. It does not launch Flameshot, `gnome-screenshot`, a shell pipeline, or a separate screenshot app on each capture.

Runtime dependencies are the GNOME Shell 50 components already in the desktop. Installation uses `/usr/bin/python3`, Python GObject bindings, `gnome-extensions`, and `glib-compile-schemas`; it does not download any dependencies. Node.js is only used by the optional developer tests, never for capture.

## Configure

Open **Tealshot Settings** from the application list, use its gear in Extension Manager, or run:

```bash
gnome-extensions prefs tealshot@miko.local
```

Settings:

- **Countdown:** 1–60 seconds; default 5. Applies to the next selection.
- **Shortcut:** presets or a custom GTK accelerator. The default is Ctrl + Windows + S. A custom entry must contain a modifier and a real key, not a modifier alone.
- **Outline and timer color:** default `#23C9E8`, chosen to complement the dark Metriplane wallpaper.
- **Outline width:** 1–6 logical pixels; default 2, with brighter corner marks.
- **Subtle cyan glow:** on/off.
The legacy `show-confirmation` preference is retained for compatibility but no longer displays a success message. Existing shortcuts, delay, outline color, width and glow settings are preserved.

The timer is positioned on the display with the largest overlap with the selected rectangle. Screen coordinates are passed to GNOME's native API; the extension does not apply an arbitrary scale factor or resize your screenshot.

## Cancel and recovery

- **During selection:** Escape or right-click cancels.
- **During countdown:** press the capture shortcut again to cancel. Escape is deliberately left for the application, so you can close its menus without cancelling capture.
- Screen lock, monitor reconfiguration, or disabling the extension cancels a pending selection/countdown.
- A cancelled or disabled capture is not allowed to replace the clipboard if an asynchronous callback arrives later.
- If the native screenshot API does not complete within 15 seconds, the UI is cleared and an error is shown; the old clipboard is preserved. New capture is blocked until the native operation returns, preventing accumulation of stuck captures.

The region is a **fixed rectangle of the screen**, not a tracker following a particular window. Move/open what you need inside that rectangle during the countdown. The trigger is active in the normal desktop/app session, not the lock screen or Activities overview.

## Clipboard Indicator

Tealshot publishes `image/png` using `St.Clipboard.set_content()`, the same clipboard mechanism used by GNOME Shell's own screenshot implementation. It does not simulate paste keystrokes.

Clipboard Indicator's current source documents image support. To retain the screenshot in its history, image history must be enabled and private mode/exclusions must not suppress the entry. Tealshot does not bypass those choices. Plain Ctrl+V is independent of whether the history extension retains the image. The receiving app must accept image data; an ordinary text-only terminal is not an image destination.

Clipboard Indicator also documents that large images can briefly freeze its UI. If pasting works but the history manager causes a pause, test one capture with Clipboard Indicator temporarily disabled. There is no requirement to install a different clipboard manager.

## First-run acceptance check

Save important work before enabling a new extension. Run these tests in your real desktop:

1. Invoke the shortcut and hold the drag for over five seconds. The countdown must **not** start until release.
2. Select a browser area, release, then open a menu inside the rectangle. The final pasted image must contain the newly opened menu. This checks that capture happens at the end, not at selection time.
3. Check that the cyan frame, timer, and pointer are absent from the PNG.
4. Paste into an image-capable chat/editor, and check Clipboard Indicator separately.
5. Set 3 seconds, then 10 seconds, and change the frame color in preferences. Test again.
6. Cancel once during selection and once during countdown. Your previous clipboard must remain intact.
7. Check display scaling using an area with crisp text. This version has not been natively tested with mixed-DPI multi-monitor layouts or HDR; report such cases rather than assuming they work.

## Diagnose / remove

In the extracted project directory:

```bash
bash doctor.sh
```

This prints local version/state/settings and recent Tealshot messages. It does not send anything. To disable immediately:

```bash
gnome-extensions disable tealshot@miko.local
```

To uninstall and restore unchanged legacy bindings:

```bash
bash uninstall.sh
```

The uninstaller restores a backed-up old key only if its command has not changed and its binding is still empty. It does not undo later user edits. Tealshot settings and backup records are kept for safety. A code update needs logout/login because GNOME Shell does not unload imported JavaScript modules.

## Development

```text
extension/extension.js     Native selection, countdown, capture and cleanup
extension/core.js          Pure geometry / timer / color / byte validation
extension/prefs.js         GTK4 / libadwaita preferences
extension/stylesheet.css  Transparent number-only countdown styling
extension/schemas/        GSettings configuration
install.sh                User-only installer entrypoint
uninstall.sh              Scoped removal / binding restoration
tools/manage.py           Backup, conflict handling and diagnostics
tests/                    Pure and mocked-lifecycle tests
```

No npm dependencies are required:

```bash
npm run check
npm test
python3 -m unittest discover -s tests -p 'test_*.py' -v
glib-compile-schemas --strict extension/schemas
```

See [docs/TEST-REPORT.md](docs/TEST-REPORT.md) for what was actually tested. In particular, Node tests with GNOME API doubles are **not** a successful live GNOME, Wayland or NVIDIA test.

## Scope and limitations

- Targets GNOME Shell **50 only**, based on the user's installed desktop. Other versions are not advertised as compatible.
- A GNOME extension runs inside the compositor process. This offers the required overlay/input integration but means version/API errors can affect the desktop; it is not process-isolated like a normal app.
- This is a first local development release, not an extensions.gnome.org-reviewed or vendor-certified package.
- No guarantee of protected video capture, HDR color fidelity, multi-seat operation, mixed-scale monitor capture, or an already malfunctioning GPU/compositor.
- No screenshot history, annotation editor, auto-upload, or disk-save feature; these are intentionally outside the requested workflow.

License: **GPL-3.0-or-later**. See [LICENSE](LICENSE) and [docs/SOURCES.md](docs/SOURCES.md).
