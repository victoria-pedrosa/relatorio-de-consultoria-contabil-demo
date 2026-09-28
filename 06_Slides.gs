/**
 * Arquivo: 06_Slides.gs
 * Monta o dicionário de tags e preenche o template do Google Slides.
 */

// =====================================================================
// DICIONÁRIO DE TAGS
// =====================================================================

/**
 * @param {Object} d   JSON de extração
 * @param {Object} k   indicadores calculados
 * @param {Object} a   análise redigida pelo Gemini
 * @param {Object} emp linha do Cadastro (pode ser null)
 */
function montarTags_(d, k, a, emp) {
  var nome = (emp && emp.empresa) || d.empresa.nome || '';
  var cnpj = (emp && emp.cnpj) || d.empresa.cnpj || '';
  var periodoExt = periodoExtenso_(d.empresa.periodo_inicio, d.empresa.periodo_fim);
  var periodoCurto = periodoCurto_(d.empresa.periodo_inicio, d.empresa.periodo_fim);
  var rotuloRes = k.deficit ? 'DÉFICIT DO PERÍODO' : 'SUPERÁVIT DO PERÍODO';
  var rotuloResMin = k.deficit ? 'Déficit do período' : 'Superávit do período';

  var T = {};

  // ---------- Slide 1 — Capa ----------
  T['EMPRESA_NOME']     = nome.toUpperCase();
  T['EMPRESA_FANTASIA'] = (emp && emp.fantasia) || '';
  T['CNPJ']             = cnpj;
  T['TITULO_CAPA']      = 'Análise de Resultados';
  T['PERIODO_EXTENSO']  = periodoExt;
  T['PERIODO_CURTO']    = periodoCurto;
  T['DATA_BASE']        = dataBr_(d.balancete.data_base || d.empresa.periodo_fim);
  T['RODAPE']           = nomeCurto_(nome) + ' • Análise de Resultados • ' + periodoCurto;
  T['DATA_EMISSAO']     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

  // ---------- Slide 2 — Visão Geral ----------
  T['RECEITA_TOTAL']        = moedaCurta_(k.receita_total);
  T['RECEITA_TOTAL_FULL']   = moeda_(k.receita_total);
  T['RECEITA_MEDIA_MES']    = 'média de ' + moedaCurta_(k.receita_media_mes) + ' por mês';
  T['DESPESA_TOTAL']        = moedaCurta_(k.despesa_total);
  T['DESPESA_TOTAL_FULL']   = moeda_(k.despesa_total);
  T['DESPESA_MEDIA_MES']    = 'média de ' + moedaCurta_(k.despesa_media_mes) + ' por mês';
  T['RESULTADO_LABEL']      = rotuloRes;
  T['RESULTADO_LABEL_MIN']  = rotuloResMin;
  T['RESULTADO_TOTAL']      = moedaCurta_(Math.abs(k.resultado));
  T['RESULTADO_TOTAL_FULL'] = moeda_(k.resultado);
  T['RESULTADO_MARGEM']     = pct_(k.margem_liquida) + ' da receita';
  T['CAIXA_TOTAL']          = moedaCurta_(k.disponibilidades);
  T['CAIXA_TOTAL_FULL']     = moeda_(k.disponibilidades);
  T['CAIXA_VARIACAO']       = (k.disponibilidades_inicio > 0
      ? pct_((k.disponibilidades - k.disponibilidades_inicio) / k.disponibilidades_inicio) +
        ' desde ' + dataBr_(inicioMenos1_(d.empresa.periodo_inicio))
      : 'saldo de abertura não informado nos documentos');
  T['TEXTO_VISAO_GERAL']    = a.texto_visao_geral;

  // ---------- Slide 3 — Receita ----------
  T['TITULO_RECEITA'] = a.titulo_receita;
  preencherLista_(T, 'REC', k.lista_receita, CONFIG.MAX_LINHAS_RECEITA);
  for (var i = 0; i < 3; i++) T['TEXTO_RECEITA_' + (i + 1)] = a.leitura_receita[i] || '';

  // ---------- Slide 4 — Despesas ----------
  T['TITULO_DESPESAS'] = a.titulo_despesas;
  preencherLista_(T, 'DESP', k.lista_despesa, CONFIG.MAX_LINHAS_DESPESA);
  for (var j = 0; j < 3; j++) T['TEXTO_DESPESAS_' + (j + 1)] = a.leitura_despesas[j] || '';

  // ---------- Slide 5 — Diagnóstico central ----------
  T['TITULO_DIAGNOSTICO']   = a.titulo_diagnostico;
  T['DIAG_PERCENTUAL']      = a.diagnostico_percentual || pct_(k.custo_fixo_sobre_receita, false, 0);
  T['DIAG_LEGENDA']         = a.diagnostico_legenda || 'DA RECEITA VAI PARA PESSOAL E OCUPAÇÃO';
  T['TEXTO_DIAGNOSTICO']    = a.texto_diagnostico_1;
  T['TEXTO_DIAGNOSTICO_1']  = a.texto_diagnostico_1;
  T['TEXTO_DIAGNOSTICO_2']  = a.texto_diagnostico_2;
  T['DIAG_RECEITA_LABEL']   = 'Receita do período';
  T['DIAG_RECEITA_VALOR']   = moedaCurta_(k.receita_total);
  T['DIAG_PESSOAL_LABEL']   = 'Pessoal e encargos';
  T['DIAG_PESSOAL_VALOR']   = moedaCurta_(k.bloco_pessoal);
  T['DIAG_OCUPACAO_LABEL']  = 'Custo de ocupação';
  T['DIAG_OCUPACAO_VALOR']  = moedaCurta_(k.bloco_ocupacao);
  T['DIAG_DEMAIS_LABEL']    = 'Demais despesas';
  T['DIAG_DEMAIS_VALOR']    = moedaCurta_(k.bloco_demais);
  T['DIAG_RESULTADO_LABEL'] = rotuloResMin;
  T['DIAG_RESULTADO_VALOR'] = (k.deficit ? '− ' : '') + moedaCurta_(Math.abs(k.resultado)).replace('− ', '');

  // ---------- Slide 6 — Balanço Patrimonial ----------
  T['LIQ_CORRENTE']       = num_(k.liquidez_corrente, 1);
  T['LIQ_CORRENTE_DESC']  = moedaCurta_(k.ativo_circulante) + ' de ativo circulante contra ' +
                            moedaCurta_(k.passivo_circulante) + ' de passivo';
  T['LIQ_IMEDIATA']       = num_(k.liquidez_imediata, 1);
  T['LIQ_IMEDIATA_DESC']  = moedaCurta_(k.disponibilidades) + ' em caixa, banco e aplicações';
  T['CCL']                = moedaCurta_(k.capital_circulante_liquido);
  T['CCL_DESC']           = 'cerca de ' + num_(k.meses_reserva, 0) + ' meses de despesa';
  T['ENDIVIDAMENTO']      = pct_(k.endividamento_geral);
  T['ENDIVIDAMENTO_DESC'] = (k.passivo_nao_circulante === 0 ? 'sem passivo não circulante' : 'inclui passivo de longo prazo') +
                            (k.emprestimos === 0 ? ' e sem empréstimos' : ' e ' + moedaCurta_(k.emprestimos) + ' de empréstimos');
  T['PL_ATIVO']           = pct_(k.pl_sobre_ativo);
  T['PL_ATIVO_DESC']      = moedaCurta_(k.patrimonio_liquido) + ' de patrimônio, já deduzido o resultado';
  T['MARGEM_LIQUIDA']     = pct_(k.margem_liquida);
  T['MARGEM_LIQUIDA_DESC']= 'retorno sobre o ativo de ' + pct_(k.roa) + ' em ' + k.meses + ' meses';
  T['TEXTO_BALANCO']      = a.texto_balanco;
  T['ATIVO_TOTAL']        = moeda_(k.ativo_total);
  T['PASSIVO_TOTAL']      = moeda_(k.passivo_terceiros);
  T['PATRIMONIO_LIQUIDO'] = moeda_(k.patrimonio_liquido);

  // ---------- Slide 7 — Caixa ----------
  T['TITULO_CAIXA'] = a.titulo_caixa;
  for (var r = 0; r < 7; r++) {
    var item = k.reconciliacao_caixa[r];
    T['CX_' + (r + 1) + '_LABEL'] = item ? item.rotulo : '';
    T['CX_' + (r + 1) + '_VALOR'] = item
      ? (item.tipo === 'saldo' ? moeda_(item.valor)
                               : (item.valor >= 0 ? '+ ' : '− ') + moeda_(Math.abs(item.valor)).replace('R$ ', 'R$ '))
      : '';
  }
  // sem saldo de abertura não dá para falar em consumo/geração: o card passa
  // a mostrar quantos meses de despesa a reserva cobre
  if (!k.caixa_inicio_conhecido) {
    T['CONSUMO_MENSAL_LABEL'] = 'RESERVA EM MESES DE DESPESA';
    T['CONSUMO_MENSAL']       = num_(k.meses_reserva, 0) + ' meses';
  } else {
    T['CONSUMO_MENSAL_LABEL'] = k.consumo_mensal_caixa < 0
      ? 'CONSUMO MENSAL DE CAIXA' : 'GERAÇÃO MENSAL DE CAIXA';
    T['CONSUMO_MENSAL']       = moedaCurta_(Math.abs(k.consumo_mensal_caixa));
  }
  T['TEXTO_CAIXA_1']        = a.texto_caixa_1;
  T['RENDIMENTO_PCT']       = rendimentoAplicacoes_(d, k);
  T['TEXTO_CAIXA_2']        = a.texto_caixa_2;
  T['NOTA_CAIXA']           = 'Reconciliação a partir do balancete — a DFC não integra o material recebido.';

  // ---------- Slide 8 — Saúde Financeira ----------
  T['CLASSIFICACAO_GERAL'] = a.classificacao_geral;
  for (var s = 0; s < 5; s++) {
    var it = a.saude[s] || { dimensao: '', texto: '' };
    T['SAUDE_' + (s + 1) + '_TITULO'] = it.dimensao;
    T['SAUDE_' + (s + 1) + '_TEXTO']  = it.texto;
  }
  T['TEXTO_SAUDE'] = a.texto_saude;

  // ---------- Slides 9 e 10 — Diagnóstico em itens ----------
  for (var p = 0; p < CONFIG.MAX_ITENS_DIAGNOSTICO; p++) {
    var pos = a.pontos_positivos[p] || { titulo: '', texto: '' };
    var neg = a.pontos_atencao[p]   || { titulo: '', texto: '' };
    T['BOM_' + (p + 1) + '_TITULO']      = pos.titulo;
    T['BOM_' + (p + 1) + '_TEXTO']       = pos.texto;
    T['MELHORAR_' + (p + 1) + '_TITULO'] = neg.titulo;
    T['MELHORAR_' + (p + 1) + '_TEXTO']  = neg.texto;
  }

  // ---------- Slide 11 — Recomendações ----------
  for (var q = 0; q < CONFIG.MAX_RECOMENDACOES; q++) {
    T['ACAO_' + (q + 1)] = a.recomendacoes[q] || '';
  }

  // ---------- Slide 12 — Resumo ----------
  T['RESUMO_TITULO'] = a.resumo_titulo;
  T['RESUMO_TEXTO']  = a.resumo_texto;
  T['ASSINATURA']    = 'Elaborado por Escritório Contábil Exemplo • Seja mais, seja Exemplo.';

  return T;
}

