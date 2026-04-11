import { StatusPedido } from "../enums";

export interface PedidoItem {
  id: number;
  pedido_id: number;
  catalogo_id: number;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  especificacoes?: string | null;
  catalogo_nome?: string;
  catalogo_tipo?: string;
  catalogo_unidade?: string;
}

export interface Pedido {
  id: number;
  cliente_id: number;
  orcamento_id?: number | null;
  status: StatusPedido;
  prazo_entrega?: string | null;
  observacoes?: string | null;
  valor_total: number;
  created_at: string;
  updated_at: string;
  cliente_nome?: string;
  itens?: PedidoItem[];
}
