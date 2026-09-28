/**
 * Arquivo: 04_Gemini.gs
 * Integração com a API do Gemini.
 *
 * Pipeline em 2 estágios:
 *   ESTÁGIO 1 — EXTRAÇÃO: os PDFs vão direto ao modelo (inlineData) e
 *               voltam como JSON estruturado com os números.
 *   ESTÁGIO 2 — ANÁLISE : o JSON do estágio 1 é reenviado ao modelo, que
 *               atua como consultor contábil sênior e redige as narrativas.
 *
 * Os NÚMEROS que vão para os slides são formatados em Apps Script a partir
 * do JSON do estágio 1 (determinístico). O modelo escreve apenas os TEXTOS.
 */

var GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

// =====================================================================
// CHAMADA HTTP
// =====================================================================

/**
 * @param {string} modelo
 * @param {Array}  partes    partes do content (text / inlineData)
 * @param {Object} genCfg    generationConfig extra
 * @param {boolean} json     exige resposta JSON
 * @return {string} texto da resposta
 */
function chamarGemini_(modelo, partes, genCfg, json) {
  // Fila de modelos: o preferido primeiro, reservas depois. Chaves novas perdem
  // acesso a modelos antigos, entao um 404 aqui nao pode derrubar o relatorio.
  var fila = modelosComReserva_(modelo);
  var iModelo = 0;
  var montarUrl = function () {
    return GEMINI_ENDPOINT + fila[iModelo] + ':generateContent?key=' + encodeURIComponent(getApiKey_());
  };
  var url = montarUrl();

  var cfg = {
    temperature: (genCfg && genCfg.temperature !== undefined) ? genCfg.temperature : 0.3,
    topP: 0.95,
    maxOutputTokens: (genCfg && genCfg.maxOutputTokens) || 32768
  };
  if (json) cfg.responseMimeType = 'application/json';

  // Nos modelos 3.x o "pensamento" do modelo consome o MESMO orcamento de
  // maxOutputTokens que a resposta. Com raciocinio em nivel alto, o JSON pode
  // acabar cortado no meio de uma frase. Aqui o trabalho analitico pesado ja foi
  // feito pelo Apps Script (os numeros chegam prontos), entao 'low' basta e
  // deixa o orcamento inteiro para o texto.
  cfg.thinkingLevel = 'low';
  var ampliouSaida = false;
  var esperaTotalMs = 0;   // quanto desse tempo foi DORMINDO, nao gerando
  var semThinking = false;

  var payload = {
    contents: [{ role: 'user', parts: partes }],
    generationConfig: cfg,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  var ultimoErro = '';
  var inicioChamada = new Date().getTime();
  var falhasNoModelo = 0;
  for (var tent = 1; tent <= CONFIG.TENTATIVAS_GEMINI; tent++) {
    var resp;
    aguardarVagaGemini_();   // segura a chamada dentro da cota antes de sair
    try {
      resp = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    } catch (e) {
      ultimoErro = 'Falha de rede: ' + e;
      Utilities.sleep(2000 * tent);
      continue;
    }

    var cod = resp.getResponseCode();
    var corpo = resp.getContentText();

    if (cod === 429) {
      // Cota estourada. Vale distinguir os dois casos: por minuto passa sozinho,
      // por dia nao adianta insistir — insistir so queima o resto da cota.
      var cota = lerErroDeCota_(corpo);
      if (cota.porDia) {
        // A cota diaria e por MODELO. Esgotar um nao significa esgotar a chave:
        // cada modelo da fila tem saldo proprio. Marca este e tenta o proximo.
        marcarModeloEsgotado_(fila[iModelo]);
        if (iModelo >= fila.length - 1) {
          var extraDia = descobrirModelo_(fila);
          if (extraDia) fila.push(extraDia);
        }
        if (iModelo < fila.length - 1) {
          iModelo++;
          registrarModeloEmUso_(modelo, fila[iModelo]);
          url = montarUrl();
          tent--;
          continue;
        }
        throw new Error(
          'Cota DIARIA do Gemini esgotada em TODOS os modelos disponiveis'
          + (cota.metrica ? ' (' + cota.metrica + ')' : '') + '.\n\n'
          + 'Modelos tentados hoje: ' + fila.join(', ') + '\n\n'
          + 'O limite do plano gratuito e por modelo e zera a meia-noite do horario\n'
          + 'do Pacifico (por volta das 5h de Brasilia).\n'
          + 'Veja o consumo em https://ai.dev/rate-limit\n\n'
          + 'Para gerar ainda hoje, e preciso ativar o faturamento da chave.');
      }
      ultimoErro = 'HTTP 429 no modelo ' + fila[iModelo] + ' — ' + corpo.substring(0, 300);
      if (new Date().getTime() - inicioChamada > 240000) break;
      // O proprio Google diz quanto esperar; respeitamos o valor dele quando vem.
      var pausaCota = cota.esperaMs || Math.max(30000, esperaBackoff_(tent));
      esperaTotalMs += pausaCota;
      Utilities.sleep(pausaCota);
      continue;
    }
    if (cod >= 500) {                                // sobrecarga do lado do Google
      ultimoErro = 'HTTP ' + cod + ' no modelo ' + fila[iModelo] + ' — ' + corpo.substring(0, 300);
      falhasNoModelo++;

      // Sobrecarga costuma atingir UM modelo, nao a API inteira. Trocar de modelo
      // custa zero segundo; dormir custa ate 30. Entao primeiro varremos a fila
      // inteira sem dormir, e so comecamos a esperar quando todos ja recusaram.
      if (iModelo < fila.length - 1) {
        iModelo++;
        falhasNoModelo = 0;
        registrarModeloEmUso_(modelo, fila[iModelo]);
        url = montarUrl();
        tent--;                                      // trocar de modelo nao gasta tentativa
        continue;
      }

      // Fila esgotada: agora sim vale esperar e recomecar do topo.
      if (new Date().getTime() - inicioChamada > 240000) break;
      var pausa = esperaBackoff_(tent);
      esperaTotalMs += pausa;
      Utilities.sleep(pausa);
      iModelo = 0;
      url = montarUrl();
      continue;
    }
    if (cod === 400 && /API_KEY_INVALID|API key not valid/i.test(corpo)) {
      throw new Error(
        'A API do Gemini recusou a chave.\n\n' +
        'O codigo esta funcionando — o problema e a propria chave.\n' +
        'Rode  Utilidades > Diagnosticar API Key  para ver o detalhe.\n\n' +
        'As tres causas mais comuns:\n' +
        '1. A chave tem restricao de aplicativo (referenciador HTTP ou IP)\n' +
        '   no Console do Cloud. O Apps Script chama do servidor, sem\n' +
        '   referenciador: a chave precisa estar SEM restricao de aplicativo.\n' +
        '2. A API "Generative Language" nao esta ativada no projeto do Cloud\n' +
        '   dono da chave.\n' +
        '3. Foi colada uma chave de outro servico, ou ela foi regenerada.'
      );
    }
    if (cod === 404) {
      // Modelo aposentado ou fora do alcance desta chave: desce a fila e refaz
      // a chamada sem consumir uma das tentativas de rede.
      if (iModelo >= fila.length - 1) {
        var achado = descobrirModelo_(fila);
        if (achado) fila.push(achado);
      }
      if (iModelo < fila.length - 1) {
        iModelo++;
        registrarModeloEmUso_(modelo, fila[iModelo]);
        url = montarUrl();
        tent--;
        continue;
      }
      throw new Error('Nenhum modelo do Gemini disponivel para esta chave.\n'
        + 'Tentados: ' + fila.join(', ') + '\n\n' + corpo.substring(0, 600));
    }
    // Nem todo modelo da fila aceita o controle de raciocinio. Se a API reclamar
    // do campo, tiramos ele e repetimos — melhor perder o ajuste fino do que a
    // geracao inteira.
    if (cod === 400 && !semThinking && /thinking/i.test(corpo)) {
      semThinking = true;
      delete cfg.thinkingLevel;
      tent--;
      continue;
    }
    if (cod !== 200) {
      throw new Error('Gemini retornou HTTP ' + cod + ' no modelo ' + fila[iModelo] + ':\n'
        + corpo.substring(0, 800));
    }

    var dados;
    try { dados = JSON.parse(corpo); }
    catch (e2) { throw new Error('Resposta do Gemini não é JSON válido.'); }

    if (dados.promptFeedback && dados.promptFeedback.blockReason) {
      throw new Error('Requisição bloqueada pelo Gemini: ' + dados.promptFeedback.blockReason);
    }
    var cand = dados.candidates && dados.candidates[0];

    // Resposta cortada por limite de tokens. O sintoma que chega ao usuario e
    // "nao foi possivel interpretar o JSON", que aponta para o lugar errado:
    // o JSON esta correto, so nao chegou ao fim. Vale uma tentativa com o dobro
    // de orcamento antes de desistir.
    if (cand && cand.finishReason === 'MAX_TOKENS') {
      if (!ampliouSaida) {
        ampliouSaida = true;
        cfg.maxOutputTokens = Math.min(65536, (cfg.maxOutputTokens || 16384) * 2);
        registrarModeloEmUso_(modelo, fila[iModelo]);
        tent--;
        continue;
      }
      throw new Error(
        'O modelo ' + fila[iModelo] + ' cortou a resposta no limite de tokens,'
        + ' mesmo com ' + cfg.maxOutputTokens + ' de orcamento.\n\n'
        + 'Isso costuma acontecer quando a empresa tem periodo longo e muitas contas.\n'
        + 'Gere o relatorio de um periodo mais curto, ou me avise para eu dividir\n'
        + 'a redacao das analises em duas chamadas.');
    }
    if (!cand) { ultimoErro = 'Resposta sem candidatos.'; Utilities.sleep(2000 * tent); continue; }

    var texto = '';
    var ps = (cand.content && cand.content.parts) || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].text) texto += ps[i].text;

    if (!texto) {
      ultimoErro = 'Resposta vazia (finishReason=' + (cand.finishReason || '?') + ').';
      Utilities.sleep(2000 * tent);
      continue;
    }
    // Deixa registrado quanto do tempo foi espera e quantas voltas foram
    // necessarias. Sem isso, "a analise levou 290s" nao diz se o modelo escreveu
    // devagar ou se ficamos dormindo entre recusas do Google.
    registrarTracoGemini_(fila[iModelo], tent, esperaTotalMs, ampliouSaida);
    return texto;
  }
  // Mensagem final: separa "o Google esta sobrecarregado" de "tem algo errado
  // na configuracao", porque a acao do usuario e completamente diferente.
  if (/HTTP 5\d\d|UNAVAILABLE|high demand|overloaded/i.test(ultimoErro)) {
    throw new Error(
      'O Gemini está sobrecarregado no momento (erro 503 do lado do Google).\n'
      + 'Não é problema da sua chave nem dos documentos — tentei '
      + CONFIG.TENTATIVAS_GEMINI + ' vezes e troquei de modelo pelo caminho.\n\n'
      + 'Espere alguns minutos e clique em Gerar de novo. Se estiver gerando vários\n'
      + 'relatórios de uma vez, gere em lotes menores.\n\n'
      + 'Detalhe técnico: ' + ultimoErro);
  }
  throw new Error('Gemini falhou após ' + CONFIG.TENTATIVAS_GEMINI + ' tentativas.\n' + ultimoErro);
}

