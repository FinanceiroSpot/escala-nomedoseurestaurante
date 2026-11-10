"use client";

import { useEffect } from "react";

// Painel que sobe de baixo da tela (no celular) ou fica no centro (no computador).
export function Folha({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/50 sm:items-center sm:justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl active:bg-neutral-200"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
