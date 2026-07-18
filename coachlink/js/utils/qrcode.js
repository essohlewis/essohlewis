/* ==========================================================================
   utils/qrcode.js — Générateur de QR code autonome (aucune dépendance, hors-ligne).
   Mode octet (UTF-8), niveau de correction M par défaut, versions 1 à 10 (auto),
   sélection du meilleur masque. Rendu en SVG net (crispEdges).
   Implémentation du standard ISO/IEC 18004 (Reed-Solomon + masques + BCH).
   Exposé : CL.qrcode.make(texte, ecc) → matrice booléenne ; CL.qrcode.svg(...).
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  /* --------- Arithmétique dans GF(256) --------- */
  var EXP = new Array(256), LOG = new Array(256);
  (function () {
    for (var i = 0; i < 8; i++) EXP[i] = 1 << i;
    for (i = 8; i < 256; i++) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8];
    for (i = 0; i < 255; i++) LOG[EXP[i]] = i;
  })();
  function gexp(n) { while (n < 0) n += 255; while (n >= 256) n -= 255; return EXP[n]; }
  function glog(n) { return LOG[n]; }

  /* --------- Polynômes --------- */
  function Poly(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  Poly.prototype.get = function (i) { return this.num[i]; };
  Poly.prototype.len = function () { return this.num.length; };
  Poly.prototype.multiply = function (e) {
    var num = new Array(this.len() + e.len() - 1);
    for (var i = 0; i < num.length; i++) num[i] = 0;
    for (i = 0; i < this.len(); i++) for (var j = 0; j < e.len(); j++) {
      num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
    }
    return new Poly(num, 0);
  };
  Poly.prototype.mod = function (e) {
    if (this.len() - e.len() < 0) return this;
    var ratio = glog(this.get(0)) - glog(e.get(0));
    var num = this.num.slice();
    for (var i = 0; i < e.len(); i++) num[i] ^= gexp(glog(e.get(i)) + ratio);
    return new Poly(num, 0).mod(e);
  };
  function ecPolynomial(ecLength) {
    var a = new Poly([1], 0);
    for (var i = 0; i < ecLength; i++) a = a.multiply(new Poly([1, gexp(i)], 0));
    return a;
  }

  /* --------- Table des blocs Reed-Solomon (versions 1 à 10, ordre L,M,Q,H) --------- */
  var RS = [
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
  ];
  var ECL = { L: 1, M: 0, Q: 3, H: 2 };
  function ecOffset(level) { return level === 1 ? 0 : level === 0 ? 1 : level === 3 ? 2 : 3; }
  function getRSBlocks(type, level) {
    var t = RS[(type - 1) * 4 + ecOffset(level)], list = [];
    for (var i = 0; i < t.length; i += 3) for (var j = 0; j < t[i]; j++) list.push({ total: t[i + 1], data: t[i + 2] });
    return list;
  }
  var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  /* --------- Tampon de bits --------- */
  function BitBuffer() { this.buffer = []; this.length = 0; }
  BitBuffer.prototype.put = function (num, len) { for (var i = 0; i < len; i++) this.putBit(((num >>> (len - i - 1)) & 1) === 1); };
  BitBuffer.prototype.putBit = function (bit) {
    var idx = Math.floor(this.length / 8);
    if (this.buffer.length <= idx) this.buffer.push(0);
    if (bit) this.buffer[idx] |= (0x80 >>> (this.length % 8));
    this.length++;
  };

  function lengthBits(type) { return type < 10 ? 8 : 16; } // mode octet, v1-9 : 8 bits, v10 : 16

  function createData(type, level, bytes) {
    var rsBlocks = getRSBlocks(type, level), buffer = new BitBuffer();
    buffer.put(4, 4); // indicateur de mode octet
    buffer.put(bytes.length, lengthBits(type));
    for (var i = 0; i < bytes.length; i++) buffer.put(bytes[i], 8);
    var totalData = 0; for (i = 0; i < rsBlocks.length; i++) totalData += rsBlocks[i].data;
    if (buffer.length > totalData * 8) throw new Error("QR: données trop longues");
    if (buffer.length + 4 <= totalData * 8) buffer.put(0, 4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (buffer.length < totalData * 8) { buffer.put(0xEC, 8); if (buffer.length >= totalData * 8) break; buffer.put(0x11, 8); }
    return createBytes(buffer, rsBlocks);
  }

  function createBytes(buffer, rsBlocks) {
    var offset = 0, maxDc = 0, maxEc = 0, dcdata = [], ecdata = [], r, i;
    for (r = 0; r < rsBlocks.length; r++) {
      var dcCount = rsBlocks[r].data, ecCount = rsBlocks[r].total - dcCount;
      maxDc = Math.max(maxDc, dcCount); maxEc = Math.max(maxEc, ecCount);
      dcdata[r] = new Array(dcCount);
      for (i = 0; i < dcCount; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      offset += dcCount;
      var rsPoly = ecPolynomial(ecCount);
      var raw = new Poly(dcdata[r], rsPoly.len() - 1);
      var mod = raw.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.len() - 1);
      for (i = 0; i < ecdata[r].length; i++) { var idx = i + mod.len() - ecdata[r].length; ecdata[r][i] = idx >= 0 ? mod.get(idx) : 0; }
    }
    var total = 0; for (i = 0; i < rsBlocks.length; i++) total += rsBlocks[i].total;
    var data = new Array(total), index = 0;
    for (i = 0; i < maxDc; i++) for (r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i];
    for (i = 0; i < maxEc; i++) for (r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i];
    return data;
  }

  /* --------- BCH (info format / version) --------- */
  var G15 = 0x537, G18 = 0x1f25, G15_MASK = 0x5412;
  function bchDigit(d) { var n = 0; while (d !== 0) { n++; d >>>= 1; } return n; }
  function getBCHTypeInfo(data) {
    var d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0) d ^= (G15 << (bchDigit(d) - bchDigit(G15)));
    return ((data << 10) | d) ^ G15_MASK;
  }
  function getBCHTypeNumber(data) {
    var d = data << 12;
    while (bchDigit(d) - bchDigit(G18) >= 0) d ^= (G18 << (bchDigit(d) - bchDigit(G18)));
    return (data << 12) | d;
  }

  /* --------- Masques --------- */
  function maskFn(p, i, j) {
    switch (p) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return (i * j) % 2 + (i * j) % 3 === 0;
      case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
      case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
    }
    return false;
  }

  /* --------- Placement --------- */
  function probe(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      if (row + r <= -1 || m.length <= row + r) continue;
      for (var c = -1; c <= 7; c++) {
        if (col + c <= -1 || m.length <= col + c) continue;
        m[row + r][col + c] = (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4);
      }
    }
  }
  function timing(m, count) {
    for (var i = 8; i < count - 8; i++) {
      if (m[i][6] == null) m[i][6] = i % 2 === 0;
      if (m[6][i] == null) m[6][i] = i % 2 === 0;
    }
  }
  function align(m, type) {
    var pos = ALIGN[type - 1];
    for (var i = 0; i < pos.length; i++) for (var j = 0; j < pos.length; j++) {
      var row = pos[i], col = pos[j];
      if (m[row][col] != null) continue;
      for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++) {
        m[row + r][col + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
      }
    }
  }
  function typeNumber(m, type, count) {
    var bits = getBCHTypeNumber(type);
    for (var i = 0; i < 18; i++) {
      var mod = ((bits >> i) & 1) === 1;
      m[Math.floor(i / 3)][i % 3 + count - 8 - 3] = mod;
      m[i % 3 + count - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }
  function typeInfo(m, count, level, mask) {
    var bits = getBCHTypeInfo((level << 3) | mask);
    for (var i = 0; i < 15; i++) {
      var mod = ((bits >> i) & 1) === 1;
      if (i < 6) m[i][8] = mod; else if (i < 8) m[i + 1][8] = mod; else m[count - 15 + i][8] = mod;
    }
    for (i = 0; i < 15; i++) {
      var mod2 = ((bits >> i) & 1) === 1;
      if (i < 8) m[8][count - i - 1] = mod2; else if (i < 9) m[8][15 - i - 1 + 1] = mod2; else m[8][15 - i - 1] = mod2;
    }
    m[count - 8][8] = true; // module sombre fixe
  }
  function mapData(m, count, data, mask) {
    var inc = -1, row = count - 1, bitIndex = 7, byteIndex = 0;
    for (var col = count - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (var c = 0; c < 2; c++) {
          if (m[row][col - c] == null) {
            var dark = false;
            if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            if (maskFn(mask, row, col - c)) dark = !dark;
            m[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || count <= row) { row -= inc; inc = -inc; break; }
      }
    }
  }

  function buildModules(type, level, data, mask) {
    var count = type * 4 + 17, m = [];
    for (var r = 0; r < count; r++) { m.push([]); for (var c = 0; c < count; c++) m[r].push(null); }
    probe(m, 0, 0); probe(m, count - 7, 0); probe(m, 0, count - 7);
    align(m, type); timing(m, count); typeInfo(m, count, level, mask);
    if (type >= 7) typeNumber(m, type, count);
    mapData(m, count, data, mask);
    return m;
  }

  function lostPoint(m) {
    var count = m.length, lost = 0, row, col, r, c;
    for (row = 0; row < count; row++) for (col = 0; col < count; col++) {
      var same = 0, dark = m[row][col];
      for (r = -1; r <= 1; r++) { if (row + r < 0 || count <= row + r) continue;
        for (c = -1; c <= 1; c++) { if (col + c < 0 || count <= col + c || (r === 0 && c === 0)) continue; if (dark === m[row + r][col + c]) same++; } }
      if (same > 5) lost += 3 + same - 5;
    }
    for (row = 0; row < count - 1; row++) for (col = 0; col < count - 1; col++) {
      var cnt = 0; if (m[row][col]) cnt++; if (m[row + 1][col]) cnt++; if (m[row][col + 1]) cnt++; if (m[row + 1][col + 1]) cnt++;
      if (cnt === 0 || cnt === 4) lost += 3;
    }
    for (row = 0; row < count; row++) for (col = 0; col < count - 6; col++)
      if (m[row][col] && !m[row][col + 1] && m[row][col + 2] && m[row][col + 3] && m[row][col + 4] && !m[row][col + 5] && m[row][col + 6]) lost += 40;
    for (col = 0; col < count; col++) for (row = 0; row < count - 6; row++)
      if (m[row][col] && !m[row + 1][col] && m[row + 2][col] && m[row + 3][col] && m[row + 4][col] && !m[row + 5][col] && m[row + 6][col]) lost += 40;
    var darkCount = 0; for (col = 0; col < count; col++) for (row = 0; row < count; row++) if (m[row][col]) darkCount++;
    lost += Math.abs(100 * darkCount / count / count - 50) / 5 * 10;
    return lost;
  }

  function toUtf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      else { i++; var cp = 0x10000 + (((c & 0x3ff) << 10) | (s.charCodeAt(i) & 0x3ff)); out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
    }
    return out;
  }

  /** Construit la matrice booléenne du QR (true = module sombre). */
  function make(text, eccName) {
    var level = ECL[eccName] != null ? ECL[eccName] : ECL.M;
    var bytes = toUtf8(String(text)), type = 0, data = null;
    for (var t = 1; t <= 10; t++) { try { data = createData(t, level, bytes); type = t; break; } catch (e) { /* essaie une version plus grande */ } }
    if (!type) throw new Error("QR: données trop longues");
    var best = null, bestLost = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var m = buildModules(type, level, data, mask), l = lostPoint(m);
      if (l < bestLost) { bestLost = l; best = m; }
    }
    return best;
  }

  /** Rendu SVG (chaîne). opts : { ecc, size(px), margin(modules), dark, light }. */
  function svg(text, opts) {
    opts = opts || {};
    var m = make(text, opts.ecc || "M"), count = m.length, margin = opts.margin == null ? 4 : opts.margin;
    var dim = count + margin * 2, dark = opts.dark || "#0b1f3a", light = opts.light || "#ffffff", px = opts.size || 220;
    var path = "";
    for (var r = 0; r < count; r++) for (var c = 0; c < count; c++) if (m[r][c]) path += "M" + (c + margin) + " " + (r + margin) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + " " + dim + '" width="' + px + '" height="' + px +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + dim + '" height="' + dim + '" fill="' + light +
      '"/><path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  CL.qrcode = { make: make, svg: svg };
})();
