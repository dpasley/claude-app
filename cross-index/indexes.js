/* Indexes: the directory room. Name and item directories, the connection index of any file,
 * how staff describe connections, and a "worth a look" panel. Read-only: the indexes are built at the New report page. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var ix = { days: 7, kind: '', shown: 0, cf: 'group', itemKind: '', lq: '' };
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

  function findCard() {
    return '<div class="card"><h2>Connection index of a file</h2><p class="muted small">Pick a file or item to see everything it is connected to.</p>' +
      '<input type="search" id="ix-q" placeholder="Name, plate, number or handle…" autocomplete="off" data-on-input="ix-find"><div id="ix-res"></div></div>';
  }

  /* ----- tabs ----- */
  var TABS = [{ id: '', label: 'Worth a look' }, { id: 'crossfiling', label: 'Cross-filing' }, { id: 'items', label: 'Items' }, { id: 'words', label: 'Words used' }];
  function tabsBar(active, badge) {
    return '<div class="tabs" role="tablist">' + TABS.map(function (t) {
      return '<a role="tab" class="tab' + (t.id === active ? ' on' : '') + '" href="#/indexes' + (t.id ? '/' + t.id : '') + '">' + esc(t.label) +
        (t.id === '' && badge ? ' <span class="badge">' + badge + '</span>' : '') + '</a>';
    }).join('') + '</div>';
  }
  function subTabs(base, list, active) {
    return '<div class="tabs sub" role="tablist">' + list.map(function (t) {
      return '<a role="tab" class="tab' + (t.id === active ? ' on' : '') + '" href="' + base + (t.id ? '/' + encodeURIComponent(t.id) : '') + '">' + esc(t.label) + ' <span class="n">' + t.n + '</span></a>';
    }).join('') + '</div>';
  }
  function cap(k) { return k.charAt(0).toUpperCase() + k.slice(1); }

  CI.views.indexes = function (arg, sub) {
    var d = D(), idx = A.idx();
    A.view.className = '';
    if (arg === 'notes') arg = 'words';
    if (arg && arg !== 'crossfiling' && arg !== 'items' && arg !== 'words' && idx.entity[arg]) return connPage(arg, idx);
    if (ix.tab !== arg) ix.lq = '';
    ix.tab = arg;
    var badge = CI.discoveries(d, idx, CI.daysAgo(ix.days)).length;
    var h = '<div class="page-head"><h1>Indexes</h1><a class="small" href="#/observation">Files that moved recently</a></div>' + tabsBar(arg === 'crossfiling' || arg === 'items' || arg === 'words' ? arg : '', badge);
    if (arg === 'crossfiling') { if (sub) ix.cf = decodeURIComponent(sub); h += crossFiling(idx); }
    else if (arg === 'items') { ix.itemKind = sub ? decodeURIComponent(sub) : ''; h += itemsTab(idx); }
    else if (arg === 'words') h += wordsTab(idx);
    else h += lookPanel(idx);
    A.view.innerHTML = h;
  };

  /* One chip per file; several connections to the same file are joined into one entry. */
  function chips(rows) {
    var order = [], by = {};
    rows.forEach(function (r) { if (!by[r.other.id]) { by[r.other.id] = { other: r.other, notes: [] }; order.push(r.other.id); } if (r.note && by[r.other.id].notes.indexOf(r.note) === -1) by[r.other.id].notes.push(r.note); });
    return order.map(function (id) {
      var x = by[id];
      return '<a href="#/entity/' + esc(id) + '">' + esc(x.other.name) + '</a>' + (x.notes.length ? ' <span class="muted small">(' + esc(A.trunc(x.notes.join('; '), 50)) + ')</span>' : '');
    }).join(', ');
  }

  /* Cross-filing: who and what is connected to each group, area, subject or individual. */
  var CF = [{ id: 'group', label: 'Groups' }, { id: 'area', label: 'Areas' }, { id: 'subject', label: 'Subjects' }, { id: 'individual', label: 'Individuals' }];
  function cfEntries(idx) {
    var d = D(), q = CI.norm(ix.lq || '');
    return d.entities.filter(function (e) { return e.type === ix.cf && !CI.isItem(e) && (!q || CI.norm([e.name, e.details || ''].concat(e.aliases || []).join(' ')).indexOf(q) !== -1); })
      .sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (e) {
        var groups = CI.connectionIndex(d, e.id, idx), n = 0; groups.forEach(function (g) { n += g.rows.length; });
        return '<div class="cfentry"><div class="row spread"><div><a href="#/entity/' + esc(e.id) + '"><b>' + esc(e.name) + '</b></a>' + (e.details ? ' <span class="muted small">' + esc(e.details) + '</span>' : '') +
          '</div><a class="small" href="#/indexes/' + esc(e.id) + '">' + n + ' connection' + (n === 1 ? '' : 's') + ' ›</a></div>' +
          (groups.length ? groups.map(function (g) {
            return '<div class="cfrow"><span class="k">' + esc(g.label) + ' <span class="muted">' + g.rows.length + '</span></span><span class="v">' + chips(g.rows) + '</span></div>';
          }).join('') : '<div class="muted small">Nothing connected yet.</div>') + '</div>';
      }).join('') || '<p class="muted">Nothing here yet.</p>';
  }
  function crossFiling(idx) {
    var d = D(), counts = {};
    d.entities.forEach(function (e) { if (!CI.isItem(e)) counts[e.type] = (counts[e.type] || 0) + 1; });
    if (!CF.some(function (c) { return c.id === ix.cf; })) ix.cf = 'group';
    var h = findCard() + '<div class="card"><h2>Who and what is connected to each…</h2>' + subTabs('#/indexes/crossfiling', CF.map(function (c) { return { id: c.id, label: c.label, n: counts[c.id] || 0 }; }), ix.cf) +
      '<input type="search" id="ix-lq" placeholder="Search this list…" value="' + esc(ix.lq || '') + '" data-on-input="ix-lq"><div id="ix-list">' + cfEntries(idx) + '</div></div>';
    return h;
  }

  /* Items: the index where plates, phones, emails and accounts live. */
  function itemEntries(idx) {
    var d = D(), q = CI.norm(ix.lq || '');
    return d.entities.filter(function (e) {
      return CI.isItem(e) && (!ix.itemKind || (e.itemType || 'other') === ix.itemKind) && (!q || CI.norm([e.name, e.details || ''].concat(e.aliases || []).join(' ')).indexOf(q) !== -1);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (e) {
      var rows = [];
      CI.connectionIndex(d, e.id, idx).forEach(function (g) { rows = rows.concat(g.rows); });
      var nrep = (idx.reportsByEntity[e.id] || []).length;
      return '<div class="cfentry"><div class="row spread"><div><a href="#/entity/' + esc(e.id) + '"><b>' + esc(e.name) + '</b></a> <span class="tag">' + esc(e.itemType || 'item') + '</span></div>' +
        '<span class="muted small">' + nrep + ' report' + (nrep === 1 ? '' : 's') + '</span></div>' +
        (rows.length ? '<div class="cfrow"><span class="k">Connected to</span><span class="v">' + chips(rows) + '</span></div>' : '<div class="muted small">Not connected to anything yet.</div>') + '</div>';
    }).join('') || '<p class="muted">No items here yet. Items are added from a report: type a plate, number or handle and choose Item.</p>';
  }
  function itemsTab(idx) {
    var d = D(), counts = {}, total = 0;
    d.entities.forEach(function (e) { if (CI.isItem(e)) { var k = e.itemType || 'other'; counts[k] = (counts[k] || 0) + 1; total++; } });
    var tabs = [{ id: '', label: 'All items', n: total }].concat(Object.keys(counts).sort().map(function (k) { return { id: k, label: cap(k), n: counts[k] }; }));
    return '<div class="card"><h2>Items <span class="muted small">plates, phones, emails, accounts: indexed, not filed</span></h2>' + subTabs('#/indexes/items', tabs, ix.itemKind) +
      '<input type="search" id="ix-lq" placeholder="Search items…" value="' + esc(ix.lq || '') + '" data-on-input="ix-lq"><div id="ix-list">' + itemEntries(idx) + '</div></div>';
  }

  function wordsTab(idx) {
    var ni = CI.noteIndex(D(), idx);
    var h = '<div class="card"><h2>Words staff use for connections</h2>';
    if (!ni.length) return h + '<p class="muted">No connections recorded yet.</p></div>';
    var max = ni[0].count;
    h += '<p class="muted small">The wording in the note of each connection, with how often it is used. Use this to decide which connection types are worth having.</p>' +
      ni.map(function (e) {
        return '<div class="barrow wide"><span class="t">' + esc(e.text) + '</span><span class="bar"><span style="width:' + Math.round(100 * e.count / max) + '%"></span></span><span class="c">' + e.count + '</span>' +
          '<span class="ex muted small">' + Object.keys(e.types).map(function (t) { return esc(t); }).join(', ') + ' · ' + e.links.slice(0, 2).map(function (l) { return link(l.from) + ' – ' + link(l.to); }).join('; ') + '</span></div>';
      }).join('') + '</div>';
    return h;
  }

  function connPage(id, idx) {
    var e = idx.entity[id], groups = CI.connectionIndex(D(), id, idx), n = 0;
    groups.forEach(function (g) { n += g.rows.length; });
    var h = tabsBar('crossfiling', 0) + '<div class="page-head"><h1>Connection index: ' + esc(e.name) + ' ' + A.tag(CI.isItem(e) ? 'item' : e.type) + '</h1><div class="row"><a class="btn" href="#/entity/' + esc(id) + '">Open the file</a></div></div>';
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

  H['ix-lq'] = function (el) {
    ix.lq = el.value; var box = document.getElementById('ix-list'); if (!box) return;
    box.innerHTML = ix.tab === 'items' ? itemEntries(A.idx()) : cfEntries(A.idx());
  };
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
