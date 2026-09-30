import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from '@/app/routes';

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-white">
      <div className="text-sm text-gray-500" role="status" aria-live="polite">
        Carregando...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}