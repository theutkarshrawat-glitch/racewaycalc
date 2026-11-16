/* Shared site script: privacy-friendly event tracking + Pro waitlist (fake-door) modal. */
(function () {
  var C = window.ET_CONFIG || {};
  var tool = document.body.getAttribute('data-tool') || 'home';

  // ---------- Tracking ----------
  // No cookies, no personal data in events. Events: pageview, tool_use, pro_click, waitlist_open, waitlist_signup.
  function localCount(name) {
    try { var k = 'et_ev_' + name; localStorage.setItem(k, String((+localStorage.getItem(k) || 0) + 1)); } catch (e) {}
  }
  function track(name, props) {
    props = props || {};
    props.tool = props.tool || tool;
    localCount(name);
    try {
      if (C.goatcounterCode && window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: 'ev/' + name + '/' + props.tool, title: name, event: true });
      }
      if (C.eventEndpoint) {
        var body = JSON.stringify({ event: name, props: props, path: location.pathname, ts: new Date().toISOString(), ref: document.referrer ? new URL(document.referrer).hostname : '' });
        if (navigator.sendBeacon) navigator.sendBeacon(C.eventEndpoint, new Blob([body], { type: 'text/plain' }));
        else fetch(C.eventEndpoint, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' });
      }
    } catch (e) {}
    if (location.search.indexOf('debug=1') > -1) console.log('[track]', name, props);
  }
  window.ETTrack = track;

  if (C.goatcounterCode) {
    var s = document.createElement('script');
    s.async = true; s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + C.goatcounterCode + '.goatcounter.com/count');
    document.head.appendChild(s);
  }
  if (C.eventEndpoint) track('pageview');

  // tool_use fires once per page view, after the visitor changes an input and a result is shown.
  var used = false;
  window.ETToolUsed = function (detail) { if (used) return; used = true; track('tool_use', detail || {}); };

  // ---------- Pro waitlist modal ----------
  var dlg = document.getElementById('pro-dialog');
  function openPro(source) {
    track('pro_click', { source: source || 'button' });
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    track('waitlist_open');
    var em = dlg.querySelector('input[type=email]'); if (em) setTimeout(function () { em.focus(); }, 50);
  }
  document.querySelectorAll('[data-pro]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openPro(b.getAttribute('data-pro')); });
  });
  if (!dlg) return;
  dlg.querySelector('.close').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  var form = dlg.querySelector('form');
  var msg = dlg.querySelector('.form-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    if (fd.get('company')) return; // honeypot
    var email = String(fd.get('email') || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    var data = { email: email, trade: fd.get('trade') || '', would_pay: fd.get('would_pay') || '', wish: String(fd.get('wish') || '').slice(0, 500), tool: tool, page: location.pathname, ts: new Date().toISOString() };
    track('waitlist_signup', { trade: data.trade, would_pay: data.would_pay });
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    function done() {
      form.classList.add('hide');
      dlg.querySelector('.thanks').classList.remove('hide');
    }
    if (C.waitlistEndpoint) {
      fetch(C.waitlistEndpoint, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(done, function () { msg.textContent = 'Could not send right now. Please try again.'; btn.disabled = false; });
    } else {
      // PLACEHOLDER: no form backend configured yet; keep a local copy so nothing breaks in testing.
      try { var k = 'et_waitlist'; var arr = JSON.parse(localStorage.getItem(k) || '[]'); arr.push(data); localStorage.setItem(k, JSON.stringify(arr)); } catch (err) {}
      console.warn('ET_CONFIG.waitlistEndpoint is empty: signup kept in this browser only.');
      done();
    }
  });
})();
