/* Pictures for the chart: faces for individuals, logos for groups.
 * Uploaded files are shrunk in the browser and stored on the entity as a small data URI (`photo`),
 * so they travel with exports. Entities without a picture get a drawn placeholder. */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  var ICON = {
    individual: '<circle cx="48" cy="35" r="15" fill="#fff"/><path d="M17 84c0-17 14-28 31-28s31 11 31 28z" fill="#fff"/>',
    group: '<rect x="26" y="20" width="44" height="62" rx="2" fill="#fff"/><rect x="34" y="30" width="8" height="8" fill="COLOR"/><rect x="54" y="30" width="8" height="8" fill="COLOR"/><rect x="34" y="46" width="8" height="8" fill="COLOR"/><rect x="54" y="46" width="8" height="8" fill="COLOR"/><rect x="42" y="62" width="12" height="20" fill="COLOR"/>',
    subject: '<path d="M27 16h28l16 16v48H27z" fill="#fff"/><path d="M55 16v16h16" fill="none" stroke="COLOR" stroke-width="3"/><rect x="35" y="44" width="28" height="4" fill="COLOR"/><rect x="35" y="54" width="28" height="4" fill="COLOR"/><rect x="35" y="64" width="18" height="4" fill="COLOR"/>',
    location: '<path d="M48 14c-14 0-24 10-24 24 0 18 24 44 24 44s24-26 24-44c0-14-10-24-24-24z" fill="#fff"/><circle cx="48" cy="38" r="9" fill="COLOR"/>'
  };

  CI.placeholder = function (type, color) {
    var icon = (ICON[type] || ICON.subject).replace(/COLOR/g, color);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="' + color + '"/>' + icon + '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };

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
