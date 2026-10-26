/* Index logic: what is worth a look, the connection index for one file, and the index of connection wordings.
 * Pure functions over the data. They point at things; deciding what matters is the staff member's call. */
(function () {
  'use strict';
  var CI = globalThis.CI || window.CI;

  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  /* days: how far back counts as "recent". idx: optional CI.buildIndex(d). */
  CI.pointers = function (d, days, idx) {
    idx = idx || CI.buildIndex(d);
    days = days || 30;
    var cutoff = CI.daysAgo(days);
    var ent = idx.entity, adj = {}, direct = {};
    d.links.forEach(function (l) {
      if (!ent[l.from] || !ent[l.to]) return;
      (adj[l.from] = adj[l.from] || {})[l.to] = 1;
      (adj[l.to] = adj[l.to] || {})[l.from] = 1;
      direct[pairKey(l.from, l.to)] = 1;
    });
    var out = { sharedItems: [], hidden: [], togetherNoLink: [], growing: [], looseEnds: [], duplicates: [] };

    // 1. An item connected to two or more different files.
    d.entities.forEach(function (e) {
      if (!CI.isItem(e)) return;
      var files = Object.keys(adj[e.id] || {}).filter(function (id) { return !CI.isItem(ent[id]); });
      if (files.length >= 2) out.sharedItems.push({ item: e.id, files: files });
    });
    out.sharedItems.sort(function (a, b) { return b.files.length - a.files.length; });

    // 2. Two files with no direct connection that share two or more neighbours.
    var seen = {};
    Object.keys(adj).forEach(function (mid) {
      var ns = Object.keys(adj[mid]);
      for (var i = 0; i < ns.length; i++) for (var j = i + 1; j < ns.length; j++) {
        var k = pairKey(ns[i], ns[j]);
        if (direct[k]) continue;
        (seen[k] = seen[k] || { a: ns[i], b: ns[j], via: [] }).via.push(mid);
      }
    });
    Object.keys(seen).forEach(function (k) {
      var p = seen[k];
      if (p.via.length >= 2 && !CI.isItem(ent[p.a]) && !CI.isItem(ent[p.b])) out.hidden.push(p);
    });
    out.hidden.sort(function (a, b) { return b.via.length - a.via.length; });

    // 3. Named together in two or more independent reports, but no connection recorded.
    var together = {};
    d.reports.forEach(function (r) {
      var root = idx.rootOf(r.id), ids = r.entities.map(function (x) { return x.entityId; }).filter(function (id) { return ent[id]; });
      for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
        if (ids[i] === ids[j]) continue;
        var k = pairKey(ids[i], ids[j]);
        var t = together[k] || (together[k] = { a: ids[i], b: ids[j], roots: {} });
        t.roots[root] = 1;
      }
    });
    Object.keys(together).forEach(function (k) {
      var t = together[k], n = Object.keys(t.roots).length;
      if (n >= 2 && !direct[k]) out.togetherNoLink.push({ a: t.a, b: t.b, reports: n });
    });
    out.togetherNoLink.sort(function (a, b) { return b.reports - a.reports; });

    // 4. Groups, subjects and areas that gained two or more newly connected files in the period.
    //    "When" is the date of the source report, so folders entered today keep their real dates.
    d.entities.forEach(function (e) {
      if (CI.isItem(e) || e.type === 'individual') return;
      var before = {}, fresh = {};
      d.links.forEach(function (l) {
        var other = l.from === e.id ? l.to : l.to === e.id ? l.from : null;
        if (!other || !ent[other]) return;
        var rr = idx.report[l.reportId], when = rr ? CI.reportDate(rr) : (l.created || '');
        if (when >= cutoff) fresh[other] = 1; else before[other] = 1;
      });
      var added = Object.keys(fresh).filter(function (id) { return !before[id]; });
      if (added.length >= 2) out.growing.push({ id: e.id, added: added, total: Object.keys(adj[e.id] || {}).length });
    });
    out.growing.sort(function (a, b) { return b.added.length - a.added.length; });

    // 5. Loose ends: in reports but connected to nothing.
    d.entities.forEach(function (e) {
      var reps = (idx.reportsByEntity[e.id] || []).length;
      if (reps >= 1 && !Object.keys(adj[e.id] || {}).length) out.looseEnds.push({ id: e.id, reports: reps });
    });

    // 6. Possible duplicates: the same name (or an alias) on more than one file of the same type.
    var byName = {};
    d.entities.forEach(function (e) {
      [e.name].concat(e.aliases || []).forEach(function (n) {
        var k = e.type + '|' + CI.norm(n);
        if (!CI.norm(n)) return;
        var a = byName[k] || (byName[k] = []);
        if (a.indexOf(e.id) === -1) a.push(e.id);
      });
    });
    var dupSeen = {};
    Object.keys(byName).forEach(function (k) {
      if (byName[k].length < 2) return;
      var key = byName[k].slice().sort().join('|');
      if (dupSeen[key]) return;
      dupSeen[key] = 1;
      out.duplicates.push({ name: k.split('|')[1], ids: byName[k] });
    });
    return out;
  };

  var KIND_ORDER = ['individual', 'group', 'subject', 'area'];
  function kindOf(e) { return CI.isItem(e) ? 'item:' + (e.itemType || 'other') : e.type; }
  function kindLabel(k) {
    if (k.indexOf('item:') === 0) { var t = k.slice(5); return t.charAt(0).toUpperCase() + t.slice(1) + ' (item)'; }
    return CI.TYPE_LABEL[k] + 's';
  }
  CI.kindLabel = kindLabel;

  /* Every connection of one file or item, grouped by what is at the other end. */
  CI.connectionIndex = function (d, id, idx) {
    idx = idx || CI.buildIndex(d);
    var groups = {};
    (idx.linksByEntity[id] || []).forEach(function (l) {
      var otherId = l.from === id ? l.to : l.from, other = idx.entity[otherId];
      if (!other) return;
      var lt = CI.linkType(d, l.type), r = idx.report[l.reportId];
      var phrase = !lt.directed ? lt.label : (l.from === id ? lt.label + ' →' : '← ' + lt.label);
      var k = kindOf(other);
      (groups[k] = groups[k] || []).push({ other: other, type: lt.label, phrase: phrase, note: l.note || '', reportId: l.reportId, date: r ? CI.reportDate(r) : '', linkId: l.id });
    });
    var keys = Object.keys(groups).sort(function (a, b) {
      var ia = KIND_ORDER.indexOf(a), ib = KIND_ORDER.indexOf(b);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib || a.localeCompare(b);
    });
    return keys.map(function (k) {
      groups[k].sort(function (a, b) { return a.other.name.localeCompare(b.other.name); });
      return { kind: k, label: kindLabel(k), rows: groups[k] };
    });
  };

  /* The wordings staff have used to say what a connection is, with counts. */
  CI.noteIndex = function (d, idx) {
    idx = idx || CI.buildIndex(d);
    var by = {};
    d.links.forEach(function (l) {
      var raw = String(l.note || '').trim(), k = CI.norm(raw) || '(no note)';
      var e = by[k] || (by[k] = { key: k, text: raw || '(no note)', count: 0, types: {}, links: [] });
      e.count++; e.types[CI.linkType(d, l.type).label] = (e.types[CI.linkType(d, l.type).label] || 0) + 1; e.links.push(l);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.count - a.count || a.key.localeCompare(b.key); });
  };
})();
