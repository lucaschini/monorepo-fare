import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { pool } from "../../db/connection";
import { cleanDatabase } from "../../__tests__/helpers";
import bcrypt from "bcryptjs";

let token: string;
let pedidoIdProduto: number;
let pedidoIdServico: number;
let pedidoIdMisto: number;
let clienteId: number;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, senha_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, tipo VARCHAR(2), nome_razao VARCHAR(255) NOT NULL, cpf_cnpj VARCHAR(18), inscricao_estadual VARCHAR(20), email VARCHAR(255), telefone VARCHAR(20), cep VARCHAR(9), logradouro VARCHAR(255), numero VARCHAR(20), complemento VARCHAR(255), bairro VARCHAR(100), cidade VARCHAR(100), uf VARCHAR(2), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS catalogo (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, descricao TEXT, tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')), unidade VARCHAR(20) NOT NULL, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, codigo_fiscal VARCHAR(20), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedidos (id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id), orcamento_id INTEGER, status VARCHAR(30) NOT NULL DEFAULT 'aberto', valor_total NUMERIC(12,2) NOT NULL DEFAULT 0, prazo_entrega DATE, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS pedido_itens (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE, catalogo_id INTEGER NOT NULL REFERENCES catalogo(id), quantidade NUMERIC(12,3) NOT NULL DEFAULT 1, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, especificacoes TEXT);
    CREATE TABLE IF NOT EXISTS notas_fiscais (id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id), cliente_id INTEGER NOT NULL REFERENCES clientes(id), tipo VARCHAR(5) NOT NULL CHECK (tipo IN ('nfe', 'nfse')), status VARCHAR(20) NOT NULL DEFAULT 'aguardando', numero_nota VARCHAR(50), valor NUMERIC(12,2) NOT NULL DEFAULT 0, xml_envio TEXT, xml_retorno TEXT, protocolo VARCHAR(100), danfe_pdf_url TEXT, mensagem_erro TEXT, justificativa_cancelamento TEXT, emitida_em TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
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

  // Cliente
  const c = await request(app)
    .post("/clientes")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome_razao: "Cliente Entrega" });
  clienteId = c.body.id;

  // Catálogo
  const prod = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Cartão",
      tipo: "produto",
      unidade: "un",
      preco_unitario: 100,
    });
  const serv = await request(app)
    .post("/catalogo")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "Design",
      tipo: "servico",
      unidade: "serv",
      preco_unitario: 500,
    });

  // Pedido só produto
  const p1 = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      cliente_id: clienteId,
      itens: [
        { catalogo_id: prod.body.id, quantidade: 10, preco_unitario: 100 },
      ],
    });
  pedidoIdProduto = p1.body.id;

  // Pedido só serviço
  const p2 = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      cliente_id: clienteId,
      itens: [
        { catalogo_id: serv.body.id, quantidade: 1, preco_unitario: 500 },
      ],
    });
  pedidoIdServico = p2.body.id;

  // Pedido misto
  const p3 = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      cliente_id: clienteId,
      itens: [
        { catalogo_id: prod.body.id, quantidade: 5, preco_unitario: 100 },
        { catalogo_id: serv.body.id, quantidade: 1, preco_unitario: 300 },
      ],
    });
  pedidoIdMisto = p3.body.id;

  // Avança todos para "pronto"
  for (const id of [pedidoIdProduto, pedidoIdServico, pedidoIdMisto]) {
    await request(app)
      .put(`/pedidos/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "em_producao" });
    await request(app)
      .put(`/pedidos/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "pronto" });
  }
});

describe("POST /pedidos/:id/entregar", () => {
  it("rejeita entrega de pedido que não está pronto", async () => {
    // Cria pedido aberto
    const cli = await request(app)
      .post("/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome_razao: "Outro" });
    const cat = await request(app)
      .post("/catalogo")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome: "Item",
        tipo: "produto",
        unidade: "un",
        preco_unitario: 10,
      });
    const ped = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cliente_id: cli.body.id,
        itens: [
          { catalogo_id: cat.body.id, quantidade: 1, preco_unitario: 10 },
        ],
      });
    const res = await request(app)
      .post(`/pedidos/${ped.body.id}/entregar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("retorna 404 para pedido inexistente", async () => {
    const res = await request(app)
      .post("/pedidos/99999/entregar")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("registra entrega de pedido com produtos → cria NF-e pendente", async () => {
    const res = await request(app)
      .post(`/pedidos/${pedidoIdProduto}/entregar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("entregue");
    expect(res.body.notas.length).toBe(1);
    expect(res.body.notas[0].tipo).toBe("nfe");
    expect(res.body.notas[0].status).toBe("aguardando");
  });

  it("registra entrega de pedido com serviços → cria NFS-e pendente", async () => {
    const res = await request(app)
      .post(`/pedidos/${pedidoIdServico}/entregar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notas.length).toBe(1);
    expect(res.body.notas[0].tipo).toBe("nfse");
  });

  it("registra entrega de pedido misto → cria NF-e + NFS-e pendentes", async () => {
    const res = await request(app)
      .post(`/pedidos/${pedidoIdMisto}/entregar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notas.length).toBe(2);
    const tipos = res.body.notas.map((n: any) => n.tipo).sort();
    expect(tipos).toEqual(["nfe", "nfse"]);
  });

  it("rejeita entregar pedido já entregue", async () => {
    const res = await request(app)
      .post(`/pedidos/${pedidoIdProduto}/entregar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /fiscal/notas", () => {
  it("lista todas as notas", async () => {
    const res = await request(app)
      .get("/fiscal/notas")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it("filtra por tipo nfe", async () => {
    const res = await request(app)
      .get("/fiscal/notas?tipo=nfe")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.every((n: any) => n.tipo === "nfe")).toBe(true);
  });

  it("filtra por cliente", async () => {
    const res = await request(app)
      .get(`/fiscal/notas/cliente/${clienteId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });
});
