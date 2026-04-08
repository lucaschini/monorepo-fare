"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import {
  Cliente,
  CreateClienteDTO,
  TipoCliente,
  validarDocumento,
  formatarCPF,
  formatarCNPJ,
} from "@erp/shared";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

const emptyForm: CreateClienteDTO = {
  tipo: TipoCliente.PJ,
  nome_razao: "",
  cpf_cnpj: "",
  inscricao_estadual: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "SP",
};

export default function ClientesPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateClienteDTO>(emptyForm);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchClientes() {
    if (!apiToken) return;
    try {
      const data = await api<Cliente[]>(
        `/clientes?busca=${encodeURIComponent(busca)}`,
        {},
        apiToken,
      );
      setClientes(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchClientes();
  }, [busca, apiToken]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setErro("");
    setModalOpen(true);
  }

  function openEdit(cliente: Cliente) {
    setForm({
      tipo: cliente.tipo as TipoCliente,
      nome_razao: cliente.nome_razao,
      cpf_cnpj: cliente.cpf_cnpj,
      inscricao_estadual: cliente.inscricao_estadual || "",
      email: cliente.email || "",
      telefone: cliente.telefone || "",
      cep: cliente.cep,
      logradouro: cliente.logradouro,
      numero: cliente.numero,
      complemento: cliente.complemento || "",
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      uf: cliente.uf,
    });
    setEditingId(cliente.id);
    setErro("");
    setModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja remover este cliente?")) return;
    try {
      await api(`/clientes/${id}`, { method: "DELETE" }, apiToken);
      fetchClientes();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");

    if (!validarDocumento(form.cpf_cnpj, form.tipo)) {
      setErro(`${form.tipo === "PF" ? "CPF" : "CNPJ"} inválido`);
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await api(`/clientes/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
          apiToken,
        });
      } else {
        await api("/clientes", {
          method: "POST",
          body: JSON.stringify(form),
          apiToken,
        });
      }
      setModalOpen(false);
      fetchClientes();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field: keyof CreateClienteDTO, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function formatDoc(doc: string, tipo: string) {
    return tipo === "PF" ? formatarCPF(doc) : formatarCNPJ(doc);
  }

  return (
    <>
      <Header title="Clientes" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Nome / Razão Social
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  CPF/CNPJ
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Cidade/UF
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  E-mail
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 transition hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.nome_razao}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.tipo === "PJ"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">
                      {formatDoc(c.cpf_cnpj, c.tipo)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.cidade}/{c.uf}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
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
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo + Doc */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Tipo *
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => updateForm("tipo", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="PJ">Pessoa Jurídica</option>
                    <option value="PF">Pessoa Física</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {form.tipo === "PF" ? "CPF" : "CNPJ"} *
                  </label>
                  <input
                    type="text"
                    value={form.cpf_cnpj}
                    onChange={(e) => updateForm("cpf_cnpj", e.target.value)}
                    required
                    placeholder={
                      form.tipo === "PF"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {form.tipo === "PF" ? "Nome Completo" : "Razão Social"} *
                </label>
                <input
                  type="text"
                  value={form.nome_razao}
                  onChange={(e) => updateForm("nome_razao", e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>

              {/* IE + Email + Telefone */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    IE
                  </label>
                  <input
                    type="text"
                    value={form.inscricao_estadual || ""}
                    onChange={(e) =>
                      updateForm("inscricao_estadual", e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => updateForm("email", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={form.telefone || ""}
                    onChange={(e) => updateForm("telefone", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    CEP *
                  </label>
                  <input
                    type="text"
                    value={form.cep}
                    onChange={(e) => updateForm("cep", e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Logradouro *
                  </label>
                  <input
                    type="text"
                    value={form.logradouro}
                    onChange={(e) => updateForm("logradouro", e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Número *
                  </label>
                  <input
                    type="text"
                    value={form.numero}
                    onChange={(e) => updateForm("numero", e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={form.complemento || ""}
                    onChange={(e) => updateForm("complemento", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => updateForm("bairro", e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    UF *
                  </label>
                  <select
                    value={form.uf}
                    onChange={(e) => updateForm("uf", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={(e) => updateForm("cidade", e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
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
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : editingId ? "Salvar" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
