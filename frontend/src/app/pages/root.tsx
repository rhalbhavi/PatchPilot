import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "../lib/api";
import { AppSidebar, AppTopBar } from "../components/app-sidebar";

export function Root() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(console.error);
  }, []);
  const unavailableScanners =
    health?.scanners
      ? Object.entries(health.scanners)
          .filter(([, available]) => !available)
          .map(([name]) => name)
      : [];

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <AppTopBar onMenuClick={() => setMobileSidebarOpen(true)} />
      {health?.status === "degraded" && (
        <div className="border-b border-yellow-300 bg-yellow-100 px-4 py-3 text-yellow-900 md:ml-20">
          <p className="font-semibold">
            ⚠ Action Required: Install Security Scanners
          </p>
          <p className="mt-1">
            PatchPilot is running in degraded mode because it cannot find the
            required command-line security tools. Scan results will be
            incomplete until they are installed. Please refer to the{" "}
            <a
              href="https://github.com/ionfwsrijan/PatchPilot/blob/main/README.md#prerequisites"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              README.md
            </a>{" "}
            for setup instructions.
          </p>
          {unavailableScanners.length > 0 && (
            <p className="mt-1">
              <strong>Unavailable scanners:</strong>{" "}
              <code>{unavailableScanners.join(", ")}</code>
            </p>
          )}
        </div>
      )}
      <main className="min-h-[calc(100vh-4rem)] md:ml-20">
        <Outlet />
      </main>
    </div>
  );
}
