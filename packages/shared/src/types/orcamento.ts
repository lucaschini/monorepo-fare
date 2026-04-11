import { StatusOrcamento } from "../enums";
import { CatalogoItem } from "./catalogo";
import { Cliente } from "./cliente";

export interface OrcamentoItem {
  id: number;
  orcamento_id: number;
  catalogo_id: number;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  // Joins
  catalogo_nome?: string;
  catalogo_tipo?: string;
  catalogo_unidade?: string;
}

export interface Orcamento {
  id: number;
  cliente_id: number;
  status: StatusOrcamento;
  valor_total: number;
  validade?: string | null;
  observacoes?: string | null;
  pedido_id?: number | null;
  created_at: string;
  updated_at: string;
  // Joins
  cliente_nome?: string;
  itens?: OrcamentoItem[];
}

export interface CreateOrcamentoDTO {
  cliente_id: number;
  validade?: string | null;
  observacoes?: string | null;
  itens: {
    catalogo_id: number;
    quantidade: number;
    preco_unitario: number;
  }[];
}

export interface UpdateOrcamentoDTO {
  validade?: string | null;
  observacoes?: string | null;
  itens?: {
    catalogo_id: number;
    quantidade: number;
    preco_unitario: number;
  }[];
}
