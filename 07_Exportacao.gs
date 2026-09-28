/**
 * Arquivo: 07_Exportacao.gs
 * Exportação do Google Slides para PDF.
 */

/**
 * @param {string} presentationId
 * @param {string} nomeArquivo   sem extensão
 * @param {Folder} pasta
 * @return {{id:string,url:string,nome:string}}
 */
function exportarPdf_(presentationId, nomeArquivo, pasta) {
  var blob;
  try {
    blob = comRetryDrive_(function () {
      return arquivoPorId_(presentationId).getAs(MimeType.PDF);
    });
  } catch (e) {
    // fallback pela API de exportação (útil em Drives compartilhados)
    var url = 'https://docs.google.com/presentation/d/' + presentationId + '/export/pdf';
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Falha ao exportar PDF (HTTP ' + resp.getResponseCode() + ').');
    }
    blob = resp.getBlob();
  }
  blob.setName(nomeArquivo + '.pdf');
  var f = pasta.createFile(blob);
  return { id: f.getId(), url: f.getUrl(), nome: f.getName() };
}

/** Cria (ou reaproveita) a subpasta da empresa dentro da pasta de saída. */
function pastaDaEmpresa_(pastaSaida, nomeEmpresa) {
  var nome = nomeEmpresa.substring(0, 80);
  var it = pastaSaida.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pastaSaida.createFolder(nome);
}
