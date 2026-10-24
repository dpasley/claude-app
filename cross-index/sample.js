/* Fictional sample data for testing the prototype. Every name, company and address is invented. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  CI.sampleData = function () {
    var d = CI.emptyData();
    d.started = true; d.sampleLoaded = true;
    d.settings.heatThreshold = 4;
    var ago = function (n) { return CI.daysAgo(n); };

    var ent = {};
    function E(key, type, name, aliases, notes) { ent[key] = CI.addEntity(d, { type: type, name: name, aliases: aliases || [], notes: notes || '' }); }
    E('vera', 'individual', 'Vera Linden', ['V. Linden']);
    E('orrin', 'individual', 'Orrin Platt', ['O. Platt']);
    E('tobias', 'individual', 'Tobias Crane', ['@tcrane_speaks']);
    E('mara', 'individual', 'Mara Quill');
    E('dana', 'individual', 'Dana Whitcomb', [], 'Northwind dispatcher (internal staff).');
    E('bright', 'group', 'Brightwater Holdings LLC', ['Brightwater']);
    E('harbor', 'group', 'Harborline Supply Co.', ['Harborline']);
    E('grid', 'group', 'GridWatch Now', ['@gridwatch_now'], 'Social media account.');
    E('keystone', 'group', 'Keystone Courier Partners', ['Keystone']);
    E('invoice', 'subject', 'Q3 vendor invoice scheme');
    E('outage', 'subject', 'Depot 4 equipment outage');
    E('harborst', 'area', '410 Harbor Street, Unit 6', ['410 Harbor St #6']);
    E('pobox', 'area', 'PO Box 2291, Dunmore');
    E('depot4', 'area', 'Northwind Depot 4');

    function R(daysAgo, eventAgo, sourceType, sourceRef, basis, summary, people, links, dupOf) {
      var r = {
        id: CI.nextId(d, 'report'), received: ago(daysAgo), eventDate: eventAgo == null ? '' : ago(eventAgo),
        sourceType: sourceType, sourceRef: sourceRef, archiveLoc: 'sample data', originalText: '', hash: '', hashAt: '',
        dupOf: dupOf || '', summary: summary, basis: basis, entities: [], created: CI.today(), updated: CI.today()
      };
      d.reports.push(r);
      people.forEach(function (p) { CI.addEntityToReport(d, r.id, ent[p[0]].id, p[1]); });
      (links || []).forEach(function (l) { CI.addLink(d, { reportId: r.id, from: ent[l[0]].id, to: ent[l[1]].id, type: l[2], note: l[3] || '' }); });
      return r;
    }

    R(3, 3, 'Financial document', 'AP ledger export, Harborline invoices 1041-1047', 'Fraud',
      'Seven consecutive invoices from Harborline Supply paid in two weeks; all list the same PO box and have no purchase order numbers.',
      [['harbor', 'payer'], ['pobox', 'named'], ['invoice', 'subject']],
      [['harbor', 'pobox', 'LOCATED_AT'], ['harbor', 'invoice', 'INVOLVED_IN']]);
    R(5, 20, 'Corporate document', 'State business filing, Brightwater Holdings LLC', 'Fraud',
      'Annual filing for Brightwater lists Vera Linden as registered agent and 410 Harbor Street, Unit 6 as the business address.',
      [['bright', 'subject'], ['vera', 'named'], ['harborst', 'named']],
      [['vera', 'bright', 'EMPLOYED_BY', 'registered agent'], ['bright', 'harborst', 'LOCATED_AT']]);
    R(6, 400, 'Corporate document', 'State business filing, Harborline Supply Co.', 'Fraud',
      'Older filing for Harborline names Orrin Platt as officer and gives 410 Harbor Street, Unit 6 as its former address.',
      [['harbor', 'subject'], ['orrin', 'named'], ['harborst', 'named']],
      [['orrin', 'harbor', 'EMPLOYED_BY', 'listed officer'], ['harbor', 'harborst', 'LOCATED_AT', 'former address']]);
    R(7, 7, 'Staff report', 'AP clerk memo to finance manager', 'Fraud',
      'AP clerk reports an email from Vera Linden pressing for expedited payment to Harborline outside the normal approval cycle.',
      [['vera', 'author'], ['harbor', 'recipient'], ['invoice', 'subject']],
      [['vera', 'invoice', 'INVOLVED_IN'], ['harbor', 'invoice', 'INVOLVED_IN']]);
    R(9, 9, 'Financial document', 'Bank transfer record, outgoing wire batch', 'Fraud',
      'Funds received from Northwind were forwarded within a day from Harborline to Brightwater Holdings.',
      [['harbor', 'payer'], ['bright', 'recipient']],
      [['harbor', 'bright', 'FUNDED']]);
    var r6 = R(4, 4, 'Social post', 'https://social.example/gridwatch_now/post/5521', 'Sabotage',
      'GridWatch Now posts that Depot 4 "will be going dark soon"; the account is administered by Tobias Crane according to its profile page.',
      [['grid', 'author'], ['depot4', 'named'], ['outage', 'subject'], ['tobias', 'named']],
      [['grid', 'outage', 'INVOLVED_IN'], ['tobias', 'grid', 'MEMBER_OF', 'profile admin']]);
    R(4, 4, 'Social post', 'https://other.example/p/88130 (repost of GridWatch post)', 'Sabotage',
      'Reshare of the GridWatch Now post on a second platform with the same text.',
      [['grid', 'author'], ['outage', 'subject']],
      [['grid', 'outage', 'INVOLVED_IN']], r6.id);
    R(2, 2, 'Staff report', 'Depot 4 maintenance log and badge export', 'Sabotage',
      'Conveyor power failure at Depot 4 traced to cut cabling; badge log shows a Keystone Courier contractor on site the night before.',
      [['depot4', 'present'], ['keystone', 'named'], ['outage', 'subject']],
      [['keystone', 'depot4', 'LOCATED_AT', 'badge log'], ['keystone', 'outage', 'INVOLVED_IN']]);
    R(8, 60, 'Corporate document', 'State business filing, Keystone Courier Partners', 'Coordinated damaging activity',
      'Keystone Courier Partners lists Mara Quill as director and 410 Harbor Street, Unit 6 as its registered address.',
      [['keystone', 'subject'], ['mara', 'named'], ['harborst', 'named']],
      [['mara', 'keystone', 'EMPLOYED_BY', 'director'], ['keystone', 'harborst', 'LOCATED_AT']]);
    R(1, 1, 'Social post', 'https://social.example/tcrane_speaks/post/9012', 'Harassment of staff',
      'Tobias Crane posts a named attack on a Northwind dispatcher, Dana Whitcomb, and tags GridWatch Now.',
      [['tobias', 'author'], ['dana', 'named'], ['grid', 'named']],
      [['tobias', 'dana', 'ACTED_AGAINST']]);
    R(10, 11, 'News / media', 'Local business-chamber event coverage', 'Coordinated damaging activity',
      'Article quotes Vera Linden and Mara Quill together at a chamber event; Orrin Platt is named as an attendee.',
      [['vera', 'named'], ['mara', 'named'], ['orrin', 'named']],
      [['vera', 'mara', 'COMMUNICATED_WITH', 'panel']]);
    R(12, 90, 'FOIA record', 'Municipal procurement file 24-117', 'Fraud',
      'Procurement file shows Keystone as prime contractor paying Brightwater Holdings as a subcontractor.',
      [['keystone', 'payer'], ['bright', 'recipient']],
      [['keystone', 'bright', 'FUNDED']]);

    var bank = CI.newBank(d, 'Invoice scheme bank', [ent.invoice.id], 2);
    d.banks.push(bank);
    d.ui.bankId = bank.id;
    bank.estimate.summary = 'Payments for the Q3 vendor invoices appear to pass through Harborline Supply to Brightwater Holdings, which shares an address with both Harborline (formerly) and Keystone Courier. The Depot 4 outage is a separate thread that touches the same address through Keystone.';
    CI.addEstimateItem(d, bank, { kind: 'ESTABLISHED', text: 'Harborline forwarded Northwind\u2019s payment to Brightwater Holdings within a day.', reportIds: 'R-0005' });
    CI.addEstimateItem(d, bank, { kind: 'ESTABLISHED', text: 'Brightwater and Harborline have both been registered at 410 Harbor Street, Unit 6.', reportIds: 'R-0002, R-0003' });
    CI.addEstimateItem(d, bank, { kind: 'HYPOTHESIS', text: 'Harborline is a pass-through for payments that end at Brightwater.', reportIds: '' });
    var lead = function (kind, who, question, rep, about, status) {
      var r = CI.addLead(d, { bankId: bank.id, kind: kind, with: who, question: question, raisedBy: rep, about: about.map(function (k) { return ent[k].id; }), issued: CI.today() });
      r.lead.status = status; return r.lead;
    };
    lead('INVESTIGATION', 'Investigations', 'Why did Harborline Supply forward Northwind\u2019s payment to Brightwater Holdings within a day, and who benefits?', 'R-0005', ['harbor', 'bright'], 'IN_PROGRESS');
    lead('DATA_REQUEST', 'Collection', 'The current state business filing for Brightwater Holdings LLC, with all amendments and the agent and address history.', 'R-0002', ['bright'], 'IN_PROGRESS');
    lead('DATA_REQUEST', 'Collection', 'Depot 4 badge and sign-in records for the 48 hours before the outage.', 'R-0008', ['depot4', 'keystone'], 'NOT_STARTED');
    bank.handedOver = '';
    bank.opened = { date: ago(6), reason: 'Seven Harborline invoices paid in two weeks with no purchase orders, and a payment forwarded to Brightwater the next day.' };
    var b2 = CI.newBank(d, 'Depot 4 outage bank', [ent.outage.id], 2);
    b2.opened = { date: ago(3), reason: 'A public post predicted the outage, and then the cabling was found cut.' };
    d.banks.push(b2);
    b2.estimate.summary = 'The GridWatch Now post named Depot 4 before the outage. A Keystone Courier contractor was on site the night before.';
    CI.addEstimateItem(d, b2, { kind: 'ESTABLISHED', text: 'GridWatch Now announced the outage before it happened.', reportIds: 'R-0006' });
    CI.handOver(d, b2);
    var inv = CI.investigationFor(d, b2.id);
    inv.status = 'PLAN_WITH_LEGAL'; inv.investigator = 'Sample investigator';
    CI.savePlan(d, inv, { objective: 'Establish who cut the cabling and refer the matter.', outcome: 'REFERRAL', preparedBy: 'Sample investigator', actions: [{ text: 'Interview the Depot 4 night supervisor', owner: 'Investigator' }, { text: 'Prepare the badge and maintenance records for law enforcement', owner: 'Collection' }, { text: 'Brief the police liaison once legal clears the plan', owner: 'Security manager' }], legalStatus: 'WITH_LEGAL', reviewer: '', legalDate: '', comments: '', execStatus: 'NOT_STARTED', execOutcome: '' });
    return d;
  };
})(typeof window !== 'undefined' ? window : globalThis);
