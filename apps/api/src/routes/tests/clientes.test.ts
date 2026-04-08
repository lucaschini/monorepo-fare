import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import bcrypt from "bcryptjs";

let token: string;

beforeAll(async () => {
  // Setup: tabelas + usuário + login para pegar token
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

  // Limpa clientes de testes anteriores
  await pool.query("DELETE FROM clientes");
});

const clienteValido = {
  tipo: "PJ",
  nome_razao: "Gráfica Teste LTDA",
  cpf_cnpj: "11222333000181",
  inscricao_estadual: "123456789",
  email: "contato@graficateste.com",
  telefone: "(11) 99999-0000",
  cep: "13201-000",
  logradouro: "Rua Teste",
  numero: "100",
  complemento: "Sala 1",
  bairro: "Centro",
  cidade: "Jundiaí",
  uf: "SP",
};

describe("POST /clientes", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/clientes").send(clienteValido);
    expect(res.status).toBe(401);
  });

  it("retorna 400 para campos obrigatórios ausentes", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "PJ" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para CNPJ inválido", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...clienteValido, cpf_cnpj: "00000000000000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CNPJ inválido/);
  });

  it("retorna 400 para CPF inválido quando tipo é PF", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...clienteValido, tipo: "PF", cpf_cnpj: "00000000000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CPF inválido/);
  });

  it("cria cliente com dados válidos", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send(clienteValido);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.nome_razao).toBe(clienteValido.nome_razao);
    expect(res.body.cpf_cnpj).toBe(clienteValido.cpf_cnpj);
  });

  it("retorna 409 para CNPJ duplicado", async () => {
    const res = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send(clienteValido);
    expect(res.status).toBe(409);
  });
});

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
  });

  it("busca sem resultados retorna array vazio", async () => {
    const res = await request(app)
      .get("/clientes?busca=inexistente999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

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

describe("PUT /clientes/:id", () => {
  it("atualiza nome do cliente", async () => {
    const lista = await request(app)
      .get("/clientes")
      .set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;

    const res = await request(app)
      .put(`/clientes/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nome_razao: "Gráfica Atualizada LTDA" });
    expect(res.status).toBe(200);
    expect(res.body.nome_razao).toBe("Gráfica Atualizada LTDA");
  });
});

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
