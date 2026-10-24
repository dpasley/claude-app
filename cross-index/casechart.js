/* Case chart: the investigators' board for one investigation.
 * Files are pinned from the master index; strings are drawn by hand and each one cites the reports behind it.
 * Open leads flag the pins and strings they are about, so the board shows what is found and what is next. */
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

  CI.views.casechart = function (id) {
    var d = D(), v = d.investigations.filter(function (x) { return x.id === id; })[0];
    if (!v) { A.view.className = ''; A.view.innerHTML = '<div class="card callout">No such investigation. <a href="#/investigations">Back to investigations</a></div>'; return; }
    st.invId = v.id; st.sel = null; CI.caseChartOf(v);
    shell();
  };

  function shell() {
    var v = inv(), d = D(), cc = CI.caseChartOf(v);
    var pinned = {}; cc.pins.forEach(function (p) { pinned[p.entityId] = 1; });
    var free = d.entities.filter(function (e) { return !pinned[e.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var b = d.banks.filter(function (x) { return x.id === v.bankId; })[0];
    var h = '<datalist id="cc-dl">' + free.map(function (e) { return '<option value="' + esc(entLabel(e)) + '">'; }).join('') + '</datalist>' +
      '<div class="chart-layout"><aside class="panel" id="ctl"></aside><section class="stage"><div class="toolbar"><strong>Case chart ' + esc(v.id) + '</strong><span id="summary" class="muted small" style="margin-left:10px"></span><span class="spacer"></span>' +
      '<button class="btn small" data-action="cc-fit">Fit</button><button class="btn small" data-action="cc-relayout">Auto-arrange</button><button class="btn small" data-action="cc-png">Image</button><button class="btn small" data-action="cc-print">Print for the wall…</button>' +
      '<a class="btn small" href="#/investigation/' + esc(v.id) + '">Investigation</a>' + (b ? '<a class="btn small" href="#/chart/' + esc(b.id) + '">Working chart</a>' : '') +
      '<button class="btn small primary" data-action="cc-raise">Raise a lead</button></div>' +
      '<div id="cy"></div><div class="legend"><span>pins are files from the master index</span><span>a string always cites the reports behind it</span><span>orange = an open lead is about this</span><span>drag pins to arrange; the arrangement is kept</span></div></section><aside class="panel" id="detail"></aside></div>';
    A.view.className = 'wide'; A.view.innerHTML = h;
    ctl(); draw();
  }

  function ctl() {
    var v = inv(), cc = CI.caseChartOf(v), box = document.getElementById('ctl'); if (!box) return;
    var h = '<h3>Pin a file</h3><input type="text" list="cc-dl" id="cc-pin-input" placeholder="Search the master files…" data-on-change="cc-pin-add"><p class="muted small">Choose a person, group, subject or area from the index to pin it to the board.</p>' +
      '<h3>Pinned files (' + cc.pins.length + ')</h3>' + (cc.pins.length ? '<ul class="plain">' + cc.pins.map(function (p) {
        var e = ent(p.entityId); if (!e) return '';
        return '<li><a href="#" data-action="cc-pick-node" data-id="' + esc(e.id) + '">' + esc(e.name) + '</a> <span class="muted small">' + esc(CI.TYPE_LABEL[e.type].toLowerCase()) + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">Nothing pinned yet.</p>') +
      '<h3>Strings (' + cc.strings.length + ')</h3>' + (cc.strings.length ? '<ul class="plain">' + cc.strings.map(function (t) {
        return '<li><a href="#" data-action="cc-pick-edge" data-id="' + esc(t.id) + '">' + esc(name(t.a)) + ' — ' + esc(t.label || 'connected') + ' — ' + esc(name(t.b)) + '</a> <span class="muted small">' + t.reportIds.length + ' report' + (t.reportIds.length === 1 ? '' : 's') + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">No strings yet.</p>') +
      '<div class="row"><button class="btn small primary" data-action="cc-string-new"' + (cc.pins.length < 2 ? ' disabled' : '') + '>Add a string</button></div>' +
      '<p class="muted small">Every string must cite at least one report. Anyone working the investigation can edit this board.</p>';
    box.innerHTML = h;
  }

  function draw() {
    var v = inv(), d = D(), g = CI.caseGraph(d, v, A.idx());
    st.graph = g;
    var hl = { nodes: {}, edges: {} };
    Object.keys(g.flags.nodes).forEach(function (k) { hl.nodes[k] = 1; });
    Object.keys(g.flags.edges).forEach(function (k) { hl.edges[k] = 1; });
    var el = document.getElementById('cy');
    if (!g.graph.nodes.length) {
      if (CI.chart) CI.chart.destroy();
      el.innerHTML = '<p class="empty" style="padding:40px;text-align:center">The board is empty. Pin the key files from the panel on the left, then draw strings between them.</p>';
    } else {
      CI.chart.render(el, g.graph, {
        layout: 'cose', positions: g.positions, edgeLabels: true, hl: hl,
        photoOf: function (id) { var e = ent(id); return e && e.photo ? e.photo : ''; },
        onMoved: function (id, p) { var pin = CI.caseChartOf(v).pins.filter(function (x) { return x.entityId === id; })[0]; if (pin) { pin.x = p.x; pin.y = p.y; A.persist(); } },
        onNode: function (id) { st.sel = { kind: 'node', id: id }; detail(); },
        onEdge: function (id) { st.sel = { kind: 'edge', id: id }; detail(); },
        onBackground: function () { st.sel = null; detail(); }
      });
    }
    var s = document.getElementById('summary');
    if (s) s.textContent = g.graph.nodes.length + ' pinned · ' + g.graph.edges.length + ' strings · ' + Object.keys(g.flags.nodes).length + ' flagged';
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
    var v = inv(), d = D(), idx = A.idx(), cc = CI.caseChartOf(v), g = st.graph || { flags: { nodes: {}, edges: {} } }, h = '';
    if (st.sel && st.sel.kind === 'node' && ent(st.sel.id)) {
      var e = ent(st.sel.id), mine = cc.strings.filter(function (t) { return t.a === e.id || t.b === e.id; });
      h += '<h3>' + esc(e.name) + '</h3><p>' + A.tag(e.type) + '</p><p class="muted small">' + (idx.reportsByEntity[e.id] || []).length + ' report' + ((idx.reportsByEntity[e.id] || []).length === 1 ? '' : 's') + ' in the master file.</p>';
      if (g.flags.nodes[e.id]) h += '<div class="group-label">Next: open leads about this file</div>' + leadItems(g.flags.nodes[e.id]);
      h += mine.length ? '<div class="group-label">Strings</div><ul class="plain">' + mine.map(function (t) {
        var other = t.a === e.id ? t.b : t.a;
        return '<li><a href="#" data-action="cc-pick-edge" data-id="' + esc(t.id) + '">' + esc(t.label || 'connected') + ' ' + esc(name(other)) + '</a> <span class="muted small">' + t.reportIds.length + ' report' + (t.reportIds.length === 1 ? '' : 's') + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">No strings from this file yet.</p>';
      h += '<div class="stack"><a class="btn small" href="#/entity/' + esc(e.id) + '">Open file</a><button class="btn small" data-action="cc-string-from" data-id="' + esc(e.id) + '"' + (cc.pins.length < 2 ? ' disabled' : '') + '>Add a string from here</button>' +
        '<button class="btn small" data-action="cc-raise-node" data-id="' + esc(e.id) + '">Raise a lead about this</button><button class="btn small danger" data-action="cc-pin-del" data-id="' + esc(e.id) + '">Remove from the board</button></div>';
    } else if (st.sel && st.sel.kind === 'edge') {
      var t = cc.strings.filter(function (x) { return x.id === st.sel.id; })[0];
      if (t) {
        h += '<h3>String</h3><p>' + esc(name(t.a)) + ' <span class="rel">— ' + esc(t.label || 'connected') + ' —</span> ' + esc(name(t.b)) + '</p><div class="group-label">Reports behind it</div><ul class="plain">' +
          t.reportIds.map(function (rid) { var r = idx.report[rid] || {}; return '<li>' + A.repLink(rid) + (r.dupOf ? ' <span class="tag">repost of ' + esc(r.dupOf) + '</span>' : '') + ' <span class="muted small">' + esc(r.sourceType || '') + ' · ' + esc(CI.reportDate(r)) + '</span><div class="muted small">' + esc(A.trunc(r.summary || '', 120)) + '</div></li>'; }).join('') + '</ul>';
        if (g.flags.edges[t.id]) h += '<div class="group-label">Next: open leads about both files</div>' + leadItems(g.flags.edges[t.id]);
        h += '<div class="stack"><button class="btn small" data-action="cc-string-edit" data-id="' + esc(t.id) + '">Change label or reports</button><button class="btn small" data-action="cc-raise-edge" data-id="' + esc(t.id) + '">Raise a lead about this</button><button class="btn small danger" data-action="cc-string-del" data-id="' + esc(t.id) + '">Remove string</button></div>';
      }
    }
    if (!h) h = '<h3>Details</h3><p class="muted small">Click a pin or a string. Pin files from the left, then add strings. Each string needs a report behind it. Orange marks what an open lead is still chasing.</p>';
    var open = (g.openLeads || []);
    if (open.length) h += '<h3 class="sep">Open leads (' + open.length + ')</h3>' + leadItems(open.map(function (l) { return l.id; }));
    box.innerHTML = h;
  }

  /* ---------- pins ---------- */
  H['cc-pin-add'] = function (el) {
    var id = parseEntity(el.value); if (!id) { A.toast('No file matches that.', true); return; }
    var res = CI.addPin(D(), inv(), id); if (res.error) { A.toast(res.error, true); return; }
    A.persist(); shell();
  };
  H['cc-pick-node'] = function (el) { var id = el.getAttribute('data-id'); st.sel = { kind: 'node', id: id }; if (CI.chart.cy) { CI.chart.cy.$(':selected').unselect(); CI.chart.cy.getElementById(id).select(); CI.chart.focus(id); } detail(); };
  H['cc-pick-edge'] = function (el) { var id = el.getAttribute('data-id'); st.sel = { kind: 'edge', id: id }; if (CI.chart.cy) { CI.chart.cy.$(':selected').unselect(); CI.chart.cy.getElementById(id).select(); CI.chart.focus(id); } detail(); };
  H['cc-pin-del'] = function (el) {
    var id = el.getAttribute('data-id'), n = CI.caseChartOf(inv()).strings.filter(function (t) { return t.a === id || t.b === id; }).length;
    A.confirm('Take ' + name(id) + ' off the board' + (n ? ' along with its ' + n + ' string' + (n === 1 ? '' : 's') : '') + '? The master file is not changed.', function () {
      CI.removePin(D(), inv(), id); A.persist(); st.sel = null; shell();
    }, { title: 'Remove from the board', yes: 'Remove', danger: true });
  };

  /* ---------- strings ---------- */
  function reportRow(rid, on) {
    var r = A.idx().report[rid] || {};
    return '<label class="chk"><input type="checkbox" data-id="' + esc(rid) + '" class="cs-r"' + (on ? ' checked' : '') + '> <b>' + esc(rid) + '</b> <span class="muted small">' + esc(r.sourceType || '') + ' · ' + esc(CI.reportDate(r)) + ' · ' + esc(A.trunc(r.summary || '', 90)) + '</span></label>';
  }
  function stringModal() {
    var f = st.form, cc = CI.caseChartOf(inv()), pins = cc.pins.filter(function (p) { return ent(p.entityId); });
    var opts = function (sel) { return A.options(pins.map(function (p) { return { value: p.entityId, label: name(p.entityId) }; }), sel); };
    var rs = f.a && f.b && f.a !== f.b ? CI.reportsForString(D(), f.a, f.b, A.idx()) : { both: [], one: [] };
    var h = '<h2>' + (f.edit ? 'Change string' : 'Add a string') + '</h2><div class="form"><datalist id="cs-types">' + D().settings.linkTypes.map(function (t) { return '<option value="' + esc(t.label) + '">'; }).join('') + '</datalist>' +
      '<div class="grid2"><label>From<select id="cs-a" data-on-change="cs-pair"' + (f.edit ? ' disabled' : '') + '>' + opts(f.a) + '</select></label><label>To<select id="cs-b" data-on-change="cs-pair"' + (f.edit ? ' disabled' : '') + '>' + opts(f.b) + '</select></label></div>' +
      '<label>What connects them <span class="hint">a few words, such as “paid by” or “same address”</span><input type="text" id="cs-label" list="cs-types" value="' + esc(f.label) + '"></label>' +
      '<div class="group-label">Reports behind it <span class="hint">choose at least one</span></div>';
    if (f.a === f.b) h += '<p class="muted small">Choose two different files.</p>';
    else if (!rs.both.length && !rs.one.length) h += '<p class="muted small">No report names either file, so there is nothing to base a string on.</p>';
    else {
      if (rs.both.length) h += '<div class="small muted">Name both files</div>' + rs.both.map(function (r) { return reportRow(r, !!f.ids[r]); }).join('');
      if (rs.one.length) h += '<div class="small muted" style="margin-top:6px">Name one of them</div>' + rs.one.map(function (r) { return reportRow(r, !!f.ids[r]); }).join('');
    }
    h += '</div><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="cs-save">' + (f.edit ? 'Save' : 'Add string') + '</button></div>';
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
    A.confirm('Remove this string? The reports behind it are not changed.', function () { CI.removeString(D(), inv(), id); A.persist(); st.sel = null; ctl(); draw(); }, { title: 'Remove string', yes: 'Remove', danger: true });
  };

  /* ---------- leads ---------- */
  function raise(question, about, rids) {
    var ids = (rids || []).filter(function (r) { return A.idx().report[r]; });
    CI.views.openLead({ bankId: inv().bankId, question: question, about: about, raisedBy: ids[ids.length - 1] || '' });
  }
  H['cc-raise'] = function () { CI.views.openLead({ bankId: inv().bankId }); };
  H['cc-raise-node'] = function (el) { var id = el.getAttribute('data-id'); raise('Who or what is ' + name(id) + '?', [id], (A.idx().reportsByEntity[id] || []).slice().sort()); };
  H['cc-raise-edge'] = function (el) {
    var t = CI.caseChartOf(inv()).strings.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!t) return;
    raise('What is behind “' + (t.label || 'the connection') + '” between ' + name(t.a) + ' and ' + name(t.b) + '?', [t.a, t.b], t.reportIds.slice().sort());
  };

  /* ---------- view tools ---------- */
  H['cc-fit'] = function () { CI.chart.fit(); };
  H['cc-relayout'] = function () {
    if (!CI.chart.cy || !st.graph) return;
    CI.chart.relayout('cose', st.graph.graph);
    var pins = CI.caseChartOf(inv()).pins;
    CI.chart.cy.nodes().forEach(function (n) { var p = n.position(), pin = pins.filter(function (x) { return x.entityId === n.id(); })[0]; if (pin) { pin.x = Math.round(p.x); pin.y = Math.round(p.y); } });
    A.persist();
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
    CI.tiledChart({ chart: CI.chart, bankName: 'Case chart ' + v.id, paper: pr.paper, orientation: pr.orientation, cols: pr.cols, rows: pr.rows, quality: pr.quality,
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
