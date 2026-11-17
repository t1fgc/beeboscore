/*
 * BeeboFX (developed by Beebo) — BeeboScore's own GPU effects engine, for layouts, splashes and the Layout Designer.
 *
 * One WebGL2 context paints every effects layer on the page and stamps each finished frame into that layer's own
 * canvas, so a layout can have effects both behind its names (a storm behind the VS) and in front of them (a hit),
 * while OBS only pays for a single graphics context.
 *
 *   Frame:  HDR scene (light can go brighter than white)  →  bloom (bright parts glow, 3–5 levels)  →  composite:
 *           soft highlight roll-off, colour fringe on hits, clip to the layout's own pieces on the scoreboard,
 *           correct transparency for OBS (glows never turn into dark fringes).
 *   Draws:  particles (sparks that streak, embers that flicker and swirl, smoke, shards, glints), fractal lightning
 *           with restrikes and branches, shockwave rings with colour-split edges, shader flames, screen flashes.
 *   Motion: particles drift through a curl-noise wind field, with gravity, drag and colour/size over their life.
 *
 *   BeeboFX.attach(root, ctx)              a layout (sb-design mount) → handle
 *     h.event(type, info)                  'point' | 'mp' | 'final' | 'win' | 'reset' | 'hype' — plays the look's preset
 *     h.scene(name, on)                    a screen came in / went out
 *     h.atmos(node, kind, color, amt, fb)  takes over a backdrop ('storm', 'splitbolt', 'ash', 'golddust'); false → keep CSS
 *     h.state(S)                           live state (match point flames, cues from the app / Stream Deck)
 *     h.destroy()
 *   BeeboFX.configure({ quality })         'auto' | 'full' | 'light' | 'off'
 *   BeeboFX.stats()                        tier, layers, particles, frame time
 *
 * Quality: full (full resolution, 5 bloom levels, up to 6000 particles), light (60 % resolution, 3 levels, 1500),
 * off (the layout's CSS effects as before). Auto starts at full and steps down by itself if frames run long; with no
 * WebGL2 (OBS without graphics acceleration) or in potato mode it is off. Nothing runs while OBS hides the source or
 * when no effect is alive.
 */
