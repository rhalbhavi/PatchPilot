import type { BackendFinding, ScanResponse } from "./api";

const KEY = "patchpilot:lastScan";

// Define a type for the data that is actually stored, which excludes findings.
type StoredScan = Omit<ScanResponse, "findings"> & {
  finding_count: number;
};

export function saveLastScan(scan: ScanResponse) {
  const { findings, ...lightweightScan } = scan;
  const storageData: StoredScan = {
    ...lightweightScan,
    finding_count: findings?.length || 0,
  };

  localStorage.setItem(KEY, JSON.stringify(storageData));
}

export function loadLastScan(): StoredScan | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredScan;
  } catch {
    return null;
  }
}