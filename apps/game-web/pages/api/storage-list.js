import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return res.status(500).json({ ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' });
    }

    const s = createClient(url, anon);

    // Inputs
    const bucket = (req.query.bucket || 'media').toString();
    let prefix   = (req.query.prefix || 'mediapool').toString();   // folder you want to list
    const limit  = Number(req.query.limit || 100);
    const offset = Number(req.query.offset || 0);

