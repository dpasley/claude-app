/* Folder mode: pick the physical file you are holding (an individual, group, area or subject).
   Each new report is put on that file automatically; Finish folder shows what was entered and the open leads. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  function D() { return A.data(); }

  function results(q) {
    var c = CI.findCandidates(D(), q, 8).filter(function (x) { return !CI.isItem(x.entity); });
    return c.length ? c.map(function (x) {
      return '<div class="cand pick"><div><strong>' + esc(x.entity.name) + '</strong> ' + A.tag(x.entity.type) + (x.entity.details ? ' <span class="muted small">' + esc(x.entity.details) + '</span>' : '') + '</div><button class="btn small" data-action="folder-pick" data-id="' + esc(x.entity.id) + '">Work on this file</button></div>';
    }).join('') : '<p class="muted small">No file with that name yet. Add it as a name on a report first, or from Files.</p>';
  }

  /* The bar at the top of New report and of the indexing page while a folder is being worked on. */
  CI.views.folderBar = function () {
    var fo = CI.folderOf(D()); if (!fo) return '';
    return '<div class="folder-bar rep-w"><div class="fb-tag">Folder mode</div><div class="fb-main"><span class="fb-sub">Entering reports from the folder of</span><a class="fb-name" href="#/entity/' + esc(fo.entity.id) + '">' + esc(fo.entity.name) + '</a> ' + A.tag(fo.entity.type) + '</div>' +
      '<div class="fb-count"><b>' + fo.reports.length + '</b> report' + (fo.reports.length === 1 ? '' : 's') + ' entered</div><button class="btn primary" data-action="folder-finish">Finish folder</button></div>';
  };
  /* The box at the top of New report. */
  CI.views.folderCard = function () {
    var d = D();
    if (CI.folderOf(d)) return CI.views.folderBar();
    return '<div class="card rep-w"><label class="big-lbl">Select a file <span class="hint">Optional. Pick the individual, group, area or subject whose folder you are holding. Every report you enter goes on that file.</span>' +
      '<input type="search" id="fd-q" data-lookup="#fd-res" data-on-input="folder-find" autocomplete="off" placeholder="Name"></label><div id="fd-res"></div></div>';
  };
  H['folder-find'] = function (el) { var r = document.getElementById('fd-res'); r.innerHTML = el.value.trim() ? results(el.value) : ''; };
  H['folder-pick'] = function (el) {
    var err = CI.openFolder(D(), el.getAttribute('data-id')); if (err) { A.toast(err, true); return; }
    A.persist(); A.go('#/report-new'); A.toast('Working on this folder. New reports get its name automatically.');
  };

  /* Finish folder. */
  CI.views.folder = function () {
    var d = D(), s = CI.folderSummary(d);
    if (!s) { A.go('#/report-new'); return; }
    var byId = A.idx().entity, openL = s.leads;
    var h = '<div class="page-head"><h1>Folder finished <span class="muted">' + esc(s.entity.name) + '</span></h1><div class="row"><a class="btn primary" href="#/report-new">Start the next folder</a></div></div>' +
      '<div class="card"><p>Entered from this folder: <b>' + s.reports.length + '</b> report' + (s.reports.length === 1 ? '' : 's') + ', <b>' + s.names.length + '</b> other name' + (s.names.length === 1 ? '' : 's') + ' and <b>' + s.links.length + '</b> connection' + (s.links.length === 1 ? '' : 's') + '.</p></div>';
    h += '<div class="card flush"><div class="row spread" style="padding:14px 16px 6px"><h2 style="margin:0">Open leads from this folder</h2><div class="row"><button class="btn small primary" data-action="folder-print"' + (openL.length ? '' : ' disabled') + '>Print lead sheets</button></div></div>' +
      (openL.length ? '<table class="fixed"><colgroup><col style="width:9%"><col style="width:51%"><col style="width:22%"><col style="width:18%"></colgroup><thead><tr><th>Lead</th><th>Reason</th><th>Investigation</th><th>Assigned to</th></tr></thead><tbody>' + openL.map(function (l) {
        return '<tr class="click" data-action="lead-open" data-id="' + esc(l.id) + '"><td>' + esc(l.id) + '</td><td class="ellip" title="' + esc(l.question) + '">' + esc(l.question) + '</td><td>' + (l.investigationId ? esc(l.investigationId) : '<span class="muted">none</span>') + '</td><td class="ellip">' + esc(l.assigned || l.with || '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted" style="padding:0 16px 14px">No open leads yet. Raise one from the indexing page of a report or from an individual’s Leads tab.</p>') + '</div>';
    h += '<div class="card flush"><h2 style="padding:14px 16px 6px;margin:0">Reports entered</h2><table class="fixed"><colgroup><col style="width:10%"><col style="width:14%"><col style="width:76%"></colgroup><thead><tr><th>Report</th><th>Date</th><th>Subject</th></tr></thead><tbody>' + s.reports.slice().reverse().map(function (r) {
      return '<tr class="click" data-action="folder-rep" data-id="' + esc(r.id) + '"><td>' + esc(r.id) + '</td><td>' + esc(CI.fmtDate(r.received)) + '</td><td class="ellip">' + esc(r.subject || r.summary || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    if (s.names.length) h += '<div class="card"><h2>Other names in these reports</h2><p>' + s.names.sort(function (a, b) { return b.n - a.n; }).map(function (x) { var e = byId[x.id]; return e ? '<a href="#/entity/' + esc(x.id) + '">' + esc(e.name) + '</a> <span class="muted small">' + x.n + '</span>' : ''; }).join(' · ') + '</p></div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['folder-finish'] = function () { CI.finishFolder(D()); A.persist(); A.go('#/folder'); };
  H['folder-rep'] = function (el) { A.go('#/report/' + el.getAttribute('data-id')); };
  H['folder-print'] = function () {
    var s = CI.folderSummary(D()); if (!s || !s.leads.length) return;
    A.saveBlob('Leads-' + s.entity.id + '-folder.pdf', function () { return CI.pdf.leadSheets(D(), s.leads.map(function (l) { return l.id; })); });
  };
})();
