import { afterAll } from "vitest";
import { pool } from "../db/connection";

afterAll(async () => {
  await pool.end();
});
