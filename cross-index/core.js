/* Cross-Index core: data model, index, graph computation, merge/undo.
 * No DOM access here, so it runs in a browser and in Node (for tests). */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  var STORAGE_KEY = 'cross-index-data-v1';

  // The four kinds of main file, plus items (a plate, phone, email, account...). An item has no folder:
  // it is an index entry that reports and connections point to.
  CI.FILE_TYPES = ['individual', 'group', 'area', 'subject'];
  CI.ENTITY_TYPES = CI.FILE_TYPES;   // items (plates, phones...) are no longer recorded; older saves that hold them still open
  CI.TYPE_LABEL = { individual: 'Individual', group: 'Group', subject: 'Subject', area: 'Area', item: 'Item' };
  CI.isItem = function (e) { return !!e && e.type === 'item'; };

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

  /* Plain-language connection types for staff. Each reads as a sentence: "A [label] B".
   * The stored id is the label in UPPER_SNAKE_CASE (Neo4j style). Any pair of file or item types is allowed;
   * the note on the connection says what kind. Added once to every data set by CI.addSuggestedLinkTypes. */
  CI.SUGGESTED_LINK_TYPES = [
    { group: 'People', label: 'Spoke with', directed: false },
    { group: 'People', label: 'Interviewed', directed: true },
    { group: 'People', label: 'Knows', directed: false },
    { group: 'People', label: 'Family of', directed: false },
    { group: 'People', label: 'Lives with', directed: false },
    { group: 'Work', label: 'Works for', directed: true },
    { group: 'Work', label: 'Works with', directed: false },
    { group: 'Work', label: 'Supervises', directed: true },
    { group: 'Social media', label: 'Administers', directed: true },
    { group: 'Social media', label: 'Posts on', directed: true },
    { group: 'Social media', label: 'Follows or supports', directed: true },
    { group: 'Social media', label: 'Shares or amplifies', directed: true },
    { group: 'Social media', label: 'Mentions or tags', directed: true },
    { group: 'Social media', label: 'Replies to', directed: true },
    { group: 'Social media', label: 'Republishes content of', directed: true },
    { group: 'Media', label: 'Hosts', directed: true },
    { group: 'Media', label: 'Appeared on', directed: true },
    { group: 'Groups', label: 'Member of', directed: true },
    { group: 'Groups', label: 'Linked with', directed: false },
    { group: 'Groups', label: 'Part of', directed: true },
    { group: 'Corporate', label: 'Owns', directed: true },
    { group: 'Corporate', label: 'Officer of', directed: true },
    { group: 'Corporate', label: 'Registered at', directed: true },
    { group: 'Corporate', label: 'Agent for', directed: true },
    { group: 'Finance', label: 'Pays', directed: true },
    { group: 'Finance', label: 'Lends to', directed: true },
    { group: 'Finance', label: 'Funds', directed: true },
    { group: 'Property and items', label: 'Rents', directed: true },
    { group: 'Property and items', label: 'Uses', directed: true },
    { group: 'Property and items', label: 'Registered with', directed: true },
    { group: 'Property and items', label: 'Contacts', directed: true },
    { group: 'Places', label: 'Lives in', directed: true },
    { group: 'Places', label: 'Based in', directed: true },
    { group: 'Places', label: 'Active in', directed: true },
    { group: 'Places', label: 'Seen at', directed: true },
    { group: 'Places', label: 'Within', directed: true },
    { group: 'Subjects and crime', label: 'Involved in', directed: true },
    { group: 'Subjects and crime', label: 'Suspected in', directed: true },
    { group: 'Subjects and crime', label: 'Charged in', directed: true },
    { group: 'Subjects and crime', label: 'Convicted in', directed: true },
    { group: 'Subjects and crime', label: 'Victim of', directed: true },
    { group: 'Subjects and crime', label: 'Witness to', directed: true },
    { group: 'Subjects and crime', label: 'Co-offender with', directed: false },
    { group: 'Subjects and crime', label: 'Supplies', directed: true },
    { group: 'Subjects and crime', label: 'Used in', directed: true },
    { group: 'Subjects and crime', label: 'Occurs in', directed: true },
    { group: 'Subjects and crime', label: 'Related to', directed: false },
    { group: 'General', label: 'Connected to', directed: false }
  ];
  /* The Social media section of the connection picker, strongest to weakest. Member of is the ordinary MEMBER_OF type, listed here as well as under Groups. */
  CI.SOCIAL_TYPES = [
    { id: 'ADMINISTERS', hint: 'Runs a page, group or channel' },
    { id: 'POSTS_ON', hint: 'Contributes content to it' },
    { id: 'FOLLOWS_OR_SUPPORTS', hint: 'Weakest. The default for ordinary supporters' },
    { id: 'MEMBER_OF', hint: 'Joined a closed or private group' },
    { id: 'SHARES_OR_AMPLIFIES', hint: 'Reposts or promotes someone\u2019s content' },
    { id: 'MENTIONS_OR_TAGS', hint: 'Refers to a name in a post' },
    { id: 'REPLIES_TO', hint: 'Direct back-and-forth' },
    { id: 'REPUBLISHES_CONTENT_OF', hint: 'A page posts content that began with someone else, e.g. a podcast clip. From the page\u2019s group to the person; no sign they know or approve' }
  ];
  CI.socialHint = function (id) { var t = CI.SOCIAL_TYPES.filter(function (x) { return x.id === id; })[0]; return t ? t.hint : ''; };
  /* A note is required only for Connected to; for every other type, including the social media types, it is optional. */
  CI.noteRequired = function (id) { return id === 'CONNECTED_TO'; };
  /* Adds any suggested type that is not already there, ahead of the older names. Returns how many were added. */
  CI.addSuggestedLinkTypes = function (d) {
    var have = {}; d.settings.linkTypes.forEach(function (t) { have[t.id] = t; });
    var add = [];
    CI.SUGGESTED_LINK_TYPES.forEach(function (s) {
      var id = CI.toToken(s.label);
      if (have[id]) {
        // An older default with the same id (MEMBER_OF, INVOLVED_IN) takes the plain label unless someone already renamed it.
        if (have[id].label === have[id].id) { have[id].label = s.label; have[id].group = s.group; }
        return;
      }
      have[id] = true; add.push({ id: id, label: s.label, directed: s.directed, group: s.group });
    });
    d.settings.linkTypes.forEach(function (t) { if (!t.group) t.group = 'Older names'; });
    d.settings.linkTypes = add.concat(d.settings.linkTypes);
    return add.length;
  };

  /* Leads: an open question raised by a report, worked by one of the three areas. */
  CI.LEAD_KINDS = [
    { id: 'INVESTIGATION', label: 'Investigation', title: 'INVESTIGATION LEAD' },
    { id: 'DATA_REQUEST', label: 'Request', title: 'REQUEST TO COLLECTION' }
  ];
  CI.LEAD_WITH = ['Investigations', 'Collection', 'Estimates'];
  CI.isRequest = function (l) { return l && l.kind === 'DATA_REQUEST'; };
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
      version: 1, schema: 8, started: false, sampleLoaded: false,
      settings: clone(CI.DEFAULT_SETTINGS),
      counters: { report: 0, entity: 0, link: 0, bank: 0, snag: 0, merge: 0, snapshot: 0, lead: 0, item: 0, investigation: 0, caseString: 0, caseNote: 0, summary: 0, timeline: 0, request: 0 },
      entities: [], reports: [], links: [], banks: [], leads: [], investigations: [], log: [], merges: [], summaries: [], timeline: [], requests: [],
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
    if ((d.schema || 1) < 5) {
      // sample data saved before case charts (or their labels) existed gets them
      if (d.sampleLoaded && typeof CI.seedSampleCaseChart === 'function') CI.seedSampleCaseChart(d);
      d.schema = 5;
    }
    if ((d.schema || 1) < 6) {
      // Leads belong to an investigation; requests to Collection are kept apart from leads.
      var inv0 = function (bankId) { return (d.investigations || []).filter(function (v) { return v.bankId === bankId; })[0]; };
      var keep = [], remap = {};
      (d.leads || []).forEach(function (l) {
        if (l.kind === 'DATA_REQUEST') {
          var nid = CI.nextId(d, 'request'); remap[l.id] = nid; l.id = nid; delete l.forLead; (d.requests = d.requests || []).push(l);
        } else keep.push(l);
      });
      d.leads = keep;
      (d.reports || []).forEach(function (r) { if (r.leadId && remap[r.leadId]) r.leadId = remap[r.leadId]; });
      (d.leads || []).concat(d.requests || []).forEach(function (l) { var v = inv0(l.bankId); l.investigationId = v ? v.id : ''; if (l.assigned == null) l.assigned = ''; });
      d.schema = 6;
    }
    if ((d.schema || 1) < 7) {
      // Handling plans are written in Word outside the app: keep only the name and location of the file; status is active or closed.
      (d.investigations || []).forEach(function (v) {
        v.status = v.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE'; delete v.plan;
        if (v.title == null) v.title = ''; if (v.reason == null) v.reason = ''; if (!v.planFile) v.planFile = { name: '', location: '' };
      });
      d.schema = 7;
    }
    if ((d.schema || 1) < 8) {
      // A lead may belong to no investigation; every lead remembers where it was raised from.
      (d.leads || []).concat(d.requests || []).forEach(function (l) { if (!l.origin) l.origin = l.investigationId ? { kind: 'investigation', id: l.investigationId } : (l.raisedBy ? { kind: 'report', id: l.raisedBy } : { kind: 'register', id: '' }); });
      d.schema = 8;
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
    ['entities', 'reports', 'links', 'banks', 'leads', 'investigations', 'log', 'merges', 'summaries', 'timeline', 'requests'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = e[k]; });
    d.settings = Object.assign({}, e.settings, d.settings || {});
    ['basisList', 'sourceTypes', 'roles', 'linkTypes'].forEach(function (k) { if (!Array.isArray(d.settings[k]) || !d.settings[k].length) d.settings[k] = e.settings[k]; });
    d.counters = Object.assign({}, e.counters, d.counters || {});
    d.ui = Object.assign({}, e.ui, d.ui || {});
    d.version = 1;
    d.reports.forEach(function (r) { if (!Array.isArray(r.entities)) r.entities = []; });
    d.entities.forEach(function (x) { if (!x.profile || typeof x.profile !== 'object') x.profile = {}; });
    d.summaries.forEach(function (x) { if (!Array.isArray(x.covers)) x.covers = []; });
    d.timeline.forEach(function (x) { if (!Array.isArray(x.reportIds)) x.reportIds = []; if (!x.level) x.level = 2; });
    d.banks.forEach(function (b) {
      if (!b.positions || typeof b.positions !== 'object') b.positions = {};
      if (!Array.isArray(b.estimates)) {
        var old = b.estimate && Array.isArray(b.estimate.items) ? b.estimate : { summary: '', items: [], updated: '' };
        b.estimates = [{ id: 'EST-1', label: 'Estimate 1', created: (b.opened && b.opened.date) || '', summary: old.summary || '', items: old.items, updated: old.updated || '' }];
      }
      delete b.estimate;
      b.estimates.forEach(function (x) { if (!Array.isArray(x.items)) x.items = []; });
      if (b.topN == null) b.topN = 0;
      if (b.outcome === undefined) b.outcome = null;
      CI.ensureCharts(b);
      if (!b.quick && (!b.seen || typeof b.seen !== 'object')) b.seen = { report: d.counters.report || 0, link: d.counters.link || 0 };
      if (b.handedOver == null) b.handedOver = '';
      if (!b.opened || typeof b.opened !== 'object') b.opened = { date: '', reason: '' };
      if (!Array.isArray(b.snapshots)) b.snapshots = []; if (!Array.isArray(b.seeds)) b.seeds = []; if (!Array.isArray(b.excluded)) b.excluded = []; });
    d.investigations.forEach(function (v) { CI.caseChartOf(v); if (!Array.isArray(v.files)) v.files = []; });
    migrate(d);
    d.entities.forEach(CI.fillNames);
    // Special banks hold a chosen list of main files. Older banks get the names their chart showed.
    d.banks.forEach(function (b) {
      if (b.quick || Array.isArray(b.files)) return;
      b.files = CI.computeGraph(d, b).nodes.map(function (n) { return n.id; });
    });
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

  var PREFIX = { report: 'R-', entity: 'E-', link: 'K-', bank: 'B-', snag: 'S-', merge: 'M-', snapshot: 'N-', lead: 'L-', item: 'I-', investigation: 'V-', caseString: 'C-', caseNote: 'W-', summary: 'SM-', timeline: 'T-', request: 'Q-' };
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
    // The paper form has a date, a subject and a source. Everything else on the report is optional.
    var p = [];
    if (!r.received) p.push('Date of report is required.');
    if (!String(r.subject || '').trim()) p.push('Subject of report is required.');
    if (!String(r.sourceRef || '').trim()) p.push('Source of report is required (a name, URL, handle or document title).');
    return p;
  };

  /* ---------- individuals: one name to look up, stored as given name and family name ---------- */
  var PARTICLES = /^(van|von|der|den|de|del|della|di|da|do|dos|du|la|le|bin|ibn|al|el|st\.?|ter|ten)$/i, SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v|phd|md)$/i;
  /* "John Q. Smith" -> given John, middle Q., family Smith. Two words: given and family. One word: family only.
     "Smith, John Quincy" -> family Smith, given John, middle Quincy. Particles (van, de la, bin…) and suffixes (Jr, III) stay with the family name. */
  CI.splitName = function (full) {
    var s = String(full || '').replace(/\s+/g, ' ').trim();
    if (!s) return { given: '', middle: '', family: '' };
    var c = s.indexOf(',');
    if (c > 0) {
      var rest = s.slice(c + 1).trim().split(' ').filter(Boolean);
      return { given: rest[0] || '', middle: rest.slice(1).join(' '), family: s.slice(0, c).trim() };
    }
    var w = s.split(' ');
    if (w.length === 1) return { given: '', middle: '', family: w[0] };
    var i = w.length - 1;
    while (i > 1 && SUFFIX.test(w[i])) i--;
    while (i > 1 && PARTICLES.test(w[i - 1])) i--;
    return { given: w[0], middle: w.slice(1, i).join(' '), family: w.slice(i).join(' ') };
  };
  CI.joinName = function (given, family, middle) { return [given, middle, family].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' '); };
  /* Fills given, middle and family on an individual that has none, and keeps them in step with the name. */
  CI.fillNames = function (e) {
    if (e.type !== 'individual') { delete e.given; delete e.middle; delete e.family; return; }
    if (typeof e.given !== 'string' && typeof e.family !== 'string') { var p = CI.splitName(e.name); e.given = p.given; e.middle = p.middle; e.family = p.family; }
    else if (typeof e.middle !== 'string') {
      // Names stored before the middle-name field: a given name of several words becomes given plus middle.
      var g = String(e.given || '').trim().split(' ').filter(Boolean);
      e.given = g[0] || ''; e.middle = g.slice(1).join(' ');
    }
  };
  CI.sortKey = function (e) { return e.type === 'individual' && (e.family || e.given) ? CI.norm((e.family || '') + ' ' + (e.given || '') + ' ' + (e.middle || '')) : CI.norm(e.name); };

  /* ---------- mutations ---------- */
  CI.addEntity = function (d, o) {
    if (o.type === 'individual' && (o.given || o.family)) o.name = CI.joinName(o.given, o.family, o.middle);
    var e = {
      id: CI.nextId(d, 'entity'),
      type: o.type,
      name: String(o.name || '').trim(),
      aliases: (o.aliases || []).map(function (s) { return String(s).trim(); }).filter(Boolean),
      notes: o.notes || '',
      details: String(o.details || '').trim(),
      profile: {},
      created: CI.today()
    };
    if (o.type === 'item') e.itemType = String(o.itemType || '').trim();
    if (o.type === 'individual') { var sp = (o.given || o.family) ? { given: String(o.given || '').trim(), middle: String(o.middle || '').trim(), family: String(o.family || '').trim() } : CI.splitName(e.name); e.given = sp.given; e.middle = sp.middle; e.family = sp.family; }
    d.entities.push(e);
    return e;
  };

  /* ----- the folder being worked on: a physical file whose reports are being entered ----- */
  /* ----- backup record: when the data was last saved to a file, and how many saves since ----- */
  CI.markBackup = function (d) { d.ui = d.ui || {}; d.ui.lastBackup = new Date().toISOString(); d.ui.changes = 0; d.ui.snooze = 0; };
  CI.backupState = function (d, now) {
    var u = d.ui || {}, n = u.changes || 0, has = d.reports.length + d.entities.length > 0;
    var days = u.lastBackup ? Math.floor(((now || Date.now()) - Date.parse(u.lastBackup)) / 86400000) : null;
    var due = has && n > (u.snooze || 0) && ((days === null && n >= 10) || n >= 25 || (days !== null && days >= 7));
    return { changes: n, last: u.lastBackup || '', days: days, due: due };
  };
  CI.folderOf = function (d, finished) {
    var f = d.ui && (finished ? d.ui.finished : d.ui.folder); if (!f) return null;
    var e = d.entities.filter(function (x) { return x.id === f.entityId; })[0];
    return e ? { entity: e, reports: (f.reports || []).filter(function (id) { return d.reports.some(function (r) { return r.id === id; }); }), since: f.since } : null;
  };
  CI.openFolder = function (d, entityId) {
    if (!d.entities.some(function (x) { return x.id === entityId; })) return 'No such file.';
    d.ui = d.ui || {}; d.ui.folder = { entityId: entityId, reports: [], since: CI.today() }; d.ui.finished = null; return null;
  };
  CI.closeFolder = function (d) { if (d.ui) d.ui.folder = null; };
  /* Finishing a folder puts it away and keeps its summary to look at and print from, until the next folder is started. */
  CI.finishFolder = function (d) { if (!d.ui || !d.ui.folder) return; d.ui.finished = d.ui.folder; d.ui.folder = null; };
  /* A new report from this folder: the folder's name is put on it and the report is counted. */
  CI.folderAdd = function (d, reportId) {
    var f = d.ui && d.ui.folder; if (!f) return;
    if (f.reports.indexOf(reportId) === -1) f.reports.push(reportId);
    CI.addEntityToReport(d, reportId, f.entityId, '', false, '');
  };
  /* What was entered from this folder, and the leads still open that come out of it. */
  CI.folderSummary = function (d) {
    var fo = CI.folderOf(d) || CI.folderOf(d, true); if (!fo) return null;
    var ids = {}; fo.reports.forEach(function (id) { ids[id] = 1; });
    var reports = d.reports.filter(function (r) { return ids[r.id]; }), names = {};
    reports.forEach(function (r) { r.entities.forEach(function (x) { names[x.entityId] = (names[x.entityId] || 0) + 1; }); });
    delete names[fo.entity.id];
    var links = d.links.filter(function (l) { return ids[l.reportId]; });
    var leads = d.leads.concat(d.requests).filter(function (l) {
      return !CI.isClosed(l) && ((l.raisedBy && ids[l.raisedBy]) || (l.origin && ((l.origin.kind === 'report' && ids[l.origin.id]) || (l.origin.kind === 'file' && l.origin.id === fo.entity.id))) || (l.about || []).indexOf(fo.entity.id) !== -1);
    });
    return { entity: fo.entity, since: fo.since, reports: reports, names: Object.keys(names).map(function (id) { return { id: id, n: names[id] }; }), links: links, leads: leads };
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

  /* Change a connection in place. Same checks as adding, ignoring the link being edited. */
  CI.updateLink = function (d, id, o) {
    var l = d.links.filter(function (x) { return x.id === id; })[0];
    if (!l) return { error: 'Connection not found.' };
    var r = d.reports.filter(function (x) { return x.id === l.reportId; })[0];
    if (!o.from || !o.to) return { error: 'Choose both entities.' };
    if (o.from === o.to) return { error: 'A connection needs two different entities.' };
    var has = function (e) { return r && r.entities.some(function (x) { return x.entityId === e; }); };
    if (!has(o.from) || !has(o.to)) return { error: 'Both entities must be listed in this report first.' };
    var lt = d.settings.linkTypes.filter(function (t) { return t.id === o.type; })[0];
    if (!lt) return { error: 'Choose a connection type.' };
    var dup = d.links.some(function (x) {
      if (x.id === id || x.reportId !== l.reportId || x.type !== o.type) return false;
      if (x.from === o.from && x.to === o.to) return true;
      return !lt.directed && x.from === o.to && x.to === o.from;
    });
    if (dup) return { error: 'This report already asserts that connection.' };
    l.from = o.from; l.to = o.to; l.type = o.type; l.note = o.note || '';
    return { link: l };
  };

  CI.deleteReport = function (d, id) {
    var r = d.reports.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    d.links = d.links.filter(function (l) { return l.reportId !== id; });
    d.reports.forEach(function (x) { if (x.dupOf === id) x.dupOf = r.dupOf || ''; });
    d.reports = d.reports.filter(function (x) { return x.id !== id; });
    CI.caseChartDropReport(d, id);
    d.summaries.forEach(function (x) { x.covers = (x.covers || []).filter(function (r) { return r !== id; }); });
    d.timeline.forEach(function (x) { x.reportIds = (x.reportIds || []).filter(function (r) { return r !== id; }); });
  };


  /* ---------- profile: the fields a modern profile carries for each kind of file ---------- */
  CI.PROFILE_FIELDS = {
    individual: [
      { id: 'dob', label: 'Date of birth', kind: 'date' }, { id: 'pob', label: 'Place of birth', kind: 'text' },
      { id: 'gender', label: 'Gender', kind: 'text' }, { id: 'nationality', label: 'Nationality', kind: 'text' },
      { id: 'languages', label: 'Languages', kind: 'text' }, { id: 'occupation', label: 'Occupation', kind: 'text' },
      { id: 'employer', label: 'Employer or organization', kind: 'text' }, { id: 'residence', label: 'Where based', kind: 'text', hint: 'city or region' },
      { id: 'description', label: 'Physical description', kind: 'long' }, { id: 'role', label: 'Role in the matters we follow', kind: 'long' },
      { id: 'status', label: 'Status', kind: 'select', options: ['Active', 'Dormant', 'Deceased', 'Unknown'] }
    ],
    group: [
      { id: 'kind', label: 'Kind of group', kind: 'text', hint: 'company, movement, club, network…' }, { id: 'founded', label: 'Founded', kind: 'date' },
      { id: 'status', label: 'Status', kind: 'select', options: ['Active', 'Dormant', 'Disbanded', 'Unknown'] }, { id: 'hq', label: 'Headquarters', kind: 'text', hint: 'city or region' },
      { id: 'operates', label: 'Where it operates', kind: 'text' }, { id: 'leadership', label: 'Leadership', kind: 'text' },
      { id: 'size', label: 'Approximate size', kind: 'text' }, { id: 'purpose', label: 'Stated purpose', kind: 'long' },
      { id: 'affiliations', label: 'Affiliations', kind: 'text' }, { id: 'role', label: 'Role in the matters we follow', kind: 'long' }
    ],
    area: [
      { id: 'kind', label: 'Kind of area', kind: 'select', options: ['City', 'Region', 'Campus', 'Neighbourhood', 'Country', 'Other'] },
      { id: 'within', label: 'Within', kind: 'text', hint: 'the region or country it sits in' }, { id: 'authority', label: 'Authority or jurisdiction', kind: 'text' },
      { id: 'population', label: 'Approximate population', kind: 'text' }, { id: 'sites', label: 'Notable sites', kind: 'long' },
      { id: 'role', label: 'Why it matters to us', kind: 'long' }
    ],
    subject: [
      { id: 'category', label: 'Category', kind: 'text', hint: 'a theme, an event, a trend, a product…' }, { id: 'first', label: 'First noticed', kind: 'date' },
      { id: 'status', label: 'Status', kind: 'select', options: ['Open', 'Watching', 'Closed'] }, { id: 'description', label: 'Description', kind: 'long' },
      { id: 'role', label: 'Why it matters to us', kind: 'long' }
    ]
  };
  CI.profileFields = function (type) { return CI.PROFILE_FIELDS[type] || []; };

  /* ---------- file summaries: written by staff, covering only what is new since the last one ---------- */
  CI.summariesFor = function (d, fileId) {
    return d.summaries.filter(function (x) { return x.fileId === fileId; }).sort(function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  };
  CI.reportsOf = function (idx, fileId) {
    return (idx.reportsByEntity[fileId] || []).slice().sort(function (a, b) {
      var ra = idx.report[a], rb = idx.report[b];
      return (ra.received || '').localeCompare(rb.received || '') || a.localeCompare(b);
    });
  };
  /* Reports in the file that no summary of this file has covered yet, oldest first. */
  CI.unsummarized = function (d, idx, fileId) {
    var done = {}; CI.summariesFor(d, fileId).forEach(function (x) { (x.covers || []).forEach(function (r) { done[r] = 1; }); });
    return CI.reportsOf(idx, fileId).filter(function (r) { return !done[r]; });
  };
  function cleanSummary(d, o) {
    var text = String(o.text || '').trim(), date = String(o.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Give the date of the summary.' };
    if (!text) return { error: 'Write the summary.' };
    var covers = (o.covers || []).filter(function (r, i, a) { return a.indexOf(r) === i && d.reports.some(function (x) { return x.id === r; }); });
    return { v: { date: date, author: String(o.author || '').trim(), text: text, covers: covers } };
  }
  CI.addSummary = function (d, o) {
    if (!d.entities.some(function (e) { return e.id === o.fileId; })) return { error: 'No such file.' };
    var c = cleanSummary(d, o); if (c.error) return c;
    var s = Object.assign({ id: CI.nextId(d, 'summary'), fileId: o.fileId, created: CI.today() }, c.v);
    d.summaries.push(s); return { summary: s };
  };
  CI.updateSummary = function (d, id, o) {
    var s = d.summaries.filter(function (x) { return x.id === id; })[0]; if (!s) return { error: 'No such summary.' };
    var c = cleanSummary(d, o); if (c.error) return c;
    Object.assign(s, c.v); return { summary: s };
  };
  CI.deleteSummary = function (d, id) { d.summaries = d.summaries.filter(function (x) { return x.id !== id; }); };

  /* ---------- time line: dated entries typed by staff, against the date the event happened ---------- */
  CI.TL_LEVELS = [{ id: 1, label: 'Key event' }, { id: 2, label: 'Standard' }, { id: 3, label: 'Fine detail' }];
  CI.timelineFor = function (d, fileId, maxLevel, from, to) {
    return d.timeline.filter(function (x) {
      return x.fileId === fileId && x.level <= (maxLevel || 3) && (!from || x.date >= from) && (!to || x.date <= to);
    }).sort(function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  };
  /* The entries of several files together, in date order (an entry belongs to one file). */
  CI.timelineMany = function (d, fileIds, maxLevel, from, to) {
    var out = []; fileIds.forEach(function (f) { out = out.concat(CI.timelineFor(d, f, maxLevel, from, to)); });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  };
  function cleanTimeline(d, o) {
    var date = String(o.date || ''), text = String(o.text || '').trim(), level = Number(o.level) || 2;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Give the date the event happened.' };
    if (!text) return { error: 'Write what happened.' };
    var ids = (Array.isArray(o.reportIds) ? o.reportIds : String(o.reportIds || '').split(/[\s,;]+/)).map(function (s) { return String(s).trim().toUpperCase(); }).filter(Boolean);
    var bad = ids.filter(function (r) { return !d.reports.some(function (x) { return x.id === r; }); });
    if (bad.length) return { error: 'No such report: ' + bad.join(', ') + '.' };
    return { v: { date: date, text: text, level: Math.min(3, Math.max(1, level)), reportIds: ids.filter(function (r, i, a) { return a.indexOf(r) === i; }) } };
  }
  CI.addTimeline = function (d, o) {
    if (!d.entities.some(function (e) { return e.id === o.fileId; })) return { error: 'No such file.' };
    var c = cleanTimeline(d, o); if (c.error) return c;
    var t = Object.assign({ id: CI.nextId(d, 'timeline'), fileId: o.fileId }, c.v);
    d.timeline.push(t); return { entry: t };
  };
  CI.updateTimeline = function (d, id, o) {
    var t = d.timeline.filter(function (x) { return x.id === id; })[0]; if (!t) return { error: 'No such entry.' };
    var c = cleanTimeline(d, o); if (c.error) return c;
    Object.assign(t, c.v); return { entry: t };
  };
  CI.deleteTimeline = function (d, id) { d.timeline = d.timeline.filter(function (x) { return x.id !== id; }); };

  CI.entityInUse = function (d, id) {
    var idx = CI.buildIndex(d);
    return (idx.reportsByEntity[id] || []).length + (idx.linksByEntity[id] || []).length + d.summaries.filter(function (x) { return x.fileId === id; }).length + d.timeline.filter(function (x) { return x.fileId === id; }).length > 0;
  };

  CI.deleteEntity = function (d, id) {
    if (CI.entityInUse(d, id)) return false;
    d.entities = d.entities.filter(function (e) { return e.id !== id; });
    CI.caseChartDropEntity(d, id);
    d.investigations.forEach(function (v) { v.files = (v.files || []).filter(function (x) { return x !== id; }); });
    d.leads.concat(d.requests).forEach(function (l) { l.about = (l.about || []).filter(function (x) { return x !== id; }); if (l.origin && l.origin.kind === 'file' && l.origin.id === id) l.origin = { kind: 'register', id: '' }; });
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
    ['folder', 'finished'].forEach(function (k) { if (d.ui && d.ui[k] && d.ui[k].entityId === fromId) d[ 'ui' ][k].entityId = intoId; });
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
    d.summaries.forEach(function (x) { if (x.fileId === fromId) x.fileId = intoId; });
    d.timeline.forEach(function (x) { if (x.fileId === fromId) x.fileId = intoId; });
    d.leads.concat(d.requests).forEach(function (l) { if (l.origin && l.origin.kind === 'file' && l.origin.id === fromId) l.origin.id = intoId; l.about = (l.about || []).map(function (x) { return x === fromId ? intoId : x; }).filter(function (x, i, a) { return a.indexOf(x) === i; }); });
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
      layout: 'cose', edgeLabels: 'auto', topN: 0, positions: {}, handedOver: '', opened: { date: '', reason: '' }, files: null, outcome: null, seen: { report: d.counters.report || 0, link: d.counters.link || 0 },
      estimates: [{ id: 'EST-1', label: 'Estimate 1', created: '', summary: '', items: [], updated: '' }],
      charts: [{ id: 'CH-1', name: 'Chart', state: null }], chartId: 'CH-1', chartSeq: 1
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
    if (Array.isArray(bank.files)) {
      bank.files.forEach(function (id) { if (entOk(id)) keep[id] = true; });
    } else if (seeds.length) {
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
  /* A lead (a question the investigators follow up) or a request (a thing for Collection to retrieve and preserve) belongs to an investigation.
   * A lead needs only its reason; the report that prompted it is optional. */
  CI.addLead = function (d, o) {
    var invId = String(o.investigationId || ''), inv = invId ? d.investigations.filter(function (v) { return v.id === invId; })[0] : null;
    if (invId && !inv) return { error: 'No such investigation.' };
    var kind = o.kind === 'DATA_REQUEST' ? 'DATA_REQUEST' : 'INVESTIGATION';
    var q = String(o.question || '').trim();
    if (!q) return { error: kind === 'DATA_REQUEST' ? 'Say what is to be retrieved.' : 'Give the reason for the lead.' };
    var raised = String(o.raisedBy || '');
    if (raised && !d.reports.some(function (x) { return x.id === raised; })) return { error: 'No such report: ' + raised + '.' };
    var forLead = String(o.forLead || '');
    if (forLead && !d.leads.some(function (x) { return x.id === forLead; })) return { error: 'No such lead: ' + forLead + '.' };
    // Where it was raised from decides which physical folder the printed sheet belongs in when there is no investigation.
    var origin = o.origin && o.origin.kind ? { kind: o.origin.kind, id: o.origin.id || '' } : (inv ? { kind: 'investigation', id: inv.id } : (raised ? { kind: 'report', id: raised } : { kind: 'register', id: '' }));
    var lead = {
      id: CI.nextId(d, kind === 'DATA_REQUEST' ? 'request' : 'lead'), investigationId: inv ? inv.id : '', bankId: inv ? inv.bankId : '', kind: kind,
      with: kind === 'DATA_REQUEST' ? 'Collection' : 'Investigations', assigned: String(o.assigned || '').trim(), question: q, raisedBy: raised, origin: origin,
      about: (o.about || []).filter(function (x, i, a) { return a.indexOf(x) === i; }), issued: o.issued || CI.today(),
      status: 'NOT_STARTED', response: '', returnedBy: '', returnedDate: '', created: CI.today()
    };
    if (kind === 'DATA_REQUEST') { lead.forLead = forLead; d.requests.push(lead); } else d.leads.push(lead);
    return { lead: lead };
  };
  /* Attach a lead or request to an investigation, or take it off one (invId empty). Its origin is kept. */
  CI.attachLead = function (d, id, invId) {
    var l = CI.findLead(d, id); if (!l) return { error: 'No such lead.' };
    var inv = invId ? d.investigations.filter(function (v) { return v.id === invId; })[0] : null;
    if (invId && !inv) return { error: 'No such investigation.' };
    l.investigationId = inv ? inv.id : ''; l.bankId = inv ? inv.bankId : '';
    if (l.forLead) { var fl = d.leads.filter(function (x) { return x.id === l.forLead; })[0]; if (!fl || fl.investigationId !== l.investigationId) l.forLead = ''; }
    return { lead: l };
  };
  /* Every lead and request about one name, whichever investigation holds it. */
  CI.leadsAbout = function (d, entityId) {
    return d.leads.concat(d.requests).filter(function (l) { return (l.about || []).indexOf(entityId) !== -1; })
      .sort(function (a, b) { return CI.isClosed(a) - CI.isClosed(b) || b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id); });
  };
  /* The register: all leads (or all requests), filtered. f: { kind: 'lead'|'request', open: bool, investigation: ''(all) | 'none' | id, assigned: ''(all) | text, about: entity id }. */
  CI.leadRegister = function (d, f) {
    f = f || {};
    var list = f.kind === 'request' ? d.requests : d.leads;
    return list.filter(function (l) {
      if (f.open && CI.isClosed(l)) return false;
      if (f.investigation === 'none' && l.investigationId) return false;
      if (f.investigation && f.investigation !== 'none' && l.investigationId !== f.investigation) return false;
      if (f.assigned && (l.assigned || '') !== f.assigned) return false;
      if (f.about && (l.about || []).indexOf(f.about) === -1) return false;
      return true;
    }).sort(function (a, b) { return CI.isClosed(a) - CI.isClosed(b) || a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id); });
  };
  /* Where a printed lead sheet belongs, in plain words. */
  CI.leadHome = function (d, l) {
    var inv = l.investigationId ? d.investigations.filter(function (v) { return v.id === l.investigationId; })[0] : null;
    var o = l.origin || { kind: inv ? 'investigation' : 'register', id: '' };
    var from;
    if (o.kind === 'file') { var e = d.entities.filter(function (x) { return x.id === o.id; })[0]; from = e ? 'Raised from the page of ' + e.name + ' (' + CI.TYPE_LABEL[e.type].toLowerCase() + ')' : 'Raised from an individual\u2019s page'; }
    else if (o.kind === 'report') from = 'Raised while indexing report ' + o.id;
    else if (o.kind === 'investigation') from = 'Raised inside investigation ' + (o.id || (inv && inv.id) || '');
    else from = 'Raised in the lead register';
    return { investigation: inv, belongs: inv ? 'Investigation ' + inv.id + (inv.title ? ' \u00b7 ' + inv.title : '') : 'No investigation', folder: inv ? 'File in the folder of investigation ' + inv.id : 'No investigation folder. Keep in the lead register', from: from };
  };
  CI.findLead = function (d, id) { return d.leads.concat(d.requests).filter(function (l) { return l.id === id; })[0]; };
  CI.leadsOf = function (d, invId) { return d.leads.filter(function (l) { return l.investigationId === invId; }); };
  CI.requestsOf = function (d, invId) { return d.requests.filter(function (l) { return l.investigationId === invId; }); };
  CI.leadResults = function (d, id) { return d.reports.filter(function (r) { return r.leadId === id; }); };
  CI.deleteLead = function (d, id) {
    d.reports.forEach(function (r) { if (r.leadId === id) r.leadId = ''; });
    d.leads = d.leads.filter(function (l) { return l.id !== id; });
    d.requests = d.requests.filter(function (l) { return l.id !== id; });
    d.requests.forEach(function (q) { if (q.forLead === id) q.forLead = ''; });
  };

  /* ---------- estimate and handover ---------- */
  CI.ESTIMATE_KINDS = [{ id: 'ESTABLISHED', label: 'Established' }, { id: 'HYPOTHESIS', label: 'Hypothesis' }];
  /* What arrived on a special bank's files since staff last marked it seen. */
  function idNum(id) { return parseInt(String(id).replace(/\D/g, ''), 10) || 0; }
  CI.bankNews = function (d, b) {
    if (b.quick || !b.seen) return { reports: [], links: [] };
    var have = {}; (b.files || []).forEach(function (id) { have[id] = 1; });
    return {
      reports: d.reports.filter(function (r) { return idNum(r.id) > b.seen.report && (r.entities || []).some(function (x) { return have[x.entityId]; }); }),
      links: d.links.filter(function (l) { return idNum(l.id) > b.seen.link && (have[l.from] || have[l.to]); })
    };
  };
  CI.markSeen = function (d, b) { b.seen = { report: d.counters.report || 0, link: d.counters.link || 0 }; };
  /* ---------- several charts per special bank ----------
   * The bank's live chart settings (filters, arrangement, snapshots) belong to its active chart. Switching saves them
   * into the chart being left and loads the other's, so the rest of the app keeps reading them straight off the bank. */
  CI.CHART_KEYS = ['minWeight', 'topN', 'linkTypes', 'entityTypes', 'dateFrom', 'dateTo', 'showMentions', 'hubStop', 'excluded', 'layout', 'edgeLabels', 'positions', 'snapshots', 'viewMode', 'frozenId', 'compareId', 'sizeByLinks', 'zoomLabels', 'groups', 'collapsed', 'groupNames'];
  function chartDefaults() {
    return { minWeight: 1, topN: 0, linkTypes: null, entityTypes: null, dateFrom: '', dateTo: '', showMentions: false, hubStop: true, excluded: [], layout: 'cose', edgeLabels: 'auto', positions: {}, snapshots: [], viewMode: 'live', frozenId: '', compareId: '', sizeByLinks: true, zoomLabels: true, groups: true, collapsed: {}, groupNames: {} };
  }
  CI.ensureCharts = function (b) {
    if (b.quick) return;
    if (!Array.isArray(b.charts) || !b.charts.length) { b.charts = [{ id: 'CH-1', name: 'Chart', state: null }]; b.chartId = 'CH-1'; b.chartSeq = 1; }
    if (!b.charts.some(function (c) { return c.id === b.chartId; })) b.chartId = b.charts[0].id;
    if (!b.chartSeq) b.chartSeq = b.charts.length;
  };
  CI.activeChart = function (b) { CI.ensureCharts(b); return b.charts.filter(function (c) { return c.id === b.chartId; })[0]; };
  function stash(b) {
    var c = CI.activeChart(b), s = {}; CI.CHART_KEYS.forEach(function (k) { s[k] = b[k] === undefined ? chartDefaults()[k] : clone(b[k]); }); c.state = s;
  }
  function load(b, state) { var s = state ? clone(state) : chartDefaults(); CI.CHART_KEYS.forEach(function (k) { b[k] = s[k] === undefined ? chartDefaults()[k] : s[k]; }); }
  CI.switchChart = function (b, id) {
    CI.ensureCharts(b);
    var t = b.charts.filter(function (c) { return c.id === id; })[0]; if (!t || id === b.chartId) return false;
    stash(b); b.chartId = id; load(b, t.state); t.state = null; return true;
  };
  /* A new chart starts blank (all the bank's files, nothing hidden), or as a copy of this one with its arrangement. */
  CI.addChart = function (b, name, copy) {
    CI.ensureCharts(b);
    var nm = String(name || '').trim() || 'Chart ' + (b.chartSeq + 1); b.chartSeq++;
    var c = { id: 'CH-' + b.chartSeq, name: nm, state: null };
    if (copy) { stash(b); c.state = clone(b.charts.filter(function (x) { return x.id === b.chartId; })[0].state); c.state.snapshots = []; c.state.compareId = ''; c.state.frozenId = ''; c.state.viewMode = 'live'; }
    b.charts.push(c); CI.switchChart(b, c.id); return c;
  };
  CI.deleteChart = function (b, id) {
    CI.ensureCharts(b);
    if (b.charts.length < 2) return 'A special bank keeps at least one chart.';
    if (b.handedOver && b.handedOverChart === id) return 'This chart was handed over with the bank, so it stays.';
    if (id === b.chartId) { var other = b.charts.filter(function (c) { return c.id !== id; })[0]; CI.switchChart(b, other.id); }
    b.charts = b.charts.filter(function (c) { return c.id !== id; }); return '';
  };
  CI.currentEstimate = function (bank) {
    if (!bank.estimates || !bank.estimates.length) bank.estimates = [{ id: 'EST-1', label: 'Estimate 1', created: '', summary: '', items: [], updated: '' }];
    return bank.estimates[bank.estimates.length - 1];
  };
  CI.estimateOf = function (bank, id) { return (bank.estimates || []).filter(function (x) { return x.id === id; })[0] || CI.currentEstimate(bank); };
  /* A new estimate for the same special bank: blank, or a copy of the latest so it can be corrected or redone. */
  CI.newEstimate = function (bank, copy) {
    var prev = CI.currentEstimate(bank), n = bank.estimates.length + 1, id = 'EST-' + n;
    while (bank.estimates.some(function (x) { return x.id === id; })) id = 'EST-' + (++n);
    var e = { id: id, label: 'Estimate ' + n, created: CI.today(), summary: copy ? prev.summary : '', items: copy ? clone(prev.items) : [], updated: CI.today() };
    bank.estimates.push(e);
    return e;
  };
  /* Names a special bank could take on next: connected to its files, heaviest first. */
  CI.suggestFiles = function (d, bank, idx, n) {
    idx = idx || CI.buildIndex(d);
    var have = {}, base = (bank.files && bank.files.length ? bank.files : bank.seeds) || [], near = {};
    (bank.files || []).forEach(function (id) { have[id] = true; });
    var stats = CI.materialStats(d, idx), inBase = {};
    base.forEach(function (id) { inBase[id] = true; });
    d.links.forEach(function (l) {
      [[l.from, l.to], [l.to, l.from]].forEach(function (p) {
        if (inBase[p[0]] && !have[p[1]] && idx.entity[p[1]] && !CI.isItem(idx.entity[p[1]])) near[p[1]] = (near[p[1]] || 0) + 1;
      });
    });
    return Object.keys(near).map(function (id) { return { id: id, linked: near[id], score: CI.statsFor(stats, id).score }; })
      .sort(function (a, b) { return b.score - a.score || b.linked - a.linked || idx.entity[a.id].name.localeCompare(idx.entity[b.id].name); }).slice(0, n || 8);
  };
  /* Starting names plus the fattest names connected to them, for opening a special bank from a finding. */
  CI.proposeFiles = function (d, seeds, n, idx) {
    idx = idx || CI.buildIndex(d);
    var tmp = { files: seeds.slice(), seeds: seeds };
    var more = CI.suggestFiles(d, tmp, idx, 200).map(function (x) { return x.id; });
    return seeds.concat(more).slice(0, Math.max(n || 12, seeds.length));
  };
  /* Change a statement: text, the reports it rests on, or whether it is established or a working theory. */
  CI.updateEstimateItem = function (d, est, id, patch) {
    var it = est.items.filter(function (i) { return i.id === id; })[0];
    if (!it) return { error: 'No such statement.' };
    var next = { kind: patch.kind || it.kind, text: patch.text != null ? String(patch.text).trim() : it.text, reportIds: patch.reportIds || it.reportIds };
    if (!next.text) return { error: 'The statement cannot be empty.' };
    var bad = next.reportIds.filter(function (r) { return !d.reports.some(function (x) { return x.id === r; }); });
    if (bad.length) return { error: 'No such report: ' + bad.join(', ') + '.' };
    if (next.kind === 'ESTABLISHED' && !next.reportIds.length) return { error: 'An established statement must cite at least one report.' };
    it.kind = next.kind; it.text = next.text; it.reportIds = next.reportIds.filter(function (r, i, a) { return a.indexOf(r) === i; });
    est.updated = CI.today();
    return { item: it };
  };
  CI.addEstimateItem = function (d, bank, o, est) {
    est = est || CI.currentEstimate(bank);
    if (!CI.ESTIMATE_KINDS.some(function (k) { return k.id === o.kind; })) return { error: 'Choose established or hypothesis.' };
    var text = String(o.text || '').trim();
    if (!text) return { error: 'Write the statement.' };
    var ids = String(o.reportIds || '').split(/[\s,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
    var bad = ids.filter(function (id) { return !d.reports.some(function (r) { return r.id === id; }); });
    if (bad.length) return { error: 'No such report: ' + bad.join(', ') + '.' };
    if (o.kind === 'ESTABLISHED' && !ids.length) return { error: 'An established statement must cite at least one report.' };
    var it = { id: CI.nextId(d, 'item'), kind: o.kind, text: text, reportIds: ids.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
    est.items.push(it); est.updated = CI.today();
    return { item: it };
  };
  /* ---------- investigations and handling plans ---------- */
  CI.INV_STATUS = [{ id: 'ACTIVE', label: 'Active' }, { id: 'CLOSED', label: 'Closed' }];
  var pick = function (list, id) { return list.filter(function (x) { return x.id === id; })[0] || list[0]; };
  CI.invStatus = function (id) { return pick(CI.INV_STATUS, id); };
  CI.investigationFor = function (d, bankId) { if (!bankId) return null; return d.investigations.filter(function (v) { return v.bankId === bankId; })[0] || null; };
  /* A special bank may end with the finding that there is no situation: nothing is handed over and no investigation is needed. */
  CI.closeBank = function (d, bank, reason) {
    if (bank.handedOver) return 'This bank was handed over to Investigations.';
    var r = String(reason || '').trim(); if (!r) return 'Say why there is no situation.';
    bank.outcome = { kind: 'NO_SITUATION', reason: r, date: CI.today() }; return '';
  };
  CI.reopenBank = function (bank) { bank.outcome = null; };
  var b0reason = function (bank) { return bank.opened && bank.opened.reason || ''; };
  /* An investigation can also be opened without a special bank (a tip, a referral). */
  CI.newInvestigation = function (d, o) {
    var title = String(o.title || '').trim(); if (!title) return { error: 'Give the investigation a title.' };
    var inv = { id: CI.nextId(d, 'investigation'), bankId: '', title: title, reason: String(o.reason || '').trim(), status: 'ACTIVE', investigator: String(o.investigator || '').trim(), opened: o.opened || CI.today(), closed: '', notes: '', files: [], planFile: { name: '', location: '' } };
    d.investigations.push(inv); return { inv: inv };
  };
  CI.handOver = function (d, bank, estId, into) {
    if (bank.outcome) return null;
    if (into && into.bankId) return null;
    var live = CI.computeGraph(d, bank, CI.buildIndex(d));
    var sn = { id: CI.nextId(d, 'snapshot'), label: 'Handover ' + CI.fmtDate(CI.today()), at: new Date().toISOString(), graph: clone(live), positions: clone(bank.positions || {}) };
    CI.ensureCharts(bank); bank.handedOverChart = bank.chartId;
    bank.snapshots.push(sn); bank.compareId = sn.id; bank.handedOver = CI.today(); bank.handedOverEstimate = CI.estimateOf(bank, estId).id;
    var inv = into || CI.investigationFor(d, bank.id);
    if (into) { into.bankId = bank.id; if (!into.reason) into.reason = b0reason(bank); }
    else if (!inv) {
      inv = { id: CI.nextId(d, 'investigation'), bankId: bank.id, title: '', reason: b0reason(bank), status: 'ACTIVE', investigator: '', opened: CI.today(), closed: '', notes: '', files: [], planFile: { name: '', location: '' } };
      d.investigations.push(inv);
    }
    return sn;
  };
  /* The files of an investigation: the ones added by hand, plus those in its bank, on its chart, or named in its leads and requests. */
  CI.invFiles = function (d, inv) {
    var map = {}, add = function (id, why) { if (!id) return; var e = d.entities.filter(function (x) { return x.id === id; })[0]; if (!e) return; (map[id] = map[id] || { entity: e, sources: [] }); if (map[id].sources.indexOf(why) === -1) map[id].sources.push(why); };
    var b = d.banks.filter(function (x) { return x.id === inv.bankId; })[0];
    (inv.files || []).forEach(function (id) { add(id, 'Added'); });
    if (b) (b.files || []).forEach(function (id) { add(id, 'Bank'); });
    CI.caseChartOf(inv).pins.forEach(function (p) { add(p.entityId, 'Chart'); });
    CI.leadsOf(d, inv.id).concat(CI.requestsOf(d, inv.id)).forEach(function (l) { (l.about || []).forEach(function (id) { add(id, 'Lead'); }); });
    var order = CI.FILE_TYPES;
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, c) { return order.indexOf(a.entity.type) - order.indexOf(c.entity.type) || a.entity.name.localeCompare(c.entity.name); });
  };
  CI.addInvFile = function (d, inv, id) {
    if (!d.entities.some(function (e) { return e.id === id; })) return { error: 'No such file.' };
    if (CI.invFiles(d, inv).some(function (x) { return x.entity.id === id; })) return { error: 'That file is already in this investigation.' };
    inv.files = inv.files || []; inv.files.push(id); return {};
  };
  CI.removeInvFile = function (d, inv, id) { inv.files = (inv.files || []).filter(function (x) { return x !== id; }); };

  /* ---------- case chart (the investigators' board) ---------- */
  /* Pins are files from the main files; strings are drawn by hand and every string must cite at least one report that names one of its ends. */
  CI.caseChartOf = function (inv) {
    if (!inv.caseChart || typeof inv.caseChart !== 'object') inv.caseChart = { pins: [], strings: [], notes: [], title: '' };
    if (!Array.isArray(inv.caseChart.pins)) inv.caseChart.pins = [];
    if (!Array.isArray(inv.caseChart.strings)) inv.caseChart.strings = [];
    if (!Array.isArray(inv.caseChart.notes)) inv.caseChart.notes = [];
    if (typeof inv.caseChart.title !== 'string') inv.caseChart.title = '';
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
  /* Free text labels placed on the board, and the board's title (printed on the wall copy). */
  CI.addNote = function (d, inv, text, pos) {
    text = String(text || '').trim(); if (!text) return { error: 'Write the label text.' };
    var n = { id: CI.nextId(d, 'caseNote'), text: text, x: pos && isFinite(pos.x) ? Math.round(pos.x) : 0, y: pos && isFinite(pos.y) ? Math.round(pos.y) : 0 };
    CI.caseChartOf(inv).notes.push(n); return { note: n };
  };
  CI.updateNote = function (d, inv, id, text) {
    text = String(text || '').trim(); if (!text) return { error: 'Write the label text.' };
    var n = CI.caseChartOf(inv).notes.filter(function (x) { return x.id === id; })[0]; if (!n) return { error: 'That label no longer exists.' };
    n.text = text; return { note: n };
  };
  CI.removeNote = function (d, inv, id) { var cc = CI.caseChartOf(inv); cc.notes = cc.notes.filter(function (x) { return x.id !== id; }); };
  CI.setCaseTitle = function (d, inv, title) { CI.caseChartOf(inv).title = String(title || '').trim(); };
  /* Connections already recorded in the main files between pinned files, as case chart connections not yet on the board. */
  CI.indexConnections = function (d, inv) {
    var cc = CI.caseChartOf(inv), pinned = {}, groups = {}, out = [];
    cc.pins.forEach(function (p) { pinned[p.entityId] = 1; });
    d.links.forEach(function (l) {
      if (!pinned[l.from] || !pinned[l.to]) return;
      var type = CI.linkType(d, l.type), k = l.from + '|' + l.to + '|' + type.label;
      var g = groups[k] || (groups[k] = { a: l.from, b: l.to, label: type.label, reportIds: [] });
      if (g.reportIds.indexOf(l.reportId) === -1) g.reportIds.push(l.reportId);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      var have = cc.strings.some(function (t) { return t.label.toLowerCase() === g.label.toLowerCase() && ((t.a === g.a && t.b === g.b) || (t.a === g.b && t.b === g.a)); });
      if (!have) out.push(g);
    });
    return out;
  };
  CI.addIndexConnections = function (d, inv) {
    var n = 0; CI.indexConnections(d, inv).forEach(function (g) { if (CI.addString(d, inv, g).string) n++; }); return n;
  };
  /* The case chart as a graph the chart canvas can draw. Open leads of the investigation flag the files they are about. */
  CI.caseGraph = function (d, inv, idx) {
    idx = idx || CI.buildIndex(d);
    var cc = CI.caseChartOf(inv), nodes = [], edges = [], positions = {}, flags = { nodes: {}, edges: {} };
    var open = CI.leadsOf(d, inv.id).filter(function (l) { return !CI.isClosed(l); });
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
    return { graph: { nodes: nodes, edges: edges }, positions: positions, flags: flags, openLeads: open, notes: cc.notes.slice() };
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
    d.investigations.forEach(function (v) { var f = v.files || []; if (f.indexOf(fromId) !== -1) { v.files = f.filter(function (x) { return x !== fromId; }); if (v.files.indexOf(intoId) === -1) v.files.push(intoId); } });
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

  /* Dates are stored as YYYY-MM-DD and shown as day, short month, year: 25 Oct. 2026. */
  CI.MONTH_ABBR = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  var MONTH_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  CI.fmtDate = function (iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso || '';
    return Number(m[3]) + ' ' + CI.MONTH_ABBR[Number(m[2]) - 1] + ' ' + m[1];
  };
  /* A full timestamp (from toISOString) as local date and time: 25 Oct. 2026 14:05. */
  CI.fmtDateTime = function (iso) {
    var dt = new Date(iso);
    if (!iso || isNaN(dt.getTime())) return CI.fmtDate(iso);
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return CI.fmtDate(dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate())) + ' ' + p2(dt.getHours()) + ':' + p2(dt.getMinutes());
  };
  /* Reads what a person types: '25 Oct. 2026', '25 october 2026', '25/10/2026' (day first), 'Oct 25, 2026', '2026-10-25'.
   * Returns YYYY-MM-DD, '' for blank, or null when it is not a date. */
  CI.parseDate = function (text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return '';
    var y, m, d, mt;
    var monthOf = function (w) { w = String(w).toLowerCase(); if (w.length < 3) return 0; for (var i = 0; i < 12; i++) if (MONTH_FULL[i].indexOf(w) === 0) return i + 1; return 0; };
    var year = function (t) { return t.length === 2 ? 2000 + Number(t) : Number(t); };
    if ((mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
    else if ((mt = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/))) { d = +mt[1]; m = +mt[2]; y = year(mt[3]); }
    else if ((mt = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[ \-\/.,]*([A-Za-z]{3,9})\.?[ \-\/.,]*(\d{2}|\d{4})$/))) { d = +mt[1]; m = monthOf(mt[2]); y = year(mt[3]); }
    else if ((mt = s.match(/^([A-Za-z]{3,9})\.?[ ]*(\d{1,2})(?:st|nd|rd|th)?,?[ ]*(\d{2}|\d{4})$/))) { m = monthOf(mt[1]); d = +mt[2]; y = year(mt[3]); }
    else return null;
    if (!m || m < 1 || m > 12 || d < 1 || y < 1900 || y > 2100) return null;
    if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return y + '-' + p2(m) + '-' + p2(d);
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
