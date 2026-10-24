/* Cross-Index UI: router, reports/intake, entity files, review log, settings.
 * The chart screen lives in chartview.js and uses the CI.app helpers exposed at the bottom. */
(function () {
  'use strict';
  var d = CI.load();
  var _idx = null;
  var view = document.getElementById('view');

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function idx() { return _idx || (_idx = CI.buildIndex(d)); }
  function persist() {
    _idx = null;
    if (!CI.save(d)) toast('Could not save to this browser (storage may be full). Export your data now.', true);
    updateNav();
  }
  function toast(msg, bad) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = ''; }, bad ? 7000 : 2600);
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function logEvent(kind, text, reportId) {
    d.log.push({ id: CI.nextId(d, 'snag'), t: new Date().toISOString(), kind: kind, text: text, reportId: reportId || '', resolved: false });
  }
  function tag(t) { return '<span class="tag t-' + esc(t) + '">' + esc(CI.TYPE_LABEL[t] || t) + '</span>'; }
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
    var h = location.hash || '#/reports';
    document.querySelectorAll('#nav a').forEach(function (a) {
      var key = a.getAttribute('data-nav');
      a.className = h.indexOf('#/' + key) === 0 || (key === 'reports' && h.indexOf('#/report') === 0) ? 'active' : '';
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

  /* ---------- router ---------- */
  var handlers = {};
  function route() {
    var h = (location.hash || '#/reports').replace(/^#\/?/, '');
    var parts = h.split('/');
    window.scrollTo(0, 0);
    if (CI.chart) CI.chart.destroy();
    var name = parts[0] || 'reports';
    if (name === 'reports') viewReports();
    else if (name === 'report-new') viewReportForm(null);
    else if (name === 'report' && parts[2] === 'edit') viewReportForm(parts[1]);
    else if (name === 'report') viewReport(parts[1]);
    else if (name === 'entities') viewEntities();
    else if (name === 'entity') viewEntity(parts[1]);
    else if (name === 'chart') CI.views.chart(parts[1] || '');
    else if (name === 'review') viewReview();
    else if (name === 'settings') viewSettings();
    else viewReports();
    updateNav();
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || !handlers[el.getAttribute('data-action')]) return;
    if (el.tagName === 'A') ev.preventDefault();
    handlers[el.getAttribute('data-action')](el, ev);
  });
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
  function repRows() {
    var q = CI.norm(repFilter);
    var rows = d.reports.slice().sort(function (a, b) { return (b.received || '').localeCompare(a.received || '') || b.id.localeCompare(a.id); })
      .filter(function (r) { return !q || CI.norm([r.id, r.sourceRef, r.summary, r.basis, r.sourceType].join(' ')).indexOf(q) !== -1; });
    if (!rows.length) return '<tr><td colspan="9" class="empty">No reports match.</td></tr>';
    return rows.map(function (r) {
      var nl = d.links.filter(function (l) { return l.reportId === r.id; }).length;
      var status = r.dupOf ? '<span class="tag">repost of ' + esc(r.dupOf) + '</span>' : (r.entities.length ? '<span class="tag ok">indexed</span>' : '<span class="tag warn">not indexed</span>');
      return '<tr><td><a href="#/report/' + esc(r.id) + '">' + esc(r.id) + '</a></td><td>' + esc(r.received) + '</td><td>' + esc(r.eventDate || '') + '</td><td>' + esc(r.sourceType) +
        '</td><td class="ellip" title="' + esc(r.sourceRef) + '">' + esc(trunc(r.sourceRef, 48)) + '</td><td>' + esc(r.basis) + '</td><td class="num">' + r.entities.length +
        '</td><td class="num">' + nl + '</td><td>' + status + '</td></tr>';
    }).join('');
  }
  function viewReports() {
    var empty = !d.reports.length && !d.entities.length;
    view.innerHTML = '<div class="page-head"><h1>Reports</h1><div class="row"><input type="search" id="rep-filter" placeholder="Filter reports…" value="' + esc(repFilter) + '" data-on-input="rep-filter"><a class="btn primary" href="#/report-new">New report</a></div></div>' +
      (empty ? '<div class="card callout"><strong>Nothing here yet.</strong> Start with <a href="#/report-new">a new report</a>, or load a small set of fictional sample data from <a href="#/settings">Settings</a> to see how the pieces fit together.</div>' : '') +
      '<div class="card flush"><table><thead><tr><th>ID</th><th>Received</th><th>Event date</th><th>Source type</th><th>Source</th><th>Intake basis</th><th class="num">Entities</th><th class="num">Links</th><th>Status</th></tr></thead><tbody id="rep-rows">' + repRows() + '</tbody></table></div>';
  }
  handlers['rep-filter'] = function (el) { repFilter = el.value; document.getElementById('rep-rows').innerHTML = repRows(); };

  /* ---------- REPORT FORM (new + edit) ---------- */
  function viewReportForm(id) {
    var r = id ? idx().report[id] : null;
    if (id && !r) return notFound('Report');
    r = r || { received: CI.today(), eventDate: '', sourceType: '', sourceRef: '', archiveLoc: '', originalText: '', dupOf: '', summary: '', basis: '' };
    var st = d.settings.sourceTypes, dupChoices = d.reports.filter(function (x) { return !id || (x.id !== id && idx().rootOf(x.id) !== id); })
      .sort(function (a, b) { return b.id.localeCompare(a.id); }).map(function (x) { return { value: x.id, label: x.id + ' – ' + trunc(x.summary, 60) }; });
    view.innerHTML = '<div class="page-head"><h1>' + (id ? 'Edit details – ' + esc(id) : 'New report') + '</h1></div>' +
      '<form class="card form" id="rep-form" onsubmit="return false">' +
      '<div class="grid2"><label>Date received<input type="date" id="f-received" value="' + esc(r.received) + '"></label>' +
      '<label>Date of the event or posting <span class="hint">(if known)</span><input type="date" id="f-event" value="' + esc(r.eventDate) + '"></label></div>' +
      '<div class="grid2"><label>Source type<select id="f-type">' + options(st, r.sourceType, 'Choose…') + '</select></label>' +
      '<label>Intake basis <span class="hint">(required)</span><select id="f-basis">' + options(d.settings.basisList, r.basis, 'Which threat category does this meet?') + '</select></label></div>' +
      '<label>Source identifier <span class="hint">URL, handle, or document title</span><input type="text" id="f-ref" value="' + esc(r.sourceRef) + '"></label>' +
      '<label>Where the preserved copy is kept <span class="hint">path, URL or file reference</span><input type="text" id="f-arch" value="' + esc(r.archiveLoc) + '"></label>' +
      '<label>Repost / duplicate of <span class="hint">leave blank unless this is a reshare of a report already filed</span><select id="f-dup">' + options(dupChoices, r.dupOf, 'Not a repost') + '</select></label>' +
      '<label>Summary <span class="hint">in your own words</span><textarea id="f-summary" rows="3">' + esc(r.summary) + '</textarea></label>' +
      '<label>Original text <span class="hint">optional; a SHA-256 fingerprint is stored with the capture time</span><textarea id="f-original" rows="4">' + esc(r.originalText) + '</textarea></label>' +
      (r.hash ? '<p class="muted small">Fingerprint ' + esc(r.hash.slice(0, 16)) + '… captured ' + esc(r.hashAt) + '</p>' : '') +
      '<div id="form-errors" class="errors" role="alert"></div>' +
      '<div class="row"><button class="btn primary" data-action="save-report" data-id="' + esc(id || '') + '">' + (id ? 'Save details' : 'Save and index') + '</button><a class="btn" href="' + (id ? '#/report/' + esc(id) : '#/reports') + '">Cancel</a></div></form>';
  }
  handlers['save-report'] = function (el) {
    var id = el.getAttribute('data-id'), ex = id ? idx().report[id] : null;
    var r = {
      received: val('f-received'), eventDate: val('f-event'), sourceType: val('f-type'), basis: val('f-basis'), sourceRef: val('f-ref').trim(),
      archiveLoc: val('f-arch').trim(), dupOf: val('f-dup'), summary: val('f-summary').trim(), originalText: val('f-original')
    };
    var problems = CI.validateReport(r), box = document.getElementById('form-errors');
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
        var n = Object.assign({ id: CI.nextId(d, 'report'), hash: hash ? hash.hash : '', hashAt: hash ? hash.at : '', entities: [], created: CI.today(), updated: CI.today() }, r);
        d.reports.push(n); persist(); go('#/report/' + n.id);
      }
    };
    if (r.originalText && (!ex || ex.originalText !== r.originalText)) {
      CI.sha256(r.originalText).then(function (h) { finish({ hash: h, at: new Date().toISOString() }); });
    } else if (!r.originalText && ex) finish({ hash: '', at: '' });
    else finish();
  };

  /* ---------- REPORT PAGE (indexing) ---------- */
  var ae = { reportId: '', q: '' };
  function notFound(what) { view.innerHTML = '<div class="card">' + esc(what) + ' not found. <a href="#/reports">Back to reports</a></div>'; }
  function viewReport(id) {
    var r = idx().report[id];
    if (!r) return notFound('Report');
    if (ae.reportId !== id) ae = { reportId: id, q: '' };
    var dupInfo = r.dupOf ? '<span class="tag">repost of ' + repLink(r.dupOf) + '</span> <span class="muted small">counts as one report with the original</span>' : '';
    var reposts = d.reports.filter(function (x) { return x.dupOf === id; });
    var h = '<div class="page-head"><h1>' + esc(r.id) + '</h1><div class="row"><a class="btn" href="#/report/' + esc(id) + '/edit">Edit details</a><button class="btn danger" data-action="del-report" data-id="' + esc(id) + '">Delete</button></div></div>';
    h += '<div class="card"><dl class="kv"><dt>Received</dt><dd>' + esc(r.received) + (r.eventDate ? ' <span class="muted">(event ' + esc(r.eventDate) + ')</span>' : '') + '</dd>' +
      '<dt>Source</dt><dd>' + esc(r.sourceType) + ' – ' + esc(r.sourceRef) + '</dd>' +
      '<dt>Intake basis</dt><dd>' + esc(r.basis) + '</dd>' +
      (r.archiveLoc ? '<dt>Preserved copy</dt><dd>' + esc(r.archiveLoc) + '</dd>' : '') +
      (r.hash ? '<dt>Fingerprint</dt><dd class="mono small">' + esc(r.hash) + '<br><span class="muted">captured ' + esc(r.hashAt) + '</span></dd>' : '') +
      (dupInfo ? '<dt>Repost</dt><dd>' + dupInfo + '</dd>' : '') +
      (reposts.length ? '<dt>Reposts</dt><dd>' + reposts.map(function (x) { return repLink(x.id); }).join(', ') + '</dd>' : '') +
      '<dt>Summary</dt><dd>' + esc(r.summary) + '</dd></dl></div>';

    h += '<div class="card"><h2>1. Entities in this report</h2><p class="muted small">Every individual, group, subject and location the report mentions. Pick the existing file when it is the same one; create a new file only when it is not.</p>';
    if (r.entities.length) {
      h += '<table class="tight"><thead><tr><th>Entity</th><th>Type</th><th>Role in report</th><th>Unsure of match</th><th></th></tr></thead><tbody>' + r.entities.map(function (x) {
        var e = idx().entity[x.entityId];
        return '<tr><td>' + entLink(x.entityId) + (e && e.aliases.length ? '<div class="muted small">also: ' + esc(e.aliases.join(', ')) + '</div>' : '') + '</td><td>' + (e ? tag(e.type) : '') + '</td>' +
          '<td><input type="text" list="roles-dl" value="' + esc(x.role) + '" data-on-change="role-change" data-eid="' + esc(x.entityId) + '"></td>' +
          '<td><label class="chk"><input type="checkbox" data-on-change="flag-toggle" data-eid="' + esc(x.entityId) + '"' + (x.flag ? ' checked' : '') + '> flag</label>' +
          (x.flag ? '<input type="text" placeholder="what is unclear?" value="' + esc(x.flagNote) + '" data-on-change="flag-note" data-eid="' + esc(x.entityId) + '">' : '') + '</td>' +
          '<td><button class="btn small" data-action="remove-entity" data-eid="' + esc(x.entityId) + '">Remove</button></td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="callout-inline">No entities yet. This report is not indexed until at least one is added.</p>';
    h += '<datalist id="roles-dl">' + d.settings.roles.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>';
    h += '<div class="addbox"><h3>Add an entity</h3><div class="grid3"><label>Name or handle<input type="text" id="ae-q" autocomplete="off" value="' + esc(ae.q) + '" data-on-input="ae-input" placeholder="Start typing to find an existing file…"></label>' +
      '<label>Role in this report<input type="text" id="ae-role" list="roles-dl"></label><label class="chk lower"><input type="checkbox" id="ae-flag"> Unsure this is the same entity – flag for review</label></div>' +
      '<div id="ae-results"></div>' +
      '<div class="row create"><select id="ae-type">' + options(CI.ENTITY_TYPES.map(function (t) { return { value: t, label: CI.TYPE_LABEL[t] }; }), '', 'Type of new entity…') + '</select>' +
      '<button class="btn" data-action="ae-create" id="ae-create-btn">Create as new entity</button></div><div id="ae-msg" class="errors"></div></div></div>';

    h += '<div class="card"><h2>2. Connections this report asserts</h2><p class="muted small">Each connection is tied to this report. Direction follows the connection type: <em>A — funded → B</em> means A funded B.</p>';
    var mine = d.links.filter(function (l) { return l.reportId === id; });
    if (mine.length) {
      h += '<table class="tight"><tbody>' + mine.map(function (l) {
        return '<tr><td>' + linkPhrase(l) + (l.note ? '<div class="muted small">' + esc(l.note) + '</div>' : '') + '</td><td class="right"><button class="btn small" data-action="del-link" data-id="' + esc(l.id) + '">Remove</button></td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="muted">No connections recorded for this report yet.</p>';
    if (r.entities.length >= 2) {
      var ents = r.entities.map(function (x) { var e = idx().entity[x.entityId]; return { value: x.entityId, label: e ? e.name : x.entityId }; });
      h += '<div class="addbox"><h3>Add a connection</h3><div class="grid4"><label>From<select id="lk-from" data-on-change="lk-preview">' + options(ents, '', 'Choose…') + '</select></label>' +
        '<label>Connection<select id="lk-type" data-on-change="lk-preview">' + options(d.settings.linkTypes.map(function (t) { return { value: t.id, label: t.label + (t.directed ? '  →' : '  ↔') }; }), '', 'Choose…') + '</select></label>' +
        '<label>To<select id="lk-to" data-on-change="lk-preview">' + options(ents, '', 'Choose…') + '</select></label>' +
        '<label>Note <span class="hint">optional</span><input type="text" id="lk-note" placeholder="where in the report?"></label></div>' +
        '<div class="row"><button class="btn primary" data-action="add-link">Add connection</button><button class="btn" data-action="lk-swap">Swap direction</button><span id="lk-preview" class="muted"></span></div><div id="lk-msg" class="errors"></div></div>';
    } else h += '<p class="callout-inline">Add at least two entities above to record a connection between them.</p>';
    h += '</div>';
    if (r.entities.length) h += '<div class="card row spread"><span class="muted">See how this report’s entities connect to the rest of the index.</span><button class="btn" data-action="chart-report" data-id="' + esc(id) + '">Chart this report’s entities</button></div>';
    view.innerHTML = h;
    renderAeResults();
  }

  function renderAeResults() {
    var box = document.getElementById('ae-results');
    if (!box) return;
    var r = idx().report[ae.reportId];
    var btn = document.getElementById('ae-create-btn');
    var q = ae.q.trim();
    if (btn) btn.textContent = q ? 'Create “' + trunc(q, 30) + '” as new entity' : 'Create as new entity';
    if (!q) { box.innerHTML = ''; return; }
    var cands = CI.findCandidates(d, q);
    if (!cands.length) { box.innerHTML = '<p class="muted small">No existing file looks like this. Choose a type below to create it.</p>'; return; }
    box.innerHTML = cands.map(function (c) {
      var inRep = r.entities.some(function (x) { return x.entityId === c.entity.id; });
      var nrep = (idx().reportsByEntity[c.entity.id] || []).length;
      return '<div class="cand"><div><strong>' + esc(c.entity.name) + '</strong> ' + tag(c.entity.type) + '<div class="muted small">' + (c.score === 1 ? 'exact match' : 'possible match') +
        (c.via !== c.entity.name ? ' on “' + esc(c.via) + '”' : '') + ' · ' + esc(c.entity.id) + ' · ' + nrep + ' report' + (nrep === 1 ? '' : 's') + '</div></div>' +
        (inRep ? '<span class="muted small">already in this report</span>' : '<button class="btn small" data-action="ae-use" data-eid="' + esc(c.entity.id) + '">Use this file</button>') + '</div>';
    }).join('');
  }
  handlers['ae-input'] = function (el) { ae.q = el.value; renderAeResults(); document.getElementById('ae-msg').textContent = ''; };
  handlers['ae-use'] = function (el) {
    var flag = document.getElementById('ae-flag').checked;
    var note = '';
    var err = CI.addEntityToReport(d, ae.reportId, el.getAttribute('data-eid'), val('ae-role').trim(), flag, note);
    if (err) { document.getElementById('ae-msg').textContent = err; return; }
    ae.q = ''; persist(); viewReport(ae.reportId);
    var q = document.getElementById('ae-q'); if (q) q.focus();
  };
  handlers['ae-create'] = function () {
    var q = ae.q.trim(), msg = document.getElementById('ae-msg'), type = val('ae-type');
    if (!q) { msg.textContent = 'Type a name or handle first.'; return; }
    if (!type) {
      msg.textContent = 'Choose what type of entity this is (individual, group, subject or location).';
      logEvent('unclear-type', 'Could not settle the entity type for “' + q + '”.', ae.reportId); persist(); return;
    }
    var cands = CI.findCandidates(d, q), exact = cands.filter(function (c) { return c.score === 1; })[0];
    if (exact && !confirm('“' + exact.entity.name + '” (' + exact.entity.id + ') already matches this name or alias. Create a separate file anyway?')) return;
    if (cands.length) logEvent('similar-created', 'Created “' + q + '” as new although similar files exist: ' + cands.map(function (c) { return c.entity.name + ' (' + c.entity.id + ')'; }).join(', ') + '.', ae.reportId);
    var e = CI.addEntity(d, { type: type, name: q });
    CI.addEntityToReport(d, ae.reportId, e.id, val('ae-role').trim(), document.getElementById('ae-flag').checked, '');
    ae.q = ''; persist(); viewReport(ae.reportId);
    var qi = document.getElementById('ae-q'); if (qi) qi.focus();
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
    var eid = el.getAttribute('data-eid'), n = d.links.filter(function (l) { return l.reportId === ae.reportId && (l.from === eid || l.to === eid); }).length;
    if (!confirm('Remove this entity from the report?' + (n ? ' Its ' + n + ' connection(s) from this report will be removed too.' : ''))) return;
    CI.removeEntityFromReport(d, ae.reportId, eid); persist(); viewReport(ae.reportId);
  };
  handlers['lk-preview'] = function () {
    var f = val('lk-from'), t = val('lk-to'), ty = val('lk-type'), box = document.getElementById('lk-preview');
    if (!f || !t || !ty) { box.textContent = ''; return; }
    var e1 = idx().entity[f], e2 = idx().entity[t], tt = lt(ty);
    box.textContent = e1.name + (tt.directed ? '  — ' + tt.label + ' →  ' : '  ↔ ' + tt.label + ' ↔  ') + e2.name;
  };
  handlers['lk-swap'] = function () {
    var a = document.getElementById('lk-from'), b = document.getElementById('lk-to'), v = a.value; a.value = b.value; b.value = v; handlers['lk-preview']();
  };
  handlers['add-link'] = function () {
    var res = CI.addLink(d, { reportId: ae.reportId, from: val('lk-from'), to: val('lk-to'), type: val('lk-type'), note: val('lk-note').trim() });
    if (res.error) { document.getElementById('lk-msg').textContent = res.error; return; }
    persist(); viewReport(ae.reportId);
  };
  handlers['del-link'] = function (el) {
    d.links = d.links.filter(function (l) { return l.id !== el.getAttribute('data-id'); }); persist(); viewReport(ae.reportId);
  };
  handlers['del-report'] = function (el) {
    var id = el.getAttribute('data-id'), n = d.links.filter(function (l) { return l.reportId === id; }).length;
    if (!confirm('Delete ' + id + '? Its ' + n + ' connection(s) will be deleted too. Entity files stay.')) return;
    CI.deleteReport(d, id); persist(); go('#/reports');
  };
  handlers['chart-report'] = function (el) {
    var r = idx().report[el.getAttribute('data-id')];
    CI.views.quickBank(r.entities.map(function (x) { return x.entityId; }), 1, 'Report ' + r.id);
  };

  /* ---------- ENTITIES LIST ---------- */
  var entState = { q: '', type: '', sort: 'name' };
  function entRows() {
    var heat = CI.heat(d, d.settings.heatWindowDays, idx()), q = CI.norm(entState.q);
    var rows = d.entities.filter(function (e) {
      if (entState.type && e.type !== entState.type) return false;
      return !q || CI.norm([e.name].concat(e.aliases).join(' ')).indexOf(q) !== -1;
    }).map(function (e) {
      var roots = {};
      (idx().reportsByEntity[e.id] || []).forEach(function (rid) { roots[idx().rootOf(rid)] = true; });
      return { e: e, reports: Object.keys(roots).length, links: (idx().linksByEntity[e.id] || []).length, heat: heat[e.id] || 0 };
    });
    rows.sort(function (a, b) {
      if (entState.sort === 'heat') return b.heat - a.heat || a.e.name.localeCompare(b.e.name);
      if (entState.sort === 'reports') return b.reports - a.reports || a.e.name.localeCompare(b.e.name);
      return a.e.name.localeCompare(b.e.name);
    });
    if (!rows.length) return '<tr><td colspan="6" class="empty">No entities match.</td></tr>';
    return rows.map(function (x) {
      var hot = x.heat >= d.settings.heatThreshold;
      return '<tr><td><a href="#/entity/' + esc(x.e.id) + '">' + esc(x.e.name) + '</a>' + (x.e.aliases.length ? '<div class="muted small">' + esc(trunc(x.e.aliases.join(', '), 60)) + '</div>' : '') + '</td><td>' + tag(x.e.type) + '</td>' +
        '<td class="num">' + x.reports + '</td><td class="num">' + x.links + '</td><td class="num">' + x.heat + (hot ? ' <span class="tag hot">hot</span>' : '') + '</td><td class="muted small">' + esc(x.e.id) + '</td></tr>';
    }).join('');
  }
  function viewEntities() {
    view.innerHTML = '<div class="page-head"><h1>Entities <span class="muted">the main files</span></h1></div>' +
      '<div class="card row wrap"><input type="search" id="ent-q" placeholder="Search names and aliases…" value="' + esc(entState.q) + '" data-on-input="ent-filter">' +
      '<select id="ent-type" data-on-change="ent-filter">' + options(CI.ENTITY_TYPES.map(function (t) { return { value: t, label: CI.TYPE_LABEL[t] + 's' }; }), entState.type, 'All types') + '</select>' +
      '<select id="ent-sort" data-on-change="ent-filter">' + options([{ value: 'name', label: 'Sort by name' }, { value: 'heat', label: 'Sort by heat' }, { value: 'reports', label: 'Sort by reports' }], entState.sort) + '</select>' +
      '<span class="muted small">Heat = independent reports in the last ' + d.settings.heatWindowDays + ' days; “hot” at ' + d.settings.heatThreshold + '+. Reposts are not counted separately.</span></div>' +
      '<div class="card flush"><table><thead><tr><th>Name</th><th>Type</th><th class="num">Reports</th><th class="num">Links</th><th class="num">Heat</th><th>ID</th></tr></thead><tbody id="ent-rows">' + entRows() + '</tbody></table></div>';
  }
  handlers['ent-filter'] = function () {
    entState.q = val('ent-q'); entState.type = val('ent-type'); entState.sort = val('ent-sort');
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
    var h = '<div class="page-head"><h1>' + esc(e.name) + ' ' + tag(e.type) + '</h1><div class="row"><button class="btn" data-action="chart-entity" data-id="' + esc(id) + '">Chart (1 hop)</button><button class="btn primary" data-action="bank-entity" data-id="' + esc(id) + '">Create bank from this</button></div></div>';
    h += '<form class="card form" onsubmit="return false"><div class="grid2"><label>Name<input type="text" id="en-name" value="' + esc(e.name) + '"></label><label>Type<select id="en-type">' + options(CI.ENTITY_TYPES.map(function (t) { return { value: t, label: CI.TYPE_LABEL[t] }; }), e.type) + '</select></label></div>' +
      '<label>Aliases, handles and spellings <span class="hint">comma separated</span><input type="text" id="en-aliases" value="' + esc(e.aliases.join(', ')) + '"></label>' +
      '<label>Notes <span class="hint">analyst notes; facts belong in reports</span><textarea id="en-notes" rows="2">' + esc(e.notes) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" data-action="save-entity" data-id="' + esc(id) + '">Save</button><span class="muted small">' + esc(id) + '</span></div></form>';
    h += '<div class="card"><h2>Connections</h2>';
    if (inc.length) {
      h += '<table class="tight"><thead><tr><th>Connection</th><th class="num">Reports</th><th>Supporting reports</th></tr></thead><tbody>' + inc.sort(function (a, b) { return b.weight - a.weight; }).map(function (x) {
        var t = x.kind === 'mention' ? null : lt(x.type);
        var phrase = t ? entLink(x.source) + ' <span class="rel">' + (t.directed ? '— ' + esc(t.label) + ' →' : '↔ ' + esc(t.label) + ' ↔') + '</span> ' + entLink(x.target) : '';
        return '<tr><td>' + phrase + '</td><td class="num">' + x.weight + '</td><td>' + x.reportIds.map(repLink).join(', ') + '</td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="muted">No connections recorded for this entity yet.</p>';
    h += '</div><div class="card"><h2>Reports (' + repIds.length + ')</h2>';
    if (repIds.length) {
      h += '<table class="tight"><tbody>' + repIds.map(function (rid) {
        var r = idx().report[rid], x = r.entities.filter(function (y) { return y.entityId === id; })[0];
        return '<tr><td>' + repLink(rid) + '</td><td>' + esc(r.received) + '</td><td>' + esc(x ? x.role : '') + '</td><td>' + esc(trunc(r.summary, 110)) + (r.dupOf ? ' <span class="tag">repost</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    } else h += '<p class="muted">Not in any report yet.</p>';
    h += '</div><div class="card"><h2>Housekeeping</h2><div class="row wrap"><select id="merge-into">' + options(others, '', 'Merge this entity into…') + '</select><button class="btn" data-action="merge-entity" data-id="' + esc(id) + '">Merge</button>' +
      '<span class="muted small">Use when two files turned out to be the same entity. Merges are logged and can be undone from Review.</span></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn danger" data-action="del-entity" data-id="' + esc(id) + '">Delete this entity</button><span class="muted small">Only possible while no report or connection uses it.</span></div></div>';
    view.innerHTML = h;
  }
  handlers['save-entity'] = function (el) {
    var e = idx().entity[el.getAttribute('data-id')], name = val('en-name').trim();
    if (!name) { toast('A name is required.', true); return; }
    e.name = name; e.type = val('en-type'); e.notes = val('en-notes');
    e.aliases = val('en-aliases').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    persist(); toast('Saved.'); viewEntity(e.id);
  };
  handlers['chart-entity'] = function (el) { CI.views.quickBank([el.getAttribute('data-id')], 1, 'Quick view'); };
  handlers['bank-entity'] = function (el) {
    var e = idx().entity[el.getAttribute('data-id')], b = CI.newBank(d, 'Bank: ' + e.name, [e.id], 2);
    d.banks.push(b); d.ui.bankId = b.id; persist(); go('#/chart/' + b.id);
  };
  handlers['merge-entity'] = function (el) {
    var id = el.getAttribute('data-id'), into = val('merge-into');
    if (!into) { toast('Choose which entity to merge into.', true); return; }
    var a = idx().entity[id], b = idx().entity[into];
    var nr = (idx().reportsByEntity[id] || []).length, nl = (idx().linksByEntity[id] || []).length;
    if (!confirm('Merge “' + a.name + '” into “' + b.name + '”?\n\n' + nr + ' report(s) and ' + nl + ' connection(s) move to “' + b.name + '”. You can undo this from Review.')) return;
    var res = CI.mergeEntities(d, id, into);
    if (res.error) { toast(res.error, true); return; }
    logEvent('merge', 'Merged “' + a.name + '” (' + id + ') into “' + b.name + '” (' + into + ').', '');
    d.log[d.log.length - 1].resolved = true;
    persist(); toast('Merged.'); go('#/entity/' + into);
  };
  handlers['del-entity'] = function (el) {
    var id = el.getAttribute('data-id');
    if (CI.entityInUse(d, id)) { toast('This entity is still used by reports or connections. Merge it or remove it from them first.', true); return; }
    if (!confirm('Delete this entity file?')) return;
    CI.deleteEntity(d, id); persist(); go('#/entities');
  };

  /* ---------- REVIEW (hesitation log, flags, merges) ---------- */
  var KIND = { snag: 'Snag', blocked: 'Blocked save', 'unclear-type': 'Unclear type', 'similar-created': 'Created despite similar', merge: 'Merge' };
  function viewReview() {
    var flags = [];
    d.reports.forEach(function (r) { r.entities.forEach(function (x) { if (x.flag) flags.push({ r: r, x: x }); }); });
    var open = d.log.filter(function (x) { return !x.resolved; }).slice().reverse();
    var done = d.log.filter(function (x) { return x.resolved; }).slice().reverse();
    var h = '<div class="page-head"><h1>Review</h1></div><p class="muted">Where the hand run hesitated. Each of these points at a decision the staff procedure or training has to make easy.</p>';
    h += '<div class="card"><h2>Flagged entity matches (' + flags.length + ')</h2>';
    h += flags.length ? '<table class="tight"><tbody>' + flags.map(function (f) {
      return '<tr><td>' + repLink(f.r.id) + '</td><td>' + entLink(f.x.entityId) + '</td><td>' + esc(f.x.flagNote || '') + '</td><td class="right"><button class="btn small" data-action="clear-flag" data-rid="' + esc(f.r.id) + '" data-eid="' + esc(f.x.entityId) + '">Resolved</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">None.</p>';
    h += '</div><div class="card"><h2>Snags and automatic notes (' + open.length + ')</h2>';
    h += open.length ? '<table class="tight"><tbody>' + open.map(logRow).join('') + '</tbody></table>' : '<p class="muted">None open. Use “Log a snag” at the top whenever the procedure feels unclear.</p>';
    h += '</div>';
    var merges = d.merges.slice().reverse();
    h += '<div class="card"><h2>Merges (' + merges.length + ')</h2>';
    h += merges.length ? '<table class="tight"><tbody>' + merges.map(function (m) {
      var into = idx().entity[m.intoId];
      return '<tr><td>' + esc(m.t) + '</td><td>“' + esc(m.fromEntity.name) + '” → ' + (into ? entLink(m.intoId) : esc(m.intoId)) + '</td><td class="right">' +
        (m.undone ? '<span class="muted small">undone</span>' : '<button class="btn small" data-action="undo-merge" data-id="' + esc(m.id) + '">Undo</button>') + '</td></tr>';
    }).join('') + '</tbody></table><p class="muted small">Undo restores the affected reports and connections to how they were just before the merge; later edits to those specific items are lost.</p>' : '<p class="muted">No merges yet.</p>';
    h += '</div>';
    if (done.length) h += '<details class="card"><summary>Resolved (' + done.length + ')</summary><table class="tight"><tbody>' + done.map(logRow).join('') + '</tbody></table></details>';
    view.innerHTML = h;
  }
  function logRow(x) {
    return '<tr><td class="nowrap muted small">' + esc(x.t.slice(0, 16).replace('T', ' ')) + '</td><td><span class="tag">' + esc(KIND[x.kind] || x.kind) + '</span></td><td>' + esc(x.text) +
      (x.reportId && x.reportId.charAt(0) === 'R' && x.reportId.charAt(1) === '-' ? ' ' + repLink(x.reportId) : '') + '</td><td class="right nowrap">' +
      (x.resolved ? '' : '<button class="btn small" data-action="log-resolve" data-id="' + esc(x.id) + '">Resolve</button> ') + '<button class="btn small" data-action="log-delete" data-id="' + esc(x.id) + '">Delete</button></td></tr>';
  }
  handlers['clear-flag'] = function (el) {
    var r = idx().report[el.getAttribute('data-rid')], x = r.entities.filter(function (y) { return y.entityId === el.getAttribute('data-eid'); })[0];
    x.flag = false; x.flagNote = ''; persist(); viewReview();
  };
  handlers['log-resolve'] = function (el) { d.log.filter(function (x) { return x.id === el.getAttribute('data-id'); }).forEach(function (x) { x.resolved = true; }); persist(); viewReview(); };
  handlers['log-delete'] = function (el) { d.log = d.log.filter(function (x) { return x.id !== el.getAttribute('data-id'); }); persist(); viewReview(); };
  handlers['undo-merge'] = function (el) {
    if (!confirm('Undo this merge? The merged-away entity file comes back and the reports and connections it touched are restored to how they were just before the merge.')) return;
    var res = CI.undoMerge(d, el.getAttribute('data-id'));
    if (res.error) { toast(res.error, true); return; }
    persist(); toast('Merge undone.'); viewReview();
  };
  document.getElementById('snag-btn').addEventListener('click', function () {
    var t = prompt('What was unclear or slow? (one line)');
    if (!t || !t.trim()) return;
    var ctx = (location.hash.match(/#\/report\/(R-\d+)/) || [])[1] || '';
    logEvent('snag', t.trim(), ctx); persist(); toast('Logged in Review.');
    if ((location.hash || '').indexOf('#/review') === 0) viewReview();
  });

  /* ---------- SETTINGS ---------- */
  function viewSettings() {
    var s = d.settings;
    var h = '<div class="page-head"><h1>Settings</h1></div><form class="card form" onsubmit="return false"><h2>Lists</h2><div class="grid3">' +
      '<label>Intake basis (threat categories) <span class="hint">one per line</span><textarea id="s-basis" rows="7">' + esc(s.basisList.join('\n')) + '</textarea></label>' +
      '<label>Source types <span class="hint">one per line</span><textarea id="s-src" rows="7">' + esc(s.sourceTypes.join('\n')) + '</textarea></label>' +
      '<label>Roles in a report <span class="hint">suggestions, one per line</span><textarea id="s-roles" rows="7">' + esc(s.roles.join('\n')) + '</textarea></label></div>' +
      '<h2>Connection types</h2><p class="muted small">Direction is fixed per type so the person indexing never has to decide it. “Directed” reads From → To.</p>' +
      '<table class="tight" id="lt-table"><thead><tr><th>Label</th><th>Directed</th><th>Used by</th><th></th></tr></thead><tbody>' + s.linkTypes.map(function (t, i) { return ltRow(t, i); }).join('') + '</tbody></table>' +
      '<div class="row"><button class="btn small" data-action="lt-add">Add connection type</button></div>' +
      '<h2>Chart and heat</h2><div class="grid3"><label>Heat window (days)<input type="number" min="1" id="s-hw" value="' + s.heatWindowDays + '"></label><label>Hot at this many reports<input type="number" min="1" id="s-ht" value="' + s.heatThreshold + '"></label>' +
      '<label>High-connection node at this many connections<input type="number" min="3" id="s-hub" value="' + s.hubDegree + '"></label></div>' +
      '<div class="row"><button class="btn primary" data-action="save-settings">Save settings</button></div></form>' +
      '<div class="card"><h2>Data</h2><p class="muted">Everything is stored in this browser only. Export regularly. <strong>Export files contain report data about real people – keep them out of the GitHub repository.</strong> The repository should hold the app and fictional sample data only.</p>' +
      '<div class="row wrap"><button class="btn" data-action="export">Export JSON</button><label class="btn">Import JSON<input type="file" accept="application/json,.json" id="import-file" data-on-change="import" hidden></label>' +
      '<button class="btn" data-action="load-sample">Load fictional sample data</button><button class="btn danger" data-action="clear-all">Clear everything</button></div>' +
      '<p class="muted small" style="margin-top:10px">Now holding ' + d.reports.length + ' reports, ' + d.entities.length + ' entities, ' + d.links.length + ' connections, ' + d.banks.length + ' banks.</p></div>';
    view.innerHTML = h;
  }
  function ltRow(t, i) {
    var used = d.links.filter(function (l) { return l.type === t.id; }).length;
    return '<tr data-id="' + esc(t.id) + '"><td><input type="text" class="lt-label" value="' + esc(t.label) + '"></td><td><input type="checkbox" class="lt-dir"' + (t.directed ? ' checked' : '') + '></td><td class="muted small">' + used + ' link' + (used === 1 ? '' : 's') + '</td><td>' +
      (used ? '' : '<button class="btn small" data-action="lt-del">Remove</button>') + '</td></tr>';
  }
  handlers['lt-add'] = function () {
    var tb = document.querySelector('#lt-table tbody'), tmp = document.createElement('tbody');
    tmp.innerHTML = ltRow({ id: 'custom_' + Date.now().toString(36), label: '', directed: true }, 0);
    tb.appendChild(tmp.firstChild);
  };
  handlers['lt-del'] = function (el) { el.closest('tr').remove(); };
  function lines(id) { return val(id).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  handlers['save-settings'] = function () {
    var s = d.settings, basis = lines('s-basis'), src = lines('s-src'), roles = lines('s-roles');
    if (!basis.length || !src.length) { toast('Intake basis and source types cannot be empty.', true); return; }
    var types = [];
    document.querySelectorAll('#lt-table tbody tr').forEach(function (tr) {
      var label = tr.querySelector('.lt-label').value.trim();
      if (label) types.push({ id: tr.getAttribute('data-id'), label: label, directed: tr.querySelector('.lt-dir').checked });
    });
    var removed = s.linkTypes.filter(function (t) { return !types.some(function (n) { return n.id === t.id; }) && d.links.some(function (l) { return l.type === t.id; }); });
    if (removed.length || !types.length) { toast('A connection type that links still use cannot be removed.', true); return; }
    s.basisList = basis; s.sourceTypes = src; s.roles = roles; s.linkTypes = types;
    s.heatWindowDays = Math.max(1, Number(val('s-hw')) || 14); s.heatThreshold = Math.max(1, Number(val('s-ht')) || 5); s.hubDegree = Math.max(3, Number(val('s-hub')) || 8);
    persist(); toast('Settings saved.'); viewSettings();
  };
  handlers['export'] = function () { download('cross-index-export-' + CI.today() + '.json', CI.exportJson(d)); };
  handlers['import'] = function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var nd = CI.importJson(rd.result);
        if (!confirm('Replace everything in this browser with the contents of “' + f.name + '” (' + nd.reports.length + ' reports, ' + nd.entities.length + ' entities)?')) return;
        d = nd; persist(); toast('Imported.'); viewSettings();
      } catch (e) { toast('Import failed: ' + e.message, true); }
    };
    rd.readAsText(f);
  };
  handlers['load-sample'] = function () {
    if ((d.reports.length || d.entities.length) && !confirm('Replace the data in this browser with the fictional sample data? Export first if you need what is here.')) return;
    d = CI.sampleData(); persist(); toast('Sample data loaded.'); go('#/reports');
  };
  handlers['clear-all'] = function () {
    if (!confirm('Delete ALL reports, entities, connections and banks from this browser? This cannot be undone.')) return;
    if (!confirm('Really delete everything? Export first if there is any chance you need it.')) return;
    d = CI.emptyData(); persist(); go('#/reports');
  };

  /* ---------- exposed to chartview.js ---------- */
  CI.views = CI.views || {};
  CI.app = {
    data: function () { return d; }, persist: persist, idx: idx, esc: esc, tag: tag, entLink: entLink, repLink: repLink, options: options, trunc: trunc, lt: lt,
    go: go, toast: toast, view: view, logEvent: logEvent, download: download, handlers: handlers
  };
  CI.views.quickBank = function (seeds, hops, name) {
    var b = d.banks.filter(function (x) { return x.quick; })[0];
    if (!b) { b = CI.newBank(d, 'Quick view', [], 1); b.quick = true; d.banks.push(b); }
    b.name = name || 'Quick view'; b.seeds = seeds; b.hops = hops; b.viewMode = 'live';
    d.ui.bankId = b.id; persist(); go('#/chart/' + b.id);
  };

  CI.app.start = function () {
    window.addEventListener('hashchange', route);
    route();
  };
})();
