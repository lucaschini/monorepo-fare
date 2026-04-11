import { afterAll, beforeAll } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

import { pool } from "../db/connection";

beforeAll(async () => {
  // Garante que estamos no banco de teste
  const result = await pool.query("SELECT current_database()");
  const dbName = result.rows[0].current_database;
  if (!dbName.includes("test")) {
    throw new Error(
      `ABORTANDO: testes conectados ao banco "${dbName}" ao invés do banco de teste!`,
    );
  }
});

afterAll(async () => {
  await pool.end();
});
