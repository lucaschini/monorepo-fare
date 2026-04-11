import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import bcrypt from "bcryptjs";

let token: string;
let insumoId: number;
let pedidoId: number;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, senha_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, tipo VARCHAR(2), nome_razao VARCHAR(255) NOT NULL, cpf_cnpj VARCHAR(18), inscricao_estadual VARCHAR(20), email VARCHAR(255), telefone VARCHAR(20), cep VARCHAR(9), logradouro VARCHAR(255), numero VARCHAR(20), complemento VARCHAR(255), bairro VARCHAR(100), cidade VARCHAR(100), uf VARCHAR(2), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS catalogo (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, descricao TEXT, tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')), unidade VARCHAR(20) NOT NULL, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, codigo_fiscal VARCHAR(20), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedidos (id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), orcamento_id INTEGER, status VARCHAR(30) NOT NULL DEFAULT 'aberto', valor_total NUMERIC(12,2) NOT NULL DEFAULT 0, prazo_entrega DATE, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedido_itens (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE, catalogo_id INTEGER NOT NULL REFERENCES catalogo(id), quantidade NUMERIC(12,3) NOT NULL DEFAULT 1, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, especificacoes TEXT);
    CREATE TABLE IF NOT EXISTS insumos (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, unidade_medida VARCHAR(20) NOT NULL, estoque_atual NUMERIC(12,3) NOT NULL DEFAULT 0, estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (id SERIAL PRIMARY KEY, insumo_id INTEGER NOT NULL REFERENCES insumos(id), pedido_id INTEGER REFERENCES pedidos(id), tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')), quantidade NUMERIC(12,3) NOT NULL, lote VARCHAR(100), observacao TEXT, created_at TIMESTAMP DEFAULT NOW());
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

  await pool.query("DELETE FROM movimentacoes_estoque");
  await pool.query("DELETE FROM insumos");

  // Cria cliente + catálogo + pedido para testes de saída vinculada
  const cli = await request(app)
    .post("/clientes")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome_razao: "Cliente Estoque" });
  const cat = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Flyer",
      tipo: "produto",
      unidade: "un",
      preco_unitario: 50,
    });
  const ped = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      cliente_id: cli.body.id,
      itens: [
        { catalogo_id: cat.body.id, quantidade: 100, preco_unitario: 0.5 },
      ],
    });
  pedidoId = ped.body.id;
});

describe("POST /estoque/insumos", () => {
  it("retorna 400 sem campos obrigatórios", async () => {
    const res = await request(app)
      .post("/estoque/insumos")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("cria insumo com sucesso", async () => {
    const res = await request(app)
      .post("/estoque/insumos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome: "Papel Couché 150g",
        unidade_medida: "fl",
        estoque_minimo: 500,
      });
    expect(res.status).toBe(201);
    expect(res.body.nome).toBe("Papel Couché 150g");
    expect(parseFloat(res.body.estoque_atual)).toBe(0);
    expect(parseFloat(res.body.estoque_minimo)).toBe(500);
    insumoId = res.body.id;
  });
});

describe("GET /estoque/insumos", () => {
  it("lista insumos", async () => {
    const res = await request(app)
      .get("/estoque/insumos")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("busca por nome", async () => {
    const res = await request(app)
      .get("/estoque/insumos?busca=Couché")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.length).toBe(1);
  });
});

describe("POST /estoque/movimentacoes — entradas", () => {
  it("retorna 400 sem campos obrigatórios", async () => {
    const res = await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("retorna 400 para quantidade negativa", async () => {
    const res = await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ insumo_id: insumoId, tipo: "entrada", quantidade: -10 });
    expect(res.status).toBe(400);
  });

  it("registra entrada e atualiza estoque", async () => {
    const res = await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        insumo_id: insumoId,
        tipo: "entrada",
        quantidade: 1000,
        lote: "LOTE-001",
        observacao: "Compra fornecedor",
      });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.insumo.estoque_atual)).toBe(1000);
  });

  it("registra segunda entrada e acumula", async () => {
    const res = await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ insumo_id: insumoId, tipo: "entrada", quantidade: 500 });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.insumo.estoque_atual)).toBe(1500);
  });
});

describe("POST /estoque/movimentacoes — saídas", () => {
  it("registra saída vinculada a pedido", async () => {
    const res = await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        insumo_id: insumoId,
        pedido_id: pedidoId,
        tipo: "saida",
        quantidade: 200,
        observacao: "Produção flyers",
      });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.insumo.estoque_atual)).toBe(1300);
  });

  it("rejeita saída maior que estoque", async () => {
    const res = await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ insumo_id: insumoId, tipo: "saida", quantidade: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficiente/);
  });
});

describe("GET /estoque/alertas", () => {
  it("retorna insumos abaixo do mínimo", async () => {
    // Cria insumo com estoque baixo
    const ins = await request(app)
      .post("/estoque/insumos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Tinta Preta", unidade_medida: "L", estoque_minimo: 10 });
    await request(app)
      .post("/estoque/movimentacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ insumo_id: ins.body.id, tipo: "entrada", quantidade: 5 });

    const res = await request(app)
      .get("/estoque/alertas")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((i: any) => i.nome === "Tinta Preta")).toBe(true);
  });
});

describe("GET /estoque/insumos/:id/extrato", () => {
  it("retorna extrato do insumo", async () => {
    const res = await request(app)
      .get(`/estoque/insumos/${insumoId}/extrato`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.insumo.id).toBe(insumoId);
    expect(res.body.movimentacoes.length).toBeGreaterThan(0);
  });

  it("retorna 404 para insumo inexistente", async () => {
    const res = await request(app)
      .get("/estoque/insumos/99999/extrato")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /estoque/pedido/:pedidoId", () => {
  it("retorna insumos alocados para o pedido", async () => {
    const res = await request(app)
      .get(`/estoque/pedido/${pedidoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].insumo_nome).toBe("Papel Couché 150g");
  });
});

describe("GET /estoque/relatorio/consumo", () => {
  it("retorna relatório de consumo", async () => {
    const res = await request(app)
      .get("/estoque/relatorio/consumo")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("total_entradas");
    expect(res.body[0]).toHaveProperty("total_saidas");
  });
});

describe("DELETE /estoque/insumos/:id", () => {
  it("rejeita excluir insumo com movimentações", async () => {
    const res = await request(app)
      .delete(`/estoque/insumos/${insumoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("exclui insumo sem movimentações", async () => {
    const ins = await request(app)
      .post("/estoque/insumos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Descartável", unidade_medida: "un", estoque_minimo: 0 });
    const res = await request(app)
      .delete(`/estoque/insumos/${ins.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
