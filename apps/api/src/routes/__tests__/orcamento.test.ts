import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import bcrypt from "bcryptjs";

let token: string;
let clienteId: number;
let catalogoId1: number;
let catalogoId2: number;
let orcamentoId: number;

beforeAll(async () => {
  // Setup tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, senha_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, tipo VARCHAR(2), nome_razao VARCHAR(255) NOT NULL, cpf_cnpj VARCHAR(18), inscricao_estadual VARCHAR(20), email VARCHAR(255), telefone VARCHAR(20), cep VARCHAR(9), logradouro VARCHAR(255), numero VARCHAR(20), complemento VARCHAR(255), bairro VARCHAR(100), cidade VARCHAR(100), uf VARCHAR(2), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS catalogo (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, descricao TEXT, tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')), unidade VARCHAR(20) NOT NULL, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, codigo_fiscal VARCHAR(20), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS orcamentos (id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), status VARCHAR(20) NOT NULL DEFAULT 'rascunho', valor_total NUMERIC(12,2) NOT NULL DEFAULT 0, validade DATE, observacoes TEXT, pedido_id INTEGER, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS orcamento_itens (id SERIAL PRIMARY KEY, orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE, catalogo_id INTEGER NOT NULL REFERENCES catalogo(id), quantidade NUMERIC(12,3) NOT NULL DEFAULT 1, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pedidos (id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), orcamento_id INTEGER, status VARCHAR(30) NOT NULL DEFAULT 'aberto', valor_total NUMERIC(12,2) NOT NULL DEFAULT 0, prazo_entrega DATE, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedido_itens (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE, catalogo_id INTEGER NOT NULL REFERENCES catalogo(id), quantidade NUMERIC(12,3) NOT NULL DEFAULT 1, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, especificacoes TEXT);
  `);

  // User + login
  const hash = await bcrypt.hash("teste123", 10);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET senha_hash = $3`,
    ["Teste", "teste@erp.local", hash],
  );
  const login = await request(app)
    .post("/auth/login")
    .send({ email: "teste@erp.local", senha: "teste123" });
  token = login.body.token;

  // Clean
  await pool.query("DELETE FROM pedido_itens");
  await pool.query("DELETE FROM pedidos");
  await pool.query("DELETE FROM orcamento_itens");
  await pool.query("DELETE FROM orcamentos");

  // Cliente
  const c = await request(app)
    .post("/clientes")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome_razao: "Cliente Orçamento" });
  clienteId = c.body.id;

  // Catálogo
  const p = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Cartão",
      tipo: "produto",
      unidade: "un",
      preco_unitario: 100,
    });
  catalogoId1 = p.body.id;
  const s = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Design",
      tipo: "servico",
      unidade: "serv",
      preco_unitario: 500,
    });
  catalogoId2 = s.body.id;
});

describe("POST /orcamentos", () => {
  it("retorna 400 sem itens", async () => {
    const res = await request(app)
      .post("/orcamentos")
      .set("Authorization", `Bearer ${token}`)
      .send({ cliente_id: clienteId });
    expect(res.status).toBe(400);
  });

  it("retorna 400 com cliente inexistente", async () => {
    const res = await request(app)
      .post("/orcamentos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: 99999,
        itens: [
          { catalogo_id: catalogoId1, quantidade: 1, preco_unitario: 100 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("cria orçamento com sucesso", async () => {
    const res = await request(app)
      .post("/orcamentos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: clienteId,
        observacoes: "Teste orçamento",
        itens: [
          { catalogo_id: catalogoId1, quantidade: 100, preco_unitario: 1.5 },
          { catalogo_id: catalogoId2, quantidade: 1, preco_unitario: 500 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("rascunho");
    expect(parseFloat(res.body.valor_total)).toBe(650);
    expect(res.body.itens.length).toBe(2);
    orcamentoId = res.body.id;
  });
});

describe("GET /orcamentos", () => {
  it("lista orçamentos", async () => {
    const res = await request(app)
      .get("/orcamentos")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].cliente_nome).toBe("Cliente Orçamento");
  });

  it("filtra por status", async () => {
    const res = await request(app)
      .get("/orcamentos?status=rascunho")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.every((o: any) => o.status === "rascunho")).toBe(true);
  });
});

describe("GET /orcamentos/:id", () => {
  it("retorna orçamento com itens", async () => {
    const res = await request(app)
      .get(`/orcamentos/${orcamentoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.itens.length).toBe(2);
    expect(res.body.itens[0].catalogo_nome).toBeDefined();
  });
});

describe("PUT /orcamentos/:id/status", () => {
  it("rejeita transição inválida", async () => {
    const res = await request(app)
      .put(`/orcamentos/${orcamentoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "aprovado" });
    expect(res.status).toBe(400);
  });

  it("muda rascunho → enviado", async () => {
    const res = await request(app)
      .put(`/orcamentos/${orcamentoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "enviado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("enviado");
  });

  it("muda enviado → aprovado", async () => {
    const res = await request(app)
      .put(`/orcamentos/${orcamentoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "aprovado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });
});

describe("POST /orcamentos/:id/converter", () => {
  it("rejeita converter orçamento não aprovado", async () => {
    // Cria outro orçamento em rascunho
    const orc = await request(app)
      .post("/orcamentos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: clienteId,
        itens: [
          { catalogo_id: catalogoId1, quantidade: 1, preco_unitario: 50 },
        ],
      });
    const res = await request(app)
      .post(`/orcamentos/${orc.body.id}/converter`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("converte orçamento aprovado em pedido", async () => {
    const res = await request(app)
      .post(`/orcamentos/${orcamentoId}/converter`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.pedido_id).toBeDefined();
    expect(res.body.orcamento_id).toBe(orcamentoId);
  });

  it("rejeita converter duas vezes", async () => {
    const res = await request(app)
      .post(`/orcamentos/${orcamentoId}/converter`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /orcamentos/:id", () => {
  it("rejeita excluir orçamento aprovado", async () => {
    const res = await request(app)
      .delete(`/orcamentos/${orcamentoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("exclui orçamento em rascunho", async () => {
    const orc = await request(app)
      .post("/orcamentos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: clienteId,
        itens: [
          { catalogo_id: catalogoId1, quantidade: 1, preco_unitario: 10 },
        ],
      });
    const res = await request(app)
      .delete(`/orcamentos/${orc.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
