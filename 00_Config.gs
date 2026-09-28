/**
 * =====================================================================
 *  RELATÓRIO DE CONSULTORIA CONTÁBIL — AUTOMAÇÃO
 *  Escritório Contábil Exemplo | Time de IA
 * ---------------------------------------------------------------------
 *  Arquivo: 00_Config.gs
 *  Todas as credenciais e IDs ficam AQUI. Não edite os demais arquivos
 *  para configurar o sistema.
 * =====================================================================
 */

// =====================================================================
// 1) CREDENCIAIS E IDs  — PREENCHA ESTA SEÇÃO
// =====================================================================

var CONFIG = {

  // ---------------------------------------------------------------
  // (A) CHAVE DA API DO GEMINI
  //     Deixe "" e use o menu  ▸ Configurar API Key  (recomendado:
  //     grava em PropertiesService, não fica exposta no código).
  //     Ou cole a chave direto aqui se preferir.
  // ---------------------------------------------------------------
  API_KEY: '',                       // <<< COLE SUA API KEY AQUI (opcional)

  // Modelo Gemini. Precisa suportar entrada de PDF (multimodal).
  MODELO_EXTRACAO: 'gemini-3.8-flash',      // leitura dos PDFs -> JSON
  MODELO_ANALISE : 'gemini-3.8-flash',      // redacao das narrativas
  MODELO_IDENTIFICACAO: 'gemini-3.6-flash', // so identifica a empresa do PDF

  // ---------------------------------------------------------------
  // (B) TEMPLATE DO GOOGLE SLIDES
  //     Se ainda não tem, rode uma vez o menu
  //     ▸ Utilidades ▸ Criar template base (padrão SOGIBA)
  //     e cole aqui o ID que aparecer.
  // ---------------------------------------------------------------
  TEMPLATE_ID: '',                   // <<< template 16:9, usado no botao SLIDES

  // Template A4 paisagem (29,7 x 21 cm), usado no botao PDF.
  // O tamanho da pagina NAO pode ser definido por codigo: crie uma
  // apresentacao em branco, va em Arquivo > Configuracao da pagina >
  // Personalizado > 29,7 x 21 cm, e informe o ID dela na interface.
  TEMPLATE_PDF_ID: '',

  // ---------------------------------------------------------------
  // (C) PASTAS NO DRIVE
  //     PASTA_DOCUMENTOS_ID  = onde ficam os PDFs de entrada
  //     PASTA_SAIDA_ID       = onde os relatórios gerados são salvos
  //
  //     Se deixar em branco, o script tenta resolver pelo caminho:
  //     Drives compartilhados > Servidor IA > 2. Automações >
  //     Relatório de Consultoria Contábil > documentosautomatizaotimecontabil
  // ---------------------------------------------------------------
  PASTA_DOCUMENTOS_ID: '',           // <<< (opcional) ID da pasta de PDFs
  PASTA_SAIDA_ID     : '',           // <<< (opcional) ID da pasta de saída

  DRIVE_COMPARTILHADO_NOME: 'Servidor IA',
  CAMINHO_DOCUMENTOS: [
    '2. Automações',
    'Relatório de Consultoria Contábil',
    'documentosautomatizaotimecontabil'
  ],
  NOME_PASTA_SAIDA: 'Relatórios Gerados',
  NOME_PASTA_ARQUIVO: 'Documentos Arquivados',

  // ---------------------------------------------------------------
  // (D) PLANILHA — nomes das abas e dos cabeçalhos
  //     O script localiza as colunas PELO NOME do cabeçalho (linha 1),
  //     então a ordem das colunas pode mudar sem quebrar nada.
  //     Cada item abaixo é uma lista de nomes aceitos (o 1º que existir).
  // ---------------------------------------------------------------
  // ID da planilha do Cadastro. OBRIGATORIO para o web app: numa URL nao
  // existe "planilha ativa". Pelo menu da planilha este valor e ignorado.
  PLANILHA_ID  : 'ID_EXEMPLO',

  // Quem pode abrir a aba Configuracao do web app.
  // Editavel pela propria interface (grava em ADMINS nas propriedades).
  ADMINS: ['usuario2@exemplo.com.br', 'victoria.pedrosa@exemplo.com.br'],

  // Quem pode USAR o app (enviar documentos e gerar relatorios), alem dos
  // ADMINS, que sempre podem. Editavel pela propria interface (grava em
  // USUARIOS nas propriedades). Lista vazia = so os ADMINS.
  USUARIOS: [],

  ABA_CADASTRO : 'Cadastro',
  ABA_LOG      : 'Import_Log',
  LINHA_CABECALHO: 1,

  COLS: {
    situacao : ['Situacao', 'Situação', 'Status'],
    empresa  : ['Empresa', 'Razão Social', 'Razao Social'],
    fantasia : ['Nome Fantasia', 'Nome Fant', 'Fantasia'],
    cnpj     : ['CNPJ', 'C.N.P.J.'],
    codigo   : ['Código Domínio', 'Codigo Dominio', 'Cod Dominio', 'Código Dominio'],
    email    : ['E-mail', 'Email', 'Emails'],
    tributacao: ['Tributacao', 'Tributação', 'Regime'],
    cidade   : ['Cidade']
  },

  // Só entram na lista as empresas com este valor em "Situacao".
  SITUACAO_ATIVA: ['Ativas', 'Ativa', 'Ativo', 'Ativos'],

  // ---------------------------------------------------------------
  // (E) COMPORTAMENTO
  // ---------------------------------------------------------------
  GERAR_PDF: true,            // exporta PDF além do Slides
  MAX_LINHAS_RECEITA : 7,     // linhas no slide de Receita (inclui a linha 'Outras contas')
  MAX_LINHAS_DESPESA : 7,     // linhas no slide de Despesas (inclui a linha 'Outras contas')
  MAX_ITENS_DIAGNOSTICO: 5,   // itens nos slides "o que está bom / melhorar"
  MAX_RECOMENDACOES  : 5,
  TIMEOUT_GEMINI_MS  : 180000,
  TENTATIVAS_GEMINI  : 5,

  // Cota do plano gratuito. O throttle abaixo segura as chamadas para nunca
  // encostar no teto — e melhor esperar 8s do que levar 429 e perder a rodada.
  RPM_MAX            : 8,        // chamadas por minuto que nos permitimos

  // Cada tentativa num modelo consome uma unidade da cota DIARIA daquele modelo.
  // Varrer a fila inteira num surto de 503 deixa a geracao rapida, mas queima
  // nove cotas de uma vez. Tres e o meio-termo: sobrevive a instabilidade
  // pontual sem torrar o dia.
  MAX_MODELOS_POR_CHAMADA: 3,
  PAUSA_ENTRE_EMPRESAS_MS: 3000  // respiro entre empresas no lote
};

