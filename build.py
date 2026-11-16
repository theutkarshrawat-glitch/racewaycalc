#!/usr/bin/env python3
"""Builds the static site into ./site.  Usage: python3 build.py https://your-domain.com"""
import json, os, shutil, subprocess, sys, html, datetime
SITE_URL = (sys.argv[1] if len(sys.argv) > 1 else 'https://example.com').rstrip('/')
ROOT = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(ROOT, 'site')
D = json.load(open(os.path.join(ROOT, 'ref', 'nec.json')))
BRAND = 'RacewayCalc'
TODAY = datetime.date.today().isoformat()
from urllib.parse import urlparse
BASE = urlparse(SITE_URL).path.rstrip('/')
NOTE7 = lambda x: int(x) + 1 if x - int(x) >= 0.8 - 1e-9 else int(x)

def max_same(conduit, ts, a):
    A = D['conduits'][conduit][ts]['area']
    q = NOTE7(A * 0.40 / a)
    if q >= 3: return q
    if NOTE7(A * 0.31 / a) >= 2: return 2
    if NOTE7(A * 0.53 / a) >= 1: return 1
    return 0

def fill_table(conduit, wtype, sizes, trades):
    head = ''.join(f'<th>{t}"</th>' for t in trades)
    body = ''
    for s in sizes:
        a = D['wire'][wtype][s]['area']
        lab = f'{s} kcmil' if s in ('250','300','350','400','500') else (s if '/' in s else f'#{s}')
        body += f'<tr><td>{lab}</td>' + ''.join(f'<td>{max_same(conduit, t, a)}</td>' for t in trades) + '</tr>'
    return f'<div class="scroll"><table class="ref"><thead><tr><th>THHN size</th>{head}</tr></thead><tbody>{body}</tbody></table></div>'

def vd_table(volts, loads, sizes):
    # K-method, copper, single phase, 3%: L = 0.03*V*CM / (2*K*I)
    amp75 = {s: D['amp'][s]['cu'][1] for s in sizes}; cap = {'14': 15, '12': 20, '10': 30}
    head = ''.join(f'<th>{i} A</th>' for i in loads)
    body = ''
    for s in sizes:
        cm = D['t8'][s]['cm']; row = f'<tr><td>#{s} Cu</td>'
        for i in loads:
            lim = min(amp75[s], cap.get(s, 9999))
            row += '<td>–</td>' if lim < i else f'<td>{int(0.03*volts*cm/(2*12.9*i))} ft</td>'
        body += row + '</tr>'
    return f'<div class="scroll"><table class="ref"><thead><tr><th>Wire</th>{head}</tr></thead><tbody>{body}</tbody></table></div>'

LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 3 7 13h5l-1 8 6-10h-5z" fill="#e8a400"/></svg>'

PRO_DIALOG = '''<dialog id="pro-dialog" aria-labelledby="pro-title"><div class="modal">
<button class="close" type="button" aria-label="Close">×</button>
<h2 id="pro-title">RacewayCalc Pro is coming</h2>
<p class="note mt0">Pro isn't live yet. Join the waitlist and get the founding price of $39/year when it launches. No payment now.</p>
<form novalidate>
<div class="field"><label for="wl-email">Work email</label><input id="wl-email" name="email" type="email" autocomplete="email" required placeholder="you@company.com"></div>
<div class="field"><label for="wl-trade">Your trade</label><select id="wl-trade" name="trade"><option value="electrician">Licensed electrician (JW/Master)</option><option value="apprentice">Apprentice</option><option value="contractor">Electrical contractor / owner</option><option value="engineer">Engineer / designer</option><option value="inspector">Inspector</option><option value="other">Other</option></select></div>
<fieldset><legend>Would you pay $39/year for Pro?</legend>
<label class="radio"><input type="radio" name="would_pay" value="yes" required>Yes, I'd pay that</label>
<label class="radio"><input type="radio" name="would_pay" value="maybe">Maybe, depends on features</label>
<label class="radio"><input type="radio" name="would_pay" value="no">No, I'd only use the free tools</label></fieldset>
<div class="field"><label for="wl-wish">What would make Pro worth it? (optional)</label><textarea id="wl-wish" name="wish" maxlength="500" placeholder="e.g. PDF report for the inspector, saved jobs"></textarea></div>
<input class="sr" tabindex="-1" autocomplete="off" name="company" aria-hidden="true">
<button class="btn primary" type="submit" style="width:100%">Join the waitlist</button>
<p class="note form-msg" role="status"></p>
<p class="note">We'll only email you about Pro. See <a href="/privacy/">privacy</a>.</p>
</form>
<div class="thanks hide"><h3>You're on the list ✓</h3><p class="note">Thanks. We'll email you when Pro opens, with the founding price.</p></div>
</div></dialog>'''

