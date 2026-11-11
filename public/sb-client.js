/*
 * BeeboScore (Beebo) — overlay client.
 * Injected automatically into every layout the app serves; you never include it yourself.
 *
 * BINDINGS
 *   <span data-sb="p1.name"></span>                 text
 *   <span data-sb="{p1.team} | {p1.name}"></span>   text template
 *   <img  data-sb-src="chars/{p1.characterSlug}.png">  image (hidden when empty / missing)
 *   <div  data-sb-bg="p1.flagUrl"></div>            background image
 *   <div  data-sb-show="c1.name"></div>             shown when truthy ("!p1.loser" inverts)
 *   <div  data-sb-hide="p1.loser"></div>            hidden when truthy
 *   <div  data-sb-class="lead:p1.leading"></div>    toggles classes
 *   <div  data-sb-pips="p1"></div>                  one <i class="pip"> per game needed; won games get .on
 *   <span data-sb-fit="40,22">…</span>              shrinks the font (max,min px) until the text fits
 *
 * STATE CLASSES on <html> (style them in CSS)
 *   sb-ready · sb-p1-winner / sb-p2-winner · sb-p1-matchpoint / sb-p2-matchpoint
 *   sb-final-game (both on match point) · sb-p1-loser / sb-p2-loser (in losers bracket) · sb-gf
 *
 * ANIMATION HOOKS
 *   .sb-changed       briefly on any element whose value changed
 *   .sb-scored        briefly on elements with data-sb-scored="p1" when P1 takes a game
 *
 * SCRIPTING
 *   window.addEventListener('scoreboard', e => e.detail)            full state (+ e.detail.prev)
 *   window.addEventListener('scoreboard:scored', e => e.detail.side) 1 or 2
 *   window.addEventListener('scoreboard:set-over', e => e.detail.winner)
 */
