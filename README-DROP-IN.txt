DAILY DROBE V8.7 — REFINED MINIMAL + LOOKS NAV FIX

Replace these in the root of the existing repo:
- index.html
- manifest.webmanifest
- icons/

Keep assets/ and netlify/ intact.

Fix:
The V8.6 button had data-page="looks" but still contained onclick="go('style')" and the visible label remained Style. This is now corrected to LOOKS -> go('looks').

Navigation:
HOME · DROBE · LOOKS · PACK · SHOP

HOME remains the “What are you doing today?” styling entry point.
LOOKS opens the WORN / SAVED archive.

Also begins the approved Refined Minimal visual direction:
white/black foundation, warm ivory selected states, finer rules, no shadows, square geometry, quieter bottom navigation.
