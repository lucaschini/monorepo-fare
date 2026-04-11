"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { Pedido, Cliente, CatalogoItem, StatusPedido } from "@erp/shared";
import {
  Plus,
  Search,
  Eye,
  Trash2,
  X,
  Package,
  Play,
  Pause,
  CheckCircle,
  Truck,
  Receipt,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  aberto: {
    label: "Aberto",
    color: "bg-gray-100 text-gray-700",
    icon: Package,
  },
  em_producao: {
    label: "Em Produção",
    color: "bg-blue-50 text-blue-700",
    icon: Play,
  },
  aguardando_material: {
    label: "Aguardando Material",
    color: "bg-amber-50 text-amber-700",
    icon: Pause,
  },
  pronto: {
    label: "Pronto",
    color: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle,
  },
  entregue: {
    label: "Entregue",
    color: "bg-purple-50 text-purple-700",
    icon: Truck,
  },
  faturado: {
    label: "Faturado",
    color: "bg-teal-50 text-teal-700",
    icon: Receipt,
  },
};

const TRANSITIONS: Record<
  string,
  { status: string; label: string; color: string; icon: any }[]
> = {
  aberto: [
    {
      status: "em_producao",
      label: "Iniciar Produção",
      color: "bg-blue-600 hover:bg-blue-700 text-white",
      icon: Play,
    },
  ],
  em_producao: [
    {
      status: "aguardando_material",
      label: "Aguardar Material",
      color: "border border-amber-200 text-amber-700 hover:bg-amber-50",
      icon: Pause,
    },
    {
      status: "pronto",
      label: "Marcar Pronto",
      color: "bg-emerald-600 hover:bg-emerald-700 text-white",
      icon: CheckCircle,
    },
  ],
  aguardando_material: [
    {
      status: "em_producao",
      label: "Retomar Produção",
      color: "bg-blue-600 hover:bg-blue-700 text-white",
      icon: Play,
    },
  ],
  pronto: [
    {
      status: "entregue",
      label: "Registrar Entrega",
      color: "bg-purple-600 hover:bg-purple-700 text-white",
      icon: Truck,
    },
  ],
  entregue: [
    {
      status: "faturado",
      label: "Faturar",
      color: "bg-teal-600 hover:bg-teal-700 text-white",
      icon: Receipt,
    },
  ],
  faturado: [],
};

type Tab = "todos" | "producao";

interface ItemForm {
  catalogo_id: number;
  catalogo_nome: string;
  quantidade: number;
  preco_unitario: number;
  especificacoes: string;
}

