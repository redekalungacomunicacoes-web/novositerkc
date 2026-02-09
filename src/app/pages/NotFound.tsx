import { Link } from 'react-router-dom';
import { RKCButton } from '@/app/components/RKCButton';

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#0F7A3E] mb-4">404</h1>
        <h2 className="text-2xl font-bold text-[#2E2E2E] mb-4">Página não encontrada</h2>
        <p className="text-gray-600 mb-8">A página que você está procurando não existe.</p>
        <Link to="/">
          <RKCButton>Voltar para Home</RKCButton>
        </Link>
      </div>
    </div>
  );
}
