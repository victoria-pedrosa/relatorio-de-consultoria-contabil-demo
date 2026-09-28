/**
 * Arquivo: 09_TemplateBuilder.gs
 * Gera do zero a apresentação-template no padrão SOGIBA / Exemplo,
 * com todas as tags {{...}} e as marcações BAR: / ROW: / FIT: já
 * aplicadas no texto alternativo de cada objeto.
 *
 * Rode UMA VEZ pelo menu:
 *   Consultoria Contábil ▸ Utilidades ▸ Criar template base (padrão SOGIBA)
 * e cole o ID gerado em CONFIG.TEMPLATE_ID.
 *
 * Medidas: o Google Slides usa 720 x 405 pt (10 x 5,625 pol, 16:9).
 * O deck SOGIBA original é 20 x 11,25 pol — mesma proporção, escala 2x.
 * Todas as posições e corpos de fonte aqui são o original dividido por 2.
 */

// Grade de DESENHO: todas as posicoes deste arquivo sao escritas nestas
// medidas (720 x 405 pt = 10 x 5,625 pol). Na hora de desenhar, T_ e R_
// convertem para o tamanho REAL da apresentacao, entao o mesmo codigo
// serve tanto para 16:9 quanto para A4 paisagem (841,89 x 595,28 pt).
var SL = { W: 720, H: 405, M: 37, CW: 646, FX: 1, FY: 1, FF: 1 };

/** Le o tamanho real da apresentacao e calcula os fatores de escala. */
function ajustarGrade_(pres) {
  var w = pres.getPageWidth(), h = pres.getPageHeight();
  SL.FX = w / 720;
  SL.FY = h / 405;
  SL.FF = Math.min(SL.FX, SL.FY);   // fonte segue o menor, para nao estourar
  return Math.round(w) + 'x' + Math.round(h) + ' pt';
}
function FS_(v) { return Math.round(v * SL.FF * 10) / 10; }

// =====================================================================
// PONTO DE ENTRADA
// =====================================================================

/** Versao para o MENU da planilha: cria e mostra o resultado num alerta. */
function criarTemplateBase() {
  var ui = SpreadsheetApp.getUi();
  var id = construirTemplate_(null, 'TEMPLATE_ID');
  ui.alert('Template criado',
    'TEMPLATE_ID: ' + id + '\n\n' +
    'Ja foi salvo nas Configuracoes do script.\n\n' +
    'Abra: https://docs.google.com/presentation/d/' + id + '/edit',
    ui.ButtonSet.OK);
  return id;
}

/**
 * Monta os 12 slides e devolve o ID.
 *
 * @param {string=} alvoId   Apresentacao JA EXISTENTE onde montar. Use para o
 *                           template A4: crie uma apresentacao em branco,
 *                           ajuste Arquivo > Configuracao da pagina para
 *                           29,7 x 21 cm e passe o ID aqui. O conteudo atual
 *                           dela e substituido.
 *                           Sem esse parametro, cria uma nova em 16:9.
 * @param {string=} chave    Propriedade onde gravar o ID.
 *                           Padrao: TEMPLATE_ID. Para o A4: TEMPLATE_PDF_ID.
 */
function construirTemplate_(alvoId, chave) {
  var pres, inicial;

  if (alvoId) {
    pres = SlidesApp.openById(extrairId_(alvoId));
    var antigos = pres.getSlides();
    for (var k = antigos.length - 1; k >= 1; k--) antigos[k].remove();
    inicial = pres.getSlides()[0];
  } else {
    pres = SlidesApp.create('TEMPLATE — Relatório de Consultoria Contábil (Exemplo)');
    inicial = pres.getSlides()[0];
  }

  // calcula a escala a partir do tamanho REAL desta apresentacao
  ajustarGrade_(pres);

  slide01Capa_(pres);
  slide02VisaoGeral_(pres);
  slide03Receita_(pres);
  slide04Despesas_(pres);
  slide05Diagnostico_(pres);
  slide06Balanco_(pres);
  slide07Caixa_(pres);
  slide08Saude_(pres);
  slide09Positivos_(pres);
  slide10Atencao_(pres);
  slide11Recomendacoes_(pres);
  slide12Resumo_(pres);

  inicial.remove();
  var id = pres.getId();          // capturado ANTES de fechar
  pres.saveAndClose();

  setPropriedade_(chave || 'TEMPLATE_ID', id);
  return id;
}

