const json=(status,body)=>({statusCode:status,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});

async function trendSignals(prefs){
  const key=process.env.SERPAPI_KEY;if(!key)return '';
  try{
    const q=`2026 women outfit styling Pinterest ${prefs?.occasion||''} ${Array.isArray(prefs?.moods)?prefs.moods.join(' '):''}`;
    const u=new URL('https://serpapi.com/search.json');u.searchParams.set('engine','google');u.searchParams.set('q',q);u.searchParams.set('gl','uk');u.searchParams.set('hl','en');u.searchParams.set('api_key',key);u.searchParams.set('num','5');
    const r=await fetch(u);if(!r.ok)return '';const d=await r.json();return (d.organic_results||[]).slice(0,5).map(x=>`${x.title}: ${x.snippet||''}`).join('\n').slice(0,4200);
  }catch{return ''}
}

const baseSystem=`You are Daily Drobe's senior personal stylist for Jessica. Your standard is not “valid outfit”; it is “I hadn't thought of that, but of course it works.” Be exacting. Never slot-fill and never tolerate a rogue piece.

JESSICA-SPECIFIC FIT / PROPORTION
- Defined waist, slim/narrow upper body, curve through hip/upper thigh. Prioritise proportion, waist placement, endpoints and visual weight rather than body-shape labels.
- High rise is strong. Wide/barrel bottoms usually need a compact/fitted/defined upper half. Slim bottoms can take more upper-body volume/structure.
- Full-length wide trousers need footwear/hem logic. Pointed/elongating shoes can help; flat trainers only when the hem genuinely works.
- One deliberate structure point is often enough. Do not bury her in volume.

WARDROBE STYLING LAWS
- Read stylingNotes AND stylistDNA for every considered item. Those are garment-specific evidence, not decoration.
- Build a CORE look first, then STYLE it. Daily Drobe should feel like a fashion stylist, not a category picker. Use intelligent layering whenever the weather/context supports it.
- Think in layers: base layer → styling/mid layer → outer layer. A fitted tee or shirt under a cardigan/knit/blazer, then a coat when genuinely cold, can be stronger than a bare top + bottom.
- Weather controls outfit depth. Warm: light/minimal layers. Mild: optional styling layer. Cool: actively consider knit/cardigan/blazer/jacket. Cold: actively consider BOTH a compatible mid-layer AND proper outerwear, plus scarf/tights/boots where useful.
- Never add layers mechanically. Check sleeve bulk, neckline/collar interaction, hem interaction, silhouette, whether the outer layer has enough room, and whether the underlying outfit still reads.
- Deliberate visible layering is encouraged: shirt collars/cuffs, a tee hem, an open cardigan, an open coat, a visible belt or waistband.
- Ask silently: “Is this merely dressed, or is it styled?” If it is only a basic top + bottom + shoes when weather/context gives a credible opportunity for richer styling, reject it and keep looking.
- No fixed number of pieces; every piece still has to earn its place.
- Context beats category completeness. WFH needs no destination bag/coat/shoes. Dog walking/long walking needs practical footwear. Dinner/date/night out needs appropriate scale/formality. Office can justify a practical larger bag.
- Whole-look seasonality must make sense. Reject shorts + heavy fur, raffia + obvious winter, open summer shoes + exposed cold-weather logic, etc.
- Generally one hero print/texture. Avoid accidental competing statements, double fur, random theme stacking, or “everything brown so it matches.”
- Colour must look intentional: bridge, echo, tonal variation or controlled contrast. Mere non-clashing is insufficient. Black + brown is allowed when deliberate.
- Accessories are punctuation. If removing one improves the outfit, omit it.
- Bags and shoes influence mood; they are not afterthoughts and do not need to match each other.
- Fragrance may remain in the catalogue but NEVER include Fragrance in outfit ids.
- Trends/Pinterest are the final 10%. They can sharpen a strong look, never rescue a weak one.
- Never invent an item. Return only supplied IDs. If forceId exists, it is non-negotiable.

ROGUE-PIECE GATE — silently test every selected piece:
1) Does its season/weather agree with the WHOLE look?
2) Does its formality agree with the activity?
3) Does its visual weight improve the silhouette?
4) Does its colour/texture have a reason to be there?
5) Is it better than the plausible alternatives in this wardrobe?
6) If removed, would the outfit improve? If yes, remove it.
Any piece failing a gate is rogue and must not reach Jessica.

VOICE: concise, knowing, fashion-literate, woman-to-woman, slightly dry. Never gushy.`;

