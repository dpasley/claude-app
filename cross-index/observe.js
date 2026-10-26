/* Situation observation: where a staff member notices something developing, then opens a bank. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var ob = { days: 0 };
  function D() { return A.data(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  CI.views.observation = function () {
    var d = D(), days = ob.days || d.settings.heatWindowDays, res = CI.observe(d, days, A.idx());
    var h = '<div class="page-head"><h1>Situation observation</h1><div class="row"><label class="row" style="margin:0">Looking at the last ' +
      '<select data-on-change="obs-days" id="obs-days">' + A.options([7, 14, 30, 60, 90].map(function (n) { return { value: String(n), label: n + ' days' }; }), String(days)) + '</select></label></div></div>' +
      '<p class="muted">This shows what has moved in the names compared with the same length of time before. It points at where to look. Deciding that something needs looking into is the staff member’s call.</p>';
    h += '<div class="card"><h2>Names that moved (' + res.files.length + ')</h2>';
    h += res.files.length ? '<table class="tight"><tbody>' + res.files.map(function (f) {
      var e = A.idx().entity[f.id];
      return '<tr><td class="nm">' + A.avatar(e, 30) + '<span><a href="#/entity/' + esc(f.id) + '">' + esc(f.name) + '</a> ' + A.tag(f.type) + '</span></td><td>' + f.why.map(esc).join('<br>') +
        '</td><td class="right nowrap"><button class="btn small primary" data-action="obs-open" data-ids="' + esc(f.id) + '">Open a bank</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">Nothing has moved enough to show. A name appears here when it has two or more independent reports in the period and more than before, or when it has been linked to two or more files it was not linked to before.</p>';
    h += '</div><div class="card"><h2>Names active together (' + res.clusters.length + ')</h2><p class="muted small">Three or more names that each had a report in the period and are linked to each other by connections made in the period. This is where a campaign or a coordinated effort tends to show.</p>';
    h += res.clusters.length ? '<table class="tight"><tbody>' + res.clusters.map(function (c) {
      return '<tr><td>' + c.ids.map(function (id) { return A.entLink(id); }).join(', ') + '<div class="muted small">' + c.ids.length + ' names</div></td><td class="right nowrap"><button class="btn small primary" data-action="obs-open" data-ids="' + esc(c.ids.join(',')) + '">Open a bank</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">None.</p>';
    h += '</div>';
    A.view.className = ''; A.view.innerHTML = h;
  };
  H['obs-days'] = function () { ob.days = Number(val('obs-days')) || 0; CI.views.observation(); };

  /* Opening a bank asks why, so the estimate starts from the reason the situation was noticed. */
  CI.views.openBank = function (ids, name, reason) {
    var seeds = ids.filter(function (id) { return A.idx().entity[id]; });
    if (!seeds.length) return;
    var nm = name || (seeds.length === 1 ? 'Situation: ' + A.idx().entity[seeds[0]].name : 'Situation: ' + A.idx().entity[seeds[0]].name + ' and ' + (seeds.length - 1) + ' more');
    CI.views._bankSeeds = seeds;
    A.modal('<h2>Open a bank</h2><div class="form"><label>Name<input type="text" id="ob-name" value="' + esc(nm) + '"></label>' +
      '<label>Why is this being looked into? <span class="hint">what you noticed, in a sentence or two</span><textarea id="ob-why" rows="3">' + esc(reason || '') + '</textarea></label>' +
      '<p class="muted small">Starting names: ' + seeds.map(function (id) { return esc(A.idx().entity[id].name); }).join(', ') + '. The chart pulls in the names connected to them, heaviest first.</p></div>' +
      '<div class="row end"><button class="btn" data-action="modal-close">Cancel</button><button class="btn primary" data-action="ob-create">Open bank</button></div>');
    var w = document.getElementById('ob-why'); if (w) w.focus();
  };
  H['obs-open'] = function (el) {
    var ids = el.getAttribute('data-ids').split(','), res = CI.observe(D(), ob.days || D().settings.heatWindowDays, A.idx());
    var f = res.files.filter(function (x) { return x.id === ids[0]; })[0], why = ids.length === 1 && f ? f.why.join('; ') + '.' : (ids.length > 1 ? ids.length + ' names active together in the last ' + res.days + ' days.' : '');
    CI.views.openBank(ids, '', why);
  };
  H['ob-create'] = function () {
    var d = D(), name = val('ob-name').trim(), why = val('ob-why').trim();
    if (!name) { A.toast('Give the bank a name.', true); return; }
    var b = CI.newBank(d, name, CI.views._bankSeeds, 2); b.topN = 12; b.opened = { date: CI.today(), reason: why };
    d.banks.push(b); d.ui.bankId = b.id; A.persist(); A.closeModal(); A.go('#/chart/' + b.id);
  };
})();
