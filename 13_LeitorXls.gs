/**
 * Arquivo: 13_LeitorXls.gs
 * Leitor do .xls antigo (BIFF8) gerado pelo Dominio, feito na mao.
 *
 * Por que isto existe: o Dominio so exporta .xls e PDF, e o .xls que ele gera
 * NAO traz o registro BOUNDSHEET, que e o indice das abas. Sem esse indice o
 * conversor do Google nao encontra a planilha dentro do arquivo — e, pior, nao
 * reclama: entrega uma planilha vazia (0x0). As bibliotecas padrao de .xls
 * tambem recusam o arquivo pelo mesmo motivo.
 *
 * Os dados, porem, estao intactos. Este leitor abre o container OLE2, acha o
 * fluxo "Workbook" e percorre os registros BIFF direto, montando a mesma grade
 * de celulas que o Google devolveria — numeros como numeros, texto como texto.
 */

// ---------------------------------------------------------------------------
// OLE2 / Compound File
// ---------------------------------------------------------------------------

function u16_(b, i) { return (b[i] & 0xFF) | ((b[i + 1] & 0xFF) << 8); }
/**
 * Inteiro de 32 bits sem sinal. Escrito com soma e multiplicacao de proposito:
 * com operadores bit a bit, o JavaScript converte para inteiro COM sinal de 32
 * bits e qualquer valor acima de 2^31 volta negativo — o que truncava o tamanho
 * do fluxo e fazia a leitura parar no meio do arquivo.
 */
function u32_(b, i) {
  return (b[i] & 0xFF)
       + ((b[i+1] & 0xFF) * 256)
       + ((b[i+2] & 0xFF) * 65536)
       + ((b[i+3] & 0xFF) * 16777216);
}

/** Converte os bytes do Drive (signed) para inteiros 0..255. */
function paraBytes_(arr) {
  var out = new Array(arr.length);
  for (var i = 0; i < arr.length; i++) out[i] = arr[i] & 0xFF;
  return out;
}

/** Encadeia os setores de um fluxo seguindo a FAT. */
function seguirCadeia_(fat, inicio, limite) {
  var cad = [], s = inicio, guarda = 0;
  while (s >= 0 && s < limite && guarda++ < 100000) {
    cad.push(s);
    s = fat[s];
    if (s === undefined || s >= 0xFFFFFFFA) break;
  }
  return cad;
}

/**
 * Extrai o fluxo "Workbook" de dentro do container OLE2.
 * @return {Array<number>} bytes do fluxo
 */
