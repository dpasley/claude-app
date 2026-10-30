/* Chart screen: banks (saved views over the main files), filters, snapshots, path finder, details. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var st = { bankId: '', sel: null, path: null, results: [], whole: null, pa: '', pb: '', avoid: true, maxHops: 4, fitPath: false, graph: null };

  function D() { return A.data(); }
  function B() { return D().banks.filter(function (b) { return b.id === st.bankId; })[0]; }
  function entLabel(e) { return e.name + ' · ' + CI.TYPE_LABEL[e.type].toLowerCase() + ' · ' + e.id; }
  function parseEntity(text) {
    var m = String(text || '').match(/(E-\d{4,})\s*$/);
    if (m && A.idx().entity[m[1]]) return m[1];
    var c = CI.findCandidates(D(), text, 1)[0];
    return c ? c.entity.id : '';
  }
  function snapOf(bank, id) { return bank.snapshots.filter(function (s) { return s.id === id; })[0]; }

  CI.views.chart = function (id) {
    var d = D();
    var bank = id && d.banks.filter(function (b) { return b.id === id; })[0];
    if (!bank) { renderList(); return; }
    if (d.ui.bankId !== bank.id) { d.ui.bankId = bank.id; A.persist(); }
    st.bankId = bank.id; st.sel = null; st.path = null; st.results = []; st.whole = null;
    renderShell();
  };

  /* ---------- the list of all charts ---------- */
  var cl = { q: '', view: 'all' };
  function bankState(b) { return b.handedOver ? 'handed' : (b.outcome ? 'nosit' : 'open'); }
  function listRows() {
    var d = D(), q = CI.norm(cl.q), idx = A.idx();
    var rows = d.banks.slice().reverse().filter(function (b) {
      if (b.quick) return false;
      if (cl.view !== 'all' && bankState(b) !== cl.view) return false;
      var seeds = b.seeds.map(function (id) { return idx.entity[id] ? idx.entity[id].name : ''; }).join(' ');
      return !q || CI.norm([b.name, seeds, (b.opened && b.opened.reason) || ''].join(' ')).indexOf(q) !== -1;
    });
    if (!rows.length) return '<p class="muted pad">' + (d.banks.some(function (b) { return !b.quick; }) ? 'No special bank matches that.' : 'No special banks yet. Open one from Indexes (Heating up), or start one with “New special bank”.') + '</p>';
    return '<table class="fixed"><colgroup><col style="width:24%"><col style="width:25%"><col style="width:11%"><col style="width:7%"><col style="width:9%"><col style="width:24%"></colgroup>' +
      '<thead><tr><th>Special bank</th><th>Opened because</th><th>Opened</th><th class="num">Files</th><th class="num">Estimates</th><th></th></tr></thead><tbody>' + rows.map(function (b) {
        var why = (b.opened && b.opened.reason) || '';
        var tag = b.handedOver ? ' <span class="tag">handed over</span>' : (b.outcome ? ' <span class="tag">no situation</span>' : '');
        var nw = CI.bankNews(d, b), nn = nw.reports.length + nw.links.length; if (nn) tag += ' <span class="tag warn" title="New since you last looked: ' + nw.reports.length + ' reports, ' + nw.links.length + ' connections">' + nw.reports.length + ' new report' + (nw.reports.length === 1 ? '' : 's') + '</span>';
        return '<tr class="pick"><td class="ellip" title="' + esc(b.name) + '"><a href="#/bank/' + esc(b.id) + '"><b>' + esc(b.name) + '</b></a>' + tag + '</td>' +
          '<td class="ellip muted" title="' + esc(why) + '">' + esc(why) + '</td>' +
          '<td>' + (b.opened && b.opened.date ? esc(CI.fmtDate(b.opened.date)) : '') + '</td><td class="num">' + (b.files || []).length + '</td><td class="num">' + b.estimates.length + '</td>' +
          '<td class="right"><button class="btn small" data-action="cl-rename" data-id="' + esc(b.id) + '">Rename</button> <button class="btn small" data-action="cl-dup" data-id="' + esc(b.id) + '">Copy</button> <button class="btn small danger" data-action="cl-del" data-id="' + esc(b.id) + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function renderList() {
    A.view.className = '';
    var all = D().banks.filter(function (b) { return !b.quick; }), cnt = { all: all.length, open: 0, handed: 0, nosit: 0 };
    all.forEach(function (b) { cnt[bankState(b)]++; });
    A.view.innerHTML = A.pageHead('Special banks', 'Opened when staff spot a possible situation. Each holds the related files, a chart and estimates.',
      '<button class="btn primary" data-action="cv-bank-new">New special bank</button>',
      [['all', 'All'], ['open', 'Open'], ['handed', 'Handed over'], ['nosit', 'No situation']].map(function (t) { return { label: t[1], n: cnt[t[0]], on: cl.view === t[0], action: 'cl-view', v: t[0] }; })) +
      '<div class="card row wrap"><input type="search" id="cl-q" data-lookup="#cl-list" autocomplete="off" placeholder="Search by name or reason" value="' + esc(cl.q) + '" data-on-input="cl-q"></div>' +
      '<div class="card flush" id="cl-list">' + listRows() + '</div>';
  }
  H['cl-view'] = function (el) { cl.view = el.getAttribute('data-v') || 'all'; renderList(); };
  H['cl-q'] = function (el) { cl.q = el.value; var b = document.getElementById('cl-list'); if (b) b.innerHTML = listRows(); };
  function bankOf(el) { return D().banks.filter(function (b) { return b.id === el.getAttribute('data-id'); })[0]; }
  H['cl-rename'] = function (el) {
    var b = bankOf(el); if (!b) return;
    A.ask('New name?', b.name, function (n) { b.name = n; A.persist(); if (el.getAttribute('data-then') === 'bank') A.go('#/bank/' + b.id); else renderList(); }, { title: 'Rename special bank', ok: 'Rename' });
  };
  H['cl-dup'] = function (el) {
    var b = bankOf(el); if (!b) return;
    var c = CI.clone(b); c.id = CI.nextId(D(), 'bank'); c.name = b.name + ' (copy)'; c.snapshots = []; c.compareId = ''; c.viewMode = 'live'; c.quick = false; c.handedOver = ''; c.handedOverEstimate = '';
    D().banks.push(c); A.persist();
    if (el.getAttribute('data-then') === 'bank') A.go('#/bank/' + c.id); else renderList();
  };
  H['cl-del'] = function (el) {
    var b = bankOf(el); if (!b) return;
    if (CI.investigationFor(D(), b.id)) { A.toast('This special bank has been handed over and has an investigation, so it cannot be deleted.', true); return; }
    A.confirm('Delete the special bank “' + b.name + '”, with its chart and estimates? The reports and files are not affected.', function () {
      D().banks = D().banks.filter(function (x) { return x.id !== b.id; }); A.persist();
      if (el.getAttribute('data-then') === 'list') A.go('#/chart'); else renderList();
    }, { title: 'Delete special bank', yes: 'Delete', danger: true });
  };

  /* Labels default to automatic: on for small charts, off once there are more than 15 connections (they pile up). */
  function labelsOn(bank, graph) { return bank.edgeLabels === true ? true : bank.edgeLabels === false ? false : (graph.edges || []).length <= 15; }
  function currentGraph(bank) {
    if (bank.viewMode === 'frozen') {
      var s = snapOf(bank, bank.frozenId);
      if (s) return { graph: s.graph, frozen: s };
    }
    return { graph: CI.computeGraph(D(), bank, A.idx()), frozen: null };
  }

  /* ---------- shell and controls ---------- */
  function renderShell() {
    var bank = B(), d = D();
    var ents = d.entities.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var frozen = bank.viewMode === 'frozen' && snapOf(bank, bank.frozenId);
    var h = '<datalist id="ent-dl">' + ents.map(function (e) { return '<option value="' + esc(entLabel(e)) + '">'; }).join('') + '</datalist>';
    if (bank.quick) h += '<div class="chart-head"><a href="#/chart" class="back">‹ Special banks</a><h1>Quick look</h1><span class="spacer"></span><button class="btn small primary" data-action="cv-save-preview">Open a special bank from this</button></div><p class="bank-why">A quick look is not saved. The next one replaces it.</p>';
    else h += CI.views.bankHead(bank, 'chart');
    if (!bank.quick) {
      CI.ensureCharts(bank);
      h += '<div class="chartbar"><label>Chart <select data-on-change="cv-chart-pick" aria-label="Chart">' + bank.charts.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === bank.chartId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn small" data-action="cv-chart-new">New chart</button><button class="btn small" data-action="cv-chart-copy">Copy this chart</button><button class="btn small" data-action="cv-chart-rename">Rename</button>' +
        (bank.charts.length > 1 ? '<button class="btn small danger" data-action="cv-chart-del">Delete</button>' : '') +
        '<span class="muted small">Each chart keeps its own filters, arrangement and snapshots.</span></div>';
    }
    h += '<div class="chart-layout nodetail" id="cl"><aside class="panel" id="ctl">' + controlsHtml(bank, !!frozen) + '</aside>' +
      '<section class="stage"><div class="toolbar"><span id="summary" class="muted small"></span><span class="spacer"></span>' + CI.views.chartFind() +
      '<button class="btn small" data-action="cv-zoom" data-f="0.8" title="Zoom out" aria-label="Zoom out">\u2212</button><button class="btn small" data-action="cv-zoom" data-f="1.25" title="Zoom in" aria-label="Zoom in">+</button><button class="btn small" data-action="cv-fit">Fit</button><button class="btn small" data-action="cv-relayout">Auto-arrange</button><button class="btn small" data-action="cv-png">Image</button><button class="btn small" data-action="cv-print">Print for the wall…</button>' +
      '</div>' +
      (frozen ? '<div class="banner">Frozen snapshot “' + esc(frozen.label) + '”, taken ' + esc(CI.fmtDateTime(frozen.at)) + '. Filters do not apply. Switch to Live to keep working.</div>' : '') +
      '<div id="cmpnote" class="cmpnote" hidden></div><div id="cy"></div></section><aside class="panel" id="detail"></aside></div>';
    A.view.innerHTML = h;
    A.view.className = 'wide';
    draw();
  }

  CI.views.chartFind = function () {
    return '<span class="cfind"><input type="search" id="cf-q" data-lookup="#cf-res" data-on-input="chart-find" placeholder="Find on chart" autocomplete="off" aria-label="Find a name on the chart"><span id="cf-res"></span></span><button class="btn small" data-action="chart-back" title="Back to the previous view (B)">\u21b6 Back</button>';
  };
  function chk(name, checked, label, extra) {
    return '<label class="chk"><input type="checkbox" ' + extra + (checked ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }

  function groupsHtml(bank, frozen) {
    var g = currentGraph(bank).graph, info = CI.groupInfo(g, bank.groupNames), col = bank.collapsed || {};
    var h = '<div' + (frozen ? ' class="off"' : '') + '><h3>Groups</h3>' + chk('gr', bank.groups !== false, 'Shade the groups', 'data-on-change="cv-groups"');
    if (!info.length) return h + '<p class="muted small">Groups appear when names are closely connected.</p></div>';
    h += '<p class="muted small" style="margin:2px 0 6px">Closely connected names are grouped for you. Fold a group into one node to read a big chart.</p><div class="grp-list">' + info.map(function (x, i) {
      return '<div class="grp-row"><i class="sw" style="background:rgba(' + CI.GROUP_TINTS[i % CI.GROUP_TINTS.length] + ',.55)"></i><button class="linkbtn" data-action="cv-grp-zoom" data-id="' + esc(x.id) + '" title="Zoom to this group">' + esc(x.name) + '</button><span class="muted small">' + x.size + '</span>' +
        '<button class="btn small" data-action="cv-grp-fold" data-id="' + esc(x.id) + '">' + (col[x.id] ? 'Open' : 'Fold') + '</button><button class="btn small" data-action="cv-grp-name" data-id="' + esc(x.id) + '" data-name="' + esc(x.name) + '">Rename</button></div>';
    }).join('') + '</div><div class="row tight-row"><button class="btn small" data-action="cv-grp-all" data-v="1">Fold all</button><button class="btn small" data-action="cv-grp-all" data-v="0">Open all</button><button class="btn small" data-action="cv-grp-arrange">Arrange by group</button></div></div>';
    return h;
  }
  function controlsHtml(bank, frozen) {
    var h = bank.quick ? '' : '<h3>Files</h3><p class="small" style="margin:0 0 4px">' + (bank.files || []).length + ' file' + ((bank.files || []).length === 1 ? '' : 's') + ' in this special bank. <a href="#/bank/' + esc(bank.id) + '">Add or remove</a></p>';
    h += '<div' + (frozen ? ' class="off"' : '') + '><h3>Show</h3>' +
      (bank.quick ? '<label>How far out from those names<select data-on-change="cv-hops"' + (frozen ? ' disabled' : '') + '>' + [0, 1, 2, 3].map(function (n) { return '<option value="' + n + '"' + (bank.hops === n ? ' selected' : '') + '>' + (n === 0 ? 'Only those names' : n + (n === 1 ? ' step' : ' steps')) + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="checks">' + CI.ENTITY_TYPES.map(function (t) {
        return chk('et', !bank.entityTypes || bank.entityTypes.indexOf(t) !== -1, CI.TYPE_LABEL[t] + 's', 'data-on-change="cv-etypes" data-id="' + t + '"' + (frozen ? ' disabled' : ''));
      }).join('') + '</div>' +
      '<div class="grid2 tight-grid"><label>From ' + A.dateInput('cv-from', bank.dateFrom, 'cv-date', ' data-k="dateFrom"') + '</label><label>To ' + A.dateInput('cv-to', bank.dateTo, 'cv-date', ' data-k="dateTo"') + '</label></div>' +
      chk('m', bank.showMentions, 'Show “mentioned together” (dashed)', 'data-on-change="cv-mentions"') +
      chk('l', labelsOn(bank, currentGraph(bank).graph), 'Label the connections' + (bank.edgeLabels === true || bank.edgeLabels === false ? '' : ' (automatic)'), 'data-on-change="cv-labels"') + '</div>';
    h += '<div' + (frozen ? ' class="off"' : '') + '><h3>Look</h3>' +
      chk('sz', bank.sizeByLinks !== false, 'Bigger names for more connections', 'data-on-change="cv-size"') +
      chk('zl', bank.zoomLabels !== false, 'Labels follow the zoom', 'data-on-change="cv-zoomlabels"') +
      '<label>Arrangement<select data-on-change="cv-layout" aria-label="Arrangement">' + A.options([{ value: 'cose', label: 'Organic' }, { value: 'groups', label: 'Grouped' }, { value: 'concentric', label: 'Rings by connections' }, { value: 'breadthfirst', label: 'Tree from the start names' }, { value: 'circle', label: 'Circle' }], bank.layout || 'cose') + '</select></label></div>';
    h += groupsHtml(bank, frozen);
    if (bank.excluded.length) {
      h += '<h3>Hidden</h3><div class="chips">' + bank.excluded.map(function (id) {
        var e = A.idx().entity[id];
        return '<span class="chip">' + esc(e ? e.name : id) + '<button data-action="cv-unhide" data-id="' + esc(id) + '" aria-label="Show again">↺</button></span>';
      }).join('') + '</div>';
    }
    var nsn = bank.snapshots.length, live2 = bank.viewMode !== 'frozen' || !snapOf(bank, bank.frozenId);
    h += '<details class="snap" id="snap-panel"' + ((st.snapOpen || !live2) ? ' open' : '') + '><summary>Snapshots' + (nsn ? ' <span class="muted">' + nsn + '</span>' : '') + '</summary>';
    if (nsn) {
      var live = live2;
      h += '<label class="chk"><input type="radio" name="vm" data-on-change="cv-view" value="live"' + (live ? ' checked' : '') + '> Live</label>' +
        '<label class="chk"><input type="radio" name="vm" data-on-change="cv-view" value="frozen"' + (!live ? ' checked' : '') + '> Frozen:</label>' +
        '<select data-on-change="cv-snap-pick">' + bank.snapshots.map(function (sn) { return '<option value="' + esc(sn.id) + '"' + (sn.id === bank.frozenId ? ' selected' : '') + '>' + esc(sn.label) + '</option>'; }).join('') + '</select>';
      if (live) h += '<label>Highlight what is new since<select data-on-change="cv-compare">' + A.options(bank.snapshots.map(function (sn) { return { value: sn.id, label: sn.label }; }), bank.compareId, 'Nothing') + '</select></label>';
      h += '<div class="row wrap tight-row"><button class="btn small danger" data-action="cv-snap-del">Delete selected snapshot</button></div>';
    } else h += '<p class="muted small">Freeze the chart when it is handed over; later findings then show as changes.</p>';
    if (!frozen) h += '<div class="row"><button class="btn small" data-action="cv-freeze">Freeze a snapshot now</button></div>';
    h += '</details>';
    return h;
  }

  function legendHtml() { return CI.views.chartLegend(); }
  CI.views.chartLegend = function () {
    var T = [['individual', 'Individual'], ['group', 'Group'], ['area', 'Area'], ['subject', 'Subject']];
    return '<div class="legend lg2">' + T.map(function (t) { return '<span class="lg-i"><i class="sw sw-' + t[0] + '" style="--c:' + CI.TYPE_COLOR[t[0]] + '"></i>' + t[1] + '</span>'; }).join('') +
      '<span class="lg-sep"></span><span><i class="ln thin"></i><i class="ln thick"></i> thicker line = more independent reports</span><span>arrow = direction</span><span>big name = many connections</span><span>shaded area = closely connected names</span><span>hover a name to follow its connections</span></div>';
  };

  document.addEventListener('toggle', function (ev) { if (ev.target && ev.target.id === 'snap-panel') st.snapOpen = ev.target.open; }, true);

  /* ---------- drawing ---------- */
  function draw() {
    var bank = B(), d = D();
    var cur = currentGraph(bank), graph = cur.graph;
    st.graph = graph;
    var diff = null;
    if (!cur.frozen && bank.compareId) { var sn = snapOf(bank, bank.compareId); if (sn) diff = CI.diffGraphs(graph, sn.graph); }
    st.diff = diff;
    var hl = { nodes: {}, edges: {} }, extraNodes = [], extraEdges = [];
    if (st.path) {
      var inN = {}; graph.nodes.forEach(function (n) { inN[n.id] = true; });
      st.path.steps.forEach(function (s) {
        hl.edges[s.edge.id] = 1; hl.nodes[s.from] = 1; hl.nodes[s.to] = 1;
        extraEdges.push(s.edge);
        [s.from, s.to].forEach(function (id) {
          if (inN[id]) return;
          inN[id] = true;
          var wn = st.whole && st.whole.nodes.filter(function (n) { return n.id === id; })[0];
          if (wn) extraNodes.push(wn);
        });
      });
    }
    var posMap;
    if (cur.frozen) { if (!cur.frozen.positions) { cur.frozen.positions = CI.clone(bank.positions || {}); A.persist(); } posMap = cur.frozen.positions; } else posMap = bank.positions;
    var force = !!st.forceLayout, forceFit = !!st.forceFit; st.forceLayout = false; st.forceFit = false;
    CI.chart.render(document.getElementById('cy'), graph, {
      layout: bank.layout, positions: posMap, forceLayout: force, forceFit: forceFit, viewKey: bank.id + '|' + bank.chartId + '|' + (cur.frozen ? cur.frozen.id : 'live'),
      onLaidOut: function (all) { Object.keys(all).forEach(function (k) { posMap[k] = all[k]; }); A.persist(); }, photoOf: function (id) { var e = A.idx().entity[id]; return e && e.photo ? e.photo : ''; },
      onMoved: function (id, p) { posMap[id] = p; A.persist(); },
      sizeByLinks: bank.sizeByLinks !== false, zoomLabels: bank.zoomLabels !== false, hulls: bank.groups !== false, collapsed: cur.frozen ? null : (bank.collapsed || {}), groupNames: bank.groupNames || {},
      onGroup: function (gid) { mutate(function (b) { b.collapsed = b.collapsed || {}; delete b.collapsed[gid]; }, true); },
      edgeLabels: labelsOn(bank, graph), diff: diff, hl: hl, extraNodes: extraNodes, extraEdges: extraEdges, highlightFit: st.fitPath,
      onNode: function (id) { st.sel = { kind: 'node', id: id }; renderDetail(); },
      onEdge: function (id) { st.sel = { kind: 'edge', id: id }; renderDetail(); },
      onBackground: function () { st.sel = null; renderDetail(); }
    });
    st.fitPath = false;
    var cn = document.getElementById('cmpnote');
    if (cn) {
      if (diff) {
        var cnt = Object.keys(diff.newNodes).length + Object.keys(diff.newEdges).length + Object.keys(diff.grownEdges).length, lbl = esc(snapOf(bank, bank.compareId).label);
        cn.innerHTML = cnt ? '<span class="sw"></span> Orange = new or stronger since “' + lbl + '”. The list on the right shows each change.' : 'Nothing new since “' + lbl + '”.';
        cn.hidden = false;
      } else cn.hidden = true;
    }
    var s = document.getElementById('summary');
    if (s) {
      var txt = graph.nodes.length + ' entities · ' + graph.edges.length + ' connections';
      if (graph.trimmed) txt += ' · ' + graph.trimmed + ' lighter name' + (graph.trimmed === 1 ? '' : 's') + ' not shown';
      if (graph.hiddenWeak && !cur.frozen) txt += ' · ' + graph.hiddenWeak + ' hidden below the minimum of ' + bank.minWeight;
      if (diff) txt += ' · since “' + esc(snapOf(bank, bank.compareId).label) + '”: ' + Object.keys(diff.newNodes).length + ' new entities, ' + Object.keys(diff.newEdges).length + ' new connections, ' + Object.keys(diff.grownEdges).length + ' strengthened';
      if (!bank.quick && Array.isArray(bank.files) && !cur.frozen) {
        var out = CI.suggestFiles(A.data(), bank, A.idx(), 999).length;
        if (out) txt += ' · <a href="#/bank/' + esc(bank.id) + '" title="Connected to files in this bank but not in it. Open the Files tab to add them.">' + out + ' connected file' + (out === 1 ? ' is' : 's are') + ' outside this bank</a>';
      }
      s.innerHTML = txt;
    }
    renderDetail();
  }

  /* ---------- detail panel ---------- */
  function edgeById(id) {
    var e = st.graph.edges.filter(function (x) { return x.id === id; })[0];
    if (e) return e;
    if (st.path) { var s = st.path.steps.filter(function (x) { return x.edge.id === id; })[0]; if (s) return s.edge; }
    return null;
  }
  function nodeName(id) {
    var e = A.idx().entity[id];
    if (e) return e.name;
    var n = st.graph.nodes.filter(function (x) { return x.id === id; })[0];
    return n ? n.name : id;
  }
  function edgePhrase(e) {
    if (e.kind === 'mention') return esc(nodeName(e.source)) + ' <span class="rel">↔ mentioned together ↔</span> ' + esc(nodeName(e.target));
    return esc(nodeName(e.source)) + ' <span class="rel">' + (e.directed ? '— ' + esc(e.label) + ' →' : '↔ ' + esc(e.label) + ' ↔') + '</span> ' + esc(nodeName(e.target));
  }

  function renderDetail() {
    var box = document.getElementById('detail');
    if (!box) return;
    var bank = B(), d = D(), idx = A.idx(), h = '';
    var frozen = bank.viewMode === 'frozen' && snapOf(bank, bank.frozenId);
    if (st.sel && st.sel.kind === 'node') {
      var id = st.sel.id, gn = st.graph.nodes.filter(function (n) { return n.id === id; })[0] || (st.whole && st.whole.nodes.filter(function (n) { return n.id === id; })[0]);
      var inc = st.graph.edges.filter(function (e) { return e.source === id || e.target === id; });
      h += '<h3>' + esc(nodeName(id)) + '</h3><p>' + (gn ? A.tag(gn.type) : '') + (gn && gn.hub ? ' <span class="tag warn">high-connection node</span>' : '') + '</p>';
      if (inc.length) {
        h += '<ul class="plain">' + inc.map(function (e) {
          var other = e.source === id ? e.target : e.source;
          var dirTxt = e.kind === 'mention' ? 'mentioned together with' : (e.directed ? (e.source === id ? e.label + ' →' : '← ' + e.label) : e.label + ' ↔');
          return '<li><a href="#" data-action="cv-pick-edge" data-id="' + esc(e.id) + '">' + esc(dirTxt) + ' ' + esc(nodeName(other)) + '</a> <span class="muted">×' + e.weight + '</span></li>';
        }).join('') + '</ul>';
      } else h += '<p class="muted small">No connections in this view.</p>';
      h += '<div class="stack"><a class="btn small" href="#/entity/' + esc(id) + '">Open file</a>';
      if (!frozen) {
        h += '<button class="btn small" data-action="cv-node-hide" data-id="' + esc(id) + '">Hide in this bank</button>';
      }
      h += (CI.investigationFor(d, bank.id) ? '<button class="btn small" data-action="cv-pin-case" data-id="' + esc(id) + '">Pin to the case chart</button>' : '') + '</div>';
    } else if (st.sel && st.sel.kind === 'edge') {
      var e = edgeById(st.sel.id);
      if (e) {
        h += '<h3>Connection</h3><p>' + edgePhrase(e) + '</p><p class="muted small">' + e.weight + ' independent report' + (e.weight === 1 ? '' : 's') + (e.kind === 'mention' ? ' name both without stating a connection.' : ' assert this. Reposts count once with the original.') + '</p>';
        if (e.kind === 'mention') {
          h += '<ul class="plain">' + e.reportIds.map(function (rid) { return '<li>' + A.repLink(rid) + ' <span class="muted">' + esc(A.trunc((idx.report[rid] || {}).summary || '', 90)) + '</span></li>'; }).join('') + '</ul>';
        } else {
          var links = d.links.filter(function (l) { return e.linkIds.indexOf(l.id) !== -1; });
          if (links.length) {
            h += '<ul class="plain">' + links.map(function (l) {
              var r = idx.report[l.reportId] || {};
              return '<li>' + A.repLink(l.reportId) + (r.dupOf ? ' <span class="tag">repost of ' + esc(r.dupOf) + '</span>' : '') + ' <span class="muted">' + esc(r.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(r))) + '</span>' +
                (l.note ? '<div class="small">“' + esc(l.note) + '”</div>' : '') + '<div class="muted small">' + esc(A.trunc(r.summary || '', 120)) + '</div></li>';
            }).join('') + '</ul>';
          } else h += '<ul class="plain">' + e.reportIds.map(function (rid) { return '<li>' + A.repLink(rid) + '</li>'; }).join('') + '</ul>';
        }
        h += '<div class="stack">' + (CI.investigationFor(d, bank.id) ? '<button class="btn small" data-action="cv-string-case" data-id="' + esc(e.id) + '">Add to the case chart</button>' : '') + '</div>';
      }
    } else {
    }

    if (st.diff) {
      var nn = Object.keys(st.diff.newNodes), ne = Object.keys(st.diff.newEdges), ge = Object.keys(st.diff.grownEdges);
      if (nn.length || ne.length || ge.length) {
        h += '<h3 class="sep">Changed since the snapshot</h3><ul class="plain">' +
          nn.map(function (id) { return '<li>New: ' + A.entLink(id) + '</li>'; }).join('') +
          ne.map(function (id) { var e2 = edgeById(id); return e2 ? '<li>New: <a href="#" data-action="cv-pick-edge" data-id="' + esc(id) + '">' + edgePhrase(e2) + '</a></li>' : ''; }).join('') +
          ge.map(function (id) { var e3 = edgeById(id); return e3 ? '<li>Stronger (+' + st.diff.grownEdges[id] + '): <a href="#" data-action="cv-pick-edge" data-id="' + esc(id) + '">' + edgePhrase(e3) + '</a></li>' : ''; }).join('') + '</ul>';
      }
    }
    box.innerHTML = h;
    var lay = document.getElementById('cl'); if (lay) lay.classList.toggle('nodetail', !h);
  }

  function pathResultsHtml() {
    if (st.results === null) return '';
    if (!st.results.length) return st.searched ? '<p class="muted small">No connection found within that many steps' + (st.avoid ? ' (high-connection nodes were skipped)' : '') + ' using this bank’s filters.</p>' : '';
    return '<ol class="paths">' + st.results.map(function (p, i) {
      var names = [nodeNameWhole(p.steps[0].from)].concat(p.steps.map(function (s) { return nodeNameWhole(s.to); }));
      return '<li' + (st.path === p ? ' class="on"' : '') + '><a href="#" data-action="cv-path-pick" data-i="' + i + '">' + esc(names.join(' → ')) + '</a><div class="muted small">' + p.hops + ' step' + (p.hops === 1 ? '' : 's') + ' · weakest link ' + p.minWeight + ' report' + (p.minWeight === 1 ? '' : 's') + '</div></li>';
    }).join('') + '</ol>';
  }
  function nodeNameWhole(id) {
    var n = st.whole && st.whole.nodes.filter(function (x) { return x.id === id; })[0];
    return n ? n.name : nodeName(id);
  }

  /* ---------- bank mutations ---------- */
  function mutate(fn, structural) {
    var b = B(); fn(b); A.persist();
    if (structural) { var c = document.getElementById('ctl'); renderShell(); } else draw();
  }
  function recompute() { document.getElementById('ctl').innerHTML = controlsHtml(B(), B().viewMode === 'frozen' && !!snapOf(B(), B().frozenId)); }

  H['cv-bank-pick'] = function (el) { A.go('#/chart/' + el.value); };
  H['cv-bank-new'] = function () { CI.views.newBank(); };
  H['cv-save-preview'] = function () { CI.views.openBank(B().seeds, '', ''); };
  H['cv-seed-add'] = function (el) {
    var id = parseEntity(el.value); if (!id) { A.toast('No entity matches that.', true); return; }
    mutate(function (b) { if (b.seeds.indexOf(id) === -1) b.seeds.push(id); b.excluded = b.excluded.filter(function (x) { return x !== id; }); }, true);
  };
  H['cv-seed-del'] = function (el) { mutate(function (b) { b.seeds = b.seeds.filter(function (x) { return x !== el.getAttribute('data-id'); }); }, true); };
  H['cv-hops'] = function (el) { mutate(function (b) { b.hops = Number(el.value); }); };
  H['cv-topn'] = function (el) { mutate(function (b) { b.topN = Math.max(0, Math.floor(Number(el.value) || 0)); }); };
  H['cv-minw'] = function (el) { mutate(function (b) { b.minWeight = Math.max(1, Number(el.value) || 1); }); };
  function checkedIds(sel) {
    var out = []; document.querySelectorAll(sel).forEach(function (c) { if (c.checked) out.push(c.getAttribute('data-id')); });
    return out;
  }
  H['cv-types'] = function () {
    var all = D().settings.linkTypes.length, on = checkedIds('[data-on-change="cv-types"]');
    mutate(function (b) { b.linkTypes = (on.length === all || !on.length) ? null : on; }); recompute();
  };
  H['cv-etypes'] = function () {
    var on = checkedIds('[data-on-change="cv-etypes"]');
    mutate(function (b) { b.entityTypes = (on.length === CI.ENTITY_TYPES.length || !on.length) ? null : on; }); recompute();
  };
  H['cv-date'] = function (el) {
    var v = CI.parseDate(el.value);
    if (v === null) { A.toast(A.dateHelp, true); return; }
    mutate(function (b) { b[el.getAttribute('data-k')] = v; });
  };
  H['cv-mentions'] = function (el) { mutate(function (b) { b.showMentions = el.checked; }); };
  H['cv-hubstop'] = function (el) { mutate(function (b) { b.hubStop = el.checked; }); };
  H['cv-labels'] = function (el) { mutate(function (b) { b.edgeLabels = el.checked; }); };
  H['cv-layout'] = function (el) { st.forceLayout = true; st.forceFit = true; mutate(function (b) { b.layout = el.value; }); };
  H['cv-size'] = function (el) { mutate(function (b) { b.sizeByLinks = el.checked; }); };
  H['cv-zoomlabels'] = function (el) { mutate(function (b) { b.zoomLabels = el.checked; }); };
  H['cv-groups'] = function (el) { mutate(function (b) { b.groups = el.checked; }); };
  H['cv-grp-fold'] = function (el) { var id = el.getAttribute('data-id'); st.forceFit = true; mutate(function (b) { b.collapsed = b.collapsed || {}; if (b.collapsed[id]) delete b.collapsed[id]; else b.collapsed[id] = true; }, true); };
  H['cv-grp-all'] = function (el) {
    var on = el.getAttribute('data-v') === '1'; st.forceFit = true;
    mutate(function (b) { b.collapsed = {}; if (on) CI.groupInfo(currentGraph(b).graph, b.groupNames).forEach(function (g) { b.collapsed[g.id] = true; }); }, true);
  };
  H['cv-grp-zoom'] = function (el) {
    var g = CI.groupInfo(currentGraph(B()).graph, B().groupNames).filter(function (x) { return x.id === el.getAttribute('data-id'); })[0], cy = CI.chart.cy; if (!g || !cy) return;
    var els = cy.collection(); g.members.forEach(function (id) { els = els.union(cy.getElementById(id)); });
    if (!els.length) els = cy.getElementById('grp:' + g.id);
    if (els.length) { CI.chart.pushView(); cy.animate({ fit: { eles: els, padding: 70 } }, { duration: 350 }); }
  };
  H['cv-grp-name'] = function (el) {
    var id = el.getAttribute('data-id');
    A.ask('Name this group', el.getAttribute('data-name'), function (n) { mutate(function (b) { b.groupNames = b.groupNames || {}; if (n.trim()) b.groupNames[id] = n.trim(); else delete b.groupNames[id]; }, true); }, { title: 'Rename group', ok: 'Rename' });
  };
  H['cv-grp-arrange'] = function () { st.forceLayout = true; st.forceFit = true; mutate(function (b) { b.layout = 'groups'; }, true); };
  H['chart-find'] = function (el) {
    var box = document.getElementById('cf-res'); if (!box) return;
    var r = CI.chart.find(el.value, 8);
    box.innerHTML = el.value.trim() ? (r.length ? r.map(function (x) { return '<div class="cand pick"><button class="btn small" data-action="chart-jump" data-id="' + esc(x.id) + '"><b>' + esc(x.name) + '</b> ' + A.tag(x.type === 'cluster' ? 'group' : x.type) + '</button></div>'; }).join('') : '<p class="muted small" style="margin:6px">Not on this chart.</p>') : '';
  };
  H['chart-jump'] = function (el) { var q = document.getElementById('cf-q'); if (q) q.value = ''; var b = document.getElementById('cf-res'); if (b) b.innerHTML = ''; CI.chart.flyTo(el.getAttribute('data-id')); };
  H['chart-back'] = function () { CI.chart.back(); };
  H['cv-unhide'] = function (el) { mutate(function (b) { b.excluded = b.excluded.filter(function (x) { return x !== el.getAttribute('data-id'); }); }, true); };
  H['cv-node-seed'] = function (el) {
    var id = el.getAttribute('data-id');
    mutate(function (b) { if (b.seeds.indexOf(id) === -1) b.seeds.push(id); }, true); st.sel = { kind: 'node', id: id }; renderDetail();
  };
  H['cv-node-hide'] = function (el) {
    var id = el.getAttribute('data-id');
    mutate(function (b) { if (b.excluded.indexOf(id) === -1) b.excluded.push(id); b.seeds = b.seeds.filter(function (x) { return x !== id; }); }, true); st.sel = null; renderDetail();
  };

  /* several charts per special bank */
  function chartReset() { st.sel = null; st.path = null; st.results = []; st.whole = null; }
  H['cv-chart-pick'] = function (el) { var b = B(); if (CI.switchChart(b, el.value)) { A.persist(); chartReset(); renderShell(); } };
  H['cv-chart-new'] = function () {
    A.ask('Name of the new chart?', '', function (n) { var b = B(); CI.addChart(b, n, false); A.persist(); chartReset(); A.toast('New chart. It starts with all the bank\u2019s files.'); renderShell(); }, { title: 'New chart', ok: 'Create' });
  };
  H['cv-chart-copy'] = function () {
    var b = B(), c0 = CI.activeChart(b);
    A.ask('Name of the copy?', c0.name + ' (copy)', function (n) { CI.addChart(B(), n, true); A.persist(); chartReset(); renderShell(); }, { title: 'Copy this chart', ok: 'Copy' });
  };
  H['cv-chart-rename'] = function () {
    var b = B(), c0 = CI.activeChart(b);
    A.ask('New name?', c0.name, function (n) { if (n.trim()) c0.name = n.trim(); A.persist(); renderShell(); }, { title: 'Rename chart', ok: 'Rename' });
  };
  H['cv-chart-del'] = function () {
    var b = B(), c0 = CI.activeChart(b);
    A.confirm('Delete the chart “' + c0.name + '”? Its arrangement and snapshots go with it. The special bank, its files and estimates are untouched.', function () {
      var msg = CI.deleteChart(B(), c0.id); if (msg) { A.toast(msg, true); return; } A.persist(); chartReset(); renderShell();
    }, { title: 'Delete chart', yes: 'Delete', danger: true });
  };

  /* snapshots */
  H['cv-freeze'] = function () {
    A.ask('Label for this snapshot?', 'Handoff ' + CI.fmtDate(CI.today()), function (label) {
      var b = B(), live = CI.computeGraph(D(), b, A.idx());
      var sn = { id: CI.nextId(D(), 'snapshot'), label: label, at: new Date().toISOString(), graph: CI.clone(live), positions: CI.clone(b.positions || {}) };
      b.snapshots.push(sn); b.compareId = sn.id; A.persist(); A.toast('Snapshot saved. The live view now highlights what is new since it.'); renderShell();
    }, { title: 'Freeze a snapshot', ok: 'Freeze' });
  };
  H['cv-view'] = function (el) {
    mutate(function (b) {
      if (el.value === 'frozen') { b.viewMode = 'frozen'; if (!snapOf(b, b.frozenId)) b.frozenId = b.snapshots[b.snapshots.length - 1].id; }
      else b.viewMode = 'live';
    }, true);
  };
  H['cv-snap-pick'] = function (el) { mutate(function (b) { b.frozenId = el.value; b.viewMode = 'frozen'; }, true); };
  H['cv-compare'] = function (el) { mutate(function (b) { b.compareId = el.value; }); };
  H['cv-snap-del'] = function () {
    var b = B(), id = b.frozenId || (b.snapshots.length && b.snapshots[b.snapshots.length - 1].id), sn = snapOf(b, id);
    if (!sn) return;
    A.confirm('Delete the snapshot “' + sn.label + '”?', function () {
      mutate(function (bb) { bb.snapshots = bb.snapshots.filter(function (x) { return x.id !== id; }); if (bb.compareId === id) bb.compareId = ''; bb.frozenId = ''; bb.viewMode = 'live'; }, true);
    }, { title: 'Delete snapshot', yes: 'Delete', danger: true });
  };

  /* toolbar */
  H['cv-fit'] = function () { CI.chart.fit(); };
  H['cv-zoom'] = function (el) { CI.chart.zoomBy(Number(el.getAttribute('data-f')) || 1); };
  H['cv-relayout'] = function () { st.forceLayout = true; st.forceFit = true; draw(); };
  H['cv-png'] = function () {
    var uri = CI.chart.png(); if (!uri) return;
    A.modal('<h2>Chart image</h2><p class="muted small">Right-click (or press and hold) the image to save or copy it.</p><img alt="Connections chart" src="' + uri + '"><div class="row end"><button class="btn" data-action="modal-close">Close</button></div>', true);
  };

  /* details + path finder */
  H['cv-pick-edge'] = function (el) { st.sel = { kind: 'edge', id: el.getAttribute('data-id') }; renderDetail(); };
  H['cv-path-from'] = function (el) {
    var e = A.idx().entity[el.getAttribute('data-id')]; st.pa = e ? entLabel(e) : ''; renderDetail();
    var b = document.getElementById('pf-b'); if (b) b.focus();
  };
  H['cv-find'] = function () {
    st.pa = document.getElementById('pf-a').value; st.pb = document.getElementById('pf-b').value;
    st.maxHops = Number(document.getElementById('pf-max').value); st.avoid = document.getElementById('pf-avoid').checked;
    var a = parseEntity(st.pa), b = parseEntity(st.pb);
    if (!a || !b) { A.toast('Choose two entities from the lists.', true); return; }
    if (a === b) { A.toast('Choose two different entities.', true); return; }
    var bank = B(), cur = currentGraph(bank);
    st.whole = cur.frozen ? cur.graph : CI.computeGraph(D(), Object.assign({}, bank, { seeds: [], hubStop: false }), A.idx());
    st.results = CI.findPaths(st.whole, a, b, { maxHops: st.maxHops, limit: 6, avoidHubs: st.avoid });
    st.searched = true; st.path = st.results[0] || null; st.fitPath = !!st.path; st.sel = null;
    draw();
  };
  H['cv-path-pick'] = function (el) { st.path = st.results[Number(el.getAttribute('data-i'))]; st.fitPath = true; draw(); };
  H['cv-path-clear'] = function () { st.path = null; st.results = []; st.searched = false; draw(); };

  /* the case chart is the investigators' board */
  H['cv-pin-case'] = function (el) {
    var id = el.getAttribute('data-id'), r = CI.views.pinToCase(B().id, [id]);
    if (r.error) { A.toast(r.error, true); return; }
    A.toast(r.added ? nodeName(id) + ' pinned to the case chart.' : nodeName(id) + ' is already on the case chart.');
  };
  H['cv-string-case'] = function (el) {
    var e = edgeById(el.getAttribute('data-id')); if (!e) return;
    var r = CI.views.stringToCase(B().id, e);
    if (r.error) { A.toast(r.error, true); return; }
    A.toast('Added to the case chart.');
  };

  /* print for the wall */
  var pr = { paper: 'tabloid', orientation: 'landscape', cols: 2, rows: 2, quality: 'standard' };
  function printPlan() {
    var bb = CI.chart.bounds(); if (!bb) return null;
    var paper = CI.PAPERS[pr.paper], land = pr.orientation !== 'portrait';
    var pw = land ? Math.max(paper.w, paper.h) : Math.min(paper.w, paper.h), ph = land ? Math.min(paper.w, paper.h) : Math.max(paper.w, paper.h);
    var plan = CI.planTiles({ gw: bb.w, gh: bb.h, cols: pr.cols, rows: pr.rows, pageW: pw, pageH: ph, margin: 0.35 });
    return { plan: plan, dpi: CI.pickDpi(plan.PW, plan.PH, CI.QUALITY[pr.quality]) };
  }
  function printHtml() {
    var p = printPlan(), n = pr.cols * pr.rows;
    return '<h2>Print for the wall</h2><div class="form"><div class="grid2"><label>Paper<select id="pr-paper" data-on-change="cv-pr">' + A.options(Object.keys(CI.PAPERS).map(function (k) { return { value: k, label: CI.PAPERS[k].label }; }), pr.paper) + '</select></label>' +
      '<label>Pages face<select id="pr-or" data-on-change="cv-pr">' + A.options([{ value: 'landscape', label: 'Landscape (wide)' }, { value: 'portrait', label: 'Portrait (tall)' }], pr.orientation) + '</select></label></div>' +
      '<div class="grid2"><label>Pages across<select id="pr-cols" data-on-change="cv-pr">' + A.options([1, 2, 3, 4].map(function (n2) { return { value: String(n2), label: String(n2) }; }), String(pr.cols)) + '</select></label>' +
      '<label>Pages down<select id="pr-rows" data-on-change="cv-pr">' + A.options([1, 2, 3, 4].map(function (n2) { return { value: String(n2), label: String(n2) }; }), String(pr.rows)) + '</select></label></div>' +
      '<label>Quality<select id="pr-q" data-on-change="cv-pr">' + A.options([{ value: 'draft', label: 'Draft (small file)' }, { value: 'standard', label: 'Standard' }, { value: 'fine', label: 'Fine (large file)' }], pr.quality) + '</select></label></div>' +
      '<p class="small">' + (p ? n + ' page' + (n === 1 ? '' : 's') + '. Joined together, about <b>' + p.plan.PW.toFixed(1) + ' × ' + p.plan.PH.toFixed(1) + ' in</b>. Pages carry crop marks and say which page sits next to which.' : 'There is nothing on the chart to print.') + '</p>' +
      '<p class="muted small">Print at 100% (actual size), not “fit to page”. Trim at the crop marks and tape the pages together.</p>' +
      '<div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" id="pr-go" data-action="cv-pr-go"' + (p ? '' : ' disabled') + '>Make PDF</button></div>';
  }
  H['cv-print'] = function () { if (!st.graph || !st.graph.nodes.length) { A.toast('There is nothing on the chart to print.', true); return; } A.modal(printHtml()); };
  H['cv-pr'] = function () {
    pr.paper = val2('pr-paper'); pr.orientation = val2('pr-or'); pr.cols = Number(val2('pr-cols')); pr.rows = Number(val2('pr-rows')); pr.quality = val2('pr-q');
    A.modal(printHtml());
  };
  function val2(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  H['cv-pr-go'] = function () {
    var btn = document.getElementById('pr-go'); btn.disabled = true; btn.textContent = 'Working…';
    var bank = B();
    CI.tiledChart({ chart: CI.chart, bankName: bank.name, paper: pr.paper, orientation: pr.orientation, cols: pr.cols, rows: pr.rows, quality: pr.quality,
      onProgress: function (i, n) { btn.textContent = 'Page ' + i + ' of ' + n + '…'; } }).then(function (r) {
      return CI.saveFile('Chart-' + CI.fileSafe(bank.name) + '-' + pr.cols + 'x' + pr.rows + '.pdf', r.blob).then(function (res) {
        A.closeModal();
        if (res.status === 'saved') A.toast('Saved. ' + r.pages + ' page' + (r.pages === 1 ? '' : 's') + ', about ' + r.finishedW.toFixed(1) + ' × ' + r.finishedH.toFixed(1) + ' in when joined.');
        else if (res.status === 'unavailable') A.toast('Saving files is not available in this view.', true);
      });
    }).catch(function (e) { A.closeModal(); A.toast(e.message || 'Could not make the PDF.', true); });
  };
})();
