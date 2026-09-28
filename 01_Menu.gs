/**
 * Arquivo: 01_Menu.gs
 * Menu customizado da planilha + abertura dos modais.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 Consultoria Contábil')
      .addItem('📥 Importação de Documentos…', 'abrirModalImportacao')
      .addSeparator()
      .addSubMenu(SpreadsheetApp.getUi().createMenu('⚙️ Configurações')
        .addItem('Configurar API Key do Gemini', 'dlgApiKey')
        .addItem('Configurar TEMPLATE_ID', 'dlgTemplateId')
        .addItem('Configurar pasta de documentos', 'dlgPastaDocs')
        .addItem('Configurar pasta de saída', 'dlgPastaSaida')
        .addItem('Ver configuração atual', 'dlgVerConfig'))
      .addSubMenu(SpreadsheetApp.getUi().createMenu('🛠️ Utilidades')
        .addItem('Criar template base (padrão SOGIBA)', 'criarTemplateBase')
        .addItem('Listar tags do template', 'dlgListarTags')
        .addItem('Testar conexão com o Gemini', 'testarGemini')
        .addItem('Diagnosticar API Key', 'diagnosticarApiKey')
        .addItem('Testar acesso à pasta do Drive', 'testarPasta'))
      .addSeparator()
      .addItem('ℹ️ Sobre', 'dlgSobre')
    .addToUi();
}

/** Instalável — use se preferir gatilho manual. */
function instalarMenu() { onOpen(); }

// ---------------------------------------------------------------------
// MODAL PRINCIPAL
// ---------------------------------------------------------------------
function abrirModalImportacao() {
  var t = HtmlService.createTemplateFromFile('Modal');
  var html = t.evaluate().setWidth(1080).setHeight(720).setTitle('Importação de Documentos');
  SpreadsheetApp.getUi().showModalDialog(html, 'Relatório de Consultoria Contábil');
}

/** Permite <?!= include('Arquivo') ?> dentro do HTML. */
function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

// ---------------------------------------------------------------------
// DIÁLOGOS DE CONFIGURAÇÃO
// ---------------------------------------------------------------------
function dlgApiKey() {
  _prompt_('GEMINI_API_KEY',
    'Cole a CHAVE do Gemini — não o endereço do site.\n\n' +
    'A chave tem 39 caracteres e começa com AIza.\n' +
    'Ela é obtida em aistudio.google.com/apikey, no botão\n' +
    '"Criar chave de API" / ícone de copiar.', true);
}
function dlgTemplateId() { _prompt_('TEMPLATE_ID', 'Cole o ID da apresentação-template do Google Slides'); }
function dlgPastaDocs()  { _prompt_('PASTA_DOCUMENTOS_ID', 'Cole o ID da pasta do Drive com os PDFs'); }
function dlgPastaSaida() { _prompt_('PASTA_SAIDA_ID', 'Cole o ID da pasta do Drive onde salvar os relatórios'); }

