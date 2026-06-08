import { pool } from "../connection";

export async function up() {
  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'operador'
  `);

  console.log("✅ Migration 010");
}

export async function down() {
  await pool.query(`
    ALTER TABLE usuarios DROP COLUMN IF EXISTS role
  `);
}
