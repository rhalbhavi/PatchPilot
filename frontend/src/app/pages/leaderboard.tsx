import { Leaderboard as LeaderboardComponent } from "../components/leaderboard";

export function Leaderboard() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl pb-20 md:pb-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top security contributors across all projects.
        </p>
      </div>
      <LeaderboardComponent />
    </div>
  );
}