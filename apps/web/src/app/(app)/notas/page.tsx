// apps/web/src/app/(app)/notas/page.tsx

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { NotaFiscal, AuditFiscal } from "@erp/shared";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  X,
  RefreshCw,
  Ban,
  FileText,
  Shield,
  ExternalLink,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  aguardando: {
    label: "Aguardando Emissão",
    color: "bg-amber-50 text-amber-700",
    icon: Clock,
  },
  autorizada: {
    label: "Autorizada",
    color: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle,
  },
  rejeitada: {
    label: "Rejeitada",
    color: "bg-red-50 text-red-700",
    icon: XCircle,
  },
  cancelada: {
    label: "Cancelada",
    color: "bg-gray-100 text-gray-500",
    icon: Ban,
  },
};

type ModalMode = null | "detalhe" | "cancelar";

export default function NotasPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  // Detalhe
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedNota, setSelectedNota] = useState<NotaFiscal | null>(null);
  const [auditoria, setAuditoria] = useState<AuditFiscal[]>([]);

  // Cancelamento
  const [justificativa, setJustificativa] = useState("");

  // UI
  const [loadingEmissao, setLoadingEmissao] = useState<number | null>(null);
  const [loadingReprocessar, setLoadingReprocessar] = useState(false);
  const [loadingCancelar, setLoadingCancelar] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "sucesso" | "erro";
    msg: string;
  } | null>(null);

  async function fetchNotas() {
    if (!apiToken) return;
    let url = "/fiscal/notas?";
    if (filtroTipo) url += `tipo=${filtroTipo}&`;
    if (filtroStatus) url += `status=${filtroStatus}&`;
    if (filtroDe) url += `de=${filtroDe}&`;
    if (filtroAte) url += `ate=${filtroAte}&`;
    setNotas(await api<NotaFiscal[]>(url, {}, apiToken));
  }

  useEffect(() => {
    fetchNotas();
  }, [filtroTipo, filtroStatus, filtroDe, filtroAte, apiToken]);

  // Limpa feedback após 5s
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  async function openDetalhe(nota: NotaFiscal) {
    setSelectedNota(nota);
    setModalMode("detalhe");
    try {
      const logs = await api<AuditFiscal[]>(
        `/fiscal/auditoria/${nota.id}`,
        {},
        apiToken,
      );
      setAuditoria(logs);
    } catch {
      setAuditoria([]);
    }
  }

  function openCancelar(nota: NotaFiscal) {
    setSelectedNota(nota);
    setJustificativa("");
    setModalMode("cancelar");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedNota(null);
    setAuditoria([]);
  }

  async function handleEmitir(notaId: number) {
    setLoadingEmissao(notaId);
    setFeedback(null);
    try {
      const res = await api<any>(
        `/fiscal/notas/${notaId}/emitir`,
        { method: "POST" },
        apiToken,
      );
      setFeedback({
        tipo: "sucesso",
        msg: `NFS-e #${notaId} emitida — Nº ${res.numero_nota || "pendente"}`,
      });
      fetchNotas();
    } catch (err: any) {
      setFeedback({ tipo: "erro", msg: err.message });
    } finally {
      setLoadingEmissao(null);
    }
  }

  async function handleReprocessar() {
    setLoadingReprocessar(true);
    setFeedback(null);
    try {
      const res = await api<any>(
        "/fiscal/notas/reprocessar",
        { method: "POST" },
        apiToken,
      );
      setFeedback({
        tipo: "sucesso",
        msg: `Reprocessamento: ${res.sucesso} sucesso, ${res.falha} falha(s) de ${res.total} nota(s)`,
      });
      fetchNotas();
    } catch (err: any) {
      setFeedback({ tipo: "erro", msg: err.message });
    } finally {
      setLoadingReprocessar(false);
    }
  }

  async function handleCancelar(e: FormEvent) {
    e.preventDefault();
    if (!selectedNota) return;
    setLoadingCancelar(true);
    try {
      await api(
        `/fiscal/notas/${selectedNota.id}/cancelar`,
        {
          method: "POST",
          body: JSON.stringify({ justificativa }),
        },
        apiToken,
      );
      setFeedback({
        tipo: "sucesso",
        msg: `NFS-e #${selectedNota.id} cancelada com sucesso`,
      });
      closeModal();
      fetchNotas();
    } catch (err: any) {
      setFeedback({ tipo: "erro", msg: err.message });
    } finally {
      setLoadingCancelar(false);
    }
  }

  function fmt(v: number | string) {
    return Number(v).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const pendentes = notas.filter((n) => n.status === "aguardando");
  const rejeitadas = notas.filter((n) => n.status === "rejeitada");

  return (
    <>
      <Header title="Notas Fiscais" />
      <div className="p-6">
        {/* Feedback flutuante */}
        {feedback && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              feedback.tipo === "sucesso"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {feedback.tipo === "sucesso" ? (
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            )}
            {feedback.msg}
          </div>
        )}

        {/* Alertas */}
        {pendentes.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>
                <strong>{pendentes.length}</strong> nota(s) aguardando emissão
              </span>
            </div>
          </div>
        )}

        {rejeitadas.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="flex items-center gap-2">
              <XCircle size={16} />
              <span>
                <strong>{rejeitadas.length}</strong> nota(s) rejeitada(s)
              </span>
            </div>
            <button
              onClick={handleReprocessar}
              disabled={loadingReprocessar}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={loadingReprocessar ? "animate-spin" : ""}
              />
              {loadingReprocessar ? "Reprocessando..." : "Reprocessar todas"}
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            <option value="">Todos os tipos</option>
            <option value="nfe">NF-e (Produto)</option>
            <option value="nfse">NFS-e (Serviço)</option>
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            <option value="">Todos os status</option>
            <option value="aguardando">Aguardando</option>
            <option value="autorizada">Autorizada</option>
            <option value="rejeitada">Rejeitada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filtroDe}
              onChange={(e) => setFiltroDe(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <span className="text-sm text-gray-400">a</span>
            <input
              type="date"
              value={filtroAte}
              onChange={(e) => setFiltroAte(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  #
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Valor
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Nº Nota
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhuma nota encontrada.
                  </td>
                </tr>
              ) : (
                notas.map((n) => {
                  const cfg = STATUS_CONFIG[n.status];
                  const Icon = cfg?.icon;
                  const emitindo = loadingEmissao === n.id;
                  return (
                    <tr
                      key={n.id}
                      className={`border-b border-gray-50 transition hover:bg-gray-50/50 ${
                        n.status === "aguardando" ? "bg-amber-50/20" : ""
                      } ${n.status === "rejeitada" ? "bg-red-50/20" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        #{n.id}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        Pedido #{n.pedido_id}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {n.cliente_nome}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            n.tipo === "nfe"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {n.tipo === "nfe" ? "NF-e" : "NFS-e"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.color}`}
                        >
                          {Icon && <Icon size={12} />} {cfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {fmt(n.valor)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {n.numero_nota || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => openDetalhe(n)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Detalhes"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Emitir: só para NFS-e aguardando ou rejeitada */}
                          {n.tipo === "nfse" &&
                            (n.status === "aguardando" ||
                              n.status === "rejeitada") && (
                              <button
                                onClick={() => handleEmitir(n.id)}
                                disabled={emitindo}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"
                                title="Emitir NFS-e"
                              >
                                <Send
                                  size={15}
                                  className={emitindo ? "animate-pulse" : ""}
                                />
                              </button>
                            )}

                          {/* Cancelar: só para autorizadas */}
                          {n.status === "autorizada" && (
                            <button
                              onClick={() => openCancelar(n)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Cancelar"
                            >
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Detalhe ── */}
      {modalMode === "detalhe" && selectedNota && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Nota #{selectedNota.id}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_CONFIG[selectedNota.status]?.color
                }`}
              >
                {selectedNota.status === "aguardando" && <Clock size={12} />}
                {selectedNota.status === "autorizada" && (
                  <CheckCircle size={12} />
                )}
                {selectedNota.status === "rejeitada" && <XCircle size={12} />}
                {selectedNota.status === "cancelada" && <Ban size={12} />}
                {STATUS_CONFIG[selectedNota.status]?.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  selectedNota.tipo === "nfe"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-purple-50 text-purple-700"
                }`}
              >
                {selectedNota.tipo === "nfe" ? "NF-e" : "NFS-e"}
              </span>
            </div>

            {/* Dados principais */}
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Cliente</span>
                <p className="font-medium text-gray-900">
                  {selectedNota.cliente_nome}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Valor</span>
                <p className="font-semibold text-gray-900">
                  {fmt(selectedNota.valor)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Pedido</span>
                <p className="text-gray-700">#{selectedNota.pedido_id}</p>
              </div>
            </div>

            {/* Dados fiscais (se emitida) */}
            {(selectedNota.numero_nota || selectedNota.chave_acesso) && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <FileText size={14} /> Dados da NFS-e
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedNota.numero_nota && (
                    <div>
                      <span className="text-gray-400">Nº Nota</span>
                      <p className="font-medium text-gray-900">
                        {selectedNota.numero_nota}
                      </p>
                    </div>
                  )}
                  {selectedNota.protocolo && (
                    <div>
                      <span className="text-gray-400">Protocolo</span>
                      <p className="font-mono text-xs text-gray-700">
                        {selectedNota.protocolo}
                      </p>
                    </div>
                  )}
                  {selectedNota.chave_acesso && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Chave de Acesso</span>
                      <p className="break-all font-mono text-xs text-gray-700">
                        {selectedNota.chave_acesso}
                      </p>
                    </div>
                  )}
                  {selectedNota.codigo_verificacao && (
                    <div>
                      <span className="text-gray-400">
                        Código de Verificação
                      </span>
                      <p className="font-mono text-xs text-gray-700">
                        {selectedNota.codigo_verificacao}
                      </p>
                    </div>
                  )}
                  {selectedNota.emitida_em && (
                    <div>
                      <span className="text-gray-400">Emitida em</span>
                      <p className="text-gray-700">
                        {new Date(selectedNota.emitida_em).toLocaleString(
                          "pt-BR",
                        )}
                      </p>
                    </div>
                  )}
                </div>
                {selectedNota.url_consulta && (
                  <a
                    href={selectedNota.url_consulta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                  >
                    <ExternalLink size={12} /> Consultar no portal
                  </a>
                )}
              </div>
            )}

            {/* Erro (se rejeitada) */}
            {selectedNota.mensagem_erro && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-medium">Motivo da rejeição:</p>
                <p className="mt-1">{selectedNota.mensagem_erro}</p>
                {selectedNota.tentativas !== undefined && (
                  <p className="mt-1 text-xs text-red-500">
                    Tentativas: {selectedNota.tentativas}/5
                  </p>
                )}
              </div>
            )}

            {/* Cancelamento */}
            {selectedNota.justificativa_cancelamento && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700">
                  Justificativa do cancelamento:
                </p>
                <p className="mt-1 italic">
                  {selectedNota.justificativa_cancelamento}
                </p>
              </div>
            )}

            {/* Log de auditoria */}
            {auditoria.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Shield size={14} /> Auditoria
                </h3>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Data
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Ação
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Usuário
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          IP
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditoria.map((a) => (
                        <tr key={a.id} className="border-b border-gray-50">
                          <td className="px-3 py-1.5 text-gray-600">
                            {new Date(a.created_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
                              {a.acao}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-600">
                            {a.usuario_nome || `#${a.usuario_id}`}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-gray-500">
                            {a.ip_origem}
                          </td>
                          <td className="px-3 py-1.5">
                            {a.erro ? (
                              <span className="text-red-600" title={a.erro}>
                                Erro
                              </span>
                            ) : (
                              <span className="text-emerald-600">
                                {a.status_code || "OK"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex justify-end gap-2">
              {selectedNota.tipo === "nfse" &&
                (selectedNota.status === "aguardando" ||
                  selectedNota.status === "rejeitada") && (
                  <button
                    onClick={() => {
                      handleEmitir(selectedNota.id);
                      closeModal();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    <Send size={14} /> Emitir NFS-e
                  </button>
                )}
              {selectedNota.status === "autorizada" && (
                <button
                  onClick={() => {
                    closeModal();
                    openCancelar(selectedNota);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Ban size={14} /> Cancelar Nota
                </button>
              )}
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cancelar ── */}
      {modalMode === "cancelar" && selectedNota && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              Cancelar Nota #{selectedNota.id}
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              {selectedNota.cliente_nome} — {fmt(selectedNota.valor)}
            </p>

            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} />
              Esta ação é irreversível. A nota será cancelada junto à
              prefeitura.
            </div>

            <form onSubmit={handleCancelar} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Justificativa (mínimo 15 caracteres) *
                </label>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  required
                  minLength={15}
                  rows={3}
                  placeholder="Descreva o motivo do cancelamento..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 resize-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  {justificativa.length}/15 caracteres mínimos
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loadingCancelar || justificativa.length < 15}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Ban size={14} />
                  {loadingCancelar ? "Cancelando..." : "Confirmar Cancelamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
