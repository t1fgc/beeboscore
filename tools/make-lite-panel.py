"""Builds this build's control panel (public/index.html) from the full app's panel.
Kept: Matches (basics), Formats (crew and team battles, Team Death Battle, Death Battle, King of the Hill, leagues),
start.gg event (sign-in, event, matches, results back), Stream (OBS link + Go online), the header's Layout picker,
Settings (version and Check for updates), and — in this build only — the Overlay maker tab.
Everything else is moved into a hidden #liteAttic so the shared panel code still finds its elements.

  python tools/make-lite-panel.py <the full app's public/index.html> public/index.html
Running it on a panel it already built (public/index.html itself) is fine too: the stripping is skipped and only
the steps that are still missing (Layout picker, Overlay maker, Settings, VS Splash card, Splash pictures, Formats, wording) are applied."""
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

def no_proto_note():
    """(1.4.0) The prototype notice that used to sit at the top of every tab is gone: its <details id="protoNote">, its
    style (#liteStyle) and public/prototype-note.js are taken out of a panel that still has them."""
    for sel in ('#protoNote', '#liteStyle', 'script[src="/static/prototype-note.js"]'):
        el = soup.select_one(sel)
        if el: el.decompose()

def vs_card():
    """Matches tab: the VS Splash card (its button, each player's record and profile picture link) comes back out of the
    attic and goes last on the tab. This build calls it the VS Splash everywhere."""
    card = soup.select_one('#vsCard')
    if not card.find_parent(id='liteAttic'): return
    soup.select('main > section.tab[data-tab="match"] > .card')[-1].insert_after(card.extract())
    h2 = card.find('h2'); h2.contents[0].replace_with('VS Splash ')
    card.select_one('#vsToggle').string = 'Show VS Splash'
    card.select_one('p.hint').string = ("Covers the scoreboard with a player-vs-player splash in the layout's style. Players loaded from start.gg get their "
                                        "profile picture and bracket record (wins – losses in this event) automatically. To give a player a character image "
                                        "instead, use Splash pictures on the start.gg tab.")

def pics_card():
    """start.gg tab: Splash pictures — per player, the start.gg profile picture or an uploaded character image for the
    VS Splash and Victory Splash. public/player-pics.js builds the card into #picRoot. Only on the PC running the app."""
    if soup.select_one('#picRoot'): return
    soup.select_one('#sggEventRow').find_parent('div', class_='card').insert_after(BeautifulSoup('<div class="card local-only" id="picCard"><div id="picRoot"></div></div>', 'html.parser'))
    soup.select('script[src]')[-1].insert_after(BeautifulSoup('<script src="/static/player-pics.js"></script>', 'html.parser'))

def pic_editor():
    """The picture window (crop, remove a green screen) that opens when a character image is chosen: public/pic-editor.js,
    loaded before the Splash pictures card that uses it."""
    if soup.select_one('script[src="/static/pic-editor.js"]'): return
    soup.select_one('script[src="/static/player-pics.js"]').insert_before(BeautifulSoup('<script src="/static/pic-editor.js"></script>', 'html.parser'))

def no_colours():
    """1.1.0 – 1.1.2 had a "Colours" button beside the Layout menu (colour palettes for one layout). Each palette became a
    layout of its own in 1.1.3, so the button and its two scripts go."""
    for el in soup.select('#palBtn, script[src="/static/palettes.js"], script[src="/static/palette-panel.js"]'): el.decompose()

def vs_art():
    """Matches tab, VS Splash card: your own pictures for the VS Splash (a name bar and a header) and the lettering colours
    that go with a custom name bar. public/vs-art.js builds it into #vaRoot. Only on the PC running the app."""
    if not soup.select_one('#vaRoot'):
        soup.select_one('#vsCard').append(BeautifulSoup('<div class="local-only" id="vaRoot"></div>', 'html.parser'))
    if not soup.select_one('script[src="/static/vs-art.js"]'):
        soup.select('script[src]')[-1].insert_after(BeautifulSoup('<script src="/static/vs-art.js"></script>', 'html.parser'))

FORMAT_TAB = """<section class="tab fmt-tab" data-tab="format">
<div class="card fmt-head">
<div class="fmt-title"><b id="fmtName">Game formats</b><span class="pill" id="fmtPill">Off</span><span class="spacer"></span>
<button class="btn primary" id="fmtStart" hidden>▶ Start</button><button class="btn" id="fmtEnd" hidden title="Stop now — the best record wins">⏹ End</button>
<button class="btn ghost" id="fmtReset" hidden title="Back to setup, keeping the rosters">↺ Back to setup</button><button class="btn ghost" id="fmtClear" hidden title="Turn formats off">✕</button></div>
<p class="hint" id="fmtSub">Run a crew battle, a Sajam Slam-style team battle, a gauntlet, a Team Death Battle, a Death Battle, King of the Hill or a league. Set it up here; once it starts, every match is run from the Matches tab.</p>
</div>
<div class="card" id="fmtPresets">
<h2>Pick a format</h2>
<div class="fmt-presets" id="fmtPresetList"></div>
</div>
<div class="card" id="fmtLive" hidden>
<h2>Now playing <span class="pill" id="fmtLabel"></span><span class="spacer"></span><button class="btn sm ghost" id="fmtUndo" title="Undo the last result (Ctrl+Alt+Z)">↶ Undo result</button></h2>
<div class="fmt-now" id="fmtNow"></div>
<div class="fmt-pending" id="fmtPending" hidden></div>
<div class="fmt-acts" id="fmtActs"></div>
<div class="fmt-splash"><span class="lbl">On stream:</span>
<button class="btn sm" data-fsplash="fvs" id="fsVs">🤼 Team VS</button><button class="btn sm" data-fsplash="fboard" id="fsBoard">📋 Board</button><button class="btn sm" data-fsplash="fwin" id="fsWin">🏆 Champion</button><button class="btn sm" id="fsBar" title="Show or hide the format bar along the bottom of the layout (also on Stream Deck)">▁ Format bar</button>
<span class="spacer"></span><button class="btn sm ghost" id="fmtLayoutBtn" hidden></button></div>
</div>
<div class="card" id="fmtBoardCard" hidden><h2 id="fmtBoardTitle">Board</h2><div id="fmtBoard"></div></div>
<div class="card" id="fmtRules" hidden><h2>Rules</h2><div id="fmtRulesBody"></div></div>
<div class="card" id="fmtRoster" hidden><h2 id="fmtRosterTitle">Teams <span class="spacer"></span><select class="f fmt-saved" id="fmtSaved"><option value="">📂 Load a saved list…</option></select></h2><div id="fmtRosterBody"></div></div>
<div class="card" id="fmtLogCard" hidden><h2>Results <span class="spacer"></span><button class="btn sm ghost" id="fmtCsv">⬇ CSV</button></h2><div id="fmtLog"></div></div>
</section>"""

