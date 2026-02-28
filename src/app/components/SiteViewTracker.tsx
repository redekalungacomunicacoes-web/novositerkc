import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

export function SiteViewTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    trackPageView({ pageType: "site", path });
  }, [location.pathname, location.search]);

  return null;
}
