/**
 * Arquivo: 05_Indicadores.gs
 * Consolidação determinística dos números (tudo que vai como NÚMERO
 * para os slides é calculado aqui, não pelo modelo).
 */

// Blocos de despesa — classificação por palavra-chave no nome da conta.
var BLOCOS_DESPESA = [
  { chave: 'pessoal',   rotulo: 'Pessoal e encargos',
    termos: ['salario','salarios','ordenado','13','decimo terceiro','ferias','inss','fgts',
             'indenizacao','aviso previo','vale transporte','pis s folha','pis sobre folha',
             'alimentacao','refeicao','lanche','vale refeicao','assistencia medica','plano de saude',
             'pro labore','prolabore','estagiario','autonomo','rescisao','multa trabalhista',
             'fardamento','uniforme','beneficio','encargos'] },
  { chave: 'ocupacao',  rotulo: 'Custo de ocupação',
    termos: ['aluguel','locacao de imovel','condominio','iptu','energia eletrica','agua e esgoto',
             'agua','telefone','internet','limpeza','conservacao','vigilancia','seguranca',
             'manutencao e reparo','higiene e limpeza','seguros'] },
  { chave: 'deprec',    rotulo: 'Depreciação e amortização',
    termos: ['depreciac','amortizac','exaust'] },
  { chave: 'terceiros', rotulo: 'Serviços de terceiros',
    termos: ['servicos prestados por terceiros','servico prestado','assistencia contabil',
             'consultoria','advocaticio','juridico','honorarios','auditoria','marketing',
             'propaganda','publicidade','software','sistema','licenca de uso'] },
  { chave: 'tributos',  rotulo: 'Impostos e taxas',
    termos: ['imposto','iss','icms','cofins','irpj','csll','taxas','taxa','tributo',
             'ir s aplicacao','ir sobre','multa','simples nacional','contribuicao sindical'] },
  { chave: 'financeiro',rotulo: 'Despesas financeiras',
    termos: ['tarifa bancaria','juros','desconto concedido','iof','despesa financeira'] }
];

function classificarDespesa_(conta) {
  var n = normalizar_(conta);
  for (var i = 0; i < BLOCOS_DESPESA.length; i++) {
    var b = BLOCOS_DESPESA[i];
    for (var j = 0; j < b.termos.length; j++) {
      if (n.indexOf(b.termos[j]) >= 0) return b.chave;
    }
  }
  return 'demais';
}

/**
 * Recebe o JSON de extração e devolve todos os indicadores derivados.
 */
