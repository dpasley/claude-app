/* The Chart tab on a file: every connection of this file on one chart, a few steps out. */
(function () {
  'use strict';
  var A = CI.app, H = A.handlers, esc = A.esc;
  var st = { hops: 1, labels: 'auto', fileId: '' };
  function D() { return A.data(); }

  CI.views.fileChart = function (e) {
    if (st.fileId !== e.id) { st.fileId = e.id; st.hops = 1; st.labels = 'auto'; }
    return '<div class="card"><div class="row wrap"><label class="row" style="margin:0">Steps out <select id="fc-hops" data-on-change="fc-hops">' + A.options([{ value: '1', label: '1: direct connections' }, { value: '2', label: '2: and theirs' }, { value: '3', label: '3: three steps' }], String(st.hops)) + '</select></label>' +
      '<label class="chk"><input type="checkbox" id="fc-labels" data-on-change="fc-labels"> Label the connections</label><span id="fc-sum" class="muted small"></span><span class="spacer" style="flex:1"></span>' +
      '' + CI.views.chartFind() + '<span class="zgrp"><button class="btn small" data-action="cv-zoom" data-f="0.8" aria-label="Zoom out">\u2212</button><button class="btn small" data-action="cv-zoom" data-f="1.25" aria-label="Zoom in">+</button><button class="btn small" data-action="fc-fit">Fit</button></span><button class="btn small" data-action="chart-entity" data-id="' + esc(e.id) + '">Open as a special bank</button></div>' +
      '<div id="fc-sel" class="muted small" style="margin-top:8px">Click a name to see what it is.</div></div>' +
      '<div class="card flush"><div id="cy" style="height:560px"></div>' + CI.views.chartLegend() + '</div>';
  };
  CI.views.fileChartDraw = function (e) {
    var d = D(), idx = A.idx(), g = CI.computeGraph(d, CI.newBank(d, 'tmp', [e.id], st.hops), idx);
    var on = st.labels === 'auto' ? g.edges.length <= 15 : st.labels === 'on';
    var cb = document.getElementById('fc-labels'); if (cb) cb.checked = on;
    var sum = document.getElementById('fc-sum'); if (sum) sum.textContent = g.nodes.length + ' names · ' + g.edges.length + ' connections' + (g.edges.length > 15 && st.labels === 'auto' ? ' · labels are off on a busy chart' : '');
    CI.chart.destroy();
    CI.chart.render(document.getElementById('cy'), g, {
      layout: 'cose', positions: {}, edgeLabels: on,
      photoOf: function (id) { var x = idx.entity[id]; return x && x.photo ? x.photo : ''; },
      onNode: function (id) {
        var x = idx.entity[id], s = document.getElementById('fc-sel'); CI.chart.focus(id);
        if (x && s) s.innerHTML = '<strong>' + esc(x.name) + '</strong> ' + A.tag(x.type) + ' <a href="#/entity/' + esc(id) + '">Open the file</a> · <a href="#/indexes/' + esc(id) + '">Connection index</a>';
      },
      onBackground: function () { CI.chart.focus(null); var s = document.getElementById('fc-sel'); if (s) s.textContent = 'Click a name to see what it is.'; }
    });
  };
  H['fc-hops'] = function (el) { st.hops = Number(el.value) || 1; A.viewEntity(st.fileId, 'chart'); };
  H['fc-labels'] = function (el) { st.labels = el.checked ? 'on' : 'off'; A.viewEntity(st.fileId, 'chart'); };
  H['fc-fit'] = function () { if (CI.chart.cy) CI.chart.cy.fit(undefined, 30); };
})();
