/*
 * BeeboScore — live data for the Twitch Stuff overlays (sidebar + viewer VS splash).
 * Calls window.onViewers(data) whenever the queue changes. WebSocket first, polling if that's blocked.
 * ?demo plays made-up viewers so you can line things up in OBS before going live.
 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const emit = d => { try { window.onViewers && window.onViewers(d); } catch (e) { console.error(e); } };
  window.twImg = u => u ? '/img?u=' + encodeURIComponent(u) : '';
  window.twEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HUES = [265, 330, 200, 20, 150, 45, 290, 0];
  window.twHue = s => HUES[[...String(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];

  if (q.has('demo')) return demo();
  let ok = false, poll = null;
  function startPoll() {
    if (poll) return;
    const tick = () => fetch('/api/twitch/live', { cache: 'no-store' }).then(r => r.json()).then(emit).catch(() => {});
    tick(); poll = setInterval(tick, 1500);
  }
  function connect() {
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return startPoll(); }
    const fb = setTimeout(() => { if (!ok) startPoll(); }, 4000);
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (!ok) { ok = true; clearTimeout(fb); clearInterval(poll); poll = null; }
      if (m.type === 'viewers') emit(m.data);
    };
    ws.onclose = () => { clearTimeout(fb); if (ok) { ok = false; setTimeout(connect, 1000); } else { startPoll(); setTimeout(connect, 15000); } };
  }
  connect();

  // ---------------------------------------------------------------- demo
  function demo() {
    const NAMES = ['CrimsonByte', 'NeonGhoul', 'ShadowKoi', 'PixelPaladin', 'VoidTaco', 'IronMoth', 'RamenRush', 'GlassJaw99', 'BeanCounter', 'TurboMoth'];
    let n = 0, splashN = 0;
    const d = { open: true, count: 0, queue: [], current: null, session: { s: 7, v: 3 }, splash: { show: false, n: 0, hold: 5 }, streamer: 'YourChannel', joinCmd: '!join', leaveCmd: '!leave', joinText: '', art: null };
    const mk = name => ({ login: name.toLowerCase(), display: name, avatar: '', rec: { w: n % 3, l: (n * 2) % 5 } });
    fetch('/api/twitch/live', { cache: 'no-store' }).then(r => r.json()).then(real => { d.art = real.art; d.streamer = real.streamer && real.streamer !== 'the streamer' ? real.streamer : d.streamer; d.streamerAvatar = real.streamerAvatar || ''; }).catch(() => {}).finally(() => {
      for (let i = 0; i < 4; i++) d.queue.push(mk(NAMES[n++ % NAMES.length]));
      d.current = { ...mk('ShadowKoi'), s: 1, v: 1 };
      d.count = d.queue.length; emit(JSON.parse(JSON.stringify(d)));
      setInterval(() => {                       // someone joins, now and then the next viewer comes up
        if (d.queue.length < 7) d.queue.push(mk(NAMES[n++ % NAMES.length]));
        d.count = d.queue.length; emit(JSON.parse(JSON.stringify(d)));
      }, 2600);
      const next = () => {
        const nx = d.queue.shift(); if (nx) d.current = { ...nx, s: 0, v: 0 };
        d.count = d.queue.length; d.splash = { show: true, n: ++splashN, hold: 5 }; emit(JSON.parse(JSON.stringify(d)));
        setTimeout(() => { d.splash = { ...d.splash, show: false }; emit(JSON.parse(JSON.stringify(d))); }, 5000);
      };
      setTimeout(next, 1200); setInterval(next, 9000);
    });
  }
})();
