import { pool } from "../connection";

export async function up() {
  await pool.query(`
    -- ══════════════════════════════════════════════════════
    -- Configuração do emitente (dados da gráfica)
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS config_fiscal (
      id SERIAL PRIMARY KEY,
      cnpj VARCHAR(14) NOT NULL,
      razao_social VARCHAR(255) NOT NULL,
      nome_fantasia VARCHAR(255),
      inscricao_municipal VARCHAR(20) NOT NULL,
      regime_tributario VARCHAR(30) NOT NULL DEFAULT 'simples_nacional',
      cnae_principal VARCHAR(10),
      codigo_municipio VARCHAR(7) NOT NULL DEFAULT '3525904',
      uf VARCHAR(2) NOT NULL DEFAULT 'SP',
      aliquota_iss NUMERIC(5,2) NOT NULL DEFAULT 5.00,

      -- Certificado: armazenamos path + senha criptografada
      -- NUNCA armazene a senha em texto puro
      certificado_path VARCHAR(500),
      certificado_senha_enc TEXT,

      -- Ambiente: 'homologacao' ou 'producao'
      ambiente VARCHAR(15) NOT NULL DEFAULT 'homologacao',

      -- Controle de série e sequencial da DPS
      serie_dps VARCHAR(5) NOT NULL DEFAULT '900',
      proximo_numero_dps INTEGER NOT NULL DEFAULT 1,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- ══════════════════════════════════════════════════════
    -- Campos extras na nota para o retorno da NFS-e Nacional
    -- ══════════════════════════════════════════════════════
    ALTER TABLE notas_fiscais
      ADD COLUMN IF NOT EXISTS chave_acesso VARCHAR(60),
      ADD COLUMN IF NOT EXISTS codigo_verificacao VARCHAR(50),
      ADD COLUMN IF NOT EXISTS numero_rps VARCHAR(20),
      ADD COLUMN IF NOT EXISTS serie_rps VARCHAR(10),
      ADD COLUMN IF NOT EXISTS url_consulta TEXT,
      ADD COLUMN IF NOT EXISTS tentativas INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS proximo_retry TIMESTAMP,
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

    -- Índice de idempotência para evitar emissão duplicada
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notas_idempotency
      ON notas_fiscais(idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_notas_chave_acesso
      ON notas_fiscais(chave_acesso)
      WHERE chave_acesso IS NOT NULL;

    -- ══════════════════════════════════════════════════════
    -- Log de auditoria fiscal
    -- Toda operação fiscal gera um registro imutável
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS audit_fiscal (
      id SERIAL PRIMARY KEY,
      nota_id INTEGER REFERENCES notas_fiscais(id),
      acao VARCHAR(30) NOT NULL,
      usuario_id INTEGER REFERENCES usuarios(id),
      ip_origem VARCHAR(45),
      request_payload TEXT,
      response_payload TEXT,
      status_code INTEGER,
      erro TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_nota ON audit_fiscal(nota_id);
    CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_fiscal(acao);
  `);

  console.log(
    "✅ Migration 008: config_fiscal, campos extras em notas_fiscais e audit_fiscal criados",
  );
}
