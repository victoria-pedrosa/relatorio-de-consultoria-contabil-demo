# Demonstração — Relatório de consultoria contábil com IA

> Projeto de portfólio de **Victória Pedrosa**. **Demonstração** de relatório de consultoria contábil com IA — versão com dados fictícios (nomes, CNPJs, e-mails e IDs internos substituídos).

## Problema de negócio
Montar o relatório de consultoria contábil (indicadores, narrativa e apresentação) levava horas por cliente.

## Antes x depois
| | Antes | Depois |
|---|---|---|
| Como é feito | Leitura manual dos relatórios da Domínio e montagem da apresentação à mão. | Fluxo automático: PDFs/XLS da Domínio → leitura determinística + Gemini → indicadores → Google Slides e PDF, com web app. |

## Ganho
- Relatório padronizado por cliente em minutos.

## Tecnologias
APIs REST, Gemini API, Google Apps Script, Google Drive, Google Sheets, Google Slides, HTML/JavaScript, SQLite, Web App (HtmlService)

## Arquivos
- `00_Config.gs`
- `01_Menu.gs`
- `02_Cadastro.gs`
- `03_Documentos.gs`
- `04_Gemini.gs`
- `05_Indicadores.gs`
- `06_Slides.gs`
- `07_Exportacao.gs`
- `08_Orquestrador.gs`
- `09_TemplateBuilder.gs`
- `10_WebApp.gs`
- `11_LeitorDominio.gs`
- `12_Narrativas.gs`
- `13_LeitorXls.gs`
- `App.html`
- `Codigo.gs`
- `Como_Configurar.md`
- `Modal.html`
- `appsscript.json`

## Como usar
Crie um projeto no Google Apps Script, copie os arquivos `.gs`/`.html` e configure as Propriedades do script indicadas no código.

## Autora
Victória Pedrosa — Product Owner do Time de IA, automação de processos contábeis e fiscais.
