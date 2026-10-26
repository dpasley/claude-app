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
      '<p class="muted">An investigation begins when a bank and its estimate are handed over. This is where executives see what is being worked and how far it has got.</p>';
    if (!d.investigations.length) h += '<div class="card callout"><strong>None yet.</strong> Hand over a bank from its <a href="#/chart">estimate</a> to start one.</div>';
    else h += '<div class="card flush"><table><thead><tr><th>ID</th><th>Bank</th><th>Status</th><th>Investigator</th><th>Handed over</th><th class="num">Open leads</th><th>Legal on plan</th><th>Case chart</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (v) {
        var b = bank(v.bankId), open = d.leads.filter(function (l) { return l.bankId === v.bankId && !CI.isClosed(l); }).length;
        return '<tr><td><a href="#/investigation/' + esc(v.id) + '">' + esc(v.id) + '</a></td><td>' + esc(b ? b.name : '(bank removed)') + '</td><td>' + invTag(v) + '</td><td>' + esc(v.investigator || '') + '</td><td>' + esc(CI.fmtShort(v.opened)) + '</td><td class="num">' + open + '</td><td>' + legalTag(v.plan) + '</td><td><a href="#/casechart/' + esc(v.id) + '">' + (CI.caseChartOf(v).pins.length ? CI.caseChartOf(v).pins.length + ' pinned' : 'Open') + '</a></td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">No investigations match.</td></tr>') + '</tbody></table></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['inv-filter'] = function () { iv.show = val('inv-show'); CI.views.investigations(); };

  function actionRows(p) {
    var acts = p.actions.slice(); for (var k = 0; k < 3; k++) acts.push({ text: '', owner: '' });
    return acts.map(function (a, i) {
      return '<div class="grid2 act-row" style="grid-template-columns:minmax(0,3fr) minmax(0,1fr);margin-bottom:8px"><input type="text" id="pl-a' + i + '" placeholder="Action ' + (i + 1) + '" value="' + esc(a.text) + '"><input type="text" id="pl-o' + i + '" placeholder="Owner" value="' + esc(a.owner) + '"></div>';
    }).join('');
  }

  CI.views.investigation = function (id) {
    var d = D(), v = d.investigations.filter(function (x) { return x.id === id; })[0];
    if (!v) { A.view.innerHTML = '<div class="card callout">No such investigation. <a href="#/investigations">Back to investigations</a></div>'; return; }
    var b = bank(v.bankId), p = v.plan, cc = CI.caseChartOf(v), leads = d.leads.filter(function (l) { return l.bankId === v.bankId; });
    var h = '<div class="page-head"><h1>Investigation ' + esc(v.id) + ' ' + invTag(v) + '</h1><div class="row wrap"><a class="btn primary" href="#/casechart/' + esc(v.id) + '">Case chart</a><a class="btn" href="#/chart/' + esc(v.bankId) + '">Working chart</a><a class="btn" href="#/estimate/' + esc(v.bankId) + '">Estimate</a><a class="btn" href="#/investigations">All investigations</a></div></div>' +
      '<p class="muted">Bank: <b>' + esc(b ? b.name : '(bank removed)') + '</b>' + (b && b.opened.reason ? ' · opened because: ' + esc(b.opened.reason) : '') + '</p>' +
      '<form class="card form" onsubmit="return false"><div class="grid2"><label>Status<select id="iv-status">' + A.options(CI.INV_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), v.status) + '</select></label>' +
      '<label>Investigator<input type="text" id="iv-who" value="' + esc(v.investigator) + '"></label></div>' +
      '<label>Notes<textarea id="iv-notes" rows="3">' + esc(v.notes) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" data-action="inv-save" data-id="' + esc(v.id) + '">Save</button><span class="muted small">Handed over ' + esc(CI.fmtDate(v.opened)) + (v.closed ? ' · closed ' + esc(CI.fmtDate(v.closed)) : '') + '</span></div></form>' +
      '<div class="card"><h3>Case chart</h3><p class="muted small">' + (cc.pins.length ? cc.pins.length + ' name' + (cc.pins.length === 1 ? '' : 's') + ' pinned, ' + cc.strings.length + ' string' + (cc.strings.length === 1 ? '' : 's') + '.' : 'Nothing pinned yet.') + ' The investigators build this board to show what has been found and what is next.</p><div class="row"><a class="btn small" href="#/casechart/' + esc(v.id) + '">Open the case chart</a></div></div>' +
      '<div class="card"><h3>Leads (' + leads.length + ')</h3>' + (leads.length ? '<ul class="plain">' + leads.map(function (l) { return '<li><a href="#/lead/' + esc(l.id) + '">' + esc(l.id) + '</a> ' + esc(A.trunc(l.question, 90)) + ' <span class="muted small">' + esc(l.with) + ' · ' + esc(CI.leadStatus(l.status).label) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted small">No leads yet.</p>') +
      '<div class="row"><button class="btn small" data-action="inv-raise" data-bank="' + esc(v.bankId) + '">Raise a lead</button></div></div>' +
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
  function invOf(el) { return D().investigations.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; }
  H['inv-save'] = function (el) {
    var v = invOf(el); if (!v) return;
    v.status = val('iv-status'); v.investigator = val('iv-who').trim(); v.notes = val('iv-notes').trim();
    if (v.status === 'CLOSED' && !v.closed) v.closed = CI.today(); if (v.status !== 'CLOSED') v.closed = '';
    A.persist(); A.toast('Saved.'); CI.views.investigation(v.id);
  };
  H['inv-raise'] = function (el) { CI.views.openLead({ bankId: el.getAttribute('data-bank') }); };
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