// =====================================================================
// 2) IDENTIDADE VISUAL — padrão SOGIBA / Exemplo
//    (usado pelo gerador de template; não precisa mexer)
// =====================================================================

var TEMA = {
  verdeEscuro : '#003528',
  verdeMedio  : '#1D4A3C',
  verdePrim   : '#00A176',
  verdeClaro  : '#7FBBA3',
  verdeSuave  : '#9FCBB9',
  bgClaro     : '#F7FAF8',
  bgBranco    : '#FFFFFF',
  bgCard      : '#EEF5F1',
  bgDestaque  : '#E3F3EC',
  linha       : '#D7E5DF',
  textoForte  : '#003528',
  textoCorpo  : '#3A453F',
  textoFraco  : '#6E7C75',
  alerta      : '#C1592F',
  fonteTitulo : 'Cambria',
  fonteCorpo  : 'Arial',
  LARGURA_PT  : 1440,   // 20,00 pol
  ALTURA_PT   : 810,    // 11,25 pol
  MARGEM_PT   : 75
};

// =====================================================================
// 3) HELPERS DE CONFIGURAÇÃO
// =====================================================================

/** Retorna a API Key: primeiro a das Propriedades do Script, depois a do CONFIG. */
function getApiKey_() {
  var p = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var k = limparValor_(p) || limparValor_(CONFIG.API_KEY);
  if (k && !/^AIza[A-Za-z0-9_\-]{30,}$/.test(k)) {
    throw new Error(
      'A chave gravada nao tem o formato de uma API key do Gemini.\n\n' +
      'Esperado: comeca com "AIza" e tem 39 caracteres.\n' +
      'Gravado : comeca com "' + k.substring(0, 4) + '" e tem ' + k.length + ' caracteres.\n\n' +
      'Gere em https://aistudio.google.com/apikey e cole em\n' +
      'Configuracoes > Configurar API Key do Gemini.'
    );
  }
  if (!k) {
    throw new Error(
      'API Key do Gemini não configurada.\n\n' +
      'Use o menu  Consultoria Contábil ▸ Configurações ▸ Configurar API Key,\n' +
      'ou preencha CONFIG.API_KEY no arquivo 00_Config.gs.'
    );
  }
  return k;
}