PRO_BOX = '''<div class="pro"><strong>RacewayCalc Pro: $39/yr</strong>
<p>Save jobs, export a clean PDF for the inspector, switch NEC 2020/2023/2026 tables, and share calcs with your crew.</p>
<button class="btn primary small" type="button" data-pro="{tool}-result">Get Pro, $39/yr</button></div>'''

DISCLAIMER = '''<p class="disclaimer"><strong>Check before you build.</strong> Results are estimates based on NFPA 70 (NEC) 2023 Chapter 9 tables, for reference only. Code editions and local amendments vary: always verify with the code adopted in your area and your authority having jurisdiction (AHJ). Not engineering advice.</p>'''

def page(path, title, desc, body, tool='home', schema=None, scripts=''):
    url = SITE_URL + path
    ld = ''.join(f'<script type="application/ld+json">{json.dumps(s, separators=(",",":"))}</script>' for s in (schema or []))
    return f'''<!doctype html><html lang="en-US"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{url}"><meta name="robots" content="index,follow">
<meta property="og:type" content="website"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(desc)}"><meta property="og:url" content="{url}"><meta property="og:site_name" content="{BRAND}">
<meta name="twitter:card" content="summary"><meta name="theme-color" content="#e8a400">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/style.css">
<script src="/assets/config.js"></script>{ld}</head>
<body data-tool="{tool}"><header class="site"><div class="wrap"><a class="brand" href="/">{LOGO}{BRAND}</a>
<nav class="top" aria-label="Tools"><a href="/conduit-fill-calculator/">Conduit fill</a><a href="/voltage-drop-calculator/">Voltage drop</a></nav></div></header>
<main class="wrap">{body}</main>
<footer class="site"><div class="wrap"><p>{BRAND}: free field calculators for US electricians. Built from NEC 2023 Chapter 9 tables, cross-checked against published examples.</p>
<p>NEC® and NFPA 70® are registered trademarks of the National Fire Protection Association. {BRAND} is not affiliated with or endorsed by NFPA. Verify every result with your adopted code and AHJ.</p>
<p><a href="/">Home</a> · <a href="/privacy/">Privacy</a> · <a href="/conduit-fill-calculator/">Conduit fill calculator</a> · <a href="/voltage-drop-calculator/">Voltage drop calculator</a></p></div></footer>
{PRO_DIALOG}
<script src="/assets/app.js" defer></script>{scripts}</body></html>'''

def faq_html(faqs):
    return '<section class="faq"><h2>FAQ</h2>' + ''.join(f'<details><summary>{html.escape(q)}</summary><p>{a}</p></details>' for q, a in faqs) + '</section>'
def faq_ld(faqs):
    import re
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a)}} for q, a in faqs]}
def app_ld(name, path, desc):
    return {"@context": "https://schema.org", "@type": "WebApplication", "name": name, "url": SITE_URL + path, "description": desc, "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (web browser)", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}, "publisher": {"@type": "Organization", "name": BRAND}}
def crumbs_ld(name, path):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/"}, {"@type": "ListItem", "position": 2, "name": name, "item": SITE_URL + path}]}

