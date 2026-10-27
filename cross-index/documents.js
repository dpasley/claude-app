/* The documents kept in a main file besides the profile: summaries and the time line.
 * A summary covers only what is new since the last one. A time line is typed by staff, against the date the event happened. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function fileOf(id) { return A.idx().entity[id]; }
  function ellip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function reload(fileId, tab) { A.viewEntity(fileId, tab); }

  /* ================= SUMMARIES ================= */
  CI.views.fileSummaries = function (e) {
    var d = D(), idx = A.idx(), list = CI.summariesFor(d, e.id).reverse(), fresh = CI.unsummarized(d, idx, e.id);
    var h = '<div class="card"><div class="row spread wrap"><div>' +
      (fresh.length ? '<b>' + fresh.length + '</b> report' + (fresh.length === 1 ? '' : 's') + ' in this file ' + (fresh.length === 1 ? 'is' : 'are') + ' not covered by a summary yet.'
        : (idx.reportsByEntity[e.id] || []).length ? 'Every report in this file is covered by a summary.' : 'No reports in this file yet.') +
      '<div class="muted small">A summary covers only what is new since the last one.</div></div><div class="row">' +
      (list.length ? '<button class="btn" data-action="sm-print-all" data-file="' + esc(e.id) + '">Print all</button>' : '') +
      '<button class="btn primary" data-action="sm-new" data-file="' + esc(e.id) + '"' + (fresh.length ? '' : ' disabled') + '>Write a summary</button></div></div></div>';
    if (!list.length) return h + '<div class="card"><p class="muted">No summaries written for this file yet.</p></div>';
    return h + '<div class="card flush"><table class="fixed"><colgroup><col style="width:12%"><col style="width:16%"><col style="width:10%"><col style="width:40%"><col style="width:22%"></colgroup>' +
      '<thead><tr><th>Date</th><th>Written by</th><th class="num">Reports</th><th>Summary</th><th></th></tr></thead><tbody>' + list.map(function (s) {
        return '<tr class="click" data-action="sm-open" data-id="' + esc(s.id) + '" data-file="' + esc(e.id) + '"><td>' + esc(CI.fmtDate(s.date)) + '</td><td class="ellip">' + esc(s.author) + '</td><td class="num">' + s.covers.length + '</td>' +
          '<td class="ellip" title="' + esc(s.text) + '">' + esc(ellip(s.text, 120)) + '</td><td class="right"><button class="btn small" data-action="sm-print" data-id="' + esc(s.id) + '">Print</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  };

  function repRows(file, chosen, current) {
    var d = D(), idx = A.idx(), taken = {};
    CI.summariesFor(d, file).forEach(function (s) { if (s.id !== current) s.covers.forEach(function (r) { taken[r] = s.id; }); });
    var ids = CI.reportsOf(idx, file);
    if (!ids.length) return '<p class="muted small">No reports in this file.</p>';
    return '<table class="fixed sm-reps"><colgroup><col style="width:6%"><col style="width:14%"><col style="width:16%"><col style="width:64%"></colgroup><tbody>' + ids.map(function (rid) {
      var r = idx.report[rid], t = taken[rid];
      return '<tr><td><input type="checkbox" class="sm-cb" data-id="' + esc(rid) + '"' + (chosen[rid] ? ' checked' : '') + (t ? ' disabled' : '') + ' aria-label="' + esc(rid) + '"></td><td>' + esc(rid) + '</td><td>' + esc(CI.fmtDate(r.received)) + '</td>' +
        '<td class="ellip" title="' + esc(r.subject || r.summary) + '">' + (t ? '<span class="muted">in ' + esc(t) + ' · </span>' : '') + esc(r.subject || r.summary || '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function summaryForm(file, s) {
    var d = D(), idx = A.idx(), f = fileOf(file), chosen = {};
    if (s) s.covers.forEach(function (r) { chosen[r] = 1; }); else CI.unsummarized(d, idx, file).forEach(function (r) { chosen[r] = 1; });
    A.modal('<h2>' + (s ? 'Summary ' + esc(s.id) : 'Summary of ' + esc(f.name)) + '</h2>' +
      '<div class="sm-top"><label>Date<span class="hint"> the date it is written</span>' + A.dateInput('sm-date', s ? s.date : CI.today(), 'date-fix') + '</label>' +
      '<label>Written by<input type="text" id="sm-by" value="' + esc(s ? s.author : (d.ui.lastAuthor || '')) + '"></label></div>' +
      '<label>Summary<span class="hint"> what these reports add to the file</span><textarea id="sm-text" rows="9">' + esc(s ? s.text : '') + '</textarea></label>' +
      '<div class="row spread"><b>Reports covered</b><span class="row"><button class="btn small" data-action="sm-tick" data-on="1">All</button><button class="btn small" data-action="sm-tick" data-on="0">None</button></span></div>' +
      '<div class="sm-scroll">' + repRows(file, chosen, s && s.id) + '</div>' +
      '<div class="row end">' + (s ? '<button class="btn danger" data-action="sm-del" data-id="' + esc(s.id) + '" data-file="' + esc(file) + '">Delete</button><span class="spacer"></span>' : '') +
      '<button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="sm-save" data-file="' + esc(file) + '"' + (s ? ' data-id="' + esc(s.id) + '"' : '') + '>Save</button></div>', true);
    var t = document.getElementById('sm-text'); if (t) t.focus();
  }
  H['sm-new'] = function (el) { summaryForm(el.getAttribute('data-file'), null); };
  H['sm-open'] = function (el) {
    var s = D().summaries.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (s) summaryForm(s.fileId, s);
  };
  H['sm-tick'] = function (el) {
    var on = el.getAttribute('data-on') === '1';
    Array.prototype.forEach.call(document.querySelectorAll('.sm-cb'), function (c) { if (!c.disabled) c.checked = on; });
  };
  H['sm-save'] = function (el) {
    var d = D(), file = el.getAttribute('data-file'), id = el.getAttribute('data-id'), date = A.readDate('sm-date');
    if (date === null) { A.toast(A.dateHelp, true); return; }
    var covers = Array.prototype.filter.call(document.querySelectorAll('.sm-cb'), function (c) { return c.checked && !c.disabled; }).map(function (c) { return c.getAttribute('data-id'); });
    var o = { fileId: file, date: date, author: val('sm-by'), text: val('sm-text'), covers: covers };
    var res = id ? CI.updateSummary(d, id, o) : CI.addSummary(d, o);
    if (res.error) { A.toast(res.error, true); return; }
    d.ui.lastAuthor = o.author.trim();
    A.persist(); A.closeModal(); A.toast('Summary saved.'); reload(file, 'summaries');
  };
  H['sm-del'] = function (el) {
    var id = el.getAttribute('data-id'), file = el.getAttribute('data-file');
    A.closeModal();
    A.confirm('Delete this summary? Its reports go back to “not covered yet”.', function () { CI.deleteSummary(D(), id); A.persist(); reload(file, 'summaries'); }, { title: 'Delete summary', yes: 'Delete', danger: true });
  };
  H['sm-print'] = function (el) {
    var d = D(), s = d.summaries.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!s) return;
    var f = fileOf(s.fileId);
    A.saveBlob('Summary-' + s.id + '-' + CI.fileSafe(f && f.name) + '.pdf', function () { return CI.pdf.summarySheets(d, A.idx(), [s.id], f ? f.name : ''); });
  };
  H['sm-print-all'] = function (el) {
    var d = D(), file = el.getAttribute('data-file'), f = fileOf(file), ids = CI.summariesFor(d, file).map(function (s) { return s.id; });
    A.saveBlob('Summaries-' + CI.fileSafe(f && f.name) + '.pdf', function () { return CI.pdf.summarySheets(d, A.idx(), ids, f ? f.name : ''); });
  };

  /* ================= TIME LINE ================= */
  var tl = { level: 3, last: '' };
  function lvLabel(n) { return CI.TL_LEVELS.filter(function (l) { return l.id === n; })[0].label; }
  function lvOptions(sel) { return A.options(CI.TL_LEVELS.map(function (l) { return { value: String(l.id), label: l.label }; }), String(sel)); }
  function tlRows(file) {
    var d = D(), rows = CI.timelineFor(d, file, tl.level);
    if (!rows.length) return '<p class="muted pad">' + (d.timeline.some(function (x) { return x.fileId === file; }) ? 'Nothing at this level of detail.' : 'No entries yet. Type the first one above.') + '</p>';
    return '<table class="fixed"><colgroup><col style="width:13%"><col style="width:50%"><col style="width:11%"><col style="width:16%"><col style="width:10%"></colgroup>' +
      '<thead><tr><th>Date of event</th><th>What happened</th><th>Detail</th><th>Reports</th><th></th></tr></thead><tbody>' + rows.map(function (t) {
        return '<tr' + (t.level === 1 ? ' class="key"' : '') + '><td>' + esc(CI.fmtDate(t.date)) + '</td><td class="ellip" title="' + esc(t.text) + '">' + esc(t.text) + '</td><td class="muted">' + esc(lvLabel(t.level)) + '</td>' +
          '<td class="ellip">' + t.reportIds.map(function (r) { return A.repLink(r); }).join(', ') + '</td><td class="right"><button class="btn small" data-action="tl-edit" data-id="' + esc(t.id) + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table>';
  }
  CI.views.fileTimeline = function (e) {
    var d = D(), n = d.timeline.filter(function (x) { return x.fileId === e.id; }).length;
    return '<div class="card"><div class="tl-add"><label>Date of event' + A.dateInput('tl-date', tl.last || '', 'date-fix') + '</label>' +
      '<label class="tl-what">What happened<input type="text" id="tl-text" autocomplete="off" data-file="' + esc(e.id) + '" placeholder="Type the entry and press Enter"></label>' +
      '<label>Detail<select id="tl-level">' + lvOptions(2) + '</select></label>' +
      '<label>Reports<input type="text" id="tl-reps" autocomplete="off" placeholder="R-0003, R-0007"></label>' +
      '<button class="btn primary" data-action="tl-add" data-file="' + esc(e.id) + '">Add</button></div></div>' +
      '<div class="card flush"><div class="row spread pad"><div class="row"><b>Time line</b><span class="muted small">' + n + ' entr' + (n === 1 ? 'y' : 'ies') + '</span>' +
      '<select id="tl-show" data-on-change="tl-show" data-file="' + esc(e.id) + '" aria-label="Level of detail shown">' + A.options([{ value: '1', label: 'Key events only' }, { value: '2', label: 'Key and standard' }, { value: '3', label: 'All entries' }], String(tl.level)) + '</select></div>' +
      '<button class="btn" data-action="tl-print" data-file="' + esc(e.id) + '"' + (n ? '' : ' disabled') + '>Print…</button></div><div id="tl-rows">' + tlRows(e.id) + '</div></div>';
  };
  H['tl-show'] = function (el) { tl.level = Number(el.value) || 3; document.getElementById('tl-rows').innerHTML = tlRows(el.getAttribute('data-file')); };
  H['tl-add'] = function (el) {
    var d = D(), file = el.getAttribute('data-file'), date = A.readDate('tl-date');
    if (date === null) { A.toast(A.dateHelp, true); return; }
    var res = CI.addTimeline(d, { fileId: file, date: date, text: val('tl-text'), level: val('tl-level'), reportIds: val('tl-reps') });
    if (res.error) { A.toast(res.error, true); return; }
    tl.last = date; A.persist(); reload(file, 'timeline');
    var t = document.getElementById('tl-text'); if (t) t.focus();
  };
  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (ev.key !== 'Enter' || !t || (t.id !== 'tl-text' && t.id !== 'tl-reps')) return;
    ev.preventDefault();
    var b = document.querySelector('[data-action="tl-add"]'); if (b) b.click();
  });
  H['tl-edit'] = function (el) {
    var t = D().timeline.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!t) return;
    A.modal('<h2>Time line entry</h2><div class="sm-top"><label>Date of event' + A.dateInput('te-date', t.date, 'date-fix') + '</label><label>Detail<select id="te-level">' + lvOptions(t.level) + '</select></label></div>' +
      '<label>What happened<textarea id="te-text" rows="4">' + esc(t.text) + '</textarea></label><label>Reports<span class="hint"> numbers, separated by commas</span><input type="text" id="te-reps" value="' + esc(t.reportIds.join(', ')) + '"></label>' +
      '<div class="row end"><button class="btn danger" data-action="te-del" data-id="' + esc(t.id) + '">Delete</button><span class="spacer"></span><button class="btn" data-action="modal-close">Cancel</button>' +
      '<button class="btn primary" data-action="te-save" data-id="' + esc(t.id) + '">Save</button></div>');
  };
  H['te-save'] = function (el) {
    var d = D(), id = el.getAttribute('data-id'), date = A.readDate('te-date');
    if (date === null) { A.toast(A.dateHelp, true); return; }
    var res = CI.updateTimeline(d, id, { date: date, text: val('te-text'), level: val('te-level'), reportIds: val('te-reps') });
    if (res.error) { A.toast(res.error, true); return; }
    A.persist(); A.closeModal(); reload(res.entry.fileId, 'timeline');
  };
  H['te-del'] = function (el) {
    var d = D(), id = el.getAttribute('data-id'), t = d.timeline.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    A.closeModal();
    A.confirm('Delete this time line entry?', function () { CI.deleteTimeline(d, id); A.persist(); reload(t.fileId, 'timeline'); }, { title: 'Delete entry', yes: 'Delete', danger: true });
  };
  H['tl-print'] = function (el) {
    var file = el.getAttribute('data-file');
    A.modal('<h2>Print the time line</h2><label>Level of detail<select id="tp-level">' + A.options([{ value: '1', label: 'Key events only' }, { value: '2', label: 'Key and standard' }, { value: '3', label: 'All entries' }], String(tl.level)) + '</select></label>' +
      '<div class="sm-top"><label>From<span class="hint"> optional</span>' + A.dateInput('tp-from', '', 'date-fix') + '</label><label>To<span class="hint"> optional</span>' + A.dateInput('tp-to', '', 'date-fix') + '</label></div>' +
      '<div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="tl-print-go" data-file="' + esc(file) + '">Print</button></div>');
  };
  H['tl-print-go'] = function (el) {
    var d = D(), file = el.getAttribute('data-file'), f = fileOf(file), from = A.readDate('tp-from'), to = A.readDate('tp-to');
    if (from === null || to === null) { A.toast(A.dateHelp, true); return; }
    var o = { maxLevel: Number(val('tp-level')) || 3, from: from, to: to };
    A.closeModal();
    A.saveBlob('Timeline-' + CI.fileSafe(f && f.name) + '.pdf', function () { return CI.pdf.timelineSheet(d, A.idx(), file, o); });
  };

  /* ================= the other sheets, in the same print style ================= */
  H['print-profile'] = function (el) { var f = fileOf(el.getAttribute('data-id')); if (f) A.saveBlob('Profile-' + CI.fileSafe(f.name) + '.pdf', function () { return CI.pdf.profileSheet(D(), A.idx(), f.id); }); };
  H['print-connections'] = function (el) { var f = fileOf(el.getAttribute('data-id')); if (f) A.saveBlob('Connections-' + CI.fileSafe(f.name) + '.pdf', function () { return CI.pdf.connectionsSheet(D(), A.idx(), f.id); }); };
  H['print-report'] = function (el) { var id = el.getAttribute('data-id'); A.saveBlob('Report-' + id + '.pdf', function () { return CI.pdf.reportSheet(D(), A.idx(), id); }); };
  H['print-estimate'] = function (el) {
    var b = D().banks.filter(function (x) { return x.id === el.getAttribute('data-bank'); })[0]; if (!b) return;
    A.saveBlob('Estimate-' + CI.fileSafe(b.name) + '.pdf', function () { return CI.pdf.estimateSheet(D(), A.idx(), b.id, el.getAttribute('data-est')); });
  };
})();
