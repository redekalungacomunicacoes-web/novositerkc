export function normalizeEntityStatus(input: string | null | undefined): string {
  const v = (input ?? '').toLowerCase().trim();

  if (v === 'em andamento' || v === 'em_andamento') return 'em_andamento';
  if (v === 'ativo') return 'ativo';
  if (v === 'inativo') return 'inativo';
  if (v === 'encerrado') return 'encerrado';
  if (v === 'planejado') return 'planejado';
  if (v === 'concluido' || v === 'concluído') return 'concluido';

  return 'ativo';
}
