// Copy Admin public data (games, config, missions) into Game public
const fs = require('fs');
const path = require('path');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

const cwd = process.cwd();
const adminPublic = path.resolve(cwd, '../admin/public');
const gamePublic  = path.resolve(cwd, './public');

copyDir(path.join(adminPublic, 'games'), path.join(gamePublic, 'games'));
for (const f of ['config.json', 'missions.json']) {
  const s = path.join(adminPublic, f);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, path.join(gamePublic, f));
  }
}
console.log('Synced data from admin/public -> game/public');
