// SPDX-License-Identifier: GPL-3.0-or-later
// GNOME Shell 50 native implementation. No external launch / startup-notification.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {
    clamp, rectangleFromPoints, validRectangle, normalizeColor, rgba,
    countdownAt, monitorForRectangle, isPng,
} from './core.js';

const KEY = 'tealshot-capture';
const STATE = Object.freeze({IDLE: 'idle', SELECTING: 'selecting', RELEASING: 'releasing', COUNTING: 'counting', CAPTURING: 'capturing'});
const nowMs = () => GLib.get_monotonic_time() / 1000;

export default class Tealshot extends Extension {
    enable() {
        this._enabled = true;
        this._serial = (this._serial ?? 0) + 1;
        this._state = STATE.IDLE;
        this._sources = new Set();
        this._signals = [];
        this._settings = this.getSettings();
        this._lastToggle = -Infinity;
        this._nativeBusy ??= false;
        try {
            Main.wm.addKeybinding(KEY, this._settings, Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL, () => this._guard(() => this._toggle()));
            this._connect(Main.layoutManager, 'monitors-changed', () => this._cancel());
            this._connect(Main.sessionMode, 'updated', () => {
                if (Main.sessionMode.isLocked || Main.sessionMode.isGreeter)
                    this._cancel();
            });
            console.info('[Tealshot] enabled; capture is only triggered by the configured shortcut');
        } catch (error) {
            this.disable();
            throw error;
        }
    }

    disable() {
        this._enabled = false;
        this._cancel();
        Main.wm.removeKeybinding(KEY);
        for (const [object, id] of this._signals ?? [])
            object.disconnect(id);
        this._signals = [];
        this._settings = null;
    }

    _connect(object, signal, callback) {
        const id = object.connect(signal, () => this._guard(callback));
        this._signals.push([object, id]);
    }

    _guard(callback) {
        try {
            return callback();
        } catch (error) {
            this._fail(error);
            return undefined;
        }
    }

    _fail(error) {
        this._cancel();
        console.error(`[Tealshot] ${error.stack ?? error}`);
        if (this._enabled && !Main.sessionMode.isLocked)
            Main.notifyError('Tealshot', `Screenshot not copied: ${error.message ?? error}`);
    }

    _timeout(milliseconds, callback, repeat = false) {
        let id = 0;
        id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            if (!repeat)
                this._sources.delete(id);
            let again = false;
            try {
                again = callback() === true;
            } catch (error) {
                // Remove before _fail() can call _cancel(): do not double-remove.
                this._sources.delete(id);
                this._fail(error);
            }
            if (repeat && again && this._sources.has(id))
                return GLib.SOURCE_CONTINUE;
            this._sources.delete(id);
            return GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
        return id;
    }

    _idle(callback) {
        let id = 0;
        id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._sources.delete(id);
            this._guard(callback);
            return GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
        return id;
    }

    _removeSource(id) {
        if (id && this._sources.delete(id))
            GLib.source_remove(id);
    }

    _clearSources() {
        for (const id of this._sources ?? [])
            GLib.source_remove(id);
        this._sources?.clear();
    }

    _bounds() {
        return {width: Math.floor(global.stage.width), height: Math.floor(global.stage.height)};
    }

    _allowed() {
        return this._enabled && !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter;
    }

    _toggle() {
        if (!this._allowed())
            return;
        // Holding the shortcut must not immediately cancel its own operation.
        if (nowMs() - this._lastToggle < 450)
            return;
        this._lastToggle = nowMs();
        if (this._state !== STATE.IDLE) {
            this._cancel();
            return;
        }
        if (this._nativeBusy) {
            Main.notifyError('Tealshot', 'The previous native capture has not finished. Try again after it completes.');
            return;
        }
        this._startSelection();
    }

    _makeRoot(reactive = false) {
        const root = new St.Widget({reactive, can_focus: reactive,
            layout_manager: new Clutter.FixedLayout(), style: 'background-color: transparent;'});
        root.add_constraint(new Clutter.BindConstraint({source: global.stage, coordinate: Clutter.BindCoordinate.ALL}));
        Main.uiGroup.add_child(root);
        Main.uiGroup.set_child_above_sibling(root, null);
        return root;
    }

