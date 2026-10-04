import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

test('enable does not capture anything', async()=>{const h=await harness();h.advance(60000);assert.equal(h.captures.length,0);h.extension.disable();});
test('time starts on release, not shortcut or drag start', async()=>{
    const h=await harness();h.trigger();h.drag(undefined,undefined,false);h.advance(30000);
    assert.equal(h.captures.length,0);const release=h.now();h.extension._pan.emit('end');h.advance(4999);
    assert.equal(h.captures.length,0);h.advance(102);assert.equal(h.captures.length,1);
    assert.ok(h.captures[0].time>=release+5000);assert.ok(h.captures[0].time<=release+5101);
    h.advance(2);assert.equal(h.copies[0].mime,'image/png');h.extension.disable();
});
test('countdown is non-modal and every overlay actor is click-through', async()=>{
    const h=await harness();h.trigger();assert.equal(h.modal.size,1);h.drag();h.advance(1);assert.equal(h.modal.size,0);
    const check=a=>{assert.equal(a.reactive,false);assert.equal(a.can_focus,false);a.children.forEach(check);};
    h.uiGroup.children.forEach(check);h.extension.disable();assert.equal(h.uiGroup.children.length,0);
});
test('overlays and modal grab are gone before the fresh capture', async()=>{
    const h=await harness();h.trigger();h.drag();h.advance(5102);
    assert.equal(h.captures.length,1);assert.equal(h.captures[0].overlays,0);assert.equal(h.captures[0].modal,0);
    assert.equal(h.streams[0].closed,true);h.extension.disable();
});
test('same shortcut cancels countdown without touching clipboard', async()=>{
    const h=await harness();h.trigger();h.drag();h.advance(2000);h.trigger();h.advance(20000);
    assert.equal(h.copies.length,0);assert.equal(h.captures.length,0);assert.equal(h.uiGroup.children.length,0);assert.equal(h.jobs.size,0);
});
test('Escape releases selection and modal', async()=>{
    const h=await harness();h.trigger();h.extension._selectionRoot.emit('captured-event',{type:()=>1,get_key_symbol:()=>27});h.advance(1);
    assert.equal(h.modal.size,0);assert.equal(h.uiGroup.children.length,0);assert.equal(h.extension._state,'idle');
});
test('tiny selection keeps selection active, without starting timer', async()=>{
    const h=await harness();h.trigger();h.drag({x:100,y:100},{x:102,y:102});h.advance(10000);
    assert.equal(h.extension._state,'selecting');assert.equal(h.captures.length,0);h.extension.disable();
});
test('disabling while selecting leaves no grab or actors', async()=>{
    const h=await harness();h.trigger();h.extension.disable();assert.equal(h.modal.size,0);assert.equal(h.uiGroup.children.length,0);assert.equal(h.jobs.size,0);
});
test('disabling during a native capture prevents late clipboard replacement', async()=>{
    const h=await harness({nativeDelay:1000});h.trigger();h.drag();h.advance(5200);assert.equal(h.captures.length,1);
    h.extension.disable();h.advance(10000);assert.equal(h.copies.length,0);assert.equal(h.streams[0].closed,true);
});
test('disable and re-enable cannot resurrect an earlier capture', async()=>{
    const h=await harness({nativeDelay:1000});h.trigger();h.drag();h.advance(5200);h.extension.disable();h.extension.enable();h.advance(10000);
    assert.equal(h.copies.length,0);h.extension.disable();
});
test('monitor change cancels pending capture', async()=>{
    const h=await harness();h.trigger();h.drag();h.advance(2000);h.layoutManager.emit('monitors-changed');h.advance(10000);assert.equal(h.captures.length,0);
});
test('screen lock cancels pending capture', async()=>{
    const h=await harness();h.trigger();h.drag();h.advance(2000);h.sessionMode.isLocked=true;h.sessionMode.emit('updated');h.advance(10000);
    assert.equal(h.captures.length,0);assert.equal(h.copies.length,0);
});
test('capture completion during lock never copies', async()=>{
    const h=await harness({nativeDelay:1000});h.trigger();h.drag();h.advance(5200);h.sessionMode.isLocked=true;h.sessionMode.emit('updated');h.advance(2000);
    assert.equal(h.copies.length,0);
});
test('native capture failure produces a message and clears overlay', async()=>{
    const h=await harness({nativeError:true});h.trigger();h.drag();h.advance(6000);assert.equal(h.errors.length,1);
    assert.equal(h.copies.length,0);assert.equal(h.uiGroup.children.length,0);assert.equal(h.jobs.size,0);
});
test('invalid image bytes are not copied', async()=>{
    const h=await harness({badPng:true});h.trigger();h.drag();h.advance(6000);assert.equal(h.copies.length,0);assert.equal(h.errors.length,1);
});
test('watchdog clears UI and late capture cannot overwrite clipboard', async()=>{
    const h=await harness({nativeDelay:30000});h.trigger();h.drag();h.advance(21000);assert.equal(h.errors.length,1);
    assert.equal(h.uiGroup.children.length,0);h.advance(30000);assert.equal(h.copies.length,0);assert.equal(h.extension._nativeBusy,false);
});
test('key autorepeat does not cancel immediately', async()=>{
    const h=await harness();h.trigger();h.advance(100);h.trigger();assert.equal(h.extension._state,'selecting');h.extension.disable();
});
test('configured duration and color are snapshotted for each new selection', async()=>{
    const h=await harness();h.settings.values['delay-seconds']=3;h.settings.values['outline-color']='#ff0000';h.trigger();h.drag();h.advance(1);
    assert.equal(h.extension._color,'#FF0000');h.settings.values['delay-seconds']=10;h.advance(3101);assert.equal(h.copies.length,1);h.extension.disable();
});
test('no confirmation setting leaves no actors after capture', async()=>{
    const h=await harness();h.settings.values['show-confirmation']=false;h.trigger();h.drag();h.advance(5200);assert.equal(h.copies.length,1);assert.equal(h.uiGroup.children.length,0);
});
test('synchronous native exception closes stream and clears capture guard', async()=>{
    const h=await harness({syncError:true});h.trigger();h.drag();h.advance(6000);assert.equal(h.copies.length,0);assert.equal(h.errors.length,1);
    assert.equal(h.extension._nativeBusy,false);assert.equal(h.streams[0].closed,true);assert.equal(h.jobs.size,0);
});
