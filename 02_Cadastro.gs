/**
 * Arquivo: 02_Cadastro.gs
 * Leitura da base de empresas (aba Cadastro) + utilidades de texto/número.
 */

// ---------------------------------------------------------------------
// LEITURA DA BASE
// ---------------------------------------------------------------------

/**
 * Lê a aba Cadastro e devolve [{linha, empresa, fantasia, cnpj, cnpjDigitos,
 * codigo, email, tributacao, cidade, situacao}]
 */
function lerCadastro_(somenteAtivas) {
  var ss = getPlanilha_();
  var sh = ss.getSheetByName(CONFIG.ABA_CADASTRO);
  if (!sh) throw new Error('Aba "' + CONFIG.ABA_CADASTRO + '" não encontrada nesta planilha.');

  var ultLin = sh.getLastRow();
  var ultCol = sh.getLastColumn();
  if (ultLin <= CONFIG.LINHA_CABECALHO) return [];

  var valores = sh.getRange(CONFIG.LINHA_CABECALHO, 1, ultLin - CONFIG.LINHA_CABECALHO + 1, ultCol).getValues();
  var cab = valores[0].map(function (c) { return normalizar_(c); });

  var idx = {};
  Object.keys(CONFIG.COLS).forEach(function (chave) {
    idx[chave] = acharColuna_(cab, CONFIG.COLS[chave]);
  });
  if (idx.empresa < 0) throw new Error('Coluna "Empresa" não encontrada na aba Cadastro.');

  var out = [];
  for (var i = 1; i < valores.length; i++) {
    var lin = valores[i];
    var nome = String(lin[idx.empresa] || '').trim();
    if (!nome) continue;

    var sit = idx.situacao >= 0 ? String(lin[idx.situacao] || '').trim() : '';
    if (somenteAtivas && sit && !situacaoAtiva_(sit)) continue;

    var cnpjBruto = idx.cnpj >= 0 ? lin[idx.cnpj] : '';
    var cnpjD = cnpj14_(cnpjBruto);
    var cnpj = cnpjD ? formatarCnpj_(cnpjD) : String(cnpjBruto || '').trim();
    out.push({
      linha       : CONFIG.LINHA_CABECALHO + i,
      empresa     : nome,
      fantasia    : idx.fantasia   >= 0 ? String(lin[idx.fantasia]   || '').trim() : '',
      cnpj        : cnpj,
      cnpjDigitos : cnpjD,
      cnpjRaiz    : cnpjD ? cnpjD.substring(0, 8) : '',
      codigo      : idx.codigo     >= 0 ? String(lin[idx.codigo]     || '').trim() : '',
      email       : idx.email      >= 0 ? String(lin[idx.email]      || '').trim() : '',
      tributacao  : idx.tributacao >= 0 ? String(lin[idx.tributacao] || '').trim() : '',
      cidade      : idx.cidade     >= 0 ? String(lin[idx.cidade]     || '').trim() : '',
      situacao    : sit
    });
  }
  return out;
}

/** Chamado pelo modal. */
function apiListarEmpresas() {
  exigirUso_();
  try {
    var lista = lerCadastro_(true).map(function (e) {
      return { linha: e.linha, empresa: e.empresa, fantasia: e.fantasia,
               cnpj: e.cnpj, cnpjDigitos: e.cnpjDigitos, codigo: e.codigo };
    });
    return { ok: true, empresas: lista };
  } catch (e) {
    return { ok: false, erro: String(e && e.message ? e.message : e) };
  }
}

/** Compara a situação sem depender de caixa, acento ou espaços extras. */
function situacaoAtiva_(sit) {
  var n = normalizar_(sit);
  for (var i = 0; i < CONFIG.SITUACAO_ATIVA.length; i++) {
    if (normalizar_(CONFIG.SITUACAO_ATIVA[i]) === n) return true;
  }
  return false;
}

