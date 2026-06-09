import React, { useEffect, useState } from "react";
import { getLeaderboard, type ContributorStat } from "../lib/api";

export const Leaderboard: React.FC = () => {
  const [data, setData] = useState<ContributorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLeaderboard()
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
        <div className="h-8 w-48 bg-gray-200 dark:bg-neutral-800 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-neutral-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl dark:bg-red-500/10 dark:text-red-400">
        Failed to load leaderboard: {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-6 text-center border rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:border-neutral-800">
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          No contributor stats available yet. Start fixing vulnerabilities!
        </p>
      </div>
    );
  }

  // Calculate max score to scale the progress bars dynamically
  const maxScore = Math.max(...data.map((d) => d.total_score), 1);

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="text-2xl" title="1st Place">🥇</span>;
    if (index === 1) return <span className="text-2xl" title="2nd Place">🥈</span>;
    if (index === 2) return <span className="text-2xl" title="3rd Place">🥉</span>;
    return <span className="text-sm font-bold text-gray-400 dark:text-neutral-500 w-8 text-center inline-block">#{index + 1}</span>;
  };

  return (
    <div className="flex flex-col gap-4 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-black">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security Contributors</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
          Ranking based on fixes passed (3pts), PRs merged (2pts), and findings closed (1pt).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900/30">
              <th className="px-6 py-3 w-16 text-center">Rank</th>
              <th className="px-6 py-3">Contributor</th>
              <th className="px-6 py-3 text-center">Findings (1pt)</th>
              <th className="px-6 py-3 text-center">PRs (2pts)</th>
              <th className="px-6 py-3 text-center">Fixes (3pts)</th>
              <th className="px-6 py-3 w-48">Total Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/50">
            {data.map((contributor, index) => {
              const scorePercentage = Math.round((contributor.total_score / maxScore) * 100);

              return (
                <tr 
                  key={contributor.github_username} 
                  className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <td className="px-6 py-4 flex justify-center items-center h-full">
                    {getRankBadge(index)}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`https://github.com/${contributor.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 group w-fit"
                    >
                      <img
                        src={`https://github.com/${contributor.github_username}.png?size=64`}
                        alt={`${contributor.github_username}'s avatar`}
                        className="w-8 h-8 rounded-full border border-gray-200 dark:border-neutral-700 group-hover:ring-2 ring-blue-500 transition-all"
                      />
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {contributor.github_username}
                      </span>
                    </a>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {contributor.findings_closed}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      {contributor.prs_merged}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      {contributor.fixes_passed}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative h-8 flex items-center bg-gray-100 dark:bg-neutral-800 rounded-md overflow-hidden">
                      {/* Visual Progress Bar Background */}
                      <div
                        className="absolute top-0 left-0 h-full bg-blue-100 dark:bg-blue-900/30 border-r border-blue-200 dark:border-blue-800/50 transition-all duration-1000 ease-out"
                        style={{ width: `${scorePercentage}%` }}
                      ></div>
                      
                      {/* Score Number overlay */}
                      <span className="relative z-10 px-3 text-sm font-bold text-gray-900 dark:text-white">
                        {contributor.total_score} <span className="text-xs font-normal text-gray-500 dark:text-neutral-400">pts</span>
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};