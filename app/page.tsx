"use client";

import { CSVUpload } from "@/components/CSVUpload";
import { FieldMapper } from "@/components/FieldMapper";
import { FileUpload } from "@/components/FileUpload";
import { ResultsTable } from "@/components/ResultsTable";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DryRunResult,
  FieldMapping,
  ProcessingResult,
  ProcessingSettings,
} from "@/lib/types";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "sandbox"
  );

  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(
    {} as FieldMapping
  );
  const [settings, setSettings] = useState<ProcessingSettings>({
    autoCreate: true,
    alsoAttachToInvoice: false,
    fromBillableExpenses: true,
    defaultCurrency: "USD",
    strictDateParsing: false,
    environment: "sandbox",
  });

  const [step, setStep] = useState<"upload" | "map" | "preview" | "results">(
    "upload"
  );
  const [processing, setProcessing] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<DryRunResult[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setConnected(data.connected);
      if (data.environment) {
        setEnvironment(data.environment);
        setSettings((prev) => ({ ...prev, environment: data.environment }));
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/auth/connect");
      const data = await res.json();
      window.location.href = data.authUri;
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      setConnected(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const handleCSVLoaded = (data: any[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
  };

  const handleNext = () => {
    if (step === "upload" && csvData.length > 0) {
      setStep("map");
    } else if (step === "map") {
      runDryRun();
    }
  };

  const runDryRun = async () => {
    setProcessing(true);
    try {
      // Map CSV data to required format
      const mappedRows = csvData.map((row) => {
        const mapped: any = {};
        Object.keys(fieldMapping).forEach((key) => {
          const csvColumn = fieldMapping[key as keyof FieldMapping];
          mapped[key] = row[csvColumn] || "";
        });
        return mapped;
      });

      const res = await fetch("/api/process/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mappedRows, settings }),
      });

      const data = await res.json();
      setDryRunResults(data.results);
      setStep("preview");
    } catch (error) {
      console.error("Dry-run failed:", error);
      alert("Failed to run preview. Please check your data and try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleExecute = async () => {
    setProcessing(true);
    setProgress({ current: 0, total: csvData.length });

    try {
      // Map CSV data
      const mappedRows = csvData.map((row) => {
        const mapped: any = {};
        Object.keys(fieldMapping).forEach((key) => {
          const csvColumn = fieldMapping[key as keyof FieldMapping];
          mapped[key] = row[csvColumn] || "";
        });
        return mapped;
      });

      // Prepare form data with files
      const formData = new FormData();
      formData.append("rows", JSON.stringify(mappedRows));
      formData.append("settings", JSON.stringify(settings));

      attachments.forEach((file) => {
        formData.append(`file_${file.name}`, file);
      });

      const res = await fetch("/api/process/execute", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResults(data.results);
      setStep("results");
    } catch (error) {
      console.error("Processing failed:", error);
      alert("Processing failed. Please check the console for details.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Image
                src="/logo.png"
                alt="Logo"
                width={360}
                height={120}
                className="mx-auto mb-8"
              />
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                QuickBooks CSV Uploader
              </h1>
              <p className="text-lg text-gray-600">
                Import CSV data and attachments to create Projects, Bills, and
                Invoices in QuickBooks Online
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Connect to QuickBooks</CardTitle>
                <CardDescription>
                  Connect your QuickBooks Online account to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleConnect} size="lg" className="w-full">
                  Connect to QuickBooks
                </Button>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  You'll be redirected to QuickBooks to authorize access
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="Logo" width={180} height={60} />
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">
                  Connected to{" "}
                  <span className="font-medium">{environment}</span>
                </span>
              </div>
            </div>
            <Button variant="outline" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {["Upload", "Map Fields", "Preview", "Results"].map(
                (label, index) => {
                  const stepKeys = ["upload", "map", "preview", "results"];
                  const currentIndex = stepKeys.indexOf(step);
                  const isActive = index === currentIndex;
                  const isComplete = index < currentIndex;

                  return (
                    <div key={label} className="flex items-center flex-1">
                      <div className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            isComplete
                              ? "bg-green-600 text-white"
                              : isActive
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {isComplete ? "✓" : index + 1}
                        </div>
                        <span
                          className={`ml-2 text-sm font-medium ${
                            isActive ? "text-blue-600" : "text-gray-600"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {index < 3 && (
                        <div
                          className={`flex-1 h-1 mx-4 ${
                            isComplete ? "bg-green-600" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Step Content */}
          {step === "upload" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload CSV File</CardTitle>
                    <CardDescription>
                      Upload your CSV file containing the data to import
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CSVUpload onDataLoaded={handleCSVLoaded} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Upload Attachments</CardTitle>
                    <CardDescription>
                      Upload files to attach to bills and invoices
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileUpload onFilesChange={setAttachments} />
                  </CardContent>
                </Card>
              </div>

              <div>
                <SettingsPanel onSettingsChange={setSettings} />
              </div>
            </div>
          )}

          {step === "map" && (
            <Card>
              <CardHeader>
                <CardTitle>Map CSV Columns</CardTitle>
                <CardDescription>
                  Map your CSV columns to the required QuickBooks fields
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldMapper
                  csvHeaders={csvHeaders}
                  onMappingChange={setFieldMapping}
                />
              </CardContent>
            </Card>
          )}

          {step === "preview" && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Actions</CardTitle>
                <CardDescription>
                  Review what will happen when you process this data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dryRunResults.map((result) => (
                    <div
                      key={result.rowIndex}
                      className="border rounded-lg p-4"
                    >
                      <h4 className="font-medium mb-2">
                        Row {result.rowIndex + 1}
                      </h4>
                      {result.errors.length > 0 && (
                        <div className="mb-2">
                          {result.errors.map((error, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-red-600 text-sm"
                            >
                              <AlertCircle className="w-4 h-4" />
                              {error}
                            </div>
                          ))}
                        </div>
                      )}
                      {result.actions.length > 0 && (
                        <ul className="space-y-1">
                          {result.actions.map((action, i) => (
                            <li
                              key={i}
                              className="text-sm text-gray-600 flex items-start gap-2"
                            >
                              <span className="text-blue-600 mt-1">→</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {step === "results" && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Results</CardTitle>
                <CardDescription>
                  View the results of your data import
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResultsTable results={results} />
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const steps = ["upload", "map", "preview", "results"];
                const currentIndex = steps.indexOf(step);
                if (currentIndex > 0) {
                  setStep(steps[currentIndex - 1] as any);
                }
              }}
              disabled={step === "upload" || processing}
            >
              Back
            </Button>

            {step !== "results" && (
              <Button
                onClick={step === "preview" ? handleExecute : handleNext}
                disabled={
                  processing ||
                  (step === "upload" && csvData.length === 0) ||
                  (step === "map" && !Object.keys(fieldMapping).length)
                }
              >
                {processing && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {step === "preview" ? "Execute" : "Next"}
              </Button>
            )}

            {step === "results" && (
              <Button
                onClick={() => {
                  setStep("upload");
                  setCsvData([]);
                  setResults([]);
                }}
              >
                Start New Import
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