function _prompt_(chave, msg, mascarar) {
  var ui = SpreadsheetApp.getUi();
  var atual = getPropriedade_(chave);
  var mostrado = mascarar && atual ? atual.substring(0, 6) + '••••••' : atual;
  var r = ui.prompt('Configuração',
    msg + (atual ? '\n\nValor atual: ' + mostrado : '') + '\n\n(deixe vazio para apagar)',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var bruto = r.getResponseText();
  var valor = (chave === 'GEMINI_API_KEY') ? limparValor_(bruto) : extrairId_(bruto);
  PropertiesService.getScriptProperties().setProperty(chave, valor);

  if (!valor) { ui.alert('Valor apagado.'); return; }

  var aviso = '';
  if (bruto.length !== valor.length) {
    aviso = '\n\nForam removidos ' + (bruto.length - valor.length) +
            ' caractere(s) invisivel(is)/espaco(s) da colagem.';
  }
  if (chave === 'GEMINI_API_KEY' && /^https?:/i.test(valor)) {
    PropertiesService.getScriptProperties().deleteProperty(chave);
    ui.alert('Isso e o endereco da pagina, nao a chave',
      'Voce colou:\n' + valor + '\n\n' +
      'Abra esse endereco no navegador. Na pagina, clique em\n' +
      '"Criar chave de API" (ou no botao de copiar ao lado de uma\n' +
      'chave existente) e cole AQUI o valor copiado.\n\n' +
      'A chave tem 39 caracteres e comeca com AIza.\n' +
      'Nada foi gravado.',
      ui.ButtonSet.OK);
    return;
  }
  if (chave === 'GEMINI_API_KEY' && !/^AIza[A-Za-z0-9_\-]{30,}$/.test(valor)) {
    ui.alert('Atencao',
      'Salvo, mas o formato nao parece uma API key do Gemini.\n\n' +
      'Esperado: comeca com "AIza", 39 caracteres.\n' +
      'Gravado : comeca com "' + valor.substring(0, 4) + '", ' + valor.length + ' caracteres.' + aviso,
      ui.ButtonSet.OK);
    return;
  }
  ui.alert('Salvo com sucesso.' + aviso);
}

function dlgVerConfig() {
  var api = getPropriedade_('GEMINI_API_KEY') || CONFIG.API_KEY;
  var msg =
    'API Key ............ ' + (api ? api.substring(0, 6) + '••••••  ✅' : '❌ não configurada') + '\n' +
    'TEMPLATE_ID ........ ' + (getPropriedade_('TEMPLATE_ID') || CONFIG.TEMPLATE_ID || '❌ não configurado') + '\n' +
    'Pasta documentos ... ' + (getPropriedade_('PASTA_DOCUMENTOS_ID') || CONFIG.PASTA_DOCUMENTOS_ID || '(resolver pelo caminho)') + '\n' +
    'Pasta saída ........ ' + (getPropriedade_('PASTA_SAIDA_ID') || CONFIG.PASTA_SAIDA_ID || '(criar automaticamente)') + '\n' +
    'Modelo extração .... ' + CONFIG.MODELO_EXTRACAO + '\n' +
    'Modelo análise ..... ' + CONFIG.MODELO_ANALISE;
  SpreadsheetApp.getUi().alert('Configuração atual', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function dlgSobre() {
  SpreadsheetApp.getUi().alert(
    'Relatório de Consultoria Contábil',
    'Gera automaticamente apresentações de análise de resultados no padrão ' +
    'Exemplo a partir de DRE, Balancete e Análise Horizontal em PDF.\n\n' +
    'Time de IA · Escritório Contábil Exemplo',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function dlgListarTags() {
  SpreadsheetApp.getUi().alert('Tags do template', listarTagsSuportadas_(), SpreadsheetApp.getUi().ButtonSet.OK);
}

function testarGemini() {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = chamarGemini_(CONFIG.MODELO_ANALISE,
      [{ text: 'Responda apenas com a palavra: OK' }], { temperature: 0 }, false);
    ui.alert('Conexão OK', 'Resposta do modelo: ' + String(r).substring(0, 200), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Falha na conexão', String(e), ui.ButtonSet.OK);
  }
}

/**
 * Mostra o que esta realmente gravado como chave, sem expor o valor inteiro,
 * e testa o endpoint mais barato da API (listagem de modelos).
 */
function diagnosticarApiKey() {
  var ui = SpreadsheetApp.getUi();
  var propriedade = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
  var noCodigo = CONFIG.API_KEY || '';
  var k = limparValor_(propriedade) || limparValor_(noCodigo);

  var linhas = [];
  linhas.push('Origem ............ ' + (limparValor_(propriedade) ? 'Configuracoes do script' : (limparValor_(noCodigo) ? '00_Config.gs' : 'NENHUMA')));
  linhas.push('Comprimento ....... ' + k.length + (k.length === 39 ? '  (esperado 39)' : '  <-- esperado 39'));
  linhas.push('Prefixo ........... ' + (k.substring(0, 6) || '(vazio)') + (k.indexOf('AIza') === 0 ? '  ok' : '  <-- deveria comecar com AIza'));
  linhas.push('Ultimos 4 ......... ' + (k.length > 4 ? k.slice(-4) : '-'));
  linhas.push('Caracteres validos  ' + (/^[A-Za-z0-9_\-]*$/.test(k) ? 'sim' : 'NAO — ha simbolo estranho'));
  if (propriedade && propriedade.length !== limparValor_(propriedade).length) {
    linhas.push('AVISO ............. o valor gravado tinha ' + (propriedade.length - limparValor_(propriedade).length) + ' caractere(s) invisivel(is); regrave pelo menu.');
  }

  linhas.push('');
  if (!k) {
    linhas.push('Nenhuma chave configurada.');
    ui.alert('Diagnostico da API Key', linhas.join('\n'), ui.ButtonSet.OK);
    return;
  }

  var resp = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(k),
    { muteHttpExceptions: true });
  var cod = resp.getResponseCode();

  if (cod === 200) {
    var n = (JSON.parse(resp.getContentText()).models || []).length;
    linhas.push('Chave VALIDA. A API respondeu com ' + n + ' modelos disponiveis.');
  } else if (cod === 400) {
    linhas.push('A API recusou a chave (HTTP 400).');
    linhas.push('');
    linhas.push('Causas, da mais comum para a menos:');
    linhas.push('1. A chave tem restricao de aplicativo (referenciador HTTP');
    linhas.push('   ou IP) no Console do Cloud. O Apps Script chama do');
    linhas.push('   servidor, sem referenciador — precisa ser SEM restricao');
    linhas.push('   de aplicativo.');
    linhas.push('2. A chave e de um projeto do Cloud onde a API');
    linhas.push('   "Generative Language" nao esta ativada.');
    linhas.push('3. Foi colada uma chave de outro servico (Maps, Cloud, OAuth).');
    linhas.push('4. A chave foi revogada ou regenerada no AI Studio.');
  } else if (cod === 403) {
    linhas.push('HTTP 403 — chave reconhecida, mas sem permissao.');
    linhas.push('Verifique se a API Generative Language esta ativada no');
    linhas.push('projeto e se a conta @exemplo.com.br pode usar o AI Studio');
    linhas.push('(o admin do Workspace pode bloquear).');
  } else {
    linhas.push('HTTP ' + cod + ' — ' + resp.getContentText().substring(0, 300));
  }

  ui.alert('Diagnostico da API Key', linhas.join('\n'), ui.ButtonSet.OK);
}

function testarPasta() {
  var ui = SpreadsheetApp.getUi();
  try {
    var pasta = getPastaDocumentos_();
    var arqs = listarArquivosPasta_(pasta);
    ui.alert('Pasta acessível',
      'Nome: ' + pasta.getName() + '\nID: ' + pasta.getId() +
      '\nArquivos PDF encontrados: ' + arqs.length, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Falha ao acessar a pasta', String(e), ui.ButtonSet.OK);
  }
}