/** Extrai o primeiro objeto JSON de um texto (tolera cercas ```json). */
function parseJsonTolerante_(txt) {
  var s = String(txt || '').trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  var ini = s.indexOf('{'), fim = s.lastIndexOf('}');
  if (ini >= 0 && fim > ini) {
    try { return JSON.parse(s.substring(ini, fim + 1)); } catch (e2) {}
  }
  // Um JSON que simplesmente para no meio nao esta malformado — esta incompleto.
  // Dizer "nao consegui interpretar" manda o usuario procurar erro de formato
  // onde o problema e de tamanho.
  var cortado = /[,{:]\s*$|"[^"]*$/.test(s.trim());
  throw new Error(
    (cortado
      ? 'A resposta do modelo foi CORTADA antes do fim — o JSON chegou incompleto.\n'
        + 'Não é erro de formato: faltou orçamento de tokens para terminar o texto.\n'
        + 'Tente gerar de novo; se repetir, o período pode estar longo demais.\n\n'
      : 'Não foi possível interpretar o JSON devolvido pelo modelo.\n')
    + 'Trecho: ' + s.substring(0, 400));
}

/** Converte um arquivo do Drive em parte inlineData. */
function parteArquivo_(fileId) {
  var f = arquivoPorId_(fileId);
  var blob = f.getBlob();
  return {
    inlineData: {
      mimeType: blob.getContentType() || 'application/pdf',
      data: Utilities.base64Encode(blob.getBytes())
    }
  };
}

