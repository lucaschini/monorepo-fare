import { up as up001 } from "./migrations/001_initial";
import { up as up002 } from "./migrations/002_clientes_optional_fields";
import { up as up003 } from "./migrations/003_catalogo";
import { up as up004 } from "./migrations/004_orcamentos_pedidos";
import { up as up005 } from "./migrations/005_estoque";
import { up as up006 } from "./migrations/006_notas_fiscais";
import { up as up007 } from "./migrations/007_update_status_financeiro";
import { up as up008 } from "./migrations/008_fiscal_config";
import { up as up009 } from "./migrations/009_pagamento_pedido";
import { up as up010 } from "./migrations/010_user_roles";

import { pool } from "./connection";

async function migrate() {
  try {
    await up001();
    await up002();
    await up003();
    await up004();
    await up005();
    await up006();
    await up007();
    await up008();
    await up009();
    await up010();
    console.log("✅ Todas as migrations executadas com sucesso");
  } catch (error) {
    console.error("❌ Erro ao executar migrations:", error);
  } finally {
    await pool.end();
  }
}

migrate();
