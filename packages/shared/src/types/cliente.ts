import { TipoCliente } from "../enums";

export interface Cliente {
  id: number;
  nome_razao: string;
  telefone?: string | null;
  email?: string | null;
  // Dados fiscais
  tipo?: TipoCliente | null;
  cpf_cnpj?: string | null;
  inscricao_estadual?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClienteDTO {
  nome_razao: string;
  telefone?: string | null;
  email?: string | null;
}

export interface DadosFiscaisDTO {
  tipo: TipoCliente;
  cpf_cnpj: string;
  inscricao_estadual?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface UpdateClienteDTO extends Partial<
  CreateClienteDTO & DadosFiscaisDTO
> {}
