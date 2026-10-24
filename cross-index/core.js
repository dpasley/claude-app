/* Cross-Index core: data model, index, graph computation, merge/undo.
 * No DOM access here, so it runs in a browser and in Node (for tests). */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  var STORAGE_KEY = 'cross-index-data-v1';

  CI.ENTITY_TYPES = ['individual', 'group', 'subject', 'location'];
  CI.TYPE_LABEL = { individual: 'Individual', group: 'Group', subject: 'Subject', location: 'Location' };

  CI.DEFAULT_SETTINGS = {
    basisList: ['Fraud', 'Sabotage', 'Theft', 'Harassment of staff', 'Credible violence', 'Coordinated damaging activity'],
    sourceTypes: ['Social post', 'Financial document', 'Corporate document', 'FOIA record', 'Staff report', 'News / media', 'Other'],
    roles: ['author / poster', 'named', 'subject of report', 'payer', 'recipient', 'present at', 'other'],
    linkTypes: [
      { id: 'employed_by', label: 'employed by / holds role in', directed: true },
      { id: 'member_of', label: 'member of', directed: true },
      { id: 'owns_controls', label: 'owns / controls', directed: true },
      { id: 'funded', label: 'funded', directed: true },
      { id: 'communicated_with', label: 'communicated with', directed: false },
      { id: 'known_associate', label: 'known associate of', directed: false },
      { id: 'based_at', label: 'based at / present at', directed: true },
      { id: 'involved_in', label: 'involved in', directed: true },
      { id: 'acted_against', label: 'alleged to have acted against', directed: true }
    ],
    heatWindowDays: 14,
    heatThreshold: 5,
    hubDegree: 8
  };

  var clone = CI.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };

  /* ---------- data container ---------- */
  CI.emptyData = function () {
    return {
      version: 1,
      settings: clone(CI.DEFAULT_SETTINGS),
      counters: { report: 0, entity: 0, link: 0, bank: 0, snag: 0, merge: 0, snapshot: 0 },
      entities: [], reports: [], links: [], banks: [], log: [], merges: [],
      ui: { bankId: null }
    };
  };

  CI.normalize = function (d) {
    var e = CI.emptyData();
    d = d || {};
    ['entities', 'reports', 'links', 'banks', 'log', 'merges'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = e[k]; });
    d.settings = Object.assign({}, e.settings, d.settings || {});
    ['basisList', 'sourceTypes', 'roles', 'linkTypes'].forEach(function (k) { if (!Array.isArray(d.settings[k]) || !d.settings[k].length) d.settings[k] = e.settings[k]; });
    d.counters = Object.assign({}, e.counters, d.counters || {});
    d.ui = Object.assign({}, e.ui, d.ui || {});
    d.version = 1;
    d.reports.forEach(function (r) { if (!Array.isArray(r.entities)) r.entities = []; });
    d.banks.forEach(function (b) { if (!Array.isArray(b.snapshots)) b.snapshots = []; if (!Array.isArray(b.seeds)) b.seeds = []; if (!Array.isArray(b.excluded)) b.excluded = []; });
    return d;
  };

  CI.load = function () {
    try {
      var raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      if (raw) return CI.normalize(JSON.parse(raw));
    } catch (e) { /* fall through to empty */ }
    return CI.emptyData();
  };

  CI.save = function (d) {
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  };

  var PREFIX = { report: 'R-', entity: 'E-', link: 'L-', bank: 'B-', snag: 'S-', merge: 'M-', snapshot: 'N-' };
  CI.nextId = function (d, kind) {
    d.counters[kind] = (d.counters[kind] || 0) + 1;
    return PREFIX[kind] + pad(d.counters[kind], 4);
  };

  /* ---------- dates ---------- */
  CI.today = function () {
    var t = new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1, 2) + '-' + pad(t.getDate(), 2);
  };
  CI.daysAgo = function (n, from) {
    var t = from ? new Date(from) : new Date();
    t.setDate(t.getDate() - n);
    return t.getFullYear() + '-' + pad(t.getMonth() + 1, 2) + '-' + pad(t.getDate(), 2);
  };
  CI.reportDate = function (r) { return r.eventDate || r.received || ''; };

  /* ---------- text matching (entity resolution aid) ---------- */
  CI.norm = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9@ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  };
  function bigrams(s) {
    var out = {}, n = 0;
    for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); out[g] = (out[g] || 0) + 1; n++; }
    return { map: out, n: n };
  }
  CI.dice = function (a, b) {
    a = CI.norm(a); b = CI.norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    var A = bigrams(a), B = bigrams(b);
    if (!A.n || !B.n) return 0;
    var inter = 0;
    Object.keys(A.map).forEach(function (g) { if (B.map[g]) inter += Math.min(A.map[g], B.map[g]); });
    return (2 * inter) / (A.n + B.n);
  };
  /* Candidates for a typed name: exact/alias matches, substring matches, then fuzzy. */
  CI.findCandidates = function (d, query, limit) {
    var q = CI.norm(query);
    if (!q) return [];
    var out = [];
    d.entities.forEach(function (e) {
      var names = [e.name].concat(e.aliases || []);
      var best = 0, via = e.name;
      names.forEach(function (n) {
        var nn = CI.norm(n), s = 0;
        if (!nn) return;
        if (nn === q) s = 1;
        else if (nn.indexOf(q) !== -1 || q.indexOf(nn) !== -1) s = Math.max(0.75, CI.dice(nn, q));
        else s = CI.dice(nn, q);
        if (s > best) { best = s; via = n; }
      });
      if (best >= 0.6) out.push({ entity: e, score: best, via: via });
    });
    out.sort(function (a, b) { return b.score - a.score || a.entity.name.localeCompare(b.entity.name); });
    return out.slice(0, limit || 8);
  };

  /* ---------- index (derived, rebuilt on demand) ---------- */
  CI.buildIndex = function (d) {
    var idx = { entity: {}, report: {}, linksByEntity: {}, reportsByEntity: {} };
    d.entities.forEach(function (e) { idx.entity[e.id] = e; });
    d.reports.forEach(function (r) { idx.report[r.id] = r; });
    idx.rootOf = function (id) {
      var seen = {}, cur = id;
      while (idx.report[cur] && idx.report[cur].dupOf && idx.report[idx.report[cur].dupOf] && !seen[cur]) {
        seen[cur] = 1; cur = idx.report[cur].dupOf;
      }
      return cur;
    };
    d.reports.forEach(function (r) {
      r.entities.forEach(function (x) {
        var a = idx.reportsByEntity[x.entityId] || (idx.reportsByEntity[x.entityId] = []);
        if (a.indexOf(r.id) === -1) a.push(r.id);
      });
    });
    d.links.forEach(function (l) {
      [l.from, l.to].forEach(function (id) { (idx.linksByEntity[id] = idx.linksByEntity[id] || []).push(l); });
    });
    return idx;
  };

  CI.linkType = function (d, id) {
    var t = d.settings.linkTypes.filter(function (x) { return x.id === id; })[0];
    return t || { id: id, label: id, directed: true };
  };

  /* Count of independent reports (reposts collapsed) per entity within the heat window. */
  CI.heat = function (d, days, idx) {
    idx = idx || CI.buildIndex(d);
    var cutoff = CI.daysAgo(days), out = {};
    Object.keys(idx.reportsByEntity).forEach(function (eid) {
      var roots = {};
      idx.reportsByEntity[eid].forEach(function (rid) {
        var r = idx.report[rid];
        if (r && (r.received || '') >= cutoff) roots[idx.rootOf(rid)] = true;
      });
      out[eid] = Object.keys(roots).length;
    });
    return out;
  };

  /* ---------- validation ---------- */
  CI.validateReport = function (r) {
    var p = [];
    if (!r.sourceType) p.push('Source type is required.');
    if (!String(r.sourceRef || '').trim()) p.push('Source identifier (URL, handle or document title) is required.');
    if (!String(r.summary || '').trim()) p.push('A short summary is required.');
    if (!r.basis) p.push('Intake basis is required: pick the threat category this report meets.');
    if (!r.received) p.push('Date received is required.');
    return p;
  };

  /* ---------- mutations ---------- */
  CI.addEntity = function (d, o) {
    var e = {
      id: CI.nextId(d, 'entity'),
      type: o.type,
      name: String(o.name || '').trim(),
      aliases: (o.aliases || []).map(function (s) { return String(s).trim(); }).filter(Boolean),
      notes: o.notes || '',
      created: CI.today()
    };
    d.entities.push(e);
    return e;
  };

  CI.addEntityToReport = function (d, reportId, entityId, role, flag, flagNote) {
    var r = d.reports.filter(function (x) { return x.id === reportId; })[0];
    if (!r) return 'Report not found.';
    if (r.entities.some(function (x) { return x.entityId === entityId; })) return 'That entity is already in this report.';
    r.entities.push({ entityId: entityId, role: role || '', flag: !!flag, flagNote: flagNote || '' });
    return null;
  };

  CI.removeEntityFromReport = function (d, reportId, entityId) {
    var r = d.reports.filter(function (x) { return x.id === reportId; })[0];
    if (!r) return 0;
    r.entities = r.entities.filter(function (x) { return x.entityId !== entityId; });
    var before = d.links.length;
    d.links = d.links.filter(function (l) { return !(l.reportId === reportId && (l.from === entityId || l.to === entityId)); });
    return before - d.links.length;
  };

  CI.addLink = function (d, o) {
    var r = d.reports.filter(function (x) { return x.id === o.reportId; })[0];
    if (!r) return { error: 'Report not found.' };
    if (!o.from || !o.to) return { error: 'Choose both entities.' };
    if (o.from === o.to) return { error: 'A connection needs two different entities.' };
    var has = function (id) { return r.entities.some(function (x) { return x.entityId === id; }); };
    if (!has(o.from) || !has(o.to)) return { error: 'Both entities must be listed in this report first.' };
    var lt = d.settings.linkTypes.filter(function (t) { return t.id === o.type; })[0];
    if (!lt) return { error: 'Choose a connection type.' };
    var dup = d.links.some(function (l) {
      if (l.reportId !== o.reportId || l.type !== o.type) return false;
      if (l.from === o.from && l.to === o.to) return true;
      return !lt.directed && l.from === o.to && l.to === o.from;
    });
    if (dup) return { error: 'This report already asserts that connection.' };
    var l = { id: CI.nextId(d, 'link'), reportId: o.reportId, from: o.from, to: o.to, type: o.type, note: o.note || '', created: CI.today() };
    d.links.push(l);
    return { link: l };
  };

  CI.deleteReport = function (d, id) {
    var r = d.reports.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    d.links = d.links.filter(function (l) { return l.reportId !== id; });
    d.reports.forEach(function (x) { if (x.dupOf === id) x.dupOf = r.dupOf || ''; });
    d.reports = d.reports.filter(function (x) { return x.id !== id; });
  };

  CI.entityInUse = function (d, id) {
    var idx = CI.buildIndex(d);
    return (idx.reportsByEntity[id] || []).length + (idx.linksByEntity[id] || []).length > 0;
  };

  CI.deleteEntity = function (d, id) {
    if (CI.entityInUse(d, id)) return false;
    d.entities = d.entities.filter(function (e) { return e.id !== id; });
    d.banks.forEach(function (b) {
      b.seeds = b.seeds.filter(function (x) { return x !== id; });
      b.excluded = b.excluded.filter(function (x) { return x !== id; });
    });
    return true;
  };

  /* ---------- merge with undo ---------- */
  CI.mergeEntities = function (d, fromId, intoId) {
    if (fromId === intoId) return { error: 'Choose a different entity to merge into.' };
    var from = d.entities.filter(function (e) { return e.id === fromId; })[0];
    var into = d.entities.filter(function (e) { return e.id === intoId; })[0];
    if (!from || !into) return { error: 'Entity not found.' };
    var rec = {
      id: CI.nextId(d, 'merge'), t: CI.today(), fromId: fromId, intoId: intoId,
      fromEntity: clone(from), addedAliases: [], reportsBefore: [], linksBefore: [], linksRemoved: [], undone: false
    };
    d.reports.forEach(function (r) {
      if (!r.entities.some(function (x) { return x.entityId === fromId; })) return;
      rec.reportsBefore.push({ id: r.id, entities: clone(r.entities) });
      var hasInto = r.entities.some(function (x) { return x.entityId === intoId; });
      if (hasInto) r.entities = r.entities.filter(function (x) { return x.entityId !== fromId; });
      else r.entities.forEach(function (x) { if (x.entityId === fromId) x.entityId = intoId; });
    });
    var kept = [];
    d.links.forEach(function (l) {
      if (l.from !== fromId && l.to !== fromId) { kept.push(l); return; }
      var nl = clone(l);
      if (nl.from === fromId) nl.from = intoId;
      if (nl.to === fromId) nl.to = intoId;
      if (nl.from === nl.to) { rec.linksRemoved.push(clone(l)); return; }
      rec.linksBefore.push({ id: l.id, from: l.from, to: l.to });
      l.from = nl.from; l.to = nl.to;
      kept.push(l);
    });
    d.links = kept;
    [from.name].concat(from.aliases || []).forEach(function (n) {
      var nn = CI.norm(n);
      if (!nn || nn === CI.norm(into.name)) return;
      if ((into.aliases || []).some(function (a) { return CI.norm(a) === nn; })) return;
      into.aliases = (into.aliases || []).concat([n]);
      rec.addedAliases.push(n);
    });
    d.banks.forEach(function (b) {
      b.seeds = b.seeds.map(function (x) { return x === fromId ? intoId : x; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      b.excluded = b.excluded.map(function (x) { return x === fromId ? intoId : x; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    });
    d.entities = d.entities.filter(function (e) { return e.id !== fromId; });
    d.merges.push(rec);
    return { merge: rec };
  };

  CI.undoMerge = function (d, mergeId) {
    var rec = d.merges.filter(function (m) { return m.id === mergeId; })[0];
    if (!rec || rec.undone) return { error: 'Nothing to undo.' };
    if (d.entities.some(function (e) { return e.id === rec.fromId; })) return { error: 'Entity already exists.' };
    var into = d.entities.filter(function (e) { return e.id === rec.intoId; })[0];
    if (!into) return { error: 'The entity it was merged into no longer exists.' };
    d.entities.push(clone(rec.fromEntity));
    rec.reportsBefore.forEach(function (rb) {
      var r = d.reports.filter(function (x) { return x.id === rb.id; })[0];
      if (r) r.entities = clone(rb.entities);
    });
    rec.linksBefore.forEach(function (lb) {
      var l = d.links.filter(function (x) { return x.id === lb.id; })[0];
      if (l) { l.from = lb.from; l.to = lb.to; }
    });
    rec.linksRemoved.forEach(function (l) { if (!d.links.some(function (x) { return x.id === l.id; })) d.links.push(clone(l)); });
    into.aliases = (into.aliases || []).filter(function (a) { return rec.addedAliases.indexOf(a) === -1; });
    rec.undone = true;
    return { ok: true };
  };

  /* ---------- graph computation ----------
   * A link is one report's assertion. A chart edge groups all links of the same type
   * between the same two entities. Weight = number of independent reports behind it
   * (reposts/duplicates collapse into the original report). */
  function inWindow(r, bank) {
    var dt = CI.reportDate(r);
    if (bank.dateFrom && dt < bank.dateFrom) return false;
    if (bank.dateTo && dt > bank.dateTo) return false;
    return true;
  }
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  CI.newBank = function (d, name, seeds, hops) {
    return {
      id: CI.nextId(d, 'bank'), name: name || 'Untitled bank', seeds: seeds || [], hops: hops == null ? 1 : hops,
      minWeight: 1, linkTypes: null, entityTypes: null, dateFrom: '', dateTo: '',
      showMentions: false, hubStop: true, excluded: [], snapshots: [], viewMode: 'live', compareId: '',
      layout: 'cose', edgeLabels: true
    };
  };

  CI.computeGraph = function (d, bank, idx) {
    idx = idx || CI.buildIndex(d);
    var types = bank.linkTypes && bank.linkTypes.length ? new Set(bank.linkTypes) : null;
    var etypes = bank.entityTypes && bank.entityTypes.length ? new Set(bank.entityTypes) : null;
    var excluded = new Set(bank.excluded || []);
    var entOk = function (id) {
      var e = idx.entity[id];
      return !!e && !excluded.has(id) && (!etypes || etypes.has(e.type));
    };

    var groups = {};
    d.links.forEach(function (l) {
      var r = idx.report[l.reportId];
      if (!r || !inWindow(r, bank)) return;
      if (types && !types.has(l.type)) return;
      if (!entOk(l.from) || !entOk(l.to)) return;
      var lt = CI.linkType(d, l.type);
      var s = l.from, t = l.to;
      if (!lt.directed && s > t) { s = l.to; t = l.from; }
      var key = 'link|' + l.type + '|' + s + '|' + t;
      var g = groups[key] || (groups[key] = {
        id: key, kind: 'link', type: l.type, label: lt.label, directed: lt.directed,
        source: s, target: t, roots: {}, linkIds: []
      });
      g.linkIds.push(l.id);
      g.roots[idx.rootOf(l.reportId)] = true;
    });
    var edges = Object.keys(groups).map(function (k) { return groups[k]; });

    if (bank.showMentions) {
      var linked = {};
      edges.forEach(function (e) { linked[pairKey(e.source, e.target)] = true; });
      var pairs = {};
      d.reports.forEach(function (r) {
        if (!inWindow(r, bank)) return;
        var ids = r.entities.map(function (x) { return x.entityId; }).filter(function (id, i, a) { return a.indexOf(id) === i && entOk(id); }).sort();
        for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
          var pk = pairKey(ids[i], ids[j]);
          if (linked[pk]) continue;
          var g = pairs[pk] || (pairs[pk] = {
            id: 'mention|' + pk, kind: 'mention', type: 'mention', label: 'mentioned together', directed: false,
            source: ids[i], target: ids[j], roots: {}, linkIds: []
          });
          g.roots[idx.rootOf(r.id)] = true;
        }
      });
      Object.keys(pairs).forEach(function (k) { edges.push(pairs[k]); });
    }

    edges.forEach(function (e) {
      e.reportIds = Object.keys(e.roots).sort();
      e.weight = e.reportIds.length;
      delete e.roots;
    });
    var total = edges.length;
    var minW = Math.max(1, Number(bank.minWeight) || 1);
    edges = edges.filter(function (e) { return e.weight >= minW; });
    var hiddenWeak = total - edges.length;

    var degree = {}, adj = {};
    edges.forEach(function (e) {
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
      (adj[e.source] = adj[e.source] || []).push(e.target);
      (adj[e.target] = adj[e.target] || []).push(e.source);
    });
    var hubDeg = d.settings.hubDegree || 8;
    var isHub = function (id) { return (degree[id] || 0) >= hubDeg; };

    var seeds = (bank.seeds || []).filter(function (id) { return idx.entity[id] && !excluded.has(id); });
    var keep = {};
    if (seeds.length) {
      var dist = {}, queue = [];
      seeds.forEach(function (s) { dist[s] = 0; queue.push(s); });
      var hops = bank.hops == null ? 1 : bank.hops;
      while (queue.length) {
        var u = queue.shift();
        if (dist[u] >= hops) continue;
        if (bank.hubStop && isHub(u) && seeds.indexOf(u) === -1) continue;
        (adj[u] || []).forEach(function (v) { if (dist[v] === undefined) { dist[v] = dist[u] + 1; queue.push(v); } });
      }
      Object.keys(dist).forEach(function (k) { keep[k] = true; });
    } else {
      Object.keys(degree).forEach(function (k) { keep[k] = true; });
    }

    var nodes = Object.keys(keep).filter(function (id) { return idx.entity[id]; }).map(function (id) {
      var e = idx.entity[id];
      return { id: id, type: e.type, name: e.name, degree: degree[id] || 0, hub: isHub(id), seed: seeds.indexOf(id) !== -1 };
    });
    edges = edges.filter(function (e) { return keep[e.source] && keep[e.target]; });
    nodes.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { nodes: nodes, edges: edges, hiddenWeak: hiddenWeak };
  };

  /* What changed in the live graph compared with a saved snapshot of the same bank. */
  CI.diffGraphs = function (live, snap) {
    var sn = {}, se = {};
    snap.nodes.forEach(function (n) { sn[n.id] = n; });
    snap.edges.forEach(function (e) { se[e.id] = e; });
    var out = { newNodes: {}, newEdges: {}, grownEdges: {} };
    live.nodes.forEach(function (n) { if (!sn[n.id]) out.newNodes[n.id] = true; });
    live.edges.forEach(function (e) {
      if (!se[e.id]) out.newEdges[e.id] = true;
      else if (e.weight > se[e.id].weight) out.grownEdges[e.id] = e.weight - se[e.id].weight;
    });
    return out;
  };

  /* How are A and B connected? Enumerates simple paths up to maxHops over the given graph. */
  CI.findPaths = function (graph, a, b, o) {
    o = o || {};
    var maxHops = o.maxHops || 4, limit = o.limit || 6, cap = 6000;
    var adj = {};
    graph.edges.forEach(function (e) {
      (adj[e.source] = adj[e.source] || []).push({ edge: e, to: e.target });
      (adj[e.target] = adj[e.target] || []).push({ edge: e, to: e.source });
    });
    var hub = {};
    graph.nodes.forEach(function (n) { hub[n.id] = n.hub; });
    var found = [], seen = {}, steps = [];
    seen[a] = true;
    (function dfs(u) {
      if (found.length >= cap) return;
      if (u === b) { found.push(steps.slice()); return; }
      if (steps.length >= maxHops) return;
      (adj[u] || []).forEach(function (n) {
        if (seen[n.to]) return;
        if (o.avoidHubs && n.to !== b && hub[n.to]) return;
        seen[n.to] = true;
        steps.push({ edge: n.edge, from: u, to: n.to });
        dfs(n.to);
        steps.pop();
        seen[n.to] = false;
      });
    })(a);
    var scored = found.map(function (p) {
      var ws = p.map(function (s) { return s.edge.weight; });
      return { steps: p, hops: p.length, minWeight: Math.min.apply(null, ws), sumWeight: ws.reduce(function (x, y) { return x + y; }, 0) };
    });
    scored.sort(function (x, y) { return x.hops - y.hops || y.minWeight - x.minWeight || y.sumWeight - x.sumWeight; });
    return scored.slice(0, limit);
  };

  /* ---------- export / import ---------- */
  CI.exportJson = function (d) { return JSON.stringify(d, null, 2); };
  CI.importJson = function (text) {
    var o = JSON.parse(text);
    if (!o || typeof o !== 'object' || !Array.isArray(o.entities) || !Array.isArray(o.reports) || !Array.isArray(o.links)) {
      throw new Error('This file does not look like a Cross-Index export.');
    }
    return CI.normalize(o);
  };

  CI.sha256 = function (text) {
    try {
      var subtle = root.crypto && root.crypto.subtle;
      if (!subtle || !root.TextEncoder) return Promise.resolve('');
      return subtle.digest('SHA-256', new root.TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return pad(b.toString(16), 2); }).join('');
      }).catch(function () { return ''; });
    } catch (e) { return Promise.resolve(''); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
