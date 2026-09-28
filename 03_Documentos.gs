/**
 * Arquivo: 03_Documentos.gs
 * Acesso às pastas do Drive, upload pelo modal, classificação e
 * agrupamento dos PDFs por empresa.
 */

// ---------------------------------------------------------------------
// PASTAS
// ---------------------------------------------------------------------

function getPastaDocumentos_() {
  var id = getPropriedade_('PASTA_DOCUMENTOS_ID') || CONFIG.PASTA_DOCUMENTOS_ID;
  if (id) return pastaPorId_(id);
  // Resolver por caminho usa iteradores do DriveApp, que falham com
  // "Service error: Drive" em Drive Compartilhado. Fazemos isso no maximo
  // uma vez e gravamos o ID.
  var p = resolverPastaPorCaminho_(CONFIG.DRIVE_COMPARTILHADO_NOME, CONFIG.CAMINHO_DOCUMENTOS);
  try { PropertiesService.getScriptProperties().setProperty('PASTA_DOCUMENTOS_ID', p.getId()); } catch (eProp) {}
  return p;
}

function getPastaSaida_() {
  var id = getPropriedade_('PASTA_SAIDA_ID') || CONFIG.PASTA_SAIDA_ID;
  if (id) return pastaPorId_(id);
  // cria/reaproveita "Relatórios Gerados" ao lado da pasta de documentos
  var docs = getPastaDocumentos_();
  var base = docs;
  try {
    var meta = comRetryDrive_(function () { return Drive.Files.get(docs.getId(), { fields: 'parents', supportsAllDrives: true }); });
    var pid = (meta && meta.parents && meta.parents[0]) || '';
    if (pid) base = pastaPorId_(pid);
  } catch (ePai) {
    var pais = docs.getParents();
    if (pais.hasNext()) base = pais.next();
  }
  var alvo = subpastaPorNome_(base, CONFIG.NOME_PASTA_SAIDA);
  try { PropertiesService.getScriptProperties().setProperty('PASTA_SAIDA_ID', alvo.getId()); } catch (eProp2) {}
  return alvo;
}

/**
 * Percorre "Drives compartilhados > <drive> > a > b > c".
 * Requer o serviço avançado "Drive API" habilitado para localizar o
 * Drive compartilhado pelo nome; se não estiver, oriente a usar o ID.
 */
function resolverPastaPorCaminho_(nomeDrive, caminho) {
  var raiz = null;

  try {
    var resp = Drive.Drives ? Drive.Drives.list({ pageSize: 100 })
                            : Drive.Teamdrives.list({ maxResults: 100 });
    var lista = resp.drives || resp.items || [];
    for (var i = 0; i < lista.length; i++) {
      if (normalizar_(lista[i].name) === normalizar_(nomeDrive)) {
        raiz = DriveApp.getFolderById(lista[i].id);
        break;
      }
    }
  } catch (e) {
    // Serviço avançado indisponível — segue para o fallback abaixo.
  }

  if (!raiz) {
    // fallback: procura a pasta final pelo nome em todo o Drive acessível
    var alvo = caminho[caminho.length - 1];
    var it = DriveApp.getFoldersByName(alvo);
    if (it.hasNext()) return it.next();
    throw new Error(
      'Não foi possível localizar a pasta "' + alvo + '".\n\n' +
      'Habilite o serviço avançado "Drive API" (Serviços ▸ +) ou informe o ID da pasta em\n' +
      'Configurações ▸ Configurar pasta de documentos.');
  }

  var atual = raiz;
  for (var k = 0; k < caminho.length; k++) {
    var f = atual.getFoldersByName(caminho[k]);
    if (!f.hasNext()) throw new Error('Subpasta não encontrada no caminho: "' + caminho[k] + '".');
    atual = f.next();
  }
  return atual;
}

// ---------------------------------------------------------------------
// LISTAGEM E CLASSIFICAÇÃO
// ---------------------------------------------------------------------

var TIPOS_DOC = {
  DRE_MENSAL   : 'DRE Mensal',
  DRE_ACUM     : 'DRE Acumulado',
  BAL_MENSAL   : 'Balancete Mensal',
  BAL_ACUM     : 'Balancete Acumulado',
  AH           : 'Análise Horizontal',
  OUTRO        : 'Outro'
};

/**
 * Classifica pelo nome do arquivo.
 * Padrão Domínio observado:
 *   "D. R. E. 072026 fundaçao garcia.pdf"        -> DRE mensal
 *   "D. R. E. 01a072026 fundaçao garcia.pdf"     -> DRE acumulado
 *   "Balancete. 072026 ..." / "Balancete 01a072026 ..."
 *   "Análise Horizontal do D. R. E.01 a 07 ..."
 */
