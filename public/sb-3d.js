/*
 * BeeboScore 3D (developed by Beebo) — real 3D pieces for Layout Designer layouts.
 *
 * One WebGL renderer draws every 3D piece on the page, one after the other, into its own place in the layout, so each
 * piece keeps its spot in the layer order like any other piece. It draws only when something changes (a name, a score,
 * a move): a 3D piece standing still costs nothing after its first frame.
 *
 *   Beebo3D.attach(box, el, ctx)   a piece (el.kind === 'three') in this box; ctx = { uid, color(c), font(key), text(tpl), url(tpl) }
 *   Beebo3D.set(P, el)             its settings or live values changed
 *   Beebo3D.react(P, type)         play a 3D move ('3d-spin', '3d-shatter'…)
 *   Beebo3D.release(uid) / sweep(uid)   a layout rebuilds: keep the pieces that come back, drop the rest
 *   Beebo3D.still(el, ctx)         a PNG of the piece (saved with the layout: OBS without graphics acceleration and potato mode show it)
 *   Beebo3D.cost(el), stats(), configure({ quality, weak, force }), moment()
 *
 * Quality tiers: high (live, real shadows), medium (live, 30 fps), low (idle loops and moves are rendered once into
 * frames and played like a flipbook), potato (one still). The tier is picked from a quick test of this PC's graphics,
 * steps down by itself if frames start dropping, and can be set per layout.
 * three.js (MIT) ships inside the app: public/vendor/three.
 */
