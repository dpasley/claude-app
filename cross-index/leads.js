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

  function isReq(l) { return CI.isRequest(l); }
  function invOfLead(l) { return D().investigations.filter(function (v) { return v.id === l.investigationId; })[0]; }
  function backHref(l) { return l.investigationId ? '#/investigation/' + l.investigationId + '/' + (isReq(l) ? 'requests' : 'leads') : '#/investigations/register'; }
  /* A report box with suggestions you can walk through with the arrow keys. The value is picked up as the report number. */
  function reportBox(id, value) {
    var reps = A.data().reports.slice().sort(function (a, b) { return b.id.localeCompare(a.id); }).slice(0, 300);
    return '<input type="text" id="' + id + '" list="' + id + '-dl" autocomplete="off" value="' + esc(value || '') + '" placeholder="Optional: start typing a report number or subject"><datalist id="' + id + '-dl">' +
      reps.map(function (r) { return '<option value="' + esc(r.id + ' – ' + A.trunc(r.subject || r.summary || r.sourceRef || '', 60)) + '">'; }).join('') + '</datalist>';
  }
  /* A type-to-search box for the investigation. Nothing drops down until you type; arrow keys and Enter pick.
     The chosen value is kept on the box (data-value). Empty text means no investigation (or all, on the register). */
  var pickers = {};
  function invBox(id, list, selId, extra, placeholder) {
    var all = (extra || []).concat(list.map(function (v) { return { value: v.id, label: v.id + ' \u2013 ' + CI.views.invName(v) }; }));
    pickers[id] = all;
    var sel = all.filter(function (x) { return x.value === selId && selId; })[0];
    return '<input type="search" id="' + id + '" class="ip-in" data-lookup="#' + id + '-res" data-on-input="ip-find" autocomplete="off" data-value="' + esc(sel ? sel.value : '') + '" value="' + esc(sel ? sel.label : '') + '" placeholder="' + esc(placeholder || 'No investigation: start typing to search') + '"><div id="' + id + '-res" class="ip-res"></div>';
  }
  CI.views.invBox = invBox;
  function readInv(id) { var e = document.getElementById(id); if (!e || !e.value.trim()) return ''; return e.getAttribute('data-value') || '?'; }
  CI.views.readInv = readInv;
  H['ip-find'] = function (el) {
    var res = document.getElementById(el.id + '-res'), q = el.value.trim().toLowerCase();
    el.setAttribute('data-value', '');
    if (!q) { res.innerHTML = ''; if (el.getAttribute('data-on-pick')) { var f = H[el.getAttribute('data-on-pick')]; if (f) f(el, ''); } return; }
    var hits = (pickers[el.id] || []).filter(function (x) { return x.label.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
    res.innerHTML = hits.length ? hits.map(function (x) { return '<div class="cand pick"><button type="button" class="btn small" data-action="ip-pick" data-for="' + esc(el.id) + '" data-value="' + esc(x.value) + '" data-label="' + esc(x.label) + '">' + esc(x.label) + '</button></div>'; }).join('') : '<p class="muted small">No investigation matches.</p>';
  };
  H['ip-pick'] = function (el) {
    var inp = document.getElementById(el.getAttribute('data-for')); if (!inp) return;
    inp.value = el.getAttribute('data-label'); inp.setAttribute('data-value', el.getAttribute('data-value'));
    document.getElementById(inp.id + '-res').innerHTML = '';
    var f = inp.getAttribute('data-on-pick'); if (f && H[f]) H[f](inp, el.getAttribute('data-value'));
  };
  function readReport(id) { var m = val(id).match(/R-\d+/i); return m ? m[0].toUpperCase() : (val(id).trim() ? '?' + val(id).trim() : ''); }
  function repLabel(rid) { var r = A.idx().report[rid]; return r ? rid + ' – ' + A.trunc(r.subject || r.summary || r.sourceRef || '', 60) : (rid || ''); }


  /* ---------- the Leads tab on an individual's page ---------- */
  CI.views.fileLeads = function (e, list) {
    var d = D(), nOpen = list.filter(function (l) { return !CI.isClosed(l); }).length;
    var h = '<div class="card flush"><div class="row spread" style="padding:14px 16px 6px"><h2 style="margin:0">Leads about ' + esc(e.name) + '</h2><div class="row"><button class="btn small primary" data-action="fl-new" data-id="' + esc(e.id) + '">New lead</button><button class="btn small" data-action="fl-print" data-id="' + esc(e.id) + '"' + (nOpen ? '' : ' disabled') + '>Print open leads</button></div></div>' +
      '<p class="muted small" style="padding:0 16px">Every lead and request that is about this name, whether it was raised here or inside an investigation. A lead raised here belongs to no investigation unless you pick one.</p>';
    if (!list.length) return h + '<p class="muted" style="padding:0 16px 14px">No leads about this name yet.</p></div>';
    h += '<table class="fixed"><colgroup><col style="width:8%"><col style="width:32%"><col style="width:14%"><col style="width:16%"><col style="width:15%"><col style="width:15%"></colgroup><thead><tr><th>Lead</th><th>Reason</th><th>Raised from</th><th>Assigned to</th><th>Issued</th><th>Status</th></tr></thead><tbody>' + list.map(function (l) {
      var home = CI.leadHome(d, l);
      return '<tr class="click" data-action="lead-open" data-id="' + esc(l.id) + '"><td>' + esc(l.id) + '</td><td class="ellip" title="' + esc(l.question) + '">' + esc(l.question) + '</td><td class="ellip" title="' + esc(home.from) + '">' + (l.investigationId ? esc(l.investigationId) : 'This page') + '</td><td class="ellip">' + esc(isReq(l) ? l.with : (l.assigned || '')) + '</td><td>' + esc(CI.fmtShort(l.issued)) + '</td><td>' + statusTag(l) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  };
  H['fl-new'] = function (el) {
    var id = el.getAttribute('data-id');
    CI.views.openLead({ about: [id], aboutChoices: [id], kind: 'INVESTIGATION', origin: { kind: 'file', id: id } });
  };
  H['fl-print'] = function (el) {
    var id = el.getAttribute('data-id'), e = A.idx().entity[id];
    saveBlob('Leads-' + id + '.pdf', function () { return CI.pdf.leadList(D(), '', { kind: 'lead', openOnly: true, about: id, scope: 'About ' + e.name, scopeTitle: 'Open leads about ' + e.name }); });
  };

  /* ---------- create (from inside an investigation) ---------- */
  CI.views.openLead = function (pre) {
    pre = pre || {};
    var d = D(), inv = d.investigations.filter(function (v) { return v.id === pre.investigationId; })[0] || null;
    var req = pre.kind === 'DATA_REQUEST', leads = inv ? CI.leadsOf(d, inv.id) : [], pick = !pre.fixInvestigation;
    var hold = '<label>Investigation <span class="hint">optional: leave empty if there is none</span>' + invBox('nl-inv', d.investigations.filter(function (v) { return v.status !== 'CLOSED' || (inv && v.id === inv.id); }), inv ? inv.id : '') + '</label>';
    var choices = pre.aboutChoices && pre.aboutChoices.length ? '<div class="group-label">About <span class="hint">tick the names this is about</span></div><div class="chips">' + pre.aboutChoices.map(function (id) { var e = A.idx().entity[id]; return e ? '<label class="chk"><input type="checkbox" class="nl-ab" data-id="' + esc(id) + '"' + ((pre.about || []).indexOf(id) !== -1 ? ' checked' : '') + '> ' + esc(e.name) + '</label>' : ''; }).join(' ') + '</div>' : '';
    A.modal('<h2>' + (req ? 'New request to Collection' : 'New lead') + (inv ? ' <span class="muted small">' + esc(inv.id) + '</span>' : '') + '</h2><div class="form">' + (pick ? hold : '') +
      '<label>' + (req ? 'What is to be retrieved' : 'Reason for the lead') + ' <span class="hint">' + (req ? 'retrieve and preserve only; no interpretation' : 'what we want to find out, and why') + '</span><textarea id="nl-q" rows="3">' + esc(pre.question || '') + '</textarea></label>' +
      '<div class="grid2">' + (req && inv ? '<label>For lead <span class="hint">optional</span><select id="nl-for">' + A.options(leads.map(function (l) { return { value: l.id, label: l.id + ' – ' + A.trunc(l.question, 50) }; }), pre.forLead || '', 'No particular lead') + '</select></label>'
        : '<label>Assigned to <span class="hint">optional</span><input type="text" id="nl-who" value="' + esc(pre.assigned || (inv && inv.investigator) || '') + '"></label>') +
      '<label>Issued ' + A.dateInput('nl-issued', pre.issued || CI.today()) + '</label></div>' +
      '<label>Prompted by report ' + reportBox('nl-rep', repLabel(pre.raisedBy)) + '</label>' +
      choices + '<p class="muted small" id="nl-note">' + (!choices && pre.about && pre.about.length ? 'About: ' + esc(pre.about.map(function (id) { var e = A.idx().entity[id]; return e ? e.name : id; }).join(', ')) : '') + '</p>' +
      '</div><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="lead-create" data-inv="' + esc(inv ? inv.id : '') + '" data-pick="' + (pick ? '1' : '') + '" data-kind="' + (req ? 'DATA_REQUEST' : 'INVESTIGATION') + '">' + (req ? 'Create request' : 'Create lead') + '</button></div>');
    CI.views._leadAbout = pre.about || []; CI.views._leadOrigin = pre.origin || null;
    var q = document.getElementById('nl-q'); if (q) q.focus();
  };
  H['lead-create'] = function (el) {
    var iss = A.readDate('nl-issued');
    if (iss === null) { A.toast('Issued: ' + A.dateHelp, true); return; }
    var who = document.getElementById('nl-who'), fl = document.getElementById('nl-for');
    var abs = document.querySelectorAll('.nl-ab'), about = abs.length ? Array.prototype.filter.call(abs, function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-id'); }) : CI.views._leadAbout;
    var invId = el.getAttribute('data-pick') ? readInv('nl-inv') : el.getAttribute('data-inv');
    if (invId === '?') { A.toast('Pick an investigation from the list, or leave it empty.', true); return; }
    var res = CI.addLead(D(), { investigationId: invId, origin: CI.views._leadOrigin, kind: el.getAttribute('data-kind'), question: val('nl-q'), raisedBy: readReport('nl-rep'), assigned: who ? who.value : '', forLead: fl ? fl.value : '', issued: iss || CI.today(), about: about });
    if (res.error) { A.toast(res.error, true); return; }
    if (CI.views._leadTheory && !isReq(res.lead)) res.lead.theory = CI.views._leadTheory; CI.views._leadTheory = '';
    var org = res.lead.origin || {}, word = (isReq(res.lead) ? 'Request ' : 'Lead ') + res.lead.id + ' created.';
    A.persist(); A.closeModal(); A.toast(word);
    if (org.kind === 'file' && A.idx().entity[org.id]) { A.viewEntity(org.id, 'leads'); return; }   /* stay on the individual's page */
    if (org.kind === 'report') return;                                                              /* stay on the indexing page */
    A.go('#/lead/' + res.lead.id);
  };

  /* ---------- one lead or request ---------- */
  CI.views.lead = function (id) {
    var d = D(), l = CI.findLead(d, id);
    if (!l) { A.view.innerHTML = '<div class="card callout">No such lead. <a href="#/investigations/register">Back to the lead register</a></div>'; return; }
    var req = isReq(l), inv = invOfLead(l), bank = inv && d.banks.filter(function (b) { return b.id === inv.bankId; })[0];
    var results = CI.leadResults(d, l.id), raised = A.idx().report[l.raisedBy], word = req ? 'Request' : 'Lead';
    var forLead = req && l.forLead ? d.leads.filter(function (x) { return x.id === l.forLead; })[0] : null;
    var h = '<div class="page-head"><h1>' + word + ' ' + esc(l.id) + ' ' + statusTag(l) + '</h1><div class="row wrap"><button class="btn" data-action="lead-sheet-one" data-id="' + esc(l.id) + '">' + word + ' sheet (PDF)</button><a class="btn" href="' + backHref(l) + '">' + (inv ? 'Back to ' + esc(inv.id) : 'Lead register') + '</a></div></div>' +
      '<p class="muted">' + (inv ? 'Investigation <a href="#/investigation/' + esc(inv.id) + '">' + esc(inv.id) + '</a>' + (inv ? ' · ' + esc(CI.views.invName(inv)) : '') : 'Not attached to an investigation.') + ' <span class="muted small">' + esc(CI.leadHome(d, l).from) + '. ' + esc(CI.leadHome(d, l).folder) + '.</span></p>' +
      '<form class="card form" onsubmit="return false"><div class="grid2"><label>Issued ' + A.dateInput('ld-f-issued', l.issued) + '</label>' +
      (req ? '<label>With<input type="text" value="Collection" disabled></label>' : '<label>Assigned to<input type="text" id="ld-f-who" value="' + esc(l.assigned || '') + '"></label>') + '</div>' +
      '<label>' + (req ? 'What is to be retrieved' : 'Reason for the lead') + '<textarea id="ld-f-q" rows="3">' + esc(l.question) + '</textarea></label>' +
      (req ? '<label>For lead <span class="hint">optional</span><select id="ld-f-for">' + A.options(CI.leadsOf(d, l.investigationId).map(function (x) { return { value: x.id, label: x.id + ' – ' + A.trunc(x.question, 60) }; }), l.forLead || '', 'No particular lead') + '</select></label>' : '') +
      '<label>Prompted by report ' + reportBox('ld-f-rep', repLabel(l.raisedBy)) + '</label>' +
      (raised ? '<p class="muted small" style="margin-top:-6px">' + esc(raised.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(raised))) + ' · ' + esc(A.trunc(raised.summary || '', 140)) + ' <a href="#/report/' + esc(raised.id) + '">Open report</a></p>' : '') +
      (forLead ? '<p class="small">For lead <a href="#/lead/' + esc(forLead.id) + '">' + esc(forLead.id) + '</a> ' + esc(A.trunc(forLead.question, 100)) + '</p>' : '') +
      (l.about && l.about.length ? '<p class="small">About: ' + l.about.map(function (e) { return A.entLink(e); }).join(', ') + '</p>' : '') +
      '<label>Investigation <span class="hint">optional</span>' + invBox('ld-f-inv', d.investigations.filter(function (v) { return v.status !== 'CLOSED' || v.id === l.investigationId; }), l.investigationId || '') + '</label>' +
      '<label>Status<select id="ld-f-status">' + A.options(CI.LEAD_STATUS.map(function (s) { return { value: s.id, label: s.label }; }), l.status) + '</select></label>' +
      '<label>Response <span class="hint">what came back, in a few words</span><textarea id="ld-f-resp" rows="4">' + esc(l.response) + '</textarea></label>' +
      '<div class="grid2"><label>Returned by<input type="text" id="ld-f-by" value="' + esc(l.returnedBy) + '"></label><label>Returned on ' + A.dateInput('ld-f-ret', l.returnedDate) + '</label></div>' +
      '<div class="row"><button class="btn primary" data-action="lead-save" data-id="' + esc(l.id) + '">Save</button></div></form>' +
      '<div class="card"><h3>Results that came back</h3>' + (results.length ? '<ul class="plain">' + results.map(function (r) { return '<li>' + A.repLink(r.id) + ' <span class="muted">' + esc(r.sourceType || '') + ' · ' + esc(CI.fmtDate(CI.reportDate(r))) + '</span><div class="small">' + esc(A.trunc(r.summary || '', 140)) + '</div></li>'; }).join('') + '</ul>' : '<p class="muted small">None yet. Whatever comes back is filed through Intake as a report that carries this number.</p>') +
      '<div class="row"><button class="btn" data-action="lead-result" data-id="' + esc(l.id) + '">File a result as a new report</button></div></div>' +
      '<div class="card"><h3>Housekeeping</h3><button class="btn danger" data-action="lead-del" data-id="' + esc(l.id) + '">Delete this ' + word.toLowerCase() + '</button></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['lead-save'] = function (el) {
    var d = D(), l = CI.findLead(d, el.getAttribute('data-id')); if (!l) return;
    var q = val('ld-f-q').trim(); if (!q) { A.toast(isReq(l) ? 'Say what is to be retrieved.' : 'Give the reason for the lead.', true); return; }
    var iss = A.readDate('ld-f-issued'), ret = A.readDate('ld-f-ret');
    if (iss === null || ret === null) { A.toast((iss === null ? 'Issued: ' : 'Returned on: ') + A.dateHelp, true); return; }
    var rep = readReport('ld-f-rep');
    if (rep && (rep.charAt(0) === '?' || !A.idx().report[rep])) { A.toast('No such report: ' + rep.replace('?', '') + '.', true); return; }
    l.issued = iss || l.issued; l.question = q; l.raisedBy = rep;
    var who = document.getElementById('ld-f-who'); if (who) l.assigned = who.value.trim();
    var fl = document.getElementById('ld-f-for'); if (fl) l.forLead = fl.value;
    var ivs = document.getElementById('ld-f-inv'), ivv = ivs ? readInv('ld-f-inv') : null; if (ivv === '?') { A.toast('Pick an investigation from the list, or leave it empty.', true); return; } if (ivs && ivv !== (l.investigationId || '')) CI.attachLead(d, l.id, ivv);
    l.status = val('ld-f-status'); l.response = val('ld-f-resp').trim(); l.returnedBy = val('ld-f-by').trim(); l.returnedDate = ret;
    A.persist(); A.toast('Saved.'); CI.views.lead(l.id);
  };
  H['lead-del'] = function (el) {
    var id = el.getAttribute('data-id'), l = CI.findLead(D(), id), back = l ? backHref(l) : '#/investigations/register';
    A.confirm('Delete ' + id + '? Reports filed against it are kept.', function () { CI.deleteLead(D(), id); A.persist(); A.closeModal(); A.go(back); }, { title: 'Delete', yes: 'Delete', danger: true });
  };
  H['lead-sheet-one'] = function (el) { var id = el.getAttribute('data-id'); saveBlob((id.charAt(0) === 'Q' ? 'Request-' : 'Lead-') + id + '.pdf', function () { return CI.pdf.leadSheets(D(), [id]); }); };
  H['lead-result'] = function (el) {
    var l = CI.findLead(D(), el.getAttribute('data-id')); if (!l) return;
    A.startReport({ leadId: l.id, sourceType: isReq(l) ? '' : 'Investigator report' });
  };

  /* ---------- estimate of the situation (one of the special bank's estimates) ---------- */
  var draft = {};   // unsaved new statements, per estimate and kind
  function draftOf(estId, kind) { var k = estId + '|' + kind; return draft[k] || (draft[k] = { text: '', reports: [] }); }
  function citeChips(ids, attrs) {
    return ids.map(function (r) {
      var rep = A.idx().report[r];
      return '<span class="chip">' + A.repLink(r) + (rep && rep.subject ? ' <span class="muted small">' + esc(A.trunc(rep.subject, 40)) + '</span>' : '') +
        '<button data-action="es-uncite" ' + attrs + ' data-report="' + esc(r) + '" aria-label="Remove ' + esc(r) + '">×</button></span>';
    }).join('');
  }
  /* A report lookup: reports that name this bank's files come first. */
  function lookupBox(target, bank, est, id, kind) {
    return '<div class="cite-row"><input type="search" class="cite-in" id="es-in-' + esc(target) + '" data-lookup="#es-res-' + esc(target) + '" autocomplete="off" placeholder="Add a report it rests on: type a number, subject or source…" data-on-input="es-find" data-target="' + esc(target) + '" data-bank="' + esc(bank.id) + '" data-est="' + esc(est.id) + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + ' data-kind="' + esc(kind) + '"></div><div class="cite-res" id="es-res-' + esc(target) + '"></div>';
  }
  function section(b, est, kind, title, hint) {
    var items = est.items.filter(function (i) { return i.kind === kind; }), dr = draftOf(est.id, kind), other = kind === 'ESTABLISHED' ? 'HYPOTHESIS' : 'ESTABLISHED';
    var h = '<div class="card est-sec"><h2>' + title + '</h2><p class="muted small">' + hint + '</p>';
    h += items.map(function (it) {
      var at = 'data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '" data-id="' + esc(it.id) + '"';
      return '<div class="stmt"><textarea rows="2" class="stmt-text" data-on-change="es-text" ' + at + '>' + esc(it.text) + '</textarea>' +
        '<div class="stmt-cites">' + (it.reportIds.length ? '<span class="fl">Rests on</span>' + citeChips(it.reportIds, at) : '<span class="muted small">No reports cited.</span>') + '</div>' +
        lookupBox(it.id, b, est, it.id, kind) +
        '<div class="stmt-act"><button class="btn small" data-action="es-move" ' + at + ' data-to="' + other + '">' + (kind === 'ESTABLISHED' ? 'Make it a working theory' : 'Make it established') + '</button>' + '<button class="btn small danger" data-action="est-del" ' + at + '>Remove</button></div></div>';
    }).join('') || '<p class="muted small">None yet.</p>';
    h += '<div class="stmt new"><label class="big-lbl">Add one<textarea rows="2" id="es-new-' + kind + '" data-on-input="es-draft-text" data-kind="' + kind + '" data-est="' + esc(est.id) + '" placeholder="Write the statement in plain words…">' + esc(dr.text) + '</textarea></label>' +
      '<div class="stmt-cites">' + (dr.reports.length ? '<span class="fl">Rests on</span>' + citeChips(dr.reports, 'data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '" data-kind="' + kind + '" data-draft="1"') : (kind === 'ESTABLISHED' ? '<span class="muted small">An established statement must cite at least one report.</span>' : '')) + '</div>' +
      lookupBox('new-' + kind, b, est, '', kind) +
      '<div class="stmt-act"><button class="btn primary" data-action="est-add" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '" data-kind="' + kind + '">Add</button></div></div></div>';
    return h;
  }
  CI.views.estimate = function (bankId, estId) {
    var d = D(), b = d.banks.filter(function (x) { return x.id === bankId; })[0];
    if (!b) { A.view.innerHTML = '<div class="card callout">No such special bank. <a href="#/chart">Back to special banks</a></div>'; return; }
    var est = CI.estimateOf(b, estId), handed = b.handedOver && b.handedOverEstimate === est.id;
    var h = CI.views.bankHead(b, 'estimates') +
      '<h2 class="sub-h">' + esc(est.label) + (handed ? ' <span class="tag">handed over</span>' : '') + ' <button class="btn small" data-action="est-rename" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '">Rename</button> <button class="btn small" data-action="print-estimate" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '">Print</button></h2>' +
      '<div class="card form"><h2>Summary</h2><label><span class="hint">Where things stand, in a few plain sentences</span><textarea id="est-sum" rows="4" data-on-change="est-sum" data-bank="' + esc(b.id) + '" data-est="' + esc(est.id) + '">' + esc(est.summary) + '</textarea></label>' +
      (est.updated ? '<p class="muted small" style="margin:6px 0 0">Updated ' + esc(CI.fmtDate(est.updated)) + '. Changes save as you go.</p>' : '') + '</div>' +
      section(b, est, 'ESTABLISHED', 'What the files establish', 'Statements the reports support. Each must cite at least one report.') +
      section(b, est, 'HYPOTHESIS', 'Working theories', 'Not yet established. Citing reports is optional.');
    A.view.className = ''; A.view.innerHTML = h;
  };
  function bankOf(el) { return D().banks.filter(function (x) { return x.id === el.getAttribute('data-bank'); })[0]; }
  function estOf(el) { var b = bankOf(el); return b ? CI.estimateOf(b, el.getAttribute('data-est')) : null; }
  H['est-sum'] = function (el) { var e = estOf(el); e.summary = el.value.trim(); e.updated = CI.today(); A.persist(); };
  H['est-rename'] = function (el) {
    var b = bankOf(el), e = estOf(el);
    A.ask('Name for this estimate?', e.label, function (n) { e.label = n; A.persist(); CI.views.estimate(b.id, e.id); }, { title: 'Rename estimate', ok: 'Rename' });
  };
  H['es-draft-text'] = function (el) { draftOf(el.getAttribute('data-est'), el.getAttribute('data-kind')).text = el.value; };
  H['es-text'] = function (el) {
    var b = bankOf(el), e = estOf(el), r = CI.updateEstimateItem(D(), e, el.getAttribute('data-id'), { text: el.value });
    if (r.error) { A.toast(r.error, true); CI.views.estimate(b.id, e.id); return; }
    A.persist();
  };
  H['es-find'] = function (el) {
    var box = document.getElementById('es-res-' + el.getAttribute('data-target')); if (!box) return;
    var b = bankOf(el), q = CI.norm(el.value), idx = A.idx(), files = {}; (b.files || []).forEach(function (id) { files[id] = 1; });
    var cur = el.getAttribute('data-id') ? (estOf(el).items.filter(function (i) { return i.id === el.getAttribute('data-id'); })[0] || {}).reportIds || [] : draftOf(el.getAttribute('data-est'), el.getAttribute('data-kind')).reports;
    var rows = D().reports.filter(function (r) { return cur.indexOf(r.id) === -1 && (!q || CI.norm([r.id, r.subject, r.sourceRef, r.summary].join(' ')).indexOf(q) !== -1); }).map(function (r) {
      return { r: r, rel: r.entities.some(function (x) { return files[x.entityId]; }) };
    }).sort(function (x, y) { return (y.rel - x.rel) || (CI.reportDate(y.r) < CI.reportDate(x.r) ? -1 : 1); }).slice(0, 8);
    if (!q && !rows.length) { box.innerHTML = ''; return; }
    box.innerHTML = rows.length ? '<table class="fixed list"><tbody>' + rows.map(function (x) {
      return '<tr class="pick"><td class="ellip"><b>' + esc(x.r.id) + '</b> ' + esc(A.trunc(x.r.subject || '', 60)) + ' <span class="muted small">' + esc(CI.fmtDate(CI.reportDate(x.r))) + ' · ' + esc(A.trunc(x.r.sourceRef || '', 30)) + '</span>' + (x.rel ? ' <span class="tag">names a file in this bank</span>' : '') + '</td>' +
        '<td class="right"><button class="btn small" data-action="es-cite" data-target="' + esc(el.getAttribute('data-target')) + '" data-bank="' + esc(b.id) + '" data-est="' + esc(el.getAttribute('data-est')) + '" data-kind="' + esc(el.getAttribute('data-kind')) + '"' + (el.getAttribute('data-id') ? ' data-id="' + esc(el.getAttribute('data-id')) + '"' : '') + ' data-report="' + esc(x.r.id) + '">Cite</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted small">No report matches that.</p>';
  };
  function refocus(target) { var i = document.getElementById('es-in-' + target); if (i) i.focus(); }
  H['es-cite'] = function (el) {
    var b = bankOf(el), e = estOf(el), id = el.getAttribute('data-id'), rep = el.getAttribute('data-report');
    if (id) {
      var it = e.items.filter(function (i) { return i.id === id; })[0], r = CI.updateEstimateItem(D(), e, id, { reportIds: it.reportIds.concat([rep]) });
      if (r.error) { A.toast(r.error, true); return; }
      A.persist();
    } else { var dr = draftOf(e.id, el.getAttribute('data-kind')); if (dr.reports.indexOf(rep) === -1) dr.reports.push(rep); }
    CI.views.estimate(b.id, e.id); refocus(el.getAttribute('data-target'));
  };
  H['es-uncite'] = function (el) {
    var b = bankOf(el), e = estOf(el), rep = el.getAttribute('data-report'), id = el.getAttribute('data-id');
    if (el.getAttribute('data-draft')) { var dr = draftOf(e.id, el.getAttribute('data-kind')); dr.reports = dr.reports.filter(function (x) { return x !== rep; }); }
    else {
      var it = e.items.filter(function (i) { return i.id === id; })[0], r = CI.updateEstimateItem(D(), e, id, { reportIds: it.reportIds.filter(function (x) { return x !== rep; }) });
      if (r.error) { A.toast(r.error, true); return; }
      A.persist();
    }
    CI.views.estimate(b.id, e.id);
  };
  H['es-move'] = function (el) {
    var b = bankOf(el), e = estOf(el), r = CI.updateEstimateItem(D(), e, el.getAttribute('data-id'), { kind: el.getAttribute('data-to') });
    if (r.error) { A.toast(r.error + ' Cite a report first.', true); return; }
    A.persist(); CI.views.estimate(b.id, e.id);
  };
  H['est-add'] = function (el) {
    var b = bankOf(el), e = estOf(el), kind = el.getAttribute('data-kind'), dr = draftOf(e.id, kind);
    var res = CI.addEstimateItem(D(), b, { kind: kind, text: dr.text, reportIds: dr.reports.join(',') }, e);
    if (res.error) { A.toast(res.error, true); return; }
    dr.text = ''; dr.reports = []; A.persist(); CI.views.estimate(b.id, e.id);
    var t = document.getElementById('es-new-' + kind); if (t) t.focus();
  };
  H['est-del'] = function (el) { var b = bankOf(el), e = estOf(el), id = el.getAttribute('data-id'); e.items = e.items.filter(function (i) { return i.id !== id; }); A.persist(); CI.views.estimate(b.id, e.id); };
  H['est-handover'] = function (el) {
    var b = bankOf(el), sel = document.getElementById('ho-est'), estId = sel ? sel.value : '';
    A.confirm('Freeze “' + b.name + '” as it stands and hand it to Investigations with ' + CI.estimateOf(b, estId).label + '? This opens an investigation for it.', function () { CI.handOver(D(), b, estId); A.persist(); A.closeModal(); A.toast('Handed over. A snapshot was saved.'); A.go('#/bank/' + b.id + '/estimates'); }, { title: 'Hand over', yes: 'Hand over' });
  };
})();