function classificarArquivo_(nome) {
  var n = normalizar_(nome);                       // ex.: "d r e 01a072026 fundacao garcia pdf"
  var acumulado = /(\d{2})\s*a\s*(\d{2})/.test(n) || /\bacumulad/.test(n) || /\b01\s*a\s*\d{2}/.test(n);

  if (/analise horizontal/.test(n)) return TIPOS_DOC.AH;
  if (/balancete/.test(n))          return acumulado ? TIPOS_DOC.BAL_ACUM : TIPOS_DOC.BAL_MENSAL;
  if (/\bd\s*r\s*e\b/.test(n) || /demonstracao do resultado/.test(n))
                                    return acumulado ? TIPOS_DOC.DRE_ACUM : TIPOS_DOC.DRE_MENSAL;
  return TIPOS_DOC.OUTRO;
}

/** Extrai "072026" ou "01a072026" do nome do arquivo. */
function extrairCompetencia_(nome) {
  var n = normalizar_(nome);
  var m = n.match(/(\d{2})\s*a\s*(\d{2})(\d{4})/);          // 01a072026
  if (m) return { inicio: m[1] + '/' + m[3], fim: m[2] + '/' + m[3], acumulado: true };
  var m2 = n.match(/(?:^|\s)(\d{2})(\d{4})(?:\s|$)/);        // 072026
  if (m2) return { inicio: m2[1] + '/' + m2[2], fim: m2[1] + '/' + m2[2], acumulado: false };
  var m3 = n.match(/(\d{2})\s*a\s*(\d{2})\b/);               // "01 a 07" (sem ano)
  if (m3) return { inicio: m3[1], fim: m3[2], acumulado: true };
  return null;
}

/**
 * Formatos que o sistema le. O .xls/.xlsx/.csv entrou quando a extracao
 * passou a ser deterministica; o PDF fica para quem ainda so tem PDF.
 */
function arquivoAceito_(f) {
  var nome = String(f.getName() || '').trim();
  if (/\.(pdf|xls|xlsx|csv)$/i.test(nome)) return true;
  // O Drive pode converter a planilha enviada em Planilha Google — e aí o
  // arquivo perde a extensão do nome. Pela extensão ele sumia da lista.
  var mime = '';
  try { mime = f.getMimeType(); } catch (e) {}
  return mime === MimeType.GOOGLE_SHEETS;
}

function listarArquivosPastaDriveApp_(pasta) {
  var out = [], it = pasta.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (!arquivoAceito_(f)) continue;
    out.push({
      id: f.getId(),
      nome: f.getName(),
      tamanho: f.getSize(),
      atualizado: f.getLastUpdated(),
      tipo: classificarArquivo_(f.getName()),
      competencia: extrairCompetencia_(f.getName())
    });
  }
  // subpastas (uma pasta por empresa, se você organizar assim)
  var sub = pasta.getFolders();
  while (sub.hasNext()) {
    var sf = sub.next();
    if (sf.getName() === CONFIG.NOME_PASTA_SAIDA) continue;
    if (sf.getName() === nomePastaArquivo_()) continue;
    var it2 = sf.getFiles();
    while (it2.hasNext()) {
      var g = it2.next();
      if (!arquivoAceito_(g)) continue;
      out.push({
        id: g.getId(), nome: g.getName(), subpasta: sf.getName(),
        tamanho: g.getSize(), atualizado: g.getLastUpdated(),
        tipo: classificarArquivo_(g.getName()),
        competencia: extrairCompetencia_(g.getName())
      });
    }
  }
  out.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return out;
}

/**
 * Casa arquivos com empresas do Cadastro.
 * Estratégia, na ordem: (1) subpasta com nome da empresa,
 * (2) código Domínio no nome, (3) similaridade de palavras do nome.
 */
// Palavras que não identificam ninguém: forma societária, ramo genérico e
// sobretudo GEOGRAFIA. Meia dúzia de clientes divide a mesma cidade.
var TOKENS_VAZIOS = ['ltda','me','epp','eireli','sa','s','a','associacao','fundacao',
  'instituto','comercio','servicos','industria','e','de','da','do','das','dos','em','the',
  'negocios','digitais','solucoes','grupo','group','holding','participacoes',
  'empreendimentos','nacional','brasil','brasileira','brasileiro'];

