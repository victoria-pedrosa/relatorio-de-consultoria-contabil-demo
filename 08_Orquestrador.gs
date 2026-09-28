/**
 * Arquivo: 08_Orquestrador.gs
 * Fluxo completo: PDFs -> Gemini -> indicadores -> Slides -> PDF -> log.
 * Funções api* são chamadas pelo modal via google.script.run.
 */

/**
 * Gera o relatório de UMA empresa.
 * @param {Object} pedido {empresa:{...}, arquivos:[{id,nome,tipo}]}
 * @return {Object} resultado
 */
function gerarRelatorioEmpresa_(pedido) {
  var emp = pedido.empresa || {};
  var arquivos = pedido.arquivos || [];
  var inicio = new Date();
  var marcos = {}, tMarco = new Date().getTime();
  var marcar = function (nome) {
    var agora = new Date().getTime();
    marcos[nome] = Math.round((agora - tMarco) / 100) / 10;
    tMarco = agora;
  };

  if (!arquivos.length) throw new Error('Nenhum documento selecionado para ' + (emp.empresa || 'a empresa') + '.');

  // 1) Extração dos PDFs pelo Gemini
  // Planilha do Dominio: leitura deterministica, sem IA e sem cota.
  // PDF: continua pelo Gemini, que era o unico caminho possivel antes.
  // Regra pela negativa: se NENHUM arquivo e PDF, vai pelo leitor. Testar a
  // presenca de .xls falhava quando o Drive converteu o arquivo em Planilha
  // Google e o nome ficou sem extensao.
  var soPlanilhas = arquivos.every(function (a) {
    return !/\.pdf$/i.test(String(a.nome || '').trim());
  });
  var dados = soPlanilhas ? lerDocumentosDominio_(arquivos) : extrairDadosDosPdfs_(arquivos);
  marcar(soPlanilhas ? 'leitura' : 'extracao');

  // Trava: os documentos tem que ser da empresa escolhida. Relatorio com o nome
  // de um cliente e os numeros de outro e o pior defeito possivel aqui.
  var conf = conferirCnpjDocumentos_(dados, emp);
  if (!conf.ok) throw new Error(conf.erro);
  if (conf.aviso) (dados.observacoes_extracao = dados.observacoes_extracao || []).push(conf.aviso);

  if (!dados.empresa.nome && emp.empresa) dados.empresa.nome = emp.empresa;
  if (!dados.empresa.cnpj && emp.cnpj)    dados.empresa.cnpj = emp.cnpj;
  if (!dados.empresa.meses_no_periodo)    dados.empresa.meses_no_periodo = contarMeses_(dados) || 1;

  // 2) Indicadores determinísticos
  var k = calcularIndicadores_(dados);

  // 3) Narrativas
  var periodoExt = periodoExtenso_(dados.empresa.periodo_inicio, dados.empresa.periodo_fim);
  // Narrativas por regras — instantaneas e sem cota. A IA so entra se o
  // usuario pedir, para o relatorio que vai ser apresentado ao cliente.
  var analise;
  if (pedido.enriquecerIa) {
    try {
      analise = gerarAnalise_(dados, k, emp.empresa || dados.empresa.nome, periodoExt);
    } catch (eIa) {
      // Se a IA falhar, o relatorio sai mesmo assim com os textos por regra.
      analise = gerarAnalisePorRegras_(dados, k, emp.empresa || dados.empresa.nome, periodoExt);
      (dados.observacoes_extracao = dados.observacoes_extracao || []).push(
        'A IA nao respondeu (' + (eIa && eIa.message || eIa) + '); textos gerados por regras.');
    }
  } else {
    analise = gerarAnalisePorRegras_(dados, k, emp.empresa || dados.empresa.nome, periodoExt);
  }
  marcar('analise');

  // 4) Tags e apresentacao
  //    saida: 'slides' usa o template 16:9; 'pdf' usa o template A4 e exporta.
  var saida = (pedido.saida === 'pdf') ? 'pdf' : 'slides';
  var templateId = (saida === 'pdf') ? getTemplatePdfId_() : getTemplateId_();

  var tags = montarTags_(dados, k, analise, emp);
  var pastaSaida = pastaDaEmpresa_(getPastaSaida_(), emp.empresa || dados.empresa.nome || 'Sem nome');
  var base = 'Relatorio_Consultoria_' + slug_(emp.empresa || dados.empresa.nome) + '_' +
             slug_(periodoCurto_(dados.empresa.periodo_inicio, dados.empresa.periodo_fim));

  var slides = gerarApresentacao_(tags, k, base + (saida === 'pdf' ? '_A4' : ''), pastaSaida, templateId);
  marcar('slides');

  // 5) PDF — so na saida 'pdf', a partir do template A4
  var pdf = null;
  if (saida === 'pdf') {
    pdf = exportarPdf_(slides.id, base, pastaSaida);
    marcar('pdf');
  }

  var arquivamento = null;
  if (pedido.arquivar !== false) {
    try {
      arquivamento = arquivarDocumentosUsados_(
        arquivos,
        emp.empresa || (dados.empresa && dados.empresa.nome) || 'EMPRESA'
      );
      marcar('arquivamento');
    } catch (eArq) {
      arquivamento = { ok: false, movidos: 0, total: 0, pasta: '', pastaUrl: '',
                       erros: [String(eArq && eArq.message ? eArq.message : eArq)] };
    }
  }

  var resultado = {
    ok: true,
    arquivamento: arquivamento,
    empresa: emp.empresa || dados.empresa.nome,
    cnpj: dados.empresa.cnpj,
    periodo: periodoExt,
    slidesUrl: slides.url,
    slidesId: slides.id,
    pdfUrl: pdf ? pdf.url : '',
    pastaUrl: pastaSaida.getUrl(),
    saida: saida,
    segundos: Math.round((new Date() - inicio) / 1000),
    etapas      : marcos,
    rastroIa    : resumoTracoGemini_(),
    observacoes: dados.observacoes_extracao || [],
    resumo: {
      receita: moeda_(k.receita_total),
      despesa: moeda_(k.despesa_total),
      resultado: moeda_(k.resultado),
      caixa: moeda_(k.disponibilidades)
    }
  };

  registrarLog_({
    empresa: resultado.empresa, cnpj: resultado.cnpj, periodo: periodoExt,
    status: 'OK (' + saida + ')', arquivos: arquivos.map(function (a) { return a.nome; }),
    linkSlides: slides.url, linkPdf: resultado.pdfUrl,
    mensagem: (resultado.observacoes || []).join(' | ')
  });

  return resultado;
}