(function () {
  'use strict';
  if (window.BeeboFX) return;
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex0 = c => { c = String(c || '#ffffff').trim(); if (c[0] !== '#') return [1, 1, 1]; if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; const n = parseInt(c.slice(1, 7), 16); return isNaN(n) ? [1, 1, 1] : [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  // a preset can be re-tinted: its warm fire turns another colour (1.11 Porcelain; 1.12.4 Obsidian Glass and the new Porcelain)
  //   cool    cobalt and ice-white          amber  Obsidian Glass: antique gold (1.12.8)        gold  Porcelain: gold leaf
  let TINT = null;
  const TINTS = { cool: { h: 222, l: 1.08, s: .9 }, violet: { h: 258, l: 1.05, s: .95 }, gold: { h: 44, l: .9, s: .9 }, amber: { h: 37, l: 1.02, s: 1 } };   // amber (1.12.8): Obsidian Glass's antique gold
  function retint([r, g, b], T) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (d < .04) return [r, g, b];
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
    if (!(h < 40 || h > 340)) return [r, g, b];                          // only the reds and oranges move (gold stays gold)
    const s = d / (1 - Math.abs(2 * l - 1) || 1), H = T.h, L = Math.min(.92, l * T.l), C = (1 - Math.abs(2 * L - 1)) * Math.min(1, s * T.s), X = C * (1 - Math.abs((H / 60) % 2 - 1)), m = L - C / 2;
    const k = Math.floor(H / 60) % 6, rgb = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][k];
    return rgb.map(v => Math.max(0, Math.min(1, v + m)));
  }
  const hex = c => { const v = hex0(c), T = TINT && TINTS[TINT]; return T ? retint(v, T) : v; };
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ============================================================================================ settings & tiers
  // 1.12.6: drawn at three quarters of the screen's size (sparks, flames and glows are soft — the difference can't be seen,
  // the graphics card does ~45% less), four bloom steps, at most 3000 particles at once
  const TIERS = { full: { res: .75, bloom: 4, cap: 3000, ambient: .8 }, light: { res: .5, bloom: 3, cap: 1200, ambient: .3 } };
  let want = ['auto', 'full', 'light', 'off', 'ultra'].includes(window.__SB_GFXQ) ? window.__SB_GFXQ : 'auto', tier = 'full', broken = false;   // the page can start at the app's setting
  // a software renderer (OBS without graphics acceleration, a PC without a usable GPU) would draw on the CPU and slow the
  // whole page: Auto keeps the engine off there; Full / Light in Settings still force it
  let SOFT = false;
  const ULTRA = () => document.documentElement.classList.contains('sb-ultra');   // 1.11: Ultra-light (sb-perf.js) — the engine stays off
  const G4 = () => (want === 'auto' && window.BeeboFX4 ? window.BeeboFX4.gov.level : 0);   // 1.12.15: BeeboFX 4's governor (Auto only)
  // 1.12.21: Reduce motion (Settings › Accessibility — it calms the stream too) rests the engine the way Effects quality: Off
  // does. Fades and slides still play; rings, sparks and embers do not.
  const CALM = () => document.documentElement.classList.contains('sb-calm');
  const tierOf = () => (broken || POTATO() || CALM() || want === 'off' || want === 'ultra' || ULTRA()) ? 'off' : want === 'light' ? 'light' : want === 'full' ? 'full' : SOFT ? 'off' : G4() >= 2 ? 'off' : G4() === 1 && tier === 'full' ? 'light' : tier;
  const T = () => (window.SBPerf && window.SBPerf.laptop && tierOf() === 'full') ? TIERS.light : (TIERS[tierOf()] || TIERS.light);   // Laptop mode: Full draws at Light's size and particle count

  // ============================================================================================ GL
  let gl = null, glc = null, F16 = false, P = {}, QUAD = null, INST = null, SHARED = false;
  // 1.12.15: BeeboFX draws in BeeboFX 4's shared 'fx' context (BeeboFX 3 draws in it too) and runs on its master clock;
  // without BeeboFX 4 it has its own, as before
  const X4 = () => window.BeeboFX4;
  const RAF = f => (X4() ? X4().raf(f) : requestAnimationFrame(f));
  const own = () => { if (SHARED) X4().claim('fx', 'fx1'); };
  function initGL() {
    if (gl || broken) return !!gl;
    try {
      const c = X4() && X4().context('fx');
      if (c) { SHARED = true; glc = c.canvas; gl = c.gl; own(); }
      else { glc = document.createElement('canvas'); glc.width = glc.height = 4;
        gl = glc.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); }
      if (!gl) throw new Error('no webgl2');
      F16 = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
      try { const dbg = gl.getExtension('WEBGL_debug_renderer_info'); const rn = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rn); } catch (e) {}
      buildPrograms();
      QUAD = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      INST = gl.createBuffer();
      glc.addEventListener('webglcontextlost', e => { e.preventDefault(); broken = true; fallbackAll(); });
      return true;
    } catch (e) { broken = true; gl = null; return false; }
  }

  // ---------------------------------------------------------------------------------------- shaders
  const NOISE = `
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }`;
  const FIRE = `
    vec3 fireRamp(float t, vec3 tint, vec4 ramp){ t=clamp(t,0.,1.);
      vec3 c = mix(vec3(0.), vec3(.55,.05,.01), smoothstep(0.,.35,t));
      c = mix(c, vec3(1.,.36,.06), smoothstep(.3,.62,t));
      c = mix(c, vec3(1.,.78,.32), smoothstep(.6,.86,t));
      c = mix(c, vec3(1.6,1.45,1.2), smoothstep(.86,1.,t));
      if (ramp.a > .5) {                 // a re-tinted look (1.12.4): the same flame, burning in the look's own colour
        vec3 r = ramp.rgb;
        c = mix(vec3(0.), r * .32, smoothstep(0.,.35,t));
        c = mix(c, r, smoothstep(.3,.62,t));
        c = mix(c, mix(r, vec3(1.), .55), smoothstep(.6,.86,t));
        c = mix(c, vec3(1.45,1.42,1.5), smoothstep(.86,1.,t));
      }
      return c * mix(vec3(1.), tint, .55); }`;
  const VS_QUAD = `#version 300 es
    layout(location=0) in vec2 aQ; out vec2 vUv; void main(){ vUv=aQ*.5+.5; gl_Position=vec4(aQ,0.,1.); }`;
  // particles: one quad per particle, stretched along its motion for sparks
  const VS_PART = `#version 300 es
    layout(location=0) in vec2 aQ;
    layout(location=1) in vec4 aPV;      // x, y, vx, vy
    layout(location=2) in vec4 aSK;      // size, life 0→1, kind, seed
    layout(location=3) in vec4 aC;       // rgb (HDR), alpha
    uniform vec2 uRes; out vec2 vQ; out vec4 vC; flat out float vKind; out float vSeed; out float vLife;
    void main(){
      vec2 v = aPV.zw; float sp = length(v); float k = aSK.z;
      vec2 dir = sp > 1. ? v/sp : vec2(1.,0.); vec2 nrm = vec2(-dir.y, dir.x);
      float s = aSK.x; vec2 off;
      if (k > 5.5 && k < 6.5) { float a = aSK.w*6.283 + aSK.y*14.*(aSK.w-.5); vec2 r = vec2(cos(a), sin(a)); vec2 q = vec2(aQ.x, aQ.y*max(.15, abs(cos(aSK.y*18.+aSK.w*9.)))); off = (q.x*r + q.y*vec2(-r.y,r.x)) * s; }   // confetti: tumbles
      else if (k > 7.5 && k < 8.5) { float len = s*2. + sp*.035; off = dir*aQ.x*len + nrm*aQ.y*s*.2; }                                // rain: a thin streak
      else if (k < .5 || (k > 3.5 && k < 4.5)) { float a = aSK.w*6.283 + aSK.y*(k > 3.5 ? 9. : 0.); vec2 r = vec2(cos(a), sin(a)); off = (aQ.x*r + aQ.y*vec2(-r.y,r.x)) * s; }
      else if (k < 1.5) { float len = s + sp*.045; off = dir*aQ.x*len + nrm*aQ.y*s*.55; }
      else off = aQ*s;
      vec2 p = aPV.xy + off;
      gl_Position = vec4(p/uRes*2.-1., 0., 1.) * vec4(1.,-1.,1.,1.);
      vQ = aQ; vC = aC; vKind = k; vSeed = aSK.w; vLife = aSK.y;
    }`;
  const FS_PART = `#version 300 es
    precision highp float; in vec2 vQ; in vec4 vC; flat in float vKind; in float vSeed; in float vLife; uniform float uTime; out vec4 o; ${NOISE}
    void main(){
      float r = length(vQ), a = 0.; vec3 c = vC.rgb;
      if (vKind < .5) { a = exp(-r*r*5.5); c += vec3(1.)*exp(-r*r*40.)*1.2; }                                   // dot / glint core
      else if (vKind < 1.5) { float along = vQ.x*.5+.5; a = exp(-vQ.y*vQ.y*9.) * smoothstep(0.,.35,along) * (1.-smoothstep(.75,1.,along)); a *= 1.;
                              c = mix(c, vec3(1.6,1.5,1.3), exp(-vQ.y*vQ.y*40.)*smoothstep(.5,1.,along)); }              // spark streak, white-hot head
      else if (vKind < 2.5) { float fl = .65+.35*sin(uTime*(14.+vSeed*20.)+vSeed*60.); a = exp(-r*r*4.)*fl; c *= 1.+exp(-r*r*30.)*1.5; }   // ember
      else if (vKind < 3.5) { float n = fbm(vQ*1.6 + vSeed*31. + uTime*.15); a = smoothstep(1.,.15,r) * smoothstep(.25,.75,n) * vC.a;      // smoke (normal blend)
                              o = vec4(c*a, a); return; }
      else if (vKind < 4.5) { float d = abs(vQ.x)+abs(vQ.y)*1.8; a = smoothstep(1.,.85,d); c *= .55 + .9*smoothstep(.2,0.,abs(vQ.x-vQ.y*.3)); }   // shard
      else if (vKind < 5.5) { a = smoothstep(1.,.5,r)*.8; c = mix(c, vec3(1.), .55); }                                                      // snow
      else if (vKind < 6.5) { a = step(abs(vQ.x),.95)*step(abs(vQ.y),.6)*vC.a; if (a < .01) discard; o = vec4(c*(.72+.28*vQ.x)*a, a); return; }   // confetti (normal blend)
      else if (vKind < 7.5) { a = smoothstep(.14,0.,abs(r-.8))*.75 + exp(-length(vQ-vec2(-.33,-.33))*12.)*.9; c = mix(c, vec3(1.), .35); }  // bubble
      else if (vKind < 8.5) { float along = vQ.x*.5+.5; a = exp(-vQ.y*vQ.y*5.)*smoothstep(0.,.7,along)*.55; }                              // rain
      else { float tw = .55+.45*sin(uTime*(3.+vSeed*4.)+vSeed*40.); a = (exp(-abs(vQ.x)*13.-abs(vQ.y)*2.4)+exp(-abs(vQ.y)*13.-abs(vQ.x)*2.4)+exp(-r*r*14.))*tw; c *= 1.25; }   // star
      a *= vC.a; if (a < .002) discard;
      o = vec4(c*a, 0.);                                                                                          // light: adds, no coverage
    }`;
  // lightning: one quad per segment, a white-hot core inside a coloured halo
  const VS_SEG = `#version 300 es
    layout(location=0) in vec2 aQ; layout(location=1) in vec4 aAB; layout(location=2) in vec4 aWI; uniform vec2 uRes;
    out vec2 vP; out vec4 vAB; out vec4 vWI;
    void main(){ vec2 a=aAB.xy, b=aAB.zw, d=b-a; float L=max(length(d),.001); vec2 t=d/L, n=vec2(-t.y,t.x); float hw=aWI.x*7.+6.;
      vec2 p = mix(a,b,aQ.x*.5+.5) + t*aQ.x*hw + n*aQ.y*hw; vP=p; vAB=aAB; vWI=aWI;
      gl_Position = vec4(p/uRes*2.-1.,0.,1.)*vec4(1.,-1.,1.,1.); }`;
  const FS_SEG = `#version 300 es
    precision highp float; in vec2 vP; in vec4 vAB; in vec4 vWI; uniform vec3 uCol; out vec4 o;
    void main(){ vec2 a=vAB.xy, b=vAB.zw, pa=vP-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),.001),0.,1.); float d=length(pa-ba*h);
      float w=vWI.x, I=vWI.y; float core=exp(-d*d/(w*w*.35+.2)); float halo=exp(-d/(w*3.2+2.))*.55;
      vec3 c = uCol*halo*1.4 + mix(uCol,vec3(1.),.75)*core*2.6; c*=I; if(max(c.r,max(c.g,c.b))<.003) discard; o=vec4(c,0.); }`;
  // shockwave ring with colour-split edges; flames; flashes — each a quad over its own box
  const VS_BOX = `#version 300 es
    layout(location=0) in vec2 aQ; uniform vec4 uBox; uniform vec2 uRes; out vec2 vP; out vec2 vL;
    void main(){ vec2 p = uBox.xy + (aQ*.5+.5)*uBox.zw; vP=p; vL=aQ*.5+.5; gl_Position=vec4(p/uRes*2.-1.,0.,1.)*vec4(1.,-1.,1.,1.); }`;
  const FS_RING = `#version 300 es
    precision highp float; in vec2 vP; uniform vec2 uC; uniform float uR, uW, uI, uSplit; uniform vec3 uCol; out vec4 o;
    float ring(float r, float R){ float x=(r-R)/uW; return exp(-x*x*2.2) + .35*exp(-max(0.,R-r)/(uW*3.)) * step(r,R); }
    void main(){ float r=length(vP-uC); vec3 c = vec3(ring(r,uR-uSplit)*uCol.r, ring(r,uR)*uCol.g, ring(r,uR+uSplit)*uCol.b) + vec3(1.)*exp(-pow((r-uR)/(uW*.35),2.))*.6;
      c*=uI; if(max(c.r,max(c.g,c.b))<.003) discard; o=vec4(c,0.); }`;
  const FS_FLAME = `#version 300 es
    precision highp float; in vec2 vP; in vec2 vL; uniform float uTime, uI, uH; uniform vec3 uTint; uniform vec4 uRamp; uniform vec4 uBox; out vec4 o; ${NOISE} ${FIRE}
    void main(){
      vec2 q = vec2((vP.x-uBox.x)/uH, (uBox.y+uBox.w-vP.y)/uH);                   // flame units: 1 = flame height, from the bottom edge up
      float n = fbm(vec2(q.x*1.6, q.y*1.3 - uTime*2.2)) ; float n2 = fbm(vec2(q.x*3.1+7., q.y*2.4 - uTime*3.4));
      float shape = (n*.75 + n2*.45) - q.y*.95;                                  // taller where the noise is strong, dying out with height
      float edgeFade = smoothstep(0.,.06,vL.x)*smoothstep(1.,.94,vL.x);
      float baseFade = uRamp.a > 1.5 ? smoothstep(0., .16, q.y) : 1.;            // lettering on fire: no hard foot, it rises out of the letters
      float t = clamp(shape*1.55, 0., 1.) * edgeFade * baseFade * uI;
      vec3 c = fireRamp(t, uTint, uRamp) * (.55 + uI*.45);
      float a = smoothstep(.04,.3,t); if (a < .003) discard; o = vec4(c*a, 0.); }`;
  const FS_FLASH = `#version 300 es
    precision highp float; in vec2 vP; uniform vec2 uC; uniform float uI, uR; uniform vec3 uCol; out vec4 o;
    void main(){ float r=length(vP-uC)/uR; float f=max(exp(-r*r*2.4)-exp(-2.4),0.)/(1.-exp(-2.4)); vec3 c=uCol*uI*f*1.4; o=vec4(c,0.); }   // falls to nothing at its edge: no visible box`;
  // post: bright pass, dual-filter blur down/up, composite
  const FS_BRIGHT = `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uT; uniform vec2 uTx; uniform float uThr; out vec4 o;
    void main(){ vec3 c = texture(uT,vUv+uTx*vec2(-1,-1)).rgb + texture(uT,vUv+uTx*vec2(1,-1)).rgb + texture(uT,vUv+uTx*vec2(-1,1)).rgb + texture(uT,vUv+uTx*vec2(1,1)).rgb; c*=.25;
      float m=max(c.r,max(c.g,c.b)); float k=max(m-uThr,0.)/max(m,1e-4); o=vec4(c*k*k*1.2 + c*smoothstep(uThr*.5,uThr,m)*.12,1.); }`;
  const FS_DOWN = `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uT; uniform vec2 uTx; out vec4 o;
    void main(){ vec3 c = texture(uT,vUv).rgb*4.; c+=texture(uT,vUv-uTx).rgb; c+=texture(uT,vUv+uTx).rgb; c+=texture(uT,vUv+vec2(uTx.x,-uTx.y)).rgb; c+=texture(uT,vUv-vec2(uTx.x,-uTx.y)).rgb; o=vec4(c/8.,1.); }`;
  const FS_UP = `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uT; uniform vec2 uTx; out vec4 o;
    void main(){ vec2 h=uTx; vec3 c = texture(uT,vUv+vec2(-h.x*2.,0.)).rgb + texture(uT,vUv+vec2(h.x*2.,0.)).rgb + texture(uT,vUv+vec2(0.,-h.y*2.)).rgb + texture(uT,vUv+vec2(0.,h.y*2.)).rgb;
      c += (texture(uT,vUv+vec2(-h.x,h.y)).rgb + texture(uT,vUv+vec2(h.x,h.y)).rgb + texture(uT,vUv+vec2(-h.x,-h.y)).rgb + texture(uT,vUv+vec2(h.x,-h.y)).rgb)*2.; o=vec4(c/12.,1.); }`;
  const FS_COMP = `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D uS, uB, uM; uniform float uBloom, uAb; uniform int uMask; uniform vec2 uRes; uniform vec4 uClip[16]; uniform int uNClip; out vec4 o;
    void main(){
      vec2 px = vec2(vUv.x, 1.-vUv.y)*uRes;
      if (uNClip > 0) { bool inside=false; for(int i=0;i<16;i++){ if(i>=uNClip) break; vec4 r=uClip[i]; if(px.x>=r.x && px.y>=r.y && px.x<=r.x+r.z && px.y<=r.y+r.w){ inside=true; break; } } if(!inside){ o=vec4(0.); return; } }
      vec2 d = (vUv-.5)*uAb;
      vec4 s = texture(uS,vUv); vec3 col = vec3(texture(uS,vUv-d).r, s.g, texture(uS,vUv+d).b);
      vec3 b = vec3(texture(uB,vUv-d*1.5).r, texture(uB,vUv).g, texture(uB,vUv+d*1.5).b);
      col += b*uBloom;
      col = 1. - exp(-col*1.35);                                                   // soft highlight roll-off: hot cores stay white, never clip harshly
      float a = clamp(max(s.a, max(col.r,max(col.g,col.b))), 0., 1.);                // light covers what it lights: correct premultiplied output for OBS
      vec4 res = vec4(min(col, vec3(a)), a);
      if (uMask == 1) res *= texture(uM, vec2(vUv.x, 1.-vUv.y)).a;                    // the exact shapes of the layout's pieces
      o = res; }`;

  function prog(vs, fs) {
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); const nm = inf.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, inf.name); }
    return { p, u };
  }
  function buildPrograms() {
    P.part = prog(VS_PART, FS_PART); P.seg = prog(VS_SEG, FS_SEG); P.ring = prog(VS_BOX, FS_RING); P.flame = prog(VS_BOX, FS_FLAME); P.flash = prog(VS_BOX, FS_FLASH);
    P.bright = prog(VS_QUAD, FS_BRIGHT); P.down = prog(VS_QUAD, FS_DOWN); P.up = prog(VS_QUAD, FS_UP); P.comp = prog(VS_QUAD, FS_COMP);
  }

  // ---------------------------------------------------------------------------------------- render targets
  const targets = new Map();      // "w×h" → { scene, mips[] }
  function tex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, F16 ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, F16 ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function targetsFor(w, h) {
    const k = w + 'x' + h; let R = targets.get(k); if (R) return R;
    if (targets.size > 3) { for (const v of targets.values()) for (const x of [v.scene, ...v.mips]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } targets.clear(); }
    R = { scene: tex(w, h), mips: [] }; let mw = w, mh = h;
    for (let i = 0; i < 5; i++) { mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); R.mips.push(tex(mw, mh)); }
    targets.set(k, R); return R;
  }
  function quad(p) { gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0); }
  function pass(p, dst, src, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null); gl.viewport(0, 0, dst ? dst.w : glc.width, dst ? dst.h : glc.height);
    quad(p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); if (p.u.uT) gl.uniform1i(p.u.uT, 0);
    if (setup) setup(p.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ============================================================================================ curl-noise wind
  const PERM = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  function noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = fade(x), v = fade(y);
    const a = PERM[X] + Y, b = PERM[X + 1] + Y;
    return lerp(lerp(grad(PERM[a], x, y), grad(PERM[b], x - 1, y), u), lerp(grad(PERM[a + 1], x, y - 1), grad(PERM[b + 1], x - 1, y - 1), u), v);
  }
  function curl(x, y, t, out) { const e = .01, s = .0042, X = x * s, Y = y * s + t * .08; const n1 = noise(X, Y + e), n2 = noise(X, Y - e), n3 = noise(X + e, Y), n4 = noise(X - e, Y); out[0] = (n1 - n2) / (2 * e); out[1] = -(n3 - n4) / (2 * e); }

  // ============================================================================================ layers
  // A layer = one 2D canvas on the page + everything drawn into it. Kinds: particles (by blend), bolts, rings, flames, flashes.
  const layers = new Set();
  let amount = 1;                 // the layout's Effects amount (Designer), applied to the particles of the moment playing
  let running = false, last = 0, ema = 16.7, slowFor = 0, renderMs = 0;
  const STRIDE = 12;
  function makeLayer(cv, W, H, o = {}) {
    const L = { cv, x2: cv.getContext('2d'), W, H, clip: o.clip || null, mask: o.mask || null, visible: o.visible || (() => cv.isConnected && cv.offsetParent !== null), ambient: [], parts: { n: 0, a: new Float32Array(0), g: [] }, bolts: [], rings: [], flames: [], flashes: [], ab: 0, bloom: o.bloom ?? 1, dead: false, t: 0, idleClear: false };
    layers.add(L); return L;
  }
  function alive(L) { return L.parts.n > 0 || L.bolts.length || L.rings.length || L.flames.length || L.flashes.length || L.ambient.length || L.ab > .001; }

  // ---------------------------------------------------------------------------------------- particles
  // per particle: x y vx vy | size size0 size1 life dur | kind seed | r g b a (start) → (end) | gravity drag turb glow
  // a re-tinted look: the warm colours a move spells out by hand (hot sparks, ember fades) move to the look's colour too
  const retintAll = cs => { const T = TINT && TINTS[TINT]; if (!T || !cs) return cs; return cs.map(c => { if (!Array.isArray(c)) return c; const m = Math.max(1, c[0], c[1], c[2]); return retint(c.map(v => v / m), T).map(v => v * m); }); };
  function emit(L, n, spec) {
    const cap = T().cap, P2 = L.parts; n = Math.max(0, Math.min(Math.round(n * (spec.scale ?? 1) * amount), cap - P2.n)); if (!n) return;
    if (TINT && spec.colors) spec = { ...spec, colors: retintAll(spec.colors) };
    for (let i = 0; i < n; i++) {
      let x = spec.x, y = spec.y;
      const ar = spec.area;
      if (ar) { if (ar.type === 'rect') { x = ar.x + Math.random() * ar.w; y = ar.y + Math.random() * ar.h; } else if (ar.type === 'line') { const t = Math.random(); x = lerp(ar.x0, ar.x1, t); y = lerp(ar.y0, ar.y1, t); } else if (ar.type === 'ring') { const a = Math.random() * 6.283; x = ar.x + Math.cos(a) * ar.r; y = ar.y + Math.sin(a) * ar.r; } }
      const ang = (spec.dir ?? -Math.PI / 2) + (Math.random() - .5) * (spec.spread ?? 6.283), sp = rnd(...(spec.speed || [0, 0]));
      const c0 = spec.colors[0], c1 = spec.colors[spec.colors.length - 1], cm = spec.colors[1] || c0;
      P2.g.push({ x, y, vx: Math.cos(ang) * sp + (spec.vx || 0), vy: Math.sin(ang) * sp + (spec.vy || 0), s0: rnd(...spec.size), s1: spec.sizeEnd ?? .2, life: 0, dur: rnd(...spec.life),
        kind: spec.kind, seed: Math.random(), c0, cm, c1, a0: spec.alpha ?? 1, g: spec.gravity || 0, drag: spec.drag ?? .6, turb: spec.turb || 0, heat: rnd(...(spec.heat || [1, 1])) });
      P2.n++;
    }
    wake();
  }
  const wind = [0, 0];
  function stepParts(L, dt, time) {
    const g = L.parts.g; let w = 0; const cols = L.cols ? L.cols() : null;
    for (let i = 0; i < g.length; i++) {
      const p = g[i]; p.life += dt / p.dur; if (p.life >= 1) continue;
      if (p.turb) { curl(p.x, p.y, time, wind); p.vx += wind[0] * p.turb * dt; p.vy += wind[1] * p.turb * dt; }
      p.vy += p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
      // 1.12.15: particles set to bounce off pieces — pushed out of a piece the short way, bouncing (losing most of their speed)
      if (cols && p.co) for (const r of cols) { if (p.x > r[0] && p.x < r[0] + r[2] && p.y > r[1] && p.y < r[1] + r[3]) {
        const dl = p.x - r[0], dr = r[0] + r[2] - p.x, du = p.y - r[1], dd = r[1] + r[3] - p.y, m = Math.min(dl, dr, du, dd);
        if (m === du) { p.y = r[1] - .5; p.vy = -Math.abs(p.vy) * .42; p.vx *= .82; } else if (m === dd) { p.y = r[1] + r[3] + .5; p.vy = Math.abs(p.vy) * .42; }
        else if (m === dl) { p.x = r[0] - .5; p.vx = -Math.abs(p.vx) * .42; } else { p.x = r[0] + r[2] + .5; p.vx = Math.abs(p.vx) * .42; }
        break; } }
      g[w++] = p;
    }
    g.length = w; L.parts.n = w;
  }
  function fillParts(L) {
    const g = L.parts.g; let A = L.parts.a; if (A.length < g.length * STRIDE) A = L.parts.a = new Float32Array(Math.max(1024, g.length * 2) * STRIDE);
    // additive first, smoke (normal blend) after: two ranges
    let o = 0, nAdd = 0;
    for (const pass of [0, 1]) for (const p of g) {
      const smoke = p.kind === 3 || p.kind === 6; if ((pass === 1) !== smoke) continue;     // smoke and confetti cover (normal blend)
      const t = p.life, c = t < .5 ? mixc(p.c0, p.cm, t * 2) : mixc(p.cm, p.c1, (t - .5) * 2);
      const fadeIn = clamp(t / .08, 0, 1), fadeOut = 1 - Math.pow(t, 2.2);
      A[o++] = p.x; A[o++] = p.y; A[o++] = p.vx; A[o++] = p.vy;
      A[o++] = p.s0 * lerp(1, p.s1, t); A[o++] = t; A[o++] = p.kind; A[o++] = p.seed;
      A[o++] = c[0] * p.heat; A[o++] = c[1] * p.heat; A[o++] = c[2] * p.heat; A[o++] = p.a0 * fadeIn * fadeOut;
      if (!smoke) nAdd++;
    }
    return { nAdd, nAll: g.length };
  }

  // ---------------------------------------------------------------------------------------- lightning
  // midpoint displacement with branches; a strike restrikes 2–4 times along a slightly new channel, then glows out
  function boltPath(x0, y0, x1, y1, rough, depth, out, width, branch) {
    const pts = [[x0, y0], [x1, y1]];
    let off = Math.hypot(x1 - x0, y1 - y0) * rough;
    for (let d = 0; d < depth; d++) {
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L2 = Math.hypot(dx, dy) || 1;
        const k = (Math.random() - .5) * off; pts.splice(i, 0, [mx - dy / L2 * k, my + dx / L2 * k]);
      }
      off *= .52;
    }
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      out.push({ a: pts[i - 1], b: pts[i], w: width * (1 - t * .55), i: 1 - t * .25 });
      if (branch > 0 && Math.random() < .045 && t < .8) {
        const p = pts[i], ang = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < .5 ? -1 : 1) * rnd(.35, .9), len = Math.hypot(x1 - x0, y1 - y0) * rnd(.12, .32) * (1 - t);
        const sub = []; boltPath(p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, rough * 1.1, Math.max(3, depth - 2), sub, width * .45, branch - 1);
        for (const s of sub) { s.i *= .6; out.push(s); }
      }
    }
    return out;
  }
  function strike(L, o) {
    burst();
    const segs = boltPath(o.x0, o.y0, o.x1, o.y1, o.rough ?? .22, o.depth ?? 7, [], o.width ?? 3.2, o.branch ?? 2);
    const restrikes = o.restrikes ?? (2 + (Math.random() * 3 | 0));
    L.bolts.push({ segs, o, col: hex(o.color), t: 0, dur: o.dur ?? .55, flick: Array.from({ length: restrikes }, (_, i) => i === 0 ? 0 : rnd(.06, .32) * i), I: o.intensity ?? 1 });
    if (o.flash !== false) L.flashes.push({ x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2, r: o.flashR || Math.max(L.W, L.H) * .7, col: hex(o.color), I: (o.flashI ?? .55) * (o.intensity ?? 1), t: 0, dur: .45, pulses: 1 });
    if (o.sparks !== false) emit(L, 26 * (o.intensity ?? 1), { x: o.x1, y: o.y1, kind: 1, speed: [200, 700], dir: -Math.PI / 2, spread: 2.6, gravity: 1100, drag: .8, size: [2, 4], life: [.25, .6], colors: [[1.8, 1.7, 1.5], hex(o.color), hex(o.color)], heat: [1, 2.2] });
    L.ab = Math.max(L.ab, .006 * (o.intensity ?? 1));
    wake();
  }
  function boltAlpha(B) {
    const t = B.t; let I = 0;
    for (const f of B.flick) { const d = t - f; if (d >= 0) I = Math.max(I, d < .03 ? 1 : Math.exp(-(d - .03) * 16)); }
    return I * B.I * (1 - clamp((t - B.dur) / .4, 0, 1));
  }
  function jitter(B) { for (const s of B.segs) { s.a = [s.a[0] + rnd(-1.5, 1.5), s.a[1]]; s.b = [s.b[0] + rnd(-1.5, 1.5), s.b[1]]; } }

  // ---------------------------------------------------------------------------------------- the frame
  function wake() { if (!running && gl && tierOf() !== 'off') { running = true; last = 0; RAF(frame); } }
  // 1.12 power: only the looping background effects running (no moment playing) → 30 frames a second, not 60; Laptop mode
  // keeps everything at 30. Hidden in OBS → the loop stops altogether and SBPerf wakes it.
  let lastBurst = 0;
  const burst = () => { lastBurst = performance.now(); };
  function frame(now) {
    if (!gl || tierOf() === 'off') { running = false; return; }
    const SP = window.SBPerf, idle = SP && (SP.idle || SP.resting);
    if (idle) { running = false; last = 0; if (SP.whenAwake) SP.whenAwake(wake); return; }
    const cap = (SP && SP.laptop) || now - lastBurst > 2500 ? 30 : 60;
    if (last && now - last < 1000 / cap - 3) { RAF(frame); return; }
    own();
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; const gap = last ? now - last : 16.7; last = now;
    let any = false; const t0 = performance.now();
    for (const L of layers) {
      if (L.dead) { layers.delete(L); continue; }
      const onlyAmbient = !L.parts.n && !L.bolts.length && !L.rings.length && !L.flames.length && !L.flashes.length;
      if (!alive(L) || (onlyAmbient && !L.visible())) { if (!L.idleClear) { L.x2.clearRect(0, 0, L.cv.width, L.cv.height); L.idleClear = true; } continue; }
      any = true; if (idle) continue;
      const vis = L.visible();
      L.t += dt; tick(L, dt, now / 1000, vis);
      if (vis) { render(L, now / 1000); L.idleClear = false; } else if (!L.idleClear) { L.x2.clearRect(0, 0, L.cv.width, L.cv.height); L.idleClear = true; }
    }
    renderMs = renderMs * .9 + (performance.now() - t0) * .1;
    // auto quality: frames running long while effects play → step down (full → light → off, back to the CSS effects).
    // 1.12.15: with BeeboFX 4 its governor decides for every engine at once (see tierOf)
    if (!X4() && any && !idle && want === 'auto' && cap === 60) { ema = ema * .95 + gap * .05; if (ema > 26) slowFor += dt; else slowFor = Math.max(0, slowFor - dt * .5);
      if (slowFor > 3) { slowFor = 0; ema = 16.7; if (tier === 'full') tier = 'light'; else { tier = 'off'; fallbackAll(); } } }
    if (any) RAF(frame); else running = false;
  }
  function tick(L, dt, time, vis) {
    for (const a of L.ambient) if (vis && a.step) a.step(dt, time);
    stepParts(L, dt, time);
    for (const B of L.bolts) { B.t += dt; if (Math.random() < .35) jitter(B); }
    L.bolts = L.bolts.filter(B => B.t < B.dur + .45);
    for (const r of L.rings) r.t += dt; L.rings = L.rings.filter(r => r.t < r.dur);
    for (const f of L.flashes) f.t += dt; L.flashes = L.flashes.filter(f => f.t < f.dur);
    for (const f of L.flames) { f.t += dt; f.cur = lerp(f.cur || 0, f.target, 1 - Math.exp(-dt * (f.target > (f.cur || 0) ? 7 : 2.2))); if (f.until && f.t > f.until) f.target = 0; }
    L.flames = L.flames.filter(f => f.target > 0 || f.cur > .01);
    L.ab *= Math.exp(-dt * 7);
  }
  function render(L, time) {
    const tr = T(), s = tr.res * Math.min(1.5, window.__SB_OUT || 1), w = Math.max(2, Math.round(L.W * s)), h = Math.max(2, Math.round(L.H * s));   // 1.12.18: sharper on a 4K browser source
    if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
    if (L.cv.width !== w || L.cv.height !== h) { L.cv.width = w; L.cv.height = h; }
    const R = targetsFor(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.scene.f); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    // flashes & flames under the particles
    for (const f of L.flashes) {
      const k = f.t / f.dur, I = f.I * (k < .08 ? k / .08 : Math.exp(-(k - .08) * 5));
      boxDraw(P.flash, [f.x - f.r, f.y - f.r, f.r * 2, f.r * 2], L, u => { gl.uniform2f(u.uC, f.x, f.y); gl.uniform1f(u.uI, I); gl.uniform1f(u.uR, f.r); gl.uniform3fv(u.uCol, f.col); });
    }
    for (const f of L.flames) {
      if (f.cur < .01) continue; const H = f.h * (.6 + .4 * f.cur);
      boxDraw(P.flame, [f.x, f.y + f.hBox - H * 1.15, f.w, H * 1.15], L, u => { gl.uniform1f(u.uTime, time + f.seed); gl.uniform1f(u.uI, f.cur); gl.uniform1f(u.uH, H); gl.uniform3fv(u.uTint, f.tint); if (u.uRamp) gl.uniform4fv(u.uRamp, f.ramp || [0, 0, 0, 0]); gl.uniform4f(u.uBox, f.x, f.y + f.hBox - H * 1.15, f.w, H * 1.15); });
    }
    for (const r of L.rings) {
      const k = r.t / r.dur, e = 1 - Math.pow(1 - k, 3), R2 = lerp(r.r0, r.r1, e), I = r.I * (1 - k) * (1 - k), W2 = r.w * (1 + k * 1.5);
      boxDraw(P.ring, [r.x - R2 - W2 * 4, r.y - R2 - W2 * 4, (R2 + W2 * 4) * 2, (R2 + W2 * 4) * 2], L, u => { gl.uniform2f(u.uC, r.x, r.y); gl.uniform1f(u.uR, R2); gl.uniform1f(u.uW, W2); gl.uniform1f(u.uI, I); gl.uniform1f(u.uSplit, W2 * .9 * r.split); gl.uniform3fv(u.uCol, r.col); });
    }
    // lightning
    if (L.bolts.length) {
      gl.useProgram(P.seg.p); gl.uniform2f(P.seg.u.uRes, L.W, L.H);
      for (const B of L.bolts) {
        const I = boltAlpha(B); if (I < .01) continue;
        const A = new Float32Array(B.segs.length * 8); let o = 0;
        for (const sg of B.segs) { A[o++] = sg.a[0]; A[o++] = sg.a[1]; A[o++] = sg.b[0]; A[o++] = sg.b[1]; A[o++] = sg.w; A[o++] = sg.i * I; A[o++] = 0; A[o++] = 0; }
        gl.uniform3fv(P.seg.u.uCol, B.col);
        instDraw(A, 8, [[1, 4, 0], [2, 4, 16]], B.segs.length);
      }
    }
    // particles
    if (L.parts.n) {
      const { nAdd, nAll } = fillParts(L);
      gl.useProgram(P.part.p); gl.uniform2f(P.part.u.uRes, L.W, L.H); gl.uniform1f(P.part.u.uTime, time);
      const A = L.parts.a.subarray(0, nAll * STRIDE);
      gl.bindBuffer(gl.ARRAY_BUFFER, INST); gl.bufferData(gl.ARRAY_BUFFER, A, gl.STREAM_DRAW);
      const at = (loc, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, off); gl.vertexAttribDivisor(loc, 1); };
      quadAttr(); gl.bindBuffer(gl.ARRAY_BUFFER, INST); at(1, 0); at(2, 16); at(3, 32);
      if (nAdd) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nAdd);
      if (nAll > nAdd) {                       // smoke: over, not added
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        for (const loc of [1, 2, 3]) gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, (loc - 1) * 16 + nAdd * STRIDE * 4);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nAll - nAdd); gl.blendFunc(gl.ONE, gl.ONE);
      }
      for (const loc of [1, 2, 3]) { gl.vertexAttribDivisor(loc, 0); gl.disableVertexAttribArray(loc); }
    }
    if (L.swarms && L.swarms.length) for (const S of L.swarms) { try { drawSwarm(S, L, time); } catch (e) { console.warn('[BeeboFX] swarm', e); S.free(); } }   // 1.12.15
    gl.disable(gl.BLEND);
    // bloom
    const lv = Math.min(tr.bloom, R.mips.length), M = R.mips, thr = F16 ? .85 : .55;
    pass(P.bright, M[0], R.scene, u => { gl.uniform2f(u.uTx, 1 / w, 1 / h); gl.uniform1f(u.uThr, thr); });
    for (let i = 1; i < lv; i++) pass(P.down, M[i], M[i - 1], u => gl.uniform2f(u.uTx, 1 / M[i - 1].w, 1 / M[i - 1].h));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = lv - 1; i > 0; i--) pass(P.up, M[i - 1], M[i], u => gl.uniform2f(u.uTx, .5 / M[i].w, .5 / M[i].h));
    gl.disable(gl.BLEND);
    // composite → the GL canvas → this layer's canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    quad(P.comp); const u = P.comp.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.scene.t); gl.uniform1i(u.uS, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, M[0].t); gl.uniform1i(u.uB, 1);
    gl.uniform1f(u.uBloom, (F16 ? 1.25 : 1.6) * L.bloom); gl.uniform1f(u.uAb, (L.mask && L.mask()) || (L.clip && L.clip()) ? 0 : L.ab);   // colour fringe only on full-screen moments gl.uniform2f(u.uRes, L.W, L.H);
    const mk = L.mask ? L.mask() : null;
    if (mk && mk.canvas) {
      if (!L.maskTex) { L.maskTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, L.maskTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, L.maskTex);
      if (L.maskVer !== mk.ver) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mk.canvas); L.maskVer = mk.ver; }
      gl.uniform1i(u.uM, 2); gl.uniform1i(u.uMask, 1);
    } else gl.uniform1i(u.uMask, 0);
    const clip = mk && mk.canvas ? null : L.clip ? L.clip() : null; const cn = clip ? Math.min(16, clip.length) : 0;
    if (cn) { const cf = new Float32Array(64); clip.slice(0, 16).forEach((r, i) => cf.set([r.x, r.y, r.w, r.h], i * 4)); gl.uniform4fv(u.uClip, cf); }
    gl.uniform1i(u.uNClip, clip ? Math.max(cn, clip.length === 0 ? 1 : cn) : 0);
    if (clip && !clip.length) gl.uniform4fv(u.uClip, new Float32Array(64));      // nothing allowed: draw nothing
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.activeTexture(gl.TEXTURE0);
    L.x2.clearRect(0, 0, w, h); L.x2.drawImage(glc, 0, 0);
  }
  function quadAttr() { gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0); }
  function instDraw(A, stride, attrs, n) {
    quadAttr(); gl.bindBuffer(gl.ARRAY_BUFFER, INST); gl.bufferData(gl.ARRAY_BUFFER, A, gl.STREAM_DRAW);
    for (const [loc, size, off] of attrs) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off); gl.vertexAttribDivisor(loc, 1); }
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    for (const [loc] of attrs) { gl.vertexAttribDivisor(loc, 0); gl.disableVertexAttribArray(loc); }
  }
  function boxDraw(p, box, L, setup) { quad(p); gl.uniform4f(p.u.uBox, box[0], box[1], box[2], box[3]); gl.uniform2f(p.u.uRes, L.W, L.H); setup(p.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  // ============================================================================================ building blocks
  const FX = {
    ring(L, x, y, o = {}) { burst(); L.rings.push({ x, y, r0: o.r0 ?? 6, r1: o.r1 ?? 220, w: o.w ?? 7, I: o.I ?? 1.4, dur: o.dur ?? .7, col: hex(o.color || '#ffffff'), split: o.split ?? 1, t: 0 }); L.ab = Math.max(L.ab, o.ab ?? .01); wake(); },
    flash(L, x, y, o = {}) { burst(); L.flashes.push({ x, y, r: o.r ?? 500, col: hex(o.color || '#ffffff'), I: o.I ?? .5, t: 0, dur: o.dur ?? .5 }); wake(); },
    flame(L, key, box, o = {}) {           // a flame along the bottom edge of a box; target 0 lets it die down
      let f = L.flames.find(x => x.key === key);
      if (!f) { f = { key, seed: Math.random() * 50, t: 0, cur: 0 }; L.flames.push(f); }
      Object.assign(f, { x: box.x, y: box.y, w: box.w, hBox: box.h, h: o.h ?? box.h * .7, target: o.I ?? 1, tint: hex(o.tint || '#ffffff'), ramp: o.ramp ? [...hex0(o.ramp), o.softBase ? 2 : 1] : TINT && TINTS[TINT] ? [...retint([1, .36, .06], TINTS[TINT]), 1] : null, until: o.for ? f.t + o.for : 0 });
      wake(); return f;
    },
    sparks(L, x, y, o = {}) { emit(L, o.n ?? 120, { x, y, kind: 1, speed: o.speed || [260, 980], dir: o.dir ?? -Math.PI / 2, spread: o.spread ?? 6.283, gravity: o.gravity ?? 1250, drag: o.drag ?? 1.1, size: o.size || [2.2, 4.4], sizeEnd: .3, life: o.life || [.35, .95], colors: o.colors || [[2.2, 2, 1.6], hex(o.color || '#ff8a3d'), mixc(hex(o.color || '#ff8a3d'), [.3, .02, 0], .6)], heat: [1, 2.4], turb: o.turb ?? 0 }); },
    embers(L, area, o = {}) { emit(L, o.n ?? 40, { area, kind: 2, speed: o.speed || [20, 90], dir: -Math.PI / 2, spread: 1.2, gravity: o.gravity ?? -60, drag: .7, size: o.size || [2.5, 6], sizeEnd: .2, life: o.life || [1.4, 3.4], colors: o.colors || [[2.2, 1.4, .5], hex(o.color || '#ff6a1f'), [.5, .05, 0]], heat: [.8, 1.8], turb: o.turb ?? 2600 }); },
    smoke(L, area, o = {}) { emit(L, o.n ?? 10, { area, kind: 3, speed: [10, 50], dir: -Math.PI / 2, spread: 1.4, gravity: -20, drag: .5, size: o.size || [40, 90], sizeEnd: 2.2, life: [2, 4], colors: [hex(o.color || '#2a2422'), hex(o.color || '#1a1614'), [.04, .04, .05]], alpha: o.alpha ?? .35, turb: 900 }); },
    glints(L, area, o = {}) { emit(L, o.n ?? 20, { area, kind: 0, speed: [5, 30], dir: Math.PI / 2, spread: 1.5, gravity: o.gravity ?? 25, drag: .4, size: o.size || [2, 5], sizeEnd: .1, life: [1.2, 3], colors: [[2.4, 2.1, 1.3], hex(o.color || '#f6c453'), hex(o.color || '#f6c453')], heat: [.6, 1.8], turb: 600 }); },
    shards(L, x, y, o = {}) { emit(L, o.n ?? 40, { x, y, kind: 4, speed: o.speed || [200, 700], dir: o.dir ?? -Math.PI / 2, spread: o.spread ?? 6.283, gravity: 1400, drag: .9, size: o.size || [4, 10], sizeEnd: .6, life: [.5, 1.1], colors: [hex(o.color || '#ffffff'), hex(o.color || '#ffffff'), hex(o.color || '#888888')], heat: [.8, 1.6] }); },
    bolt(L, o) { strike(L, o); },
    // Electrocuted (1.10): arcs crawl over a box — short forked bolts between random points inside it, sparks where they
    // land, a cold flicker — for `dur` seconds. On the scoreboard the front layer keeps it inside the plate.
    electrocute(L, box, o = {}) {
      const dur = o.dur ?? 1.4, col = o.color || '#9fd8ff', t0 = performance.now(); let next = 0;
      const A = { node: null, step(dt) {
        const t = (performance.now() - t0) / 1000; if (t > dur) { L.ambient = L.ambient.filter(x => x !== A); return; }
        next -= dt; if (next > 0) return; next = .05 + Math.random() * .09;
        const k = 1 - t / dur, p = () => [box.x + Math.random() * box.w, box.y + box.h * (.1 + Math.random() * .8)];
        for (let n = 0; n < 2 + (Math.random() * 2 | 0); n++) {
          const [x0, y0] = p(), x1 = Math.max(box.x, Math.min(box.x + box.w, x0 + (Math.random() - .5) * Math.min(box.w * 1.2, 520))), y1 = box.y + box.h * (.1 + Math.random() * .8);
          strike(L, { x0, y0, x1, y1, color: col, width: 2.2 + Math.random() * 1.8, rough: .3, depth: 6, intensity: (1.1 + Math.random() * .7) * (.45 + k * .55), branch: 2, restrikes: 0, flashI: .2 * k, flashR: 160, sparks: false });
          emit(L, 6, { x: x1, y: y1, kind: 1, speed: [120, 420], spread: 6.283, gravity: 900, drag: 1.2, size: [1.2, 2.4], life: [.12, .35], colors: [[2, 2.2, 2.4], hex(col), [.1, .2, .5]], heat: [1, 1.8] });
        }
        if (Math.random() < .35) FX.flash(L, box.x + box.w / 2, box.y + box.h / 2, { r: Math.max(box.w, box.h) * .6, I: .1 * k, color: col, dur: .12 });
      } };
      L.ambient.push(A); wake(); return A;
    },
  };

  // ============================================================================================ the 9 particle types (1.10)
  // The same nine the Particles panel offers, drawn on the GPU: spawn(box, o) emits one batch into a layer.
  //   o: { color, colors, speed, size, dir (° of wind), spread, gravity, life, turb } — anything left out uses the type's own
  const PTYPES = {
    embers: { label: 'Embers', kind: 2, from: 'bottom', speed: [60, 200], dir: -90, spread: 30, gravity: -12, life: [3, 5.5], size: [1.6, 3.6], turb: 900, drag: .4 },
    sparks: { label: 'Sparks', kind: 1, from: 'any', speed: [140, 420], dir: -90, spread: 360, gravity: 300, life: [.5, 1.1], size: [1.2, 2.6], turb: 0, drag: 1 },
    smoke: { label: 'Smoke', kind: 3, from: 'bottom', speed: [10, 40], dir: -90, spread: 40, gravity: -6, life: [5, 9], size: [60, 140], turb: 400, drag: .3, alpha: .35 },
    shards: { label: 'Shards', kind: 4, from: 'top', speed: [40, 120], dir: 90, spread: 30, gravity: 120, life: [3, 6], size: [3, 8], turb: 0, drag: .3 },
    snow: { label: 'Snow', kind: 5, from: 'top', speed: [30, 80], dir: 90, spread: 30, gravity: 10, life: [8, 14], size: [2, 5], turb: 1400, drag: .3 },
    confetti: { label: 'Confetti', kind: 6, from: 'top', speed: [80, 220], dir: 90, spread: 50, gravity: 60, life: [4, 7], size: [5, 9], turb: 1100, drag: .6 },
    bubbles: { label: 'Bubbles', kind: 7, from: 'bottom', speed: [40, 90], dir: -90, spread: 30, gravity: -8, life: [6, 10], size: [6, 14], turb: 600, drag: .3 },
    rain: { label: 'Rain', kind: 8, from: 'top', speed: [900, 1300], dir: 96, spread: 4, gravity: 0, life: [1, 1.6], size: [1.2, 2], turb: 0, drag: 0 },
    stars: { label: 'Stars', kind: 9, from: 'any', speed: [0, 8], dir: 0, spread: 360, gravity: 0, life: [2, 4], size: [3, 7], turb: 0, drag: 0 },
    dust: { label: 'Dust', kind: 0, from: 'any', speed: [4, 18], dir: 0, spread: 360, gravity: 0, life: [4, 8], size: [1, 2.6], turb: 700, drag: .2, alpha: .55 },
  };
  const deg = d => d * Math.PI / 180;
  function spawnType(L, type, box, n, o = {}) {
    const T0 = PTYPES[type]; if (!T0 || n <= 0) return;
    const from = o.from || T0.from, b = box;
    const area = from === 'bottom' ? { type: 'rect', x: b.x, y: b.y + b.h - 4, w: b.w, h: 8 } : from === 'top' ? { type: 'rect', x: b.x - b.w * .05, y: b.y - 10, w: b.w * 1.1, h: 8 } : from === 'centre' ? { type: 'rect', x: b.x + b.w * .45, y: b.y + b.h * .45, w: b.w * .1, h: b.h * .1 } : { type: 'rect', x: b.x, y: b.y, w: b.w, h: b.h };
    const col = o.color || '#ffb020', c = hex(col), conf = type === 'confetti';
    const colors = o.colors || (conf ? null : type === 'snow' || type === 'bubbles' || type === 'rain' ? [mixc(c, [1, 1, 1], .5), c, c] : [mixc(c, [2, 1.8, 1.4], .5), c, mixc(c, [.2, .05, 0], .6)]);
    const sc = Number(o.size) || 1, sp = Number(o.speed) || 1, wind = Number(o.wind) || 0;
    const spec = { area, kind: T0.kind, speed: (o.speedR || T0.speed).map(v => v * sp), dir: deg(o.dir ?? T0.dir), spread: deg(o.spread ?? T0.spread), gravity: o.gravity ?? T0.gravity, drag: T0.drag,
      size: (o.sizeR || T0.size).map(v => v * sc), sizeEnd: type === 'smoke' ? 1.8 : .5, life: o.life || T0.life, turb: o.turb ?? T0.turb, alpha: o.alpha ?? T0.alpha ?? 1, vx: wind * 60 * sp, heat: [.9, 1.3] };
    if (conf) { const pal = [c, hex('#ff5a78'), hex('#4fd1ff'), hex('#ffd24f'), mixc(c, [1, 1, 1], .5)]; for (let i = 0; i < n; i++) { const k = pal[Math.random() * pal.length | 0]; emit(L, 1, { ...spec, colors: [k, k, k] }); } return; }
    emit(L, n, { ...spec, colors });
  }
  // an emitter that keeps going (a screen's particles, or one you build in the emitter editor)
  function emitter(L, box, o = {}) {
    const T0 = PTYPES[o.type] || PTYPES.embers, perSec = (Number(o.amount) || 40) * ({ embers: .5, snow: .35, sparks: .6, bubbles: .15, confetti: .8, dust: .25, stars: .2, rain: 2.4, smoke: .06, shards: .2 }[o.type] ?? .4) * (o.rate || 1);
    let acc = 0;
    return { step(dt) { acc += dt * perSec; const n = acc | 0; if (n) { acc -= n; const g = L.parts.g, k0 = g.length; spawnType(L, o.type, typeof box === 'function' ? box() : box, Math.min(n, 30), o);
      if (o.collide) for (let i = k0; i < g.length; i++) g[i].co = 1; } } };     // 1.12.15: these bounce off the screen's pieces
  }

  // ============================================================================================ GPU swarms (1.12.15)
  // A screen's particles in the tens of thousands, simulated on the graphics card (transform feedback): each frame one
  // small program moves every particle (gravity, drag, the same curl-noise wind, respawning the old ones in the emitter's
  // area) and writes the very layout the particle shader draws from — so a swarm looks exactly like the CPU particles,
  // bloom included, with nothing copied back. Used when an emitter asks for more particles than the CPU should move.
  const SWARM_TF = `#version 300 es
precision highp float;
layout(location=0) in vec4 iA; layout(location=1) in vec4 iB; layout(location=2) in vec4 iC;
uniform float uDt, uTime; uniform vec2 uRes; uniform vec4 uArea, uSpd, uPhys, uLife, uMisc; uniform vec3 uC0, uCm, uC1; uniform float uFill;
out vec4 oA; out vec4 oB; out vec4 oC;
float h1(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
vec2 g2(vec2 i){ float a = h1(dot(i, vec2(12.9898, 78.233)))*6.2831853; return vec2(cos(a), sin(a)); }
float pn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(dot(g2(i), f), dot(g2(i+vec2(1,0)), f-vec2(1,0)), u.x), mix(dot(g2(i+vec2(0,1)), f-vec2(0,1)), dot(g2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y); }
vec2 curl(vec2 p, float t){ float e = .01; vec2 P = p*.0042 + vec2(0., t*.08);
  return vec2((pn(P+vec2(0,e)) - pn(P-vec2(0,e)))/(2.*e), -(pn(P+vec2(e,0)) - pn(P-vec2(e,0)))/(2.*e)); }
void main(){
  float seed = iB.w, t = iB.y, kind = uMisc.x; vec2 p = iA.xy, v = iA.zw;
  float dur = mix(uLife.x, uLife.y, h1(seed*1.31+.2));
  bool fresh = iB.x < 0.;
  t += fresh ? 0. : uDt/dur;
  if (fresh || t >= 1.) {
    seed = fract(seed*1.6180339 + h1(seed + uTime*.0137)*.731 + .113);
    t = fresh ? h1(seed*7.7) : 0.;
    vec2 q = vec2(h1(seed*3.1), h1(seed*5.7));
    p = (fresh && uFill > .5) ? q*uRes : uArea.xy + q*uArea.zw;
    float a = uSpd.z + (h1(seed*9.2)-.5)*uSpd.w, sp = mix(uSpd.x, uSpd.y, h1(seed*11.3));
    v = vec2(cos(a), sin(a))*sp + vec2(uPhys.w, 0.);
  } else {
    if (uPhys.z > 0.) v += curl(p, uTime)*uPhys.z*uDt;
    v.y += uPhys.x*uDt; v *= exp(-uPhys.y*uDt); p += v*uDt;
  }
  float s0 = mix(uLife.z, uLife.w, h1(seed*2.9)) * mix(1., uMisc.y, t);
  vec3 c = kind == 6. ? (h1(seed*4.4) < .34 ? uC0 : h1(seed*4.4) < .67 ? uCm : uC1) : (t < .5 ? mix(uC0, uCm, t*2.) : mix(uCm, uC1, (t-.5)*2.));
  float heat = mix(.9, 1.3, h1(seed*6.1)), al = uMisc.z * clamp(t/.08, 0., 1.) * (1. - pow(t, 2.2));
  oA = vec4(p, v); oB = vec4(s0, t, kind, seed); oC = vec4(c*heat, al);
}`;
  const SWARM_FS = `#version 300 es
precision mediump float; out vec4 o; void main(){ o = vec4(0.); }`;
  let swarmProg = null, swarmOk = null;
  function swarmProgram() {
    if (swarmProg || swarmOk === false) return swarmProg;
    try {
      const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, SWARM_TF)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, SWARM_FS));
      gl.transformFeedbackVaryings(pr, ['oA', 'oB', 'oC'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      const u = {}; for (const n of ['uDt', 'uTime', 'uRes', 'uArea', 'uSpd', 'uPhys', 'uLife', 'uMisc', 'uC0', 'uCm', 'uC1', 'uFill']) u[n] = gl.getUniformLocation(pr, n);
      swarmProg = { pr, u, tf: gl.createTransformFeedback() }; swarmOk = true;
    } catch (e) { console.warn('[BeeboFX] GPU swarm', e.message); swarmOk = false; }
    return swarmProg;
  }
  const SWARM_CAP = () => (tierOf() === 'full' && !(window.SBPerf && window.SBPerf.laptop) ? 40000 : 10000);
  function swarm(L, box, o) {
    if (!gl || !swarmProgram()) return null;
    const T0 = PTYPES[o.type] || PTYPES.embers, n = Math.max(500, Math.min(SWARM_CAP(), Math.round(Number(o.count) || 5000)));
    const c = hex(o.color || '#ffb020'), cols = ['snow', 'bubbles', 'rain'].includes(o.type) ? [mixc(c, [1, 1, 1], .5), c, c] : o.type === 'confetti' ? [c, hex('#ff5a78'), hex('#4fd1ff')] : [mixc(c, [2, 1.8, 1.4], .5), c, mixc(c, [.2, .05, 0], .6)];
    const init = new Float32Array(n * STRIDE); for (let i = 0; i < n; i++) { init[i * STRIDE + 4] = -1; init[i * STRIDE + 7] = Math.random(); }
    const mk = () => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, init, gl.DYNAMIC_COPY); return b; };
    const sc = Number(o.size) || 1, sp = Number(o.speed) || 1;
    return { key: o.key, n, bufs: [mk(), mk()], i: 0, last: 0, box, type: o.type, kind: T0.kind, normal: T0.kind === 3 || T0.kind === 6,
      spd: [(o.speedR || T0.speed)[0] * sp, (o.speedR || T0.speed)[1] * sp, deg(o.dir ?? T0.dir), deg(o.spread ?? T0.spread)],
      phys: [o.gravity ?? T0.gravity, T0.drag ?? .6, o.turb ?? T0.turb ?? 0, (Number(o.wind) || 0) * 60 * sp],
      life: [(o.life || T0.life)[0], (o.life || T0.life)[1], (o.sizeR || T0.size)[0] * sc, (o.sizeR || T0.size)[1] * sc],
      misc: [T0.kind, o.type === 'smoke' ? 1.8 : .5, o.alpha ?? T0.alpha ?? 1, 0], cols,
      fill: ['snow', 'rain', 'dust', 'stars', 'bubbles', 'embers', 'confetti'].includes(o.type) ? 1 : 0,
      free() { for (const b of this.bufs) try { gl.deleteBuffer(b); } catch (e) {} this.bufs = []; } };
  }
  function drawSwarm(S, L, time) {
    if (!S.bufs.length) return;
    const P0 = swarmProgram(); if (!P0) return;
    const dt = S.last ? Math.min(.05, Math.max(0, time - S.last)) : 0; S.last = time;
    const src = S.bufs[S.i], dst = S.bufs[1 - S.i], b = typeof S.box === 'function' ? S.box() : S.box, T0 = PTYPES[S.type] || PTYPES.embers;
    const from = T0.from, area = from === 'bottom' ? [b.x, b.y + b.h - 4, b.w, 8] : from === 'top' ? [b.x - b.w * .05, b.y - 10, b.w * 1.1, 8] : from === 'centre' ? [b.x + b.w * .45, b.y + b.h * .45, b.w * .1, b.h * .1] : [b.x, b.y, b.w, b.h];
    // move them (no drawing: rasteriser off), writing into the other buffer
    gl.useProgram(P0.pr); const U = P0.u;
    gl.uniform1f(U.uDt, dt); gl.uniform1f(U.uTime, time); gl.uniform2f(U.uRes, L.W, L.H); gl.uniform4f(U.uArea, ...area); gl.uniform4f(U.uSpd, ...S.spd);
    gl.uniform4f(U.uPhys, ...S.phys); gl.uniform4f(U.uLife, ...S.life); gl.uniform4f(U.uMisc, ...S.misc); gl.uniform1f(U.uFill, S.fill);
    gl.uniform3f(U.uC0, ...S.cols[0]); gl.uniform3f(U.uCm, ...S.cols[1]); gl.uniform3f(U.uC1, ...S.cols[2]);
    gl.bindBuffer(gl.ARRAY_BUFFER, src);
    for (let k = 0; k < 3; k++) { gl.enableVertexAttribArray(k); gl.vertexAttribPointer(k, 4, gl.FLOAT, false, STRIDE * 4, k * 16); gl.vertexAttribDivisor(k, 0); }
    gl.enable(gl.RASTERIZER_DISCARD); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, P0.tf); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dst);
    gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, S.n); gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null); gl.disable(gl.RASTERIZER_DISCARD);
    for (let k = 0; k < 3; k++) gl.disableVertexAttribArray(k);
    S.i = 1 - S.i;
    // draw them with the particle shader, straight from that buffer
    gl.useProgram(P.part.p); gl.uniform2f(P.part.u.uRes, L.W, L.H); gl.uniform1f(P.part.u.uTime, time);
    quadAttr(); gl.bindBuffer(gl.ARRAY_BUFFER, dst);
    for (const [loc, off] of [[1, 0], [2, 16], [3, 32]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, off); gl.vertexAttribDivisor(loc, 1); }
    if (S.normal) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, S.n);
    if (S.normal) gl.blendFunc(gl.ONE, gl.ONE);
    for (const loc of [1, 2, 3]) { gl.vertexAttribDivisor(loc, 0); gl.disableVertexAttribArray(loc); }
  }

  // ============================================================================================ effect presets (1.10)
  // What a moment can play, one effect at a time, stacked in the Designer (Effects › Moments). Each plays at a box (the
  // score, the plate, or the whole screen on a splash) in a colour, with an amount.
  const EFFECTS = {
    sparks: { label: 'Spark burst', emoji: '💥', color: '#ff7a2a', play: (L, b, o) => FX.sparks(L, b.x + b.w / 2, b.y + b.h / 2, { n: 90 * o.k, color: o.color, speed: [200, 760], size: [1.6, 3.2] }) },
    shock: { label: 'Shockwave', emoji: '⭕', color: '#ffb36b', play: (L, b, o) => FX.ring(L, b.x + b.w / 2, b.y + b.h / 2, { r1: Math.max(b.w, b.h) * .9 * o.k, w: 6, I: .8, color: o.color, split: .4 }) },
    flash: { label: 'Flash', emoji: '🔆', color: '#ffffff', play: (L, b, o) => FX.flash(L, b.x + b.w / 2, b.y + b.h / 2, { r: Math.max(b.w, b.h) * .7, I: .35 * o.k, color: o.color, dur: .4 }) },
    flame: { label: 'Flame lick', emoji: '🔥', color: '#ff5a1f', play: (L, b, o) => FX.flame(L, 'fx' + Math.random(), b, { I: .8 * o.k, h: b.h * .5, for: .7, tint: o.color }) },
    embers: { label: 'Ember rise', emoji: '🌋', color: '#ff7a2a', play: (L, b, o) => FX.embers(L, { type: 'rect', x: b.x, y: b.y + b.h * .5, w: b.w, h: b.h * .5 }, { n: 40 * o.k, color: o.color }) },
    glints: { label: 'Gold glints', emoji: '✨', color: '#ffe7a3', play: (L, b, o) => FX.glints(L, { type: 'rect', x: b.x, y: b.y, w: b.w, h: b.h }, { n: 40 * o.k, color: o.color }) },
    shards: { label: 'Glass burst', emoji: '🪟', color: '#d9d2cc', play: (L, b, o) => FX.shards(L, b.x + b.w / 2, b.y + b.h / 2, { n: 40 * o.k, color: o.color }) },
    smoke: { label: 'Smoke puff', emoji: '💨', color: '#5a5560', play: (L, b, o) => FX.smoke(L, { type: 'rect', x: b.x, y: b.y, w: b.w, h: b.h }, { n: 8 * o.k }) },
    bolt: { label: 'Lightning strike', emoji: '🌩️', color: '#bfe3ff', play: (L, b, o) => strike(L, { x0: b.x + b.w * Math.random(), y0: b.y - 10, x1: b.x + b.w * Math.random(), y1: b.y + b.h + 10, color: o.color, width: 3, rough: .25, depth: 7, intensity: o.k, branch: 2, restrikes: 1, flashI: .25, flashR: Math.max(b.w, b.h) * .6, sparks: false }) },
    electro: { label: 'Electrocuted', emoji: '⚡', color: '#9fd8ff', play: (L, b, o) => FX.electrocute(L, b, { color: o.color, dur: 1.2 + .4 * o.k }) },
    confetti: { label: 'Confetti pop', emoji: '🎉', color: '#ff5a1f', play: (L, b, o) => spawnType(L, 'confetti', { x: b.x, y: b.y, w: b.w, h: b.h }, 60 * o.k, { color: o.color, from: 'centre', dir: -90, spread: 120, speedR: [300, 700], gravity: 500 }) },
    stars: { label: 'Star burst', emoji: '⭐', color: '#ffe7a3', play: (L, b, o) => spawnType(L, 'stars', b, 30 * o.k, { color: o.color, from: 'centre', speedR: [80, 260], life: [.6, 1.2] }) },
    snow: { label: 'Frost puff', emoji: '❄️', color: '#cfeaff', play: (L, b, o) => spawnType(L, 'snow', b, 40 * o.k, { color: o.color, from: 'centre', speedR: [60, 220], dir: -90, spread: 360, life: [.8, 1.6] }) },
    bubbles: { label: 'Bubbles', emoji: '🫧', color: '#9fe8ff', play: (L, b, o) => spawnType(L, 'bubbles', b, 18 * o.k, { color: o.color, from: 'bottom', life: [1, 2], speedR: [60, 160] }) },
    fountain: { label: 'Spark fountain', emoji: '🌠', color: '#ffd27a', play: (L, b, o) => emit(L, 70 * o.k, { x: b.x + b.w / 2, y: b.y + b.h, kind: 1, speed: [300, 700], dir: -Math.PI / 2, spread: .7, gravity: 1300, drag: .7, size: [1.6, 3], life: [.5, 1], colors: [[2, 1.8, 1.3], hex(o.color), [.4, .15, .02]], heat: [1, 2] }) },
    // 1.11: the engine's part of Slicing (hot sparks off the cut lines) and Fissure (embers boiling out of molten cracks);
    // the layout cuts the plate / opens the cracks itself
    slice: { label: 'Slicing', emoji: '🗡️', color: '#e8f6ff', play: (L, b, o) => { for (let i = 0; i < 3; i++) { const y = b.y + b.h * (.25 + i * .25); FX.sparks(L, b.x + b.w * (.2 + Math.random() * .6), y, { n: 26 * o.k, color: o.color, speed: [200, 620], gravity: 900, life: [.2, .5], size: [1.2, 2.4] }); } } },
    fissure: { label: 'Fissure (molten)', emoji: '🌋', color: '#ff6a1a', play: (L, b, o) => { FX.embers(L, { type: 'rect', x: b.x, y: b.y + b.h * .3, w: b.w, h: b.h * .7 }, { n: 40 * o.k, color: o.color, colors: [[2.6, 1.6, .5], [1.4, .45, .05], [.4, .08, 0]], speed: [30, 140], life: [.6, 1.4], size: [1.4, 3.4], turb: 2400 }); FX.flash(L, b.x + b.w / 2, b.y + b.h / 2, { r: Math.max(b.w, b.h) * .7, I: .25, color: '#ff6a1a', dur: .6 }); } },
    burst: { label: 'Particles (your emitter)', emoji: '🎛️', color: '#ffb020', play: (L, b, o) => spawnType(L, (o.em && o.em.type) || 'sparks', b, (Number(o.em && o.em.count) || 60) * o.k, { color: o.color, ...(o.em || {}) }) },
  };
  // one stack item → its box and colour; side 0 (or 'both') plays on both plates
  function playItem(c, it, i, box) {
    burst();
    const E = EFFECTS[it.fx]; if (!E) return;
    const run = b => { if (b) c.later(() => { amount = clamp(Number(it.amount) || 1, .2, 2.5); try { E.play(c.front, b, { k: 1, color: it.color || E.color, em: it.em }); } catch (e) {} amount = 1; }, Math.max(0, Number(it.delay) || 0) * 1000); };
    if (box) return run(box);
    const at = it.at || 'plate', sides = i.side ? [i.side] : [1, 2];
    if (at === 'screen' && c.boardOn && !c.boardOn()) return run({ x: 0, y: 0, w: c.front.W, h: c.front.H });
    for (const sd of sides) { run(at === 'score' ? c.rect(sd, 'score') : c.plate(sd)); if (it.fx === 'electro' && c.jolt) c.later(() => c.jolt(sd), Math.max(0, Number(it.delay) || 0) * 1000);
      if ((it.fx === 'slice' || it.fx === 'fissure') && c.plateFx) c.later(() => c.plateFx(sd, it.fx), Math.max(0, Number(it.delay) || 0) * 1000); }
  }

  // ============================================================================================ backdrops the engine can take over
  // Each runs in a layer placed inside the backdrop's own box (behind the names); `step` keeps it going.
  const ATMOS = {
    storm(L, c, amt) {                    // forked strikes from the clouds, sheet lightning between them
      let next = .3;
      return { step(dt) { next -= dt; if (next > 0) return; next = rnd(1.4, 4.5) / Math.max(.3, amt);
        const x0 = rnd(L.W * .08, L.W * .92), x1 = x0 + rnd(-260, 260), y1 = rnd(L.H * .45, L.H * .95);
        strike(L, { x0, y0: -20, x1, y1, color: c, width: rnd(3.2, 4.6), intensity: rnd(.9, 1.3) * Math.min(1.25, .65 + amt * .55), branch: 3, flashI: .4 * amt, sparks: false });
        if (Math.random() < .5) L.flashes.push({ x: rnd(0, L.W), y: rnd(0, L.H * .3), r: L.W * .5, col: hex(c), I: .22 * amt, t: 0, dur: .7 }); } };
    },
    splitbolt(L, c, amt) {                // one channel down the middle, restriking
      let next = .25;
      return { step(dt) { next -= dt; if (next > 0) return; next = rnd(1.4, 3.8) / Math.max(.3, amt);
        const cx = L.W * .5 + rnd(-30, 30);
        // (1.9.1: a gentler strike — a smaller flash, a faint ring with no colour fringes, so the splash stays readable)
        strike(L, { x0: cx + rnd(-40, 40), y0: -20, x1: cx + rnd(-40, 40), y1: L.H + 20, color: c, width: 3.4, rough: .16, depth: 8, intensity: 1, branch: 3, restrikes: 2 + (Math.random() * 3 | 0), flashI: .26, flashR: L.W * .3, sparks: false });
        FX.ring(L, cx, L.H * .5, { r1: 460, w: 5, I: .22, color: c, dur: .9, ab: 0, split: 0 }); } };
    },
    ash(L, c, amt) {                      // warm colours: embers rising through a slow swirl with a little smoke · cool colours: ash drifting down
      const rgb = hex(c), warm = rgb[0] > rgb[2] + .25;
      return { step(dt) { const k = amt * T().ambient;
        if (warm) { if (Math.random() < dt * 24 * k) FX.embers(L, { type: 'rect', x: 0, y: L.H * .8, w: L.W, h: L.H * .25 }, { n: 1 + (Math.random() * 3 | 0), color: c, speed: [50, 160], life: [2.5, 5.5], gravity: -50, turb: 3600 });
                    if (Math.random() < dt * 1.2 * k) FX.smoke(L, { type: 'rect', x: 0, y: L.H * .9, w: L.W, h: L.H * .15 }, { n: 1, alpha: .2 }); }
        else if (Math.random() < dt * 20 * k) emit(L, 1 + (Math.random() * 2 | 0), { area: { type: 'rect', x: 0, y: -20, w: L.W, h: 30 }, kind: 0, speed: [10, 40], dir: Math.PI / 2, spread: 1, gravity: 30, drag: .5, size: [1.5, 3.5], sizeEnd: .8, life: [5, 9], colors: [rgb, rgb, rgb], alpha: .55, heat: [.5, .9], turb: 1800 }); } };
    },
    golddust(L, c, amt) {                 // gold glints drifting down and twinkling
      return { step(dt) { if (Math.random() < dt * 26 * amt * T().ambient) FX.glints(L, { type: 'rect', x: 0, y: -20, w: L.W, h: L.H * .6 }, { n: 1 + (Math.random() * 2 | 0), color: c }); } };
    },
  };
  const fallbacks = new Set();
  function fallbackAll() { for (const f of fallbacks) { try { f(); } catch (e) {} } fallbacks.clear(); for (const L of layers) { L.ambient = []; try { L.x2.clearRect(0, 0, L.cv.width, L.cv.height); } catch (e) {} } }
  // 1.12.15: BeeboFX 4's governor says the plain look (on Auto) → hand the backdrops back to the CSS effects, as when this
  // engine stepped itself down before; it stays down until the page reloads (or Effects quality changes)
  if (window.BeeboFX4) window.BeeboFX4.gov.on(l => { if (l >= 2 && want === 'auto' && tier !== 'off') { tier = 'off'; fallbackAll(); } else if (l < 2) wake(); });

  // ============================================================================================ looks (presets)
  // What each layout look does on each moment. `ctx` has the layer, rect helpers and colours.
  const PRESETS = {
    ember: {
      color: '#ff5a1f', hot: '#ffb36b', gold: '#f6c453',
      point(c, i) {                                         // a hit: sparks out of the score, a shockwave, the plate flares
        const sb = i.score || i.plate; if (!sb) return; const x = sb.x + sb.w / 2, y = sb.y + sb.h / 2;
        FX.sparks(c.front, x, y, { n: 110, color: '#ff7a2a', dir: Math.PI, spread: 6.283, speed: [220, 760], gravity: 500, life: [.3, .8] });
        FX.ring(c.front, x, y, { r1: 300, w: 4, I: .9, color: '#ffb36b', split: .35, ab: .006, dur: .55 });
        FX.flash(c.front, x, y, { r: 240, I: .3, color: '#ff8a3d', dur: .4 });
        if (i.plate) { FX.flame(c.front, 'hit' + i.side, i.plate, { I: .85, h: i.plate.h * .45, for: .45 }); FX.embers(c.front, { type: 'rect', x: i.plate.x, y: i.plate.y + i.plate.h * .6, w: i.plate.w, h: i.plate.h * .4 }, { n: 36, speed: [20, 90], life: [.8, 1.6], size: [2, 4.5] }); }
        c.punch(i.side, 1.03);
      },
      mp(c, i) { if (i.plate) { FX.flame(c.front, 'mp' + i.side, i.plate, { I: .5, h: i.plate.h * .32 }); FX.ring(c.front, i.plate.x + i.plate.w / 2, i.plate.y + i.plate.h / 2, { r1: 420, w: 5, I: .7, split: .3, color: '#ff5a1f' }); } },
      mpOff(c, i) { const f = c.front.flames.find(x => x.key === 'mp' + i.side); if (f) f.target = 0; },
      win(c, i) {
        const p = i.plate; if (!p) return; const x = p.x + p.w / 2, y = p.y + p.h / 2;
        c.front.flames.forEach(f => { if (/^mp/.test(f.key)) f.target = 0; });
        // the plate turns gold: light on gold washes out, so the win is a burst of white-gold sparks and glints, no flame
        FX.sparks(c.front, x, y, { n: 120, color: '#ffd27a', colors: [[1.8, 1.5, .9], [.9, .55, .12], [.35, .12, .02]], speed: [260, 900], spread: 6.283, gravity: 600, size: [1.8, 3.4] });
        FX.ring(c.front, x, y, { r1: 520, w: 4, I: .6, color: '#fff1c2', split: 0, dur: .8 });
        FX.glints(c.front, { type: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }, { n: 40, color: '#fff6dc', size: [1.5, 3.5] });
        c.punch(i.side, 1.035);
      },
      reset(c) { c.front.flames.forEach(f => { f.target = 0; }); },
      hype(c, i) {                                          // the Stream Deck "Hype burst": both plates erupt (or one: Hype 1P / 2P)
        for (const sd of (i && i.side ? [i.side] : [1, 2])) { const p = c.plate(sd); if (!p) continue; FX.sparks(c.front, p.x + p.w / 2, p.y + p.h / 2, { n: 140, color: '#ff7a2a', spread: 6.283, gravity: 500 }); FX.flame(c.front, 'hype' + sd, p, { I: .9, h: p.h * .55, for: 1.2 }); FX.embers(c.front, { type: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }, { n: 60 }); }
        if (i && i.side) c.punch(i.side, 1.04); else c.punchAll();
      },
      scene: {
        // (1.9.1: on the screen's backdrop layer, behind its pieces, and gentler — the lettering stays clear)
        vs(c) { const L = c.front, x = L.W / 2, y = L.H * .44;
          c.later(() => { FX.ring(L, x, y, { r1: 900, w: 6, I: .5, color: '#ffb36b', dur: 1, ab: 0, split: 0 }); FX.flash(L, x, y, { r: 520, I: .16, color: '#ff8a3d', dur: .5 });
            FX.sparks(L, x, y, { n: 120, color: '#ff7a2a', speed: [260, 900], spread: 6.283, gravity: 700, life: [.4, 1], size: [1.2, 2.4] }); FX.shards(L, x, y, { n: 18, color: '#2a1a14' }); }, 380); },
        victory(c) { const L = c.front; c.later(() => { FX.ring(L, L.W / 2, L.H * .3, { r1: 900, w: 6, I: .6, color: '#ffe3a1', dur: 1.1, ab: 0, split: 0 }); FX.sparks(L, L.W / 2, L.H * .3, { n: 110, color: '#f6c453', colors: [[2, 1.8, 1.2], [1, .78, .3], [.5, .3, .05]], speed: [240, 820], size: [1.2, 2.4] }); }, 300); },
        top8(c) { const L = c.front; c.later(() => FX.flash(L, L.W / 2, L.H * .3, { r: 1100, I: .22, color: '#ffb38a', dur: .7 }), 200); },
      },
    },
  };

  // Shattered (Testbuild 1.9): Ember's fire, plus the dynamic plate — cracks spit sparks as a player falls behind, a
  // comeback seals them in gold, heat builds on a streak (hotter, whiter embers), and the loser's plate shatters
  PRESETS.shattered = { ...PRESETS.ember,
    mp(c, i) { if (!i.plate) return; FX.flame(c.front, 'mp' + i.side, i.plate, { I: .62, h: i.plate.h * .42 }); FX.ring(c.front, i.plate.x + i.plate.w / 2, i.plate.y + i.plate.h / 2, { r1: 460, w: 5, I: .75, split: .3, color: '#ff5a1f' }); },
    crack(c, i) { const a = i.at; if (!a) return;
      FX.sparks(c.front, a.x, a.y, { n: 30 + i.level * 12, color: '#ff7a2a', speed: [160, 520], gravity: 700, life: [.25, .6], size: [1.6, 3] });
      FX.shards(c.front, a.x, a.y, { n: 8 + i.level * 3, color: '#3a2a24', speed: [80, 260] });
      FX.flash(c.front, a.x, a.y, { r: 160, I: .22, color: '#ff8a3d', dur: .3 }); },
    mend(c, i) { const p = i.plate; if (!p) return;
      FX.glints(c.front, { type: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }, { n: 46, color: '#ffe7a3', size: [1.6, 3.6] });
      FX.ring(c.front, p.x + p.w / 2, p.y + p.h / 2, { r1: 380, w: 3, I: .55, color: '#fff1c2', split: 0, dur: .7 });
      const f = c.front.flames.find(x => x.key === 'heat' + i.side); if (f) f.target = Math.max(f.target, .3); },
    heat(c, i) {                                         // points in a row: embers off the plate, hotter and whiter as it builds
      const sd = i.side, lv = Math.min(5, i.level || 0), H = (c.heat = c.heat || {});
      if (!lv) { if (H[sd]) { c.front.ambient = c.front.ambient.filter(x => x !== H[sd]); H[sd] = null; } const f = c.front.flames.find(x => x.key === 'heat' + sd); if (f) f.target = 0; return; }
      const cols = [null, ['#ff5a1f', [.5, .05, 0]], ['#ff7a2a', [.6, .12, 0]], ['#ffb36b', [.8, .3, .05]], ['#ffd59a', [1, .55, .2]], ['#fff1c2', [1.2, .9, .5]]][lv];
      if (!H[sd]) { H[sd] = { step(dt) { const p = c.plate(sd); if (!p || !c.boardOn()) return; if (Math.random() < dt * H[sd].rate) FX.embers(c.front, { type: 'rect', x: p.x, y: p.y + p.h * .55, w: p.w, h: p.h * .45 }, { n: 1 + (Math.random() * 2 | 0), color: H[sd].col, colors: [[2.4, 1.8, 1.1], hex(H[sd].col), H[sd].end], speed: [30, 110], life: [.6, 1.3], size: [1.6, 3.6], turb: 2200 }); } }; c.front.ambient.push(H[sd]); }
      Object.assign(H[sd], { rate: 4 + lv * 7, col: cols[0], end: cols[1] }); wake();
      const p = c.plate(sd); if (p) FX.flame(c.front, 'heat' + sd, p, { I: lv >= 3 ? .18 + (lv - 3) * .1 : 0, h: p.h * .3, tint: cols[0] });
    },
    shatter(c, i) { const a = i.at, p = i.plate; if (!a || !p) return;
      FX.flash(c.front, a.x, a.y, { r: 420, I: .7, color: '#fff3e0', dur: .45 });
      FX.ring(c.front, a.x, a.y, { r1: 520, w: 6, I: 1, color: '#ffb36b', split: .4, ab: .01, dur: .6 });
      FX.shards(c.front, a.x, a.y, { n: 70, color: '#d9d2cc', speed: [240, 900], spread: 6.283 });
      FX.sparks(c.front, a.x, a.y, { n: 140, color: '#ff7a2a', speed: [200, 900], gravity: 900, life: [.3, .9] });
      FX.smoke(c.front, { type: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }, { n: 6, alpha: .25 });
      for (const k of ['mp', 'heat', 'hit']) { const f = c.front.flames.find(x => x.key === k + i.side); if (f) f.target = 0; }
      c.punch(i.side, 1.02); },
    reset(c) { c.front.flames.forEach(f => { f.target = 0; }); if (c.heat) { c.front.ambient = c.front.ambient.filter(x => x !== c.heat[1] && x !== c.heat[2]); c.heat = {}; } },
  };

  // 1.12.4: Shattered is Obsidian Glass — 1.12.8: its fire burns antique gold (amber); Porcelain's moments are in paler gold leaf
  PRESETS.shattered.tint = 'amber';
  PRESETS.shattered.scene = {};          // 1.12.5: no bursts on its splashes — they wear glass, a sheen and the light flow instead
  PRESETS.porcelain = { ...PRESETS.shattered, tint: 'gold' };

  // ============================================================================================ attach to a layout
  function attach(root, ctx) {
    if (!initGL()) return null;
    TINT = (PRESETS[ctx.preset && ctx.preset()] || {}).tint || null;
    const W = ctx.W(), H = ctx.H();
    const cv = document.createElement('canvas'); cv.className = 'sd-gfx';
    cv.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:50`;
    root.appendChild(cv);
    // the front layer: on the scoreboard only inside the layout's own pieces (never over the game HUD); full screen on splashes
    const front = makeLayer(cv, W, H, { clip: () => ctx.fullScene() ? null : ctx.pieces(), mask: () => ctx.fullScene() || !ctx.mask ? null : ctx.mask(), visible: () => root.isConnected && cv.isConnected, bloom: .85 });
    const atm = new Map();
    const timers = new Set();
    const c = {
      front, plate: sd => ctx.rect(sd, 'plate'),
      later: (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); },
      punch: (sd, k) => ctx.punch && ctx.punch(sd, k), punchAll: () => { ctx.punch && ctx.punch(1, 1.04); ctx.punch && ctx.punch(2, 1.04); },
      boardOn: () => !ctx.fullScene(), rect: (sd, k) => ctx.rect(sd, k), jolt: sd => ctx.jolt && ctx.jolt(sd),
    };
    const mpOn = [false, false];
    // one backdrop layer per screen, just above its background and below its pieces: its backdrops, and its burst as it comes in
    function atmRec(scene) {
      let rec = atm.get(scene);
      if (rec && !rec.L.cv.isConnected) { rec.L.dead = true; atm.delete(scene); rec = null; }       // the screen was rebuilt
      const first = () => [...scene.children].find(n => n.classList && n.classList.contains('sd-el')) || null;
      if (!rec) {
        const W2 = scene.clientWidth || W, H2 = scene.clientHeight || H;
        const cvA = document.createElement('canvas'); cvA.className = 'sd-gfx-atm';
        cvA.style.cssText = `position:absolute;left:0;top:0;width:${W2}px;height:${H2}px;pointer-events:none`;
        scene.insertBefore(cvA, first());
        const L = makeLayer(cvA, W2, H2, { visible: () => cvA.isConnected && !scene.classList.contains('sd-hidden') && scene.offsetParent !== null, bloom: .6 });
        rec = { L, kinds: new Map() }; atm.set(scene, rec);
      } else { const f = first(); if (f && f.previousElementSibling !== rec.L.cv && !(f.previousElementSibling && f.previousElementSibling.classList.contains('sd-cv-back') && f.previousElementSibling.previousElementSibling === rec.L.cv)) scene.insertBefore(rec.L.cv, f); }
      return rec;
    }
    const h = {
      get on() { return tierOf() !== 'off'; },
      layer: front,
      event(type, info = {}) {
        const look = PRESETS[ctx.preset()]; TINT = look && look.tint || null; if (tierOf() === 'off' || !look) return;
        const sd = info.side; const i = { ...info, plate: sd ? ctx.rect(sd, 'plate') : null, score: sd ? ctx.rect(sd, 'score') : null };
        if (type === 'mp') { if (mpOn[sd - 1]) return; mpOn[sd - 1] = true; }
        if (type === 'mpOff') { if (!mpOn[sd - 1]) return; mpOn[sd - 1] = false; }
        if (type === 'reset') { mpOn[0] = mpOn[1] = false; }
        // the moment's own stack (Designer › Effects › Moments) plays with the preset, or instead of it
        const st = ctx.stack ? ctx.stack(type) : null;
        amount = clamp(ctx.intensity ? ctx.intensity() : 1, .2, 2); try { if (!(st && st.replace)) look[type] && look[type](c, i); } catch (e) {} amount = 1;
        if (st && st.items) for (const it of st.items) playItem(c, it, i);
      },
      // 1.12.5: lettering on fire (a text piece with the Flame lettering effect): a shader flame licking up round the letters, in
      // the lettering's own flame colour. Kept alive while it's called (a quarter second at a time), so it dies down with the screen
      textFlame(key, box, color) {
        if (tierOf() === 'off' || !box || !box.w) return false;
        FX.flame(front, 'tf' + key, { x: box.x - box.w * .03, y: box.y, w: box.w * 1.06, h: box.h * .5 }, { I: 1, h: box.h * 1.05, ramp: color, softBase: true, for: .3 });   // its foot just under the tops of the letters, licking up above them
        return true;
      },
      // one effect at a box (a piece's reaction, a Designer try-out): on the front layer, so on the scoreboard it stays in the pieces
      fxAt(fx, box, o = {}) { if (tierOf() === 'off' || !EFFECTS[fx]) return false; playItem(c, { fx, color: o.color, amount: o.amount ?? 1 }, {}, box); return true; },
      // a screen's particles, on the GPU, on its backdrop layer (behind its pieces): pc as in the Particles panel, plus the
      // emitter editor's settings in pc.em. Returns false when the engine is off (the 2D particles then draw them).
      particles(sceneEl, pc) {
        if (tierOf() === 'off' || !sceneEl) return false;
        const rec = atmRec(sceneEl), L = rec.L, key = 'ptc';
        L.ambient = L.ambient.filter(x => x.key !== key);
        if (L.swarms) { for (const S of L.swarms) if (S.key === key) S.free(); L.swarms = L.swarms.filter(S => S.key !== key); }
        if (!pc || !pc.type || pc.type === 'none' || !PTYPES[pc.type]) return true;
        const em = pc.em || {}, W2 = L.W, H2 = L.H;
        // 1.12.15: thousands of particles → a GPU swarm (the CPU moves at most a few thousand); falls back to the CPU emitter
        if (Number(em.count) >= 2000) {
          const S = swarm(L, { x: 0, y: 0, w: W2, h: H2 }, { key, type: pc.type, count: em.count, color: pc.color, size: Number(pc.size) || 1, speed: Number(pc.speed) || 1, wind: (Number(pc.dir) || 0) / 45,
            spread: em.spread, gravity: em.gravity, life: em.life, turb: em.turb, dir: em.dir, speedR: em.speedR, sizeR: em.sizeR });
          if (S) { (L.swarms = L.swarms || []).push(S); L.ambient.push({ key, node: sceneEl, step() {} }); wake(); return true; }
        }
        const box = () => (em.from === 'centre' ? { x: 0, y: 0, w: W2, h: H2 } : { x: 0, y: 0, w: W2, h: H2 });
        const E = emitter(L, box, { type: pc.type, amount: Number(pc.amount) || 40, color: pc.color, size: Number(pc.size) || 1, speed: Number(pc.speed) || 1, wind: (Number(pc.dir) || 0) / 45,
          rate: em.rate, from: em.from, spread: em.spread, gravity: em.gravity, life: em.life, turb: em.turb, dir: em.dir, speedR: em.speedR, sizeR: em.sizeR, collide: !!em.collide });
        // 1.12.15: the screen's pieces as boxes to bounce off (looked up a couple of times a second)
        if (em.collide) { let cache = null, at = 0; L.cols = () => { const t = performance.now(); if (cache && t - at < 400) return cache; at = t; const k = L.W / ((ctx.W && ctx.W()) || 1920);
          cache = [...sceneEl.querySelectorAll('.sd-el')].filter(n => n.offsetWidth && !n.classList.contains('sd-hidden') && n.style.visibility !== 'hidden').map(n => [n.offsetLeft * k, n.offsetTop * k, n.offsetWidth * k, n.offsetHeight * k]).filter(r => r[2] * r[3] > 400 * k * k && r[2] * r[3] < L.W * L.H * .5).slice(0, 32); return cache; }; }
        else L.cols = null;
        E.key = key; E.node = sceneEl; L.ambient.push(E); wake(); return true;
      },
      scene(name, on, instant) {
        wake();
        // a full-screen splash takes over: the scoreboard's own effects stop first, so nothing of them flies outside the
        // plates (the clip lifts for the splash) while it comes in
        if (on && ctx.fullScene()) { const g = front.parts; g.g.length = 0; g.n = 0; front.flames.length = 0; front.rings.length = 0; front.flashes.length = 0; front.bolts.length = 0; front.ab = 0; mpOn[0] = mpOn[1] = false; }
        const look = PRESETS[ctx.preset()]; TINT = look && look.tint || null; if (!on || instant || tierOf() === 'off' || !look || !look.scene || !look.scene[name]) return;
        // the burst plays on the screen's backdrop layer: behind the cards, names and plates, never over the lettering
        const el = ctx.sceneEl && ctx.sceneEl(name), L = el ? atmRec(el).L : front;
        amount = clamp(ctx.intensity ? ctx.intensity() : 1, .2, 2); try { look.scene[name]({ ...c, front: L }); } catch (e) {} amount = 1; },
      // one backdrop layer per screen, just above its background and below its pieces (all its backdrops share it)
      atmos(node, kind, color, amt, fb) {
        if (tierOf() === 'off' || !ATMOS[kind]) return false;
        const scene = node.parentElement; if (!scene) return false;
        const rec = atmRec(scene);
        const key = kind + '|' + node.className;
        if (rec.kinds.get(key) === node) { wake(); return true; }
        rec.kinds.set(key, node);
        const A = ATMOS[kind](rec.L, color, amt); A.node = node; rec.L.ambient = rec.L.ambient.filter(x => x.node && x.node.isConnected); rec.L.ambient.push(A);
        if (fb) fallbacks.add(() => { rec.kinds.delete(key); fb(); });
        wake(); return true;
      },
      state(S) {
        // a cue from the panel or the Stream Deck: the hype burst (both plates, or one: side), or a moment's stack. Electrocuted is
        // played by the layout itself (it also jolts the plate, with or without the engine)
        if (S && S.gfx) { if (S.gfx.q && S.gfx.q !== want) configure({ quality: S.gfx.q }); const cu = S.gfx.cue || {}, n = cu.n; if (h._cue !== undefined && n && n !== h._cue && !['electro', 'slice', 'fissure', 'stinger'].includes(cu.kind)) h.event(cu.kind || 'hype', cu.side ? { side: cu.side } : {}); h._cue = n || 0; }
      },
      destroy() { front.dead = true; for (const r of atm.values()) r.L.dead = true; atm.clear(); for (const t of timers) clearTimeout(t); cv.remove(); },
    };
    wake();
    return h;
  }

  function configure(o = {}) {
    if (o.quality) { const was = tierOf(); want = String(o.quality); if (want === 'auto' && tier === 'off' && !broken) tier = 'full';
      if (tierOf() === 'off' && was !== 'off') fallbackAll(); }
    wake();
  }
  function stats() { let n = 0, L = 0, sw = 0; for (const x of layers) { n += x.parts.n; L++; for (const S of x.swarms || []) sw += S.n; } return { tier: tierOf(), want, gl: !!gl, soft: SOFT, f16: F16, layers: L, particles: n, swarm: sw, frameMs: +ema.toFixed(1), renderMs: +renderMs.toFixed(2), running }; }

  window.BeeboFX = { attach, configure, stats, PRESETS, ATMOS, FX, PTYPES, EFFECTS, get available() { return initGL(); }, presets: () => Object.keys(PRESETS) };
})();