# ---------------- Conduit fill page ----------------
CF_FAQ = [
 ("What is the maximum conduit fill allowed by the NEC?", "NEC Chapter 9, Table 1 limits fill to 53% of the raceway's inside area for one conductor, 31% for two conductors, and 40% for three or more. Nipples 24 inches or shorter may be filled to 60% (Chapter 9, Note 4)."),
 ("How many #12 THHN wires fit in 3/4 inch EMT?", "Sixteen. 3/4\" EMT has 0.533 in² of inside area; 40% of that is 0.2132 in². A #12 THHN conductor is 0.0133 in², and 0.2132 ÷ 0.0133 = 16.03, which rounds down to 16. This matches NEC Annex C, Table C.1."),
 ("Does the ground wire count toward conduit fill?", "Yes. Equipment grounding and bonding conductors count when calculating fill (Chapter 9, Note 3). Use Table 5 for insulated grounds and Table 8 for bare conductors."),
 ("When can I round up the number of conductors?", "Only when every conductor in the raceway is the same size and insulation. Chapter 9, Note 7 lets you round up to the next whole number when the calculated decimal is 0.8 or more. For example, #8 THHN in 3/4\" EMT works out to 5.83, so 6 are permitted."),
 ("Why does PVC hold fewer wires than EMT of the same trade size?", "Trade size is a nominal name, not the inside diameter. 3/4\" Schedule 40 PVC has 0.508 in² inside versus 0.533 in² for 3/4\" EMT, and Schedule 80 has only 0.409 in². Always use the Table 4 row for the raceway you're actually installing."),
 ("What is jam ratio?", "When pulling exactly three conductors, they can wedge side by side in a bend if the raceway inside diameter is 2.8 to 3.2 times the conductor outside diameter (Chapter 9, Table 1, Informational Note 2). The calculator flags that range so you can upsize the raceway or change the pull."),
 ("Does conduit fill tell me how many current-carrying conductors I can run?", "No. Fill is only about physical space. With more than three current-carrying conductors in a raceway, Table 310.15(C)(1) adjustment factors reduce each conductor's ampacity, which often limits a circuit before fill does."),
]
cf_desc = "Free NEC conduit fill calculator for EMT, PVC, RMC, IMC and flex. Mix THHN, XHHW, THW and bare grounds; get fill %, the 53/31/40% limit, smallest conduit size and jam ratio."
cf_body = f'''<p class="crumbs"><a href="/">Home</a> › Conduit fill calculator</p>
<h1>Conduit Fill Calculator (NEC Chapter 9)</h1>
<p class="lede">Mix wire sizes and insulation types, add the ground, and see fill % against the NEC 53% / 31% / 40% limits. Uses Chapter 9 Tables 1, 4, 5 and 8 (2023).</p>
<div class="tool">
<form id="calc" class="card" autocomplete="off">
<div class="row2"><div class="field"><label for="conduit">Raceway type</label><select id="conduit"></select></div>
<div class="field"><label for="trade">Trade size</label><select id="trade"></select></div></div>
<label class="check"><input type="checkbox" id="nipple">Nipple 24 in or shorter (60% fill)</label>
<div id="rows"></div>
<div class="btns"><button type="button" class="btn small" id="add">+ Add conductors</button><button type="button" class="btn small" id="addGround">+ Bare ground</button></div>
<p class="note">Custom area: use for multiconductor cable, treated as one conductor using its outside area (Chapter 9, Note 9).</p>
</form>
<div class="card result-card" aria-live="polite"><div id="out"></div>
<div class="btns"><button type="button" class="btn small" id="copy">Copy link</button><button type="button" class="btn small" id="print">Print</button></div>
{PRO_BOX.format(tool='conduit')}</div>
</div>
{DISCLAIMER}
<section class="explainer">
<h2>How conduit fill is calculated</h2>
<p>Add up the cross-sectional area of every conductor, then compare it with the allowed share of the raceway's inside area.</p>
<p class="formula">Total conductor area (Table 5 / Table 8) ≤ Raceway area (Table 4) × Fill limit (Table 1)</p>
<ol><li><strong>Find each conductor's area</strong> in Chapter 9, Table 5 (insulated) or Table 8 (bare). Insulation matters: #12 THW is 0.0181 in², #12 THHN only 0.0133 in².</li>
<li><strong>Count every conductor</strong>, including the equipment ground (Note 3).</li>
<li><strong>Pick the fill limit</strong> from Table 1: 53% for 1 wire, 31% for 2, 40% for 3 or more (60% for short nipples).</li>
<li><strong>Compare</strong> the total with Table 4's area for the exact raceway type and trade size.</li></ol>
<h3>Worked example: 3 #10 THHN + 1 #10 bare in 1/2" EMT</h3>
<p>3 × 0.0211 + 1 × 0.011 = 0.0743 in². 1/2" EMT is 0.304 in² inside, so fill is 0.0743 ÷ 0.304 = 24.4%, under the 40% limit (0.1216 in²). ✓</p>
<h2>Max THHN conductors in EMT (same size)</h2>
<p class="note mt0">Annex C method, 40% fill, Note 7 rounding. Recalculated from Tables 4 and 5.</p>
{fill_table('EMT','THHN',['14','12','10','8','6','4','3','2','1','1/0','2/0','3/0','4/0'],['1/2','3/4','1','1-1/4','1-1/2','2','2-1/2','3'])}
<h2>Max THHN conductors in Schedule 40 PVC</h2>
{fill_table('PVC40','THHN',['14','12','10','8','6','4','3','2','1','1/0','2/0','3/0','4/0'],['1/2','3/4','1','1-1/4','1-1/2','2','2-1/2','3'])}
</section>
{faq_html(CF_FAQ)}
<h2>Accuracy</h2><p class="note">This calculator's results match NEC Annex C counts (for example 16 #12 THHN in 3/4" EMT, 15 in 3/4" PVC 40, 11 #12 XHHW in 3/4" EMT) and worked examples published by Mike Holt. Table data: NFPA 70 (2023) Chapter 9. Last checked {TODAY}.</p>'''

