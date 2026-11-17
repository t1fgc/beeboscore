/* BeeboScore (developed by Beebo) — BeeboFX 2 (Testbuild 1.11): screens that move on the graphics card.
 *
 *   BeeboFX2.capture(node)        a layout screen drawn into a picture (an SVG foreignObject, with the page's styles, fonts
 *                                 and pictures folded in), ready to go on the graphics card as a texture
 *   BeeboFX2.play(root, o)        plays a transition on that picture: o = { id, dir: 'in' | 'out', tex, dur, ramp, color,
 *                                 origin, angle, intensity, seed, blur } — resolves when it's done
 *   BeeboFX2.TRANSITIONS          the 42 transitions: 31 drawn per pixel (burn, melt, ripple, glitch…), 9 on meshes with
 *                                 lighting (page curl, cube, door, cloth, blinds, fold, roll, tiles, glass), 2 on GPU particles
 *   BeeboFX2.RAMPS / ramp()       time ramps: how fast a transition moves through its course (slow-motion in the middle…)
 *
 * The glass break is a rigid-body simulation (gravity, spin, a floor to bounce on), worked out once and then played, so
 * it runs the same forwards (out) and backwards (in). Motion blur blends a few moments of each frame together. Every
 * transition has a simpler stand-in (`fb`) for when the graphics card isn't used (engine off, Ultra-light, no WebGL 2).
 */
