"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { NotaFiscal, Cliente } from "@erp/shared";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
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
    icon: XCircle,
  },
};

export default function NotasPage() {
  const { data: session } = useSession();
  const apiToken = (session as any)?.apiToken;

  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  async function fetchNotas() {
    if (!apiToken) return;
    let url = "/fiscal/notas?";
    if (filtroCliente) url += `cliente_id=${filtroCliente}&`;
    if (filtroTipo) url += `tipo=${filtroTipo}&`;
    if (filtroStatus) url += `status=${filtroStatus}&`;
    if (filtroDe) url += `de=${filtroDe}&`;
    if (filtroAte) url += `ate=${filtroAte}&`;
    setNotas(await api<NotaFiscal[]>(url, {}, apiToken));
  }

  async function fetchClientes() {
    if (!apiToken) return;
    setClientes(await api<Cliente[]>("/clientes", {}, apiToken));
  }

  useEffect(() => {
    fetchNotas();
  }, [filtroCliente, filtroTipo, filtroStatus, filtroDe, filtroAte, apiToken]);
  useEffect(() => {
    fetchClientes();
  }, [apiToken]);

  function fmt(v: number | string) {
    return Number(v).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const pendentes = notas.filter((n) => n.status === "aguardando");

  return (
    <>
      <Header title="Notas Fiscais" />
      <div className="p-6">
        {/* Alerta de pendentes */}
        {pendentes.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} />
            <span>
              <strong>{pendentes.length}</strong> nota(s) aguardando emissão —
              módulo fiscal será conectado na Fase 6
            </span>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap gap-2">
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_razao}
              </option>
            ))}
          </select>
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
            <span className="text-gray-400 text-sm">a</span>
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
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Data
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
                  return (
                    <tr
                      key={n.id}
                      className={`border-b border-gray-50 transition hover:bg-gray-50/50 ${n.status === "aguardando" ? "bg-amber-50/20" : ""}`}
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
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${n.tipo === "nfe" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}
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
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(n.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