# ---------------- Voltage drop page ----------------
VD_FAQ = [
 ("What voltage drop does the NEC allow?", "The NEC recommends (in Informational Notes to 210.19 and 215.2) no more than 3% on a branch circuit or feeder and 5% combined from the service to the farthest outlet. These notes are recommendations, not enforceable rules, unless your jurisdiction or a specific section (such as fire pumps or sensitive electronic equipment) requires a limit."),
 ("What formula does this voltage drop calculator use?", "Single-phase and DC: VD = 2 × I × Z × L ÷ 1000. Three-phase: VD = 1.732 × I × Z × L ÷ 1000. I is the load current, L the one-way length in feet, and Z the conductor's ohms per 1,000 ft from NEC Chapter 9 Table 9 (AC), Table 8 (DC resistance), or the K-factor method (K = 12.9 copper, 21.2 aluminum)."),
 ("Should I use one-way or round-trip length?", "One-way. The 2 (single-phase) or 1.732 (three-phase) in the formula already accounts for the return path. Measure along the route the wire takes, including vertical runs."),
 ("What's the difference between Table 8 and Table 9?", "Table 8 lists DC resistance. Table 9 lists AC resistance and reactance for conductors in PVC, aluminum or steel conduit, and lets you account for power factor. For #1/0 and smaller the results are close; for larger conductors, long feeders and motor loads, Table 9 is more accurate."),
 ("What current should I enter?", "The actual load current at 100%. Don't use 125% for continuous loads or motors here; that factor is for sizing conductors for ampacity, not for voltage drop."),
 ("Does the recommended size meet ampacity too?", "With \"Also check ampacity\" on, the recommended size must meet your voltage-drop target and have a 75°C ampacity (Table 310.16) at least equal to the load, and respects the 240.4(D) small-conductor breaker limits. You still need to apply temperature correction, adjustment factors and terminal ratings for your installation."),
 ("How do I fix too much voltage drop?", "Upsize the conductor, run parallel sets (1/0 and larger), use a higher system voltage, shorten the run, or move the panel or transformer closer to the load."),
]
vd_desc = "Free voltage drop calculator for US electricians: single-phase, three-phase or DC, copper or aluminum, NEC Chapter 9 Table 9/Table 8 or K-factor. Get % drop, recommended wire size and max distance."
vd_body = f'''<p class="crumbs"><a href="/">Home</a> › Voltage drop calculator</p>
<h1>Voltage Drop Calculator (NEC Table 9)</h1>
<p class="lede">Single-phase, three-phase or DC, copper or aluminum. Get the % drop, voltage at the load, the smallest wire that meets your target, and how far you can run it.</p>
<div class="tool">
<form id="calc" class="card" autocomplete="off">
<div class="row2"><div class="field"><label for="phase">System</label><select id="phase"><option value="1">Single-phase AC</option><option value="3">Three-phase AC</option><option value="dc">DC</option></select></div>
<div class="field"><label for="volts">Voltage (V)</label><input id="volts" type="number" min="1" step="any" inputmode="decimal"></div></div>
<div class="btns" style="margin:-4px 0 12px"><button type="button" class="btn small" data-v="120">120</button><button type="button" class="btn small" data-v="208">208</button><button type="button" class="btn small" data-v="240">240</button><button type="button" class="btn small" data-v="277">277</button><button type="button" class="btn small" data-v="480">480</button></div>
<div class="row2"><div class="field"><label for="amps">Load current (A)</label><input id="amps" type="number" min="0" step="any" inputmode="decimal"></div>
<div class="field"><label for="length">One-way length (ft)</label><input id="length" type="number" min="0" step="any" inputmode="decimal"></div></div>
<div class="row3"><div class="field"><label for="material">Conductor</label><select id="material"><option value="cu">Copper</option><option value="al">Aluminum</option></select></div>
<div class="field"><label for="size">Wire size</label><select id="size"></select></div>
<div class="field"><label for="sets">Parallel sets</label><select id="sets"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></div></div>
<div class="field"><label for="method">Method</label><select id="method"><option value="t9">NEC Table 9: AC impedance (recommended)</option><option value="t8">NEC Table 8: DC resistance</option><option value="k">K-factor: 2·K·I·L ÷ CM</option></select></div>
<p id="dcnote" class="note hide">DC circuits use Table 8 resistance.</p>
<div id="t9opts" class="row2"><div class="field"><label for="conduit">Raceway</label><select id="conduit"><option value="pvc">PVC</option><option value="al">Aluminum</option><option value="steel">Steel (EMT/RMC)</option></select></div>
<div class="field"><label for="pf">Power factor</label><input id="pf" type="number" min="0.05" max="1" step="0.01" inputmode="decimal"></div></div>
<div class="row2"><div class="field"><label for="target">Target max drop (%)</label><select id="target"><option value="2">2%</option><option value="3">3% (branch or feeder)</option><option value="5">5% (total)</option></select></div>
<div class="field" style="align-self:end"><label class="check"><input type="checkbox" id="amp">Also check ampacity</label></div></div>
</form>
<div class="card result-card" aria-live="polite"><div id="out"></div>
<div class="btns"><button type="button" class="btn small" id="copy">Copy link</button><button type="button" class="btn small" id="print">Print</button></div>
{PRO_BOX.format(tool='vdrop')}</div>
</div>
<h2>Every wire size for these inputs</h2>
<div class="scroll"><table class="ref"><thead><tr><th>Size</th><th>Drop (V)</th><th>Drop %</th><th>75°C amps</th><th>OK</th></tr></thead><tbody id="allsizes"></tbody></table></div>
{DISCLAIMER}
<section class="explainer">
<h2>How voltage drop is calculated</h2>
<p class="formula">Single-phase / DC: VD = 2 × I × Z × L ÷ 1000<br>Three-phase: VD = 1.732 × I × Z × L ÷ 1000<br>Table 9 AC: Z = R × PF + X<sub>L</sub> × sin(arccos PF)</p>
<p>I is load amps, L is the one-way length in feet, and Z is ohms per 1,000 ft of one conductor. The percent drop is VD ÷ source voltage × 100.</p>
<h3>Worked example: 240 V, 44 A, 160 ft, #6 copper</h3>
<p>Using the K-factor method: VD = 2 × 12.9 × 44 × 160 ÷ 26,240 = 6.9 V, which is 2.9% of 240 V. The load sees about 233.1 V. That's under the 3% recommendation. (Same answer as Mike Holt's published example.)</p>
<h2>Max distance at 3% drop: 120 V single-phase, copper</h2>
<p class="note mt0">K-factor method, one-way feet. "–" means the wire's 75°C ampacity or 240.4(D) breaker limit is below the load.</p>
{vd_table(120,[15,20,30,40,50],['14','12','10','8','6','4'])}
<h2>Max distance at 3% drop: 240 V single-phase, copper</h2>
{vd_table(240,[15,20,30,40,50,60],['14','12','10','8','6','4','3','2'])}
</section>
{faq_html(VD_FAQ)}
<h2>Accuracy</h2><p class="note">Results match Calculator.net's NEC Table 9 mode to the hundredth of a volt on three test circuits, and Mike Holt's published examples (#6 Cu at 44 A over 160 ft = 6.9 V; #1 Al at 100 A, 208 V 3-phase, 80 ft = 3.51 V). Table data: NFPA 70 (2023) Chapter 9. Last checked {TODAY}.</p>'''

