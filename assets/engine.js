/* Calculation engine for conduit fill and voltage drop. Pure functions, no DOM.
   Works in the browser (window.ETEngine) and in Node (require) for tests. */
(function (root) {
  var NEC = (typeof module !== 'undefined' && module.exports) ? require('./nec-data.js') : root.NEC;

  var CONDUIT_NAMES = {
    EMT: 'EMT', IMC: 'IMC', RMC: 'RMC (rigid)', PVC40: 'PVC Sch 40 / HDPE', PVC80: 'PVC Sch 80',
    FMC: 'FMC (flex)', LFMC: 'LFMC (liquidtight)'
  };
  var WIRE_NAMES = {
    THHN: 'THHN / THWN / THWN-2',
    XHHW: 'XHHW / XHHW-2 / XHH',
    THW: 'THW / THW-2 / THHW / TW',
    BARE: 'Bare (stranded, Table 8)'
  };

  function round(x, d) { var p = Math.pow(10, d); return Math.round(x * p) / p; }

  // ---------- Conduit fill (NEC Chapter 9, Table 1 + Notes) ----------
  function fillLimit(n, nipple) {
    if (nipple) return 0.60;            // Ch. 9 Note 4: nipples <= 24 in
    if (n <= 0) return 0.40;
    if (n === 1) return 0.53;
    if (n === 2) return 0.31;
    return 0.40;
  }

  function conductorInfo(type, size) {
    if (type === 'BARE') {
      var b = NEC.t8[size];
      return b ? { area: b.area, dia: b.dia } : null;
    }
    var w = NEC.wire[type] && NEC.wire[type][size];
    return w ? { area: w.area, dia: w.dia } : null;
  }

  // Ch. 9 Note 7: when all conductors are the same size, a fractional result of 0.8 or more may be rounded up.
  function note7(x) { var f = Math.floor(x); return (x - f >= 0.8 - 1e-9) ? f + 1 : f; }

  // Explicit order: JS sorts integer-like object keys ('1','2'...) first, so never rely on key order.
  var TRADE_ORDER = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '4', '5', '6'];
  function tradeSizes(conduit) { var c = NEC.conduits[conduit]; return TRADE_ORDER.filter(function (t) { return c[t]; }); }

  function computeFill(opts) {
    var rows = opts.rows || [];
    var total = 0, n = 0, maxDia = 0, sameKey = null, allSame = true, missing = [];
    rows.forEach(function (r) {
      var c = Number(r.count) || 0;
      if (c <= 0) return;
      var info = r.type === 'CUSTOM' ? { area: Number(r.area) || 0, dia: Math.sqrt((Number(r.area) || 0) * 4 / Math.PI) } : conductorInfo(r.type, r.size);
      if (!info || !info.area) { missing.push(r); return; }
      total += c * info.area; n += c;
      if (info.dia > maxDia) maxDia = info.dia;
      var key = r.type + '|' + (r.type === 'CUSTOM' ? r.area : r.size);
      if (sameKey === null) sameKey = key; else if (sameKey !== key) allSame = false;
    });
    var limit = fillLimit(n, opts.nipple);
    var cd = NEC.conduits[opts.conduit][opts.tradeSize];
    var allowed = cd.area * limit;
    var res = {
      n: n, totalArea: total, limit: limit, conduitArea: cd.area, allowedArea: allowed,
      fillPct: cd.area ? total / cd.area * 100 : 0,
      usedOfAllowedPct: allowed ? total / allowed * 100 : 0,
      pass: total <= allowed + 1e-9, allSame: allSame && n > 0, missing: missing
    };
    // Smallest trade size of this conduit type that passes
    res.smallest = null;
    var sizes = tradeSizes(opts.conduit);
    for (var i = 0; i < sizes.length; i++) {
      if (total <= NEC.conduits[opts.conduit][sizes[i]].area * limit + 1e-9) { res.smallest = sizes[i]; break; }
    }
    // Jam ratio warning (Ch. 9 Table 1 Informational Note 2): 3 same-size conductors, ID/OD between 2.8 and 3.2
    if (n === 3 && allSame && maxDia) {
      res.jamRatio = cd.id / maxDia;
      res.jamRisk = res.jamRatio >= 2.8 && res.jamRatio <= 3.2;
    }
    return res;
  }

  // Max number of identical conductors in a raceway (Annex C method)
  function maxSame(conduit, tradeSize, type, size, nipple, customArea) {
    var A = NEC.conduits[conduit][tradeSize].area;
    var a = type === 'CUSTOM' ? Number(customArea) : (conductorInfo(type, size) || {}).area;
    if (!a) return 0;
    if (nipple) return note7(A * 0.60 / a);
    var q40 = note7(A * 0.40 / a);
    if (q40 >= 3) return q40;
    if (note7(A * 0.31 / a) >= 2) return 2;
    if (note7(A * 0.53 / a) >= 1) return 1;
    return 0;
  }

  // ---------- Voltage drop ----------
  var K = { cu: 12.9, al: 21.2 };          // ohm-cmil/ft at 75 C (common K values)
  function cmils(size) { return NEC.t8[size].cm; }

  // Effective ohms per 1000 ft of ONE conductor
  function ohmsPerKft(o) {
    var mat = o.material, size = o.size;
    if (o.method === 'k') return K[mat] * 1000 / cmils(size);
    if (o.method === 't9' && o.phase !== 'dc') {
      // Use the per-km columns (more significant digits), converted to ohms per 1000 ft
      var t = NEC.t9km[size]; if (!t) return null;
      var R = mat === 'cu' ? t.rCu[o.conduit] : t.rAl[o.conduit];
      var X = t.xl[o.conduit];
      if (R == null || X == null) return null;
      var pf = Math.min(1, Math.max(0.05, Number(o.pf) || 0.85));
      return (R * pf + X * Math.sin(Math.acos(pf))) * 0.3048;
    }
    var r8 = NEC.t8[size]; if (!r8) return null;
    return mat === 'cu' ? r8.rCu : r8.rAl;
  }

  function multiplier(phase) { return phase === '3' ? Math.sqrt(3) : 2; }

  function voltageDrop(o) {
    var z = ohmsPerKft(o);
    if (z == null) return null;
    var sets = Math.max(1, Number(o.sets) || 1);
    var vd = multiplier(o.phase) * Number(o.amps) * z * Number(o.length) / 1000 / sets;
    var pct = vd / Number(o.volts) * 100;
    return { vd: vd, pct: pct, endVolts: Number(o.volts) - vd, zPerKft: z };
  }

  function ampacity75(material, size, sets) {
    var a = NEC.amp[size]; if (!a) return null;
    var v = (material === 'cu' ? a.cu : a.al)[1];
    return v == null ? null : v * (Number(sets) || 1);
  }
  // 240.4(D) small-conductor overcurrent limits
  function smallConductorOCPD(material, size) {
    var cu = { '14': 15, '12': 20, '10': 30 }, al = { '12': 15, '10': 25 };
    return (material === 'cu' ? cu : al)[size] || null;
  }
  function validSizes(material, method) {
    return NEC.sizes.filter(function (s) {
      if (material === 'al' && s === '14') return false;  // #14 Al not listed in Table 9 / 310.16
      return true;
    });
  }

  function recommend(o, targetPct, checkAmpacity) {
    var sizes = validSizes(o.material, o.method);
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      var r = voltageDrop(Object.assign({}, o, { size: s }));
      if (!r) continue;
      if (r.pct > targetPct + 1e-9) continue;
      if (checkAmpacity) {
        var amp = ampacity75(o.material, s, o.sets);
        var cap = smallConductorOCPD(o.material, s);
        var limit = cap ? Math.min(amp, cap * (Number(o.sets) || 1)) : amp;
        if (amp == null || limit < Number(o.amps)) continue;
      }
      return { size: s, result: r };
    }
    return null;
  }

  function maxLength(o, targetPct) {
    var z = ohmsPerKft(o); if (!z) return null;
    var sets = Math.max(1, Number(o.sets) || 1);
    return targetPct / 100 * Number(o.volts) * 1000 * sets / (multiplier(o.phase) * Number(o.amps) * z);
  }

  var api = {
    NEC: NEC, CONDUIT_NAMES: CONDUIT_NAMES, WIRE_NAMES: WIRE_NAMES, round: round,
    fillLimit: fillLimit, conductorInfo: conductorInfo, note7: note7, tradeSizes: tradeSizes,
    computeFill: computeFill, maxSame: maxSame,
    ohmsPerKft: ohmsPerKft, voltageDrop: voltageDrop, recommend: recommend, maxLength: maxLength,
    ampacity75: ampacity75, smallConductorOCPD: smallConductorOCPD, validSizes: validSizes, K: K
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ETEngine = api;
})(this);
