import test from 'node:test';
import assert from 'node:assert/strict';
import {rectangleFromPoints, validRectangle, normalizeColor, rgba, countdownAt, monitorForRectangle, isPng} from '../extension/core.js';
const bounds = {width: 3440, height: 1440};

test('reversed drag is normalized', () => {
    assert.deepEqual(rectangleFromPoints({x: 900, y: 600}, {x: 100, y: 200}, bounds),
        {x: 100, y: 200, width: 800, height: 400});
});
test('fractional logical coordinates round outward, without rescaling', () => {
    assert.deepEqual(rectangleFromPoints({x: 10.3, y: 20.8}, {x: 30.4, y: 40.1}, bounds),
        {x: 10, y: 20, width: 21, height: 21});
});
test('selection is clamped to desktop bounds', () => {
    assert.deepEqual(rectangleFromPoints({x: -20, y: -30}, {x: 5000, y: 2000}, bounds),
        {x: 0, y: 0, width: 3440, height: 1440});
});
test('zero and tiny regions are rejected', () => {
    assert.equal(validRectangle({x: 0, y: 0, width: 0, height: 100}, bounds), false);
    assert.equal(validRectangle({x: 0, y: 0, width: 3, height: 3}, bounds), false);
    assert.equal(validRectangle({x: 0, y: 0, width: 4, height: 4}, bounds), true);
});
test('invalid geometry is rejected', () => {
    assert.throws(() => rectangleFromPoints({x: NaN, y: 0}, {x: 100, y: 100}, bounds));
    assert.equal(validRectangle({x: -1, y: 0, width: 100, height: 100}, bounds), false);
    assert.equal(validRectangle({x: 0, y: 0, width: 3441, height: 100}, bounds), false);
});
test('colors cannot inject CSS', () => {
    assert.equal(normalizeColor('#abcdef'), '#ABCDEF');
    assert.equal(normalizeColor('red; background: white;'), '#23C9E8');
    assert.equal(normalizeColor(null), '#23C9E8');
    assert.equal(rgba('#FF0000', 0.5), 'rgba(255,0,0,0.5)');
});
test('timer uses elapsed time and does not drift with tick count', () => {
    assert.equal(countdownAt(1000, 6000, 5000).seconds, 5);
    assert.equal(countdownAt(4999, 6000, 5000).seconds, 2);
    assert.equal(countdownAt(5000, 6000, 5000).seconds, 1);
    assert.equal(countdownAt(7500, 6000, 5000).done, true);
    assert.equal(countdownAt(7500, 6000, 5000).progress, 0);
});
test('countdown HUD uses the monitor with greatest area overlap', () => {
    const left = {x: 0, y: 0, width: 1920, height: 1080};
    const right = {x: 1920, y: 0, width: 3440, height: 1440};
    assert.equal(monitorForRectangle({x: 1800, y: 0, width: 1000, height: 500}, [left, right]), right);
    assert.equal(monitorForRectangle({x: 0, y: 0, width: 100, height: 100}, []), null);
});
test('only PNG byte signatures pass clipboard guard', () => {
    const bytes = new Uint8Array(24);
    bytes.set([137,80,78,71,13,10,26,10]);
    assert.equal(isPng(bytes), true);
    assert.equal(isPng(new Uint8Array(24)), false);
    assert.equal(isPng(new Uint8Array([137,80,78,71])), false);
});