    _makeOutline(parent) {
        const outline = new St.Widget({reactive: false, can_focus: false,
            layout_manager: new Clutter.FixedLayout()});
        const frame = new St.Widget({reactive: false, can_focus: false});
        outline.add_child(frame);
        const corners = [];
        for (let i = 0; i < 8; i++) {
            const bar = new St.Widget({reactive: false, can_focus: false});
            outline.add_child(bar);
            corners.push(bar);
        }
        parent.add_child(outline);
        outline.hide();
        return {outline, frame, corners};
    }

    _placeOutline(view, rect) {
        const color = this._color;
        const line = this._line;
        const {width: w, height: h} = rect;
        view.outline.set_position(rect.x, rect.y);
        view.outline.set_size(w, h);
        view.frame.set_position(0, 0);
        view.frame.set_size(w, h);
        view.frame.set_style(`background-color: transparent; border: ${line}px solid ${rgba(color, 0.52)};` +
            (this._glow ? ` box-shadow: 0 0 8px 1px ${rgba(color, 0.24)};` : ''));
        const length = Math.min(24, w / 2, h / 2);
        const thick = Math.min(line + 1, length);
        const positions = [
            [0, 0, length, thick], [0, 0, thick, length],
            [w - length, 0, length, thick], [w - thick, 0, thick, length],
            [0, h - thick, length, thick], [0, h - length, thick, length],
            [w - length, h - thick, length, thick], [w - thick, h - length, thick, length],
        ];
        view.corners.forEach((bar, i) => {
            const [x, y, bw, bh] = positions[i];
            bar.set_position(x, y);
            bar.set_size(bw, bh);
            bar.set_style(`background-color: ${color};`);
        });
        view.outline.show();
    }

