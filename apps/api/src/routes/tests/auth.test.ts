import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import bcrypt from "bcryptjs";

describe("POST /auth/login", () => {
  beforeAll(async () => {
    // Garante tabela e usuário de teste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const hash = await bcrypt.hash("teste123", 10);
    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET senha_hash = $3`,
      ["Teste", "teste@erp.local", hash],
    );
  });

  it("retorna 400 se email ou senha estiverem ausentes", async () => {
    const res = await request(app).post("/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("retorna 401 para credenciais inválidas", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "teste@erp.local", senha: "errada" });
    expect(res.status).toBe(401);
  });

  it("retorna 401 para email inexistente", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "naoexiste@erp.local", senha: "teste123" });
    expect(res.status).toBe(401);
  });

  it("retorna token e dados do usuário para credenciais válidas", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "teste@erp.local", senha: "teste123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe("teste@erp.local");
    expect(res.body.usuario).not.toHaveProperty("senha_hash");
  });
});