(() => {
  'use strict';
  if (window.BeeboFX2) return;

  // ===================================================================================== capture
  const dataCache = new Map();
  const toData = url => {
    if (!url || /^data:/.test(url)) return Promise.resolve(url);
    if (dataCache.has(url)) return dataCache.get(url);
    const pr = fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error(r.status))).then(b => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }));
    dataCache.set(url, pr); pr.catch(() => dataCache.delete(url));
    return pr;
  };
  let cssMemo = { key: '', css: '' };
  async function pageCss() {
    const parts = [...document.querySelectorAll('style')].map(s => s.textContent), key = parts.map(p => p.length).join(',');
    if (cssMemo.key === key) return cssMemo.css;
    let css = parts.join('\n');
    const urls = [...new Set([...css.matchAll(/url\((['"]?)((?:\/|https?:)[^'")]+?\.(?:woff2?|ttf|otf|png|jpe?g|webp|gif|svg))\1\)/g)].map(m => m[2]))];
    for (const u of urls) { try { const d = await toData(u); css = css.split(u).join(d); } catch (e) {} }
    // 1.12.15: a '<' anywhere in the styles (an @property syntax, a selector) would break the SVG the picture is drawn through — CSS escapes it
    cssMemo = { key, css: css.replace(/<\/?style/gi, '').replace(/</g, '\\3c ').replace(/&/g, '\\26 ') };
    return cssMemo.css;
  }
  /** a screen (or any node) as a canvas, at w × h; canvases inside (keyed clips, particles) are copied in as pictures */
  async function capture(node, o = {}) {
    const W = o.w || node.offsetWidth || 1920, H = o.h || node.offsetHeight || 1080;
    const css = await pageCss();
    const still = node.cloneNode(true); still.classList.remove('sd-hidden', 'sd-gxwait'); still.style.opacity = '1'; still.style.visibility = 'visible';
    // live canvases → pictures (the effects engine's own layers are left out: they're drawn again on top)
    const srcC = [...node.querySelectorAll('canvas')], dstC = [...still.querySelectorAll('canvas')];
    dstC.forEach((c, i) => {
      const s = srcC[i]; let url = '';
      if (s && !/\bsd-gfx|sd-cv-back|sd-parts|sd-crtsparks/.test(s.className)) { try { url = s.toDataURL(); } catch (e) {} }
      if (url && url.length > 30) { const im = document.createElement('img'); im.src = url; im.style.cssText = c.style.cssText; im.className = c.className; c.replaceWith(im); } else c.remove();
    });
    still.querySelectorAll('video, iframe, script').forEach(n => n.remove());
    await Promise.all([...still.querySelectorAll('img')].map(async im => { const s = im.getAttribute('src'); if (s && !/^data:/.test(s)) { try { im.setAttribute('src', await toData(im.src)); } catch (e) { im.remove(); } } }));
    // pictures set as backgrounds in a piece's own style
    await Promise.all([...still.querySelectorAll('[style*="url("]')].map(async n => {
      const st0 = n.getAttribute('style'), us = [...st0.matchAll(/url\((['"]?)((?:\/|https?:)[^'")]+)\1\)/g)].map(x => x[2]);
      let st1 = st0; for (const u of us) { try { st1 = st1.split(u).join(await toData(u)); } catch (e) {} } if (st1 !== st0) n.setAttribute('style', st1);
    }));
    const html = new XMLSerializer().serializeToString(still);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>${html}</div></foreignObject></svg>`;
    const img = new Image(); img.decoding = 'async'; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement('canvas'), k = Math.min(1, o.scale || 1); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }

  // ===================================================================================== time ramps
  // a ramp is a list of [time, progress] points (both 0 – 1), joined by smooth curves; the presets have names
  const RAMPS = {
    linear: { label: 'Steady', pts: [[0, 0], [1, 1]] },
    smooth: { label: 'Ease in and out', pts: [[0, 0], [.5, .5], [1, 1]], smooth: true },
    slowmo: { label: 'Slow motion in the middle', pts: [[0, 0], [.22, .4], [.78, .6], [1, 1]] },
    punch: { label: 'Punch: fast, then settle', pts: [[0, 0], [.18, .62], [1, 1]] },
    windup: { label: 'Wind-up: slow, then snap', pts: [[0, 0], [.7, .18], [1, 1]] },
    stutter: { label: 'Stutter', pts: [[0, 0], [.2, .3], [.3, .3], [.5, .55], [.6, .55], [1, 1]] },
  };
  function rampFn(r) {
    const pts = (Array.isArray(r) ? r : (RAMPS[r] || RAMPS.smooth).pts).map(p => [Math.max(0, Math.min(1, +p[0] || 0)), Math.max(0, Math.min(1, +p[1] || 0))]).sort((a, b) => a[0] - b[0]);
    if (!pts.length || pts[0][0] > 0) pts.unshift([0, 0]); if (pts[pts.length - 1][0] < 1) pts.push([1, 1]);
    const smooth = !Array.isArray(r) && RAMPS[r] && RAMPS[r].smooth;
    return t => {
      t = Math.max(0, Math.min(1, t));
      for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], u = x1 > x0 ? (t - x0) / (x1 - x0) : 1, s = u * u * (3 - 2 * u); return y0 + (y1 - y0) * (smooth || pts.length > 2 ? s : u); }
      return 1;
    };
  }

  // ===================================================================================== shaders
  const HEAD = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float p, uSeed, uI, uDir, uT; uniform vec2 uRes, uOrg; uniform vec3 uCol;
vec4 S(vec2 uv){ return (uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) ? vec4(0) : texture(uTex, uv); }
float h21(vec2 q){ q = fract(q*vec2(123.34, 456.21)+uSeed*.137); q += dot(q, q+45.32); return fract(q.x*q.y); }
float vn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 q){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a*vn(q); q = q*2.03+17.1; a *= .5; } return s; }
vec2 asp(){ return vec2(uRes.x/uRes.y, 1.); }
float dO(vec2 uv){ return length((uv-uOrg)*asp()); }
vec2 dirv(){ return vec2(cos(uDir), sin(uDir)); }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
`;
  const QV = `#version 300 es
in vec2 aP; out vec2 vUv; void main(){ vUv = vec2(aP.x*.5+.5, .5-aP.y*.5); gl_Position = vec4(aP, 0., 1.); }`;
  // the meshes: positions in screen pixels (x right, y down, z away from you), seen through a camera 1600 px back
  const MHEAD = `#version 300 es
precision highp float;
in vec2 aP; in vec2 aC; out vec2 vUv; out vec3 vN; out float vA; out float vB;
uniform float p, uSeed, uI, uDir, uT; uniform vec2 uRes, uOrg;
float h(vec2 q){ q = fract(q*vec2(123.34, 456.21)+uSeed*.137); q += dot(q, q+45.32); return fract(q.x*q.y); }
mat3 rx(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
mat3 ry(float a){ float c=cos(a),s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rz(float a){ float c=cos(a),s=sin(a); return mat3(c,s,0, -s,c,0, 0,0,1); }
void put(vec3 P){ float f = 1600.; vec2 c = uRes*.5; float k = f/max(1., f+P.z); vec2 s = c+(P.xy-c)*k; gl_Position = vec4(s.x/uRes.x*2.-1., 1.-s.y/uRes.y*2., clamp(P.z/8000., -.99, .99), 1.); }
`;
  const MFRAG = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vN; in float vA; in float vB; out vec4 o; uniform sampler2D uTex; uniform float uI;
void main(){
  vec4 c = (vUv.x<0.||vUv.y<0.||vUv.x>1.||vUv.y>1.) ? vec4(0) : texture(uTex, vUv);
  if (c.a < .003 || vA < .003) discard;
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(-.35, -.55, -1.)), V = vec3(0,0,-1);
  float d = max(dot(N, L), 0.), sp = pow(max(dot(reflect(-L, N), V), 0.), 28.)*.55*uI;
  vec3 rgb = c.rgb*(.42+.62*d) + sp*c.a;
  if (vB > .5) rgb = mix(rgb, vec3(.06,.06,.08)*c.a, .72);           // the back of the page
  o = vec4(rgb, c.a)*vA;
}`;

  const TR = {};
  const q = (id, label, emoji, fb, body, x = {}) => { TR[id] = { id, label, emoji, fb, kind: 'quad', frag: HEAD + body, ...x }; };
  const m = (id, label, emoji, fb, vert, x = {}) => { TR[id] = { id, label, emoji, fb, kind: 'mesh', vert: MHEAD + vert, ...x }; };

  // ------------------------------------------------------------------------------- drawn per pixel (p: 0 = all there, 1 = gone)
  q('dissolve', 'Dissolve', '🌫️', 'fade', `void main(){ float n = fbm(vUv*vec2(9.,5.)), e = p*1.15-.08; vec4 c = S(vUv);
    float v = smoothstep(e, e+.025, n), g = (1.-smoothstep(0., .05, abs(n-e)))*step(.002, p)*step(p, .998);
    o = c*v + vec4(uCol*1.6, 1.)*g*c.a*uI; }`);
  q('burn', 'Burn away', '🔥', 'ignite', `void main(){ float n = fbm(vUv*3.5)*.65+dO(vUv)*.55, e = p*1.45-.12; vec4 c = S(vUv);
    float v = smoothstep(e, e+.02, n), ch = smoothstep(e+.16, e, n); c.rgb *= mix(1., .12, ch);
    float rim = (1.-smoothstep(0., .035, abs(n-e)))*step(.002, p)*step(p, .998);
    vec3 fire = mix(uCol, vec3(1.,.92,.62), rim*rim);
    o = c*v + vec4(fire*2.2, 1.)*rim*c.a*uI; }`);
  q('melt', 'Melt', '🫠', 'drop', `void main(){ float col = floor(vUv.x*70.), r = h21(vec2(col, 3.)); float dy = p*p*(1.2+r*1.6) + p*.15;
    vec4 c = S(vec2(vUv.x, vUv.y-dy)); c *= 1.-smoothstep(.75, 1., p); o = c; }`);
  q('pixelsort', 'Pixel sort', '📊', 'glitch', `void main(){ float row = floor(vUv.y*180.), r = h21(vec2(row, 7.)); vec2 d = dirv();
    float k = p*p*(.3+r*1.1); vec4 c = vec4(0); for (int i = 0; i < 6; i++) c += S(vUv - d*k*float(i)/5.); c /= 6.;
    o = c*(1.-smoothstep(.7, 1., p)); }`);
  q('glitch2', 'Data glitch', '📺', 'glitch', `void main(){ vec2 cell = floor(vUv*vec2(8., 26.)); float t = floor(p*22.), r = h21(cell+t);
    vec2 uv = vUv; if (r < p*1.4) uv.x += (h21(cell+t+3.)-.5)*.25*p;
    float k = .012*p*uI*4.; vec4 a = S(uv+vec2(k,0)), b = S(uv), c2 = S(uv-vec2(k,0));
    vec4 c = vec4(a.r, b.g, c2.b, max(max(a.a, b.a), c2.a)); c.rgb *= .85+.15*step(.5, fract(vUv.y*uRes.y*.5));
    float flick = step(.15, h21(vec2(t, 9.))); o = c*(1.-smoothstep(.55, 1., p))*mix(1., flick, step(.3, p)); }`);
  q('ripple', 'Ripple', '💧', 'fade', `void main(){ float d = dO(vUv); vec2 n = normalize((vUv-uOrg)*asp()+1e-5);
    float w = sin(d*55.-p*28.)*.025*p*(1.-p*.5)*uI; vec4 c = S(vUv + n*w/asp());
    float ring = exp(-pow((d-p*1.3)*14., 2.))*p*(1.-p); o = c*(1.-smoothstep(.45, 1., p)) + vec4(uCol, 1.)*ring*.5*c.a*uI; }`);
  q('swirl', 'Vortex', '🌀', 'spinin', `void main(){ vec2 a = asp(), d = (vUv-uOrg)*a; float r = length(d), ang = p*p*9.*uI*max(0., 1.2-r);
    float c0 = cos(ang), s0 = sin(ang); d = mat2(c0, -s0, s0, c0)*d*(1.+p*1.6); o = S(uOrg+d/a)*(1.-smoothstep(.55, 1., p)); }`);
  q('zoomblur', 'Zoom blur', '🔭', 'pop', `void main(){ vec4 c = vec4(0); for (int i = 0; i < 12; i++) { float k = 1.+p*1.4*float(i)/11.; c += S(uOrg+(vUv-uOrg)/k); } c /= 12.;
    o = c*(1.-smoothstep(.35, 1., p)); }`);
  q('lightwipe', 'Light wipe', '🔦', 'wipe', `void main(){ vec2 d = dirv(); float t = dot(vUv-.5, d)/(abs(d.x)+abs(d.y))+.5, e = p*1.3-.15;
    vec4 c = S(vUv); float v = smoothstep(e, e+.04, t); float g = exp(-pow((t-e)*30., 2.))*step(.002, p)*step(p, .998);
    g *= .6+.4*vn(vec2(dot(vUv, vec2(-d.y, d.x))*40., p*6.));
    o = c*v + vec4(mix(uCol, vec3(1.), .55)*2., 1.)*g*.9*uI; }`);
  q('iris2', 'Iris', '👁️', 'iris', `void main(){ float d = dO(vUv), r = (1.-p)*1.25; vec4 c = S(vUv); float v = smoothstep(r, r-.012, d);
    float g = exp(-pow((d-r)*40., 2.))*step(.002, p)*step(p, .998); o = c*v + vec4(uCol*1.8, 1.)*g*uI*.8; }`);
  q('hexes', 'Hexagons', '⬡', 'fade', `void main(){ float s = mix(.002, .07, smoothstep(0., .6, p)); vec2 a = asp(), uv = vUv*a/s;
    vec2 r = vec2(1., 1.732), hr = r*.5, A = mod(uv, r)-hr, B = mod(uv-hr, r)-hr; vec2 g = dot(A,A) < dot(B,B) ? A : B; vec2 cen = (uv-g)*s/a;
    float k = h21(floor(cen*40.)); vec4 c = S(cen); float v = 1.-smoothstep(.45+k*.4, .55+k*.4, p); o = c*v; }`);
  q('mosaic2', 'Mosaic', '🧩', 'mosaic', `void main(){ float s = mix(1., 28., smoothstep(0., .5, p)); vec2 g = floor(vUv*uRes/s)*s/uRes + s*.5/uRes;
    float k = h21(floor(vUv*uRes/28.)); vec4 c = S(p < .02 ? vUv : g); o = c*(1.-smoothstep(.4+k*.45, .5+k*.45, p)); }`);
  q('crtoff', 'Old TV off', '📺', 'fade', `void main(){ float a = smoothstep(0., .55, p), b = smoothstep(.55, .92, p);
    float sy = mix(1., .004, a), sx = mix(1., .003, b); vec2 uv = vec2(.5+(vUv.x-.5)/sx, .5+(vUv.y-.5)/sy);
    vec4 c = S(uv); c.rgb = mix(c.rgb, vec3(c.a), a*.7)*(1.+a*1.6); float dot0 = (1.-step(.001, abs(vUv.y-.5)-.004*(1.-b)))*b*(1.-smoothstep(.92, 1., p));
    o = c*(1.-smoothstep(.9, 1., p)) + vec4(1.)*dot0*exp(-pow((vUv.x-.5)*30., 2.)); }`);
  q('heat', 'Heat haze', '♨️', 'fade', `void main(){ vec2 w = vec2(fbm(vUv*7.+vec2(0., p*3.)), fbm(vUv*7.+5.+vec2(p*3., 0.)))-.5;
    vec4 c = S(vUv+w*.06*p*uI); c.rgb = mix(c.rgb, uCol*c.a, p*.35); o = c*(1.-smoothstep(.3, 1., p)); }`);
  q('shockwave', 'Shockwave', '💥', 'slam', `void main(){ float d = dO(vUv), rr = p*1.55, w = exp(-pow((d-rr)*11., 2.));
    vec2 n = normalize((vUv-uOrg)*asp()+1e-5); vec4 c = S(vUv - n*w*.06*uI/asp()); float v = smoothstep(rr*.85, rr, d);
    o = c*v + vec4(mix(uCol, vec3(1.), .4), 1.)*w*.55*(1.-p)*uI; }`);
  q('clock', 'Clock wipe', '🕐', 'wipe', `void main(){ vec2 d = (vUv-uOrg)*asp(); float a = fract(atan(d.x, -d.y)/6.2832+1.+uDir/6.2832);
    vec4 c = S(vUv); float v = smoothstep(p, p+.008, a); float g = exp(-pow((a-p)*80., 2.))*step(.002, p)*step(p, .998); o = c*v + vec4(uCol, 1.)*g*.7*uI; }`);
  q('kaleido', 'Kaleidoscope', '🔮', 'spinin', `void main(){ vec2 a = asp(), d = (vUv-uOrg)*a; float r = length(d), th = atan(d.y, d.x)+p*3., n = mix(1., 8., smoothstep(0., .4, p)), seg = 6.2832/n;
    th = abs(mod(th, seg)-seg*.5); vec2 uv = uOrg + vec2(cos(th), sin(th))*r*(1.+p)/a; vec4 c = mix(S(vUv), S(uv), smoothstep(0., .25, p)); o = c*(1.-smoothstep(.5, 1., p)); }`);
  q('ink', 'Ink spread', '🖋️', 'ink', `void main(){ float n = dO(vUv)*.8+fbm(vUv*5.)*.45, e = p*1.5-.15; vec4 c = S(vUv);
    float v = smoothstep(e-.05, e, n); float edge = smoothstep(e-.12, e-.02, n)*(1.-v); o = c*v + vec4(uCol*.25, 1.)*edge*c.a*(1.-p); }`);
  q('frost', 'Frost', '❄️', 'fade', `void main(){ vec2 g = vUv*vec2(26., 15.); vec2 i = floor(g), f = fract(g); float md = 9.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 b = vec2(x, y); vec2 r = b + vec2(h21(i+b), h21(i+b+7.)) - f; md = min(md, dot(r, r)); }
    float n = sqrt(md)*.6+fbm(vUv*4.)*.6, e = p*1.3-.1; vec4 c = S(vUv); float v = smoothstep(e, e+.02, n);
    float rim = (1.-smoothstep(0., .05, abs(n-e)))*step(.002, p)*step(p, .998); o = c*v + vec4(vec3(.82,.93,1.)*1.6, 1.)*rim*c.a*uI; }`);
  q('vhs', 'VHS rewind', '📼', 'glitch', `void main(){ float t = p*12.; float row = floor(vUv.y*90.); float off = (vn(vec2(row*.3, t))-.5)*.12*p;
    float band = exp(-pow((fract(vUv.y-p*2.3)-.5)*12., 2.)); vec2 uv = vUv+vec2(off+band*.04*p, 0.);
    vec4 c = vec4(S(uv+vec2(.006*p,0)).r, S(uv).g, S(uv-vec2(.006*p,0)).b, S(uv).a); c.rgb += band*.25*p*c.a; o = c*(1.-smoothstep(.6, 1., p)); }`);
  q('squares', 'Squares', '🔲', 'fade', `void main(){ vec2 n = vec2(16., 9.), cell = floor(vUv*n), f = fract(vUv*n); float del = (length((cell+.5)/n-uOrg))*.6;
    float k = clamp((p-del*.8)/.45, 0., 1.); vec2 uv = (cell+.5+(f-.5)/max(.001, 1.-k))/n; vec4 c = (abs(f.x-.5) < .5*(1.-k) && abs(f.y-.5) < .5*(1.-k)) ? S(uv) : vec4(0); o = c; }`);
  q('diamonds', 'Diamonds', '🔷', 'fade', `void main(){ vec2 a = asp(), g = vUv*a*9.; vec2 cell = floor(g), f = fract(g)-.5; float del = length((cell+.5)/9./a-uOrg)*.55;
    float k = clamp((p-del)/.45, 0., 1.); float v = step(abs(f.x)+abs(f.y), .5*(1.-k)*1.42); o = S(vUv)*v; }`);
  q('static', 'TV static', '📡', 'fade', `void main(){ float n = h21(vUv*uRes*.5+floor(uT*30.)); vec4 c = S(vUv); float k = smoothstep(0., .5, p);
    vec3 s = vec3(n); o = vec4(mix(c.rgb, s*c.a, k), c.a)*(1.-smoothstep(.55, 1., p)) + vec4(s, 1.)*.0; }`);
  q('halftone', 'Halftone', '⚫', 'fade', `void main(){ float s = 14.; vec2 g = vUv*uRes/s, cell = floor(g)+.5, f = fract(g)-.5; vec4 c = S(cell*s/uRes);
    float r = (1.-p)*.75*sqrt(max(lum(c.rgb/max(c.a, .001)), .25)); float v = smoothstep(r, r-.08, length(f)); o = mix(S(vUv), c*v, smoothstep(0., .25, p))*(1.-smoothstep(.85, 1., p)); }`);
  q('smear', 'Smear', '💨', 'slide', `void main(){ vec2 d = dirv(); vec4 c = vec4(0); for (int i = 0; i < 10; i++) c += S(vUv - d*p*.45*float(i)/9. - d*p*p*.6); c /= 10.;
    o = c*(1.-smoothstep(.5, 1., p)); }`);
  q('liquid', 'Liquid', '🌊', 'fade', `void main(){ vec2 w = vec2(fbm(vUv*3.+p*2.), fbm(vUv*3.+9.-p*2.))-.5; vec4 c = S(vUv+w*.25*p*uI);
    float n = fbm(vUv*4.+w), v = smoothstep(p*1.2-.1, p*1.2, n); o = c*v; }`);
  q('scanbars', 'Scan bars', '📶', 'slide', `void main(){ float n = 18., row = floor(vUv.y*n), s = mod(row, 2.) < 1. ? 1. : -1., del = row/n*.35;
    float k = clamp((p-del)/.6, 0., 1.); k = k*k; vec4 c = S(vUv - vec2(s*k*1.2, 0.)); o = c; }`);
  q('flare', 'Lens flare', '✨', 'fade', `void main(){ float x = p*1.4-.2; vec4 c = S(vUv); float v = 1.-smoothstep(.35, 1., p);
    float streak = exp(-pow((vUv.y-uOrg.y)*28., 2.))*exp(-abs(vUv.x-x)*3.)*1.4, core = exp(-pow(length((vUv-vec2(x, uOrg.y))*asp())*9., 2.))*2.;
    o = c*v + vec4(mix(uCol, vec3(1.), .5), 1.)*(streak+core)*sin(p*3.1416)*uI; }`);
  q('pinch', 'Gravity well', '🕳️', 'pop', `void main(){ vec2 a = asp(), d = (vUv-uOrg)*a; float r = length(d); vec2 uv = uOrg + d/a*(1.+p*p*6./(r*3.+.2));
    o = S(uv)*(1.-smoothstep(.6, 1., p)); }`);
  q('chroma', 'Colour split', '🌈', 'glitch', `void main(){ vec2 d = (vUv-uOrg)*p*.18*uI; vec4 r = S(vUv+d), g = S(vUv), b = S(vUv-d);
    o = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a))*(1.-smoothstep(.4, 1., p)); }`);
  q('embers', 'Ember drift', '🔥', 'ignite', `void main(){ vec2 g = vUv*uRes/6., cell = floor(g); float r = h21(cell), s = r*.65; float k = clamp((p-s)/(1.-s+.001), 0., 1.);
    vec2 off = vec2((h21(cell+3.)-.5)*.2, -.35-r*.4)*k*k; vec4 c = S((cell+.5)*6./uRes - off*0.); float v = 1.-step(s, p);
    vec4 c0 = S(vUv); vec4 spark = vec4(mix(uCol, vec3(1.,.85,.5), .4), 1.)*exp(-pow((p-s)*14., 2.))*c0.a*uI; o = c0*v + spark; }`);

  // ------------------------------------------------------------------------------- on meshes, lit (grid of the screen)
  m('curl', 'Page curl', '📃', 'wipe', `void main(){ vec2 D = vec2(cos(uDir), sin(uDir)); float len = abs(D.x)*uRes.x+abs(D.y)*uRes.y, R = 90.+60.*uI;
    vec2 c0 = uRes*.5 - D*len*.5; float s = dot(aP-c0, D) - (p*(len+3.2*R) - R*1.6), a = s/R; vec3 P = vec3(aP, 0.); vec3 N = vec3(0,0,-1); vB = 0.;
    if (s > 0.) { if (a < 3.1416) { P.xy = aP - D*s + D*R*sin(a); P.z = -R*(1.-cos(a)); N = normalize(vec3(-D*sin(a), -cos(a))); vB = a > 1.5708 ? 1. : 0.; }
      else { P.xy = aP - D*s - D*(s-3.1416*R); P.z = -2.*R; N = vec3(0,0,1); vB = 1.; } }
    vUv = aP/uRes; vN = N; vA = 1.; put(P); }`, { grid: [72, 40] });
  m('cube', 'Cube turn', '🧊', 'cube', `void main(){ float a = p*1.5708*(cos(uDir) < 0. ? -1. : 1.); vec3 P = vec3(aP-uRes*.5, uRes.x*.5); P = ry(a)*P; P.z -= uRes.x*.5; P.xy += uRes*.5;
    vUv = aP/uRes; vN = ry(a)*vec3(0,0,-1); vA = 1.-smoothstep(.8, 1., p); vB = 0.; put(P); }`, { grid: [24, 14] });
  m('door', 'Swing door', '🚪', 'doors', `void main(){ bool r = cos(uDir) < 0.; float x0 = r ? uRes.x : 0., a = p*1.9*(r ? 1. : -1.); vec3 P = vec3(aP.x-x0, aP.y-uRes.y*.5, 0.);
    P = ry(a)*P; P.x += x0; P.y += uRes.y*.5; vUv = aP/uRes; vN = ry(a)*vec3(0,0,-1); vA = 1.-smoothstep(.75, 1., p); vB = 0.; put(P); }`, { grid: [24, 14] });
  m('cloth', 'Cloth drop', '🧣', 'drop', `void main(){ float rel = h(vec2(floor(aP.x/40.), 1.))*.15 + (aP.x/uRes.x)*.08, t = max(0., p-rel)/(1.-rel+.001);
    float fall = t*t*uRes.y*1.25; float wave = sin(aP.x*.012+aP.y*.02-p*9.)*36.*t*uI; vec3 P = vec3(aP.x, aP.y+fall+(aP.y/uRes.y)*fall*.35, wave+t*220.);
    float dz = cos(aP.x*.012+aP.y*.02-p*9.)*.012*36.*t*uI; vUv = aP/uRes; vN = normalize(vec3(-dz, -.4*t, -1.)); vA = 1.-smoothstep(.85, 1., p); vB = 0.; put(P); }`, { grid: [64, 36] });
  m('blinds3d', 'Turning slats', '🎚️', 'blinds', `void main(){ float n = 12., row = aC.y, cy = (row+.5)/n*uRes.y, del = row/n*.35, k = clamp((p-del)/.65, 0., 1.), a = k*1.5708;
    vec3 P = vec3(aP.x, aP.y-cy, 0.); P = rx(a)*P; P.y += cy; vUv = aP/uRes; vN = rx(a)*vec3(0,0,-1); vA = 1.-smoothstep(.85, 1., k); vB = 0.; put(P); }`, { grid: [8, 48], cells: [1, 12] });
  m('fold', 'Accordion fold', '🪗', 'fade', `void main(){ float n = 8., i = aC.x, w = uRes.x/n, x0 = i*w, ang = p*1.45*(mod(i, 2.) < 1. ? 1. : -1.);
    float cw = w*cos(p*1.45), lx = aP.x-x0; float hinge = mod(i, 2.) < 1. ? 0. : w; vec3 P = vec3(lx-hinge, aP.y, 0.); P = ry(ang)*P; P.x += hinge;
    float start = i*cw + (uRes.x - n*cw)*uOrg.x; P.x += start + (mod(i, 2.) < 1. ? 0. : cw-w); vUv = aP/uRes; vN = ry(ang)*vec3(0,0,-1); vA = 1.-smoothstep(.8, 1., p); vB = 0.; put(P); }`, { grid: [32, 12], cells: [8, 1] });
  m('roll', 'Roll up', '🧻', 'wipe', `void main(){ float R = 46.+20.*uI, L = p*(uRes.y+6.*R), s = (uRes.y - aP.y) - L + 2.*R; vec3 P = vec3(aP, 0.); vec3 N = vec3(0,0,-1); vB = 0.;
    if (s > 0.) { float a = s/R, r = R*(1.-min(a, 30.)*.01); P.y = uRes.y - L + 2.*R - r*sin(a) - 0.; P.z = -r*(1.-cos(a)); N = normalize(vec3(0., sin(a), -cos(a))); vB = cos(a) < 0. ? 1. : 0.; P.y = (uRes.y-(L-2.*R)) - r*sin(a); }
    vUv = aP/uRes; vN = N; vA = 1.-smoothstep(.92, 1., p); put(P); }`, { grid: [16, 90] });
  m('tiles', 'Tiles fly out', '🃏', 'deal', `void main(){ vec2 cc = (aC+.5)*uRes/vec2(16., 9.); float r = h(aC), del = length(cc/uRes-uOrg)*.5*0.+r*.3, k = clamp((p-del)/.7, 0., 1.);
    vec3 P = vec3(aP-cc, 0.); mat3 R = rx((h(aC+1.)-.5)*k*4.)*ry((h(aC+2.)-.5)*k*4.)*rz((h(aC+3.)-.5)*k*2.); P = R*P;
    P += vec3(cc + (cc-uOrg*uRes)*k*.8 + vec2(0., k*k*500.), -k*k*900.*uI); vUv = aP/uRes; vN = R*vec3(0,0,-1); vA = 1.-smoothstep(.6, 1., k); vB = 0.; put(P); }`, { grid: [64, 36], cells: [16, 9] });

  // ------------------------------------------------------------------------------- glass: a rigid-body simulation
  TR.glass = { id: 'glass', label: 'Glass break (3D)', emoji: '🪟', fb: 'shatter', kind: 'shards', dur: 1.7, vert: MHEAD + `in vec3 aQ; in vec3 aR; in vec3 aT; in float aF;
    void main(){ mat3 R = rz(aR.z)*ry(aR.y)*rx(aR.x); vec3 P = R*vec3(aP-aQ.xy, 0.) + aT; vUv = aP/uRes; vN = R*vec3(0,0,-1); vA = aF; vB = 0.; put(P); }` };
  // shards round an impact point; the motion is worked out once (60 steps a second), then looked up — so it plays backwards too
  function glassSim(W, H, org, seed, I) {
    let s0 = (seed * 9301 + 49297) % 233280; const rnd = () => (s0 = (s0 * 9301 + 49297) % 233280) / 233280;
    const O = [org[0] * W, org[1] * H], RAYS = 14, RINGS = [90, 260, 560, 1100, 2400];
    const ang = Array.from({ length: RAYS }, (_, i) => (i + .25 + rnd() * .5) / RAYS * Math.PI * 2);
    const V = RINGS.map((r, j) => ang.map(a => [O[0] + Math.cos(a) * r * (.8 + rnd() * .35), O[1] + Math.sin(a) * r * (.8 + rnd() * .35)]));
    const polys = [];
    for (let a = 0; a < RAYS; a++) { const b = (a + 1) % RAYS; polys.push([O, V[0][a], V[0][b]]); for (let i = 1; i < RINGS.length; i++) polys.push([V[i - 1][a], V[i - 1][b], V[i][b], V[i][a]]); }
    const shards = polys.map(pts => {
      const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]), dx = c[0] - O[0], dy = c[1] - O[1], dist = Math.hypot(dx, dy) || 1;
      const sp = (420 + rnd() * 380) * (1 - Math.min(.7, dist / 2600)) * (.6 + I * .4);
      return { pts, c, x: c[0], y: c[1], z: 0, vx: dx / dist * sp, vy: dy / dist * sp * .6 - 180 - rnd() * 200, vz: -(260 + rnd() * 520) * (1 - Math.min(.8, dist / 2000)),
        rx: 0, ry: 0, rz: 0, wx: (rnd() - .5) * 9, wy: (rnd() - .5) * 9, wz: (rnd() - .5) * 5, del: Math.min(.18, dist / 5200), track: [] };
    });
    const T = 1.6, steps = 96, dt = T / steps, floor = H + 140, G = 2300;
    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      for (const s of shards) {
        if (t > s.del) {
          s.vy += G * dt; s.vx *= 1 - .25 * dt; s.vz *= 1 - .4 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rx += s.wx * dt; s.ry += s.wy * dt; s.rz += s.wz * dt;
          if (s.y > floor && s.vy > 0) { s.y = floor; s.vy *= -.32; s.vx *= .7; s.wx *= .6; s.wy *= .6; s.wz *= .6; }     // a bounce off the floor
        }
        s.track.push([s.x, s.y, s.z, s.rx, s.ry, s.rz]);
      }
    }
    return { shards, steps };
  }

  // ------------------------------------------------------------------------------- GPU particles (worked out on the card from each particle's own seed)
  const PV = `#version 300 es
precision highp float;
in vec2 aUv; out vec4 vC; uniform sampler2D uTex; uniform float p, uSeed, uI, uDir, uMode; uniform vec2 uRes, uOrg;
float h(vec2 q){ q = fract(q*vec2(123.34, 456.21)+uSeed*.137); q += dot(q, q+45.32); return fract(q.x*q.y); }
float thr(vec2 uv){ vec2 D = vec2(cos(uDir), sin(uDir)); return clamp(dot(uv-.5, D)/(abs(D.x)+abs(D.y))+.5, 0., 1.)*.6 + h(floor(uv*80.))*.32; }
void main(){
  vec4 c = texture(uTex, aUv); float s = thr(aUv), t = max(0., p-s)/(1.-s*.6);
  vec2 P = aUv*uRes; float r1 = h(aUv*7.), r2 = h(aUv*13.+3.);
  if (uMode < .5) { P += vec2(cos(uDir+ (r1-.5)*1.6), sin(uDir+(r1-.5)*1.6))*t*(500.+900.*r2)*uI + vec2(0., -t*t*260.); }
  else { float tt = t*1.1; P.x += (r1-.5)*120.*tt; P.y += 0.5*2600.*tt*tt; float fl = uRes.y + 30. + r2*40.; if (P.y > fl) P.y = fl - abs(sin(tt*9.))*18.*(1.-tt); }
  float alive = step(.001, t)*(1.-smoothstep(.55, 1., t))*step(.02, c.a);
  vC = c*alive; gl_PointSize = (2.2+r2*2.2)*(1.-t*.4);
  gl_Position = vec4(P.x/uRes.x*2.-1., 1.-P.y/uRes.y*2., 0., 1.); }`;
  const PF = `#version 300 es
precision highp float; in vec4 vC; out vec4 o; void main(){ vec2 d = gl_PointCoord-.5; float a = smoothstep(.5, .2, length(d)); o = vC*a; }`;
  const REST = mode => HEAD + `uniform float uMode; float thr(vec2 uv){ vec2 D = dirv(); return clamp(dot(uv-.5, D)/(abs(D.x)+abs(D.y))+.5, 0., 1.)*.6 + h21(floor(uv*80.)-uSeed*.137*0.)*.32; }
    void main(){ float s = thr(vUv); o = S(vUv)*step(p, s); }`;
  TR.disintegrate = { id: 'disintegrate', label: 'Disintegrate', emoji: '🌬️', fb: 'dust', kind: 'particles', mode: 0, dur: 1.6 };
  TR.sand = { id: 'sand', label: 'Sand fall', emoji: '⏳', fb: 'drop', kind: 'particles', mode: 1, dur: 1.7 };

  // ===================================================================================== the stage
  const stages = new WeakMap();
  // 1.12.15: every transition draws in BeeboFX 4's one shared 'tx' context (edge smoothing and depth for the 3D ones) and
  // hands each frame to its own canvas — no new graphics context per moving piece, and each transition's program is
  // compiled once per context instead of once per piece. Without BeeboFX 4 it opens its own, as before.
  const X4 = () => window.BeeboFX4;
  const RAF = f => (X4() ? X4().raf(f) : requestAnimationFrame(f));
  const PROGS = new WeakMap(), progsFor = gl => { let m = PROGS.get(gl); if (!m) PROGS.set(gl, m = new Map()); return m; };
  function stage(root, W, H) {
    let st = stages.get(root); if (st && st.cv.isConnected && !(st.ctx && st.ctx.lost)) return st;
    if (st) release(root);
    const cv = document.createElement('canvas'); cv.className = 'sd-gx'; cv.width = W; cv.height = H;
    cv.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:55;display:none`;
    root.appendChild(cv);
    const c = X4() && X4().context('tx');
    if (c) { st = { cv, gl: c.gl, ctx: c, shared: true, W, H, progs: progsFor(c.gl), bufs: {}, tex: null, fbo: null }; stages.set(root, st); return st; }
    const gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl) { cv.remove(); return null; }
    st = { cv, gl, W, H, progs: new Map(), bufs: {}, tex: null, fbo: null }; stages.set(root, st); return st;
  }
  const use = st => { if (st.shared) { X4().claim('tx', 'fx2'); X4().fit('tx', st.W, st.H); } };
  const show = st => { if (st.shared) X4().present('tx', st.cv, st.W, st.H); };
  function compile(gl, vs, fs) {
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const u = {}; const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(pr, i); u[a.name] = gl.getUniformLocation(pr, a.name); }
    const at = {}; const na = gl.getProgramParameter(pr, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(pr, i); at[a.name] = gl.getAttribLocation(pr, a.name); }
    return { pr, u, at };
  }
  function prog(st, key, vs, fs) { if (!st.progs.has(key)) st.progs.set(key, compile(st.gl, vs, fs)); return st.progs.get(key); }
  function gridBuf(st, nx, ny, cx = 1, cy = 1) {
    const key = `g${nx}x${ny}c${cx}x${cy}`; if (st.bufs[key]) return st.bufs[key];
    const { gl, W, H } = st, pos = [], cel = [];
    // each cell gets its own vertices, so tiles / slats / folds can come apart
    const tw = nx / cx, th = ny / cy;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x0 = i / nx * W, x1 = (i + 1) / nx * W, y0 = j / ny * H, y1 = (j + 1) / ny * H, c = [Math.floor(i / tw), Math.floor(j / th)];
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x0, y1], [x1, y0], [x1, y1]]) { pos.push(x, y); cel.push(c[0], c[1]); }
    }
    const b = { p: gl.createBuffer(), c: gl.createBuffer(), n: pos.length / 2 };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.c); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cel), gl.STATIC_DRAW);
    return (st.bufs[key] = b);
  }
  const attr = (gl, P, name, buf, size) => { const l = P.at[name]; if (l === undefined || l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
  function uniforms(gl, P, st, o, pp, t) {
    const U = P.u, c = hex(o.color || '#ff5a1f');
    if (U.p) gl.uniform1f(U.p, pp); if (U.uT) gl.uniform1f(U.uT, t); if (U.uSeed) gl.uniform1f(U.uSeed, o.seed || 7); if (U.uI) gl.uniform1f(U.uI, o.intensity ?? 1);
    if (U.uDir) gl.uniform1f(U.uDir, (o.angle || 0) * Math.PI / 180); if (U.uRes) gl.uniform2f(U.uRes, st.W, st.H);
    if (U.uOrg) gl.uniform2f(U.uOrg, (o.origin || [.5, .5])[0], (o.origin || [.5, .5])[1]); if (U.uCol) gl.uniform3f(U.uCol, c[0], c[1], c[2]);
    if (U.uTex) gl.uniform1i(U.uTex, 0); if (U.uMode) gl.uniform1f(U.uMode, o._mode || 0);
  }
  const hex = c => { const m0 = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); const n = m0 ? parseInt(m0[1], 16) : 0xff5a1f; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  // one frame of a transition at progress pp (0 = all there, 1 = gone)
  function frame(st, def, o, pp, t) {
    const { gl, W, H } = st;
    gl.viewport(0, 0, W, H);
    if (def.kind === 'quad') {
      const P = prog(st, def.id, QV, def.frag); gl.useProgram(P.pr);
      if (!st.bufs.quad) { st.bufs.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, st.bufs.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); }
      attr(gl, P, 'aP', st.bufs.quad, 2); uniforms(gl, P, st, o, pp, t); gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return;
    }
    if (def.kind === 'mesh') {
      const P = prog(st, def.id, def.vert, MFRAG); gl.useProgram(P.pr); const g = def.grid || [32, 18], c = def.cells || g;
      const b = gridBuf(st, g[0], g[1], c[0], c[1]); attr(gl, P, 'aP', b.p, 2); attr(gl, P, 'aC', b.c, 2); uniforms(gl, P, st, o, pp, t);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, b.n); gl.disable(gl.DEPTH_TEST); return;
    }
    if (def.kind === 'shards') {
      const sim = o._sim || (o._sim = glassSim(W, H, o.origin || [.5, .5], o.seed || 7, o.intensity ?? 1));
      const P = prog(st, 'glass', def.vert, MFRAG); gl.useProgram(P.pr);
      const k = Math.min(sim.steps, pp * sim.steps), i0 = Math.floor(k), f = k - i0, i1 = Math.min(sim.steps, i0 + 1);
      const pos = [], Q = [], R = [], Tt = [], F = [];
      for (const s of sim.shards) {
        const a = s.track[i0], b = s.track[i1], cur = a.map((v, j) => v + (b[j] - v) * f), fade = 1 - Math.max(0, (pp - .7) / .3);
        const tri = s.pts.length === 3 ? [s.pts] : [[s.pts[0], s.pts[1], s.pts[2]], [s.pts[0], s.pts[2], s.pts[3]]];
        for (const tr of tri) for (const v of tr) { pos.push(v[0], v[1]); Q.push(s.c[0], s.c[1], 0); R.push(cur[3], cur[4], cur[5]); Tt.push(cur[0], cur[1], cur[2]); F.push(fade); }
      }
      const up = (name, arr, size) => { const key = 'sh_' + name; if (!st.bufs[key]) st.bufs[key] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, st.bufs[key]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW); attr(gl, P, name, st.bufs[key], size); };
      up('aP', pos, 2); up('aQ', Q, 3); up('aR', R, 3); up('aT', Tt, 3); up('aF', F, 1); uniforms(gl, P, st, o, pp, t);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, pos.length / 2); gl.disable(gl.DEPTH_TEST); return;
    }
    if (def.kind === 'particles') {
      o._mode = def.mode;
      const R0 = prog(st, 'rest', QV, REST()); gl.useProgram(R0.pr);
      if (!st.bufs.quad) { st.bufs.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, st.bufs.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); }
      attr(gl, R0, 'aP', st.bufs.quad, 2); uniforms(gl, R0, st, o, pp, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const P = prog(st, 'parts', PV, PF); gl.useProgram(P.pr);
      if (!st.bufs.pts) { const nx = 384, ny = 216, a = new Float32Array(nx * ny * 2); for (let j = 0, k = 0; j < ny; j++) for (let i = 0; i < nx; i++) { a[k++] = (i + .5) / nx; a[k++] = (j + .5) / ny; } st.bufs.pts = gl.createBuffer(); st.bufs.ptsN = nx * ny; gl.bindBuffer(gl.ARRAY_BUFFER, st.bufs.pts); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); }
      attr(gl, P, 'aUv', st.bufs.pts, 2); uniforms(gl, P, st, o, pp, t); gl.drawArrays(gl.POINTS, 0, st.bufs.ptsN);
    }
  }
  function blurTarget(st) {           // an off-screen picture each moment of the motion blur is drawn into
    const { gl, W, H } = st; if (st.fbo) return st.fbo;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, W, H);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return (st.fbo = { fb, tex, rb });
  }
  const ACC = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uK; void main(){ o = texture(uTex, vec2(vUv.x, 1.-vUv.y))*uK; }`;

  /** 1.12.16: compile the programs these transitions need ahead of time (when an overlay opens), so the first one of the
   *  night doesn't stall for a frame or two while the graphics driver builds its shaders. Returns how many were ready. */
  function warm(ids) {
    const c = X4() && X4().context('tx'); if (!c || c.lost) return 0;
    X4().claim('tx', 'fx2'); const st = { gl: c.gl, progs: progsFor(c.gl) }; let n = 0;
    for (const id of new Set(ids || [])) {
      const def = TR[id]; if (!def) continue;
      try {
        if (def.kind === 'quad') prog(st, def.id, QV, def.frag);
        else if (def.kind === 'mesh') prog(st, def.id, def.vert, MFRAG);
        else if (def.kind === 'shards') prog(st, 'glass', def.vert, MFRAG);
        else if (def.kind === 'particles') { prog(st, 'rest', QV, REST()); prog(st, 'parts', PV, PF); }
        n++;
      } catch (e) { console.warn('[BeeboFX 2] warm', id, e.message); }
    }
    return n;
  }
  /** play a transition on a captured screen; resolves when it's done */
  function play(root, o) {
    return new Promise(done => {
      const def = TR[o.id]; if (!def || !o.tex) return done(false); if (!o.dur && def.dur) o = { ...o, dur: def.dur };
      const W = o.w || o.tex.width, H = o.h || o.tex.height, st = stage(root, W, H); if (!st) return done(false);
      const { gl, cv } = st; use(st);
      try {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        if (!st.tex) st.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o.tex);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        if (def.kind === 'quad') prog(st, def.id, QV, def.frag); else if (def.kind === 'mesh') prog(st, def.id, def.vert, MFRAG);
      } catch (e) { console.warn('[BeeboFX 2]', o.id, e.message); return done(false); }
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const dur = Math.max(.15, Number(o.dur) || def.dur || 1) * 1000, ramp = o.ramp === 'pulse' ? (u => Math.sin(Math.PI * Math.max(0, Math.min(1, u))) * Math.max(.05, Math.min(1, Number(o.peak) || .3))) : rampFn(o.ramp || 'smooth'),   // 1.12.15 pulse: there and back (a GPU reaction on a piece)
        K = o.blur && def.kind !== 'quad' ? 4 : 1;
      const t0 = performance.now() + (Number(o.delay) || 0) * 1000; let raf = 0;
      cv.style.display = ''; if (o.onStart) o.onStart();
      const draw = now => {
        const lin = Math.max(0, Math.min(1, (now - t0) / dur)), pr = ramp(lin), pp = o.dir === 'in' ? 1 - pr : pr;
        if (st.ctx && st.ctx.lost) { cv.style.display = 'none'; return done(false); }
        use(st); gl.enable(gl.BLEND); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex);
        if (K === 1) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); frame(st, def, o, pp, now / 1000); }
        else {               // motion blur: a few moments just before this one, blended together
          const F = blurTarget(st), A = prog(st, 'acc', QV, ACC);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          for (let k = 0; k < K; k++) {
            const sub = Math.max(0, lin - k * .012), sp = ramp(sub), spp = o.dir === 'in' ? 1 - sp : sp;
            gl.bindFramebuffer(gl.FRAMEBUFFER, F.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex); frame(st, def, o, spp, now / 1000);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(A.pr); gl.bindTexture(gl.TEXTURE_2D, F.tex); attr(gl, A, 'aP', st.bufs.quad || (st.bufs.quad = (() => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); return b; })()), 2);
            gl.uniform1i(A.u.uTex, 0); gl.uniform1f(A.u.uK, 1 / K); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
          gl.bindTexture(gl.TEXTURE_2D, st.tex);
        }
        show(st);
        if (o.onFrame) o.onFrame(pp);
        if (lin < 1) raf = RAF(draw);
        else { if (!o.hold) { cv.style.display = 'none'; } done(true); }
      };
      raf = RAF(draw);
    });
  }
  /** a still frame (the editor's previews and the tests) */
  function still(root, o, pp) {
    const def = TR[o.id], W = o.tex.width, H = o.tex.height, st = stage(root, W, H); if (!st || !def) return false;
    const { gl, cv } = st; cv.style.display = ''; use(st);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); if (!st.tex) st.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    frame(st, def, o, pp, 1); show(st); return true;
  }
  const can = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } };
  let canMemo = null;

  /** 1.12.13: let a stage's graphics context go (a piece's own transition is done with it) */
  function release(root) {
    const st = stages.get(root); if (!st) return;
    if (st.shared) {        // a shared context stays: give back just this piece's pictures and buffers
      if (!st.ctx.lost) try { const gl = st.gl; if (st.tex) gl.deleteTexture(st.tex); if (st.fbo) { gl.deleteFramebuffer(st.fbo.fb); gl.deleteTexture(st.fbo.tex); if (st.fbo.rb) gl.deleteRenderbuffer(st.fbo.rb); }
        for (const [k, b] of Object.entries(st.bufs)) if (b && typeof b === 'object') { if (b instanceof WebGLBuffer) gl.deleteBuffer(b); else { if (b.p) gl.deleteBuffer(b.p); if (b.c) gl.deleteBuffer(b.c); } } } catch (e) {}
    } else try { const x = st.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {}
    st.cv.remove(); stages.delete(root);
  }
  window.BeeboFX2 = { capture, play, still, release, warm, TRANSITIONS: TR, RAMPS, ramp: rampFn, get available() { return canMemo === null ? (canMemo = can()) : canMemo; } };
})();
