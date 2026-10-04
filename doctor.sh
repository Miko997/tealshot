#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec /usr/bin/python3 tools/manage.py doctor