// ---------------------------------------------------------------------
// API — chamadas do modal
// ---------------------------------------------------------------------

/** Geração individual (uma empresa por chamada — evita timeout de 6 min). */
function apiGerarUm(pedido) {
  exigirUso_();
  try {
    return gerarRelatorioEmpresa_(pedido);
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    registrarLog_({
      empresa: (pedido.empresa && pedido.empresa.empresa) || '',
      cnpj: (pedido.empresa && pedido.empresa.cnpj) || '',
      status: 'ERRO',
      arquivos: (pedido.arquivos || []).map(function (a) { return a.nome; }),
      mensagem: msg
    });
    return { ok: false, empresa: (pedido.empresa && pedido.empresa.empresa) || '', erro: msg };
  }
}

/**
 * Lote: o modal chama apiGerarUm em sequência, um pedido por vez.
 * Esta função existe para uso em gatilho/execução manual sem interface.
 */
function gerarLoteSemInterface() {
  var pasta = getPastaDocumentos_();
  var arqs = listarArquivosPasta_(pasta);
  var empresas = lerCadastro_(true);
  var ag = agruparPorEmpresa_(arqs, empresas);

  var resultados = [];
  ag.grupos.forEach(function (g) {
    if (!grupoCompleto_(g.arquivos)) return;
    resultados.push(apiGerarUm({
      saida: 'pdf',
      empresa: g.empresa,
      arquivos: g.arquivos.map(function (a) { return { id: a.id, nome: a.nome, tipo: a.tipo }; })
    }));
  });
  console.log(JSON.stringify(resultados, null, 2));
  return resultados;
}

/** Diagnóstico: roda só a extração e devolve o JSON, sem gerar slides. */
function apiPreviewDados(pedido) {
  exigirUso_();
  try {
    var dados = extrairDadosDosPdfs_(pedido.arquivos || []);
    var k = calcularIndicadores_(dados);
    return { ok: true, dados: dados, indicadores: k };
  } catch (e) {
    return { ok: false, erro: String(e && e.message ? e.message : e) };
  }
}