function preencherLista_(T, prefixo, lista, max) {
  for (var i = 0; i < max; i++) {
    var it = lista[i];
    T[prefixo + '_' + (i + 1) + '_NOME']  = it ? it.conta : '';
    T[prefixo + '_' + (i + 1) + '_VALOR'] = it ? (moedaCurta_(it.valor).replace('R$ ', '') + ' · ' + pct_(it.pct)) : '';
    T[prefixo + '_' + (i + 1) + '_PCT']   = it ? pct_(it.pct) : '';
  }
}

function nomeCurto_(nome) {
  var partes = String(nome || '').trim().split(/\s+/);
  return (partes.length <= 3) ? String(nome || '') : partes.slice(0, 3).join(' ');
}

function inicioMenos1_(dataIni) {
  var d = parseDataBr_(dataIni);
  if (!d) return '';
  var x = new Date(d.getFullYear(), d.getMonth(), 0);   // último dia do mês anterior
  return Utilities.formatDate(x, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/** Rendimento das aplicações no período, quando identificável na DRE. */
function rendimentoAplicacoes_(d, k) {
  var soma = 0;
  d.dre_acumulado.receitas.forEach(function (c) {
    var n = normalizar_(c.conta);
    if (/rendimento|aplicacao|financeir/.test(n)) soma += c.valor;
  });
  var base = (k.disponibilidades + k.disponibilidades_inicio) / 2;
  if (!soma || base <= 0) return '—';
  return pct_(soma / base);
}

// =====================================================================
// PREENCHIMENTO DO TEMPLATE
// =====================================================================

/**
 * Copia o template, substitui as tags, ajusta barras e devolve o arquivo.
 * @return {{id:string, url:string, nome:string}}
 */
function gerarApresentacao_(tags, indicadores, nomeArquivo, pastaSaida, templateId) {
  templateId = templateId || getTemplateId_();
  var copia = comRetryDrive_(function () {
    return arquivoPorId_(templateId).makeCopy(nomeArquivo, pastaSaida);
  });

  // Substituicao literal de todas as tags, numa unica chamada.
  // Cada replaceAllText do SlidesApp e uma ida e volta ao servidor; com ~175
  // tags isso virava ~175 chamadas de rede. A API de Slides aceita todas num
  // batchUpdate so.
  // Primeiro a limpeza das linhas vazias, com os marcadores {{...}} ainda no
  // lugar — e por eles que cada linha e identificada. Fecha em seguida para
  // que a substituicao logo abaixo trabalhe sobre o arquivo ja enxuto.
  try {
    var prep = SlidesApp.openById(copia.getId());
    removerLinhasNaoUsadas_(prep, tags);
    prep.saveAndClose();
  } catch (eLimpa) {
    // Falhar aqui so significa manter as linhas vazias; nao derruba o relatorio.
  }

  // As chaves de montarTags_ vem SEM as chaves duplas ('EMPRESA_NOME'), e no
  // template elas aparecem como '{{EMPRESA_NOME}}'. Procurar pela chave nua
  // troca so o miolo e deixa as chaves em volta do valor — foi o que apareceu
  // no relatorio. O texto procurado tem que ser o marcador inteiro.
  var marcador = function (chave) {
    var c = String(chave);
    return (c.indexOf('{{') === 0) ? c : ('{{' + c + '}}');
  };

  var pedidos = Object.keys(tags).map(function (chave) {
    return {
      replaceAllText: {
        containsText: { text: marcador(chave), matchCase: true },
        replaceText: String(tags[chave] == null ? '' : tags[chave])
      }
    };
  });

  // A troca acontece ANTES de abrir a apresentacao com o SlidesApp. Se abrir
  // primeiro, o SlidesApp guarda o conteudo com as tags ainda no lugar e o
  // saveAndClose() do final grava esse estado por cima do que a API trocou —
  // e limparTagsResiduais_ ainda apaga as tags que sobraram. Resultado: o
  // relatorio sai inteiro em branco, que foi exatamente o que aconteceu.
  var trocouPelaApi = false;
  if (pedidos.length) {
    try {
      Slides.Presentations.batchUpdate({ requests: pedidos }, copia.getId());
      trocouPelaApi = true;
    } catch (e) {
      trocouPelaApi = false;   // servico avancado de Slides indisponivel
    }
  }

  var pres = SlidesApp.openById(copia.getId());

  if (pedidos.length && !trocouPelaApi) {
    // Caminho reserva: lento, mas garante o relatorio preenchido.
    Object.keys(tags).forEach(function (chave) {
      pres.replaceAllText(marcador(chave), String(tags[chave] == null ? '' : tags[chave]), true);
    });
  }

  // 2) barras proporcionais, remoção de linhas vazias e ajuste de fonte
  var slides = pres.getSlides();
  for (var i = 0; i < slides.length; i++) {
    ajustarSlide_(slides[i], indicadores, tags);
  }

  // 3) limpa tags que sobraram (campos não usados no template)
  limparTagsResiduais_(pres);

  pres.saveAndClose();
  var f = arquivoPorId_(copia.getId());
  return { id: f.getId(), url: f.getUrl(), nome: f.getName() };
}


/**
 * Remove qualquer {{TAG}} que tenha sobrado (SlidesApp.replaceAllText não
 * aceita expressão regular, então varremos os shapes manualmente).
 */
function limparTagsResiduais_(pres) {
  var re = /\{\{[A-Z0-9_]+\}\}/g;
  var slides = pres.getSlides();
  for (var i = 0; i < slides.length; i++) {
    var els = slides[i].getPageElements();
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      var tipo;
      try { tipo = el.getPageElementType(); } catch (e) { continue; }
      if (tipo === SlidesApp.PageElementType.SHAPE) {
        limparTextoShape_(el.asShape().getText(), re);
      } else if (tipo === SlidesApp.PageElementType.TABLE) {
        var tab = el.asTable();
        for (var r = 0; r < tab.getNumRows(); r++) {
          for (var c = 0; c < tab.getNumColumns(); c++) {
            limparTextoShape_(tab.getCell(r, c).getText(), re);
          }
        }
      } else if (tipo === SlidesApp.PageElementType.GROUP) {
        var filhos = el.asGroup().getChildren();
        for (var g = 0; g < filhos.length; g++) {
          try { limparTextoShape_(filhos[g].asShape().getText(), re); } catch (e2) {}
        }
      }
    }
  }
}

function limparTextoShape_(textRange, re) {
  try {
    var s = textRange.asString();
    if (s && re.test(s)) {
      re.lastIndex = 0;
      textRange.setText(s.replace(re, '').replace(/[ \t]{2,}/g, ' ').trim());
    }
    re.lastIndex = 0;
  } catch (e) {}
}

/**
 * Convenções de marcação nos elementos do template (campo "Título" do
 * texto alternativo — em Slides: clique no objeto ▸ Texto alternativo):
 *
 *   BAR:REC_3          barra proporcional da 3ª linha de receita
 *   BAR:DESP_2         barra proporcional da 2ª linha de despesa
 *   BAR:DIAG_PESSOAL   barra do bloco pessoal no slide de diagnóstico
 *   ROW:REC_3          qualquer elemento da linha 3 de receita (removido
 *                      quando não há dado para essa linha)
 *   ROWCX:6            faixa 6 da reconciliação de caixa (removida se vazia)
 *   POS:SAUDE_ESCALA   marcador que desliza sobre a régua de classificação
 *   FIT:20:320         reduz a fonte se o texto passar de 320 caracteres,
 *                      partindo de 20pt
 */
/**
 * Apaga as linhas numeradas que nao tem conteudo nos slides de diagnostico e
 * de recomendacoes.
 *
 * O template desenha sempre 5 linhas. Quando a empresa tem so 2 pontos
 * positivos, sobravam os numeros 3, 4 e 5 soltos com as linhas divisorias —
 * num relatorio que vai para o cliente isso parece documento inacabado.
 *
 * Roda ANTES da substituicao das tags, quando cada campo ainda carrega o
 * marcador {{PREFIXO_N_...}}. E o que permite identificar a linha com certeza,
 * sem depender de posicao na pagina.
 */
function removerLinhasNaoUsadas_(pres, tags) {
  var grupos = [
    { prefixo: 'BOM',      sufixos: ['_TITULO', '_TEXTO'] },
    { prefixo: 'MELHORAR', sufixos: ['_TITULO', '_TEXTO'] },
    { prefixo: 'ACAO',     sufixos: [''] }
  ];

  var slides = pres.getSlides();
  for (var s = 0; s < slides.length; s++) {
    var elementos = slides[s].getPageElements();

    // Texto de cada elemento, uma vez so: getText() e ida ao servidor.
    var conteudo = [];
    for (var e = 0; e < elementos.length; e++) {
      var txt = '';
      try { txt = elementos[e].asShape().getText().asString(); } catch (eT) { txt = ''; }
      conteudo.push(String(txt).trim());
    }

    for (var g = 0; g < grupos.length; g++) {
      var pre = grupos[g].prefixo;
      for (var n = 1; n <= 12; n++) {
        var marcador = '{{' + pre + '_' + n + grupos[g].sufixos[0] + '}}';
        var iAlvo = conteudo.indexOf(marcador);
        if (iAlvo < 0) continue;                 // esta linha nao existe aqui

        // A linha so cai se TODOS os campos dela estiverem vazios.
        var temConteudo = false;
        for (var f = 0; f < grupos[g].sufixos.length; f++) {
          var chave = pre + '_' + n + grupos[g].sufixos[f];
          if (String(tags[chave] == null ? '' : tags[chave]).trim()) temConteudo = true;
        }
        if (temConteudo) continue;

        // Faixa vertical da linha: do topo do titulo ate o comeco da proxima.
        var topo, altura;
        try { topo = elementos[iAlvo].getTop(); } catch (eP) { continue; }
        var topoProxima = null;
        var marcadorProx = '{{' + pre + '_' + (n + 1) + grupos[g].sufixos[0] + '}}';
        var iProx = conteudo.indexOf(marcadorProx);
        if (iProx >= 0) { try { topoProxima = elementos[iProx].getTop(); } catch (eQ) {} }

        // Sem proxima linha, usa o espacamento entre as duas anteriores.
        var passo = (topoProxima !== null) ? (topoProxima - topo) : 53;
        var deste = topo - 8, ate = topo + passo - 8;

        for (var r = 0; r < elementos.length; r++) {
          var t2;
          try { t2 = elementos[r].getTop(); } catch (eR) { continue; }
          if (t2 < deste || t2 >= ate) continue;
          try { elementos[r].remove(); } catch (eS) {}
        }
        // Os indices mudaram depois da remocao; recomeca este slide.
        elementos = slides[s].getPageElements();
        conteudo = [];
        for (var e2 = 0; e2 < elementos.length; e2++) {
          var t3 = '';
          try { t3 = elementos[e2].asShape().getText().asString(); } catch (eU) { t3 = ''; }
          conteudo.push(String(t3).trim());
        }
      }
    }
  }
}

function ajustarSlide_(slide, k, tags) {
  var elementos = slide.getPageElements();
  var remover = [];

  for (var i = 0; i < elementos.length; i++) {
    var el = elementos[i];
    var marca = '';
    try { marca = el.getTitle() || ''; } catch (e) { marca = ''; }

    // --- linhas vazias -------------------------------------------------
    if (marca.indexOf('ROW:') === 0) {
      var chaveRow = marca.substring(4).trim();
      if (!tags[chaveRow + '_NOME']) { remover.push(el); continue; }
    }
    // faixas zebradas da reconciliação de caixa sem conteúdo
    if (marca.indexOf('ROWCX:') === 0) {
      var nCx = marca.substring(6).trim();
      if (!tags['CX_' + nCx + '_LABEL']) { remover.push(el); continue; }
    }

    // --- barras proporcionais -------------------------------------------
    if (marca.indexOf('BAR:') === 0) {
      var chave = marca.substring(4).trim();
      if (/^(REC|DESP)_\d+$/.test(chave) && !tags[chave + '_NOME']) { remover.push(el); continue; }
      var frac = fracaoBarra_(chave, k, tags);
      var largMax = larguraMaxima_(el);
      var nova = Math.max(2, largMax * Math.max(0, Math.min(1, frac)));
      try { el.setWidth(nova); } catch (e2) {}
      continue;
    }

    // --- marcador que desliza sobre uma régua -----------------------------
    if (marca.indexOf('POS:') === 0) {
      var chavePos = marca.substring(4).trim();
      var fPos = Math.max(0, Math.min(1, fracaoBarra_(chavePos, k, tags)));
      var descPos = '';
      try { descPos = el.getDescription() || ''; } catch (e4) {}
      var mt = descPos.match(/TRACK=([0-9.]+),([0-9.]+)/);
      if (mt) {
        var trackL = Number(mt[1]), trackW = Number(mt[2]);
        try { el.setLeft(trackL + trackW * fPos - el.getWidth() / 2); } catch (e5) {}
      }
      continue;
    }

    // --- autoajuste de fonte ---------------------------------------------
    if (marca.indexOf('FIT:') === 0) {
      var p = marca.substring(4).split(':');
      var base = Number(p[0]) || 18, lim = Number(p[1]) || 300;
      try {
        var txt = el.asShape().getText();
        var conteudo = txt.asString();
        if (conteudo && conteudo.length > lim) {
          var fator = Math.max(0.62, Math.sqrt(lim / conteudo.length));
          var piso = Math.min(base, 7.5);          // nunca AUMENTAR a fonte
          var novo = Math.max(piso, Math.round(base * fator * 10) / 10);
          txt.getTextStyle().setFontSize(Math.min(base, novo));
        }
      } catch (e3) {}
    }
  }

  remover.forEach(function (el) { try { el.remove(); } catch (e) {} });
}

/** Guarda a largura original da barra na descrição do elemento. */
function larguraMaxima_(el) {
  var desc = '';
  try { desc = el.getDescription() || ''; } catch (e) {}
  var m = desc.match(/MAXW=([0-9.]+)/);
  if (m) return Number(m[1]);
  var w = el.getWidth();
  try { el.setDescription((desc ? desc + ' ' : '') + 'MAXW=' + w); } catch (e2) {}
  return w;
}

function fracaoBarra_(chave, k, tags) {
  // barras de lista: REC_n / DESP_n  -> usa o % da própria linha
  var m = chave.match(/^(REC|DESP)_(\d+)$/);
  if (m) {
    var lista = (m[1] === 'REC') ? k.lista_receita : k.lista_despesa;
    var idx = Number(m[2]) - 1;
    if (!lista[idx]) return 0;
    // normaliza pelo MAIOR percentual da lista — a linha "Outras contas" é
    // acrescentada no fim e pode ser a maior de todas
    var maior = 0;
    for (var z = 0; z < lista.length; z++) if (lista[z].pct > maior) maior = lista[z].pct;
    return maior > 0 ? (lista[idx].pct / maior) : 0;
  }
  // barras do slide de diagnóstico -> proporção sobre a receita
  var base = k.receita_total || 1;
  switch (chave) {
    case 'DIAG_RECEITA'  : return 1;
    case 'DIAG_PESSOAL'  : return k.bloco_pessoal / base;
    case 'DIAG_OCUPACAO' : return k.bloco_ocupacao / base;
    case 'DIAG_DEMAIS'   : return k.bloco_demais / base;
    case 'DIAG_RESULTADO': return Math.abs(k.resultado) / base;
    case 'SAUDE_ESCALA'  : return escalaSaude_(tags['CLASSIFICACAO_GERAL']);
    default: return 1;
  }
}

function escalaSaude_(classificacao) {
  // centro de cada uma das 5 faixas da régua (largura 122 + intervalo 9)
  var mapa = { 'excelente': 0.0944, 'boa': 0.2972, 'regular': 0.5000,
               'preocupante': 0.7028, 'critica': 0.9056 };
  return mapa[normalizar_(classificacao)] !== undefined ? mapa[normalizar_(classificacao)] : 0.5;
}

/** Texto de ajuda do menu ▸ Utilidades ▸ Listar tags. */
function listarTagsSuportadas_() {
  var exemplo = montarTags_(
    normalizarExtracao_({ empresa: { nome: 'EXEMPLO', meses_no_periodo: 7 } }),
    calcularIndicadores_(normalizarExtracao_({ empresa: { meses_no_periodo: 7 } })),
    normalizarAnalise_({}),
    null
  );
  return Object.keys(exemplo).sort().map(function (t) { return '{{' + t + '}}'; }).join('\n');
}
