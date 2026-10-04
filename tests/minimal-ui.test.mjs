import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {harness} from './harness.mjs';

function actors(root) {
    return [root, ...root.children.flatMap(actors)];
}
const labels = root => actors(root).filter(actor => typeof actor.text === 'string');

test('selection shows the unchanged frame, but no heading or instructions', async () => {
    const h = await harness();
    h.trigger(); h.drag(undefined, undefined, false);
    assert.equal(labels(h.uiGroup).length, 0);
    const view = h.extension._selectionOutline;
    assert.equal(view.outline.visible, true);
    assert.equal(view.corners.length, 8);
    assert.equal(view.frame.style,
        'background-color: transparent; border: 2px solid rgba(35,201,232,0.52); box-shadow: 0 0 8px 1px rgba(35,201,232,0.24);');
    assert.equal(h.extension._counter, null);
    h.extension.disable();
});

test('countdown has exactly one numeric label and no title, caption or progress bar', async () => {
    const h = await harness(); h.trigger(); h.drag(); h.advance(1);
    const counter = h.extension._counter;
    assert.equal(labels(h.uiGroup).length, 1);
    assert.equal(counter.value.text, '5');
    assert.equal(counter.box.children.length, 1);
    assert.equal(counter.box.width, 80);
    assert.equal(counter.box.x, (3440 - 80) / 2);
    assert.equal(counter.box.y, 40);
    assert.equal(counter.box.style_class, 'tealshot-countdown');
    assert.equal(h.uiGroup.children[0].children.length, 2); // frame + number holder
    h.extension.disable();
});

test('countdown reads 5 4 3 2 1 and disappears before capture; never shows zero', async () => {
    const h = await harness(); h.trigger(); h.drag(); h.advance(1);
    for (const expected of ['5', '4', '3', '2', '1']) {
        assert.equal(h.extension._counter.value.text, expected);
        assert.equal(labels(h.uiGroup).length, 1);
        h.advance(1000);
    }
    assert.equal(h.extension._counter, null);
    assert.equal(h.uiGroup.children.length, 0);
    h.advance(102);
    assert.equal(h.copies.length, 1);
    assert.equal(h.captures[0].overlays, 0);
    h.extension.disable();
});

test('old confirmation=true cannot bring back the successful-copy banner', async () => {
    const h = await harness(); h.settings.values['show-confirmation'] = true;
    h.trigger(); h.drag(); h.advance(5102);
    assert.equal(h.copies.length, 1);
    assert.equal(h.uiGroup.children.length, 0);
    assert.equal(h.jobs.size, 0);
    assert.equal(h.errors.length, 0);
    h.extension.disable();
});

test('custom accent and duration are retained and digit transition stays centered', async () => {
    const h = await harness(); h.settings.values['delay-seconds'] = 10;
    h.settings.values['outline-color'] = '#0AbCdE';
    h.trigger(); h.drag(); h.advance(1);
    const counter = h.extension._counter;
    assert.equal(counter.value.text, '10');
    assert.equal(counter.value.style, 'color: #0ABCDE;');
    const x = counter.box.x;
    h.advance(1000);
    assert.equal(counter.value.text, '9');
    assert.equal(counter.box.x, x);
    assert.equal(counter.box.width, 80);
    h.extension.disable();
});

test('counter is placed on the monitor containing the selected area', async () => {
    const h = await harness(); h.stage.width = 5360;
    h.layoutManager.monitors.push({x: 3440, y: 0, width: 1920, height: 1080, index: 1});
    h.trigger(); h.drag({x: 3700, y: 100}, {x: 4100, y: 400}); h.advance(1);
    assert.equal(h.extension._counter.box.x, 3440 + (1920 - 80) / 2);
    assert.equal(h.extension._counter.box.y, 22);
    h.extension.disable();
});

test('selection frame geometry and corner styling survive transition to countdown', async () => {
    const h = await harness(); h.trigger(); h.drag(undefined, undefined, false);
    const snapshot = a => ({x: a.x, y: a.y, width: a.width, height: a.height,
        style: a.style ?? null, children: a.children.map(snapshot)});
    const before = snapshot(h.extension._selectionOutline.outline);
    h.extension._pan.emit('end'); h.advance(1);
    const after = snapshot(h.extension._countdownRoot.children[0]);
    assert.deepEqual(after, before);
    h.extension.disable();
});

test('minimal styles have no painted card and no leftover banner or progress selectors', async () => {
    const css = await readFile(new URL('../extension/stylesheet.css', import.meta.url), 'utf8');
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = text.match(/\.tealshot-countdown\s*\{([^}]+)\}/)[1];
    assert.match(block, /background-color:\s*transparent/);
    assert.match(block, /border:\s*none/);
    assert.match(block, /box-shadow:\s*none/);
    assert.doesNotMatch(text, /tealshot-(pill|kicker|caption|track|fill)/);
    assert.match(text, /font-size:\s*32px/);
    const prefs = await readFile(new URL('../extension/prefs.js', import.meta.url), 'utf8');
    assert.doesNotMatch(prefs, /Copied confirmation|settings\.bind\('show-confirmation'/);
});

test('a successful minimal capture does not mutate saved preferences', async () => {
    const h = await harness(); const previous = JSON.stringify(h.settings.values);
    h.trigger(); h.drag(); h.advance(6000);
    assert.equal(JSON.stringify(h.settings.values), previous);
    h.extension.disable();
});
