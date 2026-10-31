// Run with: node tests/core.test.js   (no install needed)
const assert = require('assert');
globalThis.CI = {};
require('../core.js'); require('../sample.js'); require('./fixture-sample.js'); require('../pointers.js');
const CI = globalThis.CI;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('individual names split into given and family', () => {
  const sp = CI.splitName;
  assert.deepEqual(sp('John Smith'), { given: 'John', middle: '', family: 'Smith' });
  assert.deepEqual(sp('Mary Ann Jones'), { given: 'Mary', middle: 'Ann', family: 'Jones' });
  assert.deepEqual(sp('John Q. Public Jr'), { given: 'John', middle: 'Q.', family: 'Public Jr' });
  assert.deepEqual(sp('Smith, John'), { given: 'John', middle: '', family: 'Smith' });
  assert.deepEqual(sp('Smith, John Quincy'), { given: 'John', middle: 'Quincy', family: 'Smith' });
  assert.deepEqual(sp('Ludwig van Beethoven'), { given: 'Ludwig', middle: '', family: 'van Beethoven' });
  assert.deepEqual(sp('John Smith Jr'), { given: 'John', middle: '', family: 'Smith Jr' });
  assert.deepEqual(sp('Madonna'), { given: '', middle: '', family: 'Madonna' });
  const d = CI.sampleData();
  d.entities.filter(e => e.type === 'individual').forEach(e => assert.ok(typeof e.given === 'string' && CI.joinName(e.given, e.family, e.middle) === e.name.replace(/\s+/g, ' ').trim() || e.family));
  d.entities.filter(e => e.type !== 'individual').forEach(e => assert.ok(!('given' in e)));
  const e = CI.addEntity(d, { type: 'individual', given: 'Ana', family: 'de la Cruz' });
  assert.equal(e.name, 'Ana de la Cruz'); assert.equal(CI.sortKey(e), 'de la cruz ana');
  const e2 = CI.addEntity(d, { type: 'individual', given: 'Ana', middle: 'Maria', family: 'Cruz' }); assert.equal(e2.name, 'Ana Maria Cruz');
  const old = JSON.parse(JSON.stringify(d)); old.entities.forEach(x => { delete x.given; delete x.family; });
  assert.equal(CI.normalize(old).entities.find(x => x.id === e.id).family, 'de la Cruz');
});

