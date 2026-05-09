// apps/web/src/app/(app)/fiscal/page.tsx

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { AmbienteFiscal, RegimeTributario } from "@erp/shared";
import { Save, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

const AMBIENTES = [
  { value: "homologacao", label: "Homologação (testes)" },
  { value: "producao", label: "Produção" },
];

export default function FiscalConfigPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [loaded, setLoaded] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [regimeTributario, setRegimeTributario] = useState("simples_nacional");
  const [cnaePrincipal, setCnaePrincipal] = useState("");
  const [codigoMunicipio, setCodigoMunicipio] = useState("3525904");
  const [uf, setUf] = useState("SP");
  const [aliquotaIss, setAliquotaIss] = useState("5.00");
  const [certificadoPath, setCertificadoPath] = useState("");
  const [certificadoSenha, setCertificadoSenha] = useState("");
  const [ambiente, setAmbiente] = useState("homologacao");
  const [serieDps, setSerieDps] = useState("900");
  const [certificadoConfigurado, setCertificadoConfigurado] = useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchConfig() {
    if (!apiToken) return;
    try {
      const data = await api<any>("/fiscal/config", {}, apiToken);
      if (data) {
        setCnpj(data.cnpj || "");
        setRazaoSocial(data.razao_social || "");
        setNomeFantasia(data.nome_fantasia || "");
        setInscricaoMunicipal(data.inscricao_municipal || "");
        setRegimeTributario(data.regime_tributario || "simples_nacional");
        setCnaePrincipal(data.cnae_principal || "");
        setCodigoMunicipio(data.codigo_municipio || "3525904");
        setUf(data.uf || "SP");
        setAliquotaIss(String(data.aliquota_iss || "5.00"));
        setCertificadoPath(data.certificado_path || "");
        setAmbiente(data.ambiente || "homologacao");
        setSerieDps(data.serie_dps || "900");
        setCertificadoConfigurado(!!data.certificado_configurado);
      }
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setLoaded(true);
    }
  }

  useEffect(() => {
    fetchConfig();
  }, [apiToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setLoading(true);

    try {
      await api(
        "/fiscal/config",
        {
          method: "PUT",
          body: JSON.stringify({
            cnpj,
            razao_social: razaoSocial,
            nome_fantasia: nomeFantasia || null,
            inscricao_municipal: inscricaoMunicipal,
            regime_tributario: regimeTributario,
            cnae_principal: cnaePrincipal || null,
            codigo_municipio: codigoMunicipio,
            uf,
            aliquota_iss: parseFloat(aliquotaIss) || 5.0,
            certificado_path: certificadoPath || null,
            certificado_senha: certificadoSenha || null,
            ambiente,
            serie_dps: serieDps,
          }),
        },
        apiToken,
      );
      setSucesso("Configuração fiscal salva com sucesso");
      setCertificadoSenha("");
      fetchConfig();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <>
        <Header title="Configuração Fiscal" />
        <div className="flex items-center justify-center p-12">
          <p className="text-sm text-gray-400">Carregando...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Configuração Fiscal" />
      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Dados do Emitente
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Configure os dados da empresa para emissão de NFS-e no padrão
              nacional (Jundiaí — código IBGE 3525904)
            </p>
          </div>

          {/* Status do certificado */}
          <div
            className={`mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              certificadoConfigurado
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {certificadoConfigurado ? (
              <>
                <ShieldCheck size={18} />
                <span>
                  Certificado digital configurado. A senha está armazenada de
                  forma criptografada.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} />
                <span>
                  Certificado digital não configurado. A emissão de NFS-e requer
                  certificado A1 (.pfx).
                </span>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Dados da empresa ── */}
            <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
              <legend className="px-2 text-sm font-semibold text-gray-700">
                Empresa
              </legend>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      required
                      placeholder="00000000000000"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Inscrição Municipal *
                    </label>
                    <input
                      type="text"
                      value={inscricaoMunicipal}
                      onChange={(e) => setInscricaoMunicipal(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      CNAE Principal
                    </label>
                    <input
                      type="text"
                      value={cnaePrincipal}
                      onChange={(e) => setCnaePrincipal(e.target.value)}
                      placeholder="1813001"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ── Tributação ── */}
            <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
              <legend className="px-2 text-sm font-semibold text-gray-700">
                Tributação
              </legend>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Regime Tributário
                    </label>
                    <select
                      value={regimeTributario}
                      onChange={(e) => setRegimeTributario(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                    >
                      {REGIMES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Alíquota ISS (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      value={aliquotaIss}
                      onChange={(e) => setAliquotaIss(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Código Município (IBGE)
                    </label>
                    <input
                      type="text"
                      value={codigoMunicipio}
                      onChange={(e) => setCodigoMunicipio(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ── Certificado digital ── */}
            <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
              <legend className="px-2 text-sm font-semibold text-gray-700">
                Certificado Digital A1
              </legend>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Caminho do arquivo .pfx no servidor
                  </label>
                  <input
                    type="text"
                    value={certificadoPath}
                    onChange={(e) => setCertificadoPath(e.target.value)}
                    placeholder="./certs/certificado.pfx"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    O arquivo .pfx deve estar acessível pelo servidor da API
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Senha do certificado
                    {certificadoConfigurado && (
                      <span className="ml-1 text-emerald-600">
                        (já configurada — preencha apenas para alterar)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={certificadoSenha}
                    onChange={(e) => setCertificadoSenha(e.target.value)}
                    placeholder={
                      certificadoConfigurado
                        ? "••••••••"
                        : "Senha do certificado A1"
                    }
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    A senha é armazenada criptografada (AES-256-GCM) e nunca
                    retornada pela API
                  </p>
                </div>
              </div>
            </fieldset>

            {/* ── Ambiente e DPS ── */}
            <fieldset className="rounded-xl border border-gray-200 bg-white p-5">
              <legend className="px-2 text-sm font-semibold text-gray-700">
                Ambiente
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Ambiente de emissão
                  </label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {AMBIENTES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Série DPS
                  </label>
                  <input
                    type="text"
                    value={serieDps}
                    onChange={(e) => setSerieDps(e.target.value)}
                    placeholder="900"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>
              {ambiente === "producao" && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle size={14} />
                  Ambiente de produção: notas emitidas terão validade fiscal
                  real
                </div>
              )}
            </fieldset>

            {/* ── Feedback e submit ── */}
            {erro && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {erro}
              </div>
            )}
            {sucesso && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle size={16} />
                {sucesso}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? "Salvando..." : "Salvar Configuração"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
