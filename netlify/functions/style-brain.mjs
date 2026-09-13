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
1. Hard practicality: occasion, weather, explicit user notes, and forced item.
2. Proportion and silhouette. Jessica generally benefits from a defined/compact upper half with wide or barrel bottoms; with slim bottoms introduce controlled volume or tailoring above. High-rise/long-leg proportions are strong. Avoid uncontrolled volume on both halves unless there is a deliberate styling reason.
3. Outfit hierarchy: choose a hero/focal point and let other pieces support it. Do not make every piece a statement.
4. Colour: create deliberate harmony/contrast; warm chocolate/cream/taupe/gold combinations are often strong, but do not make everything match. Consider visual weight and texture.
5. Occasion/vibe and dressiness must feel exact, not generic.
6. Personal style: neutral, polished, contemporary, Scandi/quiet-luxury with room for current fashion. Use the user's inspiration notes as visual grammar, not a shopping list.
7. Currentness: use trend/search context to influence styling tricks, silhouette and combinations. Never force a trend that weakens the outfit. Trend level Classic = mostly timeless; Current = recognisably current but wearable; Trend-led = more fashion-forward.
8. Learning: positive wear/save feedback matters; reject feedback should reduce similar choices.

OUTFIT RULES:
- exactly one Top + one Bottom OR exactly one Dress/One-piece, never both systems.
- exactly one Shoes, exactly one Bag, at least one Accessory where candidates exist.
- Outerwear optional and purposeful.
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
