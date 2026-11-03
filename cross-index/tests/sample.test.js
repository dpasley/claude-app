// Run with: node tests/sample.test.js — the shipped sample data is rich enough and internally consistent.
const assert = require('assert');
globalThis.CI = {}; globalThis.jspdf = require('../vendor/jspdf.umd.min.js');
require('../core.js'); require('../portraits.js'); require('../sample.js'); require('../images.js'); require('../chart.js'); require('../pdf.js'); require('../pointers.js');
const CI = globalThis.CI; let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const d = CI.sampleData(), idx = CI.buildIndex(d);

t('at least ten files of each type, with logos for groups', () => {
  for (const ty of CI.FILE_TYPES) assert.ok(d.entities.filter(e => e.type === ty).length >= 10, ty);
  assert.ok(d.entities.filter(e => e.type === 'individual').every(e => !e.photo));
  assert.ok(d.entities.filter(e => e.type === 'group' && e.photo).length >= 10);
  assert.ok(d.entities.every(e => e.type !== 'item'));
  assert.ok(d.entities.every(e => e.photo ? e.photo.indexOf('data:image/svg+xml') === 0 : true));
});
t('every reference points at something that exists', () => {
  const ent = new Set(d.entities.map(e => e.id)), rep = new Set(d.reports.map(r => r.id));
  d.reports.forEach(r => { r.entities.forEach(x => assert.ok(ent.has(x.entityId))); if (r.dupOf) assert.ok(rep.has(r.dupOf)); });
  d.links.forEach(l => { assert.ok(ent.has(l.from) && ent.has(l.to) && rep.has(l.reportId)); assert.ok(CI.linkType(d, l.type)); });
  d.summaries.concat(d.timeline).forEach(x => assert.ok(ent.has(x.fileId)));
  d.banks.forEach(b => (b.files || []).forEach(f => assert.ok(ent.has(f))));
  d.leads.concat(d.requests).forEach(l => { assert.ok(!l.investigationId || d.investigations.some(v => v.id === l.investigationId)); if (l.raisedBy) assert.ok(rep.has(l.raisedBy)); });
});
t('dates fall in the last two months and there are plenty of reports and connections', () => {
  assert.ok(d.reports.length >= 50 && d.links.length >= 90);
  assert.ok(d.reports.every(r => r.received >= CI.daysAgo(70) && r.received <= CI.today()));
  assert.ok(new Set(d.reports.map(r => r.sourceType)).size >= 6 && new Set(d.reports.map(r => r.basis)).size >= 5);
});
t('the story gives every index something to show', () => {
  const p = CI.pointers(d, 14, idx);
  assert.ok(CI.heating(d, 14, idx).length >= 3 && CI.discoveries(d, idx, CI.daysAgo(14)).length > 0);
  assert.ok(p.hidden.length && p.togetherNoLink.length && p.growing.length && p.looseEnds.length && p.duplicates.length);
  assert.ok(CI.sharedReportIndex(d, d.entities[0].id, idx).length);
});
t('banks: two handed over, one with news, one closed with no situation, one fresh; investigations include one without a bank', () => {
  assert.equal(d.banks.filter(b => b.handedOver).length, 2);
  assert.ok(d.banks.some(b => b.outcome && b.outcome.kind === 'NO_SITUATION'));
  assert.ok(d.banks.some(b => CI.bankNews(d, b).reports.length > 0 && !b.handedOver));
  assert.ok(d.banks.some(b => b.charts.length >= 2));
  assert.equal(d.investigations.length, 3); assert.ok(d.investigations.some(v => !v.bankId && CI.invFiles(d, v).length >= 4));
  d.investigations.forEach(v => { assert.ok(CI.leadsOf(d, v.id).length >= 2 && CI.requestsOf(d, v.id).length >= 2); assert.ok(CI.caseChartOf(v).pins.length >= 4 && CI.caseChartOf(v).strings.length >= 2); });
  assert.ok(d.leads.concat(d.requests).some(l => l.status === 'DONE') && d.leads.some(l => l.status === 'NO_RESULT'));
});
t('summaries leave some reports unsummarised, and the documents print', () => {
  const tob = d.entities.find(e => e.name === 'Tobias Crane');
  assert.ok(CI.unsummarized(d, idx, tob.id).length > 0 && d.timeline.length >= 12);
  d.investigations.forEach(v => { assert.ok(CI.pdf.leadList(d, v.id, { kind: 'lead' }).size > 1000); assert.ok(CI.pdf.leadList(d, v.id, { kind: 'request' }).size > 1000); });
  d.banks.filter(b => b.handedOver).forEach(b => assert.ok(CI.pdf.estimateSheet(d, idx, b.id, b.handedOverEstimate).size > 1000));
});
t('it survives a save and load unchanged in shape', () => {
  const back = CI.normalize(JSON.parse(JSON.stringify(d)));
  assert.equal(back.entities.length, d.entities.length); assert.equal(back.reports.length, d.reports.length); assert.equal(back.schema, 8);
});
console.log(n + ' sample checks passed');
