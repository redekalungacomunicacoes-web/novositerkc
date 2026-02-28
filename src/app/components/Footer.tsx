import { useEffect, useMemo, useState } from "react";
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
    () =>
      [
        { href: footerData.instagramUrl, icon: Instagram, label: "Instagram" },
        { href: footerData.whatsappUrl, icon: MessageCircle, label: "WhatsApp" },
        { href: footerData.facebookUrl, icon: Facebook, label: "Facebook" },
        { href: footerData.linkedinUrl, icon: Linkedin, label: "LinkedIn" },
        { href: footerData.youtubeUrl, icon: Youtube, label: "YouTube" },
      ].filter((item) => Boolean(item.href)),
    [footerData]
  );

  return (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3 md:items-center">
          <div className="flex justify-center md:justify-start">
            {footerData.logoUrl ? (
              <img
                src={footerData.logoUrl}
                alt="Logo do rodapé"
                className="h-auto max-h-16 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <div className="text-left">
                <p className="text-base font-semibold text-slate-800">Rede Kalunga Comunicações</p>
                <p className="text-sm text-slate-600">Comunicação Popular e Território</p>
              </div>
            )}
          </div>

          <div className="text-center md:text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-600 line-clamp-3 md:line-clamp-2">
              {footerData.description || FALLBACKS.description}
            </p>
          </div>

          <div className="space-y-3 text-center md:text-right">
            <div className="text-sm text-slate-700">
              <p className="mb-1 font-medium text-slate-800">Localização</p>
              {footerData.mapsUrl ? (
                <a
                  href={footerData.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-2 text-slate-700 hover:text-green-800"
                >
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
                  <span>
                    {footerData.location || FALLBACKS.location}
                    {footerData.address ? <><br />{footerData.address}</> : null}
                  </span>
                </a>
              ) : (
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
                  <span>
                    {footerData.location || FALLBACKS.location}
                    {footerData.address ? <><br />{footerData.address}</> : null}
                  </span>
                </span>
              )}
            </div>

            <div className="text-sm text-slate-700">
              <p className="mb-1 font-medium text-slate-800">E-mail</p>
              <a
                href={`mailto:${footerData.email || FALLBACKS.email}`}
                className="inline-flex items-center gap-2 text-green-700 hover:text-green-800"
              >
                <Mail className="h-4 w-4" />
                {footerData.email || FALLBACKS.email}
              </a>
            </div>

            <div className="text-sm text-slate-700">
              <p className="mb-1 font-medium text-slate-800">Redes sociais</p>
              {socialLinks.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 md:justify-end">
                  {socialLinks.map(({ href, icon: Icon, label }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      className="inline-flex items-center gap-2 text-green-700 hover:text-green-800"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Nenhuma rede social cadastrada.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 text-center">
          <p className="text-sm text-slate-500">© {currentYear} Rede Kalunga Comunicações. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
