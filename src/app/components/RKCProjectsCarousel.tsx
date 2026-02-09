import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Carrossel infinito (loop):
 * - Desktop (lg+): 3 cards visíveis
 * - Tablet (md): 2 cards visíveis
 * - Mobile: 1 card visível
 *
 * ✅ roda sozinho (autoplay)
 * ✅ não trava quando tem 4, 5, 7... itens
 * ✅ swipe no mobile e drag no desktop
 * ✅ mantém 3 visíveis SEM “sumir” os restantes
 */

type BreakpointView = 1 | 2 | 3;

function getPerView(): BreakpointView {
  if (typeof window === "undefined") return 3;
  const w = window.innerWidth;
  if (w >= 1024) return 3;
  if (w >= 768) return 2;
  return 1;
}

type Props<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;

  autoplay?: boolean;
  autoplayMs?: number;      // velocidade da “rodagem”
  transitionMs?: number;    // suavidade da animação
  showArrows?: boolean;
  className?: string;
};

export function RKCProjectsCarousel<T>({
  items,
  renderItem,
  autoplay = true,
  autoplayMs = 2500,   // roda “sempre”
  transitionMs = 700,
  showArrows = true,
  className = "",
}: Props<T>) {
  const [perView, setPerView] = useState<BreakpointView>(() => getPerView());

  // índice do “track” (infinito)
  const [index, setIndex] = useState(0);

  // controle do autoplay/drag
  const [paused, setPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);

  // atualiza perView no resize
  useEffect(() => {
    const onResize = () => setPerView(getPerView());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ✅ garante loop mesmo com poucos itens:
  // - se tiver 5 e perView=3, ok
  // - se tiver 2 e perView=3, duplicamos até ficar “rolável”
  const safeItems = useMemo(() => {
    const base = items || [];
    if (base.length === 0) return [];
    const min = Math.max(perView + 2, 6); // mínimo pra loop ficar suave
    const out: T[] = [];
    while (out.length < min) out.push(...base);
    return out;
  }, [items, perView]);

  // cria trilho infinito:
  // duplicamos no começo e no fim para permitir “voltar” sem jump visível
  const loopItems = useMemo(() => {
    if (safeItems.length === 0) return [];
    // janela de buffer
    const head = safeItems.slice(-perView * 2);
    const tail = safeItems.slice(0, perView * 2);
    return [...head, ...safeItems, ...tail];
  }, [safeItems, perView]);

  // posição inicial (começa na área “do meio” para permitir loop)
  const baseIndex = useMemo(() => {
    if (safeItems.length === 0) return 0;
    return perView * 2; // após o head
  }, [safeItems.length, perView]);

  // quando muda perView ou items, reseta para base
  useEffect(() => {
    setIndex(baseIndex);
    setIsAnimating(false);
    // reativa animação no próximo frame
    const t = requestAnimationFrame(() => setIsAnimating(true));
    return () => cancelAnimationFrame(t);
  }, [baseIndex]);

  const canNav = safeItems.length > 1;

  function prev() {
    if (!canNav) return;
    setIndex((i) => i - 1);
  }
  function next() {
    if (!canNav) return;
    setIndex((i) => i + 1);
  }

  // autoplay “rodando”
  useEffect(() => {
    if (!autoplay) return;
    if (!canNav) return;
    if (paused) return;

    const t = window.setInterval(() => {
      next();
    }, autoplayMs);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, autoplayMs, paused, canNav, perView]);

  // depois da animação, “teleporta” para manter loop (sem o usuário ver)
  function onTransitionEnd() {
    if (safeItems.length === 0) return;

    const total = safeItems.length;
    const leftLimit = perView * 1; // dentro do head
    const rightLimit = perView * 2 + total; // final da área principal

    if (index <= leftLimit) {
      // teleporta pro “mesmo ponto” no meio
      setIsAnimating(false);
      setIndex(index + total);
      requestAnimationFrame(() => setIsAnimating(true));
    } else if (index >= rightLimit) {
      setIsAnimating(false);
      setIndex(index - total);
      requestAnimationFrame(() => setIsAnimating(true));
    }
  }

  // swipe/drag
  function onTouchStart(e: React.TouchEvent) {
    if (!canNav) return;
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
    setPaused(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current == null) return;
    deltaX.current = e.touches[0].clientX - startX.current;
  }
  function onTouchEnd() {
    if (startX.current == null) return;
    const dx = deltaX.current;
    startX.current = null;

    if (dx > 60) prev();
    else if (dx < -60) next();

    setPaused(false);
  }

  // mouse drag (desktop)
  function onMouseDown(e: React.MouseEvent) {
    if (!canNav) return;
    startX.current = e.clientX;
    deltaX.current = 0;
    setPaused(true);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (startX.current == null) return;
    deltaX.current = e.clientX - startX.current;
  }
  function onMouseUp() {
    if (startX.current == null) return;
    const dx = deltaX.current;
    startX.current = null;

    if (dx > 80) prev();
    else if (dx < -80) next();

    setPaused(false);
  }
  function onMouseLeave() {
    // se sair arrastando, finaliza
    if (startX.current != null) onMouseUp();
    setPaused(false);
  }

  // cada item ocupa (100/perView) do viewport
  const itemWidthPct = 100 / perView;
  const translatePct = index * itemWidthPct;

  if (!items || items.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {showArrows && canNav && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>

          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
          >
            Próximo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className="overflow-hidden select-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          onMouseLeave();
          setPaused(false);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTransitionEnd={onTransitionEnd}
          style={{
            transform: `translateX(-${translatePct}%)`,
            transition: isAnimating ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
            cursor: canNav ? "grab" : "default",
          }}
        >
          {loopItems.map((it, i) => (
            <div
              key={i}
              className="shrink-0 px-3"
              style={{ width: `${itemWidthPct}%` }}
            >
              {renderItem(it, i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
