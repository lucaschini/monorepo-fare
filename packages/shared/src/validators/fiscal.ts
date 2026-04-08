import { Cliente } from "../types/cliente";

export function clientePossuiDadosFiscais(cliente: Cliente): boolean {
  return !!(
    cliente.tipo &&
    cliente.cpf_cnpj &&
    cliente.cep &&
    cliente.logradouro &&
    cliente.numero &&
    cliente.bairro &&
    cliente.cidade &&
    cliente.uf
  );
}
