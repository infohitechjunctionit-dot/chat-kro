"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeContent: "center",
            justifyItems: "start",
            gap: "12px",
            padding: "24px"
          }}
        >
          <h1 style={{ margin: 0, fontSize: "22px" }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            The page could not be loaded. Try again, or return to the dashboard.
          </p>
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: "6px",
                background: "#2564e5",
                color: "white",
                padding: "10px 14px",
                cursor: "pointer"
              }}
            >
              Try again
            </button>
            <a href="/dashboard" style={{ alignSelf: "center", color: "#2564e5" }}>
              Go to dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
