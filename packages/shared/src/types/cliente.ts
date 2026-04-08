import { TipoCliente } from "../enums";

export interface Cliente {
  id: number;
  tipo: TipoCliente;
  nome_razao: string;
  cpf_cnpj: string;
  inscricao_estadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClienteDTO {
  tipo: TipoCliente;
  nome_razao: string;
  cpf_cnpj: string;
  inscricao_estadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface UpdateClienteDTO extends Partial<CreateClienteDTO> {}
