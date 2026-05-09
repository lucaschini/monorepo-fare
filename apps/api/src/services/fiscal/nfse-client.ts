// apps/api/src/services/fiscal/nfse-client.ts

import https from "https";
import zlib from "zlib";
import {
  AmbienteFiscal,
  ResultadoEmissao,
  ResultadoCancelamento,
} from "@erp/shared";
import { createMTLSAgent } from "./certificate";

// ══════════════════════════════════════════════════════════════
// SEGURANÇA: Comunicação com a API Nacional
//
// - mTLS obrigatório: o servidor valida nosso certificado
//   e nós validamos o do servidor (rejectUnauthorized: true)
// - Timeout de 30s para evitar conexões pendentes
// - Retry com backoff exponencial para resiliência
// - Compactação GZip + Base64 conforme exigido pelo padrão
// ══════════════════════════════════════════════════════════════

const ENDPOINTS: Record<AmbienteFiscal, string> = {
  homologacao: "https://www.producaorestrita.nfse.gov.br/SefinNacional",
  producao: "https://sefin.nfse.gov.br/sefinnacional",
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

/**
 * Compacta XML com GZip e codifica em Base64
 * (formato exigido pela API Nacional)
 */
function compressAndEncode(xml: string): string {
  const gzipped = zlib.gzipSync(Buffer.from(xml, "utf-8"));
  return gzipped.toString("base64");
}

/**
 * Descompacta resposta Base64+GZip → XML
 */
function decodeAndDecompress(base64: string): string {
  const buffer = Buffer.from(base64, "base64");
  return zlib.gunzipSync(buffer).toString("utf-8");
}

/**
 * Executa requisição HTTP com mTLS e retry com backoff exponencial
 */
async function requestWithRetry(
  url: string,
  method: string,
  body: string | null,
  agent: https.Agent,
  attempt = 1,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      agent,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "ERP-Grafica/1.0",
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ statusCode: res.statusCode || 500, body: data });
      });
    });

    req.on("error", (err) => {
      // Retry com backoff exponencial + jitter
      if (attempt < MAX_RETRIES) {
        const delay =
          BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(
          `[fiscal] Tentativa ${attempt} falhou, retry em ${Math.round(delay)}ms: ${err.message}`,
        );
        setTimeout(() => {
          requestWithRetry(url, method, body, agent, attempt + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(
          new Error(
            `Falha na comunicação após ${MAX_RETRIES} tentativas: ${err.message}`,
          ),
        );
      }
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout na comunicação com a API Nacional"));
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Envia DPS assinada para a API Nacional (emissão síncrona)
 */
export async function enviarDPS(
  xmlAssinado: string,
  pfxBuffer: Buffer,
  pfxPassword: string,
  ambiente: AmbienteFiscal,
): Promise<ResultadoEmissao> {
  const agent = createMTLSAgent(pfxBuffer, pfxPassword);
  const base64Xml = compressAndEncode(xmlAssinado);
  const baseUrl = ENDPOINTS[ambiente];
  const url = `${baseUrl}/nfse`;

  const payload = JSON.stringify({
    dpsXmlGZipB64: base64Xml,
  });

  try {
    const response = await requestWithRetry(url, "POST", payload, agent);
    agent.destroy(); // Libera recursos

    if (response.statusCode === 200 || response.statusCode === 201) {
      const data = JSON.parse(response.body);
      return {
        sucesso: true,
        chave_acesso: data.chNFSe || data.chaveAcesso,
        numero_nota: data.nNFSe || data.numeroNota,
        codigo_verificacao: data.cVerif,
        protocolo: data.nProt || data.protocolo,
        xml_retorno: data.xmlNFSe
          ? decodeAndDecompress(data.xmlNFSe)
          : response.body,
        url_consulta: data.urlConsulta || null,
        status_code: response.statusCode,
      };
    }

    // Tratar rejeições da API
    let mensagemErro = `HTTP ${response.statusCode}`;
    try {
      const errorData = JSON.parse(response.body);
      mensagemErro =
        errorData.mensagem || errorData.xMotivo || JSON.stringify(errorData);
    } catch {
      mensagemErro = response.body.substring(0, 500);
    }

    return {
      sucesso: false,
      mensagem_erro: mensagemErro,
      status_code: response.statusCode,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      mensagem_erro: err.message,
    };
  }
}

/**
 * Consulta NFS-e pela chave de acesso
 */
export async function consultarNFSe(
  chaveAcesso: string,
  pfxBuffer: Buffer,
  pfxPassword: string,
  ambiente: AmbienteFiscal,
): Promise<ResultadoEmissao> {
  const agent = createMTLSAgent(pfxBuffer, pfxPassword);
  const baseUrl = ENDPOINTS[ambiente];
  const url = `${baseUrl}/nfse/${chaveAcesso}`;

  try {
    const response = await requestWithRetry(url, "GET", null, agent);
    agent.destroy();

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      return {
        sucesso: true,
        chave_acesso: chaveAcesso,
        numero_nota: data.nNFSe,
        xml_retorno: response.body,
        status_code: response.statusCode,
      };
    }

    return {
      sucesso: false,
      mensagem_erro: response.body.substring(0, 500),
      status_code: response.statusCode,
    };
  } catch (err: any) {
    return { sucesso: false, mensagem_erro: err.message };
  }
}

/**
 * Envia cancelamento de NFS-e
 */
export async function cancelarNFSe(
  xmlCancelamentoAssinado: string,
  pfxBuffer: Buffer,
  pfxPassword: string,
  ambiente: AmbienteFiscal,
): Promise<ResultadoCancelamento> {
  const agent = createMTLSAgent(pfxBuffer, pfxPassword);
  const base64Xml = compressAndEncode(xmlCancelamentoAssinado);
  const baseUrl = ENDPOINTS[ambiente];
  const url = `${baseUrl}/nfse/cancelar`;

  const payload = JSON.stringify({
    pedCancelamentoXmlGZipB64: base64Xml,
  });

  try {
    const response = await requestWithRetry(url, "POST", payload, agent);
    agent.destroy();

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      return {
        sucesso: true,
        protocolo: data.nProt,
      };
    }

    return {
      sucesso: false,
      mensagem_erro: response.body.substring(0, 500),
    };
  } catch (err: any) {
    return { sucesso: false, mensagem_erro: err.message };
  }
}
