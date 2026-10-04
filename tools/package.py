#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build a GNOME-installable extension ZIP; no network, no installation."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root/'extension/metadata.json').read_text())
out = root/'dist'
out.mkdir(exist_ok=True)
archive = out / (metadata['uuid'] + '.shell-extension.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted((root/'extension').rglob('*')):
        if path.is_file() and '__pycache__' not in path.parts:
            z.write(path, path.relative_to(root/'extension'))
    z.write(root/'LICENSE','LICENSE')
print(archive)
print('The standalone extension has no shortcut by default; configure it in preferences.')
print('Use install.sh from the full project for migration of the previous screenshot shortcut.')
