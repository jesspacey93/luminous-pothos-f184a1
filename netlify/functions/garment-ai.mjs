const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
function outputText(data){
  if(data.output_text) return data.output_text;
  for(const o of data.output||[]) if(o.type==='message') for(const c of o.content||[]) if(c.type==='output_text'&&c.text) return c.text;
  return '';
}
function imageResult(data){
  for(const o of data.output||[]) if(o.type==='image_generation_call'&&o.result) return o.result;
  return '';
}
function parseMeta(text){
  try{return JSON.parse(text)}catch{}
  const m=String(text||'').match(/\{[\s\S]*\}/); if(m) try{return JSON.parse(m[0])}catch{}
  return {};
}
export default async (req)=>{
  if(req.method!=='POST') return json(405,{error:'POST only'});
  const key=Netlify.env.get('OPENAI_API_KEY')||process.env.OPENAI_API_KEY;
  if(!key) return json(503,{error:'AI wardrobe clean-up is not connected yet. Add OPENAI_API_KEY in Netlify.'});
  let body={}; try{body=await req.json()}catch{return json(400,{error:'Invalid request.'})}
  const image=body.image||'';
  if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(image)) return json(400,{error:'Please use a JPG, PNG or WebP image.'});
  if(image.length>13_000_000) return json(413,{error:'That photo is too large. Please choose one under about 9MB.'});
  const headers={'authorization':`Bearer ${key}`,'content-type':'application/json'};
  try{
    const editPayload={
      model:'gpt-5.6-luna',
      input:[{role:'user',content:[
        {type:'input_text',text:'Edit this exact clothing/accessory photo into a clean ecommerce catalogue cutout. Preserve the real item as faithfully as possible: same garment type, silhouette, proportions, colour, pattern, fabric appearance, hardware, seams and visible details. Remove the person, hanger, room, floor and all background clutter. Show only one complete item, centred, front-facing or in the most faithful view available, with natural product lighting. Do not redesign, embellish, invent branding or change the item. Transparent background. No text, labels, props, shadows extending beyond the item, or extra objects.'},
        {type:'input_image',image_url:image,detail:'high'}
      ]}],
      tools:[{type:'image_generation',action:'edit',model:'gpt-image-2',background:'transparent',output_format:'png',size:'1024x1536',quality:'medium'}],
      tool_choice:{type:'image_generation'}
    };
    const er=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers,body:JSON.stringify(editPayload)});
    const ed=await er.json();
    if(!er.ok) return json(er.status,{error:ed?.error?.message||'The image could not be cleaned up.'});
    const b64=imageResult(ed); if(!b64) return json(502,{error:'The AI did not return a cleaned image. Please try again.'});
    const clean=`data:image/png;base64,${b64}`;
    const metaPayload={model:'gpt-5.6-luna',input:[{role:'user',content:[
      {type:'input_text',text:'Identify this wardrobe item. Return ONLY valid JSON with keys: name, brand, category, colour, fit, season, occasion. category must be exactly one of Top, Bottom, Outerwear, One-piece, Shoes, Bag, Accessory, Fragrance. brand should be Unknown unless clearly visible/known from the image. season and occasion must be arrays of short strings. Be conservative and do not invent details.'},
      {type:'input_image',image_url:clean,detail:'high'}
    ]}],text:{format:{type:'json_object'}}};
    const mr=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers,body:JSON.stringify(metaPayload)});
    const md=await mr.json();
    const meta=mr.ok?parseMeta(outputText(md)):{};
    return json(200,{image:clean,meta});
  }catch(e){return json(500,{error:'AI clean-up failed. '+(e?.message||'Please try again.')})}
}
