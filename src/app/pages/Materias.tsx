import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RKCCard, RKCCardImage, RKCCardContent } from '@/app/components/RKCCard';
import { RKCTag } from '@/app/components/RKCTag';
import { Calendar, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type MateriaRow = {
  id: string;
  titulo: string;
  resumo: string | null;
  capa_url: string | null;
  autor_nome: string | null;
  tags: string[] | null;
  published_at: string | null;
  created_at: string;
  status: 'published' | 'draft' | 'archived';
};

function formatDateBR(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function Materias() {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas');
  const [materias, setMaterias] = useState<MateriaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('materias')
        .select('id, titulo, resumo, capa_url, autor_nome, tags, published_at, created_at, status')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      setLoading(false);

      if (error) {
        console.error(error);
        setMaterias([]);
        return;
      }

      setMaterias((data || []) as MateriaRow[]);
    })();
  }, []);

  const materiasUI = useMemo(() => {
    return materias.map((m) => {
      const categoria = (m.tags && m.tags[0]) ? m.tags[0] : 'Geral';
      return {
        id: m.id,
        titulo: m.titulo,
        resumo: m.resumo || '',
        imagem: m.capa_url || 'https://images.unsplash.com/photo-1579308343343-6557a756d515?auto=format&fit=crop&w=1200&q=80',
        autor: m.autor_nome || 'RKC',
        data: formatDateBR(m.published_at || m.created_at),
        categoria,
      };
    });
  }, [materias]);

  const categorias = useMemo(() => {
    const cats = materiasUI.map((m) => m.categoria).filter(Boolean);
    return ['Todas', ...Array.from(new Set(cats))];
  }, [materiasUI]);

  const materiasFiltradas = useMemo(() => {
    if (categoriaFiltro === 'Todas') return materiasUI;
    return materiasUI.filter((m) => m.categoria === categoriaFiltro);
  }, [materiasUI, categoriaFiltro]);

  const materiaDestaque = materiasFiltradas[0];
  const materiasSecundarias = materiasFiltradas.slice(1);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#C85A1E] to-[#7A3E1D] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#F2B705] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Matérias
          </h1>
          <p className="text-xl text-white/90 leading-relaxed">
            Jornalismo independente que nasce do território quilombola
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white" style={{ clipPath: 'ellipse(100% 100% at 50% 100%)' }} />
      </section>

      {/* Filtros */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {categorias.map((categoria) => (
              <button
                key={categoria}
                onClick={() => setCategoriaFiltro(categoria)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  categoriaFiltro === categoria
                    ? 'bg-[#0F7A3E] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {categoria}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid de Matérias */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {loading ? (
            <div className="text-gray-500">Carregando matérias...</div>
          ) : materiasFiltradas.length === 0 ? (
            <div className="text-gray-500">Nenhuma matéria publicada ainda.</div>
          ) : (
            <>
              {/* Matéria Destaque */}
              {materiaDestaque && (
                <div className="mb-12">
                  <Link to={`/materias/${materiaDestaque.id}`}>
                    <RKCCard variant="featured" className="hover:scale-[1.01] transition-transform">
                      <div className="grid lg:grid-cols-2 gap-0">
                        <RKCCardImage
                          src={materiaDestaque.imagem}
                          alt={materiaDestaque.titulo}
                          aspectRatio="square"
                        />
                        <RKCCardContent className="flex flex-col justify-between p-8 lg:p-12">
                          <div>
                            <RKCTag variant="orange" className="mb-4">
                              {materiaDestaque.categoria}
                            </RKCTag>
                            <h2 className="text-3xl lg:text-4xl font-bold text-[#2E2E2E] mb-4 leading-tight">
                              {materiaDestaque.titulo}
                            </h2>
                            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                              {materiaDestaque.resumo}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {materiaDestaque.autor}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {materiaDestaque.data}
                            </div>
                          </div>
                        </RKCCardContent>
                      </div>
                    </RKCCard>
                  </Link>
                </div>
              )}

              {/* Grid de Matérias */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {materiasSecundarias.map((materia) => (
                  <Link key={materia.id} to={`/materias/${materia.id}`}>
                    <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                      <RKCCardImage src={materia.imagem} alt={materia.titulo} />
                      <RKCCardContent>
                        <RKCTag variant="green" className="mb-3">
                          {materia.categoria}
                        </RKCTag>
                        <h3 className="font-bold text-xl mb-3 text-[#2E2E2E] line-clamp-2">
                          {materia.titulo}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">
                          {materia.resumo}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{materia.autor}</span>
                          <span>•</span>
                          <span>{materia.data}</span>
                        </div>
                      </RKCCardContent>
                    </RKCCard>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
