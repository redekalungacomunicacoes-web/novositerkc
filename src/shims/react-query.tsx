import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type QueryKey = readonly unknown[];
type Subscriber = () => void;

export class QueryClient {
  private cache = new Map<string, unknown>();
  private subscribers = new Map<string, Set<Subscriber>>();
  key(queryKey: QueryKey) { return JSON.stringify(queryKey); }
  get<T>(queryKey: QueryKey) { return this.cache.get(this.key(queryKey)) as T | undefined; }
  set<T>(queryKey: QueryKey, value: T) { const key = this.key(queryKey); this.cache.set(key, value); this.subscribers.get(key)?.forEach((subscriber) => subscriber()); }
  subscribe(queryKey: QueryKey, subscriber: Subscriber) { const key = this.key(queryKey); const set = this.subscribers.get(key) ?? new Set<Subscriber>(); set.add(subscriber); this.subscribers.set(key, set); return () => set.delete(subscriber); }
  invalidateQueries(_: { queryKey: QueryKey }) { this.subscribers.forEach((set) => set.forEach((subscriber) => subscriber())); }
}

const QueryClientContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>;
}

export function useQueryClient() {
  const client = useContext(QueryClientContext);
  return useMemo(() => client ?? new QueryClient(), [client]);
}

export function useQuery<T>({ queryKey, queryFn, enabled = true }: { queryKey: QueryKey; queryFn: () => Promise<T>; enabled?: boolean }) {
  const client = useQueryClient();
  const [data, setData] = useState<T | undefined>(() => client.get<T>(queryKey));
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setLoading] = useState(enabled && data === undefined);
  const key = JSON.stringify(queryKey);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      try { const value = await queryFn(); if (!mounted) return; client.set(queryKey, value); setData(value); setError(null); }
      catch (err) { if (mounted) setError(err instanceof Error ? err : new Error(String(err))); }
      finally { if (mounted) setLoading(false); }
    }
    const unsubscribe = client.subscribe(queryKey, () => void load());
    void load();
    return () => { mounted = false; unsubscribe(); };
  }, [client, enabled, key]);
  return { data, error, isLoading };
}

export function useMutation<TData = unknown, TError = Error, TVariables = void>({ mutationFn, onSuccess }: { mutationFn: (variables: TVariables) => Promise<TData>; onSuccess?: (data: TData) => void }) {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  async function mutateAsync(variables: TVariables) {
    setPending(true);
    try { const data = await mutationFn(variables); setError(null); onSuccess?.(data); return data; }
    catch (err) { setError(err as TError); throw err; }
    finally { setPending(false); }
  }
  return { mutateAsync, isPending, error };
}