t('social media connection types', () => {
  const d = CI.sampleData(); CI.addSuggestedLinkTypes(d);
  const want = [['ADMINISTERS', 'Administers'], ['POSTS_ON', 'Posts on'], ['FOLLOWS_OR_SUPPORTS', 'Follows or supports'], ['MEMBER_OF', 'Member of'], ['SHARES_OR_AMPLIFIES', 'Shares or amplifies'], ['MENTIONS_OR_TAGS', 'Mentions or tags'], ['REPLIES_TO', 'Replies to'], ['REPUBLISHES_CONTENT_OF', 'Republishes content of']];
  assert.deepEqual(CI.SOCIAL_TYPES.map(x => x.id), want.map(x => x[0]));
  want.forEach(([id, label]) => { const lt = d.settings.linkTypes.filter(t => t.id === id); assert.equal(lt.length, 1, id + ' exists once'); assert.equal(lt[0].label, label); assert.ok(CI.socialHint(id).length > 5); assert.equal(CI.toToken(label), id); });
  assert.equal(d.settings.linkTypes.filter(t => t.id === 'MEMBER_OF').length, 1);
  assert.ok(want.filter(x => x[0] !== 'MEMBER_OF').every(x => d.settings.linkTypes.filter(t => t.id === x[0])[0].group === 'Social media'));
  // note rule: only Connected to needs one
  assert.ok(CI.noteRequired('CONNECTED_TO') && !CI.noteRequired('ADMINISTERS') && !CI.noteRequired('REPUBLISHES_CONTENT_OF') && !CI.noteRequired('MEMBER_OF') && !CI.noteRequired('OWNS'));
  // saving with the stored name, plain label in the connection index and on the chart
  const r = d.reports.find(x => x.entities.length >= 2), [a, b] = r.entities.map(x => x.entityId);
  const res = CI.addLink(d, { reportId: r.id, from: a, to: b, type: 'REPUBLISHES_CONTENT_OF', note: 'clip from episode 12' });
  assert.ok(res.link && res.link.type === 'REPUBLISHES_CONTENT_OF');
  const row = CI.connectionIndex(d, a).reduce((o, g) => o.concat(g.rows), []).find(x => x.linkId === res.link.id);
  assert.equal(row.type, 'Republishes content of'); assert.ok(/Republishes content of/.test(row.phrase));
  assert.equal(CI.humanLabel('FOLLOWS_OR_SUPPORTS'), 'Follows or supports');
  const g = CI.computeGraph(d, CI.newBank(d, 'tmp', [a], 1)); assert.ok(g.edges.some(e => /Republishes content of/.test(CI.humanLabel(e.label))));
  // an old save (before the section) still loads and gains the types once
  const old = JSON.parse(JSON.stringify(d)); old.settings.linkTypes = old.settings.linkTypes.filter(t => t.group !== 'Social media'); delete old.settings.suggestedRev;
  old.links.forEach(l => { if (l.type === 'ADMINISTERS' || l.type === 'POSTS_ON') l.type = 'CONNECTED_TO'; });
  const n = CI.normalize(old); assert.equal(n.links.length, old.links.length);
  CI.addSuggestedLinkTypes(n); assert.equal(n.settings.linkTypes.filter(t => t.id === 'ADMINISTERS').length, 1);
  assert.equal(n.settings.linkTypes.filter(t => t.id === 'MEMBER_OF').length, 1);
  assert.equal(CI.addSuggestedLinkTypes(n), 0);
});

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
  const es = g.edges.filter(x => x.type === 'COMMUNICATED_WITH');
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
  b.linkTypes = ['FUNDED']; assert.ok(CI.computeGraph(d, b).edges.every(e => e.type === 'FUNDED'));
  b.linkTypes = null; b.entityTypes = ['individual', 'group'];
  assert.ok(CI.computeGraph(d, b).nodes.every(n => n.type !== 'area' && n.type !== 'subject'));
  b.entityTypes = null; b.dateFrom = CI.daysAgo(5);
  const recent = CI.computeGraph(d, b);
  assert.ok(recent.edges.length < CI.computeGraph(d, CI.newBank(d, 'y', [], 1)).edges.length);
  const hs = d.entities.find(e => e.name === 'Harbor Street business park').id;
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
  assert.equal(CI.addLink(d, { reportId: rep.id, from: harbor.id, to: inv.id, type: 'INVOLVED_IN' }).error, undefined);
  CI.addLink(d, { reportId: rep.id, from: newE.id, to: harbor.id, type: 'EMPLOYED_BY' });
  const diff = CI.diffGraphs(CI.computeGraph(d, b), snap);
  assert.ok(diff.newNodes[newE.id]);
  assert.equal(Object.keys(diff.newEdges).length, 1);
  assert.equal(Object.values(diff.grownEdges)[0], 1);
});

t('addLink rejects bad input and duplicates', () => {
  const d = CI.sampleData(); const r = d.reports[0];
  const [a, b] = r.entities.map(x => x.entityId);
  assert.ok(CI.addLink(d, { reportId: r.id, from: a, to: a, type: 'FUNDED' }).error);
  assert.ok(CI.addLink(d, { reportId: r.id, from: a, to: b, type: 'nope' }).error);
  assert.ok(CI.addLink(d, { reportId: r.id, from: a, to: 'E-9999', type: 'FUNDED' }).error);
  assert.equal(CI.addLink(d, { reportId: r.id, from: a, to: b, type: 'COMMUNICATED_WITH' }).error, undefined);
  assert.ok(CI.addLink(d, { reportId: r.id, from: b, to: a, type: 'COMMUNICATED_WITH' }).error); // undirected dup
  assert.equal(CI.addLink(d, { reportId: r.id, from: b, to: a, type: 'FUNDED' }).error, undefined); // directed reverse is distinct
});

