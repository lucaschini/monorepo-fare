import { TipoNota, StatusNota } from "../enums";

export interface NotaFiscal {
  id: number;
  pedido_id: number;
  cliente_id: number;
  tipo: TipoNota;
  status: StatusNota;
  numero_nota?: string | null;
  valor: number;
  xml_envio?: string | null;
  xml_retorno?: string | null;
  protocolo?: string | null;
  danfe_pdf_url?: string | null;
  mensagem_erro?: string | null;
  justificativa_cancelamento?: string | null;
  emitida_em?: string | null;
  created_at: string;

  // Campos da migration 008
  chave_acesso?: string | null;
  codigo_verificacao?: string | null;
  numero_rps?: string | null;
  serie_rps?: string | null;
  url_consulta?: string | null;
  tentativas?: number;
  proximo_retry?: string | null;
  idempotency_key?: string | null;

  // Joins
  cliente_nome?: string;
  pedido_numero?: number;
}
