export interface ResultadoEmissao {
  sucesso: boolean;
  chave_acesso?: string;
  numero_nota?: string;
  codigo_verificacao?: string;
  protocolo?: string;
  xml_retorno?: string;
  url_consulta?: string;
  mensagem_erro?: string;
  status_code?: number;
}

export interface ResultadoCancelamento {
  sucesso: boolean;
  protocolo?: string;
  mensagem_erro?: string;
}
