"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Funcionario, Turno } from "@/lib/tipos";
import { META_POR_TURNO, OPCOES_FOLGA, SETORES } from "@/config/escala";
import { DIAS_SEMANA_CURTO } from "@/lib/datas";

type Formulario = {
  id: string | null;
  nome: string;
  funcoes: string[];
  telefone: string;
  turno: string;
  folga: string; // "2-3" ou ""
};

const VAZIO: Formulario = { id: null, nome: "", funcoes: [], telefone: "", turno: "", folga: "" };

const nomesDias = (par: number[]) => par.map((d) => DIAS_SEMANA_CURTO[d]).join(" e ");

export default function Equipe() {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não foram configuradas.");
      setCarregando(false);
      return;
    }
    const db = supabase();
    const [f, t] = await Promise.all([
      db
        .from("funcionarios")
        .select("id, nome, funcao, funcoes, telefone, cpf, ativo, turno_fixo_id, folgas")
        .order("nome"),
      db.from("turnos").select("*").order("ordem"),
    ]);
    const falha = f.error || t.error;
    if (falha) setErro(falha.message);
    else {
      setErro(null);
      setLista(f.data as Funcionario[]);
      setTurnos(t.data as Turno[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !form.nome.trim()) return;
    if (form.funcoes.length === 0) {
      setErro("Escolha pelo menos uma função.");
      return;
    }
    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      funcao: form.funcoes[0],
      funcoes: form.funcoes,
      telefone: form.telefone.trim() || null,
      turno_fixo_id: form.turno || null,
      folgas: form.folga ? form.folga.split("-").map(Number) : [],
    };
    const db = supabase();
    const { error } = form.id
      ? await db.from("funcionarios").update(dados).eq("id", form.id)
      : await db.from("funcionarios").insert(dados);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setErro(null);
    setForm(null);
    await carregar();
  }

  async function mudarAtivo(f: Funcionario) {
    if (f.ativo && !window.confirm(`Desativar ${f.nome}? Ele deixa de aparecer na escala.`)) return;
    const { error } = await supabase().from("funcionarios").update({ ativo: !f.ativo }).eq("id", f.id);
    if (error) setErro(error.message);
    else await carregar();
  }

  function editar(f: Funcionario) {
    const setores = f.funcoes?.length ? f.funcoes : SETORES.some((s) => s.nome === f.funcao) ? [f.funcao] : [];
    setForm({
      id: f.id,
      nome: f.nome,
      funcoes: setores,
      telefone: f.telefone ?? "",
      turno: f.turno_fixo_id ?? "",
      folga: f.folgas?.length === 2 ? f.folgas.join("-") : "",
    });
  }

  function alternarSetor(nome: string) {
    if (!form) return;
    const tem = form.funcoes.includes(nome);
    setForm({ ...form, funcoes: tem ? form.funcoes.filter((x) => x !== nome) : [...form.funcoes, nome] });
  }

  const nomeTurno = (id: string | null) => turnos.find((t) => t.id === id)?.nome;
  const ativos = lista.filter((f) => f.ativo);
  const inativos = lista.filter((f) => !f.ativo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        <button className="botao" onClick={() => setForm(VAZIO)}>
          + Adicionar
        </button>
      </div>

      {turnos.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {turnos.map((t) => {
            const total = ativos.filter((f) => f.turno_fixo_id === t.id).length;
            const meta = META_POR_TURNO[t.nome];
            return (
              <span key={t.id} className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
                {t.nome}: {total}
                {meta ? ` de ${meta}` : ""}
              </span>
            );
          })}
        </div>
      )}

      {erro && <p className="cartao text-red-700">Erro: {erro}</p>}
      {carregando && <p className="text-neutral-600">Carregando...</p>}

      {form && (
        <form onSubmit={salvar} className="cartao space-y-3">
          <h2 className="text-lg font-semibold">{form.id ? "Editar funcionário" : "Novo funcionário"}</h2>
          <label className="block">
            <span className="text-sm font-medium">Nome</span>
            <input
              className="campo mt-1"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Funções (marque mais de uma, se for o caso)</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {SETORES.map((s) => (
                <label key={s.nome} className="flex min-h-12 items-center gap-2 rounded-xl border border-neutral-300 px-3">
                  <input
                    type="checkbox"
                    className="h-6 w-6"
                    checked={form.funcoes.includes(s.nome)}
                    onChange={() => alternarSetor(s.nome)}
                  />
                  {s.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="text-sm font-medium">Turno fixo</span>
            <select className="campo mt-1" value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}>
              <option value="">Escolha o turno</option>
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Folgas fixas (2 dias seguidos)</span>
            <select className="campo mt-1" value={form.folga} onChange={(e) => setForm({ ...form, folga: e.target.value })}>
              <option value="">Escolha as folgas</option>
              {OPCOES_FOLGA.map((par) => (
                <option key={par.join("-")} value={par.join("-")}>
                  {nomesDias(par)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Telefone</span>
            <input
              className="campo mt-1"
              type="tel"
              inputMode="tel"
              placeholder="(11) 91234-5678"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button className="botao flex-1" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className="botao-secundario flex-1" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {[...ativos, ...inativos].map((f) => {
          const setores = f.funcoes?.length ? f.funcoes : [f.funcao];
          const faltaDefinir = f.ativo && (!f.turno_fixo_id || f.folgas?.length !== 2);
          return (
            <li key={f.id} className={`cartao ${f.ativo ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{f.nome}</p>
                  <p className="text-neutral-700">{setores.join(" · ")}</p>
                  {f.turno_fixo_id && (
                    <p className="text-neutral-700">
                      {nomeTurno(f.turno_fixo_id)}
                      {f.folgas?.length === 2 ? ` · folga ${nomesDias(f.folgas)}` : ""}
                    </p>
                  )}
                  {f.telefone && (
                    <a href={`tel:${f.telefone}`} className="text-neutral-700 underline">
                      {f.telefone}
                    </a>
                  )}
                </div>
                {!f.ativo && <span className="rounded-full bg-neutral-200 px-3 py-1 text-sm">Desativado</span>}
              </div>
              {faltaDefinir && (
                <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm">
                  Falta definir turno fixo e folgas. Sem isso, a escala não é gerada para essa pessoa.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button className="botao-secundario flex-1" onClick={() => editar(f)}>
                  Editar
                </button>
                <button className="botao-secundario flex-1" onClick={() => mudarAtivo(f)}>
                  {f.ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {!carregando && lista.length === 0 && !erro && <p className="text-neutral-600">Nenhum funcionário cadastrado.</p>}
    </div>
  );
}
