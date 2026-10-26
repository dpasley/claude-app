/* Cross-Index UI: router, reports/intake, entity files, review log, settings.
 * The chart screen lives in chartview.js and uses the CI.app helpers exposed at the bottom. */
(function () {
  'use strict';
  var d = CI.load();
  var _idx = null;
  var view = document.getElementById('view');
  var cur = 'report-new', hist = [], pend = null, saveWarned = false;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function idx() { return _idx || (_idx = CI.buildIndex(d)); }
  function persist() {
    _idx = null;
    if (!CI.save(d) && !saveWarned) { saveWarned = true; toast('This browser is not keeping a saved copy (storage may be full or blocked). Export your data from Settings.', true); }
    updateNav();
  }
  function toast(msg, bad) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = ''; }, bad ? 7000 : 2600);
  }
  function go(h) {
    h = String(h).replace(/^#\/?/, '') || 'report-new';
    if (h === cur) { route(); return; }
    hist.push(cur); if (hist.length > 50) hist.shift();
    cur = h; route();
  }
  function logEvent(kind, text, reportId) {
    d.log.push({ id: CI.nextId(d, 'snag'), t: new Date().toISOString(), kind: kind, text: text, reportId: reportId || '', resolved: false });
  }
  function tag(t) { return '<span class="tag t-' + esc(t) + '">' + esc(CI.TYPE_LABEL[t] || t) + '</span>'; }
  /* Dates are typed and shown as day, short month, year (25 Oct. 2026) and kept as YYYY-MM-DD underneath. */
  function dateInput(id, iso, onchange, extra) {
    return '<span class="datebox"><input type="text" class="date-in" id="' + esc(id) + '" value="' + esc(CI.fmtDate(iso)) + '" placeholder="25 Oct. 2026" autocomplete="off" data-cal="1" data-on-change="' + (onchange || 'date-fix') + '"' + (extra || '') + '>' +
      '<button type="button" class="cal-btn" data-action="date-pick" data-for="' + esc(id) + '" title="Pick from a calendar" aria-label="Pick from a calendar">' +
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/></svg></button></span>';
  }
  /* A small calendar that opens under a date box. Typing still works; picking writes the date and fires the field's change. */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var calQuiet = false, cal = { el: null, input: null, y: 0, m: 0 };
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function calClose() { if (cal.el) { cal.el.remove(); cal.el = null; cal.input = null; } }
  function calDraw() {
    var sel = CI.parseDate(cal.input.value) || '', today = CI.today(), first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(cal.y, cal.m + 1, 0).getDate();
    var h = '<div class="cal-head"><button type="button" data-cal-nav="-1" aria-label="Previous month">\u2039</button><b>' + MONTHS[cal.m] + ' ' + cal.y + '</b><button type="button" data-cal-nav="1" aria-label="Next month">\u203a</button></div><div class="cal-grid">' +
      ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function (x) { return '<span class="dow">' + x + '</span>'; }).join('');
    for (var i = 0; i < lead; i++) h += '<span></span>';
    for (var n = 1; n <= days; n++) {
      var iso = cal.y + '-' + pad2(cal.m + 1) + '-' + pad2(n);
      h += '<button type="button" class="day' + (iso === sel ? ' sel' : '') + (iso === today ? ' today' : '') + '" data-cal-day="' + iso + '">' + n + '</button>';
    }
    h += '</div><div class="cal-foot"><button type="button" data-cal-day="' + today + '">Today</button><button type="button" data-cal-day="">Clear</button></div>';
    cal.el.innerHTML = h;
  }
  function calOpen(input) {
    if (cal.input === input) return;
    calClose();
    var base = CI.parseDate(input.value) || CI.today();
    cal.y = Number(base.slice(0, 4)); cal.m = Number(base.slice(5, 7)) - 1; cal.input = input;
    cal.el = document.createElement('div'); cal.el.className = 'cal-pop'; cal.el.setAttribute('role', 'dialog');
    input.parentNode.appendChild(cal.el); calDraw();
  }
  function calSet(iso) {
    var input = cal.input; if (!input) return;
    input.value = iso ? CI.fmtDate(iso) : ''; input.classList.remove('bad'); input.title = '';
    input.dispatchEvent(new Event('change', { bubbles: true })); calClose(); calQuiet = true; input.focus(); calQuiet = false;
  }
  document.addEventListener('focusin', function (ev) { if (!calQuiet && ev.target.matches && ev.target.matches('input[data-cal]')) calOpen(ev.target); });
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t.closest) return;
    var nav = t.closest('[data-cal-nav]'), day = t.closest('[data-cal-day]');
    if (nav && cal.el) { cal.m += Number(nav.getAttribute('data-cal-nav')); if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } calDraw(); return; }
    if (day && cal.el) { calSet(day.getAttribute('data-cal-day')); return; }
    var btn = t.closest('[data-action="date-pick"]');
    if (btn) { var inp = document.getElementById(btn.getAttribute('data-for')); if (cal.input === inp) calClose(); else { calClose(); if (inp) calOpen(inp); } return; }
    if (cal.el && !t.closest('.cal-pop') && !(t.matches && t.matches('input[data-cal]'))) calClose();
  }, true);
  document.addEventListener('keydown', function (ev) { if (cal.el && (ev.key === 'Escape' || ev.key === 'Tab')) calClose(); });
  function readDate(id) { return CI.parseDate(val(id)); }
  var DATE_HELP = 'Not a date I can read. Try 25 Oct. 2026.';
  function kindTag(e) { return e ? tag(e.type) + (e.itemType ? ' <span class="muted small">' + esc(e.itemType) + '</span>' : '') : ''; }
  function ensureSuggested() {
    if (d.settings.suggestedTypes) return;
    CI.addSuggestedLinkTypes(d); d.settings.suggestedTypes = true;
  }
  /* Connection types as a grouped drop-down. Every label reads as "A [label] B". */
  function linkTypeOptions(sel, blank, all) {
    var groups = [], by = {};
    d.settings.linkTypes.forEach(function (t) {
      if (all === false && t.id !== 'CONNECTED_TO' && t.group !== 'Added by staff') return; var g = t.group || 'Other'; if (!by[g]) { by[g] = []; groups.push(g); } by[g].push(t); });
    groups.sort(function (a, b) { return (a === 'Older names') - (b === 'Older names') || (a === 'Other') - (b === 'Other'); });
    return (all === false ? '' : '<option value="">' + esc(blank || 'Choose…') + '</option>') + groups.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + by[g].map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.label + (t.directed ? '  →' : '  ↔')) + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + '<option value="__new__">＋ New connection type…</option>';
  }
  function avatar(e, px) {
    var pic = CI.tile(e.type, CI.TYPE_COLOR[e.type] || '#666666', CI.PHOTO_TYPES[e.type] && e.photo ? e.photo : '');
    return '<img class="avatar" alt="" width="' + px + '" height="' + px + '" src="' + esc(pic) + '">';
  }
  function entLink(id) {
    var e = idx().entity[id];
    return e ? '<a href="#/entity/' + esc(id) + '">' + esc(e.name) + '</a>' : '<span class="muted">' + esc(id) + ' (removed)</span>';
  }
  function repLink(id) { return '<a href="#/report/' + esc(id) + '">' + esc(id) + '</a>'; }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function options(list, sel, blank) {
    return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (x) {
      var v = typeof x === 'string' ? x : x.value, l = typeof x === 'string' ? x : x.label;
      return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }
  function lt(id) { return CI.linkType(d, id); }
  /* Connections as one table with aligned columns, grouped by what is at the other end (used on name pages and the connection index). */
  function connTable(groups) {
    return '<table class="fixed"><colgroup><col style="width:27%"><col style="width:21%"><col style="width:28%"><col style="width:24%"></colgroup>' +
      '<thead><tr><th>Name</th><th>Connection</th><th>What it is</th><th>Source report</th></tr></thead><tbody>' +
      groups.map(function (g) {
        return '<tr class="sec"><td colspan="4">' + esc(g.label) + ' <span class="muted">' + g.rows.length + '</span></td></tr>' + g.rows.map(function (r) {
          return '<tr><td>' + entLink(r.other.id) + '</td><td title="' + esc(r.phrase) + '">' + esc(r.phrase) + '</td><td title="' + esc(r.note) + '">' + esc(r.note) + '</td><td>' + repLink(r.reportId) + ' <span class="muted small">' + esc(CI.fmtDate(r.date)) + '</span></td></tr>';
        }).join('');
      }).join('') + '</tbody></table>';
  }
  function linkPhrase(l) {
    var t = lt(l.type);
    return entLink(l.from) + ' <span class="rel">' + (t.directed ? '— ' : '↔ ') + esc(t.label) + (t.directed ? ' →' : ' ↔') + '</span> ' + entLink(l.to);
  }
  function openCount() {
    var n = d.log.filter(function (x) { return !x.resolved; }).length;
    d.reports.forEach(function (r) { r.entities.forEach(function (x) { if (x.flag) n++; }); });
    return n;
  }
  function updateNav() {
    var h = '#/' + cur;
    var back = document.getElementById('back-btn'); if (back) back.disabled = !hist.length;
    var sb = document.getElementById('sample-banner');
    if (sb) sb.hidden = true;
    document.querySelectorAll('#nav a').forEach(function (a) {
      var key = a.getAttribute('data-nav');
      a.classList.toggle('active', h.indexOf('#/' + key) === 0 || (key === 'report-new' && h.indexOf('#/report') === 0) || (key === 'entities' && h.indexOf('#/entity') === 0) || (key === 'leads' && h.indexOf('#/lead') === 0) || (key === 'chart' && h.indexOf('#/estimate') === 0) || (key === 'investigations' && (h.indexOf('#/investigation') === 0 || h.indexOf('#/casechart') === 0)));
      if (a.getAttribute('data-nav') === 'indexes' && (h.indexOf('#/observation') === 0)) a.classList.add('active');
    });
    var rc = document.getElementById('review-count'), n = openCount();
    rc.textContent = n ? n : ''; rc.style.display = n ? 'inline-block' : 'none';
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  /* In-page dialogs: browsers inside embedded viewers can suppress confirm()/prompt(), so the app has its own. */
  function modal(html, wide) {
    document.getElementById('modal-root').innerHTML = '<div class="overlay" data-action="modal-bg"><div class="dialog' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; pend = null; }
  function askConfirm(msg, onYes, o) {
    o = o || {}; pend = { yes: onYes };
    modal('<h2>' + esc(o.title || 'Are you sure?') + '</h2><p class="pre">' + esc(msg) + '</p><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn ' + (o.danger ? 'danger solid' : 'primary') + '" data-action="modal-yes">' + esc(o.yes || 'Confirm') + '</button></div>');
    var b = document.querySelector('#modal-root [data-action="modal-yes"]'); if (b) b.focus();
  }
  function askText(msg, def, onOk, o) {
    o = o || {}; pend = { ok: onOk };
    modal('<h2>' + esc(o.title || '') + '</h2><label>' + esc(msg) + '<input type="text" id="modal-input" value="' + esc(def || '') + '"></label><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="modal-ok">' + esc(o.ok || 'OK') + '</button></div>');
    var i = document.getElementById('modal-input'); if (i) { i.focus(); i.select(); }
  }

  /* ---------- router ---------- */
  var handlers = {};
  function route() {
    var parts = cur.split('/');
    window.scrollTo(0, 0);
    view.className = '';
    if (CI.chart) CI.chart.destroy();
    var name = parts[0] || 'report-new';
    var gsr = document.getElementById('gs-results'); if (gsr) gsr.innerHTML = '';
    if (name === 'reports') viewReports();
    else if (name === 'report-new') viewReportForm(null);
    else if (name === 'report' && parts[2] === 'edit') viewReportForm(parts[1]);
    else if (name === 'report') viewReport(parts[1]);
    else if (name === 'entities') { if (parts[1]) entStates.files.type = decodeURIComponent(parts[1]); viewEntities('files'); }
    else if (name === 'items') CI.views.indexes('', '');
    else if (name === 'indexes') CI.views.indexes(parts[1] ? decodeURIComponent(parts[1]) : '', parts[2]);
    else if (name === 'entity') viewEntity(parts[1]);
    else if (name === 'chart') CI.views.chart(parts[1] || '');
    else if (name === 'observation') CI.views.observation();
    else if (name === 'investigations') CI.views.investigations();
    else if (name === 'investigation') CI.views.investigation(parts[1]);
    else if (name === 'casechart') CI.views.casechart(parts[1]);
    else if (name === 'leads') CI.views.leads();
    else if (name === 'lead') CI.views.lead(parts[1]);
    else if (name === 'estimate') CI.views.estimate(parts[1]);
    else if (name === 'review') viewReview();
    else if (name === 'settings') viewSettings();
    else viewReportForm(null);
    updateNav();
  }
  document.addEventListener('click', function (ev) {
    var link = ev.target.closest('a[href^="#/"]');
    if (link && !link.hasAttribute('data-action')) { ev.preventDefault(); go(link.getAttribute('href')); return; }
    var el = ev.target.closest('[data-action]');
    if (!el || !handlers[el.getAttribute('data-action')]) return;
    if (el.tagName === 'A') ev.preventDefault();
    handlers[el.getAttribute('data-action')](el, ev);
  });
  document.addEventListener('keydown', function (ev) {
    if (!document.querySelector('#modal-root .overlay')) return;
    if (ev.key === 'Escape') closeModal();
    else if (ev.key === 'Enter' && ev.target && ev.target.id === 'modal-input') { ev.preventDefault(); handlers['modal-ok'](); }
  });
  handlers['date-fix'] = function (el) {
    var v = CI.parseDate(el.value);
    if (v === null) { el.classList.add('bad'); el.title = DATE_HELP; }
    else { el.classList.remove('bad'); el.title = ''; el.value = CI.fmtDate(v); }
  };
  handlers['date-pick'] = function () {};
  handlers['modal-close'] = function () { closeModal(); };
  handlers['modal-bg'] = function (el, ev) { if (ev.target === el) closeModal(); };
  handlers['modal-yes'] = function () { var f = pend && pend.yes; closeModal(); if (f) f(); };
  handlers['modal-ok'] = function () {
    var v = val('modal-input').trim(), f = pend && pend.ok;
    if (!v || !f) return;
    closeModal(); f(v);
  };
  ['change', 'input'].forEach(function (type) {
    document.addEventListener(type, function (ev) {
      var el = ev.target.closest('[data-on-' + type + ']');
      if (!el) return;
      var fn = handlers[el.getAttribute('data-on-' + type)];
      if (fn) fn(el, ev);
    });
  });

  /* ---------- REPORTS LIST ---------- */
  var repFilter = '';
  function repTitle(r) { return r.subject || trunc(r.summary, 80) || r.sourceRef || r.id; }
  function repRows() {
    var q = CI.norm(repFilter);
    var rows = d.reports.slice().sort(function (a, b) { return (b.received || '').localeCompare(a.received || '') || b.id.localeCompare(a.id); })
      .filter(function (r) { return !q || CI.norm([r.id, r.subject, r.sourceRef, r.summary, r.basis, r.sourceType].join(' ')).indexOf(q) !== -1; });
    if (!rows.length) return '<tr><td colspan="7" class="empty">No reports match.</td></tr>';
    return rows.map(function (r) {
      var nl = d.links.filter(function (l) { return l.reportId === r.id; }).length;
      var status = r.dupOf ? '<span class="tag">repost of ' + esc(r.dupOf) + '</span>' : (r.entities.length ? '<span class="tag ok">indexed</span>' : '<span class="tag warn">not indexed</span>');
      return '<tr><td><a href="#/report/' + esc(r.id) + '">' + esc(r.id) + '</a></td><td>' + esc(CI.fmtDate(r.received)) + '</td><td class="ellip" title="' + esc(repTitle(r)) + '">' + esc(trunc(repTitle(r), 60)) +
        '</td><td class="ellip" title="' + esc(r.sourceRef) + '">' + esc(trunc(r.sourceRef, 40)) + '</td><td class="num">' + r.entities.length +
        '</td><td class="num">' + nl + '</td><td>' + status + '</td></tr>';
    }).join('');
  }
  function viewReports() {
    var empty = !d.reports.length && !d.entities.length;
    view.innerHTML = '<div class="page-head"><h1>Reports</h1><div class="row"><input type="search" id="rep-filter" placeholder="Filter reports…" value="' + esc(repFilter) + '" data-on-input="rep-filter"><a class="btn primary" href="#/report-new">New report</a></div></div>' +
      (empty ? '<div class="card callout"><strong>Nothing here yet.</strong> Start with <a href="#/report-new">a new report</a>, or load a small set of fictional sample data from <a href="#/settings">Settings</a> to see how the pieces fit together.</div>' : '') +
      '<div class="card flush"><table><thead><tr><th>ID</th><th>Date of report</th><th>Subject</th><th>Source</th><th class="num">Names</th><th class="num">Connections</th><th>Status</th></tr></thead><tbody id="rep-rows">' + repRows() + '</tbody></table></div>';
  }
  handlers['rep-filter'] = function (el) { repFilter = el.value; document.getElementById('rep-rows').innerHTML = repRows(); };

  /* ---------- REPORT FORM (new + edit) ---------- */
  var repDefaults = null;
  function viewReportForm(id) {
    var r = id ? idx().report[id] : null;
    if (id && !r) return notFound('Report');
    r = r || Object.assign({ received: CI.today(), subject: '', eventDate: '', sourceRef: '', archiveLoc: '', dupOf: '', leadId: '', summary: '', basis: '' }, repDefaults || {});
    repDefaults = null;
    view.innerHTML = '<div class="page-head"><h1>' + (id ? 'Edit report – ' + esc(id) : 'New report') + '</h1></div>' +
      '<form class="card form rep-form" id="rep-form" onsubmit="return false">' +
      '<p class="form-intro">Record the report first. Next you add the names it mentions and the connections it shows.</p>' +
      '<div class="rf-grid">' +
      '<label class="rf-date">Date of report' + dateInput('f-received', r.received) + '</label>' +
      '<label class="rf-subject">Subject of report<input type="text" id="f-subject" value="' + esc(r.subject || '') + '" placeholder="What is the report about?"></label>' +
      '<label class="rf-source">Source of report<input type="text" id="f-ref" value="' + esc(r.sourceRef) + '" placeholder="Name, URL, handle or document title"></label>' +
      '<label class="rf-date">Date of the event or posting <span class="hint">if different</span>' + dateInput('f-event', r.eventDate) + '</label>' +
      '<label class="rf-wide">Where the preserved copy is kept <span class="hint">path, URL or file reference</span><input type="text" id="f-arch" value="' + esc(r.archiveLoc) + '"></label>' +
      '<label class="rf-wide">Notes or summary <span class="hint">in your own words</span><textarea id="f-summary" rows="4">' + esc(r.summary) + '</textarea></label>' +
      '</div>' +
      (r.leadId ? '<input type="hidden" id="f-lead" value="' + esc(r.leadId) + '"><p class="muted small">This report was started from lead ' + esc(r.leadId) + ' and answers it.</p>' : '') +
      '<div id="form-errors" class="errors" role="alert"></div>' +
      '<div class="rf-actions"><button class="btn primary" data-action="save-report" data-id="' + esc(id || '') + '">' + (id ? 'Save' : 'Save, then add names and connections') + '</button><a class="btn" href="' + (id ? '#/report/' + esc(id) : '#/reports') + '">Cancel</a></div></form>';
  }
  handlers['save-report'] = function (el) {
    var id = el.getAttribute('data-id'), ex = id ? idx().report[id] : null;
    var rec = readDate('f-received'), ev = readDate('f-event');
    var r = {
      received: rec || '', subject: val('f-subject').trim(), eventDate: ev || '', sourceRef: val('f-ref').trim(),
      archiveLoc: val('f-arch').trim(), summary: val('f-summary').trim()
    };
    var leadEl = document.getElementById('f-lead'); if (leadEl) r.leadId = leadEl.value;
    var problems = CI.validateReport(r), box = document.getElementById('form-errors');
    if (rec === null) problems = [DATE_HELP.replace('Not a date', 'Date of report is not a date')].concat(problems.filter(function (x) { return !/^Date of report/.test(x); }));
    if (ev === null) problems.push('Date of the event is not a date I can read. Try 25 Oct. 2026.');
    if (problems.length) {
      box.innerHTML = problems.map(function (p) { return '<div>' + esc(p) + '</div>'; }).join('');
      logEvent('blocked', 'Save blocked: ' + problems.join(' '), id || '(new report)');
      persist();
      return;
    }
    var finish = function (hash) {
      if (ex) {
        Object.assign(ex, r, { updated: CI.today() });
        if (hash !== undefined) { ex.hash = hash.hash; ex.hashAt = hash.at; }
        persist(); toast('Details saved.'); go('#/report/' + ex.id);
      } else {
        var n = Object.assign({ id: CI.nextId(d, 'report'), hash: hash ? hash.hash : '', hashAt: hash ? hash.at : '', basis: '', dupOf: '', leadId: '', entities: [], created: CI.today(), updated: CI.today() }, r);
        d.reports.push(n); persist(); go('#/report/' + n.id);
      }
    };
    finish();
  };

  /* ---------- REPORT PAGE (indexing) ---------- */
  var ae = { reportId: '', q: '' };
  function notFound(what) { view.innerHTML = '<div class="card">' + esc(what) + ' not found. <a href="#/entities">Back to files</a></div>'; }
  function viewReport(id) {
    var r = idx().report[id];
    if (!r) return notFound('Report');
    if (ae.reportId !== id) ae = { reportId: id, q: '', type: ae.type || '' };
    var dupInfo = r.dupOf ? '<span class="tag">repost of ' + repLink(r.dupOf) + '</span> <span class="muted small">counts as one report with the original</span>' : '';
    var reposts = d.reports.filter(function (x) { return x.dupOf === id; });
    var h = '<div class="page-head"><h1>' + esc(r.id) + ' <span class="muted">' + esc(trunc(repTitle(r), 90)) + '</span></h1><div class="row"><button class="btn" data-action="raise-lead-report" data-id="' + esc(id) + '">Raise a lead</button><a class="btn" href="#/report/' + esc(id) + '/edit">Edit details</a><button class="btn danger" data-action="del-report" data-id="' + esc(id) + '">Delete</button></div></div>';
    h += '<div class="card"><dl class="kv"><dt>Date of report</dt><dd>' + esc(CI.fmtDate(r.received)) + (r.eventDate ? ' <span class="muted">(event ' + esc(CI.fmtDate(r.eventDate)) + ')</span>' : '') + '</dd>' +
      '<dt>Subject</dt><dd>' + esc(r.subject || '–') + '</dd>' +
      '<dt>Source</dt><dd>' + esc(r.sourceRef) + (r.sourceType ? ' <span class="muted">(' + esc(r.sourceType) + ')</span>' : '') + '</dd>' +
      (r.basis ? '<dt>Intake basis</dt><dd>' + esc(r.basis) + '</dd>' : '') +
      (r.archiveLoc ? '<dt>Preserved copy</dt><dd>' + esc(r.archiveLoc) + '</dd>' : '') +
      (r.hash ? '<dt>Fingerprint</dt><dd class="mono small">' + esc(r.hash) + '<br><span class="muted">captured ' + esc(CI.fmtDateTime(r.hashAt)) + '</span></dd>' : '') +
      (dupInfo ? '<dt>Repost</dt><dd>' + dupInfo + '</dd>' : '') +
      (r.leadId ? '<dt>Answers lead</dt><dd><a href="#/lead/' + esc(r.leadId) + '">' + esc(r.leadId) + '</a></dd>' : '') +
      (reposts.length ? '<dt>Reposts</dt><dd>' + reposts.map(function (x) { return repLink(x.id); }).join(', ') + '</dd>' : '') +
      (r.summary ? '<dt>Notes</dt><dd>' + esc(r.summary) + '</dd>' : '') + '</dl></div>';

    h += '<div class="card"><h2>1. Names mentioned in this report</h2><p class="muted small">Every individual, group, area and subject the report names. Start typing: pick the existing name when it is the same one, and create a new one only when it is not. Press Enter to add.</p>';
    if (r.entities.length) {
      h += '<table class="fixed"><colgroup><col style="width:44%"><col style="width:22%"><col style="width:22%"><col style="width:12%"></colgroup><thead><tr><th>Name</th><th>Type</th><th>Unsure of match</th><th></th></tr></thead><tbody>' + r.entities.map(function (x) {
        var e = idx().entity[x.entityId];
        return '<tr><td>' + entLink(x.entityId) + (e && e.details ? ' <span class="muted small">' + esc(e.details) + '</span>' : '') + (e && e.aliases.length ? ' <span class="muted small">also: ' + esc(e.aliases.join(', ')) + '</span>' : '') + '</td><td>' + kindTag(e) + '</td>' +
          '<td><label class="chk"><input type="checkbox" data-on-change="flag-toggle" data-eid="' + esc(x.entityId) + '"' + (x.flag ? ' checked' : '') + '> flag</label>' +
          (x.flag ? '<input type="text" placeholder="what is unclear?" value="' + esc(x.flagNote) + '" data-on-change="flag-note" data-eid="' + esc(x.entityId) + '">' : '') + '</td>' +
          '<td><button class="btn small" data-action="remove-entity" data-eid="' + esc(x.entityId) + '">Remove</button></td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="callout-inline">No names yet. This report is not indexed until at least one is added.</p>';
    h += '<div class="addbox"><h3>Add a name</h3><div class="grid3"><label>Name<input type="text" id="ae-q" autocomplete="off" value="' + esc(ae.q) + '" data-on-input="ae-input" placeholder="Start typing to find an existing one…"></label>' +
      '<label class="chk lower"><input type="checkbox" id="ae-flag"> Unsure this is the same one – flag for review</label></div>' +
      '<div id="ae-results"></div>' +
      '<div class="row create wrap"><select id="ae-type" data-on-change="ae-type-change">' + options(CI.ENTITY_TYPES.map(function (t) { return { value: t, label: CI.TYPE_LABEL[t] }; }), ae.type, 'Type if new…') + '</select>' +
      '<input type="text" id="ae-details" class="wide-in" placeholder="Anything that tells this one apart: date of birth or age, address, nickname, description (optional)" value="' + esc(ae.details || '') + '" data-on-input="ae-details"' + '>' +
      '<button class="btn" data-action="ae-create" id="ae-create-btn">Create as new</button><span class="muted small">Area: a city, region or campus. Phones, plates, accounts and addresses are not indexed; if one matters, put it in the identifying details or a connection note.</span></div><div id="ae-msg" class="errors"></div></div></div>';

    h += '<div class="card"><h2>2. Connections this report shows</h2><p class="muted small">Each connection is tied to this report as its source. Read it as a sentence: <em>A — Member of → B</em> means A is a member of B. Two names can have several connections.</p>';
    var mine = d.links.filter(function (l) { return l.reportId === id; });
    if (mine.length) {
      h += '<table class="fixed"><colgroup><col style="width:26%"><col style="width:17%"><col style="width:26%"><col style="width:22%"><col style="width:9%"></colgroup>' +
        '<thead><tr><th>From</th><th>Connection</th><th>To</th><th>What it is</th><th></th></tr></thead><tbody>' + mine.map(function (l) {
        var t = lt(l.type);
        return '<tr><td>' + entLink(l.from) + '</td><td title="' + esc(t.label) + '">' + (t.directed ? '→ ' : '↔ ') + esc(t.label) + '</td><td>' + entLink(l.to) + '</td><td title="' + esc(l.note) + '">' + esc(l.note) + '</td><td class="right"><button class="btn small" data-action="del-link" data-id="' + esc(l.id) + '">Remove</button></td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="muted">No connections recorded for this report yet.</p>';
    if (r.entities.length >= 2) {
      var ents = r.entities.map(function (x) { var e = idx().entity[x.entityId]; return { value: x.entityId, label: e ? e.name : x.entityId }; });
      h += '<div class="addbox"><h3>Add a connection</h3><div class="grid4"><label>From<select id="lk-from" data-on-change="lk-preview">' + options(ents, '', 'Choose…') + '</select></label>' +
        '<label>Connection<select id="lk-type" data-on-change="lk-preview">' + linkTypeOptions(ae.allTypes ? '' : 'CONNECTED_TO', 'Choose…', !!ae.allTypes) + '</select></label>' +
        '<label>To<select id="lk-to" data-on-change="lk-preview">' + options(ents, '', 'Choose…') + '</select></label>' +
        '<label>What is the connection? <span class="hint">required: brother, treasurer, owner of the plate…</span><input type="text" id="lk-note"></label></div>' +
        '<label class="row small"><input type="checkbox" id="lk-all"' + (ae.allTypes ? ' checked' : '') + ' data-on-change="lk-all"> Show the full list of connection types</label>' +
        '<div class="row"><button class="btn primary" data-action="add-link">Add connection</button><button class="btn" data-action="lk-swap">Swap direction</button><span id="lk-preview" class="muted"></span></div><div id="lk-msg" class="errors"></div></div>';
    } else h += '<p class="callout-inline">Add at least two names above to record a connection between them.</p>';
    h += '</div>';
    h += '<div class="card row spread"><span class="muted">Finished with this report?</span><span class="row"><a class="btn" href="#/entities">Files</a><a class="btn primary" href="#/report-new">Start next report</a></span></div>';
    view.innerHTML = h;
    renderAeResults();
  }

  var aeSel = -1, aeCands = [];
  function renderAeResults() {
    var box = document.getElementById('ae-results');
    if (!box) return;
    var r = idx().report[ae.reportId];
    var btn = document.getElementById('ae-create-btn');
    var q = ae.q.trim();
    if (btn) btn.textContent = q ? 'Create “' + trunc(q, 30) + '” as new' : 'Create as new';
    if (!q) { box.innerHTML = ''; return; }
    var cands = CI.findCandidates(d, q);
    aeCands = cands;
    if (aeSel >= cands.length) aeSel = cands.length - 1;
    if (!cands.length) { box.innerHTML = '<p class="muted small">Nothing existing looks like this. Choose a type below to create it.</p>'; return; }
    box.innerHTML = cands.map(function (c, i) {
      var inRep = r.entities.some(function (x) { return x.entityId === c.entity.id; });
      var nrep = (idx().reportsByEntity[c.entity.id] || []).length;
      return '<div class="cand' + (i === aeSel ? ' active' : '') + '"><div><strong>' + esc(c.entity.name) + '</strong> ' + kindTag(c.entity) + '<div class="small">' + (c.entity.details ? esc(c.entity.details) : '<span class="muted">no identifying details yet</span>') + '</div><div class="muted small">' + (c.score === 1 ? 'exact match' : 'possible match') +
        (c.via !== c.entity.name ? ' on “' + esc(c.via) + '”' : '') + ' · ' + esc(c.entity.id) + ' · ' + nrep + ' report' + (nrep === 1 ? '' : 's') + '</div></div>' +
        (inRep ? '<span class="muted small">already in this report</span>' : '<button class="btn small" data-action="ae-use" data-eid="' + esc(c.entity.id) + '">Use this one</button>') + '</div>';
    }).join('');
  }
  /* Search box in the header: names and reports. */
  var gsHits = [];
  handlers['gs-input'] = function (el) {
    var q = CI.norm(el.value), box = document.getElementById('gs-results'), out = [];
    if (!q) { box.innerHTML = ''; gsHits = []; return; }
    CI.findCandidates(d, el.value, 12).forEach(function (c) { out.push({ href: '#/entity/' + c.entity.id, name: c.entity.name, kind: c.entity.itemType ? c.entity.itemType : CI.TYPE_LABEL[c.entity.type], sub: c.entity.details || '' }); });
    d.entities.forEach(function (e) {
      if (out.some(function (o) { return o.href === '#/entity/' + e.id; })) return;
      if (CI.norm([e.name, e.details || ''].concat(e.aliases || []).join(' ')).indexOf(q) !== -1) out.push({ href: '#/entity/' + e.id, name: e.name, kind: e.itemType ? e.itemType : CI.TYPE_LABEL[e.type], sub: e.details || '' });
    });
    d.reports.forEach(function (r) {
      if (CI.norm([r.id, r.subject, r.sourceRef].join(' ')).indexOf(q) !== -1) out.push({ href: '#/report/' + r.id, name: r.id + ' ' + (r.subject || ''), kind: 'Report', sub: CI.fmtDate(r.received) });
    });
    gsHits = out.slice(0, 12);
    box.innerHTML = gsHits.length ? gsHits.map(function (o) {
      return '<a class="pick" href="' + esc(o.href) + '"><strong>' + esc(o.name) + '</strong> <span class="muted small">' + esc(o.kind) + (o.sub ? ' · ' + esc(trunc(o.sub, 50)) : '') + '</span></a>';
    }).join('') : '<div class="muted small pad">Nothing found.</div>';
  };
  handlers['ae-input'] = function (el) { ae.q = el.value; aeSel = -1; renderAeResults(); document.getElementById('ae-msg').textContent = ''; };
  handlers['ae-type-change'] = function (el) {
    ae.type = el.value;
  };
  handlers['ae-details'] = function (el) { ae.details = el.value; };
  /* Enter in the name box: use the exact match if there is one, otherwise create it as the chosen type. */
  document.addEventListener('keydown', function (ev) {
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-lookup')) {
      /* Every lookup box: arrow down and up move through the matches, Enter picks the highlighted one (or the first). */
      var box = document.querySelector(ev.target.getAttribute('data-lookup')), rows = box ? Array.prototype.slice.call(box.querySelectorAll('.pick')) : [];
      var at = -1; rows.forEach(function (r, i) { if (r.classList.contains('active')) at = i; });
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        if (!rows.length) return;
        ev.preventDefault();
        var next = ev.key === 'ArrowDown' ? Math.min(at + 1, rows.length - 1) : at - 1;
        rows.forEach(function (r, i) { r.classList.toggle('active', i === next); });
        if (rows[next] && rows[next].scrollIntoView) rows[next].scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter' && rows.length) {
        ev.preventDefault();
        var pickRow = rows[at >= 0 ? at : 0], tgt = pickRow.matches('a,button') ? pickRow : pickRow.querySelector('a[href],button');
        if (ev.target.id === 'gs') { ev.target.value = ''; box.innerHTML = ''; }
        if (tgt) tgt.click();
      } else if (ev.key === 'Escape' && ev.target.id === 'gs') { ev.target.value = ''; box.innerHTML = ''; }
      return;
    }
    if (!ev.target || ev.target.id !== 'ae-q') return;
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && aeCands.length) {
      ev.preventDefault();
      aeSel = ev.key === 'ArrowDown' ? Math.min(aeSel + 1, aeCands.length - 1) : Math.max(aeSel - 1, -1);
      renderAeResults();
      var on = document.querySelector('#ae-results .cand.active'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    var q = ae.q.trim(), r = idx().report[ae.reportId];
    if (!q || !r) return;
    if (aeSel >= 0 && aeCands[aeSel]) {
      var pick = aeCands[aeSel].entity;
      if (r.entities.some(function (x) { return x.entityId === pick.id; })) { document.getElementById('ae-msg').textContent = 'Already in this report.'; return; }
      aeSel = -1;
      handlers['ae-use']({ getAttribute: function () { return pick.id; } });
      return;
    }
    var exact = CI.findCandidates(d, q).filter(function (c) { return c.score === 1; })[0];
    if (exact && r.entities.some(function (x) { return x.entityId === exact.entity.id; })) { document.getElementById('ae-msg').textContent = 'Already in this report.'; return; }
    if (exact) handlers['ae-use']({ getAttribute: function () { return exact.entity.id; } });
    else handlers['ae-create']();
  });
  handlers['ae-use'] = function (el) {
    aeSel = -1;
    var flag = document.getElementById('ae-flag').checked;
    var note = '';
    var err = CI.addEntityToReport(d, ae.reportId, el.getAttribute('data-eid'), '', flag, note);
    if (err) { document.getElementById('ae-msg').textContent = err; return; }
    ae.q = ''; persist(); viewReport(ae.reportId);
    var q = document.getElementById('ae-q'); if (q) q.focus();
  };
  handlers['ae-create'] = function () {
    var q = ae.q.trim(), msg = document.getElementById('ae-msg'), type = val('ae-type');
    if (!q) { msg.textContent = 'Type a name first.'; return; }
    if (!type) {
      msg.textContent = 'Choose what type this is (individual, group, area or subject).';
      logEvent('unclear-type', '“' + q + '” was not added because no type was chosen (individual, group, area or subject).', ae.reportId); persist(); return;
    }
    ae.type = type;
    var role = '', flag = document.getElementById('ae-flag').checked, rid = ae.reportId;
    var cands = CI.findCandidates(d, q), exact = cands.filter(function (c) { return c.score === 1; })[0];
    function create() {
      if (cands.length) logEvent('similar-created', 'Created “' + q + '” as new although similar names exist: ' + cands.map(function (c) { return c.entity.name + ' (' + c.entity.id + ')'; }).join(', ') + '.', rid);
      var e = CI.addEntity(d, { type: type, name: q, details: val('ae-details').trim() });
      ae.details = '';
      CI.addEntityToReport(d, rid, e.id, role, flag, '');
      ae.q = ''; persist(); viewReport(rid);
      var qi = document.getElementById('ae-q'); if (qi) qi.focus();
    }
    if (exact) askConfirm('“' + exact.entity.name + '” (' + exact.entity.id + ') already matches this name or alias. Create a separate ' + CI.TYPE_LABEL[exact.entity.type].toLowerCase() + ' anyway?', create, { title: 'Possible duplicate', yes: 'Create anyway' });
    else create();
  };
  function repEntity(el) {
    var r = idx().report[ae.reportId];
    return r && r.entities.filter(function (x) { return x.entityId === el.getAttribute('data-eid'); })[0];
  }
  handlers['role-change'] = function (el) { var x = repEntity(el); if (x) { x.role = el.value.trim(); persist(); } };
  handlers['flag-note'] = function (el) { var x = repEntity(el); if (x) { x.flagNote = el.value.trim(); persist(); } };
  handlers['flag-toggle'] = function (el) {
    var x = repEntity(el); if (!x) return;
    x.flag = el.checked; if (!x.flag) x.flagNote = '';
    persist(); viewReport(ae.reportId);
  };
  handlers['remove-entity'] = function (el) {
    var eid = el.getAttribute('data-eid'), rid = ae.reportId;
    var n = d.links.filter(function (l) { return l.reportId === rid && (l.from === eid || l.to === eid); }).length;
    askConfirm('Remove this entity from the report?' + (n ? ' Its ' + n + ' connection(s) from this report will be removed too.' : ''), function () {
      CI.removeEntityFromReport(d, rid, eid); persist(); viewReport(rid);
    }, { title: 'Remove entity', yes: 'Remove', danger: true });
  };
  var newType = { label: '', keep: null };
  function newTypeFlow() {
    newType.keep = { from: val('lk-from'), to: val('lk-to'), note: val('lk-note') };
    document.getElementById('lk-type').value = '';
    askText('Name for the new connection type. It should read as “A … B”, for example “Hires” or “Shares an address with”.', '', function (label) {
      newType.label = label;
      modal('<h2>' + esc(label) + '</h2><p>Does it matter which way round it is?</p><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn" data-action="nt-add" data-dir="0">No – same both ways</button><button class="btn primary" data-action="nt-add" data-dir="1">Yes – A → B</button></div>');
    }, { title: 'New connection type', ok: 'Next' });
  }
  handlers['nt-add'] = function (el) {
    var label = newType.label.trim(), id = CI.toToken(label), directed = el.getAttribute('data-dir') === '1';
    closeModal();
    if (!id) return;
    if (d.settings.linkTypes.some(function (t) { return t.id === id; })) { toast('A connection type with that name already exists. Choose it from the list.', true); return; }
    d.settings.linkTypes.unshift({ id: id, label: label, directed: directed, group: 'Added by staff' });
    persist(); viewReport(ae.reportId);
    var k = newType.keep || {};
    ['from', 'to'].forEach(function (x) { var e2 = document.getElementById('lk-' + x); if (e2 && k[x]) e2.value = k[x]; });
    var n2 = document.getElementById('lk-note'); if (n2 && k.note) n2.value = k.note;
    var t2 = document.getElementById('lk-type'); if (t2) t2.value = id;
    handlers['lk-preview'](); toast('Added “' + label + '”. It is now in the list for everyone.');
  };
  handlers['lk-preview'] = function () {
    if (val('lk-type') === '__new__') { newTypeFlow(); return; }
    var f = val('lk-from'), t = val('lk-to'), ty = val('lk-type'), box = document.getElementById('lk-preview');
    if (!f || !t || !ty) { box.textContent = ''; return; }
    var e1 = idx().entity[f], e2 = idx().entity[t], tt = lt(ty);
    box.textContent = e1.name + (tt.directed ? '  — ' + tt.label + ' →  ' : '  ↔ ' + tt.label + ' ↔  ') + e2.name;
  };
  handlers['lk-swap'] = function () {
    var a = document.getElementById('lk-from'), b = document.getElementById('lk-to'), v = a.value; a.value = b.value; b.value = v; handlers['lk-preview']();
  };
  handlers['lk-all'] = function (el) { ae.allTypes = el.checked; viewReport(ae.reportId); };
  handlers['add-link'] = function () {
    if (val('lk-type') === 'CONNECTED_TO' && !val('lk-note').trim()) { document.getElementById('lk-msg').textContent = 'Say what the connection is in the box on the right, for example “brother” or “owner of the plate”.'; return; }
    var res = CI.addLink(d, { reportId: ae.reportId, from: val('lk-from'), to: val('lk-to'), type: val('lk-type'), note: val('lk-note').trim() });
    if (res.error) { document.getElementById('lk-msg').textContent = res.error; return; }
    persist(); viewReport(ae.reportId);
  };
  handlers['del-link'] = function (el) {
    d.links = d.links.filter(function (l) { return l.id !== el.getAttribute('data-id'); }); persist(); viewReport(ae.reportId);
  };
  handlers['del-report'] = function (el) {
    var id = el.getAttribute('data-id'), n = d.links.filter(function (l) { return l.reportId === id; }).length;
    askConfirm('Delete ' + id + '? Its ' + n + ' connection(s) will be deleted too. The names stay.', function () {
      CI.deleteReport(d, id); persist(); go('#/entities');
    }, { title: 'Delete report', yes: 'Delete', danger: true });
  };
  handlers['raise-lead-report'] = function (el) { CI.views.openLead({ raisedBy: el.getAttribute('data-id') }); };

  /* ---------- FILES LIST (drawers by type; items by kind) ---------- */
  var entScope = 'files';
  var entStates = { files: { q: '', type: 'individual', sort: 'name' }, items: { q: '', type: '', sort: 'name' } };
  function entS() { return entStates[entScope]; }
  function entKindOf(e) { return entScope === 'items' ? e.itemType : e.type; }
  function entRows() {
    var st = entS(), q = CI.norm(st.q), stats = CI.materialStats(d, idx()), items = entScope === 'items';
    var rows = d.entities.filter(function (e) {
      if (items ? !CI.isItem(e) : CI.isItem(e)) return false;
      if (st.type && entKindOf(e) !== st.type) return false;
      return !q || CI.norm([e.name, e.details || ''].concat(e.aliases).join(' ')).indexOf(q) !== -1;
    }).map(function (e) {
      var s = CI.statsFor(stats, e.id);
      return { e: e, reports: s.reports, last: s.last, links: (idx().linksByEntity[e.id] || []).length };
    });
    rows.sort(function (a, b) {
      if (st.sort === 'recent') return (b.last || '').localeCompare(a.last || '') || a.e.name.localeCompare(b.e.name);
      return a.e.name.localeCompare(b.e.name);
    });
    if (!rows.length) return '<tr><td colspan="5" class="empty">' + (items ? 'No items here yet. Items are added from a report: type a plate, number or handle and choose Item.' : (q ? 'No names match.' : 'Nothing in this drawer yet.')) + '</td></tr>';
    return rows.map(function (x) {
      return '<tr><td class="nm">' + avatar(x.e, 30) + '<span class="ell"><a href="#/entity/' + esc(x.e.id) + '">' + esc(x.e.name) + '</a>' +
        (x.e.details ? ' <span class="muted small">' + esc(x.e.details) + '</span>' : '') + (x.e.aliases.length ? ' <span class="muted small">also: ' + esc(x.e.aliases.join(', ')) + '</span>' : '') + '</span></td>' +
        '<td class="num">' + x.reports + '</td><td>' + (x.last ? esc(CI.fmtDate(x.last)) : '') + '</td><td class="num">' + x.links + '</td><td class="muted small">' + esc(x.e.id) + '</td></tr>';
    }).join('');
  }
  function viewEntities(scope) {
    entScope = scope === 'items' ? 'items' : 'files';
    var st = entS(), items = entScope === 'items';
    if (!items && CI.FILE_TYPES.indexOf(st.type) === -1) st.type = 'individual';
    var counts = {}, total = 0;
    d.entities.forEach(function (e) { if (items ? CI.isItem(e) : !CI.isItem(e)) { var k = entKindOf(e) || 'other'; counts[k] = (counts[k] || 0) + 1; total++; } });
    var tabs = items
      ? [{ id: '', label: 'All items', n: total }].concat(Object.keys(counts).sort().map(function (k) { return { id: k, label: k.charAt(0).toUpperCase() + k.slice(1), n: counts[k] }; }))
      : CI.FILE_TYPES.map(function (t) { return { id: t, label: CI.TYPE_LABEL[t] + 's', n: counts[t] || 0 }; });
    var base = items ? '#/items/' : '#/entities/';
    view.innerHTML = '<div class="page-head"><h1>' + (items ? 'Items <span class="muted">plates, phones, emails, accounts: indexed, not filed</span>' : 'Files <span class="muted">filed by type</span>') + '</h1></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) {
        return '<a role="tab" class="tab' + (t.id === st.type ? ' on' : '') + '" href="' + base + encodeURIComponent(t.id) + '">' + esc(t.label) + ' <span class="n">' + t.n + '</span></a>';
      }).join('') + '</div>' +
      '<div class="card row wrap"><input type="search" id="ent-q" placeholder="' + (items ? 'Search plates, numbers, addresses and handles…' : 'Search this drawer by name, alias or details…') + '" value="' + esc(st.q) + '" data-on-input="ent-filter">' +
      '<select id="ent-sort" data-on-change="ent-filter">' + options([{ value: 'name', label: 'A to Z' }, { value: 'recent', label: 'Most recent report first' }], st.sort) + '</select></div>' +
      '<div class="card flush"><table class="fixed"><colgroup><col style="width:46%"><col style="width:10%"><col style="width:16%"><col style="width:14%"><col style="width:14%"></colgroup><thead><tr><th>' + (items ? 'Identifier' : 'Name') + '</th><th class="num">Reports</th><th>Last report</th><th class="num">Connections</th><th>ID</th></tr></thead><tbody id="ent-rows">' + entRows() + '</tbody></table></div>';
  }
  handlers['ent-filter'] = function () {
    var st = entS();
    st.q = val('ent-q'); st.sort = val('ent-sort');
    document.getElementById('ent-rows').innerHTML = entRows();
  };

  /* ---------- ENTITY PAGE ---------- */
  function viewEntity(id) {
    var e = idx().entity[id];
    if (!e) return notFound('Entity');
    var repIds = (idx().reportsByEntity[id] || []).slice().sort().reverse();
    var graph = CI.computeGraph(d, CI.newBank(d, 'tmp', [id], 1), idx());
    var inc = graph.edges.filter(function (x) { return x.source === id || x.target === id; });
    var others = d.entities.filter(function (x) { return x.id !== id; }).sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (x) { return { value: x.id, label: x.name + ' (' + CI.TYPE_LABEL[x.type].toLowerCase() + ', ' + x.id + ')' }; });
    var h = '<div class="page-head"><h1>' + esc(e.name) + ' ' + kindTag(e) + '</h1><div class="row"><a class="btn" href="#/indexes/' + esc(id) + '">Connection index</a><button class="btn" data-action="chart-entity" data-id="' + esc(id) + '">Chart (1 hop)</button><button class="btn primary" data-action="bank-entity" data-id="' + esc(id) + '">Create bank from this</button></div></div>';
    var stt = CI.statsFor(CI.materialStats(d, idx()), id), spec = CI.PHOTO_TYPES[e.type];
    var nConn = (idx().linksByEntity[id] || []).length;
    h += '<div class="card row wrap pic">' + avatar(e, 96) + '<div class="grow"><div><b>' + stt.reports + '</b> report' + (stt.reports === 1 ? '' : 's') + ' \u00b7 <b>' + nConn + '</b> connection' + (nConn === 1 ? '' : 's') + ' to <b>' + stt.neighbors + '</b> name' + (stt.neighbors === 1 ? '' : 's') + (stt.hub ? ' <span class="tag warn">high-connection</span>' : '') + '</div>' +
      (stt.reports > stt.material ? '<div class="muted small">' + (stt.reports - stt.material) + ' of the reports only mention it in passing.</div>' : '') +
      (spec ? '<div class="row wrap" style="margin-top:8px"><label class="btn small">' + (e.photo ? 'Replace ' : 'Add ') + spec.label.toLowerCase() + '<input type="file" accept="image/*" data-on-change="photo-file" data-id="' + esc(id) + '" hidden></label>' + (e.photo ? '<button class="btn small" data-action="photo-remove" data-id="' + esc(id) + '">Remove</button>' : '') + '<span class="muted small">Shown on the chart. Stored in this browser, shrunk to a small image.</span></div>' : '<div class="muted small" style="margin-top:6px">Pictures can be added to individuals (a photo) and groups (a logo).</div>') +
      '</div></div>';
    h += '<form class="card form" onsubmit="return false"><div class="grid2"><label>Name<input type="text" id="en-name" value="' + esc(e.name) + '"></label><label>Type<select id="en-type">' + options(CI.ENTITY_TYPES.map(function (t) { return { value: t, label: CI.TYPE_LABEL[t] }; }), e.type) + '</select></label></div>' +
      (CI.isItem(e) ? '<label>Kind of item <span class="hint">plate, phone, email, account…</span><input type="text" id="en-itemtype" value="' + esc(e.itemType || '') + '"></label><p class="muted small">An item has no folder. This page is its index entry: the reports that mention it and its connections.</p>' : '') +
      (CI.isItem(e) ? '' : '<label>Identifying details <span class="hint">date of birth or age, address, nickname, description: what tells this one apart</span><input type="text" id="en-details" value="' + esc(e.details || '') + '"></label>') +
      '<label>Aliases, handles and spellings <span class="hint">comma separated</span><input type="text" id="en-aliases" value="' + esc(e.aliases.join(', ')) + '"></label>' +
      '<label>Notes <span class="hint">analyst notes; facts belong in reports</span><textarea id="en-notes" rows="2">' + esc(e.notes) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" data-action="save-entity" data-id="' + esc(id) + '">Save</button><span class="muted small">' + esc(id) + '</span></div></form>';
    var cgroups = CI.connectionIndex(d, id, idx());
    h += '<div class="card flush"><h2 style="padding:14px 16px 6px">Connections</h2>';
    if (cgroups.length) h += connTable(cgroups);
    else h += '<p class="muted" style="padding:0 16px 14px">No connections recorded for this name yet.</p>';
    h += '</div><div class="card flush"><h2 style="padding:14px 16px 6px">Reports (' + repIds.length + ')</h2>';
    if (repIds.length) {
      h += '<table class="fixed"><colgroup><col style="width:10%"><col style="width:14%"><col style="width:76%"></colgroup><thead><tr><th>Report</th><th>Date</th><th>Subject</th></tr></thead><tbody>' + repIds.map(function (rid) {
        var r = idx().report[rid];
        return '<tr><td>' + repLink(rid) + '</td><td>' + esc(CI.fmtDate(r.received)) + '</td><td title="' + esc(r.subject || r.summary) + '">' + esc(r.subject || r.summary || '') + (r.dupOf ? ' <span class="tag">repost</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="muted" style="padding:0 16px 14px">Not in any report yet.</p>';
    h += '</div><div class="card"><h2>Housekeeping</h2><div class="row wrap"><select id="merge-into">' + options(others, '', 'Merge this name into…') + '</select><button class="btn" data-action="merge-entity" data-id="' + esc(id) + '">Merge</button>' +
      '<span class="muted small">Use when two entries turned out to be the same one. Merges are logged and can be undone from Review.</span></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn danger" data-action="del-entity" data-id="' + esc(id) + '">Delete this name</button><span class="muted small">Only possible while no report or connection uses it.</span></div></div>';
    view.innerHTML = h;
  }
  handlers['photo-file'] = function (el) {
    var e = idx().entity[el.getAttribute('data-id')], f = el.files && el.files[0];
    if (!e || !f) return;
    CI.readPhoto(f, e.type).then(function (uri) { e.photo = uri; persist(); toast('Picture saved.'); viewEntity(e.id); }, function (err) { toast(err.message, true); });
  };
  handlers['photo-remove'] = function (el) {
    var e = idx().entity[el.getAttribute('data-id')]; if (!e) return;
    delete e.photo; persist(); viewEntity(e.id);
  };
  handlers['save-entity'] = function (el) {
    var e = idx().entity[el.getAttribute('data-id')], name = val('en-name').trim();
    if (!name) { toast('A name is required.', true); return; }
    e.name = name; e.type = val('en-type'); e.notes = val('en-notes');
    var dtl = document.getElementById('en-details'); if (dtl) e.details = dtl.value.trim();
    if (e.type === 'item') { var it = document.getElementById('en-itemtype'); e.itemType = it ? it.value.trim() : (e.itemType || ''); } else delete e.itemType;
    e.aliases = val('en-aliases').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    persist(); toast('Saved.'); viewEntity(e.id);
  };
  handlers['chart-entity'] = function (el) { CI.views.quickBank([el.getAttribute('data-id')], 1, 'Quick view'); };
  handlers['bank-entity'] = function (el) {
    CI.views.openBank([el.getAttribute('data-id')], '', '');
  };
  handlers['merge-entity'] = function (el) {
    var id = el.getAttribute('data-id'), into = val('merge-into');
    if (!into) { toast('Choose which entity to merge into.', true); return; }
    var a = idx().entity[id], b = idx().entity[into];
    var nr = (idx().reportsByEntity[id] || []).length, nl = (idx().linksByEntity[id] || []).length;
    askConfirm('Merge “' + a.name + '” into “' + b.name + '”?\n\n' + nr + ' report(s) and ' + nl + ' connection(s) move to “' + b.name + '”. You can undo this from Review.', function () {
      var res = CI.mergeEntities(d, id, into);
      if (res.error) { toast(res.error, true); return; }
      logEvent('merge', 'Merged “' + a.name + '” (' + id + ') into “' + b.name + '” (' + into + ').', '');
      d.log[d.log.length - 1].resolved = true;
      persist(); toast('Merged.'); go('#/entity/' + into);
    }, { title: 'Merge entities', yes: 'Merge' });
  };
  handlers['del-entity'] = function (el) {
    var id = el.getAttribute('data-id');
    if (CI.entityInUse(d, id)) { toast('This entity is still used by reports or connections. Merge it or remove it from them first.', true); return; }
    askConfirm('Delete this name?', function () { CI.deleteEntity(d, id); persist(); go('#/entities'); }, { title: 'Delete entity', yes: 'Delete', danger: true });
  };

  /* ---------- REVIEW (hesitation log, flags, merges) ---------- */
  var KIND = { snag: 'Your note', blocked: 'Save blocked', 'unclear-type': 'Entity not added', 'similar-created': 'Possible duplicate', merge: 'Merge' };
  var KIND_HELP = { snag: 'A note you logged yourself.', blocked: 'A report could not be saved until something was filled in.', 'unclear-type': 'You tried to create an entity without choosing its type, so nothing was created.', 'similar-created': 'A new entity was created even though a similar one already exists. Check whether they should be merged.', merge: 'Two entity files were combined.' };
  function viewReview() {
    var flags = [];
    d.reports.forEach(function (r) { r.entities.forEach(function (x) { if (x.flag) flags.push({ r: r, x: x }); }); });
    var open = d.log.filter(function (x) { return !x.resolved; }).slice().reverse();
    var done = d.log.filter(function (x) { return x.resolved; }).slice().reverse();
    var h = '<div class="page-head"><h1>Review</h1></div><p class="muted">Where the hand run hesitated. Each of these points at a decision the staff procedure or training has to make easy.</p>';
    h += '<div class="card"><h2>Flagged entity matches (' + flags.length + ')</h2><p class="muted small">When you add an entity to a report you can tick a box to say “I am not sure this is the same person or thing as the existing entry.” Those reports show here. Open the report, decide, then press <b>Resolved</b> to clear the flag. It changes nothing else.</p>';
    h += flags.length ? '<table class="tight"><tbody>' + flags.map(function (f) {
      return '<tr><td>' + repLink(f.r.id) + '</td><td>' + entLink(f.x.entityId) + '</td><td>' + esc(f.x.flagNote || '') + '</td><td class="right"><button class="btn small" data-action="clear-flag" data-rid="' + esc(f.r.id) + '" data-eid="' + esc(f.x.entityId) + '">Resolved</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">None.</p>';
    h += '</div><div class="card"><h2>Notes to look at (' + open.length + ')</h2><p class="muted small">The app writes a note here when it stops you or when something might need a second look, and you can add your own with “Log a snag”. Nothing here changes your data. <b>Resolve</b> just means “I have looked at this” and moves it to the resolved list; <b>Delete</b> removes the note.</p>';
    h += open.length ? '<table class="tight"><tbody>' + open.map(logRow).join('') + '</tbody></table>' : '<p class="muted">None open. Use “Log a snag” at the top whenever the procedure feels unclear.</p>';
    h += '</div>';
    var merges = d.merges.slice().reverse();
    h += '<div class="card"><h2>Merges (' + merges.length + ')</h2><p class="muted small">A merge combines two entries that turned out to be the same one (for example “J. Smith” and “John Smith”). Reports and connections move to the entry you keep, and the other name becomes an alias. You start one from the entity page. <b>Undo</b> brings the removed file back.</p>';
    h += merges.length ? '<table class="tight"><tbody>' + merges.map(function (m) {
      var into = idx().entity[m.intoId];
      return '<tr><td>' + esc(m.t) + '</td><td>“' + esc(m.fromEntity.name) + '” → ' + (into ? entLink(m.intoId) : esc(m.intoId)) + '</td><td class="right">' +
        (m.undone ? '<span class="muted small">undone</span>' : '<button class="btn small" data-action="undo-merge" data-id="' + esc(m.id) + '">Undo</button>') + '</td></tr>';
    }).join('') + '</tbody></table><p class="muted small">Undo restores the affected reports and connections to how they were just before the merge; later edits to those specific items are lost.</p>' : '<p class="muted">No merges yet.</p>';
    h += '</div>';
    if (done.length) h += '<details class="card"><summary>Resolved (' + done.length + ')</summary><table class="tight"><tbody>' + done.map(logRow).join('') + '</tbody></table></details>';
    if (CI.views.wordsCard) h += CI.views.wordsCard();
    view.innerHTML = h;
  }
  function logRow(x) {
    return '<tr><td class="nowrap muted small">' + esc(CI.fmtDateTime(x.t)) + '</td><td><span class="tag" title="' + esc(KIND_HELP[x.kind] || '') + '">' + esc(KIND[x.kind] || x.kind) + '</span></td><td>' + esc(x.text) + (KIND_HELP[x.kind] && x.kind !== 'snag' ? '<div class="muted small">' + esc(KIND_HELP[x.kind]) + '</div>' : '') +
      (x.reportId && x.reportId.charAt(0) === 'R' && x.reportId.charAt(1) === '-' ? '<div class="small">Report: ' + repLink(x.reportId) + '</div>' : '') + '</td><td class="right nowrap">' +
      (x.resolved ? '' : '<button class="btn small" data-action="log-resolve" data-id="' + esc(x.id) + '">Resolve</button> ') + '<button class="btn small" data-action="log-delete" data-id="' + esc(x.id) + '">Delete</button></td></tr>';
  }
  handlers['clear-flag'] = function (el) {
    var r = idx().report[el.getAttribute('data-rid')], x = r.entities.filter(function (y) { return y.entityId === el.getAttribute('data-eid'); })[0];
    x.flag = false; x.flagNote = ''; persist(); viewReview();
  };
  handlers['log-resolve'] = function (el) { d.log.filter(function (x) { return x.id === el.getAttribute('data-id'); }).forEach(function (x) { x.resolved = true; }); persist(); viewReview(); };
  handlers['log-delete'] = function (el) { d.log = d.log.filter(function (x) { return x.id !== el.getAttribute('data-id'); }); persist(); viewReview(); };
  handlers['undo-merge'] = function (el) {
    var id = el.getAttribute('data-id');
    askConfirm('Undo this merge? The merged-away entry comes back and the reports and connections it touched are restored to how they were just before the merge.', function () {
      var res = CI.undoMerge(d, id);
      if (res.error) { toast(res.error, true); return; }
      persist(); toast('Merge undone.'); viewReview();
    }, { title: 'Undo merge', yes: 'Undo merge' });
  };
  document.getElementById('snag-btn').addEventListener('click', function () {
    askText('What was unclear or slow? (one line)', '', function (t) {
      var ctx = (cur.match(/^report\/(R-\d+)/) || [])[1] || '';
      logEvent('snag', t, ctx); persist(); toast('Logged in Review.');
      if (cur === 'review') viewReview();
    }, { title: 'Log a snag', ok: 'Log it' });
  });

  /* ---------- SETTINGS ---------- */
  function viewSettings() {
    var s = d.settings;
    var h = '<div class="page-head"><h1>Settings</h1></div><form class="card form" onsubmit="return false"><h2>Lists</h2><div class="grid3">' +
      '<label>Intake basis (threat categories) <span class="hint">one per line</span><textarea id="s-basis" rows="7">' + esc(s.basisList.join('\n')) + '</textarea></label>' +
      '<label>Source types <span class="hint">one per line</span><textarea id="s-src" rows="7">' + esc(s.sourceTypes.join('\n')) + '</textarea></label>' +
      '</div>' +
      '<h2>Connection types</h2><p class="muted small">Staff see the plain label and read each connection as a sentence: A [label] B. Behind the scenes the label is stored in graph-database style (UPPER_SNAKE_CASE) so it can move to Neo4j unchanged. Direction is fixed per type so the person indexing never has to decide it; undirected types read the same either way round. Renaming a label does not change the stored name or existing connections.</p>' +
      '<table class="tight" id="lt-table"><thead><tr><th>Label</th><th>Directed</th><th>Stored as</th><th>Used by</th><th></th></tr></thead><tbody>' + s.linkTypes.map(function (t, i) { return ltRow(t, i); }).join('') + '</tbody></table>' +
      '<div class="row"><button class="btn small" data-action="lt-add">Add connection type</button><button class="btn small" data-action="lt-suggest">Restore the suggested list</button></div>' +
      '<h2>Chart and heat</h2><div class="grid3"><label>Heat window (days)<input type="number" min="1" id="s-hw" value="' + s.heatWindowDays + '"></label><label>Hot at this many reports<input type="number" min="1" id="s-ht" value="' + s.heatThreshold + '"></label>' +
      '<label>High-connection node at this many connections<input type="number" min="3" id="s-hub" value="' + s.hubDegree + '"></label></div>' +
      '<div class="row"><button class="btn primary" data-action="save-settings">Save settings</button></div></form>' +
      '<div class="card"><h2>Data</h2><p class="muted">Everything is stored in this browser only. Export regularly. <strong>Export files contain report data about real people – keep them out of the GitHub repository.</strong> The repository should hold the app and fictional sample data only.</p>' +
      '<div class="row wrap"><button class="btn" data-action="export">Export\u2026</button><label class="btn">Import from file<input type="file" accept="application/json,.json" id="import-file" data-on-change="import" hidden></label>' +
      '<button class="btn" data-action="load-sample">Load fictional sample data</button>' + (d.sampleLoaded ? '<button class="btn" data-action="start-fresh">Start fresh (remove the sample data)</button>' : '') + '<button class="btn danger" data-action="clear-all">Clear everything</button></div>' +
      '<label class="form-inline">Or paste exported JSON here<textarea id="import-text" class="mono" rows="3" placeholder="{ &quot;version&quot;: 1, ... }"></textarea></label><div class="row"><button class="btn small" data-action="import-paste">Import pasted JSON</button></div>' +
      '<p class="muted small" style="margin-top:10px">Now holding ' + d.reports.length + ' reports, ' + d.entities.length + ' entities, ' + d.links.length + ' connections, ' + d.banks.length + ' banks, ' + d.leads.length + ' leads, ' + d.investigations.length + ' investigations.</p></div>';
    view.innerHTML = h;
  }
  function ltRow(t, i) {
    var used = d.links.filter(function (l) { return l.type === t.id; }).length;
    return '<tr data-id="' + esc(t.id) + '" data-group="' + esc(t.group || '') + '"><td><input type="text" class="lt-label" value="' + esc(t.label) + '"></td><td><input type="checkbox" class="lt-dir"' + (t.directed ? ' checked' : '') + '></td><td class="muted small mono">' + esc(t.id) + '</td><td class="muted small">' + used + ' link' + (used === 1 ? '' : 's') + '</td><td>' +
      (used ? '' : '<button class="btn small" data-action="lt-del">Remove</button>') + '</td></tr>';
  }
  handlers['lt-add'] = function () {
    var tb = document.querySelector('#lt-table tbody'), tmp = document.createElement('tbody');
    tmp.innerHTML = ltRow({ id: '', label: '', directed: true }, 0);
    tb.appendChild(tmp.firstChild);
  };
  handlers['lt-del'] = function (el) { el.closest('tr').remove(); };
  handlers['lt-suggest'] = function () {
    var n = CI.addSuggestedLinkTypes(d); persist(); viewSettings();
    toast(n ? 'Added ' + n + ' suggested connection type' + (n === 1 ? '' : 's') + '.' : 'All suggested connection types are already there.');
  };
  function lines(id) { return val(id).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  handlers['save-settings'] = function () {
    var s = d.settings, basis = lines('s-basis'), src = lines('s-src');
    if (!basis.length || !src.length) { toast('Intake basis and source types cannot be empty.', true); return; }
    var types = [];
    document.querySelectorAll('#lt-table tbody tr').forEach(function (tr) {
      var label = tr.querySelector('.lt-label').value.trim();
      var id = tr.getAttribute('data-id') || CI.toToken(label);
      if (label && id && !types.some(function (t) { return t.id === id; })) types.push({ id: id, label: label, directed: tr.querySelector('.lt-dir').checked, group: tr.getAttribute('data-group') || 'Added by staff' });
    });
    var removed = s.linkTypes.filter(function (t) { return !types.some(function (n) { return n.id === t.id; }) && d.links.some(function (l) { return l.type === t.id; }); });
    if (removed.length || !types.length) { toast('A connection type that links still use cannot be removed.', true); return; }
    s.basisList = basis; s.sourceTypes = src; s.linkTypes = types;
    s.heatWindowDays = Math.max(1, Number(val('s-hw')) || 14); s.heatThreshold = Math.max(1, Number(val('s-ht')) || 5); s.hubDegree = Math.max(3, Number(val('s-hub')) || 8);
    persist(); toast('Settings saved.'); viewSettings();
  };
  handlers['export'] = function () {
    modal('<h2>Export</h2><p class="muted small">Copy this text somewhere safe, outside the GitHub repository. To restore it, paste it under Settings, Data, or choose the saved file.</p><textarea id="export-text" class="mono" rows="12" readonly></textarea><div class="row end"><button class="btn" data-action="export-download">Download file</button><button class="btn primary" data-action="export-copy">Copy</button><button class="btn" data-action="modal-close">Close</button></div>', true);
    var ta = document.getElementById('export-text'); ta.value = CI.exportJson(d); ta.focus(); ta.select();
  };
  handlers['export-copy'] = function () {
    var ta = document.getElementById('export-text'); ta.select();
    var fallback = function () { try { document.execCommand('copy'); toast('Copied.'); } catch (e) { toast('Press Ctrl+C (Cmd+C) to copy the selected text.'); } };
    try { navigator.clipboard.writeText(ta.value).then(function () { toast('Copied.'); }, fallback); } catch (e) { fallback(); }
  };
  handlers['export-download'] = function () { download('cross-index-export-' + CI.today() + '.json', val('export-text')); };
  function doImport(text, label) {
    var nd;
    try { nd = CI.importJson(text); } catch (e) { toast('Import failed: ' + e.message, true); return; }
    askConfirm('Replace everything in this browser with ' + label + ' (' + nd.reports.length + ' reports, ' + nd.entities.length + ' entities)?', function () {
      d = nd; d.started = true; ensureSuggested(); persist(); toast('Imported.'); go('#/settings');
    }, { title: 'Import data', yes: 'Replace', danger: true });
  }
  handlers['import'] = function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { doImport(String(rd.result), '“' + f.name + '”'); };
    rd.readAsText(f);
  };
  handlers['import-paste'] = function () {
    var t = val('import-text').trim();
    if (!t) { toast('Paste the exported JSON first.', true); return; }
    doImport(t, 'the pasted data');
  };
  function loadSample() { d = CI.sampleData(); ensureSuggested(); persist(); toast('Sample data loaded.'); go('#/report-new'); }
  handlers['load-sample'] = function () {
    if ((d.reports.length || d.entities.length) && !d.sampleLoaded) askConfirm('Replace the data in this browser with the fictional sample data? Export first if you need what is here.', loadSample, { title: 'Load sample data', yes: 'Replace', danger: true });
    else loadSample();
  };
  function wipe() { d = CI.emptyData(); d.started = true; ensureSuggested(); persist(); toast('Index is empty.'); go('#/report-new'); }
  handlers['clear-all'] = function () {
    askConfirm('Delete ALL reports, entities, connections and banks from this browser? This cannot be undone.', function () {
      askConfirm('Really delete everything? Export first if there is any chance you need it.', wipe, { title: 'Last check', yes: 'Delete everything', danger: true });
    }, { title: 'Clear everything', yes: 'Continue', danger: true });
  };
  handlers['start-fresh'] = function () {
    askConfirm('Remove the fictional sample data and start with an empty index?', wipe, { title: 'Start fresh', yes: 'Remove sample data', danger: true });
  };

  /* ---------- exposed to chartview.js ---------- */
  CI.views = CI.views || {};
  CI.app = {
    data: function () { return d; }, persist: persist, idx: idx, esc: esc, tag: tag, entLink: entLink, repLink: repLink, options: options, trunc: trunc, lt: lt,
    dateInput: dateInput, readDate: readDate, dateHelp: DATE_HELP, go: go, toast: toast, view: view, avatar: avatar, startReport: function (def) { repDefaults = def; go('#/report-new'); }, connTable: connTable, setData: function (nd) { d = nd; _idx = null; }, logEvent: logEvent, download: download, handlers: handlers, confirm: askConfirm, ask: askText, modal: modal, closeModal: closeModal
  };
  CI.views.quickBank = function (seeds, hops, name) {
    var b = d.banks.filter(function (x) { return x.quick; })[0];
    if (!b) { b = CI.newBank(d, 'Quick view', [], 1); b.quick = true; d.banks.push(b); }
    b.name = name || 'Quick view'; b.seeds = seeds; b.hops = hops; b.viewMode = 'live';
    d.ui.bankId = b.id; persist(); go('#/chart/' + b.id);
  };

  CI.app.start = function () {
    if (!d.started && !d.reports.length && !d.entities.length) { d = CI.sampleData(); persist(); }
    if (!d.settings.suggestedTypes) { ensureSuggested(); persist(); }
    document.getElementById('back-btn').addEventListener('click', function () { if (hist.length) { cur = hist.pop(); route(); } });
    route();
  };
})();
