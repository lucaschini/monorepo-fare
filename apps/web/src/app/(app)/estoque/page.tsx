"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { Insumo, MovimentacaoEstoque, Pedido } from "@erp/shared";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  FileText,
  Eye,
} from "lucide-react";

const UNIDADES = [
  "un",
  "fl",
  "m",
  "m²",
  "kg",
  "g",
  "L",
  "mL",
  "cx",
  "pct",
  "rolo",
  "bobina",
];

type ModalMode = null | "create" | "edit" | "movimentar" | "extrato";

export default function EstoquePage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [alertas, setAlertas] = useState<Insumo[]>([]);
  const [busca, setBusca] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);

  // Form insumo
  const [nome, setNome] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("un");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");

  // Form movimentação
  const [tipoMov, setTipoMov] = useState<"entrada" | "saida">("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pedidoIdMov, setPedidoIdMov] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  // Extrato
  const [extrato, setExtrato] = useState<{
    insumo: Insumo;
    movimentacoes: MovimentacaoEstoque[];
  } | null>(null);
  const [extratoDe, setExtratoDe] = useState("");
  const [extratoAte, setExtratoAte] = useState("");

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchInsumos() {
    if (!apiToken) return;
    const data = await api<Insumo[]>(
      `/estoque/insumos?busca=${encodeURIComponent(busca)}`,
      {},
      apiToken,
    );
    setInsumos(data);
  }

  async function fetchAlertas() {
    if (!apiToken) return;
    setAlertas(await api<Insumo[]>("/estoque/alertas", {}, apiToken));
  }

  useEffect(() => {
    fetchInsumos();
    fetchAlertas();
  }, [busca, apiToken]);

  // ── Insumo CRUD ──

  function openCreate() {
    setNome("");
    setUnidadeMedida("un");
    setEstoqueMinimo("");
    setErro("");
    setSelectedInsumo(null);
    setModalMode("create");
  }

  function openEdit(ins: Insumo) {
    setNome(ins.nome);
    setUnidadeMedida(ins.unidade_medida);
    setEstoqueMinimo(String(ins.estoque_minimo));
    setErro("");
    setSelectedInsumo(ins);
    setModalMode("edit");
  }

  async function handleSubmitInsumo(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const body = {
        nome,
        unidade_medida: unidadeMedida,
        estoque_minimo: parseFloat(estoqueMinimo) || 0,
      };
      if (modalMode === "edit" && selectedInsumo) {
        await api(
          `/estoque/insumos/${selectedInsumo.id}`,
          { method: "PUT", body: JSON.stringify(body) },
          apiToken,
        );
      } else {
        await api(
          "/estoque/insumos",
          { method: "POST", body: JSON.stringify(body) },
          apiToken,
        );
      }
      setModalMode(null);
      fetchInsumos();
      fetchAlertas();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este insumo?")) return;
    try {
      await api(`/estoque/insumos/${id}`, { method: "DELETE" }, apiToken);
      fetchInsumos();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // ── Movimentação ──

  async function openMovimentar(ins: Insumo, tipo: "entrada" | "saida") {
    setSelectedInsumo(ins);
    setTipoMov(tipo);
    setQuantidade("");
    setLote("");
    setObservacao("");
    setPedidoIdMov("");
    setErro("");
    if (tipo === "saida" && apiToken) {
      setPedidos(
        await api<Pedido[]>("/pedidos?status=em_producao", {}, apiToken),
      );
    }
    setModalMode("movimentar");
  }

  async function handleSubmitMov(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      await api(
        "/estoque/movimentacoes",
        {
          method: "POST",
          body: JSON.stringify({
            insumo_id: selectedInsumo!.id,
            tipo: tipoMov,
            quantidade: parseFloat(quantidade),
            lote: lote || null,
            observacao: observacao || null,
            pedido_id: pedidoIdMov ? Number(pedidoIdMov) : null,
          }),
        },
        apiToken,
      );
      setModalMode(null);
      fetchInsumos();
      fetchAlertas();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Extrato ──

  async function openExtrato(ins: Insumo) {
    setSelectedInsumo(ins);
    setExtratoDe("");
    setExtratoAte("");
    const data = await api<{
      insumo: Insumo;
      movimentacoes: MovimentacaoEstoque[];
    }>(`/estoque/insumos/${ins.id}/extrato`, {}, apiToken);
    setExtrato(data);
    setModalMode("extrato");
  }

  async function fetchExtrato() {
    if (!selectedInsumo) return;
    let url = `/estoque/insumos/${selectedInsumo.id}/extrato?`;
    if (extratoDe) url += `de=${extratoDe}&`;
    if (extratoAte) url += `ate=${extratoAte}`;
    setExtrato(await api(url, {}, apiToken));
  }

  function closeModal() {
    setModalMode(null);
    setSelectedInsumo(null);
    setExtrato(null);
  }

  function isAbaixoMinimo(ins: Insumo) {
    return (
      Number(ins.estoque_minimo) > 0 &&
      Number(ins.estoque_atual) <= Number(ins.estoque_minimo)
    );
  }

  return (
    <>
      <Header title="Estoque" />
      <div className="p-6">
        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle size={16} /> Insumos abaixo do estoque mínimo
            </div>
            <ul className="ml-6 list-disc">
              {alertas.map((a) => (
                <li key={a.id}>
                  <strong>{a.nome}</strong>: {Number(a.estoque_atual)}{" "}
                  {a.unidade_medida} (mín: {Number(a.estoque_minimo)})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar insumo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Novo Insumo
          </button>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Unidade
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Estoque Atual
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Mínimo
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {insumos.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhum insumo cadastrado.
                  </td>
                </tr>
              ) : (
                insumos.map((ins) => (
                  <tr
                    key={ins.id}
                    className={`border-b border-gray-50 transition hover:bg-gray-50/50 ${isAbaixoMinimo(ins) ? "bg-amber-50/30" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {ins.nome}
                      {isAbaixoMinimo(ins) && (
                        <AlertTriangle
                          size={14}
                          className="inline ml-1.5 text-amber-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ins.unidade_medida}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${isAbaixoMinimo(ins) ? "text-amber-700" : "text-gray-900"}`}
                    >
                      {Number(ins.estoque_atual)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                      {Number(ins.estoque_minimo)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openMovimentar(ins, "entrada")}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Entrada"
                        >
                          <ArrowDownCircle size={15} />
                        </button>
                        <button
                          onClick={() => openMovimentar(ins, "saida")}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-orange-50 hover:text-orange-600"
                          title="Saída"
                        >
                          <ArrowUpCircle size={15} />
                        </button>
                        <button
                          onClick={() => openExtrato(ins)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Extrato"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(ins)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(ins.id)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar/Editar Insumo */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              {modalMode === "edit" ? "Editar Insumo" : "Novo Insumo"}
            </h2>
            <form onSubmit={handleSubmitInsumo} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nome *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  placeholder="Ex: Papel Couché 150g"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Unidade *
                  </label>
                  <select
                    value={unidadeMedida}
                    onChange={(e) => setUnidadeMedida(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>
              {erro && (
                <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                  {erro}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading
                    ? "Salvando..."
                    : modalMode === "edit"
                      ? "Salvar"
                      : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimentação */}
      {modalMode === "movimentar" && selectedInsumo && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              {tipoMov === "entrada"
                ? "Entrada de Estoque"
                : "Saída de Estoque"}
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              {selectedInsumo.nome} — Atual:{" "}
              {Number(selectedInsumo.estoque_atual)}{" "}
              {selectedInsumo.unidade_medida}
            </p>
            <form onSubmit={handleSubmitMov} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Quantidade ({selectedInsumo.unidade_medida}) *
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>
              {tipoMov === "entrada" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Lote
                  </label>
                  <input
                    type="text"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    placeholder="Ex: LOTE-001"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              )}
              {tipoMov === "saida" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Pedido (opcional)
                  </label>
                  <select
                    value={pedidoIdMov}
                    onChange={(e) => setPedidoIdMov(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="">Sem vínculo</option>
                    {pedidos.map((p) => (
                      <option key={p.id} value={p.id}>
                        Pedido #{p.id} — {p.cliente_nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Observação
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>
              {erro && (
                <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                  {erro}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${tipoMov === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"}`}
                >
                  {loading
                    ? "Registrando..."
                    : tipoMov === "entrada"
                      ? "Registrar Entrada"
                      : "Registrar Saída"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Extrato */}
      {modalMode === "extrato" && extrato && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              Extrato — {extrato.insumo.nome}
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Saldo atual: {Number(extrato.insumo.estoque_atual)}{" "}
              {extrato.insumo.unidade_medida}
            </p>

            {/* Filtros */}
            <div className="mb-4 flex gap-2 items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  De
                </label>
                <input
                  type="date"
                  value={extratoDe}
                  onChange={(e) => setExtratoDe(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Até
                </label>
                <input
                  type="date"
                  value={extratoAte}
                  onChange={(e) => setExtratoAte(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
                />
              </div>
              <button
                onClick={fetchExtrato}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Filtrar
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Quantidade
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Lote
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Pedido
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Obs.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {extrato.movimentacoes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-gray-400"
                      >
                        Nenhuma movimentação encontrada.
                      </td>
                    </tr>
                  ) : (
                    extrato.movimentacoes.map((m) => (
                      <tr key={m.id} className="border-b border-gray-50">
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(m.created_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.tipo === "entrada" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}
                          >
                            {m.tipo === "entrada" ? (
                              <ArrowDownCircle size={11} />
                            ) : (
                              <ArrowUpCircle size={11} />
                            )}
                            {m.tipo === "entrada" ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {Number(m.quantidade)}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {m.lote || "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {m.pedido_numero ? `#${m.pedido_numero}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">
                          {m.observacao || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
