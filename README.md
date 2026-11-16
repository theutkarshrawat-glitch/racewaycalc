# RacewayCalc: electrician tools (28-day validation test)

Two static, mobile-first calculators for US electricians, with a "Pro $39/yr" fake-door waitlist.

- `/conduit-fill-calculator/`: NEC Ch. 9 Tables 1, 4, 5, 8. EMT, IMC, RMC, PVC 40/80, FMC, LFMC; THHN/THWN-2, XHHW-2, THW/TW, bare, or a custom cable area; 53/31/40% limits, 60% nipples, Note 7 rounding, smallest passing size, jam-ratio warning.
- `/voltage-drop-calculator/`: 1-phase, 3-phase or DC; Cu/Al; NEC Table 9 (AC R + XL at any PF, PVC/Al/steel conduit), Table 8 (DC R) or K-factor; parallel sets; % drop, end voltage, max length, smallest size meeting the target plus 75°C ampacity and 240.4(D).

## Layout
- `assets/nec-data.js`: NEC tables (generated from `ref/nec.json`)
- `assets/engine.js`: pure calculation functions (browser + Node)
- `assets/conduit.js`, `assets/vd.js`: UI
- `assets/app.js`: event tracking + Pro waitlist modal
- `assets/config.js`: **analytics and form endpoints to fill in**
- `build.py`: builds `site/` (`python3 build.py https://your-domain.com`)
- `tests/crosscheck.test.js`: 39 checks against published examples (`node tests/crosscheck.test.js`)

## Before the 28-day test starts
1. **Domain** (optional but recommended): buy a `.com`, then rebuild with `python3 build.py https://yourdomain.com` and point it at GitHub Pages or Cloudflare Pages.
2. **Analytics**: create a free GoatCounter site and put its code in `config.js` → `goatcounterCode`. Or point `eventEndpoint` at your own endpoint. Events: `pageview`, `tool_use`, `pro_click`, `waitlist_open`, `waitlist_signup`.
3. **Waitlist backend**: create a Formspree form (free tier) or a Google Apps Script web app writing to a Sheet, and set `waitlistEndpoint`. Until then, signups are only kept in the visitor's own browser (localStorage), so they are **lost**.
4. **Google Search Console**: verify the domain and submit `/sitemap.xml`.
5. **Electrician review**: have a licensed electrician spot-check results before promoting.

Add `?debug=1` to any URL to log events in the browser console.
