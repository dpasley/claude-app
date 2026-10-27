/* Investigations: status of the work after hand-over, and the handling plan with legal clearance. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var iv = { show: 'open' };
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function bank(id) { return D().banks.filter(function (b) { return b.id === id; })[0]; }
  function invTag(v) { var s = CI.invStatus(v.status); return '<span class="tag ' + (v.status === 'CLOSED' ? 'ok' : (v.status === 'HANDED_OVER' ? '' : 'warn')) + '">' + esc(s.label) + '</span>'; }
  function legalTag(p) { var s = CI.legalStatus(p.legal.status); return '<span class="tag ' + (CI.isCleared(p) ? 'ok' : (p.legal.status === 'RETURNED' ? 'hot' : (p.legal.status === 'WITH_LEGAL' ? 'warn' : ''))) + '">' + esc(s.label) + '</span>'; }

  CI.views.investigations = function () {
    var d = D(), rows = d.investigations.slice().sort(function (a, b) { return b.opened.localeCompare(a.opened) || b.id.localeCompare(a.id); }).filter(function (v) { return iv.show === 'all' || v.status !== 'CLOSED'; });
    var h = '<div class="page-head"><h1>Investigations</h1><div class="row"><select data-on-change="inv-filter" id="inv-show">' + A.options([{ value: 'open', label: 'Open investigations' }, { value: 'all', label: 'All investigations' }], iv.show) + '</select></div></div>' +
      '<p class="muted">An investigation begins when a special bank and its estimate are handed over. This is where executives see what is being worked and how far it has got.</p>';
    if (!d.investigations.length) h += '<div class="card callout"><strong>None yet.</strong> Hand over a special bank from its <a href="#/chart">Estimates tab</a> to start one.</div>';
    else h += '<div class="card flush"><table><thead><tr><th>ID</th><th>Bank</th><th>Status</th><th>Investigator</th><th>Handed over</th><th class="num">Open leads</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (v) {
        var b = bank(v.bankId), open = CI.leadsOf(d, v.id).filter(function (l) { return !CI.isClosed(l); }).length;
        return '<tr><td><a href="#/investigation/' + esc(v.id) + '">' + esc(v.id) + '</a></td><td>' + esc(b ? b.name : '(bank removed)') + '</td><td>' + invTag(v) + '</td><td>' + esc(v.investigator || '') + '</td><td>' + esc(CI.fmtShort(v.opened)) + '</td><td class="num">' + open + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">No investigations match.</td></tr>') + '</tbody></table></div>';
    var orphans = d.leads.concat(d.requests).filter(function (l) { return !l.investigationId || !d.investigations.some(function (v) { return v.id === l.investigationId; }); });
    if (orphans.length) h += '<div class="card"><h2>Not attached to an investigation (' + orphans.length + ')</h2><p class="muted small">Leads and requests belong to an investigation. These were made before that rule. Attach each to one, or delete it.</p><table class="fixed"><colgroup><col style="width:10%"><col style="width:52%"><col style="width:38%"></colgroup><tbody>' +
      orphans.map(function (l) {
        return '<tr><td><a href="#/lead/' + esc(l.id) + '">' + esc(l.id) + '</a></td><td class="ellip">' + esc(l.question) + '</td><td class="right"><select id="at-' + esc(l.id) + '">' + A.options(d.investigations.map(function (v) { var b = bank(v.bankId); return { value: v.id, label: v.id + ' ' + (b ? b.name : '') }; }), '', 'Choose…') + '</select> <button class="btn small" data-action="lead-attach" data-id="' + esc(l.id) + '">Attach</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['lead-attach'] = function (el) {
    var id = el.getAttribute('data-id'), l = CI.findLead(D(), id), vid = val('at-' + id), v = D().investigations.filter(function (x) { return x.id === vid; })[0];
    if (!l || !v) { A.toast('Choose an investigation.', true); return; }
    l.investigationId = v.id; l.bankId = v.bankId; A.persist(); CI.views.investigations();
  };
  H['inv-filter'] = function () { iv.show = val('inv-show'); CI.views.investigations(); };

  function actionRows(p) {
    var acts = p.actions.slice(); for (var k = 0; k < 3; k++) acts.push({ text: '', owner: '' });
    return acts.map(function (a, i) {
      return '<div class="grid2 act-row" style="grid-template-columns:minmax(0,3fr) minmax(0,1fr);margin-bottom:8px"><input type="text" id="pl-a' + i + '" placeholder="Action ' + (i + 1) + '" value="' + esc(a.text) + '"><input type="text" id="pl-o' + i + '" placeholder="Owner" value="' + esc(a.owner) + '"></div>';
    }).join('');
  }

  /* Tabs shared by the investigation pages (the chart tab is drawn by casechart.js). */
  CI.views.invTabs = function (v, active) {
    var d = D(), nl = CI.leadsOf(d, v.id).length, nq = CI.requestsOf(d, v.id).length;
    function t(id, href, label, n) { return '<a class="tab' + (active === id ? ' on' : '') + '" href="' + href + '">' + label + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</a>'; }
    return '<div class="tabs">' + t('overview', '#/investigation/' + v.id, 'Overview') + t('chart', '#/casechart/' + v.id, 'Chart') + t('leads', '#/investigation/' + v.id + '/leads', 'Leads', nl) + t('requests', '#/investigation/' + v.id + '/requests', 'Requests', nq) + '</div>';
  };
  CI.views.invHead = function (v) {
    var b = bank(v.bankId);
    return '<div class="chart-head"><a href="#/investigations" class="back">\u2039 Investigations</a><h1>Investigation ' + esc(v.id) + '</h1>' + invTag(v) + (b ? '<span class="muted small">' + esc(b.name) + '</span>' : '') + '</div>';
  };
  CI.views.investigation = function (id, tab) {
    var d = D(), v = d.investigations.filter(function (x) { return x.id === id; })[0];
    if (!v) { A.view.innerHTML = '<div class="card callout">No such investigation. <a href="#/investigations">Back to investigations</a></div>'; return; }
    var b = bank(v.bankId), p = v.plan, cc = CI.caseChartOf(v), leads = CI.leadsOf(d, v.id), reqs = CI.requestsOf(d, v.id);
    tab = tab === 'leads' || tab === 'requests' ? tab : 'overview';
    var h = '<div class="page-head"><h1>Investigation ' + esc(v.id) + ' ' + invTag(v) + '</h1><div class="row wrap"><a class="btn" href="#/chart/' + esc(v.bankId) + '">Working chart</a><a class="btn" href="#/bank/' + esc(v.bankId) + '/estimates">Estimates</a><a class="btn" href="#/investigations">All investigations</a></div></div>' +
      '<p class="muted">Bank: <b>' + esc(b ? b.name : '(bank removed)') + '</b>' + (b && b.opened.reason ? ' · opened because: ' + esc(b.opened.reason) : '') + '</p>' +
      CI.views.invTabs(v, tab);
    if (tab !== 'overview') { A.view.className = ''; A.view.innerHTML = h + (tab === 'leads' ? leadsTab(v) : requestsTab(v)); return; }
    h += '<div class="card"><h3>Leads and requests</h3><p class="muted small">' + leads.length + ' lead' + (leads.length === 1 ? '' : 's') + ' (' + leads.filter(function (l) { return !CI.isClosed(l); }).length + ' open) and ' + reqs.length + ' request' + (reqs.length === 1 ? '' : 's') + ' to Collection. <a href="#/investigation/' + esc(v.id) + '/leads">Leads</a> \u00b7 <a href="#/investigation/' + esc(v.id) + '/requests">Requests</a></p></div>' +
      '<form class="card form" onsubmit="return false"><div class="grid2"><label>Status<select id="iv-status">' + A.options(CI.INV_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), v.status) + '</select></label>' +
      '<label>Investigator<input type="text" id="iv-who" value="' + esc(v.investigator) + '"></label></div>' +
      '<label>Notes<textarea id="iv-notes" rows="3">' + esc(v.notes) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" data-action="inv-save" data-id="' + esc(v.id) + '">Save</button><span class="muted small">Handed over ' + esc(CI.fmtDate(v.opened)) + (v.closed ? ' · closed ' + esc(CI.fmtDate(v.closed)) : '') + '</span></div></form>' +
      '<div class="card"><h3>Chart</h3><p class="muted small">' + (cc.pins.length ? cc.pins.length + ' name' + (cc.pins.length === 1 ? '' : 's') + ' pinned, ' + cc.strings.length + ' string' + (cc.strings.length === 1 ? '' : 's') + '.' : 'Nothing pinned yet.') + ' The investigators build this board to show what has been found and what is next.</p><div class="row"><a class="btn small" href="#/casechart/' + esc(v.id) + '">Open the Chart tab</a></div></div>' +
      '<form class="card form" onsubmit="return false"><div class="row spread"><h3 style="margin:0">Handling plan</h3><button class="btn small" data-action="inv-plan-pdf" data-id="' + esc(v.id) + '">Plan sheet (PDF)</button></div>' +
      '<label>Objective <span class="hint">what the plan is meant to achieve</span><textarea id="pl-obj" rows="2">' + esc(p.objective) + '</textarea></label>' +
      '<div class="grid2"><label>Outcome sought<select id="pl-out">' + A.options(CI.PLAN_OUTCOMES.map(function (o) { return { value: o.id, label: o.label }; }), p.outcome) + '</select></label><label>Prepared by<input type="text" id="pl-by" value="' + esc(p.preparedBy) + '"></label></div>' +
      '<div class="group-label" style="margin-top:6px">Actions</div>' + actionRows(p) +
      '<h3 class="sep">Legal clearance (whole plan)</h3><div class="grid2"><label>Status<select id="pl-legal">' + A.options(CI.LEGAL_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), p.legal.status) + '</select></label><label>Reviewed by<input type="text" id="pl-rev" value="' + esc(p.legal.reviewer) + '"></label></div>' +
      '<div class="grid2"><label>Date ' + A.dateInput('pl-ldate', p.legal.date) + '</label><span></span></div>' +
      '<label>Comments or conditions<textarea id="pl-lcom" rows="2">' + esc(p.legal.comments) + '</textarea></label>' +
      '<h3 class="sep">Carrying it out</h3><p class="muted small">Can start only once legal has cleared the plan.</p><div class="grid2"><label>Status<select id="pl-exec">' + A.options(CI.EXEC_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), p.execution.status) + '</select></label><span></span></div>' +
      '<label>Outcome <span class="hint">what happened. Anything that comes back goes through Intake as a report.</span><textarea id="pl-eout" rows="2">' + esc(p.execution.outcome) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" data-action="plan-save" data-id="' + esc(v.id) + '">Save plan</button>' + (p.updated ? '<span class="muted small">Updated ' + esc(CI.fmtDate(p.updated)) + '</span>' : '') + '</div></form>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  /* ----- leads and requests of one investigation ----- */
  function statusTag(l) {
    var s = CI.leadStatus(l.status), cls = l.status === 'DONE' || l.status === 'NO_RESULT' ? 'ok' : (l.status === 'IN_PROGRESS' ? 'warn' : '');
    return '<span class="tag ' + cls + '">' + esc(s.label) + '</span>';
  }
  function printBar(v, kind, n) {
    return '<div class="row"><select id="ll-show" aria-label="What to print"><option value="all">Print all</option><option value="open">Print open only</option></select>' +
      '<button class="btn" data-action="ll-print" data-id="' + esc(v.id) + '" data-kind="' + kind + '"' + (n ? '' : ' disabled') + '>' + (kind === 'request' ? 'Print request list' : 'Print lead list') + '</button></div>';
  }
  function theoryCard(v) {
    var d = D(), b = bank(v.bankId); if (!b) return '';
    var est = CI.estimateOf(b, b.handedOverEstimate), th = est.items.filter(function (i) { return i.kind === 'HYPOTHESIS'; });
    if (!th.length) return '';
    return '<div class="card"><h3>Working theories from the estimate</h3><p class="muted small">The analysts could not establish these. Make a lead of any you want followed up.</p><table class="fixed"><colgroup><col style="width:80%"><col style="width:20%"></colgroup><tbody>' +
      th.map(function (t) {
        var key = est.id + '|' + t.id, taken = d.leads.filter(function (l) { return l.theory === key; })[0];
        return '<tr><td class="ellip" title="' + esc(t.text) + '">' + esc(t.text) + '</td><td class="right">' + (taken ? '<a href="#/lead/' + esc(taken.id) + '">' + esc(taken.id) + '</a>' : '<button class="btn small" data-action="lead-from-theory" data-id="' + esc(v.id) + '" data-est="' + esc(est.id) + '" data-item="' + esc(t.id) + '">Make it a lead</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function leadsTab(v) {
    var d = D(), rows = CI.leadsOf(d, v.id).sort(function (a, b) { return b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id); });
    return '<div class="card"><div class="row spread wrap"><div><b>' + rows.length + '</b> lead' + (rows.length === 1 ? '' : 's') + ', <b>' + rows.filter(function (l) { return !CI.isClosed(l); }).length + '</b> open' +
      '<div class="muted small">A lead is a question the investigators follow up. It needs only its reason.</div></div><div class="row wrap">' + printBar(v, 'lead', rows.length) + '<button class="btn primary" data-action="lead-new" data-id="' + esc(v.id) + '" data-kind="INVESTIGATION">New lead</button></div></div></div>' +
      theoryCard(v) +
      (rows.length ? '<div class="card flush"><table class="fixed"><colgroup><col style="width:9%"><col style="width:45%"><col style="width:16%"><col style="width:12%"><col style="width:18%"></colgroup><thead><tr><th>Lead</th><th>Reason</th><th>Assigned to</th><th>Issued</th><th>Status</th></tr></thead><tbody>' + rows.map(function (l) {
        return '<tr class="click" data-action="lead-open" data-id="' + esc(l.id) + '"><td>' + esc(l.id) + '</td><td class="ellip" title="' + esc(l.question) + '">' + esc(l.question) + '</td><td class="ellip">' + esc(l.assigned || '') + '</td><td>' + esc(CI.fmtDate(l.issued)) + '</td><td>' + statusTag(l) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card"><p class="muted">No leads yet.</p></div>');
  }
  function requestsTab(v) {
    var d = D(), rows = CI.requestsOf(d, v.id).sort(function (a, b) { return b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id); });
    return '<div class="card"><div class="row spread wrap"><div><b>' + rows.length + '</b> request' + (rows.length === 1 ? '' : 's') + ' to Collection, <b>' + rows.filter(function (l) { return !CI.isClosed(l); }).length + '</b> open' +
      '<div class="muted small">A request asks Collection to retrieve and preserve something. What comes back is filed through Intake carrying the request number.</div></div><div class="row wrap">' + printBar(v, 'request', rows.length) + '<button class="btn primary" data-action="lead-new" data-id="' + esc(v.id) + '" data-kind="DATA_REQUEST">New request</button></div></div></div>' +
      (rows.length ? '<div class="card flush"><table class="fixed"><colgroup><col style="width:9%"><col style="width:45%"><col style="width:16%"><col style="width:12%"><col style="width:18%"></colgroup><thead><tr><th>Request</th><th>To retrieve</th><th>For lead</th><th>Issued</th><th>Status</th></tr></thead><tbody>' + rows.map(function (l) {
        return '<tr class="click" data-action="lead-open" data-id="' + esc(l.id) + '"><td>' + esc(l.id) + '</td><td class="ellip" title="' + esc(l.question) + '">' + esc(l.question) + '</td><td>' + esc(l.forLead || '') + '</td><td>' + esc(CI.fmtDate(l.issued)) + '</td><td>' + statusTag(l) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card"><p class="muted">No requests yet.</p></div>');
  }
  H['lead-open'] = function (el) { A.go('#/lead/' + el.getAttribute('data-id')); };
  H['lead-new'] = function (el) { CI.views.openLead({ investigationId: el.getAttribute('data-id'), kind: el.getAttribute('data-kind') }); };
  H['lead-from-theory'] = function (el) {
    var d = D(), v = invOf(el), b = v && bank(v.bankId); if (!b) return;
    var est = CI.estimateOf(b, el.getAttribute('data-est')), it = est.items.filter(function (x) { return x.id === el.getAttribute('data-item'); })[0]; if (!it) return;
    var about = {}; it.reportIds.forEach(function (r) { var rep = A.idx().report[r]; if (rep) rep.entities.forEach(function (x) { if ((b.files || []).indexOf(x.entityId) !== -1) about[x.entityId] = 1; }); });
    CI.views._leadTheory = est.id + '|' + it.id;
    CI.views.openLead({ investigationId: v.id, kind: 'INVESTIGATION', question: 'Is this so? ' + it.text, raisedBy: it.reportIds[0] || '', about: Object.keys(about) });
  };
  H['ll-print'] = function (el) {
    var d = D(), v = invOf(el); if (!v) return;
    var kind = el.getAttribute('data-kind'), open = val('ll-show') === 'open';
    A.saveBlob((kind === 'request' ? 'Request-list-' : 'Lead-list-') + v.id + '.pdf', function () { return CI.pdf.leadList(d, v.id, { kind: kind, openOnly: open }); });
  };
  function invOf(el) { return D().investigations.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; }
  H['inv-save'] = function (el) {
    var v = invOf(el); if (!v) return;
    v.status = val('iv-status'); v.investigator = val('iv-who').trim(); v.notes = val('iv-notes').trim();
    if (v.status === 'CLOSED' && !v.closed) v.closed = CI.today(); if (v.status !== 'CLOSED') v.closed = '';
    A.persist(); A.toast('Saved.'); CI.views.investigation(v.id);
  };
  H['plan-save'] = function (el) {
    var v = invOf(el); if (!v) return;
    var ldate = A.readDate('pl-ldate');
    if (ldate === null) { A.toast('Legal review date: ' + A.dateHelp, true); return; }
    var acts = [], i = 0; while (document.getElementById('pl-a' + i)) { acts.push({ text: val('pl-a' + i), owner: val('pl-o' + i) }); i++; }
    var res = CI.savePlan(D(), v, { objective: val('pl-obj'), outcome: val('pl-out'), preparedBy: val('pl-by'), actions: acts, legalStatus: val('pl-legal'), reviewer: val('pl-rev'), legalDate: ldate, comments: val('pl-lcom'), execStatus: val('pl-exec'), execOutcome: val('pl-eout') });
    if (res.error) { A.toast(res.error, true); return; }
    if (v.plan.legal.status === 'WITH_LEGAL' && v.status !== 'PLAN_WITH_LEGAL' && v.status !== 'CLOSED') v.status = 'PLAN_WITH_LEGAL';
    if (v.plan.execution.status === 'EXECUTING' && v.status !== 'CLOSED') v.status = 'EXECUTING';
    A.persist(); A.toast('Plan saved.'); CI.views.investigation(v.id);
  };
  H['inv-plan-pdf'] = function (el) { var v = invOf(el); if (!v) return; A.saveBlob('Handling-plan-' + v.id + '.pdf', function () { return CI.pdf.planSheet(D(), v.id); }); };
})();
