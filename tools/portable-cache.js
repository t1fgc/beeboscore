// BeeboScore (developed by Beebo), 1.12.16: before a portable Testbuild is built, use our launcher (desktop/portable.nsi)
// instead of electron-builder's own, which deletes the unpacked app when it closes and unpacks all of it again on
// every launch. Ours keeps it per version, so only the first launch of a new Testbuild waits for the unpacking.
const fs = require('fs'), path = require('path');
const dst = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'portable.nsi');
const src = path.join(__dirname, '..', 'desktop', 'portable.nsi');
if (!fs.existsSync(path.dirname(dst))) { console.error('electron-builder not installed'); process.exit(1); }
const ours = fs.readFileSync(src, 'utf8').split('\n').filter(l => !/^; BeeboScore \(developed by Beebo\): the portable|^; unpacked app is kept between launches \(tools/.test(l)).join('\n');
const now = fs.readFileSync(dst, 'utf8');
if (now !== ours) { if (!now.includes('.beebo-ready')) fs.writeFileSync(dst + '.orig', now); fs.writeFileSync(dst, ours); console.log('portable launcher: keeps the unpacked app between launches'); }
