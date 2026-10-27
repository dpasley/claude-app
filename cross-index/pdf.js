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
  function footer() { /* the common stamp is added once at the end: CI.pdf.stamp */ }

  CI.pdf = CI.pdf || {};
  CI.pdf.leadPage = function (doc, d, lead) {
    var kind = CI.leadKind(lead.kind), inv = d.investigations.filter(function (v) { return v.id === lead.investigationId; })[0];
    var bank = inv && d.banks.filter(function (b) { return b.id === inv.bankId; })[0];
    var rep = d.reports.filter(function (r) { return r.id === lead.raisedBy; })[0];
    header(doc, kind.title, lead.id, true);
    lab(doc, 'Investigation', X0, 112); lab(doc, 'Issued', X0 + 250, 112); lab(doc, lead.kind === 'DATA_REQUEST' ? 'With' : 'Assigned to', X0 + 385, 112);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(oneLine(doc, plain(inv ? inv.id + '  ' + (bank ? bank.name : '') : '(none)'), 235), X0, 132);
    doc.text(CI.fmtDate(lead.issued), X0 + 250, 132); doc.text(oneLine(doc, lead.kind === 'DATA_REQUEST' ? lead.with : (lead.assigned || ''), 105), X0 + 385, 132);
    lab(doc, lead.kind === 'DATA_REQUEST' ? 'Retrieve' : 'Reason for the lead', X0, 172);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    var q = lines(doc, lead.question, W, 5), y = 198;
    q.forEach(function (ln, i) { doc.text(ln, X0, y + i * 25); });
    y += (q.length - 1) * 25 + 34;
    if (lead.raisedBy || lead.forLead) {
      lab(doc, lead.raisedBy ? 'Prompted by' : 'For lead', X0, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      if (lead.raisedBy) {
        doc.text(rep ? rep.id : lead.raisedBy + ' (removed)', X0, y + 17);
        if (rep) {
          doc.setFont('helvetica', 'normal'); doc.text((rep.sourceType || '') + '  \u00b7  ' + CI.fmtDate(CI.reportDate(rep)), X0 + 52, y + 17);
          doc.setFontSize(11); doc.setTextColor(40);
          var sm = lines(doc, plain('"' + (rep.summary || rep.subject || '') + '"'), W, 3); sm.forEach(function (ln, i) { doc.text(ln, X0, y + 34 + i * 14); });
          y += 34 + sm.length * 14;
        } else y += 20;
      } else {
        var fl = d.leads.filter(function (x) { return x.id === lead.forLead; })[0];
        doc.text(lead.forLead, X0, y + 17); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
        if (fl) doc.text(oneLine(doc, plain(fl.question), 400), X0 + 52, y + 17); y += 22;
      }
    }
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
    lines(doc, tail, W, 2).forEach(function (ln, i) { doc.text(ln, X0, 728 + i * 13); });
    footer(doc);
  };

  CI.pdf.leadSheets = function (d, leadIds) {
    var JS = JsPDF(), doc = new JS({ unit: 'pt', format: 'letter', compress: true });
    leadIds.forEach(function (id, i) {
      var lead = CI.findLead(d, id); if (!lead) return;
      if (i > 0) doc.addPage('letter', 'portrait');
      CI.pdf.leadPage(doc, d, lead);
    });
    CI.pdf.stamp(doc, leadIds.length === 1 ? 'Lead sheet \u00b7 ' + leadIds[0] : 'Lead sheets');
    return doc.output('blob');
  };

  /* The list of an investigation's leads (or its requests): one entry each with reason, assignment, dates, status and a line or two of response.
   * o: { kind: 'lead' | 'request', openOnly } */
  CI.pdf.leadList = function (d, invId, o) {
    o = o || {};
    var inv = d.investigations.filter(function (v) { return v.id === invId; })[0]; if (!inv) throw new Error('No such investigation.');
    var bank = d.banks.filter(function (b) { return b.id === inv.bankId; })[0], req = o.kind === 'request';
    var all = (req ? CI.requestsOf(d, invId) : CI.leadsOf(d, invId)).sort(function (a, b) { return a.issued.localeCompare(b.issued) || a.id.localeCompare(b.id); });
    var rows = o.openOnly ? all.filter(function (l) { return !CI.isClosed(l); }) : all;
    var doc = CI.pdf.begin(), title = (req ? 'REQUEST LIST' : 'LEAD LIST');
    var again = function () { return CI.pdf.top(doc, title + ' (continued)', inv.id); };
    var y = CI.pdf.top(doc, title, inv.id);
    var n = function (st) { return all.filter(function (l) { return l.status === st; }).length; };
    lab(doc, 'Special bank', X0, y); lab(doc, 'Investigator', X0 + 250, y); lab(doc, 'Showing', X0 + 385, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(oneLine(doc, plain(bank ? bank.name : ''), 235), X0, y + 18); doc.text(oneLine(doc, plain(inv.investigator || ''), 125), X0 + 250, y + 18);
    doc.text((o.openOnly ? 'Open ' : 'All ') + rows.length + ' of ' + all.length, X0 + 385, y + 18);
    y += 34; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(95);
    doc.text('Not started ' + n('NOT_STARTED') + '   ·   In progress ' + n('IN_PROGRESS') + '   ·   Done ' + n('DONE') + '   ·   Nothing found ' + n('NO_RESULT'), X0, y); doc.setTextColor(17);
    y += 12; doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, y, X1, y); y += 20;
    if (!rows.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.text(req ? 'No requests.' : 'No leads.', X0, y); }
    rows.forEach(function (l) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      var ql = doc.splitTextToSize(plain(l.question), 245).slice(0, 4), rl = l.response ? doc.splitTextToSize('Response: ' + plain(l.response), W - 70).slice(0, 2) : [];
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      var al = doc.splitTextToSize(plain(req ? l.with : (l.assigned || '')) || ' ', 92).slice(0, 2), sl = doc.splitTextToSize(CI.leadStatus(l.status).label, 70).slice(0, 2);
      var top = Math.max(ql.length * 14, (al.length + 1) * 12 + 2, sl.length * 12), h = top + (rl.length ? rl.length * 12 + 4 : 0);
      if (y + h > 735) { doc.addPage('letter', 'portrait'); y = again() + 6; }
      doc.setFont('courier', 'bold'); doc.setFontSize(10.5); doc.text(l.id, X0, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ql.forEach(function (ln, i) { doc.text(ln, X0 + 62, y + i * 14); });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      al.forEach(function (ln, i) { doc.text(ln, X0 + 318, y + i * 12); }); doc.text(CI.fmtShort(l.issued), X0 + 318, y + al.length * 12 + 2);
      doc.setFont('helvetica', 'bold'); sl.forEach(function (ln, i) { doc.text(ln, X0 + 420, y + i * 12); });
      if (rl.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(70); rl.forEach(function (ln, i) { doc.text(ln, X0 + 62, y + top + i * 12); }); doc.setTextColor(17); }
      doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(X0, y + h + 2, X1, y + h + 2);
      y += h + 16;
    });
    CI.pdf.stamp(doc, (req ? 'Request list' : 'Lead list') + ' · ' + inv.id + (bank ? ' · ' + bank.name : ''));
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
    lab(doc, 'Special bank', X0, 112); lab(doc, 'Prepared by', X0 + 250, 112); lab(doc, 'Date', X0 + 385, 112);
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
    CI.pdf.stamp(doc, 'Handling plan \u00b7 ' + inv.id);
    return doc.output('blob');
  };

  /* ---------- the common print style: every sheet from here on starts and ends the same way ----------
   * Top: document type in capitals, the file or bank it belongs to, a heavy rule.
   * Bottom of every page: what it is, the date printed and "Page n of m". */
  CI.pdf.begin = function () { var JS = JsPDF(); return new JS({ unit: 'pt', format: 'letter', compress: true }); };
  CI.pdf.top = function (doc, type, name) {
    doc.setTextColor(17); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(type, X0, 76, { charSpace: 1.8 });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(oneLine(doc, name, 290), X1, 76, { align: 'right' });
    doc.setDrawColor(17); doc.setLineWidth(2.5); doc.line(X0, 87, X1, 87);
    return 112;
  };
  CI.pdf.stamp = function (doc, what) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.setDrawColor(190); doc.setLineWidth(0.6); doc.line(X0, 748, X1, 748);
      doc.text(oneLine(doc, what, 300), X0, 762);
      doc.text('Printed ' + CI.fmtDate(CI.today()) + '   ·   Page ' + i + ' of ' + n, X1, 762, { align: 'right' });
    }
    doc.setTextColor(17);
  };
  /* Writes wrapped text, adding pages as needed. Returns the y after the text. */
  CI.pdf.flow = function (doc, text, o) {
    var size = o.size || 11.5, lead = o.lead || size * 1.45, x = o.x == null ? X0 : o.x, w = o.w || W, y = o.y;
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(size);
    String(text || '').split(/\n/).forEach(function (para) {
      var ls = para.trim() ? doc.splitTextToSize(para, w) : [''];
      ls.forEach(function (ln) {
        if (y > 728) { doc.addPage('letter', 'portrait'); y = o.again(); doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(size); }
        doc.text(ln, x, y); y += lead;
      });
    });
    return y;
  };

  /* One summary on its own sheet (or more, if it runs long). */
  function summaryPage(doc, d, idx, s, first) {
    var f = idx.entity[s.fileId] || { name: '(file removed)', type: 'individual' };
    if (!first) doc.addPage('letter', 'portrait');
    var again = function () { return CI.pdf.top(doc, 'FILE SUMMARY (continued)', f.name); };
    var y = CI.pdf.top(doc, 'FILE SUMMARY', f.name);
    var reps = (s.covers || []).map(function (r) { return idx.report[r]; }).filter(Boolean).sort(function (a, b) { return (a.received || '').localeCompare(b.received || ''); });
    lab(doc, 'Date', X0, y); lab(doc, 'Written by', X0 + 130, y); lab(doc, 'Kind of file', X0 + 330, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(CI.fmtDate(s.date), X0, y + 20); doc.text(oneLine(doc, s.author || '', 185), X0 + 130, y + 20); doc.text(oneLine(doc, CI.TYPE_LABEL[f.type] || '', 150), X0 + 330, y + 20);
    y += 34; doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, y, X1, y); y += 26;
    y = CI.pdf.flow(doc, s.text, { y: y, size: 12, lead: 17.5, again: again });
    y += 14;
    if (y > 700) { doc.addPage('letter', 'portrait'); y = again(); }
    doc.setDrawColor(190); doc.setLineWidth(0.6); doc.line(X0, y, X1, y); y += 16;
    lab(doc, 'Covers ' + reps.length + ' report' + (reps.length === 1 ? '' : 's') + (reps.length ? ' (' + CI.fmtDate(reps[0].received) + (reps.length > 1 ? ' to ' + CI.fmtDate(reps[reps.length - 1].received) : '') + ')' : ''), X0, y);
    y += 14;
    var ids = reps.map(function (r) { return r.id; }).join(',  ');
    doc.setFont('courier', 'normal');
    CI.pdf.flow(doc, ids || 'None recorded.', { y: y, size: 9.5, lead: 13, again: again });
    doc.setFont('helvetica', 'normal');
  }
  CI.pdf.summarySheets = function (d, idx, summaryIds, fileName) {
    var doc = CI.pdf.begin();
    summaryIds.forEach(function (id, i) {
      var s = d.summaries.filter(function (x) { return x.id === id; })[0]; if (s) summaryPage(doc, d, idx, s, i === 0);
    });
    CI.pdf.stamp(doc, 'File summary · ' + fileName);
    return doc.output('blob');
  };

  /* The time line of a file: date down the left, information beside it. o: { maxLevel, from, to } */
  CI.pdf.timelineSheet = function (d, idx, fileIds, o) {
    o = o || {};
    fileIds = [].concat(fileIds); var doc = CI.pdf.begin(), f = idx.entity[fileIds[0]], many = fileIds.length > 1;
    if (!f) throw new Error('No such file.');
    var title = o.title || (many ? f.name + ' and ' + (fileIds.length - 1) + ' more' : f.name);
    var rows = CI.timelineMany(d, fileIds, o.maxLevel || 3, o.from, o.to);
    var again = function () { return CI.pdf.top(doc, 'TIME LINE (continued)', title); };
    var y = CI.pdf.top(doc, 'TIME LINE', title);
    var lv = { 1: 'Key events only', 2: 'Key events and standard entries', 3: 'All entries, including fine detail' }[o.maxLevel || 3];
    lab(doc, 'Detail', X0, y); lab(doc, 'Period', X0 + 270, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(lv, X0, y + 16);
    doc.text(o.from || o.to ? (o.from ? CI.fmtDate(o.from) : 'start') + ' to ' + (o.to ? CI.fmtDate(o.to) : 'now') : (rows.length ? CI.fmtDate(rows[0].date) + ' to ' + CI.fmtDate(rows[rows.length - 1].date) : ''), X0 + 270, y + 16);
    y += 30; doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, y, X1, y); y += 22;
    if (!rows.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.text('No entries at this level of detail.', X0, y); }
    rows.forEach(function (t) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      var ls = doc.splitTextToSize(plain(t.text), 372), h = ls.length * 15 + (t.reportIds.length || many ? 13 : 0);
      if (y + h > 735) { doc.addPage('letter', 'portrait'); y = again() + 6; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(CI.fmtDate(t.date), X0, y);
      doc.setFont('helvetica', t.level === 1 ? 'bold' : 'normal'); doc.setFontSize(11);
      ls.forEach(function (ln, i) { doc.text(ln, X0 + 118, y + i * 15); });
      if (t.reportIds.length || many) { doc.setFont('courier', 'normal'); doc.setFontSize(8.5); doc.setTextColor(95); doc.text(plain((many ? ((idx.entity[t.fileId] || {}).name || '') + (t.reportIds.length ? '   ' : '') : '')) + t.reportIds.join(', '), X0 + 118, y + ls.length * 15 - 2); doc.setTextColor(17); }
      doc.setDrawColor(210); doc.setLineWidth(0.5); doc.line(X0, y + h - 7, X1, y + h - 7);
      y += h + 9;
    });
    CI.pdf.stamp(doc, 'Time line · ' + f.name);
    return doc.output('blob');
  };

  /* ---------- the other file documents, in the same style ---------- */
  function plain(t) { return String(t || '').replace(/→/g, '>').replace(/←/g, '<').replace(/↔/g, '<>').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...'); }
  /* A table that adds pages as it goes. cols: [{ w, head }]; rows: arrays of strings; mono: column numbers in courier. Returns y. */
  function table(doc, cols, rows, y, again, o) {
    o = o || {}; var xs = [], x = X0; cols.forEach(function (c) { xs.push(x); x += c.w; });
    function head() {
      cols.forEach(function (c, i) { lab(doc, c.head, xs[i], y); });
      doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, y + 7, X1, y + 7); y += 24;
    }
    head();
    rows.forEach(function (r) {
      if (r.section) {
        if (y > 700) { doc.addPage('letter', 'portrait'); y = again(); head(); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(plain(r.section).toUpperCase(), X0, y, { charSpace: 0.8 }); y += 16; return;
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      var cells = r.map(function (t, i) { return doc.splitTextToSize(plain(t), cols[i].w - 10).slice(0, 3); });
      var h = Math.max.apply(null, cells.map(function (c) { return c.length; })) * 13;
      if (y + h > 735) { doc.addPage('letter', 'portrait'); y = again(); head(); }
      cells.forEach(function (c, i) {
        var mo = (o.mono || []).indexOf(i) !== -1; doc.setFont(mo ? 'courier' : 'helvetica', mo ? 'normal' : (i === 0 ? 'bold' : 'normal'));
        doc.setFontSize(10.5); c.forEach(function (ln, k) { doc.text(ln, xs[i], y + k * 13); });
      });
      doc.setDrawColor(215); doc.setLineWidth(0.5); doc.line(X0, y + h - 6, X1, y + h - 6);
      y += h + 6;
    });
    return y;
  };
  function facts(doc, items, y) {
    items.forEach(function (it, i) {
      var x = X0 + (i % 3) * 165;
      lab(doc, it[0], x, y); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(oneLine(doc, plain(it[1]) || '-', 150), x, y + 17);
      if (i % 3 === 2 && i < items.length - 1) y += 40;
    });
    y += 38; doc.setDrawColor(17); doc.setLineWidth(1.2); doc.line(X0, y - 10, X1, y - 10); return y + 14;
  }

  CI.pdf.profileSheet = function (d, idx, fileId) {
    var e = idx.entity[fileId]; if (!e) throw new Error('No such file.');
    var doc = CI.pdf.begin(), again = function () { return CI.pdf.top(doc, 'PROFILE (continued)', e.name); };
    var y = CI.pdf.top(doc, 'PROFILE', e.name), p = e.profile || {};
    y = facts(doc, [['Kind of file', CI.TYPE_LABEL[e.type]], ['Identifying details', e.details], ['Also known as', (e.aliases || []).join(', ')]], y);
    CI.profileFields(e.type).forEach(function (f) {
      var v = f.kind === 'date' ? CI.fmtDate(p[f.id] || '') : (p[f.id] || '');
      var ls = doc.splitTextToSize(plain(v) || '', 290).length;
      if (y + 20 + Math.max(1, ls) * 15 > 735) { doc.addPage('letter', 'portrait'); y = again(); }
      lab(doc, f.label, X0, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5);
      y = CI.pdf.flow(doc, plain(v), { x: X0 + 200, w: 290, y: y, size: 11.5, lead: 15, again: again });
      doc.setDrawColor(215); doc.setLineWidth(0.5); doc.line(X0, y - 8, X1, y - 8); y += 8;
    });
    if (e.notes) { y += 6; lab(doc, 'Notes', X0, y); y = CI.pdf.flow(doc, plain(e.notes), { x: X0 + 200, w: 290, y: y, size: 11.5, lead: 15, again: again }); }
    CI.pdf.stamp(doc, 'Profile · ' + e.name); return doc.output('blob');
  };

  CI.pdf.connectionsSheet = function (d, idx, fileId) {
    var e = idx.entity[fileId]; if (!e) throw new Error('No such file.');
    var doc = CI.pdf.begin(), again = function () { return CI.pdf.top(doc, 'CONNECTIONS (continued)', e.name); };
    var y = CI.pdf.top(doc, 'CONNECTIONS', e.name), groups = CI.connectionIndex(d, fileId, idx), rows = [];
    groups.forEach(function (g) { rows.push({ section: g.label }); g.rows.forEach(function (r) { rows.push([r.other.name, r.phrase, r.note, r.reportId]); }); });
    if (!rows.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.text('No connections recorded for this name.', X0, y); }
    else table(doc, [{ w: 130, head: 'Name' }, { w: 100, head: 'Connection' }, { w: 190, head: 'What it is' }, { w: 70, head: 'Report' }], rows, y, again, { mono: [3] });
    CI.pdf.stamp(doc, 'Connections · ' + e.name); return doc.output('blob');
  };

  CI.pdf.reportSheet = function (d, idx, reportId) {
    var r = idx.report[reportId]; if (!r) throw new Error('No such report.');
    var doc = CI.pdf.begin(), title = r.subject || r.sourceRef || r.id, again = function () { return CI.pdf.top(doc, 'REPORT (continued)', r.id); };
    var y = CI.pdf.top(doc, 'REPORT', r.id);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); var tl = doc.splitTextToSize(plain(title), W).slice(0, 2); tl.forEach(function (ln, i) { doc.text(ln, X0, y + 6 + i * 19); }); y += 14 + tl.length * 19;
    y = facts(doc, [['Date of report', CI.fmtDate(r.received)], ['Source', r.sourceRef], ['Preserved copy', r.archiveLoc]], y);
    if (r.summary) { lab(doc, 'Notes', X0, y); y = CI.pdf.flow(doc, plain(r.summary), { y: y + 18, size: 11.5, lead: 16, again: again }) + 10; }
    var names = (r.entities || []).map(function (x) { return idx.entity[x.entityId]; }).filter(Boolean).map(function (e) { return [e.name, CI.TYPE_LABEL[e.type] || '', e.details || '']; });
    if (y > 650) { doc.addPage('letter', 'portrait'); y = again(); }
    lab(doc, 'Names mentioned (' + names.length + ')', X0, y); y += 16;
    if (names.length) y = table(doc, [{ w: 200, head: 'Name' }, { w: 90, head: 'Kind' }, { w: 200, head: 'Identifying details' }], names, y, again) + 10;
    var links = d.links.filter(function (l) { return l.reportId === reportId; }).map(function (l) {
      var t = CI.linkType(d, l.type), a = idx.entity[l.from], b = idx.entity[l.to];
      return [a ? a.name : '?', (t.directed ? t.label + ' >' : t.label), b ? b.name : '?', l.note || ''];
    });
    if (y > 650) { doc.addPage('letter', 'portrait'); y = again(); }
    lab(doc, 'Connections shown (' + links.length + ')', X0, y); y += 16;
    if (links.length) table(doc, [{ w: 120, head: 'From' }, { w: 100, head: 'Connection' }, { w: 120, head: 'To' }, { w: 150, head: 'What it is' }], links, y, again);
    CI.pdf.stamp(doc, 'Report · ' + r.id); return doc.output('blob');
  };

  CI.pdf.estimateSheet = function (d, idx, bankId, estId) {
    var b = d.banks.filter(function (x) { return x.id === bankId; })[0]; if (!b) throw new Error('No such special bank.');
    var est = CI.estimateOf(b, estId), doc = CI.pdf.begin(), again = function () { return CI.pdf.top(doc, 'ESTIMATE (continued)', b.name); };
    var y = CI.pdf.top(doc, 'ESTIMATE', b.name);
    y = facts(doc, [['Estimate', est.label], ['Written', est.updated ? CI.fmtDate(est.updated) : CI.fmtDate(est.created)], ['Files in the bank', String((b.files || []).length)]], y);
    function block(title, items, empty) {
      if (y > 690) { doc.addPage('letter', 'portrait'); y = again(); }
      lab(doc, title, X0, y); y += 18;
      if (!items.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(empty, X0, y); y += 24; return; }
      items.forEach(function (it, i) {
        y = CI.pdf.flow(doc, (i + 1) + '.', { x: X0, w: 24, y: y, size: 11.5, lead: 16, bold: true, again: again }) - 16;
        y = CI.pdf.flow(doc, plain(it.text), { x: X0 + 24, w: W - 24, y: y, size: 11.5, lead: 16, again: again });
        if (it.reportIds.length) { doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(95); doc.text('Rests on ' + it.reportIds.join(', '), X0 + 24, y - 2); doc.setTextColor(17); y += 12; }
        y += 8;
      });
      y += 6;
    }
    if (est.summary) { lab(doc, 'Summary', X0, y); y = CI.pdf.flow(doc, plain(est.summary), { y: y + 18, size: 12, lead: 17, again: again }) + 10; }
    block('Established (rests on reports)', est.items.filter(function (i) { return i.kind === 'ESTABLISHED'; }), 'None.');
    block('Working theories', est.items.filter(function (i) { return i.kind === 'HYPOTHESIS'; }), 'None.');
    CI.pdf.stamp(doc, 'Estimate · ' + b.name + ' · ' + est.label); return doc.output('blob');
  };
})(typeof window !== 'undefined' ? window : globalThis);
