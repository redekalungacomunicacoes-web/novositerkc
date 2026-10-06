import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { installImageLoadingEnhancements } from "./lib/imageLoading";

createRoot(document.getElementById("root")!).render(<App />);

requestAnimationFrame(() => {
  installImageLoadingEnhancements();
});
