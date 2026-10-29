/* Pictures for the chart: faces for individuals, logos for groups.
 * Uploaded files are shrunk in the browser and stored on the entity as a small data URI (`photo`),
 * so they travel with exports. Entities without a picture get a drawn placeholder. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  /* Picture tiles. Every file on the chart is one self-contained SVG: a type-coloured frame with the photo or logo
   * (or a drawn placeholder) filling it edge to edge. Frame and picture are drawn together, so there are no gaps. */
  var GLYPH = {
    individual: '<circle cx="48" cy="34" r="16"/><path d="M12 96c0-22 16-36 36-36s36 14 36 36z"/>',
    group: '<path d="M24 86V22a3 3 0 013-3h30a3 3 0 013 3v16h12a3 3 0 013 3v45z"/><g fill="CUT"><rect x="32" y="28" width="7" height="7"/><rect x="45" y="28" width="7" height="7"/><rect x="32" y="42" width="7" height="7"/><rect x="45" y="42" width="7" height="7"/><rect x="32" y="56" width="7" height="7"/><rect x="45" y="56" width="7" height="7"/><rect x="62" y="48" width="6" height="6"/><rect x="62" y="60" width="6" height="6"/><rect x="40" y="70" width="12" height="16"/></g>',
    subject: '<path d="M26 14h30l16 16v52H26z"/><path d="M56 14v16h16" fill="none" stroke="CUT" stroke-width="3"/><g fill="CUT"><rect x="35" y="42" width="28" height="4"/><rect x="35" y="52" width="28" height="4"/><rect x="35" y="62" width="18" height="4"/></g>',
    area: '<path d="M48 10c-15 0-26 11-26 26 0 20 26 50 26 50s26-30 26-50c0-15-11-26-26-26z"/><circle cx="48" cy="36" r="10" fill="CUT"/>',
    item: '<path d="M14 14h34l34 34-34 34-34-34z"/><circle cx="31" cy="31" r="6" fill="CUT"/>'
  };
  function mix(hex, k) { // k>0 lightens toward white, k<0 darkens toward black
    var n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k), c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v + (t - v) * a); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  CI.tile = function (type, color, photo) {
    var tint = mix(color, 0.86), ring = color;
    var glyph = function (tx, ty, sc) { return '<g fill="' + color + '" transform="translate(' + tx + ' ' + ty + ') scale(' + sc + ')">' + (GLYPH[type] || GLYPH.subject).replace(/CUT/g, tint) + '</g>'; };
    var defs = '<defs>', body;
    if (type === 'individual') {
      defs += '<clipPath id="c"><circle cx="100" cy="100" r="90"/></clipPath></defs>';
      body = '<circle cx="100" cy="100" r="96" fill="#fff" stroke="' + ring + '" stroke-width="8"/>' + (photo
        ? '<image xlink:href="' + photo + '" x="10" y="10" width="180" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>'
        : '<circle cx="100" cy="100" r="90" fill="' + tint + '"/><g clip-path="url(#c)">' + glyph(9, 8, 1.9) + '</g>');
    } else if (type === 'group') {
      defs += '<clipPath id="c"><rect x="12" y="12" width="176" height="176" rx="32"/></clipPath></defs>';
      body = '<rect x="4" y="4" width="192" height="192" rx="40" fill="#fff" stroke="' + ring + '" stroke-width="8"/>' + (photo
        ? '<image xlink:href="' + photo + '" x="24" y="24" width="152" height="152" preserveAspectRatio="xMidYMid meet" clip-path="url(#c)"/>'
        : '<rect x="12" y="12" width="176" height="176" rx="32" fill="' + tint + '"/>' + glyph(26, 26, 1.5));
    } else if (type === 'area') {
      defs += '</defs>';
      body = '<polygon points="8,100 52,10 148,10 192,100 148,190 52,190" fill="' + tint + '" stroke="' + ring + '" stroke-width="9" stroke-linejoin="round"/>' + glyph(36, 34, 1.3);
    } else if (type === 'item') {
      defs += '</defs>';
      body = '<polygon points="40,8 160,8 192,40 192,160 160,192 40,192 8,160 8,40" fill="' + tint + '" stroke="' + ring + '" stroke-width="9" stroke-linejoin="round"/>' + glyph(36, 34, 1.3);
    } else {
      defs += '</defs>';
      body = '<polygon points="100,6 194,100 100,194 6,100" fill="' + tint + '" stroke="' + ring + '" stroke-width="9" stroke-linejoin="round"/>' + glyph(46, 44, 1.1);
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200" viewBox="0 0 200 200">' + defs + body + '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };
  CI.placeholder = function (type, color) { return CI.tile(type, color, ''); };

  /* Which entity types can carry an uploaded picture, and how it is cropped. */
  CI.PHOTO_TYPES = { individual: { label: 'Photo', crop: 'square' }, group: { label: 'Logo', crop: 'fit' } };

  /* Pure sizing helper (also used by tests): returns the source rectangle and output size. */
  CI.photoGeometry = function (w, h, mode, max) {
    max = max || 256;
    if (mode === 'square') {
      var side = Math.min(w, h), out = Math.min(max, side);
      return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), sw: side, sh: side, ow: out, oh: out };
    }
    var k = Math.min(1, max / Math.max(w, h));
    return { sx: 0, sy: 0, sw: w, sh: h, ow: Math.max(1, Math.round(w * k)), oh: Math.max(1, Math.round(h * k)) };
  };

  /* file -> data URI (JPEG for faces, PNG for logos so transparency survives). */
  CI.readPhoto = function (file, type) {
    return new Promise(function (resolve, reject) {
      var spec = CI.PHOTO_TYPES[type];
      if (!spec) { reject(new Error('Pictures can be added to individuals and groups.')); return; }
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('Choose an image file (JPEG, PNG or WebP).')); return; }
      var rd = new FileReader();
      rd.onerror = function () { reject(new Error('Could not read that file.')); };
      rd.onload = function () {
        var img = new root.Image();
        img.onerror = function () { reject(new Error('That file could not be opened as an image.')); };
        img.onload = function () {
          try {
            var g = CI.photoGeometry(img.naturalWidth || img.width, img.naturalHeight || img.height, spec.crop, 256);
            var c = root.document.createElement('canvas'); c.width = g.ow; c.height = g.oh;
            var ctx = c.getContext('2d');
            if (spec.crop === 'square') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, g.ow, g.oh); }
            ctx.drawImage(img, g.sx, g.sy, g.sw, g.sh, 0, 0, g.ow, g.oh);
            resolve(spec.crop === 'square' ? c.toDataURL('image/jpeg', 0.86) : c.toDataURL('image/png'));
          } catch (e) { reject(new Error('Could not process that image.')); }
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
