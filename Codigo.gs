/**
 * ============================================================
 *  VERSÃO ANTERIOR (OCR.space) — DESATIVADA EM 10/09/2026
 * ============================================================
 *  Substituída pelos arquivos 00_Config … 09_TemplateBuilder,
 *  que leem os PDFs direto pela API do Gemini.
 *
 *  O código abaixo NÃO foi apagado: está apenas comentado, para
 *  não conflitar com as funções de mesmo nome do sistema novo
 *  (onOpen, pct_, getTemplateId_, parseDataBr_).
 *
 *  Para reativar: selecione tudo daqui para baixo e use
 *  Ctrl + / (alterna comentário de linha).
 * ============================================================
 */
// /**
//  * Exemplo — Gerador de Apresentação "Análise de Resultados" + Import automático do Domínio
//  * VERSÃO 3 — OCR.space (gratuito, sem cartão de crédito), com aviso automático quando um PDF
//  * ultrapassa o limite do plano grátis (em vez de perder dados calado).
//  *
//  * LEIA ANTES DE USAR — resultado do teste que fiz nos 2 PDFs de exemplo da pasta:
//  * 1) OCR.space free: até 500 chamadas/dia, 25.000/mês, sem cartão — confirmado.
//  * 2) `isTable=true` + Motor 2 existem no plano grátis e ajudam a manter as colunas alinhadas —
//  *    confirmado.
//  * 3) IMPORTANTE: o plano grátis do OCR.space lê no máximo 3 páginas e 1 MB por PDF. O Balancete
//  *    de teste "EMPRESA EXEMPLO 174" tem 5 páginas — no plano grátis, as 2 últimas páginas (onde
//  *    fica o "RESUMO DO BALANCETE": Ativo, Passivo, Patrimônio Líquido) NÃO seriam lidas. Isso não é
//  *    hipotético: já acontece com uma das 2 empresas testadas, e tende a ser mais comum ainda nas
//  *    empresas maiores da base (o próprio projeto já avisa que hà casos com 100+ fornecedores).
//  * 4) Por isso, esta versão faz uma contagem aproximada de páginas/tamanho ANTES de mandar o PDF pro
//  *    OCR.space. Se o arquivo passar do limite, o import continua (lê o que der, normalmente as
//  *    contas do começo do Balancete) mas grava um AVISO bem visível no Import_Log e na coluna
//  *    OBSERVACOES da empresa — pra ninguém aprovar um relatório com o Ativo/Passivo faltando sem
//  *    perceber. Se isso acontecer com frequência, o caminho é o plano PRO do OCR.space (pago, sem
//  *    limite de página) ou voltar para a versão com Cloud Vision (que já tinha esse encadeamento de
//  *    páginas resolvido, mas exige cartão cadastrado no Google Cloud).
//  */
//
// var CONFIG_SHEET = 'Instruções';
// var CONFIG_CELL_SLIDES = 'B21';
// var CONFIG_CELL_FOLDER = 'B24';
// var CONFIG_CELL_OCR = 'B27'; // Chave do OCR.space
// var DATA_SHEET = 'Dados_Periodo';
// var CADASTRO_SHEET = 'Cadastro';
// var LOG_SHEET = 'Import_Log';
// var NARRATIVE_PREFIXES = ['NARRATIVA_', 'FORTE', 'MELHORIA', 'RECOMENDACAO', 'RESUMO_FINAL', 'TITULO_'];
// var NAO_SUBSTITUIR = ['STATUS', 'LINK_APRESENTACAO', 'DATA_GERACAO', 'OBSERVACOES', 'CODIGO_DOMINIO',
//   'EMPRESA_CADASTRO', 'CNPJ_CADASTRO'];
//
// var MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
//   'outubro', 'novembro', 'dezembro'];
//
// var DRE_HEADER_LABELS = [
//   'RECEITA BRUTA', 'DEDUÇÕES DA RECEITA BRUTA', 'RECEITA LÍQUIDA', 'LUCRO BRUTO', 'DESPESAS OPERACIONAIS',
//   'DESPESAS ADMINISTRATIVAS', 'DESPESAS COM PESSOAL', 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES', 'DESPESAS GERAIS',
//   'DESPESAS FINANCEIRAS', 'RECEITAS FINANCEIRAS', 'RECEITA FINANCEIRA', 'OUTRAS RECEITAS OPERACIONAIS',
//   'RECEITAS DIVERSAS', 'RESULTADO OPERACIONAL', 'DESPESAS NÃO OPERACIONAIS', 'RESULTADO ANTES DO IR E CSL',
//   'LUCRO LÍQUIDO DO EXERCÍCIO', 'PREJUÍZO DO EXERCÍCIO', 'RESULTADO DO EXERCÍCIO', 'DESCRIÇÃO'
// ];
//
// // Limites do plano GRÁTIS do OCR.space (confirmados em ocr.space/ocrapi). Passar disso não trava o
// // import, só liga o aviso em vez de falhar calado.
// var OCR_SPACE_LIMITE_PAGINAS_GRATIS = 3;
// var OCR_SPACE_LIMITE_BYTES_GRATIS = 1024 * 1024; // 1 MB
//
// var PNG_TESTE_1PX_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
//
// function onOpen() {
//   SpreadsheetApp.getUi()
//     .createMenu('Exemplo')
//     .addItem('Gerar Apresentação (linha selecionada)', 'generatePresentation')
//     .addItem('Gerar apresentações em lote (status "Dados importados")', 'generatePresentationsBatch')
//     .addSeparator()
//     .addItem('Importar 1 empresa (linha selecionada)', 'importarIndividual')
//     .addItem('Importar em lote (todas as empresas da pasta)', 'importarDaPastaDominio')
//     .addSeparator()
//     .addItem('Gerar prompt para reescrever com IA (opcional, linha selecionada)', 'generatePrompt')
//     .addSeparator()
//     .addSubMenu(SpreadsheetApp.getUi().createMenu('Configuração')
//       .addItem('Configurar (assistente)', 'abrirConfiguracao')
//       .addItem('Testar configuração', 'testarConfiguracaoMenu')
//       .addItem('Atualizar texto da aba Instruções', 'atualizarTextoInstrucoesMenu'))
//     .addToUi();
// }
//
// // ============================== UTIL ==============================
//
// function toNumber_(raw) {
//   if (raw === null || raw === undefined) return null;
//   var s = String(raw).trim();
//   if (!s) return null;
//   var neg = false;
//   if (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') { neg = true; s = s.slice(1, -1); }
//   var last = s.slice(-1);
//   if (last === 'D' || last === 'C') { s = s.slice(0, -1); }
//   s = s.trim().replace(/\./g, '').replace(',', '.');
//   var n = parseFloat(s);
//   return isNaN(n) ? null : (neg ? -n : n);
// }
//
// function brl_(v) {
//   if (v === null || v === undefined || isNaN(v)) return '';
//   var s = Math.abs(v).toFixed(2);
//   var parts = s.split('.');
//   return 'R$ ' + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + parts[1];
// }
//
// function milFmt_(v) {
//   if (v === null || v === undefined || isNaN(v)) return '';
//   return 'R$ ' + (Math.abs(v) / 1000).toFixed(1).replace('.', ',') + ' mil';
// }
//
// function pct_(v) { return (v === null || v === undefined || isNaN(v)) ? '' : v.toFixed(1).replace('.', ',') + '%'; }
// function normalizeCnpj_(raw) { return raw ? String(raw).replace(/\D/g, '') : ''; }
// function capitalize_(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
//
// function parseDataBr_(s) {
//   var m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
//   return m ? { d: parseInt(m[1], 10), m: parseInt(m[2], 10), y: parseInt(m[3], 10) } : null;
// }
//
// function formatPeriodoLabel_(inicioStr, fimStr) {
//   var ini = parseDataBr_(inicioStr), fim = parseDataBr_(fimStr);
//   if (!ini || !fim) return '';
//   var mesIni = capitalize_(MESES_PT[ini.m - 1]), mesFim = MESES_PT[fim.m - 1];
//   return (ini.y === fim.y) ? mesIni + ' a ' + mesFim + ' de ' + fim.y : mesIni + ' de ' + ini.y + ' a ' + mesFim + ' de ' + fim.y;
// }
//
// function diaAnterior_(dataStr) {
//   var d = parseDataBr_(dataStr);
//   if (!d) return '';
//   var dt = new Date(d.y, d.m - 1, d.d);
//   dt.setDate(dt.getDate() - 1);
//   return ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + dt.getFullYear();
// }
//
// function mesesNoPeriodo_(inicioStr, fimStr) {
//   var ini = parseDataBr_(inicioStr), fim = parseDataBr_(fimStr);
//   return (ini && fim) ? Math.max(1, (fim.y * 12 + fim.m) - (ini.y * 12 + ini.m) + 1) : 1;
// }
//
// function extrairIdDeTextoOuUrl_(texto) {
//   if (!texto) return '';
//   var s = String(texto).trim();
//   var m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
//   return m ? m[1] : s;
// }
//
// // ============================== CONFIG ==============================
//
// function getTemplateId_() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
//   var id = String(ss.getSheetByName(CONFIG_SHEET).getRange(CONFIG_CELL_SLIDES).getValue()).trim();
//   if (!id) throw new Error('Falta configurar o modelo de Slides.');
//   return id;
// }
//
// function getFolderId_() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
//   var id = String(ss.getSheetByName(CONFIG_SHEET).getRange(CONFIG_CELL_FOLDER).getValue()).trim();
//   if (!id) throw new Error('Falta configurar a pasta do Domínio.');
//   return id;
// }
//
// function getOcrApiKey_() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
//   var key = String(ss.getSheetByName(CONFIG_SHEET).getRange(CONFIG_CELL_OCR).getValue()).trim();
//   if (!key) throw new Error('Falta configurar a Chave da API OCR.space.');
//   return key;
// }
//
// function obterConfiguracaoAtual() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
//   var cfg = ss.getSheetByName(CONFIG_SHEET);
//   return {
//     slidesId: cfg ? String(cfg.getRange(CONFIG_CELL_SLIDES).getValue()).trim() : '',
//     folderId: cfg ? String(cfg.getRange(CONFIG_CELL_FOLDER).getValue()).trim() : '',
//     ocrKey: cfg ? String(cfg.getRange(CONFIG_CELL_OCR).getValue()).trim() : ''
//   };
// }
//
// function salvarConfiguracao(dados) {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
//   var cfg = ss.getSheetByName(CONFIG_SHEET);
//   if (!cfg) throw new Error('Aba "' + CONFIG_SHEET + '" não encontrada.');
//   dados = dados || {};
//   if (dados.slidesId) cfg.getRange(CONFIG_CELL_SLIDES).setValue(extrairIdDeTextoOuUrl_(dados.slidesId));
//   if (dados.folderId) cfg.getRange(CONFIG_CELL_FOLDER).setValue(extrairIdDeTextoOuUrl_(dados.folderId));
//   if (dados.ocrKey) cfg.getRange(CONFIG_CELL_OCR).setValue(String(dados.ocrKey).trim());
//   garantirRotulosConfiguracao_();
//   return { ok: true };
// }
//
// function garantirRotulosConfiguracao_() {
//   var cfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
//   if (!cfg) return;
//   var rotulos = [
//     ['A20', 'CONFIGURAÇÃO 1 — ID do modelo de apresentação do Google Slides (abra o .pptx anexo, Arquivo > Salvar como Google Apresentações).'],
//     ['A21', 'ID_MODELO_SLIDES ->'],
//     ['A23', 'CONFIGURAÇÃO 2 — ID (ou link) da pasta do Google Drive com os PDFs de Balancete/DRE.'],
//     ['A24', 'ID_PASTA_DOMINIO ->'],
//     ['A26', 'CONFIGURAÇÃO 3 — Chave gratuita do OCR.space (gere em ocr.space/ocrapi, só com e-mail, sem cartão). Plano grátis lê até 3 páginas e 1 MB por PDF — arquivos maiores geram aviso em vez de falhar calado.'],
//     ['A27', 'CHAVE_API_OCR ->']
//   ];
//   rotulos.forEach(function (par) {
//     var celula = cfg.getRange(par[0]);
//     if (!String(celula.getValue()).trim()) celula.setValue(par[1]);
//   });
// }
//
// function atualizarTextoInstrucoesMenu() {
//   var ui = SpreadsheetApp.getUi();
//   var resp = ui.alert('Atualizar texto da aba Instruções',
//     'Isso substitui o texto explicativo (linhas 1 a 18) pela versão atual do script. As 3 configurações não são alteradas. Continuar?',
//     ui.ButtonSet.YES_NO);
//   if (resp !== ui.Button.YES) return;
//   var cfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
//   var linhas = [
//     ['Relatório de Consultoria Contábil — Planilha de Geração de Apresentações', ''],
//     ['O que é isso', ''],
//     ['Gera o deck "Análise de Resultados" usando os números exportados do Domínio.', ''],
//     ['Antes de usar', ''],
//     ['Rode Exemplo > Configuração > Configurar (uma vez só) e depois Testar configuração.', ''],
//     ['Import automático em lote', ''],
//     ['O script varre a pasta configurada, identifica a empresa pelo CNPJ dentro do PDF, lê o Balancete e a DRE via OCR.space e preenche a linha em Dados_Periodo. Log completo em Import_Log.', ''],
//     ['Revise as linhas com status "Dados importados (revisar)" antes de gerar a apresentação — preste atenção especial em avisos de "PDF grande" no Import_Log.', ''],
//     ['Gerar apresentação', ''],
//     ['Exemplo > Gerar Apresentação (linha selecionada) ou em lote.', ''],
//     ['Textos de leitura/diagnóstico (IA)', ''],
//     ['Exemplo > Gerar prompt para IA monta o texto para colar no Claude/ChatGPT.', ''],
//     ['Limites conhecidos', ''],
//     ['• Liquidez Corrente, Liquidez Imediata e Capital Circulante Líquido não são preenchidos automaticamente.', ''],
//     ['• A Análise Horizontal não é lida pelo import.', ''],
//     ['• O plano grátis do OCR.space lê no máximo 3 páginas e 1 MB por PDF. PDFs maiores (Balancetes de empresas grandes, com muitos fornecedores) podem sair incompletos — o script avisa no Import_Log e na coluna OBSERVACOES quando isso acontece; revise manualmente esses casos ou considere o plano PRO do OCR.space.', ''],
//     ['', '']
//   ];
//   cfg.getRange(1, 1, linhas.length, 2).setValues(linhas);
//   garantirRotulosConfiguracao_();
//   ui.alert('Texto da aba Instruções atualizado.');
// }
//
// // ============================== ASSISTENTE DE CONFIGURAÇÃO (HTML) ==============================
//
// function abrirConfiguracao() {
//   var html = HtmlService.createHtmlOutput(construirHtmlConfiguracao_()).setWidth(520).setHeight(560);
//   SpreadsheetApp.getUi().showModalDialog(html, 'Configuração — Exemplo');
// }
//
// function testarConfiguracaoMenu() {
//   var r = testarConfiguracao();
//   var ui = SpreadsheetApp.getUi();
//   ui.alert('Teste de configuração',
//     '1) Slides: ' + (r.slides.ok ? 'OK' : 'FALHOU') + ' — ' + r.slides.msg + '\n\n' +
//     '2) Pasta: ' + (r.pasta.ok ? 'OK' : 'FALHOU') + ' — ' + r.pasta.msg + '\n\n' +
//     '3) OCR.space: ' + (r.ocr.ok ? 'OK' : 'FALHOU') + ' — ' + r.ocr.msg,
//     ui.ButtonSet.OK);
// }
//
// function testarConfiguracao() {
//   var res = { slides: { ok: false, msg: '' }, pasta: { ok: false, msg: '' }, ocr: { ok: false, msg: '' } };
//   try {
//     var sId = getTemplateId_();
//     res.slides.ok = true; res.slides.msg = 'encontrado: "' + arquivoPorId_(sId).getName() + '"';
//   } catch (e) { res.slides.msg = 'erro: ' + e.message; }
//   try {
//     var pId = getFolderId_();
//     var folder = DriveApp.getFolderById(pId);
//     res.pasta.ok = true; res.pasta.msg = 'pasta "' + folder.getName() + '" acessível';
//   } catch (e) { res.pasta.msg = 'erro: ' + e.message; }
//   try {
//     testarChaveOcrApi_(getOcrApiKey_());
//     res.ocr.ok = true; res.ocr.msg = 'chave está funcionando.';
//   } catch (e) { res.ocr.msg = e.message; }
//   return res;
// }
//
// function construirHtmlConfiguracao_() {
//   return '<!DOCTYPE html><html><head><base target="_top"><style>' +
//     'body{font-family:Arial,sans-serif;font-size:13px;padding:4px 12px}' +
//     'label{display:block;margin-top:14px;font-weight:bold}' +
//     'input[type=text]{width:100%;box-sizing:border-box;padding:6px;margin-top:4px}' +
//     '.ajuda{color:#666;font-size:11px;margin-top:2px}' +
//     '.botoes{margin-top:18px} button{padding:8px 14px;margin-right:8px}' +
//     '#status{margin-top:14px;white-space:pre-wrap;font-size:12px}' +
//     '</style></head><body>' +
//     '<p>Cole abaixo os IDs/links. Deixar em branco mantém o valor atual.</p>' +
//     '<label>Modelo (Google Slides)</label><input type="text" id="slidesId" placeholder="ID ou link">' +
//     '<label>Pasta do Domínio</label><input type="text" id="folderId" placeholder="ID ou link">' +
//     '<label>Chave OCR.space (gratuita)</label><input type="text" id="ocrKey" placeholder="Cole a chave aqui">' +
//     '<div class="ajuda">Chave grátis: <b>ocr.space/ocrapi</b> (só e-mail, sem cartão). Lê até 3 páginas / 1 MB por PDF no plano grátis.</div>' +
//     '<div class="botoes"><button onclick="salvar()">Salvar</button><button onclick="testar()">Testar configuração</button></div>' +
//     '<div id="status">Carregando…</div>' +
//     '<script>' +
//     'google.script.run.withSuccessHandler(function(cfg){' +
//     'document.getElementById("slidesId").value = cfg.slidesId || "";' +
//     'document.getElementById("folderId").value = cfg.folderId || "";' +
//     'document.getElementById("ocrKey").value = cfg.ocrKey || "";' +
//     'document.getElementById("status").textContent = "";' +
//     '}).obterConfiguracaoAtual();' +
//     'function salvar(){ document.getElementById("status").textContent = "Salvando…";' +
//     'google.script.run.withSuccessHandler(function(){document.getElementById("status").textContent = "Salvo.";}).salvarConfiguracao({' +
//     'slidesId: document.getElementById("slidesId").value, folderId: document.getElementById("folderId").value, ocrKey: document.getElementById("ocrKey").value});}' +
//     'function testar(){ salvar(); document.getElementById("status").textContent = "Testando (aguarde)…";' +
//     'google.script.run.withSuccessHandler(function(r){' +
//     'document.getElementById("status").textContent = (r.slides.ok?"✅":"❌")+" Slides: "+r.slides.msg+"\\n"+(r.pasta.ok?"✅":"❌")+" Pasta: "+r.pasta.msg+"\\n"+(r.ocr.ok?"✅":"❌")+" OCR: "+r.ocr.msg;' +
//     '}).testarConfiguracao(); }' +
//     '</script></body></html>';
// }
//
// // ============================== OCR.SPACE — LEITURA DE PDF ==============================
//
// function testarChaveOcrApi_(apiKey) {
//   var payload = { 'apikey': apiKey, 'language': 'por', 'base64Image': 'data:image/png;base64,' + PNG_TESTE_1PX_BASE64 };
//   var response = UrlFetchApp.fetch('https://api.ocr.space/parse/image', { 'method': 'post', 'payload': payload, 'muteHttpExceptions': true });
//   var json = JSON.parse(response.getContentText() || '{}');
//   if (json.IsErroredOnProcessing && json.ErrorMessage && String(json.ErrorMessage[0]).indexOf('API Key') !== -1) {
//     throw new Error('Chave de API do OCR.space inválida.');
//   }
//   return true;
// }
//
// /** Estimativa rápida (sem parser de PDF completo) de quantas páginas o arquivo tem: conta quantos
//  *  objetos "/Type /Page" existem nos bytes do arquivo (funciona bem quando o PDF não comprime a
//  *  árvore de páginas — testado e confirmado nos PDFs do Domínio). Se não achar nada, devolve null
//  *  (não foi possível estimar) em vez de arriscar um número errado. */
// function contarPaginasPdfAproximado_(blob) {
//   try {
//     var texto = blob.getDataAsString('ISO-8859-1');
//     var m = texto.match(/\/Type\s*\/Page(?![A-Za-z])/g);
//     return (m && m.length) ? m.length : null;
//   } catch (e) {
//     return null;
//   }
// }
//
// /** Envia o PDF para o OCR.space (Motor 2, isTable=true, que mantém o alinhamento das colunas).
//  *  Antes de mandar, estima páginas/tamanho: se passar do limite do plano grátis (3 páginas / 1 MB),
//  *  o import continua (lê o que o OCR.space devolver) mas o "aviso" no retorno avisa que o arquivo
//  *  pode ter saído incompleto — os pontos de chamada gravam isso no Import_Log em vez de deixar
//  *  passar batido. */
// function pdfParaTextoEstruturado_(blob, apiKey) {
//   var avisos = [];
//   var tamanhoBytes = blob.getBytes().length;
//   if (tamanhoBytes > OCR_SPACE_LIMITE_BYTES_GRATIS) {
//     avisos.push('arquivo tem ' + (tamanhoBytes / 1024 / 1024).toFixed(1) + ' MB — acima do limite de 1 MB do plano grátis do OCR.space, pode sair incompleto');
//   }
//   var paginasEstimadas = contarPaginasPdfAproximado_(blob);
//   if (paginasEstimadas !== null && paginasEstimadas > OCR_SPACE_LIMITE_PAGINAS_GRATIS) {
//     avisos.push('arquivo tem ~' + paginasEstimadas + ' páginas — o plano grátis do OCR.space só lê as ' +
//       OCR_SPACE_LIMITE_PAGINAS_GRATIS + ' primeiras, o resto (pode incluir o Resumo do Balancete) não será lido');
//   }
//
//   var url = 'https://api.ocr.space/parse/image';
//   var payload = {
//     'apikey': apiKey,
//     'language': 'por',
//     'isTable': 'true',
//     'scale': 'true',
//     'OCREngine': '2',
//     'file': blob
//   };
//   var response = UrlFetchApp.fetch(url, { 'method': 'post', 'payload': payload, 'muteHttpExceptions': true });
//   var code = response.getResponseCode();
//   if (code !== 200) throw new Error('API OCR.space indisponível no momento (HTTP ' + code + ')');
//
//   var json = JSON.parse(response.getContentText());
//   if (json.IsErroredOnProcessing) {
//     var err = json.ErrorMessage ? json.ErrorMessage.join(', ') : 'Erro desconhecido na leitura';
//     throw new Error('Falha no OCR.space: ' + err);
//   }
//
//   var textoCompleto = [];
//   if (json.ParsedResults) {
//     json.ParsedResults.forEach(function (page) {
//       if (page.ParsedText) textoCompleto.push(page.ParsedText);
//     });
//   }
//   return { texto: textoCompleto.join('\n'), aviso: avisos.length ? avisos.join('; ') : '' };
// }
//
// // ============================== PARSERS DOMÍNIO ==============================
//
// function collectPdfFiles_(rootFolder) {
//   var files = [];
//   var it = rootFolder.getFilesByType(MimeType.PDF);
//   while (it.hasNext()) files.push(it.next());
//   var subIt = rootFolder.getFolders();
//   while (subIt.hasNext()) {
//     var sub = subIt.next();
//     var subFiles = sub.getFilesByType(MimeType.PDF);
//     while (subFiles.hasNext()) files.push(subFiles.next());
//   }
//   return files;
// }
//
// function detectTipoArquivo_(nomeArquivo, textoOpcional) {
//   var lower = nomeArquivo.toLowerCase();
//   if (lower.indexOf('análise horizontal') !== -1 || lower.indexOf('analise horizontal') !== -1) return 'ANALISE_HORIZONTAL';
//   if (lower.indexOf('balancete') !== -1) return 'BALANCETE';
//   if (lower.indexOf('d. r. e') !== -1 || lower.indexOf('d.r.e') !== -1 || lower.indexOf('dre') !== -1) return 'DRE';
//   if (textoOpcional) {
//     var t = textoOpcional.toUpperCase();
//     if (t.indexOf('ANÁLISE HORIZONTAL') !== -1 || t.indexOf('ANALISE HORIZONTAL') !== -1) return 'ANALISE_HORIZONTAL';
//     if (t.indexOf('DEMONSTRAÇÃO DO RESULTADO') !== -1 || t.indexOf('DEMONSTRACAO DO RESULTADO') !== -1) return 'DRE';
//     if (t.indexOf('BALANCETE') !== -1) return 'BALANCETE';
//   }
//   return 'DESCONHECIDO';
// }
//
// function parseResumoBalancete_(text) {
//   var out = {};
//   var mCnpj = text.match(/C\.N\.P\.J\.:\s*([\d.\/-]+)/);
//   if (mCnpj) out.cnpj = mCnpj[1];
//   var mPeriodo = text.match(/Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
//   if (mPeriodo) { out.periodoInicio = mPeriodo[1]; out.periodoFim = mPeriodo[2]; }
//
//   var idx = text.indexOf('RESUMO DO BALANCETE');
//   var bloco = idx !== -1 ? text.slice(idx) : text;
//   var linhas = bloco.split('\n');
//
//   var labelMap = {
//     'ATIVO': 'ativoTotal', 'PASSIVO': 'passivoTotal', 'PATRIMÔNIO LÍQUIDO': 'plTotal',
//     'CONTAS DE RESULTADOS - CUSTOS E DESPESAS': 'despesasResumo', 'CONTAS DE RESULTADO - RECEITAS': 'receitasResumo',
//     'RESULTADO DO EXERCÍCIO': 'resultadoExercicio'
//   };
//   linhas.forEach(function (linha) {
//     var l = linha.trim();
//     for (var label in labelMap) {
//       if (l.indexOf(label) === 0) {
//         var nums = l.match(/-?\(?[\d.]+,\d{2}\)?[DC]?/g);
//         if (nums && nums.length) out[labelMap[label]] = toNumber_(nums[nums.length - 1]);
//       }
//     }
//   });
//
//   var mDisp = bloco.match(/\bDISPON[ÍI]VEL\b[^\n]*/i) || text.match(/\bDISPON[ÍI]VEL\b[^\n]*/i);
//   if (mDisp) {
//     var numsDisp = mDisp[0].match(/-?\(?[\d.]+,\d{2}\)?[DC]?/g);
//     if (numsDisp && numsDisp.length >= 4) {
//       out.disponivelAnterior = toNumber_(numsDisp[0]);
//       out.disponivelAtual = toNumber_(numsDisp[numsDisp.length - 1]);
//     }
//   }
//   return out;
// }
//
// function parseDRE_(text) {
//   var out = { despesaItems: [], receitaItems: [] };
//   var mCnpj = text.match(/C\.N\.P\.J\.:\s*([\d.\/-]+)/);
//   if (mCnpj) out.cnpj = mCnpj[1];
//   var mPeriodo = text.match(/Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
//   if (mPeriodo) { out.periodoInicio = mPeriodo[1]; out.periodoFim = mPeriodo[2]; }
//
//   var moneyRe = /\(?-?[\d.]+,\d{2}\)?/;
//   var linhas = text.split('\n');
//   linhas.forEach(function (linha) {
//     var l = linha.trim();
//     if (!l) return;
//     var m = l.match(moneyRe);
//     if (!m) return;
//     var desc = l.slice(0, m.index).trim();
//     if (!desc) return;
//     var isHeader = DRE_HEADER_LABELS.some(function (h) { return desc.toUpperCase().indexOf(h) === 0; });
//     if (isHeader) return;
//     var value = toNumber_(m[0]);
//     if (value === null) return;
//     if (value < 0) out.despesaItems.push({ nome: capitalize_(desc.toLowerCase()), valor: Math.abs(value) });
//     else if (value > 0) out.receitaItems.push({ nome: capitalize_(desc.toLowerCase()), valor: value });
//   });
//
//   out.despesaTotalDre = out.despesaItems.reduce(function (s, it) { return s + it.valor; }, 0);
//   out.receitaTotalDre = out.receitaItems.reduce(function (s, it) { return s + it.valor; }, 0);
//
//   var mResultado = text.match(/(LUCRO L[ÍI]QUIDO DO EXERC[ÍI]CIO|PREJU[ÍI]ZO DO EXERC[ÍI]CIO)\s*([\d.,()-]+)/);
//   if (mResultado) {
//     var v = toNumber_(mResultado[2]);
//     out.resultadoDre = mResultado[1].toUpperCase().indexOf('PREJU') === 0 ? -Math.abs(v) : Math.abs(v);
//   }
//   return out;
// }
//
// function agruparTopN_(items, n, nomeOutras) {
//   var sorted = items.slice().sort(function (a, b) { return b.valor - a.valor; });
//   var top = sorted.slice(0, n - 1);
//   var resto = sorted.slice(n - 1);
//   var restoSoma = resto.reduce(function (s, it) { return s + it.valor; }, 0);
//   if (restoSoma > 0) top.push({ nome: nomeOutras, valor: restoSoma });
//   return top;
// }
//
// function buildParsedData_(files) {
//   var parsed = {};
//   if (files.balancete) { var b = parseResumoBalancete_(files.balancete); for (var k in b) parsed[k] = b[k]; }
//   if (files.dre) { var d = parseDRE_(files.dre); for (var k2 in d) parsed[k2] = d[k2]; }
//   parsed._hasBalancete = !!files.balancete;
//   parsed._hasDre = !!files.dre;
//   parsed._avisos = [];
//   if (files.balanceteAviso) parsed._avisos.push('Balancete: ' + files.balanceteAviso);
//   if (files.dreAviso) parsed._avisos.push('DRE: ' + files.dreAviso);
//   return parsed;
// }
//
// function applyParsedToRow_(sheet, rowIndex, headers, parsed) {
//   var out = {};
//   var periodoInicio = parsed.periodoInicio, periodoFim = parsed.periodoFim;
//   if (periodoInicio && periodoFim) out.PERIODO_LABEL = formatPeriodoLabel_(periodoInicio, periodoFim);
//   var meses = (periodoInicio && periodoFim) ? mesesNoPeriodo_(periodoInicio, periodoFim) : 1;
//
//   var receitaTotal = parsed._hasDre ? parsed.receitaTotalDre : parsed.receitasResumo;
//   var despesaTotal = parsed._hasDre ? parsed.despesaTotalDre : parsed.despesasResumo;
//   if (receitaTotal !== undefined && receitaTotal !== null) {
//     out.RECEITA_TOTAL = milFmt_(receitaTotal);
//     out.RECEITA_MEDIA_MENSAL = milFmt_(receitaTotal / meses);
//     out.RECEITA_TOTAL_DETALHE = brl_(receitaTotal);
//   }
//   if (despesaTotal !== undefined && despesaTotal !== null) {
//     out.DESPESAS_TOTAL = milFmt_(despesaTotal);
//     out.DESPESAS_MEDIA_MENSAL = milFmt_(despesaTotal / meses);
//     out.DESPESAS_TOTAL_DETALHE = brl_(despesaTotal);
//   }
//   var resultado = (parsed.resultadoDre !== undefined) ? parsed.resultadoDre
//     : (parsed.resultadoExercicio !== undefined ? parsed.resultadoExercicio
//       : (receitaTotal !== undefined && despesaTotal !== undefined ? receitaTotal - despesaTotal : undefined));
//   if (resultado !== undefined && resultado !== null) {
//     out.RESULTADO_PERIODO = milFmt_(Math.abs(resultado));
//     out.LABEL_RESULTADO = resultado >= 0 ? 'Superávit do período' : 'Déficit do período';
//     out.RESULTADO_PERIODO_SINAL = (resultado >= 0 ? '+ ' : '− ') + milFmt_(Math.abs(resultado));
//     if (receitaTotal) out.RESULTADO_PCT_RECEITA = pct_(100 * resultado / receitaTotal);
//   }
//
//   var endividamentoPctNum, plAtivoPctNum;
//   if (parsed.ativoTotal) {
//     out.DATA_BALANCO = periodoFim || '';
//     if (parsed.plTotal !== undefined && parsed.passivoTotal !== undefined) {
//       var passivoCirculante = parsed.passivoTotal - parsed.plTotal;
//       endividamentoPctNum = 100 * passivoCirculante / parsed.ativoTotal;
//       plAtivoPctNum = 100 * parsed.plTotal / parsed.ativoTotal;
//       out.ENDIVIDAMENTO_GERAL = pct_(endividamentoPctNum);
//       out.ENDIVIDAMENTO_DETALHE = 'passivo circulante de ' + milFmt_(passivoCirculante) + ' sobre ativo total de ' + milFmt_(parsed.ativoTotal);
//       out.PL_SOBRE_ATIVO = pct_(plAtivoPctNum);
//       out.PL_SOBRE_ATIVO_DETALHE = 'patrimônio líquido de ' + milFmt_(parsed.plTotal);
//     }
//     if (resultado !== undefined) out.MARGEM_LIQUIDA_DETALHE = 'retorno sobre o ativo de ' + pct_(100 * resultado / parsed.ativoTotal) + ' no período';
//     out.LIQUIDEZ_CORRENTE_DETALHE = 'Ativo/Passivo circulante não extraídos automaticamente — conferir no Balancete';
//     out.CCL_DETALHE = 'idem';
//   }
//
//   if (parsed.disponivelAtual !== undefined) {
//     out.CAIXA_APLICACOES = milFmt_(parsed.disponivelAtual);
//     out.DISPONIB_FIM_DATA = periodoFim || '';
//     out.DISPONIB_FIM_VALOR = brl_(parsed.disponivelAtual);
//     if (parsed.disponivelAnterior !== undefined && parsed.disponivelAnterior !== 0) {
//       var varPct = 100 * (parsed.disponivelAtual - parsed.disponivelAnterior) / parsed.disponivelAnterior;
//       out.CAIXA_VARIACAO = (varPct >= 0 ? '+' : '') + pct_(varPct) + ' no período';
//       out.DISPONIB_INICIO_VALOR = brl_(parsed.disponivelAnterior);
//       if (periodoInicio) out.DISPONIB_INICIO_DATA = diaAnterior_(periodoInicio);
//     }
//   }
//
//   if (parsed.despesaItems && parsed.despesaItems.length) {
//     var topDesp = agruparTopN_(parsed.despesaItems, 9, 'Outras despesas');
//     var somaDesp = despesaTotal || parsed.despesaTotalDre;
//     topDesp.forEach(function (item, i) {
//       out['DESP' + (i + 1) + '_NOME'] = item.nome;
//       out['DESP' + (i + 1) + '_VALOR_PCT'] = milFmt_(item.valor).replace('R$ ', '') + ' · ' + pct_(100 * item.valor / somaDesp);
//     });
//   }
//   if (parsed.receitaItems && parsed.receitaItems.length) {
//     var topRec = agruparTopN_(parsed.receitaItems, 4, 'Outras receitas');
//     var somaRec = receitaTotal || parsed.receitaTotalDre;
//     topRec.forEach(function (item, i) {
//       out['REC' + (i + 1) + '_NOME'] = item.nome;
//       out['REC' + (i + 1) + '_VALOR_PCT'] = milFmt_(item.valor).replace('R$ ', '') + ' · ' + pct_(100 * item.valor / somaRec);
//     });
//   }
//
//   var narrativa = gerarNarrativaAutomatica_({
//     receitaTotal: receitaTotal, despesaTotal: despesaTotal, resultado: resultado, meses: meses,
//     topDesp: typeof topDesp !== 'undefined' ? topDesp : [], topRec: typeof topRec !== 'undefined' ? topRec : [],
//     endividamentoPct: endividamentoPctNum, plAtivoPct: plAtivoPctNum, caixa: parsed.disponivelAtual
//   });
//   for (var nk in narrativa) out[nk] = narrativa[nk];
//
//   out.STATUS = 'Dados importados (revisar)';
//   var obs = [];
//   if (!parsed._hasBalancete) obs.push('Sem Balancete — indicadores de patrimônio/endividamento não preenchidos.');
//   if (!parsed._hasDre) obs.push('Sem DRE — categorias de receita/despesa não preenchidas.');
//   if (parsed._avisos && parsed._avisos.length) obs.push('ATENÇÃO — ' + parsed._avisos.join(' | ') + '.');
//   obs.push('Liquidez Corrente, Liquidez Imediata e CCL não são calculados automaticamente.');
//   obs.push('Textos de leitura/diagnóstico gerados automaticamente por regras — revise antes de aprovar.');
//   out.OBSERVACOES = obs.join(' ');
//
//   var lastCol = headers.length;
//   var currentValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
//   var newValues = currentValues.slice();
//   for (var i = 0; i < headers.length; i++) {
//     var h = String(headers[i]).trim();
//     if (!out.hasOwnProperty(h) || out[h] === undefined || out[h] === '') continue;
//     var ehNarrativa = NARRATIVE_PREFIXES.some(function (p) { return h.indexOf(p) === 0; });
//     if (ehNarrativa && currentValues[i] !== '' && currentValues[i] !== null && currentValues[i] !== undefined) continue;
//     newValues[i] = out[h];
//   }
//   sheet.getRange(rowIndex, 1, 1, lastCol).setValues([newValues]);
// }
//
// // ============================== NARRATIVA AUTOMÁTICA ==============================
//
// function gerarNarrativaAutomatica_(ctx) {
//   var n = {};
//   var receitaTotal = ctx.receitaTotal, despesaTotal = ctx.despesaTotal, resultado = ctx.resultado;
//   var meses = ctx.meses || 1, topDesp = ctx.topDesp || [], topRec = ctx.topRec || [];
//   var endividamentoPct = ctx.endividamentoPct, plAtivoPct = ctx.plAtivoPct, caixa = ctx.caixa;
//   var despesaMediaMensal = despesaTotal ? despesaTotal / meses : undefined;
//   var mesesReserva = (caixa !== undefined && despesaMediaMensal) ? caixa / despesaMediaMensal : undefined;
//   var superavit = resultado !== undefined && resultado >= 0;
//   var pctReceitaResultado = (resultado !== undefined && receitaTotal) ? 100 * resultado / receitaTotal : undefined;
//
//   n.TITULO_CAPA = 'Análise de Resultados';
//
//   if (resultado !== undefined) {
//     var partesResumo = [];
//     if (endividamentoPct !== undefined) {
//       partesResumo.push(endividamentoPct <= 20 ? 'endividamento baixo (' + pct_(endividamentoPct) + ' do ativo)'
//         : (endividamentoPct <= 40 ? 'endividamento moderado (' + pct_(endividamentoPct) + ' do ativo)'
//           : 'endividamento alto (' + pct_(endividamentoPct) + ' do ativo)'));
//     }
//     partesResumo.push((superavit ? 'superávit' : 'déficit') + ' de ' + milFmt_(Math.abs(resultado)) +
//       (pctReceitaResultado !== undefined ? ' (' + pct_(Math.abs(pctReceitaResultado)) + ' da receita)' : ''));
//     n.NARRATIVA_RESUMO = capitalize_(partesResumo.join(', ')) + '.' +
//       (mesesReserva !== undefined ? ' A reserva em caixa cobre cerca de ' + mesesReserva.toFixed(0) + ' meses de despesa no ritmo atual.' : '');
//   }
//
//   if (topRec.length) {
//     var top1Rec = topRec[0];
//     var shareTop1 = receitaTotal ? 100 * top1Rec.valor / receitaTotal : 0;
//     n.TITULO_RECEITA = shareTop1 >= 70 ? 'Receita Concentrada em ' + top1Rec.nome : 'Receita Diversificada entre Fontes';
//     n.NARRATIVA_RECEITA_1 = top1Rec.nome + ' responde por ' + pct_(shareTop1) + ' da receita (' + milFmt_(top1Rec.valor) + ').';
//     if (topRec[1]) {
//       var shareTop2 = receitaTotal ? 100 * topRec[1].valor / receitaTotal : 0;
//       n.NARRATIVA_RECEITA_2 = topRec[1].nome + ' vem em seguida, com ' + pct_(shareTop2) + ' (' + milFmt_(topRec[1].valor) + ').';
//     }
//     n.NARRATIVA_RECEITA_3 = 'Receita total do período: ' + milFmt_(receitaTotal) +
//       (despesaTotal ? ', ' + pct_(100 * receitaTotal / despesaTotal) + ' das despesas.' : '.');
//   }
//
//   if (topDesp.length) {
//     var top1D = topDesp[0];
//     var shareD1 = receitaTotal ? 100 * top1D.valor / receitaTotal : 0;
//     n.TITULO_DESPESAS = capitalize_((topDesp[1] ? (top1D.nome + ' e ' + topDesp[1].nome) : top1D.nome)) + ' Dominam a Estrutura';
//     n.NARRATIVA_DESPESA_1 = top1D.nome + ' soma ' + milFmt_(top1D.valor) + ', ou ' + pct_(shareD1) + ' da receita do período.';
//     if (topDesp[1]) {
//       var shareD2 = receitaTotal ? 100 * topDesp[1].valor / receitaTotal : 0;
//       n.NARRATIVA_DESPESA_2 = topDesp[1].nome + ' representa ' + milFmt_(topDesp[1].valor) + ' (' + pct_(shareD2) + ' da receita).';
//     }
//   }
//
//   if (resultado !== undefined && receitaTotal && despesaTotal) {
//     n.TITULO_DIAGNOSTICO = superavit ? 'Resultado Positivo no Período' : 'Custo Fixo Consome a Receita';
//     var somaTop2D = topDesp[0] ? topDesp[0].valor + (topDesp[1] ? topDesp[1].valor : 0) : 0;
//     if (somaTop2D) {
//       n.NARRATIVA_DIAGNOSTICO_1 = (topDesp[1] ? (topDesp[0].nome + ' e ' + topDesp[1].nome) : topDesp[0].nome) +
//         ' somam ' + milFmt_(somaTop2D) + ' — contra ' + milFmt_(receitaTotal) + ' de receita.';
//     }
//     n.NARRATIVA_DIAGNOSTICO_2 = superavit
//       ? 'Sobra ' + milFmt_(resultado) + ' no período' + (pctReceitaResultado !== undefined ? ', ' + pct_(Math.abs(pctReceitaResultado)) + ' da receita.' : '.')
//       : 'Falta ' + milFmt_(Math.abs(resultado)) + ' no período (' + milFmt_(Math.abs(resultado) / meses) + ' por mês) para cobrir a estrutura atual.';
//   }
//
//   if (caixa !== undefined) {
//     n.TITULO_CAIXA = mesesReserva !== undefined
//       ? (mesesReserva >= 6 ? 'Reserva Confortável' : (mesesReserva >= 3 ? 'Reserva Moderada' : 'Reserva Apertada'))
//       : 'Posição de Caixa';
//     if (mesesReserva !== undefined) {
//       n.NARRATIVA_CONSUMO_CAIXA = 'Ritmo médio do período. Mantido o padrão atual, a reserva sustenta a operação por cerca de ' +
//         mesesReserva.toFixed(0) + ' meses.';
//     }
//     n.NARRATIVA_SAUDE_FINAL = (mesesReserva !== undefined && mesesReserva >= 6)
//       ? 'Há folga de caixa para os próximos meses, o que dá tempo para corrigir o modelo sem decisão emergencial.'
//       : 'A folga de caixa é limitada — vale acompanhar o consumo mensal de perto.';
//   }
//
//   var fortesCand = [];
//   if (endividamentoPct !== undefined && endividamentoPct <= 20) {
//     fortesCand.push(['Endividamento baixo', 'Passivo de apenas ' + pct_(endividamentoPct) + ' do ativo total.']);
//   }
//   if (mesesReserva !== undefined && mesesReserva >= 6) {
//     fortesCand.push(['Reserva de caixa confortável', milFmt_(caixa) + ' em caixa e aplicações contra despesa média de ' +
//       milFmt_(despesaMediaMensal) + ' ao mês.']);
//   }
//   if (plAtivoPct !== undefined && plAtivoPct >= 50) {
//     fortesCand.push(['Patrimônio líquido sólido', 'Patrimônio líquido representa ' + pct_(plAtivoPct) + ' do ativo total.']);
//   }
//   if (superavit && resultado > 0) {
//     fortesCand.push(['Resultado superavitário', 'Superávit de ' + milFmt_(resultado) + ' no período' +
//       (pctReceitaResultado !== undefined ? ' (' + pct_(Math.abs(pctReceitaResultado)) + ' da receita).' : '.')]);
//   }
//   if (topRec.length >= 3 && receitaTotal && (100 * topRec[0].valor / receitaTotal) < 70) {
//     fortesCand.push(['Receita diversificada', 'Mais de uma fonte relevante de receita, reduzindo dependência de um único cliente/serviço.']);
//   }
//   fortesCand.slice(0, 5).forEach(function (item, i) {
//     n['FORTE' + (i + 1) + '_TITULO'] = item[0];
//     n['FORTE' + (i + 1) + '_TEXTO'] = item[1];
//   });
//
//   var melhoriaCand = [];
//   if (resultado !== undefined && !superavit) {
//     melhoriaCand.push(['Receita não cobre a estrutura', 'Falta ' + milFmt_(Math.abs(resultado)) + ' no período, ou ' +
//       milFmt_(Math.abs(resultado) / meses) + ' ao mês.']);
//   }
//   if (topRec.length && receitaTotal && (100 * topRec[0].valor / receitaTotal) >= 70) {
//     melhoriaCand.push(['Dependência de uma única fonte de receita', topRec[0].nome + ' responde por ' +
//       pct_(100 * topRec[0].valor / receitaTotal) + ' do total — potencial de diversificação pouco explorado.']);
//   }
//   if (topDesp.length && receitaTotal && (100 * topDesp[0].valor / receitaTotal) >= 30) {
//     melhoriaCand.push([capitalize_(topDesp[0].nome) + ' alta para o porte', topDesp[0].nome + ' consome ' +
//       pct_(100 * topDesp[0].valor / receitaTotal) + ' da receita — vale reavaliar contrato/estrutura.']);
//   }
//   if (endividamentoPct !== undefined && endividamentoPct > 40) {
//     melhoriaCand.push(['Endividamento elevado', 'Passivo circulante representa ' + pct_(endividamentoPct) + ' do ativo total.']);
//   }
//   if (mesesReserva !== undefined && mesesReserva < 3) {
//     melhoriaCand.push(['Reserva de caixa apertada', 'No ritmo atual, a reserva cobre cerca de ' + mesesReserva.toFixed(0) + ' meses de despesa.']);
//   }
//   melhoriaCand.slice(0, 5).forEach(function (item, i) {
//     n['MELHORIA' + (i + 1) + '_TITULO'] = item[0];
//     n['MELHORIA' + (i + 1) + '_TEXTO'] = item[1];
//   });
//   melhoriaCand.slice(0, 5).forEach(function (item, i) {
//     n['RECOMENDACAO' + (i + 1)] = 'Endereçar: ' + item[0].toLowerCase() + ' — ' + item[1];
//   });
//
//   if (resultado !== undefined) {
//     n.RESUMO_FINAL_1 = (endividamentoPct !== undefined && endividamentoPct <= 20 ? 'Empresa com endividamento baixo' : 'Empresa') +
//       ', com resultado ' + (superavit ? 'superavitário' : 'deficitário') + ' no período' +
//       (mesesReserva !== undefined && mesesReserva >= 6 ? ', mas com boa folga de caixa.' : '.');
//     n.RESUMO_FINAL_2 = superavit
//       ? 'Resultado positivo de ' + milFmt_(resultado) + ' no período — manter o acompanhamento mensal de receita e despesa.'
//       : 'Fechar a lacuna de ' + milFmt_(Math.abs(resultado) / meses) + ' por mês é o principal ponto de atenção dos próximos meses.';
//   }
//   return n;
// }
//
// // ============================== GERAÇÃO DE APRESENTAÇÃO ==============================
//
// function logImport_(logSheet, arquivo, tipo, empresa, codigo, confianca, status, detalhe) {
//   logSheet.appendRow([new Date(), arquivo, tipo, empresa, codigo, confianca, status, detalhe]);
// }
//
// function getSelectedRowData_() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet(), active = ss.getActiveSheet();
//   if (active.getName() !== DATA_SHEET) throw new Error('Selecione uma linha na aba "' + DATA_SHEET + '".');
//   var sheet = ss.getSheetByName(DATA_SHEET), rowIndex = ss.getActiveRange().getRow();
//   if (rowIndex < 2) throw new Error('Selecione uma linha de dados (linha 2 em diante).');
//   return readRow_(sheet, rowIndex);
// }
//
// function readRow_(sheet, rowIndex) {
//   var lastCol = sheet.getLastColumn(), headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
//   var values = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0], data = {};
//   for (var i = 0; i < headers.length; i++) data[String(headers[i]).trim()] = values[i];
//   return { headers: headers, values: values, rowIndex: rowIndex, data: data, sheet: sheet };
// }
//
// function generatePresentation() {
//   var ui = SpreadsheetApp.getUi();
//   try {
//     var row = getSelectedRowData_();
//     var result = generateOne_(row);
//     ui.alert('Apresentação gerada: ' + result.url + (result.missing.length ? '\n\nCampos vazios: ' + result.missing.join(', ') : ''));
//   } catch (e) { ui.alert('Erro: ' + e.message); }
// }
//
// function generatePresentationsBatch() {
//   var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActiveSpreadsheet();
//   var sheet = ss.getSheetByName(DATA_SHEET), lastRow = sheet.getLastRow();
//   var statusCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('STATUS') + 1;
//   var count = 0, errors = 0;
//   for (var r = 2; r <= lastRow; r++) {
//     if (String(sheet.getRange(r, statusCol).getValue()).indexOf('Dados importados') !== 0) continue;
//     try { generateOne_(readRow_(sheet, r)); count++; } catch (e) { errors++; }
//   }
//   ui.alert('Lote concluído: ' + count + ' gerada(s), ' + errors + ' erro(s).');
// }
//
// function generateOne_(row) {
//   var templateFile = arquivoPorId_(getTemplateId_());
//   var empresa = row.data['EMPRESA'] || row.data['EMPRESA_CADASTRO'] || ('linha ' + row.rowIndex);
//   var periodo = row.data['PERIODO_LABEL'] || '';
//   var newFile = templateFile.makeCopy('Análise de Resultados - ' + empresa + (periodo ? ' - ' + periodo : ''));
//   var presentation = SlidesApp.openById(newFile.getId()), missing = [];
//
//   for (var header in row.data) {
//     if (NAO_SUBSTITUIR.indexOf(header) !== -1) continue;
//     var value = row.data[header];
//     if (value === '' || value === null || value === undefined) { missing.push(header); continue; }
//     presentation.replaceAllText('{{' + header + '}}', String(value));
//   }
//   presentation.saveAndClose();
//
//   var url = newFile.getUrl(), headers = row.headers;
//   row.sheet.getRange(row.rowIndex, headers.indexOf('LINK_APRESENTACAO') + 1).setValue(url);
//   row.sheet.getRange(row.rowIndex, headers.indexOf('STATUS') + 1).setValue('Gerada');
//   row.sheet.getRange(row.rowIndex, headers.indexOf('DATA_GERACAO') + 1).setValue(new Date());
//   return { url: url, missing: missing };
// }
//
// function generatePrompt() {
//   var ui = SpreadsheetApp.getUi();
//   try {
//     var row = getSelectedRowData_(), empresa = row.data['EMPRESA'] || row.data['EMPRESA_CADASTRO'] || ('linha ' + row.rowIndex), lines = [];
//     lines.push('Você está escrevendo os textos de diagnóstico do relatório para: ' + empresa + '. Use apenas os dados numéricos abaixo.');
//     lines.push('');
//     lines.push('DADOS NUMÉRICOS PREENCHIDOS:');
//     for (var i = 0; i < row.headers.length; i++) {
//       var h = String(row.headers[i]).trim(), v = row.values[i];
//       if (v === '' || v === null || v === undefined) continue;
//       if (NARRATIVE_PREFIXES.some(function (p) { return h.indexOf(p) === 0; })) continue;
//       lines.push('- ' + h + ': ' + v);
//     }
//     lines.push('');
//     lines.push('CAMPOS DE TEXTO (reescreva mantendo os números, devolva "CAMPO: texto"):');
//     for (var j = 0; j < row.headers.length; j++) {
//       var h2 = String(row.headers[j]).trim(), v2 = row.values[j];
//       if (NARRATIVE_PREFIXES.some(function (p) { return h2.indexOf(p) === 0; })) lines.push('- ' + h2 + (v2 ? ' (atual: ' + v2 + ')' : ' (vazio)'));
//     }
//     var ss = SpreadsheetApp.getActiveSpreadsheet(), out = ss.getSheetByName('Prompt_IA') || ss.insertSheet('Prompt_IA');
//     out.clear(); out.getRange('A1').setValue(lines.join('\n')).setWrap(true);
//     out.setColumnWidth(1, 700); ss.setActiveSheet(out); out.getRange('A1').activate();
//     ui.alert('Prompt gerado na aba "Prompt_IA". Copie, cole na IA e coloque a resposta na aba ' + DATA_SHEET + '.');
//   } catch (e) { ui.alert('Erro: ' + e.message); }
// }
//
// // ============================== IMPORT (LAÇO PRINCIPAL) ==============================
//
// function importarIndividual() {
//   var ui = SpreadsheetApp.getUi();
//   try {
//     var row = getSelectedRowData_(), cnpjAlvo = normalizeCnpj_(row.data['CNPJ_CADASTRO']);
//     if (!cnpjAlvo) throw new Error('A linha selecionada não tem CNPJ_CADASTRO preenchido.');
//
//     var apiKey = getOcrApiKey_(), folder = DriveApp.getFolderById(getFolderId_()), files = collectPdfFiles_(folder);
//     var ss = SpreadsheetApp.getActiveSpreadsheet(), logSheet = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
//     var achados = {}, lidos = 0;
//
//     files.forEach(function (f) {
//       var name = f.getName(), tipo = detectTipoArquivo_(name), resultado;
//       if (tipo === 'ANALISE_HORIZONTAL') return;
//       try {
//         resultado = pdfParaTextoEstruturado_(f.getBlob(), apiKey);
//         if (tipo === 'DESCONHECIDO') tipo = detectTipoArquivo_(name, resultado.texto);
//         if (tipo === 'ANALISE_HORIZONTAL' || tipo === 'DESCONHECIDO') return;
//       } catch (e) {
//         logImport_(logSheet, name, tipo, '', '', '', 'Erro', 'OCR.space: ' + e.message); return;
//       }
//       var mCnpj = resultado.texto.match(/C\.N\.P\.J\.:\s*([\d.\/-]+)/), cnpjNorm = mCnpj ? normalizeCnpj_(mCnpj[1]) : '';
//       if (cnpjNorm !== cnpjAlvo) return;
//       if (tipo === 'BALANCETE') { achados.balancete = resultado.texto; if (resultado.aviso) achados.balanceteAviso = resultado.aviso; }
//       if (tipo === 'DRE') { achados.dre = resultado.texto; if (resultado.aviso) achados.dreAviso = resultado.aviso; }
//       logImport_(logSheet, name, tipo, row.data['EMPRESA_CADASTRO'], row.data['CODIGO_DOMINIO'], 'CNPJ exato',
//         resultado.aviso ? 'Lido (parcial)' : 'Lido', resultado.aviso || '');
//       lidos++;
//     });
//
//     if (!lidos) throw new Error('Nenhum PDF desta empresa (CNPJ ' + row.data['CNPJ_CADASTRO'] + ') foi encontrado na pasta.');
//     applyParsedToRow_(row.sheet, row.rowIndex, row.headers, buildParsedData_(achados));
//     ui.alert('Dados importados para ' + (row.data['EMPRESA_CADASTRO'] || 'linha ' + row.rowIndex) + '. Veja o ' + LOG_SHEET + '.');
//   } catch (e) { ui.alert('Erro: ' + e.message); }
// }
//
// function importarDaPastaDominio() {
//   var ui = SpreadsheetApp.getUi();
//   try {
//     var apiKey = getOcrApiKey_(), folder = DriveApp.getFolderById(getFolderId_()), files = collectPdfFiles_(folder);
//     var ss = SpreadsheetApp.getActiveSpreadsheet(), dataSheet = ss.getSheetByName(DATA_SHEET), logSheet = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
//     var cadastro = ss.getSheetByName(CADASTRO_SHEET), headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
//
//     var cadValues = cadastro.getDataRange().getValues(), cnpjColIdx = cadValues[0].indexOf('CNPJ'), codColIdx = cadValues[0].indexOf('Código Dominio');
//     var cnpjMap = {}; for (var i = 1; i < cadValues.length; i++) { var c = normalizeCnpj_(cadValues[i][cnpjColIdx]); if (c) cnpjMap[c] = cadValues[i][codColIdx]; }
//
//     var dpValues = dataSheet.getDataRange().getValues(), codColIdxDP = headers.indexOf('CODIGO_DOMINIO'), codToRow = {};
//     for (var j = 1; j < dpValues.length; j++) codToRow[String(dpValues[j][codColIdxDP])] = j + 1;
//
//     var byCodigo = {};
//     files.forEach(function (f) {
//       var name = f.getName(), tipo = detectTipoArquivo_(name), resultado;
//       if (tipo === 'ANALISE_HORIZONTAL') { logImport_(logSheet, name, tipo, '', '', '', 'Ignorado', 'Não suportado'); return; }
//       try {
//         resultado = pdfParaTextoEstruturado_(f.getBlob(), apiKey);
//         if (tipo === 'DESCONHECIDO') tipo = detectTipoArquivo_(name, resultado.texto);
//         if (tipo === 'ANALISE_HORIZONTAL' || tipo === 'DESCONHECIDO') {
//           logImport_(logSheet, name, tipo, '', '', '', 'Ignorado', 'Não identificado (nem pelo nome, nem pelo conteúdo)');
//           return;
//         }
//       } catch (e) {
//         logImport_(logSheet, name, tipo, '', '', '', 'Erro', 'OCR.space: ' + e.message); return;
//       }
//       var mCnpj = resultado.texto.match(/C\.N\.P\.J\.:\s*([\d.\/-]+)/), cnpjNorm = mCnpj ? normalizeCnpj_(mCnpj[1]) : '';
//       var codigo = cnpjNorm ? cnpjMap[cnpjNorm] : undefined;
//       if (!codigo) { logImport_(logSheet, name, tipo, '', '', '', 'Não encontrado', 'CNPJ não localizado no Cadastro'); return; }
//
//       if (!byCodigo[codigo]) byCodigo[codigo] = {};
//       if (tipo === 'BALANCETE') { byCodigo[codigo].balancete = resultado.texto; if (resultado.aviso) byCodigo[codigo].balanceteAviso = resultado.aviso; }
//       if (tipo === 'DRE') { byCodigo[codigo].dre = resultado.texto; if (resultado.aviso) byCodigo[codigo].dreAviso = resultado.aviso; }
//       logImport_(logSheet, name, tipo, '', codigo, 'CNPJ exato', resultado.aviso ? 'Lido (parcial)' : 'Lido', resultado.aviso || '');
//     });
//
//     var count = 0, semLinha = 0;
//     for (var codigo in byCodigo) {
//       var rowIdx = codToRow[String(codigo)];
//       if (!rowIdx) { semLinha++; continue; }
//       applyParsedToRow_(dataSheet, rowIdx, headers, buildParsedData_(byCodigo[codigo]));
//       count++;
//     }
//     ui.alert('Import concluído. ' + count + ' empresa(s) atualizada(s)' + (semLinha ? ' (' + semLinha + ' sem linha correspondente).' : '.') +
//       ' Confira também os status "Lido (parcial)" no ' + LOG_SHEET + '.');
//   } catch (e) { ui.alert('Erro: ' + e.message); }
// }