home_body = f'''<h1>Free NEC calculators for electricians</h1>
<p class="lede">Fast, accurate, phone-friendly. No sign-up. Built from NEC 2023 Chapter 9 tables and cross-checked against published examples.</p>
<div class="tools">
<a class="card" href="/conduit-fill-calculator/"><h2>Conduit fill calculator</h2><p>EMT, PVC, RMC, IMC, flex. Mixed THHN/XHHW/THW plus bare grounds. Fill %, smallest conduit, jam ratio.</p></a>
<a class="card" href="/voltage-drop-calculator/"><h2>Voltage drop calculator</h2><p>1-phase, 3-phase or DC. Copper or aluminum. Table 9 AC impedance, recommended size and max distance.</p></a>
</div>
<div class="pro" style="margin-top:20px"><strong>Coming soon: RacewayCalc Pro, $39/yr</strong><p>Saved jobs, inspector-ready PDF reports, NEC edition switch, crew sharing.</p><button class="btn primary small" type="button" data-pro="home">Join the waitlist</button></div>
{DISCLAIMER}'''

privacy_body = f'''<h1>Privacy</h1>
<p>Last updated {TODAY}.</p>
<h2>What we measure</h2><p>We count anonymous events (page views, calculator uses, clicks on the Pro button and waitlist signups) to learn which tools are useful. We don't set advertising cookies, don't build profiles and don't sell data. Your calculator inputs stay in your browser; they are only placed in the page link so you can share it.</p>
<h2>Waitlist</h2><p>If you join the Pro waitlist, we store your email, trade, your answer about pricing and any comment. We use them only to tell you about Pro and to decide what to build. Ask us to delete them at any time by replying to any email from us.</p>
<h2>Third parties</h2><p>The site is hosted on a static host. Analytics and the waitlist form may be processed by a privacy-focused provider acting on our behalf.</p>'''