/** Retorna o TEMPLATE_ID: primeiro o das Propriedades, depois o do CONFIG. */
/** Template A4 usado na saida em PDF. */
function getTemplatePdfId_() {
  var t = (getPropriedade_('TEMPLATE_PDF_ID') || CONFIG.TEMPLATE_PDF_ID || '').trim();
  if (!t) {
    throw new Error(
      'Template A4 nao configurado.\n\n' +
      'O tamanho da pagina de um Google Slides nao pode ser definido por codigo. ' +
      'Crie uma apresentacao em branco, ajuste Arquivo > Configuracao da pagina > ' +
      'Personalizado para 29,7 x 21 cm, e informe o ID dela em Configuracao.');
  }
  return extrairId_(t);
}

function getTemplateId_() {
  var p = PropertiesService.getScriptProperties().getProperty('TEMPLATE_ID');
  var t = (p && p.trim()) ? p.trim() : (CONFIG.TEMPLATE_ID || '').trim();
  if (!t) {
    throw new Error(
      'TEMPLATE_ID não configurado.\n\n' +
      'Rode  Consultoria Contábil ▸ Utilidades ▸ Criar template base (padrão SOGIBA)\n' +
      'e depois cole o ID em CONFIG.TEMPLATE_ID (ou salve pelo menu Configurações).'
    );
  }
  return t;
}

function setPropriedade_(chave, valor) {
  PropertiesService.getScriptProperties().setProperty(chave, limparValor_(valor));
}

/**
 * Limpa um valor colado (chave de API, ID de arquivo/pasta).
 * Remove espacos, quebras de linha, aspas e caracteres invisiveis — causa
 * classica de "API key not valid" quando a chave e colada de um e-mail,
 * PDF ou planilha.
 */
