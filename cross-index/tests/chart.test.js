// Run with: node tests/chart.test.js  — validates elements/style/layouts against real Cytoscape in headless mode.
const assert = require('assert');
globalThis.CI = {};
require('../core.js'); require('../sample.js'); require('./fixture-sample.js'); require('../images.js'); require('../chart.js');
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
// lead tags: kept beside their name, a count per name, clickable
{
  const cy3 = cytoscape({ headless: true, styleEnabled: true, elements: CI.buildElements(g, {}), style: CI.cyStyle(), layout: { name: 'null' } });
  cy3.layout({ name: 'preset', positions: n => ({ x: 100 + 60 * cy3.nodes().indexOf(n), y: 100 }) }).run();
  CI.chart.cy = cy3;
  const some = cy3.nodes()[0], other = cy3.nodes()[1], map = {}; map[some.id()] = ['L-0001', 'L-0002']; map[other.id()] = ['L-0003', 'L-0004', 'L-0005', 'L-0006', 'L-0007'];
  CI.chart.flagBadges(map);
  assert.equal(cy3.nodes('.flag').length, 2);
  assert.equal(cy3.getElementById('F-' + some.id()).data('label'), '2 leads');
  assert.equal(cy3.getElementById('F-' + other.id()).data('label'), '5 leads', 'a count, so many leads never cover each other');
  let tapped = ''; CI.chart.onFlagTap = id => { tapped = id; };
  cy3.getElementById('F-' + other.id()).emit('tap'); assert.equal(tapped, other.id(), 'clicking a count reports which name it is on');
  tapped = ''; cy3.getElementById(other.id()).emit('tap'); assert.equal(tapped, '', 'clicking the name itself does not trigger it');
  delete CI.chart.onFlagTap;
  const before = Object.assign({}, cy3.getElementById('F-' + some.id()).position());
  some.position({ x: 900, y: 700 });
  const after = cy3.getElementById('F-' + some.id()).position();
  assert.ok(Math.abs(after.x - before.x) > 500 && Math.abs(after.y - before.y) > 400, 'the tag follows its name when the name moves');
  CI.chart.flagBadges({}); assert.equal(cy3.nodes('.flag').length, 0, 'tags are cleared when there are none');
  CI.chart.flagBadges({ 'NOT-HERE': ['L-0009'] }); assert.equal(cy3.nodes('.flag').length, 0, 'a tag for a name not on the chart is skipped');
  cy3.destroy(); CI.chart.cy = null;
  console.log('ok - lead tags on a chart');
}
process.exit(0); // cytoscape keeps a timer alive in Node; exit explicitly
