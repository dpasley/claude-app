/* A pilot-sized set of fictional data: about 30 individuals, 14 groups, 12 areas, 10 subjects and 300 reports,
   with the untidy parts of real files (aliases, misspelled repeats of a person, reposted reports, reports with no
   connections). Everything is invented; the same seed always gives the same data. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  var FIRST = ['Adrian', 'Beatrix', 'Callum', 'Dalia', 'Emeka', 'Farrah', 'Gideon', 'Helena', 'Ibrahim', 'Joanna', 'Kasper', 'Lucinda', 'Mateo', 'Nadine', 'Osric', 'Priscilla', 'Quentin', 'Rhea', 'Stellan', 'Thea', 'Ulrich', 'Valentina', 'Wendell', 'Ximena', 'Yusuf', 'Zora', 'Alistair', 'Bronwyn', 'Cormac', 'Delphine'];
  var LAST = ['Hartwell', 'Okonkwo', 'Lindqvist', 'Marchetti', 'Abara', 'Ferreira', 'Holloway', 'Ivanova', 'Kowalczyk', 'Lamarque', 'Nakamura', 'Oyelaran', 'Pemberton', 'Quarrie', 'Rasmussen', 'Soriano', 'Thackeray', 'Underhill', 'Varga', 'Whitcombe', 'Yamada', 'Zielinski', 'Ashdown', 'Bellamy', 'Castellan', 'Dunleavy', 'Escobar', 'Fairbanks', 'Grelle', 'Hollis'];
  var CO = [['Tidewater', 'Marine Services'], ['Ashgrove', 'Capital Partners'], ['Lumen', 'Telecom'], ['Redfern', 'Logistics'], ['Corbel', 'Construction'], ['Halcyon', 'Holdings'], ['Vantage', 'Staffing'], ['Quarry Lane', 'Trading'], ['Sable', 'Security Group'], ['Meadowbank', 'Foods'], ['Ironwood', 'Fabrication'], ['Pelham', 'Property Trust'], ['Orchard', 'Payments'], ['Brightmoor', 'Consulting']];
  var AREAS = ['Cinder Lake', 'Halden Quay', 'Westmarch', 'Greyfriars', 'Old Mill district', 'Teasel Court', 'Brannock Heights', 'Southgate market', 'Rooke Island', 'Lantern Row', 'Harrow Fields', 'Pike Street depot'];
  var SUBJ = [['Dock fee kickbacks', 'Fraud'], ['Warehouse arson', 'Sabotage'], ['Payroll diversion', 'Fraud'], ['Inventory shrinkage', 'Theft'], ['Intimidation of inspectors', 'Threats'], ['Fake subcontractor invoices', 'Fraud'], ['Cargo seal tampering', 'Theft'], ['Cloned access cards', 'Access control'], ['Anonymous complaint letters', 'Harassment'], ['Vehicle fuel skimming', 'Theft']];
  var SOURCES = ['Social post', 'Financial document', 'Corporate document', 'FOIA record', 'Staff report', 'News / media', 'Investigator report'];
  var BASIS = ['Fraud', 'Sabotage', 'Theft', 'Harassment of staff', 'Credible violence', 'Coordinated damaging activity'];
  // [link type id, from kind, to kind, note and sentence builders]
  var KINDS = [
    ['EMPLOYED_BY', 'i', 'g', 'works as {r}', function (a, b) { return a + ' is on the payroll of ' + b + '.'; }],
    ['OFFICER_OF', 'i', 'g', 'director', function (a, b) { return a + ' signs for ' + b + ' as a director.'; }],
    ['AGENT_FOR', 'i', 'g', 'registered agent', function (a, b) { return 'Filing lists ' + a + ' as registered agent for ' + b + '.'; }],
    ['COMMUNICATED_WITH', 'i', 'i', 'phone contact', function (a, b) { return a + ' and ' + b + ' were in contact several times in one week.'; }],
    ['ASSOCIATED_WITH', 'i', 'i', 'seen together', function (a, b) { return a + ' was seen with ' + b + ' at a meeting.'; }],
    ['LOCATED_AT', 'g', 'a', 'unit at the site', function (a, b) { return b + ' is the address given for ' + a + '.'; }],
    ['BASED_IN', 'i', 'a', 'lives there', function (a, b) { return a + ' was observed at an address in ' + b + '.'; }],
    ['RENTS', 'g', 'a', 'lease', function (a, b) { return a + ' holds a lease in ' + b + '.'; }],
    ['FUNDED', 'g', 'g', 'transfer', function (a, b) { return 'Bank records show transfers from ' + a + ' to ' + b + '.'; }],
    ['INVOLVED_IN', 'i', 's', 'named in the matter', function (a, b) { return a + ' is named in connection with ' + b + '.'; }],
    ['OCCURS_IN', 's', 'a', 'reported there', function (a, b) { return b + ' is where ' + a + ' was reported.'; }]
  ];

  CI.pilotData = function (seed) {
    var R = rng(seed || 20261029), pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var d = CI.emptyData(); d.started = true; d.sampleLoaded = true; d.settings.heatThreshold = 4;
    CI.addSuggestedLinkTypes(d); d.settings.suggestedTypes = true;
    var ago = function (n) { return CI.daysAgo(n); };
    var ok = function (r, w) { if (r && r.error) throw new Error('pilot: ' + w + ': ' + r.error); return r; };

    // files
    var ind = [], grp = [], area = [], sub = [];
    for (var i = 0; i < 30; i++) {
      var nm = FIRST[i] + ' ' + LAST[(i * 7 + 3) % LAST.length];
      var e = CI.addEntity(d, { type: 'individual', name: nm, aliases: i % 4 === 0 ? [FIRST[i].charAt(0) + '. ' + nm.split(' ')[1]] : [], details: i % 3 === 0 ? 'Born ' + (1960 + i) : '', notes: '' });
      ind.push(e);
    }
    CO.forEach(function (c) { grp.push(CI.addEntity(d, { type: 'group', name: c[0] + ' ' + c[1], aliases: R() < 0.3 ? [c[0]] : [], details: 'Company', notes: '' })); });
    AREAS.forEach(function (a) { area.push(CI.addEntity(d, { type: 'area', name: a, aliases: [], details: '', notes: '' })); });
    SUBJ.forEach(function (s) { var e2 = CI.addEntity(d, { type: 'subject', name: s[0], aliases: [], details: s[1], notes: '' }); e2.profile = { category: s[1], status: 'Open' }; sub.push(e2); });
    // near-duplicates: the same person entered under a different spelling by another clerk
    var dupA = CI.addEntity(d, { type: 'individual', name: 'Gideon Holoway', aliases: [], details: 'Probably Gideon Holloway', notes: '' });
    var dupB = CI.addEntity(d, { type: 'group', name: 'Corbel Construction Ltd', aliases: [], details: 'Probably Corbel Construction', notes: '' });

    // five clusters, each a few individuals around two groups, an area and a subject
    var clusters = [];
    for (var c = 0; c < 5; c++) clusters.push({ ind: ind.slice(c * 6, c * 6 + 6), grp: [grp[c * 2 % grp.length], grp[(c * 2 + 1) % grp.length]], area: [area[c * 2], area[c * 2 + 1]], sub: [sub[c * 2], sub[c * 2 + 1]] });
    var byKind = { i: function (cl) { return pick(cl.ind); }, g: function (cl) { return pick(cl.grp); }, a: function (cl) { return pick(cl.area); }, s: function (cl) { return pick(cl.sub); } };
    function other(kind, cl) { var pool = kind === 'i' ? ind : kind === 'g' ? grp : kind === 'a' ? area : sub; return pick(pool); }

    var reports = [];
    for (var n = 0; n < 300; n++) {
      var cl = pick(clusters), bridge = R() < 0.15, k = pick(KINDS), kind2 = pick(KINDS);
      var chosen = {};
      function take(kindKey, forceOther) { for (var t = 0; t < 12; t++) { var x = forceOther ? other(kindKey, cl) : byKind[kindKey](cl); if (!chosen[x.id]) { chosen[x.id] = x; return x; } } return null; }
      var a1 = take(k[1]), b1 = take(k[2], bridge);
      var a2 = R() < 0.5 ? take(kind2[1]) : null, b2 = a2 ? take(kind2[2], bridge) : null;
      if (!a1 || !b1) continue;
      var day = Math.floor(R() * 120) + 1, summary = k[4](a1.name, b1.name) + (a2 && b2 ? ' ' + kind2[4](a2.name, b2.name) : '');
      var r = { id: CI.nextId(d, 'report'), received: ago(day), eventDate: R() < 0.5 ? ago(day + Math.floor(R() * 30)) : '', sourceType: pick(SOURCES), sourceRef: pick(['Folder ' + (1 + Math.floor(R() * 40)), 'Document ' + (100 + Math.floor(R() * 800)), 'Staff report ' + (1 + Math.floor(R() * 90))]), archiveLoc: 'sample data', originalText: '', hash: '', hashAt: '', dupOf: '', subject: summary.split('.')[0].slice(0, 80), summary: summary, basis: pick(BASIS), entities: [], created: CI.today(), updated: CI.today() };
      d.reports.push(r); reports.push(r);
      Object.keys(chosen).forEach(function (id) { CI.addEntityToReport(d, r.id, id, '', false, ''); });
      // the clerk spelled one person differently in a few reports
      if (R() < 0.04 && a1.type === 'individual' && a1.id === ind[12].id) { /* keep deterministic and rare */ }
      var pairs = [[k, a1, b1]]; if (a2 && b2) pairs.push([kind2, a2, b2]);
      if (R() > 0.07) pairs.forEach(function (p) { var res = CI.addLink(d, { reportId: r.id, from: p[1].id, to: p[2].id, type: p[0][0], note: p[0][3].replace('{r}', pick(['driver', 'manager', 'clerk', 'accountant', 'supervisor'])) }); if (res && res.error && !/already/i.test(res.error)) throw new Error('pilot link ' + res.error); });
    }
    // misspelled duplicates appear in a handful of reports and are flagged for review
    [[dupA, ind[2], 3], [dupB, grp[4], 3]].forEach(function (p) {
      for (var j = 0; j < p[2]; j++) { var rr = reports[20 + j * 37 + (p[0] === dupB ? 5 : 0)]; if (rr && !rr.entities.some(function (x) { return x.entityId === p[0].id; })) CI.addEntityToReport(d, rr.id, p[0].id, '', true, 'Same as ' + p[1].name + '?'); }
    });
    // reposts: the same report received again from another source
    [11, 64, 120, 187, 241].forEach(function (ix) { var o = reports[ix]; if (!o) return; var cp = JSON.parse(JSON.stringify(o)); cp.id = CI.nextId(d, 'report'); cp.dupOf = o.id; cp.received = CI.daysAgo(Math.max(1, Math.floor(R() * 20))); cp.sourceType = 'News / media'; cp.sourceRef = 'Reposted copy'; d.reports.push(cp); });

    // special banks around three clusters
    [[0, 'Dock and fee matters'], [2, 'Warehouse fires'], [4, 'Fuel and fleet']].forEach(function (b) { var bank = CI.newBank(d, b[1], clusters[b[0]].ind.slice(0, 2).map(function (x) { return x.id; }), 2); d.banks.push(bank); });
    // an investigation with leads, and leads raised from files and reports
    var inv = ok(CI.newInvestigation(d, { title: 'Dock fee kickbacks', reason: 'Pattern of payments between dock operators and a contractor.', investigator: 'Rowan Pierce', opened: ago(20) }), 'inv').inv;
    var leads = [
      [inv.id, 'Who approved the fee waivers for ' + grp[0].name + '?', [grp[0].id], 'IN_PROGRESS', 'Rowan Pierce', 14, ''],
      [inv.id, 'Does ' + ind[1].name + ' have a stake in ' + grp[1].name + '?', [ind[1].id, grp[1].id], 'NOT_STARTED', 'Rowan Pierce', 9, ''],
      ['', 'Where does ' + ind[7].name + ' live now?', [ind[7].id], 'NOT_STARTED', 'Dev Patel', 6, 'file:' + ind[7].id],
      ['', 'Is ' + ind[14].name + ' the same person as the listed agent for ' + grp[6].name + '?', [ind[14].id, grp[6].id], 'IN_PROGRESS', 'Dev Patel', 11, 'file:' + ind[14].id],
      ['', 'Ownership of the lease at ' + area[4].name + '.', [area[4].id], 'NOT_STARTED', '', 3, 'file:' + area[4].id]
    ];
    leads.forEach(function (L) {
      var o = L[6] ? { kind: L[6].split(':')[0], id: L[6].split(':')[1] } : null;
      var res = ok(CI.addLead(d, { investigationId: L[0], origin: o, kind: 'INVESTIGATION', question: L[1], about: L[2], issued: ago(L[5]), assigned: L[4] }), 'lead');
      res.lead.status = L[3];
    });
    return CI.normalize(d);
  };
})(typeof window !== 'undefined' ? window : globalThis);
