// Run with: node tests/chart.test.js  — validates elements/style/layouts against real Cytoscape in headless mode.
const assert = require('assert');
globalThis.CI = {};
require('../core.js'); require('../sample.js'); require('./fixture-sample.js'); require('../images.js'); require('../chart.js'); try { require('../pilot.js'); } catch (e) {}
const cytoscape = require('../vendor/cytoscape.min.js');
const CI = globalThis.CI;
const d = CI.sampleData();
const b = CI.newBank(d, 'all', [], 1); b.showMentions = true;
const g = CI.computeGraph(d, b);
const els = CI.buildElements(g, { edgeLabels: true });
assert.equal(els.filter(e => e.group === 'nodes').length, g.nodes.length);
assert.equal(els.filter(e => e.group === 'edges').length, g.edges.length);
for (const layout of ['cose', 'breadthfirst', 'concentric', 'circle']) {
  const cy = cytoscape({ headless: true, styleEnabled: true, elements: CI.buildElements(g, {}), style: CI.cyStyle(), layout: { name: 'null' } });
  cy.layout(CI.layoutOptions(layout, g)).run();
  assert.ok(cy.nodes().length > 0);
  const n = cy.nodes()[0];
  assert.ok(isFinite(n.position('x')) && isFinite(n.position('y')), layout + ' produced positions');
  assert.ok(cy.edges('.mention').length > 0);
  assert.equal(cy.edges('[arrow = "none"]').length > 0, true);
  cy.destroy();
  console.log('ok - layout', layout);
}
// path highlight + extras
const id = n => d.entities.find(e => e.name.startsWith(n)).id;
const whole = CI.computeGraph(d, CI.newBank(d, 'w', [], 1));
const p = CI.findPaths(whole, id('Harborline'), id('Keystone'), { maxHops: 4 })[0];
const hl = { nodes: {}, edges: {} };
p.steps.forEach(s => { hl.edges[s.edge.id] = 1; hl.nodes[s.from] = 1; hl.nodes[s.to] = 1; });
const small = CI.computeGraph(d, CI.newBank(d, 's', [id('Harborline')], 0));
const extraNodes = whole.nodes.filter(n => hl.nodes[n.id]);
const els2 = CI.buildElements(small, { hl, extraNodes, extraEdges: p.steps.map(s => s.edge) });
const cy2 = cytoscape({ headless: true, styleEnabled: true, elements: els2, style: CI.cyStyle() });
assert.ok(cy2.elements('.hl').length >= p.steps.length);
assert.ok(cy2.nodes('.extra').length >= 1);
console.log('ok - path highlight with extras'); 

// groups: named, collapsible, connections added up
{
  const pd = CI.pilotData ? CI.pilotData(7) : null;
  if (pd) {
    const bk = pd.banks.slice().sort((a, b) => (b.files || []).length - (a.files || []).length)[0];
    const gg = CI.computeGraph(pd, bk);
    const info = CI.groupInfo(gg, {});
    assert.ok(info.length >= 2 && info[0].size >= info[1].size, 'groups found, largest first');
    assert.ok(!/group group$/i.test(info[0].name), 'no doubled word');
    const names = {}; names[info[0].id] = 'Security side';
    assert.equal(CI.groupInfo(gg, names).filter(x => x.id === info[0].id)[0].name, 'Security side', 'rename');
    const col = {}; col[info[0].id] = true;
    const cg = CI.collapseGraph(gg, col, names);
    assert.equal(cg.nodes.length, gg.nodes.length - info[0].size + 1, 'group folded to one node');
    assert.ok(cg.nodes.some(n => n.id === 'grp:' + info[0].id && n.cluster), 'folded node present');
    assert.ok(cg.edges.every(e => cg.nodes.some(n => n.id === e.source) && cg.nodes.some(n => n.id === e.target)), 'no dangling connections');
    const cy3 = cytoscape({ headless: true, styleEnabled: true, elements: CI.buildElements(cg, {}), style: CI.cyStyle(CI.PAPER, { sizeByLinks: false }) });
    assert.equal(cy3.nodes().length, cg.nodes.length);
    assert.equal(CI.collapseGraph(gg, {}, {}), gg, 'nothing folded returns the same graph');
    console.log('ok - groups: named, folded, connections added up');
  }
}
process.exit(0); // cytoscape keeps a timer alive in Node; exit explicitly
