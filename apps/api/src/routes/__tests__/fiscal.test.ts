// apps/api/src/routes/__tests__/fiscal.test.ts

import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import { cleanDatabase } from "../../__tests__/helpers";
import bcrypt from "bcryptjs";

let token: string;
let clienteId: number;
let clienteSemFiscalId: number;
let pedidoIdServico: number;
let pedidoIdProduto: number;
let notaNfseId: number;
let notaNfeId: number;

beforeAll(async () => {
  // Garante tabelas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, senha_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, tipo VARCHAR(2), nome_razao VARCHAR(255) NOT NULL, cpf_cnpj VARCHAR(18), inscricao_estadual VARCHAR(20), email VARCHAR(255), telefone VARCHAR(20), cep VARCHAR(9), logradouro VARCHAR(255), numero VARCHAR(20), complemento VARCHAR(255), bairro VARCHAR(100), cidade VARCHAR(100), uf VARCHAR(2), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS catalogo (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, descricao TEXT, tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')), unidade VARCHAR(20) NOT NULL, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, codigo_fiscal VARCHAR(20), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedidos (id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), orcamento_id INTEGER, status VARCHAR(30) NOT NULL DEFAULT 'em_aberto', valor_total NUMERIC(12,2) NOT NULL DEFAULT 0, prazo_entrega DATE, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedido_itens (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE, catalogo_id INTEGER NOT NULL REFERENCES catalogo(id), quantidade NUMERIC(12,3) NOT NULL DEFAULT 1, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, especificacoes TEXT);
    CREATE TABLE IF NOT EXISTS notas_fiscais (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id), cliente_id INTEGER NOT NULL REFERENCES clientes(id), tipo VARCHAR(5) NOT NULL CHECK (tipo IN ('nfe', 'nfse')), status VARCHAR(20) NOT NULL DEFAULT 'aguardando', numero_nota VARCHAR(50), valor NUMERIC(12,2) NOT NULL DEFAULT 0, xml_envio TEXT, xml_retorno TEXT, protocolo VARCHAR(100), danfe_pdf_url TEXT, mensagem_erro TEXT, justificativa_cancelamento TEXT, emitida_em TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), chave_acesso VARCHAR(60), codigo_verificacao VARCHAR(50), numero_rps VARCHAR(20), serie_rps VARCHAR(10), url_consulta TEXT, tentativas INTEGER DEFAULT 0, proximo_retry TIMESTAMP, idempotency_key VARCHAR(100));
    CREATE TABLE IF NOT EXISTS config_fiscal (id SERIAL PRIMARY KEY, cnpj VARCHAR(14) NOT NULL, razao_social VARCHAR(255) NOT NULL, nome_fantasia VARCHAR(255), inscricao_municipal VARCHAR(20) NOT NULL, regime_tributario VARCHAR(30) NOT NULL DEFAULT 'simples_nacional', cnae_principal VARCHAR(10), codigo_municipio VARCHAR(7) NOT NULL DEFAULT '3525904', uf VARCHAR(2) NOT NULL DEFAULT 'SP', aliquota_iss NUMERIC(5,2) NOT NULL DEFAULT 5.00, certificado_path VARCHAR(500), certificado_senha_enc TEXT, ambiente VARCHAR(15) NOT NULL DEFAULT 'homologacao', serie_dps VARCHAR(5) NOT NULL DEFAULT '900', proximo_numero_dps INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS audit_fiscal (id SERIAL PRIMARY KEY, nota_id INTEGER REFERENCES notas_fiscais(id), acao VARCHAR(30) NOT NULL, usuario_id INTEGER REFERENCES usuarios(id), ip_origem VARCHAR(45), request_payload TEXT, response_payload TEXT, status_code INTEGER, erro TEXT, created_at TIMESTAMP DEFAULT NOW());
  `);

  // Cria índice de idempotência se não existir
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notas_idempotency
      ON notas_fiscais(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);

  // Login
  const hash = await bcrypt.hash("teste123", 10);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET senha_hash = $3`,
    ["Teste", "teste@erp.local", hash],
  );
  const login = await request(app)
    .post("/auth/login")
    .send({ email: "teste@erp.local", senha: "teste123" });
  token = login.body.token;

  await cleanDatabase();

  // ── Cria dados de teste ──

  // Cliente COM dados fiscais completos
  const c1 = await request(app)
    .post("/clientes")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome_razao: "Gráfica Teste LTDA" });
  clienteId = c1.body.id;
  await request(app)
    .put(`/clientes/${clienteId}/fiscal`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      tipo: "PJ",
      cpf_cnpj: "11222333000181",
      inscricao_estadual: "123456789",
      cep: "13201-000",
      logradouro: "Rua Teste",
      numero: "100",
      bairro: "Centro",
      cidade: "Jundiaí",
      uf: "SP",
    });

  // Cliente SEM dados fiscais
  const c2 = await request(app)
    .post("/clientes")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome_razao: "Cliente Incompleto" });
  clienteSemFiscalId = c2.body.id;

  // Catálogo
  const serv = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Design de Logo",
      tipo: "servico",
      unidade: "serv",
      preco_unitario: 500,
      codigo_fiscal: "1302",
    });
  const prod = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Cartão de Visita",
      tipo: "produto",
      unidade: "un",
      preco_unitario: 100,
    });

  // Pedido de serviço (gera NFS-e)
  const p1 = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      cliente_id: clienteId,
      itens: [
        { catalogo_id: serv.body.id, quantidade: 1, preco_unitario: 500 },
      ],
    });
  pedidoIdServico = p1.body.id;

  // Pedido de produto (gera NF-e)
  const p2 = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      cliente_id: clienteId,
      itens: [
        { catalogo_id: prod.body.id, quantidade: 10, preco_unitario: 100 },
      ],
    });
  pedidoIdProduto = p2.body.id;

  // Avança ambos até "entregue" e registra entrega
  for (const id of [pedidoIdServico, pedidoIdProduto]) {
    await request(app)
      .put(`/pedidos/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "em_producao" });
    await request(app)
      .put(`/pedidos/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "aguardando_retirada" });
    await request(app)
      .put(`/pedidos/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "em_transporte" });
    await request(app)
      .put(`/pedidos/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "entregue" });
    await request(app)
      .post(`/pedidos/${id}/entregar`)
      .set("Authorization", `Bearer ${token}`);
  }

  // Identifica as notas criadas
  const notas = await request(app)
    .get("/fiscal/notas")
    .set("Authorization", `Bearer ${token}`);
  notaNfseId = notas.body.find((n: any) => n.tipo === "nfse")?.id;
  notaNfeId = notas.body.find((n: any) => n.tipo === "nfe")?.id;
});

