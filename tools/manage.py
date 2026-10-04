#!/usr/bin/python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Local, reversible installation. No sudo, network calls or automatic logout."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

UUID = 'tealshot@miko.local'
SCHEMA = 'org.gnome.shell.extensions.tealshot'
ROOT_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys'
BINDING_SCHEMA = ROOT_SCHEMA + '.custom-keybinding'
DEFAULT_BINDING = '<Control><Super>s'
PROJECT = Path(__file__).resolve().parent.parent


def normalise_binding(value: str) -> tuple[tuple[str, ...], str]:
    aliases = {'primary': 'control', 'ctrl': 'control', 'mod1': 'alt', 'win': 'super'}
    mods = [aliases.get(x.lower(), x.lower()) for x in re.findall(r'<([^>]+)>', value)]
    key = re.sub(r'<[^>]+>', '', value).lower()
    return tuple(sorted(set(mods))), key


def is_legacy_capture(command: str) -> bool:
    return re.search(r'(?<![\w-])(flameshot|gnome-screenshot)(?![\w-])', command) is not None


def classify_conflicts(rows: list[dict], bindings: list[str]) -> tuple[list[dict], list[dict]]:
    targets = {normalise_binding(value) for value in bindings}
    replaceable, unknown = [], []
    for row in rows:
        if row.get('binding') and normalise_binding(row['binding']) in targets:
            (replaceable if is_legacy_capture(row.get('command', '')) else unknown).append(row)
    return replaceable, unknown


def safe_to_restore(current: dict, original: dict) -> bool:
    return current.get('binding') == '' and current.get('command') == original.get('command')


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check)


