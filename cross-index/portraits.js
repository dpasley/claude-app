/* Drawn pictures for the sample data: illustrated portraits for individuals and marks for groups.
 * Nobody here is a real person and no logo is a real brand. Each picture is a small self-contained SVG
 * returned as a data URI, the same form an uploaded photo or logo takes (`entity.photo`). */
(function (root) {
  'use strict';
  var CI = root.CI = root.CI || {};

  function uri(svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }
  function shade(hex, k) { // k>0 lighter, k<0 darker
    var n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k), c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v + (t - v) * a); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  /* ---------- portraits ---------- */
  var HAIR = {
    short: function (c) { return '<path d="M52 92c-4-34 14-58 48-58s52 24 46 58c-4-14-10-24-18-30-18 8-40 8-58 0-8 6-14 16-18 30z" fill="' + c + '"/>'; },
    buzz: function (c) { return '<path d="M56 86c-2-30 14-48 44-48s46 18 44 48c-6-12-12-20-20-24-16 6-32 6-48 0-8 4-14 12-20 24z" fill="' + c + '" opacity=".9"/>'; },
    side: function (c) { return '<path d="M50 96c-6-40 16-64 52-62 30 2 48 22 44 60-2-16-8-26-16-32-22 2-46-2-62-8-8 8-14 22-18 42z" fill="' + c + '"/><path d="M60 60c18 8 44 12 70 6" stroke="' + shade(c, -0.25) + '" stroke-width="3" fill="none"/>'; },
    long: function (c) { return '<path d="M48 120c-10-50 6-86 52-86s62 36 52 86c-2 14-8 26-14 34l-6-60c-14 6-44 6-62-2l-8 62c-6-8-12-20-14-34z" fill="' + c + '"/>'; },
    bob: function (c) { return '<path d="M50 118c-8-48 8-84 50-84s58 36 50 84c0 8-4 14-10 16l-4-58c-18 6-50 6-68-4l-6 62c-8-2-12-8-12-16z" fill="' + c + '"/>'; },
    bun: function (c) { return '<circle cx="100" cy="28" r="16" fill="' + c + '"/><path d="M52 92c-4-34 14-56 48-56s52 22 46 56c-4-14-10-22-18-28-18 8-40 8-58 0-8 6-14 14-18 28z" fill="' + c + '"/>'; },
    curly: function (c) {
      var o = '', pts = [[56, 66], [66, 48], [82, 38], [100, 34], [118, 38], [134, 48], [144, 66], [52, 86], [148, 86], [74, 56], [126, 56]];
      pts.forEach(function (p) { o += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="15" fill="' + c + '"/>'; }); return o;
    },
    none: function () { return ''; },
    gray: function (c) { return '<path d="M54 90c-2-30 14-50 46-50s48 20 46 50c-4-12-10-20-18-24-18 6-38 6-56 0-8 4-14 12-18 24z" fill="' + c + '"/>'; }
  };

  /* spec: skin, hair (colour), style, shirt, bg, eyes, glasses, beard (colour or ''), mouth ('smile'|'flat'|'grin'), brow, earring, coat ('suit'|'plain'|'collar') */
  CI.portrait = function (s) {
    var skin = s.skin, shadow = shade(skin, -0.12), light = shade(skin, 0.15), hair = s.hair, style = s.style || 'short';
    var o = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(s.bg, 0.25) + '"/><stop offset="1" stop-color="' + shade(s.bg, -0.1) + '"/></linearGradient></defs>';
    o += '<rect width="200" height="200" fill="url(#bg)"/>';
    // back hair for long styles
    if (style === 'long' || style === 'bob') o += HAIR[style](hair);
    // shoulders and shirt
    o += '<path d="M10 200c0-34 26-54 58-60l32 10 32-10c32 6 58 26 58 60z" fill="' + s.shirt + '"/>';
    if (s.coat === 'suit') o += '<path d="M68 140l32 60-14 0-30-46z" fill="' + shade(s.shirt, -0.2) + '"/><path d="M132 140l-32 60 14 0 30-46z" fill="' + shade(s.shirt, -0.2) + '"/><path d="M86 142l14 22 14-22-14-8z" fill="#f4f4f4"/>' + (s.tie ? '<path d="M96 150h8l4 36-8 6-8-6z" fill="' + s.tie + '"/>' : '');
    else if (s.coat === 'collar') o += '<path d="M76 142l24 18 24-18-10-8-14 10-14-10z" fill="' + shade(s.shirt, 0.35) + '"/>';
    else o += '<path d="M80 144c8 10 32 10 40 0l-6-8H86z" fill="' + shade(s.shirt, -0.15) + '"/>';
    // neck
    o += '<path d="M84 118h32v26c0 8-32 8-32 0z" fill="' + shadow + '"/>';
    // ears
    o += '<ellipse cx="55" cy="92" rx="7" ry="11" fill="' + skin + '"/><ellipse cx="145" cy="92" rx="7" ry="11" fill="' + skin + '"/>';
    if (s.earring) o += '<circle cx="55" cy="105" r="3" fill="' + s.earring + '"/><circle cx="145" cy="105" r="3" fill="' + s.earring + '"/>';
    // head
    o += '<path d="M58 84c0-30 18-48 42-48s42 18 42 48c0 34-18 52-42 52s-42-18-42-52z" fill="' + skin + '"/>';
    o += '<path d="M62 100c4 24 18 34 38 34s34-10 38-34c-2 30-16 42-38 42s-36-12-38-42z" fill="' + shadow + '" opacity=".35"/>';
    // front hair
    if (style !== 'long' && style !== 'bob') o += HAIR[style](hair); else o += '<path d="M54 90c-2-30 14-54 46-54s48 24 46 54c-4-16-12-28-22-32-14 6-34 6-50-2-10 6-16 18-20 34z" fill="' + hair + '"/>';
    // beard
    if (s.beard) o += '<path d="M60 104c2 28 16 40 40 40s38-12 40-40c-4 10-10 16-18 18-6-4-14-6-22-6s-16 2-22 6c-8-2-14-8-18-18z" fill="' + s.beard + '"/><path d="M88 124c8 4 16 4 24 0" stroke="' + shade(skin, -0.3) + '" stroke-width="3" fill="none"/>';
    // brows
    var bc = s.brow || shade(hair, -0.15);
    o += '<path d="M72 78q10-6 20-2" stroke="' + bc + '" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M108 76q10-4 20 2" stroke="' + bc + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    // eyes
    [82, 118].forEach(function (x) { o += '<ellipse cx="' + x + '" cy="90" rx="8" ry="5.5" fill="#fff"/><circle cx="' + x + '" cy="90" r="4.2" fill="' + (s.eyes || '#3b2a1f') + '"/><circle cx="' + x + '" cy="90" r="1.8" fill="#111"/><circle cx="' + (x + 1.6) + '" cy="88.4" r="1.2" fill="#fff"/><path d="M' + (x - 8) + ' 88q8-7 16 0" stroke="' + shade(skin, -0.35) + '" stroke-width="1.6" fill="none"/>'; });
    // nose
    o += '<path d="M100 92c-2 8-6 14-6 17 4 3 8 3 12 0 0-3-4-9-6-17z" fill="' + shadow + '" opacity=".55"/>';
    // mouth
    if (s.mouth === 'grin') o += '<path d="M86 118q14 12 28 0q-14 3-28 0z" fill="#fff" stroke="' + shade('#b5524a', -0.1) + '" stroke-width="2"/>';
    else if (s.mouth === 'flat') o += '<path d="M88 120q12 3 24 0" stroke="#9a5148" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
    else o += '<path d="M86 118q14 11 28 0" stroke="#b5524a" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
    // glasses
    if (s.glasses) o += '<g fill="rgba(255,255,255,.12)" stroke="' + s.glasses + '" stroke-width="3"><rect x="68" y="80" width="28" height="20" rx="8"/><rect x="104" y="80" width="28" height="20" rx="8"/></g><path d="M96 88h8" stroke="' + s.glasses + '" stroke-width="3"/>';
    // cheek light
    o += '<ellipse cx="76" cy="106" rx="9" ry="5" fill="' + light + '" opacity=".35"/><ellipse cx="124" cy="106" rx="9" ry="5" fill="' + light + '" opacity=".35"/>';
    return uri(o + '</svg>');
  };

  /* ---------- logos ---------- */
  function wrap(inner) { return uri('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/>' + inner + '</svg>'); }
  function word(t, x, y, size, color, weight, spacing, family) { return '<text x="' + x + '" y="' + y + '" font-family="' + (family || 'Helvetica,Arial,sans-serif') + '" font-size="' + size + '" font-weight="' + (weight || 700) + '" fill="' + color + '" text-anchor="middle" letter-spacing="' + (spacing || 0) + '">' + t + '</text>'; }
  var LOGOS = {
    brightwater: function () { return wrap('<circle cx="100" cy="82" r="46" fill="#1b6fb5"/><path d="M54 84c14-14 28-14 46 0s32 14 46 0v26a46 46 0 01-92 0z" fill="#8cd0f0"/><path d="M54 84c14-14 28-14 46 0s32 14 46 0" stroke="#fff" stroke-width="5" fill="none"/>' + word('BRIGHTWATER', 100, 156, 19, '#12486f', 800, 2) + word('HOLDINGS', 100, 176, 13, '#1b6fb5', 600, 5)); },
    harborline: function () { return wrap('<path d="M100 28l54 30v60l-54 30-54-30V58z" fill="#e0792a"/><g fill="#fff"><rect x="66" y="64" width="68" height="8"/><rect x="66" y="84" width="68" height="8"/><rect x="66" y="104" width="68" height="8"/></g><path d="M100 28l54 30v60l-54 30-54-30V58z" fill="none" stroke="#a9501a" stroke-width="5" stroke-linejoin="round"/>' + word('HARBORLINE', 100, 172, 21, '#7a3a12', 800, 1.5) + word('SUPPLY CO.', 100, 190, 11, '#a9501a', 600, 4)); },
    gridwatch: function () { return wrap('<rect x="34" y="30" width="132" height="102" rx="14" fill="#16202e"/><g stroke="#2c3b52" stroke-width="2"><path d="M34 64h132M34 98h132M78 30v102M122 30v102"/></g><path d="M52 82q48-44 96 0q-48 44-96 0z" fill="#f2c230"/><circle cx="100" cy="82" r="15" fill="#16202e"/><circle cx="100" cy="82" r="6" fill="#f2c230"/>' + word('GRIDWATCH', 100, 158, 22, '#16202e', 900, 2) + word('NOW', 100, 182, 17, '#d19a00', 800, 9)); },
    keystone: function () { return wrap('<path d="M60 36h80l16 76H44z" fill="#c1272d"/><path d="M60 36h80l16 76H44z" fill="none" stroke="#7d1418" stroke-width="5" stroke-linejoin="round"/><rect x="72" y="60" width="56" height="38" rx="3" fill="#fff"/><path d="M72 62l28 20 28-20" stroke="#c1272d" stroke-width="4" fill="none"/>' + word('KEYSTONE', 100, 150, 24, '#7d1418', 900, 2) + word('COURIER PARTNERS', 100, 172, 11.5, '#c1272d', 700, 2.5)); },
    northwind: function () { return wrap('<circle cx="100" cy="76" r="46" fill="#0f7c7c"/><path d="M100 36l12 40-12 12-12-12z" fill="#fff"/><path d="M100 116l-12-40 12-12 12 12z" fill="#9fe0e0"/><path d="M60 76l40-12 12 12-12 12z" fill="#7fd0d0" opacity=".9"/><path d="M140 76l-40 12-12-12 12-12z" fill="#bff0f0" opacity=".9"/>' + word('NORTHWIND', 100, 152, 22, '#0b4f4f', 900, 2) + word('LOGISTICS', 100, 172, 13, '#0f7c7c', 700, 6)); },
    darkgrid: function () { return wrap('<rect x="40" y="26" width="120" height="120" fill="#111"/><g stroke="#444" stroke-width="3"><path d="M40 66h120M40 106h120M80 26v120M120 26v120"/></g><path d="M52 138L148 34" stroke="#e11d2e" stroke-width="12" stroke-linecap="square"/>' + word('DARK GRID', 100, 172, 22, '#111', 900, 3) + word('COLLECTIVE', 100, 190, 11, '#e11d2e', 700, 5)); },
    meridian: function () { return wrap('<circle cx="100" cy="80" r="48" fill="none" stroke="#6b3fa0" stroke-width="7"/><ellipse cx="100" cy="80" rx="20" ry="48" fill="none" stroke="#6b3fa0" stroke-width="4"/><path d="M52 80h96" stroke="#6b3fa0" stroke-width="4"/><circle cx="100" cy="80" r="9" fill="#e8a317"/>' + word('MERIDIAN', 100, 154, 22, '#412068', 900, 2) + word('STAFFING GROUP', 100, 174, 12, '#6b3fa0', 700, 3)); },
    fenn: function () { return wrap('<rect x="40" y="26" width="120" height="104" fill="none" stroke="#2d3b2d" stroke-width="4"/><g fill="#2d3b2d"><rect x="56" y="42" width="12" height="72"/><rect x="82" y="42" width="12" height="72"/><rect x="108" y="42" width="12" height="72"/><rect x="132" y="42" width="12" height="72"/><rect x="48" y="34" width="104" height="8"/><rect x="48" y="114" width="104" height="8"/></g>' + word('FENN &amp; ASSOCIATES', 100, 160, 15, '#2d3b2d', 700, 1.5, 'Georgia,serif') + word('ATTORNEYS AND FILING AGENTS', 100, 178, 8.5, '#7a8a6a', 700, 1.5)); },
    ironbridge: function () { return wrap('<path d="M24 100h152" stroke="#444" stroke-width="8"/><path d="M34 100c10-52 122-52 132 0" fill="none" stroke="#b5541c" stroke-width="9"/><g stroke="#b5541c" stroke-width="4"><path d="M58 100V72M80 100V58M100 100V54M120 100V58M142 100V72"/></g><rect x="24" y="100" width="152" height="10" fill="#444"/>' + word('IRONBRIDGE', 100, 152, 23, '#333', 900, 2) + word('MAINTENANCE LLC', 100, 172, 12, '#b5541c', 700, 3)); },
    chamber: function () { return wrap('<circle cx="100" cy="64" r="22" fill="#f2b632"/><path d="M40 92c20-14 40-14 60 0s40 14 60 0v14c-20 14-40 14-60 0s-40-14-60 0z" fill="#2a8fbd"/><path d="M40 112c20-14 40-14 60 0s40 14 60 0v14c-20 14-40 14-60 0s-40-14-60 0z" fill="#1b6c93"/>' + word('LAKESHORE', 100, 158, 21, '#14506d', 900, 2) + word('CHAMBER OF COMMERCE', 100, 176, 10, '#2a8fbd', 700, 2)); },
    bank: function () { return wrap('<path d="M100 22l54 16v46c0 34-24 52-54 64-30-12-54-30-54-64V38z" fill="#0d3b66"/><path d="M100 22l54 16v46c0 34-24 52-54 64-30-12-54-30-54-64V38z" fill="none" stroke="#c9a227" stroke-width="5"/><path d="M82 58v50h34" stroke="#c9a227" stroke-width="12" fill="none" stroke-linejoin="miter"/>' + word('FIRST LAKESHORE', 100, 168, 17, '#0d3b66', 900, 1) + word('BANK &amp; TRUST', 100, 186, 11, '#c9a227', 700, 4)); },
    pinnacle: function () { return wrap('<path d="M26 120L76 40l30 46 20-26 48 60z" fill="#2f4858"/><path d="M76 40l30 46-30 34-50 0z" fill="#33658a"/><path d="M126 60l48 60h-64z" fill="#86bbd8" opacity=".9"/><path d="M76 40l8 12-8 4-8-4z" fill="#fff"/>' + word('PINNACLE', 100, 154, 23, '#2f4858', 900, 3) + word('CONSULTING PARTNERS', 100, 174, 10.5, '#33658a', 700, 2)); },
    cobalt: function () { return wrap('<rect x="46" y="32" width="108" height="88" rx="12" fill="#0047ab"/><path d="M60 100h80" stroke="#7aa7ee" stroke-width="5"/><path d="M118 52c-24-16-52 0-40 22s46 8 36 28" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>' + word('COBALT', 100, 156, 24, '#003a8c', 900, 3) + word('FREIGHT BROKERS', 100, 176, 12, '#0047ab', 700, 3)); }
  };
  CI.logo = function (key) { return (LOGOS[key] || LOGOS.cobalt)(); };
  CI.LOGO_KEYS = Object.keys(LOGOS);
})(typeof window !== 'undefined' ? window : globalThis);