// =====================================================================
// ESTÁGIO 1 — EXTRAÇÃO DOS PDFs
// =====================================================================

function PROMPT_EXTRACAO_() {
  return [
'Você é um extrator de dados contábeis. Recebe abaixo os PDFs de fechamento',
'de uma empresa/entidade brasileira, emitidos pelo sistema Domínio:',
'DRE do mês, DRE acumulada do exercício, Balancete do mês, Balancete',
'acumulado e Análise Horizontal do DRE.',
'',
'TAREFA: ler TODOS os documentos e devolver EXCLUSIVAMENTE um objeto JSON,',
'sem comentários, sem markdown, sem texto antes ou depois.',
'',
'REGRAS DE LEITURA — obrigatórias:',
'1. Valores entre parênteses são NEGATIVOS. "(308.257,55)" => -308257.55',
'2. Saldos com sufixo "D" são devedores (positivo no ativo/despesa);',
'   com sufixo "C" são credores (positivo no passivo/receita/PL).',
'   Informe SEMPRE o valor absoluto em módulo nos campos de balanço,',
'   e use o sinal apenas nos campos de resultado.',
'3. Formato brasileiro: ponto = milhar, vírgula = decimal. Converta para',
'   número JSON puro (ex.: 308257.55). Nunca devolva string em campo numérico.',
'4. Se um valor não existir no documento, use 0 (zero) — nunca null,',
'   nunca invente, nunca estime.',
'5. Nesses relatórios, contas com natureza de RECEITA aparecem no DRE em',
'   grupos como "RECEITA LÍQUIDA", "RECEITAS FINANCEIRAS", "OUTRAS RECEITAS',
'   OPERACIONAIS". Contas de DESPESA aparecem em "DESPESAS OPERACIONAIS",',
'   "DESPESAS ADMINISTRATIVAS", "DESPESAS NÃO OPERACIONAIS". Classifique',
'   pelo grupo em que a conta está impressa, não pelo nome isolado.',
'6. Em "receitas" e "despesas" liste as contas ANALÍTICAS (as linhas',
'   indentadas de menor nível), não os totais de grupo. Some valores da',
'   mesma conta se ela aparecer repetida. Valores sempre positivos nessas',
'   duas listas (o sinal está implícito na natureza).',
'7. Em "analise_horizontal.linhas" traga APENAS as contas analíticas que',
'   tiveram movimento em pelo menos um mês, com o array de valores mensais',
'   na mesma ordem de "meses". Ignore colunas de meses inteiramente zeradas',
'   no fim do relatório (competências ainda não fechadas).',
'8. "disponibilidades" = caixa + bancos conta movimento + aplicações',
'   financeiras de liquidez imediata.',
'9. "disponibilidades_inicio_periodo" sai da coluna SALDO ANTERIOR do',
'   BALANCETE ACUMULADO (é o saldo na abertura do período), e',
'   "disponibilidades_fim_periodo" da coluna SALDO ATUAL. Some as mesmas',
'   contas da regra 8 nas duas colunas. Esses dois campos são obrigatórios',
'   sempre que o balancete acumulado estiver entre os documentos.',
'10. "meses_no_periodo" é a quantidade de meses entre periodo_inicio e',
'   periodo_fim, contando os dois extremos (01/01 a 31/07 = 7). Campo',
'   obrigatório.',
'',
'FORMATO EXATO DO JSON:',
'{',
'  "empresa": {',
'    "nome": "", "cnpj": "",',
'    "periodo_inicio": "dd/mm/aaaa", "periodo_fim": "dd/mm/aaaa",',
'    "mes_referencia": "mm/aaaa",',
'    "meses_no_periodo": 0',
'  },',
'  "dre_acumulado": {',
'    "receita_total": 0,',
'    "despesa_total": 0,',
'    "resultado_liquido": 0,',
'    "receitas": [{"conta":"","grupo":"","valor":0}],',
'    "despesas": [{"conta":"","grupo":"","valor":0}]',
'  },',
'  "dre_mensal": {',
'    "mes": "mm/aaaa", "receita_total": 0, "despesa_total": 0, "resultado_liquido": 0',
'  },',
'  "analise_horizontal": {',
'    "meses": ["mm/aaaa"],',
'    "linhas": [{"conta":"","grupo":"","natureza":"receita|despesa","valores":[0]}]',
'  },',
'  "balancete": {',
'    "data_base": "dd/mm/aaaa",',
'    "ativo_total": 0, "ativo_circulante": 0,',
'    "caixa": 0, "bancos": 0, "aplicacoes_financeiras": 0, "disponibilidades": 0,',
'    "contas_a_receber": 0, "outros_creditos": 0, "estoques": 0,',
'    "ativo_nao_circulante": 0, "imobilizado_liquido": 0, "intangivel": 0,',
'    "passivo_total": 0, "passivo_circulante": 0,',
'    "fornecedores": 0, "obrigacoes_trabalhistas": 0, "obrigacoes_tributarias": 0,',
'    "emprestimos_curto_prazo": 0, "outras_obrigacoes": 0,',
'    "passivo_nao_circulante": 0, "emprestimos_longo_prazo": 0,',
'    "patrimonio_liquido": 0, "resultado_do_exercicio": 0,',
'    "disponibilidades_inicio_periodo": 0, "disponibilidades_fim_periodo": 0,',
'    "depreciacao_periodo": 0',
'  },',
'  "observacoes_extracao": ["divergências ou faltas encontradas, se houver"]',
'}'
  ].join('\n');
}

