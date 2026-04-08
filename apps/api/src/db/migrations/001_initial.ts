import { pool } from "../connection";

export async function up() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(2) NOT NULL CHECK (tipo IN ('PF', 'PJ')),
      nome_razao VARCHAR(255) NOT NULL,
      cpf_cnpj VARCHAR(18) UNIQUE NOT NULL,
      inscricao_estadual VARCHAR(20),
      email VARCHAR(255),
      telefone VARCHAR(20),
      cep VARCHAR(9) NOT NULL,
      logradouro VARCHAR(255) NOT NULL,
      numero VARCHAR(20) NOT NULL,
      complemento VARCHAR(255),
      bairro VARCHAR(100) NOT NULL,
      cidade VARCHAR(100) NOT NULL,
      uf VARCHAR(2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
    CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome_razao);
  `);

  console.log("✅ Migration 001: tabelas usuarios e clientes criadas");
}
