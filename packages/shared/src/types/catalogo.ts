import { TipoItem } from "../enums";

export interface CatalogoItem {
  id: number;
  nome: string;
  descricao?: string | null;
  tipo: TipoItem;
  unidade: string;
  preco_unitario: number;
  codigo_fiscal?: string | null; // NCM (produto) ou código de serviço LC 116
  created_at: string;
  updated_at: string;
}

export interface CreateCatalogoDTO {
  nome: string;
  descricao?: string | null;
  tipo: TipoItem;
  unidade: string;
  preco_unitario: number;
  codigo_fiscal?: string | null;
}

export interface UpdateCatalogoDTO extends Partial<CreateCatalogoDTO> {}
