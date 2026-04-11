import { TipoMovimentacao } from "../enums";

export interface Insumo {
  id: number;
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInsumoDTO {
  nome: string;
  unidade_medida: string;
  estoque_minimo: number;
}

export interface UpdateInsumoDTO extends Partial<CreateInsumoDTO> {}

export interface MovimentacaoEstoque {
  id: number;
  insumo_id: number;
  pedido_id?: number | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  lote?: string | null;
  observacao?: string | null;
  created_at: string;
  // Joins
  insumo_nome?: string;
  insumo_unidade?: string;
  pedido_numero?: number;
}

export interface CreateMovimentacaoDTO {
  insumo_id: number;
  pedido_id?: number | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  lote?: string | null;
  observacao?: string | null;
}
