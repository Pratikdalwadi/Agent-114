import { useState } from "react";
import { FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DocumentUpload from "@/components/document-upload";
import ExtractionSettings from "@/components/extraction-settings";
import ExtractionResults from "@/components/extraction-results";
import ProcessingHistory from "@/components/processing-history";
import { ExtractionSettings as ExtractionSettingsType } from "@/types/api";
import { ExtractionJob } from "@shared/schema";

export default function Home() {
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini'>('gemini');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [activeJobId, setActiveJobId] = useState<string>('');
  const [, setLocation] = useLocation();

  // Fetch job data to get documentId for navigation
  const { data: jobData } = useQuery({
    queryKey: ['/api/extraction', activeJobId],
    enabled: !!activeJobId,
  });

  const job = (jobData as { job?: ExtractionJob })?.job;

  const defaultSettings: ExtractionSettingsType = {
    aiProvider,
    extractionMode: 'smart_table',
    outputFormat: 'json',
    preserveFormatting: true,
    includeConfidence: false,
  };

  const handleExtractionStart = (jobId: string) => {
    setActiveJobId(jobId);
  };

  // Callback for region highlighting - navigates to preview page with region parameters
  const handleRegionHighlight = (regionId: string | null, regionType: string) => {
    if (!job?.documentId || !activeJobId) return;
    
    const params = new URLSearchParams({
      jobId: activeJobId,
      tab: 'extract',
    });
    
    if (regionId) {
      params.set('regionId', regionId);
      params.set('regionType', regionType);
    }
    
    setLocation(`/preview/${job.documentId}?${params.toString()}`);
  };

  // Callback for showing bounding boxes - navigates to preview page with bounding box visualization
  const handleShowBoundingBoxes = (regionId?: string | null, regionType?: string) => {
    if (!job?.documentId || !activeJobId) return;
    
    const params = new URLSearchParams({
      jobId: activeJobId,
      tab: 'extract',
    });
    
    // Preserve region parameters if provided
    if (regionId) {
      params.set('regionId', regionId);
      if (regionType) {
        params.set('regionType', regionType);
      }
    }
    
    setLocation(`/preview/${job.documentId}?${params.toString()}`);
  };

  return (
    <div className="bg-background text-foreground min-h-screen" data-testid="home-page">
      {/* Header */}
      <header className="bg-card border-b border-border" data-testid="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">DataExtract Pro</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Document Processing</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-muted-foreground">AI Provider:</span>
                <Select value={aiProvider} onValueChange={(value: 'openai' | 'gemini') => setAiProvider(value)} data-testid="select-ai-provider">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI GPT-5</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLocation('/pdf-viewer')}
                data-testid="button-pdf-viewer"
              >
                Enhanced PDF Viewer
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-settings">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <DocumentUpload 
              onDocumentSelect={setSelectedDocumentId}
              data-testid="document-upload-section"
            />
            <ExtractionSettings
              settings={{...defaultSettings, aiProvider}}
              documentId={selectedDocumentId}
              onExtractionStart={handleExtractionStart}
              data-testid="extraction-settings-section"
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <ExtractionResults 
              jobId={activeJobId}
              onRegionHighlight={handleRegionHighlight}
              onShowBoundingBoxes={handleShowBoundingBoxes}
              data-testid="extraction-results-section"
            />
            <ProcessingHistory 
              onJobSelect={setActiveJobId}
              data-testid="processing-history-section"
            />
          </div>
        </div>

        {/* Features Highlight */}
        <div className="mt-12 bg-card rounded-lg border border-border p-8" data-testid="features-section">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Enhanced AI-Powered Extraction</h2>
            <p className="text-muted-foreground">Advanced document processing with intelligent structure preservation</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Smart Table Detection</h3>
              <p className="text-sm text-muted-foreground">AI-powered OCR analysis preserves complex table structures and formatting with 95%+ accuracy</p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground">Multi-Format Export</h3>
              <p className="text-sm text-muted-foreground">Export extracted data in JSON, CSV, and Markdown formats with customizable options</p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground">AI-Guided Processing</h3>
              <p className="text-sm text-muted-foreground">Advanced AI models analyze document context to maintain data integrity and relationships</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
