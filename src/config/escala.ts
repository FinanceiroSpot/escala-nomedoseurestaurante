// Regras da escala do Spot. Mude os números aqui quando as regras mudarem.

// Setores da cozinha e quantas pessoas, no mínimo, em cada turno.
export const SETORES: { nome: string; minimo: number }[] = [
  { nome: "Fogão", minimo: 2 },
  { nome: "Grelha", minimo: 1 },
  { nome: "Comanda", minimo: 1 },
  { nome: "Chef", minimo: 1 },
  { nome: "Salada", minimo: 1 },
  { nome: "Copa", minimo: 2 },
  { nome: "Limpeza", minimo: 3 },
  { nome: "Reposição", minimo: 2 },
  { nome: "Delivery", minimo: 2 },
];

// Mínimo de funcionários trabalhando por dia (0 = domingo ... 6 = sábado).
export const MINIMO_POR_DIA: Record<number, number> = {
  0: 18,
  1: 16,
  2: 16,
  3: 17,
  4: 17,
  5: 18,
  6: 18,
};

// Total de funcionários de cada turno fixo.
export const META_POR_TURNO: Record<string, number> = {
  Almoço: 23,
  Jantar: 22,
};

// Folgas fixas: 2 dias seguidos de segunda a sábado (1 = segunda ... 6 = sábado).
export const OPCOES_FOLGA: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
];
