/**
 * Arquivo: 10_WebApp.gs
 * Camada de WEB APP — publica a interface numa URL para o time da Exemplo.
 *
 * Implantação (Implantar ▸ Nova implantação ▸ App da Web):
 *   Executar como .......... Usuário que acessa o app da Web
 *   Quem pode acessar ...... Qualquer pessoa em exemplo.com.br
 *
 * Nesse modo cada pessoa autoriza com a própria conta, então ela precisa:
 *   - conseguir ABRIR a planilha do Cadastro (leitor já basta);
 *   - ter acesso ao Drive compartilhado "Servidor IA" (editor, para gravar
 *     os relatórios na pasta de saída).
 * A API Key do Gemini NÃO é pessoal: fica nas propriedades do script e vale
 * para todos, configurada por um administrador.
 */

// =====================================================================
// PONTO DE ENTRADA DA URL
// =====================================================================

function doGet(e) {
  if (!podeUsar_()) return paginaSemAcesso_();
  var t = HtmlService.createTemplateFromFile('App');
  t.parametro = (e && e.parameter) ? e.parameter : {};
  return t.evaluate()
    .setTitle('Relatório de Consultoria Contábil · Exemplo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// =====================================================================
// CONTEXTO — quem é o usuário e o que está configurado
// =====================================================================

function apiContexto() {
  var ctx = { ok: true, email: '', admin: false, pendencias: [], config: {} };

  ctx.email = usuarioRealAtual_();
  ctx.admin = ehAdmin_(ctx.email);
  if (!podeUsar_(ctx.email)) {
    return { ok: false, semAcesso: true, email: ctx.email, admin: false,
             pendencias: [], config: {} };
  }

  // API Key
  var k = '';
  try { k = limparValor_(getPropriedade_('GEMINI_API_KEY')) || limparValor_(CONFIG.API_KEY); } catch (e) {}
  ctx.config.apiKey = k ? (k.substring(0, 6) + '••••' + k.slice(-4)) : '';
  if (!k) ctx.pendencias.push('A chave da API do Gemini não está configurada.');

  // Template
  var tpl = '';
  try { tpl = getPropriedade_('TEMPLATE_ID') || CONFIG.TEMPLATE_ID; } catch (e) {}
  ctx.config.templateId = tpl;
  ctx.config.templateUrl = tpl ? ('https://docs.google.com/presentation/d/' + tpl + '/edit') : '';
  if (!tpl) ctx.pendencias.push('O template do Slides (16:9) ainda nao foi criado — sem ele o botao Slides nao funciona.');

  // Template A4 (saida em PDF)
  var tpdf = '';
  try { tpdf = getPropriedade_('TEMPLATE_PDF_ID') || CONFIG.TEMPLATE_PDF_ID; } catch (e) {}
  ctx.config.templatePdfId = tpdf;
  ctx.config.templatePdfUrl = tpdf ? ('https://docs.google.com/presentation/d/' + tpdf + '/edit') : '';
  if (tpdf) {
    try {
      var pp = SlidesApp.openById(tpdf);
      ctx.config.templatePdfDim = Math.round(pp.getPageWidth()) + ' x ' + Math.round(pp.getPageHeight()) + ' pt';
      ctx.config.templatePdfEhA4 = (Math.abs(pp.getPageWidth() - 841.89) < 6 && Math.abs(pp.getPageHeight() - 595.28) < 6);
    } catch (e) { ctx.config.templatePdfDim = 'nao consegui abrir'; }
  } else {
    ctx.pendencias.push('O template A4 ainda nao foi criado — sem ele o botao PDF nao funciona.');
  }

  // Planilha do Cadastro
  try {
    var sh = getPlanilha_().getSheetByName(CONFIG.ABA_CADASTRO);
    if (!sh) throw new Error('aba "' + CONFIG.ABA_CADASTRO + '" não encontrada');
    ctx.config.planilha = getPlanilha_().getName();
    ctx.config.planilhaUrl = getPlanilha_().getUrl();
  } catch (e) {
    ctx.config.planilha = '';
    ctx.pendencias.push('Não consegui abrir a planilha do Cadastro: ' + (e.message || e));
  }

  // Pasta de documentos
  try {
    var p = getPastaDocumentos_();
    ctx.config.pasta = p.getName();
    ctx.config.pastaUrl = p.getUrl();
  } catch (e) {
    ctx.config.pasta = '';
    ctx.pendencias.push('Não consegui abrir a pasta de documentos: ' + (e.message || e));
  }

  ctx.config.modeloExtracao = CONFIG.MODELO_EXTRACAO;
  ctx.config.modeloAnalise = CONFIG.MODELO_ANALISE;
  ctx.config.admins = getAdmins_();
  ctx.config.usuarios = getUsuarios_();
  return ctx;
}

// =====================================================================
// CONFIGURAÇÃO PELA WEB (somente administradores)
// =====================================================================

function apiSalvarConfig(chave, valor) {
  try {
    exigirAdmin_();

    var permitidas = ['GEMINI_API_KEY', 'TEMPLATE_ID', 'PASTA_DOCUMENTOS_ID', 'PASTA_SAIDA_ID', 'PLANILHA_ID', 'ADMINS', 'USUARIOS'];
    if (permitidas.indexOf(chave) < 0) throw new Error('Chave não permitida: ' + chave);

    if (chave === 'ADMINS') {
      var lista = String(valor || '').split(/[\s,;]+/)
        .map(function (x) { return x.trim().toLowerCase(); })
        .filter(function (x) { return /@/.test(x); });
      if (lista.indexOf(usuarioAtual_().toLowerCase()) < 0) lista.push(usuarioAtual_().toLowerCase());
      PropertiesService.getScriptProperties().setProperty('ADMINS', lista.join(','));
      return { ok: true, mensagem: lista.length + ' administrador(es) salvos.', valor: lista.join(', ') };
    }

    var bruto = String(valor == null ? '' : valor);
    var limpo = (chave === 'GEMINI_API_KEY') ? limparValor_(bruto) : extrairId_(bruto);

    if (!limpo) {
      PropertiesService.getScriptProperties().deleteProperty(chave);
      return { ok: true, mensagem: 'Valor apagado.' };
    }
    if (chave === 'GEMINI_API_KEY') {
      if (/^https?:/i.test(limpo)) {
        return { ok: false, erro: 'Isso é o endereço da página, não a chave. Abra aistudio.google.com/apikey, clique em "Criar chave de API" e cole o valor copiado (39 caracteres, começa com AIza).' };
      }
      if (!/^AIza[A-Za-z0-9_\-]{30,}$/.test(limpo)) {
        return { ok: false, erro: 'Formato inválido: o valor tem ' + limpo.length + ' caractere(s) e começa com "' + limpo.substring(0, 4) + '". Uma chave do Gemini tem 39 caracteres e começa com AIza.' };
      }
    }

    PropertiesService.getScriptProperties().setProperty(chave, limpo);
    var extra = (bruto.length !== limpo.length)
      ? ' (' + (bruto.length - limpo.length) + ' caractere(s) invisível(is) removido(s))' : '';
    return { ok: true, mensagem: 'Salvo' + extra + '.' };
  } catch (e) {
    return { ok: false, erro: String(e && e.message ? e.message : e) };
  }
}

/** Diagnóstico da API Key em texto, para exibir na página. */
/**
 * Dispara uma geracao minima em cada modelo da fila para separar duas coisas
 * que o erro 503 confunde: falta de capacidade no Google x peso da nossa
 * requisicao. Se o teste curto passa e o relatorio falha, o problema e o
 * tamanho do pacote de PDFs, nao a API.
 */
/**
 * Mostra o saldo da cota como o Gemini a organiza: por modelo, por dia.
 * Serve para responder a pergunta pratica — da para gerar agora, e em qual modelo?
 */
function apiSaldoCota() {
  exigirUso_();
  try {
    exigirAdmin_();
    var fila = modelosComReserva_(CONFIG.MODELO_EXTRACAO);
    var esgotados = modelosEsgotadosHoje_();
    var L = ['SALDO DA COTA — ' + diaDaCota_() + ' (dia do Pacifico)', ''];

    L.push('A cota diaria do plano gratuito e POR MODELO. Cada linha abaixo tem');
    L.push('saldo proprio, e o sistema desce a fila automaticamente.');
    L.push('');
    fila.forEach(function (nome, i) {
      var fora = esgotados.indexOf(nome) >= 0;
      L.push((fora ? '✕ ' : '✓ ') + (i + 1) + '. ' + nome + (fora ? '  — cota diaria esgotada hoje' : '  — disponivel'));
    });

    var vivos = fila.length - esgotados.length;
    L.push('');
    L.push(vivos > 0
      ? (vivos + ' modelo(s) ainda com saldo. Pode gerar.')
      : 'Todos os modelos esgotados hoje. A cota zera a meia-noite do Pacifico (~5h de Brasilia).');

    // Consumo do ultimo minuto, para explicar esperas que parecem travamento.
    try {
      var bruto = CacheService.getScriptCache().get(CHAVE_CACHE_RPM);
      var marcas = bruto ? JSON.parse(bruto) : [];
      var agora = new Date().getTime();
      marcas = marcas.filter(function (t) { return agora - t < 60000; });
      L.push('');
      L.push('Chamadas no ultimo minuto: ' + marcas.length + ' de ' + CONFIG.RPM_MAX + ' permitidas.');
    } catch (e) {}

    L.push('');
    L.push('Numeros oficiais da sua chave: https://ai.dev/rate-limit');
    return { ok: true, texto: L.join('\n') };
  } catch (e) {
    return { ok: false, erro: String(e && e.message || e) };
  }
}

function apiTestarGeracao() {
  exigirUso_();
  try {
    exigirAdmin_();
    var fila = modelosComReserva_(CONFIG.MODELO_EXTRACAO);
    var L = ['TESTE DE GERACAO — pedido minimo, 1 frase de resposta', ''];
    var algumOk = false;

    for (var i = 0; i < fila.length; i++) {
      var nome = fila[i];
      var url = GEMINI_ENDPOINT + nome + ':generateContent?key=' + encodeURIComponent(getApiKey_());
      var corpo = {
        contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 16 }
      };
      var t0 = new Date().getTime();
      var cod, resumo;
      try {
        var r = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(corpo),
          muteHttpExceptions: true
        });
        cod = r.getResponseCode();
        resumo = (cod === 200) ? 'OK' : r.getContentText().substring(0, 120).replace(/\s+/g, ' ');
      } catch (e) {
        cod = 0;
        resumo = 'falha de rede: ' + e;
      }
      var ms = new Date().getTime() - t0;
      if (cod === 200) algumOk = true;
      L.push((cod === 200 ? '✓ ' : '✕ ') + nome + '  —  HTTP ' + cod + '  (' + ms + ' ms)');
      if (cod !== 200) L.push('    ' + resumo);
    }

    L.push('');
    if (algumOk) {
      L.push('Pelo menos um modelo respondeu a um pedido pequeno.');
      L.push('Se mesmo assim o relatorio der 503, o problema e o TAMANHO do pacote:');
      L.push('muitos PDFs numa chamada so. Gere uma empresa por vez e, se persistir,');
      L.push('me avise para eu quebrar a extracao em uma chamada por documento.');
    } else {
      L.push('Nenhum modelo respondeu nem a um pedido minimo.');
      L.push('Isso e falta de capacidade no lado do Google, nao configuracao daqui.');
      L.push('Nao ha ajuste de codigo que resolva: esperar e tentar de novo.');
    }
    return { ok: true, texto: L.join('\n') };
  } catch (e) {
    return { ok: false, erro: String(e && e.message || e) };
  }
}

