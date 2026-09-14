const json=(status,body)=>({statusCode:status,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});

async function trendSignals(prefs){
  const key=process.env.SERPAPI_KEY;if(!key)return '';
  try{
    const q=`2026 women outfit trends Pinterest ${prefs?.occasion||''} ${Array.isArray(prefs?.moods)?prefs.moods.join(' '):''}`;
    const u=new URL('https://serpapi.com/search.json');u.searchParams.set('engine','google');u.searchParams.set('q',q);u.searchParams.set('gl','uk');u.searchParams.set('hl','en');u.searchParams.set('api_key',key);u.searchParams.set('num','5');
    const r=await fetch(u);if(!r.ok)return '';const d=await r.json();return (d.organic_results||[]).slice(0,5).map(x=>`${x.title}: ${x.snippet||''}`).join('\n').slice(0,4500);
  }catch{return ''}
}

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'POST only'});
  if(!process.env.OPENAI_API_KEY)return json(500,{error:'OPENAI_API_KEY is missing'});
  try{
    const b=JSON.parse(event.body||'{}'), candidates=Array.isArray(b.candidates)?b.candidates:[];
    if(!candidates.length)return json(400,{error:'No wardrobe candidates'});
    const trends=await trendSignals(b.prefs||{});
    const fragrances=candidates.filter(x=>x.cat==='Fragrance');
    const system=`You are Daily Drobe, Jessica's exceptionally thoughtful personal fashion stylist. You are NOT a slot-filling outfit generator. Build the complete look she would genuinely wear for the exact activity, weather and vibe.

NON-NEGOTIABLE METHOD
1. Interpret the activity and free-text brief literally. Explicit constraints are hard requirements.
2. Silently compare at least five plausible CORE outfits before choosing one. Start with silhouette/proportion, then colour/texture, then context/practicality.
3. Only after the core outfit works, consider finishing pieces individually: base layer/T-shirt, cardigan, blazer, jacket, coat, tights/hosiery, socks, shoes, bag, earrings, necklace, bracelet, rings, watch, belt, sunglasses, scarf, hat/hair accessory and fragrance.
4. There is NO fixed number of pieces and NO requirement to fill categories. Add something only if it improves the look aesthetically, practically or contextually. A result may have 4 pieces or 11+.
5. FRAGRANCE IS MANDATORY whenever at least one Fragrance candidate is supplied. Choose it thoughtfully for activity, season, intensity and value. Do not waste expensive/save-for-special fragrance on WFH or mundane errands unless the user's metadata explicitly says it is everyday.
6. Jewellery is styling, not a checkbox. You may use earrings + necklace, just earrings, layered jewellery, etc. Avoid competing statement pieces.
7. Layer intelligently. Consider whether a T-shirt/base layer underneath, open shirt/cardigan, blazer, jacket or coat makes the silhouette better and is actually useful.
8. Context controls shoes and bags. Dog walk/long walking = practical comfortable footwear, NEVER heels. Date night/dinner/night out = do not use a large work/laptop tote; prefer an appropriate small/shoulder/evening bag when available. WFH = no destination bag, coat or shoes merely to complete a formula. Office can justify a larger practical bag. Wedding/event pieces must suit the occasion.
9. Weather affects the whole look: tights, layers, footwear, outerwear, scarf, exposed skin and materials. Rain/walking should affect footwear/material choices. Never add a coat just to make a collage prettier.
10. Proportion for Jessica: high rise is strong; wide/barrel bottoms generally work best with a compact/fitted/defined top; slim bottoms can take more volume/structure up top; one deliberate point of structure; prioritise waist placement/endpoints/volume over rigid body-shape labels.
11. Pattern/texture: generally one hero pattern or strong texture. Avoid accidental clashes, double-heavy fur, or incoherent summer/winter combinations.
12. Trends/Pinterest are the final ~10%, not the foundation. The outfit must make sense first.
13. Never invent an item. Return ONLY candidate IDs supplied.
14. If forceId is supplied, that item MUST appear.
15. Give 2–5 useful styling tips about HOW to wear the selected pieces: e.g. jacket open, tuck/waist placement, sleeve push, jewellery balance, tights, sock treatment, bag position. Tips must reference the actual chosen look and never invent another garment.

VOICE: knowing, concise, fashion-literate, woman-to-woman, slightly dry. Not wellnessy or gushy.

Return strict JSON only with: ids (array of integer IDs in sensible visual layering order), why (short paragraph), stylingTips (array 2-5 strings), signals (array 3-5 short strings), trendNote (short string, optional).`;
    const user=`BRIEF\nActivity: ${b.prefs?.occasion||''}\nVibes: ${(b.prefs?.moods||[]).join(' + ')||b.prefs?.mood||''}\nWeather: ${b.prefs?.weather||''}\nHow current: ${b.prefs?.trend||''}\nAnything else: ${b.notes||'None'}\nForced item ID: ${b.forceId??'None'}\nStyle inspiration: ${b.inspiration||'None'}\n\nFRAGRANCES AVAILABLE: ${fragrances.length}\n\nWARDROBE CANDIDATES\n${JSON.stringify(candidates)}\n\nRECENT FEEDBACK\n${JSON.stringify(b.feedback||[])}\n\nCURRENT SEARCH SIGNALS (weak inspiration only)\n${trends||'None available'}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:user}]}],text:{format:{type:'json_schema',name:'daily_drobe_look',strict:true,schema:{type:'object',additionalProperties:false,properties:{ids:{type:'array',items:{type:'integer'},minItems:1,maxItems:16},why:{type:'string'},stylingTips:{type:'array',items:{type:'string'},minItems:2,maxItems:5},signals:{type:'array',items:{type:'string'},minItems:3,maxItems:5},trendNote:{type:'string'}},required:['ids','why','stylingTips','signals','trendNote']}}}})});
    const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||'OpenAI request failed');
    const txt=d.output_text||d.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;if(!txt)throw new Error('No stylist response');
    const out=JSON.parse(txt), allowed=new Set(candidates.map(x=>Number(x.id)));out.ids=(out.ids||[]).map(Number).filter(id=>allowed.has(id));
    if(b.forceId!=null&&allowed.has(Number(b.forceId))&&!out.ids.includes(Number(b.forceId)))out.ids.unshift(Number(b.forceId));
    if(fragrances.length&&!out.ids.some(id=>fragrances.some(f=>Number(f.id)===id))){const everyday=fragrances.find(f=>!/special|luxury|high/.test(String(f.valueTier||'').toLowerCase())&&!f.saveForSpecial)||fragrances[0];out.ids.push(Number(everyday.id))}
    return json(200,out);
  }catch(e){return json(500,{error:e.message||'Stylist failed'})}
}