/**
 * @param {Array<{id:string,nome:string,tipo:string}>} arquivos
 * @return {Object} JSON extraído
 */
function extrairDadosDosPdfs_(arquivos) {
  // Uma extracao falhada na etapa seguinte fazia o usuario reprocessar tudo —
  // e cada reprocessamento gastava cota de novo. Como o conteudo dos PDFs nao
  // muda, guardamos o resultado por 6h com chave derivada dos proprios arquivos.
  var chaveExtr = 'extr_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
      (arquivos || []).map(function (a) { return a.id; }).sort().join('|')));
  var cacheExtr = null;
  try {
    cacheExtr = CacheService.getScriptCache();
    var pronto = cacheExtr.get(chaveExtr);
    if (pronto) return JSON.parse(pronto);
  } catch (e) { cacheExtr = null; }

  var partes = [{ text: PROMPT_EXTRACAO_() }];

  arquivos.forEach(function (a) {
    partes.push({ text: '\n--- DOCUMENTO: ' + a.nome + '  (tipo identificado: ' + a.tipo + ') ---' });
    partes.push(parteArquivo_(a.id));
  });

  partes.push({ text: '\nDevolva agora o JSON.' });

  var txt = chamarGemini_(CONFIG.MODELO_EXTRACAO, partes, { temperature: 0, maxOutputTokens: 32768 }, true);
  var obj = parseJsonTolerante_(txt);
  var extraido = normalizarExtracao_(obj);
  if (cacheExtr) {
    try {
      var serial = JSON.stringify(extraido);
      // O cache do Apps Script corta em 100KB por chave; nao vale arriscar.
      if (serial.length < 90000) cacheExtr.put(chaveExtr, serial, 21600);
    } catch (e2) {}
  }
  return extraido;
}

