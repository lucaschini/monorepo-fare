"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import {
  Orcamento,
  OrcamentoItem,
  Cliente,
  CatalogoItem,
  StatusOrcamento,
} from "@erp/shared";
import {
  Plus,
  Search,
  Eye,
  Trash2,
  X,
  Send,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  FileText,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-700" },
  enviado: { label: "Enviado", color: "bg-blue-50 text-blue-700" },
  aprovado: { label: "Aprovado", color: "bg-emerald-50 text-emerald-700" },
  recusado: { label: "Recusado", color: "bg-red-50 text-red-700" },
};

interface ItemForm {
  catalogo_id: number;
  catalogo_nome: string;
  quantidade: number;
  preco_unitario: number;
}

export default function OrcamentosPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [observacoes, setObservacoes] = useState("");
  const [validade, setValidade] = useState("");
  const [itensForm, setItensForm] = useState<ItemForm[]>([]);
  const [catalogoSelecionado, setCatalogoSelecionado] = useState<number | "">(
    "",
  );

  // Detail modal
  const [detail, setDetail] = useState<Orcamento | null>(null);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchOrcamentos() {
    if (!apiToken) return;
    let url = `/orcamentos?busca=${encodeURIComponent(busca)}`;
    if (filtroStatus) url += `&status=${filtroStatus}`;
    const data = await api<Orcamento[]>(url, {}, apiToken);
    setOrcamentos(data);
  }

  async function fetchClientes() {
    if (!apiToken) return;
    setClientes(await api<Cliente[]>("/clientes", {}, apiToken));
  }

  async function fetchCatalogo() {
    if (!apiToken) return;
    setCatalogo(await api<CatalogoItem[]>("/catalogo", {}, apiToken));
  }

  useEffect(() => {
    fetchOrcamentos();
  }, [busca, filtroStatus, apiToken]);

  function openCreate() {
    setClienteId("");
    setObservacoes("");
    setValidade("");
    setItensForm([]);
    setCatalogoSelecionado("");
    setErro("");
    fetchClientes();
    fetchCatalogo();
    setShowCreate(true);
  }

  function addItem() {
    if (!catalogoSelecionado) return;
    const cat = catalogo.find((c) => c.id === Number(catalogoSelecionado));
    if (!cat) return;
    if (itensForm.some((i) => i.catalogo_id === cat.id)) return;
    setItensForm([
      ...itensForm,
      {
        catalogo_id: cat.id,
        catalogo_nome: `${cat.nome} (${cat.tipo === "produto" ? "Produto" : "Serviço"})`,
        quantidade: 1,
        preco_unitario: Number(cat.preco_unitario),
      },
    ]);
    setCatalogoSelecionado("");
  }

  function removeItem(idx: number) {
    setItensForm(itensForm.filter((_, i) => i !== idx));
  }

  function updateItem(
    idx: number,
    field: "quantidade" | "preco_unitario",
    value: number,
  ) {
    setItensForm(
      itensForm.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    );
  }

  function totalGeral() {
    return itensForm.reduce(
      (sum, i) => sum + i.quantidade * i.preco_unitario,
      0,
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!clienteId) {
      setErro("Selecione um cliente");
      return;
    }
    if (itensForm.length === 0) {
      setErro("Adicione ao menos um item");
      return;
    }

    setLoading(true);
    try {
      await api(
        "/orcamentos",
        {
          method: "POST",
          body: JSON.stringify({
            cliente_id: clienteId,
            observacoes: observacoes || null,
            validade: validade || null,
            itens: itensForm.map((i) => ({
              catalogo_id: i.catalogo_id,
              quantidade: i.quantidade,
              preco_unitario: i.preco_unitario,
            })),
          }),
        },
        apiToken,
      );
      setShowCreate(false);
      fetchOrcamentos();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: number) {
    const data = await api<Orcamento>(`/orcamentos/${id}`, {}, apiToken);
    setDetail(data);
  }

  async function changeStatus(id: number, status: string) {
    try {
      await api(
        `/orcamentos/${id}/status`,
        { method: "PUT", body: JSON.stringify({ status }) },
        apiToken,
      );
      fetchOrcamentos();
      if (detail?.id === id) openDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function converter(id: number) {
    if (!confirm("Converter este orçamento em pedido?")) return;
    try {
      const res = await api<{ pedido_id: number }>(
        `/orcamentos/${id}/converter`,
        { method: "POST" },
        apiToken,
      );
      alert(`Pedido #${res.pedido_id} criado com sucesso!`);
      fetchOrcamentos();
      setDetail(null);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este orçamento?")) return;
    try {
      await api(`/orcamentos/${id}`, { method: "DELETE" }, apiToken);
      fetchOrcamentos();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function fmt(v: number | string) {
    return Number(v).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <>
      <Header title="Orçamentos" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-2">
            <div className="relative max-w-xs flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar por cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado</option>
              <option value="aprovado">Aprovado</option>
              <option value="recusado">Recusado</option>
            </select>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Novo Orçamento
          </button>
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
                  Cliente
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Valor
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Data
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhum orçamento encontrado.
                  </td>
                </tr>
              ) : (
                orcamentos.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      #{o.id}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {o.cliente_nome}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LABELS[o.status]?.color}`}
                      >
                        {STATUS_LABELS[o.status]?.label}
                      </span>
                      {o.pedido_id && (
                        <span className="ml-1.5 text-xs text-gray-400">
                          → Pedido #{o.pedido_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      {fmt(o.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openDetail(o.id)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Detalhes"
                        >
                          <Eye size={15} />
                        </button>
                        {o.status === "rascunho" && (
                          <>
                            <button
                              onClick={() => changeStatus(o.id, "enviado")}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Enviar"
                            >
                              <Send size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(o.id)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {o.status === "enviado" && (
                          <>
                            <button
                              onClick={() => changeStatus(o.id, "aprovado")}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                              title="Aprovar"
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              onClick={() => changeStatus(o.id, "recusado")}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Recusar"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {o.status === "aprovado" && !o.pedido_id && (
                          <button
                            onClick={() => converter(o.id)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600"
                            title="Converter em Pedido"
                          >
                            <ArrowRightLeft size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              Novo Orçamento
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Cliente *
                  </label>
                  <select
                    value={clienteId}
                    onChange={(e) => setClienteId(Number(e.target.value) || "")}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_razao}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Validade
                  </label>
                  <input
                    type="date"
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Observações
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>

              {/* Adicionar item */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Adicionar item do catálogo
                </label>
                <div className="flex gap-2">
                  <select
                    value={catalogoSelecionado}
                    onChange={(e) =>
                      setCatalogoSelecionado(Number(e.target.value) || "")
                    }
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="">Selecione um item...</option>
                    {catalogo
                      .filter(
                        (c) => !itensForm.some((i) => i.catalogo_id === c.id),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} (
                          {c.tipo === "produto" ? "Produto" : "Serviço"}) —{" "}
                          {fmt(c.preco_unitario)}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Lista de itens */}
              {itensForm.length > 0 && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Item
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-24">
                          Qtd
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-32">
                          Preço Unit.
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-32">
                          Subtotal
                        </th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensForm.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-gray-700">
                            {item.catalogo_nome}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantidade}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "quantidade",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full rounded border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.preco_unitario}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "preco_unitario",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full rounded border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                            {fmt(item.quantidade * item.preco_unitario)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="rounded p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/50">
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-right font-medium text-gray-700"
                        >
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                          {fmt(totalGeral())}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {erro && (
                <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                  {erro}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Criar Orçamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => setDetail(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Orçamento #{detail.id}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LABELS[detail.status]?.color}`}
              >
                {STATUS_LABELS[detail.status]?.label}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Cliente</span>
                <p className="font-medium text-gray-900">
                  {detail.cliente_nome}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Valor Total</span>
                <p className="font-semibold text-gray-900">
                  {fmt(detail.valor_total)}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Data</span>
                <p className="text-gray-700">
                  {new Date(detail.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            {detail.observacoes && (
              <p className="mb-4 text-sm text-gray-500 italic">
                {detail.observacoes}
              </p>
            )}

            {/* Itens */}
            <div className="rounded-lg border border-gray-200 overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Qtd
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Preço Unit.
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.itens?.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="px-3 py-2 text-gray-700">
                        {item.catalogo_nome}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs ${item.catalogo_tipo === "produto" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}
                        >
                          {item.catalogo_tipo === "produto"
                            ? "Produto"
                            : "Serviço"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(item.quantidade)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(item.preco_unitario)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {fmt(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/50">
                    <td
                      colSpan={4}
                      className="px-3 py-2 text-right font-medium text-gray-700"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                      {fmt(detail.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2">
              {detail.status === "rascunho" && (
                <button
                  onClick={() => changeStatus(detail.id, "enviado")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Send size={14} /> Enviar
                </button>
              )}
              {detail.status === "enviado" && (
                <>
                  <button
                    onClick={() => changeStatus(detail.id, "recusado")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <XCircle size={14} /> Recusar
                  </button>
                  <button
                    onClick={() => changeStatus(detail.id, "aprovado")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <CheckCircle size={14} /> Aprovar
                  </button>
                </>
              )}
              {detail.status === "aprovado" && !detail.pedido_id && (
                <button
                  onClick={() => converter(detail.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <ArrowRightLeft size={14} /> Converter em Pedido
                </button>
              )}
              {detail.pedido_id && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500">
                  <FileText size={14} /> Pedido #{detail.pedido_id} criado
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