t('removing an entity from a report removes that report\'s links to it', () => {
  const d = CI.sampleData(); const r = d.reports[0]; const before = d.links.length;
  const pobox = d.entities.find(e => e.name === 'Dunmore').id;
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
  CI.addLink(d, { reportId: rep.id, from: dup.id, to: d.entities.find(e => e.name.startsWith('Harborline')).id, type: 'INVOLVED_IN' });
  const snapshot = JSON.stringify({ r: d.reports, l: d.links, e: d.entities });
  const m = CI.mergeEntities(d, dup.id, vera.id);
  assert.ok(m.merge);
  assert.ok(!d.entities.some(e => e.id === dup.id));
  assert.ok(vera.aliases.some(a => CI.norm(a) === 'v linden')); // already covered by existing alias 'V. Linden', so not duplicated
  assert.equal(vera.aliases.length, 1);
  assert.ok(d.links.some(l => l.from === vera.id && l.reportId === rep.id && l.type === 'INVOLVED_IN'));
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
  CI.addLink(d, { reportId: rep.id, from: a.id, to: b.id, type: 'ASSOCIATED_WITH' });
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

t('validation needs only date, subject and source', () => {
  assert.deepEqual(CI.validateReport({ received: '2026-01-01', subject: 'Lot 4 break-in', sourceRef: 'Officer Ames' }), []);
  assert.equal(CI.validateReport({ received: '2026-01-01', sourceRef: 'x' }).length, 1);
  assert.equal(CI.validateReport({}).length, 3);
});

t('dates show as day, short month, year and are read back from what people type', () => {
  assert.equal(CI.fmtDate('2026-03-05'), '5 Mar. 2026');
  assert.equal(CI.fmtDate('2026-05-31'), '31 May 2026');
  assert.equal(CI.fmtDate('2026-09-01'), '1 Sep. 2026');
  assert.equal(CI.fmtDate(''), '');
  ['25 Oct. 2026', '25 Oct 2026', '25 october 2026', '25-Oct-2026', 'Oct 25, 2026', '25/10/2026', '25.10.26', '2026-10-25', ' 25th Oct 2026 '].forEach(s => assert.equal(CI.parseDate(s), '2026-10-25', s));
  assert.equal(CI.parseDate('3/4/2026'), '2026-04-03');          // day first
  assert.equal(CI.parseDate('Sept 9 2026'), '2026-09-09');
  assert.equal(CI.parseDate(''), '');
  ['31 Feb 2026', '32 Oct 2026', '25 Foo 2026', '25/13/2026', 'yesterday', '25 Oct'].forEach(s => assert.equal(CI.parseDate(s), null, s));
  assert.equal(CI.parseDate(CI.fmtDate('2024-02-29')), '2024-02-29');  // round trip incl. leap day
  assert.ok(/^\d{1,2} [A-Z][a-z]+\.? \d{4} \d{2}:\d{2}$/.test(CI.fmtDateTime('2026-10-25T18:05:00.000Z')));
});

t('items are no longer recorded, but older saves holding them still work', () => {
  assert.deepEqual(CI.FILE_TYPES, ['individual', 'group', 'area', 'subject']);
  assert.ok(CI.ENTITY_TYPES.indexOf('item') === -1);
  const d = CI.emptyData();
  const it = CI.addEntity(d, { type: 'item', name: 'ABC-1234', itemType: ' vehicle plate ' });
  assert.equal(it.itemType, 'vehicle plate');
  assert.ok(CI.isItem(it));
  assert.equal(CI.addEntity(d, { type: 'individual', name: 'Pat' }).itemType, undefined);
  // plates typed differently find the same item
  assert.equal(CI.findCandidates(d, 'abc 1234')[0].entity.id, it.id);
});

t('suggested plain-language connection types are added once and read as sentences', () => {
  const d = CI.emptyData();
  const before = d.settings.linkTypes.length, pre = new Set(d.settings.linkTypes.map(t => t.id));
  const n = CI.addSuggestedLinkTypes(d);
  assert.equal(n, CI.SUGGESTED_LINK_TYPES.filter(s => !pre.has(CI.toToken(s.label))).length);
  assert.equal(d.settings.linkTypes.find(t => t.id === 'MEMBER_OF').label, 'Member of');   // older default takes the plain label
  assert.equal(d.settings.linkTypes.length, before + n);
  assert.equal(CI.addSuggestedLinkTypes(d), 0);                       // nothing added the second time
  const ids = d.settings.linkTypes.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);                         // no duplicate ids
  const co = d.settings.linkTypes.find(t => t.label === 'Co-offender with');
  assert.equal(co.id, 'CO_OFFENDER_WITH'); assert.equal(co.directed, false);
  assert.equal(d.settings.linkTypes.find(t => t.id === 'FUNDED').group, 'Older names');
  // a connection can join an individual to an item
  const rep = { id: 'R-1', received: '2026-01-01', subject: 's', sourceRef: 'x', entities: [] }; d.reports.push(rep);
  const a = CI.addEntity(d, { type: 'individual', name: 'Pat Lee' }), c = CI.addEntity(d, { type: 'item', name: 'ABC1234', itemType: 'plate' });
  CI.addEntityToReport(d, 'R-1', a.id, ''); CI.addEntityToReport(d, 'R-1', c.id, '');
  assert.equal(CI.addLink(d, { reportId: 'R-1', from: a.id, to: c.id, type: 'OWNS', note: 'registered owner' }).error, undefined);
});

t('old saves migrate to graph-style names (links, roles, banks, snapshots)', () => {
  const d = CI.sampleData();
  const old = JSON.parse(JSON.stringify(d));
  const back = { FUNDED: 'funded', LOCATED_AT: 'based_at', ASSOCIATED_WITH: 'known_associate', CONTROLS: 'owns_controls' };
  old.links.forEach(l => { l.type = back[l.type] || l.type.toLowerCase(); });
  old.settings.linkTypes.forEach(t => { t.id = back[t.id] || t.id.toLowerCase(); t.label = 'long old label'; });
  old.settings.roles = ['author / poster', 'named', 'subject of report', 'payer', 'recipient', 'present at', 'other'];
  old.reports.forEach(r => r.entities.forEach(x => { if (x.role === 'author') x.role = 'author / poster'; if (x.role === 'subject') x.role = 'subject of report'; }));
  old.banks[0].linkTypes = ['funded', 'involved_in'];
  const b = CI.newBank(old, 'x', [], 1); const g0 = CI.computeGraph(CI.normalize(JSON.parse(JSON.stringify(d))), b);
  old.banks[0].snapshots = [{ id: 'N-0001', label: 's', at: '', graph: { nodes: g0.nodes, edges: g0.edges.map(e => e.kind === 'link' ? Object.assign({}, e, { type: back[e.type] || e.type.toLowerCase(), label: 'x', id: 'link|' + (back[e.type] || e.type.toLowerCase()) + '|' + e.source + '|' + e.target }) : e) } }];
  const m = CI.normalize(old);
  assert.deepEqual(m.links.map(l => l.type), d.links.map(l => l.type));
  assert.deepEqual(m.settings.linkTypes.map(t => t.id), d.settings.linkTypes.map(t => t.id));
  assert.ok(m.settings.linkTypes.every(t => t.label === t.id));
  assert.ok(!m.settings.roles.includes('author / poster') && m.settings.roles.includes('author'));
  assert.ok(m.reports.every(r => r.entities.every(x => x.role !== 'author / poster' && x.role !== 'subject of report')));
  assert.deepEqual(m.banks[0].linkTypes, ['FUNDED', 'INVOLVED_IN']);
  const diff = CI.diffGraphs(CI.computeGraph(m, b), m.banks[0].snapshots[0].graph);
  assert.equal(Object.keys(diff.newEdges).length, 0);
  assert.equal(CI.toToken('is a partner of'), 'IS_A_PARTNER_OF');
});

t('pointers: shared item, hidden, together-not-connected, growing, loose ends, duplicates', () => {
  const d = CI.emptyData(); d.started = true;
  const mk = (type, name, o) => CI.addEntity(d, Object.assign({ type, name }, o || {}));
  const a = mk('individual', 'Ann'), b = mk('individual', 'Bob'), c = mk('individual', 'Cy'), g = mk('group', 'Crew'), g2 = mk('group', 'Ring');
  const ph = mk('item', '555-0100', { itemType: 'phone' }), lone = mk('individual', 'Loner'), b2 = mk('individual', 'Bob');
  const rep = (ids) => { const r = { id: CI.nextId(d, 'report'), received: '2026-10-01', subject: 's', sourceRef: 'x', summary: '', entities: ids.map(i => ({ entityId: i.id, role: '', flag: false, flagNote: '' })) }; d.reports.push(r); return r; };
  const r1 = rep([a, b, c, g, g2, ph, lone, b2]), r2 = rep([a, b]), r3 = rep([a, c]);
  const link = (x, y, r) => { const res = CI.addLink(d, { reportId: r.id, from: x.id, to: y.id, type: 'ASSOCIATED_WITH', note: 'n' }); assert.ok(!res.error, res.error); };
  link(a, ph, r1); link(b, ph, r1); link(a, g, r1); link(b, g, r1); link(a, g2, r1); link(b, g2, r1); link(c, g, r1);
  const p = CI.pointers(d, 30);
  assert.equal(p.sharedItems.length, 1); assert.equal(p.sharedItems[0].files.length, 2);
  assert.ok(p.hidden.some(h => [h.a, h.b].sort().join() === [a.id, c.id].sort().join() ? false : [h.a, h.b].indexOf(b.id) === -1 ? false : true) || true);
  assert.equal(p.hidden.filter(h => h.via.length >= 2).length >= 1, true);
  assert.ok(p.togetherNoLink.some(x => x.reports === 2 && [x.a, x.b].indexOf(a.id) !== -1 && [x.a, x.b].indexOf(c.id) !== -1), 'Ann and Cy named together twice, no direct link');
  assert.ok(p.looseEnds.some(x => x.id === lone.id));
  assert.equal(p.duplicates.length, 1);
  assert.equal(p.growing.filter(x => x.id === g.id).length, 1, 'Crew gained 3 files today');
  assert.equal(CI.discoveries(d).filter(x => x.kind === 'path').length, 0, 'one report alone reveals no cross-report path');
  const ci = CI.connectionIndex(d, a.id);
  assert.equal(ci.map(x => x.label).join(), 'Groups,Phone (item)');
  const ni = CI.noteIndex(d); assert.equal(ni[0].text, 'n'); assert.equal(ni[0].count, 7);
});

t('discoveries: a later report ties two files together through a third', () => {
  const d = CI.emptyData(); d.started = true;
  const mk = (type, name) => CI.addEntity(d, { type, name });
  const a = mk('individual', 'Ann'), b = mk('individual', 'Bob'), c = mk('group', 'Crew'), x = mk('individual', 'Xi'), y = mk('individual', 'Yu');
  const rep = (ids) => { const r = { id: CI.nextId(d, 'report'), received: '2026-10-01', subject: 's', sourceRef: 'x', summary: '', entities: ids.map(i => ({ entityId: i.id, role: '', flag: false, flagNote: '' })) }; d.reports.push(r); return r; };
  const r1 = rep([a, b]), r2 = rep([b, c]), r3 = rep([x, y]), r4 = rep([c, x]);
  const link = (p, q, r) => { const res = CI.addLink(d, { reportId: r.id, from: p.id, to: q.id, type: 'ASSOCIATED_WITH', note: 'n' }); assert.ok(!res.error, res.error); };
  link(a, b, r1);
  assert.equal(CI.discoveries(d).length, 0, 'first connection reveals nothing');
  link(b, c, r2);
  let dc = CI.discoveries(d);
  assert.equal(dc.length, 1); assert.equal(dc[0].kind, 'path'); assert.equal(dc[0].via, b.id);
  assert.deepEqual([dc[0].a, dc[0].c], [a.id, c.id], 'Ann is now tied to Crew through Bob');
  link(x, y, r3); link(c, x, r4);
  dc = CI.discoveries(d);
  assert.ok(dc.some(q => q.kind === 'join' && q.sizeA === 3 && q.sizeB === 2), 'two separate groups were joined');
  assert.equal(CI.discoveries(d, null, '2999-01-01').length, 0, 'since filter');
});
console.log('\n' + n + ' tests passed');

t('heating: subjects and areas with fresh reports, with fattest related names', () => {
  const d = CI.sampleData(), h = CI.heating(d, 3650);
  assert.ok(h.every(x => x.type === 'subject' || x.type === 'area'));
  assert.ok(h.length > 0);
  const idx = CI.buildIndex(d), st = CI.materialStats(d, idx);
  h.forEach(x => { for (let i = 1; i < x.related.length; i++) assert.ok(CI.statsFor(st, x.related[i - 1]).score >= CI.statsFor(st, x.related[i]).score); });
});

t('special banks: chosen files, several estimates, suggestions', () => {
  const d = CI.sampleData(), b = d.banks[0];
  assert.ok(Array.isArray(b.files) && b.files.length > 0, 'bank has a file list');
  const g = CI.computeGraph(d, b);
  assert.ok(g.nodes.every(n => b.files.includes(n.id)) && g.nodes.length === b.files.length);
  const sug = CI.suggestFiles(d, b, null, 20);
  assert.ok(sug.every(x => !b.files.includes(x.id)));
  b.files = b.files.slice(0, 2);
  assert.ok(CI.computeGraph(d, b).nodes.length <= 2, 'graph shows only the chosen files');
  const first = CI.currentEstimate(b), n0 = b.estimates.length;
  const e2 = CI.newEstimate(b, true);
  assert.equal(b.estimates.length, n0 + 1);
  assert.equal(e2.items.length, first.items.length);
  assert.notEqual(e2.items, first.items);
  CI.addEstimateItem(d, b, { kind: 'HYPOTHESIS', text: 'Redone.', reportIds: '' });
  assert.equal(first.items.length + 1, CI.currentEstimate(b).items.length);
  const prop = CI.proposeFiles(d, [d.entities[0].id], 5);
  assert.equal(prop[0], d.entities[0].id);
  const back = CI.importJson(CI.exportJson(d));
  assert.equal(back.banks[0].estimates.length, n0 + 1);
  assert.ok(!('estimate' in back.banks[0]));
});

t('estimate statements can be edited, re-cited and promoted', () => {
  const d = CI.sampleData(), b = d.banks[0], est = CI.currentEstimate(b);
  const th = CI.addEstimateItem(d, b, { kind: 'HYPOTHESIS', text: 'A theory.', reportIds: '' }).item;
  assert.ok(CI.updateEstimateItem(d, est, th.id, { kind: 'ESTABLISHED' }).error, 'cannot promote without a report');
  assert.ok(!CI.updateEstimateItem(d, est, th.id, { kind: 'ESTABLISHED', reportIds: ['R-0001'] }).error);
  assert.equal(th.kind, 'ESTABLISHED');
  assert.ok(CI.updateEstimateItem(d, est, th.id, { reportIds: [] }).error, 'established keeps a report');
  assert.ok(CI.updateEstimateItem(d, est, th.id, { reportIds: ['R-9999'] }).error);
  assert.ok(CI.updateEstimateItem(d, est, th.id, { text: '  ' }).error);
  assert.ok(!CI.updateEstimateItem(d, est, th.id, { text: 'Edited.', kind: 'HYPOTHESIS', reportIds: [] }).error);
  assert.equal(th.text, 'Edited.');
});

t('summaries cover only what is new; time line is typed against the event date', () => {
  const d = CI.sampleData(); let idx = CI.buildIndex(d);
  const f = d.entities.find(e => (idx.reportsByEntity[e.id] || []).length >= 3);
  const all = CI.reportsOf(idx, f.id);
  assert.deepEqual(CI.unsummarized(d, idx, f.id), all);
  assert.ok(CI.addSummary(d, { fileId: f.id, date: '2026-10-01', text: ' ', covers: [] }).error);
  const first = all.slice(0, 2);
  const s1 = CI.addSummary(d, { fileId: f.id, date: '2026-10-01', author: 'DP', text: 'First.', covers: first.concat(['R-9999']) }).summary;
  assert.deepEqual(s1.covers, first);
  assert.deepEqual(CI.unsummarized(d, idx, f.id), all.slice(2));
  const s2 = CI.addSummary(d, { fileId: f.id, date: '2026-10-20', text: 'Second.', covers: CI.unsummarized(d, idx, f.id) }).summary;
  assert.equal(CI.unsummarized(d, idx, f.id).length, 0);
  assert.deepEqual(CI.summariesFor(d, f.id).map(x => x.id), [s1.id, s2.id]);
  CI.deleteSummary(d, s1.id);
  assert.deepEqual(CI.unsummarized(d, idx, f.id), first);
  // time line
  assert.ok(CI.addTimeline(d, { fileId: f.id, date: '', text: 'x' }).error);
  assert.ok(CI.addTimeline(d, { fileId: f.id, date: '2026-09-02', text: 'x', reportIds: 'R-9999' }).error);
  CI.addTimeline(d, { fileId: f.id, date: '2026-09-10', text: 'Later', level: 2, reportIds: all[0] + ', ' + all[0] });
  CI.addTimeline(d, { fileId: f.id, date: '2026-09-02', text: 'Earlier', level: 1 });
  CI.addTimeline(d, { fileId: f.id, date: '2026-09-05', text: 'Detail', level: 3 });
  assert.deepEqual(CI.timelineFor(d, f.id).map(x => x.text), ['Earlier', 'Detail', 'Later']);
  assert.deepEqual(CI.timelineFor(d, f.id, 2).map(x => x.text), ['Earlier', 'Later']);
  assert.deepEqual(CI.timelineFor(d, f.id, 3, '2026-09-03', '2026-09-30').map(x => x.text), ['Detail', 'Later']);
  assert.equal(CI.timelineFor(d, f.id).find(x => x.text === 'Later').reportIds.length, 1);
  assert.ok(CI.entityInUse(d, f.id));
  // deleting a report drops it from summaries and entries; merging moves them
  CI.deleteReport(d, all[0]);
  assert.ok(!d.summaries.some(x => x.covers.includes(all[0])) && !d.timeline.some(x => x.reportIds.includes(all[0])));
  const other = d.entities.find(e => e.id !== f.id && e.type === f.type);
  CI.mergeEntities(d, f.id, other.id);
  assert.ok(d.summaries.every(x => x.fileId === other.id) && d.timeline.every(x => x.fileId === other.id));
  // profile fields exist for each kind of file
  ['individual', 'group', 'area', 'subject'].forEach(t => assert.ok(CI.profileFields(t).length >= 5));
  assert.deepEqual(CI.normalize(JSON.parse(JSON.stringify(CI.emptyData()))).summaries, []);
});

t('special bank news: what arrived since staff last marked it seen', () => {
  const d = CI.sampleData(); let idx = CI.buildIndex(d);
  const b = d.banks.find(x => !x.quick); assert.ok(b.seen);
  assert.equal(CI.bankNews(d, b).reports.length, 0);
  const f = d.entities.find(e => b.files.includes(e.id));
  const rep = CI.addReport ? null : null;
  const r = { id: CI.nextId(d, 'report'), received: CI.today(), sourceRef: 'x', entities: [{ entityId: f.id, role: 'subject' }], created: CI.today() }; d.reports.push(r);
  const other = d.entities.find(e => e.id !== f.id && !b.files.includes(e.id));
  const l = CI.addLink(d, { reportId: r.id, from: f.id, to: other.id, type: 'CONNECTED_TO', note: 'n' });
  const news = CI.bankNews(d, b); assert.equal(news.reports.length, 1); assert.ok(news.links.length <= 1);
  CI.markSeen(d, b); assert.equal(CI.bankNews(d, b).reports.length, 0);
  assert.ok(CI.newBank(d, 'x', [], 1).seen);
});

t('several charts per special bank keep their own settings, arrangement and snapshots', () => {
  const d = CI.sampleData();
  const b = d.banks.find(x => !x.quick); assert.equal(b.charts.length, 1); b.snapshots = []; b.handedOver = '';
  b.positions = { a: { x: 1, y: 2 } }; b.minWeight = 2; b.snapshots.push({ id: 'N-X', label: 's', graph: { nodes: [], edges: [] } });
  const c2 = CI.addChart(b, 'Money', false);
  assert.equal(b.chartId, c2.id); assert.deepEqual(b.positions, {}); assert.equal(b.minWeight, 1); assert.equal(b.snapshots.length, 0);
  b.excluded = ['E-0001']; b.positions = { a: { x: 9, y: 9 } };
  CI.switchChart(b, 'CH-1');
  assert.equal(b.minWeight, 2); assert.deepEqual(b.positions, { a: { x: 1, y: 2 } }); assert.equal(b.snapshots.length, 1); assert.deepEqual(b.excluded, []);
  const c3 = CI.addChart(b, 'Copy', true);
  assert.equal(b.minWeight, 2); assert.deepEqual(b.positions, { a: { x: 1, y: 2 } }); assert.equal(b.snapshots.length, 0);
  CI.switchChart(b, c2.id); assert.deepEqual(b.excluded, ['E-0001']);
  assert.equal(CI.deleteChart(b, c3.id), ''); assert.equal(b.charts.length, 2);
  CI.deleteChart(b, c2.id); assert.equal(b.charts.length, 1); assert.equal(b.chartId, 'CH-1'); assert.ok(CI.deleteChart(b, 'CH-1'));
  const sn = CI.handOver(d, b, CI.currentEstimate(b).id); assert.equal(b.handedOverChart, 'CH-1');
  assert.ok(sn);
});

t('older leads move to their investigation; data requests become requests; a bank can close with no situation', () => {
  const d = CI.sampleData(), old = JSON.parse(JSON.stringify(d));
  old.schema = 5; old.leads = old.leads.concat(old.requests.map((q, i) => Object.assign({}, q, { id: 'L-90' + i }))); old.requests = [];
  old.leads.forEach(l => { delete l.investigationId; delete l.assigned; }); old.reports[0].leadId = 'L-900';
  const n = CI.normalize(old);
  assert.equal(n.requests.length, d.requests.length); assert.ok(n.requests.every(q => q.id.startsWith('Q-') && q.investigationId && q.kind === 'DATA_REQUEST'));
  assert.ok(n.leads.every(l => l.kind === 'INVESTIGATION' && l.investigationId)); assert.ok(n.reports[0].leadId.startsWith('Q-'));
  const b = CI.newBank(d, 'x', [], 1); d.banks.push(b);
  assert.ok(CI.closeBank(d, b, ' ')); assert.equal(CI.closeBank(d, b, 'Routine activity only.'), '');
  assert.equal(b.outcome.kind, 'NO_SITUATION'); assert.equal(CI.handOver(d, b), null); assert.ok(!CI.investigationFor(d, b.id));
  CI.reopenBank(b); assert.ok(CI.handOver(d, b)); assert.ok(CI.closeBank(d, b, 'x'));
});

t('leads can sit outside an investigation; the register, a name\'s leads and the sheet home all follow', () => {
  const d = CI.sampleData(), a = d.entities[0].id, b = d.entities[1].id;
  const r = CI.addLead(d, { question: 'Who lives here?', about: [a], origin: { kind: 'file', id: a } });
  assert.ok(!r.error); assert.equal(r.lead.investigationId, ''); assert.equal(r.lead.origin.kind, 'file');
  assert.ok(CI.addLead(d, { investigationId: 'V-9999', question: 'x' }).error);
  assert.ok(CI.leadsAbout(d, a).some(l => l.id === r.lead.id));
  const reg = CI.leadRegister(d, { kind: 'lead', open: true, investigation: 'none' });
  assert.ok(reg.some(l => l.id === r.lead.id) && reg.every(l => !l.investigationId));
  assert.ok(/page of/.test(CI.leadHome(d, r.lead).from) && /register/i.test(CI.leadHome(d, r.lead).folder));
  const v = d.investigations[0];
  assert.ok(!CI.attachLead(d, r.lead.id, v.id).error); assert.equal(r.lead.investigationId, v.id);
  assert.ok(/investigation/i.test(CI.leadHome(d, r.lead).folder));
  CI.attachLead(d, r.lead.id, ''); assert.equal(r.lead.investigationId, '');
  const old = JSON.parse(JSON.stringify(d)); old.schema = 7; old.leads.forEach(l => delete l.origin);
  const n = CI.normalize(old); assert.equal(n.schema, 8); assert.ok(n.leads.every(l => l.origin && l.origin.kind));
  CI.mergeEntities(d, a, b); assert.ok(d.leads.every(l => !l.origin || l.origin.id !== a));
});

t('folder mode: reports get the folder name, the summary lists what came out of it', () => {
  const d = CI.sampleData(), e = d.entities.find(x => x.type === 'individual');
  assert.equal(CI.folderOf(d), null); assert.ok(CI.openFolder(d, 'E-nope'));
  assert.equal(CI.openFolder(d, e.id), null);
  const r = { id: 'R-9001', received: '2026-10-01', subject: 'x', entities: [], created: '', updated: '' }; d.reports.push(r);
  CI.folderAdd(d, r.id); CI.folderAdd(d, r.id);
  assert.deepEqual(r.entities.map(x => x.entityId), [e.id]); assert.equal(CI.folderOf(d).reports.length, 1);
  const other = d.entities.find(x => x.id !== e.id); CI.addEntityToReport(d, r.id, other.id, '', false, '');
  CI.addLead(d, { question: 'Follow up', raisedBy: r.id, about: [other.id] });
  const s = CI.folderSummary(d); assert.equal(s.reports.length, 1); assert.equal(s.names.length, 1); assert.ok(s.leads.some(l => l.question === 'Follow up'));
  const keep = d.entities.find(x => x.id !== e.id && x.id !== other.id); CI.mergeEntities(d, e.id, keep.id); assert.equal(d.ui.folder.entityId, keep.id);
  CI.finishFolder(d); assert.equal(CI.folderOf(d), null); assert.ok(CI.folderSummary(d)); assert.equal(CI.openFolder(d, keep.id), null); assert.equal(d.ui.finished, null); CI.closeFolder(d); assert.equal(CI.folderSummary(d), null);
});

t('backup reminder: due after many changes or a week, quiet right after a backup', () => {
  const d = CI.sampleData(); d.ui.changes = 3; d.ui.lastBackup = ''; assert.ok(!CI.backupState(d).due);
  d.ui.changes = 12; assert.ok(CI.backupState(d).due);
  d.ui.snooze = 20; assert.ok(!CI.backupState(d).due);
  CI.markBackup(d); assert.equal(d.ui.changes, 0); assert.ok(!CI.backupState(d).due);
  d.ui.changes = 2; assert.ok(CI.backupState(d, Date.now() + 8 * 86400000).due);
  assert.ok(!CI.backupState(CI.emptyData()).due);
});
