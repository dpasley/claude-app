/* Indexes: the directory room. Name and item directories, the connection index of any file,
 * how staff describe connections, and a "worth a look" panel. Read-only: the indexes are built at the New report page. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var ix = { days: 7, kind: '', shown: 0 };
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function link(id) { return A.entLink(id); }
  function nm(ids) { return ids.map(link).join(', '); }
  function more(list, n) { return list.length > n ? '<div class="muted small">and ' + (list.length - n) + ' more</div>' : ''; }
  var KINDS = [
    { id: 'discoveries', label: 'New discoveries', help: 'A connection entered recently ties files together that no single report shows.' },
    { id: 'shared', label: 'Shared items', help: 'One item (a phone, plate, email…) connects different files.' },
    { id: 'hidden', label: 'Linked through others', help: 'Two files share two or more connections but have none between them.' },
    { id: 'together', label: 'Named together, not connected', help: 'In two or more reports together, with no connection recorded.' },
    { id: 'growing', label: 'Growing', help: 'Groups, subjects or areas gaining connected files.' },
    { id: 'loose', label: 'Loose ends', help: 'In reports but connected to nothing yet.' },
    { id: 'dups', label: 'Possible duplicates', help: 'The same name on more than one file.' }
  ];
  var PAGE = 6;

  /* ----- little pictures: boxes joined by lines ----- */
  function kindName(e) { return CI.isItem(e) ? (e.itemType || 'item') : CI.TYPE_LABEL[e.type]; }
  function box(id, cls) {
    var e = A.idx().entity[id];
    if (!e) return '<span class="nb">' + esc(id) + '</span>';
    return '<a class="nb ' + (cls || '') + '" href="#/entity/' + esc(id) + '"><b>' + esc(A.trunc(e.name, 34)) + '</b><small>' + esc(kindName(e)) + '</small></a>';
  }
  function edge(label, how) { return '<span class="ed ' + (how || '') + '"><i>' + esc(label || '') + '</i></span>'; }
  function lbl(l, idx) { var lt = CI.linkType(D(), l.type); return (l.note || lt.label); }
  function card(pic, caption, ids, extra) {
    return '<div class="find"><div class="pic">' + pic + '</div><div class="cap">' + caption + '</div>' +
      '<div class="act">' + (ids && ids.length ? '<button class="btn small" data-action="ix-chart" data-ids="' + esc(ids.join(',')) + '">Open chart</button>' : '') + (extra || '') + '</div></div>';
  }
  function repsText(rs) { return rs.map(function (r) { return A.repLink(r); }).join(', '); }

  var renderers = {
    discoveries: function (x, idx) {
      if (x.kind === 'join') {
        return card(box(x.a, 'hl') + edge(lbl(x.link), 'new') + box(x.b, 'hl'),
          '<b>Two separate groups of files are now joined.</b> ' + A.repLink(x.link.reportId) + ' connected a group of ' + x.sizeA + ' files with a group of ' + x.sizeB + ' that had nothing to do with each other before.', [x.a, x.b]);
      }
      return card(box(x.a) + edge(lbl(x.oldLink)) + box(x.via, 'mid') + edge(lbl(x.link), 'new') + box(x.c, 'hl'),
        '<b>' + esc(idx.entity[x.a].name) + ' is now tied to ' + esc(idx.entity[x.c].name) + ' through ' + esc(idx.entity[x.via].name) + '.</b> ' + A.repLink(x.oldLink.reportId) + ' tied the first two; ' +
        A.repLink(x.link.reportId) + ' tied the last two. No single report shows both.', [x.a, x.via, x.c]);
    },
    shared: function (x, idx) {
      return card('<div class="fan">' + x.files.slice(0, 6).map(function (f) { return '<div class="row">' + box(f) + edge('', '') + '</div>'; }).join('') + '</div>' + box(x.item, 'item'),
        '<b>' + esc(idx.entity[x.item].name) + '</b> connects ' + x.files.length + ' files.' + (x.files.length > 6 ? ' Showing 6.' : ''), x.files.concat([x.item]));
    },
    hidden: function (x, idx) {
      return card(box(x.a) + edge('no connection recorded', 'gap') + box(x.b),
        'Both are connected to ' + nm(x.via) + '.', [x.a, x.b].concat(x.via));
    },
    together: function (x) {
      return card(box(x.a) + edge('named together in ' + x.reports + ' reports', 'gap') + box(x.b), 'Worth asking whether they are connected.', [x.a, x.b]);
    },
    growing: function (x) {
      return card(box(x.id, 'hl') + '<div class="chips">' + x.added.slice(0, 8).map(function (id) { return box(id, 'small'); }).join('') + '</div>',
        '<b>+' + x.added.length + '</b> newly connected in ' + ix.days + ' days <span class="bar"><span style="width:' + Math.min(100, Math.round(100 * x.added.length / Math.max(x.total, 1))) + '%"></span></span> ' + x.total + ' connected in all.', [x.id].concat(x.added));
    },
    loose: function (x) { return null; },
    dups: function (x, idx) {
      return card(x.ids.map(function (id) { var e = idx.entity[id]; return '<span class="dup">' + box(id) + '<small>' + (e.details ? esc(A.trunc(e.details, 60)) : 'no identifying details yet') + '</small></span>'; }).join(''),
        'Same name on ' + x.ids.length + ' files. Add identifying details, or merge them from a file’s page.', null);
    }
  };

  function findings(idx) {
    var d = D(), p = CI.pointers(d, ix.days, idx);
    return {
      discoveries: CI.discoveries(d, idx, CI.daysAgo(ix.days)),
      shared: p.sharedItems, hidden: p.hidden, together: p.togetherNoLink, growing: p.growing, loose: p.looseEnds, dups: p.duplicates
    };
  }

  function lookPanel(idx) {
    var f = findings(idx);
    if (!ix.kind || !f[ix.kind] || !f[ix.kind].length) {
      ix.kind = ''; KINDS.some(function (k) { if (f[k.id].length) { ix.kind = k.id; return true; } });
    }
    var h = '<div class="tiles">' + KINDS.map(function (k) {
      var n = f[k.id].length;
      return '<button class="tile' + (k.id === ix.kind ? ' on' : '') + (n ? '' : ' zero') + (k.id === 'discoveries' && n ? ' lead' : '') + '" data-action="ix-kind" data-kind="' + k.id + '"' + (n ? '' : ' disabled') + '><span class="n">' + n + '</span><span class="l">' + esc(k.label) + '</span></button>';
    }).join('') + '</div>';
    var kind = KINDS.filter(function (k) { return k.id === ix.kind; })[0];
    h += '<div class="card"><div class="row spread"><h2>' + (kind ? esc(kind.label) : 'Worth a look') + '</h2><label class="row" style="margin:0">Last ' +
      '<select id="ix-days" data-on-change="ix-days">' + A.options([7, 14, 30, 60, 90].map(function (n) { return { value: String(n), label: n + ' days' }; }), String(ix.days)) + '</select></label></div>';
    if (!kind) {
      h += '<p class="muted">Nothing stands out yet. Findings appear as reports and connections are entered. They point at where to look; what matters is the staff member’s call.</p></div>';
      return h;
    }
    h += '<p class="muted small">' + esc(kind.help) + ' These point at where to look; what matters is the staff member’s call.</p>';
    var list = f[kind.id];
    if (kind.id === 'loose') {
      h += '<div class="chips">' + list.map(function (x) { return box(x.id, 'small'); }).join('') + '</div>';
    } else {
      var shown = list.slice(0, ix.shown || PAGE);
      h += shown.map(function (x) { return renderers[kind.id](x, idx); }).join('');
      if (list.length > shown.length) h += '<p><button class="btn" data-action="ix-more">Show more (' + (list.length - shown.length) + ' left)</button></p>';
    }
    h += '</div>';
    return h;
  }

  function directories() {
    var d = D(), types = {}, kinds = {};
    d.entities.forEach(function (e) {
      if (CI.isItem(e)) kinds[e.itemType || 'other'] = (kinds[e.itemType || 'other'] || 0) + 1;
      else types[e.type] = (types[e.type] || 0) + 1;
    });
    var ks = Object.keys(kinds).sort();
    return '<div class="card"><h2>Directories</h2><div class="dirgrid">' + CI.FILE_TYPES.map(function (t) {
      return '<a href="#/entities/' + t + '"><span class="n">' + (types[t] || 0) + '</span>' + esc(CI.TYPE_LABEL[t]) + 's</a>';
    }).join('') + ks.map(function (k) {
      return '<a class="item" href="#/items/' + encodeURIComponent(k) + '"><span class="n">' + kinds[k] + '</span>' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + '</a>';
    }).join('') + '</div></div>';
  }

  function findCard() {
    return '<div class="card"><h2>Connection index of a file</h2><p class="muted small">Pick a file or item to see everything it is connected to.</p>' +
      '<input type="search" id="ix-q" placeholder="Name, plate, number or handle…" autocomplete="off" data-on-input="ix-find"><div id="ix-res"></div></div>';
  }

  function notesCard(idx) {
    var ni = CI.noteIndex(D(), idx);
    var h = '<div class="card"><h2>Words staff use for connections</h2>';
    if (!ni.length) return h + '<p class="muted">No connections recorded yet.</p></div>';
    var max = ni[0].count;
    h += ni.slice(0, 8).map(function (e) {
      return '<div class="barrow"><span class="t">' + esc(e.text) + '</span><span class="bar"><span style="width:' + Math.round(100 * e.count / max) + '%"></span></span><span class="c">' + e.count + '</span></div>';
    }).join('') + '<p class="small"><a href="#/indexes/notes">See all ' + ni.length + ' wordings</a></p></div>';
    return h;
  }

  CI.views.indexes = function (arg) {
    var d = D(), idx = A.idx();
    A.view.className = '';
    if (arg === 'notes') return notesPage(idx);
    if (arg && idx.entity[arg]) return connPage(arg, idx);
    var h = '<div class="page-head"><h1>Indexes</h1><a class="small" href="#/observation">Files that moved recently</a></div>';
    h += lookPanel(idx) + '<div class="two">' + directories() + findCard() + '</div>' + notesCard(idx);
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

  H['ix-days'] = function () { ix.days = Number(val('ix-days')) || 7; ix.shown = 0; CI.views.indexes(''); };
  H['ix-kind'] = function (el) { ix.kind = el.getAttribute('data-kind'); ix.shown = 0; CI.views.indexes(''); };
  H['ix-more'] = function () { ix.shown = (ix.shown || PAGE) + PAGE; CI.views.indexes(''); };
  H['ix-chart'] = function (el) { CI.views.quickBank(el.getAttribute('data-ids').split(','), 1, 'From the indexes'); };
  H['ix-find'] = function (el) {
    var box = document.getElementById('ix-res'), c = CI.findCandidates(D(), el.value, 8);
    box.innerHTML = c.map(function (x) {
      return '<div class="cand"><div><strong>' + esc(x.entity.name) + '</strong> ' + A.tag(CI.isItem(x.entity) ? 'item' : x.entity.type) + '</div><a class="btn small" href="#/indexes/' + esc(x.entity.id) + '">Connection index</a></div>';
    }).join('');
  };
})();
