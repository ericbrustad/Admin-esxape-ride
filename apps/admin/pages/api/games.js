import { listDirs } from '../../lib/github.js';
export default async function handler(_req,res){
  try{const slugs=await listDirs('public/games');return res.status(200).json({slugs});}
  catch(err){console.error('games error:',err);return res.status(500).json({error:String(err?.message||err)});}
}
