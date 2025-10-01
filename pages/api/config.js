import fs from 'node:fs/promises';
import path from 'node:path';
export default async function handler(req, res) {
  try {
    const file = path.join(process.cwd(), 'public', 'config.json');
    const raw = await fs.readFile(file, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(raw);
  } catch (e) {
    res.status(200).json({ splash:{enabled:true,mode:'single'}, game:{title:'Untitled Game', type:'Mystery'}, forms:{players:1}, textRules: [] });
  }
}