import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import bcrypt from "bcryptjs";

let token: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS catalogo (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')),
      unidade VARCHAR(20) NOT NULL,
      preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
      codigo_fiscal VARCHAR(20),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const hash = await bcrypt.hash("teste123", 10);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET senha_hash = $3`,
    ["Teste", "teste@erp.local", hash],
  );

  const res = await request(app)
    .post("/auth/login")
    .send({ email: "teste@erp.local", senha: "teste123" });
  token = res.body.token;

  await pool.query("DELETE FROM catalogo");
});

const itemProduto = {
  nome: "Cartão de Visita 4x4",
  descricao: "Cartão de visita colorido frente e verso",
  tipo: "produto",
  unidade: "un",
  preco_unitario: 150.0,
  codigo_fiscal: "49119900",
};

const itemServico = {
  nome: "Design de Logo",
  descricao: "Criação de logotipo personalizado",
  tipo: "servico",
  unidade: "serv",
  preco_unitario: 500.0,
  codigo_fiscal: "1302",
};

describe("POST /catalogo", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/catalogo").send(itemProduto);
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem campos obrigatórios", async () => {
    const res = await request(app)
      .post("/catalogo")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Teste" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tipo inválido", async () => {
    const res = await request(app)
      .post("/catalogo")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...itemProduto, tipo: "invalido" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para preço negativo", async () => {
    const res = await request(app)
      .post("/catalogo")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...itemProduto, preco_unitario: -10 });
    expect(res.status).toBe(400);
  });

  it("cria item produto com sucesso", async () => {
    const res = await request(app)
      .post("/catalogo")
      .set("Authorization", `Bearer ${token}`)
      .send(itemProduto);
    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(itemProduto.nome);
    expect(res.body.tipo).toBe("produto");
  });

  it("cria item serviço com sucesso", async () => {
    const res = await request(app)
      .post("/catalogo")
      .set("Authorization", `Bearer ${token}`)
      .send(itemServico);
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("servico");
  });
});

describe("GET /catalogo", () => {
  it("retorna lista completa", async () => {
    const res = await request(app)
      .get("/catalogo")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("filtra por tipo produto", async () => {
    const res = await request(app)
      .get("/catalogo?tipo=produto")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((i: any) => i.tipo === "produto")).toBe(true);
  });

  it("filtra por tipo servico", async () => {
    const res = await request(app)
      .get("/catalogo?tipo=servico")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((i: any) => i.tipo === "servico")).toBe(true);
  });

  it("busca por nome", async () => {
    const res = await request(app)
      .get("/catalogo?busca=Logo")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nome).toBe("Design de Logo");
  });
});

describe("PUT /catalogo/:id", () => {
  it("atualiza preço do item", async () => {
    const lista = await request(app)
      .get("/catalogo")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/catalogo/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ preco_unitario: 200.0 });
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.preco_unitario)).toBe(200.0);
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .put("/catalogo/99999")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Teste" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /catalogo/:id", () => {
  it("remove item existente", async () => {
    const lista = await request(app)
      .get("/catalogo")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .delete(`/catalogo/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/catalogo/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(check.status).toBe(404);
  });
});
