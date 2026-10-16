import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-3xl font-extrabold text-brand-500 mb-2">404 - Página Não Encontrada</h2>
      <p className="text-slate-400 text-sm mb-6">A página que você está procurando não existe ou foi removida.</p>
      <Link href="/" className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 font-bold rounded-xl text-xs transition-all">
        Voltar para a Página Inicial
      </Link>
    </div>
  );
}
