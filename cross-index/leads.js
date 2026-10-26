/* Leads (investigations and data requests) and the estimate of the situation. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var ls = { bank: '', show: 'open' };
  function D() { return A.data(); }
  function bankName(id) { var b = D().banks.filter(function (x) { return x.id === id; })[0]; return b ? b.name : '(bank removed)'; }
  function statusTag(l) {
    var s = CI.leadStatus(l.status), cls = l.status === 'DONE' || l.status === 'NO_RESULT' ? 'ok' : (l.status === 'IN_PROGRESS' ? 'warn' : '');
    return '<span class="tag ' + cls + '">' + esc(s.label) + '</span>';
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  /* Saving a generated file goes through the page's download permission when hosted. */
  function saveBlob(name, make) {
    var blob;
    try { blob = make(); } catch (e) { A.toast(e.message || 'Could not build the PDF.', true); return; }
    CI.saveFile(name, blob).then(function (r) {
      if (r.status === 'saved') A.toast('Saved ' + name + '.');
      else if (r.status === 'unavailable') A.toast('Saving files is not available in this view.', true);
    }, function (e) { A.toast(e.message, true); });
  }
  CI.app.saveBlob = saveBlob;

  /* ---------- list ---------- */
  CI.views.leads = function () {
    var d = D(), rows = d.leads.slice().sort(function (a, b) { return b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id); })
      .filter(function (l) { return (!ls.bank || l.bankId === ls.bank) && (ls.show === 'all' || !CI.isClosed(l)); });
    var open = d.leads.filter(function (l) { return !CI.isClosed(l); }).length;
    var h = '<div class="page-head"><h1>Leads</h1><div class="row wrap"><button class="btn primary" data-action="lead-new">New lead</button></div></div>' +
      '<div class="card"><div class="row wrap"><select data-on-change="lead-filter" id="ld-bank">' + A.options(d.banks.map(function (b) { return { value: b.id, label: b.name }; }), ls.bank, 'All banks') + '</select>' +
      '<select data-on-change="lead-filter" id="ld-show">' + A.options([{ value: 'open', label: 'Open leads' }, { value: 'all', label: 'All leads' }], ls.show) + '</select>' +
      '<span class="spacer"></span><span class="muted small">' + open + ' open of ' + d.leads.length + '</span></div>' +
      '<div class="row wrap" style="margin-top:10px"><button class="btn small" data-action="lead-board"' + (ls.bank ? '' : ' disabled') + '>Open-leads board (PDF)</button>' +
      '<button class="btn small" data-action="lead-sheets"' + (ls.bank ? '' : ' disabled') + '>All open lead sheets (PDF)</button>' +
      (ls.bank ? '' : '<span class="muted small">Choose a bank to print its board or sheets.</span>') + '</div></div>';
    if (!d.leads.length) h += '<div class="card callout"><strong>No leads yet.</strong> A lead is a question that comes out of a bank and its estimate. It goes to Investigations to find out, or to Collection as a request to retrieve something. Raise one from a report, or from the chart.</div>';
    else h += '<div class="card flush"><table><thead><tr><th>Lead</th><th>Question</th><th>Bank</th><th>With</th><th>Issued</th><th>Status</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (l) {
        return '<tr><td><a href="#/lead/' + esc(l.id) + '">' + esc(l.id) + '</a></td><td>' + esc(A.trunc(l.question, 110)) + '<div class="muted small">' + esc(CI.leadKind(l.kind).title) + '</div></td><td>' + esc(bankName(l.bankId)) + '</td><td>' + esc(l.with) + '</td><td>' + esc(CI.fmtShort(l.issued)) + '</td><td>' + statusTag(l) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">No leads match.</td></tr>') + '</tbody></table></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['lead-filter'] = function () { ls.bank = val('ld-bank'); ls.show = val('ld-show'); CI.views.leads(); };
  H['lead-board'] = function () { saveBlob('Open-leads-' + CI.fileSafe(bankName(ls.bank)) + '.pdf', function () { return CI.pdf.board(D(), ls.bank); }); };
  H['lead-sheets'] = function () {
    var ids = D().leads.filter(function (l) { return l.bankId === ls.bank && !CI.isClosed(l); }).map(function (l) { return l.id; });
    if (!ids.length) { A.toast('That bank has no open leads.', true); return; }
    saveBlob('Lead-sheets-' + CI.fileSafe(bankName(ls.bank)) + '.pdf', function () { return CI.pdf.leadSheets(D(), ids); });
  };

  /* ---------- create ---------- */
  CI.views.openLead = function (pre) {
    pre = pre || {};
    var d = D();
    if (!d.banks.length) { A.toast('Make a bank on the Chart screen first. A lead belongs to a bank.', true); return; }
    if (!d.reports.length) { A.toast('Add a report first. Every lead says which report raised it.', true); return; }
    var bankId = pre.bankId || d.ui.bankId || d.banks[0].id, kind = pre.kind || 'INVESTIGATION';
    var reps = d.reports.slice().sort(function (a, b) { return b.id.localeCompare(a.id); }).map(function (r) { return { value: r.id, label: r.id + ' – ' + A.trunc(r.summary || '', 70) }; });
    A.modal('<h2>New lead</h2><div class="form">' +
      '<div class="grid2"><label>Bank<select id="nl-bank">' + A.options(d.banks.map(function (b) { return { value: b.id, label: b.name }; }), bankId) + '</select></label>' +
      '<label>Kind<select id="nl-kind" data-on-change="lead-kind">' + A.options(CI.LEAD_KINDS.map(function (k) { return { value: k.id, label: k.title }; }), kind) + '</select></label></div>' +
      '<div class="grid2"><label>With<select id="nl-with">' + A.options(CI.LEAD_WITH.map(function (w) { return { value: w, label: w }; }), pre.with || (kind === 'DATA_REQUEST' ? 'Collection' : 'Investigations')) + '</select></label>' +
      '<label>Issued ' + A.dateInput('nl-issued', pre.issued || CI.today()) + '</label></div>' +
      '<label>Question <span class="hint">one clear question, or the thing to retrieve</span><textarea id="nl-q" rows="3">' + esc(pre.question || '') + '</textarea></label>' +
      '<label>Raised by report<select id="nl-rep">' + A.options(reps, pre.raisedBy || '', 'Choose a report') + '</select></label>' +
      '<p class="muted small" id="nl-note">' + (pre.about && pre.about.length ? 'About: ' + esc(pre.about.map(function (id) { var e = A.idx().entity[id]; return e ? e.name : id; }).join(', ')) : '') + '</p>' +
      '</div><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="lead-create">Create lead</button></div>');
    CI.views._leadAbout = pre.about || [];
    var q = document.getElementById('nl-q'); if (q) q.focus();
  };
  H['lead-kind'] = function (el) { var w = document.getElementById('nl-with'); if (w) w.value = el.value === 'DATA_REQUEST' ? 'Collection' : 'Investigations'; };
  H['lead-new'] = function () { CI.views.openLead({ bankId: ls.bank || undefined }); };
  H['lead-create'] = function () {
    var iss = A.readDate('nl-issued');
    if (iss === null) { A.toast('Issued: ' + A.dateHelp, true); return; }
    var res = CI.addLead(D(), { bankId: val('nl-bank'), kind: val('nl-kind'), with: val('nl-with'), question: val('nl-q'), raisedBy: val('nl-rep'), issued: iss || CI.today(), about: CI.views._leadAbout });
    if (res.error) { A.toast(res.error, true); return; }
    A.persist(); A.closeModal(); A.toast('Lead ' + res.lead.id + ' created.'); A.go('#/lead/' + res.lead.id);
  };

  /* ---------- one lead ---------- */
  CI.views.lead = function (id) {
    var d = D(), l = d.leads.filter(function (x) { return x.id === id; })[0];
    if (!l) { A.view.innerHTML = '<div class="card callout">No such lead. <a href="#/leads">Back to leads</a></div>'; return; }
    var reps = d.reports.slice().sort(function (a, b) { return b.id.localeCompare(a.id); }).map(function (r) { return { value: r.id, label: r.id + ' – ' + A.trunc(r.summary || '', 70) }; });
    var results = CI.leadResults(d, l.id), raised = A.idx().report[l.raisedBy];
    var h = '<div class="page-head"><h1>Lead ' + esc(l.id) + ' ' + statusTag(l) + '</h1><div class="row wrap"><button class="btn" data-action="lead-sheet-one" data-id="' + esc(l.id) + '">Lead sheet (PDF)</button><a class="btn" href="#/leads">All leads</a></div></div>' +
      '<form class="card form" onsubmit="return false"><div class="grid2"><label>Bank<select id="ld-f-bank">' + A.options(d.banks.map(function (b) { return { value: b.id, label: b.name }; }), l.bankId) + '</select></label>' +
      '<label>Issued ' + A.dateInput('ld-f-issued', l.issued) + '</label></div>' +
      '<div class="grid2"><label>Kind<select id="ld-f-kind">' + A.options(CI.LEAD_KINDS.map(function (k) { return { value: k.id, label: k.title }; }), l.kind) + '</select></label>' +
      '<label>With<select id="ld-f-with">' + A.options(CI.LEAD_WITH.map(function (w) { return { value: w, label: w }; }), l.with) + '</select></label></div>' +
      '<label>Question<textarea id="ld-f-q" rows="3">' + esc(l.question) + '</textarea></label>' +
      '<label>Raised by report<select id="ld-f-rep">' + A.options(reps, l.raisedBy) + '</select></label>' +
      (raised ? '<p class="muted small" style="margin-top:-6px">' + esc(raised.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(raised))) + ' · ' + esc(A.trunc(raised.summary || '', 140)) + ' <a href="#/report/' + esc(raised.id) + '">Open report</a></p>' : '') +
      (l.about && l.about.length ? '<p class="small">About: ' + l.about.map(function (e) { return A.entLink(e); }).join(', ') + '</p>' : '') +
      '<label>Status<select id="ld-f-status">' + A.options(CI.LEAD_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), l.status) + '</select></label>' +
      '<label>Response <span class="hint">what came back, in a few words</span><textarea id="ld-f-resp" rows="4">' + esc(l.response) + '</textarea></label>' +
      '<div class="grid2"><label>Returned by<input type="text" id="ld-f-by" value="' + esc(l.returnedBy) + '"></label><label>Returned on ' + A.dateInput('ld-f-ret', l.returnedDate) + '</label></div>' +
      '<div class="row"><button class="btn primary" data-action="lead-save" data-id="' + esc(l.id) + '">Save</button></div></form>' +
      '<div class="card"><h3>Results that came back</h3>' + (results.length ? '<ul class="plain">' + results.map(function (r) { return '<li>' + A.repLink(r.id) + ' <span class="muted">' + esc(r.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(r))) + '</span><div class="small">' + esc(A.trunc(r.summary || '', 140)) + '</div></li>'; }).join('') + '</ul>' : '<p class="muted small">None yet. What comes back is filed through Intake like any other report.</p>') +
      '<div class="row"><button class="btn" data-action="lead-result" data-id="' + esc(l.id) + '">File a result as a new report</button></div></div>' +
      '<div class="card"><h3>Housekeeping</h3><button class="btn danger" data-action="lead-del" data-id="' + esc(l.id) + '">Delete this lead</button></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['lead-save'] = function (el) {
    var d = D(), l = d.leads.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!l) return;
    var q = val('ld-f-q').trim(); if (!q) { A.toast('Write the question.', true); return; }
    var iss = A.readDate('ld-f-issued'), ret = A.readDate('ld-f-ret');
    if (iss === null || ret === null) { A.toast((iss === null ? 'Issued: ' : 'Returned on: ') + A.dateHelp, true); return; }
    l.bankId = val('ld-f-bank'); l.issued = iss || l.issued; l.kind = val('ld-f-kind'); l.with = val('ld-f-with'); l.question = q;
    l.raisedBy = val('ld-f-rep'); l.status = val('ld-f-status'); l.response = val('ld-f-resp').trim(); l.returnedBy = val('ld-f-by').trim(); l.returnedDate = ret;
    A.persist(); A.toast('Lead saved.'); CI.views.lead(l.id);
  };
  H['lead-del'] = function (el) {
    var id = el.getAttribute('data-id');
    A.confirm('Delete lead ' + id + '? Reports filed against it are kept.', function () { CI.deleteLead(D(), id); A.persist(); A.closeModal(); A.go('#/leads'); }, { title: 'Delete lead', yes: 'Delete', danger: true });
  };
  H['lead-sheet-one'] = function (el) { var id = el.getAttribute('data-id'); saveBlob('Lead-' + id + '.pdf', function () { return CI.pdf.leadSheets(D(), [id]); }); };
  H['lead-result'] = function (el) {
    var l = D().leads.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!l) return;
    A.startReport({ leadId: l.id, sourceType: l.with === 'Investigations' ? 'Investigator report' : '' });
  };

  /* ---------- estimate of the situation (one of the special bank's estimates) ---------- */
  CI.views.estimate = function (bankId, estId) {
    var d = D(), b = d.banks.filter(function (x) { return x.id === bankId; })[0];
    if (!b) { A.view.innerHTML = '<div class="card callout">No such special bank. <a href="#/chart">Back to special banks</a></div>'; return; }
    var est = CI.estimateOf(b, estId), ests = est.items.filter(function (i) { return i.kind === 'ESTABLISHED'; }), hyp = est.items.filter(function (i) { return i.kind === 'HYPOTHESIS'; });
    function list(items) {
      return items.length ? '<ul class="plain">' + items.map(function (it) {
        return '<li>' + esc(it.text) + (it.reportIds.length ? '<div class="muted small">Based on ' + it.reportIds.map(function (r) { return A.repLink(r); }).join(', ') + '</div>' : '') +
          ' <button class="btn small" data-action="est-del" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '" data-id="' + esc(it.id) + '">Remove</button></li>';
      }).join('') + '</ul>' : '<p class="muted small">None yet.</p>';
    }
    var handed = b.handedOver && b.handedOverEstimate === est.id;
    var h = CI.views.bankHead(b, 'estimates') +
      '<h2 class="sub-h">' + esc(est.label) + (handed ? ' <span class="tag">handed over</span>' : '') + ' <button class="btn small" data-action="est-rename" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '">Rename</button></h2>' +
      '<form class="card form" onsubmit="return false"><label>Summary <span class="hint">where things stand, in a few plain sentences</span><textarea id="est-sum" rows="5">' + esc(est.summary) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" data-action="est-save" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '">Save summary</button>' + (est.updated ? '<span class="muted small">Updated ' + esc(CI.fmtDate(est.updated)) + '</span>' : '') + '</div></form>' +
      '<div class="card"><h3>What the files establish</h3>' + list(ests) + '<h3 class="sep">Working theories (not yet established)</h3>' + list(hyp) + '</div>' +
      '<form class="card form" onsubmit="return false"><h3>Add a statement</h3><div class="grid2"><label>Kind<select id="est-kind">' + A.options(CI.ESTIMATE_KINDS.map(function (k) { return { value: k.id, label: k.label }; }), 'ESTABLISHED') + '</select></label>' +
      '<label>Reports it rests on <span class="hint">e.g. R-0003, R-0007 (required if established)</span><input type="text" id="est-reps" placeholder="R-0001, R-0002"></label></div>' +
      '<label>Statement<textarea id="est-text" rows="2"></textarea></label><div class="row"><button class="btn" data-action="est-add" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '">Add</button></div></form>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  function bankOf(el) { return D().banks.filter(function (x) { return x.id === el.getAttribute('data-bank'); })[0]; }
  function estOf(el) { var b = bankOf(el); return b ? CI.estimateOf(b, el.getAttribute('data-est')) : null; }
  H['est-save'] = function (el) { var b = bankOf(el), e = estOf(el); e.summary = val('est-sum').trim(); e.updated = CI.today(); A.persist(); A.toast('Summary saved.'); CI.views.estimate(b.id, e.id); };
  H['est-rename'] = function (el) {
    var b = bankOf(el), e = estOf(el);
    A.ask('Name for this estimate?', e.label, function (n) { e.label = n; A.persist(); CI.views.estimate(b.id, e.id); }, { title: 'Rename estimate', ok: 'Rename' });
  };
  H['est-add'] = function (el) {
    var b = bankOf(el), e = estOf(el), res = CI.addEstimateItem(D(), b, { kind: val('est-kind'), text: val('est-text'), reportIds: val('est-reps') }, e);
    if (res.error) { A.toast(res.error, true); return; }
    A.persist(); CI.views.estimate(b.id, e.id);
  };
  H['est-del'] = function (el) { var b = bankOf(el), e = estOf(el), id = el.getAttribute('data-id'); e.items = e.items.filter(function (i) { return i.id !== id; }); A.persist(); CI.views.estimate(b.id, e.id); };
  H['est-handover'] = function (el) {
    var b = bankOf(el), sel = document.getElementById('ho-est'), estId = sel ? sel.value : '';
    A.confirm('Freeze “' + b.name + '” as it stands and hand it to Investigations with ' + CI.estimateOf(b, estId).label + '? This opens an investigation for it.', function () { CI.handOver(D(), b, estId); A.persist(); A.closeModal(); A.toast('Handed over. A snapshot was saved.'); A.go('#/bank/' + b.id + '/estimates'); }, { title: 'Hand over', yes: 'Hand over' });
  };
  H['lead-new-bank'] = function (el) { CI.views.openLead({ bankId: el.getAttribute('data-bank') }); };
})();
