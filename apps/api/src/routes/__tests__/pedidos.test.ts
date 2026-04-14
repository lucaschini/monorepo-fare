import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import { cleanDatabase } from "../../__tests__/helpers";
import bcrypt from "bcryptjs";

let token: string;
let clienteId: number;
let catalogoId: number;
let pedidoId: number;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, senha_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, tipo VARCHAR(2), nome_razao VARCHAR(255) NOT NULL, cpf_cnpj VARCHAR(18), inscricao_estadual VARCHAR(20), email VARCHAR(255), telefone VARCHAR(20), cep VARCHAR(9), logradouro VARCHAR(255), numero VARCHAR(20), complemento VARCHAR(255), bairro VARCHAR(100), cidade VARCHAR(100), uf VARCHAR(2), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS catalogo (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, descricao TEXT, tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')), unidade VARCHAR(20) NOT NULL, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, codigo_fiscal VARCHAR(20), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedidos (id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), orcamento_id INTEGER, status VARCHAR(30) NOT NULL DEFAULT 'em_aberto', valor_total NUMERIC(12,2) NOT NULL DEFAULT 0, prazo_entrega DATE, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedido_itens (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE, catalogo_id INTEGER NOT NULL REFERENCES catalogo(id), quantidade NUMERIC(12,3) NOT NULL DEFAULT 1, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, especificacoes TEXT);
  `);

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

  const c = await request(app)
    .post("/clientes")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome_razao: "Cliente Pedido" });
  clienteId = c.body.id;

  const cat = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Banner",
      tipo: "produto",
      unidade: "m²",
      preco_unitario: 80,
    });
  catalogoId = cat.body.id;
});

describe("POST /pedidos", () => {
  it("retorna 400 sem itens", async () => {
    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${token}`)
      .send({ cliente_id: clienteId });
    expect(res.status).toBe(400);
  });

  it("retorna 400 com cliente inexistente", async () => {
    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: 99999,
        itens: [{ catalogo_id: catalogoId, quantidade: 1, preco_unitario: 80 }],
      });
    expect(res.status).toBe(400);
  });

  it("cria pedido com sucesso", async () => {
    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: clienteId,
        prazo_entrega: "2026-05-01",
        observacoes: "Pedido urgente",
        itens: [
          {
            catalogo_id: catalogoId,
            quantidade: 10,
            preco_unitario: 80,
            especificacoes: "Lona 440g",
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("em_aberto");
    expect(parseFloat(res.body.valor_total)).toBe(800);
    expect(res.body.itens.length).toBe(1);
    expect(res.body.itens[0].especificacoes).toBe("Lona 440g");
    pedidoId = res.body.id;
  });
});

describe("GET /pedidos", () => {
  it("lista pedidos", async () => {
    const res = await request(app)
      .get("/pedidos")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].cliente_nome).toBeDefined();
  });

  it("filtra por status", async () => {
    const res = await request(app)
      .get("/pedidos?status=em_aberto")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.every((p: any) => p.status === "em_aberto")).toBe(true);
  });

  it("busca por número", async () => {
    const res = await request(app)
      .get(`/pedidos?numero=${pedidoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(pedidoId);
  });

  it("busca por cliente", async () => {
    const res = await request(app)
      .get("/pedidos?busca=Cliente Pedido")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("GET /pedidos/:id", () => {
  it("retorna pedido com itens", async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.itens.length).toBe(1);
    expect(res.body.itens[0].catalogo_nome).toBe("Banner");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .get("/pedidos/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("PUT /pedidos/:id/status — fluxo completo", () => {
  it("rejeita transição inválida em_aberto → entregue", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "entregue" });
    expect(res.status).toBe(400);
  });

  it("em_aberto → em_producao", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "em_producao" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_producao");
  });

  it("em_producao → aguardando_retirada", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "aguardando_retirada" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aguardando_retirada");
  });

  it("aguardando_retirada → em_transporte", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "em_transporte" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_transporte");
  });

  it("em_transporte → entregue", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "entregue" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("entregue");
  });

  it("entregue → aguardando_pagamento", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "aguardando_pagamento" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aguardando_pagamento");
  });
});

describe("DELETE /pedidos/:id", () => {
  it("rejeita excluir pedido não em_aberto", async () => {
    const res = await request(app)
      .delete(`/pedidos/${pedidoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("exclui pedido aberto", async () => {
    const novo = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: clienteId,
        itens: [{ catalogo_id: catalogoId, quantidade: 1, preco_unitario: 10 }],
      });
    const res = await request(app)
      .delete(`/pedidos/${novo.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