async function askOpenAI(system,user,schema,name){
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:user}]}],text:{format:{type:'json_schema',name,strict:true,schema}}})});
  const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||'OpenAI request failed');
  const txt=d.output_text||d.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;if(!txt)throw new Error('No stylist response');return JSON.parse(txt);
}

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'POST only'});
  if(!process.env.OPENAI_API_KEY)return json(500,{error:'OPENAI_API_KEY is missing'});
  try{
    const b=JSON.parse(event.body||'{}'), candidates=(Array.isArray(b.candidates)?b.candidates:[]).filter(x=>x.cat!=='Fragrance');
    if(!candidates.length)return json(400,{error:'No wearable wardrobe candidates'});
    const trends=await trendSignals(b.prefs||{}), allowed=new Set(candidates.map(x=>Number(x.id)));
    const brief=`ACTIVITY: ${b.prefs?.occasion||''}\nVIBES: ${(b.prefs?.moods||[]).join(' + ')||b.prefs?.mood||''}\nWEATHER: ${b.prefs?.weather||''}\nCURRENTNESS: ${b.prefs?.trend||''}\nNOTES: ${b.notes||'None'}\nFORCED ITEM: ${b.forceId??'None'}\nSTYLE INSPIRATION: ${b.inspiration||'None'}\nRECENT FEEDBACK: ${JSON.stringify(b.feedback||[])}\nWEAK CURRENT SIGNALS: ${trends||'None'}\n\nWARDROBE:\n${JSON.stringify(candidates)}`;
    const draftSchema={type:'object',additionalProperties:false,properties:{options:{type:'array',minItems:6,maxItems:10,items:{type:'object',additionalProperties:false,properties:{ids:{type:'array',items:{type:'integer'},minItems:2,maxItems:14},concept:{type:'string'},strength:{type:'string'},risk:{type:'string'}},required:['ids','concept','strength','risk']}}},required:['options']};
    const draft=await askOpenAI(baseSystem+`\n\nFIRST PASS: Generate 6–10 genuinely different plausible outfits. Compare silhouette first, then palette, texture, context and finishing. Be ruthless about risks. Do not simply vary one accessory.`,brief,draftSchema,'daily_drobe_candidates');
    const options=(draft.options||[]).map(o=>({...o,ids:(o.ids||[]).map(Number).filter(id=>allowed.has(id))})).filter(o=>o.ids.length>=2);
    const lookSchema={type:'object',additionalProperties:false,properties:{ids:{type:'array',items:{type:'integer'},minItems:2,maxItems:14},label:{type:'string'},why:{type:'string'},stylingTips:{type:'array',items:{type:'string'},minItems:2,maxItems:5},qualityScore:{type:'integer',minimum:0,maximum:100}},required:['ids','label','why','stylingTips','qualityScore']};
    const finalSchema={type:'object',additionalProperties:false,properties:{looks:{type:'array',minItems:3,maxItems:3,items:lookSchema},trendNote:{type:'string'}},required:['looks','trendNote']};
    const critique=`${brief}\n\nSHORTLIST FROM FIRST PASS:\n${JSON.stringify(options)}\n\nAct now as a ruthless fashion director. Compare every shortlist option against the exact wardrobe metadata. Reject anything with even one rogue element. Choose the THREE strongest outfits. They must be genuinely distinct styling directions, not the same base with a different shoe or bag. Re-check forced item, silhouette, waist/volume, colour story, texture hierarchy, season/weather, walking practicality, bag scale, footwear logic, LAYER COMPATIBILITY and whether each finisher earns its place. For Cool/Cold weather, explicitly test whether a mid-layer and outer layer can work together; prefer sophisticated depth when it improves the look. At least one of the three should demonstrate strong, deliberate layering whenever the wardrobe and weather make that credible. qualityScore is your confidence that Jessica would genuinely be impressed, not technical validity. Styling tips must explain how to wear THESE exact selected pieces.`;
    const out=await askOpenAI(baseSystem+`\n\nFINAL PASS: You are the critic, not the generator. Do not reward novelty over coherence. Styling depth is valuable only when coherent. Return three excellent, meaningfully different looks.`,critique,finalSchema,'daily_drobe_final');
    out.looks=(out.looks||[]).map(l=>({...l,ids:(l.ids||[]).map(Number).filter(id=>allowed.has(id))})).filter(l=>l.ids.length>=2).slice(0,3);
    if(b.forceId!=null&&allowed.has(Number(b.forceId)))out.looks.forEach(l=>{if(!l.ids.includes(Number(b.forceId)))l.ids.unshift(Number(b.forceId))});
    if(out.looks.length<3)throw new Error('Stylist did not return three complete looks');
    return json(200,out);
  }catch(e){return json(500,{error:e.message||'Stylist failed'})}
}
