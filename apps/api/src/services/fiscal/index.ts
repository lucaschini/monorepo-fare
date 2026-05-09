import { v4 as uuidv4 } from "uuid";
import { query, pool } from "../../db/connection";
import { loadCertificate } from "./certificate";
import { buildDPSXml, buildCancelamentoXml } from "./xml-builder";
import { extractKeyFromPfx, signXml } from "./xml-signer";
import {
  enviarDPS,
  consultarNFSe as consultarAPI,
  cancelarNFSe as cancelarAPI,
} from "./nfse-client";
import { registrarAuditoria } from "./audit";
import {
  ConfigFiscal,
  DPSPayload,
  ResultadoEmissao,
  ResultadoCancelamento,
  clientePossuiDadosFiscais,
} from "@erp/shared";

async function getConfig(): Promise<ConfigFiscal> {
  const result = await query("SELECT * FROM config_fiscal ORDER BY id LIMIT 1");
  if (result.rows.length === 0) {
    throw new Error(
      "Configuração fiscal não encontrada. Configure os dados do emitente em /fiscal/config.",
    );
  }
  return result.rows[0];
}

async function getNextDPSNumber(
  client: any,
): Promise<{ serie: string; numero: string }> {
  const result = await client.query(
    "SELECT id, serie_dps, proximo_numero_dps FROM config_fiscal ORDER BY id LIMIT 1 FOR UPDATE",
  );
  const config = result.rows[0];
  const numero = String(config.proximo_numero_dps);
  await client.query(
    "UPDATE config_fiscal SET proximo_numero_dps = proximo_numero_dps + 1, updated_at = NOW() WHERE id = $1",
    [config.id],
  );
  return { serie: config.serie_dps, numero };
}

