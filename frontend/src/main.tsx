import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import "./index.css";

import { AuthProvider } from "./contexts/AuthContext";

import { Providers } from "./providers";

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <AuthProvider>
        <Providers>
          <div></div>
        </Providers>
      </AuthProvider>
    </StrictMode>
  );
}
