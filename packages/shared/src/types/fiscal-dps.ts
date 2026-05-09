export interface DadosPrestador {
  cnpj: string;
  inscricao_municipal: string;
  razao_social: string;
  codigo_municipio: string;
  uf: string;
}

export interface DadosTomador {
  tipo: "PF" | "PJ";
  cpf_cnpj: string;
  razao_social: string;
  email: string | null;
  telefone: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  codigo_municipio: string;
}

export interface DadosServico {
  discriminacao: string;
  valor_servicos: number;
  aliquota_iss: number;
  item_lista_servico: string;
  codigo_tributacao_nacional: string;
  codigo_nbs: string | null;
  iss_retido: boolean;
  codigo_municipio_incidencia: string;
}

export interface DPSPayload {
  serie: string;
  numero: string;
  data_emissao: string;
  data_competencia: string;
  prestador: DadosPrestador;
  tomador: DadosTomador;
  servico: DadosServico;
  regime_tributario: string;
}
