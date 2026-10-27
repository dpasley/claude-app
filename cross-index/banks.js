/* Special banks: a staff member spots a potential situation in the main files, gathers the related files (the fattest first)
 * and works one bank: its files, its chart, its estimates. A bank can then be handed over to Investigations. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function bankById(id) { return D().banks.filter(function (b) { return b.id === id; })[0]; }
  function bankOf(el) { return bankById(el.getAttribute('data-bank')); }

  /* ----- shared header: back link, name, tabs ----- */
  CI.views.bankTabs = function (b, active) {
    var d = D();
    function tab(id, href, label, n) { return '<a class="tab' + (active === id ? ' on' : '') + '" href="' + href + '">' + label + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</a>'; }
    return '<div class="tabs">' + tab('files', '#/bank/' + b.id, 'Files', (b.files || []).length) + tab('chart', '#/chart/' + b.id, 'Chart') +
      tab('estimates', '#/bank/' + b.id + '/estimates', 'Estimates', b.estimates.length) + '</div>';
  };
  CI.views.bankHead = function (b, active) {
    var inv = CI.investigationFor(D(), b.id);
    return '<div class="chart-head"><a href="#/chart" class="back">‹ Special banks</a><h1>' + esc(b.name) + '</h1>' +
      (b.outcome ? '<span class="tag">no situation ' + esc(CI.fmtDate(b.outcome.date)) + '</span>' : '') + (b.handedOver ? '<span class="tag">handed over ' + esc(CI.fmtDate(b.handedOver)) + '</span>' : '') +
      '<span class="spacer"></span>' + (inv ? '<a class="btn small" href="#/investigation/' + esc(inv.id) + '">Investigation</a>' : '') +
      '<button class="btn small" data-action="cl-rename" data-id="' + esc(b.id) + '" data-then="bank">Rename</button><button class="btn small" data-action="cl-dup" data-id="' + esc(b.id) + '" data-then="bank">Copy</button><button class="btn small danger" data-action="cl-del" data-id="' + esc(b.id) + '" data-then="list">Delete</button></div>' +
      (b.opened && b.opened.reason ? '<p class="bank-why"><span class="fl">Opened ' + esc(CI.fmtDate(b.opened.date)) + ' because</span> ' + esc(b.opened.reason) + '</p>' : '') +
      newsBanner(b) + CI.views.bankTabs(b, active);
  };
  /* What arrived on this bank's files since staff last marked it seen. */
  function newsBanner(b) {
    var n = CI.bankNews(D(), b); if (!n.reports.length && !n.links.length) return '';
    return '<div class="news"><span><b>New since you last looked:</b> ' + n.reports.length + ' report' + (n.reports.length === 1 ? '' : 's') + (n.reports.length ? ' (' + n.reports.slice(0, 6).map(function (r) { return A.repLink(r.id); }).join(', ') + (n.reports.length > 6 ? ', \u2026' : '') + ')' : '') +
      ' and ' + n.links.length + ' connection' + (n.links.length === 1 ? '' : 's') + ' on its files.</span><button class="btn small" data-action="bank-seen" data-bank="' + esc(b.id) + '">Mark as seen</button></div>';
  }
  H['bank-seen'] = function (el) {
    var b = bankOf(el); if (!b) return; CI.markSeen(D(), b); A.persist();
    var n = document.querySelector('.news'); if (n) n.remove();
  };

  /* ----- Files tab ----- */
  var fq = '';
  CI.views.bank = function (id, sub) {
    var b = bankById(id);
    if (!b) { A.go('#/chart'); return; }
    if (b.quick) { A.go('#/chart/' + b.id); return; }
    D().ui.bankId = b.id;
    if (sub === 'estimates') { estimatesTab(b); return; }
    filesTab(b);
  };
  function fileRows(b) {
    var d = D(), idx = A.idx(), stats = CI.materialStats(d, idx), ids = (b.files || []).filter(function (id) { return idx.entity[id]; });
    ids.sort(function (x, y) { return CI.statsFor(stats, y).score - CI.statsFor(stats, x).score || idx.entity[x].name.localeCompare(idx.entity[y].name); });
    if (!ids.length) return '<p class="muted pad">No files yet. Look a name up above, or add from the suggestions below.</p>';
    var max = Math.max.apply(null, ids.map(function (id) { return CI.statsFor(stats, id).score; }).concat([1]));
    var inv = {}; d.links.forEach(function (l) { inv[l.from] = (inv[l.from] || 0) + 1; inv[l.to] = (inv[l.to] || 0) + 1; });
    return '<table class="fixed"><colgroup><col style="width:34%"><col style="width:12%"><col style="width:9%"><col style="width:12%"><col style="width:22%"><col style="width:11%"></colgroup>' +
      '<thead><tr><th>File</th><th>Type</th><th class="num">Reports</th><th class="num">Connections</th><th>Weight</th><th></th></tr></thead><tbody>' + ids.map(function (id) {
        var e = idx.entity[id], s = CI.statsFor(stats, id), start = (b.seeds || []).indexOf(id) !== -1;
        return '<tr><td class="ellip"><a href="#/entity/' + esc(id) + '"><b>' + esc(e.name) + '</b></a>' + (start ? ' <span class="tag">where it started</span>' : '') + '</td><td>' + A.tag(e.type) + '</td>' +
          '<td class="num">' + (idx.reportsByEntity[id] || []).length + '</td><td class="num">' + (inv[id] || 0) + '</td>' +
          '<td><span class="bar"><span style="width:' + Math.round(100 * s.score / max) + '%"></span></span></td>' +
          '<td class="right"><button class="btn small" data-action="bf-remove" data-bank="' + esc(b.id) + '" data-id="' + esc(id) + '">Remove</button></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function suggestHtml(b) {
    var sug = CI.suggestFiles(D(), b, A.idx(), 8);
    if (!sug.length) return '';
    var idx = A.idx();
    return '<div class="card"><div class="row spread"><h2 style="margin:0">Related files not in this bank</h2><button class="btn small" data-action="bf-add-all" data-bank="' + esc(b.id) + '">Add all ' + sug.length + '</button></div>' +
      '<p class="muted small">Connected to the files above, fattest first.</p><div class="chips">' + sug.map(function (x) {
        return '<span class="chip">' + esc(idx.entity[x.id].name) + ' <span class="muted small">' + A.tag(idx.entity[x.id].type) + '</span><button data-action="bf-add" data-bank="' + esc(b.id) + '" data-id="' + esc(x.id) + '" aria-label="Add" title="Add to this bank">+</button></span>';
      }).join('') + '</div></div>';
  }
  function filesTab(b) {
    A.view.className = '';
    A.view.innerHTML = CI.views.bankHead(b, 'files') +
      '<div class="card"><div class="row spread"><h2 style="margin:0">Files in this special bank <span class="muted small">' + (b.files || []).length + '</span></h2><button class="btn small" data-action="bank-tl-print" data-bank="' + esc(b.id) + '">Print time line of these files\u2026</button></div>' +
      '<p class="muted small">These are main files, not copies. The chart and the estimate work from this list.</p>' +
      '<label class="big-lbl">Add a file<input type="search" id="bf-q" class="big-in" data-lookup="#bf-res" data-bank="' + esc(b.id) + '" autocomplete="off" placeholder="Start typing a name…" value="' + esc(fq) + '" data-on-input="bf-q"></label><div id="bf-res"></div></div>' +
      '<div class="card flush" id="bf-list">' + fileRows(b) + '</div>' + suggestHtml(b);
    bfResults(b);
  }
  function bfResults(b) {
    var box = document.getElementById('bf-res'); if (!box) return;
    var q = fq.trim(); if (!q) { box.innerHTML = ''; return; }
    var have = {}; (b.files || []).forEach(function (id) { have[id] = 1; });
    var c = CI.findCandidates(D(), q, 8).filter(function (x) { return !CI.isItem(x.entity); });
    box.innerHTML = c.length ? '<table class="fixed list"><tbody>' + c.map(function (x) {
      return '<tr class="pick"><td class="ellip"><b>' + esc(x.entity.name) + '</b> ' + A.tag(x.entity.type) + ' <span class="muted small">' + esc(x.entity.details || '') + '</span></td><td class="right">' +
        (have[x.entity.id] ? '<span class="muted small">already in</span>' : '<button class="btn small" data-action="bf-add" data-bank="' + esc(b.id) + '" data-id="' + esc(x.entity.id) + '">Add to bank</button>') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted small">No main file matches that.</p>';
  }
  H['bf-q'] = function (el) { fq = el.value; var b = bankById(el.getAttribute('data-bank')); if (b) bfResults(b); };
  function addFiles(b, ids) {
    ids.forEach(function (id) { if (b.files.indexOf(id) === -1) b.files.push(id); b.excluded = (b.excluded || []).filter(function (x) { return x !== id; }); });
    A.persist(); fq = ''; filesTab(b);
    var q = document.getElementById('bf-q'); if (q) q.focus();
  }
  H['bf-add'] = function (el) { var b = bankOf(el); if (b) addFiles(b, [el.getAttribute('data-id')]); };
  H['bf-add-all'] = function (el) { var b = bankOf(el); if (b) addFiles(b, CI.suggestFiles(D(), b, A.idx(), 8).map(function (x) { return x.id; })); };
  H['bf-remove'] = function (el) {
    var b = bankOf(el); if (!b) return;
    b.files = b.files.filter(function (x) { return x !== el.getAttribute('data-id'); }); b.seeds = (b.seeds || []).filter(function (x) { return x !== el.getAttribute('data-id'); });
    A.persist(); filesTab(b);
  };

  /* ----- Estimates tab ----- */
  function estimatesTab(b) {
    var d = D(), inv = CI.investigationFor(d, b.id), cur = CI.currentEstimate(b), nl = d.leads.filter(function (l) { return l.bankId === b.id; }).length;
    var rows = b.estimates.slice().reverse().map(function (e) {
      var est = e.items.filter(function (i) { return i.kind === 'ESTABLISHED'; }).length;
      var tag = (b.handedOver && b.handedOverEstimate === e.id) ? ' <span class="tag">handed over</span>' : (e === cur ? ' <span class="tag">latest</span>' : '');
      return '<tr class="pick"><td class="ellip"><a href="#/estimate/' + esc(b.id) + '/' + esc(e.id) + '"><b>' + esc(e.label) + '</b></a>' + tag + '</td>' +
        '<td>' + (e.created ? esc(CI.fmtDate(e.created)) : '') + '</td><td>' + (e.updated ? esc(CI.fmtDate(e.updated)) : '') + '</td>' +
        '<td class="num">' + est + '</td><td class="num">' + (e.items.length - est) + '</td><td class="ellip muted" title="' + esc(e.summary) + '">' + esc(e.summary) + '</td></tr>';
    }).join('');
    A.view.className = '';
    A.view.innerHTML = CI.views.bankHead(b, 'estimates') +
      '<div class="card"><div class="row spread"><div><h2 style="margin:0">Estimates</h2><p class="muted small" style="margin:4px 0 0">An estimate can be done again or corrected: each one stays on record.</p></div>' +
      '<div class="row"><button class="btn" data-action="est-new" data-bank="' + esc(b.id) + '" data-copy="1">Redo from the latest</button><button class="btn primary" data-action="est-new" data-bank="' + esc(b.id) + '">New estimate</button></div></div></div>' +
      '<div class="card flush"><table class="fixed"><colgroup><col style="width:22%"><col style="width:11%"><col style="width:11%"><col style="width:10%"><col style="width:10%"><col style="width:36%"></colgroup>' +
      '<thead><tr><th>Estimate</th><th>Started</th><th>Updated</th><th class="num">Established</th><th class="num">Theories</th><th>Summary</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (b.outcome ? '<div class="card"><h2>No situation <span class="tag">' + esc(CI.fmtDate(b.outcome.date)) + '</span></h2><p>' + esc(b.outcome.reason) + '</p><p class="muted small">This special bank ended without a hand over, so there is no investigation. It stays on record and can be reopened.</p>' +
        '<div class="row"><button class="btn" data-action="bank-reopen" data-bank="' + esc(b.id) + '">Reopen</button></div></div>'
      : '<div class="card"><h2>Where this ends</h2>' + (b.handedOver
        ? '<p>Handed over to Investigations on ' + esc(CI.fmtDate(b.handedOver)) + (b.handedOverEstimate ? ' with ' + esc(CI.estimateOf(b, b.handedOverEstimate).label) : '') + '. ' + (inv ? '<a href="#/investigation/' + esc(inv.id) + '">Investigation ' + esc(inv.id) + '</a>' : '') + '</p><p class="muted small">The chart now highlights what has changed since. Leads and requests are made in the investigation.</p>'
        : '<p class="muted small">Either the estimate shows a situation, and the bank is handed to Investigations (the files, the chart and the estimate go across and the chart is frozen as it stands), or it shows there is none and the bank is closed with the reason.</p>') +
      '<div class="row wrap">' + (b.handedOver ? '' : '<label class="row" style="margin:0">Estimate to send <select id="ho-est">' + A.options(b.estimates.slice().reverse().map(function (e) { return { value: e.id, label: e.label }; }), cur.id) + '</select></label><button class="btn primary" data-action="est-handover" data-bank="' + esc(b.id) + '">Hand over now</button><button class="btn" data-action="bank-nosit" data-bank="' + esc(b.id) + '">No situation: close this bank</button>') + '</div></div>');
  }
  H['bank-nosit'] = function (el) {
    var b = bankOf(el); if (!b) return;
    A.ask('Why is there no situation? One or two plain sentences.', '', function (reason) {
      var msg = CI.closeBank(D(), b, reason); if (msg) { A.toast(msg, true); return; }
      A.persist(); A.toast('Closed: no situation.'); estimatesTab(b);
    }, { title: 'No situation', ok: 'Close the bank' });
  };
  H['bank-reopen'] = function (el) { var b = bankOf(el); if (!b) return; CI.reopenBank(b); A.persist(); estimatesTab(b); };
  H['est-new'] = function (el) {
    var b = bankOf(el); if (!b) return;
    var e = CI.newEstimate(b, !!el.getAttribute('data-copy')); A.persist(); A.go('#/estimate/' + b.id + '/' + e.id);
  };

  /* ----- creating a special bank ----- */
  CI.views.newBank = function () {
    A.modal('<h2>New special bank</h2><div class="form"><label>Name<input type="text" id="nb-name" autocomplete="off" placeholder="e.g. Depot 4 equipment outage"></label>' +
      '<label>Why is this being looked into? <span class="hint">what you noticed, in a sentence or two</span><textarea id="nb-why" rows="3"></textarea></label>' +
      '<p class="muted small">You add the files on the next page.</p></div><div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="nb-create">Create</button></div>');
    var n = document.getElementById('nb-name'); if (n) n.focus();
  };
  H['nb-create'] = function () {
    var d = D(), name = val('nb-name').trim();
    if (!name) { A.toast('Give the special bank a name.', true); return; }
    var b = CI.newBank(d, name, [], 1); b.files = []; b.opened = { date: CI.today(), reason: val('nb-why').trim() }; b.estimates[0].created = CI.today();
    d.banks.push(b); d.ui.bankId = b.id; A.persist(); A.closeModal(); A.go('#/bank/' + b.id);
  };

  /* Opening a special bank from a finding: the starting names and their fattest related names come ticked; the staff member decides. */
  CI.views.openBank = function (ids, name, reason) {
    var idx = A.idx(), seeds = ids.filter(function (id) { return idx.entity[id]; });
    if (!seeds.length) return;
    var nm = name || (seeds.length === 1 ? idx.entity[seeds[0]].name : idx.entity[seeds[0]].name + ' and ' + (seeds.length - 1) + ' more');
    var prop = CI.proposeFiles(D(), seeds, 12, idx), extra = CI.suggestFiles(D(), { files: prop, seeds: seeds }, idx, 8).map(function (x) { return x.id; });
    CI.views._bankSeeds = seeds;
    function row(id, on) {
      return '<label class="chk pickfile"><input type="checkbox" class="ob-file" data-id="' + esc(id) + '"' + (on ? ' checked' : '') + '> <b>' + esc(idx.entity[id].name) + '</b> ' + A.tag(idx.entity[id].type) + (seeds.indexOf(id) !== -1 ? ' <span class="tag">where it started</span>' : '') + '</label>';
    }
    A.modal('<h2>Open a special bank</h2><div class="form"><label>Name<input type="text" id="ob-name" value="' + esc(nm) + '"></label>' +
      '<label>Why is this being looked into? <span class="hint">what you noticed, in a sentence or two</span><textarea id="ob-why" rows="3">' + esc(reason || '') + '</textarea></label>' +
      '<div class="group-label">Files to bring in <span class="hint">the fattest related files are ticked; untick any you do not want</span></div><div class="filepick">' +
      prop.map(function (id) { return row(id, true); }).join('') + extra.map(function (id) { return row(id, false); }).join('') + '</div></div>' +
      '<div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="ob-create">Open special bank</button></div>', true);
    var w = document.getElementById('ob-why'); if (w) w.focus();
  };
  H['ob-create'] = function () {
    var d = D(), name = val('ob-name').trim(), why = val('ob-why').trim();
    if (!name) { A.toast('Give the special bank a name.', true); return; }
    var files = []; document.querySelectorAll('.ob-file:checked').forEach(function (c) { files.push(c.getAttribute('data-id')); });
    if (!files.length) { A.toast('Tick at least one file.', true); return; }
    var b = CI.newBank(d, name, CI.views._bankSeeds.filter(function (s) { return files.indexOf(s) !== -1; }), 1); b.files = files; b.opened = { date: CI.today(), reason: why }; b.estimates[0].created = CI.today();
    d.banks.push(b); d.ui.bankId = b.id; A.persist(); A.closeModal(); A.go('#/bank/' + b.id);
  };
})();
