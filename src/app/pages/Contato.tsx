import { useState } from 'react';
import { RKCButton } from '@/app/components/RKCButton';
import { RKCCard, RKCCardContent } from '@/app/components/RKCCard';
import { Mail, MapPin, Phone, Send, CheckCircle2, Facebook, Instagram } from 'lucide-react';

export function Contato() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    assunto: '',
    mensagem: '',
  });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulação de envio
    setSent(true);
    setFormData({ nome: '', email: '', assunto: '', mensagem: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const contatos = [
    {
      icon: Mail,
      titulo: 'Email',
      info: 'contato@redekalunga.org.br',
      link: 'mailto:contato@redekalunga.org.br',
    },
    {
      icon: MapPin,
      titulo: 'Localização',
      info: 'Chapada dos Veadeiros, Território Kalunga, GO',
      link: null,
    },
    {
      icon: Phone,
      titulo: 'Telefone',
      info: '(62) 9 8765-4321',
      link: 'tel:+5562987654321',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#2FA866] to-[#0F7A3E] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#F2B705] blur-3xl" />
        </div>
        
        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Entre em Contato
          </h1>
          <p className="text-xl text-white/90 leading-relaxed">
            Quer colaborar, sugerir pautas ou conhecer nosso trabalho? 
            Estamos aqui para conversar!
          </p>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white" style={{ clipPath: 'ellipse(100% 100% at 50% 100%)' }} />
      </section>

      {/* Formulário e Informações */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Formulário */}
            <div className="lg:col-span-2">
              {!sent ? (
                <div>
                  <h2 className="text-3xl font-bold text-[#2E2E2E] mb-4">
                    Envie uma mensagem
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Preencha o formulário abaixo e entraremos em contato em breve.
                  </p>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="nome" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                          Seu nome *
                        </label>
                        <input
                          type="text"
                          id="nome"
                          name="nome"
                          value={formData.nome}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F7A3E] focus:border-transparent"
                          placeholder="Digite seu nome"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                          Seu email *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F7A3E] focus:border-transparent"
                          placeholder="seuemail@exemplo.com"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="assunto" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                        Assunto *
                      </label>
                      <select
                        id="assunto"
                        name="assunto"
                        value={formData.assunto}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F7A3E] focus:border-transparent"
                      >
                        <option value="">Selecione um assunto</option>
                        <option value="parceria">Parcerias e Colaborações</option>
                        <option value="pauta">Sugestão de Pauta</option>
                        <option value="duvida">Dúvidas</option>
                        <option value="outros">Outros</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="mensagem" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                        Mensagem *
                      </label>
                      <textarea
                        id="mensagem"
                        name="mensagem"
                        value={formData.mensagem}
                        onChange={handleChange}
                        required
                        rows={6}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F7A3E] focus:border-transparent resize-none"
                        placeholder="Digite sua mensagem..."
                      />
                    </div>
                    
                    <RKCButton type="submit" size="lg">
                      Enviar Mensagem
                      <Send className="w-5 h-5" />
                    </RKCButton>
                  </form>
                </div>
              ) : (
                <RKCCard className="border-2 border-[#0F7A3E]">
                  <RKCCardContent className="p-8 md:p-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#0F7A3E]/10 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-[#0F7A3E]" />
                    </div>
                    <h2 className="text-3xl font-bold text-[#2E2E2E] mb-4">
                      Mensagem enviada!
                    </h2>
                    <p className="text-lg text-gray-600 mb-6">
                      Obrigado por entrar em contato. Retornaremos em breve!
                    </p>
                    <RKCButton onClick={() => setSent(false)} variant="outline">
                      Enviar nova mensagem
                    </RKCButton>
                  </RKCCardContent>
                </RKCCard>
              )}
            </div>
            
            {/* Informações de Contato */}
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-[#2E2E2E] mb-6">
                  Informações de Contato
                </h3>
                
                <div className="space-y-4">
                  {contatos.map((contato, index) => {
                    const Icon = contato.icon;
                    const content = (
                      <RKCCard key={index} className="hover:shadow-md transition-shadow">
                        <RKCCardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 flex-shrink-0 rounded-full bg-[#0F7A3E]/10 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-[#0F7A3E]" />
                            </div>
                            <div>
                              <h4 className="font-bold text-[#2E2E2E] mb-1">
                                {contato.titulo}
                              </h4>
                              <p className="text-gray-600 text-sm">
                                {contato.info}
                              </p>
                            </div>
                          </div>
                        </RKCCardContent>
                      </RKCCard>
                    );
                    
                    return contato.link ? (
                      <a key={index} href={contato.link} target="_blank" rel="noopener noreferrer">
                        {content}
                      </a>
                    ) : content;
                  })}
                </div>
              </div>
              
              {/* Redes Sociais */}
              <div>
                <h3 className="text-xl font-bold text-[#2E2E2E] mb-4">
                  Redes Sociais
                </h3>
                <div className="flex gap-3">
                  <a
                    href="#"
                    className="w-12 h-12 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center"
                  >
                    <Instagram className="w-6 h-6 text-white" />
                  </a>
                  <a
                    href="#"
                    className="w-12 h-12 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center"
                  >
                    <Facebook className="w-6 h-6 text-white" />
                  </a>
                </div>
              </div>
              
              {/* Horário de Atendimento */}
              <RKCCard className="bg-gradient-to-br from-[#0F7A3E]/5 to-[#2FA866]/5">
                <RKCCardContent className="p-6">
                  <h4 className="font-bold text-[#2E2E2E] mb-3">
                    Horário de Atendimento
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Segunda a Sexta<br />
                    09:00 - 18:00
                  </p>
                </RKCCardContent>
              </RKCCard>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
