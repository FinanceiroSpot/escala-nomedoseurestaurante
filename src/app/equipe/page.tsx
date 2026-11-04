"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = { id: string | null; nome: string; funcao: string; telefone: string };

const VAZIO: Formulario = { id: null, nome: "", funcao: FUNCOES_PADRAO[0], telefone: "" };

export default function Equipe() {
  const [lista, setLista] = useState<Funcionario[]>([]);
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
    const { data, error } = await supabase()
      .from("funcionarios")
      .select("id, nome, funcao, telefone, cpf, ativo")
      .order("nome");
    if (error) setErro(error.message);
    else {
      setErro(null);
      setLista(data as Funcionario[]);
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
    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      funcao: form.funcao,
      telefone: form.telefone.trim() || null,
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
    setForm(null);
    await carregar();
  }

  async function mudarAtivo(f: Funcionario) {
    if (f.ativo && !window.confirm(`Desativar ${f.nome}? Ele deixa de aparecer na escala.`)) return;
    const { error } = await supabase()
      .from("funcionarios")
      .update({ ativo: !f.ativo })
      .eq("id", f.id);
    if (error) setErro(error.message);
    else await carregar();
  }

  const ativos = lista.filter((f) => f.ativo);
  const inativos = lista.filter((f) => !f.ativo);
  // Mantém no seletor uma função antiga que não esteja na lista padrão.
  const funcoes = form && !FUNCOES_PADRAO.includes(form.funcao) ? [form.funcao, ...FUNCOES_PADRAO] : FUNCOES_PADRAO;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        <button className="botao" onClick={() => setForm(VAZIO)}>
          + Adicionar
        </button>
      </div>

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
          <label className="block">
            <span className="text-sm font-medium">Função</span>
            <select
              className="campo mt-1"
              value={form.funcao}
              onChange={(e) => setForm({ ...form, funcao: e.target.value })}
            >
              {funcoes.map((fn) => (
                <option key={fn}>{fn}</option>
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
        {[...ativos, ...inativos].map((f) => (
          <li key={f.id} className={`cartao ${f.ativo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{f.nome}</p>
                <p className="text-neutral-700">{f.funcao}</p>
                {f.telefone && (
                  <a href={`tel:${f.telefone}`} className="text-neutral-700 underline">
                    {f.telefone}
                  </a>
                )}
              </div>
              {!f.ativo && (
                <span className="rounded-full bg-neutral-200 px-3 py-1 text-sm">Desativado</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="botao-secundario flex-1"
                onClick={() =>
                  setForm({ id: f.id, nome: f.nome, funcao: f.funcao, telefone: f.telefone ?? "" })
                }
              >
                Editar
              </button>
              <button className="botao-secundario flex-1" onClick={() => mudarAtivo(f)}>
                {f.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!carregando && lista.length === 0 && !erro && (
        <p className="text-neutral-600">Nenhum funcionário cadastrado.</p>
      )}
    </div>
  );
}