// =====================================================================
// PRIMITIVAS DE DESENHO
// =====================================================================

function novoSlide_(pres, corFundo) {
  var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  s.getBackground().setSolidFill(corFundo);
  return s;
}

/** Caixa de texto. o = {size,bold,color,font,align,valign,marca,espaco} */
function T_(slide, x, y, w, h, texto, o) {
  o = o || {};
  var sh = slide.insertTextBox(texto == null ? '' : String(texto),
                               x * SL.FX, y * SL.FY, w * SL.FX, h * SL.FY);
  var tr = sh.getText();
  var st = tr.getTextStyle();
  st.setFontFamily(o.font || TEMA.fonteCorpo);
  st.setFontSize(FS_(o.size || 9));
  st.setBold(!!o.bold);
  st.setForegroundColor(o.color || TEMA.textoCorpo);
  if (o.italic) st.setItalic(true);
  if (o.align) tr.getParagraphStyle().setParagraphAlignment(o.align);
  if (o.espaco) tr.getParagraphStyle().setLineSpacing(o.espaco);
  sh.setContentAlignment(o.valign || SlidesApp.ContentAlignment.TOP);
  try { sh.getBorder().setTransparent(); } catch (e) {}
  if (o.marca) sh.setTitle(o.marca);
  return sh;
}

/** Retângulo sólido. */
function R_(slide, x, y, w, h, cor, marca, raio) {
  var sh = slide.insertShape(
    raio ? SlidesApp.ShapeType.ROUND_RECTANGLE : SlidesApp.ShapeType.RECTANGLE,
    x * SL.FX, y * SL.FY, w * SL.FX, h * SL.FY);
  sh.getFill().setSolidFill(cor);
  try { sh.getBorder().setTransparent(); } catch (e) {}
  if (marca) sh.setTitle(marca);
  if (marca && marca.indexOf('BAR:') === 0) sh.setDescription('MAXW=' + (w * SL.FX));
  return sh;
}

/** Rodapé padrão (linha + texto + número da página). */
function rodape_(slide, numero, escuro) {
  var corLinha = escuro ? TEMA.verdeMedio : TEMA.linha;
  var corTexto = escuro ? TEMA.verdeClaro : TEMA.textoFraco;
  R_(slide, SL.M, 371, SL.CW, 0.75, corLinha);
  T_(slide, SL.M, 378, 500, 15, '{{RODAPE}}', { size: 9, color: corTexto });
  T_(slide, SL.W - SL.M - 60, 378, 60, 15, String(numero),
     { size: 9, color: corTexto, align: SlidesApp.ParagraphAlignment.END });
}

/** Cabeçalho padrão: eyebrow verde + título Cambria. */
function cabecalho_(slide, eyebrow, titulo) {
  T_(slide, SL.M, 34, SL.CW, 14, eyebrow,
     { size: 9.75, bold: true, color: TEMA.verdePrim });
  T_(slide, SL.M, 50, SL.CW, 30, titulo,
     { size: 24, font: TEMA.fonteTitulo, color: TEMA.textoForte });
}

