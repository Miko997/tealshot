// SPDX-License-Identifier: GPL-3.0-or-later
// Pure functions shared by the extension and its dependency-free tests.
export const DEFAULT_COLOR = '#23C9E8';
export const MIN_SIZE = 4;

export function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
}

export function rectangleFromPoints(start, end, bounds) {
    if (![start.x, start.y, end.x, end.y, bounds.width, bounds.height].every(Number.isFinite))
        throw new Error('Invalid selection coordinates');
    const x1 = clamp(Math.floor(Math.min(start.x, end.x)), 0, bounds.width);
    const y1 = clamp(Math.floor(Math.min(start.y, end.y)), 0, bounds.height);
    const x2 = clamp(Math.ceil(Math.max(start.x, end.x)), 0, bounds.width);
    const y2 = clamp(Math.ceil(Math.max(start.y, end.y)), 0, bounds.height);
    return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
}

export function validRectangle(rect, bounds) {
    return rect && Object.values(rect).every(Number.isInteger) &&
        rect.x >= 0 && rect.y >= 0 && rect.width >= MIN_SIZE && rect.height >= MIN_SIZE &&
        rect.x + rect.width <= bounds.width && rect.y + rect.height <= bounds.height;
}

export function normalizeColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
        ? value.toUpperCase() : DEFAULT_COLOR;
}

export function rgba(value, alpha) {
    const hex = normalizeColor(value);
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${rgb.join(',')},${clamp(alpha, 0, 1)})`;
}

export function countdownAt(nowMs, deadlineMs, durationMs) {
    const remainingMs = Math.max(0, deadlineMs - nowMs);
    return {
        remainingMs,
        seconds: Math.ceil(remainingMs / 1000),
        progress: clamp(remainingMs / Math.max(1, durationMs), 0, 1),
        done: remainingMs <= 0,
    };
}

export function monitorForRectangle(rect, monitors) {
    if (!monitors.length)
        return null;
    let best = monitors[0];
    let area = -1;
    for (const monitor of monitors) {
        const w = Math.max(0, Math.min(rect.x + rect.width, monitor.x + monitor.width) - Math.max(rect.x, monitor.x));
        const h = Math.max(0, Math.min(rect.y + rect.height, monitor.y + monitor.height) - Math.max(rect.y, monitor.y));
        if (w * h > area) {
            area = w * h;
            best = monitor;
        }
    }
    return best;
}

export function isPng(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes?.length >= 24 && signature.every((value, i) => bytes[i] === value);
}
