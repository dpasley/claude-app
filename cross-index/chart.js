/* Connections chart: turns a computed graph into Cytoscape elements and manages the canvas.
 * Drawn like an investigation board: every file is a picture tile (photo, logo or a drawn placeholder),
 * connections are strings with their relationship type on a label chip.
 * The chart is always drawn on light "paper" so that what is on screen is what prints.
 * buildElements/cyStyle are pure so they can be tested without a browser. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  // Okabe-Ito colours (colour-blind safe); shape and the placeholder icon also encode type.
  CI.TYPE_COLOR = { individual: '#0072B2', group: '#D55E00', subject: '#009E73', area: '#CC79A7' };
  CI.TYPE_SHAPE = { individual: 'ellipse', group: 'round-rectangle', subject: 'diamond', area: 'hexagon' };

  CI.PAPER = {
    text: '#1d2230', bg: '#ffffff', edge: '#6f7589', edgeText: '#2c3142', chip: '#c3c8d6', seed: '#1d2230', hub: '#6f7589',
    sel: '#3552d1', accent: '#d9480f', types: CI.TYPE_COLOR
  };
  CI.DEFAULT_THEME = CI.PAPER;
  CI.readTheme = function () { return CI.PAPER; };

  CI.edgeWidth = function (w) { return Math.min(10, 2 + (w - 1) * 1.5); };

  /* opts: edgeLabels, diff, extraNodes[], extraEdges[], hl {edges,nodes}, photoOf(id) -> data URI */
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
      var color = CI.TYPE_COLOR[n.type] || '#666666';
      var photo = opts.photoOf ? opts.photoOf(n.id) : '';
      var logo = photo && n.type === 'group';
      els.push({ group: 'nodes', data: {
        id: n.id, label: n.name, color: color, type: n.type, shape: CI.TYPE_SHAPE[n.type] || 'ellipse', degree: n.degree || 0,
        img: CI.tile(n.type, color, photo), fit: 'contain', bg: color
      }, classes: cls.join(' ') });
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

  CI.cyStyle = function (t) {
    t = t || CI.PAPER;
    return [
      { selector: 'node', style: {
        'label': 'data(label)', 'font-size': 11, 'font-weight': 'bold', 'color': t.text, 'text-valign': 'bottom', 'text-margin-y': 8,
        'text-wrap': 'wrap', 'text-max-width': 120,
        'text-background-color': t.bg, 'text-background-opacity': 0.96, 'text-background-shape': 'roundrectangle', 'text-background-padding': 3,
        'text-border-width': 1, 'text-border-color': t.chip, 'text-border-opacity': 1,
        'background-opacity': 0, 'background-image': 'data(img)', 'background-fit': 'contain', 'background-clip': 'none', 'background-image-containment': 'over', 'background-image-opacity': 1,
        'shape': 'data(shape)', 'width': 'mapData(degree, 0, 12, 64, 96)', 'height': 'mapData(degree, 0, 12, 64, 96)',
        'border-width': 0
      } },
      { selector: 'node.seed', style: { 'outline-width': 5, 'outline-color': t.seed, 'outline-offset': 0, 'outline-opacity': 1 } },
      { selector: 'node.hub', style: { 'outline-width': 5, 'outline-style': 'solid', 'outline-color': t.hub, 'outline-offset': 0, 'outline-opacity': 1 } },
      { selector: 'node.new', style: { 'outline-width': 5, 'outline-color': t.accent, 'outline-offset': 0, 'outline-opacity': 1 } },
      { selector: 'node.hl', style: { 'outline-width': 5, 'outline-color': t.accent, 'outline-offset': 0, 'outline-opacity': 1 } },
      { selector: 'node.extra', style: { 'opacity': 0.85 } },
      { selector: 'node:selected', style: { 'outline-width': 5, 'outline-color': t.sel, 'outline-offset': 0, 'outline-opacity': 1, 'overlay-color': t.sel, 'overlay-opacity': 0.1, 'overlay-padding': 10 } },
      { selector: 'edge', style: {
        'width': 'data(w)', 'line-color': t.edge, 'target-arrow-color': t.edge, 'target-arrow-shape': 'data(arrow)', 'arrow-scale': 1.3,
        'curve-style': 'bezier', 'control-point-step-size': 46, 'line-cap': 'round',
        'label': 'data(elabel)', 'font-size': 9, 'font-weight': 'bold', 'color': t.edgeText, 'text-rotation': 'autorotate',
        'text-background-color': t.bg, 'text-background-opacity': 1, 'text-background-shape': 'roundrectangle', 'text-background-padding': 3,
        'text-border-width': 1, 'text-border-color': t.chip, 'text-border-opacity': 1
      } },
      { selector: 'edge.mention', style: { 'line-style': 'dashed', 'line-color': t.chip, 'target-arrow-shape': 'none', 'width': 1.6, 'text-border-opacity': 0 } },
      { selector: 'edge.new', style: { 'line-color': t.accent, 'target-arrow-color': t.accent } },
      { selector: 'edge.grown', style: { 'line-color': t.accent, 'target-arrow-color': t.accent } },
      { selector: 'edge.extra', style: { 'opacity': 0.75 } },
      { selector: 'edge.hl', style: { 'line-color': t.accent, 'target-arrow-color': t.accent, 'opacity': 1, 'z-index': 20 } },
      { selector: 'edge:selected', style: { 'line-color': t.sel, 'target-arrow-color': t.sel, 'overlay-color': t.sel, 'overlay-opacity': 0.12 } },
      { selector: 'node.note', style: { 'background-opacity': 1, 'background-color': '#fff3b8', 'background-image': 'none', 'shape': 'round-rectangle', 'width': 'label', 'height': 'label', 'padding': '12px', 'text-valign': 'center', 'text-halign': 'center', 'text-margin-y': 0, 'text-max-width': 190, 'text-wrap': 'wrap', 'font-size': 13, 'font-weight': 'normal', 'color': '#3b3200', 'text-background-opacity': 0, 'text-border-width': 0, 'border-width': 1, 'border-color': '#d1b94a' } },
      { selector: 'node.flag', style: { 'background-opacity': 1, 'background-color': t.accent, 'background-image': 'none', 'shape': 'round-rectangle', 'width': 'label', 'height': 18, 'padding': '6px', 'text-valign': 'center', 'text-halign': 'center', 'text-margin-y': 0, 'font-size': 10, 'font-weight': 'bold', 'color': '#ffffff', 'text-background-opacity': 0, 'text-border-width': 0, 'border-width': 0, 'events': 'no', 'z-index': 30 } },
      { selector: 'node.dim', style: { 'opacity': 0.16, 'text-opacity': 0.25 } },
      { selector: 'edge.dim', style: { 'opacity': 0.1, 'text-opacity': 0 } }
    ];
  };

  CI.layoutOptions = function (name, graph) {
    var seeds = graph.nodes.filter(function (n) { return n.seed; }).map(function (n) { return n.id; });
    switch (name) {
      case 'breadthfirst': return { name: 'breadthfirst', directed: true, padding: 40, spacingFactor: 1.35, roots: seeds.length ? seeds.map(function (s) { return '#' + (root.CSS && root.CSS.escape ? root.CSS.escape(s) : s); }).join(',') : undefined, animate: false };
      case 'concentric': return { name: 'concentric', padding: 40, animate: false, minNodeSpacing: 60, concentric: function (n) { return n.degree(); }, levelWidth: function () { return 2; } };
      case 'circle': return { name: 'circle', padding: 40, animate: false };
      default: return { name: 'cose', padding: 40, animate: false, randomize: true, nodeRepulsion: function () { return 90000; }, idealEdgeLength: function () { return 260; }, nodeOverlap: 40, numIter: 1800, componentSpacing: 120, gravity: 0.25, nodeDimensionsIncludeLabels: true };
    }
  };

  /* Canvas wrapper (browser only). o: layout, edgeLabels, diff, hl, extraNodes, extraEdges, highlightFit, photoOf,
   * positions {id:{x,y}} (saved arrangement), onMoved(id,pos), onNode, onEdge, onBackground */
  CI.chart = {
    cy: null, focusId: null,
    destroy: function () { if (this.cy) { this.cy.destroy(); this.cy = null; } },
    focus: function (id) {
      var cy = this.cy; if (!cy) return;
      cy.elements().removeClass('dim');
      this.focusId = null;
      if (!id) return;
      var n = cy.getElementById(id); if (!n.length) return;
      var keep = n.isNode() ? n.closedNeighborhood() : n.connectedNodes().union(n);
      cy.elements().not(keep).addClass('dim');
      this.focusId = id;
    },
    render: function (container, graph, o) {
      var self = this, keepSel = null, keepFocus = self.focusId;
      if (self.cy) {
        var s = self.cy.$(':selected');
        if (s.length) keepSel = s[0].id();
        self.cy.destroy(); self.cy = null;
      }
      if (typeof root.cytoscape !== 'function') { container.innerHTML = '<p class="empty">The chart library did not load (vendor/cytoscape.min.js).</p>'; return; }
      var els = CI.buildElements(graph, o);
      var cy = self.cy = root.cytoscape({
        container: container, elements: els, style: CI.cyStyle(CI.PAPER), minZoom: 0.1, maxZoom: 3, wheelSensitivity: 0.25, layout: { name: 'null' }
      });
      var pos = o.positions || {};
      var layout = cy.layout(CI.layoutOptions(o.layout || 'cose', graph));
      layout.one('layoutstop', function () {
        cy.nodes().forEach(function (n) { var p = pos[n.id()]; if (p && isFinite(p.x) && isFinite(p.y)) n.position({ x: p.x, y: p.y }); });
        cy.fit(null, 40);
        if (o.highlightFit && o.hl) { var h = cy.elements('.hl'); if (h.length) cy.fit(h, 80); }
      });
      layout.run();
      cy.on('tap', 'node', function (ev) { self.focus(ev.target.id()); o.onNode && o.onNode(ev.target.id()); });
      cy.on('tap', 'edge', function (ev) { self.focus(ev.target.id()); o.onEdge && o.onEdge(ev.target.id()); });
      cy.on('tap', function (ev) { if (ev.target === cy) { self.focus(null); o.onBackground && o.onBackground(); } });
      cy.on('dragfree', 'node', function (ev) { var p = ev.target.position(); o.onMoved && o.onMoved(ev.target.id(), { x: Math.round(p.x), y: Math.round(p.y) }); });
      if (keepSel) { var el = cy.getElementById(keepSel); if (el.length) el.select(); }
      if (keepFocus) self.focus(keepFocus); else self.focusId = null;
    },
    relayout: function (name, graph) {
      if (!this.cy) return;
      var cy = this.cy;
      var l = cy.layout(CI.layoutOptions(name, graph));
      l.one('layoutstop', function () { cy.fit(null, 40); });
      l.run();
    },
    fit: function () { if (this.cy) this.cy.fit(null, 40); },
    /* Whole graph in model coordinates, labels included (selection and focus cleared first); null when empty. */
    bounds: function () {
      var cy = this.cy;
      if (!cy || !cy.elements().length) return null;
      var sel = cy.$(':selected'), dim = cy.elements('.dim');
      sel.unselect(); dim.removeClass('dim');
      try {
        var b = cy.elements().boundingBox();
        return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, w: b.w, h: b.h };
      } finally { sel.select(); dim.addClass('dim'); }
    },
    /* Render the whole graph to one canvas at `scale` pixels per model unit (white background). */
    fullCanvas: function (scale) {
      var cy = this.cy, sel = cy.$(':selected'), dim = cy.elements('.dim');
      sel.unselect(); dim.removeClass('dim');
      try {
        var bb = cy.elements().boundingBox();
        var canvas = cy.renderer().bufferCanvasImage({ full: true, maxWidth: bb.w * scale, maxHeight: bb.h * scale, bg: '#ffffff' });
        return { canvas: canvas, bb: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2, w: bb.w, h: bb.h }, scale: canvas.width / bb.w };
      } finally { sel.select(); dim.addClass('dim'); }
    },
    png: function () { return this.cy ? this.cy.png({ full: true, scale: 2, bg: '#ffffff' }) : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
