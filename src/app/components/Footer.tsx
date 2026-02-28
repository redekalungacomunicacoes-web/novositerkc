import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Youtube } from "lucide-react";
import { buildPublicStorageUrl, getFooterSettings, normalizeWhatsappLink } from "@/lib/footerSettings";

type FooterData = {
  logoUrl: string;
  description: string;
  email: string;
  location: string;
  address: string;
  mapsUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
};

const FALLBACKS: FooterData = {
  logoUrl: "",
  description:
    "Mídia independente quilombola com atuação territorial na Chapada dos Veadeiros e no Território Kalunga, promovendo comunicação popular e jornalismo independente.",
  email: "contato@redekalunga.org.br",
  location: "Chapada dos Veadeiros, GO",
  address: "Território Kalunga",
  mapsUrl: "",
  instagramUrl: "",
  whatsappUrl: "",
  facebookUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
};

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [footerData, setFooterData] = useState<FooterData>(FALLBACKS);

  useEffect(() => {
    (async () => {
      try {
        const settings = await getFooterSettings();
        setFooterData({
          logoUrl: buildPublicStorageUrl(settings.footer_logo_path),
          description: settings.footer_description || FALLBACKS.description,
          email: settings.footer_email || FALLBACKS.email,
          location: settings.footer_location || FALLBACKS.location,
          address: settings.footer_address_short || FALLBACKS.address,
          mapsUrl: settings.footer_maps_url || "",
          instagramUrl: settings.footer_instagram_url || "",
          whatsappUrl: normalizeWhatsappLink(settings.footer_whatsapp),
          facebookUrl: settings.footer_facebook_url || "",
          linkedinUrl: settings.footer_linkedin_url || "",
          youtubeUrl: settings.footer_youtube_url || "",
        });
      } catch (e) {
        console.warn("Não foi possível carregar configurações do rodapé.", e);
      }
    })();
  }, []);

  const socialLinks = useMemo(
    () => [
      { href: footerData.instagramUrl, icon: Instagram, label: "Instagram" },
      { href: footerData.whatsappUrl, icon: MessageCircle, label: "WhatsApp" },
      { href: footerData.facebookUrl, icon: Facebook, label: "Facebook" },
      { href: footerData.linkedinUrl, icon: Linkedin, label: "LinkedIn" },
      { href: footerData.youtubeUrl, icon: Youtube, label: "YouTube" },
    ].filter((item) => Boolean(item.href)),
    [footerData]
  );

  return (
    <footer className="bg-[#2E2E2E] text-white">
      <div className="relative h-16 bg-[#0F7A3E]" style={{ clipPath: "ellipse(100% 100% at 50% 0%)" }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              {footerData.logoUrl ? (
                <img src={footerData.logoUrl} alt="Logo do rodapé" className="w-12 h-12 rounded-lg object-cover bg-white" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center">
                  <span className="text-white font-bold text-xl">RKC</span>
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg">Rede Kalunga Comunicações</h3>
                <p className="text-sm text-gray-300">Comunicação Popular e Território</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6 max-w-md line-clamp-2">{footerData.description}</p>

            <div className="flex gap-4 flex-wrap">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="w-10 h-10 rounded-full bg-gray-700 hover:bg-[#0F7A3E] flex items-center justify-center transition-colors"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4">Navegação</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-300 hover:text-[#F2B705] transition-colors">Home</Link></li>
              <li><Link to="/quem-somos" className="text-gray-300 hover:text-[#F2B705] transition-colors">Quem Somos</Link></li>
              <li><Link to="/projetos" className="text-gray-300 hover:text-[#F2B705] transition-colors">Projetos</Link></li>
              <li><Link to="/materias" className="text-gray-300 hover:text-[#F2B705] transition-colors">Matérias</Link></li>
              <li><Link to="/newsletter" className="text-gray-300 hover:text-[#F2B705] transition-colors">Newsletter</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4">Contato</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <MapPin className="w-5 h-5 flex-shrink-0 text-[#F2B705] mt-0.5" />
                {footerData.mapsUrl ? (
                  <a href={footerData.mapsUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                    {footerData.location}
                    {footerData.address ? <><br />{footerData.address}</> : null}
                  </a>
                ) : (
                  <span>
                    {footerData.location}
                    {footerData.address ? <><br />{footerData.address}</> : null}
                  </span>
                )}
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-5 h-5 flex-shrink-0 text-[#F2B705] mt-0.5" />
                <a href={`mailto:${footerData.email}`} className="hover:text-white transition-colors">{footerData.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm">© {currentYear} Rede Kalunga Comunicações. Todos os direitos reservados.</p>
          <p className="text-gray-500 text-xs mt-2">Comunicação popular, jornalismo independente e pertencimento territorial.</p>
        </div>
      </div>
    </footer>
  );
}