// =====================================================================
// SLIDE 1 — CAPA
// =====================================================================
function slide01Capa_(pres) {
  var s = novoSlide_(pres, TEMA.verdeEscuro);
  T_(s, SL.M, 37, 710, 14, 'EXEMPLO CONTABILIDADE LTDA',
     { size: 10.5, bold: true, color: TEMA.verdeClaro });
  T_(s, SL.M, 53, 710, 13, 'Seja mais, seja Exemplo.',
     { size: 9.75, color: '#8FBBA9' });

  T_(s, SL.M, 155, 646, 19, '{{EMPRESA_NOME}}',
     { size: 12, bold: true, color: TEMA.verdeClaro, marca: 'FIT:12:70' });
  T_(s, SL.M, 178, 646, 46, '{{TITULO_CAPA}}',
     { size: 39, font: TEMA.fonteTitulo, color: '#FFFFFF' });
  T_(s, SL.M, 231, 646, 22, '{{PERIODO_EXTENSO}}',
     { size: 14.25, color: TEMA.verdeSuave });

  R_(s, SL.M, 343, 646, 0.75, TEMA.verdeMedio);
  T_(s, SL.M, 353, 646, 15, 'Reunião de resultados | CNPJ {{CNPJ}}',
     { size: 9.75, color: TEMA.verdeClaro });
}

// =====================================================================
// SLIDE 2 — VISÃO GERAL
// =====================================================================
function slide02VisaoGeral_(pres) {
  var s = novoSlide_(pres, TEMA.bgClaro);
  cabecalho_(s, 'VISÃO GERAL', 'Resumo Executivo');

  var cards = [
    { label: 'RECEITA TOTAL',      valor: '{{RECEITA_TOTAL}}',   sub: '{{RECEITA_MEDIA_MES}}', cor: TEMA.verdePrim, corValor: TEMA.textoForte },
    { label: 'DESPESAS DO PERÍODO',valor: '{{DESPESA_TOTAL}}',   sub: '{{DESPESA_MEDIA_MES}}', cor: TEMA.alerta,    corValor: TEMA.textoForte },
    { label: '{{RESULTADO_LABEL}}',valor: '{{RESULTADO_TOTAL}}', sub: '{{RESULTADO_MARGEM}}',  cor: TEMA.alerta,    corValor: TEMA.alerta },
    { label: 'CAIXA E APLICAÇÕES', valor: '{{CAIXA_TOTAL}}',     sub: '{{CAIXA_VARIACAO}}',    cor: TEMA.verdePrim, corValor: TEMA.textoForte }
  ];

  var x = SL.M, larg = 152, gap = 12.5, topo = 99, alt = 82;
  cards.forEach(function (c) {
    R_(s, x, topo, larg, alt, TEMA.bgBranco);
    R_(s, x, topo, larg, 2, c.cor);
    T_(s, x + 11, topo + 14, larg - 22, 13, c.label, { size: 9, bold: true, color: TEMA.textoFraco });
    T_(s, x + 11, topo + 30, larg - 22, 24, c.valor,
       { size: 21.75, font: TEMA.fonteTitulo, color: c.corValor });
    T_(s, x + 11, topo + 56, larg - 22, 22, c.sub, { size: 9.75, color: TEMA.textoFraco });
    x += larg + gap;
  });

  R_(s, SL.M, 205, 646, 78, TEMA.bgBranco);
  R_(s, SL.M, 205, 2.5, 78, TEMA.verdePrim);
  T_(s, SL.M + 16, 218, 614, 58, '{{TEXTO_VISAO_GERAL}}',
     { size: 12, color: TEMA.textoCorpo, espaco: 130, marca: 'FIT:12:420' });

  rodape_(s, 2, false);
}

