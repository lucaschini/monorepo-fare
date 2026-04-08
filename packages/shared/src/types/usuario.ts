export interface Usuario {
  id: number;
  nome: string;
  email: string;
  created_at: string;
}

export interface LoginDTO {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
