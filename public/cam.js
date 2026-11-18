/* BeeboScore (developed by Beebo) — a commentator's camera page (/cam/<link>), Testbuild 1.12.6 (relay: 1.12.9).
 * The camera goes peer to peer (WebRTC) to each commentary screen that asks for it; BeeboScore only passes the messages that
 * connect them. Low delay: no buffering on purpose, the frame rate is kept when the network is tight, and the bitrate is set
 * high enough for a sharp face.
 * 1.12.9 — the relay: when the live connection to the app can't be opened (some tunnels and networks block it) or the direct
 * connection to the screen doesn't come up (strict NAT, phone carriers), the camera is recorded in short pieces and sent to
 * the app over plain web requests — the same way this page itself loaded — and the app hands them to the screen. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const token = decodeURIComponent(location.pathname.split('/')[2] || '');
  const QUAL = { '720': { w: 1280, h: 720, fps: 30, br: 3500000 }, '1080': { w: 1920, h: 1080, fps: 30, br: 6000000 }, '720p60': { w: 1280, h: 720, fps: 60, br: 5000000 } };
  let stream = null, ws = null, live = false, ice = [{ urls: ['stun:stun.l.google.com:19302'] }], retry = 0, hello = false, helloT = 0, wsDead = false;
  const peers = new Map();      // screen id → RTCPeerConnection
  const say = t => { $('st').innerHTML = t; };
  const err = t => { const m = $('msg'); m.hidden = !t; m.textContent = t || ''; };
  try { const q = localStorage.getItem('bs-cam-q'); if (q && QUAL[q]) $('q').value = q; } catch {}

  async function getCam() {
    const q = QUAL[$('q').value] || QUAL['720'], id = $('cams').value;
    if (stream) stream.getTracks().forEach(t => t.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined, width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: q.fps, max: q.fps } }, audio: $('mic').checked ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false });
    } catch (e) {
      if (!window.isSecureContext) err('Browsers only allow the camera on a secure page. Ask the host for the online link (it starts with https://).');
      else err(e && e.name === 'NotAllowedError' ? 'The camera was blocked. Allow it in the address bar, then reload this page.' : 'No camera could be opened: ' + (e && e.message || e));
      $('go').disabled = true; return false;
    }
    err('');
    const vt = stream.getVideoTracks()[0]; if (vt) try { vt.contentHint = 'motion'; } catch {}
    $('v').srcObject = stream; $('go').disabled = false;
    const s = vt && vt.getSettings ? vt.getSettings() : {}; say(live ? liveText() : `Ready: <b>${s.width || '?'} × ${s.height || '?'}</b> at ${Math.round(s.frameRate || 0) || '?'} fps. Press <b>Go live</b> when the host asks.`);
    // the tracks changed: every screen gets the new ones
    for (const pc of peers.values()) for (const sd of pc.getSenders()) { const t = stream.getTracks().find(x => x.kind === (sd.track && sd.track.kind)); if (t) sd.replaceTrack(t).catch(() => {}); }
    if (R && R.on) relayStart();
    return true;
  }
  async function listCams() {
    try {
      const all = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'), cur = $('cams').value;
      $('cams').innerHTML = all.map((d, i) => `<option value="${d.deviceId}">${(d.label || 'Camera ' + (i + 1)).replace(/[<>&]/g, '')}</option>`).join('');
      if (cur) $('cams').value = cur;
    } catch {}
  }
  const direct = () => [...peers.values()].filter(pc => pc.connectionState === 'connected').length;
  const liveText = () => `<b>Live</b> — ${direct() ? `on ${direct()} ${direct() === 1 ? 'screen' : 'screens'} (direct)` : R.on ? 'sending through BeeboScore (relay)' : 'waiting for the commentary screen to come on'}.`;

  // ---------------------------------------------------------------- the relay (1.12.9)
  const base = '/cam/' + encodeURIComponent(token);
  const R = { on: false, rec: null, sess: '', first: true, chain: Promise.resolve(), backlog: 0, fails: 0 };
  function pickMime() {
    const audio = !!(stream && stream.getAudioTracks().length);
    const list = audio ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'] : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'];
    return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  }
  function relayStart() {
    if (!live || !stream || !window.MediaRecorder) return;
    relayStop(true); R.on = true;
    const q = QUAL[$('q').value] || QUAL['720'], mime = pickMime(); if (!mime) { err('This browser can’t send the camera through BeeboScore. Try Chrome or Edge.'); return; }
    R.sess = Math.random().toString(36).slice(2, 12); R.first = true; R.backlog = 0;
    const sess = R.sess, opt = { mimeType: mime, videoBitsPerSecond: Math.min(q.br, 4000000), audioBitsPerSecond: 96000 };
    try { opt.videoKeyFrameIntervalDuration = 2000; } catch {}
    let rec; try { rec = new MediaRecorder(stream, opt); } catch (e) { try { rec = new MediaRecorder(stream, { mimeType: mime }); } catch (e2) { err('The camera couldn’t be recorded: ' + e2.message); return; } }
    R.rec = rec;
    rec.ondataavailable = ev => {
      if (!ev.data || !ev.data.size || sess !== R.sess) return;
      const first = R.first; R.first = false;
      if (R.backlog > 12 && !first) { relayStart(); return; }          // the network can't keep up: start a fresh piece (smaller wait)
      R.backlog++;
      R.chain = R.chain.then(() => fetch(base + '/chunk', { method: 'POST', body: ev.data, headers: { 'x-sess': sess, 'x-mime': mime.split(';')[0] + (mime.includes('codecs') ? ';' + mime.split(';')[1] : ''), 'x-first': first ? '1' : '0' }, cache: 'no-store' })
        .then(r => { if (r.status === 404) { stop(); err('This camera link was taken back by the host.'); return null; } return r.ok ? r.json() : null; })
        .then(j => { R.fails = 0; if (j && j.restart && sess === R.sess) setTimeout(relayStart, 0); })
        .catch(() => { if (++R.fails > 20 && live) { say('Can’t reach BeeboScore — trying again…'); } })
        .finally(() => { R.backlog--; }));
    };
    rec.start(200);
    say(liveText());
  }
  function relayStop(quiet) { R.on = false; R.sess = ''; if (R.rec) { try { R.rec.stop(); } catch {} R.rec = null; } if (!quiet) say(liveText()); }

  async function viaHttp(why) {        // the live connection can't be opened: hello + relay over plain web requests
    if (!live || R.on) return;
    try { const r = await fetch(base + '/hello', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status === 404 ? 'gone' : 'http ' + r.status); const d = await r.json();
      $('who').textContent = d.name || `Commentator ${d.slot}`; $('tag').textContent = 'LIVE'; $('tag').className = 'tag on'; relayStart();
    } catch (e) { if (e.message === 'gone') { stop(); err('This camera link was taken back by the host.'); } else { say('Can’t reach BeeboScore — trying again…'); setTimeout(() => viaHttp(why), 3000); } }
  }
  function connect() {
    hello = false; clearTimeout(helloT);
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?cam=' + encodeURIComponent(token)); } catch { ws = null; wsDead = true; return viaHttp('no ws'); }
    helloT = setTimeout(() => { if (!hello && live) { wsDead = true; try { ws.close(); } catch {} viaHttp('ws timeout'); } }, 6000);
    ws.onopen = () => { retry = 0; };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m.type, m.data || {}); };
    ws.onclose = () => {
      if (!live) return; for (const pc of peers.values()) pc.close(); peers.clear();
      if (!hello || wsDead) { wsDead = true; return viaHttp('ws closed'); }     // never got through: the relay over web requests
      say(R.on ? liveText() : 'Connection lost — trying again…'); setTimeout(() => live && !wsDead && connect(), Math.min(10000, 800 * 2 ** retry++));
    };
  }
  const send = m => { try { ws && ws.readyState === 1 && ws.send(JSON.stringify(m)); } catch {} };
  async function handle(type, d) {
    if (type === 'cam-relay') { if (d.on) relayStart(); else relayStop(); return; }
    if (type === 'cam-hello') { hello = true; clearTimeout(helloT); if (Array.isArray(d.ice)) ice = d.ice; $('who').textContent = d.name || `Commentator ${d.slot}`; $('tag').textContent = 'LIVE'; $('tag').className = 'tag on'; say(liveText()); return; }
    if (type === 'cam-ended') { stop(); err(d.why || 'The host stopped this camera.'); return; }
    if (type === 'cam-want') return offer(d.from);
    if (type === 'cam-bye') { const pc = peers.get(d.from); if (pc) { pc.close(); peers.delete(d.from); say(liveText()); } return; }
    if (type === 'cam-sig') {
      const pc = peers.get(d.from), sig = d.sig || {}; if (!pc) return;
      try { if (sig.sdp) await pc.setRemoteDescription(sig.sdp); else if (sig.cand) await pc.addIceCandidate(sig.cand); } catch {}
    }
  }
  async function offer(to) {
    if (!stream || !to) return;
    const old = peers.get(to); if (old) old.close();
    const pc = new RTCPeerConnection({ iceServers: ice, bundlePolicy: 'max-bundle' }); peers.set(to, pc);
    const q = QUAL[$('q').value] || QUAL['720'];
    for (const t of stream.getTracks()) {
      const sd = pc.addTrack(t, stream);
      if (t.kind === 'video') {
        // sharp and steady: a high ceiling, and when the network is tight keep the frame rate (drop resolution instead)
        try { const p = sd.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = q.br; p.encodings[0].maxFramerate = q.fps; p.encodings[0].priority = 'high'; p.encodings[0].networkPriority = 'high'; p.degradationPreference = 'maintain-framerate'; sd.setParameters(p).catch(() => {}); } catch {}
      }
    }
    pc.onicecandidate = e => { if (e.candidate) send({ type: 'sig', to, data: { cand: e.candidate } }); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { peers.delete(to); } say(liveText()); };
    const o = await pc.createOffer(); await pc.setLocalDescription(o);
    send({ type: 'sig', to, data: { sdp: pc.localDescription } });
    // the encoding limits again once there's a connection (some browsers only take them then)
    say(liveText());
  }
  // ---------------------------------------------------------------- who's talking (1.12.11)
  // Listens to the microphone here (its own capture: the camera's sound is only sent with "Send my microphone"), works out
  // when the commentator is talking over the room's own noise, and tells BeeboScore "talking" / "quiet" — nothing else.
  const T = { ms: null, ac: null, an: null, on: false, floor: -55, loud: 0, quietAt: 0, sentAt: 0, timer: 0 };
  function talkSend(on) {
    T.sentAt = Date.now();
    if (ws && ws.readyState === 1 && hello) return send({ type: 'talk', on });
    fetch(base + '/talk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on }) }).catch(() => {});
  }
  function talkSet(on) { if (T.on === on) return; T.on = on; $('meter').classList.toggle('on', on); talkSend(on); }
  async function talkStart() {
    talkStop(); if (!$('talk').checked) return;
    try { T.ms = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } }); } catch { return; }
    T.ac = new (window.AudioContext || window.webkitAudioContext)(); if (T.ac.state === 'suspended') T.ac.resume().catch(() => {});
    T.an = T.ac.createAnalyser(); T.an.fftSize = 1024; T.ac.createMediaStreamSource(T.ms).connect(T.an);
    const buf = new Float32Array(T.an.fftSize); $('meter').hidden = false;
    T.timer = setInterval(() => {
      T.an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = 10 * Math.log10(sum / buf.length + 1e-10), now = Date.now();
      T.floor = db < T.floor ? T.floor + (db - T.floor) * .3 : T.floor + (db - T.floor) * .01;        // the room's own noise, followed slowly
      $('meter').firstChild.style.width = Math.max(0, Math.min(100, (db + 70) * 1.6)) + '%';
      // 1.12.12: how loud before it lights up (the slider): 1 (a quiet room: lights up easily) … 5 (a loud venue: only clear speech)
      const sv = SENS[Number($('sens').value) - 1] || SENS[2], at = Math.max(sv[1], T.floor + sv[0]);
      $('meterAt').style.left = Math.max(0, Math.min(98, (at + 70) * 1.6)) + '%';
      const loud = db > at;
      if (loud) { T.loud += 100; T.quietAt = now; } else T.loud = 0;
      if (!live) return talkSet(false);
      if (!T.on && T.loud >= 200) talkSet(true);
      else if (T.on && now - T.quietAt > 900) talkSet(false);
      else if (T.on && now - T.sentAt > 3000) talkSend(true);                                       // still talking
    }, 100);
  }
  const SENS = [[6, -56], [8, -53], [10, -50], [14, -45], [18, -40]];      // [dB over the room's noise, and at least this loud]
  try { const v = localStorage.getItem('bs-cam-sens'); if (v) $('sens').value = v; } catch {}
  $('sens').oninput = () => { try { localStorage.setItem('bs-cam-sens', $('sens').value); } catch {} };
  const sensShow = () => { $('sensRow').hidden = !$('talk').checked; }; sensShow();
  function talkStop() { clearInterval(T.timer); if (T.on) talkSet(false); if (T.ms) T.ms.getTracks().forEach(t => t.stop()); if (T.ac) T.ac.close().catch(() => {}); T.ms = T.ac = T.an = null; $('meter').hidden = true; }
  $('talk').onchange = () => { sensShow(); try { localStorage.setItem('bs-cam-talk', $('talk').checked ? '1' : '0'); } catch {} if (live) talkStart(); else talkStop(); };
  try { if (localStorage.getItem('bs-cam-talk') === '0') $('talk').checked = false; } catch {}
  sensShow();
  function stop() {
    talkStop();
    live = false; relayStop(true); clearTimeout(helloT); wsDead = false; try { ws && ws.close(); } catch {} ws = null;
    for (const pc of peers.values()) pc.close(); peers.clear();
    $('go').hidden = false; $('stop').hidden = true; $('tag').textContent = 'PREVIEW'; $('tag').className = 'tag';
    say('Stopped. Press <b>Go live</b> to start again.');
  }
  $('go').onclick = () => { if (!stream) return; live = true; $('go').hidden = true; $('stop').hidden = false; err(''); say('Connecting…'); connect(); talkStart(); };
  $('stop').onclick = stop;
  $('q').onchange = () => { try { localStorage.setItem('bs-cam-q', $('q').value); } catch {} getCam(); };
  $('cams').onchange = () => getCam();
  $('mic').onchange = () => { getCam().then(() => { if (live) { for (const to of [...peers.keys()]) offer(to); if (R.on) relayStart(); } }); };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { err(window.isSecureContext ? 'This browser can’t share a camera. Try Chrome, Edge, Firefox or Safari.' : 'Browsers only allow the camera on a secure page. Ask the host for the online link (it starts with https://).'); return; }
  getCam().then(ok => { if (ok) listCams(); });
  addEventListener('pagehide', () => { if (live) stop(); });
})();
