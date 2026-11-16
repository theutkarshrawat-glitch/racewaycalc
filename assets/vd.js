(function () {
  var E = window.ETEngine, NEC = E.NEC, $ = function (s) { return document.querySelector(s); };
  var state = { phase: '1', volts: '120', amps: '16', length: '100', material: 'cu', size: '12', sets: '1', method: 't9', conduit: 'pvc', pf: '0.85', target: '3', amp: true };
  var KEYS = Object.keys(state);
  function readHash() {
    try { var h = new URLSearchParams(location.hash.slice(1)); KEYS.forEach(function (k) { if (h.has(k)) state[k] = k === 'amp' ? h.get(k) === '1' : h.get(k); }); } catch (e) {}
  }
  function writeHash() { history.replaceState(null, '', '#' + KEYS.map(function (k) { return k + '=' + encodeURIComponent(k === 'amp' ? (state.amp ? 1 : 0) : state[k]); }).join('&')); }
  function sizeLabel(s) { return (+s >= 250) ? s + ' kcmil' : s + ' AWG'; }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function opts() { return { method: state.phase === 'dc' && state.method === 't9' ? 't8' : state.method, material: state.material, size: state.size, phase: state.phase, volts: +state.volts, amps: +state.amps, length: +state.length, sets: +state.sets || 1, conduit: state.conduit, pf: +state.pf }; }

  function fill() {
    var sizes = E.validSizes(state.material);
    if (sizes.indexOf(state.size) < 0) state.size = sizes[0];
    $('#size').innerHTML = sizes.map(function (s) { return '<option value="' + s + '"' + (s === state.size ? ' selected' : '') + '>' + sizeLabel(s) + '</option>'; }).join('');
    KEYS.forEach(function (k) { var el = document.getElementById(k); if (!el || k === 'size') return; if (el.type === 'checkbox') el.checked = !!state[k]; else el.value = state[k]; });
    var t9 = state.method === 't9' && state.phase !== 'dc';
    $('#t9opts').classList.toggle('hide', !t9);
    $('#dcnote').classList.toggle('hide', !(state.phase === 'dc' && state.method === 't9'));
  }
  function calc() {
    var o = opts(), out = $('#out');
    if (!(o.volts > 0 && o.amps > 0 && o.length > 0)) { out.innerHTML = '<p class="note">Enter voltage, current and length.</p>'; return; }
    var r = E.voltageDrop(o); if (!r) { out.innerHTML = '<p class="note">No table value for that size.</p>'; return; }
    var target = +state.target || 3;
    var cls = r.pct <= target ? 'ok' : (r.pct <= 5 ? 'warn' : 'bad');
    var txt = r.pct <= target ? '✓ At or under your ' + target + '% target' : '✗ Over your ' + target + '% target';
    var rec = E.recommend(o, target, state.amp);
    var maxL = E.maxLength(o, target);
    var amp = E.ampacity75(o.material, o.size, o.sets), cap = E.smallConductorOCPD(o.material, o.size);
    var html = '<div class="big">' + fmt(r.pct, 2) + '<small>% drop</small></div><span class="status ' + cls + '">' + txt + '</span>' +
      '<dl class="kv"><dt>Voltage drop</dt><dd>' + fmt(r.vd, 2) + ' V</dd><dt>Voltage at load</dt><dd>' + fmt(r.endVolts, 1) + ' V</dd>' +
      '<dt>Ω per 1,000 ft used</dt><dd>' + fmt(r.zPerKft, 4) + '</dd>' +
      '<dt>Max one-way length at ' + target + '%</dt><dd>' + (maxL ? Math.floor(maxL).toLocaleString() + ' ft' : '–') + '</dd>' +
      '<dt>Smallest size for ' + target + '%' + (state.amp ? ' + ampacity' : '') + '</dt><dd>' + (rec ? sizeLabel(rec.size) + ' (' + fmt(rec.result.pct, 2) + '%)' : 'Over 1000 kcmil: add parallel sets') + '</dd>' +
      '<dt>' + sizeLabel(o.size) + ' ampacity, 75°C</dt><dd>' + (amp != null ? amp + ' A' + (o.sets > 1 ? ' (' + o.sets + ' sets)' : '') : '–') + '</dd></dl>';
    if (amp != null && amp < o.amps) html += '<div class="alert bad">' + sizeLabel(o.size) + ' is rated ' + amp + ' A at 75°C (Table 310.16), below the ' + o.amps + ' A load.</div>';
    else if (cap && cap * o.sets < o.amps) html += '<div class="alert warn">240.4(D) limits ' + sizeLabel(o.size) + ' ' + (o.material === 'cu' ? 'copper' : 'aluminum') + ' to a ' + cap + ' A breaker.</div>';
    var mname = { t9: 'NEC Ch. 9 Table 9 (AC, PF ' + o.pf + ', ' + { pvc: 'PVC', al: 'aluminum', steel: 'steel' }[o.conduit] + ' conduit)', t8: 'NEC Ch. 9 Table 8 (DC resistance, 75°C)', k: 'K-factor (K = ' + E.K[o.material] + ')' }[o.method];
    html += '<p class="note">Method: ' + mname + '. ' + (o.phase === '3' ? 'Three-phase: VD = 1.732 × I × Z × L ÷ 1000.' : 'Single-phase/DC: VD = 2 × I × Z × L ÷ 1000.') + ' L is one-way length.</p>';
    out.innerHTML = html;
    // all-sizes table
    var rows = E.validSizes(o.material).map(function (s) {
      var x = E.voltageDrop(Object.assign({}, o, { size: s })); if (!x) return '';
      var a = E.ampacity75(o.material, s, o.sets);
      var ok = x.pct <= target && (!state.amp || (a != null && a >= o.amps));
      return '<tr' + (s === o.size ? ' style="font-weight:700"' : '') + '><td>' + sizeLabel(s) + '</td><td>' + fmt(x.vd, 2) + '</td><td>' + fmt(x.pct, 2) + '%</td><td>' + (a != null ? a : '–') + '</td><td>' + (ok ? '✓' : '') + '</td></tr>';
    }).join('');
    $('#allsizes').innerHTML = rows;
    writeHash();
  }
  function onInput(e) {
    var t = e.target; if (!t.id || !(t.id in state)) return;
    state[t.id] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.id === 'voltsPreset') return;
    if (t.id === 'material' || t.id === 'method' || t.id === 'phase') fill();
    calc(); window.ETToolUsed && window.ETToolUsed({ phase: state.phase, material: state.material });
  }
  readHash(); fill(); calc();
  var form = $('#calc');
  form.addEventListener('input', onInput); form.addEventListener('change', onInput);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  document.querySelectorAll('[data-v]').forEach(function (b) { b.addEventListener('click', function () { state.volts = b.getAttribute('data-v'); $('#volts').value = state.volts; calc(); window.ETToolUsed && window.ETToolUsed({}); }); });
  $('#copy').addEventListener('click', function () {
    var b = this; (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function () { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500); }, function () { prompt('Copy this link', location.href); });
  });
  $('#print').addEventListener('click', function () { window.print(); });
})();