def format_tab():
    """Game formats (1.2.0): the Format tab comes back out of the attic with the full app's current markup (Team Death
    Battle included), right after Matches; a rail button with the "set won, waiting for Confirm" dot; and the two scripts
    that run it — public/format-panel.js (the tab) and public/match-format.js (the picker and console on the Matches tab).
    public/panel-ask.js is the panel's own "type something" window: the desktop app has no prompt()."""
    if not soup.select_one('main > section.tab[data-tab="format"]'):
        old = soup.select_one('section.tab[data-tab="format"]')
        if old: old.decompose()
        soup.select_one('main > section.tab[data-tab="match"]').insert_after(BeautifulSoup('<!-- ===================== FORMATS ===================== -->\n' + FORMAT_TAB, 'html.parser'))
    if not soup.select_one('nav.rail button[data-tab="format"]'):
        badge = soup.select_one('#fmtBadge')
        if badge: badge.decompose()
        soup.select_one('nav.rail button[data-tab="match"]').insert_after(BeautifulSoup('<button data-tab="format" title="Crew and team battles, Team Death Battle, Death Battle, King of the Hill and leagues"><svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z" opacity=".35"/><path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/></svg>Formats<i class="badge" hidden id="fmtBadge"></i></button>', 'html.parser'))
    for src in ('/static/panel-ask.js', '/static/format-panel.js', '/static/match-format.js'):       # after panel.js; the text window, then the tab's script
        if not soup.select_one(f'script[src="{src}"]'):
            soup.select('script[src]')[-1].insert_after(BeautifulSoup(f'<script src="{src}"></script>', 'html.parser'))

def whats_new():
    """What's new: a window that opens once after an update (public/whats-new.js), and a button for it in Settings, beside
    the app's name (that part of the card shows wherever the app runs; public/whats-new.js unhides the button)."""
    about = soup.select_one('#updCard .about')
    if not soup.select_one('#wnOpen'): about.append(BeautifulSoup('<button class="btn ghost" hidden id="wnOpen">What\'s new</button>', 'html.parser'))
    btn = soup.select_one('#wnOpen')
    if btn.parent is not about: about.append(btn.extract())
    if not soup.select_one('script[src="/static/whats-new.js"]'):
        soup.select('script[src]')[-1].insert_after(BeautifulSoup('<script src="/static/whats-new.js"></script>', 'html.parser'))

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

def sd_card():
    """Settings: the Stream Deck card (1.3.2) comes back out of the attic, above Updates & about: the app and plugin status,
    Install / Update, and "Set up my Stream Deck", which puts the BeeboScore layout on a 15-key Stream Deck or a 32-key
    Stream Deck XL. public/streamdeck-panel.js runs it. Only on the PC running the app."""
    card = soup.select_one('#sdCard')
    if card is None or not card.find_parent(id='liteAttic'): return
    soup.select_one('#updCard').insert_before(card.extract())
    card['class'] = card.get('class', []) + ['local-only']
    if not soup.select_one('script[src="/static/streamdeck-panel.js"]'):
        soup.select_one('script[src="/static/overlay-toggle.js"]').insert_after(BeautifulSoup('<script src="/static/streamdeck-panel.js"></script>', 'html.parser'))

def behave_card():
    """Settings: the Scoreboard card (1.3.6) comes back out of the attic, above the Stream Deck card: Refresh OBS on
    reset, the Victory Splash when a set ends (and how long it stays), the lock-in splash in team formats. Its two
    "follow" switches stay in the attic: this build has one layout for every game and no format versions of it."""
    card = soup.select_one('#setBehave')
    if card is None or not card.find_parent(id='liteAttic'): return
    soup.select_one('#sdCard').insert_before(card.extract())
    for i in ('setAutoSwitch', 'setFollowFormat'):
        el = card.select_one('#' + i)
        if el is not None: attic.append(el.find_parent('label').extract())

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
sd_card()
behave_card()
no_proto_note()
vs_card()
pics_card()
pic_editor()
whats_new()
no_colours()
vs_art()
format_tab()
html = str(soup).replace('>Bracket</a> tab', '>start.gg</a> tab')
for pattern, new in SCRUB: html = re.sub(pattern, new, html)
open(out, 'w').write(html)
