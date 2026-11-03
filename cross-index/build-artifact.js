// Builds a single self-contained page (dist/cross-index-artifact.html) for hosting as a Claude artifact.
// Plain Node, nothing to install:  node build-artifact.js            (the artifact build)
//                                  node build-artifact.js --local    (dist/Cross-Index.html: one file to double-click and run on a computer)
const fs = require('fs'), path = require('path');
const LOCAL = process.argv.indexOf('--local') !== -1;
const dir = __dirname, read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const safeJs = t => t.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src='));
const scripts = ['vendor/cytoscape.min.js', 'vendor/jspdf.umd.min.js', 'core.js', 'portraits.js', 'sample.js', 'pilot.js', 'images.js', 'chart.js', 'pdf.js', 'app.js', 'chartview.js', 'banks.js', 'documents.js', 'leads.js', 'pointers.js', 'observe.js', 'indexes.js', 'investigations.js', 'casechart.js', 'folder.js', 'filechart.js', 'backup.js', 'datafile.js'];
const out = [
  '<title>Cross-Index</title>',
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  LOCAL ? '' : '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">',
  '<style>\n' + read('style.css') + '\n</style>',
  body.trim(),
  // Embedded pages cannot start downloads directly, so the artifact build drops the JSON download button (Copy and paste-import remain). PDFs go through the downloads capability.
  ...scripts.map(f => '<script>\n' + safeJs(read(f)).split(LOCAL ? '\u0000' : '<button class="btn" data-action="export-download">Download file</button>').join('') + '\n</script>'),
  '<script>CI.app.start();</script>'
].join('\n');
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
const name = LOCAL ? 'Cross-Index.html' : 'cross-index-artifact.html';
fs.writeFileSync(path.join(dir, 'dist', name), out);
console.log('dist/' + name, (out.length / 1024).toFixed(0) + ' KB');
