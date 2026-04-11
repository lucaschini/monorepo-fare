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
  // Joins
  cliente_nome?: string;
  pedido_numero?: number;
}
