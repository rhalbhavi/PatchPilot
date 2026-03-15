import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { ProgressStepper } from "../components/progress-stepper";
import { StatusPill } from "../components/status-pill";
import { ToolBadge } from "../components/tool-badge";
import { scanTools } from "../data/sample-data";
import { cn } from "../components/ui/utils";
import { Link } from "react-router";

export function ScanProgress() {
  const [logExpanded, setLogExpanded] = useState(false);

  const steps = [
    { id: "upload", label: "Upload", status: "completed" as const },
    { id: "scan", label: "Scan", status: "current" as const },
    { id: "findings", label: "Findings", status: "upcoming" as const },
    { id: "fix", label: "Fix", status: "upcoming" as const },
    { id: "verify", label: "Verify", status: "upcoming" as const },
    { id: "evidence", label: "Evidence", status: "upcoming" as const },
  ];

  const sampleLogs = [
    "[14:23:05] Starting vulnerability scan for acme-corp/payment-api",
    "[14:23:05] Initializing Semgrep static analysis...",
    "[14:23:06] Semgrep: Scanning 234 files across 15 directories",
    "[14:23:12] Semgrep: Found 5 potential vulnerabilities",
    "[14:23:12] Starting OSV dependency scanner...",
    "[14:23:15] OSV: Analyzing package.json and package-lock.json",
    "[14:23:18] OSV: Checking 127 dependencies against vulnerability database",
    "[14:23:24] OSV: Found 2 known CVEs in dependencies",
    "[14:23:24] Preparing Gitleaks secret scanner...",
    "[14:23:25] Gitleaks: Scanning git history and current files",
  ];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl pb-20 md:pb-8">
      <div className="mb-8">
        <h1 className="mb-2">Scan in Progress</h1>
        <p className="text-muted-foreground">
          Running security analysis on acme-corp/payment-api
        </p>
      </div>

      {/* Job Metadata */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Job ID</div>
              <div className="font-mono text-sm">JOB-2024-03-15-001</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Repository</div>
              <div className="text-sm font-medium">acme-corp/payment-api</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Started</div>
              <div className="text-sm">Mar 15, 2024 at 2:23 PM</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Elapsed Time</div>
              <div className="text-sm font-medium">1m 28s</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Stepper */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <ProgressStepper steps={steps} />
        </CardContent>
      </Card>

      {/* Tool Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {scanTools.map((tool) => (
          <Card key={tool.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <ToolBadge tool={tool.name} />
                <StatusPill status={tool.status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tool.status === "running" && (
                  <>
                    <Progress value={65} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      Scanning files... 234 of 360
                    </div>
                  </>
                )}
                {tool.status === "completed" && (
                  <div className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Started:</span>
                      <span className="font-mono text-xs">{tool.startTime}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-mono text-xs">{tool.endTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Findings:</span>
                      <span className="font-medium">{tool.findingsCount}</span>
                    </div>
                  </div>
                )}
                {tool.status === "pending" && (
                  <div className="text-sm text-muted-foreground">
                    Waiting for previous scans to complete...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Logs</CardTitle>
              <CardDescription>Real-time scan output</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogExpanded(!logExpanded)}
            >
              {logExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Expand
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "rounded-lg bg-muted p-4 font-mono text-xs overflow-hidden transition-all",
              logExpanded ? "max-h-96" : "max-h-48"
            )}
          >
            <div className="overflow-y-auto h-full">
              {sampleLogs.map((log, index) => (
                <div key={index} className="py-0.5 text-foreground/90">
                  {log}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Copy Logs
            </Button>
            <Button variant="outline" size="sm">
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="text-sm text-muted-foreground">
          Scan will continue in background if you navigate away
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Scan
          </Button>
          <Link to="/findings">
            <Button size="sm">View Partial Results</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
