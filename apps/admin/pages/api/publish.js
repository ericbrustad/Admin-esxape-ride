import { ghGet, upsertJson, joinPath } from '../../lib/github.js';
async function readJson(path){const r=await ghGet(path);if(r.status!==200||!r.data||r.data.type!=='file')return null;
  const buff=Buffer.from(r.data.content||'','base64');try{return JSON.parse(buff.toString('utf8'));}catch{return null;}}
function isLegacyRoot(slug){const v=String(slug??'').trim().toLowerCase();return v===''||v==='(legacy root)'||v==='legacy-root'||v==='root';}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const {slug}=req.body||{}; const legacy=isLegacyRoot(slug);
    const src=legacy?joinPath('public','draft'):joinPath('public/games',slug,'draft');
    const dst=legacy?'public':joinPath('public/games',slug);
    const cfg=await readJson(joinPath(src,'config.json')); const mis=await readJson(joinPath(src,'missions.json'));
    const results=[]; if(cfg)results.push(await upsertJson(joinPath(dst,'config.json'),cfg,`publish(config): ${slug||'root'}`));
    if(mis)results.push(await upsertJson(joinPath(dst,'missions.json'),mis,`publish(missions): ${slug||'root'}`));
    return res.status(200).json({ok:true,results});
  }catch(err){console.error('publish error:',err);return res.status(500).json({error:String(err?.message||err)});}
}
