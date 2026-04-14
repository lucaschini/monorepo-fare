import { afterAll, beforeAll } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

import { pool } from "../db/connection";
import { up as up001 } from "../db/migrations/001_initial";
import { up as up002 } from "../db/migrations/002_clientes_optional_fields";
import { up as up003 } from "../db/migrations/003_catalogo";
import { up as up004 } from "../db/migrations/004_orcamentos_pedidos";
import { up as up005 } from "../db/migrations/005_estoque";
import { up as up006 } from "../db/migrations/006_notas_fiscais";
import { up as up007 } from "../db/migrations/007_update_status_financeiro";

beforeAll(async () => {
  const result = await pool.query("SELECT current_database()");
  const dbName = result.rows[0].current_database;
  if (!dbName.includes("test")) {
    throw new Error(
      `ABORTANDO: testes conectados ao banco "${dbName}" ao invés do banco de teste!`,
    );
  }

  // Roda todas as migrations no banco de teste
  await up001();
  await up002();
  await up003();
  await up004();
  await up005();
  await up006();
  await up007();
});

afterAll(async () => {
  await pool.end();
});
