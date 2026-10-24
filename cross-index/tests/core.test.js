// Run with: node tests/core.test.js   (no install needed)
const assert = require('assert');
globalThis.CI = {};
require('../core.js'); require('../sample.js');
const CI = globalThis.CI;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('sample builds and validates', () => {
  const d = CI.sampleData();
  assert.equal(d.entities.length, 14);
  assert.equal(d.reports.length, 12);
  d.reports.forEach(r => assert.deepEqual(CI.validateReport(r), []));
  assert.ok(d.links.length >= 18);
});

t('weight counts independent reports; repost collapses into original', () => {
  const d = CI.sampleData(); const idx = CI.buildIndex(d);
  const g = CI.computeGraph(d, CI.newBank(d, 'all', [], 1), idx);
  const grid = d.entities.find(e => e.name === 'GridWatch Now').id;
  const outage = d.entities.find(e => e.name === 'Depot 4 equipment outage').id;
  const e = g.edges.find(x => x.source === grid && x.target === outage);
  assert.equal(e.linkIds.length, 2);   // two links (original + repost)
  assert.equal(e.weight, 1);           // but one independent report
  const harbor = d.entities.find(e => e.name.startsWith('Harborline')).id;
  const inv = d.entities.find(e => e.name.startsWith('Q3')).id;
  assert.equal(g.edges.find(x => x.source === harbor && x.target === inv).weight, 2);
});

t('undirected links normalize regardless of entry order', () => {
  const d = CI.sampleData(); const idx = CI.buildIndex(d);
  const vera = d.entities.find(e => e.name === 'Vera Linden').id, mara = d.entities.find(e => e.name === 'Mara Quill').id;
  const g = CI.computeGraph(d, CI.newBank(d, 'all', [], 1), idx);
  const es = g.edges.filter(x => x.type === 'communicated_with');
  assert.equal(es.length, 1);
  assert.ok(es[0].source < es[0].target);
});

t('min weight hides weak edges and reports how many', () => {
  const d = CI.sampleData(); const b = CI.newBank(d, 'x', [], 1); b.minWeight = 2;
  const g = CI.computeGraph(d, b);
  assert.ok(g.hiddenWeak > 0);
  g.edges.forEach(e => assert.ok(e.weight >= 2));
});

t('hops expand from seed; hop 3 reaches the other thread via the shared address', () => {
  const d = CI.sampleData(); const inv = d.entities.find(e => e.name.startsWith('Q3')).id;
  const names = h => { const b = CI.newBank(d, 'x', [inv], h); return CI.computeGraph(d, b).nodes.map(n => n.name); };
  assert.ok(!names(2).includes('Keystone Courier Partners'));
  assert.ok(names(3).includes('Keystone Courier Partners'));
  assert.ok(names(1).length < names(2).length);
});

t('mentions toggle adds dashed co-occurrence only where no explicit link exists', () => {
  const d = CI.sampleData(); const b = CI.newBank(d, 'x', [], 1);
  const off = CI.computeGraph(d, b); b.showMentions = true; const on = CI.computeGraph(d, b);
  assert.equal(off.edges.filter(e => e.kind === 'mention').length, 0);
  const m = on.edges.filter(e => e.kind === 'mention');
  assert.ok(m.length > 0);
  const explicit = new Set(on.edges.filter(e => e.kind === 'link').map(e => [e.source, e.target].sort().join('|')));
  m.forEach(e => assert.ok(!explicit.has([e.source, e.target].sort().join('|'))));
});

t('link type, entity type, date and exclusion filters', () => {
  const d = CI.sampleData(); const b = CI.newBank(d, 'x', [], 1);
  b.linkTypes = ['funded']; assert.ok(CI.computeGraph(d, b).edges.every(e => e.type === 'funded'));
  b.linkTypes = null; b.entityTypes = ['individual', 'group'];
  assert.ok(CI.computeGraph(d, b).nodes.every(n => n.type !== 'location' && n.type !== 'subject'));
  b.entityTypes = null; b.dateFrom = CI.daysAgo(5);
  const recent = CI.computeGraph(d, b);
  assert.ok(recent.edges.length < CI.computeGraph(d, CI.newBank(d, 'y', [], 1)).edges.length);
  const hs = d.entities.find(e => e.name === '410 Harbor Street, Unit 6').id;
  const b2 = CI.newBank(d, 'z', [], 1); b2.excluded = [hs];
  assert.ok(!CI.computeGraph(d, b2).nodes.some(n => n.id === hs));
});