def read_json(path: Path, default):
    if not path.exists():
        return default
    with path.open(encoding='utf-8') as handle:
        return json.load(handle)


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temp = tempfile.mkstemp(prefix='.state-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['install', 'uninstall', 'doctor'])
    parser.add_argument('--yes', action='store_true', help='Confirm the described installation/removal actions')
    args = parser.parse_args()
    if os.geteuid() == 0:
        print('Run this as your desktop user, NOT with sudo.', file=sys.stderr)
        return 2
    try:
        import gi
        gi.require_version('Gio', '2.0')
        from gi.repository import Gio
    except ImportError:
        print('Python GObject bindings are missing. On Ubuntu: sudo apt install python3-gi', file=sys.stderr)
        return 2

    data = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share'))
    state_dir = Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local/state')) / 'tealshot'
    dest = data / 'gnome-shell/extensions' / UUID
    state_file = state_dir / 'installer-state.json'
    launcher = data / 'applications/tealshot-settings.desktop'
    shell = Gio.Settings.new('org.gnome.shell')
    media = Gio.Settings.new(ROOT_SCHEMA)

    def binding_row(path):
        value = Gio.Settings.new_with_path(BINDING_SCHEMA, path)
        return {'path': path, 'name': value.get_string('name'),
                'command': value.get_string('command'), 'binding': value.get_string('binding')}

    if args.action == 'doctor':
        for command in [('gnome-shell', '--version'), ('gnome-extensions', 'info', UUID)]:
            try:
                result = run(*command, check=False)
                print(result.stdout, result.stderr, sep='')
            except OSError as error:
                print(error)
        print('Session:', os.environ.get('XDG_SESSION_TYPE', 'unknown'))
        print('Installed directory:', dest)
        print('Disabled globally:', shell.get_boolean('disable-user-extensions'))
        print('Enabled list contains Tealshot:', UUID in shell.get_strv('enabled-extensions'))
        if dest.exists():
            source = Gio.SettingsSchemaSource.new_from_directory(str(dest / 'schemas'), Gio.SettingsSchemaSource.get_default(), False)
            schema = source.lookup(SCHEMA, False)
            prefs = Gio.Settings.new_full(schema, None, None)
            for key in ['tealshot-capture', 'delay-seconds', 'outline-color', 'outline-width', 'glow']:
                print(key + ':', prefs.get_value(key).print_(True))
        print('\nRecent Tealshot messages (no screenshot data):')
        result = run('journalctl', '--user', '-b', '--no-pager', '-o', 'cat', '--grep=Tealshot', '-n', '40', check=False)
        print(result.stdout, result.stderr, sep='')
        return 0

    if args.action == 'uninstall':
        if not args.yes and input('Remove Tealshot and restore unchanged legacy screenshot shortcuts? [y/N] ').lower() != 'y':
            return 0
        if dest.is_symlink():
            raise RuntimeError(f'Refusing to remove symlink: {dest}')
        run('gnome-extensions', 'disable', UUID, check=False)
        shell.set_strv('enabled-extensions', [x for x in shell.get_strv('enabled-extensions') if x != UUID])
        state = read_json(state_file, {})
        live_paths = set(media.get_strv('custom-keybindings'))
        for original in state.get('legacy_bindings', []):
            if original['path'] in live_paths and safe_to_restore(binding_row(original['path']), original):
                item = Gio.Settings.new_with_path(BINDING_SCHEMA, original['path'])
                item.set_string('binding', original['binding'])
                print('Restored:', original['name'], original['binding'])
        Gio.Settings.sync()
        if dest.exists():
            shutil.rmtree(dest)
        if launcher.exists() and 'X-Tealshot-Managed=true' in launcher.read_text():
            launcher.unlink()
        print('Tealshot removed. Preferences and backup records kept in your user account.')
        return 0

    for binary in ['gnome-shell', 'gnome-extensions', 'glib-compile-schemas']:
        if not shutil.which(binary):
            raise RuntimeError(f'Missing {binary}. This package targets Ubuntu with GNOME Shell 50.')
    version = run('gnome-shell', '--version').stdout.strip()
    match = re.search(r'\b(\d+)\.', version)
    if not match or int(match.group(1)) != 50:
        raise RuntimeError(f'Target is GNOME Shell 50; detected {version!r}. No changes made.')
    if os.environ.get('XDG_SESSION_TYPE') != 'wayland':
        raise RuntimeError('Run the installer in a terminal inside your GNOME Wayland desktop. No changes made.')
    if dest.is_symlink():
        raise RuntimeError(f'Refusing to replace symlink: {dest}')

    rows = [binding_row(path) for path in media.get_strv('custom-keybindings')]
    desired = [DEFAULT_BINDING]
    if (dest / 'schemas/gschemas.compiled').exists():
        source = Gio.SettingsSchemaSource.new_from_directory(str(dest / 'schemas'), Gio.SettingsSchemaSource.get_default(), False)
        old = Gio.Settings.new_full(source.lookup(SCHEMA, False), None, None)
        desired = old.get_strv('tealshot-capture') or [DEFAULT_BINDING]
    replaceable, unknown = classify_conflicts(rows, desired)
    if unknown:
        details = '\n'.join(f"  {x['name']}: {x['binding']}" for x in unknown)
        raise RuntimeError(f'An unrelated custom shortcut already uses this key. It will NOT be modified:\n{details}\nChange that binding in Settings, then rerun the installer.')
    print(f'Tealshot 0.1.1 — {version}')
    print('Install locally:', dest)
    print('Shortcut:', ', '.join(desired), '(Super = Windows key)')
    print('Countdown: 5 seconds by default, starting AFTER selection.')
    for row in replaceable:
        print('Back up and disable old screenshot binding:', row['name'], row['binding'])
    print('No sudo, driver changes, downloads, forced logout, or deletion of other apps.')
    if not args.yes and input('Install? [y/N] ').lower() != 'y':
        return 0

    state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(state_dir, 0o700)
    dest.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.tealshot-install-', dir=dest.parent))
    try:
        shutil.copytree(PROJECT / 'extension', stage, dirs_exist_ok=True)
        shutil.copy2(PROJECT / 'LICENSE', stage / 'LICENSE')
        result = run('glib-compile-schemas', '--strict', str(stage / 'schemas'), check=False)
        if result.returncode:
            raise RuntimeError('Schema compilation failed: ' + result.stderr)
        # Check the new schema before touching active bindings.
        source = Gio.SettingsSchemaSource.new_from_directory(str(stage / 'schemas'), Gio.SettingsSchemaSource.get_default(), False)
        schema = source.lookup(SCHEMA, False)
        if not schema:
            raise RuntimeError('New settings schema could not be loaded.')
        prefs = Gio.Settings.new_full(schema, None, None)
        state = read_json(state_file, {'legacy_bindings': []})
        recorded = {x['path'] for x in state.get('legacy_bindings', [])}
        for row in replaceable:
            if row['path'] not in recorded:
                state.setdefault('legacy_bindings', []).append(row)
        write_json(state_file, state)  # Backup MUST precede any shortcut modification.
        run('gnome-extensions', 'disable', UUID, check=False)
        if dest.exists():
            backup = state_dir / ('extension-before-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
            shutil.copytree(dest, backup)
            shutil.rmtree(dest)
        os.replace(stage, dest)
        prefs.set_strv('tealshot-capture', desired)
        for row in replaceable:
            old_binding = Gio.Settings.new_with_path(BINDING_SCHEMA, row['path'])
            old_binding.set_string('binding', '')
        enabled = list(shell.get_strv('enabled-extensions'))
        if UUID not in enabled:
            enabled.append(UUID)
        shell.set_strv('enabled-extensions', enabled)
        # Do not clear the user's global extension-disabled preference.
        Gio.Settings.sync()
        launcher.parent.mkdir(parents=True, exist_ok=True)
        if not launcher.exists() or 'X-Tealshot-Managed=true' in launcher.read_text():
            launcher.write_text('[Desktop Entry]\nType=Application\nName=Tealshot Settings\n'
                                'Comment=Countdown, selection outline and screenshot shortcut\n'
                                f'Exec=gnome-extensions prefs {UUID}\nIcon=camera-photo-symbolic\n'
                                'Terminal=false\nStartupNotify=false\nCategories=Settings;Utility;\n'
                                'X-Tealshot-Managed=true\n', encoding='utf-8')
        result = run('gnome-extensions', 'enable', UUID, check=False)
        if result.returncode:
            print('GNOME has not discovered the new extension yet; it is queued for your next login.')
        print('\nINSTALLED. Save your work, then log out and back in ONCE (or restart normally).')
        print('Then: Ctrl + Windows + S → drag → release → 5-second countdown → Ctrl+V.')
        print(f'Settings: gnome-extensions prefs {UUID}')
        if shell.get_boolean('disable-user-extensions'):
            print('NOTICE: extensions are disabled globally. Enable "Use Extensions" in Extension Manager.')
        return 0
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(f'Tealshot: {error}', file=sys.stderr)
        raise SystemExit(1)
