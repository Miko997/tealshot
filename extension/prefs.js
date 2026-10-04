// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {normalizeColor} from './core.js';

const PRESETS = [
    ['Ctrl + Windows + S', '<Control><Super>s'],
    ['Ctrl + Alt + S', '<Control><Alt>s'],
    ['Shift + Print Screen', '<Shift>Print'],
    ['Custom / disabled', null],
];

export default class TealshotPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(620, 700);
        const settings = this.getSettings();
        window._tealshotSettings = settings;
        const page = new Adw.PreferencesPage({title: 'Tealshot', icon_name: 'camera-photo-symbolic'});
        window.add(page);
        const workflow = new Adw.PreferencesGroup({title: 'Select → prepare → copy',
            description: 'Drag the area first. The timer starts on mouse release. During the countdown you can use your apps; the same shortcut cancels. Screenshots go to the system clipboard, not to disk.'});
        page.add(workflow);
        const delay = new Adw.SpinRow({title: 'Countdown', subtitle: 'Seconds after you release the mouse',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 60, step_increment: 1, page_increment: 5}), digits: 0});
        settings.bind('delay-seconds', delay, 'value', Gio.SettingsBindFlags.DEFAULT);
        workflow.add(delay);

        const keys = new Adw.PreferencesGroup({title: 'Keyboard shortcut',
            description: 'Windows means the Windows-logo key (also called Super). Ctrl + Windows + S avoids your clipboard shortcut.'});
        page.add(keys);
        const current = settings.get_strv('tealshot-capture')[0] ?? '';
        const index = PRESETS.findIndex(([, value]) => value === current);
        const combo = new Adw.ComboRow({title: 'Shortcut preset', model: Gtk.StringList.new(PRESETS.map(([name]) => name)),
            selected: index < 0 ? 3 : index});
        keys.add(combo);
        const manual = new Adw.EntryRow({title: 'Custom shortcut (GTK notation)', text: current, show_apply_button: true});
        keys.add(manual);
        const status = new Adw.ActionRow({title: 'Examples: <Control><Super>s or <Control><Alt>s',
            subtitle: 'Change only while not capturing. Clear the custom field to disable the shortcut.'});
        keys.add(status);
        combo.connect('notify::selected', () => {
            const value = PRESETS[combo.selected]?.[1];
            if (value) {
                settings.set_strv('tealshot-capture', [value]);
                manual.set_text(value);
                status.set_subtitle('Saved. Another app or extension using the same shortcut can still block it.');
            }
        });
        manual.connect('apply', () => {
            const text = manual.get_text().trim();
            if (!text) {
                settings.set_strv('tealshot-capture', []);
                combo.selected = 3;
                status.set_subtitle('Shortcut disabled.');
                return;
            }
            const [ok, key, modifiers] = Gtk.accelerator_parse(text);
            const isModifier = [Gdk.KEY_Control_L, Gdk.KEY_Control_R, Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
                Gdk.KEY_Super_L, Gdk.KEY_Super_R, Gdk.KEY_Shift_L, Gdk.KEY_Shift_R].includes(key);
            if (!ok || !key || !modifiers || isModifier) {
                status.set_subtitle('Not saved: use a modifier plus a real key, for example <Control><Super>s.');
                return;
            }
            const value = Gtk.accelerator_name(key, modifiers);
            settings.set_strv('tealshot-capture', [value]);
            const preset = PRESETS.findIndex(([, val]) => val === value);
            combo.selected = preset < 0 ? 3 : preset;
            manual.set_text(value);
            status.set_subtitle(`Saved: ${Gtk.accelerator_get_label(key, modifiers)}`);
        });

        const look = new Adw.PreferencesGroup({title: 'Appearance',
            description: 'Only the countdown number and selection frame are shown. No background panel or success message. Both disappear before capture; your apps remain usable during the countdown.'});
        page.add(look);
        const colorRow = new Adw.ActionRow({title: 'Outline and timer color', subtitle: 'Default: cyan / teal #23C9E8'});
        const rgba = new Gdk.RGBA();
        rgba.parse(normalizeColor(settings.get_string('outline-color')));
        const picker = new Gtk.ColorDialogButton({dialog: new Gtk.ColorDialog({with_alpha: false}), rgba,
            valign: Gtk.Align.CENTER});
        picker.connect('notify::rgba', () => {
            const c = picker.get_rgba();
            const hex = [c.red, c.green, c.blue].map(value =>
                Math.round(value * 255).toString(16).padStart(2, '0')).join('');
            settings.set_string('outline-color', `#${hex.toUpperCase()}`);
            colorRow.set_subtitle(`#${hex.toUpperCase()}`);
        });
        colorRow.add_suffix(picker);
        look.add(colorRow);
        const width = new Adw.SpinRow({title: 'Outline width', subtitle: 'Logical pixels',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 6, step_increment: 1, page_increment: 1}), digits: 0});
        settings.bind('outline-width', width, 'value', Gio.SettingsBindFlags.DEFAULT);
        look.add(width);
        const glow = new Adw.SwitchRow({title: 'Subtle cyan glow'});
        settings.bind('glow', glow, 'active', Gio.SettingsBindFlags.DEFAULT);
        look.add(glow);

        const privacy = new Adw.PreferencesGroup({title: 'Clipboard and privacy',
            description: 'Tealshot writes image/png to the standard clipboard. Ctrl+V works in apps that accept pasted images. Clipboard Indicator can keep the image when its image-history feature is enabled and private mode is off. Tealshot does not read the clipboard, auto-paste, upload images, keep image history, or save captures to disk.'});
        page.add(privacy);
        privacy.add(new Adw.ActionRow({title: 'Tealshot 0.1.1 · GNOME Shell 50',
            subtitle: 'Local development build. Esc/right click cancels selection; the capture shortcut cancels the countdown.'}));
    }
}
