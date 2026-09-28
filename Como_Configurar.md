# Como configurar — Planilha "Relatório de Consultoria Contábil"

Guia para quem não mexe com programação. Leva uns 10 minutos, só de clicar. Depois de configurado uma vez, o dia a dia é só usar o menu **Exemplo**.

## O que mudou nesta versão

O código anterior travava (`Drive.Files.insert is not a function`) e, mesmo corrigindo isso, a forma como ele lia o PDF embaralhava a ordem das colunas do Balancete/DRE do Domínio — testei nos PDFs reais da pasta e confirmei isso. A nova versão lê o PDF com a **Cloud Vision API** (Google), que enxerga a posição de cada palavra na página e remonta a linha certa. Por causa disso, tem 1 configuração nova (chave da API Vision) e 1 configuração a menos (não precisa mais ativar o serviço "Drive API" no Apps Script).

## Passo 1 — Colar o novo código

1. Abra a planilha "Relatório de Consultoria Contábil" no navegador.
2. Menu **Extensões > Apps Script**.
3. Apague todo o conteúdo que estiver lá.
4. Cole o conteúdo do arquivo **Codigo_Apps_Script.gs** (enviado junto com este guia).
5. Clique no ícone de salvar (disquete) no topo.
6. Volte para a aba da planilha e recarregue a página (F5). Um menu novo **Exemplo** vai aparecer na barra de menus, ao lado de Ajuda.
7. Na primeira vez que usar qualquer item do menu Exemplo, o Google vai pedir autorização ("Esta app não foi verificada..."). Clique em **Avançado** > **Acessar Relatório de Consultoria Contábil (não seguro)** > **Permitir**. Isso é normal para scripts que você mesmo instalou.

## Passo 2 — Criar a Chave de API do Cloud Vision

1. Acesse **console.cloud.google.com** (entre com a mesma conta Google usada na planilha).
2. Se aparecer para escolher um projeto, clique em **Novo Projeto**. Dê um nome, por exemplo `escr-relatorios`, e clique em **Criar**. Espere uns 30 segundos e selecione esse projeto no topo da tela.
3. No campo de busca do topo, digite **Cloud Vision API** e abra o resultado.
4. Clique no botão azul **Ativar**. Se pedir para ativar o faturamento (billing), siga o passo — é preciso cadastrar um cartão, mas a Vision API tem uma cota gratuita mensal (ver "Custo esperado" abaixo) e o uso desta planilha deve ficar dentro dela ou custar poucos reais.
5. No menu à esquerda, vá em **APIs e Serviços > Credenciais**.
6. Clique em **+ Criar Credenciais > Chave de API**. Uma chave (uma sequência de letras/números começando com `AIza...`) vai aparecer — copie ela.
7. (Recomendado) Clique em **Restringir chave**, em "Restrições de API" marque **Cloud Vision API** e salve. Isso impede que a chave seja usada para outra coisa se vazar.

## Passo 3 — Configurar a planilha

1. Na planilha, menu **Exemplo > Configuração > Configurar**.
2. Cole os 3 campos:
   - **Modelo de apresentação (Google Slides)**: abra o arquivo `Modelo_Analise_Resultados_Exemplo.pptx`, use **Arquivo > Salvar como Google Apresentações**, e cole o link da apresentação que abrir (ou só o ID, os dois funcionam).
   - **Pasta do Domínio no Google Drive**: cole o link da pasta onde ficam os PDFs de Balancete/DRE exportados do Domínio.
   - **Chave da API Cloud Vision**: cole a chave copiada no Passo 2.
3. Clique em **Testar configuração**. Deve aparecer ✅ nos 3 itens. Se algum vier ❌, a mensagem explica o que corrigir.
4. Clique em **Salvar**.

## Uso do dia a dia

- **Exemplo > Importar 1 empresa (linha selecionada)** — importa só a empresa da linha selecionada na aba Dados_Periodo.
- **Exemplo > Importar em lote (todas as empresas da pasta)** — varre a pasta do Domínio inteira e preenche todas as linhas que encontrar. Acompanhe o resultado na aba **Import_Log**.
- Depois de importar, **revise a linha** (a coluna OBSERVACOES sinaliza o que precisa de atenção) antes de gerar a apresentação.
- **Exemplo > Gerar Apresentação (linha selecionada)** ou **Gerar apresentações em lote** — cria a cópia do modelo de Slides já preenchida.
- **Exemplo > Gerar prompt para reescrever com IA** — opcional, para deixar os textos de leitura/diagnóstico com uma redação mais solta.

## Erros comuns

| Mensagem | O que significa | O que fazer |
|---|---|---|
| "Falta configurar..." | Algum dos 3 campos está vazio | Exemplo > Configuração > Configurar |
| "API key not valid" | A chave foi colada errada ou incompleta | Copie a chave de novo no Console do Google Cloud |
| "Cloud Vision API não está ativada" | Esqueceu o Passo 2.4 | Volte no Console e clique em Ativar |
| "falta ativar o faturamento (billing)" | O projeto do Google Cloud não tem cartão cadastrado | Console > Faturamento > vincular uma forma de pagamento |
| "CNPJ não localizado no Cadastro" (no Import_Log) | O PDF não tem o CNPJ dessa empresa cadastrado na aba Cadastro, ou o PDF não é de uma empresa da base | Confira o CNPJ dentro do PDF e na aba Cadastro |

## Limitação conhecida (vale saber)

Em contas com descrição muito longa que não cabe na largura da coluna, o Domínio às vezes desenha o texto de um jeito que sobrepõe com a linha seguinte do Balancete. Isso pode fazer o **nome** de alguma conta pequena sair estranho/embaralhado no log — mas não afeta os **valores** (os totais de receita, despesa, resultado, caixa e endividamento continuam corretos, porque vêm de linhas de resumo com nomes curtos, que não têm esse problema). Ainda assim, sempre revise os nomes de despesas/receitas antes de aprovar a apresentação — é por isso que o status fica como "Dados importados (revisar)" e não "Aprovado".

## Custo esperado da Cloud Vision API

A Cloud Vision API cobra por página lida, com uma faixa gratuita mensal (1.000 unidades/mês, sujeita a mudar — confira em cloud.google.com/vision/pricing). Cada PDF de Balancete/DRE tem poucas páginas (1 a 5, normalmente). Para o volume desta base de empresas, a expectativa é de um custo baixo (poucos reais por mês), mas vale acompanhar o painel de faturamento do Google Cloud no primeiro mês de uso para confirmar.
