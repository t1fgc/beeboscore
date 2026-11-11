"""Builds this prototype build's control panel (public/index.html) from the full app's panel.
Kept: Matches (basics), start.gg event (sign-in, event, matches, results back), Stream (OBS link + Go online),
the header's Layout picker, the prototype notice at the top, Settings (version and Check for updates), and — in this
build only — the Overlay maker tab.
Everything else is moved into a hidden #liteAttic so the shared panel code still finds its elements.

  python tools/make-lite-panel.py <the full app's public/index.html> public/index.html
Running it on a panel it already built (public/index.html itself) is fine too: the stripping is skipped and only
the steps that are still missing (Layout picker, Overlay maker, Settings, prototype notice, wording) are applied."""
import re, sys
from bs4 import BeautifulSoup
src, out = sys.argv[1], sys.argv[2]
soup = BeautifulSoup(open(src).read(), 'html.parser')
attic = soup.select_one('#liteAttic')
built = attic is not None                      # the source is already a BeeboScore panel
if not built:
    attic = soup.new_tag('div', id='liteAttic', hidden='', style='display:none!important', **{'aria-hidden': 'true'})
    soup.body.append(attic)
def hide(el):
    if el is not None: attic.append(el.extract())
def hideSel(sel):
    for el in soup.select(sel): hide(el)

def layout_picker():
    """Header: the Layout picker stays (layouts made in the Overlay maker are switched there); only the Game picker
    goes to the attic — this build has one built-in layout for every fighting game, and panel.js still needs to find #gamePick."""
    pickers = soup.select_one('.pickers')
    if pickers.find_parent(id='liteAttic'): soup.select_one('header .brand').insert_after(pickers.extract())
    game = soup.select_one('#gamePick')
    if game and not game.find_parent(id='liteAttic'): hide(game.find_parent('div', class_='picker'))

def maker_tab():
    """The Overlay maker: a rail tab and an empty section that public/maker-panel.js builds itself into (#mkRoot).
    Only on the PC running the app (.local-only) — the picture work and /api/maker/* are local."""
    if soup.select_one('#mkRoot'): return
    rail = soup.select('nav.rail button[data-tab]')[-1]
    rail.insert_after(BeautifulSoup('<button class="local-only" data-tab="maker" title="Turn a static PNG overlay into an animated layout"><svg viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64a4 4 0 1 0-4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36A3.9 3.9 0 0 0 6 14a4 4 0 1 0 4 4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6-7.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zM19 3l-6 6 2 2 7-7V3h-3z"/></svg>Overlay maker</button>', 'html.parser'))
    soup.select('main > section.tab')[-1].insert_after(BeautifulSoup('<!-- ===================== OVERLAY MAKER (this build only) ===================== -->\n<section class="tab local-only" data-tab="maker"><div id="mkRoot"></div></section>', 'html.parser'))
    soup.select('script[src]')[-1].insert_after(BeautifulSoup('<script src="/static/maker-panel.js"></script>', 'html.parser'))

PROTO_CSS = """
/* BeeboScore: the prototype notice at the top of every tab (open the first time, remembers being closed) */
.proto { border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 12px; background: var(--card); margin-bottom: 4px; }
.proto summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 13px; }
.proto summary::-webkit-details-marker { display: none; }
.proto summary b { color: var(--accent); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.proto summary span { color: var(--muted); flex: 1; min-width: 0; }
.proto summary i { font-style: normal; font-size: 12px; font-weight: 700; color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 3px 10px; white-space: nowrap; }
.proto summary i::before { content: 'Show'; }
.proto[open] summary i::before { content: 'Hide'; }
.proto summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 10px; }
.proto .proto-body { padding: 2px 16px 14px; font-size: 13.5px; line-height: 1.5; }
.proto .proto-body p { margin: 0 0 8px; }
.proto ul { margin: 0; padding-left: 18px; }
.proto li { margin: 3px 0; }
.proto li b { color: var(--text); }
body.mk-open .proto { margin: 14px 26px; }
"""
PROTO_HTML = """<details class="proto" id="protoNote" open>
<summary><b>Prototype build</b><span>A new build is on the way later in 2026.</span><i aria-hidden="true"></i></summary>
<div class="proto-body">
<p>This is only a prototype build. A new build is coming later in 2026, and it will include all of the following:</p>
<ul>
<li><b>Multiple supported game formats:</b> Team Battle, KOTH, Death Battle and more</li>
<li><b>Twitch integration</b> for Viewer Battles and Tournaments</li>
<li><b>Bracket Generator</b> with custom overlays</li>
<li><b>Layout Designer</b> with so many features creators will love to start creating their own overlays!</li>
<li>And more!</li>
</ul>
</div>
</details>
"""

