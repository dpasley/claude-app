/* PDF output: lead sheets, the open-leads board, and the chart printed as tiled pages for a wall.
 * Uses jsPDF (vendor/jspdf.umd.min.js). Layout helpers that need no PDF library (planTiles, pickDpi) are
 * plain functions so they can be tested in Node. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  CI.PAPERS = { tabloid: { label: 'Tabloid 11 × 17 in', w: 11, h: 17 }, letter: { label: 'Letter 8.5 × 11 in (test print)', w: 8.5, h: 11 } };

  /* ---------- saving ---------- */
  CI.saveFile = function (filename, blob) {
    var hosted = !!(root.claude && typeof root.claude.use === 'function');
    var p = hosted ? root.claude.use('downloads') : Promise.resolve(null);
    return Promise.resolve(p).catch(function () { return null; }).then(function (dl) {
      if (dl && typeof dl.save === 'function') {
        return dl.save({ filename: filename, data: blob }).then(function () { return { status: 'saved' }; }, function (err) {
          if (err && err.code === 'declined') return { status: 'declined' };
          throw new Error((err && err.message) || 'The file could not be saved.');
        });
      }
      if (hosted) return { status: 'unavailable' };
      var a = root.document.createElement('a');
      a.href = root.URL.createObjectURL(blob); a.download = filename; root.document.body.appendChild(a); a.click();
      setTimeout(function () { root.URL.revokeObjectURL(a.href); a.remove(); }, 800);
      return { status: 'saved' };
    });
  };

  function JsPDF() {
    var lib = root.jspdf && root.jspdf.jsPDF;
    if (!lib) throw new Error('The PDF library did not load (vendor/jspdf.umd.min.js).');
    return lib;
  }
  CI.fmtShort = function (iso) { return CI.fmtDate(iso); };
  CI.fileSafe = function (s) { return String(s || 'chart').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'chart'; };

  /* ---------- tiled chart ---------- */
  /* Fits a graph of gw x gh model units onto cols x rows pages. All sizes in inches.
   * f = inches per model unit. Tiles are the printable area of each page (page minus margin). */
  CI.planTiles = function (o) {
    var pw = o.pageW - 2 * o.margin, ph = o.pageH - 2 * o.margin, PW = o.cols * pw, PH = o.rows * ph;
    var pad = o.pad == null ? 0.4 : o.pad;
    var f = Math.min((PW - 2 * pad) / o.gw, (PH - 2 * pad) / o.gh);
    f = Math.min(f, o.maxF || 0.03);
    var offX = (PW - o.gw * f) / 2, offY = (PH - o.gh * f) / 2, tiles = [];
    for (var r = 0; r < o.rows; r++) for (var c = 0; c < o.cols; c++) tiles.push({ r: r, c: c, n: r * o.cols + c + 1, ix: c * pw, iy: r * ph });
    return { pw: pw, ph: ph, PW: PW, PH: PH, f: f, offX: offX, offY: offY, tiles: tiles };
  };
  CI.pickDpi = function (PW, PH, wanted, maxPixels) {
    var cap = Math.floor(Math.sqrt((maxPixels || 14000000) / (PW * PH)));
    return Math.max(50, Math.min(wanted, cap));
  };
  CI.QUALITY = { draft: 100, standard: 150, fine: 200 };

  /* o: chart (CI.chart), bankName, paper, orientation ('landscape'|'portrait'), cols, rows, quality, onProgress(done,total).
   * Resolves { blob, pages, dpi, finishedW, finishedH } */
  CI.tiledChart = function (o) {
    return new Promise(function (resolve, reject) {
      try {
        var chart = o.chart, bb = chart.bounds();
        if (!bb) throw new Error('There is nothing on the chart to print.');
        var paper = CI.PAPERS[o.paper] || CI.PAPERS.tabloid;
        var land = o.orientation !== 'portrait';
        var pageW = land ? Math.max(paper.w, paper.h) : Math.min(paper.w, paper.h);
        var pageH = land ? Math.min(paper.w, paper.h) : Math.max(paper.w, paper.h);
        var margin = 0.35;
        var plan = CI.planTiles({ gw: bb.w, gh: bb.h, cols: o.cols, rows: o.rows, pageW: pageW, pageH: pageH, margin: margin });
        var dpi = CI.pickDpi(plan.PW, plan.PH, CI.QUALITY[o.quality] || 150);
        var G = chart.fullCanvas(plan.f * dpi);
        var JS = JsPDF(), doc = new JS({ orientation: land ? 'landscape' : 'portrait', unit: 'in', format: [paper.w, paper.h], compress: true });
        var total = plan.tiles.length, i = 0;
        var step = function () {
          if (i >= total) { resolve({ blob: doc.output('blob'), pages: total, dpi: dpi, finishedW: plan.PW, finishedH: plan.PH }); return; }
          var t = plan.tiles[i];
          var cv = root.document.createElement('canvas'); cv.width = Math.round(plan.pw * dpi); cv.height = Math.round(plan.ph * dpi);
          var cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);
          cx.drawImage(G.canvas, Math.round((plan.offX - t.ix) * dpi), Math.round((plan.offY - t.iy) * dpi));
          if (i > 0) doc.addPage([paper.w, paper.h], land ? 'landscape' : 'portrait');
          doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, plan.pw, plan.ph);
          // margin furniture: label, crop marks, neighbours
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
          doc.text((o.bankName || 'Chart') + '   page ' + t.n + ' of ' + total + (total > 1 ? '   row ' + (t.r + 1) + ', column ' + (t.c + 1) : '') + '   printed ' + CI.fmtDate(CI.today()), margin, margin - 0.14);
          doc.setDrawColor(140); doc.setLineWidth(0.006);
          [[margin, margin], [pageW - margin, margin], [margin, pageH - margin], [pageW - margin, pageH - margin]].forEach(function (p, k) {
            var dx = k % 2 === 0 ? -1 : 1, dy = k < 2 ? -1 : 1;
            doc.line(p[0] + dx * 0.04, p[1], p[0] + dx * 0.2, p[1]); doc.line(p[0], p[1] + dy * 0.04, p[0], p[1] + dy * 0.2);
          });
          doc.setFontSize(7);
          if (t.c > 0) doc.text('< page ' + (t.n - 1), 0.08, pageH / 2);
          if (t.c < o.cols - 1) doc.text('page ' + (t.n + 1) + ' >', pageW - 0.08, pageH / 2, { align: 'right' });
          if (t.r > 0) doc.text('^ page ' + (t.n - o.cols), pageW / 2, 0.2, { align: 'center' });
          if (t.r < o.rows - 1) doc.text('v page ' + (t.n + o.cols), pageW / 2, pageH - 0.12, { align: 'center' });
          i++; o.onProgress && o.onProgress(i, total);
          setTimeout(step, 0);
        };
        step();
      } catch (e) { reject(e); }
    });
  };

  /* ---------- lead sheets and board (US Letter, points) ---------- */
  var X0 = 61, X1 = 551, W = 490;
  function lab(doc, text, x, y) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(95); doc.text(String(text).toUpperCase(), x, y, { charSpace: 1.1 }); doc.setTextColor(17);
  }
  function lines(doc, text, width, max) {
    var a = doc.splitTextToSize(String(text || ''), width);
    if (max && a.length > max) { a = a.slice(0, max); a[max - 1] = a[max - 1].replace(/\s*\S{0,3}$/, '') + '…'; }
    return a;
  }
  function oneLine(doc, text, width) { return lines(doc, text, width, 1)[0] || ''; }
  function header(doc, title, right, mono) {
    doc.setTextColor(17); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(title, X0, 76, { charSpace: 1.8 });
    doc.setFont(mono ? 'courier' : 'helvetica', mono ? 'bold' : 'normal'); doc.setFontSize(mono ? 20 : 12); doc.text(right, X1, 76, { align: 'right' });
    doc.setDrawColor(17); doc.setLineWidth(2.5); doc.line(X0, 87, X1, 87);
  }
  function footer(doc) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Cross-Index', X0, 762); doc.text('Printed ' + CI.fmtDate(CI.today()), X1, 762, { align: 'right' });
    doc.setTextColor(17);
  }

  CI.pdf = CI.pdf || {};
  CI.pdf.leadPage = function (doc, d, lead) {
    var kind = CI.leadKind(lead.kind), bank = d.banks.filter(function (b) { return b.id === lead.bankId; })[0];
    var rep = d.reports.filter(function (r) { return r.id === lead.raisedBy; })[0];
    header(doc, kind.title, lead.id, true);
    lab(doc, 'Bank', X0, 112); lab(doc, 'Issued', X0 + 250, 112); lab(doc, 'With', X0 + 385, 112);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(oneLine(doc, bank ? bank.name : '(bank removed)', 235), X0, 132);
    doc.text(CI.fmtDate(lead.issued), X0 + 250, 132); doc.text(lead.with, X0 + 385, 132);
    lab(doc, lead.kind === 'DATA_REQUEST' ? 'Retrieve' : 'Question', X0, 172);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    var q = lines(doc, lead.question, W, 5), y = 198;
    q.forEach(function (ln, i) { doc.text(ln, X0, y + i * 25); });
    y += (q.length - 1) * 25 + 34;
    lab(doc, 'Raised by', X0, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(rep ? rep.id : lead.raisedBy + ' (removed)', X0, y + 17);
    if (rep) {
      doc.setFont('helvetica', 'normal'); doc.text(rep.sourceType + '  ·  ' + CI.fmtDate(CI.reportDate(rep)), X0 + 52, y + 17);
      doc.setFontSize(11); doc.setTextColor(40);
      var sm = lines(doc, '“' + rep.summary + '”', W, 3); sm.forEach(function (ln, i) { doc.text(ln, X0, y + 34 + i * 14); });
      y += 34 + sm.length * 14;
    } else y += 20;
    doc.setTextColor(17);
    var yR = y + 20; lab(doc, 'Response', X0, yR);
    doc.setDrawColor(140); doc.setLineWidth(0.6);
    for (var ly = yR + 12; ly <= 604; ly += 30) doc.line(X0, ly, X1, ly);
    lab(doc, 'Status', X0, 626);
    var x = X0; doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    CI.LEAD_STATUS.forEach(function (s) {
      doc.setDrawColor(17); doc.setLineWidth(1.3); doc.rect(x, 633, 12, 12);
      if (lead.status === s.id) { doc.setLineWidth(1.6); doc.line(x + 2.5, 635.5, x + 9.5, 642.5); doc.line(x + 9.5, 635.5, x + 2.5, 642.5); }
      doc.text(s.label, x + 19, 643); x += 19 + doc.getTextWidth(s.label) + 26;
    });
    var segs = [[X0, X0 + 215, 'Returned by', lead.returnedBy], [X0 + 240, X0 + 345, 'Date', lead.returnedDate ? CI.fmtDate(lead.returnedDate) : ''],
      [X0 + 370, X1, 'Intake report no.', CI.leadResults(d, lead.id).map(function (r) { return r.id; }).join(', ')]];
    doc.setDrawColor(17); doc.setLineWidth(1);
    segs.forEach(function (s) {
      doc.line(s[0], 694, s[1], 694);
      if (s[3]) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(oneLine(doc, s[3], s[1] - s[0] - 4), s[0] + 2, 690); }
      lab(doc, s[2], s[0], 706);
    });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    var tail = lead.kind === 'DATA_REQUEST'
      ? 'Retrieve and preserve only. Do not interpret or contact anyone. Return through Intake and write ' + lead.id + ' on it.'
      : 'Return your results through Intake and write ' + lead.id + ' on them.';
    lines(doc, tail, W, 2).forEach(function (ln, i) { doc.text(ln, X0, 734 + i * 14); });
    footer(doc);
  };

  CI.pdf.leadSheets = function (d, leadIds) {
    var JS = JsPDF(), doc = new JS({ unit: 'pt', format: 'letter', compress: true });
    leadIds.forEach(function (id, i) {
      var lead = d.leads.filter(function (l) { return l.id === id; })[0]; if (!lead) return;
      if (i > 0) doc.addPage('letter', 'portrait');
      CI.pdf.leadPage(doc, d, lead);
    });
    return doc.output('blob');
  };

  CI.pdf.board = function (d, bankId) {
    var JS = JsPDF(), doc = new JS({ unit: 'pt', format: 'letter', compress: true });
    var bank = d.banks.filter(function (b) { return b.id === bankId; })[0];
    var all = d.leads.filter(function (l) { return l.bankId === bankId; }).sort(function (a, b) { return a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id); });
    var open = all.filter(function (l) { return !CI.isClosed(l); });
    var n = function (s) { return all.filter(function (l) { return l.status === s; }).length; };
    function top() {
      header(doc, 'OPEN LEADS', CI.fmtDate(CI.today()), false);
      lab(doc, 'Bank', X0, 112); lab(doc, 'Not started', X0 + 270, 112); lab(doc, 'In progress', X0 + 355, 112); lab(doc, 'Closed', X0 + 440, 112);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(oneLine(doc, bank ? bank.name : '(bank removed)', 255), X0, 132);
      doc.text(String(n('NOT_STARTED')), X0 + 270, 132); doc.text(String(n('IN_PROGRESS')), X0 + 355, 132); doc.text(String(n('DONE') + n('NO_RESULT')), X0 + 440, 132);
      lab(doc, 'Lead', X0, 176); lab(doc, 'Question', X0 + 64, 176); lab(doc, 'With', X0 + 270, 176); lab(doc, 'Issued', X0 + 346, 176); lab(doc, 'Status', X0 + 416, 176);
      doc.setDrawColor(17); doc.setLineWidth(1.6); doc.line(X0, 183, X1, 183);
      footer(doc);
      return 205;
    }
    var y = top();
    if (!open.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.text('No open leads.', X0, y + 10); }
    open.forEach(function (l) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      var ql = lines(doc, l.question, 196, 4), h = Math.max(1, ql.length) * 14;
      if (y + h > 728) { doc.addPage('letter', 'portrait'); y = top(); }
      doc.setFont('courier', 'bold'); doc.text(l.id, X0, y);
      doc.setFont('helvetica', 'normal'); ql.forEach(function (ln, i) { doc.text(ln, X0 + 64, y + i * 14); });
      doc.text(oneLine(doc, l.with, 70), X0 + 270, y); doc.setFontSize(10); doc.text(CI.fmtShort(l.issued), X0 + 346, y); doc.setFontSize(11);
      doc.setFont('helvetica', 'bold'); doc.text(oneLine(doc, CI.leadStatus(l.status).label, 70), X0 + 416, y);
      doc.setDrawColor(170); doc.setLineWidth(0.6); doc.line(X0, y + h + 6, X1, y + h + 6);
      y += h + 22;
    });
    return doc.output('blob');
  };

  /* ---------- handling plan sheet ---------- */
  function tick(doc, x, y, on, label) {
    doc.setDrawColor(17); doc.setLineWidth(1.3); doc.rect(x, y, 12, 12);
    if (on) { doc.setLineWidth(1.6); doc.line(x + 2.5, y + 2.5, x + 9.5, y + 9.5); doc.line(x + 9.5, y + 2.5, x + 2.5, y + 9.5); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(label, x + 19, y + 10);
    return x + 19 + doc.getTextWidth(label) + 26;
  }
  CI.pdf.planSheet = function (d, invId) {
    var JS = JsPDF(), doc = new JS({ unit: 'pt', format: 'letter', compress: true });
    var inv = d.investigations.filter(function (v) { return v.id === invId; })[0];
    if (!inv) throw new Error('No such investigation.');
    var bank = d.banks.filter(function (b) { return b.id === inv.bankId; })[0], p = inv.plan;
    header(doc, 'HANDLING PLAN', inv.id, true);
    lab(doc, 'Bank', X0, 112); lab(doc, 'Prepared by', X0 + 250, 112); lab(doc, 'Date', X0 + 385, 112);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(oneLine(doc, bank ? bank.name : '(bank removed)', 235), X0, 132);
    doc.text(oneLine(doc, p.preparedBy || '', 125), X0 + 250, 132); doc.text(p.updated ? CI.fmtDate(p.updated) : '', X0 + 385, 132);
    lab(doc, 'Objective', X0, 172);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    var ob = lines(doc, p.objective || '', W, 3), y = 194;
    ob.forEach(function (ln, i) { doc.text(ln, X0, y + i * 21); });
    y += Math.max(ob.length, 1) * 21 + 14;
    lab(doc, 'Outcome sought', X0, y); var x = X0;
    CI.PLAN_OUTCOMES.forEach(function (o) { x = tick(doc, x, y + 8, p.outcome === o.id, o.label); });
    y += 44;
    lab(doc, 'Actions', X0, y); lab(doc, 'Owner', X0 + 385, y);
    doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, y + 6, X1, y + 6); y += 24;
    var shown = 0;
    p.actions.forEach(function (a, i) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      var al = lines(doc, a.text, 330, 3), h = al.length * 14;
      if (y + h > 520) return;
      doc.setFont('helvetica', 'bold'); doc.text(String(i + 1) + '.', X0, y);
      doc.setFont('helvetica', 'normal'); al.forEach(function (ln, k) { doc.text(ln, X0 + 20, y + k * 14); });
      doc.text(oneLine(doc, a.owner, 100), X0 + 385, y);
      doc.setDrawColor(190); doc.setLineWidth(0.6); doc.line(X0, y + h + 2, X1, y + h + 2);
      y += h + 17; shown++;
    });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(95);
    if (!p.actions.length) doc.text('No actions yet.', X0, y);
    else if (shown < p.actions.length) doc.text('…and ' + (p.actions.length - shown) + ' more action(s) in the app.', X0, y);
    doc.setTextColor(17);
    doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, 548, X1, 548);
    lab(doc, 'Legal clearance (whole plan)', X0, 566);
    x = X0;
    [['CLEARED', 'Cleared'], ['CLEARED_WITH_CONDITIONS', 'Cleared with conditions'], ['RETURNED', 'Returned']].forEach(function (o) { x = tick(doc, x, 576, p.legal.status === o[0], o[1]); });
    lab(doc, 'Comments or conditions', X0, 612);
    doc.setDrawColor(140); doc.setLineWidth(0.6); doc.line(X0, 640, X1, 640); doc.line(X0, 664, X1, 664);
    if (p.legal.comments) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); lines(doc, p.legal.comments, W, 2).forEach(function (ln, i) { doc.text(ln, X0 + 2, 636 + i * 24); }); }
    var segs = [[X0, X0 + 215, 'Reviewed by', p.legal.reviewer], [X0 + 240, X0 + 345, 'Date', p.legal.date ? CI.fmtDate(p.legal.date) : ''], [X0 + 370, X1, 'Signature', '']];
    doc.setDrawColor(17); doc.setLineWidth(1);
    segs.forEach(function (sg) {
      doc.line(sg[0], 722, sg[1], 722);
      if (sg[3]) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(oneLine(doc, sg[3], sg[1] - sg[0] - 4), sg[0] + 2, 718); }
      lab(doc, sg[2], sg[0], 734);
    });
    footer(doc);
    return doc.output('blob');
  };
})(typeof window !== 'undefined' ? window : globalThis);