export default function PedidosPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [tab, setTab] = useState<Tab>("todos");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itensForm, setItensForm] = useState<ItemForm[]>([]);
  const [catalogoSel, setCatalogoSel] = useState<number | "">("");

  // Detail modal
  const [detail, setDetail] = useState<Pedido | null>(null);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchPedidos() {
    if (!apiToken) return;
    let url = `/pedidos?busca=${encodeURIComponent(busca)}`;
    if (tab === "producao") {
      url += "&status=em_producao";
    } else if (filtroStatus) {
      url += `&status=${filtroStatus}`;
    }
    setPedidos(await api<Pedido[]>(url, {}, apiToken));
  }

  useEffect(() => {
    fetchPedidos();
  }, [busca, filtroStatus, tab, apiToken]);

  // ── Create helpers ──

  async function openCreate() {
    setClienteId("");
    setPrazo("");
    setObservacoes("");
    setItensForm([]);
    setCatalogoSel("");
    setErro("");
    if (apiToken) {
      setClientes(await api<Cliente[]>("/clientes", {}, apiToken));
      setCatalogo(await api<CatalogoItem[]>("/catalogo", {}, apiToken));
    }
    setShowCreate(true);
  }

  function addItem() {
    if (!catalogoSel) return;
    const cat = catalogo.find((c) => c.id === Number(catalogoSel));
    if (!cat || itensForm.some((i) => i.catalogo_id === cat.id)) return;
    setItensForm([
      ...itensForm,
      {
        catalogo_id: cat.id,
        catalogo_nome: `${cat.nome} (${cat.tipo === "produto" ? "Produto" : "Serviço"})`,
        quantidade: 1,
        preco_unitario: Number(cat.preco_unitario),
        especificacoes: "",
      },
    ]);
    setCatalogoSel("");
  }

  function removeItem(idx: number) {
    setItensForm(itensForm.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ItemForm, value: any) {
    setItensForm(
      itensForm.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    );
  }

  function totalGeral() {
    return itensForm.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
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
        "/pedidos",
        {
          method: "POST",
          body: JSON.stringify({
            cliente_id: clienteId,
            prazo_entrega: prazo || null,
            observacoes: observacoes || null,
            itens: itensForm.map((i) => ({
              catalogo_id: i.catalogo_id,
              quantidade: i.quantidade,
              preco_unitario: i.preco_unitario,
              especificacoes: i.especificacoes || null,
            })),
          }),
        },
        apiToken,
      );
      setShowCreate(false);
      fetchPedidos();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Detail / Status ──

  async function openDetail(id: number) {
    setDetail(await api<Pedido>(`/pedidos/${id}`, {}, apiToken));
  }

  async function changeStatus(id: number, status: string) {
    try {
      await api(
        `/pedidos/${id}/status`,
        { method: "PUT", body: JSON.stringify({ status }) },
        apiToken,
      );
      fetchPedidos();
      if (detail?.id === id) openDetail(id);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este pedido?")) return;
    try {
      await api(`/pedidos/${id}`, { method: "DELETE" }, apiToken);
      fetchPedidos();
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

  // ── Contadores para aba produção ──
  const countProducao = pedidos.filter((p) =>
    ["em_producao", "aguardando_material"].includes(p.status),
  ).length;

  const prontos = pedidos.filter((p) => p.status === "pronto");

  return (
    <>
      <Header title="Pedidos" />
      <div className="p-6">
        {/* Abas */}
        <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          <button
            onClick={() => {
              setTab("todos");
              setFiltroStatus("");
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === "todos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Todos os Pedidos
          </button>
          <button
            onClick={() => setTab("producao")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === "producao" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Fila de Produção
            {countProducao > 0 && tab !== "producao" && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
                {countProducao}
              </span>
            )}
          </button>
        </div>

        {/* Alerta de prontos */}
        {prontos.length > 0 && tab === "todos" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle size={16} />
            <span>
              <strong>{prontos.length}</strong> pedido(s) pronto(s) para
              retirada/despacho
            </span>
          </div>
        )}

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
            {tab === "todos" && (
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Novo Pedido
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
                  Prazo
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
              {pedidos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const Icon = cfg?.icon;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 transition hover:bg-gray-50/50 ${p.status === "pronto" ? "bg-emerald-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        #{p.id}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.cliente_nome}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.color}`}
                        >
                          {Icon && <Icon size={12} />} {cfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {fmt(p.valor_total)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.prazo_entrega
                          ? new Date(p.prazo_entrega).toLocaleDateString(
                              "pt-BR",
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => openDetail(p.id)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Detalhes"
                          >
                            <Eye size={15} />
                          </button>
                          {TRANSITIONS[p.status]?.map((t) => (
                            <button
                              key={t.status}
                              onClick={() => changeStatus(p.id, t.status)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title={t.label}
                            >
                              <t.icon size={15} />
                            </button>
                          ))}
                          {p.status === "aberto" && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
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
              Novo Pedido
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
                    Prazo de Entrega
                  </label>
                  <input
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
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

              {/* Add item */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Adicionar item do catálogo
                </label>
                <div className="flex gap-2">
                  <select
                    value={catalogoSel}
                    onChange={(e) =>
                      setCatalogoSel(Number(e.target.value) || "")
                    }
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="">Selecione...</option>
                    {catalogo
                      .filter(
                        (c) => !itensForm.some((i) => i.catalogo_id === c.id),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} — {fmt(c.preco_unitario)}
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

              {itensForm.length > 0 && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Item
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-20">
                          Qtd
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-28">
                          Preço
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          Especificações
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-28">
                          Subtotal
                        </th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensForm.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-gray-700 text-xs">
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
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.especificacoes}
                              placeholder="Ex: Lona 440g, 4x0"
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "especificacoes",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
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
                          colSpan={4}
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
                  {loading ? "Criando..." : "Criar Pedido"}
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
                Pedido #{detail.id}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[detail.status]?.color}`}
              >
                {STATUS_CONFIG[detail.status]?.label}
              </span>
              {detail.orcamento_id && (
                <span className="text-xs text-gray-400">
                  via Orçamento #{detail.orcamento_id}
                </span>
              )}
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
                <span className="text-gray-400">Prazo</span>
                <p className="text-gray-700">
                  {detail.prazo_entrega
                    ? new Date(detail.prazo_entrega).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
              </div>
            </div>

            {detail.observacoes && (
              <p className="mb-4 text-sm text-gray-500 italic">
                {detail.observacoes}
              </p>
            )}

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
                      Preço
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.itens?.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="px-3 py-2">
                        <span className="text-gray-700">
                          {item.catalogo_nome}
                        </span>
                        {item.especificacoes && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.especificacoes}
                          </p>
                        )}
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

            {/* Ações de status */}
            <div className="flex justify-end gap-2">
              {TRANSITIONS[detail.status]?.map((t) => (
                <button
                  key={t.status}
                  onClick={() => changeStatus(detail.id, t.status)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${t.color}`}
                >
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
