import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DeckPage } from "./DeckPage";
import "./page.css";

// The deck page's entry: index.html loads this and nothing else.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeckPage />
  </StrictMode>,
);
