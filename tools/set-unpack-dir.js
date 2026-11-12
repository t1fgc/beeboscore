#!/usr/bin/env node
/* BeeboScore (developed by Beebo): gives each version its own unpack folder.
 *
 * The portable exe unpacks the app into %TEMP%\<build.portable.unpackDirName> every time it starts and deletes that
 * folder when the app closes. "Restart & update" starts the new exe while the old copy is still closing, so the two
 * must not share a folder. This sets the name to BeeboScore-<version> from package.json. It runs before every build
 * (npm run dist → predist), so the name can never be left behind when the version goes up.
 */
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'package.json'), raw = fs.readFileSync(file, 'utf8'), pkg = JSON.parse(raw);
const want = `BeeboScore-${pkg.version}`;
if (!pkg.build || !pkg.build.portable) throw new Error('package.json has no build.portable section');
if (pkg.build.portable.unpackDirName === want) { console.log(`unpack folder: ${want} (already set)`); process.exit(0); }
// change only that one value, so the rest of the file keeps its formatting
const next = raw.replace(/("unpackDirName":\s*")[^"]*(")/, `$1${want}$2`);
if (next === raw) throw new Error('could not find unpackDirName in package.json');
fs.writeFileSync(file, next); console.log(`unpack folder: ${want}`);