// =====================================================================
// SLIDES 3 e 4 — RECEITA / DESPESAS (ranking com barras)
// =====================================================================
function slideRanking_(pres, cfg) {
  var s = novoSlide_(pres, cfg.fundo);
  cabecalho_(s, cfg.eyebrow, cfg.titulo);

  // --- geometria calculada a partir do nº de linhas (nunca invade o rodapé)
  var yLinhas = 94, alturaLinha = 19;
  var larguraLabel = 208, xBar = SL.M + larguraLabel + 10;
  var larguraTrilho = 296, xValor = xBar + larguraTrilho + 12;

  for (var i = 1; i <= cfg.linhas; i++) {
    var y = yLinhas + (i - 1) * alturaLinha;
    var chave = cfg.prefixo + '_' + i;
    T_(s, SL.M, y, larguraLabel, 14, '{{' + chave + '_NOME}}',
       { size: 10.2, color: TEMA.textoCorpo, marca: 'ROW:' + chave });
    R_(s, xBar, y + 4.5, larguraTrilho, 7, TEMA.bgCard, 'ROW:' + chave);
    R_(s, xBar, y + 4.5, larguraTrilho, 7, cfg.corBarra, 'BAR:' + chave);
    T_(s, xValor, y, SL.M + SL.CW - xValor, 14, '{{' + chave + '_VALOR}}',
       { size: 10.2, bold: true, color: TEMA.textoForte, marca: 'ROW:' + chave,
         align: SlidesApp.ParagraphAlignment.END });
  }

  // --- linha de total
  var yRegua = yLinhas + cfg.linhas * alturaLinha + 6;
  R_(s, SL.M, yRegua, SL.CW, 1.5, TEMA.verdeEscuro);
  T_(s, SL.M, yRegua + 8, 320, 17, cfg.rotuloTotal,
     { size: 11.25, bold: true, color: TEMA.textoForte });
  T_(s, SL.M + 326, yRegua + 6, SL.CW - 326, 19, cfg.tagTotal,
     { size: 12.75, bold: true, color: TEMA.textoForte, align: SlidesApp.ParagraphAlignment.END });

  // --- caixa de leitura (ocupa o que sobrar até 362 pt)
  var yBox = yRegua + 33;
  var altBox = 362 - yBox;
  R_(s, SL.M, yBox, SL.CW, altBox, TEMA.bgDestaque);
  T_(s, SL.M + 16, yBox + 9, 240, 13, cfg.rotuloBox,
     { size: 9, bold: true, color: TEMA.textoForte });
  var passoTexto = (altBox - 30) / 3;
  for (var t = 1; t <= 3; t++) {
    T_(s, SL.M + 16, yBox + 25 + (t - 1) * passoTexto, SL.CW - 32, passoTexto,
       '•  {{' + cfg.prefixoTexto + '_' + t + '}}',
       { size: 10, color: TEMA.textoCorpo, marca: 'FIT:10:170' });
  }

  rodape_(s, cfg.numero, false);
  return s;
}

function slide03Receita_(pres) {
  slideRanking_(pres, {
    fundo: TEMA.bgBranco, eyebrow: 'RECEITA', titulo: '{{TITULO_RECEITA}}',
    prefixo: 'REC', prefixoTexto: 'TEXTO_RECEITA', linhas: CONFIG.MAX_LINHAS_RECEITA,
    corBarra: TEMA.verdePrim, rotuloTotal: 'Receita total do período',
    tagTotal: '{{RECEITA_TOTAL_FULL}}', rotuloBox: 'LEITURA', numero: 3
  });
}

function slide04Despesas_(pres) {
  slideRanking_(pres, {
    fundo: TEMA.bgClaro, eyebrow: 'DESPESAS', titulo: '{{TITULO_DESPESAS}}',
    prefixo: 'DESP', prefixoTexto: 'TEXTO_DESPESAS', linhas: CONFIG.MAX_LINHAS_DESPESA,
    corBarra: TEMA.alerta, rotuloTotal: 'Despesa total do período',
    tagTotal: '{{DESPESA_TOTAL_FULL}}', rotuloBox: 'O QUE OBSERVAR', numero: 4
  });
}

