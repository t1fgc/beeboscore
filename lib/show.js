'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — the show: everything new in 1.12.18 wired into the app in one place.
 *
 *   Running the show   the rundown (lib/rundown.js), countdown and coming-up screens, rehearsal mode, the show log
 *                      (lib/showlog.js), the backup PC (lib/mirror.js)
 *   Replays and video  Replay 2.0 (slow motion, freeze-frame, drawing on the replay), the recap video and vertical
 *                      clips (lib/media.js)
 *   Players            profiles, storylines, event stats, seasons, the walk-in (lib/people.js)
 *   Viewers            the prediction game, polls, the hype meter, Twitch Predictions and channel points (lib/crowd.js)
 *   Look and reach     the sound pack and music player, overlay languages, colour-blind-safe colours, 4K output
 *   Platform           team accounts (lib/team.js), sync between PCs (lib/sync.js), extensions (lib/extensions.js), the
 *                      online gallery (lib/gallery.js), the venue screen, the vertical page, the phone app
 *
 * server.js hands it `ctx` (what it needs from the app) and calls: onState(prev, next, undo) after every change,
 * onChat(m) for chat, action(b) for remote actions it doesn't know, live() for what overlays need, sd() for the Stream
 * Deck, publicRoute(…) before sign-in and route(…) after it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const RD = require('./rundown');
const { createShowLog, diff: logDiff } = require('./showlog');
const PEOPLE = require('./people');
const { createCrowd } = require('./crowd');
const { createMedia } = require('./media');
const { createMirror } = require('./mirror');
const { createSync } = require('./sync');
const { createTeam } = require('./team');
const { createExtensions } = require('./extensions');
const GAL = require('./gallery');
const MO = require('./moments');
const TALE = require('./tale');

const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const key = n => String(n || '').trim().toLowerCase();
const clockOf = ms => { const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), z = n => String(n).padStart(2, '0'); return h ? `${h}:${z(m)}:${z(t % 60)}` : `${z(m)}:${z(t % 60)}`; };   // as the header shows it
const LANGS = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh'];
const SFX = ['off', 'auto', 'glass', 'chime', 'punch'];
const OUT = ['auto', '1080', '1440', '2160'];
const FULL = ['countdown', 'schedule', 'walkin', 'evstats', 'season', 'greset'];      // greset (1.12.23): the Bracket reset splash
const CARDS = ['storyline', 'pred', 'poll'];
const MUSIC_EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/webm': 'webm' };
const AUDIO_TYPE = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', webm: 'audio/webm' };
// made-up players for rehearsal mode
const REH_PLAYERS = [{ name: 'CrimsonByte', team: 'EMBR', country: 'GB', character: 'Jin' }, { name: 'NeonGhoul', team: 'FRST', country: 'JP', character: 'Reina' }];

