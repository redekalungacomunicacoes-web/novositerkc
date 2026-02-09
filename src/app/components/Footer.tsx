import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-[#2E2E2E] text-white">
      {/* Faixa orgânica superior */}
      <div className="relative h-16 bg-[#0F7A3E]" style={{ clipPath: 'ellipse(100% 100% at 50% 0%)' }} />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e descrição */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center">
                <span className="text-white font-bold text-xl">RKC</span>
              </div>
              <div>
                <div className="font-bold text-lg">Rede Kalunga Comunicações</div>
                <div className="text-sm text-gray-400">Comunicação Popular e Território</div>
              </div>
            </div>
            <p className="text-sm text-gray-300 max-w-md leading-relaxed">
              Mídia independente quilombola com atuação territorial na Chapada dos Veadeiros 
              e no Território Kalunga, promovendo comunicação popular e jornalismo independente.
            </p>
            
            {/* Redes sociais */}
            <div className="flex gap-4 mt-6">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#0F7A3E] transition-colors flex items-center justify-center">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#0F7A3E] transition-colors flex items-center justify-center">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#0F7A3E] transition-colors flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          {/* Links rápidos */}
          <div>
            <h3 className="font-bold mb-4">Navegação</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-300 hover:text-[#F2B705] transition-colors">Home</Link></li>
              <li><Link to="/quem-somos" className="text-gray-300 hover:text-[#F2B705] transition-colors">Quem Somos</Link></li>
              <li><Link to="/projetos" className="text-gray-300 hover:text-[#F2B705] transition-colors">Projetos</Link></li>
              <li><Link to="/materias" className="text-gray-300 hover:text-[#F2B705] transition-colors">Matérias</Link></li>
              <li><Link to="/newsletter" className="text-gray-300 hover:text-[#F2B705] transition-colors">Newsletter</Link></li>
              <li><Link to="/contato" className="text-gray-300 hover:text-[#F2B705] transition-colors">Contato</Link></li>
            </ul>
          </div>
          
          {/* Contato */}
          <div>
            <h3 className="font-bold mb-4">Contato</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <MapPin className="w-5 h-5 flex-shrink-0 text-[#F2B705] mt-0.5" />
                <span>Chapada dos Veadeiros<br />Território Kalunga, GO</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-5 h-5 flex-shrink-0 text-[#F2B705] mt-0.5" />
                <span>contato@redekalunga.org.br</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Linha de copyright */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-gray-400">
          <p>&copy; {currentYear} Rede Kalunga Comunicações. Todos os direitos reservados.</p>
          <p className="mt-2">Comunicação popular, jornalismo independente e pertencimento territorial.</p>
        </div>
      </div>
    </footer>
  );
}
