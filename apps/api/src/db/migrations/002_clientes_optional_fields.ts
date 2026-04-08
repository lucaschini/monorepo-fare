import { pool } from "../connection";

export async function up() {
  await pool.query(`
    ALTER TABLE clientes
      ALTER COLUMN tipo DROP NOT NULL,
      ALTER COLUMN cpf_cnpj DROP NOT NULL,
      ALTER COLUMN cep DROP NOT NULL,
      ALTER COLUMN logradouro DROP NOT NULL,
      ALTER COLUMN numero DROP NOT NULL,
      ALTER COLUMN bairro DROP NOT NULL,
      ALTER COLUMN cidade DROP NOT NULL,
      ALTER COLUMN uf DROP NOT NULL;

    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_check;
    ALTER TABLE clientes ADD CONSTRAINT clientes_tipo_check CHECK (tipo IS NULL OR tipo IN ('PF', 'PJ'));

    DROP INDEX IF EXISTS idx_clientes_cpf_cnpj;
    CREATE UNIQUE INDEX idx_clientes_cpf_cnpj ON clientes(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';
  `);

  console.log(
    "✅ Migration 002: campos de clientes agora opcionais (exceto nome e telefone)",
  );
}