function createShow(ctx) {
  const D = ctx.DATA_DIR, cfg = () => ctx.config(), S = () => ctx.config().settings, st = () => ctx.state();
  const save = () => ctx.saveConfig();
  let dirtyT = null;
  /** something overlays show changed: one state broadcast soon (crowd counts: at most twice a second) */
  function changed(soft) { clearTimeout(dirtyT); dirtyT = setTimeout(() => { dirtyT = null; ctx.liveBroadcast(); ctx.panel('show', panelView()); }, soft ? 450 : 30); }
  /** 1.12.19: tell the panel which of its cards to read again (instead of the panel asking every few seconds) —
   *  parts: profiles · stats · seasons · media · clips · mirror · sync · templates */
  const pokeWait = new Set(); let pokeT = null;
  function poke(...parts) { parts.forEach(x => pokeWait.add(x)); if (pokeT) return; pokeT = setTimeout(() => { pokeT = null; const l = [...pokeWait]; pokeWait.clear(); ctx.panel('show:changed', { parts: l }); }, 120); }
  const actor = () => { try { return (ctx.actor && ctx.actor()) || ''; } catch { return ''; } };

  // ------------------------------------------------------------------------------------------------ rehearsal
  const reh = { on: false, step: '', i: 0, n: 0, snap: null, timers: [], fake: null };
  // ------------------------------------------------------------------------------------------------ the show log
  const slog = createShowLog({ dir: path.join(D, 'showlog'), startOf: () => ctx.chapterStart(), log: ctx.log });
  // `before`: the scoreboard just before this happened (Undo to here)
  const note = (kind, text, before) => { const r = slog.add(reh.on ? 'rehearsal' : kind, (reh.on ? '[Rehearsal] ' : '') + text, JSON.stringify({ ...ctx.strip(JSON.parse(JSON.stringify(before || st()))), updatedAt: 0 }), actor()); if (r) ctx.panel('showlog', { add: { id: r.id, at: r.at, kind: r.kind, text: r.text, undo: true } }); return r; };

  // ------------------------------------------------------------------------------------------------ the rundown
  if (!cfg().rundown) { cfg().rundown = RD.starter(); save(); } else cfg().rundown = RD.clean(cfg().rundown);
  const runFile = path.join(D, 'rundown-run.json');
  let run = ctx.readJSON(runFile, { idx: -1, segStart: 0, showStart: 0 }); const extraMs = {};
  if (run.idx >= 0 && (!cfg().rundown.list[run.idx] || Date.now() - run.segStart > 12 * 3600e3)) run = { idx: -1, segStart: 0, showStart: 0 };
  const templates = () => (Array.isArray(cfg().rundownTemplates) ? cfg().rundownTemplates : []).filter(t => t && t.name).slice(0, 20).map(t => ({ name: str(t.name, 40), ...RD.clean(t), at: Number(t.at) || 0 }));
  const rundown = RD.createRundown({
    get: () => cfg().rundown, getRun: () => run, setRun: r => { run = r; for (const k of Object.keys(extraMs)) delete extraMs[k]; ctx.saveLater(runFile, () => run, 100); },
    extra: seg => extraMs[seg.id] || 0, extend: (seg, m) => { extraMs[seg.id] = (extraMs[seg.id] || 0) + m * 60000; },
    changed: () => changed(), apply: applySegment,
  });
  async function applySegment(seg, i) {
    const R = b => Promise.resolve(ctx.remoteAction(b)).catch(e => ctx.log(`rundown “${seg.name}”: ${e.message}`));
    note('segment', `Rundown: ${seg.name}`);
    const s = seg.screen;
    if (s === 'none') await R({ action: 'hideAll' });
    else if (s === 'countdown') setFull({ show: 'countdown', label: seg.label || seg.name, until: seg.mins ? Date.now() + seg.mins * 60000 : 0 });
    else if (s === 'schedule' || s === 'evstats' || s === 'season') setFull({ show: s });
    else if (['bracket', 'top8', 'standings'].includes(s)) await R({ action: 'splash', kind: s, show: true });
    else if (s.startsWith('screen:')) await R({ action: 'screen', name: s.slice(7), show: true });
    if (seg.obsScene) ctx.panel('obs-scene', { scene: seg.obsScene });
    if (seg.chapter && !reh.on) try { ctx.chapterMark(seg.name); } catch {}
    if (seg.auto) try { ctx.autos.runNow(seg.auto); } catch {}
    if (!reh.on && i > 0) try { ctx.notify('segment', `📋 ${seg.name} is starting now on stream${st().event ? ' · ' + st().event : ''}`); } catch {}
    try { ctx.autos.fire('segment', { what: seg.name, round: seg.name }); } catch {}
  }
  /** the full-screen show screens (countdown, coming up, walk-in, event in numbers, season table) */
  function setFull(f) {
    const cur = st().full || {};
    const nx = { show: FULL.includes(f.show) ? f.show : '', side: Number(f.side) === 2 ? 2 : 1, label: str(f.label ?? cur.label, 60), until: Number(f.until) || 0, n: (Number(cur.n) || 0) + 1 };
    ctx.setState({ full: nx }, { undo: true });
  }
  function setCard(show, extra = {}) { const cur = st().card || {}; ctx.setState({ card: { show: CARDS.includes(show) ? show : '', n: (Number(cur.n) || 0) + 1, i: Number(extra.i) || 0 } }, { undo: true }); }

  // ------------------------------------------------------------------------------------------------ players: profiles, seasons
  const profiles = PEOPLE.createProfiles(path.join(D, 'profiles.json'));
  const seasons = PEOPLE.createSeasons(path.join(D, 'seasons.json'));
  const live = { key: '', d1: 0, d2: 0 };          // the set being played: the most each side has been behind
  const eventSince = () => { if (run.idx >= 0 && run.showStart) return run.showStart; const rows = ctx.hist.all(), ev = String(st().event || ''); const today = Date.now() - 16 * 3600e3; let t = Date.now(); for (let i = rows.length - 1; i >= 0; i--) { const r = rows[i]; if (r.at < today) break; if (ev && r.event && r.event !== ev) continue; t = r.start || r.at; } return Math.min(t, Date.now()); };
  function storyList() {
    const s = st(), m = ctx.bracket();
    return PEOPLE.storylines(ctx.hist.all(), s, { today: eventSince(), live: { deficit1: live.d1, deficit2: live.d2 }, top8: !!(m && m.top8 && m.top8.reached), firstTop8: n => seasons.firstTop8(n), phase: m && m.top8 && m.top8.reached ? 'Top 8' : '' });
  }
  const evStats = () => PEOPLE.eventStats(ctx.hist.all(), eventSince());
  // ------------------------------------------------------------------------------------------------ 1.12.21: moments, the head-to-head line, the set timer
  /** a player's seed in the bracket that's loaded (start.gg or the viewer tournament), 0 when it isn't known */
  function seedOf(name) {
    const m = ctx.bracket(), k = key(name); if (!m || !k) return 0;
    const of = p => (p && key(p.name) === k && Number(p.seed) > 0 ? Number(p.seed) : 0);
    for (const col of [...(m.winners || []), ...(m.losers || [])]) for (const x of col.sets || []) { const v = of(x.a) || of(x.b); if (v) return v; }
    for (const x of m.gf || []) { const v = of(x.a) || of(x.b); if (v) return v; }
    for (const x of m.standings || []) { const v = of(x); if (v) return v; }
    return 0;
  }
  const splashUp = () => { const s = st(); return !!((s.vs && s.vs.show) || (s.playerVs && s.playerVs.show) || (s.victory && s.victory.show) || (s.splash && s.splash.show) || (s.full && s.full.show) || s.screen); };
  const moments = MO.createMoments({ state: st, settings: S, busy: splashUp, format: () => { const f = st().format; return !!(f && f.status === 'live'); }, rows: () => ctx.hist.all(), since: () => eventSince(), seedOf, note: (k, t) => note(k, t), changed: () => changed(),
    fire: (e, info) => { try { ctx.autos.fire(e, info); } catch {} }, standby: () => mirror.standby });
  // 1.12.23: the tale (lib/tale.js), worked out again only when something it reads has changed
  let taleKey = '', taleVal = null;
  function taleNow() {
    const s = st(), m = ctx.bracket(), told = moments.story() || {}, on = S().vsStrip !== false;
    const k = JSON.stringify([key(s.p1 && s.p1.name), key(s.p2 && s.p2.name), !!(s.p1 && s.p1.loser), !!(s.p2 && s.p2.loser), s.winnerSide || 0, ctx.hist.rev, m && m.updatedAt, told, on, s.event || '']);
    if (k === taleKey) return taleVal;
    taleKey = k;
    let t = null; try { t = TALE.tale(s, { rows: ctx.hist.all(), since: eventSince(), bracket: m, seedOf, hist: s.p1 && s.p2 && s.p1.name && s.p2.name ? ctx.hist.view(s.p1.name, s.p2.name) : null, story: told }); } catch (e) { ctx.log('tale: ' + e.message); }
    if (t && !on) t.strip = false, t.off = true;
    return (taleVal = t);
  }
  // 1.12.23: the Bracket reset splash comes up by itself once the reset is on (after the Victory screen, when nothing else is up),
  // for seven seconds — unless it's switched off (Settings › Scoreboard) or it has been shown for this grand final already
  let gresetFor = '', gresetT = null;
  function gresetWatch() {
    const s = st(), told = moments.story() || {}, end = told.end;
    if (!end || end.kind !== 'reset' || S().resetSplash === false || mirror.standby || reh.on) return;
    const k = `${key(s.p1 && s.p1.name)}|${key(s.p2 && s.p2.name)}`; if (gresetFor === k || splashUp()) return;
    gresetFor = k; setImmediate(() => { try { gresetShow(true); } catch {} });
    clearTimeout(gresetT); gresetT = setTimeout(() => { try { if ((st().full || {}).show === 'greset') gresetShow(false); } catch {} }, 7000); if (gresetT.unref) gresetT.unref();
  }
  function gresetShow(on) {
    const cur = st().full || {};
    if (on) setFull({ show: 'greset' }); else if (cur.show === 'greset') setFull({ show: '' });
  }
  /** the set timer: { show, start, end } on the scoreboard's state — running while start is set and end isn't */
  const timerOf = () => { const t = st().timer || {}; return { show: !!t.show, start: Number(t.start) || 0, end: Number(t.end) || 0 }; };
  const setTimer = t => ctx.setState({ timer: { show: !!t.show, start: Number(t.start) || 0, end: Number(t.end) || 0 } }, { undo: true });
  const realPair = s => { const b = MO.snap(s); return b.ok; };
  function profileOf(name) {
    const p = profiles.get(name), pic = ctx.picUrl(name);
    return p || pic ? { ...(p || { name }), pic: pic || (p && p.avatar ? '/img?u=' + encodeURIComponent(p.avatar) : '') } : null;
  }
  function walkinData(side) {
    const s = st(), me = s['p' + side], them = s['p' + (3 - side)]; if (!me || !me.name) return null;
    const pr = profileOf(me.name) || {}, h = ctx.hist.player(me.name), hv = them && them.name ? ctx.hist.view(me.name, them.name) : null, best = seasons.results(me.name).slice(0, 3), rk = seasons.rankOf(me.name);
    return { side, name: me.name, team: me.team || pr.team || '', country: me.country || pr.country || '', pic: pr.pic || '', main: me.character || pr.main || h.main || '', bio: pr.bio || '', socials: pr.socials || {}, sponsor: pr.sponsor || '',
      record: h.record || '', sets: h.sets, h2h: hv ? hv.line : '', best: best.map(b => `${PEOPLE.ordinal(b.place)} · ${b.event}`), rank: rk ? `#${rk.rank} in ${(seasons.active() || {}).name || 'the season'}` : '',
      music: pr.walkin ? { src: '/walkin/' + pr.walkin.file, vol: pr.walkin.vol, title: pr.walkin.title } : null };
  }

  // ------------------------------------------------------------------------------------------------ viewers
  const pref = () => ({ predAuto: false, predChat: true, pollChat: true, hype: false, hypeFull: 40, hypeShow: true, twAuto: false, twWindow: 120, ...(cfg().crowd || {}) });
  const crowd = createCrowd({
    prefs: pref, canSay: () => !reh.on && ctx.chat.canSay(), say: t => ctx.chat.say(t), changed: soft => changed(soft), log: ctx.log,
    predicted: (w, l) => { if (!reh.on) seasons.predicted(w, l); }, names: () => [st().p1.name, st().p2.name], winner: () => ctx.winnerOf(),
    onHype: () => { if (reh.on) return; Promise.resolve(ctx.remoteAction({ action: 'hype' })).catch(() => {}); note('hype', 'Hype meter peaked — hype burst'); try { ctx.autos.fire('hype', {}); } catch {} },
    fire: (e, info) => { try { ctx.autos.fire(e, info); } catch {} },
    hasScopes: () => ctx.twitch.hasScopes(), me: () => ctx.twitch.userId(), helix: (m, p, b) => ctx.twitch.helix(m, p, b),
    rewards: () => (Array.isArray(cfg().twitchRewards) ? cfg().twitchRewards : []), setRewards: l => { cfg().twitchRewards = l.slice(0, 20); save(); },
    redeem: async (r, who) => {
      note('reward', `Channel points: ${who || 'a viewer'} redeemed “${r.title}”`);
      if (r.do.startsWith('auto:')) { if (!ctx.autos.runNow(r.do.slice(5))) throw new Error('That automation is gone.'); }
      else await ctx.remoteAction({ action: r.do === 'sponsor' ? 'sponsor' : r.do, do: 'next' });
    },
  });

  // ------------------------------------------------------------------------------------------------ video, backup PC, sync, team, extensions, gallery
  const media = createMedia({ binDir: ctx.BIN_DIR, log: ctx.log });
  const mediaJob = { what: '', text: '', frac: 0, file: '', error: '' };
  const mirror = createMirror({ get: () => cfg().mirrorFrom, log: ctx.log, changed: big => { if (big) { save(); note('backup', 'This PC took over from the streaming PC'); } ctx.panel('mirror', mirror.view()); },
    apply: d => { if (d.state) { reh.on = false; ctx.setState(d.state, { replace: true, undo: true, keepPages: true }); }
      const c = cfg(); let ch = false;
      if (d.activeOverlay && d.activeOverlay !== c.activeOverlay && ctx.overlayExists(d.activeOverlay)) { ctx.setActive(d.activeOverlay); }
      for (const k of ['rundown', 'automations', 'sponsors']) if (d[k] && JSON.stringify(d[k]) !== JSON.stringify(c[k])) { c[k] = k === 'rundown' ? RD.clean(d[k]) : d[k]; ch = true; if (k === 'automations') ctx.autos.set(d[k]); }
      if (d.settings) for (const [k, v] of Object.entries(d.settings)) if (JSON.stringify(c.settings[k]) !== JSON.stringify(v)) { c.settings[k] = v; ch = true; }
      if (d.run) { run = d.run; }
      if (ch) save(); } });
  if (mirror.standby) mirror.start();
  const MIRROR_SETTINGS = ['vsStyle', 'vsColor1', 'vsColor2', 'overlayColours', 'autoVictory', 'victoryHold', 'lockSplash', 'formatBarOpacity', 'fxQuality', 'lightFx', 'overlayLang', 'sfxPack', 'cvd', 'outScale'];
  const sync = createSync({ get: () => cfg().sync, set: v => { cfg().sync = v; save(); }, log: ctx.log, make: () => ctx.makeBackup(), parse: ctx.parseBackup, restore: doc => ctx.restoreBackup(doc) });
  // 1.12.19: another PC wrote newer settings to the shared folder — the panel hears about it (no asking every 30 s)
  let syncKey = ''; const syncWatch = setInterval(() => { try { if (!(cfg().sync && cfg().sync.on)) return; const w = sync.waiting(), k = w ? w.pc + ':' + w.at : ''; if (k !== syncKey) { syncKey = k; poke('sync'); } } catch {} }, 30000); syncWatch.unref && syncWatch.unref();
  const team = createTeam({ get: () => cfg().team, set: l => { cfg().team = l; save(); } });
  const ext = createExtensions({ dir: path.join(D, 'extensions'), get: () => cfg().extensions, set: v => { cfg().extensions = v; save(); }, log: ctx.log });
  const galleryHost = process.env.GALLERY_HOST === '1' ? GAL.host(path.join(D, 'gallery-host')) : null;
  const galleryUrl = () => String(S().galleryUrl || process.env.BEEBO_GALLERY_URL || ctx.builtGallery || '').trim();
  const gallery = GAL.client(galleryUrl);

  // ------------------------------------------------------------------------------------------------ music and the sound pack
  const MUSIC_DIR = path.join(D, 'music'), WALKIN_DIR = path.join(D, 'walkin');
  let musicMemo = { k: '', v: null };        // the track list is checked on disk only when it changes
  const musicCfg = () => { const m = cfg().music || {}, k = JSON.stringify(m); if (musicMemo.k !== k || !musicMemo.v) musicMemo = { k, v: musicRead(m) }; return musicMemo.v; };
  const musicRead = m => ({ on: !!m.on, vol: Math.max(0, Math.min(100, Number(m.vol ?? 40))), duckTo: Math.max(0, Math.min(100, Number(m.duckTo ?? 25))), shuffle: m.shuffle !== false, autoDuck: m.autoDuck !== false,
    list: (Array.isArray(m.list) ? m.list : []).filter(t => t && /^[a-f0-9]{16}\.(mp3|ogg|m4a|wav|webm)$/.test(t.file) && fs.existsSync(path.join(MUSIC_DIR, t.file))).slice(0, 200).map(t => ({ file: t.file, title: str(t.title, 80) })) });
  const musicRun = { duck: false, skip: 0 };
  function saveUpload(dir, buf, type) {
    const ext2 = MUSIC_EXT[String(type || '').split(';')[0].trim().toLowerCase()];
    if (!ext2) throw new Error('Use an MP3, OGG, M4A, WAV or WebM sound file.');
    if (buf.length > 25 * 1024 * 1024) throw new Error('That file is too big (25 MB at most).');
    const f = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '.' + ext2;
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, f), buf); return f;
  }

  // ------------------------------------------------------------------------------------------------ what the overlays get (liveState.x)
  function langOf() { const per = cfg().layoutLang || {}; return { def: LANGS.includes(S().overlayLang) ? S().overlayLang : 'en', per: Object.fromEntries(Object.entries(per).filter(([, v]) => LANGS.includes(v))) }; }
  function liveX() {
    const s = st(), full = s.full || {}, card = s.card || {}, x = {};
    const lg = langOf(); if (lg.def !== 'en' || Object.keys(lg.per).length) x.lang = lg;
    if (S().cvd) x.cvd = true;
    const out = OUT.includes(S().outScale) ? S().outScale : 'auto'; if (out !== 'auto') x.out = out;
    const sfx = SFX.includes(S().sfxPack) ? S().sfxPack : 'off'; if (sfx !== 'off') x.sfx = sfx;
    const rv = rundown.view();
    if (rv.running) x.rd = { name: rv.current.name, endsAt: rv.current.endsAt, next: rv.next ? rv.next.name : '' };
    if (full.show === 'countdown' || full.show === 'schedule') x.sched = { title: cfg().rundown.title || '', list: rv.list.filter(i => !i.done).slice(0, 7).map(i => ({ name: i.name, at: i.at, live: i.live })) };
    if (full.show === 'walkin') x.walk = walkinData(full.side);
    if (full.show === 'evstats') { const e = evStats(); x.ev = { ...e, event: s.event || '' }; }
    if (full.show === 'season') { const v = seasons.view(); x.season = { name: v.season ? v.season.name : '', events: v.season ? v.season.events.length : 0, table: v.table.slice(0, 12).map(r => ({ rank: r.rank, name: r.name, pts: r.pts, events: r.events, best: r.best })), predictors: v.predictors.slice(0, 5) }; }
    if (card.show === 'storyline') { const l = reh.on ? [{ title: 'Revenge set', text: 'NeonGhoul beat CrimsonByte 2–1 in Winners Semi-Final earlier today — CrimsonByte came back through losers for this.' }] : storyList(); const it = l[Math.max(0, Math.min(l.length - 1, Number(card.i) || 0))]; if (it) x.story = { title: it.title, text: it.text }; }
    const pv = reh.on && reh.fake ? reh.fake.pred : crowd.predView(); if (pv) x.pred = pv;
    const pl = reh.on && reh.fake ? reh.fake.poll : crowd.pollView(); if (pl) x.poll = pl;
    const hy = reh.on && reh.fake && reh.fake.hype ? reh.fake.hype : crowd.hypeView(); if (hy && (hy.level > 0 || hy.peak)) x.hype = hy;
    const rk = [1, 2].map(k => s['p' + k] && s['p' + k].name ? seasons.rankOf(s['p' + k].name) : null); if (rk[0] || rk[1]) x.rank = { name: (seasons.active() || {}).name || '', 1: rk[0], 2: rk[1] };
    const pr = [1, 2].map(k => { const p = s['p' + k] && s['p' + k].name ? profiles.get(s['p' + k].name) : null; return p ? { socials: p.socials, sponsor: p.sponsor, pronouns: p.pronouns, main: p.main } : null; }); if (pr[0] || pr[1]) x.prof = { 1: pr[0], 2: pr[1] };
    const mc = musicCfg(); if (mc.list.length) x.music = { on: mc.on && !reh.on, vol: mc.vol, duckTo: mc.duckTo, duck: musicRun.duck || (mc.autoDuck && ctx.talking()), shuffle: mc.shuffle, skip: musicRun.skip, list: mc.list.map(t => '/music/' + t.file) };
    if (reh.on) x.reh = { step: reh.step, i: reh.i, n: reh.n };
    // 1.12.19: the venue screen's options (only when they're not the usual ones)
    if (S().venueBracket === false || S().venueNext === false || S().venueClock === false || S().venueQr) x.venue = { bracket: S().venueBracket !== false, next: S().venueNext !== false, clock: S().venueClock !== false, qr: S().venueQr ? (S().venueQrUrl || (ctx.twitchChannel && ctx.twitchChannel() ? 'https://twitch.tv/' + ctx.twitchChannel() : '')) : '' };
    // 1.12.21: the moment banner that's on, the set timer (how long it has run, as of now) and what the scoreboard leaves out
    { const mo = moments.live(); if (mo) x.mo = mo;
      const told = moments.story(); if (told) x.story = told;
      const t = timerOf(); if (t.show) x.timer = { ms: t.start ? Math.max(0, (t.end || Date.now()) - t.start) : 0, run: !!t.start && !t.end };
      const sb = {}; if (S().sbGameNo === false) sb.nogame = true; if (S().moments === false || S().moGame === false) sb.noflip = true; if (S().reduceMotion) sb.calm = true;
      if (Object.keys(sb).length) x.sb = sb; }
    // 1.12.23: the tale of the set — the stats strip on FullVS and GlassVS, where the set sends each player, Victory's banner
    { const t = taleNow(); if (t) x.tale = t; }
    const ex = ext.active(); if (ex.length) x.ext = ex.filter(e => e.js).map(e => e.id);
    if (s.ext && Object.keys(s.ext).length) x.extOn = s.ext;
    return x;
  }

  // ------------------------------------------------------------------------------------------------ the state, as it changes
  const snapOf = s => ({ n1: key(s.p1 && s.p1.name), n2: key(s.p2 && s.p2.name), s1: Number(s.p1 && s.p1.score) || 0, s2: Number(s.p2 && s.p2.score) || 0 });
  function onState(prev, next, { undo = false, winWas = 0, winNow = 0 } = {}) {
    // the show log
    if (!mirror.standby) for (const [kind, text] of logDiff(prev, next)) note(kind, text, prev);
    // the set being played: how far behind each side has been (comebacks, reverse sweeps)
    const a = snapOf(prev), b = snapOf(next), k = `${b.n1}|${b.n2}`;
    if (k !== live.key || (b.s1 === 0 && b.s2 === 0)) { live.key = k; live.d1 = 0; live.d2 = 0; }
    live.d1 = Math.max(live.d1, b.s2 - b.s1); live.d2 = Math.max(live.d2, b.s1 - b.s2);
    if (!reh.on && !mirror.standby) crowd.onState(a, b, winWas, winNow, [next.p1.name, next.p2.name], undo);
    if (winNow && winNow !== winWas) poke('stats');                       // a set was won: the event in numbers moves on
    // 1.12.21: moments; and the set timer, when it starts by itself — from zero for two new players (or a reset), frozen at the win
    try { moments.onState(prev, next, { undo, winWas, winNow }); } catch (e) { ctx.log('moments: ' + e.message); }
    if (S().sbTimer && !mirror.standby) {
      const t = timerOf(), fresh = k !== `${a.n1}|${a.n2}` || (b.s1 === 0 && b.s2 === 0 && (a.s1 > 0 || a.s2 > 0));
      let nx = null;
      if (fresh && realPair(next) && !undo) nx = { show: true, start: Date.now(), end: 0 };
      else if (winNow && !winWas && t.show && t.start && !t.end) nx = { ...t, end: Date.now() };
      else if (!winNow && winWas && t.show && t.start && t.end) nx = { ...t, end: 0 };
      if (nx) setImmediate(() => { try { setTimer(nx); if (nx.end && !t.end) note('graphic', `Set timer stopped at ${clockOf(nx.end - nx.start)}`); else if (!nx.end && !t.end) note('on', 'Set timer started'); } catch {} });
    }
    try { gresetWatch(); } catch {}
    // the walk-in follows the player on that side; a full-screen splash takes the show screens away
    if (sync) syncSoon();
  }
  /** what server.js puts into history for a won set: how many games down the winner came back from */
  const comebackOf = w => (w === 1 ? live.d1 : w === 2 ? live.d2 : 0);
  let syncT = null; const syncSoon = () => { if (!(cfg().sync && cfg().sync.on)) return; clearTimeout(syncT); syncT = setTimeout(() => sync.write(), 60000); syncT.unref && syncT.unref(); };

  function onChat(m) { if (mirror.standby) return false; try { return crowd.onChat(m); } catch (e) { ctx.log('chat: ' + e.message); return false; } }

  // ------------------------------------------------------------------------------------------------ rehearsal mode
  const SAMPLE = [['CrimsonByte', 'EMBR', 'GB', 'Jin'], ['NeonGhoul', 'FRST', 'JP', 'Reina'], ['RamenRush', '', 'US', 'Kazuya'], ['IronMoth', 'MOTH', 'DE', 'King'], ['VoidTaco', '', 'MX', 'Bryan'], ['GlassJaw99', '', 'CA', 'Paul'], ['BeanCounter', 'EMBR', 'IE', 'Lars'], ['TurboMoth', 'MOTH', 'FR', 'Asuka']];
  function addSample() {
    for (const [name, team, country, main] of SAMPLE) if (!profiles.get(name) || profiles.get(name).sample) profiles.set(name, { team, country, main, bio: 'A made-up player for trying things out', sample: true });
    const ev = (n, d, order) => ({ name: `Sample Weekly #${n}`, date: d, standings: order.map((i, k) => ({ name: SAMPLE[i][0], place: [1, 2, 3, 4, 5, 5, 7, 7][k] })) });
    seasons.addSample([ev(1, '2026-01-05', [0, 1, 2, 3, 4, 5, 6, 7]), ev(2, '2026-01-12', [1, 0, 3, 2, 6, 7, 4, 5])]);
  }
  function rehStop(why = 'stopped') {
    try { if (profiles.clearSample() + seasons.clearSample()) { changed(); poke('profiles', 'seasons'); } } catch {}     // 1.12.19: sample data goes with the rehearsal
    for (const t of reh.timers) clearTimeout(t); reh.timers = [];
    if (!reh.on) return rehView();
    const snap = reh.snap; reh.on = false; reh.fake = null; reh.step = ''; reh.snap = null;
    note('rehearsal', `Rehearsal ${why} — everything put back`);
    if (snap) ctx.setState(JSON.parse(snap), { replace: true, undo: true, keepPages: true });
    changed(); return rehView();
  }
  function rehStart() {
    if (reh.on) return rehView();
    if (mirror.standby) throw new Error('This PC is the backup — take over first.');
    reh.snap = JSON.stringify(ctx.strip(st())); reh.on = true; reh.fake = null;
    const R = b => () => Promise.resolve(ctx.remoteAction(b)).catch(() => {});
    const set = o => () => ctx.setState(o);
    const steps = [];
    const add = (label, fn, ms = 3000) => steps.push({ label, fn, ms });
    const [A, B] = REH_PLAYERS;
    add('Two made-up players', set({ p1: { ...ctx.blankPlayer(), ...A }, p2: { ...ctx.blankPlayer(), ...B }, round: 'Winners Final', bestOf: 5, event: 'Rehearsal Weekly', stats: { show: false }, card: { show: '' }, full: { show: '' } }), 2500);
    add('VS splash', R({ action: 'vs', show: true }), 5000);
    add('Back to the game', R({ action: 'vs', show: false }), 1800);
    add('Prediction bar', () => { reh.fake = { ...(reh.fake || {}), pred: { a: A.name, b: B.name, open: true, locked: false, n1: 58, n2: 42, total: 100, pct1: 58, pct2: 42 } }; setCard('pred'); }, 3500);
    add('A game to CrimsonByte', () => { reh.fake.pred = { ...reh.fake.pred, open: false, locked: true }; ctx.setState({ p1: { score: 1 } }); }, 2500);
    add('Stats card', R({ action: 'stats', side: 1, show: true }), 3500);
    add('A game to NeonGhoul', () => { ctx.setState({ stats: { show: false }, p2: { score: 1 } }); }, 2000);
    add('Storyline card', () => setCard('storyline'), 4000);
    add('Poll', () => { reh.fake.poll = { q: 'Who takes it?', open: true, endsAt: Date.now() + 30000, total: 64, opts: [{ text: A.name, letter: 'A', n: 38, pct: 59 }, { text: B.name, letter: 'B', n: 26, pct: 41 }] }; setCard('poll'); }, 3500);
    add('Hype meter', () => { setCard(''); reh.fake.hype = { level: 1, peak: true, show: true }; changed(); Promise.resolve(ctx.remoteAction({ action: 'hype' })).catch(() => {}); }, 3000);
    add('Match point', () => { reh.fake.hype = null; ctx.setState({ p1: { score: 2 } }); }, 2500);
    if (ctx.sponsorCount() > 0) add('Sponsor', R({ action: 'sponsor', do: 'next' }), 4000);
    add('The set is won', () => ctx.setState({ p1: { score: 3 } }), 1500);
    add('Victory splash', R({ action: 'victory', show: true }), 5000);
    add('Hide all', R({ action: 'hideAll' }), 1500);
    const m = ctx.bracket();
    if (m) { add('Bracket splash', R({ action: 'splash', kind: 'bracket', show: true }), 5000); if (m.top8 && m.top8.reached) add('Top 8 splash', R({ action: 'splash', kind: 'top8', show: true }), 5000); if ((m.standings || []).length) add('Standings', R({ action: 'splash', kind: 'standings', show: true }), 4000); add('Hide all', R({ action: 'hideAll' }), 1200); }
    for (const sc of ctx.layoutScreens()) { add(`Screen: ${sc.name || sc.id}`, R({ action: 'screen', name: sc.id, show: true }), 3500); add('Screen off', R({ action: 'screen', name: sc.id, show: false }), 1200); }
    add('Countdown', () => setFull({ show: 'countdown', label: 'Starting soon', until: Date.now() + 5 * 60000 }), 4500);
    add('Coming up', () => setFull({ show: 'schedule' }), 4000);
    add('The event in numbers', () => setFull({ show: 'evstats' }), 4500);
    add('Season table', () => setFull({ show: 'season' }), 4500);
    add('Walk-in: CrimsonByte', () => setFull({ show: 'walkin', side: 1 }), 4500);
    add('Walk-in: NeonGhoul', () => setFull({ show: 'walkin', side: 2 }), 4500);
    add('Back to the game', () => setFull({ show: '' }), 1500);
    reh.n = steps.length; reh.i = 0;
    note('rehearsal', `Rehearsal started — ${steps.length} steps`);
    let t = 300;
    steps.forEach((s, i) => { reh.timers.push(setTimeout(() => { if (!reh.on) return; reh.i = i + 1; reh.step = s.label; try { s.fn(); } catch (e) { ctx.log('rehearsal: ' + e.message); } changed(); ctx.panel('rehearsal', rehView()); }, t)); t += s.ms; });
    reh.timers.push(setTimeout(() => rehStop('finished'), t + 500));
    changed(); return rehView();
  }
  function rehView() { return { on: reh.on, step: reh.step, i: reh.i, n: reh.n }; }

  // ------------------------------------------------------------------------------------------------ Replay 2.0 (the app's window talks to OBS)
  const replay = { speed: 100, frozen: false };
  function drawMsg(d) { ctx.hubAll('show:draw', d); }

  // ------------------------------------------------------------------------------------------------ remote actions (panel, Stream Deck, automations, the operator)
  async function action(b) {
    const show = b.show === undefined || b.show === 'toggle' ? null : !!b.show;
    switch (b.action) {
      case 'rundown': { const r = rundown.action({ do: b.do || 'next', id: b.id, n: b.n, mins: b.mins }); return { rundown: r }; }
      case 'countdown': {
        if (b.do === 'plus' || b.do === 'minus') {          // 1.12.19: a minute more (or less) while it runs, without starting it again
          const cur = st().full || {}; if (cur.show !== 'countdown') throw new Error('The countdown isn’t on stream.');
          const d = Math.max(1, Math.min(60, Math.round(Number(b.mins) || 1))) * (b.do === 'minus' ? -1 : 1), now = Date.now(), base = Number(cur.until) > now ? Number(cur.until) : now;
          const until = Math.max(now + 5000, base + d * 60000);
          ctx.setState({ full: { ...cur, until } }, { undo: true }); note('countdown', `Countdown ${d > 0 ? '+' : '−'}${Math.abs(d)} min`); return { until, left: until - now };
        }
        const cur = st().full || {}, on = show === null ? cur.show !== 'countdown' : show;
        if (!on) { if (cur.show === 'countdown') setFull({ show: '' }); return {}; }
        const mins = Number(b.mins) || 0, rv = rundown.view();
        setFull({ show: 'countdown', label: str(b.label, 60) || (rv.current ? rv.current.name : '') || 'Starting soon', until: mins ? Date.now() + mins * 60000 : rv.current && rv.current.endsAt ? rv.current.endsAt : 0 }); return {};
      }
      case 'schedule': case 'evstats': case 'season': { const cur = st().full || {}, on = show === null ? cur.show !== b.action : show; setFull({ show: on ? b.action : cur.show === b.action ? '' : cur.show }); return {}; }
      case 'walkin': {
        const side = Number(b.side) === 2 ? 2 : 1, cur = st().full || {}, on = show === null ? !(cur.show === 'walkin' && Number(cur.side) === side) : show;
        if (on && !(st()['p' + side] && st()['p' + side].name)) throw new Error('No player there yet.');
        setFull(on ? { show: 'walkin', side } : { show: cur.show === 'walkin' ? '' : cur.show }); return {};
      }
      case 'storyline': {
        const cur = st().card || {}, l = storyList();
        if (b.do === 'next') { if (!l.length) throw new Error('No storylines for this set yet.'); setCard('storyline', { i: cur.show === 'storyline' ? ((Number(cur.i) || 0) + 1) % l.length : 0 }); return {}; }
        const on = show === null ? cur.show !== 'storyline' : show;
        if (on && !l.length && !reh.on) throw new Error('No storylines for this set yet — they come from Player history.');
        setCard(on ? 'storyline' : cur.show === 'storyline' ? '' : cur.show, { i: Number(b.i) || 0 }); return {};
      }
      case 'pred': {
        const r = crowd.action({ do: b.do || 'predToggle', a: b.a, b: b.b, who: b.who });
        const cur = st().card || {};
        if (['predOpen', 'predToggle'].includes(b.do || 'predToggle') && crowd.pred && crowd.pred.open && cur.show !== 'pred') setCard('pred');
        if (b.do === 'predClose' && cur.show === 'pred') setCard('');
        if (b.do === 'card') setCard(cur.show === 'pred' ? '' : 'pred');
        return { pred: r };
      }
      case 'poll': {
        const r = crowd.action({ do: b.do || 'pollToggle', question: b.question, options: b.options, secs: b.secs });
        if (b.do === 'pollStart' || (b.do === 'pollToggle' && crowd.poll && crowd.poll.open)) { cfg().crowd = { ...(cfg().crowd || {}), pollLast: { question: crowd.poll.q, options: crowd.poll.opts, secs: Math.round((crowd.poll.endsAt - crowd.poll.at) / 1000) } }; save(); setCard('poll'); note('poll', `Poll: ${crowd.poll.q}`); }
        if (b.do === 'pollClear' && (st().card || {}).show === 'poll') setCard('');
        if (b.do === 'card') setCard((st().card || {}).show === 'poll' ? '' : 'poll');
        return { poll: r };
      }
      case 'twpred': { const r = await crowd.twAction({ ...b, do: b.do || 'toggle' }); note('twitch', `Twitch prediction: ${(r.pred && r.pred.status) || b.do}`); return { twitch: r }; }
      case 'rehearsal': return { rehearsal: b.do === 'stop' || (b.do !== 'start' && reh.on) ? rehStop() : rehStart() };
      // 1.12.21 ------------------------------------------------------------------------------------------
      case 'moments': {                   // (not 'moment': that one is the Hype key's effect) do: 'replay' (the last one again) · 'test' + kind (try one) · 'on' / 'off' / 'toggle' (the banners) · 'clear'
        if (['on', 'off', 'toggle'].includes(b.do)) { const on = b.do === 'toggle' ? S().moments === false : b.do === 'on'; S().moments = on; save(); if (!on) moments.clear(); note(on ? 'on' : 'off', `Moment banners ${on ? 'on' : 'off'}`); changed(); ctx.panel('settings', S()); return { moments: moments.view() }; }
        const r = moments.action({ do: b.do || 'replay', kind: b.kind }); if (b.do !== 'clear') note('moment', b.do === 'test' ? `Moment tried out: ${r.moment.title}` : `Moment replayed: ${r.moment.title}`); return { moments: moments.view() };
      }
      case 'h2h': {                       // the head-to-head line under the scoreboard
        const cur = !!(st().h2h && st().h2h.show), on = show === null ? !cur : show;
        if (on && !realPair(st())) throw new Error('Two players on the scoreboard first — the line is about the two of them.');
        if (on !== cur) ctx.setState({ h2h: { show: on } }, { undo: true });                        // (the show log writes it down from the change itself)
        return { h2h: on };
      }
      case 'timer': {                     // do: 'toggle' (start → stop → start again from zero) · 'start' · 'stop' · 'hide'
        const t = timerOf(), d = b.do || 'toggle', now = Date.now();
        if (d === 'hide' || (d === 'toggle' && b.hold)) { if (t.show) setTimer({ show: false, start: 0, end: 0 }); return { timer: timerOf() }; }
        if (d === 'stop' || (d === 'toggle' && t.show && t.start && !t.end)) { if (t.show && t.start && !t.end) { setTimer({ ...t, end: now }); note('graphic', `Set timer stopped at ${clockOf(now - t.start)}`); } return { timer: timerOf() }; }
        setTimer({ show: true, start: now, end: 0 }); note('on', 'Set timer started'); return { timer: timerOf() };
      }
      // 1.12.23 ------------------------------------------------------------------------------------------
      case 'strip': {                     // the stats strip under FullVS and GlassVS: do 'on' / 'off' / 'toggle'
        const cur = S().vsStrip !== false, on = b.do === 'on' ? true : b.do === 'off' ? false : show === null ? !cur : show;
        S().vsStrip = on; save(); note(on ? 'on' : 'off', `Stats strip ${on ? 'on' : 'off'}`); changed(); ctx.panel('settings', S()); return { strip: on };
      }
      case 'greset': {                    // the Bracket reset splash: show / hide (toggle)
        const cur = (st().full || {}).show === 'greset', on = show === null ? !cur : show;
        if (on && !realPair(st())) throw new Error('Two players on the scoreboard first — the splash is about the two of them.');
        clearTimeout(gresetT); gresetShow(on); return { greset: on };
      }
      case 'replaySlow': replay.speed = replay.speed === 100 ? Math.max(10, Math.min(100, Number(b.speed) || 50)) : 100; ctx.panel('obs-replay2', { speed: replay.speed }); note('replay', replay.speed === 100 ? 'Replay at full speed' : `Replay in slow motion (${replay.speed}%)`); return { replay };
      case 'replayFreeze': replay.frozen = b.do === 'off' ? false : b.do === 'on' ? true : !replay.frozen; ctx.panel('obs-replay2', { freeze: replay.frozen }); note('replay', replay.frozen ? 'Replay frozen' : 'Replay playing'); return { replay };
      case 'drawClear': drawMsg({ clear: true }); return {};
      case 'draw': { if (b.undo) { drawMsg({ undo: str(b.undo, 12) }); return {}; }          // 1.12.19: Ctrl+Z on the replay pad takes the last stroke away
        const pts = (Array.isArray(b.pts) ? b.pts : []).slice(0, 400).map(p => [Math.round(Math.max(0, Math.min(1, Number(p[0]) || 0)) * 10000) / 10000, Math.round(Math.max(0, Math.min(1, Number(p[1]) || 0)) * 10000) / 10000]); drawMsg({ id: str(b.id, 12), tool: ['pen', 'arrow', 'circle'].includes(b.tool) ? b.tool : 'pen', color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#ffd23f', w: Math.max(2, Math.min(24, Number(b.w) || 8)), pts, done: !!b.done }); return {}; }
      case 'music': {
        const m = { ...(cfg().music || {}) };
        if (b.do === 'duck') { musicRun.duck = !musicRun.duck; }
        else if (b.do === 'skip') musicRun.skip++;
        else { if (!musicCfg().list.length) throw new Error('Add some music first (Stream tab › Music).'); m.on = b.do === 'on' ? true : b.do === 'off' ? false : !m.on; cfg().music = m; save(); }
        changed(); return { music: { on: musicCfg().on, duck: musicRun.duck } };
      }
      case 'ext': {
        const e = ext.cue(String(b.ext || ''), String(b.cue || b.screen || ''));
        if (e.screens.some(x => x.id === (b.screen || b.cue))) { const k = `${e.id}:${b.screen || b.cue}`, cur = { ...(st().ext || {}) }, on = show === null ? !cur[k] : show; if (on) cur[k] = true; else delete cur[k]; ctx.setState({ ext: null }, { undo: true }); ctx.setState({ ext: cur }, { undo: true }); }
        else ctx.hubAll('ext', { ext: e.id, cue: String(b.cue), data: b.data && typeof b.data === 'object' ? b.data : {} });
        note('ext', `${e.name}: ${b.screen || b.cue}`); return {};
      }
      case 'clip': ctx.panel('vertical-clip', { at: Date.now() }); return {};
      case 'results': ctx.panel('results-make', { at: Date.now() }); return {};
    }
    return undefined;            // not one of ours
  }
  const ACTIONS = ['rundown', 'countdown', 'schedule', 'evstats', 'season', 'walkin', 'storyline', 'pred', 'poll', 'twpred', 'rehearsal', 'replaySlow', 'replayFreeze', 'drawClear', 'draw', 'music', 'ext', 'clip', 'results', 'moments', 'h2h', 'timer', 'strip', 'greset'];

  /** for the Stream Deck's status */
  function sd() {
    const s = st(), rv = rundown.view(), pv = crowd.predView(), pl = crowd.pollView(), tv = crowd.twView(), full = s.full || {}, card = s.card || {};
    return { rd: rv.running ? { name: rv.current.name, left: rv.current.left, next: rv.next ? rv.next.name : '' } : { name: '', next: cfg().rundown.list[0] ? cfg().rundown.list[0].name : '', empty: !cfg().rundown.list.length },
      full: full.show || '', fullSide: Number(full.side) || 1, card: card.show || '', pred: pv ? { open: pv.open, pct1: pv.pct1, total: pv.total } : null, poll: pl ? { open: pl.open } : null, pollLast: !!pref().pollLast,
      tw: tv.allowed ? { status: tv.pred ? tv.pred.status : '' } : null, reh: reh.on, replay: { ...replay }, music: musicCfg().list.length ? { on: musicCfg().on, duck: musicRun.duck } : null,
      stories: storyList().length, ext: ext.active().map(e => ({ id: e.id, name: e.name, cues: e.cues, screens: e.screens, icon: e.icon })), backup: mirror.standby,
      mo: (v => ({ on: v.on, now: v.now, last: v.last ? v.last.title : '' }))(moments.view()), h2h: !!(s.h2h && s.h2h.show), strip: S().vsStrip !== false, timer: (t => ({ show: t.show, run: !!t.start && !t.end, ms: t.start ? Math.max(0, (t.end || Date.now()) - t.start) : 0 }))(timerOf()) };   // 1.12.21
  }
  /** the panel's Show card(s) */
  function panelView() { return { rundown: { ...rundown.view(), plan: cfg().rundown }, rehearsal: rehView(), crowd: { pred: crowd.predView(), poll: crowd.pollView(), hype: crowd.hypeView(), prefs: pref(), twitch: crowd.twView() }, full: st().full || {}, card: st().card || {}, replay, music: { ...musicCfg(), duck: musicRun.duck }, job: { ...mediaJob, busy: media.busy },
    moments: moments.view(), h2h: !!(st().h2h && st().h2h.show), timer: (t => ({ show: t.show, run: !!t.start && !t.end, ms: t.start ? Math.max(0, (t.end || Date.now()) - t.start) : 0 }))(timerOf()) }; }   // 1.12.21

  // ------------------------------------------------------------------------------------------------ routes before sign-in (overlays, OBS sources, the venue, the backup PC's link, the gallery)
  async function publicRoute(req, res, p, method, url) {
    if (p === '/sb-show.js' || p === '/sb-i18n.js') { ctx.serveFile(req, res, path.join(ctx.PUBLIC_DIR, p.slice(1))); return true; }
    if (p === '/venue') { ctx.serveFile(req, res, path.join(ctx.PUBLIC_DIR, 'venue.html')); return true; }
    if (p === '/vertical') { ctx.serveFile(req, res, path.join(ctx.PUBLIC_DIR, 'vertical.html')); return true; }
    if (p === '/music-player') { ctx.serveFile(req, res, path.join(ctx.PUBLIC_DIR, 'music.html')); return true; }
    if (p === '/manifest.webmanifest') { ctx.send(res, 200, JSON.stringify({ name: 'BeeboScore', short_name: 'BeeboScore', description: 'The BeeboScore control panel', start_url: '/', scope: '/', display: 'standalone', background_color: '#0e0f13', theme_color: '#0e0f13', icons: [{ src: '/static/brand/app-192.png', sizes: '192x192', type: 'image/png' }, { src: '/static/brand/app-512.png', sizes: '512x512', type: 'image/png' }, { src: '/static/brand/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }), 'application/manifest+json'); return true; }
    if (p === '/sw.js') { ctx.serveFile(req, res, path.join(ctx.PUBLIC_DIR, 'sw.js')); return true; }
    let m = p.match(/^\/(music|walkin)\/([a-f0-9]{16})\.(mp3|ogg|m4a|wav|webm)$/);
    if (m && method === 'GET') { const f = path.join(m[1] === 'music' ? MUSIC_DIR : WALKIN_DIR, m[2] + '.' + m[3]); if (!fs.existsSync(f)) { ctx.send(res, 404, 'No sound', 'text/plain'); return true; } const size = fs.statSync(f).size; res.writeHead(200, { 'Content-Type': AUDIO_TYPE[m[3]], 'Content-Length': size, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }); fs.createReadStream(f).pipe(res); return true; }
    m = p.match(/^\/ext\/([a-z0-9-]{2,31})\/(overlay\.js|icon\.svg)$/);
    if (m && method === 'GET') { const f = ext.file(m[1], m[2]); if (!f || !fs.existsSync(f) || !ext.active().some(e => e.id === m[1])) { ctx.send(res, 404, 'Not found', 'text/plain'); return true; } ctx.send(res, 200, fs.readFileSync(f), m[2] === 'icon.svg' ? 'image/svg+xml' : 'text/javascript; charset=utf-8', m[2] === 'icon.svg' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}); return true; }
    // the backup PC's link: this network only, never through the online link
    m = p.match(/^\/mirror\/([A-Za-z0-9_-]{20,40})\/state$/);
    if (m) {
      const tok = (cfg().mirror || {}).token || '';
      if (req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || !(ctx.isHost(req) || ctx.isLan(req)) || !tok || m[1].length !== tok.length || !crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(tok))) { ctx.send(res, 404, { error: 'not here' }); return true; }
      if (!mirrorSeen || Date.now() - mirrorSeen.at > 8000) setTimeout(() => poke('mirror'), 0);        // a backup PC started copying (again)
      mirrorSeen = { at: Date.now(), ip: ctx.clientIp(req) };
      const s = ctx.strip(JSON.parse(JSON.stringify(st())));
      const data = { name: S().stationName || 'Streaming PC', state: s, activeOverlay: cfg().activeOverlay, rundown: cfg().rundown, automations: cfg().automations || [], sponsors: cfg().sponsors, run, settings: Object.fromEntries(MIRROR_SETTINGS.filter(k => k in S()).map(k => [k, S()[k]])) };
      data.rev = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
      ctx.send(res, 200, data, undefined, { 'Cache-Control': 'no-store' }); return true;
    }
    if (galleryHost) { const ip = ctx.clientIp(req); if (await galleryHost.handle(req, res, p, method, url, ctx.readBody, ip)) return true; }
    return false;
  }
  let mirrorSeen = null;

  // ------------------------------------------------------------------------------------------------ routes after sign-in
  async function route(req, res, p, method, url, { local, role, localOnly }) {
    const body = () => ctx.readJSONBody(req).catch(() => ({})).then(b => b || {});
    const okk = d => { ctx.ok(res, d); return true; }, bad = (code, e) => { ctx.fail(res, code, e); return true; };
    const tryDo = async fn => { try { return okk(await fn()); } catch (e) { return bad(e.status || 400, e.message || 'That didn’t work.'); } };
    if (p === '/api/me') return okk({ role, local, name: role === 'to' ? '' : (req.__member && req.__member.name) || '' });
    if (p === '/api/show' && method === 'GET') return okk(panelView());
    if (p === '/api/layout-lang' && method === 'GET') return okk(langOf());
    if (p === '/api/layout-lang' && method === 'POST') { if (role !== 'to') return bad(403, 'Only the TO can do that.'); const b = await body(), n = str(b.name, 60); if (!n) return bad(400, 'Which layout?'); const per = { ...(cfg().layoutLang || {}) }; if (LANGS.includes(b.lang)) per[n] = b.lang; else delete per[n]; cfg().layoutLang = per; save(); changed(); return okk(langOf()); }
    // the rundown
    if (p === '/api/rundown' && method === 'GET') return okk({ ...rundown.view(), plan: cfg().rundown, screens: ctx.layoutScreens(), autos: ctx.autos.list.map(a => ({ id: a.id, name: a.name })), templates: templates().map(t => ({ name: t.name, n: t.list.length, at: t.at })) });
    if (p === '/api/rundown' && method === 'POST') {
      const b = await body();
      if (b.plan && role === 'to') { cfg().rundown = RD.clean(b.plan); if (run.idx >= cfg().rundown.list.length) run = { idx: -1, segStart: 0, showStart: 0 }; save(); changed(); }
      if (b.starter && role === 'to') { cfg().rundown = RD.starter(); save(); changed(); }
      if (b.template && typeof b.template === 'object') {         // 1.12.19: rundowns saved by name ("Weekly", "Major") and loaded into the next show
        if (role !== 'to') return bad(403, 'Only the TO can do that.');
        const t = b.template, name = str(t.name, 40); if (!name) return bad(400, 'Give the rundown a name.');
        let l = templates();
        if (t.do === 'save') { if (!cfg().rundown.list.length) return bad(400, 'The rundown is empty.'); l = [{ name, ...RD.clean(cfg().rundown), at: Date.now() }, ...l.filter(x => x.name.toLowerCase() !== name.toLowerCase())].slice(0, 20); }
        else if (t.do === 'delete') l = l.filter(x => x.name !== name);
        else if (t.do === 'load') { const x = l.find(y => y.name === name); if (!x) return bad(404, 'There’s no saved rundown called that.'); cfg().rundown = RD.clean({ list: x.list.map(sg => ({ ...sg, id: undefined })), startAt: x.startAt }); run = { idx: -1, segStart: 0, showStart: 0 }; ctx.saveLater(runFile, () => run, 100); changed(); }
        else return bad(400, 'Save, load or delete?');
        cfg().rundownTemplates = l; save(); poke('templates');
        return okk({ ...rundown.view(), plan: cfg().rundown, templates: l.map(x => ({ name: x.name, n: x.list.length, at: x.at })) });
      }
      if (b.do) return tryDo(() => rundown.action(b));
      return okk({ ...rundown.view(), plan: cfg().rundown });
    }
    // the show log
    if (p === '/api/showlog' && method === 'GET') {
      const f = url.searchParams.get('export');
      if (f) { const t = slog.exportText(f === 'csv' ? 'csv' : 'txt'); ctx.send(res, 200, t, f === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8', { 'Content-Disposition': `attachment; filename="Show log ${new Date().toISOString().slice(0, 10)}.${f === 'csv' ? 'csv' : 'txt'}"` }); return true; }
      return okk(slog.view(Math.min(600, Number(url.searchParams.get('limit')) || 200)));
    }
    if (p === '/api/showlog/undo' && method === 'POST') {
      const b = await body(), r = slog.get(b.id); if (!r || !r.before) return bad(404, 'That point is too far back to undo to.');
      ctx.setState(JSON.parse(r.before), { replace: true }); note('undo', `Put back to before “${r.text}”`); return okk(slog.view());
    }
    if (p === '/api/showlog/mark' && method === 'POST') { const b = await body(); note('note', str(b.text, 160) || 'Note'); return okk(slog.view()); }
    // 1.12.19: "Try with sample data" — made-up players and a season to try the cards with, during a rehearsal only
    if (p === '/api/sample' && method === 'POST') {
      if (role !== 'to') return bad(403, 'Only the TO can do that.');
      const b = await body();
      if (b.do === 'clear') { const n = profiles.clearSample() + seasons.clearSample(); changed(); poke('profiles', 'seasons'); return okk({ cleared: n }); }
      if (!reh.on) return bad(400, 'Sample data is for rehearsals — start one first (Show tab › Rehearsal).');
      return tryDo(() => { addSample(); changed(); poke('profiles', 'seasons'); return { ok: true }; });
    }
    if (p === '/api/rehearsal' && method === 'POST') { const b = await body(); return tryDo(() => (b.do === 'stop' ? rehStop() : rehStart())); }
    // players
    if (p === '/api/profiles' && method === 'GET' && url.searchParams.get('export') === 'csv') { ctx.send(res, 200, '\uFEFF' + profiles.exportCsv(), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="Player profiles.csv"' }); return true; }
    if (p === '/api/profiles/import' && method === 'POST') { if (role !== 'to') return bad(403, 'Only the TO can do that.'); return tryDo(async () => { const t = String(await ctx.readBody(req, 4 * 1024 * 1024)); const r = profiles.importCsv(t); changed(); poke('profiles'); note('players', `Profiles imported: ${r.added} new, ${r.updated} updated`); return r; }); }
    if (p === '/api/profiles' && method === 'GET') return okk({ list: profiles.list().map(x => ({ ...x, pic: ctx.picUrl(x.name) || (x.avatar ? '/img?u=' + encodeURIComponent(x.avatar) : '') })), socials: PEOPLE.SOCIALS });
    let m = p.match(/^\/api\/profiles\/(.+)$/);
    if (m && method === 'GET') { const n = decodeURIComponent(m[1]), x = profileOf(n); return okk({ profile: x || { name: n }, record: ctx.hist.player(n), results: seasons.results(n).slice(0, 10), rank: seasons.rankOf(n) }); }
    if (p === '/api/profiles' && method === 'POST') {
      const b = await body();
      if (b.remove) { profiles.remove(b.remove); changed(); poke('profiles'); return okk({ ok: true }); }
      if (b.merge && typeof b.merge === 'object') return tryDo(() => { const keep = str(b.merge.keep, 60), drop = str(b.merge.drop, 60), r = profiles.merge(keep, drop), n = seasons.renamePlayer(drop, r.name); changed(); poke('profiles', 'seasons'); note('players', `Profiles merged: ${drop} → ${r.name}`); return { profile: r, seasonResults: n }; });
      return tryDo(() => { const r = profiles.set(b.name, b.profile || {}); changed(); poke('profiles'); return { profile: r }; });
    }
    if (p === '/api/profiles/music' && method === 'POST') {
      if (localOnly()) return true;
      const n = str(url.searchParams.get('name'), 60); if (!n) return bad(400, 'Which player?');
      return tryDo(async () => { const buf = await ctx.readBody(req, 26 * 1024 * 1024); const f = saveUpload(WALKIN_DIR, buf, req.headers['content-type']); const r = profiles.set(n, { walkin: { file: f, title: str(url.searchParams.get('title'), 60), vol: 80 } }); return { profile: r }; });
    }
    if (p === '/api/profiles/music' && method === 'DELETE') { const n = str(url.searchParams.get('name'), 60); return tryDo(() => ({ profile: profiles.set(n, { walkin: null }) })); }
    if (p === '/api/results/post' && method === 'POST') {          // the results graphics (made in the app) to Discord
      const b = await body(), list = (Array.isArray(b.images) ? b.images : []).slice(0, 4);
      if (!list.length) return bad(400, 'No pictures to post.');
      let n = 0; for (const im of list) if (ctx.notify('graphic', str(im.text, 300) || '🏆 Results', { png: String(im.png || ''), name: (str(im.name, 60).replace(/[^\w\- ]+/g, '') || 'results') + '.png', force: !!b.force })) n++;
      if (!n) return bad(400, 'Discord isn’t set up, or posting results graphics is switched off (Stream tab › Discord).');
      note('graphic', `Results graphics posted to Discord (${n})`); return okk({ posted: n });
    }
    if (p === '/api/storylines' && method === 'GET') return okk({ list: storyList(), p1: st().p1.name, p2: st().p2.name, round: st().round });
    if (p === '/api/event-stats' && method === 'GET') return okk(evStats());
    if (p === '/api/seasons' && method === 'GET' && url.searchParams.get('export') === 'csv') { try { const x = seasons.exportCsv(url.searchParams.get('id') || ''); ctx.send(res, 200, '\uFEFF' + x.csv, 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="${x.name.replace(/[^\w\- ]+/g, '').trim() || 'Season'}.csv"` }); } catch (e) { bad(404, e.message); } return true; }
    if (p === '/api/seasons/import' && method === 'POST') { if (role !== 'to') return bad(403, 'Only the TO can do that.'); return tryDo(async () => { const t = String(await ctx.readBody(req, 8 * 1024 * 1024)); const r = seasons.importCsv(t, url.searchParams.get('name') || ''); changed(); poke('seasons'); return r; }); }
    if (p === '/api/seasons' && method === 'GET') return okk(seasons.view());
    if (p === '/api/seasons' && method === 'POST') {
      const b = await body();
      if (b.do === 'addBracket') { const mo = ctx.bracket(); if (!mo || !(mo.standings || []).length) return bad(400, 'The bracket has no results yet.'); return tryDo(() => { const r = seasons.action({ do: 'addEvent', name: b.name || ctx.bracketTitle() || mo.vtName || mo.name || st().event, standings: mo.standings.map(s => ({ name: s.name, place: s.place })) }); changed(); return r; }); }
      return tryDo(() => { const r = seasons.action(b); changed(); poke('seasons'); return r; });
    }
    // viewers
    if (p === '/api/crowd' && method === 'GET') return okk({ pred: crowd.predView(), poll: crowd.pollView(), hype: crowd.hypeView(), prefs: pref(), twitch: crowd.twView(), autos: ctx.autos.list.map(a => ({ id: a.id, name: a.name })) });
    if (p === '/api/crowd' && method === 'POST') {
      const b = await body();
      if (b.prefs && typeof b.prefs === 'object') { const P = b.prefs, c = { ...(cfg().crowd || {}) }; for (const k of ['predAuto', 'predChat', 'pollChat', 'hype', 'hypeShow', 'twAuto']) if (k in P) c[k] = !!P[k]; if ('hypeFull' in P) c.hypeFull = Math.max(5, Math.min(1000, Number(P.hypeFull) || 40)); if ('twWindow' in P) c.twWindow = Math.max(30, Math.min(1800, Number(P.twWindow) || 120)); cfg().crowd = c; save(); changed(); }
      if (b.twitch) return tryDo(() => action({ action: 'twpred', ...b.twitch }));
      return okk({ pred: crowd.predView(), poll: crowd.pollView(), hype: crowd.hypeView(), prefs: pref(), twitch: crowd.twView() });
    }
    // media: the recap video and vertical clips
    if (p === '/api/media' && method === 'GET') { if (localOnly()) return true; const s = await media.status(); return okk({ ...s, job: mediaJob, days: highlightDays() }); }
    if (p === '/api/media/download' && method === 'POST' && media.downloading) { if (localOnly()) return true; const b = await body(); if (b.cancel) { media.cancelDownload(); return okk({ cancelled: true }); } return bad(409, 'FFmpeg is downloading already.'); }
    if (p === '/api/media/clips' && method === 'GET') { if (localOnly()) return true; return okk({ list: clipList(), folder: path.join(D, 'highlights') }); }
    if (p === '/api/media/clips' && method === 'POST') {
      if (localOnly()) return true; const b = await body(), f = clipPath(b.remove || b.open);
      if (!f) return bad(404, 'That clip isn’t there any more.');
      if (b.open) { ctx.openPath(path.dirname(f)); return okk({ ok: true }); }
      try { fs.rmSync(f, { force: true }); } catch (e) { return bad(400, 'Couldn’t delete it: ' + e.message); }
      note('video', `Clip deleted: ${path.basename(f)}`); poke('clips'); return okk({ list: clipList() });
    }
    if (p === '/api/media/download' && method === 'POST') { if (localOnly()) return true; const qb = await body(); if (qb.cancel) return okk({ cancelled: false }); Object.assign(mediaJob, { what: 'download', text: 'Starting the download…', frac: 0, file: '', error: '' }); media.download((t, f) => { mediaJob.text = t; mediaJob.frac = f; ctx.panel('media', { job: mediaJob }); }, { force: process.env.FFMPEG_DOWNLOAD_TEST === '1' }).then(() => { mediaJob.text = 'FFmpeg is ready'; mediaJob.what = ''; ctx.panel('media', { job: mediaJob }); poke('media'); }).catch(e => { if (/cancelled/i.test(e.message)) { mediaJob.text = 'Download cancelled — nothing was kept'; mediaJob.frac = 0; } else mediaJob.error = e.message; mediaJob.what = ''; ctx.panel('media', { job: mediaJob }); poke('media'); }); return okk({ started: true }); }
    if (p === '/api/media/recap' && method === 'POST') {
      if (localOnly()) return true;
      const b = await body(), day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day || '')) ? b.day : new Date().toISOString().slice(0, 10);
      const dir = path.join(D, 'highlights', day); let clips = []; try { clips = fs.readdirSync(dir).filter(f => /\.(mkv|mp4|mov|flv|ts|webm)$/i.test(f) && !/^Recap /.test(f)).map(f => path.join(dir, f)).sort((x, y) => fs.statSync(x).mtimeMs - fs.statSync(y).mtimeMs); } catch {}
      const out = path.join(D, 'highlights', `Recap ${day}.mp4`);
      Object.assign(mediaJob, { what: 'recap', text: 'Starting…', frac: 0, file: '', error: '' });
      media.recap({ clips, cards: Array.isArray(b.cards) ? b.cards.slice(0, 6) : [], out, onProgress: (t, f) => { mediaJob.text = t; mediaJob.frac = f; ctx.panel('media', { job: mediaJob }); } })
        .then(r => { mediaJob.file = r.file; mediaJob.text = `Recap ready: ${r.clips} clips`; ctx.panel('media', { job: mediaJob }); note('video', 'Recap video made'); poke('clips'); })
        .catch(e => { mediaJob.error = e.message; ctx.panel('media', { job: mediaJob }); });
      return okk({ started: true, clips: clips.length });
    }
    if (p === '/api/media/vertical' && method === 'POST') {
      if (localOnly()) return true;
      const b = await body(); const src = String(b.path || '');
      if (!src || !path.isAbsolute(src) || !fs.existsSync(src)) return bad(400, 'OBS saved the clip somewhere this app can’t reach.');
      const day = new Date().toISOString().slice(0, 10), dir = path.join(D, 'highlights', day, 'vertical'); fs.mkdirSync(dir, { recursive: true });
      const nice = String(b.name || 'Clip').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'Clip'; let out = path.join(dir, nice + ' (vertical).mp4'), i = 2; while (fs.existsSync(out)) out = path.join(dir, `${nice} (vertical ${i++}).mp4`);
      return tryDo(async () => { const r = await media.vertical({ clip: src, top: b.top, bottom: b.bottom, out }); note('video', `Vertical clip saved: ${path.basename(r.file)}`); poke('clips'); return { file: r.file, name: path.basename(r.file), folder: dir }; });
    }
    if (p === '/api/media/open' && method === 'POST') { if (localOnly()) return true; const b = await body(); const f = String(b.file || ''); const dir = f && f.startsWith(path.join(D, 'highlights')) && fs.existsSync(f) ? f : path.join(D, 'highlights'); fs.mkdirSync(path.join(D, 'highlights'), { recursive: true }); ctx.openPath(dir); return okk({ ok: true }); }
    // music
    if (p === '/api/music' && method === 'GET') return okk({ ...musicCfg(), duck: musicRun.duck });
    if (p === '/api/music' && method === 'POST') {
      const ct = String(req.headers['content-type'] || '');
      if (ct.startsWith('audio/')) { if (localOnly()) return true; return tryDo(async () => { const buf = await ctx.readBody(req, 26 * 1024 * 1024), f = saveUpload(MUSIC_DIR, buf, ct), m2 = musicCfg(); if (!m2.list.some(t => t.file === f)) m2.list.push({ file: f, title: str(url.searchParams.get('title'), 80) || 'Track' }); cfg().music = { ...(cfg().music || {}), list: m2.list }; save(); changed(); return { ...musicCfg(), duck: musicRun.duck }; }); }
      const b = await body(), cur = { ...(cfg().music || {}) };
      for (const k of ['on', 'shuffle', 'autoDuck']) if (k in b) cur[k] = !!b[k];
      for (const k of ['vol', 'duckTo']) if (k in b) cur[k] = Math.max(0, Math.min(100, Number(b[k]) || 0));
      if (Array.isArray(b.order)) { const l = musicCfg().list; cur.list = b.order.map(f => l.find(t => t.file === f)).filter(Boolean); }
      if (b.remove) { cur.list = musicCfg().list.filter(t => t.file !== b.remove); try { fs.rmSync(path.join(MUSIC_DIR, path.basename(String(b.remove))), { force: true }); } catch {} }
      cfg().music = cur; save(); changed(); return okk({ ...musicCfg(), duck: musicRun.duck });
    }
    // the backup PC
    if (p === '/api/mirror' && method === 'GET') { if (localOnly()) return true; const t = (cfg().mirror || {}).token; return okk({ link: t ? ctx.lanUrls().slice(1).map(u => `${u}/mirror/${t}`) : [], on: !!t, path: t ? `/mirror/${t}` : '', seen: mirrorSeen, from: mirror.view() }); }
    if (p === '/api/mirror' && method === 'POST') {
      if (localOnly()) return true;
      const b = await body();
      if (b.make) cfg().mirror = { token: crypto.randomBytes(18).toString('base64url') };
      if (b.revoke) cfg().mirror = {};
      if ('from' in b) { const u = b.from ? mirror.valid(b.from) : ''; if (b.from && !u) return bad(400, 'Paste the link from the streaming PC (Settings › Backup PC there).'); cfg().mirrorFrom = { ...(cfg().mirrorFrom || {}), url: u, standby: !!u }; save(); u ? mirror.start() : mirror.stop(); }
      if ('auto' in b) cfg().mirrorFrom = { ...(cfg().mirrorFrom || {}), auto: !!b.auto, autoSecs: Math.max(5, Math.min(120, Number(b.autoSecs) || 10)) };
      if (b.takeOver) mirror.takeOver('button');
      if (b.standby) { cfg().mirrorFrom = { ...(cfg().mirrorFrom || {}), standby: true }; mirror.start(); }
      save(); const t = (cfg().mirror || {}).token; return okk({ link: t ? ctx.lanUrls().slice(1).map(u => `${u}/mirror/${t}`) : [], on: !!t, path: t ? `/mirror/${t}` : '', seen: mirrorSeen, from: mirror.view() });
    }
    // sync between PCs
    if (p === '/api/sync' && method === 'GET') { if (localOnly()) return true; return okk(sync.view()); }
    if (p === '/api/sync' && method === 'POST') {
      if (localOnly()) return true;
      const b = await body(), c = { ...(cfg().sync || {}) };
      if ('dir' in b) { const d = String(b.dir || '').trim(); if (d && !sync.okDir(d)) return bad(400, 'That folder isn’t there (use the full path, e.g. C:\\Users\\you\\OneDrive).'); c.dir = d; }
      if ('on' in b) c.on = !!b.on;
      cfg().sync = { ...cfg().sync, ...c }; save();
      if (b.now || ('on' in b && b.on)) sync.write(true);
      if (b.take) return tryDo(() => { const o = sync.take(); return { took: o.name, restarting: true }; });
      return okk(sync.view());
    }
    // team accounts
    if (p === '/api/team' && method === 'GET') { if (role !== 'to') return bad(403, 'Only the TO can do that.'); return okk(team.view()); }
    if (p === '/api/team' && method === 'POST') {
      if (role !== 'to' || !local) return bad(403, 'Only the PC running the app can change the team.');
      const b = await body();
      return tryDo(() => { const r = b.remove ? team.remove(b.remove) : b.id ? team.update(b) : team.add(b); ctx.dropSessions(b.remove || (b.password || b.role ? b.id : '')); return r; });
    }
    // extensions
    if (p === '/api/extensions' && method === 'GET') return okk({ list: ext.installed() });
    if (p === '/api/extensions' && method === 'POST') {
      if (localOnly()) return true;
      const ct = String(req.headers['content-type'] || '');
      if (!ct.includes('json') || url.searchParams.has('install')) return tryDo(async () => { const m2 = ext.install(await ctx.readBody(req, 1024 * 1024)); ctx.refreshOverlays(); note('ext', `Extension installed: ${m2.name}`); return { list: ext.installed(), installed: m2 }; });
      const b = await body();
      if (b.remove) { ext.remove(b.remove); ctx.refreshOverlays(); }
      if (b.toggle) { ext.toggle(b.toggle, b.on); ctx.refreshOverlays(); }
      if (b.cue) return tryDo(() => action({ action: 'ext', ext: b.ext, cue: b.cue, screen: b.screen, show: b.show }));
      return okk({ list: ext.installed() });
    }
    // the online gallery (the app fetches; pages never talk to the gallery themselves)
    if (p === '/api/gallery-online' && method === 'GET') { const set = !!gallery.base(); if (!set) return okk({ set: false, items: [] }); return tryDo(async () => ({ set, ...(await gallery.list(url.searchParams.get('q') || '', url.searchParams.get('page') || 0)) })); }
    m = p.match(/^\/api\/gallery-online\/thumb\/([a-z0-9]{10})\.png$/);
    if (m) { const buf = await gallery.thumb(m[1]); if (!buf) { ctx.send(res, 404, 'none', 'text/plain'); return true; } ctx.send(res, 200, buf, 'image/png', { 'Cache-Control': 'public, max-age=3600' }); return true; }
    if (p === '/api/gallery-online/get' && method === 'GET') return tryDo(async () => { const r = await gallery.get(url.searchParams.get('id')); const d = r.file && (r.file.design || r.file); GAL.checkDesign(d); return { item: { ...r, file: undefined }, design: d }; });
    if (p === '/api/gallery-online/publish' && method === 'POST') {
      if (localOnly()) return true;
      const b = await body(), name = String(b.name || '');
      return tryDo(async () => { const d = ctx.inlineDesign(name); if (!d) throw new Error('Only Layout Designer layouts can be shared.'); const r = await gallery.publish({ design: d, title: b.title || d.title, author: b.author, blurb: b.blurb, thumb: b.thumb }); const keys = { ...(cfg().galleryKeys || {}) }; keys[r.id] = { key: r.key, name, at: Date.now() }; cfg().galleryKeys = keys; save(); return { id: r.id, link: gallery.base() + r.link }; });
    }
    if (p === '/api/gallery-online/remove' && method === 'POST') { if (localOnly()) return true; const b = await body(), k = (cfg().galleryKeys || {})[b.id]; if (!k) return bad(404, 'This PC didn’t share that one.'); return tryDo(async () => { await gallery.remove(b.id, k.key); delete cfg().galleryKeys[b.id]; save(); return { removed: true }; }); }
    if (p === '/api/gallery-online/mine' && method === 'GET') return okk({ list: Object.entries(cfg().galleryKeys || {}).map(([id, v]) => ({ id, name: v.name, at: v.at, link: gallery.base() ? `${gallery.base()}/l/${id}` : '' })) });
    return false;
  }
  // 1.12.19: the clips the app made (vertical clips and recaps), newest first — an id is the path inside highlights/
  const HL = () => path.join(D, 'highlights');
  function clipList() {
    const out = [], root = HL();
    const add = (dir, rel) => { try { for (const f of fs.readdirSync(dir)) { if (!/\.mp4$/i.test(f) || /\.part\.mp4$/i.test(f)) continue; const st2 = fs.statSync(path.join(dir, f)); out.push({ id: rel ? rel + '/' + f : f, name: f.replace(/\.mp4$/i, ''), at: st2.mtimeMs, mb: Math.round(st2.size / 104857.6) / 10, kind: /^Recap /.test(f) ? 'recap' : 'vertical', path: path.join(dir, f) }); } } catch {} };
    add(root, '');
    try { for (const d of fs.readdirSync(root).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse().slice(0, 14)) add(path.join(root, d, 'vertical'), d + '/vertical'); } catch {}
    return out.sort((a, b) => b.at - a.at).slice(0, 30);
  }
  function clipPath(id) {
    const rel = String(id || ''); if (!/^(\d{4}-\d{2}-\d{2}\/vertical\/)?[^/\\]+\.mp4$/i.test(rel) || rel.includes('..')) return '';
    const f = path.join(HL(), ...rel.split('/')); return f.startsWith(HL() + path.sep) && fs.existsSync(f) ? f : '';
  }
  function highlightDays() { try { return fs.readdirSync(path.join(D, 'highlights')).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(0, 30).map(d => ({ day: d, clips: fs.readdirSync(path.join(D, 'highlights', d)).filter(f => /\.(mkv|mp4|mov|flv|ts|webm)$/i.test(f)).length })); } catch { return []; } }

  return {
    onState, onChat, action, ACTIONS, live: liveX, sd, panelView, publicRoute, route, comebackOf, note, rundown, profiles, seasons, crowd, team, ext, mirror, sync, media, moments, seedOf,
    get rehearsing() { return reh.on; }, get standby() { return mirror.standby; }, setFull, setCard, storyList, evStats, walkinData,
    fromStartgg: list => { const n = profiles.fromStartgg(list); if (n) changed(); return n; },
    close() { rundown.close(); crowd.close(); mirror.stop(); sync.close(); clearInterval(syncWatch); moments.stop(); },
    poke,
    /** 1.12.19: Settings › Health's rows for the video tools, the backup PC and sync */
    async health() {
      const m = await media.status().catch(() => ({ ready: false })), sv = (() => { try { return sync.view(); } catch { return {}; } })(), mv = mirror.view();
      return { ffmpeg: { ready: !!m.ready, where: m.where || '', version: m.ready ? await media.version().catch(() => '') : '', downloading: media.downloading },
        backup: { sharing: !!(cfg().mirror || {}).token, seen: mirrorSeen ? mirrorSeen.at : 0, standby: mv.standby, ok: !!(mv.last && mv.last.ok), quiet: mv.quiet, error: mv.last && mv.last.error || '' },
        sync: { on: !!sv.on, ok: !!sv.ok, wrote: sv.wrote || 0, error: sv.error || '', waiting: sv.waiting ? sv.waiting.name : '' } };
    },
  };
}

module.exports = { createShow, LANGS, SFX, OUT, FULL, CARDS };
