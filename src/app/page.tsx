import Link from "next/link";
import { identidade } from "@/config/identidade";

export default function Inicio() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{identidade.nome}</h1>
      <Link href="/escala" className="botao w-full !py-6 text-xl">
        Escala da semana
      </Link>
      <Link href="/equipe" className="botao-secundario w-full !py-6 text-xl">
        Equipe
      </Link>
    </div>
  );
}
