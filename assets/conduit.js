(function () {
  var E = window.ETEngine, NEC = E.NEC, $ = function (s) { return document.querySelector(s); };
  var TYPES = ['THHN', 'XHHW', 'THW', 'BARE', 'CUSTOM'];
  var TYPE_LABEL = { THHN: 'THHN/THWN', XHHW: 'XHHW', THW: 'THW/TW', BARE: 'Bare', CUSTOM: 'Custom area' };
  var state = { conduit: 'EMT', size: '3/4', nipple: false, rows: [{ count: 3, type: 'THHN', size: '12' }, { count: 1, type: 'THHN', size: '12' }] };

  function readHash() {
    try {
      var h = new URLSearchParams(location.hash.slice(1));
      if (!h.get('c')) return;
      if (NEC.conduits[h.get('c')]) state.conduit = h.get('c');
      if (NEC.conduits[state.conduit][h.get('t')]) state.size = h.get('t');
      state.nipple = h.get('n') === '1';
      var r = (h.get('r') || '').split(',').filter(Boolean).map(function (x) {
        var p = x.split('~'); return p[1] === 'CUSTOM' ? { count: +p[0], type: 'CUSTOM', area: p[2] } : { count: +p[0], type: p[1], size: p[2] };
      }).filter(function (x) { return TYPES.indexOf(x.type) > -1; });
      if (r.length) state.rows = r;
    } catch (e) {}
  }
  function writeHash() {
    var r = state.rows.map(function (x) { return x.count + '~' + x.type + '~' + (x.type === 'CUSTOM' ? x.area : x.size); }).join(',');
    history.replaceState(null, '', '#c=' + state.conduit + '&t=' + encodeURIComponent(state.size) + '&n=' + (state.nipple ? 1 : 0) + '&r=' + encodeURIComponent(r));
  }
  function opt(v, l, sel) { return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + l + '</option>'; }
  function sizeLabel(s) { return (+s >= 250) ? s + ' kcmil' : (s.indexOf('/') > -1 ? s : '#' + s); }

  function renderSelects() {
    $('#conduit').innerHTML = Object.keys(E.CONDUIT_NAMES).map(function (k) { return opt(k, E.CONDUIT_NAMES[k], state.conduit); }).join('');
    var sizes = E.tradeSizes(state.conduit);
    if (sizes.indexOf(state.size) < 0) state.size = sizes[1] || sizes[0];
    $('#trade').innerHTML = sizes.map(function (s) { return opt(s, s + '"', state.size); }).join('');
    $('#nipple').checked = state.nipple;
  }
  function renderRows() {
    var html = state.rows.map(function (r, i) {
      var sizeField = r.type === 'CUSTOM'
        ? '<div><label for="a' + i + '">Area in²</label><input id="a' + i + '" data-i="' + i + '" data-k="area" type="number" step="0.0001" min="0" inputmode="decimal" value="' + (r.area || '') + '" placeholder="0.1590"></div>'
        : '<div><label for="s' + i + '">Size</label><select id="s' + i + '" data-i="' + i + '" data-k="size">' + NEC.sizes.map(function (s) { return opt(s, sizeLabel(s), r.size); }).join('') + '</select></div>';
      return '<div class="cond"><div><label for="q' + i + '">Qty</label><input id="q' + i + '" data-i="' + i + '" data-k="count" type="number" min="0" max="999" inputmode="numeric" value="' + r.count + '"></div>' +
        '<div><label for="w' + i + '">Insulation</label><select id="w' + i + '" data-i="' + i + '" data-k="type">' + TYPES.map(function (t) { return opt(t, TYPE_LABEL[t], r.type); }).join('') + '</select></div>' +
        sizeField + '<button type="button" class="icon-btn" data-del="' + i + '" aria-label="Remove row">×</button></div>';
    }).join('');
    $('#rows').innerHTML = html;
  }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  function calc() {
    var r = E.computeFill({ conduit: state.conduit, tradeSize: state.size, nipple: state.nipple, rows: state.rows });
    var out = $('#out');
    if (!r.n) { out.innerHTML = '<p class="note">Add at least one conductor.</p>'; return; }
    var limitPct = r.limit * 100;
    var rule = state.nipple ? 'Nipple 24 in or shorter: 60% (Chapter 9, Note 4)' : (r.n === 1 ? '1 conductor: 53%' : r.n === 2 ? '2 conductors: 31%' : 'Over 2 conductors: 40%') + ' (Chapter 9, Table 1)';
    var status = r.pass ? '<span class="status ok">✓ Within ' + fmt(limitPct, 0) + '% fill</span>' : '<span class="status bad">✗ Over the ' + fmt(limitPct, 0) + '% limit</span>';
    var html = '<div class="big">' + fmt(r.fillPct, 1) + '<small>% fill</small></div>' + status +
      '<div class="bar' + (r.pass ? '' : ' over') + '" role="img" aria-label="Fill ' + fmt(r.fillPct, 1) + '% of ' + fmt(limitPct, 0) + '% allowed"><span style="width:' + Math.min(100, r.fillPct) + '%"></span><i style="left:' + limitPct + '%"></i></div>' +
      '<dl class="kv"><dt>Conductors</dt><dd>' + r.n + '</dd><dt>Conductor area</dt><dd>' + fmt(r.totalArea, 4) + ' in²</dd>' +
      '<dt>' + state.size + '" ' + state.conduit + ' total area</dt><dd>' + fmt(r.conduitArea, 3) + ' in²</dd><dt>Allowed (' + fmt(limitPct, 0) + '%)</dt><dd>' + fmt(r.allowedArea, 4) + ' in²</dd>' +
      '<dt>Smallest ' + state.conduit + ' that passes</dt><dd>' + (r.smallest ? r.smallest + '"' : 'None listed') + '</dd></dl>' +
      '<p class="note">' + rule + '.</p>';
    if (r.allSame) {
      var f = state.rows.filter(function (x) { return +x.count > 0; })[0];
      var m = E.maxSame(state.conduit, state.size, f.type, f.size, state.nipple, f.area);
      html += '<p class="note">Max identical conductors in ' + state.size + '" ' + state.conduit + ': <strong>' + m + '</strong> (Annex C method, Note 7 rounding).</p>';
    } else {
      html += '<p class="note">Mixed sizes: Note 7 round-up does not apply.</p>';
    }
    if (r.jamRisk) html += '<div class="alert warn">Jam risk: conduit ID ÷ conductor OD = ' + fmt(r.jamRatio, 2) + ' (2.8–3.2 can jam when pulling 3 conductors; Table 1, Informational Note 2).</div>';
    if (r.missing.length) html += '<div class="alert bad">' + r.missing.length + ' row(s) have no Table 5 value for that size/insulation and were skipped.</div>';
    out.innerHTML = html;
    writeHash();
  }
  function onInput(e) {
    var t = e.target;
    if (t.id === 'conduit') { state.conduit = t.value; renderSelects(); }
    else if (t.id === 'trade') state.size = t.value;
    else if (t.id === 'nipple') state.nipple = t.checked;
    else if (t.dataset.i != null) {
      var row = state.rows[+t.dataset.i], k = t.dataset.k;
      if (k === 'count') row.count = Math.max(0, parseInt(t.value || '0', 10));
      else if (k === 'type') { var was = row.type; row.type = t.value; if (t.value === 'CUSTOM') row.area = row.area || ''; else if (!row.size) row.size = '12'; if ((was === 'CUSTOM') !== (t.value === 'CUSTOM')) renderRows(); }
      else row[k] = t.value;
    } else return;
    calc(); window.ETToolUsed && window.ETToolUsed({ conduit: state.conduit });
  }
  readHash(); renderSelects(); renderRows(); calc();
  var form = $('#calc');
  form.addEventListener('input', onInput); form.addEventListener('change', onInput);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  $('#rows').addEventListener('click', function (e) {
    var d = e.target.getAttribute('data-del'); if (d == null) return;
    state.rows.splice(+d, 1); if (!state.rows.length) state.rows.push({ count: 1, type: 'THHN', size: '12' });
    renderRows(); calc();
  });
  $('#add').addEventListener('click', function () { var last = state.rows[state.rows.length - 1] || {}; state.rows.push({ count: 1, type: last.type === 'CUSTOM' ? 'THHN' : (last.type || 'THHN'), size: last.size || '12' }); renderRows(); calc(); });
  $('#addGround').addEventListener('click', function () { state.rows.push({ count: 1, type: 'BARE', size: '12' }); renderRows(); calc(); });
  $('#copy').addEventListener('click', function () {
    var b = this; (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function () { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500); }, function () { prompt('Copy this link', location.href); });
  });
  $('#print').addEventListener('click', function () { window.print(); });
})();