t('findPaths finds the hidden connection between the two threads', () => {
  const d = CI.sampleData(); const g = CI.computeGraph(d, CI.newBank(d, 'all', [], 1));
  const id = n => d.entities.find(e => e.name.startsWith(n)).id;
  const paths = CI.findPaths(g, id('Harborline'), id('Keystone'), { maxHops: 4, limit: 6 });
  assert.ok(paths.length >= 2);
  assert.equal(paths[0].hops, 2);  // via address or via Brightwater
  paths.forEach(p => assert.ok(p.steps[0].from === id('Harborline') && p.steps[p.steps.length - 1].to === id('Keystone')));
});

t('hub handling: stops expanding at hubs, and avoids them in paths', () => {
  const d = CI.sampleData(); d.settings.hubDegree = 3;
  const inv = d.entities.find(e => e.name.startsWith('Q3')).id;
  const b = CI.newBank(d, 'x', [inv], 3); b.hubStop = true;
  const stopped = CI.computeGraph(d, b).nodes.length; b.hubStop = false;
  assert.ok(stopped <= CI.computeGraph(d, b).nodes.length);
  const g = CI.computeGraph(d, CI.newBank(d, 'all', [], 1));
  assert.ok(g.nodes.some(n => n.hub));
});

t('snapshot diff finds new nodes, new edges and grown weights', () => {
  const d = CI.sampleData(); const b = CI.newBank(d, 'x', [], 1);
  const snap = CI.computeGraph(d, b);
  const harbor = d.entities.find(e => e.name.startsWith('Harborline')), inv = d.entities.find(e => e.name.startsWith('Q3'));
  const rep = { id: CI.nextId(d, 'report'), received: CI.today(), eventDate: '', sourceType: 'Social post', sourceRef: 'x', dupOf: '', summary: 's', basis: 'Fraud', entities: [] };
  d.reports.push(rep);
  const newE = CI.addEntity(d, { type: 'individual', name: 'New Person' });
  CI.addEntityToReport(d, rep.id, harbor.id, 'named'); CI.addEntityToReport(d, rep.id, inv.id, 'named'); CI.addEntityToReport(d, rep.id, newE.id, 'named');
  assert.equal(CI.addLink(d, { reportId: rep.id, from: harbor.id, to: inv.id, type: 'involved_in' }).error, undefined);
  CI.addLink(d, { reportId: rep.id, from: newE.id, to: harbor.id, type: 'employed_by' });
  const diff = CI.diffGraphs(CI.computeGraph(d, b), snap);
  assert.ok(diff.newNodes[newE.id]);
  assert.equal(Object.keys(diff.newEdges).length, 1);
  assert.equal(Object.values(diff.grownEdges)[0], 1);
});

t('addLink rejects bad input and duplicates', () => {
  const d = CI.sampleData(); const r = d.reports[0];
  const [a, b] = r.entities.map(x => x.entityId);
  assert.ok(CI.addLink(d, { reportId: r.id, from: a, to: a, type: 'funded' }).error);
  assert.ok(CI.addLink(d, { reportId: r.id, from: a, to: b, type: 'nope' }).error);
  assert.ok(CI.addLink(d, { reportId: r.id, from: a, to: 'E-9999', type: 'funded' }).error);
  assert.equal(CI.addLink(d, { reportId: r.id, from: a, to: b, type: 'communicated_with' }).error, undefined);
  assert.ok(CI.addLink(d, { reportId: r.id, from: b, to: a, type: 'communicated_with' }).error); // undirected dup
  assert.equal(CI.addLink(d, { reportId: r.id, from: b, to: a, type: 'funded' }).error, undefined); // directed reverse is distinct
});

t('removing an entity from a report removes that report\'s links to it', () => {
  const d = CI.sampleData(); const r = d.reports[0]; const before = d.links.length;
  const pobox = d.entities.find(e => e.name.startsWith('PO Box')).id;
  assert.equal(CI.removeEntityFromReport(d, r.id, pobox), 1);
  assert.equal(d.links.length, before - 1);
});