export async function emitirNFSe(
  notaId: number,
  usuarioId: number,
  ipOrigem: string,
): Promise<ResultadoEmissao> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const notaResult = await client.query(
      "SELECT * FROM notas_fiscais WHERE id = $1 FOR UPDATE",
      [notaId],
    );

    if (notaResult.rows.length === 0) {
      throw new Error("Nota fiscal não encontrada");
    }

    const nota = notaResult.rows[0];

    if (nota.status === "autorizada") {
      throw new Error("Esta nota já foi autorizada");
    }

    if (nota.status === "cancelada") {
      throw new Error("Esta nota foi cancelada");
    }

    if (nota.tipo !== "nfse") {
      throw new Error(
        "Este serviço emite apenas NFS-e. Para NF-e, use o módulo de produto.",
      );
    }

    let idempotencyKey = nota.idempotency_key;
    if (!idempotencyKey) {
      idempotencyKey = `nfse-${nota.pedido_id}-${nota.cliente_id}-${uuidv4()}`;
      await client.query(
        "UPDATE notas_fiscais SET idempotency_key = $1 WHERE id = $2",
        [idempotencyKey, notaId],
      );
    }

    const clienteResult = await client.query(
      "SELECT * FROM clientes WHERE id = $1",
      [nota.cliente_id],
    );

    if (clienteResult.rows.length === 0) {
      throw new Error("Cliente não encontrado");
    }

    const cliente = clienteResult.rows[0];

    if (!clientePossuiDadosFiscais(cliente)) {
      throw new Error(
        "O cliente não possui dados fiscais completos. Preencha tipo, CPF/CNPJ, e endereço antes de emitir.",
      );
    }

    const itensResult = await client.query(
      `SELECT pi.*, cat.nome AS catalogo_nome, cat.codigo_fiscal
       FROM pedido_itens pi
       JOIN catalogo cat ON cat.id = pi.catalogo_id
       WHERE pi.pedido_id = $1`,
      [nota.pedido_id],
    );

    const discriminacao = itensResult.rows
      .map(
        (item: any) =>
          `${item.catalogo_nome} - Qtd: ${Number(item.quantidade)} - Unit: R$${Number(item.preco_unitario).toFixed(2)} - Sub: R$${Number(item.subtotal).toFixed(2)}`,
      )
      .join(" | ");

    const itemServico = itensResult.rows.find((i: any) => i.codigo_fiscal);
    const codigoServico = itemServico?.codigo_fiscal || "0000";

    const config = await getConfig();

    if (!config.certificado_path || !config.certificado_senha_enc) {
      throw new Error("Certificado digital não configurado");
    }

    const { pfxBuffer, password } = loadCertificate(
      config.certificado_path,
      config.certificado_senha_enc,
    );

    const { serie, numero } = await getNextDPSNumber(client);

    const agora = new Date();
    const payload: DPSPayload = {
      serie,
      numero,
      data_emissao: agora.toISOString(),
      data_competencia: agora.toISOString().split("T")[0],
      prestador: {
        cnpj: config.cnpj,
        inscricao_municipal: config.inscricao_municipal,
        razao_social: config.razao_social,
        codigo_municipio: config.codigo_municipio,
        uf: config.uf,
      },
      tomador: {
        tipo: cliente.tipo,
        cpf_cnpj: cliente.cpf_cnpj,
        razao_social: cliente.nome_razao,
        email: cliente.email,
        telefone: cliente.telefone,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        uf: cliente.uf,
        cep: cliente.cep,
        codigo_municipio: config.codigo_municipio,
      },
      servico: {
        discriminacao,
        valor_servicos: Number(nota.valor),
        aliquota_iss: Number(config.aliquota_iss),
        item_lista_servico: codigoServico,
        codigo_tributacao_nacional: codigoServico.replace(".", ""),
        codigo_nbs: null,
        iss_retido: false,
        codigo_municipio_incidencia: config.codigo_municipio,
      },
      regime_tributario: config.regime_tributario,
    };

    let xml = buildDPSXml(payload);
    const tpAmb = config.ambiente === "producao" ? "1" : "2";
    xml = xml.replace("__AMBIENTE__", tpAmb);

    const { privateKey, certificate } = extractKeyFromPfx(pfxBuffer, password);
    const xmlAssinado = signXml(xml, privateKey, certificate);

    await client.query(
      `UPDATE notas_fiscais SET
        xml_envio = $1, numero_rps = $2, serie_rps = $3,
        tentativas = tentativas + 1
       WHERE id = $4`,
      [xmlAssinado, numero, serie, notaId],
    );

    await client.query("COMMIT");

    const resultado = await enviarDPS(
      xmlAssinado,
      pfxBuffer,
      password,
      config.ambiente,
    );

    if (resultado.sucesso) {
      await query(
        `UPDATE notas_fiscais SET
          status = 'autorizada', numero_nota = $1, chave_acesso = $2,
          codigo_verificacao = $3, protocolo = $4, xml_retorno = $5,
          url_consulta = $6, emitida_em = NOW(), mensagem_erro = NULL
         WHERE id = $7`,
        [
          resultado.numero_nota,
          resultado.chave_acesso,
          resultado.codigo_verificacao,
          resultado.protocolo,
          resultado.xml_retorno,
          resultado.url_consulta,
          notaId,
        ],
      );
    } else {
      await query(
        `UPDATE notas_fiscais SET
          status = 'rejeitada', mensagem_erro = $1,
          proximo_retry = NOW() + INTERVAL '5 minutes'
         WHERE id = $2`,
        [resultado.mensagem_erro, notaId],
      );
    }

    try {
      await registrarAuditoria({
        nota_id: notaId,
        acao: "emissao",
        usuario_id: usuarioId,
        ip_origem: ipOrigem,
        request_payload: xmlAssinado.substring(0, 5000),
        response_payload: resultado.xml_retorno?.substring(0, 5000),
        status_code: resultado.status_code,
        erro: resultado.mensagem_erro,
      });
    } catch {
      // ignora — nota pode não existir (FK)
    }

    return resultado;
  } catch (err: any) {
    await client.query("ROLLBACK");

    try {
      await registrarAuditoria({
        nota_id: notaId,
        acao: "emissao",
        usuario_id: usuarioId,
        ip_origem: ipOrigem,
        erro: err.message,
      });
    } catch {
      // ignora — nota pode não existir (FK)
    }

    return { sucesso: false, mensagem_erro: err.message };
  } finally {
    client.release();
  }
}

