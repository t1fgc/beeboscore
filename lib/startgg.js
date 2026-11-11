'use strict';
/*
 * start.gg GraphQL client.
 * Docs: https://developer.start.gg/docs/intro
 * Limits: max ~80 requests / 60s and 1000 objects per request, so pages are kept small.
 */
const ENDPOINT = process.env.STARTGG_ENDPOINT || 'https://api.start.gg/gql/alpha';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// start.gg allows 80 requests a minute per token: stay under 60, wait and retry when it says "too many", and share
// one answer between identical requests made at the same moment.
const RATE = Number(process.env.STARTGG_RATE) || 60, WINDOW = 60000, sent = [], inflight = new Map();
async function slot() {
  for (;;) {
    const now = Date.now(); while (sent.length && now - sent[0] > WINDOW) sent.shift();
    if (sent.length < RATE) { sent.push(now); return; }
    await new Promise(r => setTimeout(r, WINDOW - (now - sent[0]) + 50));
  }
}
async function gql(token, query, variables) {
  const key = query + JSON.stringify(variables || {});
  if (inflight.has(key)) return inflight.get(key);
  const p = gqlNow(token, query, variables).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
async function gqlNow(token, query, variables) {
  if (typeof token === 'function') token = await token();        // signed in with start.gg: a fresh access token each time
  if (!token) throw new Error('Sign in with start.gg (or add an API token) in the Bracket tab first.');
  for (let attempt = 0; ; attempt++) {
    await slot();
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      if (attempt < 1 && !(err && err.name === 'TimeoutError')) { await sleep(1500); continue; }
      throw new Error(err && err.name === 'TimeoutError' ? 'start.gg took too long to answer. Try again.' : "Couldn't reach start.gg. Check your internet connection.");
    }
    if ((res.status === 429 || res.status >= 502) && attempt < 3) {          // busy: back off and try again
      const ra = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.min(30000, ra ? ra * 1000 : 2000 * 2 ** attempt)); continue;
    }
    let body;
    try { body = await res.json(); } catch { throw new Error(`start.gg returned an unexpected response (HTTP ${res.status}).`); }
    if (res.status === 429) throw new Error('start.gg is getting too many requests — BeeboScore will slow down. Try again in a minute.');
    if (res.status === 401 || res.status === 403) throw new Error('start.gg rejected the token. Check it in Developer Settings on start.gg.');
    if (body && body.success === false) {
      if (/rate limit/i.test(body.message || '') && attempt < 3) { await sleep(3000 * 2 ** attempt); continue; }
      throw new Error(body.message || 'start.gg request failed.');
    }
    if (body.errors && body.errors.length && !body.data) throw new Error(body.errors.map(e => e.message).join('; '));
    if (!res.ok) throw new Error(`start.gg error (HTTP ${res.status}).`);
    return body.data;
  }
}


