/* Investigations: opened by handing over a special bank, or on their own; leads, requests and the case chart. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var iv = { show: 'open' };
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function bank(id) { return D().banks.filter(function (b) { return b.id === id; })[0]; }
  function invTag(v) { return '<span class="tag ' + (v.status === 'CLOSED' ? 'ok' : 'warn') + '">' + esc(CI.invStatus(v.status).label) + '</span>'; }
  function invName(v) { var b = bank(v.bankId); return v.title || (b ? b.name : '') || '(untitled)'; }
  CI.views.invName = invName;

  function invPageTabs(active) {
    var n = D().leads.concat(D().requests).filter(function (l) { return !CI.isClosed(l); }).length;
    return '<div class="tabs"><a class="tab' + (active === 'list' ? ' on' : '') + '" href="#/investigations">Investigations</a><a class="tab' + (active === 'register' ? ' on' : '') + '" href="#/investigations/register">Lead register <span class="n">' + n + ' open</span></a></div>';
  }
  CI.views.investigations = function (tab) {
    if (tab === 'register') return register();
    var d = D(), rows = d.investigations.slice().sort(function (a, b) { return b.opened.localeCompare(a.opened) || b.id.localeCompare(a.id); }).filter(function (v) { return iv.show === 'all' || v.status !== 'CLOSED'; });
    var h = '<div class="page-head"><h1>Investigations</h1><div class="row"><button class="btn primary" data-action="inv-new">New investigation</button><select data-on-change="inv-filter" id="inv-show">' + A.options([{ value: 'open', label: 'Open investigations' }, { value: 'all', label: 'All investigations' }], iv.show) + '</select></div></div>' +
      '<p class="muted">An investigation begins when a special bank and its estimate are handed over, or on its own (a tip or a referral) with New investigation.</p>' + invPageTabs('list');
    if (!d.investigations.length) h += '<div class="card callout"><strong>None yet.</strong> Use New investigation, or hand over a special bank from its <a href="#/chart">Estimates tab</a>.</div>';
    else h += '<div class="card flush"><table><thead><tr><th>ID</th><th>Investigation</th><th>Status</th><th>Investigator</th><th>Opened</th><th class="num">Open leads</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (v) {
        var b = bank(v.bankId), open = CI.leadsOf(d, v.id).filter(function (l) { return !CI.isClosed(l); }).length;
        return '<tr><td><a href="#/investigation/' + esc(v.id) + '">' + esc(v.id) + '</a></td><td>' + esc(invName(v)) + '</td><td>' + invTag(v) + '</td><td>' + esc(v.investigator || '') + '</td><td>' + esc(CI.fmtShort(v.opened)) + '</td><td class="num">' + open + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">No investigations match.</td></tr>') + '</tbody></table></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  /* ----- the lead register: every lead and request, with or without an investigation ----- */
  var lr = { kind: 'lead', open: true, inv: '', who: '' };
  function scopeText(d) {
    var parts = [lr.open ? 'Open' : 'All', lr.kind === 'request' ? 'requests' : 'leads'];
    var t = parts.join(' ');
    if (lr.inv === 'none') t += ' with no investigation'; else if (lr.inv) t += ' in ' + lr.inv;
    if (lr.who) t += ', assigned to ' + lr.who;
    return t;
  }
  function register() {
    var d = D(), req = lr.kind === 'request';
    var all = CI.leadRegister(d, { kind: lr.kind }), rows = CI.leadRegister(d, { kind: lr.kind, open: lr.open, investigation: lr.inv, assigned: lr.who });
    var people = {}; all.forEach(function (l) { if (l.assigned) people[l.assigned] = 1; });
    var h = '<div class="page-head"><h1>Investigations</h1><div class="row"><button class="btn primary" data-action="reg-new">' + (req ? 'New request' : 'New lead') + '</button><button class="btn" data-action="reg-print"' + (rows.length ? '' : ' disabled') + '>Print ' + (req ? 'request' : 'lead') + ' list</button></div></div>' + invPageTabs('register') +
      '<div class="card"><div class="row wrap"><div class="row" style="gap:6px"><button class="btn small' + (req ? '' : ' primary') + '" data-action="reg-kind" data-kind="lead">Leads ' + d.leads.length + '</button><button class="btn small' + (req ? ' primary' : '') + '" data-action="reg-kind" data-kind="request">Requests ' + d.requests.length + '</button></div>' +
      '<label class="row" style="margin:0">Show <select id="rg-open" data-on-change="reg-filter">' + A.options([{ value: 'open', label: 'Open only' }, { value: 'all', label: 'All' }], lr.open ? 'open' : 'all') + '</select></label>' +
      '<label class="row" style="margin:0">Investigation <select id="rg-inv" data-on-change="reg-filter">' + A.options([{ value: '', label: 'All' }, { value: 'none', label: 'None' }].concat(d.investigations.map(function (v) { return { value: v.id, label: v.id + ' – ' + invName(v) }; })), lr.inv) + '</select></label>' +
      '<label class="row" style="margin:0">Assigned to <select id="rg-who" data-on-change="reg-filter">' + A.options([{ value: '', label: 'Anyone' }].concat(Object.keys(people).sort().map(function (p) { return { value: p, label: p }; })), lr.who) + '</select></label></div>' +
      '<p class="muted small" style="margin:8px 0 0">A lead or request can belong to an investigation or to none. The sheet prints where it belongs: an investigation\u2019s folder, or the register.</p></div>';
    h += rows.length ? '<div class="card flush"><table class="fixed"><colgroup><col style="width:7%"><col style="width:28%"><col style="width:17%"><col style="width:10%"><col style="width:13%"><col style="width:13%"><col style="width:12%"></colgroup><thead><tr><th>' + (req ? 'Request' : 'Lead') + '</th><th>' + (req ? 'To retrieve' : 'Reason') + '</th><th>About</th><th>Investigation</th><th>' + (req ? 'With' : 'Assigned to') + '</th><th>Issued</th><th>Status</th></tr></thead><tbody>' + rows.map(function (l) {
      var names = (l.about || []).map(function (id) { var e = A.idx().entity[id]; return e ? e.name : id; }).join(', ');
      return '<tr class="click" data-action="lead-open" data-id="' + esc(l.id) + '"><td>' + esc(l.id) + '</td><td class="ellip" title="' + esc(l.question) + '">' + esc(l.question) + '</td><td class="ellip" title="' + esc(names) + '">' + esc(names) + '</td><td>' + (l.investigationId ? esc(l.investigationId) : '<span class="muted">none</span>') + '</td><td class="ellip">' + esc(req ? l.with : (l.assigned || '')) + '</td><td>' + esc(CI.fmtShort(l.issued)) + '</td><td>' + statusTag(l) + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="card"><p class="muted">' + (all.length ? 'Nothing matches those filters.' : 'No ' + (req ? 'requests' : 'leads') + ' yet. Raise one from a name\u2019s page, the indexing page, or here.') + '</p></div>';
    A.view.className = ''; A.view.innerHTML = h;
  }
  H['reg-kind'] = function (el) { lr.kind = el.getAttribute('data-kind'); lr.who = ''; register(); };
  H['reg-filter'] = function () { lr.open = val('rg-open') !== 'all'; lr.inv = val('rg-inv'); lr.who = val('rg-who'); register(); };
  H['reg-new'] = function () { CI.views.openLead({ kind: lr.kind === 'request' ? 'DATA_REQUEST' : 'INVESTIGATION', investigationId: lr.inv && lr.inv !== 'none' ? lr.inv : '', origin: { kind: 'register', id: '' } }); };
  H['reg-print'] = function () {
    var d = D(), req = lr.kind === 'request';
    A.saveBlob((req ? 'Request-register' : 'Lead-register') + '.pdf', function () { return CI.pdf.leadList(d, '', { kind: lr.kind, openOnly: lr.open, investigation: lr.inv, assigned: lr.who, scope: scopeText(d), scopeTitle: 'Lead register' }); });
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
    var d = D(), nl = CI.leadsOf(d, v.id).length, nq = CI.requestsOf(d, v.id).length, nf = CI.invFiles(d, v).length;
    function t(id, href, label, n) { return '<a class="tab' + (active === id ? ' on' : '') + '" href="' + href + '">' + label + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</a>'; }
    return '<div class="tabs">' + t('overview', '#/investigation/' + v.id, 'Overview') + t('files', '#/investigation/' + v.id + '/files', 'Files', nf) + t('chart', '#/casechart/' + v.id, 'Chart') + t('leads', '#/investigation/' + v.id + '/leads', 'Leads', nl) + t('requests', '#/investigation/' + v.id + '/requests', 'Requests', nq) + '</div>';
  };
  CI.views.invHead = function (v) {
    return '<div class="chart-head"><a href="#/investigations" class="back">\u2039 Investigations</a><h1>Investigation ' + esc(v.id) + '</h1>' + invTag(v) + '<span class="muted small">' + esc(invName(v)) + '</span></div>';
  };
  CI.views.investigation = function (id, tab) {
    var d = D(), v = d.investigations.filter(function (x) { return x.id === id; })[0];
    if (!v) { A.view.innerHTML = '<div class="card callout">No such investigation. <a href="#/investigations">Back to investigations</a></div>'; return; }
    var b = bank(v.bankId), cc = CI.caseChartOf(v), leads = CI.leadsOf(d, v.id), reqs = CI.requestsOf(d, v.id), pf = v.planFile || { name: '', location: '' };
    tab = tab === 'leads' || tab === 'requests' || tab === 'files' ? tab : 'overview';
    var h = CI.views.invHead(v) + CI.views.invTabs(v, tab);
    if (tab !== 'overview') { A.view.className = ''; A.view.innerHTML = h + (tab === 'leads' ? leadsTab(v) : tab === 'files' ? filesTab(v) : requestsTab(v)); return; }
    h += '<form class="card form" onsubmit="return false"><label>Title<input type="text" id="iv-title" value="' + esc(v.title || '') + '" placeholder="' + esc(b ? b.name : '') + '"></label>' +
      '<label>Why it was opened<textarea id="iv-reason" rows="2">' + esc(v.reason || '') + '</textarea></label>' +
      '<div class="grid2"><label>Status<select id="iv-status">' + A.options(CI.INV_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), v.status) + '</select></label>' +
      '<label>Investigator<input type="text" id="iv-who" value="' + esc(v.investigator) + '"></label></div>' +
      '<label>Notes<textarea id="iv-notes" rows="3">' + esc(v.notes) + '</textarea></label>' +
      '<h3 class="sep">Handling plan</h3><p class="muted small">The plan is written outside this app. Record the name of the file and where it is kept.</p>' +
      '<div class="grid2"><label>File name<input type="text" id="iv-pfname" value="' + esc(pf.name) + '"></label><label>Where it is kept<input type="text" id="iv-pfloc" value="' + esc(pf.location) + '"></label></div>' +
      '<div class="row"><button class="btn primary" data-action="inv-save" data-id="' + esc(v.id) + '">Save</button><span class="muted small">' + (b ? 'Handed over ' : 'Opened ') + esc(CI.fmtDate(v.opened)) + (v.closed ? ' \u00b7 closed ' + esc(CI.fmtDate(v.closed)) : '') + '</span></div></form>' +
      '<div class="card"><h3>Special bank</h3><p class="muted small">' + (b ? esc(b.name) + (b.opened && b.opened.reason ? ' \u00b7 opened because: ' + esc(b.opened.reason) : '') : 'This investigation was opened without a special bank.') + '</p>' + (!b ? '<div class="row"><button class="btn small" data-action="inv-attach" data-id="' + esc(v.id) + '">Attach a special bank</button></div>' : '') + (b ? '<div class="row"><a class="btn small" href="#/chart/' + esc(b.id) + '">Working chart</a><a class="btn small" href="#/bank/' + esc(b.id) + '/estimates">Estimates</a></div>' : '') + '</div>' +
      '<div class="card"><h3>Leads and requests</h3><p class="muted small">' + leads.length + ' lead' + (leads.length === 1 ? '' : 's') + ' (' + leads.filter(function (l) { return !CI.isClosed(l); }).length + ' open) and ' + reqs.length + ' request' + (reqs.length === 1 ? '' : 's') + ' to Collection. <a href="#/investigation/' + esc(v.id) + '/leads">Leads</a> \u00b7 <a href="#/investigation/' + esc(v.id) + '/requests">Requests</a></p></div>' +
      '<div class="card"><h3>Chart</h3><p class="muted small">' + (cc.pins.length ? cc.pins.length + ' name' + (cc.pins.length === 1 ? '' : 's') + ' pinned, ' + cc.strings.length + ' string' + (cc.strings.length === 1 ? '' : 's') + '.' : 'Nothing pinned yet.') + ' The investigators build this board to show what has been found and what is next.</p><div class="row"><a class="btn small" href="#/casechart/' + esc(v.id) + '">Open the Chart tab</a></div></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  /* ----- files of one investigation ----- */
  function filesTab(v) {
    var d = D(), rows = CI.invFiles(d, v), pinned = {}; CI.caseChartOf(v).pins.forEach(function (p) { pinned[p.entityId] = 1; });
    var inList = {}; rows.forEach(function (r) { inList[r.entity.id] = 1; });
    var free = d.entities.filter(function (e) { return !inList[e.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    return '<div class="card"><div class="row spread wrap"><div><b>' + rows.length + '</b> file' + (rows.length === 1 ? '' : 's') + '<div class="muted small">The individuals, groups, areas and subjects this investigation is about. Files from its bank, its chart and its leads appear here too.</div></div>' +
      '<div><datalist id="if-dl">' + free.map(function (e) { return '<option value="' + esc(e.name + ' \u00b7 ' + CI.TYPE_LABEL[e.type].toLowerCase() + ' \u00b7 ' + e.id) + '">'; }).join('') + '</datalist>' +
      '<input type="text" list="if-dl" id="if-add" data-vid="' + esc(v.id) + '" placeholder="Add a file: type a name…" data-on-change="inv-file-add" autocomplete="off" style="min-width:280px"></div></div></div>' +
      (rows.length ? '<div class="card flush"><table class="fixed"><colgroup><col style="width:34%"><col style="width:14%"><col style="width:26%"><col style="width:26%"></colgroup><thead><tr><th>Name</th><th>Type</th><th>Why it is here</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
        var e = r.entity, mine = r.sources.indexOf('Added') !== -1;
        return '<tr><td class="ellip">' + A.entLink(e.id) + '</td><td>' + esc(CI.TYPE_LABEL[e.type]) + '</td><td class="ellip">' + esc(r.sources.join(', ')) + '</td><td class="right">' +
          (pinned[e.id] ? '<span class="muted small">on the chart</span>' : '<button class="btn small" data-action="inv-file-pin" data-id="' + esc(v.id) + '" data-eid="' + esc(e.id) + '">Pin to chart</button>') +
          (mine ? ' <button class="btn small" data-action="inv-file-del" data-id="' + esc(v.id) + '" data-eid="' + esc(e.id) + '">Remove</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card"><p class="muted">No files yet. Add one above.</p></div>');
  }
  H['inv-file-add'] = function (el) {
    var v = D().investigations.filter(function (x) { return x.id === el.getAttribute('data-vid'); })[0]; if (!v || !el.value.trim()) return;
    var m = el.value.match(/(E-\d{4,})\s*$/), id = m ? m[1] : ((CI.findCandidates(D(), el.value, 1)[0] || {}).entity || {}).id;
    if (!id) { A.toast('No file matches that.', true); return; }
    var res = CI.addInvFile(D(), v, id); if (res.error) { A.toast(res.error, true); return; }
    A.persist(); CI.views.investigation(v.id, 'files'); var i = document.getElementById('if-add'); if (i) i.focus();
  };
  H['inv-file-del'] = function (el) { var v = invOf(el); if (!v) return; CI.removeInvFile(D(), v, el.getAttribute('data-eid')); A.persist(); CI.views.investigation(v.id, 'files'); };
  H['inv-file-pin'] = function (el) { var v = invOf(el); if (!v) return; var r = CI.addPin(D(), v, el.getAttribute('data-eid')); if (r.error) { A.toast(r.error, true); return; } A.persist(); CI.views.investigation(v.id, 'files'); };
  H['inv-attach'] = function (el) {
    var d = D(), v = invOf(el); if (!v) return;
    var banks = d.banks.filter(function (b) { return !b.handedOver && !b.outcome && !b.quick; });
    if (!banks.length) { A.toast('There is no special bank waiting to be handed over. Analysts open one from Special banks.', true); return; }
    A.modal('<h2>Attach a special bank <span class="muted small">' + esc(v.id) + '</span></h2><div class="form"><p class="muted small">The bank is frozen as it stands and handed over to this investigation with the estimate you choose.</p>' +
      '<label>Special bank<select id="at-bank" data-on-change="inv-attach-bank">' + A.options(banks.map(function (b) { return { value: b.id, label: b.name }; }), banks[0].id) + '</select></label>' +
      '<label>Estimate to send<select id="at-est">' + estOptions(banks[0]) + '</select></label></div>' +
      '<div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="inv-attach-go" data-id="' + esc(v.id) + '">Hand over to this investigation</button></div>');
  };
  function estOptions(b) { return A.options(b.estimates.slice().reverse().map(function (e) { return { value: e.id, label: e.label }; }), CI.currentEstimate(b).id); }
  H['inv-attach-bank'] = function () { var b = bank(val('at-bank')), s = document.getElementById('at-est'); if (b && s) s.innerHTML = estOptions(b); };
  H['inv-attach-go'] = function (el) {
    var v = invOf(el), b = bank(val('at-bank')); if (!v || !b) return;
    if (!CI.handOver(D(), b, val('at-est'), v)) { A.toast('That bank cannot be handed over.', true); return; }
    A.persist(); A.closeModal(); A.toast('Bank attached.'); CI.views.investigation(v.id);
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
  H['lead-new'] = function (el) { CI.views.openLead({ investigationId: el.getAttribute('data-id'), fixInvestigation: true, kind: el.getAttribute('data-kind') }); };
  H['lead-from-theory'] = function (el) {
    var d = D(), v = invOf(el), b = v && bank(v.bankId); if (!b) return;
    var est = CI.estimateOf(b, el.getAttribute('data-est')), it = est.items.filter(function (x) { return x.id === el.getAttribute('data-item'); })[0]; if (!it) return;
    var about = {}; it.reportIds.forEach(function (r) { var rep = A.idx().report[r]; if (rep) rep.entities.forEach(function (x) { if ((b.files || []).indexOf(x.entityId) !== -1) about[x.entityId] = 1; }); });
    CI.views._leadTheory = est.id + '|' + it.id;
    CI.views.openLead({ investigationId: v.id, fixInvestigation: true, kind: 'INVESTIGATION', question: 'Is this so? ' + it.text, raisedBy: it.reportIds[0] || '', about: Object.keys(about) });
  };
  H['ll-print'] = function (el) {
    var d = D(), v = invOf(el); if (!v) return;
    var kind = el.getAttribute('data-kind'), open = val('ll-show') === 'open';
    A.saveBlob((kind === 'request' ? 'Request-list-' : 'Lead-list-') + v.id + '.pdf', function () { return CI.pdf.leadList(d, v.id, { kind: kind, openOnly: open }); });
  };
  function invOf(el) { return D().investigations.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; }
  H['inv-save'] = function (el) {
    var v = invOf(el); if (!v) return;
    v.title = val('iv-title').trim(); v.reason = val('iv-reason').trim(); v.status = val('iv-status'); v.investigator = val('iv-who').trim(); v.notes = val('iv-notes').trim();
    v.planFile = { name: val('iv-pfname').trim(), location: val('iv-pfloc').trim() };
    if (v.status === 'CLOSED' && !v.closed) v.closed = CI.today(); if (v.status !== 'CLOSED') v.closed = '';
    A.persist(); A.toast('Saved.'); CI.views.investigation(v.id);
  };
  H['inv-new'] = function () {
    A.modal('<h2>New investigation</h2><div class="form"><label>Title<input type="text" id="ni-title" placeholder="e.g. Tip about the Depot 4 contractor"></label>' +
      '<label>Why it is being opened <span class="hint">where it came from</span><textarea id="ni-reason" rows="3"></textarea></label>' +
      '<div class="grid2"><label>Investigator <span class="hint">optional</span><input type="text" id="ni-who"></label><label>Opened ' + A.dateInput('ni-date', CI.today()) + '</label></div>' +
      '</div><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="inv-create">Create</button></div>');
    var t = document.getElementById('ni-title'); if (t) t.focus();
  };
  H['inv-create'] = function () {
    var dt = A.readDate('ni-date'); if (dt === null) { A.toast('Opened: ' + A.dateHelp, true); return; }
    var res = CI.newInvestigation(D(), { title: val('ni-title'), reason: val('ni-reason'), investigator: val('ni-who'), opened: dt || CI.today() });
    if (res.error) { A.toast(res.error, true); return; }
    A.persist(); A.closeModal(); A.toast('Investigation ' + res.inv.id + ' opened.'); A.go('#/investigation/' + res.inv.id);
  };
})();
