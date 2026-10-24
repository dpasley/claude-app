/* Chart screen: banks (saved views over the one main index), filters, snapshots, path finder, details. */
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
    if (!d.banks.length) { var nb = CI.newBank(d, 'All activity', [], 1); d.banks.push(nb); d.ui.bankId = nb.id; A.persist(); }
    var bank = d.banks.filter(function (b) { return b.id === id; })[0] || d.banks.filter(function (b) { return b.id === d.ui.bankId; })[0] || d.banks[0];
    if (d.ui.bankId !== bank.id) { d.ui.bankId = bank.id; A.persist(); }
    st.bankId = bank.id; st.sel = null; st.path = null; st.results = []; st.whole = null;
    renderShell();
  };

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
    h += '<div class="chart-layout"><aside class="panel" id="ctl">' + controlsHtml(bank, !!frozen) + '</aside>' +
      '<section class="stage"><div class="toolbar"><span id="summary" class="muted small"></span><span class="spacer"></span>' +
      '<button class="btn small" data-action="cv-fit">Fit</button><button class="btn small" data-action="cv-relayout">Auto-arrange</button><button class="btn small" data-action="cv-png">Image</button><button class="btn small" data-action="cv-print">Print for the wall…</button>' +
      '<a class="btn small" href="#/estimate/' + esc(bank.id) + '">Estimate</a><button class="btn small primary" data-action="cv-raise">Raise a lead</button></div>' +
      (frozen ? '<div class="banner">Frozen snapshot “' + esc(frozen.label) + '”, taken ' + esc(frozen.at.slice(0, 16).replace('T', ' ')) + '. Filters do not apply. Switch to Live to keep working.</div>' : '') +
      '<div id="cy"></div>' + legendHtml() + '</section><aside class="panel" id="detail"></aside></div>';
    A.view.innerHTML = h;
    A.view.className = 'wide';
    draw();
  }

  function chk(name, checked, label, extra) {
    return '<label class="chk"><input type="checkbox" ' + extra + (checked ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }

  function controlsHtml(bank, frozen) {
    var d = D(), s = d.settings, banks = d.banks;
    var h = '<h3>Bank</h3><select data-on-change="cv-bank-pick">' + banks.map(function (b) {
      return '<option value="' + esc(b.id) + '"' + (b.id === bank.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('') + '</select><div class="row wrap tight-row"><button class="btn small" data-action="cv-bank-new">New</button><button class="btn small" data-action="cv-bank-rename">Rename</button>' +
      '<button class="btn small" data-action="cv-bank-dup">Duplicate</button><button class="btn small danger" data-action="cv-bank-del">Delete</button></div>' +
      '<p class="muted small">A bank is a saved view. It reads the one main index and never copies data.</p>';
    h += '<h3>Starting entities</h3><div class="chips">' + (bank.seeds.length ? bank.seeds.map(function (id) {
      var e = A.idx().entity[id];
      return '<span class="chip">' + esc(e ? e.name : id) + '<button data-action="cv-seed-del" data-id="' + esc(id) + '" aria-label="Remove">×</button></span>';
    }).join('') : '<span class="muted small">None: shows every entity that has a connection.</span>') + '</div>' +
      '<input type="text" list="ent-dl" placeholder="Add an entity…" data-on-change="cv-seed-add" id="cv-seed-input">';
    h += '<fieldset' + (frozen ? ' disabled' : '') + '><legend>Filters</legend>' +
      '<label>Hops from the starting entities<select data-on-change="cv-hops">' + [0, 1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (bank.hops === n ? ' selected' : '') + '>' + n + (n === 0 ? ' (only these)' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label>Minimum independent reports per connection<input type="number" min="1" value="' + (bank.minWeight || 1) + '" data-on-change="cv-minw"></label>' +
      '<div class="group-label">Connection types</div>' + s.linkTypes.map(function (t) {
        return chk('lt', !bank.linkTypes || bank.linkTypes.indexOf(t.id) !== -1, t.label + (t.directed ? ' →' : ' ↔'), 'data-on-change="cv-types" data-id="' + esc(t.id) + '"');
      }).join('') +
      '<div class="group-label">Entity types</div>' + CI.ENTITY_TYPES.map(function (t) {
        return chk('et', !bank.entityTypes || bank.entityTypes.indexOf(t) !== -1, CI.TYPE_LABEL[t] + 's', 'data-on-change="cv-etypes" data-id="' + t + '"');
      }).join('') +
      '<div class="grid2 tight-grid"><label>From<input type="date" value="' + esc(bank.dateFrom) + '" data-on-change="cv-date" data-k="dateFrom"></label><label>To<input type="date" value="' + esc(bank.dateTo) + '" data-on-change="cv-date" data-k="dateTo"></label></div>' +
      '<p class="muted small">Dates use the event date, or the received date when none was given.</p>' +
      '<label>Show only the heaviest files <span class="hint">0 shows everything; starting entities are always kept</span><input type="number" min="0" value="' + (bank.topN || 0) + '" data-on-change="cv-topn"></label>' +
      chk('m', bank.showMentions, 'Show “mentioned together” (dashed)', 'data-on-change="cv-mentions"') +
      chk('h', bank.hubStop, 'Do not expand past high-connection nodes', 'data-on-change="cv-hubstop"') + '</fieldset>';
    if (bank.excluded.length) {
      h += '<h3>Hidden in this bank</h3><div class="chips">' + bank.excluded.map(function (id) {
        var e = A.idx().entity[id];
        return '<span class="chip">' + esc(e ? e.name : id) + '<button data-action="cv-unhide" data-id="' + esc(id) + '" aria-label="Show again">↺</button></span>';
      }).join('') + '</div>';
    }
    h += '<h3>Display</h3><label>Layout<select data-on-change="cv-layout">' + A.options([{ value: 'cose', label: 'Force-directed' }, { value: 'breadthfirst', label: 'Hierarchy (follows direction)' }, { value: 'concentric', label: 'Concentric by connections' }, { value: 'circle', label: 'Circle' }], bank.layout) + '</select></label>' +
      chk('l', bank.edgeLabels !== false, 'Edge labels', 'data-on-change="cv-labels"');
    h += '<h3>Snapshots</h3><p class="muted small">Freeze a bank when it is handed to investigators. Later findings then show up as changes.</p>';
    if (bank.snapshots.length) {
      var live = bank.viewMode !== 'frozen' || !snapOf(bank, bank.frozenId);
      h += '<label class="chk"><input type="radio" name="vm" data-on-change="cv-view" value="live"' + (live ? ' checked' : '') + '> Live</label>' +
        '<label class="chk"><input type="radio" name="vm" data-on-change="cv-view" value="frozen"' + (!live ? ' checked' : '') + '> Frozen:</label>' +
        '<select data-on-change="cv-snap-pick">' + bank.snapshots.map(function (sn) { return '<option value="' + esc(sn.id) + '"' + (sn.id === bank.frozenId ? ' selected' : '') + '>' + esc(sn.label) + '</option>'; }).join('') + '</select>';
      if (live) h += '<label>Highlight what is new since<select data-on-change="cv-compare">' + A.options(bank.snapshots.map(function (sn) { return { value: sn.id, label: sn.label }; }), bank.compareId, 'Nothing') + '</select></label>';
      h += '<div class="row wrap tight-row"><button class="btn small danger" data-action="cv-snap-del">Delete selected snapshot</button></div>';
    }
    if (!frozen) h += '<div class="row"><button class="btn small" data-action="cv-freeze">Freeze a snapshot now</button></div>';
    return h;
  }

  function legendHtml() {
    return '<div class="legend"><span>photo or logo tile = individual / group</span><span>arrow = direction</span><span>thicker line = more independent reports</span><span>dashed = mentioned together</span><span>orange = new or traced</span><span>black ring = starting entity</span><span>double ring = high-connection</span><span>drag tiles to arrange; the arrangement is kept</span></div>';
  }

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
    CI.chart.render(document.getElementById('cy'), graph, {
      layout: bank.layout, positions: cur.frozen ? null : bank.positions, photoOf: function (id) { var e = A.idx().entity[id]; return e && e.photo ? e.photo : ''; },
      onMoved: function (id, p) { if (cur.frozen) return; bank.positions[id] = p; A.persist(); },
      edgeLabels: bank.edgeLabels !== false, diff: diff, hl: hl, extraNodes: extraNodes, extraEdges: extraEdges, highlightFit: st.fitPath,
      onNode: function (id) { st.sel = { kind: 'node', id: id }; renderDetail(); },
      onEdge: function (id) { st.sel = { kind: 'edge', id: id }; renderDetail(); },
      onBackground: function () { st.sel = null; renderDetail(); }
    });
    st.fitPath = false;
    var s = document.getElementById('summary');
    if (s) {
      var txt = graph.nodes.length + ' entities · ' + graph.edges.length + ' connections';
      if (graph.trimmed) txt += ' · ' + graph.trimmed + ' lighter file' + (graph.trimmed === 1 ? '' : 's') + ' not shown';
      if (graph.hiddenWeak && !cur.frozen) txt += ' · ' + graph.hiddenWeak + ' hidden below the minimum of ' + bank.minWeight;
      if (diff) txt += ' · since “' + esc(snapOf(bank, bank.compareId).label) + '”: ' + Object.keys(diff.newNodes).length + ' new entities, ' + Object.keys(diff.newEdges).length + ' new connections, ' + Object.keys(diff.grownEdges).length + ' strengthened';
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
        h += '<button class="btn small" data-action="cv-node-seed" data-id="' + esc(id) + '">Add as starting entity</button><button class="btn small" data-action="cv-node-hide" data-id="' + esc(id) + '">Hide in this bank</button>';
      }
      h += '<button class="btn small" data-action="cv-path-from" data-id="' + esc(id) + '">Find connections from here…</button><button class="btn small" data-action="cv-raise-node" data-id="' + esc(id) + '">Raise a lead about this</button></div>';
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
              return '<li>' + A.repLink(l.reportId) + (r.dupOf ? ' <span class="tag">repost of ' + esc(r.dupOf) + '</span>' : '') + ' <span class="muted">' + esc(r.sourceType || '') + ' · ' + esc(CI.reportDate(r)) + '</span>' +
                (l.note ? '<div class="small">“' + esc(l.note) + '”</div>' : '') + '<div class="muted small">' + esc(A.trunc(r.summary || '', 120)) + '</div></li>';
            }).join('') + '</ul>';
          } else h += '<ul class="plain">' + e.reportIds.map(function (rid) { return '<li>' + A.repLink(rid) + '</li>'; }).join('') + '</ul>';
        }
        h += '<div class="stack"><button class="btn small" data-action="cv-raise-edge" data-id="' + esc(e.id) + '">Raise a lead about this</button></div>';
      }
    } else {
      h += '<h3>Details</h3><p class="muted small">Click an entity or a connection. Every connection lists the reports behind it.</p>';
    }

    h += '<h3 class="sep">How are two entities connected?</h3><label>From<input type="text" list="ent-dl" id="pf-a" value="' + esc(st.pa) + '" placeholder="Choose an entity…"></label>' +
      '<label>To<input type="text" list="ent-dl" id="pf-b" value="' + esc(st.pb) + '" placeholder="Choose an entity…"></label>' +
      '<label>Longest chain<select id="pf-max">' + [2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (st.maxHops === n ? ' selected' : '') + '>' + n + ' steps</option>'; }).join('') + '</select></label>' +
      '<label class="chk"><input type="checkbox" id="pf-avoid"' + (st.avoid ? ' checked' : '') + '> Avoid high-connection nodes</label>' +
      '<div class="row"><button class="btn small primary" data-action="cv-find">Find connections</button>' + (st.path ? '<button class="btn small" data-action="cv-path-clear">Clear</button>' : '') + '</div><div id="pf-out">' + pathResultsHtml() + '</div>';

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
  H['cv-bank-new'] = function () {
    A.ask('Name for the new bank?', '', function (n) {
      var b = CI.newBank(D(), n, [], 1); D().banks.push(b); D().ui.bankId = b.id; A.persist(); A.go('#/chart/' + b.id);
    }, { title: 'New bank', ok: 'Create' });
  };
  H['cv-bank-rename'] = function () {
    var b = B();
    A.ask('New name?', b.name, function (n) { b.name = n; b.quick = false; A.persist(); renderShell(); }, { title: 'Rename bank', ok: 'Rename' });
  };
  H['cv-bank-dup'] = function () {
    var b = B(), c = CI.clone(b); c.id = CI.nextId(D(), 'bank'); c.name = b.name + ' (copy)'; c.snapshots = []; c.compareId = ''; c.viewMode = 'live'; c.quick = false;
    D().banks.push(c); D().ui.bankId = c.id; A.persist(); A.go('#/chart/' + c.id);
  };
  H['cv-bank-del'] = function () {
    var b = B();
    var nl = D().leads.filter(function (l) { return l.bankId === b.id; }).length;
    if (nl) { A.toast('This bank has ' + nl + ' lead' + (nl === 1 ? '' : 's') + '. Delete or move them first.', true); return; }
    A.confirm('Delete the bank “' + b.name + '”' + (b.snapshots.length ? ' and its ' + b.snapshots.length + ' snapshot(s)' : '') + '? The reports and entities are not affected.', function () {
      D().banks = D().banks.filter(function (x) { return x.id !== b.id; }); D().ui.bankId = null; A.persist(); A.go('#/chart');
    }, { title: 'Delete bank', yes: 'Delete', danger: true });
  };
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
  H['cv-date'] = function (el) { mutate(function (b) { b[el.getAttribute('data-k')] = el.value; }); };
  H['cv-mentions'] = function (el) { mutate(function (b) { b.showMentions = el.checked; }); };
  H['cv-hubstop'] = function (el) { mutate(function (b) { b.hubStop = el.checked; }); };
  H['cv-labels'] = function (el) { mutate(function (b) { b.edgeLabels = el.checked; }); };
  H['cv-layout'] = function (el) { mutate(function (b) { b.layout = el.value; }); };
  H['cv-unhide'] = function (el) { mutate(function (b) { b.excluded = b.excluded.filter(function (x) { return x !== el.getAttribute('data-id'); }); }, true); };
  H['cv-node-seed'] = function (el) {
    var id = el.getAttribute('data-id');
    mutate(function (b) { if (b.seeds.indexOf(id) === -1) b.seeds.push(id); }, true); st.sel = { kind: 'node', id: id }; renderDetail();
  };
  H['cv-node-hide'] = function (el) {
    var id = el.getAttribute('data-id');
    mutate(function (b) { if (b.excluded.indexOf(id) === -1) b.excluded.push(id); b.seeds = b.seeds.filter(function (x) { return x !== id; }); }, true); st.sel = null; renderDetail();
  };

  /* snapshots */
  H['cv-freeze'] = function () {
    A.ask('Label for this snapshot?', 'Handoff ' + CI.today(), function (label) {
      var b = B(), live = CI.computeGraph(D(), b, A.idx());
      var sn = { id: CI.nextId(D(), 'snapshot'), label: label, at: new Date().toISOString(), graph: CI.clone(live) };
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
  H['cv-relayout'] = function () { B().positions = {}; A.persist(); draw(); };
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

  /* leads from the chart */
  function raiseFrom(question, about, rids) {
    var bank = B(), ids = (rids || []).filter(function (r) { return A.idx().report[r]; });
    CI.views.openLead({ bankId: bank.id, question: question, about: about, raisedBy: ids[ids.length - 1] || '' });
  }
  H['cv-raise'] = function () { CI.views.openLead({ bankId: B().id }); };
  H['cv-raise-node'] = function (el) {
    var id = el.getAttribute('data-id'), e = A.idx().entity[id];
    raiseFrom(e ? 'Who or what is ' + e.name + '?' : '', [id], (A.idx().reportsByEntity[id] || []).slice().sort());
  };
  H['cv-raise-edge'] = function (el) {
    var e = edgeById(el.getAttribute('data-id')); if (!e) return;
    var q = e.kind === 'mention' ? 'Is there a connection between ' + nodeName(e.source) + ' and ' + nodeName(e.target) + '?' : 'What is behind ' + nodeName(e.source) + ' ' + e.label + ' ' + nodeName(e.target) + '?';
    raiseFrom(q, [e.source, e.target], (e.reportIds || []).slice().sort());
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
