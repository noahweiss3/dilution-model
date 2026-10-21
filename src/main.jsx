import React from "react";
import ReactDOM from "react-dom/client";
// This isolated design-study branch opens the gallery. The original model and
// its auth/persistence remain available at /model with separate styles.
async function boot() {
  let tree;
  if (window.location.pathname.startsWith("/model")) {
    document.title = "Dilution Model";
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href =
      "https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(fonts);
    const [{ default: App }, { ClerkProvider }] = await Promise.all([
      import("./App.jsx"),
      import("@clerk/clerk-react"),
      import("./index.css"),
    ]);
    const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    tree = key ? (
      <ClerkProvider publishableKey={key} afterSignOutUrl="/model">
        <App clerkConfigured />
      </ClerkProvider>
    ) : (
      <App clerkConfigured={false} />
    );
  } else {
    const { default: PrototypeApp } =
      await import("./prototypes/PrototypeApp.jsx");
    tree = <PrototypeApp />;
  }
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>{tree}</React.StrictMode>,
  );
}
boot();
