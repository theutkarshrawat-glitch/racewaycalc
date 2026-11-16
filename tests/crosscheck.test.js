/* Cross-checks against published examples. Run: node tests/crosscheck.test.js */
const E = require('../assets/engine.js');
let pass = 0, fail = 0; const rows = [];
function check(name, source, got, want, tol) {
  const ok = typeof want === 'number' ? Math.abs(got - want) <= (tol || 0) : got === want;
  ok ? pass++ : fail++;
  rows.push({ ok, name, source, got, want });
}
const vd = (o) => E.voltageDrop(o);

// ---- Calculator.net (NEC Table 9 mode, queried live 16 Nov 2026) ----
let r = vd({ method: 't9', material: 'cu', size: '12', conduit: 'pvc', pf: 0.85, volts: 120, phase: '1', length: 100, amps: 16 });
check('12 AWG Cu, PVC, 120V 1ph, 16A, 100ft, PF .85: volts', 'Calculator.net', +r.vd.toFixed(2), 5.56, 0.005);
check('  ... percent', 'Calculator.net', +r.pct.toFixed(2), 4.64, 0.005);
r = vd({ method: 't9', material: 'cu', size: '10', conduit: 'steel', pf: 0.85, volts: 240, phase: '1', length: 150, amps: 30 });
check('10 AWG Cu, steel, 240V 1ph, 30A, 150ft: volts', 'Calculator.net', +r.vd.toFixed(2), 9.39, 0.005);
check('  ... percent', 'Calculator.net', +r.pct.toFixed(2), 3.91, 0.005);
r = vd({ method: 't9', material: 'al', size: '4/0', conduit: 'pvc', pf: 0.9, volts: 480, phase: '3', length: 300, amps: 150 });
check('4/0 Al, PVC, 480V 3ph, 150A, 300ft, PF .9: volts', 'Calculator.net', +r.vd.toFixed(2), 8.45, 0.005);
check('  ... percent', 'Calculator.net', +r.pct.toFixed(2), 1.76, 0.005);

// ---- Mike Holt (mikeholt.com voltage drop articles + EC&M Code Basics) ----
r = vd({ method: 'k', material: 'cu', size: '6', volts: 240, phase: '1', length: 160, amps: 44 });
check('#6 Cu, 44A, 240V 1ph, 160ft (K method): volts', 'Mike Holt, VD Part 1', +r.vd.toFixed(1), 6.9, 0.05);
check('  ... percent', 'Mike Holt, VD Part 1', +r.pct.toFixed(1), 2.9, 0.05);
let rec = E.recommend({ method: 'k', material: 'cu', volts: 240, phase: '1', length: 100, amps: 28, sets: 1 }, 3, false);
check('Min size for 28A, 100ft, 240V, 3% (K method)', 'Mike Holt, VD Part 2', rec.size, '10');
r = vd({ method: 'k', material: 'al', size: '1', volts: 208, phase: '3', length: 80, amps: 100 });
check('1 AWG Al, 100A, 208V 3ph, 80ft: volts', 'Mike Holt / EC&M Code Basics', +r.vd.toFixed(2), 3.51, 0.005);
check('  ... percent', 'Mike Holt / EC&M Code Basics', +r.pct.toFixed(2), 1.69, 0.005);
r = vd({ method: 't9', material: 'cu', size: '12', conduit: 'pvc', pf: 1, volts: 120, phase: '1', length: 100, amps: 16 });
check('12 THHN, 16A, 120V, 100ft, Table 9 R (Ohm\'s law): volts', 'Mike Holt / EC&M Code Basics (uses R = 2.0 rounded)', +r.vd.toFixed(1), 6.4, 0.05);
r = vd({ method: 'k', material: 'cu', size: '12', volts: 120, phase: '1', length: 100, amps: 20 });
check('12 Cu, 20A, 120V, 100ft (K): volts', 'BendMate worked example', +r.vd.toFixed(1), 7.9, 0.05);
rec = E.recommend({ method: 'k', material: 'cu', volts: 120, phase: '1', length: 100, amps: 20, sets: 1 }, 3, false);
check('  ... smallest size for 3%', 'BendMate worked example', rec.size, '8');

