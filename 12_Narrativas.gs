/**
 * Arquivo: 12_Narrativas.gs
 * Textos do relatorio montados por REGRAS, a partir dos indicadores que o
 * Apps Script ja calcula. Nenhuma chamada de IA.
 *
 * Por que regras servem aqui: os numeros que importam — liquidez,
 * endividamento, margem, concentracao, queima de caixa — ja saem prontos e
 * corretos de calcularIndicadores_. O que faltava era vestir isso de frase.
 * Regra tem uma vantagem que num relatorio contabil pesa: os mesmos numeros
 * produzem sempre o mesmo texto. Nada de o relatorio de marco chamar uma
 * liquidez de 2,6 de "confortavel" e o de abril chamar a mesma coisa de
 * "robusta".
 *
 * A saida tem exatamente o formato de gerarAnalise_, entao montarTags_ nao
 * muda uma linha.
 */

/** Faixa em que um valor cai, dada uma lista [limite, rotulo] crescente. */
function faixa_(valor, faixas, padrao) {
  for (var i = 0; i < faixas.length; i++) {
    if (valor < faixas[i][0]) return faixas[i][1];
  }
  return padrao;
}

/** Nome legivel dos blocos de despesa que o motor de indicadores classifica. */
var ROTULO_BLOCO = {
  bloco_pessoal        : 'pessoal',
  bloco_ocupacao       : 'ocupação',
  bloco_terceiros      : 'serviços de terceiros',
  bloco_tributos       : 'tributos',
  bloco_financeiro     : 'despesas financeiras',
  bloco_depreciacao    : 'depreciação',
  bloco_demais         : 'demais despesas',
  bloco_nao_classificado: 'despesas não classificadas'
};

/** Maior bloco de despesa e quanto ele pesa sobre a receita. */
function maiorBloco_(k) {
  var melhor = { chave: '', rotulo: '', valor: 0 };
  Object.keys(ROTULO_BLOCO).forEach(function (ch) {
    var v = Number(k[ch] || 0);
    if (v > melhor.valor) melhor = { chave: ch, rotulo: ROTULO_BLOCO[ch], valor: v };
  });
  melhor.sobre_receita = k.receita_total > 0 ? melhor.valor / k.receita_total * 100 : 0;
  return melhor;
}

/**
 * Monta todas as narrativas do relatorio.
 * @param {Object} dados  pacote do leitor (ou da extracao por IA)
 * @param {Object} k      indicadores calculados
 * @param {string} nomeEmpresa
 * @param {string} periodoExt
 * @return {Object} mesmo formato de gerarAnalise_
 */
