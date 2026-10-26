/* Indexes: the directory room. Name and item directories, the connection index of any file,
 * how staff describe connections, and a "worth a look" panel. Read-only: the indexes are built at the New report page. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var ix = { days: 30 };
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function link(id) { return A.entLink(id); }
  function nm(ids) { return ids.map(link).join(', '); }
  function more(list, n) { return list.length > n ? '<div class="muted small">and ' + (list.length - n) + ' more</div>' : ''; }
  var SHOW = 10;

  function ptr(text, why, ids) {
    return '<div class="ptr"><div class="row spread"><div>' + text + '</div>' +
      (ids && ids.length ? '<button class="btn small" data-action="ix-chart" data-ids="' + esc(ids.join(',')) + '">Chart</button>' : '') + '</div>' +
      '<div class="why">' + why + '</div></div>';
  }

  function section(title, count, body, help) {
    if (!count) return '';
    return '<h3>' + esc(title) + ' <span class="muted">(' + count + ')</span></h3>' + (help ? '<p class="muted small">' + help + '</p>' : '') + body;
  }

  function lookPanel(idx) {
    var d = D(), p = CI.pointers(d, ix.days, idx), h = '';
    var total = p.sharedItems.length + p.hidden.length + p.togetherNoLink.length + p.growing.length + p.looseEnds.length + p.duplicates.length;
    h += '<div class="card"><div class="row spread"><h2>Worth a look</h2><label class="row" style="margin:0">Recent means the last ' +
      '<select id="ix-days" data-on-change="ix-days">' + A.options([7, 14, 30, 60, 90].map(function (n) { return { value: String(n), label: n + ' days' }; }), String(ix.days)) + '</select></label></div>' +
      '<p class="muted small">These point at where to look. Deciding that something matters is the staff member’s call. Each line says why it is shown.</p>';
    if (!total) h += '<p class="muted">Nothing stands out yet. Pointers appear as reports and connections are entered.</p>';
    h += section('The same item connects different files', p.sharedItems.length, p.sharedItems.slice(0, SHOW).map(function (s) {
      return ptr(link(s.item) + ' is connected to ' + nm(s.files), 'One ' + esc(CI.isItem(idx.entity[s.item]) ? (idx.entity[s.item].itemType || 'item') : 'item') + ' ties ' + s.files.length + ' files together.', s.files.concat([s.item]));
    }).join('') + more(p.sharedItems, SHOW));
    h += section('Connected without a direct connection', p.hidden.length, p.hidden.slice(0, SHOW).map(function (x) {
      return ptr(link(x.a) + ' and ' + link(x.b) + ' are not connected to each other', 'Both are connected to ' + nm(x.via) + '.', [x.a, x.b].concat(x.via));
    }).join('') + more(p.hidden, SHOW), 'Two files that share two or more of the same connections, with no connection recorded between them.');
    h += section('Named together, never connected', p.togetherNoLink.length, p.togetherNoLink.slice(0, SHOW).map(function (x) {
      return ptr(link(x.a) + ' and ' + link(x.b), 'Named together in ' + x.reports + ' independent reports, but no connection is recorded.', [x.a, x.b]);
    }).join('') + more(p.togetherNoLink, SHOW));
    h += section('Growing', p.growing.length, p.growing.slice(0, SHOW).map(function (x) {
      return ptr(link(x.id) + ' gained ' + x.added.length + ' newly connected files in ' + ix.days + ' days: ' + nm(x.added.slice(0, 6)), 'It now has ' + x.total + ' connected files.', [x.id]);
    }).join('') + more(p.growing, SHOW));
    h += section('Possible duplicates', p.duplicates.length, p.duplicates.slice(0, SHOW).map(function (x) {
      return '<div class="ptr"><div>' + x.ids.map(function (id) {
        var e = idx.entity[id];
        return link(id) + ' <span class="muted small">' + (e.details ? esc(e.details) : 'no identifying details yet') + ' · ' + esc(id) + '</span>';
      }).join('<br>') + '</div><div class="why">Same name on ' + x.ids.length + ' files. Add identifying details, or merge them from a file’s page.</div></div>';
    }).join('') + more(p.duplicates, SHOW));
    h += section('Loose ends', p.looseEnds.length, '<div class="ptr">' + p.looseEnds.slice(0, 20).map(function (x) { return link(x.id); }).join(', ') +
      (p.looseEnds.length > 20 ? ' and ' + (p.looseEnds.length - 20) + ' more' : '') + '<div class="why">In reports, but connected to nothing yet.</div></div>');
    h += '<p class="small"><a href="#/observation">Files that moved recently (situation observation)</a></p></div>';
    return h;
  }

  function directories() {
    var d = D(), types = {}, kinds = {};
    d.entities.forEach(function (e) {
      if (CI.isItem(e)) kinds[e.itemType || 'other'] = (kinds[e.itemType || 'other'] || 0) + 1;
      else types[e.type] = (types[e.type] || 0) + 1;
    });
    var h = '<div class="card"><h2>Name directories</h2><div class="dirgrid">' + CI.FILE_TYPES.map(function (t) {
      return '<a href="#/entities/' + t + '"><span class="n">' + (types[t] || 0) + '</span>' + esc(CI.TYPE_LABEL[t]) + 's</a>';
    }).join('') + '</div></div>';
    var ks = Object.keys(kinds).sort();
    h += '<div class="card"><h2>Item directories <span class="muted small">plates, phones, emails, accounts: indexed, not filed</span></h2>' +
      (ks.length ? '<div class="dirgrid">' + ks.map(function (k) {
        return '<a href="#/items/' + encodeURIComponent(k) + '"><span class="n">' + kinds[k] + '</span>' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + '</a>';
      }).join('') + '</div>' : '<p class="muted">No items yet. Add a plate, phone, email or account from a report.</p>') + '</div>';
    return h;
  }

  function notesCard(idx) {
    var d = D(), ni = CI.noteIndex(d, idx);
    var h = '<div class="card"><h2>How staff describe connections</h2>';
    if (!ni.length) return h + '<p class="muted">No connections recorded yet.</p></div>';
    h += '<p class="muted small">The wording used in the note of each connection, with how often. Use this to decide which connection types are worth having.</p><table class="tight"><tbody>' +
      ni.slice(0, 8).map(function (e) { return '<tr><td>' + esc(e.text) + '</td><td class="right">' + e.count + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="small"><a href="#/indexes/notes">See all ' + ni.length + ' wordings</a></p></div>';
    return h;
  }

  CI.views.indexes = function (arg) {
    var d = D(), idx = A.idx();
    A.view.className = '';
    if (arg === 'notes') return notesPage(idx);
    if (arg && idx.entity[arg]) return connPage(arg, idx);
    var h = '<div class="page-head"><h1>Indexes <span class="muted">built as reports are cross-indexed</span></h1></div>';
    h += lookPanel(idx) + directories();
    h += '<div class="card"><h2>Connection index of a file</h2><p class="muted small">Pick any file or item to see everything it is connected to, grouped by what is at the other end.</p>' +
      '<input type="search" id="ix-q" placeholder="Name, plate, number or handle…" autocomplete="off" data-on-input="ix-find"><div id="ix-res"></div></div>';
    h += notesCard(idx);
    A.view.innerHTML = h;
  };

  function connPage(id, idx) {
    var e = idx.entity[id], groups = CI.connectionIndex(D(), id, idx), n = 0;
    groups.forEach(function (g) { n += g.rows.length; });
    var h = '<div class="page-head"><h1>Connection index: ' + esc(e.name) + ' ' + A.tag(CI.isItem(e) ? 'item' : e.type) + '</h1><div class="row"><a class="btn" href="#/entity/' + esc(id) + '">Open the file</a><a class="btn" href="#/indexes">Indexes</a></div></div>';
    if (e.details) h += '<p class="muted">' + esc(e.details) + '</p>';
    if (!n) h += '<div class="card"><p class="muted">No connections recorded yet.</p></div>';
    groups.forEach(function (g) {
      h += '<div class="card"><h2>' + esc(g.label) + ' <span class="muted">(' + g.rows.length + ')</span></h2><table class="tight"><thead><tr><th>Name</th><th>Connection</th><th>What it is</th><th>Source report</th></tr></thead><tbody>' +
        g.rows.map(function (r) {
          return '<tr><td>' + link(r.other.id) + '</td><td>' + esc(r.phrase) + '</td><td>' + esc(r.note) + '</td><td>' + A.repLink(r.reportId) + ' <span class="muted small">' + esc(CI.fmtDate(r.date)) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    A.view.innerHTML = h;
  }

  function notesPage(idx) {
    var d = D(), ni = CI.noteIndex(d, idx);
    var h = '<div class="page-head"><h1>How staff describe connections</h1><a class="btn" href="#/indexes">Indexes</a></div><div class="card">';
    h += ni.length ? '<table class="tight"><thead><tr><th>Wording</th><th class="right">Times</th><th>Connection types used</th><th>Examples</th></tr></thead><tbody>' + ni.map(function (e) {
      return '<tr><td>' + esc(e.text) + '</td><td class="right">' + e.count + '</td><td>' + Object.keys(e.types).map(function (t) { return esc(t) + ' ×' + e.types[t]; }).join(', ') + '</td><td>' +
        e.links.slice(0, 3).map(function (l) { return link(l.from) + ' – ' + link(l.to); }).join('<br>') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">No connections recorded yet.</p>';
    A.view.innerHTML = h + '</div>';
  }

  H['ix-days'] = function () { ix.days = Number(val('ix-days')) || 30; CI.views.indexes(''); };
  H['ix-chart'] = function (el) { CI.views.quickBank(el.getAttribute('data-ids').split(','), 1, 'From the indexes'); };
  H['ix-find'] = function (el) {
    var box = document.getElementById('ix-res'), c = CI.findCandidates(D(), el.value, 8);
    box.innerHTML = c.map(function (x) {
      return '<div class="cand"><div><strong>' + esc(x.entity.name) + '</strong> ' + A.tag(CI.isItem(x.entity) ? 'item' : x.entity.type) + '</div><a class="btn small" href="#/indexes/' + esc(x.entity.id) + '">Connection index</a></div>';
    }).join('');
  };
})();
