import { useState, useEffect } from "react";
import { Eye, Download, Loader2, Target } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ExtractionJob, ExtractionResult } from "@shared/schema";
import RealTimeBoundingBoxViewer from "./real-time-bounding-box-viewer";

interface ExtractionResultsProps {
  jobId: string;
  onRegionHighlight?: (regionId: string | null, regionType: string) => void;
  onShowBoundingBoxes?: (regionId?: string | null, regionType?: string) => void;
}

export default function ExtractionResults({ 
  jobId, 
  onRegionHighlight, 
  onShowBoundingBoxes 
}: ExtractionResultsProps) {
  const { toast } = useToast();
  const [activeFormat, setActiveFormat] = useState<'json' | 'csv' | 'markdown'>('json');

  const { data: jobData, isLoading } = useQuery({
    queryKey: ['/api/extraction', jobId],
    enabled: !!jobId,
    refetchInterval: (data) => {
      const jobResponse = data as { job?: ExtractionJob };
      return jobResponse?.job?.status === 'processing' || jobResponse?.job?.status === 'pending' ? 2000 : false;
    },
  });

  const job = (jobData as { job?: ExtractionJob })?.job;

  useEffect(() => {
    if (job?.status === 'completed') {
      toast({
        title: "Extraction completed",
        description: `Document processed with ${job.confidence}% confidence`,
      });
    } else if (job?.status === 'failed') {
      toast({
        title: "Extraction failed",
        description: job.error || "An error occurred during processing",
        variant: "destructive",
      });
    }
  }, [job?.status, job?.confidence, job?.error, toast]);

  const handleDownload = async (format?: string) => {
    if (!job?.id) return;

    try {
      const blob = await api.downloadResult(job.id, format || activeFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `extraction_result.${format || activeFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `File downloaded in ${format || activeFormat} format`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const renderCompletedResults = (result: unknown): JSX.Element => {
    if (!result || typeof result !== 'object') {
      return <div className="text-center py-8 text-muted-foreground">Invalid extraction result format</div>;
    }
    
    const extractionResult = result as ExtractionResult;
    
    return (
      <div>
        {/* Format Tabs */}
        <Tabs value={activeFormat} onValueChange={(value) => setActiveFormat(value as any)} data-testid="tabs-format">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="json" data-testid="tab-json">JSON</TabsTrigger>
            <TabsTrigger value="csv" data-testid="tab-csv">CSV</TabsTrigger>
            <TabsTrigger value="markdown" data-testid="tab-markdown">Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="mt-4">
            <div className="bg-muted rounded-md p-4 min-h-[300px] max-h-[500px] overflow-auto" data-testid="preview-json">
              {renderPreview(extractionResult)}
            </div>
          </TabsContent>

          <TabsContent value="csv" className="mt-4">
            <div className="bg-muted rounded-md p-4 min-h-[300px] max-h-[500px] overflow-auto" data-testid="preview-csv">
              {renderPreview(extractionResult)}
            </div>
          </TabsContent>

          <TabsContent value="markdown" className="mt-4">
            <div className="bg-muted rounded-md p-4 min-h-[300px] max-h-[500px] overflow-auto" data-testid="preview-markdown">
              {renderPreview(extractionResult)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Download Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground" data-testid="text-extraction-stats">
            {(() => {
              const parts = [];
              if (extractionResult?.objects && extractionResult.objects.length > 0) {
                parts.push(`${extractionResult.objects.length} object(s) detected`);
              }
              if (extractionResult?.tables && extractionResult.tables.length > 0) {
                parts.push(`${extractionResult.tables.length} table(s) extracted`);
              }
              if (parts.length === 0) {
                parts.push('Content extracted');
              }
              return parts.join(' • ');
            })()}  • {job?.confidence || 75}% confidence
          </div>
          <div className="flex items-center space-x-3">
            {job?.documentId && (
              <Link href={`/preview/${job.documentId}`}>
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid="button-preview"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </Link>
            )}
            <Button 
              size="sm"
              onClick={() => handleDownload()}
              data-testid="button-download"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderPreview = (result: ExtractionResult): React.ReactNode => {
    switch (activeFormat) {
      case 'json':
        return (
          <pre className="text-foreground whitespace-pre-wrap text-sm font-mono">
            {JSON.stringify(result, null, 2)}
          </pre>
        );
      case 'csv':
        return (
          <div className="text-foreground text-sm font-mono">
            <p className="text-muted-foreground mb-2">CSV Preview (first few rows):</p>
            {/* Objects from smart_image mode */}
            {result.objects && result.objects.length > 0 && (
              <div className="space-y-4 mb-6">
                <h4 className="font-semibold">## Detected Objects</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-border">
                    <thead>
                      <tr>
                        <th className="border border-border px-2 py-1 bg-muted text-left">Label</th>
                        <th className="border border-border px-2 py-1 bg-muted text-left">Confidence</th>
                        <th className="border border-border px-2 py-1 bg-muted text-left">Category</th>
                        <th className="border border-border px-2 py-1 bg-muted text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.objects.slice(0, 10).map((obj, objIndex) => (
                        <tr key={objIndex}>
                          <td className="border border-border px-2 py-1">{obj.label}</td>
                          <td className="border border-border px-2 py-1">{Math.round(obj.confidence * 100)}%</td>
                          <td className="border border-border px-2 py-1">{obj.category || 'N/A'}</td>
                          <td className="border border-border px-2 py-1">{obj.description || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Tables from other modes */}
            {result.tables && result.tables.length > 0 && (
              <div className="space-y-4">
                {result.tables.map((table, index) => (
                  <div key={index}>
                    {table.title && <p className="font-semibold"># {table.title}</p>}
                    {table.data && table.data.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-border">
                          <thead>
                            <tr>
                              {Object.keys(table.data[0] as Record<string, any>).map((header: string) => (
                                <th key={header} className="border border-border px-2 py-1 bg-muted text-left">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.data.slice(0, 5).map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {Object.values(row as Record<string, any>).map((cell: any, cellIndex: number) => (
                                  <td key={cellIndex} className="border border-border px-2 py-1">
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'markdown':
        return (
          <div className="text-foreground text-sm">
            <p className="text-muted-foreground mb-2">Markdown Preview:</p>
            <div className="space-y-4">
              {/* Objects from smart_image mode */}
              {result.objects && result.objects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">## Detected Objects</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.objects.map((obj, objIndex) => (
                      <div 
                        key={objIndex} 
                        className="border border-border rounded-md p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group" 
                        data-testid={`object-${objIndex}`}
                        onClick={() => {
                          const regionId = `object-${objIndex}`;
                          const regionType = 'object';
                          if (onRegionHighlight) {
                            onRegionHighlight(regionId, regionType);
                          }
                          if (onShowBoundingBoxes) {
                            onShowBoundingBoxes(regionId, regionType);
                          }
                          toast({
                            title: "Region highlighted",
                            description: `Showing location of "${obj.label}" in document`,
                          });
                        }}
                        title="Click to highlight this object in the document"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground group-hover:text-blue-600">{obj.label}</span>
                          <span className="text-sm text-muted-foreground">{Math.round(obj.confidence * 100)}%</span>
                        </div>
                        {obj.category && (
                          <div className="text-xs text-muted-foreground mb-1">
                            Category: {obj.category}
                          </div>
                        )}
                        {obj.description && (
                          <div className="text-sm text-muted-foreground">
                            {obj.description}
                          </div>
                        )}
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Click to locate in document
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Tables from other modes */}
              {result.tables && result.tables.map((table, index) => (
                <div key={index} className="group">
                  <div 
                    className="cursor-pointer hover:bg-muted/30 p-2 rounded transition-colors"
                    onClick={() => {
                      const regionId = `table-${index}`;
                      const regionType = 'table';
                      if (onRegionHighlight) {
                        onRegionHighlight(regionId, regionType);
                      }
                      if (onShowBoundingBoxes) {
                        onShowBoundingBoxes(regionId, regionType);
                      }
                      toast({
                        title: "Table highlighted",
                        description: `Showing location of "${table.title || `Table ${index + 1}`}" in document`,
                      });
                    }}
                    title="Click to highlight this table in the document"
                  >
                    {table.title && (
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg group-hover:text-blue-600">## {table.title}</h3>
                        <Target className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    {table.confidence && (
                      <p className="text-sm text-muted-foreground italic">
                        *Confidence: {Math.round(table.confidence * 100)}%*
                      </p>
                    )}
                  </div>
                  {table.data && table.data.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-border">
                        <thead>
                          <tr>
                            {Object.keys(table.data[0]).map(header => (
                              <th key={header} className="border border-border px-2 py-1 bg-muted text-left">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.data.slice(0, 3).map((row, rowIndex) => (
                            <tr 
                              key={rowIndex}
                              className="hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer transition-colors"
                              onClick={() => {
                                const regionId = `table-${index}-row-${rowIndex}`;
                                const regionType = 'table';
                                if (onRegionHighlight) {
                                  onRegionHighlight(regionId, regionType);
                                }
                                if (onShowBoundingBoxes) {
                                  onShowBoundingBoxes(regionId, regionType);
                                }
                                toast({
                                  title: "Table row highlighted",
                                  description: `Showing location in document`,
                                });
                              }}
                              title="Click to highlight this table row in the document"
                            >
                              {Object.values(row).map((cell, cellIndex) => (
                                <td key={cellIndex} className="border border-border px-2 py-1">
                                  {String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <p>No preview available</p>;
    }
  };

  if (!jobId) {
    return (
      <Card data-testid="card-extraction-results-empty">
        <CardHeader>
          <CardTitle>Extraction Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Start an extraction to see results here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card data-testid="card-extraction-results-loading">
        <CardHeader>
          <CardTitle>Extraction Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-extraction-results">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Extraction Results</CardTitle>
          {job && (
            <div className="flex items-center space-x-2">
              {job.status === 'processing' && (
                <>
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                  <span className="text-accent font-medium text-sm">Processing...</span>
                </>
              )}
              {job.status === 'completed' && (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 font-medium text-sm">Completed</span>
                </>
              )}
              {job.status === 'failed' && (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-600 font-medium text-sm">Failed</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {job && (job.status === 'processing' || job.status === 'pending') && (
          <div className="space-y-6" data-testid="processing-status">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Analysis Progress</span>
                <span className="text-foreground font-medium">{job.progress || 0}%</span>
              </div>
              <Progress value={job.progress || 0} className="w-full" />
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span>
                  {job.progress === 0 && "Initializing extraction..."}
                  {job.progress && job.progress < 30 && "Uploading and validating document..."}
                  {job.progress && job.progress < 60 && "Analyzing document structure..."}
                  {job.progress && job.progress < 90 && "Extracting data with AI..."}
                  {job.progress && job.progress >= 90 && "Finalizing results..."}
                </span>
              </div>
            </div>
            
            {/* Real-time Bounding Box Visualization */}
            {job.documentId && (
              <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                <RealTimeBoundingBoxViewer 
                  job={job}
                  documentUrl={`/api/documents/${job.documentId}/file`}
                  data-testid="real-time-bbox-viewer"
                />
              </div>
            )}
          </div>
        )}

        {job?.status === 'completed' && job.result && job.result !== null ? renderCompletedResults(job.result) : null}

        {job?.status === 'failed' && (
          <div className="text-center py-8 text-red-600" data-testid="error-message">
            <p>Extraction failed: {job.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
