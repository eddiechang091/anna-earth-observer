import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { LanguageProvider } from "./i18n/LanguageContext.tsx";
import { getAnnaRuntime } from "./anna-runtime.ts";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

// Kick off Anna connection early so it is ready when the first tool.invoke fires.
void getAnnaRuntime();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh the page.</p>}>
    <LanguageProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </LanguageProvider>
  </Sentry.ErrorBoundary>
);
