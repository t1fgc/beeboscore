'use strict';
/*
 * BeeboScore (developed by Beebo): update.log, a short record of every start and every "Restart & update" hand-over,
 * kept in the data folder (the last 40 lines). It is what to look at when Restart & update closed the app and the new
 * version did not come up. A good update ends with these lines, in this order:
 *   <old>  Restart & update: closing so the installer can put in <new>
 *   <new>  started by Restart & update (from <old>)
 *   <new>  started on port N
 *   <new>  window shown
 * If the last line is the old version's, the new version never got as far as starting the app.
 */
const fs = require('fs');
const path = require('path');

const KEEP = 40;
const MARK = 'update-pending.json';        // written by the old copy just before it closes for the installer

function createUpdateLog(dataDir, version) {
  const file = path.join(dataDir, 'update.log');
  function log(msg) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      let old = ''; try { old = fs.readFileSync(file, 'utf8'); } catch {}
      const lines = old.split('\n').filter(Boolean).slice(-(KEEP - 1));
      lines.push(`${new Date().toISOString()}  ${version}  ${msg}`);
      fs.writeFileSync(file, lines.join('\n') + '\n');
    } catch {}
  }
  /** the old copy, just before it closes: remember what it is handing over to */
  function handOver(to) {
    log(`Restart & update: closing so ${to} can take over`);
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(path.join(dataDir, MARK), JSON.stringify({ from: version, to, at: Date.now() })); } catch {}
  }
  /** the next start: was it the one Restart & update asked for? (reads and removes the note the old copy left) */
  function afterUpdate() {
    const f = path.join(dataDir, MARK); let m = null;
    try { m = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
    try { fs.unlinkSync(f); } catch {}
    if (!m || !m.to) return null;
    if (m.to === version) log(`started by Restart & update (from ${m.from})`);
    else log(`started after Restart & update, but this is ${version}, not ${m.to}: the installer did not finish`);
    return m;
  }
  return { log, handOver, afterUpdate, file };
}

module.exports = { createUpdateLog };
