/* BeeboScore — Matches tab: pick a game format at the top of Players, and run the format's matches from here.
 * Setup (rosters, rules) stays in the Format tab; this is the control desk while it's live. */
(() => {
  'use strict';
  const P = window.BeeboPanel, FM = window.BeeboFormat; if (!P || !FM) return;
  const { esc, toast } = P;
  const $ = (s, r = document) => r.querySelector(s);
  const tab = $('section.tab[data-tab="match"]');
  const playersCard = [...tab.querySelectorAll('.card')].find(c => /^Players/.test((c.querySelector('h2') || {}).textContent || ''));
  if (!playersCard) return;

  // ------------------------------------------------------------ the picker (top of the Players card)
  const NAMES = { crew: 'Crew battle', sajam: 'Team battle', gauntlet: 'Gauntlet', tdb: 'Team Death Battle', death: 'Death Battle', koth: 'King of the Hill', league: 'League' };
  const EM = Object.fromEntries(FM.presets.map(p => [p[0], p[1]]));
  const pick = document.createElement('div');
  pick.className = 'mf-pick';
  pick.innerHTML = `<label class="l" for="mfPick">Format</label>
    <select class="f" id="mfPick" title="Change the game format. Rosters and rules are set up in the Format tab."><option value="">🎮 Normal match</option>${FM.presets.map(([k, em]) => `<option value="${k}">${em} ${esc(NAMES[k])}</option>`).join('')}</select>
    <a href="#" class="mf-setup" data-goto="format">⚙ Set up in the Format tab</a>`;
  playersCard.querySelector('h2').after(pick);
  const sel = $('#mfPick');
  sel.onchange = async () => {
    const k = sel.value, { F } = FM.get();
    if ((F && F.preset) === k || (!F && !k)) return;
    if (F && F.status === 'live' && !window.confirm(k ? `${F.name} is running. Switch to ${NAMES[k]}? The results so far are cleared (rosters stay).` : `Turn ${F.name} off and go back to normal matches? Its results are cleared.`)) { sync(); return; }
    try {
      if (!k) { await FM.post({ do: 'clear' }); toast('Back to normal matches'); }
      else { if (F && F.status !== 'setup') await FM.post({ do: 'reset' }); await FM.choose(k); toast(`${EM[k]} ${NAMES[k]} picked — add the players in the Format tab, then start it`); }
    } catch (e) { sync(); }
  };

  // ------------------------------------------------------------ the console (above Players)
  const card = document.createElement('div');
  card.className = 'card mf-card'; card.id = 'mfCard'; card.hidden = true;
  playersCard.before(card);

  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  function sideInfo(F, V, x, i) {
    if (!x) return { name: '—', sub: '', tc: '' };
    if (F.kind === 'teams' && F.rules.mode === 'tdb') {
      const t = F.teams[i], vt = V.teams[i], j = t.players.findIndex(p => p.name === x.name), vp = vt.players[j] || {}, lv = Math.max(0, vp.lives || 0), max = F.rules.lives;
      return { name: x.name, tc: t.color, id: `t${i}-${j}`, lives: lv, mp: vt.mp,
        sub: `${esc(t.tag || t.name)} · <span class="mf-hearts">${'❤'.repeat(lv)}<i>${'❤'.repeat(Math.max(0, max - lv))}</i></span>${lv === 1 ? ' <b class="mf-tag">LAST LIFE</b>' : ''}${vp.hits ? ` · cracked ${vp.hits}/${F.rules.setsPerLife}` : ''} · ${vt.left} of ${vt.size} left` };
    }
    if (F.kind === 'teams') {
      const t = F.teams[i], vt = V.teams[i];
      const extra = F.rules.mode === 'paired' ? `${vt.points}/${V.goal} pts` : `${vt.left} of ${vt.size} left`;
      return { name: x.name, tc: t.color, sub: `${esc(t.tag || t.name)} · ${x.coach ? 'coach' : (F.rules.tiers ? 'Tier ' : '#') + x.slot} · ${extra}`, mp: vt.mp };
    }
    const v = (V.fighters || []).find(f => f.id === x.id) || {};
    if (F.kind === 'elim' && F.rules.mode === 'death') {
      const max = v.maxLives || F.rules.lives || 1, lv = Math.max(0, v.lives || 0);
      return { name: x.name, id: x.id, lives: lv, max, sub: `<span class="mf-hearts">${'❤'.repeat(lv)}<i>${'❤'.repeat(Math.max(0, max - lv))}</i></span>${lv === 1 ? ' <b class="mf-tag">LAST LIFE</b>' : ''}` };
    }
    if (F.kind === 'elim') return { name: x.name, sub: `${v.king ? '👑 King · ' : ''}streak ${v.streak || 0} · best ${v.best || 0}` };
    const st = (V.standings || []).find(r => r.name === x.name);
    return { name: x.name, sub: st ? `${ord(st.rank)} · ${st.wins}W ${st.losses}L` : '' };
  }
  function render() {
    const { F, V, pending, S } = FM.get();
    tab.className = tab.className.replace(/\bmfmt-\S+/g, '').trim() + (F ? ` mfmt-${F.preset}${F.status === 'live' ? ' mfmt-live' : ''}` : '');
    sync();
    if (!F || !V) { card.hidden = true; return; }
    card.hidden = false;
    const em = EM[F.preset] || '🎮';
    if (F.status === 'setup') {
      card.innerHTML = `<div class="mf-head"><span class="mf-em">${em}</span><div><b>${esc(F.name)}</b><small>Setting up — ${F.kind === 'teams' ? 'add both teams' : 'add the players'} and pick the rules in the Format tab.</small></div><span class="spacer"></span>
        <a href="#" class="btn" data-goto="format">⚙ Set up</a><button class="btn primary" data-mf="start">▶ Start</button></div>`;
      return;
    }
    if (F.status === 'done') {
      const w = F.kind === 'teams' ? (F.winner >= 0 ? F.teams[F.winner].name : 'It’s a draw') : (V.champion || '—');
      card.innerHTML = `<div class="mf-head"><span class="mf-em">🏆</span><div><b>${esc(w)}</b><small>${esc(F.name)} is over${V.mvp ? ` · MVP ${esc(V.mvp)}` : ''}</small></div><span class="spacer"></span>
        <button class="btn${S && S.splash && S.splash.show === 'fwin' ? ' on' : ''}" data-fs="fwin">🏆 Champion splash</button><button class="btn ghost" data-mf="undo">↶ Undo</button><button class="btn ghost" data-mf="reset">↺ Run it again</button><button class="btn ghost" data-mf="off">✕ Normal matches</button></div>`;
      return;
    }
    const sd = FM.sides(), a = sideInfo(F, V, sd && sd.a, 0), b = sideInfo(F, V, sd && sd.b, 1);
    const sp = (S && S.splash && S.splash.show) || '';
    const lifeBtns = x => x.id ? `<span class="mf-life"><button data-life="${x.id}" data-d="-1" title="Take a life">−❤</button><button data-life="${x.id}" data-d="1" title="Give a life back">＋❤</button></span>` : '';
    const ctx = F.kind === 'teams' && F.rules.mode === 'tdb' ? `${V.teams[0].livesLeft} v ${V.teams[1].livesLeft} lives · ${V.teams[0].left} v ${V.teams[1].left} fighters` : F.kind === 'teams' ? (F.rules.mode === 'paired' ? `${V.teams[0].points} – ${V.teams[1].points} · first to ${V.goal}` : `${V.teams[0].left} v ${V.teams[1].left} left`)
      : F.kind === 'elim' ? (F.rules.mode === 'death' ? `${V.alive} of ${V.total} alive${V.final ? ' · FINAL' : ''}` : `King ${esc(V.king || '—')} · streak ${V.streak}${V.next ? ` · next: ${esc(V.next)}` : ''}`)
      : `${V.played} of ${V.total} played · leader ${esc(V.leader || '—')}`;
    const wn = pending ? (pending === 1 ? a.name : b.name) : '';
    card.innerHTML = `<div class="mf-head"><span class="mf-em">${em}</span><div><b>${esc(F.name)}</b><small>${esc(V.label || '')} · ${ctx}</small></div><span class="spacer"></span>
        <a href="#" class="btn sm ghost" data-goto="format" title="The full board, rosters and results">📋 Board</a><button class="btn sm ghost" data-mf="undo" title="Undo the last result (Ctrl+Alt+Z)">↶ Undo</button></div>
      <div class="mf-sides">
        <div class="mf-side a" ${a.tc ? `style="--tc:${esc(a.tc)}"` : ''}><small>${a.sub}</small><b>${esc(a.name)}</b>${a.mp ? '<i class="mf-tag">MATCH POINT</i>' : ''}${lifeBtns(a)}<button class="btn sm ghost mf-ff" data-ff="1">Forfeit</button></div>
        <span class="mf-vs">VS</span>
        <div class="mf-side b" ${b.tc ? `style="--tc:${esc(b.tc)}"` : ''}><small>${b.sub}</small><b>${esc(b.name)}</b>${b.mp ? '<i class="mf-tag">MATCH POINT</i>' : ''}${lifeBtns(b)}<button class="btn sm ghost mf-ff" data-ff="2">Forfeit</button></div>
      </div>
      ${pending ? `<div class="mf-pending"><b>✔ ${esc(wn)} won the set${F.rules.auto ? ' — moving on by itself' : ''}</b><button class="btn primary" data-mf="confirm">Confirm &amp; next match</button></div>`
        : `<p class="hint mf-hint">Score the match below as usual — when someone reaches FT${F.rules.ft}, confirm it here and the next match loads.</p>`}
      ${F.kind === 'teams' && F.rules.mode === 'tdb' ? switchHTML(F, V) : ''}
      <div class="mf-stream"><span class="lbl">On stream:</span>
        ${F.kind === 'teams' ? `<button class="btn sm${sp === 'fvs' ? ' on' : ''}" data-fs="fvs">🤼 Team VS</button>` : ''}
        <button class="btn sm${sp === 'fboard' ? ' on' : ''}" data-fs="fboard">${F.kind === 'teams' ? '📋 Team board' : F.kind === 'elim' ? (F.rules.mode === 'koth' ? '👑 King board' : '💀 Board') : '📊 Standings'}</button>
        <button class="btn sm${!S || S.fbar !== false ? ' on' : ''}" data-mf="fbar">▁ Format bar</button>
        ${F.kind !== 'teams' ? '<button class="btn sm ghost" data-mf="end" title="Stop now — the best record wins">⏹ End</button>' : ''}</div>
      <div class="kbd-hints"><span><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Enter</kbd> confirm &amp; next</span><span><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Z</kbd> undo the last result</span></div>`;
  }
  // Team Death Battle: who fights next (open after a life is lost, and before the first set)
  function switchHTML(F, V) {
    const open = V.switchOpen, who = V.switching === 'loser' && F.log.length ? [F.log[F.log.length - 1].w === 1 ? 1 : 0] : [0, 1];
    return `<div class="mf-switch${open ? ' open' : ''}"><div class="mf-sw-head"><b>${open ? '🔄 Switch window — who fights next?' : '🔒 Switching opens when a life is lost'}</b>
      <small>${open ? 'Click a fighter to put them in. Benched fighters keep their lives. It locks once the next set starts.' : `${V.lives} ${V.lives === 1 ? 'life' : 'lives'} each · ${V.per === 1 ? '1 set = 1 life' : V.per + ' sets = 1 life'}`}</small>
      ${open ? '<button class="btn sm primary" data-mf="lock">✓ Lock in</button>' : ''}</div>
      <div class="mf-sw-teams">${V.teams.map((t, ti) => `<div class="mf-sw-team" style="--tc:${esc(t.color)}"><small>${esc(t.name)} · ${t.livesLeft} lives</small><div>${t.players.map((p, j) => `<button class="mf-sw-p ${p.state}" data-sw="${ti}:${j}" ${!open || p.out || p.state === 'playing' || !who.includes(ti) ? 'disabled' : ''} title="${p.out ? 'Knocked out' : p.state === 'playing' ? 'Fighting now' : open ? 'Switch in' : ''}">${p.pic ? `<img src="${esc(p.pic)}" alt="">` : ''}<b>${esc(p.name)}</b><span>${p.out ? '☠ out' : `${'❤'.repeat(p.lives)}<i>${'❤'.repeat(Math.max(0, V.lives - p.lives))}</i>`}</span></button>`).join('')}</div></div>`).join('')}</div></div>`;
  }
  function sync() { const { F } = FM.get(); const v = F ? F.preset : ''; if (sel.value !== v && document.activeElement !== sel) sel.value = v; }

  card.addEventListener('click', async e => {
    const t = e.target.closest('[data-mf],[data-fs],[data-ff],[data-life],[data-sw]'); if (!t || t.disabled) return;
    const { F } = FM.get(); if (!F) return;
    try {
      if (t.dataset.fs) return await FM.post({ do: 'splash', kind: t.dataset.fs, show: 'toggle' });
      if (t.dataset.ff) { const sd = FM.sides(); const n = t.dataset.ff === '1' ? sd.a.name : sd.b.name; if (window.confirm(`${n} forfeits this match?`)) await FM.post({ do: 'forfeit', side: Number(t.dataset.ff) }); return; }
      if (t.dataset.sw) { const [ti, j] = t.dataset.sw.split(':').map(Number); return await FM.post({ do: 'swap', side: ti + 1, index: j }, `🔄 ${F.teams[ti].players[j].name} switches in`); }
      if (t.dataset.life && /^t[01]-\d+$/.test(t.dataset.life)) { const [ti, j] = t.dataset.life.slice(1).split('-').map(Number), x = F.teams[ti].players[j]; const n = Math.max(0, Math.min(9, (x.lives || 0) + Number(t.dataset.d))); if (n === 0 && !window.confirm(`${x.name} is out?`)) return; return await FM.post({ do: 'lives', id: t.dataset.life, lives: n }); }
      if (t.dataset.life) { const x = F.fighters.find(y => y.id === t.dataset.life); if (!x) return; const n = Math.max(0, Math.min(9, (x.lives || 0) + Number(t.dataset.d))); if (n === 0 && !window.confirm(`${x.name} is out?`)) return; return await FM.post({ do: 'lives', id: x.id, lives: n }); }
      switch (t.dataset.mf) {
        case 'start': await FM.start(); break;
        case 'confirm': await FM.confirm(); break;
        case 'undo': await FM.post({ do: 'undo' }, '↶ Result undone'); break;
        case 'end': if (window.confirm('End it now? The best record so far wins.')) await FM.post({ do: 'end' }); break;
        case 'reset': if (window.confirm('Run it again from the first match? Results are cleared (rosters stay).')) { await FM.post({ do: 'reset' }); await FM.start(); } break;
        case 'off': await FM.post({ do: 'clear' }); toast('Back to normal matches'); break;
        case 'lock': await FM.post({ do: 'lock' }, '✓ Locked in'); break;
        case 'fbar': await P.api('/api/remote/action', { method: 'POST', body: { action: 'fbar', show: 'toggle' } }); break;
      }
    } catch (er) {}
  });
  window.addEventListener('beebo:state', () => setTimeout(render, 0));
  setTimeout(render, 300);
})();