function apiDiagnosticoChave() {
  exigirAdmin_();
  try {
    exigirAdmin_();
    var propriedade = getPropriedade_('GEMINI_API_KEY');
    var k = limparValor_(propriedade) || limparValor_(CONFIG.API_KEY);
    var L = [];
    L.push('Origem: ' + (limparValor_(propriedade) ? 'propriedades do script' : (limparValor_(CONFIG.API_KEY) ? '00_Config.gs' : 'nenhuma')));
    L.push('Comprimento: ' + k.length + (k.length === 39 ? ' (ok)' : ' — esperado 39'));
    L.push('Prefixo: ' + (k.substring(0, 6) || '(vazio)') + (k.indexOf('AIza') === 0 ? ' (ok)' : ' — deveria começar com AIza'));
    if (!k) return { ok: false, erro: 'Nenhuma chave configurada.' };

    var resp = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(k),
      { muteHttpExceptions: true });
    var cod = resp.getResponseCode();
    if (cod === 200) {
      var listados = JSON.parse(resp.getContentText()).models || [];
      L.push('Chave VÁLIDA — ' + listados.length + ' modelos disponíveis.');

      // Mostra se os modelos configurados existem para ESTA chave. O Google
      // aposenta modelos e chaves novas nao enxergam os antigos.
      var nomes = listados.map(function (mm) {
        return String(mm.name || '').replace(/^models\//, '');
      });
      var querem = [CONFIG.MODELO_EXTRACAO, CONFIG.MODELO_ANALISE, CONFIG.MODELO_IDENTIFICACAO];
      var vistos = [];
      querem.forEach(function (q) { if (vistos.indexOf(q) < 0) vistos.push(q); });
      L.push('');
      vistos.forEach(function (q) {
        L.push('Modelo ' + q + ': ' + (nomes.indexOf(q) >= 0 ? 'disponível' : 'INDISPONÍVEL — o sistema cai para a reserva'));
      });
      var emUso = getPropriedade_('MODELO_EM_USO');
      if (emUso) L.push('Última substituição automática: ' + emUso);
      var flashes = nomes.filter(function (n) { return /^gemini-[0-9]/.test(n) && /flash|pro/.test(n) && !/lite|embedding|image|tts|live|vision/.test(n); }).sort();
      if (flashes.length) {
        L.push('');
        L.push('Disponíveis para esta chave: ' + flashes.slice(-8).join(', '));
      }
      return { ok: true, texto: L.join('\n') };
    }
    if (cod === 400) L.push('HTTP 400 — a API recusou a chave. Verifique restrição de aplicativo (deve ser "Nenhuma") e se a API Generative Language está ativada.');
    else if (cod === 403) L.push('HTTP 403 — chave reconhecida, mas sem permissão. Verifique se o AI Studio está liberado para o domínio.');
    else L.push('HTTP ' + cod + ' — ' + resp.getContentText().substring(0, 200));
    return { ok: false, erro: L.join('\n') };
  } catch (e) {
    return { ok: false, erro: String(e && e.message ? e.message : e) };
  }
}

