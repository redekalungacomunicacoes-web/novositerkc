import { useEffect, useRef, useState } from 'react';
import { Maximize, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PublicRow } from './model';

export const editorialBucket = 'accountability-editorial';

function EditorialImage({ row }: { row: PublicRow }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (typeof row.path !== 'string') return;
    let active = true;
    let objectUrl = '';
    void supabase.storage.from(editorialBucket).download(row.path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.path]);
  const alt = typeof row.alt === 'string' ? row.alt : '';
  return <figure className="rkc-account-figure">
    {url ? <button type="button" className="rkc-account-image-button" onClick={() => dialog.current?.showModal()}
      aria-label={'Ampliar imagem: ' + alt}>
      <img src={url} alt={alt} loading="lazy" decoding="async" />
      <Maximize size={18} aria-hidden="true" />
    </button> : <p role="status">{failed ? 'Imagem indisponível.' : 'Carregando imagem…'}</p>}
    {row.caption && <figcaption>{row.caption}</figcaption>}
    {url && <dialog ref={dialog} className="rkc-account-lightbox" aria-label={alt}>
      <button type="button" onClick={() => dialog.current?.close()}><X size={18} /> Fechar imagem</button>
      <img src={url} alt={alt} />
      {row.caption && <p>{row.caption}</p>}
    </dialog>}
  </figure>;
}

export function Gallery({ rows }: { rows: PublicRow[] }) {
  return <div className="rkc-account-gallery">{rows.map((row, index) =>
    <EditorialImage key={String(row.path ?? index)} row={row} />)}</div>;
}

export function NarrativeAnswer({ row, media }: { row: PublicRow; media: PublicRow[] }) {
  const paragraphs = typeof row.body === 'string' ? row.body.split(/\r?\n\s*\r?\n/) : [];
  const at = (index: number) => media.filter(image => Math.min(Number(image.afterParagraph), paragraphs.length) === index);
  return <>
    <Gallery rows={at(0)} />
    {paragraphs.map((paragraph, index) => <div key={index}>
      <p className="rkc-account-body">{paragraph}</p>
      <Gallery rows={at(index + 1)} />
    </div>)}
  </>;
}
