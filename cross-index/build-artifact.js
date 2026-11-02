// Builds a single self-contained page (dist/cross-index-artifact.html) for hosting as a Claude artifact.
// Plain Node, nothing to install:  node build-artifact.js
const fs = require('fs'), path = require('path');
const dir = __dirname, read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const safeJs = t => t.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src='));
const scripts = ['vendor/cytoscape.min.js', 'vendor/jspdf.umd.min.js', 'core.js', 'portraits.js', 'sample.js', 'pilot.js', 'images.js', 'chart.js', 'pdf.js', 'app.js', 'chartview.js', 'banks.js', 'documents.js', 'leads.js', 'pointers.js', 'observe.js', 'indexes.js', 'investigations.js', 'casechart.js', 'folder.js', 'filechart.js', 'backup.js', 'datafile.js'];
const out = [
  '<title>Cross-Index</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">',
  '<style>\n' + read('style.css') + '\n</style>',
  body.trim(),
  // Embedded pages cannot start downloads directly, so the artifact build drops the JSON download button (Copy and paste-import remain). PDFs go through the downloads capability.
  ...scripts.map(f => '<script>\n' + safeJs(read(f)).split('<button class="btn" data-action="export-download">Download file</button>').join('') + '\n</script>'),
  '<script>CI.app.start();</script>'
].join('\n');
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist', 'cross-index-artifact.html'), out);
console.log('dist/cross-index-artifact.html', (out.length / 1024).toFixed(0) + ' KB');

// The same app as ONE file for offline use (offline/cross-index.html): no network needed, nothing to install.
// Open it in Chrome or Edge, choose a data file in Settings, and replace this file with a newer copy whenever you like.
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const offline = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cross-Index</title>',
  '<style>\n' + read('style.css') + '\n</style></head><body>',
  body.trim(),
  ...scripts.map(f => '<script>\n' + safeJs(read(f)) + '\n</script>'),
  '<script>CI.BUILD = ' + JSON.stringify(stamp) + '; CI.app.start();</script>',
  '</body></html>'
].join('\n');
fs.mkdirSync(path.join(dir, 'offline'), { recursive: true });
fs.writeFileSync(path.join(dir, 'offline', 'cross-index.html'), offline);
console.log('offline/cross-index.html', (offline.length / 1024).toFixed(0) + ' KB', stamp);
