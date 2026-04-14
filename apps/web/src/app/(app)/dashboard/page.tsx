"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import {
  Pedido,
  Cliente,
  CatalogoItem,
  TipoTransacao,
  MetodoPagamento,
  StatusTransacao,
} from "@erp/shared";
import {
  Users,
  FileText,
  ClipboardList,
  Truck,
  Search,
  Plus,
  X,
  DollarSign,
  Eye,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const STATUS_COLUMNS = [
  { key: "criando_arte", label: "Criando Arte", color: "border-t-pink-400" },
  { key: "em_aberto", label: "Em Aberto", color: "border-t-amber-400" },
  { key: "em_producao", label: "Em Produção", color: "border-t-blue-400" },
  {
    key: "aguardando_retirada",
    label: "Aguardando Retirada",
    color: "border-t-purple-400",
  },
  { key: "em_transporte", label: "Em Transporte", color: "border-t-cyan-400" },
  { key: "entregue", label: "Entregue", color: "border-t-emerald-400" },
  {
    key: "aguardando_pagamento",
    label: "Aguardando Pagamento",
    color: "border-t-orange-400",
  },
];

const METODOS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [busca, setBusca] = useState("");
  const [counts, setCounts] = useState({
    clientes: 0,
    orcamentos: 0,
    pedidos: 0,
    entregas: 0,
  });

  // Modal venda rápida
  const [showVenda, setShowVenda] = useState(false);
  const [vendaTipo, setVendaTipo] = useState<string>("receita");
  const [vendaDescricao, setVendaDescricao] = useState("");
  const [vendaValor, setVendaValor] = useState("");
  const [vendaMetodo, setVendaMetodo] = useState("");
  const [vendaStatus, setVendaStatus] = useState("pendente");
  const [vendaVencimento, setVendaVencimento] = useState("");
  const [vendaObs, setVendaObs] = useState("");
  const [vendaErro, setVendaErro] = useState("");
  const [vendaLoading, setVendaLoading] = useState(false);

  // Detail modal
  const [detail, setDetail] = useState<Pedido | null>(null);

  async function fetchData() {
    if (!apiToken) return;
    const allPedidos = await api<Pedido[]>("/pedidos", {}, apiToken);
    setPedidos(allPedidos);

    const clientes = await api<any[]>("/clientes", {}, apiToken);
    const orcamentos = await api<any[]>("/orcamentos", {}, apiToken);
    const entregas = allPedidos.filter((p) => p.status === "entregue").length;

    setCounts({
      clientes: clientes.length,
      orcamentos: orcamentos.length,
      pedidos: allPedidos.length,
      entregas,
    });
  }

  useEffect(() => {
    fetchData();
  }, [apiToken]);

  // Filtro do kanban por busca
  const pedidosFiltrados = busca
    ? pedidos.filter(
        (p) =>
          p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
          String(p.id).includes(busca),
      )
    : pedidos;

  function pedidosByStatus(status: string) {
    return pedidosFiltrados.filter((p) => p.status === status);
  }

  async function moveStatus(pedidoId: number, newStatus: string) {
    try {
      await api(
        `/pedidos/${pedidoId}/status`,
        { method: "PUT", body: JSON.stringify({ status: newStatus }) },
        apiToken,
      );
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function openDetail(id: number) {
    setDetail(await api<Pedido>(`/pedidos/${id}`, {}, apiToken));
  }

  // Venda rápida
  function openVenda() {
    setVendaTipo("receita");
    setVendaDescricao("");
    setVendaValor("");
    setVendaMetodo("");
    setVendaStatus("pendente");
    setVendaVencimento("");
    setVendaObs("");
    setVendaErro("");
    setShowVenda(true);
  }

  async function handleVenda(e: FormEvent) {
    e.preventDefault();
    setVendaErro("");
    setVendaLoading(true);
    try {
      await api(
        "/financeiro",
        {
          method: "POST",
          body: JSON.stringify({
            tipo: vendaTipo,
            descricao: vendaDescricao,
            valor: parseFloat(vendaValor),
            metodo_pagamento: vendaMetodo || null,
            status: vendaStatus,
            vencimento: vendaVencimento || null,
            observacoes: vendaObs || null,
          }),
        },
        apiToken,
      );
      setShowVenda(false);
    } catch (err: any) {
      setVendaErro(err.message);
    } finally {
      setVendaLoading(false);
    }
  }

  function fmt(v: number | string) {
    return Number(v).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  // Próximo status possível para cada coluna
  const NEXT_STATUS: Record<string, string> = {
    criando_arte: "em_aberto",
    em_aberto: "em_producao",
    em_producao: "aguardando_retirada",
    aguardando_retirada: "em_transporte",
    em_transporte: "entregue",
    entregue: "aguardando_pagamento",
  };

  return (
    <>
      <Header title="Gestão" />
      <div className="p-6">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gestão</h2>
            <p className="text-sm text-gray-400">Visão geral do seu negócio</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openVenda}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <DollarSign size={16} /> Venda Rápida
            </button>
            <Link
              href="/pedidos"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} /> Novo
            </Link>
          </div>
        </div>

        {/* Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Clientes",
              value: counts.clientes,
              icon: Users,
              href: "/clientes",
            },
            {
              label: "Orçamentos",
              value: counts.orcamentos,
              icon: FileText,
              href: "/orcamentos",
            },
            {
              label: "Pedidos",
              value: counts.pedidos,
              icon: ClipboardList,
              href: "/pedidos",
            },
            {
              label: "Entregas",
              value: counts.entregas,
              icon: Truck,
              href: "/pedidos",
            },
          ].map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                <card.icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Painel de Pedidos header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Painel de Pedidos
          </h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar por nome ou nº"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 w-56"
              />
            </div>
            <Link
              href="/pedidos"
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Kanban */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => {
            const items = pedidosByStatus(col.key);
            return (
              <div
                key={col.key}
                className={`flex w-56 min-w-[14rem] flex-shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50/50 border-t-4 ${col.color}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-semibold text-gray-700">
                    {col.label}
                  </span>
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-600">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-2 px-2 pb-2 min-h-[8rem]">
                  {items.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-400">
                      Nenhum pedido
                    </p>
                  ) : (
                    items.map((p) => (
                      <div
                        key={p.id}
                        className="group rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md cursor-pointer"
                        onClick={() => openDetail(p.id)}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-900">
                            PED-{p.id}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 truncate mb-2">
                          {p.cliente_nome}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>
                            {p.prazo_entrega
                              ? new Date(p.prazo_entrega).toLocaleDateString(
                                  "pt-BR",
                                  { day: "2-digit", month: "2-digit" },
                                )
                              : "—"}
                          </span>
                          <span className="font-medium text-gray-700">
                            {fmt(p.valor_total)}
                          </span>
                        </div>
                        {/* Quick move button */}
                        {NEXT_STATUS[col.key] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveStatus(p.id, NEXT_STATUS[col.key]);
                            }}
                            className="mt-2 w-full rounded-md bg-gray-50 py-1 text-[10px] font-medium text-gray-500 opacity-0 transition group-hover:opacity-100 hover:bg-brand-50 hover:text-brand-600"
                          >
                            Mover →{" "}
                            {
                              STATUS_COLUMNS.find(
                                (c) => c.key === NEXT_STATUS[col.key],
                              )?.label
                            }
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Detalhe Pedido */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => setDetail(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              Pedido #{detail.id}
            </h2>
            <p className="mb-4 text-sm text-gray-400">{detail.cliente_nome}</p>

            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Valor</span>
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
              <div>
                <span className="text-gray-400">Criado em</span>
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
            {detail.itens && detail.itens.length > 0 && (
              <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Qtd
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.itens.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="px-3 py-2 text-gray-700">
                          {item.catalogo_nome}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(item.quantidade)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {fmt(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Move actions */}
            <div className="flex flex-wrap gap-2">
              {NEXT_STATUS[detail.status] && (
                <button
                  onClick={() => {
                    moveStatus(detail.id, NEXT_STATUS[detail.status]);
                    setDetail(null);
                  }}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Mover →{" "}
                  {
                    STATUS_COLUMNS.find(
                      (c) => c.key === NEXT_STATUS[detail.status],
                    )?.label
                  }
                </button>
              )}
              <Link
                href="/pedidos"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Abrir em Pedidos
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal Venda Rápida */}
      {showVenda && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => setShowVenda(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              {vendaTipo === "receita" ? "Nova Receita" : "Nova Despesa"}
            </h2>

            <form onSubmit={handleVenda} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Tipo
                </label>
                <select
                  value={vendaTipo}
                  onChange={(e) => setVendaTipo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Descrição *
                </label>
                <input
                  type="text"
                  value={vendaDescricao}
                  onChange={(e) => setVendaDescricao(e.target.value)}
                  required
                  placeholder="Ex: Pagamento Pedido #123"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={vendaValor}
                    onChange={(e) => setVendaValor(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Método de Pagamento
                  </label>
                  <select
                    value={vendaMetodo}
                    onChange={(e) => setVendaMetodo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="">Selecione</option>
                    {METODOS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Status
                  </label>
                  <select
                    value={vendaStatus}
                    onChange={(e) => setVendaStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Vencimento
                  </label>
                  <input
                    type="date"
                    value={vendaVencimento}
                    onChange={(e) => setVendaVencimento(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Observações
                </label>
                <textarea
                  value={vendaObs}
                  onChange={(e) => setVendaObs(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>

              {vendaErro && (
                <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                  {vendaErro}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVenda(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={vendaLoading}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {vendaLoading ? "Salvando..." : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
