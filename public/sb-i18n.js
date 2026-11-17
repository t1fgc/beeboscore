/* BeeboScore (developed by Beebo), 1.12.18 — overlay languages.
 *
 * The fixed words on stream ("Victory", "Grand Final", "Up next", "Winners Round 2"…) in the language picked for the
 * layout (Layouts tab › Language, or Settings › Overlay language for every layout). Player names, teams and anything you
 * typed yourself stay as they are: only whole phrases from the list below are changed, keeping their capitals.
 *   BeeboI18n.t('Coming up')     the phrase in the layout's language (the show layer's own words)
 *   BeeboI18n.scan(el)           translate what's in el now (the layout's text is watched by itself)
 */
(() => {
  'use strict';
  if (window.BeeboI18n) return;
  // [English, es, fr, de, pt, it, ja, ko, zh]
  const L = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh'];
  const W = [
    ['Victory', 'Victoria', 'Victoire', 'Sieg', 'Vitória', 'Vittoria', '勝利', '승리', '胜利'],
    ['Winner', 'Ganador', 'Vainqueur', 'Gewinner', 'Vencedor', 'Vincitore', '勝者', '승자', '胜者'],
    ['Wins', 'Gana', 'Gagne', 'Gewinnt', 'Vence', 'Vince', '勝利', '승리', '获胜'],
    ['Champion', 'Campeón', 'Champion', 'Champion', 'Campeão', 'Campione', 'チャンピオン', '챔피언', '冠军'],
    ['Grand Final', 'Gran Final', 'Grande finale', 'Großes Finale', 'Grande Final', 'Gran Finale', 'グランドファイナル', '그랜드 파이널', '总决赛'],
    ['Grand Finals', 'Gran Final', 'Grande finale', 'Großes Finale', 'Grande Final', 'Gran Finale', 'グランドファイナル', '그랜드 파이널', '总决赛'],
    ['Grand Final Reset', 'Gran Final (reset)', 'Grande finale (reset)', 'Großes Finale (Reset)', 'Grande Final (reset)', 'Gran Finale (reset)', 'グランドファイナル (リセット)', '그랜드 파이널 (리셋)', '总决赛 (重置)'],
    ['Winners Final', 'Final de ganadores', 'Finale winners', 'Winners-Finale', 'Final de vencedores', 'Finale winners', 'ウィナーズファイナル', '위너스 파이널', '胜者组决赛'],
    ['Losers Final', 'Final de perdedores', 'Finale losers', 'Losers-Finale', 'Final de perdedores', 'Finale losers', 'ルーザーズファイナル', '루저스 파이널', '败者组决赛'],
    ['Winners Semi-Final', 'Semifinal de ganadores', 'Demi-finale winners', 'Winners-Halbfinale', 'Semifinal de vencedores', 'Semifinale winners', 'ウィナーズセミファイナル', '위너스 준결승', '胜者组半决赛'],
    ['Winners Semi-Finals', 'Semifinales de ganadores', 'Demi-finales winners', 'Winners-Halbfinale', 'Semifinais de vencedores', 'Semifinali winners', 'ウィナーズセミファイナル', '위너스 준결승', '胜者组半决赛'],
    ['Losers Semi-Final', 'Semifinal de perdedores', 'Demi-finale losers', 'Losers-Halbfinale', 'Semifinal de perdedores', 'Semifinale losers', 'ルーザーズセミファイナル', '루저스 준결승', '败者组半决赛'],
    ['Losers Semi-Finals', 'Semifinales de perdedores', 'Demi-finales losers', 'Losers-Halbfinale', 'Semifinais de perdedores', 'Semifinali losers', 'ルーザーズセミファイナル', '루저스 준결승', '败者组半决赛'],
    ['Winners Quarter-Final', 'Cuartos de final de ganadores', 'Quart de finale winners', 'Winners-Viertelfinale', 'Quartas de final de vencedores', 'Quarti di finale winners', 'ウィナーズ準々決勝', '위너스 8강', '胜者组四分之一决赛'],
    ['Winners Quarter-Finals', 'Cuartos de final de ganadores', 'Quarts de finale winners', 'Winners-Viertelfinale', 'Quartas de final de vencedores', 'Quarti di finale winners', 'ウィナーズ準々決勝', '위너스 8강', '胜者组四分之一决赛'],
    ['Losers Quarter-Final', 'Cuartos de final de perdedores', 'Quart de finale losers', 'Losers-Viertelfinale', 'Quartas de final de perdedores', 'Quarti di finale losers', 'ルーザーズ準々決勝', '루저스 8강', '败者组四分之一决赛'],
    ['Losers Quarter-Finals', 'Cuartos de final de perdedores', 'Quarts de finale losers', 'Losers-Viertelfinale', 'Quartas de final de perdedores', 'Quarti di finale losers', 'ルーザーズ準々決勝', '루저스 8강', '败者组四分之一决赛'],
    ['Top 8', 'Top 8', 'Top 8', 'Top 8', 'Top 8', 'Top 8', 'トップ8', '톱 8', '八强'],
    ['Top 8 Results', 'Resultados del Top 8', 'Résultats du Top 8', 'Top-8-Ergebnisse', 'Resultados do Top 8', 'Risultati della Top 8', 'トップ8結果', '톱 8 결과', '八强结果'],
    ['Pools', 'Grupos', 'Poules', 'Gruppen', 'Grupos', 'Gironi', '予選プール', '예선', '小组赛'],
    ['Up next', 'A continuación', 'À suivre', 'Als Nächstes', 'A seguir', 'A seguire', '次の試合', '다음 경기', '下一场'],
    ['Coming up', 'Próximamente', 'Au programme', 'Demnächst', 'Em breve', 'In programma', 'この後', '곧 이어서', '即将开始'],
    ['On now', 'Ahora', 'En ce moment', 'Jetzt', 'Agora', 'Ora', '放送中', '진행 중', '正在进行'],
    ['Starting soon', 'Empezamos pronto', 'Ça commence bientôt', 'Gleich geht’s los', 'Já vamos começar', 'Si comincia a breve', 'まもなく開始', '곧 시작합니다', '即将开始'],
    ['Back in a few', 'Volvemos enseguida', 'On revient vite', 'Gleich zurück', 'Já voltamos', 'Torniamo subito', 'まもなく再開', '잠시 후 돌아옵니다', '稍后回来'],
    ['Any second now', 'En cualquier momento', 'D’une seconde à l’autre', 'Jeden Moment', 'A qualquer momento', 'A momenti', 'まもなく', '곧', '马上'],
    ['Thanks for watching', 'Gracias por vernos', 'Merci d’avoir regardé', 'Danke fürs Zuschauen', 'Obrigado por assistir', 'Grazie per la visione', 'ご視聴ありがとうございました', '시청해 주셔서 감사합니다', '感谢观看'],
    ['More soon', 'Pronto, más', 'La suite bientôt', 'Bald mehr', 'Mais em breve', 'Altro a breve', '続きはこの後', '곧 더 보여드릴게요', '敬请期待'],
    ['Bracket', 'Cuadro', 'Tableau', 'Turnierbaum', 'Chave', 'Tabellone', 'トーナメント表', '대진표', '对阵表'],
    ['Standings', 'Clasificación', 'Classement', 'Platzierungen', 'Classificação', 'Classifica', '順位', '순위', '排名'],
    ['Results', 'Resultados', 'Résultats', 'Ergebnisse', 'Resultados', 'Risultati', '結果', '결과', '结果'],
    ['Match point', 'Punto de partido', 'Point de match', 'Matchball', 'Match point', 'Match point', 'マッチポイント', '매치 포인트', '赛点'],
    ['Live', 'En vivo', 'En direct', 'Live', 'Ao vivo', 'In diretta', 'ライブ', '라이브', '直播'],
    ['Record', 'Historial', 'Bilan', 'Bilanz', 'Histórico', 'Bilancio', '戦績', '전적', '战绩'],
    ['Head to head', 'Cara a cara', 'Face-à-face', 'Direkter Vergleich', 'Confronto direto', 'Testa a testa', '対戦成績', '상대 전적', '交手记录'],
    ['First meeting', 'Primer enfrentamiento', 'Première rencontre', 'Erstes Aufeinandertreffen', 'Primeiro confronto', 'Primo scontro', '初対戦', '첫 대결', '首次交手'],
    ['First set on stream', 'Primer set en directo', 'Premier set en direct', 'Erstes Set im Stream', 'Primeiro set na live', 'Primo set in diretta', '配信初登場', '첫 방송 출전', '首次登上直播'],
    ['Season', 'Temporada', 'Saison', 'Saison', 'Temporada', 'Stagione', 'シーズン', '시즌', '赛季'],
    ['Best results', 'Mejores resultados', 'Meilleurs résultats', 'Beste Ergebnisse', 'Melhores resultados', 'Migliori risultati', '主な成績', '최고 성적', '最佳成绩'],
    ['About', 'Sobre', 'À propos', 'Über', 'Sobre', 'Chi è', 'プロフィール', '소개', '简介'],
    ['Poll', 'Encuesta', 'Sondage', 'Umfrage', 'Enquete', 'Sondaggio', '投票', '투표', '投票'],
    ['Closed', 'Cerrada', 'Terminé', 'Beendet', 'Encerrada', 'Chiuso', '終了', '마감', '已结束'],
    ['Type !vote and a number', 'Escribe !vote y un número', 'Tapez !vote et un numéro', 'Schreib !vote und eine Zahl', 'Digite !vote e um número', 'Scrivi !vote e un numero', '!vote と番号を入力', '!vote와 번호를 입력', '输入 !vote 加数字'],
    ['Who wins?', '¿Quién gana?', 'Qui va gagner ?', 'Wer gewinnt?', 'Quem vence?', 'Chi vince?', '勝つのはどっち？', '누가 이길까?', '谁会赢？'],
    ['Type !pick 1 or !pick 2', 'Escribe !pick 1 o !pick 2', 'Tapez !pick 1 ou !pick 2', 'Schreib !pick 1 oder !pick 2', 'Digite !pick 1 ou !pick 2', 'Scrivi !pick 1 o !pick 2', '!pick 1 か !pick 2 を入力', '!pick 1 또는 !pick 2 입력', '输入 !pick 1 或 !pick 2'],
    ['Picks locked', 'Votos cerrados', 'Pronostics fermés', 'Tipps geschlossen', 'Palpites encerrados', 'Pronostici chiusi', '予想締め切り', '예측 마감', '竞猜已锁定'],
    ['pick', 'voto', 'pronostic', 'Tipp', 'palpite', 'pronostico', '票', '표', '票'],
    ['picks', 'votos', 'pronostics', 'Tipps', 'palpites', 'pronostici', '票', '표', '票'],
    ['Storyline', 'La historia', 'L’enjeu', 'Die Story', 'A história', 'La storia', '見どころ', '관전 포인트', '看点'],
    ['Rematch', 'Revancha', 'Revanche', 'Rückkampf', 'Revanche', 'Rivincita', '再戦', '재대결', '再战'],
    ['Revenge set', 'Set de revancha', 'Set de la revanche', 'Revanche-Set', 'Set da revanche', 'Set della rivincita', 'リベンジマッチ', '복수전', '复仇之战'],
    ['Rivalry', 'Rivalidad', 'Rivalité', 'Rivalität', 'Rivalidade', 'Rivalità', 'ライバル対決', '라이벌전', '宿敌对决'],
    ['Losers run', 'Racha en perdedores', 'Parcours en losers', 'Lauf im Losers-Bracket', 'Sequência nos perdedores', 'Rimonta nei losers', 'ルーザーズ快進撃', '루저스 연승', '败者组连胜'],
    ['On a streak', 'En racha', 'Série en cours', 'Siegesserie', 'Em sequência', 'In serie', '連勝中', '연승 중', '连胜中'],
    ['Comeback player', 'Rey de las remontadas', 'Roi des remontées', 'Comeback-Spieler', 'Rei das viradas', 'Re delle rimonte', '逆転の名手', '역전의 명수', '逆转高手'],
    ['First Top 8', 'Primer Top 8', 'Premier Top 8', 'Erste Top 8', 'Primeiro Top 8', 'Prima Top 8', '初のトップ8', '첫 톱 8', '首次八强'],
    ['Stream debut', 'Debut en directo', 'Débuts en direct', 'Stream-Debüt', 'Estreia na live', 'Debutto in diretta', '配信デビュー', '방송 데뷔', '直播首秀'],
    ['Reverse sweep', 'Remontada total', 'Reverse sweep', 'Reverse Sweep', 'Virada completa', 'Rimonta completa', '大逆転', '리버스 스윕', '翻盘'],
    ['Comeback on', 'Remontada en marcha', 'Remontée en cours', 'Comeback läuft', 'Virada em andamento', 'Rimonta in corso', '逆転なるか', '역전 진행 중', '逆转进行中'],
    // 1.12.21: the moment banners and the head-to-head line (the sentence under a banner's title has the players' names in it and stays as written)
    ['Final game', 'Partida decisiva', 'Manche décisive', 'Entscheidungsspiel', 'Partida decisiva', 'Partita decisiva', '最終試合', '최종전', '决胜局'],
    ['Sweep', 'Barrida', 'Sans-faute', 'Sweep', 'Varrida', 'Cappotto', 'ストレート勝ち', '스윕', '横扫'],
    ['Upset', 'Sorpresa', 'Surprise', 'Überraschung', 'Zebra', 'Sorpresa', '番狂わせ', '이변', '爆冷'],
    ['Runback', 'Revancha', 'Revanche', 'Revanche', 'Revanche', 'Rivincita', '再戦', '리매치', '再战'],
    ['Bracket reset', 'Reinicio del cuadro', 'Reset du bracket', 'Bracket-Reset', 'Reset da chave', 'Reset del tabellone', 'ブラケットリセット', '브래킷 리셋', '重置决赛'],
    ['Head-to-head', 'Cara a cara', 'Face-à-face', 'Direkter Vergleich', 'Confronto direto', 'Testa a testa', '対戦成績', '상대 전적', '交手记录'],
    ['First meeting on stream', 'Primer enfrentamiento en directo', 'Première rencontre en direct', 'Erstes Duell im Stream', 'Primeiro confronto na live', 'Primo scontro in diretta', '配信では初対戦', '방송 첫 대결', '直播首次交手'],
    ['On the brink', 'Al borde', 'Au bord du gouffre', 'Am Abgrund', 'À beira', 'Sull’orlo', '崖っぷち', '벼랑 끝', '濒临淘汰'],
    ['The event in numbers', 'El torneo en cifras', 'Le tournoi en chiffres', 'Das Turnier in Zahlen', 'O torneio em números', 'Il torneo in numeri', '数字で見る大会', '숫자로 보는 대회', '数据回顾'],
    ['Sets', 'Sets', 'Sets', 'Sets', 'Sets', 'Set', 'セット', '세트', '场次'],
    ['Games', 'Partidas', 'Manches', 'Spiele', 'Partidas', 'Partite', 'ゲーム', '게임', '局数'],
    ['Players', 'Jugadores', 'Joueurs', 'Spieler', 'Jogadores', 'Giocatori', '選手', '선수', '选手'],
    ['Comebacks', 'Remontadas', 'Remontées', 'Comebacks', 'Viradas', 'Rimonte', '逆転', '역전', '逆转'],
    ['Longest set', 'Set más largo', 'Set le plus long', 'Längstes Set', 'Set mais longo', 'Set più lungo', '最長セット', '최장 세트', '最长场次'],
    ['Most played', 'Más jugados', 'Les plus joués', 'Am meisten gespielt', 'Mais jogados', 'Più giocati', '使用率トップ', '최다 사용', '最常用角色'],
    ['Most sets won', 'Más sets ganados', 'Le plus de sets gagnés', 'Meiste Sets gewonnen', 'Mais sets vencidos', 'Più set vinti', '最多勝利', '최다 승리', '胜场最多'],
    ['Biggest comeback', 'Mayor remontada', 'Plus grande remontée', 'Größtes Comeback', 'Maior virada', 'Rimonta più grande', '最大の逆転', '최대 역전', '最大逆转'],
    ['from', 'desde', 'à', 'aus', 'de', 'da', '', '', '从'],
    ['games down', 'partidas abajo', 'manches de retard', 'Spielen Rückstand', 'partidas atrás', 'partite sotto', 'ゲームビハインドから', '게임 뒤진 상황에서', '局落后'],
    ['event', 'torneo', 'tournoi', 'Turnier', 'torneio', 'torneo', '大会', '대회', '赛事'],
    ['events', 'torneos', 'tournois', 'Turniere', 'torneios', 'tornei', '大会', '대회', '赛事'],
    ['pts', 'pts', 'pts', 'Pkt.', 'pts', 'pt', 'pt', '점', '分'],
    ['No results yet', 'Aún no hay resultados', 'Pas encore de résultats', 'Noch keine Ergebnisse', 'Ainda sem resultados', 'Ancora nessun risultato', 'まだ結果なし', '아직 결과 없음', '暂无结果'],
    ['Best predictors', 'Mejores pronósticos', 'Meilleurs pronostiqueurs', 'Beste Tipper', 'Melhores palpiteiros', 'Migliori pronosticatori', '予想ランキング', '예측 순위', '竞猜达人'],
    ['HYPE', 'HYPE', 'HYPE', 'HYPE', 'HYPE', 'HYPE', 'HYPE', 'HYPE', 'HYPE'],
    ['Thanks to our sponsor', 'Gracias a nuestro patrocinador', 'Merci à notre sponsor', 'Danke an unseren Sponsor', 'Obrigado ao nosso patrocinador', 'Grazie al nostro sponsor', 'スポンサー', '후원사에 감사드립니다', '感谢赞助商'],
    ['Player 1', 'Jugador 1', 'Joueur 1', 'Spieler 1', 'Jogador 1', 'Giocatore 1', 'プレイヤー1', '플레이어 1', '选手 1'],
    ['Player 2', 'Jugador 2', 'Joueur 2', 'Spieler 2', 'Jogador 2', 'Giocatore 2', 'プレイヤー2', '플레이어 2', '选手 2'],
  ];
  // "Winners Round 2", "Losers Round 1", "Round 3", "Best of 3", "First to 3", "Game 2"
  const R = {
    es: { wr: n => `Ronda ${n} de ganadores`, lr: n => `Ronda ${n} de perdedores`, r: n => `Ronda ${n}`, bo: n => `Al mejor de ${n}`, ft: n => `Primero a ${n}`, g: n => `Partida ${n}` },
    fr: { wr: n => `Winners – tour ${n}`, lr: n => `Losers – tour ${n}`, r: n => `Tour ${n}`, bo: n => `En ${n} manches`, ft: n => `Premier à ${n}`, g: n => `Manche ${n}` },
    de: { wr: n => `Winners – Runde ${n}`, lr: n => `Losers – Runde ${n}`, r: n => `Runde ${n}`, bo: n => `Best of ${n}`, ft: n => `First to ${n}`, g: n => `Spiel ${n}` },
    pt: { wr: n => `Rodada ${n} de vencedores`, lr: n => `Rodada ${n} de perdedores`, r: n => `Rodada ${n}`, bo: n => `Melhor de ${n}`, ft: n => `Primeiro a ${n}`, g: n => `Partida ${n}` },
    it: { wr: n => `Winners – turno ${n}`, lr: n => `Losers – turno ${n}`, r: n => `Turno ${n}`, bo: n => `Al meglio di ${n}`, ft: n => `Primo a ${n}`, g: n => `Partita ${n}` },
    ja: { wr: n => `ウィナーズ${n}回戦`, lr: n => `ルーザーズ${n}回戦`, r: n => `${n}回戦`, bo: n => `${n}本先取`.replace(/^(\d+)/, m => String(Math.ceil(Number(m) / 2))), ft: n => `${n}本先取`, g: n => `第${n}試合` },
    ko: { wr: n => `위너스 ${n}라운드`, lr: n => `루저스 ${n}라운드`, r: n => `${n}라운드`, bo: n => `${n}판 ${Math.ceil(n / 2)}선승`, ft: n => `${n}선승`, g: n => `${n}게임` },
    zh: { wr: n => `胜者组第${n}轮`, lr: n => `败者组第${n}轮`, r: n => `第${n}轮`, bo: n => `BO${n}`, ft: n => `先${n}胜`, g: n => `第${n}局` },
  };
  const norm = s => String(s || '').replace(/[’']/g, '’').replace(/\s+/g, ' ').trim().toLowerCase();
  const MAP = new Map(); for (const row of W) MAP.set(norm(row[0]), row);
  const latin = c => !['ja', 'ko', 'zh'].includes(c);
  let lang = 'en';
  function phrase(text, c = lang) {
    if (c === 'en' || !text) return null;
    const t = String(text), core = t.trim(); if (!core || core.length > 60) return null;
    const i = L.indexOf(c); if (i < 1) return null;
    const row = MAP.get(norm(core)); let out = row ? row[i] : null;
    if (out == null && R[c]) {
      let m;
      if ((m = /^winners round (\d+)$/i.exec(core))) out = R[c].wr(m[1]); else if ((m = /^losers round (\d+)$/i.exec(core))) out = R[c].lr(m[1]);
      else if ((m = /^round (\d+)$/i.exec(core))) out = R[c].r(m[1]); else if ((m = /^best of (\d+)$/i.exec(core))) out = R[c].bo(Number(m[1]));
      else if ((m = /^first to (\d+)$/i.exec(core))) out = R[c].ft(m[1]); else if ((m = /^game (\d+)$/i.exec(core))) out = R[c].g(m[1]);
    }
    if (out == null || out === '') return null;
    const up = core === core.toUpperCase() && /[A-Z]/.test(core);
    if (up && latin(c)) out = out.toLocaleUpperCase(c);
    return t.replace(core, out);
  }
  /** the show layer's words */
  const t = text => phrase(text) || text;
  // the layout's text: whole phrases in text nodes, kept up to date as the layout changes them
  const orig = new WeakMap();
  function fix(n) {
    if (n.nodeType !== 3 || !n.parentNode || /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) return;
    const was = orig.get(n), cur = n.nodeValue;
    const src = was && was.out === cur ? was.src : cur;                          // our own change, or the layout's new text
    const out = lang === 'en' ? src : (phrase(src) || src);
    if (out !== cur) { orig.set(n, { src, out }); n.nodeValue = out; } else if (!was || was.out !== cur) orig.set(n, { src, out });
  }
  function scan(el) { if (!el) return; if (el.nodeType === 3) return fix(el); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) fix(n); }
  let mo = null;
  function watch(on) {
    if (on && !mo && document.body) {
      mo = new MutationObserver(list => { for (const m of list) { if (m.type === 'characterData') fix(m.target); else for (const a of m.addedNodes) scan(a); } });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    } else if (!on && mo) { mo.disconnect(); mo = null; }
  }
  function setLang(c) {
    c = L.includes(c) ? c : 'en'; if (c === lang) return; lang = c;
    document.documentElement.setAttribute('data-sb-lang', c);
    if (document.body) scan(document.body);
    watch(c !== 'en');
  }
  addEventListener('scoreboard', e => { const x = e.detail && e.detail.x, lg = x && x.lang; const me = window.__SB_OVERLAY || ''; setLang(lg ? (lg.per && lg.per[me]) || lg.def || 'en' : 'en'); });
  window.BeeboI18n = { t, scan, phrase, get lang() { return lang; }, set: setLang, LANGS: L };
})();
