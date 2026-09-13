export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const body = await req.json();
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error('Styling service is not configured');
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    if (!candidates.length) throw new Error('No wardrobe candidates');

    let trendContext = '';
    const serpKey = process.env.SERPAPI_KEY;
    if (serpKey) {
      const q = `2026 women's fashion ${body.prefs?.mood||''} ${body.prefs?.occasion||''} outfit trends Pinterest styling`; 
      const u = new URL('https://serpapi.com/search.json');
      u.searchParams.set('engine','google'); u.searchParams.set('q',q); u.searchParams.set('gl','uk'); u.searchParams.set('hl','en'); u.searchParams.set('api_key',serpKey); u.searchParams.set('num','8');
      const sr = await fetch(u); if (sr.ok) { const sj=await sr.json(); trendContext=(sj.organic_results||[]).slice(0,8).map(x=>`${x.title||''}: ${x.snippet||''}`).join('\n'); }
    }

    const system = `You are the senior fashion stylist inside Daily Drobe. Your job is NOT to randomly match categories. Deliberately construct one excellent outfit from the supplied wardrobe candidate IDs.

STYLE PRIORITIES, in order:
1. Hard practicality and semantic context: occasion, weather, explicit user notes, destination, and forced item. Treat free-text notes as requirements, not flavour text. Infer what the person will physically be doing and what they therefore need.
2. Proportion and silhouette. Jessica generally benefits from a defined/compact upper half with wide or barrel bottoms; with slim bottoms introduce controlled volume or tailoring above. High-rise/long-leg proportions are strong. Avoid uncontrolled volume on both halves unless there is a deliberate styling reason.
3. Outfit hierarchy: choose a hero/focal point and let other pieces support it. Do not make every piece a statement.
4. Colour: create deliberate harmony/contrast; warm chocolate/cream/taupe/gold combinations are often strong, but do not make everything match. Consider visual weight and texture.
5. Occasion/vibe and dressiness must feel exact, not generic.
6. Personal style: neutral, polished, contemporary, Scandi/quiet-luxury with room for current fashion. Use the user's inspiration notes as visual grammar, not a shopping list.
7. Currentness: use trend/search context to influence styling tricks, silhouette and combinations. Never force a trend that weakens the outfit. Trend level Classic = mostly timeless; Current = recognisably current but wearable; Trend-led = more fashion-forward.
8. Learning: positive wear/save feedback matters; reject feedback should reduce similar choices.

CONTEXT OVERRIDES GENERIC OUTFIT RULES:
- "working from home", "WFH", "at home", or equivalent = indoor at-home dressing. Do NOT add a bag, outdoor coat/jacket or shoes/boots just to complete a conventional outfit. Build only what she would realistically wear at home; accessory is optional.
- A named destination is meaningful. Infer its dress code and setting. For Sushi Samba / an upscale rooftop restaurant / special dinner, aim polished, contemporary evening dressing: elevated rather than office-like or daytime-casual.
- Weather is not permission to create seasonally incoherent styling. Avoid summer shorts with heavy winter/faux-fur layers. Check the WHOLE outfit for seasonal coherence.
- Never stack competing heavy statement textures. In particular, do not pair a faux-fur/fur-collar cardigan with a fur/faux-fur coat. One strong fur texture is enough.
- If the user gives a practical constraint, violating it is worse than being less fashionable.

OUTFIT RULES:
- exactly one Top + one Bottom OR exactly one Dress/One-piece, never both systems.
- For an out-of-home look, choose Shoes and Bag where candidates exist; for at-home looks omit them unless explicitly requested.
- Accessory is optional when at home; for going-out looks use one where useful.
- Outerwear is optional and only when the brief actually requires leaving the house and weather/occasion justify it.
- Never invent an item or ID.
- If the wardrobe candidate set lacks a required category, omit it rather than substituting the wrong category.
- The explanation must mention specific styling reasoning: silhouette/proportion, colour/texture, hierarchy, and why it suits the brief. No generic 'perfect for the occasion' copy.

Return ONLY valid JSON: {"ids":[number...],"why":"2-4 sentence stylist explanation","signals":["short signal",...],"trendNote":"short phrase about current/Pinterest influence or empty string"}`;

    const user = JSON.stringify({brief:body.prefs,notes:body.notes||'',forcedItemId:body.forceId||null,styleInspiration:body.inspiration||'',recentFeedback:body.feedback||[],currentTrendAndPinterestSearchSignals:trendContext,candidates});
    const r = await fetch('https://api.openai.com/v1/responses', {method:'POST',headers:{'authorization':`Bearer ${openaiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',instructions:system,input:user})});
    const j=await r.json(); if(!r.ok) throw new Error(j?.error?.message||'Stylist request failed');
    const txt=(j.output||[]).flatMap(o=>o.content||[]).map(c=>c.text||'').join('').trim();
    const match=txt.match(/\{[\s\S]*\}/); if(!match) throw new Error('Stylist returned no JSON');
    const out=JSON.parse(match[0]);
    const allowed=new Set(candidates.map(x=>Number(x.id))); out.ids=(out.ids||[]).map(Number).filter(id=>allowed.has(id));
    return Response.json(out);
  } catch (e) {
    return Response.json({error:'The stylist could not build this look right now.'},{status:500});
  }
};