function extrairWorkbook_(bytes) {
  var ass = [0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1];
  for (var i = 0; i < 8; i++) {
    if (bytes[i] !== ass[i]) throw new Error('Arquivo nao e um .xls no formato OLE2.');
  }
  var tamSetor = 1 << u16_(bytes, 30);
  var corte    = u32_(bytes, 56) || 4096;
  var nFat     = u32_(bytes, 44);
  var dirIni   = u32_(bytes, 48);
  var miniIni  = u32_(bytes, 60);
  var difIni   = u32_(bytes, 68);
  var nDif     = u32_(bytes, 72);
  var setor = function (n) { return 512 + n * tamSetor; };
  // ceil, nao floor: o Dominio grava o ultimo setor SEM completar os 512 bytes.
  // Com floor esse setor ficava fora do limite e a leitura perdia o final do
  // arquivo — justamente onde estao as linhas de totais do balancete.
  var totalSetores = Math.ceil((bytes.length - 512) / tamSetor);

  // DIFAT: 109 entradas no cabecalho, o resto em setores encadeados.
  var difat = [];
  for (var d = 0; d < 109; d++) {
    var v = u32_(bytes, 76 + d * 4);
    if (v < 0xFFFFFFFA) difat.push(v);
  }
  var prox = difIni, voltas = 0;
  while (nDif > 0 && prox < 0xFFFFFFFA && voltas++ < 1000) {
    var base = setor(prox);
    var porSetor = (tamSetor / 4) - 1;
    for (var k = 0; k < porSetor; k++) {
      var w = u32_(bytes, base + k * 4);
      if (w < 0xFFFFFFFA) difat.push(w);
    }
    prox = u32_(bytes, base + porSetor * 4);
  }

  // FAT
  var fat = [];
  for (var f = 0; f < difat.length; f++) {
    var b0 = setor(difat[f]);
    for (var q = 0; q < tamSetor / 4; q++) fat.push(u32_(bytes, b0 + q * 4));
  }

  // Diretorio: acha a entrada chamada "Workbook" (ou "Book").
  var dirSetores = seguirCadeia_(fat, dirIni, totalSetores);
  var achado = null;
  for (var ds = 0; ds < dirSetores.length; ds++) {
    var off = setor(dirSetores[ds]);
    for (var e = 0; e + 128 <= tamSetor; e += 128) {
      var p = off + e;
      var cch = u16_(bytes, p + 64);
      if (cch < 2) continue;
      var nome = '';
      for (var c2 = 0; c2 < (cch / 2) - 1; c2++) nome += String.fromCharCode(u16_(bytes, p + c2 * 2));
      if (nome === 'Workbook' || nome === 'Book') {
        achado = { inicio: u32_(bytes, p + 116), tamanho: u32_(bytes, p + 120) };
      }
      if (nome === 'Root Entry') {
        var raiz = { inicio: u32_(bytes, p + 116), tamanho: u32_(bytes, p + 120) };
        achado = achado || null;
        extrairWorkbook_._raiz = raiz;
      }
    }
  }
  if (!achado) throw new Error('Fluxo "Workbook" nao encontrado dentro do .xls.');

  // Fluxos grandes vivem na FAT normal. O Workbook do Dominio tem dezenas de KB,
  // bem acima do corte de mini-stream, entao este caminho basta.
  if (achado.tamanho < corte) {
    throw new Error('Planilha pequena demais (mini-stream) — formato nao suportado.');
  }
  var cad = seguirCadeia_(fat, achado.inicio, totalSetores);
  var out = [], resta = achado.tamanho;
  for (var s2 = 0; s2 < cad.length && resta > 0; s2++) {
    var ini = setor(cad[s2]);
    var n = Math.min(tamSetor, resta, bytes.length - ini);
    for (var t = 0; t < n; t++) out.push(bytes[ini + t]);
    resta -= n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// BIFF8
// ---------------------------------------------------------------------------

/** Le uma string do SST/LABEL no formato XLUnicodeString. */
function lerStrUnicode_(b, pos, comCch) {
  var cch = comCch ? u16_(b, pos) : 0;
  var i = pos + (comCch ? 2 : 0);
  var flags = b[i]; i++;
  var largo = (flags & 0x01) !== 0;
  var temExt = (flags & 0x04) !== 0;
  var temRich = (flags & 0x08) !== 0;
  var nRich = 0, cbExt = 0;
  if (temRich) { nRich = u16_(b, i); i += 2; }
  if (temExt)  { cbExt = u32_(b, i); i += 4; }
  var txt = '';
  for (var c = 0; c < cch; c++) {
    if (largo) { txt += String.fromCharCode(u16_(b, i)); i += 2; }
    else { txt += String.fromCharCode(b[i]); i += 1; }
  }
  i += nRich * 4 + cbExt;
  return { texto: txt, fim: i };
}

/** Numero no formato RK (inteiro ou float comprimido), lido dos 4 bytes crus. */
function valorRk_(b, i) {
  var b0 = b[i] & 0xFF;
  var inteiro = (b0 & 0x02) !== 0;
  var div100  = (b0 & 0x01) !== 0;
  var v;
  if (inteiro) {
    var n = (b0 & 0xFC) + ((b[i+1] & 0xFF) * 256) + ((b[i+2] & 0xFF) * 65536)
          + ((b[i+3] & 0xFF) * 16777216);
    v = Math.floor(n / 4);
    if (v >= 0x20000000) v -= 0x40000000;   // inteiro de 30 bits com sinal
  } else {
    var buf = new ArrayBuffer(8), dv = new DataView(buf);
    dv.setUint8(4, b0 & 0xFC);
    dv.setUint8(5, b[i+1] & 0xFF);
    dv.setUint8(6, b[i+2] & 0xFF);
    dv.setUint8(7, b[i+3] & 0xFF);
    v = dv.getFloat64(0, false);
  }
  return div100 ? v / 100 : v;
}

function lerDouble_(b, i) {
  var buf = new ArrayBuffer(8), dv = new DataView(buf);
  for (var k = 0; k < 8; k++) dv.setUint8(k, b[i + k]);
  return dv.getFloat64(0, true);
}

/**
 * Percorre os registros BIFF e devolve a grade de celulas.
 * Como o arquivo do Dominio tem uma unica planilha, nao ha o que desambiguar:
 * todo registro de celula encontrado pertence a ela.
 */
function gradeDoBiff_(b) {
  var sst = [], celulas = [], maxL = 0, maxC = 0;
  var pos = 0;

  var guardar = function (lin, col, val) {
    celulas.push({ l: lin, c: col, v: val });
    if (lin > maxL) maxL = lin;
    if (col > maxC) maxC = col;
  };

  while (pos + 4 <= b.length) {
    var id = u16_(b, pos), tam = u16_(b, pos + 2), p = pos + 4;
    if (p + tam > b.length) break;

    if (id === 0x00FC) {                       // SST
      // O SST pode transbordar para registros CONTINUE (0x003C). Juntamos o
      // corpo inteiro antes de interpretar, senao as strings quebram no meio.
      var corpo = b.slice(p, p + tam);
      var q = pos + 4 + tam;
      while (q + 4 <= b.length && u16_(b, q) === 0x003C) {
        var t2 = u16_(b, q + 2);
        corpo = corpo.concat(b.slice(q + 4, q + 4 + t2));
        q += 4 + t2;
      }
      var unicas = u32_(corpo, 4), i2 = 8;
      for (var s = 0; s < unicas && i2 < corpo.length; s++) {
        var r = lerStrUnicode_(corpo, i2, true);
        sst.push(r.texto);
        i2 = r.fim;
      }
      pos = q;
      continue;
    }
    if (id === 0x00FD) {                       // LABELSST
      var isst = u32_(b, p + 6);
      guardar(u16_(b, p), u16_(b, p + 2), sst[isst] === undefined ? '' : sst[isst]);
    } else if (id === 0x0203) {                // NUMBER
      guardar(u16_(b, p), u16_(b, p + 2), lerDouble_(b, p + 6));
    } else if (id === 0x027E) {                // RK
      guardar(u16_(b, p), u16_(b, p + 2), valorRk_(b, p + 6));
    } else if (id === 0x00BD) {                // MULRK
      var lin = u16_(b, p), c0 = u16_(b, p + 2), k2 = p + 4;
      while (k2 + 6 <= p + tam - 2) {
        guardar(lin, c0, valorRk_(b, k2 + 2));
        c0++; k2 += 6;
      }
    } else if (id === 0x0204) {                // LABEL
      var rr = lerStrUnicode_(b, p + 6, true);
      guardar(u16_(b, p), u16_(b, p + 2), rr.texto);
    }
    pos += 4 + tam;
  }

  var G = [];
  for (var l = 0; l <= maxL; l++) {
    var linha = [];
    for (var c3 = 0; c3 <= maxC; c3++) linha.push('');
    G.push(linha);
  }
  celulas.forEach(function (x) { G[x.l][x.c] = x.v; });
  return G;
}

/** Ponto de entrada: bytes do arquivo .xls -> grade de celulas. */
function gradeDoXlsAntigo_(bytes) {
  return gradeDoBiff_(extrairWorkbook_(paraBytes_(bytes)));
}