function acharColuna_(cabNormalizado, candidatos) {
  for (var c = 0; c < candidatos.length; c++) {
    var alvo = normalizar_(candidatos[c]);
    var i = cabNormalizado.indexOf(alvo);
    if (i >= 0) return i;
  }
  // segunda passada: "começa com"
  for (var c2 = 0; c2 < candidatos.length; c2++) {
    var alvo2 = normalizar_(candidatos[c2]);
    for (var j = 0; j < cabNormalizado.length; j++) {
      if (cabNormalizado[j] && cabNormalizado[j].indexOf(alvo2) === 0) return j;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------
// TEXTO / NÚMEROS
// ---------------------------------------------------------------------

/** minúsculas, sem acento, sem pontuação, espaços colapsados */
function normalizar_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function somenteDigitos_(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

/**
 * CNPJ reduzido a 14 digitos, pronto para comparacao.
 *
 * Trata os dois jeitos que o CNPJ chega quebrado na pratica:
 *  - celula formatada como NUMERO na planilha, que come o zero a esquerda
 *    ("00.000.999/0001-00" vira 5367250000100, 13 digitos);
 *  - CNPJ digitado sem pontuacao ou com espacos.
 * Devolve '' quando nao da para reconhecer um CNPJ.
 */
function cnpj14_(v) {
  if (v == null || v === '') return '';
  var d;
  if (typeof v === 'number') {
    // sem notacao cientifica e sem casas decimais
    d = v.toFixed(0).replace(/\D/g, '');
  } else {
    d = String(v).replace(/\D/g, '');
  }
  if (!d) return '';
  if (d.length > 14) d = d.slice(-14);          // veio com lixo na frente
  if (d.length < 11) return '';                 // curto demais para ser CNPJ
  while (d.length < 14) d = '0' + d;            // repoe zeros a esquerda
  return d;
}

/** Raiz do CNPJ: os 8 primeiros digitos, iguais entre matriz e filiais. */
function cnpjRaiz_(v) {
  var d = cnpj14_(v);
  return d ? d.substring(0, 8) : '';
}

function formatarCnpj_(v) {
  var d = somenteDigitos_(v);
  if (d.length === 13) d = '0' + d;          // planilha comeu o zero à esquerda
  if (d.length !== 14) return String(v == null ? '' : v).trim();
  return d.substr(0, 2) + '.' + d.substr(2, 3) + '.' + d.substr(5, 3) + '/' + d.substr(8, 4) + '-' + d.substr(12, 2);
}

/** Converte "(1.234,56)" / "1.234,56D" / "-1234.56" em Number (negativo entre parênteses). */
function paraNumero_(v) {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  var s = String(v).trim();
  if (!s) return 0;
  var neg = /^\(.*\)$/.test(s) || /-/.test(s.charAt(0));
  var credor = /C\s*$/i.test(s) && !/D\s*$/i.test(s);
  s = s.replace(/[()]/g, '').replace(/[DC]\s*$/i, '').replace(/[R$\s]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  var n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (neg) n = -Math.abs(n);
  if (credor) n = -Math.abs(n);
  return n;
}

/** 154142.82 -> "R$ 154.142,82" */
function moeda_(n) {
  n = Number(n) || 0;
  var neg = n < 0;
  var s = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '− R$ ' : 'R$ ') + s;
}

/** 154142.82 -> "R$ 154,1 mil"  |  2540000 -> "R$ 2,54 mi" */
function moedaCurta_(n) {
  n = Number(n) || 0;
  var neg = n < 0, a = Math.abs(n), s;
  if (a >= 1000000)   s = (a / 1000000).toFixed(2).replace('.', ',') + ' mi';
  else if (a >= 1000) s = (a / 1000).toFixed(1).replace('.', ',') + ' mil';
  else                s = a.toFixed(2).replace('.', ',');
  return (neg ? '− R$ ' : 'R$ ') + s;
}

/** 0.895 -> "89,5%"  (recebe fração)   |  pct_(89.5, true) -> "89,5%" */
function pct_(v, jaEmPercentual, casas) {
  var n = Number(v) || 0;
  if (!jaEmPercentual) n = n * 100;
  var c = (casas === undefined) ? 1 : casas;
  return (n < 0 ? '−' : '') + Math.abs(n).toFixed(c).replace('.', ',') + '%';
}

function num_(v, casas) {
  var c = (casas === undefined) ? 1 : casas;
  var n = Number(v) || 0;
  return (n < 0 ? '−' : '') + Math.abs(n).toFixed(c).replace('.', ',');
}

var MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                'julho','agosto','setembro','outubro','novembro','dezembro'];

/** ("01/01/2026","31/07/2026") -> "Janeiro a julho de 2026" */
function periodoExtenso_(ini, fim) {
  var a = parseDataBr_(ini), b = parseDataBr_(fim);
  if (!a || !b) return '';
  var mi = MESES_PT[a.getMonth()], mf = MESES_PT[b.getMonth()];
  var cap = mi.charAt(0).toUpperCase() + mi.slice(1);
  if (a.getFullYear() === b.getFullYear()) {
    if (a.getMonth() === b.getMonth()) return cap + ' de ' + b.getFullYear();
    return cap + ' a ' + mf + ' de ' + b.getFullYear();
  }
  return cap + ' de ' + a.getFullYear() + ' a ' + mf + ' de ' + b.getFullYear();
}

/** "Jan–Jul 2026" para o rodapé */
function periodoCurto_(ini, fim) {
  var a = parseDataBr_(ini), b = parseDataBr_(fim);
  if (!a || !b) return '';
  var abr = function (d) { return MESES_PT[d.getMonth()].substring(0, 3).replace(/^./, function (m) { return m.toUpperCase(); }); };
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return abr(b) + ' ' + b.getFullYear();
  return abr(a) + '–' + abr(b) + ' ' + b.getFullYear();
}

function parseDataBr_(s) {
  if (s instanceof Date) return s;
  var m = String(s || '').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  var m2 = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  return null;
}

function dataBr_(s) {
  var d = parseDataBr_(s);
  if (!d) return String(s || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function slug_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 60);
}

// ---------------------------------------------------------------------
// LOG
// ---------------------------------------------------------------------
function registrarLog_(dados) {
  try {
    var ss = getPlanilha_();
    var sh = ss.getSheetByName(CONFIG.ABA_LOG);
    if (!sh) { sh = ss.insertSheet(CONFIG.ABA_LOG); }
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Data/Hora', 'Empresa', 'CNPJ', 'Período', 'Status',
                    'Arquivos usados', 'Link Slides', 'Link PDF', 'Mensagem']);
      sh.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#003528').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
    sh.appendRow([
      new Date(), dados.empresa || '', dados.cnpj || '', dados.periodo || '',
      dados.status || '', (dados.arquivos || []).join(' | '),
      dados.linkSlides || '', dados.linkPdf || '', dados.mensagem || ''
    ]);
  } catch (e) {
    console.warn('Falha ao gravar log: ' + e);
  }
}