# ---------------- write ----------------
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(OUT, 'assets'))
def w(rel, content):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    if rel.endswith('.html'): content = content.replace('href="/', 'href="' + BASE + '/').replace('src="/', 'src="' + BASE + '/')
    open(p, 'w').write(content)
w('index.html', page('/', f'Free NEC Calculators for Electricians | {BRAND}', 'Free conduit fill and voltage drop calculators for US electricians, built from NEC Chapter 9 tables and checked against published examples.', home_body,
  schema=[{"@context": "https://schema.org", "@type": "WebSite", "name": BRAND, "url": SITE_URL + "/"}]))
w('conduit-fill-calculator/index.html', page('/conduit-fill-calculator/', 'Conduit Fill Calculator (NEC 2023): EMT, PVC, RMC | ' + BRAND, cf_desc, cf_body, tool='conduit',
  schema=[app_ld('Conduit Fill Calculator', '/conduit-fill-calculator/', cf_desc), faq_ld(CF_FAQ), crumbs_ld('Conduit fill calculator', '/conduit-fill-calculator/')],
  scripts='<script src="/assets/nec-data.js" defer></script><script src="/assets/engine.js" defer></script><script src="/assets/conduit.js" defer></script>'))
w('voltage-drop-calculator/index.html', page('/voltage-drop-calculator/', 'Voltage Drop Calculator (NEC Table 9): Wire Size & Distance | ' + BRAND, vd_desc, vd_body, tool='vdrop',
  schema=[app_ld('Voltage Drop Calculator', '/voltage-drop-calculator/', vd_desc), faq_ld(VD_FAQ), crumbs_ld('Voltage drop calculator', '/voltage-drop-calculator/')],
  scripts='<script src="/assets/nec-data.js" defer></script><script src="/assets/engine.js" defer></script><script src="/assets/vd.js" defer></script>'))
w('privacy/index.html', page('/privacy/', f'Privacy | {BRAND}', f'How {BRAND} handles analytics and waitlist data.', privacy_body))
w('404.html', page('/404.html', f'Page not found | {BRAND}', 'Page not found.', '<h1>Page not found</h1><p><a href="/">Go to the calculators</a></p>'))
w('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#16181d"/><path d="M13 3 7 13h5l-1 8 6-10h-5z" fill="#e8a400"/></svg>')
w('robots.txt', f'User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n')
w('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{SITE_URL}{p}</loc><lastmod>{TODAY}</lastmod></url>' for p in ['/', '/conduit-fill-calculator/', '/voltage-drop-calculator/', '/privacy/']) + '</urlset>\n')
w('.nojekyll', '')
print('built', OUT, 'for', SITE_URL)
