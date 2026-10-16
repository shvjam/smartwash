
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { guardDomAgainstExtensions } from "./app/lib/domGuard";
  import "./styles/index.css";

  guardDomAgainstExtensions();
  createRoot(document.getElementById("root")!).render(<App />);