(function () {
  'use strict';
  const OVERLAY = window.__SB_OVERLAY;
  const FOLLOW = !!window.__SB_FOLLOW_ACTIVE;
  // FRAMED: running inside BeeboScore's seamless host page, which handles reloads/switches.
  // INSTANT: a seamless refresh — skip intros and jump straight to the current look.
  const FRAMED = !!window.__SB_FRAMED;
  const INSTANT = !!window.__SB_INSTANT;
  const root = document.documentElement;
  let first = true, prev = null;

  // Tell the host page once the first state is drawn (fonts loaded, intro skipped).
  let readySent = false;
  function signalReady() {
    if (readySent) return; readySent = true;
    const go = () => {
      root.classList.remove('sb-instant');
      requestAnimationFrame(() => requestAnimationFrame(() => { try { parent.postMessage({ sb: 'ready' }, location.origin); } catch (e) {} }));
    };
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
    fonts.then(() => requestAnimationFrame(() => requestAnimationFrame(go)));
  }

  const get = (obj, path) => String(path).trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function fill(tpl, s) {
    tpl = tpl.trim();
    if (tpl.includes('{')) return tpl.replace(/\{([^}]+)\}/g, (_, k) => { const v = get(s, k); return v == null ? '' : v; });
    const v = get(s, tpl);
    return v == null ? '' : v;
  }
  function truthy(expr, s) {
    expr = expr.trim();
    const neg = expr.startsWith('!');
    const v = get(s, neg ? expr.slice(1) : expr);
    const t = !!v && v !== '0' && v !== 'false';
    return neg ? !t : t;
  }
  const slug = x => String(x || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const flagEmoji = cc => (cc = String(cc || '').trim().toUpperCase(), /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))) : '');

  // player pictures + flags come through BeeboScore's picture cache (instant, offline-safe)
  const viaCache = u => /^https:\/\/([\w-]+\.)*(start\.gg|flagcdn\.com)\//i.test(String(u || '')) ? '/img?u=' + encodeURIComponent(u) : u;
  function enrich(raw) {
    const s = JSON.parse(JSON.stringify(raw));
    const ft = /^FT\s*(\d+)$/i.exec(String(s.bestOf || '').trim());
    const bo = ft ? 0 : Number(s.bestOf);
    const firstTo = ft ? Number(ft[1]) : (bo ? Math.ceil(bo / 2) : 0);
    s.bestOfText = ft ? `First to ${firstTo}` : bo ? `Best of ${bo}` : String(s.bestOf || '');
    s.bestOfShort = ft ? `FT${firstTo}` : bo ? `BO${bo}` : String(s.bestOf || '');
    s.firstTo = firstTo || '';
    s.firstToText = firstTo ? `First to ${firstTo}` : '';
    s.isGrandFinals = /grand/i.test(s.round || '');
    for (const k of ['p1', 'p2']) {
      const p = s[k] || (s[k] = {});
      const o = s[k === 'p1' ? 'p2' : 'p1'] || {};
      const cc = String(p.country || '').trim().toLowerCase();
      p.score = Number(p.score) || 0;
      p.displayName = (p.name || '') + (p.loser ? ' [L]' : '');
      p.fullName = p.team ? `${p.team} | ${p.name || ''}` : (p.name || '');
      p.flag = flagEmoji(cc);
      p.flagUrl = /^[a-z]{2}$/.test(cc) ? viaCache(`https://flagcdn.com/w80/${cc}.png`) : '';
      if (p.avatar) p.avatar = viaCache(p.avatar);
      p.characterSlug = slug(p.character);
      p.leading = p.score > (Number(o.score) || 0);
      p.winner = !!firstTo && p.score >= firstTo;
      p.matchPoint = !!firstTo && firstTo > 1 && p.score === firstTo - 1;
      p.loserTag = p.loser ? '[L]' : '';
    }
    s.setOver = s.p1.winner !== s.p2.winner;
    s.winnerSide = s.p1.winner && !s.p2.winner ? 1 : s.p2.winner && !s.p1.winner ? 2 : 0;
    s.finalGame = !s.setOver && s.p1.matchPoint && s.p2.matchPoint;
    for (const k of ['c1', 'c2']) {
      const c = s[k] || (s[k] = {});
      c.display = c.handle ? `${c.name} ${c.handle}` : (c.name || '');
    }
    s.commentators = [s.c1.name, s.c2.name].filter(Boolean).join(' & ');
    return s;
  }

  function pulse(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el['__t' + cls]);
    el['__t' + cls] = setTimeout(() => el.classList.remove(cls), ms);
  }

  function fit(el) {
    const [max, min] = String(el.getAttribute('data-sb-fit')).split(',').map(Number);
    if (!max) return;
    el.style.fontSize = max + 'px';
    if (el.scrollWidth <= el.clientWidth + 1) return;
    // binary search: a handful of reflows instead of one per pixel
    let lo = min || 8, hi = max;
    while (hi - lo > 1) {
      const size = (lo + hi) >> 1;
      el.style.fontSize = size + 'px';
      if (el.scrollWidth > el.clientWidth + 1) hi = size; else lo = size;
    }
    el.style.fontSize = lo + 'px';
  }
  function fitAll() { document.querySelectorAll('[data-sb-fit]').forEach(fit); }
  window.SB = { fit, fitAll, enrich };

  function apply(raw) {
    const s = enrich(raw);
    s.prev = prev;
    let textChanged = first;
    document.querySelectorAll('[data-sb]').forEach(el => {
      const v = String(fill(el.getAttribute('data-sb'), s));
      if (el.textContent !== v) { el.textContent = v; textChanged = true; if (!first) pulse(el, 'sb-changed', 1200); }
    });
    document.querySelectorAll('[data-sb-src]').forEach(el => {
      const tpl = el.getAttribute('data-sb-src');
      const v = String(fill(tpl, s));
      const holes = tpl.includes('{') && (tpl.match(/\{([^}]+)\}/g) || []).some(m => { const x = get(s, m.slice(1, -1)); return x == null || x === ''; });
      if (!v || holes) { el.style.visibility = 'hidden'; el.removeAttribute('src'); return; }
      if (el.getAttribute('src') !== v) {
        el.onerror = () => { el.style.visibility = 'hidden'; el.style.display = 'none'; };   // a picture that won't load takes no space
        el.onload = () => { el.style.visibility = ''; el.style.display = ''; };
        el.style.display = '';
        el.setAttribute('src', v);
      }
    });
    document.querySelectorAll('[data-sb-bg]').forEach(el => {
      const v = String(fill(el.getAttribute('data-sb-bg'), s));
      el.style.backgroundImage = v ? `url("${v}")` : 'none';
    });
    document.documentElement.classList.toggle('sb-off', !!s.hidden);      // the whole overlay hidden (downtime)
    document.querySelectorAll('[data-sb-show]').forEach(el => el.classList.toggle('sb-hidden', !truthy(el.getAttribute('data-sb-show'), s)));
    document.querySelectorAll('[data-sb-hide]').forEach(el => el.classList.toggle('sb-hidden', truthy(el.getAttribute('data-sb-hide'), s)));
    document.querySelectorAll('[data-sb-class]').forEach(el => {
      el.getAttribute('data-sb-class').split(',').forEach(pair => {
        const [cls, expr] = pair.split(':');
        if (cls && expr) el.classList.toggle(cls.trim(), truthy(expr, s));
      });
    });
    const need = Number(s.firstTo) || 0;
    document.querySelectorAll('[data-sb-pips]').forEach(el => {
      const p = s[el.getAttribute('data-sb-pips')] || {};
      const html = need > 0 && need <= 10 ? Array.from({ length: need }, (_, i) => `<i class="pip${i < p.score ? ' on' : ''}"></i>`).join('') : '';
      if (el.innerHTML !== html) el.innerHTML = html;
    });

    root.classList.add('sb-ready');
    root.classList.toggle('sb-p1-winner', s.winnerSide === 1);
    root.classList.toggle('sb-p2-winner', s.winnerSide === 2);
    root.classList.toggle('sb-p1-matchpoint', !s.setOver && s.p1.matchPoint);
    root.classList.toggle('sb-p2-matchpoint', !s.setOver && s.p2.matchPoint);
    root.classList.toggle('sb-final-game', s.finalGame);
    root.classList.toggle('sb-p1-loser', !!s.p1.loser);
    root.classList.toggle('sb-p2-loser', !!s.p2.loser);
    root.classList.toggle('sb-gf', s.isGrandFinals);
    if (textChanged) fitAll();

    window.scoreboard = s;
    const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { console.error(e); } };
    if (!first && prev) {
      for (const side of [1, 2]) {
        if (s['p' + side].score > prev['p' + side].score) {
          document.querySelectorAll(`[data-sb-scored="p${side}"]`).forEach(el => pulse(el, 'sb-scored', 900));
          emit('scoreboard:scored', { side, state: s });
        }
      }
      if (s.winnerSide && s.winnerSide !== prev.winnerSide) emit('scoreboard:set-over', { winner: s.winnerSide, state: s });
    }
    emit('scoreboard', s);
    if (typeof window.onScoreboard === 'function') { try { window.onScoreboard(s); } catch (e) { console.error(e); } }
    prev = s;
    first = false;
    if (FRAMED) signalReady();
  }

  const style = document.createElement('style');
  style.textContent = '.sb-hidden{display:none!important}' +
    'body{transition:opacity .5s ease}html.sb-off body{opacity:0!important;pointer-events:none}' +
    'html.sb-instant *,html.sb-instant *::before,html.sb-instant *::after{transition:none!important;animation-delay:0s!important;animation-duration:0s!important}' +
    // potato mode: every animation jumps to its final frame and stays there
    'html.sb-potato *,html.sb-potato *::before,html.sb-potato *::after{transition:none!important;animation-delay:0s!important;animation-duration:0s!important;animation-iteration-count:1!important}' +
    // light effects: every animation stays, the heaviest decoration goes (particles, lightning, glows, shakes, blurs)
    'html.sb-light .br-embers,html.sb-light .br-sparks,html.sb-light .br-spark,html.sb-light .br-flare,html.sb-light .t8-bolts,html.sb-light .t8-glow,html.sb-light .t8-ghost,html.sb-light .sh-ghost,' +
    'html.sb-light .vs-sh-embers,html.sb-light .vs-sh-glow,html.sb-light .vs-sh-glow2,html.sb-light .vs-spark,html.sb-light .vs-ghost,html.sb-light #sbf-fx,html.sb-light .sbf-frag,html.sb-light [data-sb-heavy]{display:none!important}' +
    'html.sb-light .t8-shake .br-stage,html.sb-light .vs-shake,html.sb-light.vs-shake{animation:none!important}' +
    'html.sb-light *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
  (document.head || document.documentElement).appendChild(style);
  if (document.fonts) document.fonts.ready.then(fitAll);

  // ---- realtime: WebSocket first, falls back to polling (works through any proxy/tunnel)
  let lastUpdated = 0, lastRev = null, polling = null, wsOk = false, lastSnd = '';
  function onState(data) {
    const snd = data && JSON.stringify(data.snd || null);           // Settings › Sound changes arrive without a new update
    if (!data || (data.updatedAt && data.updatedAt === lastUpdated && snd === lastSnd)) return;
    lastUpdated = data.updatedAt; lastSnd = snd;
    const run = () => { queue.push(data); if (queue.length > 40) queue.splice(0, queue.length - 40); if (!holdT) drain(); };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run, { once: true }) : run();
  }
  // A moment on the current players (a life lost, a player knocked out) can ask to keep them on screen a little longer
  // before the next update shows: window.__SB_HOLD(newState, shownState) → ms. Updates that arrive meanwhile queue up
  // and play in order afterwards — each one can hold too — so fast results never skip an animation (they speed up
  // when several are waiting, so the overlay never falls far behind).
  let holdT = 0;
  const queue = [];
  function drain() {
    while (queue.length && !holdT) {
      const d = queue.shift();
      let ms = !first && typeof window.__SB_HOLD === 'function' ? Number(window.__SB_HOLD(d, prev)) || 0 : 0;
      // falling behind (results confirmed faster than the moments play): every moment still plays, just quicker
      if (ms > 0 && queue.length) ms = queue.length >= 3 ? 250 : Math.max(600, ms * .55);
      if (ms > 0) { holdT = setTimeout(() => { holdT = 0; apply(d); drain(); }, Math.min(ms, 6000)); return; }
      apply(d);
    }
  }
  // ---- latency reports: tell the app when each numbered update is actually on this screen.
  // Not for the app's own previews or the potato-mode renderer.
  const q = new URLSearchParams(location.search);
  const REPORT = !q.has('preview') && !q.has('potato') && !window.__SB_POTATO;
  let viewerId = '';
  try { viewerId = (FRAMED && parent.__sbViewer) || ''; } catch (e) {}
  if (!viewerId) viewerId = Math.random().toString(36).slice(2, 12);
  let sock = null;
  const say = m => { try { if (REPORT && sock && sock.readyState === 1) sock.send(JSON.stringify(m)); } catch (e) {} };
  function hello() {
    let tz = '', obs = false;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    try { obs = !!(window.obsstudio || (parent && parent.obsstudio)); } catch (e) { obs = !!window.obsstudio; }
    say({ type: 'lat-hello', v: viewerId, tz, obs, layout: OVERLAY || '' });
  }
  function ackWhenDrawn(seq, t0, test) {
    if (!REPORT || !seq) return;
    const done = () => say({ type: 'lat-ack', seq, draw: Math.round(performance.now() - t0), test: !!test, hidden: document.hidden });
    if (document.hidden) return done();               // a hidden tab never paints; report straight away
    requestAnimationFrame(() => requestAnimationFrame(done));
  }
  function handle(msg, t0) {
    if (msg.type === 'lat-ping') return say({ type: 'lat-pong', t: msg.t });
    if (msg.type === 'lat-probe') return ackWhenDrawn(msg.seq, t0, true);
    if (msg.type === 'fx') { document.documentElement.classList.toggle('sb-light', !!(msg.data && msg.data.light)); return; }
    if (msg.type === 'state') { onState(msg.data); ackWhenDrawn(msg.seq, t0); }
    else if (msg.type === 'bracket') { try { window.__SB_BRACKET = msg.data; window.dispatchEvent(new CustomEvent('scoreboard:bracket', { detail: msg.data })); } catch (e) {} }   // framed too: new results arrive live
    else if (FRAMED) return;            // reloads / layout switches: the host page swaps in a fresh copy instead
    else if (msg.type === 'reload') { if (!msg.data.overlay || msg.data.overlay === OVERLAY) location.reload(); }
    else if (msg.type === 'active-changed') { if (FOLLOW && msg.data.overlay !== OVERLAY) location.reload(); }
  }
  function startPolling() {
    if (polling) return;
    const tick = async () => {
      try {
        const r = await fetch('/api/live?o=' + encodeURIComponent(OVERLAY || ''), { cache: 'no-store' });
        const d = await r.json();
        onState(d.state);
        if (FRAMED) return;
        if (lastRev !== null && d.rev !== lastRev) return location.reload();
        lastRev = d.rev;
        if (FOLLOW && d.active && d.active !== OVERLAY) location.reload();
      } catch (e) { /* server restarting — keep trying */ }
    };
    tick();
    polling = setInterval(tick, 1000);
  }
  function stopPolling() { clearInterval(polling); polling = null; lastRev = null; }
  function connect() {
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
    catch (e) { startPolling(); return; }
    sock = ws; ws.onopen = hello;
    const fallback = setTimeout(() => { if (!wsOk) startPolling(); }, 4000);
    ws.onmessage = e => {
      const t0 = performance.now();
      if (!wsOk) { wsOk = true; clearTimeout(fallback); stopPolling(); }
      try { handle(JSON.parse(e.data), t0); } catch (err) { console.error(err); }
    };
    ws.onclose = () => {
      clearTimeout(fallback);
      if (wsOk) { wsOk = false; setTimeout(connect, 1000); }
      else { startPolling(); setTimeout(connect, 15000); }
    };
  }
  connect();
})();
