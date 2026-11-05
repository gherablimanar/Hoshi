import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
document.documentElement.dataset.theme = "dark";
createRoot(document.getElementById("root")!).render(<App />);

import "./editor.css";
