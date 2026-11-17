/* BeeboScore (developed by Beebo) — player pictures and clips (Testbuild 1.11).
 *
 * A player's own picture can be a PNG / WebP / JPG, an animated GIF, or a short WebM / MP4 clip. BeeboKey.media() puts the
 * right element in a box; a clip filmed on a green (or any flat-colour) screen is keyed: drawn through a small WebGL shader
 * that takes the screen colour out and pulls the green spill off the edges. Without WebGL it falls back to a 2D canvas
 * (fine for the small sizes these are shown at). A clip only plays, and is only keyed, while it is on screen.
 *
 * BeeboKey.detect(file) looks at the edges of a clip's first frame and returns the screen colour ('#rrggbb') or '' — the
 * panel calls it when a clip is dropped in, so green screens are taken out on their own.
 */
(() => {
  'use strict';
  if (window.BeeboKey) return;
  const isVideo = src => /^data:video\/|\.(webm|mp4|mov|m4v)(\?|#|$)/i.test(String(src || ''));
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const potato = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;

  // ------------------------------------------------------------------------------------------- the keyer
  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  // distance in colour (CbCr) from the screen colour: inside `tol` is gone, a soft edge after it; green spill pulled back
  const FS = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec3 k;uniform float tol,soft;
    vec2 cc(vec3 c){return vec2(-.169*c.r-.331*c.g+.5*c.b,.5*c.r-.419*c.g-.081*c.b);}
    void main(){vec4 c=texture2D(t,uv);float d=distance(cc(c.rgb),cc(k));float a=smoothstep(tol,tol+soft,d);
      vec3 o=c.rgb;float gk=k.g-max(k.r,k.b);if(gk>.1){float m=max(o.r,o.b);o.g=min(o.g,m+.02);}
      gl_FragColor=vec4(o*a,a);}`;
  function glKeyer(cv) {
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const u = n => gl.getUniformLocation(pr, n);
    return { draw(video, key, tol, soft) {
      if (cv.width !== video.videoWidth || cv.height !== video.videoHeight) { cv.width = video.videoWidth; cv.height = video.videoHeight; }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform3f(u('k'), key[0], key[1], key[2]); gl.uniform1f(u('tol'), tol); gl.uniform1f(u('soft'), soft);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }, lose() { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } };
  }
  function cpuKeyer(cv) {                                    // no WebGL: the same maths on a small 2D canvas
    const g = cv.getContext('2d', { willReadFrequently: true });
    const cc = (r, gg, b) => [-.169 * r - .331 * gg + .5 * b, .5 * r - .419 * gg - .081 * b];
    return { draw(video, key, tol, soft) {
      const s = Math.min(1, 160 / Math.max(1, video.videoWidth)), w = Math.max(1, Math.round(video.videoWidth * s)), h = Math.max(1, Math.round(video.videoHeight * s));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      g.drawImage(video, 0, 0, w, h); const im = g.getImageData(0, 0, w, h), d = im.data, kc = cc(...key), gk = key[1] - Math.max(key[0], key[2]) > .1;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, c = cc(r, gg, b), dist = Math.hypot(c[0] - kc[0], c[1] - kc[1]);
        const x = Math.max(0, Math.min(1, (dist - tol) / soft)), a = x * x * (3 - 2 * x);
        if (gk) d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]) + 5);
        d[i + 3] = a * 255;
      }
      g.putImageData(im, 0, 0);
    }, lose() {} };
  }

  // ------------------------------------------------------------------------------------------- an element for a picture
  const live = new Set();
  function media(box, src, key, o = {}) {
    for (const n of [...box.querySelectorAll('.bk-media')]) { if (n.__bk) n.__bk.stop(); n.remove(); }
    if (!src) return null;
    const fit = o.fit || 'cover', style = `position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};display:block`;
    if (!isVideo(src)) { const im = document.createElement('img'); im.className = 'bk-media'; im.alt = ''; im.src = src; im.style.cssText = style; box.appendChild(im); return im; }
    const v = document.createElement('video'); v.className = 'bk-media'; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !potato(); v.preload = 'auto'; v.src = src; v.setAttribute('muted', '');
    const k = hex(key);
    if (!k) { v.style.cssText = style; box.appendChild(v); if (potato()) v.addEventListener('loadeddata', () => v.pause(), { once: true }); return v; }
    // keyed: the clip plays hidden, a canvas shows it with the screen taken out
    const cv = document.createElement('canvas'); cv.className = 'bk-media bk-keyed'; cv.style.cssText = style;
    v.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
    box.appendChild(cv); box.appendChild(v);
    let ker = null, raf = 0, stopped = false;
    const tol = o.tol ?? .085, soft = o.soft ?? .07;
    const onScreen = () => cv.isConnected && cv.offsetParent !== null && cv.getClientRects().length > 0;
    const frame = () => {
      if (stopped) return;
      if (!cv.isConnected) { stop(); return; }
      if (v.readyState >= 2 && onScreen()) { if (v.paused && !potato()) v.play().catch(() => {}); try { if (!ker) ker = glKeyer(cv) || cpuKeyer(cv); ker.draw(v, k, tol, soft); } catch (e) {} }
      else if (!v.paused && !onScreen()) v.pause();
      if (potato()) { raf = setTimeout(frame, 500); return; }           // Ultra-light: a still, refreshed now and then
      if (v.requestVideoFrameCallback && !v.paused) v.requestVideoFrameCallback(frame); else raf = requestAnimationFrame(frame);
    };
    const stop = () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(raf); try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} if (ker) ker.lose(); live.delete(cv); };
    cv.__bk = { stop }; live.add(cv);
    v.addEventListener('loadeddata', frame, { once: true });
    return cv;
  }

  // ------------------------------------------------------------------------------------------- is it a green screen?
  // samples the outer edge of the first frame (a little in, so a letterbox doesn't count); when most of it is one bright,
  // saturated colour, that colour is the screen
  function detect(fileOrUrl) {
    return new Promise(res => {
      const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl), v = document.createElement('video');
      let done = false; const end = c => { if (done) return; done = true; if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url); res(c || ''); };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.addEventListener('error', () => end(''));
      v.addEventListener('loadeddata', () => { try { v.currentTime = Math.min(.1, (v.duration || 1) / 4); } catch (e) { end(''); } }, { once: true });
      v.addEventListener('seeked', () => {
        try {
          const W = 64, H = Math.max(8, Math.round(64 * v.videoHeight / Math.max(1, v.videoWidth))), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
          const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(v, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
          const px = []; const at = (x, y) => { const i = (y * W + x) * 4; px.push([d[i], d[i + 1], d[i + 2]]); };
          for (let x = 2; x < W - 2; x++) { at(x, 2); at(x, H - 3); } for (let y = 2; y < H - 2; y++) { at(2, y); at(W - 3, y); }
          const screenish = ([r, gg, b]) => { const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); return mx > 70 && mx - mn > 60; };
          const green = px.filter(([r, gg, b]) => gg > r * 1.25 && gg > b * 1.25 && screenish([r, gg, b])), blue = px.filter(([r, gg, b]) => b > r * 1.3 && b > gg * 1.15 && screenish([r, gg, b]));
          const pick = green.length >= px.length * .55 ? green : blue.length >= px.length * .55 ? blue : null;
          if (!pick) return end('');
          const avg = [0, 1, 2].map(i => Math.round(pick.reduce((s, p) => s + p[i], 0) / pick.length));
          end('#' + avg.map(n => n.toString(16).padStart(2, '0')).join(''));
        } catch (e) { end(''); }
      }, { once: true });
      setTimeout(() => end(''), 6000);
    });
  }

  window.BeeboKey = { media, detect, isVideo };
})();
