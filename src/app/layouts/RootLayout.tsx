import { Outlet } from "react-router-dom";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { ScrollToTop } from "@/app/components/ScrollToTop";
import { SiteFavicon } from "@/app/components/SiteFavicon";
import { GoogleAnalytics } from "@/app/components/GoogleAnalytics";
import { SiteViewTracker } from "@/app/components/SiteViewTracker";
import { SiteSeo } from "@/app/components/SiteSeo";

export function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <SiteFavicon />
      <SiteSeo />
      <GoogleAnalytics />
      <SiteViewTracker />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