function calcularIndicadores_(d) {
  var da = d.dre_acumulado, b = d.balancete;
  var meses = Math.max(1, Number(d.empresa.meses_no_periodo) || contarMeses_(d) || 1);

  var receita  = da.receita_total || somar_(da.receitas);
  var despesa  = da.despesa_total || somar_(da.despesas);
  var resultado = (da.resultado_liquido !== 0) ? da.resultado_liquido : (receita - despesa);
  var deficit  = resultado < 0;

  // --- blocos de despesa -------------------------------------------
  var blocos = {}, rotulos = {};
  BLOCOS_DESPESA.forEach(function (x) { blocos[x.chave] = 0; rotulos[x.chave] = x.rotulo; });
  blocos.demais = 0; rotulos.demais = 'Demais despesas';

  da.despesas.forEach(function (c) { blocos[classificarDespesa_(c.conta)] += c.valor; });

  var pessoal   = blocos.pessoal;
  var ocupacao  = blocos.ocupacao;
  var terceiros = blocos.terceiros;
  var fixo      = pessoal + ocupacao;

  // Dois recortes diferentes, com nomes distintos para não se confundirem:
  //  - "nao_classificado": o que sobra depois de TODOS os blocos (soma dos
  //    blocos + este = despesa total; é o recorte enviado ao Gemini);
  //  - "demais_alem_fixo": tudo que não é pessoal nem ocupação (é o que a
  //    barra do slide 5 mostra, ao lado dos dois blocos de custo fixo).
  var somaBlocos = pessoal + ocupacao + terceiros + blocos.tributos +
                   blocos.financeiro + blocos.deprec;
  var naoClassificado = Math.max(0, despesa - somaBlocos);
  var demaisAlemFixo  = Math.max(0, despesa - fixo);

  // --- balanço -------------------------------------------------------
  var ac  = b.ativo_circulante || (b.disponibilidades + b.contas_a_receber + b.outros_creditos + b.estoques);
  var pc  = b.passivo_circulante ||
            (b.fornecedores + b.obrigacoes_trabalhistas + b.obrigacoes_tributarias +
             b.emprestimos_curto_prazo + b.outras_obrigacoes);
  var disp = b.disponibilidades_fim_periodo || b.disponibilidades;
  var dispIni = b.disponibilidades_inicio_periodo;
  // Sem o saldo de abertura não há como falar em variação nem em consumo de
  // caixa. Marcamos como desconhecido e zeramos os derivados, em vez de
  // tratar 0 como "começou sem dinheiro" — o que inflaria tudo.
  var caixaInicioConhecido = dispIni > 0;
  var ativo = b.ativo_total || (ac + b.ativo_nao_circulante);
  var passivoTerceiros = pc + b.passivo_nao_circulante;
  var pl = b.patrimonio_liquido;

  var liqCorrente  = pc > 0 ? ac / pc : 0;
  var liqImediata  = pc > 0 ? disp / pc : 0;
  var ccl          = ac - pc;
  var endividamento = ativo > 0 ? passivoTerceiros / ativo : 0;
  var plSobreAtivo  = ativo > 0 ? pl / ativo : 0;
  var margemLiquida = receita > 0 ? resultado / receita : 0;
  var roa           = ativo > 0 ? resultado / ativo : 0;
  var coberturaReceita = despesa > 0 ? receita / despesa : 0;

  var despesaMes = despesa / meses;
  var mesesReserva = despesaMes > 0 ? disp / despesaMes : 0;

  var variacaoCaixa = caixaInicioConhecido ? (disp - dispIni) : 0;
  var consumoMensalCaixa = caixaInicioConhecido ? (variacaoCaixa / meses) : 0;
  var mesesAteEsgotar = (consumoMensalCaixa < 0) ? disp / Math.abs(consumoMensalCaixa) : 0;

  var emprestimos = b.emprestimos_curto_prazo + b.emprestimos_longo_prazo;

  // --- listas para os slides -----------------------------------------
  var listaReceita = topN_(da.receitas, CONFIG.MAX_LINHAS_RECEITA, receita);
  var listaDespesa = topN_(da.despesas, CONFIG.MAX_LINHAS_DESPESA, despesa);

  // --- série mensal (Análise Horizontal) ------------------------------
  var serie = serieMensal_(d);

  // --- reconciliação de caixa ----------------------------------------
  var recon = [];
  if (caixaInicioConhecido) {
    recon.push({ rotulo: 'Disponibilidades no início do período', valor: dispIni, tipo: 'saldo' });
    recon.push({ rotulo: (deficit ? 'Déficit do período' : 'Superávit do período'), valor: resultado, tipo: 'mov' });
    if (b.depreciacao_periodo > 0) {
      recon.push({ rotulo: 'Depreciação (despesa sem caixa)', valor: b.depreciacao_periodo, tipo: 'mov' });
    }
    var residual = disp - (dispIni + resultado + b.depreciacao_periodo);
    if (Math.abs(residual) >= 0.01) {
      recon.push({ rotulo: 'Variações patrimoniais e demais ajustes', valor: residual, tipo: 'mov' });
    }
  }
  recon.push({ rotulo: 'Disponibilidades na data-base', valor: disp, tipo: 'saldo' });

  // --- divergência DRE x Balancete ------------------------------------
  var divergencia = 0;
  if (b.resultado_do_exercicio !== 0) divergencia = b.resultado_do_exercicio - resultado;

  return {
    meses: meses,
    receita_total: receita,
    despesa_total: despesa,
    resultado: resultado,
    deficit: deficit,
    receita_media_mes: receita / meses,
    despesa_media_mes: despesa / meses,
    resultado_medio_mes: resultado / meses,
    margem_liquida: margemLiquida,
    cobertura_receita_sobre_despesa: coberturaReceita,

    bloco_pessoal: pessoal,
    bloco_ocupacao: ocupacao,
    bloco_terceiros: terceiros,
    bloco_tributos: blocos.tributos,
    bloco_financeiro: blocos.financeiro,
    bloco_depreciacao: blocos.deprec,
    bloco_nao_classificado: naoClassificado,
    bloco_demais: demaisAlemFixo,
    custo_fixo: fixo,
    custo_fixo_sobre_receita: receita > 0 ? fixo / receita : 0,
    pessoal_sobre_receita: receita > 0 ? pessoal / receita : 0,
    ocupacao_sobre_receita: receita > 0 ? ocupacao / receita : 0,

    ativo_total: ativo,
    ativo_circulante: ac,
    passivo_circulante: pc,
    passivo_nao_circulante: b.passivo_nao_circulante,
    passivo_terceiros: passivoTerceiros,
    patrimonio_liquido: pl,
    disponibilidades: disp,
    caixa_inicio_conhecido: caixaInicioConhecido,
    disponibilidades_inicio: dispIni,
    variacao_caixa: variacaoCaixa,
    consumo_mensal_caixa: consumoMensalCaixa,
    meses_ate_esgotar: mesesAteEsgotar,
    meses_reserva: mesesReserva,
    emprestimos: emprestimos,

    liquidez_corrente: liqCorrente,
    liquidez_imediata: liqImediata,
    capital_circulante_liquido: ccl,
    endividamento_geral: endividamento,
    pl_sobre_ativo: plSobreAtivo,
    roa: roa,

    concentracao_receita: listaReceita.length ? listaReceita[0].pct : 0,
    principal_fonte_receita: listaReceita.length ? listaReceita[0].conta : '',

    lista_receita: listaReceita,
    lista_despesa: listaDespesa,
    reconciliacao_caixa: recon,
    serie_mensal: serie,
    divergencia_dre_balancete: divergencia
  };
}

