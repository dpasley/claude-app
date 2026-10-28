/* Fictional sample data for trying out the prototype. Every person, company, place and event here is invented.
 * The story: Northwind Logistics (the organisation the office serves) is hit by three overlapping matters over about two months:
 *   1. a vendor-invoice scheme run through shell companies that share an address and an agent,
 *   2. an outage at Depot 4 that was announced online before it happened, and a protest campaign that follows,
 *   3. a leak of depot schedules that feeds a harassment campaign against dispatchers.
 * Two quieter matters (a customs hold at Port Kessler, copper thefts) are in the data as noise and as a closed special bank.
 * Groups carry drawn logos (see portraits.js); individuals have the plain icon. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  /* The newer sample builds its own case charts. (The old hook stays so saves made with the first sample still open.) */
  CI.seedSampleCaseChart = function () { return false; };

  CI.sampleData = function () {
    var d = CI.emptyData();
    d.started = true; d.sampleLoaded = true;
    d.settings.heatThreshold = 4;
    CI.addSuggestedLinkTypes(d); d.settings.suggestedTypes = true;
    var ago = function (n) { return CI.daysAgo(n); };
    var ok = function (res, what) { if (res && res.error) throw new Error('sample: ' + what + ': ' + res.error); return res; };

    /* ---------------- files ---------------- */
    var ent = {};
    function E(key, type, name, o) {
      o = o || {};
      var e = CI.addEntity(d, { type: type, name: name, aliases: o.aliases || [], notes: o.notes || '', details: o.details || '' });
      if (o.profile) e.profile = o.profile;
      if (o.logo) e.photo = CI.logo(o.logo);
      ent[key] = e; return e;
    }
    var SK = { fair: '#f1c9a5', light: '#e8b890', tan: '#d9a67c', olive: '#c68d63', brown: '#8a5a3c', deep: '#6b4429' };

    // --- individuals (16, one of them a deliberate duplicate) ---
    E('vera', 'individual', 'Vera Linden', { aliases: ['V. Linden', 'Vera M. Linden'], details: 'Registered agent for Brightwater Holdings',
      profile: { gender: 'Female', occupation: 'Registered agent', employer: 'Brightwater Holdings LLC', residence: 'Dunmore', languages: 'English', status: 'Active',
        description: 'Mid forties, shoulder-length brown hair, often seen in a navy suit.', role: 'Named agent for Brightwater; pressed Northwind accounts payable to rush Harborline invoices.' } });
    E('orrin', 'individual', 'Orrin Platt', { aliases: ['O. Platt'], details: 'Former Harborline officer; now officer of Cobalt Freight',
      profile: { gender: 'Male', occupation: 'Company officer', employer: 'Cobalt Freight Brokers', residence: 'Riverside', languages: 'English', status: 'Active',
        description: 'Early sixties, grey hair, wire glasses.', role: 'Listed officer of Harborline until last year; receives monthly transfers from Brightwater.' } });
    E('tobias', 'individual', 'Tobias Crane', { aliases: ['@tcrane_speaks'], details: 'Administers the GridWatch Now account',
      profile: { gender: 'Male', occupation: 'Online commentator', residence: 'Millbrook', languages: 'English', status: 'Active',
        role: 'Runs the GridWatch Now account; has posted a named attack on a Northwind dispatcher and a leaked shift schedule.' } });
    E('mara', 'individual', 'Mara Quill', { details: 'Director of Keystone Courier Partners',
      profile: { gender: 'Female', occupation: 'Company director', employer: 'Keystone Courier Partners', residence: 'Kessler', languages: 'English, Spanish', status: 'Active',
        role: 'Director of Keystone, which has a contractor presence at Depot 4 and shares an address with two other companies of interest.' } });
    E('dana', 'individual', 'Dana Whitcomb', { details: 'Northwind dispatcher, Depot 4 (staff)', notes: 'Internal staff. Target of the harassment campaign.',
      profile: { gender: 'Female', occupation: 'Dispatcher', employer: 'Northwind Logistics', residence: 'Kessler', languages: 'English', status: 'Active', role: 'Subject of online harassment; staff member, not a subject of enquiry.' } });
    E('elias', 'individual', 'Elias Moreno', { details: 'Accounts payable manager, Northwind (staff)',
      profile: { gender: 'Male', occupation: 'Accounts payable manager', employer: 'Northwind Logistics', residence: 'Kessler', status: 'Active', role: 'Approved two of the Harborline invoices after hours.' } });
    E('priya', 'individual', 'Priya Raman', { details: 'Accounts payable clerk, Northwind (staff)',
      profile: { gender: 'Female', occupation: 'Accounts payable clerk', employer: 'Northwind Logistics', residence: 'Kessler', status: 'Active', role: 'Raised the first alarm about the Harborline invoices.' } });
    E('gordon', 'individual', 'Gordon Tully', { details: 'Keystone site supervisor',
      profile: { gender: 'Male', occupation: 'Site supervisor', employer: 'Keystone Courier Partners', residence: 'Eastgate', status: 'Active', role: 'Badge log places him at Depot 4 the night before the outage.' } });
    E('hannah', 'individual', 'Hannah Ostrowski', { details: 'Property manager, Harbor Street business park',
      profile: { gender: 'Female', occupation: 'Property manager', residence: 'Kessler', status: 'Active', role: 'Manages the business park where three companies of interest are registered.' } });
    E('cal', 'individual', 'Cal Brandt', { details: 'Night supervisor, Depot 4 (staff)',
      profile: { gender: 'Male', occupation: 'Night supervisor', employer: 'Northwind Logistics', residence: 'Oakhaven', status: 'Active', role: 'Witness: let two men in Keystone vests into the cable room.' } });
    E('rosalind', 'individual', 'Rosalind Fenn', { aliases: ['R. Fenn'], details: 'Attorney and filing agent, Fenn & Associates',
      profile: { gender: 'Female', occupation: 'Attorney', employer: 'Fenn & Associates', residence: 'Kessler', languages: 'English, French', status: 'Active', role: 'Files the incorporation papers for several companies of interest.' } });
    E('jonas', 'individual', 'Jonas Weir', { details: 'Organiser, Dark Grid Collective',
      profile: { gender: 'Male', occupation: 'Organiser', employer: 'Dark Grid Collective', residence: 'Millbrook', languages: 'English', status: 'Active', role: 'Publicly leads the Dark Grid campaign against Northwind depots.' } });
    E('teodora', 'individual', 'Teodora Banks', { details: 'Reporter, Kessler Ledger',
      profile: { gender: 'Female', occupation: 'Journalist', employer: 'Kessler Ledger', residence: 'Kessler', status: 'Active', role: 'Reports on Northwind’s contractors; says she has a source inside Northwind finance.' } });
    E('marcus', 'individual', 'Marcus Ellery', { details: 'Former Northwind scheduler, dismissed',
      profile: { gender: 'Male', occupation: 'Former scheduler', employer: 'Northwind Logistics (until five months ago)', residence: 'Oakhaven', status: 'Active', role: 'Dismissed after a dispute; his old account exported the schedule that was leaked.' } });
    E('sunil', 'individual', 'Sunil Desai', { details: 'Security badge administrator, Northwind (staff)',
      profile: { gender: 'Male', occupation: 'Badge administrator', employer: 'Northwind Logistics', residence: 'Lakeview', status: 'Active', role: 'Issued the override that let a contractor badge open the cable room.' } });
    E('hannah2', 'individual', 'Hannah Ostrowski', { details: 'Leasing contact, Eastgate rail yard',
      profile: { occupation: 'Leasing agent', residence: 'Eastgate', status: 'Unknown', role: 'The same name as the Harbor Street property manager. Not yet established whether it is the same person.' } });

    var BORN = { vera: ['1981-03-14', 'Dunmore'], orrin: ['1963-11-02', 'Riverside'], tobias: ['1990-07-21', 'Millbrook'], mara: ['1978-05-30', 'Kessler'], dana: ['1989-01-09', 'Kessler'], elias: ['1975-09-17', 'Kessler'], priya: ['1992-12-04', 'Kessler'], gordon: ['1984-06-25', 'Eastgate'], hannah: ['1986-02-18', 'Kessler'], cal: ['1980-10-11', 'Oakhaven'], rosalind: ['1971-08-08', 'Kessler'], jonas: ['1987-04-27', 'Millbrook'], teodora: ['1983-03-03', 'Kessler'], marcus: ['1979-12-30', 'Oakhaven'], sunil: ['1982-09-05', 'Lakeview'] };
    Object.keys(BORN).forEach(function (k) { ent[k].profile.dob = BORN[k][0]; ent[k].profile.pob = BORN[k][1]; });

    // --- groups (14) ---
    E('bright', 'group', 'Brightwater Holdings LLC', { aliases: ['Brightwater'], details: 'Holding company, Harbor Street business park', logo: 'brightwater',
      profile: { kind: 'Company', status: 'Active', hq: 'Kessler', operates: 'Fenwick County', leadership: 'Vera Linden (registered agent)', size: 'No staff on site', purpose: 'Stated as property and equipment leasing.', role: 'End point of the money in the invoice scheme.' } });
    E('harbor', 'group', 'Harborline Supply Co.', { aliases: ['Harborline'], details: 'Vendor paid by Northwind', logo: 'harborline',
      profile: { kind: 'Company', status: 'Active', hq: 'Dunmore', leadership: 'Orrin Platt (former officer)', size: 'Unknown', purpose: 'Stated as industrial supplies.', role: 'The vendor whose invoices are in question.' } });
    E('grid', 'group', 'GridWatch Now', { aliases: ['@gridwatch_now'], details: 'Social media account', notes: 'Social media account.', logo: 'gridwatch',
      profile: { kind: 'Social media account', status: 'Active', operates: 'Online', leadership: 'Tobias Crane (administrator)', size: 'About 9,000 followers', purpose: 'Posts about infrastructure failures.', role: 'Announced the Depot 4 outage before it happened.' } });
    E('keystone', 'group', 'Keystone Courier Partners', { aliases: ['Keystone'], details: 'Courier contractor with access to Depot 4', logo: 'keystone',
      profile: { kind: 'Company', status: 'Active', hq: 'Kessler', operates: 'Fenwick County, Port of Kessler', leadership: 'Mara Quill (director)', size: '40 to 60 drivers', purpose: 'Courier and yard services.', role: 'Contractor on site the night before the outage.' } });
    E('northwind', 'group', 'Northwind Logistics', { aliases: ['Northwind'], details: 'The organisation this office serves', logo: 'northwind',
      profile: { kind: 'Company', status: 'Active', hq: 'Kessler', operates: 'Fenwick County', size: 'About 2,400 staff', purpose: 'Freight and distribution.', role: 'The client. Most reports concern its payments, depots and staff.' } });
    E('darkgrid', 'group', 'Dark Grid Collective', { aliases: ['Dark Grid'], details: 'Protest movement against Northwind depots', logo: 'darkgrid',
      profile: { kind: 'Movement', status: 'Active', operates: 'Fenwick County', leadership: 'Jonas Weir (organiser)', size: 'Around 30 active members', purpose: 'Stated aim: “turn the lights out” on Northwind.', role: 'Announced actions against Depot 4, Depot 7 and headquarters.' } });
    E('meridian', 'group', 'Meridian Staffing Group', { aliases: ['Meridian'], details: 'Temporary labour supplier to Depot 4', logo: 'meridian',
      profile: { kind: 'Company', status: 'Active', hq: 'Kessler', operates: 'Fenwick County', size: 'About 200 temps', purpose: 'Temporary and seasonal labour.', role: 'Temps with badges used outside their shifts.' } });
    E('fenn', 'group', 'Fenn & Associates', { details: 'Law and company-filing firm', logo: 'fenn',
      profile: { kind: 'Law firm', status: 'Active', hq: 'Kessler', leadership: 'Rosalind Fenn (partner)', size: 'Six lawyers', purpose: 'Company formation and filing.', role: 'Agent for several of the companies of interest.' } });
    E('ironbridge', 'group', 'Ironbridge Maintenance LLC', { details: 'Maintenance contractor, Depot 4', logo: 'ironbridge',
      profile: { kind: 'Company', status: 'Active', hq: 'Riverside', operates: 'Depots 4 and 7', size: 'About 25', purpose: 'Electrical and conveyor maintenance.', role: 'Billed for a cable inspection with no signed work order.' } });
    E('chamber', 'group', 'Lakeshore Chamber of Commerce', { aliases: ['the Chamber'], details: 'Business association', logo: 'chamber',
      profile: { kind: 'Association', status: 'Active', hq: 'Kessler', size: '300 member firms', purpose: 'Business networking and advocacy.', role: 'Events where several people of interest were seen together.' } });
    E('bank', 'group', 'First Lakeshore Bank & Trust', { aliases: ['First Lakeshore'], details: 'Bank used by several of the companies', logo: 'bank',
      profile: { kind: 'Bank', status: 'Active', hq: 'Kessler', purpose: 'Retail and commercial banking.', role: 'Holds the accounts the invoice money passed through.' } });
    E('pinnacle', 'group', 'Pinnacle Consulting Partners', { aliases: ['Pinnacle'], details: 'Consultancy that invoices Northwind', logo: 'pinnacle',
      profile: { kind: 'Company', status: 'Active', hq: 'Kessler', size: 'Unknown', purpose: 'Stated as management consulting.', role: 'Invoices Northwind for work with no deliverables.' } });
    E('cobalt', 'group', 'Cobalt Freight Brokers', { aliases: ['Cobalt'], details: 'Freight broker; fuel cards; Port Kessler', logo: 'cobalt',
      profile: { kind: 'Company', status: 'Active', hq: 'Riverside', operates: 'Port of Kessler', leadership: 'Orrin Platt (officer)', size: 'About 15', purpose: 'Freight brokerage.', role: 'Handled the held containers; fuel cards issued to its drivers.' } });
    E('ledger', 'group', 'Kessler Ledger', { details: 'Local newspaper', notes: 'No logo recorded yet.',
      profile: { kind: 'Newspaper', status: 'Active', hq: 'Kessler', size: 'Newsroom of 20', purpose: 'Local news.', role: 'Source of several media reports.' } });

    // --- areas (13) ---
    E('kessler', 'area', 'Kessler', { details: 'City where Northwind is headquartered', profile: { kind: 'City', within: 'Fenwick County', population: '640,000', role: 'Home city of most people in the data.' } });
    E('harborst', 'area', 'Harbor Street business park', { aliases: ['Harbor St park'], details: 'Shared address of three companies', profile: { kind: 'Neighbourhood', within: 'Kessler', sites: 'Units 4, 7 and 9 are leased to companies of interest.', role: 'Brightwater, Keystone and Pinnacle are all registered here.' } });
    E('dunmore', 'area', 'Dunmore', { details: 'Small town; PO box on the invoices', profile: { kind: 'City', within: 'Fenwick County', population: '12,000', role: 'Town of the PO box used on every Harborline invoice.' } });
    E('depot4', 'area', 'Northwind Depot 4', { details: 'Northwind distribution depot', profile: { kind: 'Campus', within: 'Kessler', sites: 'Conveyor hall, cable room, main gate.', role: 'Site of the outage and the first protest actions.' } });
    E('depot7', 'area', 'Northwind Depot 7', { details: 'Northwind distribution depot', profile: { kind: 'Campus', within: 'Eastgate', sites: 'Loading dock and supervisors’ office.', role: 'Where the threatening letters were received.' } });
    E('hq', 'area', 'Ashby Tower', { aliases: ['Northwind headquarters'], details: 'Northwind headquarters', profile: { kind: 'Campus', within: 'Kessler', role: 'Named by Dark Grid as the next target.' } });
    E('port', 'area', 'Port of Kessler', { details: 'Container port', profile: { kind: 'Neighbourhood', within: 'Kessler', authority: 'Kessler Port Authority', role: 'Customs hold and the late-night fuel purchases.' } });
    E('lakeview', 'area', 'Lakeview campus', { details: 'Northwind training campus', profile: { kind: 'Campus', within: 'Fenwick County', role: 'Where badge administration is based.' } });
    E('millbrook', 'area', 'Millbrook', { details: 'Residential neighbourhood', profile: { kind: 'Neighbourhood', within: 'Kessler', role: 'Where Crane and Weir live and meet.' } });
    E('fenwick', 'area', 'Fenwick County', { details: 'County around Kessler', profile: { kind: 'Region', population: '1.1 million', authority: 'County sheriff', role: 'The wider region of all the matters.' } });
    E('riverside', 'area', 'Riverside Industrial District', { aliases: ['Riverside'], details: 'Industrial zone', profile: { kind: 'Neighbourhood', within: 'Kessler', role: 'Cobalt and Ironbridge are based here; copper thefts occurred here.' } });
    E('eastgate', 'area', 'Eastgate rail yard', { aliases: ['Eastgate'], details: 'Rail yard and light industry', profile: { kind: 'Neighbourhood', within: 'Fenwick County', role: 'Copper theft reports; second Hannah Ostrowski.' } });
    E('oakhaven', 'area', 'Oakhaven', { details: 'Suburb', profile: { kind: 'Neighbourhood', within: 'Kessler', role: 'Home area of two staff members and a former scheduler.' } });

    // --- subjects (12) ---
    E('invoice', 'subject', 'Q3 vendor invoice scheme', { details: 'Invoices paid without purchase orders', profile: { category: 'Fraud', first: ago(46), status: 'Open', description: 'Invoices from Harborline and Pinnacle paid outside the normal approval cycle.', role: 'Largest matter by money.' } });
    E('outage', 'subject', 'Depot 4 equipment outage', { details: 'Conveyor power failure, cabling cut', profile: { category: 'Sabotage', first: ago(12), status: 'Open', description: 'Conveyor power failed after cabling was cut; announced online sixteen days ago.', role: 'The event the Depot 4 bank is about.' } });
    E('shells', 'subject', 'Shell company network', { details: 'Companies sharing address, agent and contacts', profile: { category: 'Corporate structure', first: ago(22), status: 'Watching', description: 'Harborline, Brightwater, Pinnacle share contact details and a filing agent.', role: 'Explains how the invoice money moves.' } });
    E('badge', 'subject', 'Depot access badge misuse', { details: 'Badges used outside shifts', profile: { category: 'Access control', first: ago(31), status: 'Open', description: 'Temp and contractor badges opening doors outside their shifts.', role: 'How people reached the cable room.' } });
    E('harass', 'subject', 'Harassment campaign against dispatchers', { details: 'Named online attacks on staff', profile: { category: 'Harassment', first: ago(15), status: 'Open', description: 'A dispatcher was named, targeted and then had her schedule posted.', role: 'Staff safety.' } });
    E('leak', 'subject', 'Leak of depot schedules', { details: 'Internal shift schedule posted online', profile: { category: 'Information leak', first: ago(4), status: 'Open', description: 'A Depot 4 shift schedule appeared on a public account.', role: 'Feeds the harassment campaign.' } });
    E('bidrig', 'subject', 'Procurement bid rigging', { details: 'Prime contractor paying a related subcontractor', profile: { category: 'Fraud', first: ago(34), status: 'Watching', description: 'Municipal file shows a prime contractor paying a company tied to its own address.', role: 'May show the same people working in public contracts.' } });
    E('fuel', 'subject', 'Fuel card misuse', { details: 'Night purchases at Port Kessler', profile: { category: 'Theft', first: ago(14), status: 'Watching', description: 'Eleven cards used at stations around the port between midnight and 4 a.m.', role: 'Possible fuel resale.' } });
    E('cargo', 'subject', 'Port Kessler cargo diversion', { details: 'Customs hold on three containers', profile: { category: 'Theft', first: ago(50), status: 'Closed', description: 'Three containers held for manifest mismatch.', role: 'Checked and found to be a clerical error.' } });
    E('copper', 'subject', 'Copper wire theft', { details: 'Thefts at rail and industrial sites', profile: { category: 'Theft', first: ago(43), status: 'Watching', description: 'Repeated copper theft in Eastgate and Riverside.', role: 'Background; no tie to the other matters so far.' } });
    E('protest', 'subject', 'Dark Grid protest campaign', { details: 'Announced actions against Northwind sites', profile: { category: 'Protest and disruption', first: ago(27), status: 'Open', description: 'A series of announced night actions against Northwind depots and headquarters.', role: 'The fastest-growing matter this fortnight.' } });
    E('threats', 'subject', 'Threatening letters to Depot 7', { details: 'Two letters to supervisors', profile: { category: 'Threats', first: ago(20), status: 'Open', description: 'Two anonymous letters threatening supervisors at Depot 7.', role: 'Author unknown.' } });

    /* ---------------- reports ---------------- */
    var rep = {};
    function R(key, daysAgo, eventAgo, sourceType, sourceRef, basis, summary, people, links, dupOf) {
      var r = {
        id: CI.nextId(d, 'report'), received: ago(daysAgo), eventDate: eventAgo == null ? '' : ago(eventAgo),
        sourceType: sourceType, sourceRef: sourceRef, archiveLoc: 'sample data', originalText: '', hash: '', hashAt: '',
        dupOf: dupOf || '', subject: String(summary).split(/[.;]/)[0].slice(0, 80), summary: summary, basis: basis, entities: [], created: CI.today(), updated: CI.today()
      };
      d.reports.push(r); rep[key] = r;
      people.forEach(function (p) { var m = CI.addEntityToReport(d, r.id, ent[p[0]].id, p[1], !!p[2], p[3] || ''); if (m) throw new Error('sample: ' + key + ' ' + p[0] + ': ' + m); });
      (links || []).forEach(function (l) { ok(CI.addLink(d, { reportId: r.id, from: ent[l[0]].id, to: ent[l[1]].id, type: l[2], note: l[3] || '' }), key + ' ' + l.slice(0, 3).join(' ')); });
      return r;
    }

    // ---- matter 1: the invoice scheme and its shells ----
    R('bw', 62, 120, 'Corporate document', 'State business filing, Brightwater Holdings LLC', 'Fraud',
      'Annual filing for Brightwater lists Vera Linden as registered agent and the Harbor Street business park as the business address.',
      [['bright', 'subject'], ['vera', 'named', true, 'Same Vera Linden as the Dunmore filings? Spelling differs.'], ['harborst', 'named']],
      [['vera', 'bright', 'AGENT_FOR'], ['bright', 'harborst', 'REGISTERED_AT']]);
    R('hl', 60, 400, 'Corporate document', 'State business filing, Harborline Supply Co.', 'Fraud',
      'Older filing for Harborline names Orrin Platt as officer and gives the Harbor Street business park as its former address.',
      [['harbor', 'subject'], ['orrin', 'named'], ['harborst', 'named']],
      [['orrin', 'harbor', 'OFFICER_OF'], ['harbor', 'harborst', 'REGISTERED_AT', 'former address']]);
    R('pin', 58, 45, 'Corporate document', 'State business filing, Pinnacle Consulting Partners', 'Fraud',
      'Filing for Pinnacle names Rosalind Fenn as agent and gives the Harbor Street business park as its address.',
      [['pinnacle', 'subject'], ['rosalind', 'named'], ['harborst', 'named']],
      [['rosalind', 'pinnacle', 'AGENT_FOR'], ['pinnacle', 'harborst', 'REGISTERED_AT']]);
    R('fenn', 57, 380, 'Corporate document', 'Fenn & Associates formation records', 'Fraud',
      'Records for Fenn & Associates show Rosalind Fenn as partner, and list Harborline and Brightwater among the firm’s filing clients.',
      [['fenn', 'subject'], ['rosalind', 'named'], ['harbor', 'named'], ['bright', 'named']],
      [['rosalind', 'fenn', 'OFFICER_OF', 'partner'], ['fenn', 'harbor', 'AGENT_FOR'], ['fenn', 'bright', 'AGENT_FOR']]);
    R('key', 55, 60, 'Corporate document', 'State business filing, Keystone Courier Partners', 'Coordinated damaging activity',
      'Keystone Courier Partners lists Mara Quill as director and the Harbor Street business park as its registered address.',
      [['keystone', 'subject'], ['mara', 'named'], ['harborst', 'named']],
      [['mara', 'keystone', 'OFFICER_OF', 'director'], ['keystone', 'harborst', 'REGISTERED_AT']]);
    R('prop', 50, 50, 'Investigator report', 'Property records search, Harbor Street business park', 'Fraud',
      'The business park is managed by Hannah Ostrowski; units 4, 7 and 9 are leased to Brightwater, Keystone and Pinnacle.',
      [['hannah', 'subject'], ['harborst', 'subject'], ['bright', 'named'], ['keystone', 'named'], ['pinnacle', 'named']],
      [['hannah', 'harborst', 'BASED_IN', 'property manager'], ['bright', 'harborst', 'RENTS', 'unit 4'], ['keystone', 'harborst', 'RENTS', 'unit 7'], ['pinnacle', 'harborst', 'RENTS', 'unit 9']]);
    R('ledger', 46, 45, 'Financial document', 'AP ledger export, Harborline invoices 1041-1047', 'Fraud',
      'Seven consecutive invoices from Harborline Supply paid in two weeks; all list the same PO box in Dunmore and have no purchase order numbers.',
      [['harbor', 'payer'], ['dunmore', 'named'], ['invoice', 'subject'], ['northwind', 'payer']],
      [['harbor', 'dunmore', 'BASED_IN', 'PO box'], ['harbor', 'invoice', 'INVOLVED_IN'], ['northwind', 'harbor', 'PAYS']]);
    R('memo', 44, 44, 'Staff report', 'AP clerk memo to finance manager', 'Fraud',
      'AP clerk reports an email from Vera Linden pressing for expedited payment to Harborline outside the normal approval cycle.',
      [['priya', 'author'], ['elias', 'recipient'], ['vera', 'named'], ['harbor', 'named'], ['invoice', 'subject']],
      [['vera', 'invoice', 'INVOLVED_IN'], ['priya', 'invoice', 'WITNESS_TO'], ['priya', 'elias', 'WORKS_FOR', 'reports to']]);
    R('wire', 40, 40, 'Financial document', 'Bank transfer record, outgoing wire batch', 'Fraud',
      'Funds received from Northwind were forwarded within a day from Harborline to Brightwater Holdings; both accounts are at First Lakeshore.',
      [['harbor', 'payer'], ['bright', 'recipient'], ['bank', 'named']],
      [['harbor', 'bright', 'PAYS', 'within a day'], ['harbor', 'bank', 'USES'], ['bright', 'bank', 'USES']]);
    R('appr', 38, 38, 'Staff report', 'AP approval audit trail', 'Fraud',
      'Elias Moreno approved two Harborline invoices himself, after hours; Priya Raman had flagged both.',
      [['elias', 'subject'], ['priya', 'named'], ['harbor', 'named'], ['invoice', 'subject']],
      [['elias', 'invoice', 'INVOLVED_IN', 'approver']]);
    R('foia', 34, 100, 'FOIA record', 'Municipal procurement file 24-117', 'Fraud',
      'Procurement file shows Keystone as prime contractor paying Brightwater Holdings as a subcontractor.',
      [['keystone', 'payer'], ['bright', 'recipient'], ['bidrig', 'subject']],
      [['keystone', 'bright', 'PAYS', 'subcontract'], ['keystone', 'bidrig', 'INVOLVED_IN']]);
    R('news1', 33, 33, 'News / media', 'Kessler Ledger, “Who does Northwind pay?”', 'Fraud',
      'Teodora Banks reports on Northwind’s contractor spending and quotes Mara Quill defending Keystone’s public contract.',
      [['teodora', 'author'], ['ledger', 'author'], ['mara', 'named'], ['keystone', 'named'], ['northwind', 'subject']],
      [['teodora', 'ledger', 'WORKS_FOR']]);
    R('pinv', 30, 30, 'Financial document', 'AP ledger, Pinnacle consulting invoices', 'Fraud',
      'Four Pinnacle invoices for “strategy consulting” were paid; none names a deliverable or a Northwind sponsor.',
      [['pinnacle', 'payer'], ['northwind', 'payer'], ['invoice', 'subject']],
      [['northwind', 'pinnacle', 'PAYS'], ['pinnacle', 'invoice', 'INVOLVED_IN']]);
    R('orrinpay', 28, 29, 'Financial document', 'Bank statement extract, First Lakeshore account', 'Fraud',
      'Brightwater makes a monthly transfer to an account in the name of Orrin Platt, who left Harborline last year.',
      [['bright', 'payer'], ['orrin', 'recipient'], ['bank', 'named']],
      [['bright', 'orrin', 'PAYS', 'monthly']]);
    R('audit', 22, 22, 'Staff report', 'Internal audit note, vendor master file', 'Fraud',
      'Harborline, Brightwater and Pinnacle share a contact phone number and mailing address in the vendor master file.',
      [['harbor', 'subject'], ['bright', 'subject'], ['pinnacle', 'subject'], ['shells', 'subject']],
      [['harbor', 'bright', 'LINKED_WITH', 'shared contact details'], ['bright', 'pinnacle', 'LINKED_WITH', 'shared contact details'], ['harbor', 'shells', 'INVOLVED_IN'], ['bright', 'shells', 'INVOLVED_IN'], ['pinnacle', 'shells', 'INVOLVED_IN']]);
    R('bankco', 19, 19, 'Financial document', 'First Lakeshore signature cards', 'Fraud',
      'Vera Linden and Rosalind Fenn are the two signatories on the Pinnacle account.',
      [['bank', 'subject'], ['vera', 'named'], ['rosalind', 'named'], ['pinnacle', 'named']],
      [['vera', 'rosalind', 'KNOWS', 'co-signatories'], ['pinnacle', 'bank', 'USES']]);
    R('priyaint', 18, 18, 'Investigator report', 'Interview with Priya Raman', 'Fraud',
      'Priya says Elias told her not to question Vera Linden’s invoices and that the two have known each other for years.',
      [['priya', 'author'], ['elias', 'named'], ['vera', 'named']],
      [['elias', 'vera', 'KNOWS', 'long acquaintance per Raman']]);
    R('cobaltf', 15, 20, 'Corporate document', 'State business filing, Cobalt Freight Brokers', 'Theft',
      'Cobalt Freight Brokers lists Orrin Platt as officer and the Riverside Industrial District as its address.',
      [['cobalt', 'subject'], ['orrin', 'named'], ['riverside', 'named']],
      [['orrin', 'cobalt', 'OFFICER_OF'], ['cobalt', 'riverside', 'REGISTERED_AT']]);
    R('fuelc', 14, 14, 'Financial document', 'Fuel card statement, Cobalt fleet', 'Theft',
      'Eleven fuel cards issued to Cobalt-contracted drivers were used at stations around the Port of Kessler between midnight and 4 a.m.',
      [['cobalt', 'subject'], ['port', 'named'], ['fuel', 'subject']],
      [['cobalt', 'fuel', 'INVOLVED_IN'], ['fuel', 'port', 'OCCURS_IN']]);
    R('pinv2', 9, 9, 'Staff report', 'AP hold notice', 'Fraud',
      'Priya Raman holds a fifth Pinnacle invoice because it again lacks a deliverable.',
      [['priya', 'author'], ['pinnacle', 'named'], ['invoice', 'subject']],
      [['pinnacle', 'invoice', 'INVOLVED_IN']]);
    R('pinv3', 2, 2, 'Financial document', 'AP ledger, Pinnacle invoice 5', 'Fraud',
      'A sixth Pinnacle invoice arrives, this time for exactly the amount held back on the fifth.',
      [['pinnacle', 'payer'], ['northwind', 'recipient'], ['invoice', 'subject']],
      [['pinnacle', 'northwind', 'ASSOCIATED_WITH', 'invoice resubmitted']]);

    // ---- matter 2: Depot 4, the outage and the campaign ----
    R('gwfence', 40, 40, 'Social post', 'https://social.example/gridwatch_now/post/5102', 'Sabotage',
      'GridWatch Now posts a photo of the Depot 4 fence under the words “rotting from inside”.',
      [['grid', 'author'], ['depot4', 'named']],
      [['grid', 'depot4', 'ACTIVE_IN']]);
    R('temps', 36, 36, 'Staff report', 'Depot 4 labour supply schedule', 'Sabotage',
      'Meridian Staffing supplies three temporary workers to Depot 4; their badges were issued by Sunil Desai.',
      [['meridian', 'subject'], ['depot4', 'named'], ['sunil', 'named'], ['northwind', 'named']],
      [['meridian', 'northwind', 'WORKS_FOR', 'temporary labour'], ['sunil', 'northwind', 'WORKS_FOR'], ['meridian', 'depot4', 'ACTIVE_IN']]);
    R('badgeaud', 31, 31, 'Staff report', 'Badge audit, Depot 4 gate', 'Sabotage',
      'Two Meridian temp badges were used at the Depot 4 gate outside any scheduled shift.',
      [['meridian', 'subject'], ['depot4', 'present'], ['badge', 'subject']],
      [['meridian', 'badge', 'INVOLVED_IN'], ['badge', 'depot4', 'OCCURS_IN']]);
    R('dgcall', 27, 27, 'Social post', 'https://social.example/darkgrid/post/301', 'Coordinated damaging activity',
      'Jonas Weir posts a call for a “lights out for Northwind” night action and tags Dark Grid Collective.',
      [['jonas', 'author'], ['darkgrid', 'author'], ['protest', 'subject'], ['northwind', 'named']],
      [['jonas', 'darkgrid', 'MEMBER_OF', 'organiser'], ['darkgrid', 'protest', 'INVOLVED_IN'], ['darkgrid', 'northwind', 'ACTED_AGAINST']]);
    R('news2', 25, 25, 'News / media', 'Kessler Ledger, “Who is Dark Grid?”', 'Coordinated damaging activity',
      'Teodora Banks interviews Jonas Weir about Dark Grid; Tobias Crane of GridWatch Now is named as an occasional spokesperson.',
      [['teodora', 'author'], ['jonas', 'named'], ['tobias', 'named'], ['darkgrid', 'subject'], ['grid', 'named'], ['millbrook', 'named']],
      [['tobias', 'jonas', 'KNOWS', 'spokesperson for Dark Grid'], ['grid', 'darkgrid', 'LINKED_WITH'], ['jonas', 'millbrook', 'LIVES_IN']]);
    R('letter1', 20, 20, 'Staff report', 'Depot 7 supervisor report', 'Credible violence',
      'A supervisor at Depot 7 receives an unsigned letter threatening harm if “the lights are not turned out”.',
      [['threats', 'subject'], ['depot7', 'named']], []);
    var gwpost = R('gwpost', 16, 16, 'Social post', 'https://social.example/gridwatch_now/post/5521', 'Sabotage',
      'GridWatch Now posts that Depot 4 “will be going dark soon”; the account is administered by Tobias Crane according to its profile page.',
      [['grid', 'author'], ['depot4', 'named'], ['outage', 'subject'], ['tobias', 'named']],
      [['grid', 'outage', 'INVOLVED_IN'], ['tobias', 'grid', 'MEMBER_OF', 'profile admin']]);
    R('gwrepost', 16, 16, 'Social post', 'https://other.example/p/88130 (repost of GridWatch post)', 'Sabotage',
      'Reshare of the GridWatch Now post on a second platform with the same text.',
      [['grid', 'author'], ['outage', 'subject']],
      [['grid', 'outage', 'INVOLVED_IN']], gwpost.id);
    R('attack', 15, 15, 'Social post', 'https://social.example/tcrane_speaks/post/9012', 'Harassment of staff',
      'Tobias Crane posts a named attack on a Northwind dispatcher, Dana Whitcomb, and tags GridWatch Now.',
      [['tobias', 'author'], ['dana', 'named'], ['grid', 'named'], ['harass', 'subject']],
      [['tobias', 'dana', 'ACTED_AGAINST'], ['tobias', 'harass', 'INVOLVED_IN']]);
    R('dm', 14, 14, 'Staff report', 'Dana Whitcomb statement to security', 'Harassment of staff',
      'Dana Whitcomb reports unwanted messages to her personal phone that quote the online post.',
      [['dana', 'author'], ['harass', 'subject'], ['tobias', 'named']],
      [['dana', 'harass', 'VICTIM_OF']]);
    R('cable', 12, 12, 'Staff report', 'Depot 4 maintenance log and badge export', 'Sabotage',
      'Conveyor power failure at Depot 4 traced to cut cabling; the badge log shows a Keystone contractor and a Meridian temp on site the night before.',
      [['depot4', 'present'], ['keystone', 'named'], ['meridian', 'named'], ['outage', 'subject'], ['gordon', 'present']],
      [['outage', 'depot4', 'OCCURS_IN'], ['keystone', 'outage', 'INVOLVED_IN', 'contractor on site'], ['gordon', 'depot4', 'SEEN_AT', 'badge log'], ['gordon', 'keystone', 'WORKS_FOR']]);
    R('witness', 11, 11, 'Staff report', 'Statement of Cal Brandt, night supervisor', 'Sabotage',
      'Cal Brandt says two men in Keystone vests asked for the cable room at about 2 a.m. and he let them in because the gate card was valid.',
      [['cal', 'author'], ['keystone', 'named'], ['depot4', 'present'], ['outage', 'subject']],
      [['cal', 'outage', 'WITNESS_TO'], ['cal', 'depot4', 'SEEN_AT', 'night supervisor']]);
    R('gwtold', 11, 11, 'Social post', 'https://social.example/gridwatch_now/post/5530', 'Sabotage',
      'GridWatch Now posts “told you” with a photo of the dark Depot 4 conveyor hall.',
      [['grid', 'author'], ['depot4', 'named'], ['outage', 'subject'], ['tobias', 'named']],
      [['grid', 'depot4', 'ACTIVE_IN']]);
    R('override', 10, 10, 'Investigator report', 'Badge system override log', 'Sabotage',
      'The badge used by the Keystone contractor was activated under an override entered by Sunil Desai.',
      [['sunil', 'subject'], ['gordon', 'named'], ['badge', 'subject'], ['keystone', 'named']],
      [['sunil', 'gordon', 'COMMUNICATED_WITH', 'override entered the day before'], ['sunil', 'badge', 'INVOLVED_IN']]);
    R('ironb', 9, 9, 'Financial document', 'Ironbridge invoice 7712, Depot 4 cable inspection', 'Sabotage',
      'Ironbridge Maintenance billed Northwind for a cable inspection at Depot 4 the week before the outage; the work order is unsigned.',
      [['ironbridge', 'payer'], ['depot4', 'named'], ['outage', 'subject'], ['northwind', 'recipient']],
      [['ironbridge', 'northwind', 'WORKS_FOR'], ['ironbridge', 'outage', 'INVOLVED_IN', 'unsigned work order']]);
    R('meet', 7, 7, 'Investigator report', 'Observation, Millbrook café', 'Coordinated damaging activity',
      'Mara Quill and Jonas Weir are seen meeting at a Millbrook café; Gordon Tully joins them for part of it.',
      [['mara', 'subject'], ['jonas', 'subject'], ['gordon', 'present'], ['millbrook', 'named']],
      [['mara', 'jonas', 'KNOWS', 'seen meeting'], ['gordon', 'jonas', 'KNOWS', 'joined meeting'], ['mara', 'millbrook', 'SEEN_AT']]);
    R('phase2', 6, 6, 'Social post', 'https://social.example/darkgrid/post/344', 'Coordinated damaging activity',
      'Dark Grid announces “phase two” of its campaign naming Depot 4 and Depot 7.',
      [['darkgrid', 'author'], ['protest', 'subject'], ['depot4', 'named'], ['depot7', 'named']],
      [['darkgrid', 'protest', 'INVOLVED_IN'], ['darkgrid', 'depot4', 'ACTIVE_IN'], ['darkgrid', 'depot7', 'ACTIVE_IN']]);
    R('letter2', 5, 5, 'Staff report', 'Depot 7 second letter', 'Credible violence',
      'A second letter at Depot 7 repeats the phrase “lights out” from Dark Grid’s slogan.',
      [['threats', 'subject'], ['depot7', 'named'], ['darkgrid', 'named']],
      [['darkgrid', 'threats', 'SUSPECTED_IN', 'matching slogan'], ['threats', 'depot7', 'OCCURS_IN']]);
    R('sched', 4, 4, 'Social post', 'https://social.example/tcrane_speaks/post/9120', 'Harassment of staff',
      'Tobias Crane posts a photo of the Depot 4 shift schedule with Dana Whitcomb’s shifts circled.',
      [['tobias', 'author'], ['dana', 'named'], ['depot4', 'named'], ['leak', 'subject'], ['harass', 'subject']],
      [['tobias', 'leak', 'INVOLVED_IN'], ['tobias', 'dana', 'ACTED_AGAINST'], ['leak', 'depot4', 'OCCURS_IN']]);
    R('marcusnews', 4, 150, 'News / media', 'Kessler Ledger, “Northwind scheduler dismissed”', 'Harassment of staff',
      'Teodora Banks reports that scheduler Marcus Ellery was dismissed after a dispute over overtime.',
      [['teodora', 'author'], ['marcus', 'subject'], ['northwind', 'named'], ['ledger', 'named']],
      [['marcus', 'northwind', 'WORKS_FOR', 'former employee']]);
    R('meta', 3, 3, 'Investigator report', 'Metadata analysis of the leaked schedule image', 'Harassment of staff',
      'The leaked schedule came from an export made by the Northwind account of Marcus Ellery, which was not disabled when he left.',
      [['marcus', 'subject'], ['leak', 'subject'], ['northwind', 'named'], ['depot4', 'named']],
      [['marcus', 'leak', 'INVOLVED_IN', 'export from his account']]);
    R('reply', 3, 3, 'Social post', 'https://social.example/tcrane_speaks/post/9144', 'Harassment of staff',
      'Tobias Crane publicly thanks Marcus Ellery for “the inside view”.',
      [['tobias', 'author'], ['marcus', 'named']],
      [['tobias', 'marcus', 'KNOWS', 'public exchange']]);
    R('gate', 2, 2, 'Staff report', 'Depot 4 gate sensor log', 'Sabotage',
      'The Depot 4 gate sensor was tampered with overnight; Cal Brandt found the cover removed at the start of his shift.',
      [['cal', 'author'], ['depot4', 'present'], ['protest', 'subject']],
      [['protest', 'depot4', 'OCCURS_IN']]);
    R('hqpost', 1, 1, 'Social post', 'https://social.example/darkgrid/post/359', 'Coordinated damaging activity',
      'Dark Grid’s next post tags Ashby Tower with the words “next”.',
      [['darkgrid', 'author'], ['hq', 'named'], ['protest', 'subject']],
      [['darkgrid', 'hq', 'ACTIVE_IN']]);
    R('photo', 0, 0, 'Staff report', 'Depot 4 fence camera log', 'Sabotage',
      'Marcus Ellery is recorded photographing the Depot 4 fence from the road at dusk.',
      [['marcus', 'subject'], ['depot4', 'present']],
      [['marcus', 'depot4', 'SEEN_AT', 'camera log']]);

    // ---- quieter matters: customs hold, copper, and some background ----
    R('hold', 50, 52, 'Staff report', 'Customs hold notice, three containers', 'Theft',
      'Three containers are held at the Port of Kessler for manifest mismatch; Cobalt Freight handled all three.',
      [['cargo', 'subject'], ['port', 'named'], ['cobalt', 'named']],
      [['cobalt', 'cargo', 'INVOLVED_IN'], ['cargo', 'port', 'OCCURS_IN']]);
    R('holdrep', 47, 47, 'Investigator report', 'Review of the customs hold', 'Theft',
      'Review finds the manifests were mis-keyed by a clerk and corrected the same day; nothing was diverted.',
      [['cargo', 'subject'], ['cobalt', 'named'], ['port', 'named']], []);
    R('cu1', 43, 43, 'Staff report', 'Rail yard security report', 'Theft',
      'About 300 metres of copper cable were cut and taken from the Eastgate rail yard overnight.',
      [['copper', 'subject'], ['eastgate', 'named']],
      [['copper', 'eastgate', 'OCCURS_IN']]);
    R('cu2', 26, 26, 'News / media', 'Kessler Ledger, “Copper thieves strike again”', 'Theft',
      'Another copper theft is reported in the Riverside Industrial District; police suspect two unrelated crews.',
      [['copper', 'subject'], ['riverside', 'named'], ['ledger', 'named']],
      [['copper', 'riverside', 'OCCURS_IN']]);
    R('lease', 21, 21, 'Corporate document', 'Eastgate rail yard lease notice', 'Theft',
      'A lease notice for a warehouse at the Eastgate rail yard is signed by a Hannah Ostrowski as leasing agent.',
      [['hannah2', 'named'], ['eastgate', 'named']],
      [['hannah2', 'eastgate', 'BASED_IN', 'leasing agent']]);
    R('chamber1', 13, 13, 'News / media', 'Lakeshore Chamber luncheon coverage', 'Coordinated damaging activity',
      'The Chamber’s autumn luncheon photographs show Vera Linden, Mara Quill, Orrin Platt and Rosalind Fenn at the same table.',
      [['chamber', 'subject'], ['vera', 'named'], ['mara', 'named'], ['orrin', 'named'], ['rosalind', 'named']],
      [['vera', 'chamber', 'MEMBER_OF'], ['mara', 'chamber', 'MEMBER_OF']]);
    R('chamber2', 12, 12, 'News / media', 'Lakeshore Chamber newsletter', 'Coordinated damaging activity',
      'The newsletter quotes Mara Quill and Rosalind Fenn on a panel about contractor transparency.',
      [['chamber', 'subject'], ['mara', 'named'], ['rosalind', 'named'], ['teodora', 'named']], []);
    R('pobox', 5, 5, 'Staff report', 'Postal hold request, Dunmore', 'Fraud',
      'A clerk at the Dunmore post office says the Harborline PO box is collected weekly by a woman who gives the name Vera.',
      [['dunmore', 'subject'], ['harbor', 'named'], ['vera', 'named', true, 'First name only']],
      [['harbor', 'dunmore', 'BASED_IN']]);
    R('source', 3, 3, 'Investigator report', 'Call with Teodora Banks', 'Fraud',
      'Teodora Banks says an anonymous person inside Northwind finance has sent her copies of the Harborline invoices.',
      [['teodora', 'subject'], ['northwind', 'named'], ['invoice', 'subject']],
      [['teodora', 'invoice', 'WITNESS_TO']]);
    R('lakeview', 8, 8, 'Staff report', 'Badge office relocation memo', 'Sabotage',
      'Badge administration moves to the Lakeview campus; Sunil Desai keeps his override rights during the move.',
      [['sunil', 'subject'], ['lakeview', 'named'], ['badge', 'subject']],
      [['sunil', 'lakeview', 'BASED_IN']]);
    R('fenwickr', 24, 24, 'News / media', 'County business digest', 'Fraud',
      'The digest lists Brightwater, Harborline and Pinnacle among companies registered in Fenwick County with no listed staff.',
      [['fenwick', 'subject'], ['bright', 'named'], ['harbor', 'named'], ['pinnacle', 'named'], ['shells', 'subject']],
      [['bright', 'fenwick', 'WITHIN'], ['harbor', 'fenwick', 'WITHIN'], ['pinnacle', 'fenwick', 'WITHIN']]);
    R('kessnote', 35, 35, 'Staff report', 'Security briefing, headquarters', 'Coordinated damaging activity',
      'Headquarters security briefs on Depot 4, Depot 7 and Kessler site risks ahead of the winter peak.',
      [['kessler', 'subject'], ['hq', 'named'], ['depot4', 'named'], ['depot7', 'named'], ['oakhaven', 'named']], []);

    /* ---------------- file summaries and time lines ---------------- */
    function S(key, daysAgo, author, text, covers) { ok(CI.addSummary(d, { fileId: ent[key].id, date: ago(daysAgo), author: author, text: text, covers: covers.map(function (k) { return rep[k].id; }) }), 'summary ' + key); }
    function T(key, eventAgo, level, text, keys) { ok(CI.addTimeline(d, { fileId: ent[key].id, date: ago(eventAgo), level: level, text: text, reportIds: keys.map(function (k) { return rep[k].id; }) }), 'timeline ' + key); }
    S('vera', 30, 'Analyst Okafor', 'Vera Linden is the named agent for Brightwater and later appears pressing Northwind’s AP clerk to rush Harborline invoices. She is a co-signatory with Rosalind Fenn on the Pinnacle account.', ['bw', 'memo', 'bankco']);
    S('harbor', 40, 'Analyst Okafor', 'Harborline is a vendor with a Dunmore PO box that was formerly at the Harbor Street park. Seven invoices were paid in two weeks, and the money moved to Brightwater within a day.', ['hl', 'ledger', 'wire']);
    S('tobias', 8, 'Analyst Rhee', 'Tobias Crane administers GridWatch Now, which posted the Depot 4 prediction. He then posted a named attack on a dispatcher and later her schedule, and publicly thanked a former scheduler.', ['gwpost', 'attack', 'sched']);
    S('depot4', 5, 'Analyst Rhee', 'Depot 4 has had a gate-badge anomaly, an outage the night after contractor access, a fence post from GridWatch and a second incident with the gate sensor. Dark Grid names it in phase two.', ['badgeaud', 'cable', 'phase2']);
    T('vera', 62, 3, 'Brightwater annual filing lists her as agent.', ['bw']);
    T('vera', 44, 2, 'Emails Northwind AP to rush Harborline payments.', ['memo']);
    T('vera', 19, 2, 'Named co-signatory on the Pinnacle account.', ['bankco']);
    T('vera', 13, 3, 'At the same Chamber table as Quill, Platt and Fenn.', ['chamber1']);
    T('harbor', 46, 1, 'First of seven invoices paid in two weeks.', ['ledger']);
    T('harbor', 40, 1, 'Northwind money forwarded to Brightwater within a day.', ['wire']);
    T('tobias', 27, 3, 'Appears as occasional Dark Grid spokesperson.', ['news2']);
    T('tobias', 16, 1, 'GridWatch Now post predicts Depot 4 going dark.', ['gwpost']);
    T('tobias', 15, 1, 'Posts a named attack on Dana Whitcomb.', ['attack']);
    T('tobias', 4, 1, 'Posts the Depot 4 schedule with Whitcomb’s shifts circled.', ['sched']);
    T('depot4', 36, 2, 'Meridian temps start; badges issued.', ['temps']);
    T('depot4', 31, 2, 'Two temp badges used outside shifts.', ['badgeaud']);
    T('depot4', 12, 1, 'Conveyor power failure; cabling cut.', ['cable']);
    T('depot4', 2, 1, 'Gate sensor tampered with.', ['gate']);
    T('protest', 27, 1, 'First call for a night action.', ['dgcall']);
    T('protest', 6, 1, 'Phase two names Depots 4 and 7.', ['phase2']);
    T('protest', 1, 1, 'Ashby Tower tagged “next”.', ['hqpost']);
    // The Tobias summary stops before the “reply” and “dm” reports so that "reports since the last summary" has something to show.

    /* ---------------- special banks ---------------- */
    function bankFor(name, seeds, hops, opened, reason) {
      var b = CI.newBank(d, name, seeds.map(function (k) { return ent[k].id; }), hops);
      b.opened = { date: ago(opened), reason: reason }; d.banks.push(b); return b;
    }
    function items(b, list) { list.forEach(function (it) { ok(CI.addEstimateItem(d, b, { kind: it[0], text: it[1], reportIds: it[2].map(function (k) { return rep[k].id; }).join(',') }), 'estimate item'); }); }

    // Bank 1: invoice scheme (handed over)
    var b1 = bankFor('Invoice scheme bank', ['invoice', 'shells'], 2, 44, 'Seven Harborline invoices paid in two weeks with no purchase orders, and a payment forwarded to Brightwater the next day.');
    CI.currentEstimate(b1).summary = 'Northwind’s payments to Harborline and Pinnacle appear to pass through shell companies that share an address, a filing agent and a bank, and end at Brightwater and a former Harborline officer. An insider may be easing the approvals.';
    items(b1, [
      ['ESTABLISHED', 'Harborline forwarded Northwind’s payment to Brightwater Holdings within a day.', ['wire']],
      ['ESTABLISHED', 'Brightwater, Keystone and Pinnacle are all registered at the Harbor Street business park, and Harborline formerly was.', ['bw', 'hl', 'key', 'pin']],
      ['ESTABLISHED', 'Fenn & Associates is the filing agent of record for Harborline and Brightwater, and Rosalind Fenn for Pinnacle.', ['fenn', 'pin']],
      ['ESTABLISHED', 'Brightwater makes a monthly transfer to Orrin Platt, a former Harborline officer.', ['orrinpay']],
      ['HYPOTHESIS', 'Harborline and Pinnacle exist only to pass money to Brightwater and Platt.', []],
      ['HYPOTHESIS', 'Someone in Northwind accounts payable is helping the invoices through.', []]
    ]);
    b1.estimates[0].created = ago(40); b1.estimates[0].updated = ago(22);
    CI.handOver(d, b1);
    CI.newEstimate(b1, true); CI.currentEstimate(b1).label = 'Estimate 2'; CI.currentEstimate(b1).summary = 'After handover: the audit note ties Pinnacle to the same contact details, and signature cards connect Vera Linden to Rosalind Fenn.';
    items(b1, [['ESTABLISHED', 'Harborline, Brightwater and Pinnacle share a phone number and a mailing address.', ['audit']]]);

    // Bank 2: Depot 4 outage (handed over)
    var b2 = bankFor('Depot 4 outage bank', ['outage', 'depot4'], 2, 12, 'A public post predicted the outage, and then the cabling was found cut.');
    CI.currentEstimate(b2).summary = 'GridWatch Now named Depot 4 before the outage. A Keystone contractor and a Meridian temp were on site the night before, both with badges that opened the cable room.';
    items(b2, [
      ['ESTABLISHED', 'GridWatch Now announced the outage before it happened.', ['gwpost']],
      ['ESTABLISHED', 'A Keystone contractor and a Meridian temp were on site the night before.', ['cable', 'witness']],
      ['ESTABLISHED', 'The contractor’s badge was activated under an override entered by Sunil Desai.', ['override']],
      ['HYPOTHESIS', 'The cabling was cut by people who were let in and who knew the schedule.', []],
      ['HYPOTHESIS', 'Dark Grid and GridWatch Now coordinated, with help from inside Northwind.', []]
    ]);
    CI.handOver(d, b2);

    // Bank 3: Dark Grid campaign (open, with news since last seen)
    var b3 = bankFor('Dark Grid campaign bank', ['protest', 'darkgrid'], 2, 8, 'Phase-two announcement names Depots 4 and 7, and a letter at Depot 7 repeats Dark Grid’s slogan.');
    CI.currentEstimate(b3).summary = 'Dark Grid is escalating from posts to site visits. Its organiser meets a Keystone director, and GridWatch Now amplifies it.';
    items(b3, [
      ['ESTABLISHED', 'Dark Grid announced phase two of its campaign naming Depots 4 and 7.', ['phase2']],
      ['ESTABLISHED', 'Mara Quill and Jonas Weir met, with Gordon Tully joining for part of it.', ['meet']],
      ['HYPOTHESIS', 'Dark Grid wrote the Depot 7 letters.', []]
    ]);
    CI.newEstimate(b3, true);
    CI.addChart(b3, 'Campaign ties', false);
    CI.switchChart(b3, b3.charts[0].id);
    // New since last seen: the last few reports and links
    b3.seen = { report: Math.max(0, d.counters.report - 9), link: Math.max(0, d.counters.link - 14) };

    // Bank 4: Port Kessler (closed with no situation)
    var b4 = bankFor('Port Kessler cargo bank', ['cargo'], 1, 49, 'Customs hold on three containers handled by one broker.');
    CI.currentEstimate(b4).summary = 'The manifests were mis-keyed and corrected the same day.';
    items(b4, [['ESTABLISHED', 'The containers were released after the manifests were corrected.', ['holdrep']]]);
    ok({ error: CI.closeBank(d, b4, 'Review shows a clerical error: manifests mis-keyed, corrected the same day, nothing diverted.') }, 'close bank');

    // Bank 5: Depot 7 letters (just opened)
    var b5 = bankFor('Depot 7 letters bank', ['threats', 'depot7'], 1, 5, 'Two threatening letters to supervisors; author unknown.');
    CI.currentEstimate(b5).summary = 'Nothing established yet.';

    d.banks.forEach(function (b) { if (!Array.isArray(b.files)) b.files = CI.computeGraph(d, b, CI.buildIndex(d)).nodes.map(function (n) { return n.id; }); });
    d.ui.bankId = b3.id;

    /* ---------------- investigations: leads, requests, case charts ---------------- */
    var v1 = CI.investigationFor(d, b1.id), v2 = CI.investigationFor(d, b2.id);
    v1.investigator = 'Nadia Reyes'; v1.opened = ago(22); v1.title = 'Northwind vendor invoice scheme';
    v1.planFile = { name: 'Invoice scheme handling plan v2.docx', location: 'Shared drive \\ Investigations \\ V-0001' };
    v1.notes = 'Priority is the money trail to Brightwater and whoever inside Northwind is helping. Legal has the plan.';
    v2.investigator = 'Tomas Greer'; v2.opened = ago(10); v2.title = 'Depot 4 outage and access';
    v2.planFile = { name: 'Depot 4 handling plan.docx', location: 'Shared drive \\ Investigations \\ V-0002' };
    v2.notes = 'Two lines: who was let in, and whether the campaign groups knew in advance.';
    var v3 = ok(CI.newInvestigation(d, { title: 'Leaked depot schedules and targeting of dispatchers', reason: 'Northwind HR reported schedule screenshots on a public account; a former scheduler is suspected.', investigator: 'Nadia Reyes', opened: ago(3) }), 'inv3').inv;
    v3.notes = 'Opened from an HR referral, not from a special bank. Staff safety first.';
    v3.planFile = { name: 'Schedule leak plan draft.docx', location: 'Nadia’s desktop' };
    ['marcus', 'tobias', 'dana', 'leak', 'harass', 'depot4'].forEach(function (k) { ok(CI.addInvFile(d, v3, ent[k].id), 'inv file ' + k); });

    function L(inv, kind, question, repKey, aboutKeys, status, extra) {
      var res = ok(CI.addLead(d, { investigationId: inv ? inv.id : '', origin: extra && extra.originKey ? { kind: extra.originKind || 'file', id: ent[extra.originKey].id } : null, kind: kind, question: question, raisedBy: repKey ? rep[repKey].id : '', about: (aboutKeys || []).map(function (k) { return ent[k].id; }), issued: ago((extra && extra.issued) || 5), assigned: (extra && extra.assigned) || '', forLead: (extra && extra.forLead) || '' }), 'lead');
      var l = res.lead; l.status = status;
      if (status === 'DONE' || status === 'NO_RESULT') { l.response = extra.response; l.returnedBy = extra.by; l.returnedDate = ago(extra.back); }
      if (extra && extra.result) extra.result.forEach(function (k) { rep[k].leadId = l.id; });
      return l;
    }
    // Investigation 1
    var l1 = L(v1, 'INVESTIGATION', 'Why did Harborline forward Northwind’s payment to Brightwater within a day, and who benefits?', 'wire', ['harbor', 'bright'], 'IN_PROGRESS', { issued: 20, assigned: 'Nadia Reyes' });
    var l2 = L(v1, 'INVESTIGATION', 'Is anyone at Northwind accounts payable helping the invoices through?', 'appr', ['elias', 'priya'], 'IN_PROGRESS', { issued: 18, assigned: 'Nadia Reyes' });
    L(v1, 'INVESTIGATION', 'Who collects the Harborline PO box in Dunmore?', 'pobox', ['dunmore', 'vera'], 'NOT_STARTED', { issued: 4, assigned: 'Dev Patel' });
    L(v1, 'INVESTIGATION', 'Is Orrin Platt’s monthly transfer a salary, a loan or a pay-off?', 'orrinpay', ['orrin', 'bright'], 'DONE', { issued: 15, assigned: 'Dev Patel', by: 'Dev Patel', back: 6, response: 'Bank enquiry says the transfers are labelled consulting retainer. No contract found. Treated as unexplained.' });
    L(v1, 'DATA_REQUEST', 'The current state business filing for Brightwater Holdings LLC, with all amendments and the agent and address history.', 'bw', ['bright'], 'DONE', { issued: 19, forLead: l1.id, by: 'Collection desk', back: 12, response: 'Filing set retrieved and indexed; one amendment changed the agent two years ago.', result: ['audit'] });
    L(v1, 'DATA_REQUEST', 'Pinnacle Consulting Partners bank signature cards and incorporation papers.', 'pin', ['pinnacle'], 'IN_PROGRESS', { issued: 14, forLead: l1.id });
    L(v1, 'DATA_REQUEST', 'The Northwind vendor onboarding file for Harborline, including who approved the vendor.', 'ledger', ['harbor', 'elias'], 'NOT_STARTED', { issued: 6, forLead: l2.id });
    // Investigation 2
    var m1 = L(v2, 'INVESTIGATION', 'Who authorised the Keystone contractor’s access to Depot 4 on the night before the outage?', 'cable', ['keystone', 'depot4', 'gordon'], 'IN_PROGRESS', { issued: 9, assigned: 'Tomas Greer' });
    L(v2, 'INVESTIGATION', 'Why was a badge override entered for a contractor the day before, and by whose request?', 'override', ['sunil', 'gordon'], 'NOT_STARTED', { issued: 8, assigned: 'Tomas Greer' });
    L(v2, 'INVESTIGATION', 'Did GridWatch Now or Dark Grid know in advance, and from whom?', 'gwpost', ['grid', 'tobias', 'darkgrid'], 'NO_RESULT', { issued: 10, assigned: 'Tomas Greer', by: 'Analyst Rhee', back: 4, response: 'Checked what the indexes hold: no message, call or contact in the reports before the post. Left open for later reports.' });
    L(v2, 'DATA_REQUEST', 'Depot 4 badge and sign-in records for the 48 hours before the outage.', 'cable', ['depot4', 'keystone'], 'DONE', { issued: 9, forLead: m1.id, by: 'Collection desk', back: 5, response: 'Records retrieved and filed.', result: ['override'] });
    L(v2, 'DATA_REQUEST', 'Camera footage of the cable room door for the night before the outage.', 'witness', ['depot4'], 'IN_PROGRESS', { issued: 7, forLead: m1.id });
    // Investigation 3
    var n1 = L(v3, 'INVESTIGATION', 'Was Marcus Ellery’s account used by him, or by someone else, to export the schedule?', 'meta', ['marcus', 'leak'], 'IN_PROGRESS', { issued: 3, assigned: 'Nadia Reyes' });
    L(v3, 'INVESTIGATION', 'Is Tobias Crane being fed material by anyone besides Marcus Ellery?', 'reply', ['tobias', 'marcus'], 'NOT_STARTED', { issued: 2, assigned: 'Nadia Reyes' });
    L(v3, 'DATA_REQUEST', 'The login history for the Marcus Ellery account since his dismissal.', 'meta', ['marcus'], 'IN_PROGRESS', { issued: 3, forLead: n1.id });
    L(v3, 'DATA_REQUEST', 'All public posts of tcrane_speaks mentioning Northwind staff, preserved with timestamps.', 'attack', ['tobias', 'dana'], 'NOT_STARTED', { issued: 2 });

    // Leads with no investigation: raised from an individual's page, from indexing a report, or in the register
    L(null, 'INVESTIGATION', 'Where does Orrin Platt live now, and does he still hold the Dunmore lease?', null, ['orrin'], 'NOT_STARTED', { issued: 3, assigned: 'Dev Patel', originKey: 'orrin' });
    L(null, 'INVESTIGATION', 'Is Vera Lindqvist the same person who appears as agent for two other filings?', 'bw', ['vera'], 'IN_PROGRESS', { issued: 6, assigned: 'Analyst Rhee', originKey: 'vera' });
    L(null, 'INVESTIGATION', 'Who runs the tcrane_speaks account outside working hours?', 'attack', ['tobias'], 'NOT_STARTED', { issued: 1 });
    L(null, 'DATA_REQUEST', 'Property records for the Dunmore PO box address.', null, ['dunmore'], 'NOT_STARTED', { issued: 3, originKey: 'dunmore' });

    // Case charts (the investigators’ boards)
    function pins(inv, list) { list.forEach(function (p) { ok(CI.addPin(d, inv, ent[p[0]].id, { x: p[1], y: p[2] }), 'pin ' + p[0]); }); }
    function strings(inv, list) { list.forEach(function (t) { ok(CI.addString(d, inv, { a: ent[t[0]].id, b: ent[t[1]].id, label: t[2], reportIds: t[3].map(function (k) { return rep[k].id; }) }), 'string ' + t[0] + t[1]); }); }
    pins(v1, [['northwind', -300, 0], ['harbor', -100, -140], ['pinnacle', -100, 140], ['bright', 120, 0], ['orrin', 320, -140], ['bank', 320, 100], ['vera', 120, -250], ['rosalind', 120, 260], ['fenn', -100, 300], ['harborst', -320, 240], ['elias', -320, -200]]);
    strings(v1, [['northwind', 'harbor', 'pays', ['ledger']], ['northwind', 'pinnacle', 'pays', ['pinv']], ['harbor', 'bright', 'forwards money', ['wire']], ['bright', 'orrin', 'monthly transfer', ['orrinpay']], ['vera', 'bright', 'agent', ['bw']], ['rosalind', 'pinnacle', 'agent', ['pin']], ['fenn', 'harbor', 'files for', ['fenn']], ['bright', 'harborst', 'registered at', ['bw']], ['pinnacle', 'harborst', 'registered at', ['pin']], ['vera', 'rosalind', 'co-signatories', ['bankco']], ['elias', 'harbor', 'approved invoices', ['appr']], ['bright', 'bank', 'uses', ['wire']]]);
    CI.setCaseTitle(d, v1, 'Invoice scheme: how the money moves');
    CI.addNote(d, v1, 'Same address, same agent, same bank', { x: -80, y: 260 });
    CI.addNote(d, v1, 'Who inside is helping?', { x: -330, y: -110 });
    pins(v2, [['grid', -300, -140], ['tobias', -300, 120], ['outage', 0, -140], ['depot4', 260, -140], ['keystone', 0, 80], ['gordon', 260, 100], ['sunil', 0, 280], ['meridian', 260, 280], ['darkgrid', -300, 300], ['cal', 480, -20]]);
    strings(v2, [['grid', 'outage', 'announced it beforehand', ['gwpost']], ['tobias', 'grid', 'administers the account', ['gwpost']], ['keystone', 'outage', 'contractor on site', ['cable']], ['gordon', 'depot4', 'badge log', ['cable']], ['sunil', 'gordon', 'override', ['override']], ['cal', 'outage', 'witness', ['witness']], ['meridian', 'depot4', 'temp on site', ['badgeaud']], ['grid', 'darkgrid', 'linked', ['news2']], ['tobias', 'darkgrid', 'spokesperson', ['news2']]]);
    CI.setCaseTitle(d, v2, 'Depot 4: who was let in, and who knew');
    CI.addNote(d, v2, 'Public account predicted it', { x: -300, y: -270 });
    CI.addNote(d, v2, 'Override entered the day before', { x: 40, y: 190 });
    pins(v3, [['marcus', -200, 0], ['tobias', 120, 0], ['dana', 120, 200], ['depot4', -200, 200]]);
    strings(v3, [['marcus', 'tobias', 'public exchange', ['reply']], ['tobias', 'dana', 'targets', ['sched']]]);
    CI.setCaseTitle(d, v3, 'Schedule leak');

    return d;
  };
})(typeof window !== 'undefined' ? window : globalThis);
