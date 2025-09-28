import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Sparkles, Target, Brain, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PDFProcessor, { PageData } from './PDFProcessor';
import EnhancedPDFProcessor from './EnhancedPDFProcessor';
import DocumentViewer from './DocumentViewer';
import TextSearch from './TextSearch';
import TextChunkHighlighter from './TextChunkHighlighter';
import PerfectExtractionDashboard from './PerfectExtractionDashboard';
import { ExtractionResult, TextChunk, Grounding, transformLegacyToGrounding, LegacyPageData } from '@/types';

const PDFViewer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [selectedChunk, setSelectedChunk] = useState<string>('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [textChunks, setTextChunks] = useState<TextChunk[]>([]);
  const [highlightedGrounding, setHighlightedGrounding] = useState<Grounding | null>(null);
  const [activeView, setActiveView] = useState<'document' | 'analytics' | 'chunks'>('document');
  const [documentDimensions, setDocumentDimensions] = useState({ width: 0, height: 0 });
  const { toast } = useToast();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setPages([]);
      setCurrentPage(1);
      setSelectedChunk('');
      setError('');
      setIsProcessing(true);
      setProgress(0);
      setExtractionResult(null);
      setTextChunks([]);
      setHighlightedGrounding(null);
      
      toast({
        title: "Processing PDF",
        description: advancedMode ? "Performing advanced AI extraction..." : "Extracting text and generating images...",
      });
    } else {
      setError('Please select a valid PDF file.');
      toast({
        title: "Invalid File",
        description: "Please select a valid PDF file.",
        variant: "destructive",
      });
    }
  }, [toast, advancedMode]);

  const handleProcessingComplete = useCallback((processedPages: PageData[]) => {
    setPages(processedPages);
    setIsProcessing(false);
    setCurrentPage(1);
    
    const totalChunks = processedPages.reduce((sum, page) => sum + page.textChunks.length, 0);
    
    // Set document dimensions from first page
    if (processedPages.length > 0) {
      const firstPage = processedPages[0];
      if (firstPage.imageUrl) {
        const img = new Image();
        img.onload = () => {
          setDocumentDimensions({ width: img.width, height: img.height });
        };
        img.src = firstPage.imageUrl;
      }
    }
    
    toast({
      title: "Processing Complete",
      description: `Successfully processed ${processedPages.length} pages with ${totalChunks} text regions.`,
    });
  }, [toast]);

  const handleEnhancedProcessingComplete = useCallback((processedPages: LegacyPageData[], result: ExtractionResult) => {
    setPages(processedPages);
    setExtractionResult(result);
    setTextChunks(result.chunks || []);
    setIsProcessing(false);
    setCurrentPage(1);
    
    // Set document dimensions from intermediate representation or first page
    if (result.intermediate_representation?.pages?.[0]) {
      const firstIRPage = result.intermediate_representation.pages[0];
      setDocumentDimensions({ width: firstIRPage.width, height: firstIRPage.height });
    } else if (processedPages.length > 0) {
      const firstPage = processedPages[0];
      if (firstPage.imageUrl) {
        const img = new Image();
        img.onload = () => {
          setDocumentDimensions({ width: img.width, height: img.height });
        };
        img.src = firstPage.imageUrl;
      }
    }
    
    const totalElements = (result.chunks?.length || 0) + 
                         (result.intermediate_representation?.pages?.[0]?.blocks?.length || 0);
    
    toast({
      title: "Advanced Processing Complete",
      description: `Successfully extracted ${totalElements} elements with AI-powered analysis.`,
    });
  }, [toast]);

  const handleProgressUpdate = useCallback((newProgress: number) => {
    setProgress(newProgress);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsProcessing(false);
    setProgress(0);
    
    toast({
      title: "Processing Error",
      description: errorMessage,
      variant: "destructive",
    });
  }, [toast]);

  const handleChunkClick = useCallback((chunkId: string) => {
    setSelectedChunk(selectedChunk === chunkId ? '' : chunkId);
  }, [selectedChunk]);

  const handleChunkSelect = useCallback((chunkId: string) => {
    if (chunkId) {
      // Find the page containing this chunk
      const targetPage = pages.find(page => 
        page.textChunks.some(chunk => chunk.id === chunkId)
      );
      
      if (targetPage && targetPage.pageNumber !== currentPage) {
        setCurrentPage(targetPage.pageNumber);
      }
    }
    
    setSelectedChunk(chunkId);
  }, [pages, currentPage]);

  // Advanced feature handlers
  const handleTextChunkHighlight = useCallback((chunkId: string | null, grounding?: Grounding) => {
    console.log('🎯 PDFViewer: Text chunk highlight triggered', {
      chunkId,
      grounding,
      currentPage,
      hasGrounding: !!grounding
    });
    setSelectedChunk(chunkId || '');
    setHighlightedGrounding(grounding || null);
  }, []);

  const handleTextChunkClick = useCallback((chunk: TextChunk) => {
    console.log('🖱️ PDFViewer: Text chunk click triggered', {
      chunkId: chunk.chunk_id,
      text: chunk.text.substring(0, 30) + '...',
      grounding: chunk.grounding?.[0],
      currentPage
    });
    setSelectedChunk(chunk.chunk_id);
    if (chunk.grounding && chunk.grounding.length > 0) {
      const targetPage = chunk.grounding[0].page + 1; // Convert to 1-based
      if (targetPage !== currentPage) {
        console.log(`📄 Switching to page ${targetPage} from ${currentPage}`);
        setCurrentPage(targetPage);
      }
      // Set the grounding for highlighting
      setHighlightedGrounding(chunk.grounding[0]);
    }
  }, [currentPage]);

  const resetViewer = () => {
    setFile(null);
    setPages([]);
    setCurrentPage(1);
    setSelectedChunk('');
    setError('');
    setIsProcessing(false);
    setProgress(0);
    setExtractionResult(null);
    setTextChunks([]);
    setHighlightedGrounding(null);
    setActiveView('document');
  };

  return (
    <div className="min-h-screen bg-viewer-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-pdf-primary" />
            <h1 className="text-3xl font-bold text-foreground">PDF Text Extractor</h1>
            {advancedMode && <Sparkles className="w-6 h-6 text-pdf-accent" />}
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {advancedMode 
              ? "AI-powered document analysis with text chunk grounding and semantic understanding"
              : "Upload a PDF document to extract and search through all text content with interactive highlighting"
            }
          </p>
          
          {/* Advanced Mode Toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Label htmlFor="advanced-mode" className="text-sm font-medium">
              Basic Mode
            </Label>
            <Switch
              id="advanced-mode"
              checked={advancedMode}
              onCheckedChange={setAdvancedMode}
              disabled={isProcessing}
              data-testid="switch-advanced-mode"
            />
            <Label htmlFor="advanced-mode" className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Advanced AI Mode
            </Label>
          </div>
          
          {advancedMode && (
            <div className="mt-4 p-3 bg-pdf-accent/10 border border-pdf-accent/20 rounded-lg max-w-3xl mx-auto">
              <p className="text-sm text-pdf-accent font-medium">
                🚀 Advanced Mode Features:
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Text chunk grounding • Semantic analysis • Perfect extraction dashboard • Visual bounding boxes
              </p>
            </div>
          )}
        </div>

        {/* File Upload */}
        {!file && (
          <Card className="max-w-2xl mx-auto p-8 bg-viewer-surface border-viewer-border border-2 border-dashed">
            <div className="text-center">
              <Upload className="w-16 h-16 mx-auto mb-6 text-pdf-primary" />
              <h3 className="text-xl font-semibold mb-4">Upload PDF Document</h3>
              <p className="text-muted-foreground mb-6">
                Select a PDF file to extract text and generate interactive previews
              </p>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                <Button 
                  size="lg" 
                  className="bg-pdf-primary hover:bg-pdf-primary/90 text-pdf-primary-foreground"
                  disabled={isProcessing}
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Choose PDF File
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mt-4">
                Supports multi-page PDFs with text content
              </p>
            </div>
          </Card>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <Card className="max-w-2xl mx-auto p-6 bg-viewer-surface border-viewer-border">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 relative">
                <div className="w-12 h-12 border-4 border-pdf-primary/20 border-t-pdf-primary rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Processing PDF...</h3>
              <p className="text-muted-foreground mb-4">
                Extracting text from all pages and generating interactive previews
              </p>
              
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {progress < 10 && "Loading document..."}
                  {progress >= 10 && progress < 30 && "Processing pages..."}
                  {progress >= 30 && progress < 70 && "Extracting text content..."}
                  {progress >= 70 && progress < 90 && "Applying OCR for better accuracy..."}
                  {progress >= 90 && "Finalizing text regions..."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert className="max-w-2xl mx-auto mb-6 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        {pages.length > 0 && (
          <div className="space-y-6">
            {/* Success Status */}
            <Card className="max-w-2xl mx-auto p-4 bg-pdf-accent/10 border-pdf-accent/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-pdf-accent" />
                <div>
                  <p className="font-semibold text-pdf-accent">
                    {advancedMode ? "Advanced Processing Complete!" : "Processing Complete!"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Successfully processed {pages.length} page{pages.length !== 1 ? 's' : ''} with{' '}
                    {advancedMode 
                      ? `${textChunks.length} AI-extracted elements and ${extractionResult?.intermediate_representation?.pages?.[0]?.blocks?.length || 0} semantic blocks`
                      : `${pages.reduce((sum, page) => sum + page.textChunks.length, 0)} text regions`
                    }
                    {advancedMode && extractionResult?.intermediate_representation && (
                      <span className="inline-flex items-center gap-1 ml-2 text-pdf-primary">
                        <span>•</span>
                        <span className="font-medium">AI Enhanced</span>
                      </span>
                    )}
                    {!advancedMode && pages.some(page => page.textChunks.some(chunk => chunk.id.includes('ocr'))) && (
                      <span className="inline-flex items-center gap-1 ml-2 text-pdf-primary">
                        <span>•</span>
                        <span className="font-medium">OCR Enhanced</span>
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetViewer}
                  className="ml-auto hover:bg-pdf-accent/10"
                >
                  Upload New File
                </Button>
              </div>
            </Card>

            {/* Advanced Mode Controls */}
            {advancedMode && extractionResult && (
              <div className="max-w-4xl mx-auto">
                <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)} className="w-full">
                  <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
                    <TabsTrigger value="document" className="text-sm" data-testid="tab-document">
                      <Eye className="w-4 h-4 mr-2" />
                      Document
                    </TabsTrigger>
                    <TabsTrigger value="chunks" className="text-sm" data-testid="tab-chunks">
                      <Target className="w-4 h-4 mr-2" />
                      Text Chunks
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="text-sm" data-testid="tab-analytics">
                      <Brain className="w-4 h-4 mr-2" />
                      Analytics
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Main Layout */}
            {advancedMode && extractionResult ? (
              <div className="space-y-6">
                {activeView === 'document' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Document Viewer */}
                    <div className="lg:col-span-2">
                      <DocumentViewer
                        pages={pages}
                        highlightedChunk={selectedChunk}
                        onChunkClick={handleChunkClick}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        highlightedGrounding={highlightedGrounding}
                        documentDimensions={documentDimensions}
                      />
                    </div>

                    {/* Text Search Panel */}
                    <div className="lg:col-span-1">
                      <TextSearch
                        pages={pages}
                        onChunkSelect={handleChunkSelect}
                        selectedChunk={selectedChunk}
                      />
                    </div>
                  </div>
                )}

                {activeView === 'chunks' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Document Viewer */}
                    <div className="lg:col-span-2">
                      <DocumentViewer
                        pages={pages}
                        highlightedChunk={selectedChunk}
                        onChunkClick={handleChunkClick}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        highlightedGrounding={highlightedGrounding}
                        documentDimensions={documentDimensions}
                      />
                    </div>

                    {/* Text Chunk Highlighter */}
                    <div className="lg:col-span-1">
                      <TextChunkHighlighter
                        textChunks={textChunks}
                        documentDimensions={documentDimensions}
                        onChunkHighlight={handleTextChunkHighlight}
                        onChunkClick={handleTextChunkClick}
                        highlightedChunk={selectedChunk}
                        currentPage={currentPage - 1} // Convert to 0-based
                        showConfidence={true}
                      />
                    </div>
                  </div>
                )}

                {activeView === 'analytics' && (
                  <div className="max-w-6xl mx-auto">
                    <PerfectExtractionDashboard
                      extractionResult={extractionResult}
                      processingTime={Date.now()}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Document Viewer */}
                <div className="lg:col-span-2">
                  <DocumentViewer
                    pages={pages}
                    highlightedChunk={selectedChunk}
                    onChunkClick={handleChunkClick}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                  />
                </div>

                {/* Text Search Panel */}
                <div className="lg:col-span-1">
                  <TextSearch
                    pages={pages}
                    onChunkSelect={handleChunkSelect}
                    selectedChunk={selectedChunk}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF Processors */}
        {file && isProcessing && (
          <>
            {advancedMode ? (
              <EnhancedPDFProcessor
                file={file}
                onProcessingComplete={handleEnhancedProcessingComplete}
                onProgressUpdate={handleProgressUpdate}
                onError={handleError}
                enableAdvancedProcessing={true}
              />
            ) : (
              <PDFProcessor
                file={file}
                onProcessingComplete={handleProcessingComplete}
                onProgressUpdate={handleProgressUpdate}
                onError={handleError}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;