/* BeeboScore (developed by Beebo) — the commentary screen (Testbuild 1.12.6).
 *
 * state.splash.show === 'comm' with state.comm = { count 1–4, title, match, people: [{ name, handle, mode: 'link' | 'cutout', live }] }.
 * Each commentator's camera is either
 *   • 'link'   — the built-in camera link: their webcam arrives here over WebRTC (peer to peer, encrypted, no buffering), or
 *   • 'cutout' — a see-through window in the frame: put your own camera source (a capture card, VDO.Ninja…) under the overlay
 *                in OBS at the position the app shows.
 * The screen fits itself to how many commentators there are, in the layout's own look (Obsidian Glass, Porcelain, Default).
 * Everything that moves is transform / opacity.
 */
(() => {
  'use strict';
  if (window.__SB_COMM) return; window.__SB_COMM = true;
  // 1.12.9: /commentary (= /overlay?only=comm) — the commentary screen as its own OBS browser source, for its own scene: it's
  // always on there, nothing else of the layout shows, and the app switches OBS to that scene when you show it
  const ONLY = new URLSearchParams(location.search).get('only') === 'comm';
  if (ONLY) { document.documentElement.classList.add('sb-comm-only'); const st0 = document.createElement('style'); st0.textContent = 'html.sb-comm-only body>*:not(#sbc){visibility:hidden!important}html.sb-comm-only,html.sb-comm-only body{background:transparent!important}'; document.head.appendChild(st0); }
  const W = 1920, H = 1080;
  const LOOK = String(((document.querySelector('meta[name="sb-look"]') || {}).content || 'shattered')).toLowerCase();
  const TH = LOOK === 'porcelain'
    ? { bg: 'linear-gradient(180deg,#fbf8f1,#efe6d2 60%,#e2d3ac)', panel: 'linear-gradient(180deg,#ffffff,#f3ecdc)', edge: '#141210', acc: '#c9a13b', acc2: '#141210', ink: '#141210', name: '#b0841f', sub: '#5a4a2a', hole: 'rgba(20,18,16,.9)', font: "'Saira Condensed',sans-serif", ui: "'Chakra Petch',sans-serif", dark: false,
        plate: 'linear-gradient(180deg,#ffffff,#f7f6f3 55%,#e9e7e2)', ring: '#0b0b0d', nameFill: 'linear-gradient(180deg,#d9b54a 0%,#b8901f 55%,#7a5c0e 100%)', clip: 'polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)', r: '0' }
    : LOOK === 'default'
      // 1.12.13: the panel's own Classic colours (gold, 1P red, 2P blue, slate) and Beebo Classic
      ? { bg: 'linear-gradient(180deg,#10121a,#0a0b10)', panel: 'linear-gradient(180deg,#1c2030,#151822)', edge: '#333a50', acc: '#e9c35e', acc2: '#3b8eff', ink: '#eef1f7', name: '#eef1f7', sub: '#8b93a7', hole: 'rgba(238,241,247,.7)', font: "'Beebo Classic','Segoe UI',system-ui,sans-serif", ui: "'Beebo Classic','Segoe UI',system-ui,sans-serif", dark: true, plain: true,
          plate: 'linear-gradient(180deg,#1c2030,#151822)', ring: '#2c3446', nameFill: '', clip: 'none', r: '10px' }
      : { bg: 'radial-gradient(ellipse at 20% 0%,#3a2a0c 0,transparent 60%),radial-gradient(ellipse at 90% 100%,#2a1d08 0,transparent 55%),linear-gradient(180deg,#14100a,#070605)', panel: 'linear-gradient(180deg,rgba(44,34,14,.92),rgba(13,11,7,.94))', edge: '#e0a93b', acc: '#e0a93b', acc2: '#f6dc96', ink: '#ffffff', name: '#ffffff', sub: '#f2d79a', hole: 'rgba(224,169,59,.9)', font: "'Saira Condensed',sans-serif", ui: "'Chakra Petch',sans-serif", dark: true,
          plate: 'linear-gradient(180deg,#38342b 0%,#1b1913 44%,#0b0a08 80%,#030304)', ring: 'rgba(224,169,59,.55)', nameFill: 'linear-gradient(180deg,#fff 0%,#f3ede0 40%,#ab9f84 52%,#ebe3cf 76%,#fff 100%)', clip: 'polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)', r: '0' };
  /** where everything goes for 1–4 commentators (the app shows the same numbers for cutouts) */
  function boxes(n) {
    if (n <= 1) return [{ x: 408, y: 150, w: 1104, h: 621 }];
    if (n === 2) return [{ x: 70, y: 230, w: 870, h: 489 }, { x: 980, y: 230, w: 870, h: 489 }];
    if (n === 3) return [0, 1, 2].map(i => ({ x: 60 + i * 612, y: 290, w: 576, h: 324 }));
    return [0, 1, 2, 3].map(i => ({ x: i % 2 ? 980 : 300, y: i < 2 ? 150 : 590, w: 640, h: 360 }));
  }
  window.__SB_COMM_BOXES = boxes;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const css = `
#sbc{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9500;pointer-events:none;display:none;color:${TH.ink};font-family:${TH.ui}}
#sbc.on{display:block}
#sbc .bg{position:absolute;inset:0;background:${TH.bg}}
#sbc .bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 120px,${TH.dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.03)'} 120px 122px)}
#sbc .hd{position:absolute;left:0;right:0;top:56px;text-align:center}
#sbc .hd small{display:block;font:700 15px/1 ${TH.ui};letter-spacing:6px;color:${TH.sub};text-transform:uppercase}
#sbc .hd b{display:block;margin-top:8px;font:800 54px/1 ${TH.font};${TH.plain ? '' : 'font-style:italic;'}letter-spacing:4px;text-transform:uppercase;color:${TH.ink}}
#sbc .hd i{display:block;width:180px;height:3px;margin:12px auto 0;background:linear-gradient(90deg,transparent,${TH.acc},${TH.acc2},transparent)}
#sbc .slot{position:absolute;will-change:transform,opacity}
#sbc .fr{position:absolute;inset:0;border-radius:${TH.plain ? 6 : 4}px;overflow:hidden;background:${TH.panel};box-shadow:0 0 0 3px ${TH.edge},0 22px 50px rgba(0,0,0,${TH.dark ? .55 : .25})}
#sbc .fr video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s}
#sbc .fr video.on{opacity:1}
#sbc .fr .wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font:700 18px/1 ${TH.ui};letter-spacing:4px;color:${TH.sub};text-transform:uppercase}
#sbc .fr .wait b{font:800 120px/1 ${TH.font};${TH.plain ? '' : 'font-style:italic;'}color:${TH.acc};opacity:.35}
#sbc .fr .sh{position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.14) 50%,transparent);transform:translateX(-120%);animation:sbc-sh 7s ease-in-out infinite;will-change:transform}
#sbc .slot:nth-child(2n) .fr .sh{animation-delay:-3.5s}
@keyframes sbc-sh{0%,55%{transform:translateX(-120%)}100%{transform:translateX(420%)}}
/* a cutout: see-through inside, so the camera source under the overlay shows; a thin edge marks it */
#sbc .slot.cut .fr{background:none;box-shadow:0 0 0 3px ${TH.edge},0 0 0 9999px transparent}
#sbc .slot.cut .fr .sh,#sbc .slot.cut .fr .wait{display:none}
#sbc .pl{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px}
/* 1.12.9: the name plate is made like the layout's player bars — the same plate, outline and slanted ends, the same lettering */
#sbc .pl .np{position:relative;max-width:100%;min-width:56%;height:var(--nph,64px);display:flex;align-items:center;justify-content:center;padding:0 34px;background:${TH.plate};box-shadow:inset 0 0 0 2px ${TH.ring},inset 0 1px 0 rgba(255,255,255,.14),0 10px 26px rgba(0,0,0,${TH.dark ? .5 : .2});clip-path:${TH.clip};border-radius:${TH.r};box-sizing:border-box}
#sbc .pl .np::after{content:'';position:absolute;left:18%;right:18%;bottom:0;height:3px;background:linear-gradient(90deg,transparent,${TH.acc},${TH.acc2},transparent)}
#sbc .pl b{display:block;max-width:100%;font:800 36px/1.2 ${TH.font};${TH.plain ? '' : 'font-style:italic;'}letter-spacing:1px;text-transform:uppercase;white-space:nowrap;overflow:hidden;padding:0 .16em 0 .06em;${TH.nameFill ? `background:${TH.nameFill};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;` : `color:${TH.name};`}}
#sbc .pl small{font:700 15px/1 ${TH.ui};letter-spacing:3px;color:${TH.sub}}
/* 1.12.11: who's talking — their frame lights up and a name tag slides in over their camera */
#sbc .fr .lt{position:absolute;left:18px;bottom:18px;max-width:calc(100% - 36px);display:flex;align-items:center;gap:14px;padding:10px 26px 10px 20px;box-sizing:border-box;background:${TH.plate};box-shadow:inset 0 0 0 2px ${TH.ring},0 10px 24px rgba(0,0,0,.45);clip-path:${TH.clip};border-radius:${TH.r};transform:translateX(-40px);opacity:0;transition:transform .35s cubic-bezier(.2,.8,.3,1),opacity .3s;will-change:transform,opacity}
#sbc .fr .lt span{display:flex;flex-direction:column;gap:4px;min-width:0}
#sbc .fr .lt b{font:800 var(--ltf,28px)/1.1 ${TH.font};${TH.plain ? '' : 'font-style:italic;'}text-transform:uppercase;white-space:nowrap;overflow:hidden;padding:0 .16em 0 .06em;${TH.nameFill ? `background:${TH.nameFill};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;` : `color:${TH.name};`}}
#sbc .fr .lt small{font:700 13px/1 ${TH.ui};letter-spacing:3px;color:${TH.sub};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbc .fr .lt i{display:flex;align-items:flex-end;gap:3px;height:22px;flex:none}
#sbc .fr .lt i em{display:block;width:4px;height:100%;border-radius:2px;background:${TH.acc};transform-origin:50% 100%;transform:scaleY(.3)}
#sbc .slot.talk .fr .lt i em{animation:sbc-eq .9s ease-in-out infinite}   /* 1.12.12: the level bars move only while that person talks */
#sbc .slot.talk .fr .lt i em:nth-child(2){animation-delay:-.3s}#sbc .slot.talk .fr .lt i em:nth-child(3){animation-delay:-.6s}
@keyframes sbc-eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
#sbc .slot.talk .fr .lt{transform:none;opacity:1}
#sbc .slot .fr{transition:box-shadow .3s}
#sbc .slot.talk .fr{box-shadow:0 0 0 3px ${TH.acc},0 0 34px ${TH.acc}88,0 22px 50px rgba(0,0,0,${TH.dark ? .55 : .25})}
#sbc .slot.talk .pl .np{box-shadow:inset 0 0 0 2px ${TH.acc},inset 0 1px 0 rgba(255,255,255,.14),0 0 22px ${TH.acc}66}
#sbc .live{position:absolute;right:12px;top:12px;padding:5px 10px 4px;border-radius:3px;background:#e2283f;color:#fff;font:700 12px/1 ${TH.ui};letter-spacing:2px;opacity:0;transition:opacity .4s}
#sbc .slot.has .live{opacity:1}
#sbc .mt{position:absolute;left:50%;bottom:46px;transform:translateX(-50%);display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;column-gap:26px;width:min(1180px,86%);height:68px;padding:0 44px;box-sizing:border-box;background:${TH.plate};box-shadow:inset 0 0 0 2px ${TH.ring},inset 0 1px 0 rgba(255,255,255,.14),0 10px 26px rgba(0,0,0,${TH.dark ? .5 : .2});clip-path:${TH.clip};border-radius:${TH.r}}
#sbc .mt span{min-width:0;font:800 34px/1.2 ${TH.font};${TH.plain ? '' : 'font-style:italic;'}text-transform:uppercase;white-space:nowrap;overflow:hidden;padding:0 .16em 0 .06em;${TH.nameFill ? `background:${TH.nameFill};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;` : `color:${TH.name};`}}
#sbc .mt span.a{text-align:right}#sbc .mt span.b{text-align:left}
#sbc .mt em{font:800 40px/1 ${TH.font};font-style:normal;color:${TH.acc};white-space:nowrap}
#sbc .mt small{position:absolute;left:0;right:0;top:-24px;text-align:center;font:700 13px/1 ${TH.ui};letter-spacing:4px;color:${TH.sub}}
.sb-potato #sbc *{animation:none!important;transition:none!important}
`;
  const st = document.createElement('style'); st.textContent = (window.SBColours && window.SBColours.on ? window.SBColours.map(css) : css); document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'sbc'; document.body.appendChild(root);
  const potato = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;

  // ------------------------------------------------------------------ the cameras (WebRTC, receive only)
  let ws = null, me = '', ice = [], live = {}, want = new Set(), wsT = 0, closeT = 0, talk = {};
  const pcs = new Map();      // slot → RTCPeerConnection
  function sock() {
    if (ws) return;
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?camview=1');
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m.type, m.data || {}); };
    ws.onclose = () => { ws = null; for (const k of [...pcs.keys()]) drop(k); if (want.size) { clearTimeout(wsT); wsT = setTimeout(sock, 2000); } };
  }
  const send = m => { try { ws && ws.readyState === 1 && ws.send(JSON.stringify(m)); } catch {} };
  let relayOn = {};
  function onMsg(type, d) {
    if (type === 'cam-hello') { me = d.id; ice = d.ice || []; live = d.slots || {}; relayOn = d.relay || {}; talk = d.talk || {}; paintTalk(); for (const k of want) if (live[k]) ask(k); return; }
    if (type === 'cams') { live = d.slots || {}; relayOn = d.relay || {}; talk = d.talk || {}; paintTalk(); for (const k of want) { if (live[k] && !pcs.has(k) && !relays[k]) ask(k); if (!live[k]) { if (pcs.has(k)) drop(k); relayDrop(k); } } paintLive(); return; }
    if (type === 'cam-sig') answer(d.slot, d.sig || {});
    if (type === 'cam-chunk') relayChunk(d);
  }
  // 1.12.9: the direct connection gets ~9 s to come up; if it doesn't (or the camera page is already sending through the
  // app), the picture comes through BeeboScore instead — a little behind, but it always arrives
  const askT = {};
  function ask(slot) {
    if (pcs.has(slot) || relays[slot]) return;
    if (relayOn[slot]) return wantRelay(slot);
    send({ type: 'want', slot });
    clearTimeout(askT[slot]); askT[slot] = setTimeout(() => { const pc = pcs.get(slot); if (want.has(slot) && live[slot] && !(pc && pc.connectionState === 'connected')) wantRelay(slot); }, 9000);
  }
  function wantRelay(slot) { if (relays[slot] && relays[slot].ok) return; send({ type: 'want-relay', slot }); }
  // ---- the relay: pieces of WebM / MP4 into a MediaSource, kept close to live
  const relays = {}; window.__sbcRelays = relays;      // (the tests look at it)
  function relayDrop(slot) { const r = relays[slot]; if (!r) return; delete relays[slot]; try { if (r.url) URL.revokeObjectURL(r.url); } catch {} const v = root.querySelector(`.slot[data-s="${slot}"] video`); if (v && v.dataset.relay) { v.classList.remove('on'); v.removeAttribute('src'); delete v.dataset.relay; try { v.load(); } catch {} } paintLive(); }
  function relayChunk(d) {
    const slot = Number(d.slot); if (!want.has(slot)) return;
    const pc = pcs.get(slot); if (pc && pc.connectionState === 'connected') return;              // the direct picture is already here
    let r = relays[slot];
    if (d.first) {
      if (r && r.sess === d.sess && !d.stale) return;
      relayDrop(slot); if (pc) { try { pc.close(); } catch {} pcs.delete(slot); }
      if (!window.MediaSource || !MediaSource.isTypeSupported(d.mime)) { console.warn('camera relay: this browser can’t play', d.mime); return; }
      const v = root.querySelector(`.slot[data-s="${slot}"] video`); if (!v) return;
      const ms = new MediaSource(); r = relays[slot] = { sess: d.sess, ms, sb: null, q: [], ok: false, url: URL.createObjectURL(ms) };
      v.srcObject = null; v.dataset.relay = '1'; v.src = r.url;
      ms.addEventListener('sourceopen', () => { try { r.sb = ms.addSourceBuffer(d.mime); r.sb.mode = 'sequence'; r.sb.addEventListener('updateend', () => pump(slot)); pump(slot); } catch (e) { console.warn('camera relay:', e.message); } }, { once: true });
      v.onloadeddata = () => { v.classList.add('on'); r.ok = true; paintLive(); v.play().catch(() => {}); };
    }
    if (!r || r.sess !== d.sess) return;
    const bin = atob(d.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    r.q.push(u); if (r.q.length > 40) r.q.splice(1, r.q.length - 20);
    pump(slot);
  }
  // 1.12.12: the buffer is trimmed to the last 30 seconds every 10 seconds (it used to fill up on long streams), and a piece
  // that doesn't fit is kept and tried again once room is made, instead of being thrown away (which froze the picture)
  function pump(slot) {
    const r = relays[slot]; if (!r || !r.sb || r.sb.updating) return;
    const v = root.querySelector(`.slot[data-s="${slot}"] video`), now = Date.now();
    if (v && now - (r.trimAt || 0) > 10000) {
      r.trimAt = now;
      try { const b = r.sb.buffered; if (b.length && v.currentTime - b.start(0) > 30) { r.trims = (r.trims || 0) + 1; r.sb.remove(0, v.currentTime - 30); return; } } catch {}     // updateend → pump again
    }
    if (!r.q.length) return;
    try { r.sb.appendBuffer(r.q[0]); r.q.shift(); }
    catch (e) { if (e.name === 'QuotaExceededError') { r.full = (r.full || 0) + 1; try { if (v && v.currentTime > 2) { r.sb.remove(0, Math.max(.1, v.currentTime - 2)); return; } } catch {} } r.q.shift(); }   // anything else: that piece can't be used

    if (v && v.buffered.length) { const end = v.buffered.end(v.buffered.length - 1); if (end - v.currentTime > 1.1) v.currentTime = Math.max(0, end - .3); if (v.paused) v.play().catch(() => {}); }   // stay close to live
  }
  function drop(slot) { const pc = pcs.get(slot); if (pc) { try { pc.close(); } catch {} pcs.delete(slot); } const v = root.querySelector(`.slot[data-s="${slot}"] video`); if (v) { v.classList.remove('on'); v.srcObject = null; } paintLive(); }
  async function answer(slot, sig) {
    let pc = pcs.get(slot);
    if (sig.sdp && sig.sdp.type === 'offer') {
      if (pc) { try { pc.close(); } catch {} }
      pc = new RTCPeerConnection({ iceServers: ice, bundlePolicy: 'max-bundle' }); pcs.set(slot, pc);
      pc.onicecandidate = e => { if (e.candidate) send({ type: 'sig', slot, data: { cand: e.candidate } }); };
      pc.ontrack = e => {
        // as little delay as the browser allows: no extra jitter buffer
        try { e.receiver.jitterBufferTarget = 0; } catch {} try { e.receiver.playoutDelayHint = 0; } catch {}
        const v = root.querySelector(`.slot[data-s="${slot}"] video`); if (!v) return;
        if (v.dataset.relay) { relayDrop(slot); }
        if (v.srcObject !== e.streams[0]) { v.srcObject = e.streams[0]; v.play().catch(() => {}); }
        v.onloadeddata = () => { v.classList.add('on'); paintLive(); };
      };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { drop(slot); setTimeout(() => want.has(slot) && live[slot] && ask(slot), 1500); } };
      try { await pc.setRemoteDescription(sig.sdp); const a = await pc.createAnswer(); await pc.setLocalDescription(a); send({ type: 'sig', slot, data: { sdp: pc.localDescription } }); } catch (e) { console.warn('camera link:', e.message); }
    } else if (sig.cand && pc) { try { await pc.addIceCandidate(sig.cand); } catch {} }
  }
  function paintTalk() { root.querySelectorAll('.slot').forEach(s => s.classList.toggle('talk', !!talk[s.dataset.s] && !s.classList.contains('cut'))); }
  function paintLive() { root.querySelectorAll('.slot').forEach(s => { const v = s.querySelector('video'); s.classList.toggle('has', !!(v && v.classList.contains('on'))); }); }
  function wantSlots(list) {
    want = new Set(list); clearTimeout(closeT);
    for (const k of [...pcs.keys()]) if (!want.has(k)) { send({ type: 'bye', slot: k }); drop(k); }
    for (const k of Object.keys(relays).map(Number)) if (!want.has(k)) relayDrop(k);
    if (want.size) { sock(); if (ws && ws.readyState === 1 && me) for (const k of want) if (live[k]) ask(k); }
    // nothing wanted for a minute: the connection to the app closes (a quick show / hide doesn't reconnect)
    else closeT = setTimeout(() => { if (!want.size && ws) { try { ws.close(); } catch {} ws = null; } }, 60000);
  }

  // ------------------------------------------------------------------ the screen
  let on = false, key = '', lastFit = '';
  function html(c, s) {
    const n = Math.max(1, Math.min(4, c.count || 2)), B = boxes(n), ppl = (c.people || []).slice(0, n);
    const slots = ppl.map((p, i) => {
      const b = B[i], cut = p.mode === 'cutout', plH = n >= 4 ? 64 : n === 3 ? 80 : 96;
      return `<div class="slot${cut ? ' cut' : ''}" data-s="${i + 1}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h + plH}px">
        <div class="fr" style="height:${b.h}px">${cut ? '' : `<video muted autoplay playsinline></video><div class="wait"><b>${esc(String(p.name || 'C' + (i + 1)).trim().charAt(0).toUpperCase())}</b>${p.live ? 'CONNECTING…' : 'CAMERA OFF'}</div><i class="sh"></i><span class="live">LIVE</span>${c.talk !== false ? `<div class="lt" style="--ltf:${n >= 3 ? 22 : 28}px"><i><em></em><em></em><em></em></i><span><b class="sbc-nm" data-fs="${n >= 3 ? 22 : 28}">${esc(p.name || `Commentator ${i + 1}`)}</b>${p.handle ? `<small>${esc(p.handle)}</small>` : ''}</span></div>` : ''}`}</div>
        <div class="pl" style="top:${b.h + 14}px;--nph:${n >= 3 ? 52 : 64}px"><div class="np"><b class="sbc-nm" data-fs="${n >= 3 ? 28 : 36}">${esc(p.name || `Commentator ${i + 1}`)}</b></div>${p.handle ? `<small>${esc(p.handle)}</small>` : ''}</div></div>`;
    }).join('');
    const p1 = s.p1 || {}, p2 = s.p2 || {}, showMatch = c.match !== false && n < 4 && (p1.name || p2.name);
    const mt = showMatch ? `<div class="mt"><small>${esc(s.round || 'NOW PLAYING')}</small><span class="a sbc-nm">${esc(p1.name || 'Player 1')}</span><em>${Number(p1.score) || 0} – ${Number(p2.score) || 0}</em><span class="b sbc-nm">${esc(p2.name || 'Player 2')}</span></div>` : '';
    // cutouts: holes right through the background, so the camera sources under the overlay in OBS show
    const holes = ppl.map((p, i) => (p.mode === 'cutout' ? B[i] : null)).filter(Boolean);
    const mask = holes.length ? (() => { const d = `M0 0H${W}V${H}H0Z` + holes.map(h => `M${h.x} ${h.y}h${h.w}v${h.h}h${-h.w}Z`).join(''); return `clip-path:path(evenodd,'${d}')`; })() : '';
    return `<div class="bg" style="${mask}"></div><div class="hd"><small>${esc(s.title || s.event || '')}</small><b>${esc(c.title || 'Commentary')}</b><i></i></div>${slots}${mt}`;
  }
  // every name fits whole (1.12.9: no cut-off letters, no "…"): smaller until the whole name is inside its plate
  function fit() {
    root.querySelectorAll('.sbc-nm').forEach(b => {
      b.style.fontSize = b.dataset.fs ? b.dataset.fs + 'px' : ''; let f = parseFloat(getComputedStyle(b).fontSize) || 30; const min = Math.max(12, f * .45);
      const over = () => { const r = document.createRange(); r.selectNodeContents(b); return b.scrollWidth > b.clientWidth || r.getBoundingClientRect().width > b.getBoundingClientRect().width + .05; };
      while (over() && f > min) { f -= 1; b.style.fontSize = f + 'px'; }
    });
  }
  function show(c, s) {
    const k = JSON.stringify([c.count, c.title, c.match, c.talk, (c.people || []).map(p => [p.name, p.handle, p.mode, p.live]), s.title, s.round, s.p1 && s.p1.name, s.p2 && s.p2.name, s.p1 && s.p1.score, s.p2 && s.p2.score]);
    const first = !on; on = true;
    if (k !== key) {
      // keep the videos that are already playing (a name or score change mustn't blink the cameras)
      const keep = {}; root.querySelectorAll('.slot').forEach(x => { const v = x.querySelector('video'); if (v && (v.srcObject || v.dataset.relay)) keep[x.dataset.s] = v; });
      key = k; root.innerHTML = html(c, s);
      root.querySelectorAll('.slot').forEach(x => { const v = keep[x.dataset.s], nv = x.querySelector('video'); if (v && nv) { nv.replaceWith(v); } });
      paintLive(); paintTalk();
    }
    root.className = 'on'; document.documentElement.classList.add('sb-comm-on');
    if (k !== lastFit) { lastFit = k; fit(); }
    const n = Math.max(1, Math.min(4, c.count || 2));
    wantSlots((c.people || []).slice(0, n).map((p, i) => (p.mode !== 'cutout' ? i + 1 : 0)).filter(Boolean));
    if (first && !potato()) {
      root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      const hd = root.querySelector('.hd'); if (hd) hd.animate([{ opacity: 0, transform: 'translateY(-26px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
      root.querySelectorAll('.slot').forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(40px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 200 + i * 110, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
      const mt = root.querySelector('.mt'); if (mt) mt.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(30px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 480, delay: 520, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    }
  }
  function hide() {
    if (!on) return; on = false; wantSlots([]); document.documentElement.classList.remove('sb-comm-on'); lastFit = '';
    if (potato()) { root.className = ''; return; }
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).onfinish = () => { if (!on) { root.className = ''; root.getAnimations().forEach(a => a.cancel()); } };
  }
  window.addEventListener('scoreboard', e => {
    const s = e.detail || {};
    if (ONLY) { if (s.comm) show(s.comm, s); else hide(); return; }
    if (s.splash && s.splash.show === 'comm' && s.comm && s.comm.where !== 'scene' && !s.hidden) show(s.comm, s); else hide();
  });
})();
