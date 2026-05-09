import { AmbienteFiscal, RegimeTributario } from "../enums";

export interface ConfigFiscal {
  id: number;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  inscricao_municipal: string;
  regime_tributario: RegimeTributario;
  cnae_principal: string | null;
  codigo_municipio: string;
  uf: string;
  aliquota_iss: number;
  certificado_path: string | null;
  certificado_senha_enc: string | null;
  ambiente: AmbienteFiscal;
  serie_dps: string;
  proximo_numero_dps: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateConfigFiscalDTO {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  inscricao_municipal: string;
  regime_tributario?: RegimeTributario;
  cnae_principal?: string | null;
  codigo_municipio?: string;
  uf?: string;
  aliquota_iss?: number;
  certificado_path?: string | null;
  certificado_senha?: string | null;
  ambiente?: AmbienteFiscal;
  serie_dps?: string;
}
