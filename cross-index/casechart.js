/* Case chart: the investigators' picture of the major players and how they are related in one investigation.
 * It looks and prints like the working chart, but shows only the main files chosen for it, arranged for the best view of the situation.
 * Connections can be drawn by hand; each cites the reports behind it. Labels and a title can be added for the wall copy.
 * Open leads put a flag badge on the files they are about, so the board shows what is next. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var st = { invId: '', sel: null, graph: null, form: null };

  function D() { return A.data(); }
  function inv() { return D().investigations.filter(function (v) { return v.id === st.invId; })[0]; }
  function ent(id) { return A.idx().entity[id]; }
  function name(id) { var e = ent(id); return e ? e.name : id; }
  function entLabel(e) { return e.name + ' · ' + CI.TYPE_LABEL[e.type].toLowerCase() + ' · ' + e.id; }
  function parseEntity(text) {
    var m = String(text || '').match(/(E-\d{4,})\s*$/);
    if (m && ent(m[1])) return m[1];
    var c = CI.findCandidates(D(), text, 1)[0];
    return c ? c.entity.id : '';
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function isNote(id) { return /^W-/.test(id); }

  CI.views.casechart = function (id) {
    var d = D(), v = d.investigations.filter(function (x) { return x.id === id; })[0];
    if (!v) { A.view.className = ''; A.view.innerHTML = '<div class="card callout">No such investigation. <a href="#/investigations">Back to investigations</a></div>'; return; }
    st.invId = v.id; st.sel = null; CI.caseChartOf(v);
    shell();
  };

  function titleText() { var v = inv(); return 'Case chart ' + v.id + (CI.caseChartOf(v).title ? ' · ' + CI.caseChartOf(v).title : ''); }

  function shell() {
    var v = inv(), d = D(), cc = CI.caseChartOf(v);
    var pinned = {}; cc.pins.forEach(function (p) { pinned[p.entityId] = 1; });
    var free = d.entities.filter(function (e) { return !pinned[e.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var b = d.banks.filter(function (x) { return x.id === v.bankId; })[0];
    var h = CI.views.invHead(v) + CI.views.invTabs(v, 'chart') + '<datalist id="cc-dl">' + free.map(function (e) { return '<option value="' + esc(entLabel(e)) + '">'; }).join('') + '</datalist>' +
      '<div class="chart-layout"><aside class="panel" id="ctl"></aside><section class="stage"><div class="toolbar"><strong id="cc-title">' + esc(titleText()) + '</strong><span id="summary" class="muted small" style="margin-left:10px"></span><span class="spacer"></span>' +
      '<button class="btn small" data-action="cc-fit">Fit</button><button class="btn small" data-action="cc-relayout">Auto-arrange</button><button class="btn small" data-action="cc-png">Image</button><button class="btn small" data-action="cc-print">Print for the wall…</button>' +
       (b ? '<a class="btn small" href="#/chart/' + esc(b.id) + '">Working chart</a>' : '') +
      '<button class="btn small primary" data-action="cc-raise">Raise a lead</button></div>' +
      '<div id="cy"></div><div class="legend"><span>photo or logo tile = individual / group</span><span>every connection cites the reports behind it</span><span>orange badge = an open lead is about this name</span><span>yellow = label</span><span>drag to arrange; the arrangement is kept and prints</span></div></section><aside class="panel" id="detail"></aside></div>';
    A.view.className = 'wide'; A.view.innerHTML = h;
    ctl(); draw();
  }

  function ctl() {
    var v = inv(), box = document.getElementById('ctl'); if (!box) return;
    var cc = CI.caseChartOf(v), avail = CI.indexConnections(D(), v).length;
    box.innerHTML = '<h3>Add a name</h3><input type="text" list="cc-dl" id="cc-pin-input" placeholder="Search the names…" data-on-change="cc-pin-add"><p class="muted small">Choose the major players for this investigation. You can also send them from the working chart.</p>' +
      '<h3>Connections</h3><div class="stack"><button class="btn small primary" data-action="cc-string-new"' + (cc.pins.length < 2 ? ' disabled' : '') + '>Draw a connection</button>' +
      '<button class="btn small" data-action="cc-index-add"' + (avail ? '' : ' disabled') + '>Add the ' + avail + ' already in the main files</button></div>' +
      '<p class="muted small">A connection you draw must cite at least one report. Click one to see its reports.</p>' +
      '<h3>Labels</h3><div class="stack"><button class="btn small" data-action="cc-note-new">Add a label</button><button class="btn small" data-action="cc-title">Set the title</button></div>' +
      '<p class="muted small">Labels and the title print on the wall copy. Anyone working the investigation can edit this board.</p>';
  }

  function placeBadge(n) {
    var cy = CI.chart.cy, b = cy && cy.getElementById('F-' + n.id());
    if (b && b.length) { var p = n.position(); var bw = 14 + 6.4 * String(b.data('label')).length, w = n.width() || 70, h = n.height() || 70; b.position({ x: p.x + w / 2 - 14 + bw / 2, y: p.y - h / 2 - 2 }); }
  }
  function flagBadges(g) {
    var cy = CI.chart.cy; if (!cy) return;
    cy.nodes('.flag').remove();
    Object.keys(g.flags.nodes).forEach(function (id) {
      var n = cy.getElementById(id); if (!n.length) return;
      cy.add({ group: 'nodes', data: { id: 'F-' + id, label: g.flags.nodes[id].join(' · '), degree: 0 }, classes: 'flag', position: { x: n.position().x, y: n.position().y }, selectable: false, grabbable: false });
      placeBadge(n);
    });
  }
  function decorate(g) {
    var cy = CI.chart.cy; if (!cy) return;
    cy.nodes('.note').remove();
    g.notes.forEach(function (n) { cy.add({ group: 'nodes', data: { id: n.id, label: n.text, degree: 0 }, classes: 'note', position: { x: n.x, y: n.y } }); });
    flagBadges(g);
    cy.off('drag.cc'); cy.on('drag.cc', 'node', function (ev) { if (!ev.target.hasClass('note') && !ev.target.hasClass('flag')) placeBadge(ev.target); });
    cy.fit(null, 40);
  }

  function draw() {
    var v = inv(), d = D(), g = CI.caseGraph(d, v, A.idx());
    st.graph = g;
    var hl = { nodes: {}, edges: {} };
    Object.keys(g.flags.edges).forEach(function (k) { hl.edges[k] = 1; });
    var el = document.getElementById('cy');
    if (!g.graph.nodes.length) {
      if (CI.chart) CI.chart.destroy();
      el.innerHTML = '<p class="empty" style="padding:40px;text-align:center">The board is empty. Add the major players from the panel on the left, then draw how they are connected.</p>';
    } else {
      CI.chart.render(el, g.graph, {
        layout: 'cose', positions: g.positions, edgeLabels: true, hl: hl,
        photoOf: function (id) { var e = ent(id); return e && e.photo ? e.photo : ''; },
        onMoved: function (id, p) {
          var cc = CI.caseChartOf(v), t = isNote(id) ? cc.notes.filter(function (x) { return x.id === id; })[0] : cc.pins.filter(function (x) { return x.entityId === id; })[0];
          if (t) { t.x = p.x; t.y = p.y; A.persist(); }
        },
        onNode: function (id) { if (/^F-/.test(id)) return; st.sel = isNote(id) ? { kind: 'note', id: id } : { kind: 'node', id: id }; detail(); },
        onEdge: function (id) { st.sel = { kind: 'edge', id: id }; detail(); },
        onBackground: function () { st.sel = null; detail(); }
      });
      decorate(g);
    }
    var s = document.getElementById('summary');
    if (s) s.textContent = g.graph.nodes.length + ' names · ' + g.graph.edges.length + ' connections' + (Object.keys(g.flags.nodes).length ? ' · ' + Object.keys(g.flags.nodes).length + ' flagged' : '');
    var t = document.getElementById('cc-title'); if (t) t.textContent = titleText();
    detail();
  }

  function leadItems(ids) {
    return '<ul class="plain">' + ids.map(function (id) {
      var l = D().leads.filter(function (x) { return x.id === id; })[0]; if (!l) return '';
      return '<li><a href="#/lead/' + esc(l.id) + '">' + esc(l.id) + '</a> ' + esc(A.trunc(l.question, 80)) + ' <span class="muted small">' + esc(CI.leadStatus(l.status).label) + '</span></li>';
    }).join('') + '</ul>';
  }

  function detail() {
    var box = document.getElementById('detail'); if (!box) return;
    var v = inv(), idx = A.idx(), cc = CI.caseChartOf(v), g = st.graph || { flags: { nodes: {}, edges: {} } }, h = '';
    if (st.sel && st.sel.kind === 'node' && ent(st.sel.id)) {
      var e = ent(st.sel.id), mine = cc.strings.filter(function (t) { return t.a === e.id || t.b === e.id; });
      h += '<h3>' + esc(e.name) + '</h3><p>' + A.tag(e.type) + '</p><p class="muted small">' + (idx.reportsByEntity[e.id] || []).length + ' report' + ((idx.reportsByEntity[e.id] || []).length === 1 ? '' : 's') + ' in the main file.</p>';
      if (g.flags.nodes[e.id]) h += '<div class="group-label">Next: open leads about this name</div>' + leadItems(g.flags.nodes[e.id]);
      h += mine.length ? '<div class="group-label">Connections</div><ul class="plain">' + mine.map(function (t) {
        var other = t.a === e.id ? t.b : t.a;
        return '<li><a href="#" data-action="cc-pick-edge" data-id="' + esc(t.id) + '">' + esc(t.label || 'connected') + ' ' + esc(name(other)) + '</a> <span class="muted small">' + t.reportIds.length + ' report' + (t.reportIds.length === 1 ? '' : 's') + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">No connections from this name yet.</p>';
      h += '<div class="stack"><a class="btn small" href="#/entity/' + esc(e.id) + '">Open file</a><button class="btn small" data-action="cc-string-from" data-id="' + esc(e.id) + '"' + (cc.pins.length < 2 ? ' disabled' : '') + '>Draw a connection from here</button>' +
        '<button class="btn small" data-action="cc-raise-node" data-id="' + esc(e.id) + '">Raise a lead about this</button><button class="btn small danger" data-action="cc-pin-del" data-id="' + esc(e.id) + '">Remove from the board</button></div>';
    } else if (st.sel && st.sel.kind === 'edge') {
      var t = cc.strings.filter(function (x) { return x.id === st.sel.id; })[0];
      if (t) {
        h += '<h3>Connection</h3><p>' + esc(name(t.a)) + ' <span class="rel">— ' + esc(t.label || 'connected') + ' —</span> ' + esc(name(t.b)) + '</p><div class="group-label">Reports behind it</div><ul class="plain">' +
          t.reportIds.map(function (rid) { var r = idx.report[rid] || {}; return '<li>' + A.repLink(rid) + (r.dupOf ? ' <span class="tag">repost of ' + esc(r.dupOf) + '</span>' : '') + ' <span class="muted small">' + esc(r.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(r))) + '</span><div class="muted small">' + esc(A.trunc(r.summary || '', 120)) + '</div></li>'; }).join('') + '</ul>';
        if (g.flags.edges[t.id]) h += '<div class="group-label">Next: open leads about both names</div>' + leadItems(g.flags.edges[t.id]);
        h += '<div class="stack"><button class="btn small" data-action="cc-string-edit" data-id="' + esc(t.id) + '">Change label or reports</button><button class="btn small" data-action="cc-raise-edge" data-id="' + esc(t.id) + '">Raise a lead about this</button><button class="btn small danger" data-action="cc-string-del" data-id="' + esc(t.id) + '">Remove connection</button></div>';
      }
    } else if (st.sel && st.sel.kind === 'note') {
      var nt = cc.notes.filter(function (x) { return x.id === st.sel.id; })[0];
      if (nt) h += '<h3>Label</h3><p>' + esc(nt.text) + '</p><div class="stack"><button class="btn small" data-action="cc-note-edit" data-id="' + esc(nt.id) + '">Change the text</button><button class="btn small danger" data-action="cc-note-del" data-id="' + esc(nt.id) + '">Remove label</button></div>';
    }
    if (!h) h = '<h3>Details</h3><p class="muted small">Click a name, a connection or a label. Each connection lists the reports behind it. An orange badge marks a name an open lead is still chasing.</p>';
    var open = (g.openLeads || []);
    if (open.length) h += '<h3 class="sep">Open leads (' + open.length + ')</h3>' + leadItems(open.map(function (l) { return l.id; }));
    box.innerHTML = h;
  }

  /* ---------- main files on the board ---------- */
  H['cc-pin-add'] = function (el) {
    var id = parseEntity(el.value); if (!id) { A.toast('No name matches that.', true); return; }
    var res = CI.addPin(D(), inv(), id); if (res.error) { A.toast(res.error, true); return; }
    A.persist(); shell();
  };
  H['cc-pick-edge'] = function (el) { var id = el.getAttribute('data-id'); st.sel = { kind: 'edge', id: id }; if (CI.chart.cy) { CI.chart.cy.$(':selected').unselect(); CI.chart.cy.getElementById(id).select(); CI.chart.focus(id); } detail(); };
  H['cc-pin-del'] = function (el) {
    var id = el.getAttribute('data-id'), n = CI.caseChartOf(inv()).strings.filter(function (t) { return t.a === id || t.b === id; }).length;
    A.confirm('Take ' + name(id) + ' off the board' + (n ? ' along with its ' + n + ' connection' + (n === 1 ? '' : 's') : '') + '? The name is not changed.', function () {
      CI.removePin(D(), inv(), id); A.persist(); st.sel = null; shell();
    }, { title: 'Remove from the board', yes: 'Remove', danger: true });
  };
  H['cc-index-add'] = function () {
    var n = CI.addIndexConnections(D(), inv()); A.persist(); A.toast(n ? n + ' connection' + (n === 1 ? '' : 's') + ' added.' : 'Nothing new to add.'); ctl(); draw();
  };

  /* ---------- connections ---------- */
  function reportRow(rid, on) {
    var r = A.idx().report[rid] || {};
    return '<label class="chk"><input type="checkbox" data-id="' + esc(rid) + '" class="cs-r"' + (on ? ' checked' : '') + '> <b>' + esc(rid) + '</b> <span class="muted small">' + esc(r.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(r))) + ' · ' + esc(A.trunc(r.summary || '', 90)) + '</span></label>';
  }
  function stringModal() {
    var f = st.form, cc = CI.caseChartOf(inv()), pins = cc.pins.filter(function (p) { return ent(p.entityId); });
    var opts = function (sel) { return A.options(pins.map(function (p) { return { value: p.entityId, label: name(p.entityId) }; }), sel); };
    var rs = f.a && f.b && f.a !== f.b ? CI.reportsForString(D(), f.a, f.b, A.idx()) : { both: [], one: [] };
    var h = '<h2>' + (f.edit ? 'Change connection' : 'Draw a connection') + '</h2><div class="form"><datalist id="cs-types">' + D().settings.linkTypes.map(function (t) { return '<option value="' + esc(t.label) + '">'; }).join('') + '</datalist>' +
      '<div class="grid2"><label>From<select id="cs-a" data-on-change="cs-pair"' + (f.edit ? ' disabled' : '') + '>' + opts(f.a) + '</select></label><label>To<select id="cs-b" data-on-change="cs-pair"' + (f.edit ? ' disabled' : '') + '>' + opts(f.b) + '</select></label></div>' +
      '<label>What connects them <span class="hint">a few words, such as “paid by” or “same address”</span><input type="text" id="cs-label" list="cs-types" value="' + esc(f.label) + '"></label>' +
      '<div class="group-label">Reports behind it <span class="hint">choose at least one</span></div>';
    if (f.a === f.b) h += '<p class="muted small">Choose two different names.</p>';
    else if (!rs.both.length && !rs.one.length) h += '<p class="muted small">No report names either one, so there is nothing to base a connection on.</p>';
    else {
      if (rs.both.length) h += '<div class="small muted">Name both</div>' + rs.both.map(function (r) { return reportRow(r, !!f.ids[r]); }).join('');
      if (rs.one.length) h += '<div class="small muted" style="margin-top:6px">Name one of them</div>' + rs.one.map(function (r) { return reportRow(r, !!f.ids[r]); }).join('');
    }
    h += '</div><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="cs-save">' + (f.edit ? 'Save' : 'Add connection') + '</button></div>';
    A.modal(h, true);
  }
  function captureForm() {
    var f = st.form; if (!f) return;
    if (!f.edit) { f.a = val('cs-a') || f.a; f.b = val('cs-b') || f.b; }
    f.label = val('cs-label');
    f.ids = {}; document.querySelectorAll('.cs-r').forEach(function (c) { if (c.checked) f.ids[c.getAttribute('data-id')] = 1; });
  }
  function openString(a, b, editId) {
    var cc = CI.caseChartOf(inv()), pins = cc.pins;
    if (editId) {
      var t = cc.strings.filter(function (x) { return x.id === editId; })[0]; if (!t) return;
      st.form = { edit: t.id, a: t.a, b: t.b, label: t.label, ids: {} }; t.reportIds.forEach(function (r) { st.form.ids[r] = 1; });
    } else {
      var a2 = a || (pins[0] && pins[0].entityId) || '', b2 = b || (pins.filter(function (p) { return p.entityId !== a2; })[0] || {}).entityId || '';
      st.form = { edit: '', a: a2, b: b2, label: '', ids: {} };
    }
    stringModal();
  }
  H['cc-string-new'] = function () { openString('', ''); };
  H['cc-string-from'] = function (el) { openString(el.getAttribute('data-id'), ''); };
  H['cc-string-edit'] = function (el) { openString('', '', el.getAttribute('data-id')); };
  H['cs-pair'] = function () { captureForm(); stringModal(); };
  H['cs-save'] = function () {
    captureForm(); var f = st.form, ids = Object.keys(f.ids);
    var res = f.edit ? CI.updateString(D(), inv(), f.edit, { label: f.label, reportIds: ids }) : CI.addString(D(), inv(), { a: f.a, b: f.b, label: f.label, reportIds: ids });
    if (res.error) { A.toast(res.error, true); return; }
    A.persist(); A.closeModal(); st.sel = { kind: 'edge', id: res.string.id }; ctl(); draw();
  };
  H['cc-string-del'] = function (el) {
    var id = el.getAttribute('data-id');
    A.confirm('Remove this connection? The reports behind it are not changed.', function () { CI.removeString(D(), inv(), id); A.persist(); st.sel = null; ctl(); draw(); }, { title: 'Remove connection', yes: 'Remove', danger: true });
  };

  /* ---------- labels and title ---------- */
  H['cc-note-new'] = function () {
    A.ask('What should the label say?', '', function (text) {
      var cy = CI.chart.cy, ex = cy ? cy.extent() : null, c = ex ? { x: (ex.x1 + ex.x2) / 2, y: (ex.y1 + ex.y2) / 2 } : { x: 0, y: 0 };
      var res = CI.addNote(D(), inv(), text, c); if (res.error) { A.toast(res.error, true); return; }
      A.persist(); st.sel = { kind: 'note', id: res.note.id }; draw();
    }, { title: 'Add a label', ok: 'Add' });
  };
  H['cc-note-edit'] = function (el) {
    var id = el.getAttribute('data-id'), nt = CI.caseChartOf(inv()).notes.filter(function (x) { return x.id === id; })[0]; if (!nt) return;
    A.ask('What should the label say?', nt.text, function (text) { var res = CI.updateNote(D(), inv(), id, text); if (res.error) { A.toast(res.error, true); return; } A.persist(); draw(); }, { title: 'Change the label', ok: 'Save' });
  };
  H['cc-note-del'] = function (el) { CI.removeNote(D(), inv(), el.getAttribute('data-id')); A.persist(); st.sel = null; draw(); };
  H['cc-title'] = function () {
    A.ask('Title for the board (printed on the wall copy)?', CI.caseChartOf(inv()).title, function (text) { CI.setCaseTitle(D(), inv(), text); A.persist(); draw(); }, { title: 'Board title', ok: 'Save' });
  };

  /* ---------- leads ---------- */
  function raise(question, about, rids) {
    var ids = (rids || []).filter(function (r) { return A.idx().report[r]; });
    CI.views.openLead({ investigationId: inv().id, question: question, about: about, raisedBy: ids[ids.length - 1] || '' });
  }
  H['cc-raise'] = function () { CI.views.openLead({ investigationId: inv().id }); };
  H['cc-raise-node'] = function (el) { var id = el.getAttribute('data-id'); raise('Who or what is ' + name(id) + '?', [id], (A.idx().reportsByEntity[id] || []).slice().sort()); };
  H['cc-raise-edge'] = function (el) {
    var t = CI.caseChartOf(inv()).strings.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!t) return;
    raise('What is behind “' + (t.label || 'the connection') + '” between ' + name(t.a) + ' and ' + name(t.b) + '?', [t.a, t.b], t.reportIds.slice().sort());
  };

  /* ---------- view tools ---------- */
  H['cc-fit'] = function () { CI.chart.fit(); };
  H['cc-relayout'] = function () {
    var cy = CI.chart.cy; if (!cy || !st.graph) return;
    cy.nodes('.flag,.note').remove();
    var cc = CI.caseChartOf(inv()), centre = function () { var ns = cy.nodes(), x = 0, y = 0; ns.forEach(function (n) { x += n.position().x; y += n.position().y; }); return { x: x / (ns.length || 1), y: y / (ns.length || 1) }; };
    var c0 = centre();
    CI.chart.relayout('cose', st.graph.graph);
    var c1 = centre();
    cc.notes.forEach(function (n) { n.x = Math.round(n.x + c1.x - c0.x); n.y = Math.round(n.y + c1.y - c0.y); });
    cy.nodes().forEach(function (n) { var p = n.position(), pin = cc.pins.filter(function (x) { return x.entityId === n.id(); })[0]; if (pin) { pin.x = Math.round(p.x); pin.y = Math.round(p.y); } });
    A.persist();
    decorate(st.graph);
  };
  H['cc-png'] = function () {
    var uri = CI.chart.png(); if (!uri) { A.toast('The board is empty.', true); return; }
    A.modal('<h2>Case chart image</h2><p class="muted small">Right-click (or press and hold) the image to save or copy it.</p><img alt="Case chart" src="' + uri + '"><div class="row end"><button class="btn" data-action="modal-close">Close</button></div>', true);
  };

  var pr = { paper: 'tabloid', orientation: 'landscape', cols: 2, rows: 2, quality: 'standard' };
  function printHtml() {
    var bb = CI.chart.bounds(), n = pr.cols * pr.rows, plan = null;
    if (bb) {
      var paper = CI.PAPERS[pr.paper], land = pr.orientation !== 'portrait';
      plan = CI.planTiles({ gw: bb.w, gh: bb.h, cols: pr.cols, rows: pr.rows, pageW: land ? Math.max(paper.w, paper.h) : Math.min(paper.w, paper.h), pageH: land ? Math.min(paper.w, paper.h) : Math.max(paper.w, paper.h), margin: 0.35 });
    }
    var sel = function (id, list, cur) { return '<select id="' + id + '" data-on-change="cc-pr">' + A.options(list, cur) + '</select>'; };
    var nums = [1, 2, 3, 4].map(function (k) { return { value: String(k), label: String(k) }; });
    return '<h2>Print the case chart</h2><div class="form"><div class="grid2"><label>Paper' + sel('cp-paper', Object.keys(CI.PAPERS).map(function (k) { return { value: k, label: CI.PAPERS[k].label }; }), pr.paper) + '</label>' +
      '<label>Pages face' + sel('cp-or', [{ value: 'landscape', label: 'Landscape (wide)' }, { value: 'portrait', label: 'Portrait (tall)' }], pr.orientation) + '</label></div>' +
      '<div class="grid2"><label>Pages across' + sel('cp-cols', nums, String(pr.cols)) + '</label><label>Pages down' + sel('cp-rows', nums, String(pr.rows)) + '</label></div>' +
      '<label>Quality' + sel('cp-q', [{ value: 'draft', label: 'Draft (small file)' }, { value: 'standard', label: 'Standard' }, { value: 'fine', label: 'Fine (large file)' }], pr.quality) + '</label></div>' +
      '<p class="small">' + (plan ? n + ' page' + (n === 1 ? '' : 's') + '. Joined together, about <b>' + plan.PW.toFixed(1) + ' × ' + plan.PH.toFixed(1) + ' in</b>. Leave room on the printout for hand notes.' : 'There is nothing on the board to print.') + '</p>' +
      '<div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" id="cp-go" data-action="cc-pr-go"' + (plan ? '' : ' disabled') + '>Make PDF</button></div>';
  }
  H['cc-print'] = function () { if (!st.graph || !st.graph.graph.nodes.length) { A.toast('The board is empty.', true); return; } A.modal(printHtml()); };
  H['cc-pr'] = function () { pr.paper = val('cp-paper'); pr.orientation = val('cp-or'); pr.cols = Number(val('cp-cols')); pr.rows = Number(val('cp-rows')); pr.quality = val('cp-q'); A.modal(printHtml()); };
  H['cc-pr-go'] = function () {
    var btn = document.getElementById('cp-go'); btn.disabled = true; btn.textContent = 'Working…';
    var v = inv();
    CI.tiledChart({ chart: CI.chart, bankName: titleText(), paper: pr.paper, orientation: pr.orientation, cols: pr.cols, rows: pr.rows, quality: pr.quality,
      onProgress: function (i, n) { btn.textContent = 'Page ' + i + ' of ' + n + '…'; } }).then(function (r) {
      return CI.saveFile('Case-chart-' + v.id + '-' + pr.cols + 'x' + pr.rows + '.pdf', r.blob).then(function (res) {
        A.closeModal();
        if (res.status === 'saved') A.toast('Saved. ' + r.pages + ' page' + (r.pages === 1 ? '' : 's') + '.');
        else if (res.status === 'unavailable') A.toast('Saving files is not available in this view.', true);
      });
    }).catch(function (e) { A.closeModal(); A.toast(e.message || 'Could not make the PDF.', true); });
  };

  /* ---------- sending things over from the working chart ---------- */
  CI.views.pinToCase = function (bankId, entityIds) {
    var v = CI.investigationFor(D(), bankId);
    if (!v) return { error: 'This bank has not been handed over, so it has no investigation yet.' };
    var added = 0;
    entityIds.forEach(function (id) { if (!CI.addPin(D(), v, id).error) added++; });
    A.persist();
    return { inv: v, added: added };
  };
  CI.views.stringToCase = function (bankId, e) {
    var v = CI.investigationFor(D(), bankId);
    if (!v) return { error: 'This bank has not been handed over, so it has no investigation yet.' };
    CI.addPin(D(), v, e.source); CI.addPin(D(), v, e.target);
    var res = CI.addString(D(), v, { a: e.source, b: e.target, label: e.kind === 'mention' ? 'named together' : e.label, reportIds: (e.reportIds || []).slice() });
    A.persist();
    return res.error ? { error: res.error, inv: v } : { inv: v, string: res.string };
  };
})();
