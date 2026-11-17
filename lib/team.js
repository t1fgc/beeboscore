'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — team accounts for remote access.
 *
 * The remote-access password (Settings › Remote access) stays the TO's: it opens everything. Team members each get
 * their own name, password and role:
 *   to         everything (another tournament organiser)
 *   operator   the operator's remote: scores, splashes, screens, the rundown, sponsors, polls and picks — no settings
 *   caster     the casters' page: the players, storylines, notes and the stats — nothing on stream
 * Passwords are kept as salted scrypt hashes (never in a backup or a sync). Roles are checked on the server for every
 * request; the pages only hide what a role can't use.
 */
const crypto = require('crypto');

const ROLES = { to: 'Tournament organiser (everything)', operator: 'Operator (the remote: scores, splashes, screens, rundown)', caster: 'Caster (the casters’ page: players, storylines, notes)' };
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
function check(pw, stored) {
  const [salt, h] = String(stored || '').split(':'); if (!salt || !h) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), salt, 32).toString('hex')), b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// what each role may reach (the TO and the PC running the app: everything)
const CASTER = [/^\/$/, /^\/casters$/, /^\/api\/casters$/, /^\/api\/notes$/, /^\/api\/storylines$/, /^\/api\/profiles(\/[^/]+)?$/, /^\/api\/history\/matchup$/, /^\/api\/state$/, /^\/api\/me$/, /^\/api\/logout$/, /^\/api\/event-stats$/, /^\/api\/seasons$/];
const OPERATOR = [...CASTER, /^\/op$/, /^\/op\/(status|action)$/, /^\/api\/rundown$/, /^\/api\/showlog$/, /^\/api\/remote\/status$/];
const READONLY_FOR_CASTER = new Set(['/api/state', '/api/profiles', '/api/seasons']);

function allowed(role, p, method) {
  if (role === 'to') return true;
  const list = role === 'operator' ? OPERATOR : role === 'caster' ? CASTER : [];
  if (!list.some(r => r.test(p))) return false;
  if (method !== 'GET' && method !== 'HEAD') {
    if (role === 'caster') return p === '/api/notes' || p === '/api/logout';
    if (role === 'operator') return ['/api/notes', '/api/logout', '/op/action', '/api/rundown'].includes(p);
    if (READONLY_FOR_CASTER.has(p)) return false;
  }
  return true;
}
/** the remote actions the operator role may use (server.js adds the second operator's list) */
const OPERATOR_ACTIONS = ['score', 'setScore', 'swap', 'reset', 'undo', 'undoAny', 'vs', 'playervs', 'victory', 'splash', 'hideAll', 'hideOne', 'screen', 'stinger', 'nextMatch', 'stats', 'sponsor', 'chapter',
  'rundown', 'countdown', 'schedule', 'storyline', 'evstats', 'season', 'walkin', 'pred', 'poll', 'replay', 'replaySlow', 'replayFreeze', 'drawClear', 'hype', 'music'];

function createTeam({ get, set }) {
  const list = () => (get() || []).filter(m => m && m.id && ROLES[m.role]);
  function view() { return { roles: ROLES, members: list().map(m => ({ id: m.id, name: m.name, role: m.role, at: m.at || 0 })) }; }
  function add({ name, role, password }) {
    name = String(name || '').trim().slice(0, 40); if (!name) throw new Error('Give them a name.');
    if (!ROLES[role]) throw new Error('Pick a role.');
    if (String(password || '').length < 8) throw new Error('Use a password of at least 8 characters.');
    const l = list(); if (l.length >= 30) throw new Error('That’s the most team members (30).');
    if (l.some(m => m.name.toLowerCase() === name.toLowerCase())) throw new Error('Someone on the team already has that name.');
    l.push({ id: crypto.randomBytes(6).toString('hex'), name, role, hash: hash(password), at: Date.now() }); set(l); return view();
  }
  function update({ id, role, password, name }) {
    const l = list(), m = l.find(x => x.id === id); if (!m) throw new Error('No such team member.');
    if (role) { if (!ROLES[role]) throw new Error('Pick a role.'); m.role = role; }
    if (name) m.name = String(name).trim().slice(0, 40) || m.name;
    if (password) { if (String(password).length < 8) throw new Error('Use a password of at least 8 characters.'); m.hash = hash(password); }
    set(l); return view();
  }
  function remove(id) { set(list().filter(m => m.id !== id)); return view(); }
  /** the member this password belongs to (or null) */
  function login(name, password) { const n = String(name || '').trim().toLowerCase(); return list().find(m => (!n || m.name.toLowerCase() === n) && check(password, m.hash)) || null; }
  return { view, add, update, remove, login, has: id => list().some(m => m.id === id), get: id => list().find(m => m.id === id) || null };
}

module.exports = { createTeam, allowed, ROLES, OPERATOR_ACTIONS, hash, check };
