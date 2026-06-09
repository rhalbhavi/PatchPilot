import type { BackendFinding } from "./api";
import type { Finding } from "../data/sample-data";

function mapSeverity(sev: BackendFinding["severity"]): Finding["severity"] {
  switch (sev) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    case "INFO":
    default:
      return "info";
  }
}

export function mapBackendFindingToUi(f: BackendFinding): Finding {
  return {
    id: f.id,
    severity: mapSeverity(f.severity),
    category: f.category,
    title: f.title,

    file: f.location?.path ?? "Unknown file",
    lineNumber: f.location?.start_line ?? 0,
    tool: (f.metadata?.engine as Finding["tool"]) ?? "semgrep",
    
    confidence: f.confidence ?? 100,
    status: "open",
    description: f.description ?? "",
    code: f.code ?? "",
    suggestedFix: f.suggested_fix,
    references: f.references ?? [],
  };
}
