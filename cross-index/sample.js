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
    E('harborst', 'location', '410 Harbor Street, Unit 6', ['410 Harbor St #6']);
    E('pobox', 'location', 'PO Box 2291, Dunmore');
    E('depot4', 'location', 'Northwind Depot 4');

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
      [['harbor', 'payer'], ['pobox', 'named'], ['invoice', 'subject of report']],
      [['harbor', 'pobox', 'based_at'], ['harbor', 'invoice', 'involved_in']]);
    R(5, 20, 'Corporate document', 'State business filing, Brightwater Holdings LLC', 'Fraud',
      'Annual filing for Brightwater lists Vera Linden as registered agent and 410 Harbor Street, Unit 6 as the business address.',
      [['bright', 'subject of report'], ['vera', 'named'], ['harborst', 'named']],
      [['vera', 'bright', 'employed_by', 'registered agent'], ['bright', 'harborst', 'based_at']]);
    R(6, 400, 'Corporate document', 'State business filing, Harborline Supply Co.', 'Fraud',
      'Older filing for Harborline names Orrin Platt as officer and gives 410 Harbor Street, Unit 6 as its former address.',
      [['harbor', 'subject of report'], ['orrin', 'named'], ['harborst', 'named']],
      [['orrin', 'harbor', 'employed_by', 'listed officer'], ['harbor', 'harborst', 'based_at', 'former address']]);
    R(7, 7, 'Staff report', 'AP clerk memo to finance manager', 'Fraud',
      'AP clerk reports an email from Vera Linden pressing for expedited payment to Harborline outside the normal approval cycle.',
      [['vera', 'author / poster'], ['harbor', 'recipient'], ['invoice', 'subject of report']],
      [['vera', 'invoice', 'involved_in'], ['harbor', 'invoice', 'involved_in']]);
    R(9, 9, 'Financial document', 'Bank transfer record, outgoing wire batch', 'Fraud',
      'Funds received from Northwind were forwarded within a day from Harborline to Brightwater Holdings.',
      [['harbor', 'payer'], ['bright', 'recipient']],
      [['harbor', 'bright', 'funded']]);
    var r6 = R(4, 4, 'Social post', 'https://social.example/gridwatch_now/post/5521', 'Sabotage',
      'GridWatch Now posts that Depot 4 "will be going dark soon"; the account is administered by Tobias Crane according to its profile page.',
      [['grid', 'author / poster'], ['depot4', 'named'], ['outage', 'subject of report'], ['tobias', 'named']],
      [['grid', 'outage', 'involved_in'], ['tobias', 'grid', 'member_of', 'profile lists him as admin']]);
    R(4, 4, 'Social post', 'https://other.example/p/88130 (repost of GridWatch post)', 'Sabotage',
      'Reshare of the GridWatch Now post on a second platform with the same text.',
      [['grid', 'author / poster'], ['outage', 'subject of report']],
      [['grid', 'outage', 'involved_in']], r6.id);
    R(2, 2, 'Staff report', 'Depot 4 maintenance log and badge export', 'Sabotage',
      'Conveyor power failure at Depot 4 traced to cut cabling; badge log shows a Keystone Courier contractor on site the night before.',
      [['depot4', 'present at'], ['keystone', 'named'], ['outage', 'subject of report']],
      [['keystone', 'depot4', 'based_at', 'badge log, night before'], ['keystone', 'outage', 'involved_in']]);
    R(8, 60, 'Corporate document', 'State business filing, Keystone Courier Partners', 'Coordinated damaging activity',
      'Keystone Courier Partners lists Mara Quill as director and 410 Harbor Street, Unit 6 as its registered address.',
      [['keystone', 'subject of report'], ['mara', 'named'], ['harborst', 'named']],
      [['mara', 'keystone', 'employed_by', 'director'], ['keystone', 'harborst', 'based_at']]);
    R(1, 1, 'Social post', 'https://social.example/tcrane_speaks/post/9012', 'Harassment of staff',
      'Tobias Crane posts a named attack on a Northwind dispatcher, Dana Whitcomb, and tags GridWatch Now.',
      [['tobias', 'author / poster'], ['dana', 'named'], ['grid', 'named']],
      [['tobias', 'dana', 'acted_against']]);
    R(10, 11, 'News / media', 'Local business-chamber event coverage', 'Coordinated damaging activity',
      'Article quotes Vera Linden and Mara Quill together at a chamber event; Orrin Platt is named as an attendee.',
      [['vera', 'named'], ['mara', 'named'], ['orrin', 'named']],
      [['vera', 'mara', 'communicated_with', 'appeared together on panel']]);
    R(12, 90, 'FOIA record', 'Municipal procurement file 24-117', 'Fraud',
      'Procurement file shows Keystone as prime contractor paying Brightwater Holdings as a subcontractor.',
      [['keystone', 'payer'], ['bright', 'recipient']],
      [['keystone', 'bright', 'funded']]);

    var bank = CI.newBank(d, 'Invoice scheme bank', [ent.invoice.id], 2);
    d.banks.push(bank);
    d.ui.bankId = bank.id;
    return d;
  };
})(typeof window !== 'undefined' ? window : globalThis);
