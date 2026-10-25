// Run with: node tests/pdf.test.js  — PDF layout maths and real PDF generation with the bundled jsPDF.
const assert = require('assert'), fs = require('fs'), path = require('path');
globalThis.CI = {};
globalThis.jspdf = require('../vendor/jspdf.umd.min.js');
require('../core.js'); require('../sample.js'); require('../images.js'); require('../chart.js'); require('../pdf.js');
const CI = globalThis.CI;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('planTiles centres and fits the graph inside the poster, tiles cover it', () => {
  const p = CI.planTiles({ gw: 1200, gh: 700, cols: 2, rows: 2, pageW: 17, pageH: 11, margin: 0.35 });
  assert.ok(Math.abs(p.pw - 16.3) < 1e-9 && Math.abs(p.ph - 10.3) < 1e-9);
  assert.equal(p.tiles.length, 4);
  assert.ok(1200 * p.f <= p.PW - 0.8 + 1e-9 && 700 * p.f <= p.PH - 0.8 + 1e-9);
  assert.ok(Math.abs(p.offX + 1200 * p.f / 2 - p.PW / 2) < 1e-9);
  assert.deepEqual(p.tiles.map(t => t.n), [1, 2, 3, 4]);
  assert.deepEqual([p.tiles[1].r, p.tiles[1].c], [0, 1]);
});
t('planTiles caps enlargement so a tiny graph is not blown up', () => {
  const p = CI.planTiles({ gw: 100, gh: 80, cols: 2, rows: 2, pageW: 17, pageH: 11, margin: 0.35 });
  assert.equal(p.f, 0.03);
});
t('pickDpi lowers resolution for big posters and never below 50', () => {
  assert.equal(CI.pickDpi(32.6, 20.6, 150), 144);
  assert.ok(CI.pickDpi(49, 31, 150) < 100);
  assert.equal(CI.pickDpi(500, 500, 150), 50);
});
t('photoGeometry crops faces square and fits logos', () => {
  const a = CI.photoGeometry(800, 600, 'square', 256); assert.deepEqual([a.sw, a.sh, a.ow, a.oh, a.sx], [600, 600, 256, 256, 100]);
  const b = CI.photoGeometry(1000, 500, 'fit', 256); assert.deepEqual([b.ow, b.oh], [256, 128]);
  const c = CI.photoGeometry(100, 60, 'fit', 256); assert.deepEqual([c.ow, c.oh], [100, 60]);
});
t('placeholders exist for every type', () => {
  CI.ENTITY_TYPES.forEach(ty => assert.ok(CI.placeholder(ty, '#123456').startsWith('data:image/svg+xml')));
});
t('lead sheets and board produce real PDFs', async () => {});
(async () => {
  const d = CI.sampleData();
  const one = CI.pdf.leadSheets(d, d.leads.map(l => l.id));
  const buf = Buffer.from(await one.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString(), '%PDF'); assert.ok((buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 4);
  const board = Buffer.from(await CI.pdf.board(d, d.banks[0].id).arrayBuffer());
  assert.equal(board.slice(0, 4).toString(), '%PDF');
  const out = process.env.PDF_OUT; if (out) { fs.writeFileSync(path.join(out, 'sheets.pdf'), buf); fs.writeFileSync(path.join(out, 'board.pdf'), board); }
  console.log('ok - lead sheets (4 pages) and board are valid PDFs'); n++;
  // lead logic
  assert.equal(CI.addLead(d, { bankId: d.banks[0].id, kind: 'INVESTIGATION', with: 'Investigations', question: ' ', raisedBy: 'R-0001' }).error, 'Write the question.');
  assert.ok(CI.addLead(d, { bankId: 'B-9', kind: 'INVESTIGATION', with: 'Investigations', question: 'q', raisedBy: 'R-0001' }).error);
  assert.ok(CI.addLead(d, { bankId: d.banks[0].id, kind: 'X', with: 'Investigations', question: 'q', raisedBy: 'R-0001' }).error);
  assert.ok(CI.addLead(d, { bankId: d.banks[0].id, kind: 'DATA_REQUEST', with: 'Nobody', question: 'q', raisedBy: 'R-0001' }).error);
  assert.ok(CI.addLead(d, { bankId: d.banks[0].id, kind: 'DATA_REQUEST', with: 'Collection', question: 'q', raisedBy: 'R-9999' }).error);
  const L = CI.addLead(d, { bankId: d.banks[0].id, kind: 'DATA_REQUEST', with: 'Collection', question: 'q?', raisedBy: 'R-0001', about: ['E-0001', 'E-0001'] }).lead;
  assert.equal(L.id, 'L-0005'); assert.deepEqual(L.about, ['E-0001']); assert.equal(L.status, 'NOT_STARTED');
  d.reports[0].leadId = L.id; assert.equal(CI.leadResults(d, L.id).length, 1);
  CI.deleteLead(d, L.id); assert.equal(d.reports[0].leadId, ''); assert.equal(d.leads.length, 4);
  console.log('ok - lead creation rules, results and delete'); n++;
  // estimate
  const b = d.banks[0], cnt = b.estimate.items.length;
  assert.equal(CI.addEstimateItem(d, b, { kind: 'ESTABLISHED', text: 'x', reportIds: '' }).error, 'An established statement must cite at least one report.');
  assert.ok(CI.addEstimateItem(d, b, { kind: 'HYPOTHESIS', text: 'x', reportIds: 'R-9999' }).error.includes('R-9999'));
  assert.ok(CI.addEstimateItem(d, b, { kind: 'HYPOTHESIS', text: 'x', reportIds: '' }).item);
  assert.equal(b.estimate.items.length, cnt + 1);
  const sn = CI.handOver(d, b); assert.equal(b.handedOver, CI.today()); assert.equal(b.compareId, sn.id); assert.ok(sn.graph.nodes.length > 0);
  console.log('ok - estimate rules and handover snapshot'); n++;
  // material stats
  const st = CI.materialStats(d), id = nm => d.entities.find(e => e.name.startsWith(nm)).id;
  assert.equal(st[id('Orrin')].reports, 2); assert.equal(st[id('Orrin')].material, 1);
  assert.equal(st[id('Harborline')].material, 4);
  // repost collapses
  assert.equal(st[id('GridWatch')].reports, 2); assert.equal(st[id('GridWatch')].material, 1); // named in R-0010 but not connected there
  console.log('ok - material vs total reports, reposts collapsed'); n++;
  const b2 = CI.newBank(d, 'top', [id('Q3')], 3); b2.topN = 4;
  const g = CI.computeGraph(d, b2); assert.equal(g.nodes.length, 4); assert.ok(g.nodes.some(x => x.seed)); assert.ok(g.trimmed > 0);
  assert.ok(g.edges.every(e => g.nodes.some(x => x.id === e.source) && g.nodes.some(x => x.id === e.target)));
  console.log('ok - top-N keeps the heaviest files and the starting entity'); n++;
  // investigations and handling plans
  assert.equal(d.investigations.length, 2); // sample's Depot 4 bank was already handed over; the invoice bank was just handed over
  const inv = CI.investigationFor(d, b.id); assert.ok(inv && inv.status === 'HANDED_OVER' && /^V-\d{4}$/.test(inv.id));
  CI.handOver(d, b); assert.equal(d.investigations.length, 2); // one investigation per bank
  const base = { objective: 'Stop it', outcome: 'LEGAL', preparedBy: 'P', actions: [{ text: 'Do a thing', owner: 'Me' }], legalStatus: 'NOT_SUBMITTED', reviewer: '', legalDate: '', comments: '', execStatus: 'NOT_STARTED', execOutcome: '' };
  assert.ok(CI.savePlan(d, inv, Object.assign({}, base, { legalStatus: 'WITH_LEGAL', actions: [] })).error.includes('at least one action'));
  assert.ok(CI.savePlan(d, inv, Object.assign({}, base, { execStatus: 'EXECUTING' })).error.includes('cleared'));
  assert.ok(CI.savePlan(d, inv, Object.assign({}, base, { legalStatus: 'RETURNED', execStatus: 'EXECUTING' })).error);
  assert.ok(CI.savePlan(d, inv, Object.assign({}, base, { legalStatus: 'CLEARED_WITH_CONDITIONS', reviewer: 'Counsel', legalDate: CI.today(), comments: 'Notify police first', execStatus: 'EXECUTING' })).plan);
  assert.ok(CI.isCleared(inv.plan) && inv.plan.execution.status === 'EXECUTING');
  const pb = CI.pdf.planSheet(d, inv.id); assert.ok(pb.size > 1500);
  console.log('ok - investigations: one per bank, plan rules, legal clearance gates execution, plan sheet PDF'); n++;
  // area rename migration
  const old = JSON.parse(JSON.stringify(d)); old.schema = 2; old.entities.find(e => e.type === 'area').type = 'location'; old.banks[0].entityTypes = ['individual', 'location'];
  old.banks[0].snapshots[0].graph.nodes.forEach(x => { if (x.type === 'area') x.type = 'location'; });
  const mig = CI.normalize(old); assert.ok(mig.entities.every(e => e.type !== 'location')); assert.deepEqual(mig.banks[0].entityTypes, ['individual', 'area']);
  assert.ok(mig.banks[0].snapshots[0].graph.nodes.every(x => x.type !== 'location')); assert.equal(CI.TYPE_LABEL.area, 'Area');
  console.log('ok - old "location" files migrate to "area"'); n++;
  // situation observation
  const o = CI.observe(d, 14);
  assert.ok(o.files.length >= 1); assert.ok(o.files.every(f => f.why.length && f.now >= 0));
  assert.ok(o.clusters.every(c => c.ids.length >= 3));
  const quiet = CI.observe(CI.emptyData(), 14); assert.equal(quiet.files.length, 0); assert.equal(quiet.clusters.length, 0);
  console.log('ok - situation observation finds what moved (' + o.files.length + ' files, ' + o.clusters.length + ' clusters)'); n++;
  // case chart
  const dd = CI.sampleData(), iv = dd.investigations[0], eid = k => dd.entities.find(e => e.name.startsWith(k)).id;
  const cc = CI.caseChartOf(iv); const nPins = cc.pins.length, nStr = cc.strings.length;
  assert.equal(CI.addPin(dd, iv, 'E-9999').error, 'That file does not exist.');
  assert.ok(CI.addPin(dd, iv, eid('Grid')).error.includes('already'));
  const dana = CI.addPin(dd, iv, eid('Dana')); assert.ok(dana.pin); assert.equal(cc.pins.length, nPins + 1);
  assert.ok(CI.addString(dd, iv, { a: eid('Dana'), b: eid('Dana'), label: 'x', reportIds: ['R-0010'] }).error);
  assert.equal(CI.addString(dd, iv, { a: eid('Dana'), b: eid('Tobias'), label: 'attacked', reportIds: [] }).error, 'A string must cite at least one report.');
  assert.ok(CI.addString(dd, iv, { a: eid('Dana'), b: eid('Tobias'), label: 'attacked', reportIds: ['R-9999'] }).error.includes('R-9999'));
  assert.ok(CI.addString(dd, iv, { a: eid('Dana'), b: eid('Tobias'), label: 'attacked', reportIds: ['R-0001'] }).error.includes('does not name'));
  assert.ok(CI.addString(dd, iv, { a: eid('Dana'), b: eid('Vera'), label: 'x', reportIds: ['R-0010'] }).error.includes('pinned'));
  const rs = CI.reportsForString(dd, eid('Dana'), eid('Tobias')); assert.deepEqual(rs.both, ['R-0010']);
  const st1 = CI.addString(dd, iv, { a: eid('Dana'), b: eid('Tobias'), label: 'attacked', reportIds: ['R-0010'] }).string; assert.ok(st1);
  assert.ok(CI.addString(dd, iv, { a: eid('Tobias'), b: eid('Dana'), label: 'Attacked', reportIds: ['R-0010'] }).error.includes('already'));
  assert.equal(CI.updateString(dd, iv, st1.id, { label: 'named', reportIds: [] }).error, 'A string must cite at least one report.');
  const cg = CI.caseGraph(dd, iv); assert.equal(cg.graph.nodes.length, nPins + 1); assert.equal(cg.graph.edges.length, nStr + 1);
  assert.ok(cg.flags.nodes[eid('Keystone')] && cg.flags.edges['C-0003']); assert.ok(!cg.flags.nodes[eid('Grid')]);
  dd.leads.forEach(l => { l.status = 'DONE'; }); assert.equal(Object.keys(CI.caseGraph(dd, iv).flags.nodes).length, 0);
  CI.deleteReport(dd, 'R-0010'); assert.ok(!cc.strings.some(t => t.id === st1.id)); // its only report is gone
  CI.removePin(dd, iv, eid('Keystone')); assert.ok(!cc.strings.some(t => t.a === eid('Keystone') || t.b === eid('Keystone')));
  const m1 = CI.addEntity(dd, { type: 'individual', name: 'Orrin P.' }); CI.addPin(dd, iv, m1.id); CI.addPin(dd, iv, eid('Orrin Platt'));
  CI.mergeEntities(dd, m1.id, eid('Orrin Platt')); assert.equal(cc.pins.filter(p => p.entityId === eid('Orrin Platt')).length, 1); assert.ok(!cc.pins.some(p => p.entityId === m1.id));
  console.log('ok - case chart: pins, strings need reports, flags from open leads, cleanup on delete and merge'); n++;
  const olds = JSON.parse(JSON.stringify(CI.sampleData())); olds.schema = 3; olds.investigations[0].caseChart = { pins: [], strings: [] }; olds.leads = olds.leads.filter(l => l.bankId !== olds.investigations[0].bankId);
  const migs = CI.normalize(olds); assert.equal(migs.investigations[0].caseChart.pins.length, 7); assert.equal(migs.investigations[0].caseChart.strings.length, 5); assert.equal(migs.schema, 5); assert.ok(migs.investigations[0].caseChart.title && migs.investigations[0].caseChart.notes.length === 2);
  const mid = JSON.parse(JSON.stringify(CI.sampleData())); mid.schema = 4; mid.investigations[0].caseChart.title = ''; mid.investigations[0].caseChart.notes = []; assert.equal(CI.normalize(mid).investigations[0].caseChart.notes.length, 2);
  console.log('ok - sample data saved before case charts gets its case chart on load'); n++;
  const d5 = CI.sampleData(), v5 = d5.investigations[0], c5 = CI.caseChartOf(v5);
  assert.equal(CI.addNote(d5, v5, '  ', {}).error, 'Write the label text.'); const nt = CI.addNote(d5, v5, 'Key player', { x: 5, y: 6 }).note; assert.ok(/^W-/.test(nt.id)); assert.equal(CI.updateNote(d5, v5, nt.id, 'Ringleader?').note.text, 'Ringleader?');
  CI.removeNote(d5, v5, nt.id); assert.ok(!c5.notes.some(x => x.id === nt.id)); CI.setCaseTitle(d5, v5, ' New title '); assert.equal(c5.title, 'New title');
  const before = c5.strings.length, avail = CI.indexConnections(d5, v5).length; assert.ok(avail >= 1); assert.equal(CI.addIndexConnections(d5, v5), avail); assert.equal(c5.strings.length, before + avail); assert.equal(CI.indexConnections(d5, v5).length, 0);
  console.log('ok - case chart labels, title and connections taken from the main files'); n++;
  console.log('\n' + n + ' PDF/lead checks passed'); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