t('deleting a report removes its links and re-parents reposts', () => {
  const d = CI.sampleData(); const orig = d.reports.find(r => r.sourceRef.includes('gridwatch_now/post/5521'));
  const repost = d.reports.find(r => r.dupOf === orig.id);
  CI.deleteReport(d, orig.id);
  assert.equal(repost.dupOf, '');
  assert.ok(!d.links.some(l => l.reportId === orig.id));
});

t('merge moves reports/links/aliases and undo restores everything', () => {
  const d = CI.sampleData();
  const dup = CI.addEntity(d, { type: 'individual', name: 'V Linden' });
  const vera = d.entities.find(e => e.name === 'Vera Linden');
  const rep = d.reports.find(r => r.summary.startsWith('Older filing'));
  CI.addEntityToReport(d, rep.id, dup.id, 'named');
  CI.addLink(d, { reportId: rep.id, from: dup.id, to: d.entities.find(e => e.name.startsWith('Harborline')).id, type: 'involved_in' });
  const snapshot = JSON.stringify({ r: d.reports, l: d.links, e: d.entities });
  const m = CI.mergeEntities(d, dup.id, vera.id);
  assert.ok(m.merge);
  assert.ok(!d.entities.some(e => e.id === dup.id));
  assert.ok(vera.aliases.some(a => CI.norm(a) === 'v linden')); // already covered by existing alias 'V. Linden', so not duplicated
  assert.equal(vera.aliases.length, 1);
  assert.ok(d.links.some(l => l.from === vera.id && l.reportId === rep.id && l.type === 'involved_in'));
  assert.equal(CI.undoMerge(d, m.merge.id).ok, true);
  const norm = s => { const o = JSON.parse(s); o.e.sort((a, b) => a.id.localeCompare(b.id)); return JSON.stringify(o); };
  const after = norm(JSON.stringify({ r: d.reports, l: d.links, e: d.entities }));
  assert.equal(after, norm(snapshot));
});

t('merge drops links that would become self-links, and undo brings them back', () => {
  const d = CI.sampleData();
  const a = d.entities.find(e => e.name === 'Vera Linden'), b = CI.addEntity(d, { type: 'individual', name: 'Vera L.' });
  const rep = d.reports.find(r => r.summary.startsWith('Annual filing'));
  CI.addEntityToReport(d, rep.id, b.id, 'named');
  CI.addLink(d, { reportId: rep.id, from: a.id, to: b.id, type: 'known_associate' });
  const n = d.links.length;
  const m = CI.mergeEntities(d, b.id, a.id);
  assert.equal(d.links.length, n - 1);
  CI.undoMerge(d, m.merge.id);
  assert.equal(d.links.length, n);
});

t('entity candidates: exact, alias and fuzzy matches; unrelated names ignored', () => {
  const d = CI.sampleData();
  assert.equal(CI.findCandidates(d, 'vera linden')[0].entity.name, 'Vera Linden');
  assert.equal(CI.findCandidates(d, 'V. Linden')[0].entity.name, 'Vera Linden');
  assert.ok(CI.findCandidates(d, 'Vera Lindon').some(c => c.entity.name === 'Vera Linden'));
  assert.equal(CI.findCandidates(d, 'Zebediah Quartz').length, 0);
});

t('heat counts independent reports in the window', () => {
  const d = CI.sampleData(); const h = CI.heat(d, 14);
  const harbor = d.entities.find(e => e.name.startsWith('Harborline')).id;
  assert.equal(h[harbor], 4);
  const grid = d.entities.find(e => e.name === 'GridWatch Now').id;
  assert.equal(h[grid], 2); // original post + harassment post; the repost collapses
});

t('export/import round trip', () => {
  const d = CI.sampleData(); const back = CI.importJson(CI.exportJson(d));
  assert.equal(back.links.length, d.links.length);
  assert.throws(() => CI.importJson('{"nope":1}'));
});

t('validation requires basis and source fields', () => {
  assert.equal(CI.validateReport({ received: '2026-01-01', sourceType: 'Social post', sourceRef: 'x', summary: 's', basis: '' }).length, 1);
  assert.equal(CI.validateReport({}).length, 5);
});

console.log('\n' + n + ' tests passed');