(function () {
  'use strict';
  if (window.Beebo3D) return;
  const me = document.currentScript, BASE = me && me.src ? me.src.replace(/[^/]*$/, '') : '/static/';
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(+v) ? d : +v);

  // ======================================================================================== what the Designer offers
  const SHAPES = {
    cube: { label: 'Cube', fit: 'sphere' }, plate: { label: 'Plate', fit: 'box', stretch: true }, card: { label: 'Card', fit: 'box', stretch: true },
    sphere: { label: 'Sphere', fit: 'sphere' }, cylinder: { label: 'Cylinder', fit: 'sphere' }, cone: { label: 'Cone', fit: 'sphere' },
    capsule: { label: 'Capsule', fit: 'sphere' }, torus: { label: 'Torus', fit: 'sphere' }, ring: { label: 'Ring', fit: 'sphere' },
    knot: { label: 'Knot', fit: 'sphere' }, prism: { label: 'Prism', fit: 'sphere' }, hex: { label: 'Hex badge', fit: 'box' },
    coin: { label: 'Coin', fit: 'box' }, gem: { label: 'Gem', fit: 'sphere', flat: true }, star: { label: 'Star', fit: 'box' },
    shield: { label: 'Shield', fit: 'box' }, bolt: { label: 'Bolt', fit: 'box' }, heart: { label: 'Heart', fit: 'box' },
    crown: { label: 'Crown', fit: 'box' }, trophy: { label: 'Trophy', fit: 'sphere' },
    extrude: { label: 'Your shape', fit: 'box', stretch: true }, letters: { label: '3D letters', fit: 'box', stretch: true },
    logo3d: { label: 'Picture in 3D', fit: 'box', stretch: true }, model: { label: '3D model (.glb)', fit: 'sphere' },
  };
  const MATS = {
    chrome: { label: 'Chrome', color: '#e8ecf3' }, gold: { label: 'Gold', color: '#f1b84a' }, metal: { label: 'Brushed metal', color: '#9aa3b2' },
    glass: { label: 'Glass', color: '#bfe3ff' }, crystal: { label: 'Crystal', color: '#d7c4ff' }, plastic: { label: 'Glossy', color: '#ff5a1f' },
    matte: { label: 'Matte', color: '#ff5a1f' }, neon: { label: 'Neon', color: '#ff2fd2' }, toon: { label: 'Cartoon', color: '#ffb020' },
    stone: { label: 'Stone', color: '#8c8a86' }, obsidian: { label: 'Obsidian', color: '#ff5a1f' }, holo: { label: 'Hologram', color: '#33e1ff' },
    own: { label: 'The model\'s own', color: '#ffffff', model: true },
  };
  const CAMS = {          // azimuth, elevation (degrees), distance
    front: { label: 'Front', az: 0, el: 0, d: 1 }, hero: { label: 'Low hero', az: 0, el: -16, d: 1.02 }, high: { label: 'From above', az: 0, el: 26, d: 1.05 },
    left: { label: 'Left', az: -34, el: 6, d: 1.05 }, right: { label: 'Right', az: 34, el: 6, d: 1.05 }, iso: { label: 'Corner', az: 38, el: 28, d: 1.12 },
    top: { label: 'Top', az: 0, el: 68, d: 1.1 }, close: { label: 'Close-up', az: 0, el: 2, d: .78 }, wide: { label: 'Wide', az: 0, el: 6, d: 1.4 },
  };
  const IDLES = { none: { label: 'Still' }, spin: { label: 'Turntable' }, sway: { label: 'Sway' }, float: { label: 'Float' }, wobble: { label: 'Wobble' },
    pulse: { label: 'Breathe' }, tilt: { label: 'Showcase tilt' }, orbit: { label: 'Camera orbit' }, clip: { label: 'Model animation' } };
  const REACTS = {
    '3d-spin': { label: '3D spin', emoji: '🌀', tip: 'One fast full turn.', ms: 900 },
    '3d-flip': { label: '3D flip', emoji: '🔄', tip: 'Flips head over heels.', ms: 900 },
    '3d-tumble': { label: '3D tumble', emoji: '🎲', tip: 'Tumbles on two axes and lands.', ms: 1200 },
    '3d-jump': { label: '3D hop', emoji: '🐇', tip: 'Squash, hop and land.', ms: 800 },
    '3d-slam': { label: '3D slam', emoji: '🔨', tip: 'Drops from above and hits hard.', ms: 900 },
    '3d-shatter': { label: '3D shatter', emoji: '💥', tip: 'Breaks into real pieces that fly apart, then snaps back together.', ms: 1900 },
    '3d-pushin': { label: 'Camera push-in', emoji: '🎥', tip: 'The camera rushes in and eases back.', ms: 1400 },
    '3d-orbit': { label: 'Camera orbit', emoji: '🪐', tip: 'The camera circles the piece once.', ms: 1600 },
    '3d-glow': { label: '3D glow', emoji: '🌟', tip: 'Lights up from inside.', ms: 1000 },
    '3d-wobble': { label: '3D wobble', emoji: '🫨', tip: 'Rocks side to side like jelly.', ms: 1000 },
  };
  const FACE = { none: 'Nothing', text: 'Text', picture: 'Picture' };
  const FACE_STYLES = { print: 'Printed', emboss: 'Raised', carve: 'Carved', glow: 'Glowing' };
  const SHADOWS = { none: 'None', drop: 'Drop shadow', floor: 'Soft floor', real: 'Real shadows' };
  const T3 = () => ({ shape: 'cube', mat: 'chrome', color: '', color2: '', edge: '', glow: 0, glowColor: '#ffb020', emissive: 0,
    rx: -14, ry: 26, rz: 0, scale: 1, depth: .35, bevel: .3, round: 0, pts: null, fit: .8,
    cam: 'front', fov: 30, lights: { key: '#ffffff', keyI: 2.4, keyA: 35, keyE: 40, rim: '#ff8a3c', rimI: 2.2, amb: .55, env: 1 },
    shadow: 'drop', idle: 'none', idleSpeed: 1,
    face: { mode: 'none', text: '', src: '', style: 'print', color: '#ffffff', font: 'saira', size: .7, upper: true, italic: true },
    text: '{p1.name}', font: 'saira', upper: true, italic: false, src: '', model: '', clip: '', key: '3d-spin', still: '', stillKey: '' });

  // ======================================================================================== outlines (0..1, y down)
  const OUT = {
    heart: Array.from({ length: 64 }, (_, i) => { const t = i / 64 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [.5 + x / 34, .45 - y / 34]; }),
    shield: [[.08, .06], [.5, 0], [.92, .06], [.92, .42], ...Array.from({ length: 14 }, (_, i) => { const t = (i + 1) / 15; return [.92 - .42 * t, .42 + .58 * Math.sin(t * Math.PI / 2) ** 1.4]; }), ...Array.from({ length: 14 }, (_, i) => { const t = (i + 1) / 15; return [.5 - .42 * t, 1 - .58 * Math.sin(t * Math.PI / 2) ** .8 * t]; }), [.08, .42]],
    crown: [[0, 1], [0, .22], [.18, .58], [.3, .08], [.5, .5], [.7, .08], [.82, .58], [1, .22], [1, 1]],
    bolt: [[.58, 0], [.12, .58], [.44, .58], [.32, 1], [.88, .38], [.54, .38], [.7, 0]],
    star: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .21 : .5; return [.5 + Math.cos(a) * r, .53 + Math.sin(a) * r]; }),
  };

  // ======================================================================================== tracing (text & pictures → outlines)
  // marks: Uint8Array w*h (1 = inside). Walks the edges of the inside pixels (clockwise on screen) into closed loops.
  function contours(mask, w, h) {
    const In = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1, W1 = w + 1, out = new Map();
    const add = (ax, ay, bx, by) => { const k = ay * W1 + ax; let a = out.get(k); if (!a) out.set(k, a = []); a.push(by * W1 + bx); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (mask[y * w + x] !== 1) continue;
      if (!In(x, y - 1)) add(x, y, x + 1, y);
      if (!In(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!In(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!In(x - 1, y)) add(x, y + 1, x, y);
    }
    const loops = [];
    while (out.size) {
      const k0 = out.keys().next().value; let cur = k0, pdx = 0, pdy = 0; const pts = [];
      for (let guard = 0; guard < 4e6; guard++) {
        const list = out.get(cur); if (!list) break;
        const cx = cur % W1, cy = (cur / W1) | 0;
        let pick = 0;
        if (list.length > 1) {            // a corner two inside pixels share: turn right (keeps them apart)
          let best = -9;
          list.forEach((n, i) => { const dx = n % W1 - cx, dy = ((n / W1) | 0) - cy, turn = pdx * dy - pdy * dx; const sc = turn > 0 ? 2 : turn === 0 ? 1 : 0; if (sc > best) { best = sc; pick = i; } });
        }
        const nx = list[pick]; list.splice(pick, 1); if (!list.length) out.delete(cur);
        pts.push([cx, cy]); pdx = nx % W1 - cx; pdy = ((nx / W1) | 0) - cy; cur = nx;
        if (cur === k0) break;
      }
      if (pts.length > 3) loops.push(pts);
    }
    return loops;
  }
  function straighten(p) {         // drop points along a straight run
    const o = [];
    for (let i = 0; i < p.length; i++) { const a = p[(i + p.length - 1) % p.length], b = p[i], c = p[(i + 1) % p.length]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) o.push(b); }
    return o.length >= 3 ? o : p;
  }
  // Ramer–Douglas–Peucker on a closed loop: split at the point farthest from the first, simplify both halves
  function rdpOpen(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = segD(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function rdp(pts, tol) {
    if (pts.length < 6) return pts;
    let f = 0, fd = -1; for (let i = 1; i < pts.length; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; f = i; } }
    const A = rdpOpen(pts.slice(0, f + 1), tol), Bh = rdpOpen(pts.slice(f).concat([pts[0]]), tol);
    return A.slice(0, -1).concat(Bh.slice(0, -1));
  }
  function smoothLoop(p, n = 1) { for (let k = 0; k < n; k++) p = p.map((q, i) => { const a = p[(i + p.length - 1) % p.length], c = p[(i + 1) % p.length]; return [(a[0] + 2 * q[0] + c[0]) / 4, (a[1] + 2 * q[1] + c[1]) / 4]; }); return p; }
  const areaOf = p => p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;
  function inLoop(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
  // a mask → [{ outer, holes }] in pixels
  function outlinesOf(mask, w, h, tol = 1.1) {
    const loops = contours(mask, w, h).map(l => ({ p: rdp(smoothLoop(l, 2), tol), a: 0 })).filter(l => l.p.length >= 3);
    for (const l of loops) l.a = areaOf(l.p);
    const big = loops.reduce((m, l) => Math.abs(l.a) > Math.abs(m.a) ? l : m, { a: 0 }), sign = Math.sign(big.a) || 1;
    const outers = loops.filter(l => Math.sign(l.a) === sign && Math.abs(l.a) > 8).map(l => ({ outer: l.p, a: Math.abs(l.a), holes: [] }));
    for (const l of loops) if (Math.sign(l.a) !== sign && Math.abs(l.a) > 4) {
      const host = outers.filter(o => inLoop(l.p[0], o.outer)).sort((a, b) => a.a - b.a)[0]; if (host) host.holes.push(l.p);
    }
    return outers;
  }
  async function textMask(txt, fontCss, weight, italic) {
    const fs = 180, font = `${italic ? 'italic ' : ''}${weight || 700} ${fs}px ${fontCss}`;
    try { await document.fonts.load(font, txt); } catch (e) {}
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = font;
    const m = g.measureText(txt), w = Math.ceil(Math.max(8, m.width + fs * .3)), h = Math.ceil(fs * 1.35);
    c.width = Math.min(4096, w); c.height = h; g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(txt, fs * .15, h / 2);
    return maskOf(g, c.width, c.height, 110);
  }
  function maskOf(g, w, h, cut) {
    const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > cut ? 1 : 0;
    return { m, w, h };
  }
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; });

  // ======================================================================================== the renderer
  let T = null, A = {}, loading = null, R = null, RAA = null, ENV = null, glOK = null, GLNAME = '', benchTier = '', downshift = 0;
  const cfg = { quality: 'auto', weak: false, force: '' };
  const pieces = new Set(), pool = new Map();
  let raf = 0, lastFrame = 0, slow = 0, frames = 0, lastMs = 0;
  const TIER = { high: { px: 1.5, aa: true, real: 1024, fps: 60, bake: false }, medium: { px: 1, aa: true, real: 512, fps: 30, bake: false },
    low: { px: .8, aa: false, real: 0, fps: 30, bake: true }, potato: { px: .75, aa: false, real: 0, fps: 0, bake: true, still: true } };
  const ORDER = ['potato', 'low', 'medium', 'high'];
  const lower = (a, b) => ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];
  function tier() {
    if (POTATO()) return 'potato';
    if (cfg.force) return cfg.force;
    let t = cfg.quality && cfg.quality !== 'auto' ? cfg.quality : (benchTier || 'medium');
    if (downshift) t = ORDER[Math.max(1, ORDER.indexOf(t) - downshift)];
    if (cfg.weak) t = lower(t, 'low');
    return TIER[t] ? t : 'medium';
  }
  const Q = () => TIER[tier()];

  function load() {
    if (loading) return loading;
    loading = (async () => {
      const [three, rb, room] = await Promise.all([import(BASE + 'vendor/three/three.module.min.js'), import(BASE + 'vendor/three/addons/RoundedBoxGeometry.js'), import(BASE + 'vendor/three/addons/RoomEnvironment.js')]);
      T = three; A.RoundedBox = rb.RoundedBoxGeometry; A.Room = room.RoomEnvironment;
      if (!makeRenderer(true)) { glOK = false; return false; }
      glOK = true; benchTier = bench();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { for (const P of pieces) P.dirty = true; kick(); } });
      return true;
    })().catch(e => { console.warn('BeeboScore 3D could not start — 3D pieces show their saved picture.', e); glOK = false; return false; });
    return loading;
  }
  function makeRenderer(aa) {
    try {
      if (R) { try { R.dispose(); } catch (e) {} }
      const cv = document.createElement('canvas');
      R = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: aa, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      RAA = aa; R.setPixelRatio(1); R.setClearColor(0x000000, 0); R.outputColorSpace = T.SRGBColorSpace;
      R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
      R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
      const pm = new T.PMREMGenerator(R); ENV = pm.fromScene(new A.Room(), .04).texture; pm.dispose();
      for (const P of pieces) if (P.scene) { P.scene.environment = ENV; P.dirty = true; }
      try { const gl = R.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); GLNAME = x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) {}
      return true;
    } catch (e) { console.warn('BeeboScore 3D: no WebGL here', e); R = null; return false; }
  }
  // a quick test of this PC's graphics: a shadowed knot, 8 frames
  function bench() {
    if (/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(GLNAME)) return 'low';
    try {
      const sc = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, 0, 5);
      const m = new T.Mesh(new T.TorusKnotGeometry(.8, .28, 200, 32), new T.MeshStandardMaterial({ metalness: 1, roughness: .2 })); m.castShadow = m.receiveShadow = true;
      const l = new T.DirectionalLight(0xffffff, 2); l.position.set(2, 3, 4); l.castShadow = true; l.shadow.mapSize.set(1024, 1024);
      sc.add(m, l); sc.environment = ENV; R.setSize(512, 512, false);
      const gl = R.getContext(), px = new Uint8Array(4); R.render(sc, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now(); for (let i = 0; i < 8; i++) { m.rotation.y += .2; R.render(sc, cam); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const ms = (performance.now() - t0) / 8; m.geometry.dispose(); m.material.dispose(); l.dispose();
      return ms < 3.5 ? 'high' : ms < 11 ? 'medium' : 'low';
    } catch (e) { return 'medium'; }
  }

  // ======================================================================================== materials
  const texCache = new Map(), shared = new Set(), keep = t => { shared.add(t); return t; };
  function gradTex(steps) { const k = 'toon' + steps; if (texCache.has(k)) return texCache.get(k); const d = new Uint8Array(steps * 4); for (let i = 0; i < steps; i++) { const v = Math.round(60 + 195 * i / (steps - 1)); d.set([v, v, v, 255], i * 4); } const t = new T.DataTexture(d, steps, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; texCache.set(k, keep(t)); return t; }
  function noiseTex() { if (texCache.has('noise')) return texCache.get('noise'); const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), im = g.createImageData(128, 128); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < im.data.length; i += 4) { const v = 90 + r() * 140; im.data.set([v, v, v, 255], i); } g.putImageData(im, 0, 0); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); texCache.set('noise', keep(t)); return t; }
  function blobTex() { if (texCache.has('blob')) return texCache.get('blob'); const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); texCache.set('blob', keep(t)); return t; }
  function makeMat(t3, P, flat) {
    const kind = MATS[t3.mat] ? t3.mat : 'chrome', col = P.ctx.color(t3.color || MATS[kind].color), env = num(t3.lights && t3.lights.env, 1);
    const c = new T.Color(col), em = num(t3.emissive, 0), base = { color: c, flatShading: !!flat, envMapIntensity: env };
    let m;
    switch (kind) {
      case 'chrome': m = new T.MeshStandardMaterial({ ...base, metalness: 1, roughness: .1 }); break;
      case 'gold': m = new T.MeshStandardMaterial({ ...base, metalness: 1, roughness: .26 }); break;
      case 'metal': m = new T.MeshStandardMaterial({ ...base, metalness: .85, roughness: .42 }); break;
      case 'glass': m = new T.MeshPhysicalMaterial({ ...base, metalness: .1, roughness: 0, clearcoat: 1, transparent: true, opacity: .5, side: T.DoubleSide, depthWrite: false, envMapIntensity: env * 2.4, specularIntensity: 1, emissive: c, emissiveIntensity: .12, sheen: .5, sheenColor: c }); break;
      case 'crystal': m = new T.MeshPhysicalMaterial({ ...base, flatShading: true, metalness: .15, roughness: .08, clearcoat: 1, iridescence: .9, iridescenceIOR: 1.6, transparent: true, opacity: .82, envMapIntensity: env * 1.6 }); break;
      case 'plastic': m = new T.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: .32, clearcoat: 1, clearcoatRoughness: .12 }); break;
      case 'matte': m = new T.MeshStandardMaterial({ ...base, metalness: 0, roughness: .9 }); break;
      case 'neon': m = new T.MeshStandardMaterial({ ...base, color: c.clone().multiplyScalar(.12), emissive: c, emissiveIntensity: 1.5 + em * 2, roughness: .45, metalness: .2 }); break;
      case 'toon': m = new T.MeshToonMaterial({ color: c, gradientMap: gradTex(3) }); break;
      case 'stone': m = new T.MeshStandardMaterial({ ...base, metalness: 0, roughness: 1, bumpMap: noiseTex(), bumpScale: 2.2 }); break;
      case 'obsidian': m = new T.MeshPhysicalMaterial({ ...base, color: new T.Color('#0c0c12').lerp(c, .08), metalness: .35, roughness: .14, clearcoat: 1, sheen: .6, sheenColor: c }); break;
      case 'holo': m = new T.MeshStandardMaterial({ ...base, emissive: c, emissiveIntensity: .7 + em, transparent: true, opacity: .5, side: T.DoubleSide, depthWrite: false, metalness: .2, roughness: .3 }); break;
      default: m = new T.MeshStandardMaterial(base);
    }
    if (em && !['neon', 'holo', 'toon'].includes(kind)) { m.emissive = c.clone(); m.emissiveIntensity = em; }
    m.userData.baseEm = m.emissiveIntensity || 0;
    return m;
  }
  function secondMat(t3, P) {
    const m = makeMat({ ...t3, mat: t3.mat === 'glass' || t3.mat === 'holo' ? 'metal' : t3.mat, color: t3.color2 || (t3.mat === 'gold' ? '#2a2018' : '#1a1c24') }, P);
    return m;
  }

  // ======================================================================================== geometry
  function roundPts(pts, r, steps = 5) {
    if (!r) return pts;
    const o = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, rr = Math.min(r, l1 / 2, l2 / 2);
      const a = [p1[0] + (p0[0] - p1[0]) / l1 * rr, p1[1] + (p0[1] - p1[1]) / l1 * rr], b = [p1[0] + (p2[0] - p1[0]) / l2 * rr, p1[1] + (p2[1] - p1[1]) / l2 * rr];
      for (let s = 0; s <= steps; s++) { const t = s / steps, u = 1 - t; o.push([u * u * a[0] + 2 * u * t * p1[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p1[1] + t * t * b[1]]); }
    }
    return o;
  }
  // points in a 0..1 box (y down) → a Shape sized W×H (y up)
  function shapeOf(pts, W, H, holes = []) {
    const v = p => new T.Vector2((p[0] - .5) * W, (.5 - p[1]) * H);
    const s = new T.Shape(pts.map(v));
    for (const h of holes) s.holes.push(new T.Path(h.map(v)));
    return s;
  }
  function extrudeOpts(t3, size) {
    const bev = clamp(num(t3.bevel, .3), 0, 1) * size;
    return { depth: Math.max(.02, num(t3.depth, .35)) * size, bevelEnabled: bev > 0, bevelThickness: bev * .22, bevelSize: bev * .14, bevelSegments: 3, curveSegments: 16, steps: 1 };
  }
  function centerGeo(g) { g.computeBoundingBox(); const c = new T.Vector3(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, -c.z); return g; }
  // planar front mapping: the picture lands on the front of an extruded outline
  function planarUV(g) {
    g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, uv = new Float32Array(p.count * 2), w = (b.max.x - b.min.x) || 1, h = (b.max.y - b.min.y) || 1;
    for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x) / w; uv[i * 2 + 1] = (p.getY(i) - b.min.y) / h; }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  }
  async function shapesFromMask(mk, asp) {
    const outs = outlinesOf(mk.m, mk.w, mk.h, Math.max(.9, mk.h / 160));
    if (!outs.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const o of outs) for (const [x, y] of o.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const sw = x1 - x0 || 1, sh = y1 - y0 || 1, k = 2 / sh;
    const v = ([x, y]) => new T.Vector2((x - x0 - sw / 2) * k, (sh / 2 - (y - y0)) * k);
    return outs.map(o => { const s = new T.Shape(o.outer.map(v)); for (const h of o.holes) s.holes.push(new T.Path(h.map(v))); return s; });
  }
  async function buildGeometry(P, t3) {
    const asp = P.w / Math.max(1, P.h), S = t3.shape, mats = [makeMat(t3, P, (SHAPES[S] || {}).flat)];
    let g = null, group = null, extra = {};
    const ex = (pts, W = 2, H = 2) => { const q = roundPts(pts.map(([x, y]) => [(x - .5) * W, (.5 - y) * H]), clamp(num(t3.round, 0), 0, 1) * Math.min(W, H) / 2, 8); return new T.ExtrudeGeometry(new T.Shape(q.map(([x, y]) => new T.Vector2(x, y))), extrudeOpts(t3, Math.min(W, H) * .5)); };
    switch (S) {
      case 'cube': g = new A.RoundedBox(1.5, 1.5, 1.5, 5, .04 + clamp(num(t3.bevel, .3), 0, 1) * .3); break;
      case 'plate': { const d = Math.max(.04, num(t3.depth, .35) * .6); g = new A.RoundedBox(2 * asp, 2, d, 5, Math.min(d / 2 - .001, .02 + num(t3.bevel, .3) * .12)); break; }
      case 'card': g = new A.RoundedBox(2 * asp, 2, .1, 4, .045); break;
      case 'sphere': g = new T.SphereGeometry(1, 64, 40); break;
      case 'cylinder': g = new T.CylinderGeometry(.8, .8, 1.7, 64); break;
      case 'cone': g = new T.ConeGeometry(.9, 1.8, 64); break;
      case 'capsule': g = new T.CapsuleGeometry(.6, 1, 10, 32); break;
      case 'torus': g = new T.TorusGeometry(.8, .3, 40, 120); break;
      case 'ring': g = new T.TorusGeometry(.9, .09, 20, 160); break;
      case 'knot': g = new T.TorusKnotGeometry(.7, .22, 220, 28); break;
      case 'prism': g = new T.CylinderGeometry(1, 1, .9, 3).rotateX(Math.PI / 2); break;
      case 'hex': g = new T.CylinderGeometry(1, 1, Math.max(.1, num(t3.depth, .35) * .7), 6).rotateX(Math.PI / 2).rotateZ(Math.PI / 6); break;
      case 'coin': g = new T.CylinderGeometry(1, 1, Math.max(.08, num(t3.depth, .35) * .5), 72).rotateX(Math.PI / 2); break;
      case 'gem': g = new T.LatheGeometry([[0, -1], [.92, .18], [.66, .55], [0, .55]].map(([x, y]) => new T.Vector2(x, y)), 10); break;
      case 'star': case 'shield': case 'bolt': case 'heart': case 'crown': g = ex(OUT[S]); break;
      case 'extrude': g = ex(Array.isArray(t3.pts) && t3.pts.length >= 3 ? t3.pts : [[0, 0], [1, 0], [1, 1], [0, 1]], 2 * asp, 2); break;
      case 'trophy': {
        group = new T.Group(); const m2 = secondMat(t3, P); mats.push(m2);
        const cup = new T.LatheGeometry([[0, .1], [.18, .12], [.5, .3], [.72, .7], [.8, 1.15], [.76, 1.18], [.66, .78], [.44, .42], [0, .32]].map(([x, y]) => new T.Vector2(x, y)), 64);
        const stem = new T.CylinderGeometry(.09, .16, .5, 32).translate(0, -.14, 0), knob = new T.SphereGeometry(.16, 32, 16).translate(0, .06, 0);
        const hl = new T.TorusGeometry(.28, .055, 16, 48, Math.PI * 1.25).rotateZ(Math.PI * .37).translate(-.74, .78, 0), hr = hl.clone().rotateY(Math.PI);
        const foot = new A.RoundedBox(.9, .26, .62, 4, .05).translate(0, -.5, 0);
        for (const [geo, m] of [[cup, mats[0]], [stem, mats[0]], [knob, mats[0]], [hl, mats[0]], [hr, mats[0]], [foot, m2]]) group.add(new T.Mesh(geo, m));
        break;
      }
      case 'letters': {
        const txt = P.ctx.text(t3.text || '') || ' ', f = P.ctx.font(t3.font || 'saira');
        const mk = await textMask(t3.upper ? txt.toUpperCase() : txt, f.css, f.weight, !!t3.italic);
        const shapes = await shapesFromMask(mk, asp); if (!shapes) { g = new T.BoxGeometry(.01, .01, .01); break; }
        g = new T.ExtrudeGeometry(shapes, extrudeOpts(t3, 1)); break;
      }
      case 'logo3d': {
        const src = P.ctx.url(t3.src || ''); if (!src) { g = new A.RoundedBox(2 * asp, 2, .2, 4, .05); break; }
        const img = await loadImg(src), k = Math.min(1, 420 / Math.max(img.width, img.height)), w = Math.max(2, Math.round(img.width * k)), h = Math.max(2, Math.round(img.height * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h; const gg = c.getContext('2d'); gg.drawImage(img, 0, 0, w, h);
        const shapes = await shapesFromMask(maskOf(gg, w, h, 60), asp); if (!shapes) { g = new A.RoundedBox(2 * asp, 2, .2, 4, .05); break; }
        g = new T.ExtrudeGeometry(shapes, extrudeOpts(t3, 1)); planarUV(g);
        const tex = new T.Texture(img); tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true; tex.anisotropy = 4;
        const face = new T.MeshStandardMaterial({ map: tex, roughness: .45, metalness: .05, envMapIntensity: num(t3.lights && t3.lights.env, 1) * .6 });
        mats.unshift(face);          // ExtrudeGeometry: group 0 = front & back, group 1 = the sides
        break;
      }
      case 'model': {
        const url = P.ctx.url(t3.model || ''); if (!url) { g = new A.RoundedBox(1.2, 1.2, 1.2, 4, .1); break; }
        if (!A.GLTF) A.GLTF = (await import(BASE + 'vendor/three/addons/GLTFLoader.js')).GLTFLoader;
        const buf = await (await fetch(url)).arrayBuffer(), gltf = await new Promise((ok, no) => new A.GLTF().parse(buf, '', ok, no));
        group = gltf.scene; extra.clips = gltf.animations || [];
        if (t3.mat && t3.mat !== 'own') group.traverse(o => { if (o.isMesh) o.material = mats[0]; });
        else { mats.length = 0; group.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { if (m.envMapIntensity !== undefined) m.envMapIntensity = num(t3.lights && t3.lights.env, 1); mats.push(m); } }); }
        break;
      }
      default: g = new A.RoundedBox(1.5, 1.5, 1.5, 4, .1);
    }
    if (g && !group) { centerGeo(g); group = new T.Group(); group.add(new T.Mesh(g, mats.length > 1 && S === 'logo3d' ? [mats[0], mats[1]] : mats[0])); }
    return { group, mats, extra };
  }
  // scale + centre the object into the piece's box (front view)
  function fitObj(P, group, t3) {
    const asp = P.w / Math.max(1, P.h), meta = SHAPES[t3.shape] || {}, fit = clamp(num(t3.fit, .8), .2, 1.2);
    group.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(group), c = new T.Vector3(), s = new T.Vector3(); box.getCenter(c); box.getSize(s);
    group.position.sub(c);
    const wrap = new T.Group(); wrap.add(group);
    let k;
    if (meta.fit === 'sphere') { const r = s.length() / 2 || 1; k = fit * Math.min(asp, 1) / r * 1.08; }
    else k = Math.min(2 * asp * fit / (s.x || 1), 2 * fit / (s.y || 1));
    wrap.scale.setScalar(k * clamp(num(t3.scale, 1), .2, 3));
    return { wrap, size: s.multiplyScalar(k), k };
  }

  // ======================================================================================== the face (text or picture on the front)
  async function faceCanvas(P, fc, pw, ph) {
    const c = document.createElement('canvas'), W = clamp(Math.round(512 * Math.max(1, pw / ph)), 64, 2048), H = clamp(Math.round(W * ph / pw), 32, 2048);
    c.width = W; c.height = H; const g = c.getContext('2d');
    if (fc.mode === 'picture') {
      const src = P.ctx.url(fc.src || ''); if (!src) return null;
      try { const img = await loadImg(src), k = Math.min(W / img.width, H / img.height); g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k); } catch (e) { return null; }
      return c;
    }
    let txt = P.ctx.text(fc.text || ''); if (!txt) return null; if (fc.upper) txt = txt.toUpperCase();
    const f = P.ctx.font(fc.font || 'saira'), base = H * .72 * clamp(num(fc.size, .7), .2, 1.4);
    const font = s => `${fc.italic ? 'italic ' : ''}${f.weight || 700} ${s}px ${f.css}`;
    try { await document.fonts.load(font(base), txt); } catch (e) {}
    g.font = font(base); const tw = g.measureText(txt).width, s = tw > W * .9 ? base * W * .9 / tw : base;
    g.font = font(s); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = P.ctx.color(fc.color || '#ffffff'); g.fillText(txt, W / 2, H / 2 + s * .04);
    return c;
  }
  async function addFace(P, t3, fc, objSize) {
    if (!fc || fc.mode === 'none') return null;
    const flatFront = ['plate', 'card', 'hex', 'coin', 'extrude', 'shield', 'star', 'heart', 'crown', 'cube', 'bolt'].includes(t3.shape);
    const pw = objSize.x * (t3.shape === 'card' ? .96 : .82), ph = objSize.y * (t3.shape === 'card' ? .96 : .7);
    const cv = await faceCanvas(P, fc, pw, ph); if (!cv) return null;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const st = fc.style || 'print', grp = new T.Group(), z = objSize.z / 2 + (flatFront ? .004 : .02);
    const plane = new T.PlaneGeometry(pw, ph);
    let m;
    if (st === 'glow') {
      m = new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
      const halo = new T.Mesh(plane, new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: .45, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.setScalar(1.04); halo.position.z = z - .002; grp.add(halo);
    } else if (st === 'emboss' || st === 'carve') {
      const b = document.createElement('canvas'); b.width = cv.width; b.height = cv.height; const g = b.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, b.width, b.height); g.filter = 'blur(2px)'; g.drawImage(cv, 0, 0);
      const bt = new T.CanvasTexture(b);
      m = new T.MeshStandardMaterial({ map: tex, transparent: true, bumpMap: bt, bumpScale: st === 'emboss' ? 7 : -7, metalness: .35, roughness: .35, polygonOffset: true, polygonOffsetFactor: -2 });
      if (st === 'carve') m.color = new T.Color('#9a9aa0');
    } else m = new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: .5, metalness: .05, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new T.Mesh(plane, m); mesh.position.z = z; grp.add(mesh);
    return grp;
  }

  // ======================================================================================== a piece
  const KEYS = t3 => ({
    geo: JSON.stringify([t3.shape, t3.depth, t3.bevel, t3.round, t3.pts, t3.fit, t3.font, t3.upper, t3.italic, t3.shape === 'letters' ? t3.text : '', t3.src, t3.model, t3.mat, t3.color, t3.color2, t3.emissive, t3.lights && t3.lights.env]),
    face: JSON.stringify(t3.face || {}),
  });
  function attach(box, el, ctx) {
    const key = ctx.uid + ':' + el.id;
    let P = pool.get(key);
    if (P) pool.delete(key);
    else {
      P = { key, id: el.id, dirty: true, drawn: false, frames: {}, token: 0 };
      P.cv = document.createElement('canvas'); P.cv.className = 'sd-3d-cv'; P.g2 = P.cv.getContext('2d');
      P.img = document.createElement('img'); P.img.className = 'sd-3d-still'; P.img.alt = '';
    }
    css(); P.ctx = ctx; P.box = box; box.append(P.img, P.cv); pieces.add(P);
    set(P, el);
    return P;
  }
  function release(uid) { for (const P of [...pieces]) if (P.key.startsWith(uid + ':')) { pieces.delete(P); pool.set(P.key, P); } }
  function sweep(uid) { for (const [k, P] of [...pool]) if (k.startsWith(uid + ':')) { pool.delete(k); dispose(P); } }
  function detach(P) { pieces.delete(P); dispose(P); }
  function dispose(P) {
    P.dead = true; dropFrames(P);
    if (P.scene) P.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) { for (const k of ['map', 'bumpMap', 'alphaMap']) if (m[k] && !shared.has(m[k])) { try { m[k].dispose(); } catch (e) {} } m.dispose && m.dispose(); } });
    P.scene = null;
  }
  function dropFrames(P) { for (const f of Object.values(P.frames || {})) for (const b of f.list || []) try { b.close(); } catch (e) {} P.frames = {}; }

  function set(P, el) {
    P.el = el; P.t3 = { ...T3(), ...(el.t3 || {}), lights: { ...T3().lights, ...((el.t3 || {}).lights || {}) }, face: { ...T3().face, ...((el.t3 || {}).face || {}) } };
    P.w = Math.max(4, el.w); P.h = Math.max(4, el.h);
    const t3 = P.t3;
    if (t3.still && P.img.getAttribute('src') !== t3.still) P.img.src = t3.still;
    P.img.style.display = t3.still && !P.drawn ? '' : 'none';
    // glow + drop shadow are drawn by the browser around whatever the 3D picture is (cheap in OBS)
    const f = [];
    if (t3.shadow === 'drop') f.push(`drop-shadow(0 ${(P.h * .035).toFixed(1)}px ${(P.h * .045).toFixed(1)}px rgba(0,0,0,.55))`);
    if (num(t3.glow, 0) > 0) f.push(`drop-shadow(0 0 ${num(t3.glow, 0)}px ${P.ctx.color(t3.glowColor || '#ffb020')})`);
    P.cv.style.filter = f.join(' ');
    if (glOK === false) return;
    if (!T) { load().then(ok => ok && !P.dead && set(P, P.el)); return; }
    const k = KEYS(t3), size = P.w + 'x' + P.h;
    if (k.geo !== P.geoKey || size !== P.sizeKey || !P.scene) { P.geoKey = k.geo; P.sizeKey = size; P.faceKey = k.face; rebuild(P); }
    else if (k.face !== P.faceKey || faceText(P) !== P.faceText) { P.faceKey = k.face; refaceP(P); }
    else if (t3.shape === 'letters' && P.ctx.text(t3.text || '') !== P.lettersText) rebuild(P);
    else if (t3.shape === 'logo3d' && P.ctx.url(t3.src || '') !== P.logoSrc) rebuild(P);
    stage(P);
    const v = visualKey(P); if (v !== P.vKey || !P.drawn) { P.vKey = v; P.dirty = true; kick(); }
  }
  // a card shows its picture on the front unless told otherwise
  const faceCfg = P => P.t3.shape === 'card' && (!P.t3.face || P.t3.face.mode === 'none') ? { ...P.t3.face, mode: 'picture', src: P.t3.src || (P.t3.face && P.t3.face.src) || '', style: 'print' } : P.t3.face;
  const faceText = P => { const f = faceCfg(P); return f.mode === 'picture' ? P.ctx.url(f.src || '') : f.mode === 'text' ? P.ctx.text(f.text || '') : ''; };
  const visualKey = P => JSON.stringify([P.geoKey, P.faceKey, P.faceText, P.lettersText, P.t3.rx, P.t3.ry, P.t3.rz, P.t3.scale, P.t3.cam, P.t3.fov, P.t3.lights, P.t3.shadow, P.t3.idle, P.t3.idleSpeed, P.w, P.h, tier()]);

  async function rebuild(P) {
    const tok = ++P.token, t3 = P.t3;
    if (!P.scene) {
      P.scene = new T.Scene(); P.scene.environment = ENV;
      P.cam = new T.PerspectiveCamera(30, 1, .05, 200);
      P.hemi = new T.HemisphereLight(0xffffff, 0x1a1c24, .5); P.keyL = new T.DirectionalLight(0xffffff, 2); P.rimL = new T.DirectionalLight(0xff8a3c, 2);
      P.keyL.shadow.camera.left = P.keyL.shadow.camera.bottom = -3; P.keyL.shadow.camera.right = P.keyL.shadow.camera.top = 3; P.keyL.shadow.bias = -.0006; P.keyL.shadow.normalBias = .02;
      P.spinG = new T.Group(); P.fxG = new T.Group(); P.baseG = new T.Group();
      P.scene.add(P.hemi, P.keyL, P.keyL.target, P.rimL, P.spinG); P.spinG.add(P.fxG); P.fxG.add(P.baseG);
    }
    let built;
    try { built = await buildGeometry(P, t3); } catch (e) { console.warn('BeeboScore 3D: couldn\'t build this piece', e); built = { group: new T.Group(), mats: [], extra: {} }; }
    if (tok !== P.token || P.dead) return;
    // swap the old object out
    for (const o of [...P.baseG.children]) { P.baseG.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
    if (P.floor) { P.scene.remove(P.floor); P.floor = null; }
    if (P.shards) { for (const s of P.shards.list) { s.mesh.geometry.dispose(); s.mesh.material.dispose(); } if (P.shards.grp.parent) P.shards.grp.parent.remove(P.shards.grp); }
    P.shards = null; P.mixer = null;
    const { wrap, size } = fitObj(P, built.group, t3);
    P.baseG.add(wrap); P.obj = wrap; P.objSize = size; P.mats = built.mats; P.clips = (built.extra.clips || []).map(c => c.name || 'Animation');
    wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (built.extra.clips && built.extra.clips.length) { P.mixer = new T.AnimationMixer(built.group); const c = built.extra.clips.find(x => x.name === t3.clip) || built.extra.clips[0]; P.action = P.mixer.clipAction(c); P.clipLen = c.duration || 1; if (t3.idle === 'clip' || t3.clip) P.action.play(); }
    P.lettersText = t3.shape === 'letters' ? P.ctx.text(t3.text || '') : '';
    P.logoSrc = t3.shape === 'logo3d' ? P.ctx.url(t3.src || '') : '';
    await refaceP(P, true);
    if (tok !== P.token || P.dead) return;
    stage(P); P.vKey = visualKey(P); dropFrames(P); P.dirty = true; kick();
    if (P.onBuilt) P.onBuilt();
  }
  async function refaceP(P, inBuild) {
    if (P.face) { P.baseG.remove(P.face); P.face.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); P.face = null; }
    const fc = faceCfg(P);
    P.faceText = faceText(P);
    if (!P.objSize) return;
    const f = await addFace(P, P.t3, fc, P.objSize);
    if (f) { P.face = f; P.baseG.add(f); }
    if (!inBuild) { P.vKey = visualKey(P); dropFrames(P); P.dirty = true; kick(); }
  }
  // lights, camera, rotation, floor: cheap, every change
  function stage(P) {
    if (!P.scene) return;
    const t3 = P.t3, L = t3.lights, q = Q(), d2r = Math.PI / 180;
    P.hemi.intensity = num(L.amb, .55);
    const az = num(L.keyA, 35) * d2r, el = num(L.keyE, 40) * d2r;
    P.keyL.color.set(P.ctx.color(L.key || '#ffffff')); P.keyL.intensity = num(L.keyI, 2.4); P.keyL.position.set(Math.sin(az) * Math.cos(el) * 6, Math.sin(el) * 6, Math.cos(az) * Math.cos(el) * 6);
    P.rimL.color.set(P.ctx.color(L.rim || '#ff8a3c')); P.rimL.intensity = num(L.rimI, 2.2); P.rimL.position.set(-Math.sin(az) * 4, 2.5, -5);
    for (const m of P.mats || []) if (m.envMapIntensity !== undefined && t3.mat !== 'own') m.envMapIntensity = num(L.env, 1) * (t3.mat === 'glass' ? 1.8 : t3.mat === 'crystal' ? 1.6 : 1);
    P.baseG.rotation.set(num(t3.rx, 0) * d2r, num(t3.ry, 0) * d2r, num(t3.rz, 0) * d2r);
    // shadows
    const real = t3.shadow === 'real' && q.real > 0, floorKind = t3.shadow === 'real' ? (real ? 'real' : 'blob') : t3.shadow === 'floor' ? 'blob' : '';
    const span = Math.max(1, P.w / P.h) * 1.7, sc = P.keyL.shadow.camera; if (sc.right !== span) { sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.updateProjectionMatrix(); }
    P.keyL.castShadow = real; if (real && P.keyL.shadow.mapSize.x !== q.real) { P.keyL.shadow.mapSize.set(q.real, q.real); if (P.keyL.shadow.map) { P.keyL.shadow.map.dispose(); P.keyL.shadow.map = null; } }
    if (P.floor && P.floor.userData.kind !== floorKind) { P.scene.remove(P.floor); P.floor.geometry.dispose(); P.floor.material.dispose(); P.floor = null; }
    if (floorKind && !P.floor && P.objSize) {
      const s = P.objSize, w = Math.max(s.x, s.z) * 1.6, y = -Math.max(s.y, .4) / 2 - .02;
      P.floor = floorKind === 'real' ? new T.Mesh(new T.PlaneGeometry(span * 3, span * 3), new T.ShadowMaterial({ opacity: .38 })) : new T.Mesh(new T.PlaneGeometry(w, w * .7), new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, toneMapped: false }));
      P.floor.rotation.x = -Math.PI / 2; P.floor.position.y = y; P.floor.receiveShadow = true; P.floor.userData.kind = floorKind; P.scene.add(P.floor);
    }
    camera(P, 0, 1);
  }
  function camera(P, dAz, dMul) {
    const t3 = P.t3, c = CAMS[t3.cam] || CAMS.front, d2r = Math.PI / 180, asp = P.w / P.h;
    let fov = clamp(num(t3.fov, 30), 10, 75);
    // a wide piece (a name, a plate): step the camera back so its ends aren't seen at a steep angle
    if (2 * Math.atan(Math.tan(fov * d2r / 2) * asp) / d2r > 44) fov = Math.max(6, 2 * Math.atan(Math.tan(22 * d2r) / asp) / d2r);
    P.cam.fov = fov; P.cam.aspect = asp;
    const dist = c.d * dMul / Math.tan(fov * d2r / 2);
    const az = (c.az + dAz) * d2r, el = c.el * d2r;
    P.cam.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist); P.cam.lookAt(0, 0, 0); P.cam.updateProjectionMatrix();
  }

  // ======================================================================================== motion
  const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, out3 = u => 1 - Math.pow(1 - u, 3);
  const IDLE_PERIOD = { spin: 7, sway: 5.2, float: 4, wobble: 3.2, pulse: 2.6, tilt: 6, orbit: 12 };
  function idleAt(P, t) {
    const sp = clamp(num(P.t3.idleSpeed, 1), .1, 4), g = P.spinG, k = P.t3.idle, w = 2 * Math.PI / ((IDLE_PERIOD[k] || 6) / sp);
    g.rotation.set(0, 0, 0); g.position.set(0, 0, 0); g.scale.setScalar(1); P.camAz = 0;
    if (k === 'spin') g.rotation.y = t * w;
    else if (k === 'sway') g.rotation.y = Math.sin(t * w) * .38;
    else if (k === 'float') { g.position.y = Math.sin(t * w) * .07; g.rotation.z = Math.sin(t * w * .5 + 1) * .045; g.rotation.y = Math.sin(t * w * .5) * .08; }
    else if (k === 'wobble') { g.rotation.x = Math.sin(t * w) * .09; g.rotation.z = Math.cos(t * w) * .09; }
    else if (k === 'pulse') g.scale.setScalar(1 + Math.sin(t * w) * .04);
    else if (k === 'tilt') { g.rotation.x = Math.sin(t * w) * .16; g.rotation.y = Math.sin(t * w * .5) * .3; }
    else if (k === 'orbit') P.camAz = (t * w) * 180 / Math.PI;
  }
  function reactAt(P, rx, u) {
    const f = P.fxG; f.rotation.set(0, 0, 0); f.position.set(0, 0, 0); f.scale.setScalar(1); P.camMul = 1; P.camAz2 = 0;
    for (const m of P.mats || []) if (m.emissiveIntensity !== undefined) m.emissiveIntensity = m.userData.baseEm || 0;
    if (!rx) return;
    const e = ease(u), seed = rx.seed;
    switch (rx.type) {
      case '3d-spin': f.rotation.y = e * Math.PI * 2; break;
      case '3d-flip': f.rotation.x = e * Math.PI * 2; f.position.y = Math.sin(u * Math.PI) * .18; break;
      case '3d-tumble': f.rotation.x = e * Math.PI * 2 * (seed > .5 ? 1 : -1); f.rotation.z = e * Math.PI * 2; f.position.y = Math.sin(u * Math.PI) * .3; break;
      case '3d-jump': { const sq = u < .18 ? 1 - Math.sin(u / .18 * Math.PI) * .18 : u > .82 ? 1 - Math.sin((u - .82) / .18 * Math.PI) * .14 : 1; f.scale.set(2 - sq, sq, 2 - sq); f.position.y = u > .18 && u < .82 ? Math.sin((u - .18) / .64 * Math.PI) * .45 : 0; break; }
      case '3d-slam': { const fall = Math.min(1, u / .45); f.position.y = (1 - fall * fall) * 2.6; const hit = u > .45 ? Math.sin(Math.min(1, (u - .45) / .3) * Math.PI) : 0; f.scale.set(1 + hit * .16, 1 - hit * .2, 1 + hit * .16); f.rotation.z = (1 - fall) * .4; break; }
      case '3d-pushin': P.camMul = 1 - Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * .3 * (u < .62 ? 1 : 1 - (u - .62) / .38); break;
      case '3d-orbit': P.camAz2 = e * 360; break;
      case '3d-glow': { const b = Math.sin(u * Math.PI); for (const m of P.mats || []) if (m.emissiveIntensity !== undefined) { if (!m.emissive || m.emissive.getHex() === 0) m.emissive = (m.color || new T.Color(1, 1, 1)).clone(); m.emissiveIntensity = (m.userData.baseEm || 0) + b * 1.6; } f.scale.setScalar(1 + b * .05); break; }
      case '3d-wobble': f.rotation.z = Math.sin(u * Math.PI * 6) * (1 - u) * .38; f.rotation.y = Math.sin(u * Math.PI * 4) * (1 - u) * .2; break;
      case '3d-shatter': shatterAt(P, u, seed); break;
    }
  }
  // break the object into real pieces: triangles grouped round random centres, flung apart, then snapped back
  function shardsOf(P) {
    if (P.shards) return P.shards;
    let s = 1 + (P.id.length * 97) % 1000; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const tris = [], wrap = P.obj; wrap.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(P.baseG.matrixWorld).invert();
    wrap.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, p = g.attributes.position, m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld), mat = [].concat(o.material)[0];
      const v = new T.Vector3();
      for (let i = 0; i + 2 < p.count && tris.length < 40000; i += 3) { const t = []; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(p, i + j).applyMatrix4(m); t.push(v.x, v.y, v.z); } tris.push({ t, mat }); }
      if (g !== o.geometry) g.dispose();
    });
    const K = 22, cs = Array.from({ length: K }, () => tris.length ? tris[Math.floor(rnd() * tris.length)].t.slice(0, 3) : [0, 0, 0]);
    const bins = cs.map(() => new Map());
    for (const tr of tris) { const cx = (tr.t[0] + tr.t[3] + tr.t[6]) / 3, cy = (tr.t[1] + tr.t[4] + tr.t[7]) / 3, cz = (tr.t[2] + tr.t[5] + tr.t[8]) / 3; let bi = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c[0] - cx) ** 2 + (c[1] - cy) ** 2 + (c[2] - cz) ** 2; if (d < bd) { bd = d; bi = i; } }); const b = bins[bi]; if (!b.has(tr.mat)) b.set(tr.mat, []); b.get(tr.mat).push(...tr.t); }
    const grp = new T.Group(), list = [];
    bins.forEach((b, i) => {
      for (const [mat, arr] of b) {
        if (!arr.length) continue;
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); g.computeBoundingBox();
        const c = new T.Vector3(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, -c.z);
        const mm = mat ? mat.clone() : new T.MeshStandardMaterial(); mm.transparent = true; mm.side = T.DoubleSide;
        const mesh = new T.Mesh(g, mm); mesh.position.copy(c); mesh.castShadow = true;
        const dir = c.clone().normalize(); if (!isFinite(dir.x)) dir.set(rnd() - .5, rnd(), rnd() - .5).normalize();
        list.push({ mesh, home: c.clone(), v: dir.multiplyScalar(1.6 + rnd() * 2.2).add(new T.Vector3((rnd() - .5) * .8, .9 + rnd() * 1.4, (rnd() - .2) * 1.6)), av: new T.Vector3((rnd() - .5) * 9, (rnd() - .5) * 9, (rnd() - .5) * 9) });
        grp.add(mesh);
      }
    });
    P.shards = { grp, list };
    return P.shards;
  }
  function shatterAt(P, u, seed) {
    const S = shardsOf(P), fly = .62, back = .82;
    if (u <= 0 || u >= 1) { if (S.grp.parent) S.grp.parent.remove(S.grp); P.obj.visible = true; if (P.face) P.face.visible = true; return; }
    if (!S.grp.parent) P.baseG.add(S.grp);
    P.obj.visible = u >= back; if (P.face) P.face.visible = u >= back;
    S.grp.visible = u < back;
    if (u < back) {
      const t = Math.min(u, fly) / fly * 1.15, r = u > fly ? (u - fly) / (back - fly) : 0, rr = ease(r);
      for (const s of S.list) {
        const px = s.home.x + s.v.x * t, py = s.home.y + s.v.y * t - 4.2 * t * t, pz = s.home.z + s.v.z * t;
        s.mesh.position.set(px + (s.home.x - px) * rr, py + (s.home.y - py) * rr, pz + (s.home.z - pz) * rr);
        s.mesh.rotation.set(s.av.x * t * (1 - rr), s.av.y * t * (1 - rr), s.av.z * t * (1 - rr));
        s.mesh.material.opacity = u < fly ? 1 - Math.max(0, (u - .45) / (fly - .45)) * .5 : .5 + rr * .5;
      }
    } else { const k = (u - back) / (1 - back); P.fxG.scale.setScalar(1 + Math.sin(k * Math.PI) * .08); }
  }
  function react(P, type, o = {}) {
    if (!REACTS[type] || tier() === 'potato') return;
    P.rx = { type, start: performance.now(), ms: REACTS[type].ms, seed: (P.id.length * 31 % 10) / 10 };
    P.dirty = true; kick();
  }
  function moment() { for (const P of pieces) { const k = P.t3 && P.t3.key; if (k && k !== 'none') react(P, k); } }

  // ======================================================================================== drawing
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
  function size(P) { const q = Q(), px = q.px * Math.min(2, window.devicePixelRatio || 1) / (window.devicePixelRatio > 1.4 ? 1.25 : 1); return [Math.max(2, Math.round(P.w * px)), Math.max(2, Math.round(P.h * px))]; }
  function draw(P, g2, cw, ch) {
    const c = R.domElement; if (c.width < cw || c.height < ch) R.setSize(Math.max(c.width, cw), Math.max(c.height, ch), false);
    const H = R.domElement.height;
    R.setViewport(0, 0, cw, ch); R.setScissor(0, 0, cw, ch); R.setScissorTest(true);
    camera(P, (P.camAz || 0) + (P.camAz2 || 0), P.camMul || 1);
    R.render(P.scene, P.cam);
    g2.clearRect(0, 0, cw, ch); g2.drawImage(R.domElement, 0, H - ch, cw, ch, 0, 0, cw, ch);
  }
  function wantsLive(P) { const q = Q(); return !q.still && ((P.t3.idle && P.t3.idle !== 'none' && (P.t3.idle !== 'clip' || P.mixer)) || !!P.rx || (P.mixer && P.t3.idle === 'clip')); }
  function loop(now) {
    raf = 0; if (!R || document.hidden) return;
    const q = Q(), t0 = performance.now();
    if (RAA !== q.aa) { makeRenderer(q.aa); for (const P of pieces) { P.dirty = true; dropFrames(P); } }
    const cap = q.fps || 60, gap = now - lastFrame;
    let again = false;
    if (cap < 60 && gap < 1000 / cap - 3 && lastFrame) { raf = requestAnimationFrame(loop); return; }
    if (lastFrame && gap < 400) { const busy = [...pieces].some(P => P.rx || wantsLive(P)); if (busy) { frames++; if (gap > 1000 / cap * 1.7) slow++; if (frames >= 45) { if (slow > 18 && cfg.quality === 'auto' && !cfg.force && tier() !== 'low') { downshift++; for (const P of pieces) { dropFrames(P); P.dirty = true; } console.info('BeeboScore 3D: frames were dropping — quality lowered to', tier()); } frames = 0; slow = 0; } } }
    lastFrame = now;
    const t = now / 1000;
    for (const P of pieces) {
      if (!P.scene || !P.obj || !P.box.isConnected) continue;
      const [cw, ch] = size(P); if (P.cv.width !== cw || P.cv.height !== ch) { P.cv.width = cw; P.cv.height = ch; P.dirty = true; }
      const rxu = P.rx ? (now - P.rx.start) / P.rx.ms : 0;
      if (P.rx && rxu >= 1) { const was = P.rx; P.rx = null; reactAt(P, null, 0); if (was.type === '3d-shatter') shatterAt(P, 1); P.dirty = true; }
      const live = wantsLive(P);
      // low tier: idle loops and moves play from frames rendered once
      if (q.bake && !q.still) {
        if (P.rx && playBaked(P, 'rx:' + P.rx.type, rxu, cw, ch)) { again = true; continue; }
        if (!P.rx && P.t3.idle !== 'none' && playBaked(P, 'idle', (t % idleLen(P)) / idleLen(P), cw, ch)) { again = true; continue; }
      }
      if (!live && !P.dirty) continue;
      if (!q.still) { idleAt(P, P.t3.idle === 'none' || P.t3.idle === 'clip' ? 0 : t); if (P.mixer && (P.t3.idle === 'clip' || P.t3.clip)) P.mixer.update(Math.min(.1, gap / 1000 || 0)); }
      else idleAt(P, 0);
      reactAt(P, P.rx, rxu);
      draw(P, P.g2, cw, ch); P.dirty = false; P.drawn = true; P.img.style.display = 'none';
      if (live) again = true;
      if (q.bake && !q.still) scheduleBake(P);
    }
    lastMs = performance.now() - t0;
    if (again) raf = requestAnimationFrame(loop);
  }
  const idleLen = P => (IDLE_PERIOD[P.t3.idle] || 6) / clamp(num(P.t3.idleSpeed, 1), .1, 4);

  // ---- flipbook frames for weak PCs
  function playBaked(P, k, u, cw, ch) {
    const f = P.frames[k]; if (!f || f.key !== P.vKey || !f.ready) return false;
    const b = f.list[Math.min(f.list.length - 1, Math.max(0, Math.floor(u * f.list.length)))]; if (!b) return false;
    P.g2.clearRect(0, 0, cw, ch); P.g2.drawImage(b, 0, 0, cw, ch); P.drawn = true; P.img.style.display = 'none'; return true;
  }
  const bakeQ = new Set(); let baking = false;
  function scheduleBake(P) { bakeQ.add(P); if (!baking) { baking = true; (window.requestIdleCallback || setTimeout)(runBakes, { timeout: 600 }); } }
  async function runBakes() {
    for (const P of [...bakeQ]) {
      bakeQ.delete(P); if (P.dead || !P.scene || !P.obj) continue;
      const [cw, ch] = size(P); if (cw * ch * 4 * 40 > 48e6) continue;          // too big to keep frames for: stays live
      const jobs = [];
      if (P.t3.idle && P.t3.idle !== 'none' && P.t3.idle !== 'clip') jobs.push(['idle', Math.round(clamp(idleLen(P) * 12, 24, 72)), u => { idleAt(P, u * idleLen(P)); reactAt(P, null, 0); }]);
      const want = new Set([P.t3.key, ...Object.values((P.el && P.el.react) || {})].filter(v => REACTS[v]));
      for (const type of want) jobs.push(['rx:' + type, Math.round(REACTS[type].ms / 1000 * 30), u => { idleAt(P, 0); reactAt(P, { type, seed: (P.id.length * 31 % 10) / 10 }, u); }]);
      for (const [k, n, pose] of jobs) {
        if (P.frames[k] && P.frames[k].key === P.vKey) continue;
        const scratch = document.createElement('canvas'); scratch.width = cw; scratch.height = ch; const g = scratch.getContext('2d'), list = [];
        for (let i = 0; i < n; i++) {
          if (P.dead || P.rx) break;
          pose(i / n); draw(P, g, cw, ch);
          try { list.push(await createImageBitmap(scratch)); } catch (e) { break; }
          if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
        }
        reactAt(P, null, 0); if (k === 'rx:3d-shatter') shatterAt(P, 1); idleAt(P, 0);
        if (list.length === n) { if (P.frames[k]) for (const b of P.frames[k].list) try { b.close(); } catch (e) {} P.frames[k] = { key: P.vKey, list, ready: true }; }
        else for (const b of list) try { b.close(); } catch (e) {}
      }
      P.dirty = true;
    }
    baking = false; kick();
  }

  // ======================================================================================== stills, cost, stats
  // render one piece by itself (the Designer saves this picture with the layout)
  async function still(el, ctx, w = el.w, h = el.h) {
    if (!(await load())) return null;
    const box = document.createElement('div'), P0 = { key: 'still:' + Math.random(), id: el.id || 'still', dirty: true, frames: {}, token: 0 };
    P0.cv = document.createElement('canvas'); P0.g2 = P0.cv.getContext('2d'); P0.img = document.createElement('img'); P0.ctx = ctx; P0.box = box;
    const built = new Promise(ok => { P0.onBuilt = ok; setTimeout(ok, 8000); });
    set(P0, { ...el, w, h }); await built;
    if (!P0.obj) { dispose(P0); return null; }
    const cw = Math.round(w), ch = Math.round(h); P0.cv.width = cw; P0.cv.height = ch; idleAt(P0, 0); reactAt(P0, null, 0);
    draw(P0, P0.g2, cw, ch);
    const blob = await new Promise(ok => P0.cv.toBlob(ok, 'image/png'));
    dispose(P0);
    return blob;
  }
  const TRIS = { cube: 1.2, plate: 1.2, card: 1, sphere: 5, cylinder: 1, cone: .5, capsule: 2.4, torus: 9.6, ring: 6.4, knot: 12, prism: .1, hex: .1, coin: .6, gem: .2, star: 1.5, shield: 2, bolt: 1, heart: 3, crown: 1.2, trophy: 10, extrude: 1.5, letters: 6, logo3d: 8, model: 15 };
  function cost(el) {
    const t3 = { ...T3(), ...(el.t3 || {}) }, why = [];
    let c = .6 + (TRIS[t3.shape] || 2) * .12;
    if (t3.shadow === 'real') { c += 3; why.push('real shadows'); } else if (t3.shadow === 'floor') c += .3;
    if (['glass', 'crystal', 'holo'].includes(t3.mat)) { c += 1.2; why.push('see-through material'); }
    if (t3.idle && t3.idle !== 'none') { c += t3.idle === 'clip' ? 4 : 2.5; why.push(t3.idle === 'clip' ? 'model animation' : 'idle motion'); }
    if (t3.shape === 'model') { c += 2; why.push('3D model'); }
    if (t3.face && t3.face.mode && t3.face.mode !== 'none') c += .4;
    if (num(t3.glow, 0) > 0) c += .5;
    const area = (el.w * el.h) / (1920 * 1080); c *= 1 + area * 3; if (area > .25) why.push('large on screen');
    return { pts: Math.round(c * 10) / 10, why };
  }
  function stats() { return { ready: !!R, gl: glOK, tier: tier(), auto: benchTier, renderer: GLNAME, pieces: pieces.size, live: [...pieces].filter(wantsLive).length, ms: Math.round(lastMs * 10) / 10, baked: [...pieces].reduce((n, P) => n + Object.keys(P.frames || {}).length, 0) }; }
  function info(P) { return { clips: P.clips || [], tris: (() => { let n = 0; if (P.obj) P.obj.traverse(o => { if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(n); })() }; }
  function configure(o = {}) {
    const before = tier(); Object.assign(cfg, o);
    if (tier() !== before) for (const P of pieces) { dropFrames(P); if (P.scene) stage(P); P.vKey = visualKey(P); P.dirty = true; }
    kick();
  }

  const CSS = '.sd-k-three .sd-3d{position:absolute;inset:0}.sd-3d>canvas,.sd-3d>img{position:absolute;inset:0;width:100%;height:100%;display:block}.sd-3d>img{object-fit:fill}';
  function css() { if (document.getElementById('sb3d-css')) return; const s = document.createElement('style'); s.id = 'sb3d-css'; s.textContent = CSS; document.head.appendChild(s); }

  window.Beebo3D = { attach, set, react, release, sweep, detach, still, cost, stats, info, configure, moment, load, css, tier,
    SHAPES, MATS, CAMS, IDLES, REACTS, FACE, FACE_STYLES, SHADOWS, defaults: T3, outlinesOf, contours, _pieces: pieces };
})();