// Tokens FRACOS: aparecem no nome, mas não identificam ninguém sozinhos.
// Geografia (meia dúzia de clientes divide a mesma cidade) e ramo de atuação
// (dezenas de "CLINICA ..." no cadastro).
var TOKENS_FRACOS = [
  // geografia
  'salvador','bahia','feira','santana','lauro','freitas','camacari','itabuna','ilheus',
  'vitoria','conquista','juazeiro','barreiras','simoes','filho','norte','sul','leste',
  'oeste','centro','litoral','sertao','recife','fortaleza','aracaju','maceio','natal',
  'joao','pessoa','teresina','sao','paulo','rio','janeiro','minas','gerais',
  // ramo
  'clinica','clinicas','medicos','medica','medico','odonto','odontologia','estetica',
  'consultoria','engenharia','transportes','construtora','distribuidora','farmacia',
  'laboratorio','escritorio','agencia','loja','supermercado','restaurante','academia'
];

function ehTokenFraco_(t) {
  return TOKENS_FRACOS.indexOf(t) >= 0;
}

/** Tokens úteis de um nome, sem repetição. Mantém 3 letras: "BTC" identifica. */
function tokensNome_(nome) {
  var vistos = {}, out = [];
  normalizar_(nome).split(' ').forEach(function (t) {
    if (t.length < 3) return;
    if (TOKENS_VAZIOS.indexOf(t) >= 0) return;
    if (/^\d+$/.test(t)) return;          // 072026, 2025... são competências
    if (vistos[t]) return;
    vistos[t] = 1; out.push(t);
  });
  return out;
}

function agruparPorEmpresa_(arquivos, empresas) {
  var mapa = {}, soltos = [];

  var indice = empresas.map(function (e) {
    // Dedupe entre razão social e fantasia: sem isso, uma palavra presente nas
    // duas contava dobrado e inflava a pontuação (foi o que deu 51 à VIBE).
    var toks = tokensNome_(e.empresa + ' ' + (e.fantasia || ''));
    return {
      ref: e,
      tokens: toks,
      fortes: toks.filter(function (t) { return !ehTokenFraco_(t); }),
      normEmpresa: normalizar_(e.empresa),
      normFantasia: normalizar_(e.fantasia),
      cnpjDigitos: String(e.cnpjDigitos || ''),
      codigo: normalizar_(e.codigo).replace(/\s/g, '')
    };
  });

  arquivos.forEach(function (a) {
    var alvo = null, melhorScore = 0, segundoScore = 0;
    var nomeNorm = normalizar_(a.subpasta ? a.subpasta : a.nome);
    var toksArq = tokensNome_(a.subpasta ? a.subpasta : a.nome);
    var digitos = somenteDigitos_(a.nome);

    for (var i = 0; i < indice.length; i++) {
      var it = indice[i], score = 0;

      if (a.subpasta && normalizar_(a.subpasta) === it.normEmpresa) score = 100;
      else if (a.subpasta && it.normFantasia && normalizar_(a.subpasta) === it.normFantasia) score = 98;
      else if (it.cnpjDigitos && digitos.indexOf(it.cnpjDigitos) >= 0) score = 95;
      else if (it.codigo && new RegExp('(^|[^0-9])' + it.codigo + '([^0-9]|$)').test(nomeNorm)) score = 85;
      else {
        // Comparação por token inteiro, não por pedaço de palavra: antes
        // "sul" casaria dentro de "consultoria".
        var hits = 0, hitsFortes = 0, hitLongo = false;
        for (var t = 0; t < it.tokens.length; t++) {
          var tk = it.tokens[t];
          if (toksArq.indexOf(tk) < 0) continue;
          hits++;
          if (!ehTokenFraco_(tk)) { hitsFortes++; if (tk.length >= 5) hitLongo = true; }
        }
        if (!it.tokens.length || !hits) continue;

        // Nenhum token forte = só bateu cidade ou ramo. Isso não identifica
        // empresa nenhuma; o arquivo vai para "sem vínculo" e alguém decide.
        if (!hitsFortes) continue;

        // Pontua pelo que o acerto tem de DISTINTIVO, não pela fração do nome
        // que foi coberta. O critério antigo punia nome comprido: "BTC ESTETICA
        // EMPRESA EXEMPLO 3 LTDA" perdia justamente por ter mais palavras.
        score = 45
              + (hitsFortes - 1) * 15
              + (hitLongo ? 10 : 0)
              + Math.min(hits - hitsFortes, 2) * 5;
      }

      if (score > melhorScore) { segundoScore = melhorScore; melhorScore = score; alvo = it.ref; }
      else if (score > segundoScore) segundoScore = score;
    }

    var ambiguo = melhorScore < 85 && (melhorScore - segundoScore) < 10;
    if (alvo && melhorScore >= 40 && !ambiguo) {
      var k = alvo.empresa;
      if (!mapa[k]) mapa[k] = { empresa: alvo, arquivos: [], score: melhorScore };
      mapa[k].arquivos.push(a);
    } else {
      soltos.push(a);
    }
  });

  var grupos = Object.keys(mapa).map(function (k) { return mapa[k]; });
  grupos.sort(function (x, y) { return x.empresa.empresa.localeCompare(y.empresa.empresa); });
  return { grupos: grupos, semVinculo: soltos };
}