def proto_note():
    """The notice at the top of the app: this is a prototype, and what the next build brings. A native <details>, open the
    first time; public/prototype-note.js remembers when it's been closed."""
    style = soup.select_one('#liteStyle')            # each part is added only if it's missing, and the style always follows PROTO_CSS
    if style: style.string = PROTO_CSS
    else: soup.head.append(BeautifulSoup('<style id="liteStyle">' + PROTO_CSS + '</style>', 'html.parser'))
    if not soup.select_one('#protoNote'): soup.select_one('main').insert(0, BeautifulSoup(PROTO_HTML, 'html.parser'))
    if not soup.select_one('script[src="/static/prototype-note.js"]'): soup.select('script[src]')[-1].insert_after(BeautifulSoup('<script src="/static/prototype-note.js"></script>', 'html.parser'))

def settings_tab():
    """Settings: in this build it's one card — the app's version and "Check for updates". The card comes back out of the
    attic; the full app's self-test and setup-wizard buttons in it stay there. Only on the PC running the app."""
    if soup.select_one('main > section.tab[data-tab="settings"]'): return
    card = soup.select_one('#updCard')
    extras = soup.select_one('#selfTest')
    if extras and extras.find_parent(id='updCard'): hide(extras.find_parent('div', class_='inline'))
    soup.select_one('#updUnsupported').string = 'Checking for updates works in the desktop app, on the PC that runs it.'
    soup.select('main > section.tab')[-1].insert_after(BeautifulSoup('<!-- ===================== SETTINGS (this build: updates & about) ===================== -->\n<section class="tab local-only" data-tab="settings"></section>', 'html.parser'))
    soup.select_one('main > section.tab[data-tab="settings"]').append(card.extract())
    soup.select('nav.rail button[data-tab]')[-1].insert_after(BeautifulSoup('<button class="local-only" data-tab="settings" title="Version and updates"><svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>Settings</button>', 'html.parser'))

# Wording left over from the full app (mostly in the hidden attic) that names a single game: this build is for every
# fighting game, so those lines are reworded. Patterns, so no game has to be named here either.
SCRUB = [
    (r'(start\.gg/tournament/my-weekly/event/)[a-z0-9-]+', r'\1singles'),
    (r'(gives the set point to whoever wins a game\.) [^<]*? for now\.', r'\1'),
    (r'like the [^<]*? overlay\.', 'like the Shattered overlay.'),
    (r'under [A-Z][^<,]*? light, ', 'under special-move lighting, '),
    (r'named after the characters — [^<"]*?…', 'named after the characters — Fighter-One.png, Fighter-Two.png…'),
]

