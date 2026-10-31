/* Connections chart: turns a computed graph into Cytoscape elements and manages the canvas.
 * Drawn like an investigation board: every file is a picture tile (photo, logo or a drawn placeholder),
 * connections are strings with their relationship type on a label chip.
 * The chart is always drawn on light "paper" so that what is on screen is what prints.
 * buildElements/cyStyle are pure so they can be tested without a browser. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  // Okabe-Ito colours (colour-blind safe); shape and the placeholder icon also encode type.
  CI.TYPE_COLOR = { individual: '#0072B2', group: '#D55E00', subject: '#009E73', area: '#CC79A7', item: '#6B7280' };
  CI.TYPE_SHAPE = { individual: 'ellipse', group: 'ellipse', subject: 'ellipse', area: 'ellipse', item: 'ellipse' };

  CI.PAPER = {
    text: '#1d2230', bg: '#fafbfc', edge: '#aab1c4', edgeHot: '#2c3550', edgeText: '#2c3142', chip: '#c3c8d6', seed: '#1d2230', hub: '#6f7589',
    sel: '#3552d1', accent: '#d9480f', types: CI.TYPE_COLOR
  };
  CI.DEFAULT_THEME = CI.PAPER;
  CI.readTheme = function () { return CI.PAPER; };

  CI.edgeWidth = function (w) { return Math.min(7, 1.4 + (w - 1) * 0.9); };

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
        img: n.cluster ? CI.clusterTile(n.size) : CI.tile(n.type, color, photo), fit: 'contain', bg: color
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
      var full = e.kind === 'mention' ? (e.weight > 1 ? '×' + e.weight : '') : (CI.humanLabel ? CI.humanLabel(e.label) : e.label) + (e.weight > 1 ? ' ×' + e.weight : '');
      var label = opts.edgeLabels !== false ? full : '';
      els.push({ group: 'edges', data: { id: e.id, source: e.source, target: e.target, w: CI.edgeWidth(e.weight), arrow: e.directed ? 'triangle' : 'none', elabel: label, full: full }, classes: cls.join(' ') });
    }

    graph.nodes.forEach(function (n) { addNode(n, false); });
    (opts.extraNodes || []).forEach(function (n) { addNode(n, true); });
    graph.edges.forEach(function (e) { addEdge(e, false); });
    (opts.extraEdges || []).forEach(function (e) { addEdge(e, true); });
    return els;
  };

  CI.cyStyle = function (t, o) {
    t = t || CI.PAPER; o = o || {};
    var sz = o.sizeByLinks === false ? 62 : 'mapData(degree, 0, 20, 44, 124)';
    return [
      { selector: 'node', style: {
        'label': 'data(label)', 'font-size': 13, 'font-weight': 600, 'color': t.text, 'text-valign': 'bottom', 'text-margin-y': 7,
        'text-wrap': 'wrap', 'text-max-width': 110,
        'text-outline-color': t.bg, 'text-outline-width': 2, 'text-outline-opacity': 1,
        'text-background-color': t.bg, 'text-background-opacity': 0.82, 'text-background-padding': 2, 'text-background-shape': 'roundrectangle',
        'background-opacity': 0, 'background-image': 'data(img)', 'background-fit': 'contain', 'background-clip': 'none', 'background-image-containment': 'over', 'background-image-opacity': 1,
        'shape': 'data(shape)', 'width': sz, 'height': sz,
        'border-width': 0, 'transition-property': 'opacity', 'transition-duration': '120ms'
      } },
      { selector: 'node.seed', style: { 'outline-width': 3, 'outline-color': t.seed, 'outline-offset': 2, 'outline-opacity': 1 } },
      { selector: 'node.hub', style: { 'outline-width': 3, 'outline-style': 'solid', 'outline-color': t.hub, 'outline-offset': 2, 'outline-opacity': 1 } },
      { selector: 'node.new', style: { 'outline-width': 3, 'outline-color': t.accent, 'outline-offset': 2, 'outline-opacity': 1 } },
      { selector: 'node.hl', style: { 'outline-width': 3, 'outline-color': t.accent, 'outline-offset': 2, 'outline-opacity': 1 } },
      { selector: 'node.extra', style: { 'opacity': 0.85 } },
      { selector: 'node:selected', style: { 'outline-width': 3, 'outline-color': t.sel, 'outline-offset': 2, 'outline-opacity': 1, 'overlay-color': t.sel, 'overlay-opacity': 0.1, 'overlay-padding': 10 } },
      { selector: 'edge', style: {
        'width': 'data(w)', 'line-color': t.edge, 'target-arrow-color': t.edge, 'target-arrow-shape': 'data(arrow)', 'arrow-scale': 0.9,
        'curve-style': 'bezier', 'control-point-step-size': 34, 'line-cap': 'round', 'opacity': 0.8,
        'label': 'data(elabel)', 'font-size': 11, 'font-weight': 600, 'color': t.edgeText, 'text-rotation': 'autorotate',
        'text-outline-color': t.bg, 'text-outline-width': 3, 'text-outline-opacity': 1, 'transition-property': 'opacity', 'transition-duration': '120ms'
      } },
      { selector: 'edge.hot', style: { 'line-color': t.edgeHot, 'target-arrow-color': t.edgeHot, 'opacity': 1, 'z-index': 30, 'label': 'data(full)', 'text-opacity': 1 } },
      { selector: 'node.fade', style: { 'opacity': 0.28, 'text-opacity': 0.4 } },
      { selector: 'edge.fade', style: { 'opacity': 0.12 } },
      { selector: 'edge.mention', style: { 'line-style': 'dashed', 'line-color': t.chip, 'target-arrow-shape': 'none', 'width': 1.2 } },
      { selector: 'edge.new', style: { 'line-color': t.accent, 'target-arrow-color': t.accent } },
      { selector: 'edge.grown', style: { 'line-color': t.accent, 'target-arrow-color': t.accent } },
      { selector: 'edge.extra', style: { 'opacity': 0.75 } },
      { selector: 'edge.hl', style: { 'line-color': t.accent, 'target-arrow-color': t.accent, 'opacity': 1, 'z-index': 20, 'width': 3 } },
      { selector: 'edge:selected', style: { 'line-color': t.sel, 'target-arrow-color': t.sel, 'overlay-color': t.sel, 'overlay-opacity': 0.12 } },
      { selector: 'node.note', style: { 'background-opacity': 1, 'background-color': '#fff3b8', 'background-image': 'none', 'shape': 'round-rectangle', 'width': 'label', 'height': 'label', 'padding': '12px', 'text-valign': 'center', 'text-halign': 'center', 'text-margin-y': 0, 'text-max-width': 190, 'text-wrap': 'wrap', 'font-size': 13, 'font-weight': 'normal', 'color': '#3b3200', 'text-background-opacity': 0, 'text-border-width': 0, 'border-width': 1, 'border-color': '#d1b94a' } },
      { selector: 'node.flag', style: { 'background-opacity': 1, 'background-color': t.accent, 'background-image': 'none', 'shape': 'round-rectangle', 'width': 'label', 'height': 18, 'padding': '6px', 'text-valign': 'center', 'text-halign': 'center', 'text-margin-y': 0, 'font-size': 10, 'font-weight': 'bold', 'color': '#ffffff', 'text-background-opacity': 0, 'text-border-width': 0, 'border-width': 0, 'events': 'no', 'z-index': 30 } },
      { selector: 'node.dim', style: { 'opacity': 0.16, 'text-opacity': 0.25 } },
      { selector: 'edge.dim', style: { 'opacity': 0.1, 'text-opacity': 0 } },
      { selector: 'node.lbl-off', style: { 'text-opacity': 0, 'text-outline-opacity': 0, 'text-background-opacity': 0 } },
      { selector: 'edge.lbl-off', style: { 'text-opacity': 0, 'text-outline-opacity': 0 } }
    ];
  };


  CI.GROUP_TINTS = ['53,82,209', '0,158,115', '213,94,0', '204,121,167', '110,90,200', '60,140,170'];
  /* The groups found in a graph, largest first: id, name (the most connected member unless renamed), members. */
  CI.groupInfo = function (graph, names) {
    names = names || {};
    var cl = CI.clusters(graph), by = {};
    graph.nodes.forEach(function (n) { var k = cl[n.id]; if (k) (by[k] = by[k] || []).push(n); });
    return Object.keys(by).map(function (k) {
      var m = by[k].slice().sort(function (a, b) { return (b.degree || 0) - (a.degree || 0) || a.name.localeCompare(b.name); });
      return { id: k, name: names[k] || (/\bgroup$/i.test(m[0].name) ? m[0].name : m[0].name + ' group'), renamed: !!names[k], members: m.map(function (n) { return n.id; }), size: m.length };
    }).sort(function (a, b) { return b.size - a.size || a.name.localeCompare(b.name); });
  };
  /* Folds each collapsed group into one node; connections to the rest are added up. */
  CI.collapseGraph = function (graph, collapsed, names) {
    var on = Object.keys(collapsed || {}).filter(function (k) { return collapsed[k]; });
    if (!on.length) return graph;
    var info = CI.groupInfo(graph, names).filter(function (g) { return collapsed[g.id]; }), rep = {};
    if (!info.length) return graph;
    info.forEach(function (g) { g.members.forEach(function (id) { rep[id] = 'grp:' + g.id; }); });
    var edges = [], by = {}, partners = {};
    graph.edges.forEach(function (e) {
      var a = rep[e.source] || e.source, b = rep[e.target] || e.target;
      if (a === b) return;
      if (a === e.source && b === e.target) { edges.push(e); return; }
      var k = a < b ? a + '|' + b : b + '|' + a, x = by[k];
      if (!x) { x = by[k] = { id: 'ge:' + k, source: a, target: b, kind: 'link', label: '', weight: 0, directed: false, n: 0 }; edges.push(x); }
      x.weight += e.weight || 1; x.n++; x.label = x.n + ' connection' + (x.n === 1 ? '' : 's');
      (partners[a] = partners[a] || {})[b] = 1; (partners[b] = partners[b] || {})[a] = 1;
    });
    var nodes = graph.nodes.filter(function (n) { return !rep[n.id]; }).concat(info.map(function (g) {
      return { id: 'grp:' + g.id, name: g.name, type: 'group', cluster: true, size: g.size, degree: Math.max(8, Object.keys(partners['grp:' + g.id] || {}).length + 4) };
    }));
    var out = {}; Object.keys(graph).forEach(function (k) { out[k] = graph[k]; }); out.nodes = nodes; out.edges = edges; return out;
  };
  CI.clusterTile = function (n) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect x="5" y="5" width="86" height="86" rx="24" fill="#e8ecfc" stroke="#3552d1" stroke-width="4" stroke-dasharray="7 5"/><text x="48" y="58" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#3552d1">' + n + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  /* Groups of names that are tightly connected: label propagation, repeatable (ties go to the smaller id). */
  CI.clusters = function (graph) {
    var lab = {}, nb = {}, ids = graph.nodes.map(function (n) { return n.id; }).sort();
    ids.forEach(function (id) { lab[id] = id; nb[id] = []; });
    (graph.edges || []).forEach(function (e) { if (e.kind === 'mention' || !nb[e.source] || !nb[e.target]) return; nb[e.source].push([e.target, e.weight || 1]); nb[e.target].push([e.source, e.weight || 1]); });
    for (var round = 0; round < 12; round++) {
      var changed = false;
      ids.forEach(function (id) {
        var sum = {}; nb[id].forEach(function (p) { sum[lab[p[0]]] = (sum[lab[p[0]]] || 0) + p[1]; });
        var best = lab[id], bw = -1; Object.keys(sum).sort().forEach(function (l) { if (sum[l] > bw) { bw = sum[l]; best = l; } });
        if (best !== lab[id]) { lab[id] = best; changed = true; }
      });
      if (!changed) break;
    }
    var sizes = {}; ids.forEach(function (id) { sizes[lab[id]] = (sizes[lab[id]] || 0) + 1; });
    var out = {}; ids.forEach(function (id) { out[id] = sizes[lab[id]] >= 3 ? lab[id] : ''; });
    return out;
  };
  CI.layoutOptions = function (name, graph) {
    var seeds = graph.nodes.filter(function (n) { return n.seed; }).map(function (n) { return n.id; });
    switch (name) {
      case 'breadthfirst': return { name: 'breadthfirst', directed: true, padding: 40, spacingFactor: 1.35, roots: seeds.length ? seeds.map(function (s) { return '#' + (root.CSS && root.CSS.escape ? root.CSS.escape(s) : s); }).join(',') : undefined, animate: false };
      case 'concentric': return { name: 'concentric', padding: 40, animate: false, minNodeSpacing: 60, concentric: function (n) { return n.degree(); }, levelWidth: function () { return 2; } };
      case 'circle': return { name: 'circle', padding: 40, animate: false };
      case 'groups': var cg = CI.clusters(graph); return { name: 'cose', padding: 60, animate: false, randomize: true, nodeRepulsion: function () { return 180000; }, idealEdgeLength: function (e) { var a = cg[e.source().id()], b = cg[e.target().id()]; return a && a === b ? 105 : 540; }, edgeElasticity: function (e) { var a = cg[e.source().id()], b = cg[e.target().id()]; return a && a === b ? 220 : 18; }, nodeOverlap: 40, numIter: 2600, componentSpacing: 200, gravity: 0.25, nodeDimensionsIncludeLabels: true };
      default: var cl = CI.clusters(graph); return { name: 'cose', padding: 50, animate: false, randomize: true, nodeRepulsion: function () { return 120000; }, idealEdgeLength: function (e) { var a = cl[e.source().id()], b = cl[e.target().id()]; return a && a === b ? 150 : 330; }, edgeElasticity: function (e) { var a = cl[e.source().id()], b = cl[e.target().id()]; return a && a === b ? 160 : 40; }, nodeOverlap: 40, numIter: 2200, componentSpacing: 140, gravity: 0.3, nodeDimensionsIncludeLabels: true };
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
    /* Places nodes that have no saved position next to a connected node that has one, so a saved arrangement never shifts. */
    placeNew: function (cy, pos) {
      var has = function (id) { var p = pos[id]; return !!p && isFinite(p.x) && isFinite(p.y); };
      var xs = [], ys = [];
      cy.nodes().forEach(function (n) { if (has(n.id())) { xs.push(pos[n.id()].x); ys.push(pos[n.id()].y); } });
      var maxX = xs.length ? Math.max.apply(null, xs) : 0, minY = ys.length ? Math.min.apply(null, ys) : 0, loose = 0, around = {};
      cy.nodes().forEach(function (n) {
        if (has(n.id())) return;
        var nb = n.neighborhood('node').filter(function (x) { return has(x.id()); });
        if (nb.length) {
          var a = nb[0], k = around[a.id()] = (around[a.id()] || 0) + 1, ang = k * 2.4, r = 150 + 12 * k;
          var ax = 0, ay = 0; nb.forEach(function (m) { ax += pos[m.id()].x; ay += pos[m.id()].y; }); ax /= nb.length; ay /= nb.length;
          pos[n.id()] = { x: Math.round(ax + r * Math.cos(ang)), y: Math.round(ay + r * Math.sin(ang)) };
        } else {
          pos[n.id()] = { x: Math.round(maxX + 180), y: Math.round(minY + 110 * loose++) };
        }
      });
    },
    render: function (container, graph, o) {
      var self = this, keepSel = null, keepFocus = self.focusId;
      if (self.cy) {
        var s = self.cy.$(':selected');
        if (s.length) keepSel = s[0].id();
        self.lastView = { key: self.viewKey, zoom: self.cy.zoom(), pan: self.cy.pan() };
        self.cy.destroy(); self.cy = null;
      }
      if (typeof root.cytoscape !== 'function') { container.innerHTML = '<p class="empty">The chart library did not load (vendor/cytoscape.min.js).</p>'; return; }
      var base = graph, pos = o.positions || {}, valid = function (id) { var p = pos[id]; return !!p && isFinite(p.x) && isFinite(p.y); };
      if (o.collapsed && Object.keys(o.collapsed).some(function (k) { return o.collapsed[k]; })) {
        graph = CI.collapseGraph(base, o.collapsed, o.groupNames);
        CI.groupInfo(base, o.groupNames).forEach(function (g) {
          var id = 'grp:' + g.id; if (!o.collapsed[g.id] || valid(id)) return;
          var pts = g.members.filter(valid); if (!pts.length) return;
          pos[id] = { x: Math.round(pts.reduce(function (a, m) { return a + pos[m].x; }, 0) / pts.length), y: Math.round(pts.reduce(function (a, m) { return a + pos[m].y; }, 0) / pts.length) };
        });
      }
      var els = CI.buildElements(graph, o);
      var cy = self.cy = root.cytoscape({
        container: container, elements: els, style: CI.cyStyle(CI.PAPER, o), minZoom: 0.08, maxZoom: 3, wheelSensitivity: 0.8, layout: { name: 'null' }
      });
      self.viewKey = o.viewKey || ''; self.hist = [];
      /* Gentle curves: single connections bow a little, several between the same two names fan out. Straight when the chart is busy. */
      if (o.curves !== false && cy.edges().length <= 350) {
        var pairs = {};
        cy.edges().forEach(function (e) { var a = e.data('source'), b = e.data('target'), k = a < b ? a + '|' + b : b + '|' + a; (pairs[k] = pairs[k] || []).push(e); });
        Object.keys(pairs).forEach(function (k) {
          var g = pairs[k];
          g.forEach(function (e, i) {
            var sign = e.data('source') < e.data('target') ? 1 : -1, dist = (i - (g.length - 1) / 2) * 30 + (g.length === 1 ? 20 : 0);
            e.style({ 'curve-style': 'unbundled-bezier', 'control-point-distances': [dist * sign], 'control-point-weights': [0.5] });
          });
        });
      }
      var nodeIds = cy.nodes().map(function (n) { return n.id(); }), saved = nodeIds.filter(valid).length;
      var fresh = o.forceLayout || !nodeIds.length || saved === 0;
      var layout;
      if (fresh) layout = cy.layout(CI.layoutOptions(o.layout || 'cose', graph));
      else { self.placeNew(cy, pos); layout = cy.layout({ name: 'preset', positions: function (n) { return pos[n.id()]; }, fit: false }); }
      layout.one('layoutstop', function () {
        var out = {}, moved = false;
        cy.nodes().forEach(function (n) { var p = n.position(); out[n.id()] = { x: Math.round(p.x), y: Math.round(p.y) }; if (!valid(n.id()) || fresh) moved = true; });
        if (moved && o.onLaidOut) o.onLaidOut(out);
        var lv = self.lastView;
        if (!fresh && !o.forceFit && lv && lv.key === self.viewKey) { cy.zoom(lv.zoom); cy.pan(lv.pan); }
        else cy.fit(null, 40);
        if (o.highlightFit && o.hl) { var h = cy.elements('.hl'); if (h.length) cy.fit(h, 80); }
        applyLabels(); drawMini();
      });
      layout.run();
      /* Labels follow the zoom: far out only the best connected names are labelled, close in everything is. */
      var lblPending = false;
      function applyLabels() {
        lblPending = false; if (!cy || cy.destroyed()) return;
        if (o.zoomLabels === false) { cy.nodes().removeClass('lbl-off'); cy.edges().toggleClass('lbl-off', !o.edgeLabels && false); return; }
        var z = cy.zoom();
        var ns = cy.nodes().filter(function (n) { return !n.hasClass('note') && !n.hasClass('flag'); }).sort(function (a, b) { return (b.data('degree') || 0) - (a.data('degree') || 0); });
        var frac = ns.length <= 30 ? (z < 0.3 ? 0.3 : 1.01) : (z < 0.4 ? 0.08 : z < 0.75 ? 0.35 : 1.01);
        var keep = Math.ceil(ns.length * frac);
        cy.batch(function () {
          ns.forEach(function (n, i) { n.toggleClass('lbl-off', i >= keep && !n.hasClass('seed') && !n.hasClass('hl') && !n.hasClass('new')); });
          cy.edges().toggleClass('lbl-off', !o.edgeLabels && z < 1.25);
        });
      }
      cy.on('zoom', function () { if (!lblPending) { lblPending = true; (root.requestAnimationFrame || setTimeout)(applyLabels); } });
      cy.on('mouseover', 'node', function (ev) { var nb = ev.target.closedNeighborhood(); cy.elements().not(nb).addClass('fade'); nb.edges().addClass('hot'); nb.removeClass('lbl-off'); });
      cy.on('mouseover', 'edge', function (ev) { ev.target.addClass('hot').removeClass('lbl-off'); });
      cy.on('mouseout', 'node, edge', function () { cy.elements().removeClass('fade hot'); applyLabels(); });
      if (o.hulls !== false) self.hulls(container, cy, base, o);
      /* Zoom helpers: double-click a name to zoom to it and its neighbours, keys + - 0 F, a small overview map. */
      cy.on('dbltap', 'node', function (ev) { self.hood(ev.target.id()); });
      if (self.keyEl && self.keyFn) self.keyEl.removeEventListener('keydown', self.keyFn);
      self.keyEl = container; container.tabIndex = 0;
      self.keyFn = function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); self.zoomBy(1.25); }
        else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); self.zoomBy(0.8); }
        else if (ev.key === '0') { ev.preventDefault(); self.pushView(); self.fit(); }
        else if (ev.key === 'f' || ev.key === 'F') { var s = cy.$('node:selected'); ev.preventDefault(); if (s.length) self.hood(s[0].id()); else { self.pushView(); self.fit(); } }
        else if (ev.key === 'Backspace' || ev.key === 'b') { ev.preventDefault(); self.back(); }
      };
      container.addEventListener('keydown', self.keyFn);
      container.addEventListener('mousedown', function () { try { container.focus({ preventScroll: true }); } catch (e) { container.focus(); } });
      var mini = null, mctx = null, MW = 176, MH = 118, mview = null;
      var oldMini = container.querySelector('.minimap'); if (oldMini) oldMini.remove();
      if (o.minimap !== false && graph.nodes.length >= 10) {
        mini = container.ownerDocument.createElement('canvas'); mini.className = 'minimap'; mini.width = MW * 2; mini.height = MH * 2; mini.style.width = MW + 'px'; mini.style.height = MH + 'px'; mini.title = 'Overview: click or drag to move around';
        container.appendChild(mini); mctx = mini.getContext('2d');
        var dragging = false;
        var toModel = function (ev) { var r = mini.getBoundingClientRect(); if (!mview) return null; return { x: mview.x1 + ((ev.clientX - r.left) - mview.ox) / mview.s, y: mview.y1 + ((ev.clientY - r.top) - mview.oy) / mview.s }; };
        var go = function (ev) { var m = toModel(ev); if (!m) return; var z = cy.zoom(); cy.pan({ x: cy.width() / 2 - m.x * z, y: cy.height() / 2 - m.y * z }); };
        mini.addEventListener('pointerdown', function (ev) { dragging = true; try { mini.setPointerCapture(ev.pointerId); } catch (e) {} self.pushView(); go(ev); ev.stopPropagation(); ev.preventDefault(); });
        mini.addEventListener('pointermove', function (ev) { if (dragging) go(ev); });
        mini.addEventListener('pointerup', function () { dragging = false; });
      }
      var miniPending = false;
      function drawMini() {
        miniPending = false; if (!mini || !cy || cy.destroyed()) return;
        var bb = cy.elements().boundingBox(), ex = cy.extent(); if (!isFinite(bb.w) || !bb.w) return;
        var x1 = Math.min(bb.x1, ex.x1), y1 = Math.min(bb.y1, ex.y1), x2 = Math.max(bb.x2, ex.x2), y2 = Math.max(bb.y2, ex.y2);
        var s = Math.min((MW - 12) / (x2 - x1), (MH - 12) / (y2 - y1)), ox = (MW - s * (x2 - x1)) / 2, oy = (MH - s * (y2 - y1)) / 2;
        mview = { x1: x1, y1: y1, s: s, ox: ox, oy: oy };
        mctx.setTransform(2, 0, 0, 2, 0, 0); mctx.clearRect(0, 0, MW, MH);
        cy.nodes().forEach(function (n) { var p = n.position(); mctx.fillStyle = n.data('color') || '#666'; mctx.globalAlpha = n.hasClass('dim') ? 0.25 : 0.9; mctx.beginPath(); mctx.arc(ox + (p.x - x1) * s, oy + (p.y - y1) * s, n.hasClass('seed') ? 3 : 2.2, 0, 7); mctx.fill(); });
        mctx.globalAlpha = 1; mctx.strokeStyle = '#3552d1'; mctx.lineWidth = 1.5; mctx.fillStyle = 'rgba(53,82,209,.08)';
        var rx = ox + (ex.x1 - x1) * s, ry = oy + (ex.y1 - y1) * s, rw = (ex.x2 - ex.x1) * s, rh = (ex.y2 - ex.y1) * s;
        mctx.fillRect(rx, ry, rw, rh); mctx.strokeRect(rx, ry, rw, rh);
      }
      cy.on('viewport position layoutstop', function () { if (mini && !miniPending) { miniPending = true; (root.requestAnimationFrame || setTimeout)(drawMini); } });
      cy.on('tap', 'node', function (ev) { if (/^grp:/.test(ev.target.id())) { o.onGroup && o.onGroup(ev.target.id().slice(4)); return; } self.focus(ev.target.id()); o.onNode && o.onNode(ev.target.id()); });
      cy.on('tap', 'edge', function (ev) { self.focus(ev.target.id()); o.onEdge && o.onEdge(ev.target.id()); });
      cy.on('tap', function (ev) { if (ev.target === cy) { self.focus(null); o.onBackground && o.onBackground(); } });
      cy.on('dragfree', 'node', function (ev) { var p = ev.target.position(); o.onMoved && o.onMoved(ev.target.id(), { x: Math.round(p.x), y: Math.round(p.y) }); });
      applyLabels(); drawMini();
      if (keepSel) { var el = cy.getElementById(keepSel); if (el.length) el.select(); }
      if (keepFocus) self.focus(keepFocus); else self.focusId = null;
    },
    /* Soft shaded areas behind groups of closely connected names. Drawn under the chart; not part of the printed chart. */
    hulls: function (container, cy, graph, o) {
      o = o || {};
      var old = container.querySelector('.hull-layer'); if (old) old.remove();
      var info = CI.groupInfo(graph, o.groupNames), ids = {}, nameOf = {}; info.forEach(function (g) { ids[g.id] = g.members; nameOf[g.id] = g.name; });
      var keys = info.map(function (g) { return g.id; }); if (keys.length < 2 || graph.nodes.length < 8) return;
      var cv = container.ownerDocument.createElement('canvas'); cv.className = 'hull-layer';
      cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:0';
      container.insertBefore(cv, container.firstChild);
      var TINTS = CI.GROUP_TINTS;
      function hull(pts) {
        pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
        function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
        var lo = [], up = [], i;
        for (i = 0; i < pts.length; i++) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop(); lo.push(pts[i]); }
        for (i = pts.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(pts[i]); }
        up.pop(); lo.pop(); return lo.concat(up);
      }
      var pending = false;
      function draw() {
        pending = false; if (!cy || cy.destroyed()) return;
        var w = container.clientWidth, h = container.clientHeight, dpr = root.devicePixelRatio || 1;
        cv.width = w * dpr; cv.height = h * dpr; var g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
        keys.forEach(function (k, ix) {
          var pts = [], z = cy.zoom();
          ids[k].forEach(function (id) {
            var n = cy.getElementById(id); if (!n.length) return;
            var p = n.renderedPosition(), r = n.renderedWidth() / 2 + 34 * z;
            for (var a = 0; a < 12; a++) pts.push([p.x + r * Math.cos(a * Math.PI / 6), p.y + r * Math.sin(a * Math.PI / 6)]);
          });
          var hp = hull(pts); if (hp.length < 3) return;
          g.beginPath(); var n0 = hp.length;
          for (var i = 0; i < n0; i++) { var a1 = hp[i], b1 = hp[(i + 1) % n0], mx = (a1[0] + b1[0]) / 2, my = (a1[1] + b1[1]) / 2; if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(a1[0], a1[1], mx, my); }
          g.quadraticCurveTo(hp[0][0], hp[0][1], (hp[0][0] + hp[1][0]) / 2, (hp[0][1] + hp[1][1]) / 2); g.closePath();
          var t = TINTS[ix % TINTS.length]; g.fillStyle = 'rgba(' + t + ',.07)'; g.fill(); g.strokeStyle = 'rgba(' + t + ',.22)'; g.lineWidth = 1.2; g.stroke();
          var top = Infinity, sx = 0; hp.forEach(function (p) { top = Math.min(top, p[1]); sx += p[0]; }); sx /= hp.length;
          var txt = nameOf[k] + '  \u00b7  ' + ids[k].filter(function (id) { return cy.getElementById(id).length; }).length, fs = Math.round(Math.max(11, Math.min(15, 11 + z * 3)));
          g.font = '600 ' + fs + 'px "IBM Plex Sans", system-ui, sans-serif'; var tw = g.measureText(txt).width;
          g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath(); g.roundRect ? g.roundRect(sx - tw / 2 - 9, top - fs - 14, tw + 18, fs + 10, 11) : g.rect(sx - tw / 2 - 9, top - fs - 14, tw + 18, fs + 10); g.fill();
          g.strokeStyle = 'rgba(' + t + ',.45)'; g.lineWidth = 1; g.stroke(); g.fillStyle = 'rgb(' + t + ')'; g.textBaseline = 'middle'; g.fillText(txt, sx - tw / 2, top - fs / 2 - 9);
        });
      }
      function soon() { if (!pending) { pending = true; (root.requestAnimationFrame || setTimeout)(draw); } }
      cy.on('render viewport position layoutstop', soon); soon();
    },
    pushView: function () { var cy = this.cy; if (!cy) return; (this.hist = this.hist || []).push({ zoom: cy.zoom(), pan: { x: cy.pan().x, y: cy.pan().y } }); if (this.hist.length > 20) this.hist.shift(); },
    back: function () { var cy = this.cy, v = this.hist && this.hist.pop(); if (!cy || !v) return false; cy.animate({ zoom: v.zoom, pan: v.pan }, { duration: 300 }); return true; },
    flyTo: function (id) {
      var cy = this.cy; if (!cy) return; var n = cy.getElementById(id); if (!n.length) return;
      this.pushView(); cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 1.1) }, { duration: 350 }); this.focus(id); n.select();
    },
    hood: function (id) {
      var cy = this.cy; if (!cy) return; var n = cy.getElementById(id); if (!n.length) return;
      this.pushView(); cy.animate({ fit: { eles: n.closedNeighborhood(), padding: 70 } }, { duration: 350 });
    },
    find: function (q, max) {
      var cy = this.cy; if (!cy || !q) return [];
      var t = String(q).toLowerCase(); return cy.nodes().filter(function (n) { return !n.hasClass('note') && !n.hasClass('flag') && String(n.data('label')).toLowerCase().indexOf(t) !== -1; }).slice(0, max || 8).map(function (n) { return { id: n.id(), name: n.data('label'), type: n.data('type') }; });
    },
    zoomBy: function (f) { var cy = this.cy; if (!cy) return; cy.zoom({ level: Math.min(3, Math.max(0.08, cy.zoom() * f)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); },
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
