import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from '@/app/routes';

const MAINTENANCE_MODE = true;

export default function App() {

  if (MAINTENANCE_MODE) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0b1220',
          color: '#fff',
          textAlign: 'center',
          padding: '20px'
        }}
      >
        <div>
          <img
            src="/logo-rkc.png"
            alt="Rede Kalunga Comunicações"
            style={{
              width: '180px',
              marginBottom: '30px'
            }}
          />

          <h1 style={{ fontSize: '42px' }}>
            Sistema em Manutenção
          </h1>

          <p style={{ fontSize: '18px', maxWidth: '600px' }}>
            Estamos realizando melhorias em nossa plataforma.
          </p>

          <p style={{ fontSize: '18px' }}>
            Retornaremos em até 24 horas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
