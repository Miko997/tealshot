// GNOME API TEST DOUBLES. This is NOT a live compositor or a native GUI test.
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as Core from '../extension/core.js';

export async function harness(options = {}) {
    let now = 1000, nextId = 1;
    const jobs = new Map(), captures = [], copies = [], errors = [], logs = [], bindings = new Map();
    const streams = [];
    const settings = {
        values: {'delay-seconds':5, 'outline-color':'#23C9E8', 'outline-width':2, glow:true, 'show-confirmation':true},
        get_int(k) { return this.values[k]; }, get_string(k) { return this.values[k]; }, get_boolean(k) { return this.values[k]; },
    };
    class Actor {
        constructor(properties = {}) {
            Object.assign(this, {x:0, y:0, width:0, height:0, visible:true, reactive:false, can_focus:false}, properties);
            this.children = []; this.events = new Map(); this.actions = []; this.dead = false;
        }
        connect(name, fn) { const id = nextId++; this.events.set(id, {name, fn}); return id; }
        disconnect(id) { this.events.delete(id); }
        emit(name, ...args) { let ret; for (const e of [...this.events.values()]) if (e.name === name) ret = e.fn(this, ...args); return ret; }
        add_child(child) { this.children.push(child); child.parent = this; }
        set_child_above_sibling() {}
        add_constraint(constraint) { this.width = constraint.source.width; this.height = constraint.source.height; }
        set_cursor_type(value) { this.cursor = value; }
        add_action(action) { this.actions.push(action); }
        set_position(x,y) { this.x=x; this.y=y; }
        set_size(w,h) { this.width=w; this.height=h; }
        set_style(value) { this.style=value; }
        set_text(value) { this.text=value; }
        set_width(value) { this.width=value; }
        grab_key_focus() { this.focused = true; }
        hide() { this.visible=false; }
        show() { this.visible=true; }
        destroy() {
            if (this.dead) throw new Error('double actor destruction');
            this.dead=true;
            for (const c of [...this.children]) c.destroy();
            this.children=[];
            if (this.parent) this.parent.children = this.parent.children.filter(c=>c!==this);
            this.events.clear(); this.actions=[];
        }
    }
    class Pan extends Actor {
        set_begin_threshold() {}
        get_centroid_abs() { return this.coords; }
    }
    const stage = new Actor({width:3440,height:1440});
    const uiGroup = new Actor();
    const layoutManager = new Actor();
    layoutManager.monitors=[{x:0,y:0,width:3440,height:1440,index:0}];
    layoutManager.primaryIndex=0;
    const sessionMode = new Actor({isLocked:false,isGreeter:false});
    const modal = new Set();
    const Main = {
        uiGroup, layoutManager, sessionMode, panel:{height:30},
        wm: {addKeybinding(k,s,f,m,fn) { bindings.set(k,fn); return 1; }, removeKeybinding(k) { bindings.delete(k); }},
        pushModal(actor) { modal.add(actor); return actor; },
        popModal(actor) { if (!modal.delete(actor)) throw new Error('bad modal pop'); },
        notifyError(title, body) { errors.push([title,body]); },
    };
    function schedule(delay, fn) { const id=nextId++; jobs.set(id,{due:now+delay,delay,fn}); return id; }
    const GLib = {PRIORITY_DEFAULT:0,PRIORITY_DEFAULT_IDLE:200,SOURCE_REMOVE:false,SOURCE_CONTINUE:true,
        get_monotonic_time:()=>now*1000,
        timeout_add:(_,delay,fn)=>schedule(delay,fn), idle_add:(_,fn)=>schedule(0.001,fn), source_remove:id=>jobs.delete(id)};
    const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
    class MemoryStream {
        constructor() { this.closed=false; streams.push(this); }
        close() { this.closed=true; return true; }
        is_closed() { return this.closed; }
        steal_as_bytes() {
            if (!this.closed) throw new Error('stream must be closed');
            return {get_data:()=>options.badPng?new Uint8Array(24):png};
        }
    }
    class Screenshot {
        screenshot_area(x,y,width,height,stream,callback) {
            captures.push({x,y,width,height,time:now,overlays:uiGroup.children.length,modal:modal.size});
            if (options.syncError) throw new Error('native synchronous failure');
            schedule(options.nativeDelay??1,()=>callback(this, {}));
        }
        screenshot_area_finish() { if (options.nativeError) throw new Error('native capture error'); return [true, {}]; }
    }
    const modules = {
        'gi://Clutter':{default:{FixedLayout:class {},BindConstraint:class {constructor(p){Object.assign(this,p);}},
            BindCoordinate:{ALL:1},CursorType:{CROSSHAIR:1},Orientation:{VERTICAL:1},ActorAlign:{CENTER:1},PanGesture:Pan,
            EventType:{KEY_PRESS:1,BUTTON_PRESS:2},KEY_Escape:27,EVENT_STOP:true,EVENT_PROPAGATE:false}},
        'gi://Gio':{default:{MemoryOutputStream:{new_resizable:()=>new MemoryStream()}}},
        'gi://GLib':{default:GLib},'gi://Meta':{default:{KeyBindingFlags:{NONE:0}}},
        'gi://Shell':{default:{Screenshot,ActionMode:{NONE:0,NORMAL:1}}},
        'gi://St':{default:{Widget:Actor,BoxLayout:Actor,Label:Actor,ClipboardType:{CLIPBOARD:1},
            Clipboard:{get_default:()=>({set_content:(type,mime,bytes)=>copies.push({type,mime,bytes,time:now})})}}},
        'resource:///org/gnome/shell/extensions/extension.js':{Extension:class {getSettings(){return settings;}}},
        'resource:///org/gnome/shell/ui/main.js':Main,'./core.js':Core,
    };
    const context = vm.createContext({console:{info:(...a)=>logs.push(a),error:(...a)=>logs.push(a)},
        global:{stage,get_pointer:()=>[500,200,0]}});
    const code = await readFile(new URL('../extension/extension.js', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(code,{context});
    await module.link(specifier=>{
        const exports=modules[specifier];
        if (!exports) throw new Error('Unexpected import '+specifier);
        return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});
    });
    await module.evaluate();
    const extension = new module.namespace.default();
    extension.enable();
    function advance(ms) {
        const target=now+ms; let loops=0;
        while(true) {
            const entries=[...jobs].filter(([,j])=>j.due<=target).sort((a,b)=>a[1].due-b[1].due);
            if(!entries.length)break;
            if(++loops>20000)throw new Error('timer loop');
            const [id,job]=entries[0]; now=job.due;
            const keep=job.fn();
            if(keep===true && jobs.has(id)) job.due=now+job.delay;
            else jobs.delete(id);
        }
        now=target;
    }
    const trigger=()=>bindings.get('tealshot-capture')?.();
    function drag(start={x:100,y:100},end={x:500,y:400},release=true) {
        const pan=extension._pan;
        pan.coords=start;pan.emit('recognize');
        pan.coords=end;pan.emit('pan-update');
        if(release)pan.emit('end');
    }
    return {extension, settings, captures, copies, errors, logs, jobs, streams, modal, uiGroup,
        layoutManager, sessionMode, stage, trigger, drag, advance, now:()=>now};
}