// =====================================================================
// SLIDE 5 — DIAGNÓSTICO CENTRAL (fundo escuro)
// =====================================================================
function slide05Diagnostico_(pres) {
  var s = novoSlide_(pres, TEMA.verdeEscuro);
  T_(s, SL.M, 34, SL.CW, 14, 'DIAGNÓSTICO', { size: 9.75, bold: true, color: TEMA.verdeClaro });
  T_(s, SL.M, 50, SL.CW, 30, '{{TITULO_DIAGNOSTICO}}',
     { size: 24, font: TEMA.fonteTitulo, color: '#FFFFFF' });

  // bloco esquerdo — número-síntese
  T_(s, SL.M, 104, 300, 62, '{{DIAG_PERCENTUAL}}',
     { size: 56, font: TEMA.fonteTitulo, color: TEMA.verdeClaro });
  T_(s, SL.M, 172, 300, 26, '{{DIAG_LEGENDA}}',
     { size: 9.5, bold: true, color: '#8FBBA9', marca: 'FIT:9.5:60' });
  T_(s, SL.M, 206, 300, 56, '{{TEXTO_DIAGNOSTICO_1}}',
     { size: 10.5, color: '#D7E5DF', espaco: 130, marca: 'FIT:10.5:260' });
  T_(s, SL.M, 266, 300, 52, '{{TEXTO_DIAGNOSTICO_2}}',
     { size: 10.5, color: '#9FCBB9', espaco: 130, marca: 'FIT:10.5:260' });

  // bloco direito — barras comparativas
  var xb = 372, larg = 311, y = 108, passo = 44;
  var linhas = [
    { label: '{{DIAG_RECEITA_LABEL}}',   valor: '{{DIAG_RECEITA_VALOR}}',   marca: 'DIAG_RECEITA',   cor: TEMA.verdePrim },
    { label: '{{DIAG_PESSOAL_LABEL}}',   valor: '{{DIAG_PESSOAL_VALOR}}',   marca: 'DIAG_PESSOAL',   cor: TEMA.verdeClaro },
    { label: '{{DIAG_OCUPACAO_LABEL}}',  valor: '{{DIAG_OCUPACAO_VALOR}}',  marca: 'DIAG_OCUPACAO',  cor: TEMA.verdeClaro },
    { label: '{{DIAG_DEMAIS_LABEL}}',    valor: '{{DIAG_DEMAIS_VALOR}}',    marca: 'DIAG_DEMAIS',    cor: '#5E8F7C' }
  ];
  linhas.forEach(function (l) {
    T_(s, xb, y, 190, 14, l.label, { size: 10, color: '#9FCBB9' });
    T_(s, xb + 190, y, larg - 190, 14, l.valor,
       { size: 10.5, bold: true, color: '#FFFFFF', align: SlidesApp.ParagraphAlignment.END });
    R_(s, xb, y + 17, larg, 9, TEMA.verdeMedio);
    R_(s, xb, y + 17, larg, 9, l.cor, 'BAR:' + l.marca);
    y += passo;
  });

  R_(s, xb, y + 4, larg, 1, TEMA.verdeMedio);
  T_(s, xb, y + 14, 190, 16, '{{DIAG_RESULTADO_LABEL}}', { size: 10.5, bold: true, color: TEMA.verdeClaro });
  T_(s, xb + 150, y + 12, larg - 150, 20, '{{DIAG_RESULTADO_VALOR}}',
     { size: 15, bold: true, color: '#E0895F', align: SlidesApp.ParagraphAlignment.END });

  rodape_(s, 5, true);
}