// ---------------------------------------------------------------------
// API PARA O MODAL
// ---------------------------------------------------------------------

/** Lista o conteúdo da pasta do Drive já agrupado por empresa. */
/**
 * Ultima palavra sobre a qual empresa e o documento: o CNPJ impresso dentro
 * dele. Nome de arquivo e palpite — foi por confiar nele que os documentos da
 * BTC ESTETICA foram parar na VIBE, ambas com "SALVADOR" no nome.
 * So vale para planilha, onde ler o cabecalho e instantaneo e nao gasta cota.
 */
function resolverPlanilhasPorCnpj_(ag, empresas) {
  var porCnpj = {}, porRaiz = {};
  empresas.forEach(function (e) {
    if (e.cnpjDigitos) porCnpj[e.cnpjDigitos] = e;
    if (e.cnpjRaiz) (porRaiz[e.cnpjRaiz] = porRaiz[e.cnpjRaiz] || []).push(e);
  });

  var sobraram = [];
  ag.semVinculo.forEach(function (a) {
    if (/\.pdf$/i.test(String(a.nome || ''))) { sobraram.push(a); return; }
    var det;
    try { det = identificarEmpresaNoArquivo_(a.id, a.nome); }
    catch (e) { sobraram.push(a); return; }

    var alvo = det.cnpjDigitos ? porCnpj[det.cnpjDigitos] : null;
    if (!alvo && det.cnpjRaiz && porRaiz[det.cnpjRaiz] && porRaiz[det.cnpjRaiz].length === 1) {
      alvo = porRaiz[det.cnpjRaiz][0];   // matriz/filial, sem ambiguidade
    }
    if (!alvo) { sobraram.push(a); return; }

    a.viaCnpj = true;
    var k = alvo.empresa, achou = null;
    for (var i = 0; i < ag.grupos.length; i++) {
      if (ag.grupos[i].empresa.empresa === k) { achou = ag.grupos[i]; break; }
    }
    if (achou) achou.arquivos.push(a);
    else ag.grupos.push({ empresa: alvo, arquivos: [a], score: 95 });
  });

  ag.semVinculo = sobraram;
  ag.grupos.sort(function (x, y) {
    return x.empresa.empresa.localeCompare(y.empresa.empresa);
  });
}

function apiListarDocumentosDrive() {
  exigirUso_();
  try {
    var pasta = getPastaDocumentos_();
    var arqs = listarArquivosPasta_(pasta);
    var empresas = lerCadastro_(true);
    var ag = agruparPorEmpresa_(arqs, empresas);
    resolverPlanilhasPorCnpj_(ag, empresas);

    return {
      ok: true,
      pasta: { nome: pasta.getName(), id: pasta.getId(), url: pasta.getUrl() },
      total: arqs.length,
      grupos: ag.grupos.map(function (g) {
        return {
          empresa: g.empresa.empresa,
          fantasia: g.empresa.fantasia,
          cnpj: g.empresa.cnpj,
          codigo: g.empresa.codigo,
          linha: g.empresa.linha,
          arquivos: g.arquivos.map(fmtArq_),
          completo: grupoCompleto_(g.arquivos)
        };
      }),
      semVinculo: ag.semVinculo.map(fmtArq_)
    };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    if (erroTransitorioDrive_(e)) {
      msg = 'O Drive do Google esta instavel neste momento (' + msg + '). ' +
            'Nenhum arquivo foi perdido — clique em Atualizar em alguns segundos.';
    }
    return { ok: false, erro: msg };
  }
}

function fmtArq_(a) {
  return {
    id: a.id, nome: a.nome, tipo: a.tipo, subpasta: a.subpasta || '',
    tamanhoKb: Math.round((a.tamanho || 0) / 1024),
    competencia: a.competencia ? (a.competencia.acumulado
      ? a.competencia.inicio + ' a ' + a.competencia.fim : a.competencia.fim) : ''
  };
}

/** Considera "completo" quando há pelo menos uma DRE e um Balancete. */
function grupoCompleto_(arqs) {
  var t = arqs.map(function (a) { return a.tipo; });
  var temDre = t.indexOf(TIPOS_DOC.DRE_ACUM) >= 0 || t.indexOf(TIPOS_DOC.DRE_MENSAL) >= 0;
  var temBal = t.indexOf(TIPOS_DOC.BAL_ACUM) >= 0 || t.indexOf(TIPOS_DOC.BAL_MENSAL) >= 0;
  return temDre && temBal;
}

