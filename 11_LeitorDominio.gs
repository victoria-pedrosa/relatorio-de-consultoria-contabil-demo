/**
 * Arquivo: 11_LeitorDominio.gs
 * Leitura DETERMINISTICA dos exports do Dominio (.xls/.xlsx/.csv).
 *
 * Por que isto existe: a IA so era necessaria porque a unica entrada era PDF.
 * Com planilha, os numeros ja vem em celulas — usar um modelo de linguagem
 * para ler uma celula e mais lento, custa cota e pode errar o valor.
 * Este leitor devolve exatamente o mesmo formato que normalizarExtracao_
 * produzia, entao entra como substituto direto no orquestrador.
 *
 * Convencoes do Dominio descobertas contra arquivos reais (BTC ESTETICA):
 *  - Balancete: o "d"/"c" de devedor/credor esta SO na formatacao da celula.
 *    Quem carrega a informacao e o sinal: positivo = devedor, negativo = credor.
 *  - Balancete: a hierarquia vem na indentacao da descricao, 3 espacos por nivel.
 *  - Balancete: as linhas de totais do rodape trazem o rotulo na coluna A e
 *    nao tem codigo de conta.
 *  - DRE: grupo na coluna A, conta na coluna C, saldo na I, e o subtotal do
 *    grupo cai na coluna L da ULTIMA conta daquele grupo.
 *  - Analise Horizontal: as colunas dos meses sao irregulares (celulas
 *    mescladas), entao cada mes e localizado pelo cabecalho, nunca por posicao.
 */

// ---------------------------------------------------------------------------
// APOIO
// ---------------------------------------------------------------------------

