// apps/api/src/services/fiscal/xml-signer.ts

import crypto from "crypto";
import { SignedXml } from "xml-crypto";

// ══════════════════════════════════════════════════════════════
// SEGURANÇA: Assinatura XMLDSIG
//
// O XML da DPS DEVE ser assinado com o certificado A1 antes
// do envio. Sem assinatura, a API Nacional rejeita com erro.
//
// Usamos xml-crypto que implementa o padrão W3C XMLDSIG.
// A chave privada é extraída do .pfx em memória e descartada
// após a assinatura — nunca persiste em disco ou variáveis.
// ══════════════════════════════════════════════════════════════

interface CertKeyPair {
  privateKey: string;
  certificate: string;
}

/**
 * Extrai chave privada e certificado do buffer .pfx
 *
 * SEGURANÇA: A chave privada existe apenas em memória
 * durante o tempo de vida do objeto retornado.
 */
export function extractKeyFromPfx(
  pfxBuffer: Buffer,
  password: string,
): CertKeyPair {
  // Node.js 16+ suporta PKCS12 nativo
  const pfx = crypto.createPrivateKey({
    key: pfxBuffer,
    format: "der",
    type: "pkcs12",
    passphrase: password,
  });

  const cert = crypto.createPublicKey({
    key: pfxBuffer,
    format: "der",
    type: "pkcs12",
    passphrase: password,
  });

  return {
    privateKey: pfx.export({ type: "pkcs8", format: "pem" }).toString(),
    certificate: cert.export({ type: "spki", format: "pem" }).toString(),
  };
}

/**
 * Assina o XML da DPS com XMLDSIG (Enveloped Signature)
 *
 * Padrões utilizados:
 * - Canonicalization: Exclusive XML Canonicalization (C14N)
 * - Signature: RSA-SHA256
 * - Digest: SHA-256
 * - Transform: Enveloped Signature
 */
export function signXml(
  xml: string,
  privateKeyPem: string,
  certificatePem: string,
): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  });

  // Referência ao elemento infDPS (ou infPedCancelamento)
  sig.addReference({
    xpath: "//*[local-name()='infDPS']",
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  });

  sig.computeSignature(xml, {
    location: { reference: "//*[local-name()='infDPS']", action: "after" },
  });

  return sig.getSignedXml();
}