/**
 * IDENTIFICACAO POR IA — para os arquivos que o nome nao resolveu.
 *
 * Manda cada PDF ao Gemini, que le o cabecalho e devolve nome + CNPJ.
 * O casamento com o Cadastro e feito por CNPJ (exato, sem ambiguidade);
 * se o CNPJ nao bater, tenta o nome. Uma chamada por arquivo, no modelo
 * rapido — e uma pergunta barata perto da analise completa.
 *
 * @param {Array<string>} ids  IDs dos arquivos no Drive
 * @return {{ok:boolean, resultados:Array}}
 */
function apiIdentificarEmpresas(ids) {
  exigirUso_();
  try {
    ids = ids || [];
    var todas = lerCadastro_(false);          // inclui inativas, para poder avisar
    var ativas = {};
    lerCadastro_(true).forEach(function (e) { ativas[e.linha] = true; });

    // Indices de busca. O CNPJ manda: e o unico criterio sem ambiguidade.
    var porCnpj = {}, porRaiz = {}, porNome = {}, comCnpj = 0;

    function juntar(mapa, chave, e) {
      if (!chave) return;
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(e);
    }

    todas.forEach(function (e) {
      if (e.cnpjDigitos) {
        comCnpj++;
        juntar(porCnpj, e.cnpjDigitos, e);
        juntar(porRaiz, e.cnpjRaiz, e);
      }
      juntar(porNome, normalizar_(e.empresa), e);
      juntar(porNome, normalizar_(e.fantasia), e);
    });

    var resultados = ids.map(function (id) {
      var r = { id: id, ok: false };
      try {
        var det = identificarEmpresaNoArquivo_(id);
        r.lido = { nome: det.nome, cnpj: det.cnpj, tipo: det.tipo };

        var achados = null, criterio = '';

        // 1) CNPJ completo — o caminho certo
        if (det.cnpjDigitos && porCnpj[det.cnpjDigitos]) {
          achados = porCnpj[det.cnpjDigitos];
          criterio = 'CNPJ';
        }
        // 2) raiz do CNPJ: matriz e filial so diferem nos 6 ultimos digitos
        if (!achados && det.cnpjRaiz && porRaiz[det.cnpjRaiz] && porRaiz[det.cnpjRaiz].length === 1) {
          achados = porRaiz[det.cnpjRaiz];
          criterio = 'raiz do CNPJ (matriz/filial)';
        }
        // 3) nome exato
        if (!achados && det.nome && porNome[normalizar_(det.nome)]) {
          achados = porNome[normalizar_(det.nome)];
          criterio = 'nome exato';
        }
        // 4) nome parcial, so quando houver vencedor unico
        if (!achados && det.nome) {
          var toks = tokensNome_(det.nome).filter(function (t) { return t.length >= 5; });
          if (toks.length) {
            var c = todas.filter(function (e) {
              var n = normalizar_(e.empresa) + ' ' + normalizar_(e.fantasia);
              return toks.every(function (t) { return n.indexOf(t) >= 0; });
            });
            if (c.length === 1) { achados = c; criterio = 'nome parcial'; }
            else if (c.length > 1) { r.ambiguo = c.length; }
          }
        }

        if (achados && achados.length === 1) {
          var alvo = achados[0];
          r.ok = true;
          r.criterio = criterio;
          r.inativa = !ativas[alvo.linha];
          r.empresa = { empresa: alvo.empresa, fantasia: alvo.fantasia, cnpj: alvo.cnpj,
                        codigo: alvo.codigo, linha: alvo.linha };
        } else if (achados && achados.length > 1) {
          r.erro = 'O CNPJ ' + det.cnpj + ' aparece em ' + achados.length +
                   ' linhas do Cadastro (' + achados.slice(0, 3).map(function (x) {
                     return 'linha ' + x.linha; }).join(', ') + '). Escolha a mao.';
        } else {
          r.erro = motivoNaoAchou_(det, comCnpj, todas.length, r.ambiguo);
        }
      } catch (e) {
        r.erro = String(e && e.message ? e.message : e);
      }
      return r;
    });

    return { ok: true, resultados: resultados,
             base: { empresas: todas.length, comCnpj: comCnpj } };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    if (erroTransitorioDrive_(e)) {
      msg = 'O Drive do Google esta instavel neste momento (' + msg + '). ' +
            'Nenhum arquivo foi perdido — clique em Atualizar em alguns segundos.';
    }
    return { ok: false, erro: msg };
  }
}