/** Garante que todas as chaves existam e sejam do tipo certo. */
function normalizarExtracao_(o) {
  o = o || {};
  var e  = o.empresa   || {};
  var da = o.dre_acumulado || {};
  var dm = o.dre_mensal    || {};
  var ah = o.analise_horizontal || {};
  var b  = o.balancete || {};
  var n  = function (v) { var x = Number(v); return isNaN(x) ? 0 : x; };

  var lista = function (arr) {
    return (arr || []).filter(function (x) { return x && x.conta; }).map(function (x) {
      return { conta: String(x.conta).trim(), grupo: String(x.grupo || '').trim(), valor: Math.abs(n(x.valor)) };
    }).filter(function (x) { return x.valor > 0; })
      .sort(function (p, q) { return q.valor - p.valor; });
  };

  return {
    empresa: {
      nome: String(e.nome || '').trim(),
      cnpj: formatarCnpj_(e.cnpj || ''),
      periodo_inicio: String(e.periodo_inicio || '').trim(),
      periodo_fim: String(e.periodo_fim || '').trim(),
      mes_referencia: String(e.mes_referencia || '').trim(),
      meses_no_periodo: n(e.meses_no_periodo)   // 0 = desconhecido; calculado adiante
    },
    dre_acumulado: {
      receita_total: Math.abs(n(da.receita_total)),
      despesa_total: Math.abs(n(da.despesa_total)),
      resultado_liquido: n(da.resultado_liquido),
      receitas: lista(da.receitas),
      despesas: lista(da.despesas)
    },
    dre_mensal: {
      mes: String(dm.mes || '').trim(),
      receita_total: Math.abs(n(dm.receita_total)),
      despesa_total: Math.abs(n(dm.despesa_total)),
      resultado_liquido: n(dm.resultado_liquido)
    },
    analise_horizontal: {
      meses: (ah.meses || []).map(String),
      linhas: (ah.linhas || []).filter(function (l) { return l && l.conta; }).map(function (l) {
        return {
          conta: String(l.conta).trim(),
          grupo: String(l.grupo || '').trim(),
          natureza: (String(l.natureza || '').toLowerCase() === 'receita') ? 'receita' : 'despesa',
          valores: (l.valores || []).map(n)
        };
      })
    },
    balancete: {
      data_base: String(b.data_base || '').trim(),
      ativo_total: Math.abs(n(b.ativo_total)),
      ativo_circulante: Math.abs(n(b.ativo_circulante)),
      caixa: Math.abs(n(b.caixa)),
      bancos: Math.abs(n(b.bancos)),
      aplicacoes_financeiras: Math.abs(n(b.aplicacoes_financeiras)),
      disponibilidades: Math.abs(n(b.disponibilidades)) ||
        (Math.abs(n(b.caixa)) + Math.abs(n(b.bancos)) + Math.abs(n(b.aplicacoes_financeiras))),
      contas_a_receber: Math.abs(n(b.contas_a_receber)),
      outros_creditos: Math.abs(n(b.outros_creditos)),
      estoques: Math.abs(n(b.estoques)),
      ativo_nao_circulante: Math.abs(n(b.ativo_nao_circulante)),
      imobilizado_liquido: Math.abs(n(b.imobilizado_liquido)),
      intangivel: Math.abs(n(b.intangivel)),
      passivo_total: Math.abs(n(b.passivo_total)),
      passivo_circulante: Math.abs(n(b.passivo_circulante)),
      fornecedores: Math.abs(n(b.fornecedores)),
      obrigacoes_trabalhistas: Math.abs(n(b.obrigacoes_trabalhistas)),
      obrigacoes_tributarias: Math.abs(n(b.obrigacoes_tributarias)),
      emprestimos_curto_prazo: Math.abs(n(b.emprestimos_curto_prazo)),
      outras_obrigacoes: Math.abs(n(b.outras_obrigacoes)),
      passivo_nao_circulante: Math.abs(n(b.passivo_nao_circulante)),
      emprestimos_longo_prazo: Math.abs(n(b.emprestimos_longo_prazo)),
      patrimonio_liquido: Math.abs(n(b.patrimonio_liquido)),
      resultado_do_exercicio: n(b.resultado_do_exercicio),
      disponibilidades_inicio_periodo: Math.abs(n(b.disponibilidades_inicio_periodo)),
      disponibilidades_fim_periodo: Math.abs(n(b.disponibilidades_fim_periodo)),
      depreciacao_periodo: Math.abs(n(b.depreciacao_periodo))
    },
    observacoes_extracao: o.observacoes_extracao || []
  };
}

// =====================================================================
// IDENTIFICACAO — de qual empresa e este PDF?
// =====================================================================

/**
 * Le so o cabecalho do documento para descobrir a empresa.
 * Usa o modelo rapido: e uma pergunta barata, nao a analise completa.
 * @return {{nome:string, cnpj:string, cnpjDigitos:string, tipo:string,
 *           periodo_inicio:string, periodo_fim:string}}
 */