// ---- Conduit fill: NEC Annex C Table C.1 (EMT) & C.11 (PVC 40) as published ----
const annex = [
  ['EMT', '3/4', 'THHN', '12', 16, 'Mike Holt (Annex C, Table C.1)'],
  ['EMT', '1/2', 'THHN', '14', 12, 'Voltkit / Annex C'], ['EMT', '3/4', 'THHN', '14', 22, 'Voltkit / Annex C'], ['EMT', '1', 'THHN', '14', 35, 'Voltkit / Annex C'],
  ['EMT', '1/2', 'THHN', '12', 9, 'Voltkit / Annex C'], ['EMT', '1', 'THHN', '12', 26, 'electricaltoolbox / Annex C'],
  ['EMT', '1-1/4', 'THHN', '12', 45, 'electricaltoolbox / Annex C'], ['EMT', '1-1/2', 'THHN', '12', 61, 'electricaltoolbox / Annex C'], ['EMT', '2', 'THHN', '12', 101, 'electricaltoolbox / Annex C'],
  ['EMT', '1/2', 'THHN', '10', 5, 'Voltkit / Annex C'], ['EMT', '3/4', 'THHN', '10', 10, 'Voltkit / Annex C'], ['EMT', '1', 'THHN', '10', 16, 'Voltkit / Annex C'],
  ['EMT', '1/2', 'THHN', '8', 3, 'Voltkit / Annex C'], ['EMT', '3/4', 'THHN', '8', 6, 'Voltkit / SparkShift (Note 7 round-up)'], ['EMT', '1', 'THHN', '8', 9, 'Voltkit / Annex C'],
  ['EMT', '3/4', 'THHN', '6', 4, 'electricaltoolbox'],
  ['PVC40', '3/4', 'THHN', '14', 21, 'Voltkit / Annex C'], ['PVC40', '3/4', 'THHN', '12', 15, 'Voltkit / Annex C'], ['PVC40', '3/4', 'THHN', '10', 9, 'Voltkit / Annex C'], ['PVC40', '3/4', 'THHN', '8', 5, 'Voltkit / Annex C'],
  ['EMT', '3/4', 'XHHW', '12', 11, 'Voltkit / Annex C'], ['EMT', '3/4', 'THW', '12', 11, 'Voltkit / Annex C (TW)']
];
annex.forEach(([c, t, w, s, want, src]) => check(`#${s} ${w} in ${t}" ${c}: max count`, src, E.maxSame(c, t, w, s), want));

// Mixed fill sanity: 3 #12 THHN + 1 #12 bare in 1/2 EMT
const f = E.computeFill({ conduit: 'EMT', tradeSize: '1/2', rows: [{ count: 3, type: 'THHN', size: '12' }, { count: 1, type: 'BARE', size: '12' }] });
check('3x#12 THHN + #12 bare in 1/2" EMT: fill %', 'Hand calc (0.0459 / 0.304)', +f.fillPct.toFixed(1), 15.1, 0.05);

const g = E.computeFill({ conduit: 'EMT', tradeSize: '3/4', rows: [{ count: 4, type: 'THHN', size: '12' }] });
check('Smallest EMT for 4x#12 THHN', 'Annex C (9 fit in 1/2")', g.smallest, '1/2');
const h = E.computeFill({ conduit: 'EMT', tradeSize: '1', rows: [{ count: 3, type: 'THHN', size: '1/0' }] });
check('Smallest EMT for 3x1/0 THHN', 'Hand calc (0.5565 <= 0.598)', h.smallest, '1-1/4');

const w = Math.max(...rows.map(x => x.name.length));
rows.forEach(x => console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name.padEnd(w)}  got ${x.got}  want ${x.want}  [${x.source}]`));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