/** Explica, em portugues, por que o arquivo nao casou com nenhuma empresa. */
function motivoNaoAchou_(det, comCnpj, total, ambiguo) {
  if (!det.nome && !det.cnpjDigitos) {
    return 'Nao consegui ler nem o nome nem o CNPJ neste documento.';
  }
  var p = ['Li no PDF: ' + (det.nome || '(sem nome)') + ' — ' + (det.cnpj || 'sem CNPJ') + '.'];
  if (det.cnpjDigitos) {
    p.push('Esse CNPJ nao existe no Cadastro (' + comCnpj + ' das ' + total +
           ' empresas tem CNPJ preenchido).');
  } else {
    p.push('O CNPJ nao saiu legivel, entao so restaria casar pelo nome.');
  }
  if (ambiguo) p.push('O nome bateu com ' + ambiguo + ' empresas diferentes.');
  return p.join(' ');
}

/**
 * Diagnostico de um arquivo so: mostra o que a IA leu, como esta o indice
 * de CNPJs do Cadastro e se houve casamento. Serve para descobrir onde a
 * identificacao esta quebrando sem precisar adivinhar.
 */
function apiDiagnosticarIdentificacao(fileId) {
  exigirUso_();
  try {
    var L = [];
    var todas = lerCadastro_(false);
    var comCnpj = todas.filter(function (e) { return !!e.cnpjDigitos; });

    L.push('CADASTRO');
    L.push('  linhas com empresa .... ' + todas.length);
    L.push('  com CNPJ utilizavel ... ' + comCnpj.length);
    L.push('  exemplos .............. ' + comCnpj.slice(0, 3).map(function (e) {
             return e.cnpjDigitos; }).join(', '));
    L.push('');

    if (!fileId) {
      var pasta = getPastaDocumentos_();
      var arqs = listarArquivosPasta_(pasta);
      if (!arqs.length) { L.push('Nenhum PDF na pasta para testar.'); return { ok: true, texto: L.join('\n') }; }
      fileId = arqs[0].id;
      L.push('Testando com o primeiro PDF da pasta: ' + arqs[0].nome);
      L.push('');
    }

    var det = identificarEmpresaNoArquivo_(fileId);
    L.push('O QUE A IA LEU NO PDF');
    L.push('  nome .................. ' + (det.nome || '(vazio)'));
    L.push('  CNPJ .................. ' + (det.cnpj || '(vazio)'));
    L.push('  CNPJ em digitos ....... ' + (det.cnpjDigitos || '(vazio)'));
    L.push('  tipo .................. ' + (det.tipo || '(vazio)'));
    L.push('');

    L.push('COMPARACAO');
    if (!det.cnpjDigitos) {
      L.push('  A IA nao devolveu CNPJ — sem isso nao da para casar com seguranca.');
    } else {
      var exato = comCnpj.filter(function (e) { return e.cnpjDigitos === det.cnpjDigitos; });
      var raiz  = comCnpj.filter(function (e) { return e.cnpjRaiz === det.cnpjRaiz; });
      L.push('  CNPJ exato no Cadastro ... ' + (exato.length ? exato.map(function (e) {
               return e.empresa + ' (linha ' + e.linha + ')'; }).join('; ') : 'NAO ENCONTRADO'));
      L.push('  mesma raiz (' + det.cnpjRaiz + ') ..... ' + (raiz.length ? raiz.map(function (e) {
               return e.empresa + ' ' + e.cnpj; }).join('; ') : 'nenhuma'));
    }
    return { ok: true, texto: L.join('\n') };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    if (erroTransitorioDrive_(e)) {
      msg = 'O Drive do Google esta instavel neste momento (' + msg + '). ' +
            'Nenhum arquivo foi perdido — clique em Atualizar em alguns segundos.';
    }
    return { ok: false, erro: msg };
  }
}

/**
 * Recebe um arquivo enviado pelo modal (base64) e grava no Drive.
 * @param {{nome:string, mime:string, dados:string, subpasta:string}} arq
 */
function apiUploadArquivo(arq) {
  exigirUso_();
  try {
    var pasta = getPastaDocumentos_();
    if (arq.subpasta) {
      var it = pasta.getFoldersByName(arq.subpasta);
      pasta = it.hasNext() ? it.next() : pasta.createFolder(arq.subpasta);
    }
    var bytes = Utilities.base64Decode(arq.dados);
    // Alguns navegadores mandam mime vazio para .xls antigo; nesse caso o tipo
    // sai da extensao, senao o arquivo entrava no Drive marcado como PDF.
    var n = String(arq.nome || '').toLowerCase();
    var mimePadrao = /\.xlsx$/.test(n) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                   : /\.xls$/.test(n)  ? 'application/vnd.ms-excel'
                   : /\.csv$/.test(n)  ? 'text/csv'
                   : MimeType.PDF;
    var blob = Utilities.newBlob(bytes, arq.mime || mimePadrao, arq.nome);
    var f = pasta.createFile(blob);
    return {
      ok: true,
      arquivo: fmtArq_({
        id: f.getId(), nome: f.getName(), tamanho: f.getSize(),
        subpasta: arq.subpasta || '',
        tipo: classificarArquivo_(f.getName()),
        competencia: extrairCompetencia_(f.getName())
      })
    };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    if (erroTransitorioDrive_(e)) {
      msg = 'O Drive do Google esta instavel neste momento (' + msg + '). ' +
            'Nenhum arquivo foi perdido — clique em Atualizar em alguns segundos.';
    }
    return { ok: false, erro: msg };
  }
}


