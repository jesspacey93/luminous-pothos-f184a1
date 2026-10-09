const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const n=v=>{const m=String(v||'').replace(/,/g,'').match(/(\d+(?:\.\d{1,2})?)/);return m?Number(m[1]):null};
export default async (req)=>{
  if(req.method!=='GET') return json({error:'Method not allowed'},405);
  const key=process.env.SERPAPI_KEY;
  if(!key) return json({error:'Live shopping is not connected yet. Add SERPAPI_KEY in Netlify environment variables, then redeploy the preview.'},503);
  const u=new URL(req.url);let q=(u.searchParams.get('q')||'').trim();if(!q)return json({error:'Missing search query'},400);
  const stores=(u.searchParams.get('stores')||'').trim(),size=(u.searchParams.get('size')||'').trim(),budget=(u.searchParams.get('budget')||'').trim(),limit=Math.min(20,Math.max(1,Number(u.searchParams.get('limit')||12)));
  if(size)q+=` size ${size}`;if(stores)q+=` ${stores}`;
  const api=new URL('https://serpapi.com/search.json');api.searchParams.set('engine','google_shopping');api.searchParams.set('q',q);api.searchParams.set('gl','uk');api.searchParams.set('hl','en');api.searchParams.set('google_domain','google.co.uk');api.searchParams.set('api_key',key);
  try{
    const r=await fetch(api,{headers:{accept:'application/json'}});const data=await r.json();if(!r.ok||data.error)return json({error:data.error||'Shopping provider returned an error.'},502);
    let products=(data.shopping_results||[]).map(x=>({title:x.title||'',price:x.price||'',value:Number(x.extracted_price)||n(x.price),store:x.source||x.seller||'',link:x.product_link||x.link||'',image:x.thumbnail||'',rating:x.rating||null,reviews:x.reviews||null})).filter(x=>x.title&&x.link);
    const max=n(budget);if(max)products=products.filter(x=>!x.value||x.value<=max);
    if(stores){const wanted=stores.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const preferred=products.filter(p=>wanted.some(w=>(p.store+' '+p.title).toLowerCase().includes(w)));if(preferred.length)products=preferred}
    const seen=new Set();products=products.filter(p=>{const k=(p.store+'|'+p.title).toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,limit);
    return json({query:q,products});
  }catch(e){return json({error:'Could not reach the live shopping provider. Try again in a moment.'},502)}
};