function gerarAnalisePorRegras_(dados, k, nomeEmpresa, periodoExt) {
  var a = {};
  var bloco = maiorBloco_(k);
  var lucro = Number(k.resultado || 0);

  // ATENCAO A ESCALA: calcularIndicadores_ guarda as razoes como FRACAO
  // (0,319 = 31,9%), e os slides aplicam pct_() na hora de exibir. Aqui as
  // frações são convertidas uma unica vez, na entrada, para que os limiares e
  // os textos falem a mesma lingua dos numeros mostrados no relatorio.
  var emPct = function (x) { return Number(x || 0) * 100; };

  var margem   = emPct(k.margem_liquida);
  var endiv    = emPct(k.endividamento_geral);
  var plAtivo  = emPct(k.pl_sobre_ativo);
  var conc     = emPct(k.concentracao_receita);
  var roaPct   = emPct(k.roa);
  var fixoPct  = emPct(k.custo_fixo_sobre_receita);
  var pessoalPct = emPct(k.pessoal_sobre_receita);
  var liq = Number(k.liquidez_corrente || 0);
  var varCaixa = Number(k.variacao_caixa || 0);

  // ---------------------------------------------------------------- titulos
  a.titulo_receita = k.principal_fonte_receita
    ? (k.principal_fonte_receita + ' responde por ' + num_(conc, 1) + '% da receita')
    : 'Composição da receita no período';

  a.titulo_despesas = bloco.rotulo
    ? ('Maior peso em ' + bloco.rotulo + ': ' + num_(bloco.sobre_receita, 1) + '% da receita')
    : 'Onde o dinheiro é aplicado';

  a.titulo_diagnostico = lucro >= 0
    ? ('Resultado positivo de ' + moeda_(lucro) + ' no período')
    : ('Prejuízo de ' + moeda_(Math.abs(lucro)) + ' no período');

  a.titulo_caixa = varCaixa >= 0
    ? ('Disponibilidades sobem para ' + moeda_(k.disponibilidades))
    : ('Disponibilidades caem para ' + moeda_(k.disponibilidades));

  // ----------------------------------------------------------- visao geral
  a.texto_visao_geral =
    'Em ' + periodoExt + ', a ' + nomeEmpresa + ' registrou receita de '
    + moeda_(k.receita_total) + ' e despesas de ' + moeda_(k.despesa_total) + ', '
    + (lucro >= 0 ? 'fechando com lucro de ' : 'fechando com prejuízo de ')
    + moeda_(Math.abs(lucro)) + ' — margem de ' + num_(margem, 1) + '%. '
    + 'A média mensal foi de ' + moeda_(k.receita_media_mes) + ' de receita contra '
    + moeda_(k.despesa_media_mes) + ' de despesa. '
    + 'O patrimônio líquido responde por ' + num_(plAtivo, 1) + '% do ativo total de '
    + moeda_(k.ativo_total) + '.';

  // -------------------------------------------------------------- receitas
  a.leitura_receita = [];
  (k.lista_receita || []).slice(0, 3).forEach(function (r) {
    var pct = k.receita_total > 0 ? (r.valor / k.receita_total * 100) : 0;
    a.leitura_receita.push(r.conta + ': ' + moeda_(r.valor) + ' (' + num_(pct, 1) + '% do total)');
  });
  if (conc >= 80) {
    a.leitura_receita.push('Concentração de ' + num_(conc, 1)
      + '% numa única fonte — a receita depende fortemente dela.');
  }

  // -------------------------------------------------------------- despesas
  a.leitura_despesas = [];
  (k.lista_despesa || []).slice(0, 3).forEach(function (d) {
    var pct = k.receita_total > 0 ? (d.valor / k.receita_total * 100) : 0;
    a.leitura_despesas.push(d.conta + ': ' + moeda_(d.valor) + ' (' + num_(pct, 1) + '% da receita)');
  });
  if (pessoalPct > 0) {
    a.leitura_despesas.push('Pessoal consome ' + num_(pessoalPct, 1)
      + '% da receita; custo fixo total em ' + num_(fixoPct, 1) + '%.');
  }

  // ------------------------------------------------------------ diagnostico
  a.diagnostico_percentual = num_(margem, 1) + '%';
  a.diagnostico_legenda = 'MARGEM LÍQUIDA';

  a.texto_diagnostico_1 =
    'Cada R$ 100 de receita deixaram R$ ' + num_(margem, 2)
    + ' de resultado. As despesas consumiram ' + num_(100 - margem, 1) + '% do faturamento, '
    + 'e o maior peso está em ' + (bloco.rotulo || 'despesas gerais') + ' ('
    + moeda_(bloco.valor) + ').';

  a.texto_diagnostico_2 = (function () {
    if (margem < 0) {
      return 'A operação não se paga no período: as despesas superaram a receita em '
        + moeda_(Math.abs(lucro)) + '. Enquanto isso não se inverter, o resultado vem do caixa '
        + 'acumulado ou de aporte, não da atividade.';
    }
    if (margem < 5) {
      return 'A margem é estreita: uma variação pequena na receita ou nos custos vira prejuízo. '
        + 'Vale tratar o custo fixo de ' + num_(fixoPct, 1)
        + '% da receita como a variável a monitorar de perto.';
    }
    if (margem < 15) {
      return 'A margem é saudável, mas sem folga grande. O custo fixo em '
        + num_(fixoPct, 1) + '% da receita é o que define o ponto de equilíbrio.';
    }
    return 'A margem é confortável e dá espaço para investimento ou formação de reserva. '
      + 'O custo fixo em ' + num_(fixoPct, 1) + '% da receita deixa folga operacional.';
  })();

  // ---------------------------------------------------------------- balanco
  a.texto_balanco =
    'O ativo total é de ' + moeda_(k.ativo_total) + ', dos quais '
    + moeda_(k.ativo_circulante) + ' em circulante. O passivo com terceiros soma '
    + moeda_(k.passivo_terceiros) + ', o que põe o endividamento em ' + num_(endiv, 1)
    + '% do ativo. A liquidez corrente está em ' + num_(liq, 2)
    + ' — ' + faixa_(liq, [[1, 'o circulante não cobre as obrigações de curto prazo'],
                           [1.5, 'cobertura apertada das obrigações de curto prazo'],
                           [2.5, 'cobertura adequada das obrigações de curto prazo']],
                     'folga larga sobre as obrigações de curto prazo')
    + '. O capital circulante líquido é de ' + moeda_(k.capital_circulante_liquido) + '.';

  // ------------------------------------------------------------------ caixa
  a.texto_caixa_1 =
    'As disponibilidades saíram de ' + moeda_(k.disponibilidades_inicio) + ' para '
    + moeda_(k.disponibilidades) + ' no período, '
    + (varCaixa >= 0 ? 'um acréscimo de ' : 'uma redução de ') + moeda_(Math.abs(varCaixa)) + '.';

  a.texto_caixa_2 = (function () {
    var folga = Number(k.meses_ate_esgotar || 0);
    if (varCaixa < 0 && folga > 0) {
      // Dizer "convem acompanhar de perto" para quem tem 46 meses de folga
      // e alarme falso — e alarme falso repetido faz o leitor ignorar o real.
      var leitura = folga < 6 ? ' Isso é curto: exige ação já.'
                  : (folga < 12 ? ' Convém acompanhar de perto.'
                                : ' É uma folga larga, sem urgência.');
      return 'No ritmo de consumo do período — ' + moeda_(k.consumo_mensal_caixa)
        + ' por mês — o saldo atual cobre cerca de ' + num_(folga, 1) + ' meses.' + leitura;
    }
    if (Number(k.meses_reserva || 0) > 0) {
      return 'O saldo atual equivale a ' + num_(k.meses_reserva, 1)
        + ' meses de despesa — é a reserva que a empresa tem para atravessar uma queda de receita.';
    }
    return 'O caixa acompanhou o resultado do período sem descolamento relevante.';
  })();

  // ------------------------------------------------------------- saude geral
  var notas = [];
  notas.push(liq >= 1.5 ? 1 : (liq >= 1 ? 0 : -1));
  notas.push(endiv <= 40 ? 1 : (endiv <= 70 ? 0 : -1));
  notas.push(margem >= 10 ? 1 : (margem >= 0 ? 0 : -1));
  notas.push(varCaixa >= 0 ? 1 : 0);
  notas.push(conc <= 70 ? 1 : 0);
  var soma = notas.reduce(function (x, y) { return x + y; }, 0);
  a.classificacao_geral = soma >= 4 ? 'Saudável'
    : (soma >= 2 ? 'Estável' : (soma >= 0 ? 'Atenção' : 'Crítica'));

  a.saude = [
    { dimensao: 'Liquidez', texto: 'Liquidez corrente de ' + num_(liq, 2) + '. '
      + faixa_(liq, [[1, 'Abaixo de 1: obrigações de curto prazo maiores que o circulante.'],
                     [1.5, 'Entre 1 e 1,5: cobre, mas sem folga.'],
                     [2.5, 'Entre 1,5 e 2,5: confortável.']], 'Acima de 2,5: folga ampla.') },
    { dimensao: 'Endividamento', texto: 'Capital de terceiros em ' + num_(endiv, 1) + '% do ativo. '
      + faixa_(endiv, [[40, 'Estrutura pouco alavancada.'],
                       [70, 'Alavancagem moderada.']], 'Dependência alta de terceiros.') },
    { dimensao: 'Rentabilidade', texto: 'Margem líquida de ' + num_(margem, 1)
      + '% e retorno sobre o ativo de ' + num_(roaPct, 1) + '%.' },
    { dimensao: 'Caixa', texto: (varCaixa >= 0 ? 'Geração' : 'Consumo') + ' de caixa de '
      + moeda_(Math.abs(varCaixa)) + ' no período.' },
    { dimensao: 'Concentração', texto: 'Principal fonte responde por ' + num_(conc, 1)
      + '% da receita.' + (conc > 70 ? ' Dependência relevante de um único cliente ou serviço.' : '') }
  ];

  a.texto_saude = 'Situação geral classificada como ' + a.classificacao_geral.toLowerCase()
    + ', considerando liquidez, endividamento, rentabilidade, caixa e concentração de receita.';

  // ------------------------------------------------- pontos e recomendacoes
  a.pontos_positivos = [];
  a.pontos_atencao = [];
  a.recomendacoes = [];

  if (margem >= 10) a.pontos_positivos.push({ titulo: 'Margem consistente',
    texto: 'Margem líquida de ' + num_(margem, 1) + '% no período.' });
  if (liq >= 1.5) a.pontos_positivos.push({ titulo: 'Liquidez confortável',
    texto: 'Liquidez corrente de ' + num_(liq, 2) + ', com capital circulante líquido de '
      + moeda_(k.capital_circulante_liquido) + '.' });
  if (endiv <= 40) a.pontos_positivos.push({ titulo: 'Baixo endividamento',
    texto: 'Capital de terceiros em apenas ' + num_(endiv, 1) + '% do ativo.' });
  if (varCaixa >= 0) a.pontos_positivos.push({ titulo: 'Caixa em crescimento',
    texto: 'Disponibilidades cresceram ' + moeda_(varCaixa) + ' no período.' });

  if (margem < 0) a.pontos_atencao.push({ titulo: 'Operação no prejuízo',
    texto: 'Margem de ' + num_(margem, 1) + '%: as despesas superaram a receita no período.' });
  else if (margem < 5) a.pontos_atencao.push({ titulo: 'Margem estreita',
    texto: 'Margem de ' + num_(margem, 1) + '% deixa pouca folga para oscilação de custos.' });
  if (liq < 1.2) a.pontos_atencao.push({ titulo: 'Liquidez apertada',
    texto: 'Liquidez corrente de ' + num_(liq, 2) + ' para obrigações de '
      + moeda_(k.passivo_circulante) + ' no curto prazo.' });
  if (endiv > 60) a.pontos_atencao.push({ titulo: 'Endividamento elevado',
    texto: num_(endiv, 1) + '% do ativo financiado por terceiros.' });
  if (conc > 70) a.pontos_atencao.push({ titulo: 'Receita concentrada',
    texto: num_(conc, 1) + '% da receita vem de uma única fonte.' });
  if (varCaixa < 0) a.pontos_atencao.push({ titulo: 'Consumo de caixa',
    texto: 'Redução de ' + moeda_(Math.abs(varCaixa)) + ' nas disponibilidades.' });
  if (bloco.sobre_receita > 40) a.pontos_atencao.push({ titulo: 'Concentração de custo',
    texto: 'Gastos com ' + bloco.rotulo + ' consomem ' + num_(bloco.sobre_receita, 1) + '% da receita.' });

  // Um slide de pontos positivos em branco parece defeito, nao diagnostico.
  if (!a.pontos_positivos.length) {
    a.pontos_positivos.push({ titulo: 'Sem destaque positivo no período',
      texto: 'Nenhum dos indicadores acompanhados ficou em faixa favorável. '
        + 'Os pontos de atenção ao lado concentram o que precisa de ação.' });
  }

  if (margem < 5) a.recomendacoes.push('Revisar a formação de preço e o custo fixo, hoje em '
    + num_(fixoPct, 1) + '% da receita.');
  if (conc > 70) a.recomendacoes.push('Trabalhar a diversificação da receita para reduzir a dependência de '
    + (k.principal_fonte_receita || 'uma única fonte') + '.');
  if (liq < 1.2) a.recomendacoes.push('Renegociar prazos com fornecedores ou antecipar recebíveis '
    + 'para recompor a liquidez de curto prazo.');
  if (varCaixa < 0) a.recomendacoes.push('Montar projeção de caixa mensal — no ritmo atual, '
    + 'o saldo atual cobre cerca de ' + num_(k.meses_ate_esgotar || 0, 1) + ' meses.');
  if (bloco.sobre_receita > 40) a.recomendacoes.push('Detalhar a rubrica de ' + bloco.rotulo
    + ', que sozinha responde por ' + moeda_(bloco.valor) + ' no período.');
  if (!a.recomendacoes.length) a.recomendacoes.push('Manter o acompanhamento mensal dos indicadores; '
    + 'não há desvio que exija ação imediata no período.');

  // ------------------------------------------------------------------ resumo
  a.resumo_titulo = a.classificacao_geral === 'Saudável'
    ? 'Período saudável, com espaço para investir'
    : (a.classificacao_geral === 'Crítica'
        ? 'Período crítico: ação imediata recomendada'
        : 'Período ' + a.classificacao_geral.toLowerCase() + ', com pontos a acompanhar');

  a.resumo_texto = a.texto_visao_geral + ' '
    + (a.pontos_atencao.length
        ? ('Principal ponto de atenção: ' + a.pontos_atencao[0].texto)
        : 'Não há pontos de atenção relevantes no período.');

  // Passa pelo mesmo normalizador da IA: corta listas, garante strings.
  return normalizarAnalise_(a);
}
