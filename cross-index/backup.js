/* Backup safety: the data lives only in this browser, so say so, and make a backup one click. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  function D() { return A.data(); }
  function when(s) { return s.last ? CI.fmtDate(s.last.slice(0, 10)) : 'never'; }

  CI.views.backupLine = function () {
    var s = CI.backupState(D());
    return '<strong>Last backed up: ' + esc(when(s)) + (s.last ? '' : '') + '</strong>' + (s.changes ? ', ' + s.changes + ' saved change' + (s.changes === 1 ? '' : 's') + ' since.' : '.') + ' <button type="button" class="btn small" data-action="backup-now">Back up now</button>';
  };
  CI.views.backupBanner = function () {
    var el = document.getElementById('backup-banner'); if (!el) return;
    var s = CI.backupState(D());
    if (!s.due) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = 'Your data is kept only in this browser. ' + (s.last ? 'Last backed up ' + esc(when(s)) : 'It has not been backed up') + ' (' + s.changes + ' saved changes since). <button type="button" class="btn small primary" data-action="backup-now">Back up now</button><button type="button" class="btn small" data-action="backup-later">Remind me later</button>';
  };
  H['backup-now'] = function () {
    var d = D(); CI.markBackup(d);
    var blob = new Blob([CI.exportJson(d)], { type: 'application/json' });
    CI.saveFile('cross-index-backup-' + CI.today() + '.json', blob).then(function (r) {
      if (r.status === 'saved') { A.persist(); A.toast('Backup saved. Keep it outside the GitHub repository.'); }
      else { A.toast(r.status === 'declined' ? 'Backup was not saved.' : 'Saving files is not available in this view. Use Settings, Export.', true); }
      CI.views.backupBanner();
    }, function (e) { A.toast(e.message, true); });
  };
  H['backup-later'] = function () { var d = D(); d.ui.snooze = (d.ui.changes || 0) + 15; A.persist(); CI.views.backupBanner(); };
  document.addEventListener('DOMContentLoaded', function () { CI.views.backupBanner(); });
})();
