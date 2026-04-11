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
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(2) CHECK (tipo IS NULL OR tipo IN ('PF', 'PJ')),
      nome_razao VARCHAR(255) NOT NULL,
      cpf_cnpj VARCHAR(18),
      inscricao_estadual VARCHAR(20),
      email VARCHAR(255),
      telefone VARCHAR(20),
      cep VARCHAR(9),
      logradouro VARCHAR(255),
      numero VARCHAR(20),
      complemento VARCHAR(255),
      bairro VARCHAR(100),
      cidade VARCHAR(100),
      uf VARCHAR(2),
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

  await pool.query("DELETE FROM pedido_itens");
  await pool.query("DELETE FROM orcamento_itens");
  await pool.query("DELETE FROM pedidos");
  await pool.query("DELETE FROM orcamentos");
  await pool.query("DELETE FROM clientes");
});

// ── POST /clientes (cadastro básico) ──

describe("POST /clientes", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app)
      .post("/clientes")
      .send({ nome_razao: "Teste" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem nome_razao", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ telefone: "11999990000" });
    expect(res.status).toBe(400);
  });

  it("cria cliente só com nome", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome_razao: "Cliente Simples" });
    expect(res.status).toBe(201);
    expect(res.body.nome_razao).toBe("Cliente Simples");
    expect(res.body.cpf_cnpj).toBeNull();
  });

  it("cria cliente com nome, telefone e email", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome_razao: "Gráfica Teste LTDA",
        telefone: "(11) 99999-0000",
        email: "contato@graficateste.com",
      });
    expect(res.status).toBe(201);
    expect(res.body.telefone).toBe("(11) 99999-0000");
    expect(res.body.email).toBe("contato@graficateste.com");
  });
});

// ── GET /clientes ──

describe("GET /clientes", () => {
  it("retorna lista de clientes", async () => {
    const res = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("busca por nome", async () => {
    const res = await request(app)
      .get("/clientes?busca=Gráfica Teste")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nome_razao).toBe("Gráfica Teste LTDA");
  });

  it("busca sem resultados retorna array vazio", async () => {
    const res = await request(app)
      .get("/clientes?busca=inexistente999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

// ── GET /clientes/:id ──

describe("GET /clientes/:id", () => {
  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .get("/clientes/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("retorna cliente por ID", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .get(`/clientes/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
});

// ── PUT /clientes/:id (dados básicos) ──

describe("PUT /clientes/:id", () => {
  it("atualiza nome do cliente", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/clientes/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nome_razao: "Nome Atualizado" });
    expect(res.status).toBe(200);
    expect(res.body.nome_razao).toBe("Nome Atualizado");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .put("/clientes/99999")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome_razao: "Teste" });
    expect(res.status).toBe(404);
  });
});

// ── PUT /clientes/:id/fiscal ──

describe("PUT /clientes/:id/fiscal", () => {
  const dadosFiscais = {
    tipo: "PJ",
    cpf_cnpj: "11222333000181",
    inscricao_estadual: "123456789",
    cep: "13201-000",
    logradouro: "Rua Teste",
    numero: "100",
    bairro: "Centro",
    cidade: "Jundiaí",
    uf: "SP",
  };

  it("retorna 400 sem campos fiscais obrigatórios", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/clientes/${id}/fiscal`)
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "PJ" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para CNPJ inválido", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/clientes/${id}/fiscal`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...dadosFiscais, cpf_cnpj: "00000000000000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CNPJ inválido/);
  });

  it("retorna 400 para CPF inválido", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/clientes/${id}/fiscal`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...dadosFiscais, tipo: "PF", cpf_cnpj: "00000000000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CPF inválido/);
  });

  it("salva dados fiscais com sucesso", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/clientes/${id}/fiscal`)
      .set("Authorization", `Bearer ${token}`)
      .send(dadosFiscais);
    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe("PJ");
    expect(res.body.cpf_cnpj).toBe("11222333000181");
    expect(res.body.cidade).toBe("Jundiaí");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .put("/clientes/99999/fiscal")
      .set("Authorization", `Bearer ${token}`)
      .send(dadosFiscais);
    expect(res.status).toBe(404);
  });
});

// ── DELETE /clientes/:id ──

describe("DELETE /clientes/:id", () => {
  it("remove cliente existente", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .delete(`/clientes/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/clientes/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(check.status).toBe(404);
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app)
      .delete("/clientes/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