/** Maiusculas, sem acento, espacos colapsados — para comparar rotulos. */
function normTxt_(s) {
  if (s === null || s === undefined) return '';
  var t = String(s);
  try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  return t.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Devolve o numero da celula, ou null se nao for numero. */
function numCel_(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

/** Primeiro CNPJ que aparecer numa linha de celulas. */
function cnpjNaLinha_(linha) {
  for (var i = 0; i < linha.length; i++) {
    var m = String(linha[i] == null ? '' : linha[i]).match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (m) return m[0];
  }
  return '';
}

/** dd/mm/aaaa a partir de texto ou de um objeto Date da celula. */
function dataCel_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  var m = String(v == null ? '' : v).match(/\d{2}\/\d{2}\/\d{4}/);
  return m ? m[0] : '';
}

/**
 * Converte qualquer planilha do Drive (.xls legado, .xlsx, .csv) para Sheets,
 * le a primeira aba inteira e descarta a copia temporaria.
 * O .xls do Dominio e BIFF8 antigo; o Drive converte sem reclamar.
 */
function gradeDoArquivo_(fileId) {
  // .xls do Dominio: lido por conta propria. O conversor do Google devolve uma
  // planilha VAZIA para esse arquivo (falta o registro BOUNDSHEET) e nao avisa,
  // entao passar por ele significaria ler nada achando que leu.
  try {
    var arq = arquivoPorId_(fileId);
    if (/\.xls$/i.test(arq.getName())) {
      var G = gradeDoXlsAntigo_(arq.getBlob().getBytes());
      if (G && G.length > 1) return G;
    }
  } catch (eXls) {
    throw new Error('Falha ao ler o .xls: ' + (eXls && eXls.message || eXls));
  }

  // Se o arquivo JA e uma Planilha Google (o Drive converte no upload quando a
  // conta esta configurada assim), abrir direto: copiar seria desperdicio.
  try {
    if (arquivoPorId_(fileId).getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(fileId).getSheets()[0].getDataRange().getValues();
    }
  } catch (e) {}

  var tmp = null;
  try {
    // supportsAllDrives e obrigatorio: a pasta vive num Drive compartilhado
    // ("Servidor IA"), e sem esta flag a API v3 responde 404 como se o
    // arquivo nao existisse.
    tmp = comRetryDrive_(function () {
      return Drive.Files.copy(
        { name: 'tmp_leitura_' + fileId, mimeType: MimeType.GOOGLE_SHEETS },
        fileId,
        { supportsAllDrives: true }
      );
    });
    var aba = SpreadsheetApp.openById(tmp.id).getSheets()[0];
    return aba.getDataRange().getValues();
  } finally {
    // A copia nao pode ficar para tras: sao centenas de arquivos por mes.
    if (tmp && tmp.id) {
      try { arquivoPorId_(tmp.id).setTrashed(true); } catch (e) {}
    }
  }
}

/**
 * Descobre o que o arquivo e pelo CONTEUDO, nao pelo nome. Nome de arquivo
 * o usuario renomeia; o titulo impresso pelo Dominio nao.
 */
function tipoDaGrade_(G) {
  var alto = G.slice(0, 12).map(function (l) {
    return l.map(function (c) { return normTxt_(c); }).join(' ');
  }).join(' | ');
  if (alto.indexOf('ANALISE HORIZONTAL') >= 0) return 'analise_horizontal';
  if (alto.indexOf('BALANCETE') >= 0) return 'balancete';
  if (alto.indexOf('DEMONSTRACAO DO RESULTADO') >= 0) return 'dre';
  return '';
}

/** Linhas do DRE/AH que sao totais calculados, nao grupos de contas. */
var LINHAS_CALCULADAS = [
  'RECEITA LIQUIDA', 'LUCRO BRUTO', 'RESULTADO OPERACIONAL',
  'RESULTADO ANTES', 'LUCRO LIQUIDO', 'PREJUIZO', 'RESULTADO DO EXERCICIO'
];
function ehCalculada_(nome) {
  for (var i = 0; i < LINHAS_CALCULADAS.length; i++) {
    if (nome.indexOf(LINHAS_CALCULADAS[i]) >= 0) return true;
  }
  return false;
}

/** No DRE do Dominio, receita e o grupo que fala de receita e nao de deducao. */
function grupoEhReceita_(nome) {
  return nome.indexOf('RECEITA') >= 0 && nome.indexOf('DEDU') < 0;
}

// ---------------------------------------------------------------------------
// BALANCETE
// ---------------------------------------------------------------------------

function lerBalanceteGrade_(G) {
  var r = { nome: '', cnpj: '', periodo_inicio: '', periodo_fim: '', contas: [] };

  for (var i = 0; i < G.length; i++) {
    var lin = G[i];
    var a = normTxt_(lin[0]);

    if (a.indexOf('EMPRESA') === 0) {
      for (var j = 1; j < lin.length; j++) {
        var t = String(lin[j] == null ? '' : lin[j]).trim();
        if (t.length > 3) { r.nome = t; break; }
      }
    }
    if (a.indexOf('C.N.P.J') === 0) r.cnpj = cnpjNaLinha_(lin);
    if (a.indexOf('PERIODO') === 0) {
      var todas = lin.join(' ').match(/\d{2}\/\d{2}\/\d{4}/g) || [];
      if (todas.length >= 2) { r.periodo_inicio = todas[0]; r.periodo_fim = todas[1]; }
    }

    var codigo = lin[0];
    var desc   = lin[1];
    var atual  = numCel_(lin[7]);
    // Rodape: rotulo na coluna A, sem codigo de conta.
    if ((desc === null || desc === undefined || desc === '') &&
        typeof codigo === 'string' && atual !== null) {
      desc = codigo; codigo = null;
    }
    if (desc === null || desc === undefined || desc === '' || atual === null) continue;

    var bruta = String(desc);
    var espacos = bruta.length - bruta.replace(/^ +/, '').length;
    r.contas.push({
      codigo   : codigo,
      desc     : normTxt_(desc),
      nivel    : Math.floor(espacos / 3),
      anterior : numCel_(lin[4]) || 0,
      debito   : numCel_(lin[5]) || 0,
      credito  : numCel_(lin[6]) || 0,
      atual    : atual,
      resumo   : !(typeof codigo === 'number')
    });
  }
  return r;
}

/** Acha a primeira conta cuja descricao contenha todos os pedacos dados. */
function contaBal_(bal, pedacos, opc) {
  opc = opc || {};
  for (var i = 0; i < bal.contas.length; i++) {
    var c = bal.contas[i];
    if (!!opc.resumo !== !!c.resumo) continue;
    if (opc.nivel !== undefined && c.nivel !== opc.nivel) continue;
    var achou = true;
    for (var k = 0; k < pedacos.length; k++) {
      if (c.desc.indexOf(pedacos[k]) < 0) { achou = false; break; }
    }
    if (achou) return c;
  }
  return null;
}
function valBal_(conta, campo) {
  return conta ? Math.abs(conta[campo || 'atual']) : 0;
}

// ---------------------------------------------------------------------------
// DRE
// ---------------------------------------------------------------------------

function lerDreGrade_(G) {
  var r = { nome: '', cnpj: '', data_fim: '', grupos: [], contas: [], calculadas: {} };

  // As colunas de Saldo e Total sao achadas pelo cabecalho, nao fixadas.
  var cSaldo = -1, cTotal = -1;
  for (var i = 0; i < G.length && (cSaldo < 0 || cTotal < 0); i++) {
    for (var j = 0; j < G[i].length; j++) {
      var h = normTxt_(G[i][j]);
      if (h === 'SALDO' && cSaldo < 0) cSaldo = j;
      if (h === 'TOTAL' && cTotal < 0) cTotal = j;
    }
  }
  if (cSaldo < 0) cSaldo = 8;
  if (cTotal < 0) cTotal = 11;

  var grupo = null;
  for (var m = 0; m < G.length; m++) {
    var lin = G[m];
    var a = normTxt_(lin[0]);
    var c = normTxt_(lin[2]);
    var saldo = cSaldo < lin.length ? numCel_(lin[cSaldo]) : null;
    var total = cTotal < lin.length ? numCel_(lin[cTotal]) : null;

    if (a.indexOf('EMPRESA') === 0) {
      for (var j2 = 1; j2 < lin.length; j2++) {
        var t2 = String(lin[j2] == null ? '' : lin[j2]).trim();
        if (t2.length > 3) { r.nome = t2; break; }
      }
      continue;
    }
    if (a.indexOf('C.N.P.J') === 0) { r.cnpj = cnpjNaLinha_(lin); continue; }
    if (a.indexOf('DEMONSTRACAO') === 0) { r.data_fim = dataCel_(lin.join(' ')); continue; }
    if (a === 'DESCRICAO' || a.indexOf('SISTEMA LICENCIADO') === 0) continue;

    if (a) {
      if (ehCalculada_(a)) {
        if (total !== null) r.calculadas[a] = total;
        grupo = null;                       // linha calculada nao abre grupo
      } else {
        grupo = a;
        r.grupos.push({ nome: a, total: total });
      }
      continue;
    }

    if (c && saldo !== null && grupo) {
      r.contas.push({ conta: c, grupo: grupo, valor: saldo });
      if (total !== null) {                 // fecha o subtotal do grupo corrente
        for (var g = 0; g < r.grupos.length; g++) {
          if (r.grupos[g].nome === grupo && r.grupos[g].total === null) {
            r.grupos[g].total = total;
          }
        }
      }
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// ANALISE HORIZONTAL
// ---------------------------------------------------------------------------

function lerAhGrade_(G) {
  var r = { meses: [], linhas: [], cnpj: '', nome: '' };

  if (G.length) {
    var p = String(G[0][0] == null ? '' : G[0][0]).trim();
    if (p.length > 3) r.nome = p;
  }
  for (var i = 0; i < Math.min(G.length, 8); i++) {
    if (!r.cnpj) r.cnpj = cnpjNaLinha_(G[i]);
  }

  var iCab = -1;
  for (var k = 0; k < G.length; k++) {
    if (normTxt_(G[k][0]) === 'DESCRICAO') { iCab = k; break; }
  }
  if (iCab < 0) return r;

  // Colunas dos meses vem do cabecalho — mescladas, nunca em posicao fixa.
  var colunas = [];
  for (var j = 0; j < G[iCab].length; j++) {
    var h = String(G[iCab][j] == null ? '' : G[iCab][j]).trim();
    if (/^\d{2}\/\d{4}$/.test(h)) { colunas.push(j); r.meses.push(h); }
  }
  if (!colunas.length) return r;

  var grupo = null;
  for (var n = iCab + 1; n < G.length; n++) {
    var lin = G[n];
    var a = normTxt_(lin[0]);
    var c = normTxt_(lin[1]);

    if (a) { grupo = ehCalculada_(a) ? null : a; }
    if (!c || !grupo) continue;

    var vals = [], tem = false;
    for (var q = 0; q < colunas.length; q++) {
      var x = colunas[q] < lin.length ? numCel_(lin[colunas[q]]) : null;
      if (x !== null) tem = true;
      vals.push(x === null ? 0 : x);
    }
    if (!tem) continue;
    r.linhas.push({
      conta: c, grupo: grupo,
      natureza: grupoEhReceita_(grupo) ? 'receita' : 'despesa',
      valores: vals
    });
  }
  return r;
}

// ---------------------------------------------------------------------------
// MONTAGEM — mesmo formato que a extracao por IA devolvia
// ---------------------------------------------------------------------------

/**
 * Identifica a empresa de UM arquivo, escolhendo o caminho pelo formato.
 * Planilha: le o cabecalho e pronto — instantaneo, de graca e exato, porque o
 * CNPJ esta numa celula. PDF: continua indo ao Gemini, que era o unico jeito.
 * Antes, planilha tambem era mandada ao Gemini como se fosse PDF — e o modelo
 * nao conseguia ler nada, entao o botao de identificar nunca funcionava nelas.
 */
function identificarEmpresaNoArquivo_(fileId, nome) {
  if (!nome) {
    try { nome = arquivoPorId_(fileId).getName(); } catch (e) { nome = ''; }
  }
  if (/\.pdf$/i.test(String(nome || '').trim())) {
    return identificarEmpresaNoPdf_(fileId);
  }
  // Mesmo sendo barato, ler a planilha custa uma copia no Drive. Como o
  // conteudo nao muda, guarda por 6h.
  var cacheP = null, chaveP = 'idplan_' + fileId;
  try {
    cacheP = CacheService.getScriptCache();
    var pronto = cacheP.get(chaveP);
    if (pronto) return JSON.parse(pronto);
  } catch (e) { cacheP = null; }

  var G = gradeDoArquivo_(fileId);
  var tipo = tipoDaGrade_(G);
  var lido = (tipo === 'balancete') ? lerBalanceteGrade_(G)
           : (tipo === 'dre')       ? lerDreGrade_(G)
           : (tipo === 'analise_horizontal') ? lerAhGrade_(G)
           : { nome: '', cnpj: '' };
  var d = cnpj14_(lido.cnpj);
  var achado = {
    nome        : lido.nome || '',
    cnpj        : lido.cnpj || '',
    tipo        : tipo || '',
    cnpjDigitos : d,
    cnpjRaiz    : d ? d.substring(0, 8) : ''
  };
  if (cacheP) { try { cacheP.put(chaveP, JSON.stringify(achado), 21600); } catch (e2) {} }
  return achado;
}

/**
 * Le os arquivos de uma empresa e devolve o pacote de dados no formato que
 * calcularIndicadores_ e gerarAnalise_ ja consomem.
 * @param {Array} arquivos [{id, nome, tipo}]
 * @return {Object} dados
 */
function lerDocumentosDominio_(arquivos) {
  var obs = [], bal = null, dre = null, ah = null;

  for (var i = 0; i < arquivos.length; i++) {
    var arq = arquivos[i], G;
    try {
      G = gradeDoArquivo_(arq.id);
    } catch (e) {
      obs.push('Nao consegui abrir "' + arq.nome + '": ' + (e && e.message || e));
      continue;
    }
    var tipo = tipoDaGrade_(G);
    if (tipo === 'balancete' && !bal) bal = lerBalanceteGrade_(G);
    else if (tipo === 'dre' && !dre)  dre = lerDreGrade_(G);
    else if (tipo === 'analise_horizontal' && !ah) ah = lerAhGrade_(G);
    else if (!tipo) obs.push('"' + arq.nome + '" nao parece um export do Dominio; ignorado.');
  }

  if (!dre && !bal) {
    // As falhas de leitura ficavam guardadas em obs e morriam aqui, junto com
    // a unica pista do que deu errado. Agora elas vao na mensagem.
    throw new Error('Nenhum DRE ou Balancete legivel entre os arquivos enviados.\n'
      + 'O leitor espera os exports do Dominio em Excel (.xls/.xlsx) ou CSV.\n\n'
      + (obs.length ? 'O que aconteceu com cada arquivo:\n- ' + obs.join('\n- ')
                    : 'Arquivos recebidos: '
                      + arquivos.map(function (a) { return a.nome; }).join(', ')));
  }

  // ---- identificacao da empresa: vem do proprio documento, celula fixa ----
  var idNome = (bal && bal.nome) || (dre && dre.nome) || (ah && ah.nome) || '';
  var idCnpj = (bal && bal.cnpj) || (dre && dre.cnpj) || (ah && ah.cnpj) || '';

  // ---- DRE acumulado ----
  var receitas = [], despesas = [], recTot = 0, despTot = 0;
  if (dre) {
    for (var d = 0; d < dre.contas.length; d++) {
      var ct = dre.contas[d];
      var item = { conta: ct.conta, grupo: ct.grupo, valor: Math.abs(ct.valor) };
      if (grupoEhReceita_(ct.grupo)) { receitas.push(item); recTot += item.valor; }
      else { despesas.push(item); despTot += item.valor; }
    }
  }
  var lucro = 0;
  if (dre) {
    var chaves = Object.keys(dre.calculadas);
    for (var q = 0; q < chaves.length; q++) {
      if (chaves[q].indexOf('LUCRO LIQUIDO') >= 0 || chaves[q].indexOf('PREJUIZO') >= 0) {
        lucro = dre.calculadas[chaves[q]];
      }
    }
    if (!lucro && dre.calculadas['RESULTADO OPERACIONAL'] !== undefined) {
      lucro = dre.calculadas['RESULTADO OPERACIONAL'];
    }
  }

  // ---- DRE do mes: sai da ultima coluna da Analise Horizontal ----
  // Assim o mensal deixa de ser um documento separado a mais para exportar.
  var mensal = { mes: '', receita_total: 0, despesa_total: 0, resultado_liquido: 0 };
  if (ah && ah.meses.length) {
    var ult = ah.meses.length - 1;
    mensal.mes = ah.meses[ult];
    for (var w = 0; w < ah.linhas.length; w++) {
      var v = ah.linhas[w].valores[ult] || 0;
      if (ah.linhas[w].natureza === 'receita') mensal.receita_total += Math.abs(v);
      else mensal.despesa_total += Math.abs(v);
    }
    mensal.resultado_liquido = mensal.receita_total - mensal.despesa_total;
  }

  // ---- Balancete ----
  var disp = bal ? contaBal_(bal, ['DISPONIVEL']) : null;
  var balOut = {
    data_base                      : (bal && bal.periodo_fim) || (dre && dre.data_fim) || '',
    ativo_total                    : valBal_(bal && contaBal_(bal, ['ATIVO'], { nivel: 0 })),
    ativo_circulante               : valBal_(bal && contaBal_(bal, ['ATIVO CIRCULANTE'])),
    caixa                          : valBal_(bal && contaBal_(bal, ['CAIXA'])),
    bancos                         : valBal_(bal && contaBal_(bal, ['BANCOS CONTA MOVIMENTO'])),
    aplicacoes_financeiras         : valBal_(bal && contaBal_(bal, ['APLICACOES FINANCEIRAS'])),
    disponibilidades               : valBal_(disp),
    contas_a_receber               : valBal_(bal && contaBal_(bal, ['CLIENTES'])),
    outros_creditos                : valBal_(bal && contaBal_(bal, ['OUTROS CREDITOS'])),
    estoques                       : valBal_(bal && contaBal_(bal, ['ESTOQUE'])),
    ativo_nao_circulante           : valBal_(bal && contaBal_(bal, ['ATIVO NAO-CIRCULANTE'])),
    imobilizado_liquido            : valBal_(bal && contaBal_(bal, ['IMOBILIZADO'])),
    intangivel                     : valBal_(bal && contaBal_(bal, ['INTANGIVEL'])),
    passivo_total                  : valBal_(bal && contaBal_(bal, ['PASSIVO'], { nivel: 0 })),
    passivo_circulante             : valBal_(bal && contaBal_(bal, ['PASSIVO CIRCULANTE'])),
    fornecedores                   : valBal_(bal && contaBal_(bal, ['FORNECEDORES'])),
    obrigacoes_trabalhistas        : valBal_(bal && contaBal_(bal, ['OBRIGACOES TRABALHISTA'])),
    obrigacoes_tributarias         : valBal_(bal && contaBal_(bal, ['OBRIGACOES TRIBUTARIAS'])),
    emprestimos_curto_prazo        : valBal_(bal && contaBal_(bal, ['EMPRESTIMOS'])),
    outras_obrigacoes              : valBal_(bal && contaBal_(bal, ['OUTRAS OBRIGACOES'])),
    passivo_nao_circulante         : valBal_(bal && contaBal_(bal, ['PASSIVO NAO-CIRCULANTE'])),
    emprestimos_longo_prazo        : 0,
    patrimonio_liquido             : valBal_(bal && contaBal_(bal, ['PATRIMONIO LIQUIDO'])),
    resultado_do_exercicio         : valBal_(bal && contaBal_(bal, ['RESULTADO DO EXERCICIO'], { resumo: true })),
    disponibilidades_inicio_periodo: valBal_(disp, 'anterior'),
    disponibilidades_fim_periodo   : valBal_(disp),
    depreciacao_periodo            : 0
  };
  for (var dp = 0; dp < despesas.length; dp++) {
    if (despesas[dp].conta.indexOf('DEPRECIA') >= 0 || despesas[dp].conta.indexOf('AMORTIZA') >= 0) {
      balOut.depreciacao_periodo += despesas[dp].valor;
    }
  }

  // ---- periodo ----
  var ini = (bal && bal.periodo_inicio) || '';
  var fim = (bal && bal.periodo_fim) || (dre && dre.data_fim) || '';
  var meses = (ah && ah.meses.length) ? ah.meses.length : mesesEntre_(ini, fim);

  // ---- conferencia DRE x Balancete: os dois sao lidos por caminhos ----
  // ---- independentes, entao divergencia grande denuncia erro de leitura ----
  if (dre && bal) {
    // Comparar com o SALDO desta conta seria errado: o saldo ja vem liquido
    // das deducoes. A receita bruta do periodo esta na coluna CREDITO.
    var recBal = valBal_(contaBal_(bal, ['CONTAS DE RESULTADO - RECEITAS'], { resumo: true }), 'credito');
    if (recBal > 0 && Math.abs(recTot - recBal) > 1) {
      obs.push('Receita do DRE (' + moeda_(recTot) + ') diverge do Balancete ('
        + moeda_(recBal) + ') em ' + moeda_(recTot - recBal) + '.');
    }
  }

  return {
    empresa: {
      nome            : idNome,
      cnpj            : idCnpj,
      periodo_inicio  : ini,
      periodo_fim     : fim,
      mes_referencia  : mensal.mes,
      meses_no_periodo: meses || 1
    },
    dre_acumulado: {
      receita_total    : recTot,
      despesa_total    : despTot,
      resultado_liquido: lucro,
      receitas         : receitas,
      despesas         : despesas
    },
    dre_mensal        : mensal,
    analise_horizontal: { meses: (ah && ah.meses) || [], linhas: (ah && ah.linhas) || [] },
    balancete         : balOut,
    observacoes_extracao: obs
  };
}

/** Quantos meses ha entre duas datas dd/mm/aaaa (inclusivo). */
function mesesEntre_(ini, fim) {
  var a = String(ini).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  var b = String(fim).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!a || !b) return 0;
  return (Number(b[3]) - Number(a[3])) * 12 + (Number(b[2]) - Number(a[2])) + 1;
}

/**
 * TRAVA DE SEGURANCA: o CNPJ impresso no documento tem que ser o da empresa
 * escolhida. Um relatorio com o nome de um cliente e os numeros de outro e o
 * pior defeito possivel num escritorio contabil, e ate agora nada impedia isso
 * quando o vinculo era feito a mao na tela.
 * @return {Object} { ok, erro }
 */
function conferirCnpjDocumentos_(dadosLidos, empresaEscolhida) {
  var doDoc = cnpj14_(dadosLidos && dadosLidos.empresa && dadosLidos.empresa.cnpj);
  var doCad = cnpj14_(empresaEscolhida && (empresaEscolhida.cnpjDigitos || empresaEscolhida.cnpj));

  if (!doDoc) {
    return { ok: true, aviso: 'Os documentos nao trazem CNPJ legivel; nao foi possivel conferir.' };
  }
  if (!doCad) {
    return { ok: true, aviso: 'A empresa "' + (empresaEscolhida && empresaEscolhida.empresa)
      + '" esta sem CNPJ no Cadastro; nao foi possivel conferir.' };
  }
  if (doDoc === doCad) return { ok: true };

  // Mesma raiz = matriz e filial. Segue, mas avisa.
  if (doDoc.substring(0, 8) === doCad.substring(0, 8)) {
    return { ok: true, aviso: 'Documento e de outra unidade do mesmo grupo (CNPJ '
      + formatarCnpj_(doDoc) + ' contra ' + formatarCnpj_(doCad) + ').' };
  }

  return {
    ok: false,
    erro: 'CNPJ NAO CONFERE — geracao interrompida.\n\n'
      + 'Empresa escolhida : ' + (empresaEscolhida && empresaEscolhida.empresa) + '\n'
      + '  CNPJ no Cadastro: ' + formatarCnpj_(doCad) + '\n'
      + 'Documentos enviados: ' + (dadosLidos.empresa.nome || '(sem nome)') + '\n'
      + '  CNPJ no documento: ' + formatarCnpj_(doDoc) + '\n\n'
      + 'Os documentos pertencem a outra empresa. Corrija o vinculo antes de gerar.'
  };
}
