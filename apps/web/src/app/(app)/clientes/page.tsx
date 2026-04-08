"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import {
  Cliente,
  TipoCliente,
  validarDocumento,
  formatarCPF,
  formatarCNPJ,
  clientePossuiDadosFiscais,
} from "@erp/shared";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";

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

type ModalMode = null | "create" | "edit" | "fiscal";

export default function ClientesPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  // Form básico
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  // Form fiscal
  const [tipo, setTipo] = useState<string>("PJ");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("SP");

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
    setNome("");
    setTelefone("");
    setEmail("");
    setErro("");
    setSelectedCliente(null);
    setModalMode("create");
  }

  function openEdit(c: Cliente) {
    setNome(c.nome_razao);
    setTelefone(c.telefone || "");
    setEmail(c.email || "");
    setErro("");
    setSelectedCliente(c);
    setModalMode("edit");
  }

  function openFiscal(c: Cliente) {
    setTipo(c.tipo || "PJ");
    setCpfCnpj(c.cpf_cnpj || "");
    setIe(c.inscricao_estadual || "");
    setCep(c.cep || "");
    setLogradouro(c.logradouro || "");
    setNumero(c.numero || "");
    setComplemento(c.complemento || "");
    setBairro(c.bairro || "");
    setCidade(c.cidade || "");
    setUf(c.uf || "SP");
    setErro("");
    setSelectedCliente(c);
    setModalMode("fiscal");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedCliente(null);
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

  async function handleSubmitBasico(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      if (modalMode === "edit" && selectedCliente) {
        await api(
          `/clientes/${selectedCliente.id}`,
          {
            method: "PUT",
            body: JSON.stringify({ nome_razao: nome, telefone, email }),
          },
          apiToken,
        );
      } else {
        await api(
          "/clientes",
          {
            method: "POST",
            body: JSON.stringify({ nome_razao: nome, telefone, email }),
          },
          apiToken,
        );
      }
      closeModal();
      fetchClientes();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFiscal(e: FormEvent) {
    e.preventDefault();
    setErro("");

    if (!validarDocumento(cpfCnpj, tipo as "PF" | "PJ")) {
      setErro(`${tipo === "PF" ? "CPF" : "CNPJ"} inválido`);
      return;
    }

    setLoading(true);
    try {
      await api(
        `/clientes/${selectedCliente!.id}/fiscal`,
        {
          method: "PUT",
          body: JSON.stringify({
            tipo,
            cpf_cnpj: cpfCnpj,
            inscricao_estadual: ie,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            uf,
          }),
        },
        apiToken,
      );
      closeModal();
      fetchClientes();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDoc(doc: string | null, tipo: string | null) {
    if (!doc) return "—";
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
              placeholder="Buscar por nome, telefone ou e-mail..."
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

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Nome
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Telefone
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  E-mail
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Fiscal
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
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const fiscal = clientePossuiDadosFiscais(c);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 transition hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.nome_razao}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.telefone || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {fiscal ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <FileText size={12} />
                            {c.tipo} —{" "}
                            {formatDoc(c.cpf_cnpj ?? null, c.tipo ?? null)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <AlertTriangle size={12} />
                            Incompleto
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => openFiscal(c)}
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
                            title="Dados Fiscais"
                          >
                            <FileText size={15} />
                          </button>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro / Edição */}
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
              {modalMode === "edit" ? "Editar Cliente" : "Novo Cliente"}
            </h2>

            <form onSubmit={handleSubmitBasico} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nome / Razão Social *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Telefone
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

      {/* Modal Dados Fiscais */}
      {modalMode === "fiscal" && selectedCliente && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              Dados Fiscais
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              {selectedCliente.nome_razao}
            </p>

            <form onSubmit={handleSubmitFiscal} className="space-y-4">
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
                    <option value="PJ">Pessoa Jurídica</option>
                    <option value="PF">Pessoa Física</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {tipo === "PF" ? "CPF" : "CNPJ"} *
                  </label>
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    required
                    placeholder={
                      tipo === "PF" ? "000.000.000-00" : "00.000.000/0000-00"
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  value={ie}
                  onChange={(e) => setIe(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    CEP *
                  </label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
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
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
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
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
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
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    UF *
                  </label>
                  <select
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {UFS.map((u) => (
                      <option key={u} value={u}>
                        {u}
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
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
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
                  {loading ? "Salvando..." : "Salvar Dados Fiscais"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
