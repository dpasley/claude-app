/* Cross-Index core: data model, index, graph computation, merge/undo.
 * No DOM access here, so it runs in a browser and in Node (for tests). */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  var STORAGE_KEY = 'cross-index-data-v1';

  CI.ENTITY_TYPES = ['individual', 'group', 'subject', 'area'];
  CI.TYPE_LABEL = { individual: 'Individual', group: 'Group', subject: 'Subject', area: 'Area' };

  CI.DEFAULT_SETTINGS = {
    basisList: ['Fraud', 'Sabotage', 'Theft', 'Harassment of staff', 'Credible violence', 'Coordinated damaging activity'],
    sourceTypes: ['Social post', 'Financial document', 'Corporate document', 'FOIA record', 'Staff report', 'News / media', 'Investigator report', 'Other'],
    roles: ['author', 'named', 'subject', 'payer', 'recipient', 'present', 'other'],
    // Relationship types follow graph-database style: UPPER_SNAKE_CASE, read as "(from)-[:TYPE]->(to)".
    linkTypes: [
      { id: 'EMPLOYED_BY', label: 'EMPLOYED_BY', directed: true },
      { id: 'MEMBER_OF', label: 'MEMBER_OF', directed: true },
      { id: 'CONTROLS', label: 'CONTROLS', directed: true },
      { id: 'FUNDED', label: 'FUNDED', directed: true },
      { id: 'COMMUNICATED_WITH', label: 'COMMUNICATED_WITH', directed: false },
      { id: 'ASSOCIATED_WITH', label: 'ASSOCIATED_WITH', directed: false },
      { id: 'LOCATED_AT', label: 'LOCATED_AT', directed: true },
      { id: 'INVOLVED_IN', label: 'INVOLVED_IN', directed: true },
      { id: 'ACTED_AGAINST', label: 'ACTED_AGAINST', directed: true }
    ],
    heatWindowDays: 14,
    heatThreshold: 5,
    hubDegree: 8
  };

  /* Leads: an open question raised by a report, worked by one of the three areas. */
  CI.LEAD_KINDS = [
    { id: 'INVESTIGATION', label: 'Investigation', title: 'INVESTIGATION LEAD' },
    { id: 'DATA_REQUEST', label: 'Data request', title: 'DATA REQUEST' }
  ];
  CI.LEAD_WITH = ['Investigations', 'Collection', 'Estimates'];
  CI.LEAD_STATUS = [
    { id: 'NOT_STARTED', label: 'Not started' }, { id: 'IN_PROGRESS', label: 'In progress' },
    { id: 'DONE', label: 'Done' }, { id: 'NO_RESULT', label: 'Checked, nothing found' }
  ];
  CI.leadKind = function (id) { return CI.LEAD_KINDS.filter(function (k) { return k.id === id; })[0] || CI.LEAD_KINDS[0]; };
  CI.leadStatus = function (id) { return CI.LEAD_STATUS.filter(function (k) { return k.id === id; })[0] || CI.LEAD_STATUS[0]; };
  CI.isClosed = function (l) { return l.status === 'DONE' || l.status === 'NO_RESULT'; };

  var clone = CI.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };

  /* ---------- data container ---------- */
  CI.emptyData = function () {
    return {
      version: 1, started: false, sampleLoaded: false,
      settings: clone(CI.DEFAULT_SETTINGS),
      counters: { report: 0, entity: 0, link: 0, bank: 0, snag: 0, merge: 0, snapshot: 0, lead: 0, item: 0, investigation: 0, caseString: 0 },
      entities: [], reports: [], links: [], banks: [], leads: [], investigations: [], log: [], merges: [],
      ui: { bankId: null }
    };
  };


  /* Older saves used lower-case link names and wordier roles; convert them to the graph-style names. */
  var OLD_LINK = { employed_by: 'EMPLOYED_BY', member_of: 'MEMBER_OF', owns_controls: 'CONTROLS', funded: 'FUNDED', communicated_with: 'COMMUNICATED_WITH', known_associate: 'ASSOCIATED_WITH', based_at: 'LOCATED_AT', involved_in: 'INVOLVED_IN', acted_against: 'ACTED_AGAINST' };
  var OLD_ROLE = { 'author / poster': 'author', 'subject of report': 'subject', 'present at': 'present' };
  CI.toToken = function (s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''); };
  function migrate(d) {
    if ((d.schema || 1) < 2) {
      if (d.settings.sourceTypes.indexOf('Investigator report') === -1) {
        var oi = d.settings.sourceTypes.indexOf('Other');
        d.settings.sourceTypes.splice(oi === -1 ? d.settings.sourceTypes.length : oi, 0, 'Investigator report');
      }
      d.schema = 2;
    }
    if ((d.schema || 1) < 3) {
      // 'location' files are now called 'area'
      d.entities.forEach(function (e) { if (e.type === 'location') e.type = 'area'; });
      var fixT = function (a) { return a ? a.map(function (t) { return t === 'location' ? 'area' : t; }) : a; };
      d.banks.forEach(function (b) {
        b.entityTypes = fixT(b.entityTypes);
        b.snapshots.forEach(function (sn) { ((sn.graph && sn.graph.nodes) || []).forEach(function (n) { if (n.type === 'location') n.type = 'area'; }); });
      });
      d.schema = 3;
    }
    if ((d.schema || 1) < 4) {
      // sample data saved before case charts existed gets its case chart
      if (d.sampleLoaded && typeof CI.seedSampleCaseChart === 'function') CI.seedSampleCaseChart(d);
      d.schema = 4;
    }
    var nl = function (t) { return OLD_LINK[t] || t; };
    d.links.forEach(function (l) { l.type = nl(l.type); });
    d.settings.linkTypes.forEach(function (t) { if (OLD_LINK[t.id]) { t.id = OLD_LINK[t.id]; t.label = t.id; } });
    d.settings.roles = d.settings.roles.map(function (r) { return OLD_ROLE[r] || r; }).filter(function (r, i, a) { return a.indexOf(r) === i; });
    d.reports.forEach(function (r) { r.entities.forEach(function (x) { if (OLD_ROLE[x.role]) x.role = OLD_ROLE[x.role]; }); });
    d.banks.forEach(function (b) {
      if (b.linkTypes) b.linkTypes = b.linkTypes.map(nl);
      b.snapshots.forEach(function (sn) {
        (sn.graph && sn.graph.edges || []).forEach(function (e) {
          if (e.kind !== 'link') return;
          var t = nl(e.type); e.type = t; e.label = t; e.id = 'link|' + t + '|' + e.source + '|' + e.target;
        });
      });
    });
  }

  CI.normalize = function (d) {
    var e = CI.emptyData();
    d = d || {};
    ['entities', 'reports', 'links', 'banks', 'leads', 'investigations', 'log', 'merges'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = e[k]; });
    d.settings = Object.assign({}, e.settings, d.settings || {});
    ['basisList', 'sourceTypes', 'roles', 'linkTypes'].forEach(function (k) { if (!Array.isArray(d.settings[k]) || !d.settings[k].length) d.settings[k] = e.settings[k]; });
    d.counters = Object.assign({}, e.counters, d.counters || {});
    d.ui = Object.assign({}, e.ui, d.ui || {});
    d.version = 1;
    d.reports.forEach(function (r) { if (!Array.isArray(r.entities)) r.entities = []; });
    d.banks.forEach(function (b) {
      if (!b.positions || typeof b.positions !== 'object') b.positions = {};
      if (!b.estimate || !Array.isArray(b.estimate.items)) b.estimate = { summary: '', items: [], updated: '' };
      if (b.topN == null) b.topN = 0;
      if (b.handedOver == null) b.handedOver = '';
      if (!b.opened || typeof b.opened !== 'object') b.opened = { date: '', reason: '' };
      if (!Array.isArray(b.snapshots)) b.snapshots = []; if (!Array.isArray(b.seeds)) b.seeds = []; if (!Array.isArray(b.excluded)) b.excluded = []; });
    d.investigations.forEach(function (v) { CI.caseChartOf(v); });
    migrate(d);
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

  var PREFIX = { report: 'R-', entity: 'E-', link: 'K-', bank: 'B-', snag: 'S-', merge: 'M-', snapshot: 'N-', lead: 'L-', item: 'I-', investigation: 'V-', caseString: 'C-' };
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
    CI.caseChartDropReport(d, id);
  };

  CI.entityInUse = function (d, id) {
    var idx = CI.buildIndex(d);
    return (idx.reportsByEntity[id] || []).length + (idx.linksByEntity[id] || []).length > 0;
  };

  CI.deleteEntity = function (d, id) {
    if (CI.entityInUse(d, id)) return false;
    d.entities = d.entities.filter(function (e) { return e.id !== id; });
    CI.caseChartDropEntity(d, id);
    d.leads.forEach(function (l) { l.about = (l.about || []).filter(function (x) { return x !== id; }); });
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
    CI.caseChartMerge(d, fromId, intoId);
    d.leads.forEach(function (l) { l.about = (l.about || []).map(function (x) { return x === fromId ? intoId : x; }).filter(function (x, i, a) { return a.indexOf(x) === i; }); });
    d.entities.filter(function (e) { return e.id === fromId; }).forEach(function (e) { if (e.photo && !into.photo) into.photo = e.photo; });
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
      layout: 'cose', edgeLabels: true, topN: 0, positions: {}, handedOver: '', opened: { date: '', reason: '' },
      estimate: { summary: '', items: [], updated: '' }
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
    var trimmed = 0, topN = Number(bank.topN) || 0;
    if (topN > 0 && nodes.length > Math.max(topN, seeds.length)) {
      var stats = CI.materialStats(d, idx);
      var sc = function (n) { return stats[n.id] ? stats[n.id].score : 0; };
      nodes.sort(function (a, b) { return (b.seed - a.seed) || (sc(b) - sc(a)) || a.name.localeCompare(b.name); });
      var kept = {};
      nodes.slice(0, Math.max(topN, seeds.length)).forEach(function (n) { kept[n.id] = true; });
      trimmed = nodes.length - Object.keys(kept).length;
      nodes = nodes.filter(function (n) { return kept[n.id]; });
      edges = edges.filter(function (e) { return kept[e.source] && kept[e.target]; });
    }
    nodes.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { nodes: nodes, edges: edges, hiddenWeak: hiddenWeak, trimmed: trimmed };
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

  /* ---------- how heavy is each file, and how much of it matters ----------
   * reports  = independent reports the entity is listed in
   * material = independent reports in which the entity is part of a recorded connection
   * A file that is mostly passing mentions has many reports but few material ones.
   * score discounts high-connection nodes (a big bank or city ties to everything, so it says little). */
  CI.materialStats = function (d, idx) {
    idx = idx || CI.buildIndex(d);
    var out = {}, hubDeg = d.settings.hubDegree || 8;
    function get(id) { return out[id] || (out[id] = { reports: {}, material: {}, sources: {}, neighbors: {}, first: '', last: '' }); }
    d.reports.forEach(function (r) {
      var root = idx.rootOf(r.id), dt = CI.reportDate(r);
      r.entities.forEach(function (x) {
        var o = get(x.entityId); o.reports[root] = 1;
        if (dt) { if (!o.first || dt < o.first) o.first = dt; if (!o.last || dt > o.last) o.last = dt; }
      });
    });
    d.links.forEach(function (l) {
      var r = idx.report[l.reportId]; if (!r) return;
      var root = idx.rootOf(l.reportId), rr = idx.report[root] || r, src = CI.norm(rr.sourceRef || root);
      [[l.from, l.to], [l.to, l.from]].forEach(function (p) {
        var o = get(p[0]); o.material[root] = 1; o.sources[src] = 1; o.neighbors[p[1]] = 1;
      });
    });
    Object.keys(out).forEach(function (id) {
      var o = out[id];
      o.reports = Object.keys(o.reports).length; o.material = Object.keys(o.material).length;
      o.sources = Object.keys(o.sources).length; o.neighbors = Object.keys(o.neighbors).length;
      o.hub = o.neighbors >= hubDeg; o.score = o.material * (o.hub ? 0.5 : 1) + Math.min(o.sources, 5) / 100;
    });
    return out;
  };
  CI.statsFor = function (stats, id) { return stats[id] || { reports: 0, material: 0, sources: 0, neighbors: 0, hub: false, score: 0, first: '', last: '' }; };

  /* ---------- leads ---------- */
  CI.addLead = function (d, o) {
    var bank = d.banks.filter(function (b) { return b.id === o.bankId; })[0];
    if (!bank) return { error: 'Choose a bank.' };
    if (!CI.LEAD_KINDS.some(function (k) { return k.id === o.kind; })) return { error: 'Choose whether this is an investigation or a data request.' };
    if (CI.LEAD_WITH.indexOf(o.with) === -1) return { error: 'Choose who the lead is with.' };
    var q = String(o.question || '').trim();
    if (!q) return { error: 'Write the question.' };
    var r = d.reports.filter(function (x) { return x.id === o.raisedBy; })[0];
    if (!r) return { error: 'Choose the report that raised it.' };
    var lead = {
      id: CI.nextId(d, 'lead'), bankId: bank.id, kind: o.kind, with: o.with, question: q, raisedBy: r.id,
      about: (o.about || []).filter(function (x, i, a) { return a.indexOf(x) === i; }), issued: o.issued || CI.today(),
      status: 'NOT_STARTED', response: '', returnedBy: '', returnedDate: '', created: CI.today()
    };
    d.leads.push(lead);
    return { lead: lead };
  };
  CI.leadResults = function (d, id) { return d.reports.filter(function (r) { return r.leadId === id; }); };
  CI.deleteLead = function (d, id) {
    d.reports.forEach(function (r) { if (r.leadId === id) r.leadId = ''; });
    d.leads = d.leads.filter(function (l) { return l.id !== id; });
  };

  /* ---------- estimate and handover ---------- */
  CI.ESTIMATE_KINDS = [{ id: 'ESTABLISHED', label: 'Established' }, { id: 'HYPOTHESIS', label: 'Hypothesis' }];
  CI.addEstimateItem = function (d, bank, o) {
    if (!CI.ESTIMATE_KINDS.some(function (k) { return k.id === o.kind; })) return { error: 'Choose established or hypothesis.' };
    var text = String(o.text || '').trim();
    if (!text) return { error: 'Write the statement.' };
    var ids = String(o.reportIds || '').split(/[\s,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
    var bad = ids.filter(function (id) { return !d.reports.some(function (r) { return r.id === id; }); });
    if (bad.length) return { error: 'No such report: ' + bad.join(', ') + '.' };
    if (o.kind === 'ESTABLISHED' && !ids.length) return { error: 'An established statement must cite at least one report.' };
    var it = { id: CI.nextId(d, 'item'), kind: o.kind, text: text, reportIds: ids.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
    bank.estimate.items.push(it); bank.estimate.updated = CI.today();
    return { item: it };
  };
  /* ---------- investigations and handling plans ---------- */
  CI.INV_STATUS = [{ id: 'HANDED_OVER', label: 'Handed over' }, { id: 'INVESTIGATING', label: 'Investigating' }, { id: 'PLAN_WITH_LEGAL', label: 'Plan with legal' }, { id: 'EXECUTING', label: 'Executing plan' }, { id: 'CLOSED', label: 'Closed' }];
  CI.PLAN_OUTCOMES = [{ id: 'REFERRAL', label: 'Referral to law enforcement' }, { id: 'LEGAL', label: 'Legal response' }, { id: 'OTHER', label: 'Other' }];
  CI.LEGAL_STATUS = [{ id: 'NOT_SUBMITTED', label: 'Not submitted' }, { id: 'WITH_LEGAL', label: 'With legal' }, { id: 'CLEARED', label: 'Cleared' }, { id: 'CLEARED_WITH_CONDITIONS', label: 'Cleared with conditions' }, { id: 'RETURNED', label: 'Returned' }];
  CI.EXEC_STATUS = [{ id: 'NOT_STARTED', label: 'Not started' }, { id: 'EXECUTING', label: 'Executing' }, { id: 'DONE', label: 'Done' }];
  var pick = function (list, id) { return list.filter(function (x) { return x.id === id; })[0] || list[0]; };
  CI.invStatus = function (id) { return pick(CI.INV_STATUS, id); };
  CI.legalStatus = function (id) { return pick(CI.LEGAL_STATUS, id); };
  CI.execStatus = function (id) { return pick(CI.EXEC_STATUS, id); };
  CI.isCleared = function (plan) { return !!plan && (plan.legal.status === 'CLEARED' || plan.legal.status === 'CLEARED_WITH_CONDITIONS'); };
  CI.newPlan = function () {
    return { objective: '', outcome: 'REFERRAL', actions: [], preparedBy: '', updated: '', legal: { status: 'NOT_SUBMITTED', reviewer: '', date: '', comments: '' }, execution: { status: 'NOT_STARTED', outcome: '' } };
  };
  CI.investigationFor = function (d, bankId) { return d.investigations.filter(function (v) { return v.bankId === bankId; })[0] || null; };
  CI.handOver = function (d, bank) {
    var live = CI.computeGraph(d, bank, CI.buildIndex(d));
    var sn = { id: CI.nextId(d, 'snapshot'), label: 'Handover ' + CI.today(), at: new Date().toISOString(), graph: clone(live) };
    bank.snapshots.push(sn); bank.compareId = sn.id; bank.handedOver = CI.today();
    var inv = CI.investigationFor(d, bank.id);
    if (!inv) {
      inv = { id: CI.nextId(d, 'investigation'), bankId: bank.id, status: 'HANDED_OVER', investigator: '', opened: CI.today(), closed: '', notes: '', plan: CI.newPlan() };
      d.investigations.push(inv);
    }
    return sn;
  };
  /* Saves the plan fields; execution may only start once legal has cleared the whole plan. */
  CI.savePlan = function (d, inv, o) {
    var p = inv.plan;
    var actions = (o.actions || []).map(function (a) { return { text: String(a.text || '').trim(), owner: String(a.owner || '').trim() }; }).filter(function (a) { return a.text; });
    if (!pick(CI.LEGAL_STATUS, o.legalStatus) || !CI.LEGAL_STATUS.some(function (x) { return x.id === o.legalStatus; })) return { error: 'Choose a legal clearance status.' };
    if (!CI.EXEC_STATUS.some(function (x) { return x.id === o.execStatus; })) return { error: 'Choose an execution status.' };
    if (o.execStatus !== 'NOT_STARTED' && o.legalStatus !== 'CLEARED' && o.legalStatus !== 'CLEARED_WITH_CONDITIONS') return { error: 'The plan cannot be carried out until legal has cleared it.' };
    if (o.legalStatus !== 'NOT_SUBMITTED' && !actions.length) return { error: 'Add at least one action before sending the plan to legal.' };
    p.objective = String(o.objective || '').trim(); p.outcome = o.outcome || 'OTHER'; p.actions = actions; p.preparedBy = String(o.preparedBy || '').trim();
    p.legal = { status: o.legalStatus, reviewer: String(o.reviewer || '').trim(), date: o.legalDate || '', comments: String(o.comments || '').trim() };
    p.execution = { status: o.execStatus, outcome: String(o.execOutcome || '').trim() };
    p.updated = CI.today();
    return { plan: p };
  };

  /* ---------- case chart (the investigators' board) ---------- */
  /* Pins are files from the main files; strings are drawn by hand and every string must cite at least one report that names one of its ends. */
  CI.caseChartOf = function (inv) {
    if (!inv.caseChart || typeof inv.caseChart !== 'object') inv.caseChart = { pins: [], strings: [] };
    if (!Array.isArray(inv.caseChart.pins)) inv.caseChart.pins = [];
    if (!Array.isArray(inv.caseChart.strings)) inv.caseChart.strings = [];
    return inv.caseChart;
  };
  CI.addPin = function (d, inv, entityId, pos) {
    var cc = CI.caseChartOf(inv);
    if (!d.entities.some(function (e) { return e.id === entityId; })) return { error: 'That file does not exist.' };
    if (cc.pins.some(function (p) { return p.entityId === entityId; })) return { error: 'That file is already on the case chart.' };
    var n = cc.pins.length, p = { entityId: entityId, x: pos && isFinite(pos.x) ? pos.x : (n % 4) * 230, y: pos && isFinite(pos.y) ? pos.y : Math.floor(n / 4) * 200 };
    cc.pins.push(p);
    return { pin: p };
  };
  CI.removePin = function (d, inv, entityId) {
    var cc = CI.caseChartOf(inv);
    cc.pins = cc.pins.filter(function (p) { return p.entityId !== entityId; });
    cc.strings = cc.strings.filter(function (t) { return t.a !== entityId && t.b !== entityId; });
  };
  /* Reports that may back a string between a and b: those naming both come first, then those naming only one. */
  CI.reportsForString = function (d, a, b, idx) {
    idx = idx || CI.buildIndex(d);
    var ra = idx.reportsByEntity[a] || [], rb = idx.reportsByEntity[b] || [];
    var both = ra.filter(function (r) { return rb.indexOf(r) !== -1; }).sort();
    var one = ra.concat(rb).filter(function (r, i, arr) { return arr.indexOf(r) === i && both.indexOf(r) === -1; }).sort();
    return { both: both, one: one };
  };
  function checkString(d, inv, o, selfId) {
    var cc = CI.caseChartOf(inv), idx = CI.buildIndex(d);
    var has = function (id) { return cc.pins.some(function (p) { return p.entityId === id; }); };
    if (!o.a || !o.b || o.a === o.b) return { error: 'Choose two different files.' };
    if (!has(o.a) || !has(o.b)) return { error: 'Both files must be pinned to the case chart first.' };
    var ids = (o.reportIds || []).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
    if (!ids.length) return { error: 'A string must cite at least one report.' };
    for (var i = 0; i < ids.length; i++) {
      if (!idx.report[ids[i]]) return { error: 'There is no report ' + ids[i] + '.' };
      var named = (idx.reportsByEntity[o.a] || []).indexOf(ids[i]) !== -1 || (idx.reportsByEntity[o.b] || []).indexOf(ids[i]) !== -1;
      if (!named) return { error: ids[i] + ' does not name either file, so it cannot back this string.' };
    }
    var label = String(o.label || '').trim();
    var dup = cc.strings.some(function (t) { return t.id !== selfId && t.label.toLowerCase() === label.toLowerCase() && ((t.a === o.a && t.b === o.b) || (t.a === o.b && t.b === o.a)); });
    if (dup) return { error: 'These two files already have a string with that label.' };
    return { ok: { a: o.a, b: o.b, label: label, reportIds: ids } };
  }
  CI.addString = function (d, inv, o) {
    var c = checkString(d, inv, o, null); if (c.error) return c;
    var t = { id: CI.nextId(d, 'caseString'), a: c.ok.a, b: c.ok.b, label: c.ok.label, reportIds: c.ok.reportIds, added: CI.today() };
    CI.caseChartOf(inv).strings.push(t);
    return { string: t };
  };
  CI.updateString = function (d, inv, id, o) {
    var cc = CI.caseChartOf(inv), t = cc.strings.filter(function (x) { return x.id === id; })[0];
    if (!t) return { error: 'That string no longer exists.' };
    var c = checkString(d, inv, { a: t.a, b: t.b, label: o.label, reportIds: o.reportIds }, id); if (c.error) return c;
    t.label = c.ok.label; t.reportIds = c.ok.reportIds;
    return { string: t };
  };
  CI.removeString = function (d, inv, id) { var cc = CI.caseChartOf(inv); cc.strings = cc.strings.filter(function (t) { return t.id !== id; }); };
  /* The case chart as a graph the chart canvas can draw. Open leads of the investigation flag the files they are about. */
  CI.caseGraph = function (d, inv, idx) {
    idx = idx || CI.buildIndex(d);
    var cc = CI.caseChartOf(inv), nodes = [], edges = [], positions = {}, flags = { nodes: {}, edges: {} };
    var open = d.leads.filter(function (l) { return l.bankId === inv.bankId && !CI.isClosed(l); });
    cc.pins.forEach(function (p) {
      var e = idx.entity[p.entityId]; if (!e) return;
      var deg = cc.strings.filter(function (t) { return t.a === p.entityId || t.b === p.entityId; }).length;
      nodes.push({ id: e.id, name: e.name, type: e.type, degree: deg, seed: false, hub: false });
      positions[e.id] = { x: p.x, y: p.y };
      var ls = open.filter(function (l) { return (l.about || []).indexOf(e.id) !== -1; });
      if (ls.length) flags.nodes[e.id] = ls.map(function (l) { return l.id; });
    });
    var have = {}; nodes.forEach(function (n) { have[n.id] = 1; });
    cc.strings.forEach(function (t) {
      if (!have[t.a] || !have[t.b]) return;
      var roots = {}; t.reportIds.forEach(function (r) { roots[idx.rootOf(r)] = 1; });
      edges.push({ id: t.id, source: t.a, target: t.b, kind: 'string', label: t.label, weight: Object.keys(roots).length || 1, directed: false, reportIds: t.reportIds.slice() });
      var ls = open.filter(function (l) { return (l.about || []).indexOf(t.a) !== -1 && (l.about || []).indexOf(t.b) !== -1; });
      if (ls.length) flags.edges[t.id] = ls.map(function (l) { return l.id; });
    });
    return { graph: { nodes: nodes, edges: edges }, positions: positions, flags: flags, openLeads: open };
  };
  function caseChartsDo(d, fn) { d.investigations.forEach(function (v) { if (v.caseChart) fn(v.caseChart); }); }
  CI.caseChartDropReport = function (d, rid) {
    caseChartsDo(d, function (cc) {
      cc.strings.forEach(function (t) { t.reportIds = t.reportIds.filter(function (x) { return x !== rid; }); });
      cc.strings = cc.strings.filter(function (t) { return t.reportIds.length; });
    });
  };
  CI.caseChartDropEntity = function (d, id) { d.investigations.forEach(function (v) { if (v.caseChart) CI.removePin(d, v, id); }); };
  CI.caseChartMerge = function (d, fromId, intoId) {
    caseChartsDo(d, function (cc) {
      var had = cc.pins.some(function (p) { return p.entityId === intoId; });
      if (had) cc.pins = cc.pins.filter(function (p) { return p.entityId !== fromId; });
      else cc.pins.forEach(function (p) { if (p.entityId === fromId) p.entityId = intoId; });
      var seen = {};
      cc.strings.forEach(function (t) { if (t.a === fromId) t.a = intoId; if (t.b === fromId) t.b = intoId; });
      cc.strings = cc.strings.filter(function (t) {
        if (t.a === t.b) return false;
        var k = [t.a, t.b].sort().join('|') + '|' + t.label.toLowerCase();
        if (seen[k]) return false; seen[k] = 1; return true;
      });
    });
  };

  /* ---------- situation observation ---------- */
  /* What moved in the last `days` days compared with the same length of time before. Reposts count once. */
  CI.observe = function (d, days, idx) {
    idx = idx || CI.buildIndex(d);
    var cutNow = CI.daysAgo(days), cutPrev = CI.daysAgo(days * 2), seen = {}, items = [];
    function countFor(eid, from, to) {
      var roots = {};
      (idx.reportsByEntity[eid] || []).forEach(function (rid) {
        var r = idx.report[rid], t = r && (r.received || '');
        if (r && t >= from && (!to || t < to)) roots[idx.rootOf(rid)] = true;
      });
      return Object.keys(roots).length;
    }
    // links asserted by reports received in the window; a neighbour is "new" if it had no link before the window
    var before = {}, inWin = {}, nbr = function (m, a, b) { (m[a] = m[a] || {})[b] = true; (m[b] = m[b] || {})[a] = true; };
    d.links.forEach(function (l) {
      var r = idx.report[l.reportId], t = r && (r.received || ''); if (!r) return;
      if (t >= cutNow) nbr(inWin, l.from, l.to); else nbr(before, l.from, l.to);
    });
    d.entities.forEach(function (e) {
      var now = countFor(e.id, cutNow), prev = countFor(e.id, cutPrev, cutNow);
      var fresh = Object.keys(inWin[e.id] || {}).filter(function (n) { return !(before[e.id] && before[e.id][n]); });
      var why = [];
      if (now >= 2 && now > prev) why.push(now + ' independent reports in the last ' + days + ' days' + (prev ? ', up from ' + prev : ', none before'));
      if (fresh.length >= 2) why.push('linked to ' + fresh.length + ' files it was not linked to before');
      if (!why.length) return;
      var score = (now > prev ? now - prev : 0) * 2 + fresh.length;
      items.push({ kind: 'FILE', id: e.id, type: e.type, name: e.name, now: now, prev: prev, fresh: fresh.length, why: why, score: score });
    });
    items.sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name); });
    // clusters: files active in the window that are linked to each other by links made in the window
    var active = {}, parent = {};
    d.entities.forEach(function (e) { if (countFor(e.id, cutNow) >= 1 && inWin[e.id]) active[e.id] = true; });
    var find = function (x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    Object.keys(active).forEach(function (x) { parent[x] = x; });
    Object.keys(active).forEach(function (a) { Object.keys(inWin[a]).forEach(function (b) { if (active[b]) parent[find(a)] = find(b); }); });
    var groups = {};
    Object.keys(active).forEach(function (x) { (groups[find(x)] = groups[find(x)] || []).push(x); });
    var clusters = Object.keys(groups).map(function (k) { return groups[k]; }).filter(function (g) { return g.length >= 3; }).map(function (g) {
      return { kind: 'CLUSTER', ids: g, names: g.map(function (id) { return idx.entity[id].name; }), score: g.length };
    }).sort(function (a, b) { return b.score - a.score; });
    return { files: items, clusters: clusters, days: days };
  };

  CI.fmtDate = function (iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso || '';
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
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
