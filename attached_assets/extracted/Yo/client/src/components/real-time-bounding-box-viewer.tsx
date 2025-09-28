import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2, Target, FileText, Image } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { ExtractionJob, Document, BoundingBox, Word, Line, Block, Table, ExtractionResult } from "@shared/schema";
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';

interface RealTimeBoundingBoxViewerProps {
  job: ExtractionJob;
  documentUrl?: string; // Make optional since we'll fetch it
  className?: string;
}

interface RegionData {
  id: string;
  type: 'word' | 'line' | 'block' | 'table';
  bbox: BoundingBox;
  content: string;
  confidence?: number;
}

export default function RealTimeBoundingBoxViewer({ 
  job, 
  documentUrl, 
  className 
}: RealTimeBoundingBoxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [documentDimensions, setDocumentDimensions] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Create PDF plugin instance
  const pageNavigationPluginInstance = pageNavigationPlugin();
  
  // Fetch document details
  const { data: documentData } = useQuery({
    queryKey: [`/api/documents/${job.documentId}`],
    enabled: !!job.documentId,
  });
  
  const document = (documentData as { document?: Document })?.document;
  
  // Get document URL
  const getDocumentUrl = () => {
    if (documentUrl) return documentUrl;
    if (document) return `/api/documents/${document.id}/file`;
    return '';
  };
  
  const resolvedDocumentUrl = getDocumentUrl();
  const isPDF = document?.mimeType === 'application/pdf';

  // Extract regions from current job result (support multiple pages)
  const extractRegions = (): RegionData[] => {
    if (!job.result) return [];
    
    const result = job.result as ExtractionResult;
    
    // Support both ir and intermediate_representation for backward compatibility
    const intermediateRep = result.intermediate_representation || result.ir;
    if (!intermediateRep?.pages) return [];

    const regions: RegionData[] = [];
    const pages = intermediateRep.pages;

    // Process current page (or first page if not multi-page)
    const pageIndex = Math.max(0, currentPage - 1);
    const page = pages[pageIndex] || pages[0];
    if (!page) return [];

    // Add blocks (most visible level during processing)
    if (page.blocks && page.blocks.length > 0) {
      page.blocks.forEach((block: Block, index: number) => {
        regions.push({
          id: `block-${index}`,
          type: 'block',
          bbox: block.bbox,
          content: block.lines?.map((l: Line) => 
            l.words?.map((w: Word) => w.text).join(' ')
          ).join('\n') || '',
          confidence: block.confidence || 0.8,
        });
      });
    }

    // Add tables with high priority
    if (page.tables && page.tables.length > 0) {
      page.tables.forEach((table: Table, index: number) => {
        regions.push({
          id: `table-${index}`,
          type: 'table',
          bbox: table.bbox,
          content: `Table (${table.rows}x${table.cols})`,
          confidence: table.confidence || 0.9,
        });
      });
    }

    // Add lines for more detailed view if blocks are sparse or during early processing
    if (page.lines && (!page.blocks || page.blocks.length < 3)) {
      page.lines.slice(0, 20).forEach((line: Line, index: number) => { // Limit to 20 lines to avoid clutter
        regions.push({
          id: `line-${index}`,
          type: 'line',
          bbox: line.bbox,
          content: line.words?.map((w: Word) => w.text).join(' ') || '',
          confidence: line.words && line.words.length > 0 
            ? line.words.reduce((sum, w) => sum + (w.confidence || 0.7), 0) / line.words.length 
            : 0.7,
        });
      });
    }

    // Add words if very sparse (early processing)
    if (regions.length < 5 && page.words && page.words.length > 0) {
      page.words.slice(0, 50).forEach((word: Word, index: number) => { // Limit to 50 words
        regions.push({
          id: `word-${index}`,
          type: 'word',
          bbox: word.bbox,
          content: word.text,
          confidence: word.confidence || 0.6,
        });
      });
    }

    return regions;
  };

  const updateContainerSize = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  };

  useEffect(() => {
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  useEffect(() => {
    // Reset document loaded state when document URL changes
    setDocumentLoaded(false);
  }, [resolvedDocumentUrl]);
  
  useEffect(() => {
    // Update total pages from intermediate representation
    if (job.result) {
      const result = job.result as ExtractionResult;
      const intermediateRep = result.intermediate_representation || result.ir;
      if (intermediateRep?.pages) {
        setTotalPages(intermediateRep.pages.length);
      }
    }
  }, [job.result]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setDocumentDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setDocumentLoaded(true);
  };
  
  const handlePDFDocumentLoad = (e: any) => {
    // For PDFs, we'll use standard page dimensions and scale accordingly
    // PDF.js typically uses 72 DPI, standard page is ~595x842 points
    setDocumentDimensions({ width: 595, height: 842 });
    setDocumentLoaded(true);
    if (e.doc) {
      setTotalPages(e.doc.numPages);
    }
  };

  const regions = extractRegions();

  // Calculate scale factor to fit the document in the container
  const scaleX = containerSize.width / documentDimensions.width;
  const scaleY = containerSize.height / documentDimensions.height;
  const scale = Math.min(scaleX, scaleY, 1);

  const scaledWidth = documentDimensions.width * scale;
  const scaledHeight = documentDimensions.height * scale;

  // Green color scheme as requested
  const getRegionStyle = (region: RegionData) => {
    const baseOpacity = job.status === 'processing' ? 0.2 : 0.3;
    const confidence = region.confidence || 0.8;
    
    // Different shades of green based on region type
    const colors = {
      block: `rgba(34, 197, 94, ${baseOpacity * confidence})`, // green-500
      table: `rgba(22, 163, 74, ${baseOpacity * confidence})`, // green-600  
      line: `rgba(74, 222, 128, ${baseOpacity * confidence})`, // green-400
      word: `rgba(134, 239, 172, ${baseOpacity * confidence})`, // green-300
    };

    const borderColors = {
      block: 'rgb(34, 197, 94)', // green-500
      table: 'rgb(22, 163, 74)', // green-600
      line: 'rgb(74, 222, 128)', // green-400
      word: 'rgb(134, 239, 172)', // green-300
    };

    return {
      backgroundColor: colors[region.type],
      border: `2px solid ${borderColors[region.type]}`,
      borderRadius: '2px',
    };
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'pending':
        return 'Initializing extraction...';
      case 'processing':
        return `Processing document... ${regions.length} regions detected`;
      case 'completed':
        return 'Extraction completed';
      case 'failed':
        return 'Extraction failed';
      default:
        return 'Unknown status';
    }
  };

  const getProgressValue = () => {
    if (job.status === 'completed') return 100;
    if (job.status === 'failed') return 0;
    if (job.progress) return job.progress;
    
    // Better progress calculation based on extraction phases
    const regionCount = regions.length;
    if (regionCount === 0) return 15; // Initial processing
    if (regionCount < 5) return 25; // Early detection
    if (regionCount < 20) return 50; // Good progress
    if (regionCount < 50) return 75; // Almost done
    return 90; // Final processing
  };

  return (
    <Card className={`h-full flex flex-col ${className}`} data-testid="real-time-bbox-viewer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="w-4 h-4 text-green-600" />
            Real-time Document Analysis
            {job.status === 'processing' && (
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant={job.status === 'processing' ? 'default' : 'secondary'}
              className={job.status === 'processing' ? 'bg-green-600' : ''}
              data-testid="status-badge"
            >
              {regions.length} regions
            </Badge>
            {job.confidence && (
              <Badge variant="outline" data-testid="confidence-badge">
                {Math.round(job.confidence)}% confidence
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="status-text">{getStatusText()}</span>
            <span data-testid="progress-percentage">{getProgressValue()}%</span>
          </div>
          <Progress 
            value={getProgressValue()} 
            className="h-2" 
            data-testid="extraction-progress"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative" data-testid="real-time-content">
        <div 
          ref={containerRef}
          className="relative w-full h-full bg-gray-50 dark:bg-gray-900 overflow-hidden rounded-lg"
          style={{ minHeight: '400px' }}
        >
          {/* Document Display - PDF or Image */}
          {isPDF && resolvedDocumentUrl ? (
            <div 
              ref={documentRef}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              style={{
                width: documentLoaded ? scaledWidth : '80%',
                height: documentLoaded ? scaledHeight : '80%',
                opacity: documentLoaded ? 1 : 0.5,
              }}
            >
              <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                <Viewer
                  fileUrl={resolvedDocumentUrl}
                  plugins={[pageNavigationPluginInstance]}
                  onDocumentLoad={handlePDFDocumentLoad}
                  data-testid="pdf-viewer"
                />
              </Worker>
            </div>
          ) : resolvedDocumentUrl ? (
            <img
              src={resolvedDocumentUrl}
              alt="Document being processed"
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full"
              style={{
                width: documentLoaded ? scaledWidth : 'auto',
                height: documentLoaded ? scaledHeight : 'auto',
                opacity: documentLoaded ? 1 : 0,
              }}
              onLoad={handleImageLoad}
              data-testid="document-image"
            />
          ) : null}

          {/* Loading overlay */}
          {!documentLoaded && resolvedDocumentUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading {isPDF ? 'PDF' : 'document'}...</span>
                {isPDF && <FileText className="w-4 h-4" />}
                {!isPDF && <Image className="w-4 h-4" />}
              </div>
            </div>
          )}
          
          {/* No document overlay */}
          {!resolvedDocumentUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="w-6 h-6" />
                <span>No document available</span>
              </div>
            </div>
          )}

          {/* Bounding Box Overlays */}
          {documentLoaded && regions.length > 0 && (
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                width: scaledWidth,
                height: scaledHeight,
              }}
              data-testid="bbox-overlay-container"
            >
              {regions.map((region) => (
                <div
                  key={region.id}
                  className={`absolute transition-all duration-500 cursor-pointer hover:opacity-80 group pointer-events-auto ${
                    job.status === 'processing' ? 'animate-pulse' : ''
                  }`}
                  style={{
                    left: `${region.bbox.x * 100}%`,
                    top: `${region.bbox.y * 100}%`,
                    width: `${region.bbox.width * 100}%`,
                    height: `${region.bbox.height * 100}%`,
                    ...getRegionStyle(region),
                  }}
                  title={`${region.type}: ${region.content.substring(0, 100)}${region.content.length > 100 ? '...' : ''} (${Math.round((region.confidence || 0) * 100)}%)`}
                  data-testid={`bbox-${region.type}-${region.id}`}
                >
                  {/* Confidence indicator for high-confidence regions */}
                  {region.confidence && region.confidence > 0.85 && job.status === 'processing' && (
                    <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full opacity-80 animate-pulse" />
                  )}
                  
                  {/* Region type indicator */}
                  <div className="absolute top-0 left-0 bg-green-600 text-white text-xs px-1 py-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity">
                    {region.type} {region.confidence && `(${Math.round(region.confidence * 100)}%)`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Processing indicator overlay */}
          {job.status === 'processing' && regions.length === 0 && documentLoaded && (
            <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 animate-pulse">
              <Eye className="w-4 h-4" />
              Analyzing {isPDF ? 'PDF' : 'document'}...
            </div>
          )}
          
          {/* Multi-page indicator for PDFs */}
          {isPDF && totalPages > 1 && documentLoaded && (
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Page {currentPage} of {totalPages}
            </div>
          )}

          {/* Error state */}
          {job.status === 'failed' && (
            <div className="absolute inset-0 bg-red-50 dark:bg-red-950 bg-opacity-90 flex items-center justify-center">
              <div className="text-center text-red-600 dark:text-red-400">
                <p className="font-medium">Extraction failed</p>
                {job.error && <p className="text-sm mt-1">{job.error}</p>}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Region count footer */}
      {regions.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="region-summary">
              {regions.filter(r => r.type === 'block').length} blocks, {' '}
              {regions.filter(r => r.type === 'table').length} tables, {' '}
              {regions.filter(r => r.type === 'line').length} lines
            </span>
            <span data-testid="avg-confidence">
              Avg confidence: {regions.length > 0 
                ? Math.round(regions.reduce((sum, r) => sum + (r.confidence || 0), 0) / regions.length * 100) 
                : 0}%
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}