def strip():
    soup.title.string = 'BeeboScore'
    for l in soup.select('link[href="/static/twitch-panel.css"], link[href="/static/autoscore/tab.css"]'): l.decompose()
    soup.select_one('.brand b').string = 'BeeboScore'
    for sel in ['#latChip', '#miniBtn', '#updBanner', '#sdBanner']: hideSel(sel)
    KEEP = ('match', 'bracket', 'stream')
    for btn in soup.select('nav.rail button'):
        if btn.get('data-tab') not in KEEP:
            for b in btn.select('i.badge'): hide(b)
            btn.decompose()
        elif btn.get('data-tab') == 'bracket':
            btn.contents[-1].replace_with('start.gg')
    for sec in soup.select('section.tab'):
        if sec.get('data-tab') not in KEEP: hide(sec)
    # Matches tab
    for sel in ['#wnCard', '#obsWarn', '#quickStart', '#screensCard', '#vsCard', '#customCard', '#winGF', 'a[data-goto="settings"]', '#swapCasters']: hideSel(sel)
    for side in ('p1', 'p2'):
        for path in (f'{side}.pronouns', f'{side}.country', f'{side}.character'):
            el = soup.select_one(f'[data-path="{path}"]')
            if el and el.find_parent('div', class_='row'): hide(el.find_parent('div', class_='row'))
    ev = soup.select_one('[data-path="event"]'); card = ev.find_parent('div', class_='card')
    for path in ('game', 'c1.name', 'c1.handle', 'c2.name', 'c2.handle'):
        el = soup.select_one(f'[data-path="{path}"]')
        if el: hide(el.find_parent('div', class_='field'))
    h2 = card.find('h2'); [c.extract() for c in list(h2.contents)]; h2.append('Event')
    for row in card.select('.row'):
        if not row.select('input'): row.decompose()
    # start.gg tab: the event only — no viewer tournaments, bracket splash or share/export
    br = soup.select_one('section[data-tab="bracket"]')
    t = br.select_one('h1.pagetitle'); t.contents[0].replace_with('start.gg event ')
    p = t.find_next_sibling('p'); p.string = 'Sign in, load your event, and pull its players and matches onto the scoreboard. Results can go back to start.gg when a set ends.'
    for sel in ['#brSrc', '#vtCard', '#splashCard', '#shareCard']: hideSel(sel)
    # Stream tab: OBS link + Go online
    st = soup.select_one('section[data-tab="stream"]')
    for c in st.select(':scope > .card'):
        if c.get('id') != 'onlineCard' and not (c.find('h2') and c.find('h2').get_text(strip=True) == 'OBS'): hide(c)
    hideSel('#openOutput')
    for p in st.select('.card p.hint'):
        if '.txt' in p.get_text(): hide(p)
    nt = soup.select_one('#ntBox p.hint'); nt.clear()
    nt.append(BeautifulSoup("With a free Cloudflare account and your own domain, the online link stays the same every time. In the Cloudflare dashboard: <b>Networking › Tunnels › Create Tunnel</b>, pick Windows, and copy the install command (don't run it — BeeboScore runs the tunnel itself). Paste it below, then on the tunnel's <b>Routes</b> tab add a <b>Published application</b> (e.g. <code>bracket.yourdomain.com</code>) with the service URL <code>http://localhost:3300</code>. The token is stored encrypted on this PC.", 'html.parser'))
    for sel in ['#nameModal', '#wiz', '#potatoModal', '#pvSnd']: hideSel(sel)
    for m in soup.select('meta[name="sb-sound-panel"]'): m.decompose()
    # header: show / hide the whole overlay (downtime)
    undo = soup.select_one('#undoBtn')
    undo.insert_before(BeautifulSoup('<button class="btn ghost sm ov-toggle" id="ovBtn" title="Hide the whole overlay during downtime, show it again when you\'re back (Ctrl+Shift+H)"><svg viewBox="0 0 24 24"><path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg><span>Overlay on</span></button>', 'html.parser'))
    for sc in soup.select('script[src]'):
        if sc['src'] not in ('/static/keys.js', '/static/panel.js', '/static/report-panel.js'): sc.decompose()
    first = soup.select_one('script[src]'); first.insert_before(attic.extract())
    last = soup.select('script[src]')[-1]; last.insert_after(BeautifulSoup('<script src="/static/overlay-toggle.js"></script>', 'html.parser'))

if not built: strip()
layout_picker()
maker_tab()
settings_tab()
proto_note()
html = str(soup).replace('>Bracket</a> tab', '>start.gg</a> tab')
for pattern, new in SCRUB: html = re.sub(pattern, new, html)
open(out, 'w').write(html)