    _makeCountdown(parent, monitor, seconds) {
        // One number only. Keep the allocation fixed so 10 -> 9 does not jump.
        // This is not a panel: the container paints no background or border.
        const width = Math.min(80, monitor.width - 24);
        const box = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL,
            style_class: 'tealshot-countdown', reactive: false, can_focus: false, width});
        const value = new St.Label({text: `${seconds}`, style_class: 'tealshot-time',
            x_align: Clutter.ActorAlign.CENTER, reactive: false, can_focus: false});
        value.set_style(`color: ${this._color};`);
        box.add_child(value);
        const panelInset = monitor.index === Main.layoutManager.primaryIndex
            ? Math.max(28, Main.panel.height) : 12;
        box.set_position(Math.round(monitor.x + (monitor.width - width) / 2),
            Math.round(monitor.y + panelInset + 10));
        parent.add_child(box);
        return {box, value};
    }

    _startSelection() {
        this._cancel();
        this._state = STATE.SELECTING;
        const token = this._serial;
        this._color = normalizeColor(this._settings.get_string('outline-color'));
        this._line = clamp(this._settings.get_int('outline-width'), 1, 6);
        this._glow = this._settings.get_boolean('glow');
        this._delayMs = clamp(this._settings.get_int('delay-seconds'), 1, 60) * 1000;
        const root = this._makeRoot(true);
        this._selectionRoot = root;
        // Per-actor cursor; destroying the selector restores the normal cursor.
        root.set_cursor_type(Clutter.CursorType.CROSSHAIR);
        this._selectionOutline = this._makeOutline(root);
        const [px, py] = global.get_pointer();
        const monitor = monitorForRectangle({x: px, y: py, width: 1, height: 1}, Main.layoutManager.monitors);
        if (!monitor)
            throw new Error('No active display');

        const pan = new Clutter.PanGesture();
        this._pan = pan;
        pan.set_begin_threshold(0);
        pan.connect('recognize', () => this._guard(() => {
            if (this._state !== STATE.SELECTING)
                return;
            const p = pan.get_centroid_abs();
            this._start = {x: p.x, y: p.y};
            this._end = {...this._start};
        }));
        pan.connect('pan-update', () => this._guard(() => {
            if (this._state !== STATE.SELECTING || !this._start)
                return;
            const p = pan.get_centroid_abs();
            this._end = {x: p.x, y: p.y};
            const rect = rectangleFromPoints(this._start, this._end, this._bounds());
            if (rect.width > 0 && rect.height > 0)
                this._placeOutline(this._selectionOutline, rect);
        }));
        pan.connect('end', () => this._guard(() => {
            if (this._state !== STATE.SELECTING || !this._start || token !== this._serial)
                return;
            const rect = rectangleFromPoints(this._start, this._end, this._bounds());
            if (!validRectangle(rect, this._bounds())) {
                this._start = null;
                this._selectionOutline.outline.hide();
                return;
            }
            const releaseTime = nowMs();
            this._state = STATE.RELEASING;
            // Never destroy a gesture from inside its own signal callback.
            this._idle(() => {
                if (token !== this._serial || !this._allowed())
                    return;
                this._releaseSelection();
                this._beginCountdown(rect, releaseTime, token);
            });
        }));
        root.add_action(pan);
        root.connect('captured-event', (_actor, event) => {
            if ((event.type() === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) ||
                (event.type() === Clutter.EventType.BUTTON_PRESS && event.get_button() === 3)) {
                this._idle(() => {
                    if (token === this._serial)
                        this._cancel();
                });
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._grab = Main.pushModal(root, {actionMode: Shell.ActionMode.NONE});
        root.grab_key_focus();
    }

    _releaseSelection() {
        if (this._grab) {
            const grab = this._grab;
            this._grab = null;
            Main.popModal(grab);
        }
        this._selectionRoot?.destroy();
        this._selectionRoot = null;
        this._selectionOutline = null;
        this._pan = null;
        this._start = this._end = null;
    }

    _beginCountdown(rect, releaseTime, token) {
        this._state = STATE.COUNTING;
        this._rect = rect;
        // A fresh non-reactive overlay: no modal grab and no app-focus change.
        const root = this._makeRoot(false);
        this._countdownRoot = root;
        this._placeOutline(this._makeOutline(root), rect);
        const monitor = monitorForRectangle(rect, Main.layoutManager.monitors);
        this._counter = this._makeCountdown(root, monitor, this._delayMs / 1000);
        const deadline = releaseTime + this._delayMs;
        this._timeout(50, () => {
            if (token !== this._serial || !this._allowed()) {
                this._cancel();
                return false;
            }
            const tick = countdownAt(nowMs(), deadline, this._delayMs);
            if (tick.done) {
                this._prepareCapture(token);
                return false;
            }
            this._counter.value.set_text(`${tick.seconds}`);
            // Keep the non-reactive guide above newly opened menus/windows.
            Main.uiGroup.set_child_above_sibling(root, null);
            return true;
        }, true);
    }

    _prepareCapture(token) {
        this._state = STATE.CAPTURING;
        const rect = {...this._rect};
        this._countdownRoot?.destroy();
        this._countdownRoot = null;
        this._counter = null;
        // Let the compositor present the overlay-free scene before reading it.
        // No frozen screenshot is taken when selecting: this capture is fresh.
        this._timeout(100, () => {
            if (token !== this._serial || !this._allowed())
                return;
            if (!validRectangle(rect, this._bounds()))
                throw new Error('Display geometry changed; select the region again');
            this._capture(rect, token);
        });
    }

    _capture(rect, token) {
        this._nativeBusy = true;
        const shooter = new Shell.Screenshot();
        const stream = Gio.MemoryOutputStream.new_resizable();
        const watchdog = this._timeout(15000, () => {
            if (token === this._serial)
                this._fail(new Error('Native screenshot timed out. The clipboard was not changed.'));
        });
        const finish = (source, result) => {
            this._removeSource(watchdog);
            this._nativeBusy = false;
            try {
                const finished = source.screenshot_area_finish(result);
                const success = Array.isArray(finished) ? finished[0] : finished;
                if (!success)
                    throw new Error('GNOME could not capture this region');
                stream.close(null);
                const bytes = stream.steal_as_bytes();
                if (token !== this._serial || !this._allowed())
                    return; // Cancel/lock/disable must never overwrite the clipboard later.
                if (!isPng(bytes.get_data()))
                    throw new Error('The screenshot API did not return a PNG');
                St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD, 'image/png', bytes);
                this._state = STATE.IDLE;
                this._rect = null;
                console.info(`[Tealshot] copied PNG (${rect.width} × ${rect.height} logical pixels)`);
            } catch (error) {
                if (token === this._serial && this._enabled)
                    this._fail(error);
            } finally {
                if (!stream.is_closed())
                    stream.close(null);
            }
        };
        try {
            // Callback form works even when GNOME has Gio._promisified this API.
            shooter.screenshot_area(rect.x, rect.y, rect.width, rect.height, stream, finish);
        } catch (error) {
            this._nativeBusy = false;
            this._removeSource(watchdog);
            stream.close(null);
            throw error;
        }
    }

    _cancel() {
        this._serial = (this._serial ?? 0) + 1;
        this._clearSources();
        this._releaseSelection();
        this._countdownRoot?.destroy();
        this._countdownRoot = this._counter = this._rect = null;
        this._state = STATE.IDLE;
    }
}