// ══════════════════════════════════════════════════════
// Configuração fiscal
// ══════════════════════════════════════════════════════

describe("GET /fiscal/config", () => {
  it("retorna null quando não há configuração", async () => {
    const res = await request(app)
      .get("/fiscal/config")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe("PUT /fiscal/config", () => {
  it("retorna 400 sem campos obrigatórios", async () => {
    const res = await request(app)
      .put("/fiscal/config")
      .set("Authorization", `Bearer ${token}`)
      .send({ cnpj: "11222333000181" });
    expect(res.status).toBe(400);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).put("/fiscal/config").send({
      cnpj: "11222333000181",
      razao_social: "Teste",
      inscricao_municipal: "12345",
    });
    expect(res.status).toBe(401);
  });

  it("cria configuração fiscal com sucesso", async () => {
    const res = await request(app)
      .put("/fiscal/config")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cnpj: "11222333000181",
        razao_social: "Gráfica Teste LTDA",
        nome_fantasia: "Gráfica Teste",
        inscricao_municipal: "12345",
        regime_tributario: "simples_nacional",
        cnae_principal: "1813001",
        codigo_municipio: "3525904",
        uf: "SP",
        aliquota_iss: 5.0,
        ambiente: "homologacao",
        serie_dps: "900",
      });
    expect(res.status).toBe(201);
    expect(res.body.cnpj).toBe("11222333000181");
    expect(res.body.razao_social).toBe("Gráfica Teste LTDA");
    expect(res.body.codigo_municipio).toBe("3525904");
    expect(res.body.ambiente).toBe("homologacao");
  });

  it("nunca retorna a senha do certificado na resposta", async () => {
    const res = await request(app)
      .put("/fiscal/config")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cnpj: "11222333000181",
        razao_social: "Gráfica Teste LTDA",
        inscricao_municipal: "12345",
        certificado_senha: "minha-senha-secreta",
      });
    expect(res.status).toBe(200);
    expect(res.body.certificado_senha_enc).toBeUndefined();
    expect(res.body.certificado_senha).toBeUndefined();
  });

  it("atualiza configuração existente", async () => {
    const res = await request(app)
      .put("/fiscal/config")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cnpj: "11222333000181",
        razao_social: "Gráfica Atualizada LTDA",
        inscricao_municipal: "12345",
        aliquota_iss: 3.0,
      });
    expect(res.status).toBe(200);
    expect(res.body.razao_social).toBe("Gráfica Atualizada LTDA");
    expect(parseFloat(res.body.aliquota_iss)).toBe(3.0);
  });
});

