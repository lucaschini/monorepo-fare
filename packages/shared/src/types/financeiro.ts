import { TipoTransacao, MetodoPagamento, StatusTransacao } from "../enums";

export interface TransacaoFinanceira {
  id: number;
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  metodo_pagamento?: MetodoPagamento | null;
  status: StatusTransacao;
  vencimento?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransacaoDTO {
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  metodo_pagamento?: MetodoPagamento | null;
  status?: StatusTransacao;
  vencimento?: string | null;
  observacoes?: string | null;
}