// =====================================================================
// SLIDE 6 — BALANÇO PATRIMONIAL
// =====================================================================
function slide06Balanco_(pres) {
  var s = novoSlide_(pres, TEMA.bgBranco);
  cabecalho_(s, 'BALANÇO PATRIMONIAL', 'Indicadores de Estrutura e Liquidez ({{DATA_BASE}})');

  var itens = [
    { t: 'LIQUIDEZ CORRENTE',        v: '{{LIQ_CORRENTE}}',   d: '{{LIQ_CORRENTE_DESC}}' },
    { t: 'LIQUIDEZ IMEDIATA',        v: '{{LIQ_IMEDIATA}}',   d: '{{LIQ_IMEDIATA_DESC}}' },
    { t: 'CAPITAL CIRCULANTE LÍQUIDO', v: '{{CCL}}',          d: '{{CCL_DESC}}' },
    { t: 'ENDIVIDAMENTO GERAL',      v: '{{ENDIVIDAMENTO}}',  d: '{{ENDIVIDAMENTO_DESC}}' },
    { t: 'PATRIMÔNIO LÍQUIDO / ATIVO', v: '{{PL_ATIVO}}',     d: '{{PL_ATIVO_DESC}}' },
    { t: 'MARGEM LÍQUIDA',           v: '{{MARGEM_LIQUIDA}}', d: '{{MARGEM_LIQUIDA_DESC}}' }
  ];

  var larg = 208, alt = 84, gapX = 11, gapY = 11, x0 = SL.M, y0 = 98;
  itens.forEach(function (it, i) {
    var col = i % 3, lin = Math.floor(i / 3);
    var x = x0 + col * (larg + gapX), y = y0 + lin * (alt + gapY);
    R_(s, x, y, larg, alt, TEMA.bgCard);
    T_(s, x + 12, y + 11, larg - 24, 13, it.t, { size: 8.6, bold: true, color: TEMA.textoFraco });
    T_(s, x + 12, y + 26, larg - 24, 26, it.v,
       { size: 21.75, font: TEMA.fonteTitulo, color: TEMA.textoForte });
    T_(s, x + 12, y + 55, larg - 24, 24, it.d,
       { size: 9, color: TEMA.textoFraco, marca: 'FIT:9:90' });
  });

  R_(s, SL.M, 288, 646, 70, TEMA.bgDestaque);
  T_(s, SL.M + 16, 298, 614, 52, '{{TEXTO_BALANCO}}',
     { size: 10.1, color: TEMA.textoCorpo, espaco: 128, marca: 'FIT:10.1:520' });

  rodape_(s, 6, false);
}

// =====================================================================
// SLIDE 7 — CAIXA
// =====================================================================
function slide07Caixa_(pres) {
  var s = novoSlide_(pres, TEMA.bgClaro);
  cabecalho_(s, 'CAIXA', '{{TITULO_CAIXA}}');

  // reconciliação (coluna esquerda)
  var y = 98, passo = 24, largEsq = 388;
  for (var i = 1; i <= 7; i++) {
    R_(s, SL.M, y, largEsq, 20, (i % 2 === 1) ? TEMA.bgBranco : TEMA.bgCard, 'ROWCX:' + i);
    T_(s, SL.M + 10, y + 3, 250, 15, '{{CX_' + i + '_LABEL}}',
       { size: 9.6, color: TEMA.textoCorpo, marca: 'ROWCX:' + i });
    T_(s, SL.M + 262, y + 3, largEsq - 272, 15, '{{CX_' + i + '_VALOR}}',
       { size: 9.6, bold: true, color: TEMA.textoForte, marca: 'ROWCX:' + i,
         align: SlidesApp.ParagraphAlignment.END });
    y += passo;
  }
  T_(s, SL.M, y + 6, largEsq, 24, '{{NOTA_CAIXA}}',
     { size: 8.4, italic: true, color: TEMA.textoFraco });

  // dois cards à direita
  var xc = SL.M + largEsq + 16, largC = 646 - largEsq - 16;
  R_(s, xc, 98, largC, 100, TEMA.bgBranco);
  R_(s, xc, 98, largC, 2, TEMA.alerta);
  T_(s, xc + 12, 110, largC - 24, 13, '{{CONSUMO_MENSAL_LABEL}}', { size: 9, bold: true, color: TEMA.textoFraco });
  T_(s, xc + 12, 126, largC - 24, 24, '{{CONSUMO_MENSAL}}',
     { size: 21.75, font: TEMA.fonteTitulo, color: TEMA.textoForte });
  T_(s, xc + 12, 151, largC - 24, 44, '{{TEXTO_CAIXA_1}}',
     { size: 8.8, color: TEMA.textoFraco, espaco: 122, marca: 'FIT:8.8:190' });

  R_(s, xc, 210, largC, 100, TEMA.bgBranco);
  R_(s, xc, 210, largC, 2, TEMA.verdePrim);
  T_(s, xc + 12, 222, largC - 24, 13, 'RENDIMENTO DAS APLICAÇÕES', { size: 9, bold: true, color: TEMA.textoFraco });
  T_(s, xc + 12, 238, largC - 24, 24, '{{RENDIMENTO_PCT}}',
     { size: 21.75, font: TEMA.fonteTitulo, color: TEMA.textoForte });
  T_(s, xc + 12, 263, largC - 24, 44, '{{TEXTO_CAIXA_2}}',
     { size: 8.8, color: TEMA.textoFraco, espaco: 122, marca: 'FIT:8.8:190' });

  rodape_(s, 7, false);
}

