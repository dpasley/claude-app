/* Data file: keeps the data in a file on the computer, separate from the app.
 * Chrome and Edge can write to a chosen file; the app saves to it a moment after every change. The app can then be
 * replaced by a newer copy at any time: open the new app, choose the same data file, and everything is there.
 * Other browsers cannot write to a file by themselves, so they keep the backup reminder (download a copy).
 * A data file is never overwritten by older, empty or sample data: when the two differ the app asks first. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var root = typeof window !== 'undefined' ? window : globalThis;
  var hosted = !!(root.claude && typeof root.claude.use === 'function');
  var TYPES = [{ description: 'Cross-Index data', accept: { 'application/json': ['.json'] } }];

  /* The handle to the chosen file is remembered in the browser's IndexedDB (replaceable in tests). */
  var memory = {};
  function idb() {
    return new Promise(function (res, rej) {
      if (!root.indexedDB) { rej(new Error('no indexedDB')); return; }
      var r = root.indexedDB.open('cross-index-meta', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  var store = {
    get: function (k) { return idb().then(function (db) { return new Promise(function (res) { var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return memory[k] || null; }); },
    set: function (k, v) { memory[k] = v; return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function () { res(true); }; t.onerror = function () { res(false); }; }); }).catch(function () { return false; }); },
    del: function (k) { delete memory[k]; return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = function () { res(true); }; t.onerror = function () { res(false); }; }); }).catch(function () { return false; }); }
  };

  var DF = CI.dataFile = {
    handle: null, name: '', state: 'none', /* none | linked | permission | paused | error */
    lastWrite: '', error: '', timer: null, busy: false, again: false, pendingFile: null, setupDismissed: false, store: store,
    supported: function () { return !hosted && typeof root.showSaveFilePicker === 'function' && typeof root.showOpenFilePicker === 'function'; }
  };

  function D() { return A.data(); }
  function isBlank(d) { return !d.reports.length && !d.entities.length; }
  function when(iso) { return iso ? CI.fmtDate(iso.slice(0, 10)) + ' ' + new Date(iso).toTimeString().slice(0, 5) : 'never'; }
  function stamp(d) { return (d && d.ui && d.ui.savedAt) || ''; }

  /* ---------- decide between the file and this browser's copy ---------- */
  /* Returns 'load' (take the file), 'write' (file is older: save to it), 'same', or 'ask'. */
  DF.decide = function (local, file) {
    var fileHas = !isBlank(file), localDisposable = isBlank(local) || !!local.sampleLoaded;
    if (!fileHas) return isBlank(local) ? 'same' : 'write';
    if (localDisposable && !file.sampleLoaded) return 'load';
    var ls = stamp(local), fs = stamp(file);
    if (ls === fs) return 'same';
    if (fs > ls) return 'ask';
    return 'write';
  };

  function readFile(h) {
    return Promise.resolve(h.getFile()).then(function (f) { return f.text(); }).then(function (t) {
      if (!t.trim()) return CI.emptyData();
      return CI.importJson(t);
    });
  }
  function takeFile(fd) {
    A.setData(fd); D().started = true; CI.save(D()); DF.state = 'linked'; DF.pendingFile = null; DF.error = '';
    A.go(root.location && root.location.hash ? root.location.hash : '#/report-new'); refresh();
    A.toast('Loaded your data file (' + fd.reports.length + ' reports, ' + fd.entities.length + ' files).');
  }
  DF.sync = function () {
    var h = DF.handle; if (!h) return Promise.resolve();
    return readFile(h).then(function (fd) {
      var act = DF.decide(D(), fd);
      if (act === 'load') { takeFile(fd); return; }
      if (act === 'write') { DF.state = 'linked'; return DF.writeNow(); }
      if (act === 'ask') {
        DF.state = 'paused'; DF.pendingFile = fd; refresh();
        A.confirm('The data file “' + DF.name + '” was saved ' + when(stamp(fd)) + ', later than this browser’s copy (' + when(stamp(D())) + '). Load the data file?', function () { takeFile(fd); }, { title: 'Newer data file', yes: 'Load the data file' });
        return;
      }
      DF.state = 'linked'; refresh();
    }).catch(function (e) { DF.state = 'error'; DF.error = (e && e.message) || 'The data file could not be read.'; refresh(); });
  };

  /* ---------- writing ---------- */
  DF.changed = function () {
    if (!DF.handle || DF.state !== 'linked') return;
    clearTimeout(DF.timer); DF.timer = setTimeout(DF.writeNow, 400);
  };
  DF.writeNow = function () {
    if (!DF.handle || (DF.state !== 'linked')) return Promise.resolve();
    clearTimeout(DF.timer);
    if (DF.busy) { DF.again = true; return Promise.resolve(); }
    DF.busy = true;
    var text = CI.exportJson(D());
    return Promise.resolve(DF.handle.createWritable()).then(function (w) {
      return Promise.resolve(w.write(text)).then(function () { return w.close(); });
    }).then(function () { DF.lastWrite = new Date().toISOString(); DF.error = ''; }, function (e) {
      DF.error = (e && e.message) || 'The data file could not be written.';
      DF.state = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'permission' : 'error';
    }).then(function () { DF.busy = false; if (DF.again) { DF.again = false; DF.changed(); } refresh(); });
  };

  /* ---------- choosing a file (each needs a click) ---------- */
  function link(h) {
    DF.handle = h; DF.name = h.name || 'data file';
    return store.set('handle', h);
  }
  DF.create = function () {
    if (!DF.supported()) return Promise.resolve();
    return root.showSaveFilePicker({ suggestedName: 'cross-index-data.json', types: TYPES }).then(function (h) {
      return link(h).then(function () { DF.state = 'linked'; return DF.writeNow(); }).then(function () { A.toast('Saving to “' + DF.name + '”. Keep it in a folder that is not the app’s folder.'); });
    }, function (e) { if (!e || e.name !== 'AbortError') A.toast((e && e.message) || 'Could not create the file.', true); });
  };
  DF.open = function () {
    if (!DF.supported()) return Promise.resolve();
    return root.showOpenFilePicker({ types: TYPES, multiple: false }).then(function (hs) {
      var h = hs[0];
      return Promise.resolve(h.requestPermission({ mode: 'readwrite' })).then(function (p) {
        if (p !== 'granted') { A.toast('Permission to save to that file was not given.', true); return; }
        return link(h).then(function () { DF.state = 'linked'; return DF.sync(); });
      });
    }, function (e) { if (!e || e.name !== 'AbortError') A.toast((e && e.message) || 'Could not open the file.', true); });
  };
  DF.reconnect = function () {
    var h = DF.handle; if (!h) return Promise.resolve();
    return Promise.resolve(h.requestPermission({ mode: 'readwrite' })).then(function (p) {
      if (p !== 'granted') { A.toast('Permission to save to the data file was not given.', true); return; }
      DF.state = 'linked'; return DF.sync();
    }, function (e) { A.toast((e && e.message) || 'Could not reconnect.', true); });
  };
  DF.unlink = function () { DF.handle = null; DF.name = ''; DF.state = 'none'; DF.error = ''; DF.pendingFile = null; return store.del('handle').then(refresh); };

  DF.init = function () {
    if (!DF.supported()) { refresh(); return Promise.resolve(); }
    return store.get('handle').then(function (h) {
      if (!h) { refresh(); return; }
      DF.handle = h; DF.name = h.name || 'data file';
      return Promise.resolve(h.queryPermission ? h.queryPermission({ mode: 'readwrite' }) : 'prompt').then(function (p) {
        if (p === 'granted') { DF.state = 'linked'; return DF.sync(); }
        DF.state = 'permission'; refresh();
      });
    }).catch(function () { refresh(); });
  };

  /* ---------- what the person sees ---------- */
  function statusText() {
    if (!DF.supported()) return 'Not available in this browser';
    if (DF.state === 'linked') return 'Saving to ' + DF.name + (DF.lastWrite ? ' · saved ' + when(DF.lastWrite).slice(-5) : '');
    if (DF.state === 'permission') return DF.name + ' needs permission again';
    if (DF.state === 'paused') return 'Paused: ' + DF.name + ' differs from this copy';
    if (DF.state === 'error') return 'Problem with ' + DF.name;
    return 'No data file yet';
  }
  DF.card = function () {
    var h = '<div class="card" id="df-card"><h2>Data file</h2>';
    if (!DF.supported()) {
      return h + '<p class="muted">' + (hosted ? 'This page is hosted, so it cannot write to a file on your computer. Use the downloaded copy of the app.' : 'This browser cannot save to a file on its own. Use Chrome or Edge for automatic saving; otherwise use <strong>Back up now</strong> below to download a copy.') + '</p></div>';
    }
    h += '<p class="muted">Keeps your data in a file on this computer, separate from the app. The app saves to it after every change, so you can replace the app with a newer version at any time and open the same file.</p>' +
      '<p><strong>' + esc(statusText()) + '</strong>' + (DF.error ? '<br><span class="bad-t">' + esc(DF.error) + '</span>' : '') + '</p><div class="row wrap">';
    if (DF.state === 'permission') h += '<button class="btn primary" data-action="df-reconnect">Reconnect ' + esc(DF.name) + '</button>';
    if (DF.state === 'paused') h += '<button class="btn primary" data-action="df-takefile">Load the data file</button><button class="btn" data-action="df-overwrite">Replace the file with this copy</button>';
    if (DF.state === 'linked') h += '<button class="btn" data-action="df-save-now">Save now</button>';
    h += '<button class="btn' + (DF.state === 'none' ? ' primary' : '') + '" data-action="df-open">Open my data file…</button><button class="btn" data-action="df-create">Create a new data file…</button>' + (DF.handle ? '<button class="btn" data-action="df-unlink">Stop using this file</button>' : '') + '</div></div>';
    return h;
  };
  function banner() {
    var el = document.getElementById('backup-banner'); if (!el) return false;
    var m = null;
    if (DF.state === 'permission') m = 'Your data file <strong>' + esc(DF.name) + '</strong> needs permission again for this visit. <button type="button" class="btn small primary" data-action="df-reconnect">Reconnect</button>';
    else if (DF.state === 'paused') m = 'Saving to the data file is paused because it differs from this copy. <button type="button" class="btn small primary" data-action="df-takefile">Load the data file</button> <button type="button" class="btn small" data-action="df-overwrite">Replace the file with this copy</button>';
    else if (DF.state === 'error') m = 'Could not save to the data file: ' + esc(DF.error) + ' <a href="#/settings">Settings</a>';
    else if (DF.state === 'none' && DF.supported() && !DF.setupDismissed) m = 'Keep your data in a file on this computer, separate from the app. <button type="button" class="btn small primary" data-action="df-open">Open my data file</button> <button type="button" class="btn small" data-action="df-create">Create a new one</button> <button type="button" class="btn small" data-action="df-later">Later</button>';
    else if (DF.state === 'linked') { el.hidden = true; return true; }
    if (m === null) return false;
    el.hidden = false; el.innerHTML = m; return true;
  }
  function refresh() {
    var c = document.getElementById('df-card'); if (c) c.outerHTML = DF.card();
    var s = document.getElementById('df-status'); if (s) s.textContent = statusText();
    if (!banner() && CI.views.backupBanner && CI.views._backupBannerOrig) CI.views._backupBannerOrig();
  }
  var orig = CI.views.backupBanner; CI.views._backupBannerOrig = orig;
  CI.views.backupBanner = function () { if (!banner() && orig) orig(); };
  CI.views.dataFileCard = function () { return DF.card(); };

  H['df-create'] = function () {
    var sample = !!D().sampleLoaded, blank = isBlank(D());
    var run = function () {
      DF.create().then(function () {
        if (DF.handle && sample) { var nd = CI.emptyData(); nd.started = true; A.setData(nd); A.persist(); A.go('#/report-new'); }
        refresh();
      });
    };
    if (sample) A.confirm('This starts a NEW, EMPTY data file and removes the sample data. If you already have a data file, choose Open my data file instead.', run, { title: 'Create a new data file', yes: 'Create a new file' });
    else if (blank) A.confirm('This starts a NEW data file with nothing in it. If you already have a data file, choose Open my data file instead.', run, { title: 'Create a new data file', yes: 'Create a new file' });
    else run();
  };
  H['df-open'] = function () { DF.open(); };
  H['df-reconnect'] = function () { DF.reconnect(); };
  H['df-save-now'] = function () { DF.writeNow().then(function () { A.toast(DF.state === 'linked' ? 'Saved to ' + DF.name + '.' : 'Could not save: ' + DF.error, DF.state !== 'linked'); }); };
  H['df-unlink'] = function () { A.confirm('Stop saving to “' + DF.name + '”? The file stays where it is; the app will keep its copy in this browser only.', function () { DF.unlink(); }, { title: 'Stop using this data file', yes: 'Stop' }); };
  H['df-later'] = function () { DF.setupDismissed = true; refresh(); };
  H['df-takefile'] = function () { if (DF.pendingFile) takeFile(DF.pendingFile); else DF.sync(); };
  H['df-overwrite'] = function () { A.confirm('Replace the contents of “' + DF.name + '” with this browser’s copy?', function () { DF.state = 'linked'; DF.writeNow(); }, { title: 'Replace the data file', yes: 'Replace', danger: true }); };

  if (root.document) {
    root.document.addEventListener('visibilitychange', function () { if (root.document.visibilityState === 'hidden' && DF.timer) DF.writeNow(); });
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { setTimeout(DF.init, 0); });
    else setTimeout(DF.init, 0);
  }
})();