export async function consultarNFSe(
  notaId: number,
  usuarioId: number,
  ipOrigem: string,
): Promise<ResultadoEmissao> {
  const notaResult = await query("SELECT * FROM notas_fiscais WHERE id = $1", [
    notaId,
  ]);

  if (notaResult.rows.length === 0) {
    throw new Error("Nota fiscal não encontrada");
  }

  const nota = notaResult.rows[0];

  if (!nota.chave_acesso) {
    throw new Error("Esta nota não possui chave de acesso para consulta");
  }

  const config = await getConfig();

  if (!config.certificado_path || !config.certificado_senha_enc) {
    throw new Error("Certificado digital não configurado");
  }

  const { pfxBuffer, password } = loadCertificate(
    config.certificado_path,
    config.certificado_senha_enc,
  );
  const resultado = await consultarAPI(
    nota.chave_acesso,
    pfxBuffer,
    password,
    config.ambiente,
  );

  await registrarAuditoria({
    nota_id: notaId,
    acao: "consulta",
    usuario_id: usuarioId,
    ip_origem: ipOrigem,
    status_code: resultado.status_code,
    erro: resultado.mensagem_erro,
  });

  return resultado;
}

export async function cancelarNFSe(
  notaId: number,
  justificativa: string,
  usuarioId: number,
  ipOrigem: string,
): Promise<ResultadoCancelamento> {
  if (!justificativa || justificativa.trim().length < 15) {
    throw new Error(
      "Justificativa de cancelamento deve ter no mínimo 15 caracteres",
    );
  }

  const notaResult = await query("SELECT * FROM notas_fiscais WHERE id = $1", [
    notaId,
  ]);

  if (notaResult.rows.length === 0) {
    throw new Error("Nota fiscal não encontrada");
  }

  const nota = notaResult.rows[0];

  if (nota.status !== "autorizada") {
    throw new Error("Só é possível cancelar notas com status 'autorizada'");
  }

  if (!nota.chave_acesso) {
    throw new Error("Nota sem chave de acesso");
  }

  const config = await getConfig();

  if (!config.certificado_path || !config.certificado_senha_enc) {
    throw new Error("Certificado digital não configurado");
  }

  const { pfxBuffer, password } = loadCertificate(
    config.certificado_path,
    config.certificado_senha_enc,
  );
  const { privateKey, certificate } = extractKeyFromPfx(pfxBuffer, password);

  const xmlCancelamento = buildCancelamentoXml(
    nota.chave_acesso,
    "1",
    justificativa.trim(),
  );
  const xmlAssinado = signXml(xmlCancelamento, privateKey, certificate);

  const resultado = await cancelarAPI(
    xmlAssinado,
    pfxBuffer,
    password,
    config.ambiente,
  );

  if (resultado.sucesso) {
    await query(
      `UPDATE notas_fiscais SET
        status = 'cancelada', justificativa_cancelamento = $1,
        protocolo = COALESCE($2, protocolo)
       WHERE id = $3`,
      [justificativa.trim(), resultado.protocolo, notaId],
    );
  }

  await registrarAuditoria({
    nota_id: notaId,
    acao: "cancelamento",
    usuario_id: usuarioId,
    ip_origem: ipOrigem,
    request_payload: xmlAssinado.substring(0, 5000),
    erro: resultado.mensagem_erro,
  });

  return resultado;
}

export async function reprocessarRejeitadas(
  usuarioId: number,
  ipOrigem: string,
): Promise<{ total: number; sucesso: number; falha: number }> {
  const result = await query(
    `SELECT id FROM notas_fiscais
     WHERE status = 'rejeitada'
       AND tipo = 'nfse'
       AND tentativas < 5
       AND (proximo_retry IS NULL OR proximo_retry <= NOW())
     ORDER BY created_at ASC
     LIMIT 10`,
  );

  let sucesso = 0;
  let falha = 0;

  for (const row of result.rows) {
    const res = await emitirNFSe(row.id, usuarioId, ipOrigem);
    if (res.sucesso) sucesso++;
    else falha++;
  }

  return { total: result.rows.length, sucesso, falha };
}
