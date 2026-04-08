"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { CatalogoItem, TipoItem } from "@erp/shared";
import { Plus, Search, Pencil, Trash2, X, Package, Wrench } from "lucide-react";

const UNIDADES = ["un", "m", "m²", "kg", "cx", "pct", "fl", "serv", "hr"];

type ModalMode = null | "create" | "edit";

export default function CatalogoPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [itens, setItens] = useState<CatalogoItem[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<string>(TipoItem.PRODUTO);
  const [unidade, setUnidade] = useState("un");
  const [preco, setPreco] = useState("");
  const [codigoFiscal, setCodigoFiscal] = useState("");

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchItens() {
    if (!apiToken) return;
    try {
      let url = `/catalogo?busca=${encodeURIComponent(busca)}`;
      if (filtroTipo) url += `&tipo=${filtroTipo}`;
      const data = await api<CatalogoItem[]>(url, {}, apiToken);
      setItens(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchItens();
  }, [busca, filtroTipo, apiToken]);

  function openCreate() {
    setNome("");
    setDescricao("");
    setTipo(TipoItem.PRODUTO);
    setUnidade("un");
    setPreco("");
    setCodigoFiscal("");
    setErro("");
    setEditingId(null);
    setModalMode("create");
  }

  function openEdit(item: CatalogoItem) {
    setNome(item.nome);
    setDescricao(item.descricao || "");
    setTipo(item.tipo);
    setUnidade(item.unidade);
    setPreco(String(item.preco_unitario));
    setCodigoFiscal(item.codigo_fiscal || "");
    setErro("");
    setEditingId(item.id);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja remover este item?")) return;
    try {
      await api(`/catalogo/${id}`, { method: "DELETE" }, apiToken);
      fetchItens();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    const body = {
      nome,
      descricao: descricao || null,
      tipo,
      unidade,
      preco_unitario: parseFloat(preco) || 0,
      codigo_fiscal: codigoFiscal || null,
    };

    try {
      if (editingId) {
        await api(
          `/catalogo/${editingId}`,
          {
            method: "PUT",
            body: JSON.stringify(body),
          },
          apiToken,
        );
      } else {
        await api(
          "/catalogo",
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          apiToken,
        );
      }
      closeModal();
      fetchItens();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number | string) {
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <>
      <Header title="Catálogo" />
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
                placeholder="Buscar por nome ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="">Todos</option>
              <option value="produto">Produtos</option>
              <option value="servico">Serviços</option>
            </select>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus size={16} />
            Novo Item
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
                  Tipo
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Unidade
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Preço Unit.
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Cód. Fiscal
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                itens.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-50 transition hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          {item.nome}
                        </span>
                        {item.descricao && (
                          <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                            {item.descricao}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.tipo === "produto"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {item.tipo === "produto" ? (
                          <Package size={11} />
                        ) : (
                          <Wrench size={11} />
                        )}
                        {item.tipo === "produto" ? "Produto" : "Serviço"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.unidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      {formatCurrency(item.preco_unitario)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.codigo_fiscal || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Remover"
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

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              {modalMode === "edit" ? "Editar Item" : "Novo Item"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nome *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  placeholder="Ex: Cartão de Visita 4x4"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Descrição
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  placeholder="Detalhes do produto ou serviço..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Tipo *
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="produto">Produto</option>
                    <option value="servico">Serviço</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Unidade *
                  </label>
                  <select
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Preço Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {tipo === "produto" ? "NCM" : "Cód. Serviço (LC 116)"}
                  </label>
                  <input
                    type="text"
                    value={codigoFiscal}
                    onChange={(e) => setCodigoFiscal(e.target.value)}
                    placeholder={tipo === "produto" ? "49119900" : "1302"}
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
    </>
  );
}
