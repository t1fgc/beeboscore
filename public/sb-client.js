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
      // instant is for the first frame only: from here on this copy plays everything (a lost life, a K.O., the splashes)
      // like any other (it used to stay on, so after a seamless refresh the format moments never played again)
      window.__SB_INSTANT = false;
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
  // 1.12.8: q = how many pictures the app has made bigger so far — a new one changes the address, so the bigger copy is fetched
  let upq = 0;
  const viaCache = u => /^https:\/\/([\w-]+\.)*(start\.gg|flagcdn\.com)\//i.test(String(u || '')) ? '/img?u=' + encodeURIComponent(u) + (upq && /start\.gg/i.test(u) ? '&q=' + upq : '') : u;
  function enrich(raw) {
    const s = JSON.parse(JSON.stringify(raw));
    upq = Number(s.fx && s.fx.upv) || 0;
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
      p.flagUrl = /^[a-z]{2}$/.test(cc) ? `/static/flags/${cc}.svg` : '';   // built in: works offline
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
    signalReady();
  }

  const style = document.createElement('style');
  style.textContent = '.sb-hidden{display:none!important}' +
    'body{transition:opacity .5s ease}html.sb-leaving body{opacity:0!important;pointer-events:none;transition:opacity .26s ease}' +
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
  let lastUpdated = 0, lastRev = null, polling = null, wsOk = false, lastSig = '';
  // 1.12.16: smaller updates — the app sends only what changed ("statep"); a missed one asks for the whole state again
  let stObj = null, stRev = 0;
  function applyPatch(msg, ws) {
    const d = msg.data || {};
    if (msg.type === 'state') { stObj = d; stRev = Number(msg.rev) || 0; return msg; }
    if (!stObj || !stRev || d.base !== stRev) { try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'state-full' })); } catch (e) {} return null; }
    const s = { ...stObj }, copied = new Set();
    const own = k => { if (!copied.has(k)) { copied.add(k); s[k] = s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) ? { ...s[k] } : {}; } return s[k]; };
    for (const p of d.del || []) { if (p.length === 1) delete s[p[0]]; else if (s[p[0]] && typeof s[p[0]] === 'object') delete own(p[0])[p[1]]; }
    for (const p of d.set || []) { if (p.length === 2) { s[p[0]] = p[1]; copied.add(p[0]); } else own(p[0])[p[1]] = p[2]; }
    stObj = s; stRev = d.rev;
    return { type: 'state', data: s, seq: msg.seq, rev: d.rev };
  }
  function onState(data) {
    // 1.12.12: the whole update is compared, not just its stamp, so a change that arrives without a new stamp (the up-next
    // list, King of the Hill records, sound / effects / commentary / logo settings, effect cues) always gets through, and
    // only true repeats (the same update by socket and by polling, a reconnect) are dropped
    if (!data) return;
    let sig = ''; try { sig = JSON.stringify(data); } catch (e) { sig = String(Math.random()); }
    if (sig === lastSig) return;
    lastSig = sig; lastUpdated = data.updatedAt;
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
  window.addEventListener('beebo:gfx-load', e => say({ type: 'gfx-load', ...(e.detail || {}) }));   // 1.12.11: BeeboFX 3's load, for the panel
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
    else if (msg.type === 'vtpub') { try { window.__SB_VT = msg.data; window.dispatchEvent(new CustomEvent('scoreboard:vt', { detail: msg.data })); } catch (e) {} }   // the viewer tournament (its join splash)
    else if (FRAMED) return;            // reloads / layout switches: the host page swaps in a fresh copy instead
    else if (msg.type === 'talk') { try { window.dispatchEvent(new CustomEvent('beebo:talk', { detail: msg.data || {} })); } catch (e) {} }   // 1.12.15
    else if (msg.type === 'show:draw' || msg.type === 'ext') { try { window.dispatchEvent(new CustomEvent(msg.type === 'ext' ? 'beebo:ext' : 'beebo:' + msg.type, { detail: msg.data || {} })); } catch (e) {} }   // 1.12.18: drawing on replays; extensions' cues
    else if (msg.type === 'tempo') { try { window.dispatchEvent(new CustomEvent('beebo:tempo', { detail: msg.data || {} })); } catch (e) {} }   // 1.12.15: tap tempo
    else if (msg.type === 'reload') { if (msg.data.ifLite) { if (window.__SB_LITE_BUNDLE) softReload(); } else if (!msg.data.overlay || msg.data.overlay === OVERLAY) softReload(); }   // 1.12.16: ifLite — effects back on: only pages without the engines
    else if (msg.type === 'active-changed') { if (FOLLOW && msg.data.overlay !== OVERLAY) location.reload(); }
  }
  // A page opened on its own (not inside the OBS host page): fade out, come back as an instant copy (no intro) that fades
  // in once drawn. The address is put back afterwards, so pressing F5 later still plays the intro.
  function softReload() {
    if (q.has('preview') || q.has('potato') || window.__SB_POTATO) return location.reload();
    root.classList.add('sb-leaving');
    const u = new URL(location.href); u.searchParams.set('instant', 'soft'); u.searchParams.set('t', Date.now());   // soft: a live copy that only skips its intro (1.12.21)
    setTimeout(() => location.replace(u.toString()), 280);
  }
  if (INSTANT && !FRAMED && /[?&]instant(&|=|$)/.test(location.search)) {
    try { const u = new URL(location.href); u.searchParams.delete('instant'); u.searchParams.delete('t'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (e) {}
  }
  function startPolling() {
    if (polling) return;
    const tick = async () => {
      try {
        const r = await fetch('/api/live?o=' + encodeURIComponent(OVERLAY || ''), { cache: 'no-store' });
        const d = await r.json();
        onState(d.state);
        if (FRAMED) return;
        if (lastRev !== null && d.rev !== lastRev) return softReload();
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
    sock = ws; ws.onopen = () => { try { ws.send(JSON.stringify({ type: 'patch-ok' })); } catch (e) {} hello(); };
    const fallback = setTimeout(() => { if (!wsOk) startPolling(); }, 4000);
    ws.onmessage = e => {
      const t0 = performance.now();
      if (!wsOk) { wsOk = true; clearTimeout(fallback); stopPolling(); }
      try { let m = JSON.parse(e.data); if (m.type === 'state' || m.type === 'statep') m = applyPatch(m, ws); if (m) handle(m, t0); } catch (err) { console.error(err); }
    };
    ws.onclose = () => {
      clearTimeout(fallback);
      if (wsOk) { wsOk = false; setTimeout(connect, 1000); }
      else { startPolling(); setTimeout(connect, 15000); }
    };
  }
  // ---- previews in the app (?demo=bar | vs | victory, e.g. "Preview the VS Splash"): this layout with the names that are on the scoreboard
  // now, playing a set piece instead of following the stream. Nothing here reaches the app or the real overlay.
  function demo(kind) {
    let n = 0;
    const push = st => onState({ ...st, updatedAt: Date.now() + (++n) });
    fetch('/api/live?o=' + encodeURIComponent(OVERLAY || ''), { cache: 'no-store' }).then(r => r.json()).catch(() => ({})).then(d => {
      const b = JSON.parse(JSON.stringify((d && d.state) || {}));
      const at = (a, c) => ({ ...b, bestOf: 5, hidden: false, screen: '', format: null, splash: { show: '' }, vs: { show: false }, victory: { show: false, side: 0, n: 0 }, p1: { ...b.p1, score: a }, p2: { ...b.p2, score: c } });
      if (kind === 'vs') return push({ ...at(0, 0), vs: { show: true } });
      if (kind === 'victory') return push({ ...at(3, 1), victory: { show: true, side: 1, n: 1 } });
      const steps = [[1, 1, 1700], [2, 1, 2600], [3, 1, 3800]];           // a game is taken → match point → the set is won, on a loop
      let i = 0; const next = () => { const [a, c, ms] = steps[i++ % steps.length]; push(at(a, c)); setTimeout(next, ms); };
      next();
    });
  }
  if (q.get('demo')) { demo(q.get('demo')); return; }
  connect();
})();
