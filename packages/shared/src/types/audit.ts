import { AcaoFiscal } from "../enums";

export interface AuditFiscal {
  id: number;
  nota_id: number;
  acao: AcaoFiscal;
  usuario_id: number;
  ip_origem: string;
  request_payload: string | null;
  response_payload: string | null;
  status_code: number | null;
  erro: string | null;
  created_at: string;
  // Join
  usuario_nome?: string;
}

export interface CreateAuditFiscalDTO {
  nota_id: number;
  acao: AcaoFiscal;
  usuario_id: number;
  ip_origem: string;
  request_payload?: string;
  response_payload?: string;
  status_code?: number;
  erro?: string;
}
