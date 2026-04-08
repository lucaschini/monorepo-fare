"use client";

import { useSession } from "next-auth/react";

export default function Header({ title }: { title: string }) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-sm">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      {session?.user && (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {session.user.name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-gray-600">{session.user.name}</span>
        </div>
      )}
    </header>
  );
}