function somar_(lista) {
  return (lista || []).reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
}

/**
 * Top N contas. Se sobrarem contas fora do corte, a ÚLTIMA das N linhas
 * vira "Outras contas (x)" agregando o restante — assim o total sempre
 * fecha e nunca há mais de N linhas para o slide.
 */
function topN_(lista, n, total) {
  var l = (lista || []).slice().sort(function (a, b) { return b.valor - a.valor; });
  var top, resto;
  if (l.length > n) { top = l.slice(0, n - 1); resto = l.slice(n - 1); }
  else              { top = l.slice(0); resto = []; }
  if (resto.length) {
    var soma = somar_(resto);
    if (soma > 0) top.push({ conta: 'Outras contas (' + resto.length + ')', grupo: '', valor: soma });
  }
  var base = total || somar_(l);
  return top.map(function (x) {
    return { conta: x.conta, valor: x.valor, pct: base > 0 ? x.valor / base : 0 };
  });
}

function contarMeses_(d) {
  var ini = parseDataBr_(d.empresa.periodo_inicio), fim = parseDataBr_(d.empresa.periodo_fim);
  if (!ini || !fim) return 0;
  return (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth()) + 1;
}

/** Totaliza receita e despesa mês a mês a partir da Análise Horizontal. */
function serieMensal_(d) {
  var ah = d.analise_horizontal;
  if (!ah.meses || !ah.meses.length) return [];
  var out = ah.meses.map(function (m) { return { mes: m, receita: 0, despesa: 0, resultado: 0 }; });
  ah.linhas.forEach(function (l) {
    for (var i = 0; i < out.length; i++) {
      var v = Math.abs(Number(l.valores[i]) || 0);
      if (!v) continue;
      if (l.natureza === 'receita') out[i].receita += v; else out[i].despesa += v;
    }
  });
  out.forEach(function (o) { o.resultado = o.receita - o.despesa; });
  // descarta meses ainda sem movimento no fim da série
  while (out.length && out[out.length - 1].receita === 0 && out[out.length - 1].despesa === 0) out.pop();
  return out;
}