// =====================================================================
// SLIDE 8 — SAÚDE FINANCEIRA
// =====================================================================
function slide08Saude_(pres) {
  var s = novoSlide_(pres, TEMA.bgBranco);
  cabecalho_(s, 'SAÚDE FINANCEIRA', 'Classificação Geral: {{CLASSIFICACAO_GERAL}}');

  // escala Excelente -> Crítica
  var faixas = ['Excelente', 'Boa', 'Regular', 'Preocupante', 'Crítica'];
  var cores  = ['#00A176', '#4FAE8C', '#B9A44B', '#C97F3E', '#C1592F'];
  var largF = 122, gap = 9, x = SL.M, yF = 96;
  faixas.forEach(function (f, i) {
    R_(s, x, yF, largF, 5, cores[i]);
    T_(s, x, yF + 9, largF, 13, f, { size: 8.6, color: TEMA.textoFraco });
    x += largF + gap;
  });
  // marcador triangular que desliza até a faixa da classificação
  var marcador = s.insertShape(SlidesApp.ShapeType.TRIANGLE,
    SL.M * SL.FX, (yF - 11) * SL.FY, 11 * SL.FX, 9 * SL.FY);
  marcador.getFill().setSolidFill(TEMA.verdeEscuro);
  try { marcador.getBorder().setTransparent(); } catch (e) {}
  marcador.setTitle('POS:SAUDE_ESCALA');
  marcador.setDescription('TRACK=' + (SL.M * SL.FX) + ',' + (SL.CW * SL.FX));
  marcador.setRotation(180);

  // dimensões
  var y = 132, passo = 33;
  for (var i2 = 1; i2 <= 5; i2++) {
    T_(s, SL.M, y, 172, 14, '{{SAUDE_' + i2 + '_TITULO}}',
       { size: 9.2, bold: true, color: TEMA.verdePrim });
    T_(s, SL.M + 178, y - 1, 646 - 178, 28, '{{SAUDE_' + i2 + '_TEXTO}}',
       { size: 10.1, color: TEMA.textoCorpo, marca: 'FIT:10.1:190' });
    R_(s, SL.M, y + 24, 646, 0.5, TEMA.linha);
    y += passo;
  }

  R_(s, SL.M, 302, 646, 54, TEMA.bgDestaque);
  T_(s, SL.M + 16, 311, 614, 38, '{{TEXTO_SAUDE}}',
     { size: 10.1, color: TEMA.textoCorpo, espaco: 128, marca: 'FIT:10.1:320' });

  rodape_(s, 8, false);
}