/** ===================================================================
 *  ARQUIVAMENTO AUTOMATICO DOS DOCUMENTOS USADOS NA GERACAO
 *  Cria  <Documentos Arquivados>/<EMPRESA> - AAAA-MM-DD  e move para la
 *  todos os arquivos que alimentaram o relatorio, para que a pasta de
 *  leitura nao seja relida desnecessariamente.
 * =================================================================== */

function nomePastaArquivo_() {
  return (CONFIG && CONFIG.NOME_PASTA_ARQUIVO) || 'Documentos Arquivados';
}

function nomeSubpastaArquivo_(nomeEmpresa, quando) {
  var tz = Session.getScriptTimeZone() || 'America/Bahia';
  var data = Utilities.formatDate(quando || new Date(), tz, 'yyyy-MM-dd');
  var limpo = String(nomeEmpresa || 'EMPRESA')
    .replace(/[\\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo.length > 80) limpo = limpo.slice(0, 80).trim();
  if (!limpo) limpo = 'EMPRESA';
  return limpo + ' - ' + data;
}

function subpastaPorNome_(pai, nome) {
  var paiId = pai.getId();
  try {
    var esc = String(nome).replace(/'/g, "\\'");
    var r = comRetryDrive_(function () {
      return Drive.Files.list({
        q: "'" + paiId + "' in parents and trashed = false and mimeType = '" + MIME_PASTA_ + "' and name = '" + esc + "'",
        fields: 'files(id,name)', pageSize: 10,
        supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives'
      });
    });
    var fs = (r && r.files) || [];
    if (fs.length) return pastaPorId_(fs[0].id);
    var criada = comRetryDrive_(function () {
      return Drive.Files.create(
        { name: nome, mimeType: MIME_PASTA_, parents: [paiId] },
        null,
        { supportsAllDrives: true, fields: 'id' }
      );
    });
    return pastaPorId_(criada.id);
  } catch (e) {
    var it = pai.getFoldersByName(nome);
    return it.hasNext() ? it.next() : pai.createFolder(nome);
  }
}

function getPastaArquivo_() {
  return subpastaPorNome_(getPastaDocumentos_(), nomePastaArquivo_());
}

function pastaDoArquivamento_(nomeEmpresa, quando) {
  return subpastaPorNome_(getPastaArquivo_(), nomeSubpastaArquivo_(nomeEmpresa, quando));
}

function moverArquivoParaPasta_(fileId, destino) {
  var destinoId = destino.getId();
  try {
    var meta = comRetryDrive_(function () { return Drive.Files.get(fileId, { fields: 'parents', supportsAllDrives: true }); });
    var pais = (meta && meta.parents) || [];
    var remover = [];
    for (var i = 0; i < pais.length; i++) { if (pais[i] !== destinoId) remover.push(pais[i]); }
    if (!remover.length && pais.length) return true;
    var opts = { addParents: destinoId, supportsAllDrives: true, fields: 'id, parents' };
    if (remover.length) opts.removeParents = remover.join(',');
    comRetryDrive_(function () { return Drive.Files.update({}, fileId, null, opts); });
    return true;
  } catch (e) {
    var f = arquivoPorId_(fileId);
    destino.addFile(f);
    var it = f.getParents();
    while (it.hasNext()) {
      var p = it.next();
      if (p.getId() !== destinoId) { try { p.removeFile(f); } catch (e2) {} }
    }
    return true;
  }
}

function arquivarDocumentosUsados_(arquivos, nomeEmpresa, quando) {
  var lista = (arquivos || []).map(function (a) {
    if (!a) return null;
    if (typeof a === 'string') return { id: a, nome: a };
    return { id: a.id || a.fileId || a.ID || '', nome: a.nome || a.name || '' };
  }).filter(function (a) { return a && a.id; });

  if (!lista.length) return { ok: true, movidos: 0, total: 0, pasta: '', pastaUrl: '', erros: [] };

  var destino = pastaDoArquivamento_(nomeEmpresa, quando || new Date());
  var movidos = 0, erros = [], vistos = {};
  for (var i = 0; i < lista.length; i++) {
    var id = lista[i].id;
    if (vistos[id]) continue;
    vistos[id] = true;
    try { moverArquivoParaPasta_(id, destino); movidos++; }
    catch (e) { erros.push((lista[i].nome || id) + ': ' + (e && e.message ? e.message : e)); }
  }
  return {
    ok: erros.length === 0,
    movidos: movidos,
    total: Object.keys(vistos).length,
    pasta: destino.getName(),
    pastaId: destino.getId(),
    pastaUrl: destino.getUrl(),
    erros: erros
  };
}



/** ===================================================================
 *  LEITURA DE PASTAS VIA DRIVE API v3
 *  O DriveApp falha com "Service error: Drive" ao percorrer iteradores
 *  dentro de Drive Compartilhado. A API avancada e estavel e mais rapida
 *  (2 chamadas em vez de N idas e voltas).
 * =================================================================== */

var MIME_PASTA_ = 'application/vnd.google-apps.folder';
var MIME_PLANILHA_GOOGLE_ = 'application/vnd.google-apps.spreadsheet';

function driveFilhos_(pastaId) {
  var out = [], token = null, voltas = 0;
  do {
    var args = {
      q: "'" + pastaId + "' in parents and trashed = false",
      fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime)',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives'
    };
    if (token) args.pageToken = token;
    var r = comRetryDrive_(function () { return Drive.Files.list(args); });
    out = out.concat((r && r.files) || []);
    token = r && r.nextPageToken;
  } while (token && ++voltas < 20);
  return out;
}

function arquivoAceitoMeta_(nome, mime) {
  var n = String(nome || '').trim();
  if (/\.(pdf|xls|xlsx|csv)$/i.test(n)) return true;
  return mime === MIME_PLANILHA_GOOGLE_;
}

function itemDeMeta_(f, nomeSubpasta) {
  var o = {
    id: f.id,
    nome: f.name,
    tamanho: Number(f.size || 0),
    atualizado: f.modifiedTime ? new Date(f.modifiedTime) : new Date(),
    tipo: classificarArquivo_(f.name),
    competencia: extrairCompetencia_(f.name)
  };
  if (nomeSubpasta) o.subpasta = nomeSubpasta;
  return o;
}

function listarArquivosPasta_(pasta) {
  try {
    var raizId = pasta.getId();
    var out = [], subpastas = [];
    var filhos = driveFilhos_(raizId);
    for (var i = 0; i < filhos.length; i++) {
      var f = filhos[i];
      if (f.mimeType === MIME_PASTA_) { subpastas.push(f); continue; }
      if (!arquivoAceitoMeta_(f.name, f.mimeType)) continue;
      out.push(itemDeMeta_(f, ''));
    }
    for (var j = 0; j < subpastas.length; j++) {
      var sf = subpastas[j];
      if (sf.name === CONFIG.NOME_PASTA_SAIDA) continue;
      if (sf.name === nomePastaArquivo_()) continue;
      var netos = driveFilhos_(sf.id);
      for (var n = 0; n < netos.length; n++) {
        var g = netos[n];
        if (g.mimeType === MIME_PASTA_) continue;
        if (!arquivoAceitoMeta_(g.name, g.mimeType)) continue;
        out.push(itemDeMeta_(g, sf.name));
      }
    }
    return out;
  } catch (e) {
    // se a API avancada cair, ainda tentamos pelo caminho antigo
    return listarArquivosPastaDriveApp_(pasta);
  }
}


/** ===================================================================
 *  O Drive do Google devolve "Service error: Drive" de forma
 *  intermitente (falha uma chamada, a seguinte passa). Sem repetir a
 *  chamada, a tela inteira quebra por um soluco de alguns segundos.
 * =================================================================== */

function erroTransitorioDrive_(e) {
  var msg = String((e && e.message) || e || '');
  return /service error|internal error|erro de servi|backend error|try again|rate limit|quota exceeded|timed out|temporariamente/i.test(msg);
}

function comRetryDrive_(fn, tentativas) {
  var n = tentativas || 5, ultimo = null;
  for (var i = 0; i < n; i++) {
    try { return fn(); }
    catch (e) {
      ultimo = e;
      if (!erroTransitorioDrive_(e) || i === n - 1) throw e;
      Utilities.sleep(900 * (i + 1) + Math.floor(Math.random() * 500));
    }
  }
  throw ultimo;
}

function arquivoPorId_(id) {
  var alvo = String(id || '').trim();
  return comRetryDrive_(function () { return DriveApp.getFileById(alvo); });
}

function pastaPorId_(id) {
  var alvo = String(id || '').trim();
  return comRetryDrive_(function () { return DriveApp.getFolderById(alvo); });
}
