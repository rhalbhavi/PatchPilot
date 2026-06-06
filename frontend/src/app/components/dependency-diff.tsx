import React, { useEffect, useState } from "react";
import { getDependencyDiff,type DependencyDiffResult } from "../lib/api";

export const DependencyDiff: React.FC = () => {
  const [data, setData] = useState<DependencyDiffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDependencyDiff()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6 border rounded-xl animate-pulse bg-gray-50 dark:bg-neutral-900/50 dark:border-neutral-800">
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-gray-200 dark:bg-neutral-800 rounded"></div>
          <div className="h-40 bg-gray-200 dark:bg-neutral-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl dark:bg-red-500/10 dark:text-red-400">
        Error loading diff: {error}
      </div>
    );
  }

  if (!data || (data.introduced.length === 0 && data.resolved.length === 0)) {
    return (
      <div className="p-6 text-center border rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:border-neutral-800">
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          No dependency vulnerability changes detected between the last two scans.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Introduced Threats (Red) */}
      <div className="flex flex-col h-full border border-red-200 rounded-xl overflow-hidden dark:border-red-500/20">
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 dark:bg-red-500/10 dark:border-red-500/20 sticky top-0 z-10">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">
            Introduced Vulnerabilities ({data.introduced.length})
          </h3>
        </div>
        <div className="divide-y divide-red-100 dark:divide-red-500/10 max-h-[400px] overflow-y-auto">
          {data.introduced.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center italic">None introduced.</div>
          ) : (
            data.introduced.map((finding) => (
              <div key={finding.id} className="p-4 bg-white dark:bg-black/20 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                    {finding.package_name || "Unknown Package"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 font-semibold tracking-wide">
                    {finding.rule_id}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{finding.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resolved Threats (Green with Strikethrough) */}
      <div className="flex flex-col h-full border border-emerald-200 rounded-xl overflow-hidden dark:border-emerald-500/20 opacity-80">
        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 sticky top-0 z-10">
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
            Resolved Vulnerabilities ({data.resolved.length})
          </h3>
        </div>
        <div className="divide-y divide-emerald-100 dark:divide-emerald-500/10 max-h-[400px] overflow-y-auto">
          {data.resolved.length === 0 ? (
             <div className="p-4 text-xs text-gray-500 text-center italic">None resolved.</div>
          ) : (
            data.resolved.map((finding) => (
              <div key={finding.id} className="p-4 bg-white dark:bg-black/20 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-medium text-gray-500 line-through decoration-emerald-500">
                    {finding.package_name || "Unknown Package"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold tracking-wide line-through decoration-emerald-500">
                    {finding.rule_id}
                  </span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2 line-through decoration-gray-400">
                  {finding.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};