// =====================================================================
// SLIDES 9, 10 e 11 — LISTAS NUMERADAS
// =====================================================================
function slideItens_(pres, cfg) {
  var s = novoSlide_(pres, cfg.fundo);
  cabecalho_(s, cfg.eyebrow, cfg.titulo);

  var y = 96, passo = 53;
  for (var i = 1; i <= cfg.qtd; i++) {
    R_(s, SL.M, y, 26, 26, cfg.corNum, null, true);
    T_(s, SL.M, y + 6, 26, 16, String(i),
       { size: 11, bold: true, color: '#FFFFFF', align: SlidesApp.ParagraphAlignment.CENTER });

    if (cfg.comTitulo) {
      T_(s, SL.M + 38, y + 1, 608, 15, '{{' + cfg.prefixo + '_' + i + '_TITULO}}',
         { size: 11.5, bold: true, color: TEMA.textoForte, marca: 'FIT:11.5:60' });
      T_(s, SL.M + 38, y + 18, 608, 30, '{{' + cfg.prefixo + '_' + i + '_TEXTO}}',
         { size: 10.1, color: TEMA.textoCorpo, espaco: 125, marca: 'FIT:10.1:240' });
    } else {
      T_(s, SL.M + 38, y + 2, 608, 34, '{{' + cfg.prefixo + '_' + i + '}}',
         { size: 10.6, color: TEMA.textoCorpo, espaco: 128, marca: 'FIT:10.6:260' });
    }
    R_(s, SL.M, y + passo - 9, 646, 0.5, TEMA.linha);
    y += passo;
  }
  rodape_(s, cfg.numero, false);
}

function slide09Positivos_(pres) {
  slideItens_(pres, {
    fundo: TEMA.bgClaro, eyebrow: 'DIAGNÓSTICO', titulo: 'O Que Está Bom',
    prefixo: 'BOM', qtd: CONFIG.MAX_ITENS_DIAGNOSTICO, comTitulo: true,
    corNum: TEMA.verdePrim, numero: 9
  });
}

function slide10Atencao_(pres) {
  slideItens_(pres, {
    fundo: TEMA.bgBranco, eyebrow: 'DIAGNÓSTICO', titulo: 'O Que Pode Melhorar',
    prefixo: 'MELHORAR', qtd: CONFIG.MAX_ITENS_DIAGNOSTICO, comTitulo: true,
    corNum: TEMA.alerta, numero: 10
  });
}

function slide11Recomendacoes_(pres) {
  slideItens_(pres, {
    fundo: TEMA.bgClaro, eyebrow: 'PRÓXIMOS PASSOS', titulo: 'Recomendações',
    prefixo: 'ACAO', qtd: CONFIG.MAX_RECOMENDACOES, comTitulo: false,
    corNum: TEMA.verdeEscuro, numero: 11
  });
}

// =====================================================================
// SLIDE 12 — RESUMO / ENCERRAMENTO
// =====================================================================
function slide12Resumo_(pres) {
  var s = novoSlide_(pres, TEMA.verdeEscuro);
  T_(s, SL.M, 37, 646, 14, 'EXEMPLO CONTABILIDADE LTDA',
     { size: 10.5, bold: true, color: TEMA.verdeClaro });

  T_(s, SL.M, 140, 646, 16, 'EM RESUMO', { size: 9.75, bold: true, color: '#8FBBA9' });
  T_(s, SL.M, 162, 646, 60, '{{RESUMO_TITULO}}',
     { size: 27, font: TEMA.fonteTitulo, color: '#FFFFFF', marca: 'FIT:27:130' });
  T_(s, SL.M, 232, 560, 60, '{{RESUMO_TEXTO}}',
     { size: 12, color: TEMA.verdeSuave, espaco: 132, marca: 'FIT:12:340' });

  R_(s, SL.M, 330, 646, 0.75, TEMA.verdeMedio);
  T_(s, SL.M, 342, 646, 15, '{{ASSINATURA}}', { size: 9.75, color: TEMA.verdeClaro });
  T_(s, SL.M, 358, 646, 15, '{{EMPRESA_NOME}} • {{PERIODO_EXTENSO}} • emitido em {{DATA_EMISSAO}}',
     { size: 8.4, color: '#5E8F7C' });
}
