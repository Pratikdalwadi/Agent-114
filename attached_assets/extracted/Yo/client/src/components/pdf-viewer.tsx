import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PDFProcessor, { PageData } from './pdf-processor';
import DocumentViewer from './document-viewer';
import TextSearch from './text-search';

const PDFViewer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [selectedChunk, setSelectedChunk] = useState<string>('');
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
      
      toast({
        title: "Processing PDF",
        description: "Extracting text and generating images...",
      });
    } else {
      setError('Please select a valid PDF file.');
      toast({
        title: "Invalid File",
        description: "Please select a valid PDF file.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleProcessingComplete = useCallback((processedPages: PageData[]) => {
    setPages(processedPages);
    setIsProcessing(false);
    setCurrentPage(1);
    
    const totalChunks = processedPages.reduce((sum, page) => sum + page.textChunks.length, 0);
    
    toast({
      title: "Processing Complete",
      description: `Successfully processed ${processedPages.length} pages with ${totalChunks} text regions.`,
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

  const resetViewer = () => {
    setFile(null);
    setPages([]);
    setCurrentPage(1);
    setSelectedChunk('');
    setError('');
    setIsProcessing(false);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Enhanced PDF Text Extractor</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload a PDF document to extract and search through all text content with interactive highlighting and OCR capabilities
          </p>
        </div>

        {/* File Upload */}
        {!file && (
          <Card className="max-w-2xl mx-auto p-8 border-2 border-dashed" data-testid="upload-card">
            <div className="text-center">
              <Upload className="w-16 h-16 mx-auto mb-6 text-primary" />
              <h3 className="text-xl font-semibold mb-4">Upload PDF Document</h3>
              <p className="text-muted-foreground mb-6">
                Select a PDF file to extract text with advanced OCR and precise text positioning
              </p>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                  data-testid="input-pdf-upload"
                />
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90"
                  disabled={isProcessing}
                  data-testid="button-upload"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Choose PDF File
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mt-4">
                Supports multi-page PDFs with text content and images
              </p>
            </div>
          </Card>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <Card className="max-w-2xl mx-auto p-6" data-testid="processing-card">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 relative">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Processing PDF...</h3>
              <p className="text-muted-foreground mb-4">
                Extracting text from all pages with OCR enhancement and generating interactive previews
              </p>
              
              <div className="space-y-2">
                <Progress value={progress} className="w-full" data-testid="progress-bar" />
                <p className="text-sm text-muted-foreground" data-testid="progress-text">
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
          <Alert variant="destructive" className="max-w-2xl mx-auto mb-6" data-testid="error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success State with Document Viewer */}
        {pages.length > 0 && !isProcessing && (
          <div className="space-y-6">
            {/* Success Message */}
            <Alert className="max-w-2xl mx-auto" data-testid="success-alert">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully processed {pages.length} pages with {pages.reduce((sum, page) => sum + page.textChunks.length, 0)} text regions.
                Use the search feature to find specific content or click on text regions to copy them.
              </AlertDescription>
            </Alert>

            {/* Main Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Search Panel */}
              <div className="lg:col-span-1 space-y-4">
                <TextSearch
                  pages={pages}
                  onResultSelect={handleChunkSelect}
                  data-testid="text-search-panel"
                />
                
                <Card className="p-4" data-testid="document-info">
                  <h4 className="font-medium mb-2">Document Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pages:</span>
                      <span>{pages.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Text Regions:</span>
                      <span>{pages.reduce((sum, page) => sum + page.textChunks.length, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Page:</span>
                      <span>{currentPage}</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={resetViewer}
                    className="w-full mt-4"
                    data-testid="button-reset"
                  >
                    Upload New PDF
                  </Button>
                </Card>
              </div>

              {/* Document Viewer */}
              <div className="lg:col-span-3">
                <DocumentViewer
                  pages={pages}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  selectedChunk={selectedChunk}
                  onChunkClick={handleChunkClick}
                  data-testid="document-viewer-panel"
                />
              </div>
            </div>
          </div>
        )}

        {/* PDF Processor (Hidden) */}
        {file && isProcessing && (
          <PDFProcessor
            file={file}
            onProcessingComplete={handleProcessingComplete}
            onProgressUpdate={handleProgressUpdate}
            onError={handleError}
          />
        )}
      </div>
    </div>
  );
};

export default PDFViewer;