/**
 * Monta os 12 slides.
 * @param {string=} alvoId  apresentacao ja existente (usada no A4)
 * @param {string=} chave   TEMPLATE_ID (padrao) ou TEMPLATE_PDF_ID
 */
function apiCriarTemplate(alvoId, chave) {
  exigirAdmin_();
  try {
    exigirAdmin_();
    chave = (chave === 'TEMPLATE_PDF_ID') ? 'TEMPLATE_PDF_ID' : 'TEMPLATE_ID';

    if (chave === 'TEMPLATE_PDF_ID' && !alvoId) {
      return { ok: false, erro:
        'Para o template A4 e preciso informar uma apresentacao existente.\n\n' +
        'O tamanho da pagina de um Google Slides nao pode ser definido por codigo. ' +
        'Crie uma apresentacao em branco, va em Arquivo > Configuracao da pagina > ' +
        'Personalizado, ponha 29,7 x 21 cm, e cole o link dela aqui.' };
    }

    var id = construirTemplate_(alvoId || null, chave);
    var pres = SlidesApp.openById(id);
    var dim = Math.round(pres.getPageWidth()) + ' x ' + Math.round(pres.getPageHeight()) + ' pt';
    var a4 = (Math.abs(pres.getPageWidth() - 841.89) < 6 && Math.abs(pres.getPageHeight() - 595.28) < 6);

    return { ok: true, id: id, dimensao: dim, ehA4: a4,
             url: 'https://docs.google.com/presentation/d/' + id + '/edit' };
  } catch (e) {
    return { ok: false, erro: String(e && e.message ? e.message : e) };
  }
}

function exigirAdmin_() {
  var email = usuarioAtual_();
  if (!ehAdmin_(email)) {
    throw new Error('Só administradores podem alterar a configuração. Você está como ' +
      (email || 'usuário não identificado') + '.');
  }
}

/** Tela para quem abriu a URL mas nao esta na lista de liberados. */
function paginaSemAcesso_() {
  var quem = usuarioRealAtual_() || 'usuario nao identificado';
  var html =
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<div style="font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
    'max-width:520px;margin:12vh auto;padding:0 20px;color:#16281f">' +
    '<h2 style="margin:0 0 10px">Acesso nao liberado</h2>' +
    '<p style="margin:0 0 8px">Voce esta conectado como <b>' + quem + '</b>.</p>' +
    '<p style="margin:0;color:#4b6156">Peca a um administrador do Time de IA para' +
    ' incluir esse e-mail na lista de usuarios do app.</p></div>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Sem acesso · Relatorio de Consultoria Contabil');
}
