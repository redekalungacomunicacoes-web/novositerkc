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

  const resolveLogoUrl = (footerLogoPath: string | null | undefined, footerLogoUrl?: string | null) => {
    if (footerLogoUrl && /^https?:\/\//i.test(footerLogoUrl)) return footerLogoUrl;
    if (footerLogoPath && /^https?:\/\//i.test(footerLogoPath)) return footerLogoPath;
    return buildPublicStorageUrl(footerLogoPath);
  };

  useEffect(() => {
    (async () => {
      try {
        const settings = await getFooterSettings();
        const settingsWithLogoUrl = settings as typeof settings & { footer_logo_url?: string | null };

        setFooterData({
          logoUrl: resolveLogoUrl(settings.footer_logo_path, settingsWithLogoUrl.footer_logo_url),
          description: settings.footer_description || FALLBACKS.description,
          email: settings.footer_email || FALLBACKS.email,
          location: settings.footer_location || FALLBACKS.location,
          address: "",
          mapsUrl: "",
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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 md:grid-cols-3 md:items-center">
          <div className="flex justify-center md:justify-start">
            {footerData.logoUrl ? (
              <img
                src={footerData.logoUrl}
                alt="Rede Kalunga Comunicações"
                className="h-auto max-h-16 w-auto object-contain"
              />
            ) : (
              <div className="text-left">
                <p className="text-base font-semibold text-slate-800">Rede Kalunga Comunicações</p>
                <p className="text-sm text-slate-600">Comunicação Popular e Território</p>
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-600">
              {footerData.description || FALLBACKS.description}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 text-sm text-slate-700 md:items-end">
            {(footerData.location || FALLBACKS.location) && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-700" />
                <span>{footerData.location || FALLBACKS.location}</span>
              </p>
            )}

            {(footerData.email || FALLBACKS.email) && (
              <a
                href={`mailto:${footerData.email || FALLBACKS.email}`}
                className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-green-700 transition hover:text-green-800"
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {footerData.email || FALLBACKS.email}
                </span>
              </a>
            )}

            {socialLinks.length > 0 ? (
              <div className="mt-1 flex items-center gap-4 text-green-700">
                  {socialLinks.map(({ href, icon: Icon, label }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      className="text-green-700 transition hover:text-green-800"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-slate-500">
          © {currentYear} Rede Kalunga Comunicações. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
