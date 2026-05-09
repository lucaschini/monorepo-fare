// apps/api/src/services/fiscal/__tests__/xml-builder.test.ts

import { describe, it, expect } from "vitest";
import { buildDPSXml, buildCancelamentoXml } from "../xml-builder";
import { DPSPayload } from "@erp/shared";

const payloadBase: DPSPayload = {
  serie: "900",
  numero: "1",
  data_emissao: "2026-05-08T10:00:00-03:00",
  data_competencia: "2026-05-08",
  prestador: {
    cnpj: "11222333000181",
    inscricao_municipal: "12345",
    razao_social: "Gráfica Teste LTDA",
    codigo_municipio: "3525904",
    uf: "SP",
  },
  tomador: {
    tipo: "PJ",
    cpf_cnpj: "22333444000199",
    razao_social: "Cliente Exemplo LTDA",
    email: "cliente@exemplo.com",
    telefone: "(11) 99999-0000",
    logradouro: "Rua das Flores",
    numero: "100",
    complemento: "Sala 5",
    bairro: "Centro",
    cidade: "Jundiaí",
    uf: "SP",
    cep: "13201-000",
    codigo_municipio: "3525904",
  },
  servico: {
    discriminacao: "Design de logotipo personalizado",
    valor_servicos: 500.0,
    aliquota_iss: 5.0,
    item_lista_servico: "1302",
    codigo_tributacao_nacional: "130201",
    codigo_nbs: null,
    iss_retido: false,
    codigo_municipio_incidencia: "3525904",
  },
  regime_tributario: "simples_nacional",
};

describe("buildDPSXml", () => {
  it("gera XML válido com todos os campos obrigatórios", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<DPS");
    expect(xml).toContain("<infDPS");
    expect(xml).toContain("</DPS>");
  });

  it("contém ID da DPS no formato correto", () => {
    const xml = buildDPSXml(payloadBase);
    // DPS + 7 dígitos município + 1 tipo + 14 CNPJ + 5 série + 15 número
    expect(xml).toMatch(/Id="DPS\d{42}"/);
  });

  it("contém dados do prestador", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).toContain("<CNPJ>11222333000181</CNPJ>");
    expect(xml).toContain("<IM>12345</IM>");
  });

  it("contém dados do tomador PJ", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).toContain("<CNPJ>22333444000199</CNPJ>");
    expect(xml).toContain("<xNome>Cliente Exemplo LTDA</xNome>");
  });

  it("gera tag CPF para tomador PF", () => {
    const payload = {
      ...payloadBase,
      tomador: {
        ...payloadBase.tomador,
        tipo: "PF" as const,
        cpf_cnpj: "52998224725",
      },
    };
    const xml = buildDPSXml(payload);
    expect(xml).toContain("<CPF>52998224725</CPF>");
    expect(xml).not.toContain("<CNPJ>52998224725</CNPJ>");
  });

  it("contém dados do serviço", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).toContain("<cTribNac>130201</cTribNac>");
    expect(xml).toContain(
      "<xDescServ>Design de logotipo personalizado</xDescServ>",
    );
    expect(xml).toContain("<vServ>500.00</vServ>");
  });

  it("inclui complemento quando presente", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).toContain("<xCpl>Sala 5</xCpl>");
  });

  it("omite complemento quando ausente", () => {
    const payload = {
      ...payloadBase,
      tomador: { ...payloadBase.tomador, complemento: null },
    };
    const xml = buildDPSXml(payload);
    expect(xml).not.toContain("<xCpl>");
  });

  it("omite cNBS quando ausente", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).not.toContain("<cNBS>");
  });

  it("inclui cNBS quando presente", () => {
    const payload = {
      ...payloadBase,
      servico: { ...payloadBase.servico, codigo_nbs: "121012200" },
    };
    const xml = buildDPSXml(payload);
    expect(xml).toContain("<cNBS>121012200</cNBS>");
  });

  it("contém placeholder de ambiente para substituição", () => {
    const xml = buildDPSXml(payloadBase);
    expect(xml).toContain("<tpAmb>__AMBIENTE__</tpAmb>");
  });

  it("define ISS retido corretamente", () => {
    const semRetencao = buildDPSXml(payloadBase);
    expect(semRetencao).toContain("<tpRetISSQN>2</tpRetISSQN>");

    const comRetencao = buildDPSXml({
      ...payloadBase,
      servico: { ...payloadBase.servico, iss_retido: true },
    });
    expect(comRetencao).toContain("<tpRetISSQN>1</tpRetISSQN>");
  });

  it("define opção do Simples Nacional conforme regime", () => {
    const simples = buildDPSXml(payloadBase);
    expect(simples).toContain("<opSimpNac>1</opSimpNac>");

    const lucro = buildDPSXml({
      ...payloadBase,
      regime_tributario: "lucro_presumido",
    });
    expect(lucro).toContain("<opSimpNac>0</opSimpNac>");
  });

  // ── Segurança: XML injection ──

  it("escapa caracteres especiais no XML (previne injection)", () => {
    const payload = {
      ...payloadBase,
      tomador: {
        ...payloadBase.tomador,
        razao_social: 'Empresa <script>alert("xss")</script> & Cia',
      },
    };
    const xml = buildDPSXml(payload);
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&amp; Cia");
  });

  it("escapa aspas na discriminação", () => {
    const payload = {
      ...payloadBase,
      servico: {
        ...payloadBase.servico,
        discriminacao: 'Serviço "especial" com <tags>',
      },
    };
    const xml = buildDPSXml(payload);
    expect(xml).toContain("&quot;especial&quot;");
    expect(xml).toContain("&lt;tags&gt;");
  });

  it("limpa caracteres não-numéricos de CPF/CNPJ", () => {
    const payload = {
      ...payloadBase,
      tomador: {
        ...payloadBase.tomador,
        cpf_cnpj: "22.333.444/0001-99",
      },
    };
    const xml = buildDPSXml(payload);
    expect(xml).toContain("<CNPJ>22333444000199</CNPJ>");
    // Garante que a formatação com pontuação não vazou para o XML
    expect(xml).not.toContain("<CNPJ>22.333.444/0001-99</CNPJ>");
  });

  describe("buildCancelamentoXml", () => {
    it("gera XML de cancelamento com campos obrigatórios", () => {
      const xml = buildCancelamentoXml(
        "NFSe12345678901234567890123456789012345678901234567890",
        "1",
        "Erro na emissão, dados incorretos do tomador",
      );
      expect(xml).toContain("<PedCancelamento");
      expect(xml).toContain("<chNFSe>");
      expect(xml).toContain("<cMotCanc>1</cMotCanc>");
      expect(xml).toContain("Erro na emissão");
    });

    it("escapa caracteres especiais na justificativa", () => {
      const xml = buildCancelamentoXml(
        "chave123",
        "1",
        'Motivo com "aspas" & <tags>',
      );
      expect(xml).toContain("&quot;aspas&quot;");
      expect(xml).toContain("&amp;");
      expect(xml).toContain("&lt;tags&gt;");
    });
  });
});