function identificarEmpresaNoPdf_(fileId) {
  // Cada PDF nao identificado gasta uma chamada, e sao varios por empresa —
  // e o que mais consome cota aqui. O que a IA le de um arquivo nao muda,
  // entao guardamos por 6h: reprocessar a mesma pasta nao custa nada.
  var cache = null, chaveCache = 'idemp_' + fileId;
  try {
    cache = CacheService.getScriptCache();
    var guardado = cache.get(chaveCache);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { cache = null; }

  var prompt = [
    'Este PDF e um relatorio contabil brasileiro (DRE, Balancete ou Analise',
    'Horizontal), emitido pelo sistema Dominio. No cabecalho da primeira pagina',
    'estao o nome da empresa e o CNPJ.',
    '',
    'Responda SOMENTE com este JSON, sem markdown e sem texto em volta:',
    '{',
    '  "nome": "razao social exatamente como impressa",',
    '  "cnpj": "00.000.000/0000-00",',
    '  "tipo": "DRE Mensal | DRE Acumulado | Balancete Mensal | Balancete Acumulado | Analise Horizontal | Outro",',
    '  "periodo_inicio": "dd/mm/aaaa",',
    '  "periodo_fim": "dd/mm/aaaa"',
    '}',
    '',
    'O CNPJ e o campo MAIS IMPORTANTE. Ele aparece no topo da primeira',
    'pagina, geralmente logo abaixo do nome, rotulado como "C.N.P.J.:" ou',
    '"CNPJ:". Transcreva os 14 digitos exatamente como impressos, incluindo',
    'zeros a esquerda. Se a pontuacao estiver borrada, devolva so os digitos.',
    'Procure o CNPJ em TODAS as paginas antes de desistir.',
    'Se algum campo nao aparecer no documento, devolva string vazia.',
    'Nao invente CNPJ: so transcreva o que estiver impresso.'
  ].join('\n');

  var partes = [{ text: prompt }, parteArquivo_(fileId)];
  var txt = chamarGemini_(CONFIG.MODELO_IDENTIFICACAO, partes,
                          { temperature: 0, maxOutputTokens: 2048 }, true);
  var o = parseJsonTolerante_(txt) || {};
  var d14 = cnpj14_(o.cnpj || '');
  var cnpj = d14 ? formatarCnpj_(d14) : String(o.cnpj || '').trim();
  var achado = {
    nome: String(o.nome || '').trim(),
    cnpj: cnpj,
    cnpjDigitos: d14,
    cnpjRaiz: d14 ? d14.substring(0, 8) : '',
    tipo: String(o.tipo || '').trim(),
    periodo_inicio: String(o.periodo_inicio || '').trim(),
    periodo_fim: String(o.periodo_fim || '').trim()
  };
  // Guarda o que foi lido: o conteudo do PDF nao muda, entao uma segunda
  // passada na mesma pasta nao gasta cota de novo.
  if (cache) { try { cache.put(chaveCache, JSON.stringify(achado), 21600); } catch (e3) {} }
  return achado;
}

// =====================================================================
// ESTÁGIO 2 — ANÁLISE / REDAÇÃO
// =====================================================================

function PROMPT_ANALISE_(nomeEmpresa, periodoExt) {
  return [
'PAPEL',
'Você é consultor contábil sênior da Escritório Contábil Exemplo, escrevendo a',
'apresentação de resultados que será lida pela diretoria de ' + nomeEmpresa + ',',
'referente a ' + periodoExt + '. Quem lê entende do negócio, mas não é contador.',
'',
'MATERIAL',
'Você recebe um JSON com: (a) DRE acumulada e do mês, (b) o Balancete',
'(patrimonial) na data-base, (c) a série mensal da Análise Horizontal conta',
'a conta, e (d) indicadores já calculados. Todos os números já foram',
'conferidos — sua tarefa é INTERPRETAR, não recalcular.',
'',
'MÉTODO DE ANÁLISE — siga nesta ordem:',
'1. Cruze a ANÁLISE HORIZONTAL com o BALANCETE. A variação mensal de uma',
'   conta só vira insight quando explicada pelo que o patrimônio mostra:',
'   um salto em "serviços de terceiros" que aparece como fornecedor em',
'   aberto é diferente de um que já foi pago.',
'2. Avalie o PESO de cada bloco: custo com pessoal (salários, 13º, férias,',
'   INSS, FGTS, benefícios), custo de ocupação (aluguel, condomínio,',
'   energia, água, IPTU), serviços de terceiros e demais. Diga sempre',
'   quanto cada bloco consome da receita, em %.',
'3. Separe o RECORRENTE do EVENTUAL. Uma conta que aparece em um único mês',
'   com valor alto é evento isolado e deve ser nomeada como tal.',
'4. Verifique a SUSTENTABILIDADE: a receita cobre a estrutura? Em quantos',
'   meses a reserva se esgota no ritmo atual? Há concentração de receita?',
'5. Aponte DIVERGÊNCIAS entre documentos quando existirem (ex.: resultado',
'   do balancete diferente do resultado da DRE) — isso é valor entregue.',
'6. Se "saldo_inicial_de_caixa_conhecido" for false, os campos de variação e',
'   consumo de caixa vêm nulos: NÃO afirme que houve consumo, geração ou',
'   queda de caixa. Escreva sobre o saldo na data-base e sobre quantos meses',
'   de despesa ele cobre, e registre em "texto_caixa_1" que o saldo de',
'   abertura não constava dos documentos recebidos.',
'7. Os blocos em "blocos_de_despesa_mutuamente_exclusivos" NÃO se sobrepõem:',
'   somados, dão a despesa total. Não some nada duas vezes.',
'',
'REGRAS DE ESCRITA — obrigatórias:',
'- Português do Brasil, tom técnico, direto e adulto. Sem jargão vazio,',
'  sem "é importante ressaltar", sem "podemos observar que".',
'- TODA afirmação carrega um número do JSON. Frase sem número é frase',
'  cortada. Nunca cite um número que não esteja no JSON.',
'- Valores em reais no formato "R$ 91,5 mil" ou "R$ 154.142,82".',
'  Percentuais com uma casa: "89,5%". Negativos com o sinal "−".',
'- Não use travessão como pontuação decorativa em excesso; no máximo um',
'  por frase.',
'- Nada de recomendação genérica ("reduzir custos"). Cada recomendação',
'  aponta a conta, o valor e o efeito esperado.',
'- Se a entidade for associação/fundação sem fins lucrativos, use',
'  "superávit"/"déficit" em vez de "lucro"/"prejuízo".',
'- Não invente contexto que não está no JSON (não suponha setor, mercado,',
'  concorrência, nem eventos externos).',
'',
'SAÍDA',
'Devolva EXCLUSIVAMENTE um objeto JSON, sem markdown e sem texto extra,',
'exatamente com estas chaves (respeite os limites de caracteres):',
'{',
'  "titulo_receita":       "título do slide de receita, 3 a 7 palavras, afirmativo",',
'  "titulo_despesas":      "idem para despesas",',
'  "titulo_diagnostico":   "idem para o slide de diagnóstico central",',
'  "titulo_caixa":         "idem para o slide de caixa",',
'  "texto_visao_geral":    "1 parágrafo, 280 a 420 caracteres, o retrato do período",',
'  "leitura_receita":      ["3 frases curtas, 110 a 170 caracteres cada"],',
'  "leitura_despesas":     ["3 frases curtas, 110 a 170 caracteres cada"],',
'  "diagnostico_percentual": "o número-síntese do slide central, ex.: 96%",',
'  "diagnostico_legenda":  "legenda em CAIXA ALTA do número acima, até 45 caracteres",',
'  "texto_diagnostico_1":  "1 parágrafo, 180 a 260 caracteres",',
'  "texto_diagnostico_2":  "1 parágrafo, 140 a 260 caracteres",',
'  "texto_balanco":        "1 parágrafo, 300 a 440 caracteres, sobre estrutura patrimonial e liquidez",',
'  "texto_caixa_1":        "1 parágrafo, 120 a 190 caracteres, sobre o consumo/geração mensal de caixa",',
'  "texto_caixa_2":        "1 parágrafo, 120 a 190 caracteres, sobre aplicações e resgates",',
'  "classificacao_geral":  "uma de: Excelente | Boa | Regular | Preocupante | Crítica",',
'  "saude": [',
'    {"dimensao":"LIQUIDEZ","texto":"1 frase, 110 a 190 caracteres, começando pelo veredito"},',
'    {"dimensao":"ENDIVIDAMENTO","texto":""},',
'    {"dimensao":"RENTABILIDADE","texto":""},',
'    {"dimensao":"GERAÇÃO DE CAIXA","texto":""},',
'    {"dimensao":"SUSTENTABILIDADE DO MODELO","texto":""}',
'  ],',
'  "texto_saude":          "1 parágrafo, 180 a 320 caracteres, justificando a classificação geral",',
'  "pontos_positivos":     [{"titulo":"até 55 caracteres","texto":"140 a 240 caracteres"}],',
'  "pontos_atencao":       [{"titulo":"até 55 caracteres","texto":"140 a 240 caracteres"}],',
'  "recomendacoes":        ["ação concreta, 150 a 260 caracteres, com conta, valor e efeito"],',
'  "resumo_titulo":        "1 frase de até 130 caracteres, a conclusão do relatório",',
'  "resumo_texto":         "1 parágrafo, 200 a 340 caracteres, o que fazer a seguir"',
'}',
'',
'Em "pontos_positivos" e "pontos_atencao" devolva exatamente ' + CONFIG.MAX_ITENS_DIAGNOSTICO + ' itens cada.',
'Em "recomendacoes" devolva exatamente ' + CONFIG.MAX_RECOMENDACOES + ' itens.',
'Em "leitura_receita" e "leitura_despesas" devolva exatamente 3 itens.'
  ].join('\n');
}

/**
 * Recorte dos indicadores enviado ao modelo. Só entram grandezas com
 * significado único — os blocos de despesa aqui são MUTUAMENTE EXCLUSIVOS e
 * somam a despesa total, para o modelo não contar o mesmo gasto duas vezes.
 */
function pacoteIndicadores_(k) {
  return {
    meses_no_periodo: k.meses,
    receita_total: k.receita_total,
    despesa_total: k.despesa_total,
    resultado: k.resultado,
    receita_media_mes: k.receita_media_mes,
    despesa_media_mes: k.despesa_media_mes,
    margem_liquida_fracao: k.margem_liquida,
    receita_cobre_da_despesa_fracao: k.cobertura_receita_sobre_despesa,

    blocos_de_despesa_mutuamente_exclusivos: {
      pessoal_e_encargos: k.bloco_pessoal,
      custo_de_ocupacao: k.bloco_ocupacao,
      servicos_de_terceiros: k.bloco_terceiros,
      impostos_e_taxas: k.bloco_tributos,
      despesas_financeiras: k.bloco_financeiro,
      depreciacao_e_amortizacao: k.bloco_depreciacao,
      demais_nao_classificadas: k.bloco_nao_classificado
    },
    custo_fixo_pessoal_mais_ocupacao: k.custo_fixo,
    custo_fixo_sobre_receita_fracao: k.custo_fixo_sobre_receita,
    pessoal_sobre_receita_fracao: k.pessoal_sobre_receita,
    ocupacao_sobre_receita_fracao: k.ocupacao_sobre_receita,

    ativo_total: k.ativo_total,
    ativo_circulante: k.ativo_circulante,
    passivo_circulante: k.passivo_circulante,
    passivo_nao_circulante: k.passivo_nao_circulante,
    patrimonio_liquido: k.patrimonio_liquido,
    emprestimos_totais: k.emprestimos,
    liquidez_corrente: k.liquidez_corrente,
    liquidez_imediata: k.liquidez_imediata,
    capital_circulante_liquido: k.capital_circulante_liquido,
    endividamento_geral_fracao: k.endividamento_geral,
    pl_sobre_ativo_fracao: k.pl_sobre_ativo,
    roa_fracao: k.roa,

    disponibilidades_na_data_base: k.disponibilidades,
    saldo_inicial_de_caixa_conhecido: k.caixa_inicio_conhecido,
    disponibilidades_no_inicio: k.caixa_inicio_conhecido ? k.disponibilidades_inicio : null,
    variacao_de_caixa: k.caixa_inicio_conhecido ? k.variacao_caixa : null,
    consumo_ou_geracao_mensal_de_caixa: k.caixa_inicio_conhecido ? k.consumo_mensal_caixa : null,
    meses_de_reserva_ao_ritmo_de_despesa: k.meses_reserva,

    concentracao_da_maior_receita_fracao: k.concentracao_receita,
    principal_fonte_de_receita: k.principal_fonte_receita,
    divergencia_resultado_balancete_menos_dre: k.divergencia_dre_balancete,
    ranking_receitas: k.lista_receita,
    ranking_despesas: k.lista_despesa,
    serie_mensal_receita_despesa: k.serie_mensal
  };
}

function gerarAnalise_(dados, indicadores, nomeEmpresa, periodoExt) {
  var pacote = {
    empresa: dados.empresa,
    dre_acumulado: {
      receita_total: dados.dre_acumulado.receita_total,
      despesa_total: dados.dre_acumulado.despesa_total,
      resultado_liquido: dados.dre_acumulado.resultado_liquido,
      receitas: dados.dre_acumulado.receitas.slice(0, 20),
      despesas: dados.dre_acumulado.despesas.slice(0, 30)
    },
    dre_mensal: dados.dre_mensal,
    balancete: dados.balancete,
    analise_horizontal: {
      meses: dados.analise_horizontal.meses,
      linhas: dados.analise_horizontal.linhas.slice(0, 40)
    },
    indicadores: pacoteIndicadores_(indicadores),
    observacoes_extracao: dados.observacoes_extracao
  };

  var partes = [
    { text: PROMPT_ANALISE_(nomeEmpresa, periodoExt) },
    { text: '\n\nJSON COM OS DADOS:\n' + JSON.stringify(pacote) },
    { text: '\n\nDevolva agora o JSON da análise.' }
  ];

  var txt = chamarGemini_(CONFIG.MODELO_ANALISE, partes, { temperature: 0.35, maxOutputTokens: 32768 }, true);
  return normalizarAnalise_(parseJsonTolerante_(txt));
}

function normalizarAnalise_(a) {
  a = a || {};
  var s = function (v, padrao) { var t = String(v == null ? '' : v).trim(); return t || (padrao || ''); };
  var arr = function (v, n, mapa) {
    var l = Array.isArray(v) ? v.slice(0, n) : [];
    return mapa ? l.map(mapa) : l.map(function (x) { return s(x); });
  };

  return {
    titulo_receita:     s(a.titulo_receita, 'Composição da Receita'),
    titulo_despesas:    s(a.titulo_despesas, 'Onde o Dinheiro é Aplicado'),
    titulo_diagnostico: s(a.titulo_diagnostico, 'Diagnóstico do Período'),
    titulo_caixa:       s(a.titulo_caixa, 'Movimentação de Caixa'),
    texto_visao_geral:  s(a.texto_visao_geral),
    leitura_receita:    arr(a.leitura_receita, 3),
    leitura_despesas:   arr(a.leitura_despesas, 3),
    diagnostico_percentual: s(a.diagnostico_percentual),
    diagnostico_legenda: s(a.diagnostico_legenda).toUpperCase(),
    texto_diagnostico_1: s(a.texto_diagnostico_1),
    texto_diagnostico_2: s(a.texto_diagnostico_2),
    texto_balanco:      s(a.texto_balanco),
    texto_caixa_1:      s(a.texto_caixa_1),
    texto_caixa_2:      s(a.texto_caixa_2),
    classificacao_geral: s(a.classificacao_geral, 'Regular'),
    saude: arr(a.saude, 5, function (x) {
      return { dimensao: s(x && x.dimensao).toUpperCase(), texto: s(x && x.texto) };
    }),
    texto_saude:        s(a.texto_saude),
    pontos_positivos:   arr(a.pontos_positivos, CONFIG.MAX_ITENS_DIAGNOSTICO, function (x) {
      return { titulo: s(x && x.titulo), texto: s(x && x.texto) };
    }),
    pontos_atencao:     arr(a.pontos_atencao, CONFIG.MAX_ITENS_DIAGNOSTICO, function (x) {
      return { titulo: s(x && x.titulo), texto: s(x && x.texto) };
    }),
    recomendacoes:      arr(a.recomendacoes, CONFIG.MAX_RECOMENDACOES),
    resumo_titulo:      s(a.resumo_titulo),
    resumo_texto:       s(a.resumo_texto)
  };
}
