import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceKey, getServerClient } from "../../lib/supabase";
export default async function handler(req,res){
  const url=getSupabaseUrl(), anon=getSupabaseAnonKey(), service=getSupabaseServiceKey();
  const out={ ok:true, time:new Date().toISOString(), env:{hasUrl:!!url,hasAnonKey:!!anon,hasServiceKey:!!service}, projectRef:null, buckets:[], storageError:null };
  try{
    if(url){ const m=url.match(/https?:\/\/([a-zA-Z0-9-]+)\.supabase\.co/); if(m) out.projectRef=m[1]; }
    const supabase=getServerClient();
    if(supabase){ const { data,error } = await supabase.storage.listBuckets(); out.buckets=(data||[]).map(b=>b.name); out.storageError=error?.message??null; }
    else { out.storageError = "Server key not configured (SUPABASE_SERVICE_ROLE_KEY)."; }
  }catch(e){ out.ok=false; out.storageError=e?.message||String(e); }
  res.status(200).json(out);
}
