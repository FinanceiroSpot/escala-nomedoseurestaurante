"use client";

import { useState } from "react";
import { DIAS_SEMANA_CURTO, hojeISO, paraData, paraISO, somarDias } from "@/lib/datas";
import { MESES, dataBR } from "@/lib/emprestimos";
import { Folha } from "@/components/Folha";

// Calendário mensal grande, para escolher uma data com o dedo.
// Semana começa na segunda, como no resto do sistema.
export function Calendario({
  valor,
  aoEscolher,
}: {
  valor: string;
  aoEscolher: (iso: string) => void;
}) {
  const hoje = hojeISO();
  const base = paraData(valor);
  const [mes, setMes] = useState({ a: base.getFullYear(), m: base.getMonth() });

  const primeiro = new Date(mes.a, mes.m, 1);
  const vazios = (primeiro.getDay() + 6) % 7; // segunda = 0
  const diasNoMes = new Date(mes.a, mes.m + 1, 0).getDate();
  const celulas: (string | null)[] = [
    ...Array<null>(vazios).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => paraISO(new Date(mes.a, mes.m, i + 1))),
  ];

  function mover(delta: number) {
    const d = new Date(mes.a, mes.m + delta, 1);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  }

  const ordem = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => mover(-1)}
          aria-label="Mês anterior"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-2xl active:bg-neutral-200"
        >
          ‹
        </button>
        <p className="text-lg font-bold">
          {MESES[mes.m]} <span className="font-normal text-neutral-500">{mes.a}</span>
        </p>
        <button
          type="button"
          onClick={() => mover(1)}
          aria-label="Próximo mês"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-2xl active:bg-neutral-200"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {ordem.map((d) => (
          <span key={d} className="pb-1 text-xs font-semibold text-neutral-500">
            {DIAS_SEMANA_CURTO[d]}
          </span>
        ))}
        {celulas.map((iso, i) => {
          if (!iso) return <span key={`v${i}`} />;
          const escolhido = iso === valor;
          const eHoje = iso === hoje;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => aoEscolher(iso)}
              className={`h-11 rounded-full text-base font-medium active:scale-95 ${
                escolhido
                  ? "font-bold text-white shadow"
                  : eHoje
                    ? "border-2 font-bold"
                    : "hover:bg-neutral-100"
              }`}
              style={
                escolhido
                  ? { background: "var(--cor-principal)" }
                  : eHoje
                    ? { borderColor: "var(--cor-principal)", color: "var(--cor-principal)" }
                    : undefined
              }
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" className="botao-secundario flex-1" onClick={() => aoEscolher(hoje)}>
          Hoje
        </button>
        <button
          type="button"
          className="botao-secundario flex-1"
          onClick={() => aoEscolher(somarDias(hoje, -1))}
        >
          Ontem
        </button>
      </div>
    </div>
  );
}

// Botão que mostra a data e abre o calendário numa folha.
export function CampoData({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (iso: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{rotulo}</span>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="campo flex items-center justify-between text-left"
      >
        <span>
          {dataBR(valor)}
          {valor === hojeISO() && <span className="ml-2 text-neutral-500">(hoje)</span>}
        </span>
        <span aria-hidden>📅</span>
      </button>
      {aberto && (
        <Folha titulo={rotulo} aoFechar={() => setAberto(false)}>
          <Calendario
            valor={valor}
            aoEscolher={(iso) => {
              aoMudar(iso);
              setAberto(false);
            }}
          />
        </Folha>
      )}
    </div>
  );
}