function limparValor_(v) {
  return String(v == null ? '' : v)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/\s+/g, '')
    .replace(/^["'`\u201C\u201D\u2018\u2019]+|["'`\u201C\u201D\u2018\u2019]+$/g, '');
}

/** Aceita tanto o ID puro quanto a URL completa do Drive/Slides. */
function extrairId_(v) {
  var s = limparValor_(v);
  var m = s.match(/\/(?:d|folders)\/([A-Za-z0-9_-]{15,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([A-Za-z0-9_-]{15,})/);
  if (m) return m[1];
  return s;
}

// ---------------------------------------------------------------------------
// MODELOS DO GEMINI
// O Google aposenta modelos sem aviso e chaves novas perdem acesso aos antigos.
// Em vez de quebrar, o sistema desce esta fila ate achar um modelo que responda.
// ---------------------------------------------------------------------------
var MODELOS_RESERVA = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
  // Sem modelos 'pro' aqui: no plano gratuito a cota diaria deles e pequena
  // demais para servir de reserva — esgotam em duas ou tres chamadas.
];

/**
 * Fila de modelos a tentar, do preferido ao ultimo recurso.
 * MODELO_FORCADO, se gravado nas propriedades, tem prioridade sobre tudo.
 */
function modelosComReserva_(preferido) {
  var fila = [];
  var add = function (nome) { if (nome && fila.indexOf(nome) < 0) fila.push(nome); };
  add(getPropriedade_('MODELO_FORCADO'));
  add(preferido);
  MODELOS_RESERVA.forEach(add);

  // A cota diaria do plano gratuito e POR MODELO
  // (GenerateRequestsPerDayPerProjectPerModel-FreeTier). Ou seja: cada modelo
  // tem o proprio saldo. Quem ja esgotou hoje vai para o fim da fila — nao some,
  // porque se a virada do dia escapar do nosso controle ele ainda serve.
  var esgotados = modelosEsgotadosHoje_();
  if (!esgotados.length) return fila;
  var vivos  = fila.filter(function (n) { return esgotados.indexOf(n) < 0; });
  var mortos = fila.filter(function (n) { return esgotados.indexOf(n) >= 0; });

  // Ja sabemos que os esgotados vao recusar: tentar de novo so gasta tempo.
  // Eles voltam a fila apenas se nao sobrar alternativa.
  var ordem = vivos.length ? vivos.concat(mortos) : mortos;
  return ordem.slice(0, Math.max(1, CONFIG.MAX_MODELOS_POR_CHAMADA || 3));
}

// ---------------------------------------------------------------------------
// RASTRO DAS CHAMADAS
// Guarda, por execucao, o que aconteceu em cada chamada ao Gemini. Serve para
// distinguir tempo de geracao de tempo de espera — sao problemas diferentes,
// com solucoes diferentes.
// ---------------------------------------------------------------------------
var TRACO_GEMINI = [];

function registrarTracoGemini_(modelo, voltas, esperaMs, ampliou) {
  TRACO_GEMINI.push({
    modelo  : modelo,
    voltas  : voltas,
    esperaS : Math.round(esperaMs / 100) / 10,
    ampliou : !!ampliou
  });
}

/** Resumo em uma linha do que as chamadas desta execucao enfrentaram. */
function resumoTracoGemini_() {
  if (!TRACO_GEMINI.length) return '';
  return TRACO_GEMINI.map(function (t) {
    return t.modelo
      + (t.voltas > 1 ? ' ' + t.voltas + ' voltas' : '')
      + (t.esperaS > 0 ? ' esperando ' + t.esperaS + 's' : '')
      + (t.ampliou ? ' +orcamento' : '');
  }).join(' / ');
}

// ---------------------------------------------------------------------------
// SALDO DIARIO POR MODELO
// ---------------------------------------------------------------------------
var CHAVE_MODELOS_ESGOTADOS = 'gemini_modelos_esgotados';

/** As cotas diarias do Google zeram a meia-noite do Pacifico, nao de Brasilia. */
function diaDaCota_() {
  return Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
}

/** Modelos que ja bateram a cota diaria hoje. */
function modelosEsgotadosHoje_() {
  try {
    var bruto = PropertiesService.getScriptProperties().getProperty(CHAVE_MODELOS_ESGOTADOS);
    if (!bruto) return [];
    var d = JSON.parse(bruto);
    return (d.dia === diaDaCota_()) ? (d.modelos || []) : [];
  } catch (e) { return []; }
}

function marcarModeloEsgotado_(nome) {
  try {
    var lista = modelosEsgotadosHoje_();
    if (lista.indexOf(nome) < 0) lista.push(nome);
    PropertiesService.getScriptProperties().setProperty(
      CHAVE_MODELOS_ESGOTADOS, JSON.stringify({ dia: diaDaCota_(), modelos: lista }));
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// CONTROLE DE COTA
// O plano gratuito do Gemini limita chamadas por minuto. Em vez de descobrir
// o teto levando 429 (que derruba a rodada inteira), seguramos a chamada aqui.
// O historico fica no cache do script, entao vale entre execucoes diferentes —
// cada empresa gerada pelo app roda numa execucao propria.
// ---------------------------------------------------------------------------
var CHAVE_CACHE_RPM = 'gemini_chamadas_recentes';

/** Segura a execucao ate haver vaga dentro do RPM_MAX. */
function aguardarVagaGemini_() {
  try {
    var cache = CacheService.getScriptCache();
    for (var volta = 0; volta < 12; volta++) {
      var agora = new Date().getTime();
      var bruto = cache.get(CHAVE_CACHE_RPM);
      var marcas = bruto ? JSON.parse(bruto) : [];
      marcas = marcas.filter(function (t) { return agora - t < 60000; });

      if (marcas.length < CONFIG.RPM_MAX) {
        marcas.push(agora);
        cache.put(CHAVE_CACHE_RPM, JSON.stringify(marcas), 120);
        return;
      }
      // Sem vaga: dorme ate a chamada mais antiga sair da janela de 60s.
      var espera = Math.min(20000, 60000 - (agora - Math.min.apply(null, marcas)) + 500);
      Utilities.sleep(Math.max(1000, espera));
    }
  } catch (e) {
    // Cache indisponivel nao pode impedir a geracao; segue sem throttle.
  }
}

/**
 * Le o corpo de um 429 e diz que cota estourou. A acao do usuario muda
 * completamente: cota por minuto passa sozinha, cota por dia so amanha.
 * Devolve { porDia, metrica, esperaMs }.
 */
function lerErroDeCota_(corpo) {
  var info = { porDia: false, metrica: '', esperaMs: 0 };
  try {
    var det = (JSON.parse(corpo).error || {}).details || [];
    det.forEach(function (d) {
      var tipo = String(d['@type'] || '');
      if (tipo.indexOf('QuotaFailure') >= 0) {
        (d.violations || []).forEach(function (vi) {
          var id = String(vi.quotaId || vi.quotaMetric || '');
          if (id && !info.metrica) info.metrica = id;
          if (/per_?day|PerDay/i.test(id)) info.porDia = true;
        });
      }
      if (tipo.indexOf('RetryInfo') >= 0 && d.retryDelay) {
        var seg = parseFloat(String(d.retryDelay).replace('s', ''));
        if (seg > 0) info.esperaMs = Math.min(60000, Math.round(seg * 1000));
      }
    });
    if (!info.porDia && /per day|daily limit|PerDay/i.test(corpo)) info.porDia = true;
  } catch (e) {}
  return info;
}

/**
 * Espera entre tentativas: exponencial com sorteio, teto de 30s.
 * O sorteio evita que varias empresas de um lote voltem todas no mesmo instante
 * e derrubem a API de novo.
 */
function esperaBackoff_(tentativa) {
  var base = Math.min(30000, 4000 * Math.pow(2, tentativa - 1));
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

/** Anota qual modelo acabou sendo usado, para aparecer no diagnostico. */
function registrarModeloEmUso_(pedido, usado) {
  try {
    PropertiesService.getScriptProperties().setProperty('MODELO_EM_USO', usado);
  } catch (e) {}
  try {
    Logger.log('Modelo ' + pedido + ' indisponivel para esta chave; usando ' + usado + '.');
  } catch (e2) {}
}

/**
 * Ultimo recurso: pergunta a propria API quais modelos a chave enxerga e
 * devolve o mais recente que sirva para generateContent.
 */
function descobrirModelo_(jaTentados) {
  try {
    var u = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='
          + encodeURIComponent(getApiKey_());
    var r = UrlFetchApp.fetch(u, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var lista = JSON.parse(r.getContentText()).models || [];
    var bons = lista
      .filter(function (mm) {
        return (mm.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
      })
      .map(function (mm) { return String(mm.name || '').replace(/^models\//, ''); })
      .filter(function (n) {
        if (!n || jaTentados.indexOf(n) >= 0) return false;
        // So 'flash'. Os modelos 'pro' tem cota diaria gratuita muito menor,
        // entao gastar uma requisicao para descobrir isso e prejuizo dobrado.
        if (!/flash/.test(n)) return false;
        return !/lite|embedding|image|tts|live|vision|thinking|exp|preview/.test(n);
      })
      .sort();
    return bons.length ? bons[bons.length - 1] : '';
  } catch (e) { return ''; }
}

function getPropriedade_(chave) {
  return PropertiesService.getScriptProperties().getProperty(chave) || '';
}

// =====================================================================
// 4) PLANILHA E USUARIO — necessarios para o WEB APP
// =====================================================================

/**
 * Devolve a planilha do Cadastro.
 * Pelo menu usa a planilha ativa; pelo web app nao existe planilha ativa,
 * entao abre por ID.
 */
function getPlanilha_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (ss) return ss;

  var id = getPropriedade_('PLANILHA_ID') || CONFIG.PLANILHA_ID;
  if (!id) {
    throw new Error('PLANILHA_ID nao configurado. No web app e preciso informar ' +
      'o ID da planilha do Cadastro, porque numa URL nao existe planilha ativa.');
  }
  return SpreadsheetApp.openById(extrairId_(id));
}

/** E-mail de quem esta usando (vazio se o Google nao informar). */
function usuarioAtual_() {
  return usuarioRealAtual_();
}

/** Administradores: a propriedade ADMINS tem prioridade sobre o codigo. */
function getAdmins_() {
  var p = getPropriedade_('ADMINS');
  var lista = p ? p.split(/[\s,;]+/) : (CONFIG.ADMINS || []);
  return lista.map(function (x) { return String(x || '').trim().toLowerCase(); })
              .filter(function (x) { return /@/.test(x); });
}

/**
 * So o e-mail de quem ESTA acessando. Nunca cai para getEffectiveUser():
 * com a implantacao em "Executar como: eu", o usuario efetivo e sempre o
 * dono do script — e o dono esta na lista de ADMINS. O fallback daria
 * poderes de administrador a qualquer pessoa que abrisse o app.
 */
function usuarioRealAtual_() {
  try { return String(Session.getActiveUser().getEmail() || '').trim(); }
  catch (x) { return ''; }
}

function ehAdmin_(email) {
  var e = String(email || usuarioRealAtual_()).trim().toLowerCase();
  if (!e) return false;
  return getAdmins_().indexOf(e) >= 0;
}

/** E-mails liberados para USAR o app (fora os admins, que sempre podem). */
function getUsuarios_() {
  var p = getPropriedade_('USUARIOS');
  var lista = p ? p.split(/[\s,;]+/) : (CONFIG.USUARIOS || []);
  return lista.map(function (x) { return String(x || '').trim().toLowerCase(); })
              .filter(function (x) { return /@/.test(x); });
}

/**
 * Pode enviar documentos e gerar relatorios? Admin sempre pode.
 * Lista vazia = so os admins — falha fechada de proposito: e melhor
 * alguem ficar de fora do que qualquer um entrar.
 */
function podeUsar_(email) {
  var e = String(email || usuarioRealAtual_()).trim().toLowerCase();
  if (!e) return false;
  if (ehAdmin_(e)) return true;
  return getUsuarios_().indexOf(e) >= 0;
}

function exigirUso_() {
  var e = usuarioRealAtual_();
  if (!podeUsar_(e)) {
    throw new Error('Sem acesso a este app. Voce esta como ' +
      (e || 'usuario nao identificado') +
      '. Peca a um administrador para liberar o seu e-mail.');
  }
}
