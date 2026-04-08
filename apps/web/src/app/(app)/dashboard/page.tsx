"use client";

import Header from "@/components/Header";
import { Users } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <>
      <Header title="Painel" />
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/clientes"
            className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Clientes</p>
              <p className="text-lg font-semibold text-gray-900">Gerenciar</p>
            </div>
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">
            Indicadores e relatórios serão implementados na Fase 8.
          </p>
        </div>
      </div>
    </>
  );
}