describe("GET /fiscal/config (após criação)", () => {
  it("retorna configuração sem senha criptografada", async () => {
    const res = await request(app)
      .get("/fiscal/config")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cnpj).toBe("11222333000181");
    expect(res.body.certificado_senha_enc).toBeUndefined();
    expect(res.body.certificado_configurado).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// Listagem e consulta de notas (rotas herdadas do notas.ts)
// ══════════════════════════════════════════════════════

describe("GET /fiscal/notas", () => {
  it("lista todas as notas", async () => {
    const res = await request(app)
      .get("/fiscal/notas")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("filtra por tipo nfse", async () => {
    const res = await request(app)
      .get("/fiscal/notas?tipo=nfse")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((n: any) => n.tipo === "nfse")).toBe(true);
  });

  it("filtra por tipo nfe", async () => {
    const res = await request(app)
      .get("/fiscal/notas?tipo=nfe")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((n: any) => n.tipo === "nfe")).toBe(true);
  });

  it("filtra por status", async () => {
    const res = await request(app)
      .get("/fiscal/notas?status=aguardando")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((n: any) => n.status === "aguardando")).toBe(true);
  });

  it("filtra por cliente", async () => {
    const res = await request(app)
      .get(`/fiscal/notas?cliente_id=${clienteId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((n: any) => n.cliente_id === clienteId)).toBe(true);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/fiscal/notas");
    expect(res.status).toBe(401);
  });
});

describe("GET /fiscal/notas/:id", () => {
  it("retorna nota por ID", async () => {
    const res = await request(app)
      .get(`/fiscal/notas/${notaNfseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(notaNfseId);
    expect(res.body.tipo).toBe("nfse");
    expect(res.body.cliente_nome).toBe("Gráfica Teste LTDA");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .get("/fiscal/notas/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /fiscal/notas/cliente/:clienteId", () => {
  it("retorna histórico de notas do cliente", async () => {
    const res = await request(app)
      .get(`/fiscal/notas/cliente/${clienteId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("retorna array vazio para cliente sem notas", async () => {
    const res = await request(app)
      .get(`/fiscal/notas/cliente/${clienteSemFiscalId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

it("rejeita emissão de nota inexistente", async () => {
  const res = await request(app)
    .post("/fiscal/notas/99999/emitir")
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(422);
  expect(res.body.mensagem).toMatch(/não encontrad/);
});

it("rejeita emissão de NF-e (somente NFS-e é suportada)", async () => {
  const res = await request(app)
    .post(`/fiscal/notas/${notaNfeId}/emitir`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(422);
  expect(res.body.mensagem).toMatch(/NFS-e/);
});

it("rejeita emissão quando certificado não está configurado", async () => {
  await pool.query(
    "UPDATE config_fiscal SET certificado_path = NULL, certificado_senha_enc = NULL",
  );
  const res = await request(app)
    .post(`/fiscal/notas/${notaNfseId}/emitir`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(422);
  expect(res.body.mensagem).toMatch(/[Cc]ertificad/);
});

it("retorna 400 com justificativa curta (mín 15 chars)", async () => {
  const res = await request(app)
    .post(`/fiscal/notas/${notaNfseId}/cancelar`)
    .set("Authorization", `Bearer ${token}`)
    .send({ justificativa: "curta" });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/15 caracteres/);
});

it("retorna 400 para nota que não está autorizada", async () => {
  const res = await request(app)
    .post(`/fiscal/notas/${notaNfseId}/cancelar`)
    .set("Authorization", `Bearer ${token}`)
    .send({ justificativa: "Justificativa com mais de quinze caracteres" });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/autorizada/);
});

it("retorna 400 para nota sem chave de acesso", async () => {
  const res = await request(app)
    .get(`/fiscal/notas/${notaNfseId}/consultar`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/chave de acesso/);
});

it("retorna resultado mesmo sem notas rejeitadas", async () => {
  const res = await request(app)
    .post("/fiscal/notas/reprocessar")
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(0);
  expect(res.body.sucesso).toBe(0);
  expect(res.body.falha).toBe(0);
});
// ══════════════════════════════════════════════════════
// Auditoria
// ══════════════════════════════════════════════════════

describe("GET /fiscal/auditoria/:notaId", () => {
  it("retorna log de auditoria da nota", async () => {
    const res = await request(app)
      .get(`/fiscal/auditoria/${notaNfseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Deve ter ao menos 1 registro da tentativa de emissão anterior
  });

  it("retorna array vazio para nota sem auditoria", async () => {
    const res = await request(app)
      .get(`/fiscal/auditoria/${notaNfeId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
