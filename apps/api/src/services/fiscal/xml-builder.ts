// apps/api/src/services/fiscal/xml-builder.ts

import { DPSPayload } from "@erp/shared";

// ══════════════════════════════════════════════════════════════
// SEGURANÇA: Sanitização de XML
//
// Todo valor inserido no XML é sanitizado para prevenir
// XML injection. Caracteres especiais são escapados.
// ══════════════════════════════════════════════════════════════

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanNumeric(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Monta o ID da DPS conforme padrão nacional:
 * "DPS" + Código IBGE (7) + Tipo Inscrição (1) + CNPJ (14) + Série (5) + Número (15)
 * Total: 3 + 7 + 1 + 14 + 5 + 15 = 45 caracteres
 */
function buildDPSId(payload: DPSPayload): string {
  const codigoMunicipio = payload.prestador.codigo_municipio.padStart(7, "0");
  const tipoInscricao = "1"; // 1 = CNPJ
  const cnpj = cleanNumeric(payload.prestador.cnpj).padStart(14, "0");
  const serie = payload.serie.padStart(5, "0");
  const numero = payload.numero.padStart(15, "0");

  return `DPS${codigoMunicipio}${tipoInscricao}${cnpj}${serie}${numero}`;
}

/**
 * Constrói o XML da DPS (Declaração de Prestação de Serviços)
 * seguindo o layout do Padrão Nacional da NFS-e.
 *
 * Referência: Anexo I - Leiautes RN DPS NFSe (gov.br/nfse)
 */
export function buildDPSXml(payload: DPSPayload): string {
  const id = buildDPSId(payload);
  const cnpjPrestador = cleanNumeric(payload.prestador.cnpj);
  const docTomador = cleanNumeric(payload.tomador.cpf_cnpj);
  const cepTomador = cleanNumeric(payload.tomador.cep);
  const valorServico = payload.servico.valor_servicos.toFixed(2);
  const aliquota = payload.servico.aliquota_iss.toFixed(4);
  const valorIss = (
    (payload.servico.valor_servicos * payload.servico.aliquota_iss) /
    100
  ).toFixed(2);

  // Tag do documento do tomador conforme tipo
  const tagDocTomador =
    payload.tomador.tipo === "PF"
      ? `<CPF>${docTomador}</CPF>`
      : `<CNPJ>${docTomador}</CNPJ>`;

  // Código de opção do Simples Nacional
  // 1 = Microempresa Municipal, 2 = Estimativa, 3 = Sociedade de Profissionais
  // 4 = Cooperativa, 6 = MEI, 0 = Não optante
  const codSimples =
    payload.regime_tributario === "simples_nacional" ? "1" : "0";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="${escapeXml(id)}" versao="1.00">
    <tpAmb>__AMBIENTE__</tpAmb>
    <dhEmi>${escapeXml(payload.data_emissao)}</dhEmi>
    <verAplic>ERP-GRAFICA-1.0</verAplic>
    <serie>${escapeXml(payload.serie)}</serie>
    <nDPS>${escapeXml(payload.numero)}</nDPS>
    <dCompet>${escapeXml(payload.data_competencia)}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${escapeXml(payload.prestador.codigo_municipio)}</cLocEmi>
    <opSimpNac>${codSimples}</opSimpNac>
    <regEspTrib>0</regEspTrib>

    <prest>
      <CNPJ>${cnpjPrestador}</CNPJ>
      <IM>${escapeXml(payload.prestador.inscricao_municipal)}</IM>
    </prest>

    <toma>
      ${tagDocTomador}
      <xNome>${escapeXml(payload.tomador.razao_social)}</xNome>
      <end>
        <xLgr>${escapeXml(payload.tomador.logradouro)}</xLgr>
        <nro>${escapeXml(payload.tomador.numero)}</nro>
        ${payload.tomador.complemento ? `<xCpl>${escapeXml(payload.tomador.complemento)}</xCpl>` : ""}
        <xBairro>${escapeXml(payload.tomador.bairro)}</xBairro>
        <cMun>${escapeXml(payload.tomador.codigo_municipio)}</cMun>
        <UF>${escapeXml(payload.tomador.uf)}</UF>
        <CEP>${cepTomador}</CEP>
      </end>
      ${payload.tomador.telefone ? `<fone>${escapeXml(cleanNumeric(payload.tomador.telefone))}</fone>` : ""}
      ${payload.tomador.email ? `<email>${escapeXml(payload.tomador.email)}</email>` : ""}
    </toma>

    <serv>
      <cServ>
        <cTribNac>${escapeXml(payload.servico.codigo_tributacao_nacional)}</cTribNac>
        ${payload.servico.codigo_nbs ? `<cNBS>${escapeXml(payload.servico.codigo_nbs)}</cNBS>` : ""}
        <xDescServ>${escapeXml(payload.servico.discriminacao)}</xDescServ>
      </cServ>
      <cLocPrestacao>${escapeXml(payload.servico.codigo_municipio_incidencia)}</cLocPrestacao>
    </serv>

    <valores>
      <vServPrest>
        <vServ>${valorServico}</vServ>
      </vServPrest>
      <trib>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <cPaisResult>1058</cPaisResult>
          <tpRetISSQN>${payload.servico.iss_retido ? "1" : "2"}</tpRetISSQN>
        </tribMun>
      </trib>
    </valores>

  </infDPS>
</DPS>`;

  return xml;
}

/**
 * Constrói o XML de cancelamento de NFS-e
 */
export function buildCancelamentoXml(
  chaveAcesso: string,
  codigoMotivo: string,
  justificativa: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PedCancelamento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infPedCancelamento>
    <chNFSe>${escapeXml(chaveAcesso)}</chNFSe>
    <cMotCanc>${escapeXml(codigoMotivo)}</cMotCanc>
    <xMotCanc>${escapeXml(justificativa)}</xMotCanc>
  </infPedCancelamento>
</PedCancelamento>`;
}
