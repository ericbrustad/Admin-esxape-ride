export const config = { matcher: '/:path*' };
function unauthorized(realm='Esx Admin'){return new Response('Auth required',{status:401,headers:{'WWW-Authenticate':`Basic realm="${realm}"`}});}
export function middleware(request){
  const USER=process.env.BASIC_AUTH_USER||'Eric';
  const PASS=process.env.BASIC_AUTH_PASS||'someStrongPassword';
  const auth=request.headers.get('authorization')||'';
  const [scheme,encoded]=auth.split(' ');
  if(scheme!=='Basic'||!encoded) return unauthorized();
  try{
    const decoded=globalThis.atob(encoded);
    const i=decoded.indexOf(':');
    if(i<0) return unauthorized();
    const user=decoded.slice(0,i);
    const pass=decoded.slice(i+1);
    if(user===USER&&pass===PASS) return;
  }catch(e){}
  return unauthorized();
}