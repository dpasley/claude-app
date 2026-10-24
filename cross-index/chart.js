/* Connections chart: turns a computed graph into Cytoscape elements and manages the canvas.
 * buildElements/cyStyle are pure so they can be tested without a browser. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  // Color-blind-safe palette (Okabe-Ito); shape also encodes type so color is never the only cue.
  CI.TYPE_COLOR = { individual: '#0072B2', group: '#D55E00', subject: '#009E73', location: '#CC79A7' };
  CI.TYPE_SHAPE = { individual: 'ellipse', group: 'round-rectangle', subject: 'diamond', location: 'hexagon' };

  CI.edgeWidth = function (w) { return Math.min(9, 1.8 + (w - 1) * 1.4); };

  /* opts: edgeLabels (bool), diff (from CI.diffGraphs), extraNodes[], extraEdges[], hl {edges:{id:1}, nodes:{id:1}} */
  CI.buildElements = function (graph, opts) {
    opts = opts || {};
    var diff = opts.diff || { newNodes: {}, newEdges: {}, grownEdges: {} };
    var hl = opts.hl || { edges: {}, nodes: {} };
    var els = [], haveN = {}, haveE = {};

    function addNode(n, extra) {
      if (haveN[n.id]) return;
      haveN[n.id] = true;
      var cls = [];
      if (n.seed) cls.push('seed');
      if (n.hub) cls.push('hub');
      if (diff.newNodes[n.id]) cls.push('new');
      if (extra) cls.push('extra');
      if (hl.nodes[n.id]) cls.push('hl');
      els.push({ group: 'nodes', data: { id: n.id, label: n.name, color: CI.TYPE_COLOR[n.type] || '#666', shape: CI.TYPE_SHAPE[n.type] || 'ellipse', degree: n.degree || 0 }, classes: cls.join(' ') });
    }
    function addEdge(e, extra) {
      if (haveE[e.id]) return;
      haveE[e.id] = true;
      var cls = [];
      if (e.kind === 'mention') cls.push('mention');
      if (diff.newEdges[e.id]) cls.push('new');
      if (diff.grownEdges[e.id]) cls.push('grown');
      if (extra) cls.push('extra');
      if (hl.edges[e.id]) cls.push('hl');
      var label = '';
      if (opts.edgeLabels !== false) {
        label = e.kind === 'mention' ? (e.weight > 1 ? '×' + e.weight : '') : e.label + (e.weight > 1 ? ' ×' + e.weight : '');
      }
      els.push({ group: 'edges', data: { id: e.id, source: e.source, target: e.target, w: CI.edgeWidth(e.weight), arrow: e.directed ? 'triangle' : 'none', elabel: label }, classes: cls.join(' ') });
    }

    graph.nodes.forEach(function (n) { addNode(n, false); });
    (opts.extraNodes || []).forEach(function (n) { addNode(n, true); });
    graph.edges.forEach(function (e) { addEdge(e, false); });
    (opts.extraEdges || []).forEach(function (e) { addEdge(e, true); });
    return els;
  };

  CI.cyStyle = function () {
    return [
      { selector: 'node', style: {
        'label': 'data(label)', 'font-size': 11, 'color': '#1d1d1b', 'text-valign': 'bottom', 'text-margin-y': 5,
        'text-wrap': 'wrap', 'text-max-width': 110, 'background-color': 'data(color)', 'shape': 'data(shape)',
        'width': 'mapData(degree, 0, 12, 24, 46)', 'height': 'mapData(degree, 0, 12, 24, 46)',
        'border-width': 1.5, 'border-color': '#ffffff', 'text-background-color': '#ffffff', 'text-background-opacity': 0.75, 'text-background-padding': 1
      } },
      { selector: 'node.seed', style: { 'border-width': 4, 'border-color': '#1d1d1b' } },
      { selector: 'node.hub', style: { 'border-style': 'double', 'border-width': 5, 'border-color': '#6b6b66' } },
      { selector: 'node.new', style: { 'border-width': 4, 'border-color': '#e8590c' } },
      { selector: 'node.extra', style: { 'opacity': 0.8 } },
      { selector: 'node.hl', style: { 'border-width': 4, 'border-color': '#e8590c' } },
      { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#3b5bdb', 'overlay-color': '#3b5bdb', 'overlay-opacity': 0.12, 'overlay-padding': 6 } },
      { selector: 'edge', style: {
        'width': 'data(w)', 'line-color': '#7d828c', 'target-arrow-color': '#7d828c', 'target-arrow-shape': 'data(arrow)', 'arrow-scale': 1.1,
        'curve-style': 'bezier', 'control-point-step-size': 38, 'label': 'data(elabel)', 'font-size': 9, 'color': '#3a3d44',
        'text-rotation': 'autorotate', 'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': 2, 'text-margin-y': -2
      } },
      { selector: 'edge.mention', style: { 'line-style': 'dashed', 'line-color': '#b9bcc4', 'target-arrow-shape': 'none', 'opacity': 0.9 } },
      { selector: 'edge.new', style: { 'line-color': '#e8590c', 'target-arrow-color': '#e8590c' } },
      { selector: 'edge.grown', style: { 'line-color': '#e8590c', 'target-arrow-color': '#e8590c' } },
      { selector: 'edge.extra', style: { 'opacity': 0.7 } },
      { selector: 'edge.hl', style: { 'line-color': '#e8590c', 'target-arrow-color': '#e8590c', 'opacity': 1, 'z-index': 20 } },
      { selector: 'edge:selected', style: { 'line-color': '#3b5bdb', 'target-arrow-color': '#3b5bdb', 'overlay-color': '#3b5bdb', 'overlay-opacity': 0.12 } }
    ];
  };

  CI.layoutOptions = function (name, graph) {
    var seeds = graph.nodes.filter(function (n) { return n.seed; }).map(function (n) { return n.id; });
    switch (name) {
      case 'breadthfirst': return { name: 'breadthfirst', directed: true, padding: 30, spacingFactor: 1.15, roots: seeds.length ? seeds.map(function (s) { return '#' + (root.CSS && root.CSS.escape ? root.CSS.escape(s) : s); }).join(',') : undefined, animate: false };
      case 'concentric': return { name: 'concentric', padding: 30, animate: false, minNodeSpacing: 30, concentric: function (n) { return n.degree(); }, levelWidth: function () { return 2; } };
      case 'circle': return { name: 'circle', padding: 30, animate: false };
      default: return { name: 'cose', padding: 30, animate: false, randomize: true, nodeRepulsion: function () { return 14000; }, idealEdgeLength: function () { return 110; }, nodeOverlap: 20, numIter: 1500, componentSpacing: 80 };
    }
  };

  /* Canvas wrapper (browser only). */
  CI.chart = {
    cy: null,
    destroy: function () { if (this.cy) { this.cy.destroy(); this.cy = null; } },
    render: function (container, graph, o) {
      var self = this, keepSel = null;
      if (self.cy) {
        var s = self.cy.$(':selected');
        if (s.length) keepSel = s[0].id();
        self.cy.destroy(); self.cy = null;
      }
      if (typeof root.cytoscape !== 'function') { container.innerHTML = '<p class="empty">The chart library did not load (vendor/cytoscape.min.js).</p>'; return; }
      var els = CI.buildElements(graph, o);
      var layoutName = o.layout || 'cose';
      var cy = self.cy = root.cytoscape({
        container: container, elements: els, style: CI.cyStyle(), minZoom: 0.15, maxZoom: 3, wheelSensitivity: 0.25,
        layout: CI.layoutOptions(layoutName, graph)
      });
      cy.on('tap', 'node', function (ev) { o.onNode && o.onNode(ev.target.id()); });
      cy.on('tap', 'edge', function (ev) { o.onEdge && o.onEdge(ev.target.id()); });
      cy.on('tap', function (ev) { if (ev.target === cy) o.onBackground && o.onBackground(); });
      if (keepSel) { var el = cy.getElementById(keepSel); if (el.length) el.select(); }
      if (o.highlightFit && o.hl) {
        var hlEls = cy.elements('.hl');
        if (hlEls.length) cy.fit(hlEls, 60);
      }
    },
    relayout: function (name, graph) {
      if (!this.cy) return;
      this.cy.layout(CI.layoutOptions(name, graph)).run();
      this.cy.fit(null, 30);
    },
    fit: function () { if (this.cy) this.cy.fit(null, 30); },
    png: function () { return this.cy ? this.cy.png({ full: true, scale: 2, bg: '#ffffff' }) : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
