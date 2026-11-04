"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { variaveisConfiguradas } from "@/lib/supabase";
import { listarEscala, listarFuncionarios, listarTurnos, salvarCelula } from "@/lib/dados";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  somarDias,
} from "@/lib/datas";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";

type Celula = { data: string; turno: Turno };

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [escala, setEscala] = useState<Escala[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState<Celula | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const dias = useMemo(() => diasDaSemana(segunda), [segunda]);

  const carregar = useCallback(async () => {
    try {
      if (!variaveisConfiguradas()) throw new Error("O banco de dados não está configurado.");
      const [f, t, e] = await Promise.all([
        listarFuncionarios(),
        listarTurnos(),
        listarEscala(segunda, somarDias(segunda, 6)),
      ]);
      setFuncionarios(f);
      setTurnos(t);
      setEscala(e);
      setErro("");
      setPronto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [segunda]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const porId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  function idsDa(data: string, turnoId: string): string[] {
    return escala
      .filter((e) => e.data === data && e.turno_id === turnoId)
      .map((e) => e.funcionario_id);
  }

  function abrir(c: Celula) {
    setMarcados(new Set(idsDa(c.data, c.turno.id)));
    setAberta(c);
    setErro("");
  }

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function salvar() {
    if (!aberta) return;
    setSalvando(true);
    try {
      await salvarCelula(aberta.data, aberta.turno.id, [...marcados]);
      setAberta(null);
      await carregar();
    } catch (e) {
      setErro("Não foi possível salvar. " + (e instanceof Error ? e.message : ""));
    } finally {
      setSalvando(false);
    }
  }

  // Na janela: funcionários ativos, mais os inativos já escalados nessa célula.
  const opcoes = aberta
    ? funcionarios.filter((f) => f.ativo || idsDa(aberta.data, aberta.turno.id).includes(f.id))
    : [];
  const grupos = new Map<string, Funcionario[]>();
  for (const f of opcoes) grupos.set(f.funcao, [...(grupos.get(f.funcao) ?? []), f]);

  const hoje = hojeISO();
  const intervalo = `${diaMes(dias[0])} a ${diaMes(dias[6])}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="cartao space-y-3">
        <p className="text-center text-lg font-semibold">
          {intervalo} · {paraData(dias[6]).getFullYear()}
        </p>
        <div className="flex gap-2">
          <button className="botao-secundario flex-1" onClick={() => setSegunda(somarDias(segunda, -7))}>
            ◀ Anterior
          </button>
          <button className="botao-secundario flex-1" onClick={() => setSegunda(somarDias(segunda, 7))}>
            Próxima ▶
          </button>
        </div>
        <button
          className="botao-secundario w-full"
          onClick={() => setSegunda(inicioDaSemana(hojeISO()))}
        >
          Voltar para esta semana
        </button>
      </div>

      {erro && <p className="rounded-xl bg-red-50 p-3 text-red-700">{erro}</p>}
      {!pronto && !erro && <p className="text-neutral-600">Carregando...</p>}

      {pronto && (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] min-w-20 bg-[var(--cor-secundaria)]" />
                {dias.map((d) => (
                  <th
                    key={d}
                    className={`min-w-28 rounded-lg px-2 py-2 text-sm ${
                      d === hoje ? "bg-amber-200" : "bg-white"
                    }`}
                  >
                    {DIAS_SEMANA[paraData(d).getDay()]}
                    <span className="block font-normal text-neutral-600">{diaMes(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <th className="sticky left-0 z-[1] rounded-lg bg-white px-2 py-2 text-left text-sm">
                    {t.nome}
                    <span className="block font-normal text-neutral-600">
                      {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                    </span>
                  </th>
                  {dias.map((d) => {
                    const ids = idsDa(d, t.id);
                    const nomes = ids
                      .map((id) => porId.get(id))
                      .filter((f): f is Funcionario => Boolean(f))
                      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
                    return (
                      <td key={d} className="p-0 align-top">
                        <button
                          onClick={() => abrir({ data: d, turno: t })}
                          className="block min-h-24 w-full rounded-lg border border-neutral-200 bg-white p-2 text-left active:bg-neutral-100"
                        >
                          {nomes.length === 0 ? (
                            <span className="text-2xl text-neutral-400">+</span>
                          ) : (
                            <>
                              <span className="block text-sm font-bold">
                                {nomes.length} {nomes.length === 1 ? "pessoa" : "pessoas"}
                              </span>
                              {nomes.map((f) => (
                                <span key={f.id} className="block truncate text-sm">
                                  {f.nome.split(" ")[0]}
                                </span>
                              ))}
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberta && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/50 sm:items-center sm:justify-center">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="border-b border-neutral-200 p-4">
              <p className="text-lg font-bold">
                {aberta.turno.nome} · {DIAS_SEMANA[paraData(aberta.data).getDay()]}{" "}
                {diaMes(aberta.data)}
              </p>
              <p className="text-neutral-600">Quem trabalha? ({marcados.size} marcados)</p>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {[...grupos.entries()].map(([funcao, lista]) => (
                <div key={funcao}>
                  <p className="mb-2 text-sm font-semibold uppercase text-neutral-600">{funcao}</p>
                  <div className="space-y-2">
                    {lista.map((f) => (
                      <label
                        key={f.id}
                        className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-2 text-lg ${
                          marcados.has(f.id)
                            ? "border-green-600 bg-green-50 font-semibold"
                            : "border-neutral-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-6 w-6"
                          checked={marcados.has(f.id)}
                          onChange={() => alternar(f.id)}
                        />
                        <span>
                          {f.nome}
                          {!f.ativo && (
                            <span className="ml-2 text-sm font-normal text-neutral-500">
                              (inativo)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {opcoes.length === 0 && (
                <p className="text-neutral-600">Nenhum funcionário ativo. Cadastre na tela Equipe.</p>
              )}
            </div>
            <div className="flex gap-2 border-t border-neutral-200 p-4">
              <button className="botao flex-1" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button className="botao-secundario flex-1" onClick={() => setAberta(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