// Accepts a full URL, "tournament/slug/...", or a bare slug.
function parseLink(input) {
  let s = String(input || '').trim();
  s = s.replace(/^(https?:\/\/)?(www\.)?(start|smash)\.gg\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const t = s.match(/^tournament\/([^/]+)/i);
  const tournament = t ? t[1] : (s && !s.includes('/') ? s : null);
  const e = s.match(/^tournament\/([^/]+)\/events?\/([^/]+)/i);
  return { tournament, eventSlug: e ? `tournament/${e[1]}/event/${e[2]}` : null };
}

const TOURNAMENT_Q = `
query Tournament($slug: String!) {
  tournament(slug: $slug) {
    id name slug
    events { id name slug numEntrants videogame { name } }
  }
}`;

const EVENT_BY_SLUG_Q = `
query EventBySlug($slug: String!) {
  event(slug: $slug) { id name slug numEntrants videogame { name } tournament { id name slug } }
}`;

const ENTRANTS_Q = `
query EventEntrants($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo { total totalPages }
      nodes {
        id name
        participants {
          gamerTag prefix
          player { gamerTag prefix user { genderPronoun location { country } images(type: "profile") { url } } }
        }
      }
    }
  }
}`;

// fallback if the richer query is ever rejected (schema changes, permissions)
const ENTRANTS_MIN_Q = `
query EventEntrants($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo { total totalPages }
      nodes { id name participants { gamerTag prefix } }
    }
  }
}`;

const SET_FIELDS = `
  id state fullRoundText identifier round
  phaseGroup { displayIdentifier phase { name } }
  slots { entrant { id name participants { gamerTag prefix } } }
`;

const SETS_Q = (filtered) => `
query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    sets(page: $page, perPage: $perPage, sortType: STANDARD${filtered ? ', filters: { state: [1, 2, 6], hideEmpty: true }' : ''}) {
      pageInfo { total totalPages }
      nodes { ${SET_FIELDS} }
    }
  }
}`;

const STREAM_Q = `
query StreamQueue($slug: String!) {
  tournament(slug: $slug) {
    streamQueue {
      stream { streamName streamSource }
      sets { ${SET_FIELDS} event { id name } }
    }
  }
}`;

async function loadTournament(token, link) {
  const { tournament, eventSlug } = parseLink(link);
  if (!tournament) throw new Error('Paste a start.gg tournament or event link, e.g. start.gg/tournament/my-weekly/event/singles');
  const data = await gql(token, TOURNAMENT_Q, { slug: tournament });
  if (!data || !data.tournament) throw new Error('Tournament not found. Check the link (and that the tournament is public).');
  const t = data.tournament;
  let selectedEventId = null;
  if (eventSlug) {
    const ev = (t.events || []).find(e => (e.slug || '').toLowerCase() === eventSlug.toLowerCase());
    if (ev) selectedEventId = ev.id;
    else {
      const d2 = await gql(token, EVENT_BY_SLUG_Q, { slug: eventSlug }).catch(() => null);
      if (d2 && d2.event) selectedEventId = d2.event.id;
    }
  }
  return {
    id: t.id, name: t.name, slug: t.slug,
    events: (t.events || []).map(e => ({ id: e.id, name: e.name, slug: e.slug, numEntrants: e.numEntrants, game: e.videogame && e.videogame.name })),
    selectedEventId,
  };
}

function mapParticipant(p) {
  const pl = p.player || {};
  const user = pl.user || {};
  return {
    name: p.gamerTag || pl.gamerTag || '',
    team: p.prefix || pl.prefix || '',
    pronouns: user.genderPronoun || '',
    countryName: (user.location && user.location.country) || '',
    avatar: profileImage(user),
  };
}
const profileImage = user => { const im = user && Array.isArray(user.images) && user.images.find(i => i && i.url); return im ? im.url : ''; };

// One player's run in this event: profile picture + completed sets won/lost (DQs not counted).
const RUN_Q = `
query PlayerRun($eventId: ID!, $entrantId: ID!) {
  entrant(id: $entrantId) { id participants { player { user { images(type: "profile") { url } } } } }
  event(id: $eventId) {
    sets(page: 1, perPage: 80, filters: { entrantIds: [$entrantId], state: [3] }) {
      nodes { id winnerId displayScore }
    }
  }
}`;
async function loadRun(token, eventId, entrantId) {
  const data = await gql(token, RUN_Q, { eventId, entrantId });
  const parts = (data && data.entrant && data.entrant.participants) || [];
  const avatar = parts.length === 1 ? profileImage(parts[0].player && parts[0].player.user) : '';
  let wins = 0, losses = 0;
  const nodes = (data && data.event && data.event.sets && data.event.sets.nodes) || [];
  for (const s of nodes) {
    if (!s || s.winnerId == null || /\bDQ\b/i.test(s.displayScore || '')) continue;
    if (String(s.winnerId) === String(entrantId)) wins++; else losses++;
  }
  return { avatar, wins, losses };
}

async function loadEntrants(token, eventId, onProgress) {
  const perPage = 60;
  const out = [];
  let page = 1, totalPages = 1, query = ENTRANTS_Q;
  do {
    let data;
    try { data = await gql(token, query, { eventId, page, perPage }); }
    catch (err) {
      if (query === ENTRANTS_Q && page === 1 && !/token|rate limit/i.test(err.message)) { query = ENTRANTS_MIN_Q; continue; }
      throw err;
    }
    const ents = data && data.event && data.event.entrants;
    if (!ents) break;
    totalPages = (ents.pageInfo && ents.pageInfo.totalPages) || 1;
    for (const n of ents.nodes || []) {
      const parts = n.participants || [];
      if (parts.length === 1) out.push({ ...mapParticipant(parts[0]), entrantId: n.id });
      else {
        // doubles/teams: one entry for the team plus each member
        out.push({ name: n.name, team: '', pronouns: '', countryName: '', avatar: '', entrantId: n.id });
        for (const p of parts) out.push({ ...mapParticipant(p), entrantId: n.id });
      }
    }
    if (onProgress) onProgress(page, totalPages);
    page++;
    if (page <= totalPages) await sleep(800); // stay well under the rate limit
  } while (page <= totalPages && page <= 50);
  return out;
}

const STATE = { 1: 'Not started', 2: 'In progress', 3: 'Completed', 4: 'Ready', 5: 'Invalid', 6: 'Called', 7: 'Queued' };

function mapSet(s, extra = {}) {
  const slots = (s.slots || []).map(sl => {
    const e = sl.entrant;
    if (!e) return null;
    const parts = e.participants || [];
    const single = parts.length === 1 ? parts[0] : null;
    return {
      entrantId: e.id,
      name: single ? single.gamerTag : e.name,
      team: single ? (single.prefix || '') : '',
      displayName: e.name,
    };
  });
  return {
    id: s.id,
    state: s.state, stateText: STATE[s.state] || '',
    round: s.fullRoundText || '',
    roundNum: s.round,
    identifier: s.identifier || '',
    phase: (s.phaseGroup && s.phaseGroup.phase && s.phaseGroup.phase.name) || '',
    pool: (s.phaseGroup && s.phaseGroup.displayIdentifier) || '',
    p1: slots[0] || null,
    p2: slots[1] || null,
    ...extra,
  };
}

async function loadSets(token, eventId) {
  const perPage = 40;
  const out = [];
  let filtered = true;
  for (let page = 1; page <= 5; page++) {
    let data;
    try { data = await gql(token, SETS_Q(filtered), { eventId, page, perPage }); }
    catch (err) {
      if (filtered && page === 1) { filtered = false; page = 0; continue; } // retry without filters
      throw err;
    }
    const sets = data && data.event && data.event.sets;
    if (!sets) break;
    for (const s of sets.nodes || []) out.push(mapSet(s));
    if (page >= ((sets.pageInfo && sets.pageInfo.totalPages) || 1)) break;
    await sleep(800);
  }
  // in progress first, then called/ready, then not started; completed last
  const order = { 2: 0, 6: 1, 4: 1, 7: 2, 1: 3, 3: 9 };
  return out
    .filter(s => s.p1 || s.p2)
    .sort((a, b) => (order[a.state] ?? 5) - (order[b.state] ?? 5));
}

async function loadStreamQueue(token, tournamentSlug) {
  const data = await gql(token, STREAM_Q, { slug: tournamentSlug });
  const queues = (data && data.tournament && data.tournament.streamQueue) || [];
  const out = [];
  for (const q of queues) {
    const stream = (q.stream && q.stream.streamName) || 'Stream';
    for (const s of q.sets || []) out.push(mapSet(s, { stream, event: s.event && s.event.name }));
  }
  return out;
}

// ------------------------------------------------------------ full bracket (bracket / Top 8 splash)
const PHASES_Q = `
query EventPhases($eventId: ID!) {
  event(id: $eventId) {
    id name numEntrants videogame { name } tournament { name }
    phases { id name phaseOrder bracketType
      phaseGroups(query: { page: 1, perPage: 64 }) { nodes { id displayIdentifier bracketType state } } }
  }
}`;
const GROUP_SETS_Q = `
query GroupSets($id: ID!, $page: Int!, $perPage: Int!) {
  phaseGroup(id: $id) {
    id displayIdentifier bracketType
    sets(page: $page, perPage: $perPage, sortType: ROUND) {
      pageInfo { totalPages }
      nodes { id state round fullRoundText identifier winnerId station { number }
        slots { prereqId prereqType prereqPlacement seed { seedNum }
          entrant { id name initialSeedNum participants { gamerTag prefix } }
          standing { stats { score { value } } } } }
    }
  }
}`;
// Which pool to show: the one holding `preferSetId` (the match on stream), else the latest phase that has
// started, preferring a pool with matches in progress. Returns the phases list too (for a picker).
async function loadBracketInfo(token, eventId) {
  const data = await gql(token, PHASES_Q, { eventId });
  const ev = data && data.event;
  if (!ev) throw new Error('Event not found on start.gg.');
  const groups = [];
  for (const ph of (ev.phases || []).slice().sort((a, b) => (a.phaseOrder || 0) - (b.phaseOrder || 0))) {
    const nodes = (ph.phaseGroups && ph.phaseGroups.nodes) || [];
    for (const g of nodes) groups.push({ id: String(g.id), phase: ph.name || '', pool: nodes.length > 1 ? (g.displayIdentifier || '') : '',
      type: g.bracketType || ph.bracketType || '', state: g.state, order: ph.phaseOrder || 0 });
  }
  return { event: ev.name || '', tournament: (ev.tournament && ev.tournament.name) || '', game: (ev.videogame && ev.videogame.name) || '',
    entrants: ev.numEntrants || 0, groups };
}
// Page 1 says how many pages there are; the rest (up to 8) are fetched side by side, a beat apart, so a
// 48-player bracket loads in about the time of two requests (well inside start.gg's 80 requests/minute).
async function loadGroupSets(token, groupId) {
  const out = []; let type = '', pool = '';
  const first = await gql(token, GROUP_SETS_Q, { id: groupId, page: 1, perPage: 30 });
  const g1 = first && first.phaseGroup;
  const total = Math.min(8, (g1 && g1.sets && g1.sets.pageInfo && g1.sets.pageInfo.totalPages) || 1);
  const rest = await Promise.all(Array.from({ length: total - 1 }, (_, i) =>
    sleep(i * 120).then(() => gql(token, GROUP_SETS_Q, { id: groupId, page: i + 2, perPage: 30 }))));
  for (const data of [first, ...rest]) {
    const g = data && data.phaseGroup;
    if (!g) break;
    type = g.bracketType || type; pool = g.displayIdentifier || pool;
    for (const s of (g.sets && g.sets.nodes) || []) {
      out.push({
        id: String(s.id), state: s.state, round: s.round, roundText: s.fullRoundText || '', identifier: s.identifier || '',
        winnerId: s.winnerId == null ? '' : String(s.winnerId), station: s.station && s.station.number ? Number(s.station.number) : 0,
        slots: (s.slots || []).map(sl => {
          const e = sl.entrant, parts = (e && e.participants) || [], one = parts.length === 1 ? parts[0] : null;
          const sc = sl.standing && sl.standing.stats && sl.standing.stats.score ? sl.standing.stats.score.value : null;
          return { prereqId: sl.prereqId == null ? '' : String(sl.prereqId), prereqType: sl.prereqType || '', prereqPlacement: sl.prereqPlacement || null,
            seed: (sl.seed && sl.seed.seedNum) || (e && e.initialSeedNum) || null,
            entrantId: e ? String(e.id) : '', name: e ? (one ? one.gamerTag : e.name) : '', team: one ? (one.prefix || '') : '',
            score: sc == null ? null : Number(sc) };
        }),
      });
    }
  }
  return { type, pool, sets: out };
}

// ------------------------------------------------------------ signed in (OAuth): who you are, and the tournaments you run
async function loadMe(token) {
  const d = await gql(token, `query { currentUser { id slug name player { gamerTag prefix } images { url type } } }`);
  const u = d && d.currentUser; if (!u) return null;
  const img = (u.images || []).find(i => i.type === 'profile') || (u.images || [])[0];
  return { id: String(u.id), slug: u.slug || '', name: (u.player && u.player.gamerTag) || u.name || 'start.gg account', avatar: img ? img.url : '' };
}
/** tournaments you organise or admin (newest first), with their events */
async function loadMyTournaments(token, { page = 1 } = {}) {
  const fields = `nodes { id name slug startAt endAt state numAttendees isOnline city countryCode images { url type } events { id name numEntrants state videogame { name } } } pageInfo { total totalPages }`;
  let d;
  try { d = await gql(token, `query($p:Int){ currentUser { tournaments(query:{ perPage: 20, page: $p, filter: { tournamentView: "admin" } }) { ${fields} } } }`, { p: page }); }
  catch { d = await gql(token, `query($p:Int){ currentUser { tournaments(query:{ perPage: 20, page: $p }) { ${fields} } } }`, { p: page }); }   // older API: no admin filter
  const t = d && d.currentUser && d.currentUser.tournaments;
  return { total: (t && t.pageInfo && t.pageInfo.total) || 0, pages: (t && t.pageInfo && t.pageInfo.totalPages) || 1,
    list: ((t && t.nodes) || []).map(x => { const img = (x.images || []).find(i => i.type === 'profile') || (x.images || [])[0];
      return { id: String(x.id), name: x.name, slug: String(x.slug || '').replace(/^tournament\//, ''), startAt: x.startAt ? x.startAt * 1000 : 0, state: x.state, attendees: x.numAttendees || 0, online: !!x.isOnline, place: [x.city, x.countryCode].filter(Boolean).join(', '),
        image: img ? img.url : '', events: (x.events || []).map(e => ({ id: String(e.id), name: e.name, entrants: e.numEntrants || 0, game: (e.videogame && e.videogame.name) || '' })) }; }) };
}

// ------------------------------------------------------------ final standings (Top 8 standings splash)
const STANDINGS_Q = `
query EventStandings($eventId: ID!) {
  event(id: $eventId) { id name state numEntrants
    standings(query: { page: 1, perPage: 64 }) { nodes { placement entrant { id name participants { gamerTag prefix player { user { images(type: "profile") { url } } } } } } }
  }
}`;
async function loadStandings(token, eventId) {
  const d = await gql(token, STANDINGS_Q, { eventId });
  const ev = d && d.event; if (!ev) return null;
  return { done: ev.state === 'COMPLETED' || ev.state === 3, entrants: ev.numEntrants || 0,
    list: ((ev.standings && ev.standings.nodes) || []).filter(n => n && n.entrant).map(n => {
      const parts = n.entrant.participants || [], one = parts.length === 1 ? parts[0] : null;
      return { place: n.placement, id: String(n.entrant.id), name: (one && one.gamerTag) || n.entrant.name || '', team: (one && one.prefix) || '', avatar: one ? profileImage(one.player && one.player.user) : '' };
    }) };
}

module.exports = { loadStandings, loadMe, loadMyTournaments, parseLink, loadTournament, loadEntrants, loadSets, loadStreamQueue, loadRun, loadBracketInfo, loadGroupSets };

// ---- reporting results back (needs a token from a tournament admin / reporter; signing in asks for tournament.reporter; older sign-ins need signing in again)
/** games won → one entry per game in play order (the winner takes the last one) */
function gameDataFor(winnerId, loserId, wScore, lScore) {
  const w = Math.max(0, Math.round(Number(wScore) || 0)), l = Math.max(0, Math.round(Number(lScore) || 0)), out = [];
  if (!w && !l) return out;
  const seq = [...Array(l).fill(String(loserId)), ...Array(Math.max(0, w - 1)).fill(String(winnerId))];
  // alternate so it reads like a real set, then the winner's final game
  const mixed = []; let a = seq.filter(x => x === String(winnerId)), b = seq.filter(x => x !== String(winnerId));
  while (a.length || b.length) { if (b.length) mixed.push(b.shift()); if (a.length) mixed.push(a.shift()); }
  if (w) mixed.push(String(winnerId));
  mixed.forEach((id, i) => out.push({ winnerId: id, gameNum: i + 1 }));
  return out.slice(0, 30);
}
async function reportSet(token, setId, { winnerId, loserId, wScore, lScore, isDQ = false } = {}) {
  if (!setId || /^preview/.test(String(setId))) throw new Error("This match isn't a real start.gg set yet (both players need to be known on start.gg first).");
  if (!winnerId) throw new Error('No winner to report.');
  const gameData = isDQ ? undefined : gameDataFor(winnerId, loserId, wScore, lScore);
  const d = await gqlNow(token, 'mutation ReportSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) { reportBracketSet(setId: $setId, winnerId: $winnerId, isDQ: $isDQ, gameData: $gameData) { id state } }',
    { setId: String(setId), winnerId: String(winnerId), isDQ: !!isDQ, gameData });
  if (!d || !d.reportBracketSet) throw new Error("start.gg didn't accept the result — is this account an admin or reporter for the tournament?");
  return d.reportBracketSet;
}
async function resetSet(token, setId) {
  const d = await gqlNow(token, 'mutation ResetSet($setId: ID!) { resetSet(setId: $setId) { id state } }', { setId: String(setId) });
  if (!d || !d.resetSet) throw new Error("start.gg didn't reset the set.");
  return d.resetSet;
}
module.exports.reportSet = reportSet; module.exports.resetSet = resetSet; module.exports.gameDataFor = gameDataFor;
