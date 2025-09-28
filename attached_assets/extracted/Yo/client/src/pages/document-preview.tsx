import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ArrowLeft, Download, Copy, Target, Eye, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Document, ExtractionJob, ExtractionResult, BoundingBox, TextChunk } from "@shared/schema";
import { Viewer } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';
import BoundingBoxViewer from "@/components/bounding-box-viewer";
import VisualGroundingInterface from "@/components/visual-grounding-interface";
import PerfectExtractionDashboard from "@/components/perfect-extraction-dashboard";
import ExtractionResults from "@/components/extraction-results";
import TextChunkHighlighter from "@/components/text-chunk-highlighter";
import TextChunkOverlay from "@/components/text-chunk-overlay";
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';

// Inline BoundingBoxOverlay component for document viewer
interface BoundingBoxOverlayProps {
  regions: any[];
  documentDimensions: { width: number; height: number };
  highlightedRegion?: { id: string; type: string } | null;
  onRegionClick?: (regionId: string, regionType: string) => void;
}

const BoundingBoxOverlay = ({ regions, documentDimensions, highlightedRegion, onRegionClick }: BoundingBoxOverlayProps) => {
  const getRegionStyle = (region: any) => {
    const isHighlighted = highlightedRegion?.id === region.id;
    const baseOpacity = isHighlighted ? 0.4 : 0.2;
    const confidence = region.confidence || 0.8;
    
    const colors = {
      block: `rgba(34, 197, 94, ${baseOpacity * confidence})`, // green-500
      table: `rgba(59, 130, 246, ${baseOpacity * confidence})`, // blue-500  
      line: `rgba(168, 85, 247, ${baseOpacity * confidence})`, // purple-500
      word: `rgba(249, 115, 22, ${baseOpacity * confidence})`, // orange-500
    };

    const borderColors = {
      block: 'rgb(34, 197, 94)', // green-500
      table: 'rgb(59, 130, 246)', // blue-500
      line: 'rgb(168, 85, 247)', // purple-500
      word: 'rgb(249, 115, 22)', // orange-500
    };

    return {
      backgroundColor: colors[region.type as keyof typeof colors] || colors.block,
      border: `2px solid ${borderColors[region.type as keyof typeof borderColors] || borderColors.block}`,
      borderRadius: '2px',
      boxShadow: isHighlighted ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none',
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {regions.map((region) => (
        <div
          key={region.id}
          className={`absolute transition-all duration-300 cursor-pointer hover:opacity-80 group pointer-events-auto ${
            highlightedRegion?.id === region.id ? 'animate-pulse' : ''
          }`}
          style={{
            left: `${region.bbox.x * 100}%`,
            top: `${region.bbox.y * 100}%`,
            width: `${region.bbox.width * 100}%`,
            height: `${region.bbox.height * 100}%`,
            ...getRegionStyle(region),
          }}
          onClick={() => onRegionClick?.(region.id, region.type)}
          title={`${region.type}: ${region.content?.substring(0, 100)}${(region.content?.length || 0) > 100 ? '...' : ''} (${Math.round((region.confidence || 0) * 100)}%)`}
          data-testid={`overlay-${region.type}-${region.id}`}
        >
          {/* Region type indicator */}
          <div className="absolute top-0 left-0 bg-blue-600 text-white text-xs px-1 py-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {region.type} {region.confidence && `(${Math.round(region.confidence * 100)}%)`}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function DocumentPreview() {
  const { documentId } = useParams<{ documentId: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Parse query parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const jobIdFromUrl = urlParams.get('jobId');
  const tabFromUrl = urlParams.get('tab') as 'parse' | 'extract' | 'analyze' | 'bbox' | 'chunks' | 'chat' | null;
  const pageFromUrl = urlParams.get('page');
  const regionIdFromUrl = urlParams.get('regionId');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab] = useState<'parse' | 'extract' | 'analyze' | 'bbox' | 'chunks' | 'chat'>('parse');
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'json'>('markdown');
  const [highlightedRegion, setHighlightedRegion] = useState<{ id: string; type: string } | null>(null);
  const [documentDimensions, setDocumentDimensions] = useState({ width: 0, height: 0 });
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(false);
  
  // Text chunk highlighting state
  const [highlightedChunk, setHighlightedChunk] = useState<string | null>(null);
  const [hoveredChunk, setHoveredChunk] = useState<string | null>(null);
  const [showTextChunkOverlay, setShowTextChunkOverlay] = useState(false);
  
  // Create the page navigation plugin
  const pageNavigationPluginInstance = pageNavigationPlugin();
  
  const {
    GoToFirstPage,
    GoToLastPage,
    GoToNextPage,
    GoToPreviousPage,
    CurrentPageLabel,
  } = pageNavigationPluginInstance;

  // Handle URL parameters on component mount and when they change
  useEffect(() => {
    // Set active tab based on URL parameter or default to 'extract' if jobId is provided
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else if (jobIdFromUrl) {
      setActiveTab('extract');
    }

    // Enable bounding boxes when coming from Recent Extractions
    if (jobIdFromUrl) {
      setShowBoundingBoxes(true);
    }

    // Set page if specified in URL
    if (pageFromUrl) {
      const pageNum = parseInt(pageFromUrl, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
      }
    }
  }, [tabFromUrl, jobIdFromUrl, pageFromUrl]);

  // Fetch document data
  const { data: documentData } = useQuery({
    queryKey: [`/api/documents/${documentId}`],
    enabled: !!documentId,
  });

  // Fetch extraction jobs for this document
  const { data: jobsData } = useQuery({
    queryKey: [`/api/extraction/document/${documentId}`],
    enabled: !!documentId,
    refetchInterval: 2000,
  });

  // Fetch specific job data when jobId is provided in URL
  const { data: specificJobData } = useQuery({
    queryKey: [`/api/extraction/${jobIdFromUrl}`],
    enabled: !!jobIdFromUrl,
    refetchInterval: (data) => {
      const jobResponse = data as { job?: ExtractionJob };
      return jobResponse?.job?.status === 'processing' || jobResponse?.job?.status === 'pending' ? 2000 : false;
    },
  });

  const document = (documentData as { document?: Document })?.document;
  const jobs = (jobsData as { jobs?: ExtractionJob[] })?.jobs || [];
  const specificJob = (specificJobData as { job?: ExtractionJob })?.job;
  const latestJob = specificJob || jobs.find(job => job.status === 'completed') || jobs[0];

  // Handle region highlighting and job result mapping
  useEffect(() => {
    if (specificJob && specificJob.status === 'completed' && specificJob.result) {
      const result = specificJob.result as ExtractionResult;
      const intermediateRep = result.intermediate_representation || result.ir;
      
      if (intermediateRep?.pages && intermediateRep.pages.length > 0) {
        const page = intermediateRep.pages[0]; // Use first page for now
        
        // If regionId is specified in URL, highlight that specific region
        if (regionIdFromUrl) {
          setHighlightedRegion({ id: regionIdFromUrl, type: 'auto' });
        } else {
          // Auto-highlight the first block or table found in the extraction result
          if (page.blocks && page.blocks.length > 0) {
            setHighlightedRegion({ id: 'block-0', type: 'block' });
          } else if (page.tables && page.tables.length > 0) {
            setHighlightedRegion({ id: 'table-0', type: 'table' });
          }
        }

        // Show toast notification about highlighting
        if (jobIdFromUrl) {
          toast({
            title: "Extraction highlighted",
            description: "The extracted content is now highlighted on the document",
          });
        }
      }
    }
  }, [specificJob, regionIdFromUrl, jobIdFromUrl, toast]);

  // Get document file URL
  const getDocumentUrl = (doc: Document) => {
    return `/api/documents/${doc.id}/file`;
  };

  const handleCopyToClipboard = async () => {
    if (!latestJob?.result) return;
    
    try {
      let textContent = '';
      const result = latestJob.result as ExtractionResult;
      
      if (outputFormat === 'json') {
        textContent = JSON.stringify(result, null, 2);
      } else {
        // Format as markdown
        if (result.tables && result.tables.length > 0) {
          result.tables.forEach((table, index) => {
            if (table.title) {
              textContent += `## ${table.title}\n\n`;
            }
            if (table.data && table.data.length > 0) {
              const headers = Object.keys(table.data[0]);
              textContent += headers.join(' | ') + '\n';
              textContent += headers.map(() => '---').join(' | ') + '\n';
              table.data.forEach((row: any) => {
                textContent += headers.map(header => row[header] || '').join(' | ') + '\n';
              });
              textContent += '\n';
            }
          });
        }
      }
      
      await navigator.clipboard.writeText(textContent);
      toast({
        title: "Copied to clipboard",
        description: "Extraction results copied successfully",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Handle region highlighting for visual grounding
  const handleRegionHighlight = (regionId: string | null, regionType: string) => {
    if (regionId) {
      setHighlightedRegion({ id: regionId, type: regionType });
    } else {
      setHighlightedRegion(null);
    }
  };

  // Handle coordinate clicks for visual grounding
  const handleCoordinateClick = (bbox: BoundingBox) => {
    // Switch to bbox tab to show the region
    setActiveTab('bbox');
    // Set the highlighted region (implementation depends on how you want to link them)
    toast({
      title: "Region Located",
      description: `Coordinates: (${bbox.x.toFixed(3)}, ${bbox.y.toFixed(3)})`,
    });
  };

  // Handle text chunk highlighting
  const handleChunkHighlight = (chunkId: string | null, grounding?: any) => {
    setHighlightedChunk(chunkId);
    if (chunkId && grounding) {
      // Enable text chunk overlay when highlighting chunks
      setShowTextChunkOverlay(true);
      toast({
        title: "Text chunk highlighted",
        description: `Chunk on page ${grounding.page + 1}`,
      });
    }
  };

  // Handle text chunk click
  const handleChunkClick = (chunk: any) => {
    setHighlightedChunk(chunk.chunk_id);
    setShowTextChunkOverlay(true);
    
    // Switch to the document page if different
    if (chunk.grounding && chunk.grounding[0]) {
      const chunkPage = chunk.grounding[0].page + 1;
      if (chunkPage !== currentPage) {
        setCurrentPage(chunkPage);
      }
    }
    
    toast({
      title: "Text chunk selected",
      description: `Viewing "${chunk.text.substring(0, 50)}..."`,
    });
  };

  // Handle text chunk hover
  const handleChunkHover = (chunkId: string | null) => {
    setHoveredChunk(chunkId);
  };

  // Handle showing bounding boxes on main document viewer
  const handleShowBoundingBoxes = () => {
    setShowBoundingBoxes(true);
    toast({
      title: "Visual grounding enabled",
      description: "Bounding boxes are now visible on the document",
    });
  };

  // Extract regions from extraction result for overlay
  const extractRegionsForOverlay = (): Array<{
    id: string;
    type: string;
    bbox: { x: number; y: number; width: number; height: number };
    content?: string;
    confidence?: number;
  }> => {
    if (!latestJob?.result) return [];
    
    const result = latestJob.result as ExtractionResult;
    const intermediateRep = result.intermediate_representation || result.ir;
    if (!intermediateRep?.pages) return [];

    const regions: Array<{
      id: string;
      type: string;
      bbox: { x: number; y: number; width: number; height: number };
      content?: string;
      confidence?: number;
    }> = [];
    const page = intermediateRep.pages[0]; // Use first page for now
    if (!page) return [];

    // Add blocks (main content regions)
    if (page.blocks) {
      page.blocks.forEach((block: any, index: number) => {
        regions.push({
          id: `block-${index}`,
          type: 'block',
          bbox: block.bbox,
          content: block.lines?.map((l: any) => l.words?.map((w: any) => w.text).join(' ')).join('\n') || '',
          confidence: block.confidence || 0.8,
        });
      });
    }

    // Add tables (high priority)
    if (page.tables) {
      page.tables.forEach((table: any, index: number) => {
        regions.push({
          id: `table-${index}`,
          type: 'table',
          bbox: table.bbox,
          content: `Table (${table.rows}x${table.cols})`,
          confidence: table.confidence || 0.9,
        });
      });
    }

    return regions;
  };

  // Get document dimensions (you might want to calculate this from the actual document)
  const getDocumentDimensions = () => {
    // For now, using standard dimensions - you could enhance this to get actual dimensions
    return { width: 612, height: 792 }; // Standard letter size in points
  };

  // Extract text chunks from extraction result
  const extractTextChunksFromResult = (result: ExtractionResult): TextChunk[] => {
    // Use text chunks directly from the extraction result
    if (result.chunks && Array.isArray(result.chunks)) {
      return result.chunks;
    }

    // Legacy fallback for text_chunks field
    if ((result as any).text_chunks && Array.isArray((result as any).text_chunks)) {
      return (result as any).text_chunks;
    }
    
    // Return empty array if no chunks are available
    console.warn('No text chunks available in extraction result');
    return [];
  };

  // Map block types to chunk types
  const mapBlockTypeToChunkType = (blockType: string) => {
    const mapping: { [key: string]: string } = {
      'paragraph': 'text',
      'heading': 'title',
      'list': 'list',
      'table': 'table',
      'image': 'figure',
      'line': 'text',
      'footer': 'footer',
      'header': 'header',
      'form_field': 'form_field',
      'signature': 'figure',
      'logo': 'figure',
      'caption': 'caption',
    };

    return mapping[blockType] || 'text';
  };

  const renderExtractionResults = (result: ExtractionResult) => {
    if (outputFormat === 'json') {
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
    }

    // Check if we have enhanced structured content
    if (result.structured_content) {
      // Sanitize the content to prevent XSS attacks
      const sanitizedContent = DOMPurify.sanitize(result.structured_content);
      
      return (
        <div className="space-y-4 text-foreground">
          <div className="flex items-center space-x-2 mb-4">
            <span className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 text-blue-700 dark:text-blue-300 rounded-full">
              Enhanced Structured Analysis
            </span>
          </div>
          
          <div className="bg-muted/10 rounded-lg p-6 border border-border/30">
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold mt-8 mb-4 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold mt-6 mb-3 text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-foreground leading-relaxed mb-3">{children}</p>
                  ),
                  code: ({ children }) => (
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted p-4 rounded text-sm font-mono overflow-x-auto">{children}</pre>
                  ),
                  table: ({ children }) => (
                    <table className="min-w-full border border-border mb-4">{children}</table>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-3 py-2 bg-muted font-semibold text-left">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-3 py-2">{children}</td>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-foreground">{children}</em>
                  ),
                }}
              >
                {sanitizedContent}
              </ReactMarkdown>
            </div>
          </div>

          {/* Show metadata */}
          {result.metadata && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <div className="text-xs text-muted-foreground">
                {result.metadata.page_count && `${result.metadata.page_count} page(s)`}
                {result.metadata.word_count && ` • ${result.metadata.word_count} words`}
                {result.metadata.ai_provider && ` • Processed with ${result.metadata.ai_provider}`}
                {result.metadata.processed_at && ` • ${new Date(result.metadata.processed_at).toLocaleString()}`}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Fallback to original enhanced structured content with data-driven layout
    return (
      <div className="space-y-4 text-foreground">
        {result.tables && result.tables.map((table, tableIndex) => (
          <div key={tableIndex} className="space-y-3">
            {/* Data-driven marginalia numbering */}
            {table.title && (
              <div className="flex items-center space-x-2 mb-4">
                <span className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full">
                  {tableIndex + 1} - {table.title}
                </span>
              </div>
            )}
            
            {table.data && table.data.length > 0 && (
              <div className="space-y-3">
                {table.data.map((row: any, rowIndex) => (
                  <div key={rowIndex} className="group">
                    {Object.entries(row).map(([key, value]) => {
                      const valueStr = String(value);
                      
                      // Check if this looks like a person's name (contains medical titles)
                      const isPersonName = valueStr.match(/(M\.D\.|PhD|Dr\.|MD|Ph\.D)/i);
                      
                      return (
                        <div key={key} className="space-y-2">
                          {key && (
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              {key}
                            </div>
                          )}
                          
                          {isPersonName ? (
                            // Enhanced person card format for medical professionals
                            <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-4 border border-border/50">
                              <div className="font-semibold text-base text-foreground mb-1">
                                {valueStr}
                              </div>
                              {valueStr.toLowerCase().includes('dermatopathology') && (
                                <div className="text-sm text-muted-foreground">
                                  Board Certified in Dermatopathology
                                </div>
                              )}
                            </div>
                          ) : (
                            // Regular content display with enhanced styling
                            <div className="py-2">
                              <div className="font-medium text-foreground leading-relaxed">
                                {valueStr}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {table.confidence && (
              <div className="text-xs text-muted-foreground mt-4 pt-2 border-t border-border/30">
                Confidence: {Math.round(table.confidence * 100)}%
              </div>
            )}
          </div>
        ))}
        
        {/* Objects display for smart_image extraction */}
        {result.objects && result.objects.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <span className="px-3 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full">
                Objects Detected
              </span>
            </div>
            
            {result.objects.map((obj, objIndex) => (
              <div key={objIndex} className="bg-muted/20 rounded-lg p-4 border border-border/50">
                <div className="font-semibold text-sm text-foreground mb-2">
                  {obj.label}
                </div>
                {obj.description && (
                  <div className="text-sm text-muted-foreground mb-2">
                    {obj.description}
                  </div>
                )}
                {obj.category && (
                  <div className="text-xs text-muted-foreground">
                    Category: {obj.category} • Confidence: {Math.round(obj.confidence * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Text content display */}
        {result.text && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <span className="px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                Text Content
              </span>
            </div>
            
            <div className="bg-muted/20 rounded-lg p-4 border border-border/50">
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {result.text}
              </div>
            </div>
          </div>
        )}
        
        {result.metadata && (
          <div className="mt-8 pt-4 border-t border-border/30">
            <div className="text-sm text-muted-foreground">
              {result.metadata.page_count && `${result.metadata.page_count} page(s)`}
              {result.metadata.word_count && ` • ${result.metadata.word_count} words`}
              {result.metadata.ai_provider && ` • Processed with ${result.metadata.ai_provider}`}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!document) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Document not found</p>
          <Link href="/">
            <Button variant="outline" className="mt-4" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border" data-testid="preview-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-6 border-l border-border"></div>
              <div>
                <h1 className="text-lg font-semibold text-foreground" data-testid="text-document-name">
                  {document.originalName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {document.mimeType} • {Math.round(document.size / 1024)} KB
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(getDocumentUrl(document), '_blank')}
                data-testid="button-download-document"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Document Viewer */}
        <div className="flex-1 flex flex-col bg-card border-r border-border">
          {/* Navigation Controls */}
          <div className="flex items-center justify-center p-4 border-b border-border bg-muted/50">
            <div className="flex items-center space-x-2">
              <GoToPreviousPage>
                {(props) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={props.onClick}
                    disabled={props.isDisabled}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
              </GoToPreviousPage>
              
              <CurrentPageLabel>
                {(props) => (
                  <span className="text-sm font-medium px-3 py-1 bg-background rounded border">
                    {props.currentPage + 1} / {props.numberOfPages}
                  </span>
                )}
              </CurrentPageLabel>
              
              <GoToNextPage>
                {(props) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={props.onClick}
                    disabled={props.isDisabled}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </GoToNextPage>
            </div>
          </div>

          {/* Document Display */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4 relative" data-testid="document-viewer">
            {document.mimeType === 'application/pdf' ? (
              <div style={{ height: 'calc(100vh - 12rem)' }} className="relative pdf-viewer-container">
                <Viewer
                  fileUrl={getDocumentUrl(document)}
                  plugins={[pageNavigationPluginInstance]}
                />
                
                {/* Bounding Box Overlay for PDF - Using CSS to target PDF page content */}
                {showBoundingBoxes && latestJob?.status === 'completed' && (
                  <div>
                    <style>{`
                      .pdf-viewer-container .rpv-core__page-layer {
                        position: relative !important;
                      }
                      .pdf-bounding-box-overlay {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        pointer-events: none !important;
                        z-index: 10 !important;
                      }
                    `}</style>
                    <div className="absolute inset-0 pointer-events-none z-10">
                      <BoundingBoxOverlay 
                        regions={extractRegionsForOverlay()}
                        documentDimensions={getDocumentDimensions()}
                        highlightedRegion={highlightedRegion}
                        onRegionClick={(regionId, regionType) => {
                          setHighlightedRegion({ id: regionId, type: regionType });
                          toast({
                            title: "Region selected",
                            description: `Highlighted ${regionType} region`,
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Text Chunk Overlay for PDF */}
                {showTextChunkOverlay && latestJob?.status === 'completed' && latestJob.result && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    <TextChunkOverlay
                      textChunks={extractTextChunksFromResult(latestJob.result as ExtractionResult)}
                      documentDimensions={getDocumentDimensions()}
                      highlightedChunk={highlightedChunk}
                      hoveredChunk={hoveredChunk}
                      currentPage={currentPage - 1}
                      onChunkClick={handleChunkClick}
                      onChunkHover={handleChunkHover}
                      showOverlay={showTextChunkOverlay}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full relative image-viewer-container">
                <div className="relative inline-block">
                  <img
                    src={getDocumentUrl(document)}
                    alt={document.originalName}
                    className="max-w-full max-h-full object-contain"
                    data-testid="image-document"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      setDocumentDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                  />
                  
                  {/* Bounding Box Overlay for Images - positioned directly over the image */}
                  {showBoundingBoxes && latestJob?.status === 'completed' && (
                    <div className="absolute inset-0">
                      <BoundingBoxOverlay 
                        regions={extractRegionsForOverlay()}
                        documentDimensions={documentDimensions}
                        highlightedRegion={highlightedRegion}
                        onRegionClick={(regionId, regionType) => {
                          setHighlightedRegion({ id: regionId, type: regionType });
                          toast({
                            title: "Region selected",
                            description: `Highlighted ${regionType} region`,
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Text Chunk Overlay for Images */}
                  {showTextChunkOverlay && latestJob?.status === 'completed' && latestJob.result && (
                    <div className="absolute inset-0 z-10">
                      <TextChunkOverlay
                        textChunks={extractTextChunksFromResult(latestJob.result as ExtractionResult)}
                        documentDimensions={documentDimensions}
                        highlightedChunk={highlightedChunk}
                        hoveredChunk={hoveredChunk}
                        currentPage={currentPage - 1}
                        onChunkClick={handleChunkClick}
                        onChunkHover={handleChunkHover}
                        showOverlay={showTextChunkOverlay}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Extraction Results */}
        <div className="w-96 flex flex-col bg-background">
          {/* Tab Headers */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-6 m-4 mb-2" data-testid="tabs-main">
              <TabsTrigger value="parse" data-testid="tab-parse">Parse</TabsTrigger>
              <TabsTrigger value="extract" data-testid="tab-extract">Extract</TabsTrigger>
              <TabsTrigger value="analyze" data-testid="tab-analyze">
                <BarChart3 className="w-3 h-3 mr-1" />
                Analyze
              </TabsTrigger>
              <TabsTrigger value="bbox" data-testid="tab-bbox">
                <Target className="w-3 h-3 mr-1" />
                Boxes
              </TabsTrigger>
              <TabsTrigger value="chunks" data-testid="tab-chunks">
                <FileText className="w-3 h-3 mr-1" />
                Chunks
              </TabsTrigger>
              <TabsTrigger value="chat" data-testid="tab-chat">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="parse" className="flex-1 flex flex-col m-0">
              <div className="p-4 space-y-4 flex-1 overflow-auto">
                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <Button
                      variant={outputFormat === 'markdown' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOutputFormat('markdown')}
                      data-testid="button-format-markdown"
                    >
                      Markdown
                    </Button>
                    <Button
                      variant={outputFormat === 'json' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOutputFormat('json')}
                      data-testid="button-format-json"
                    >
                      JSON
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyToClipboard}
                      data-testid="button-copy"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Visual Grounding Toggle */}
                  <Button
                    variant={showBoundingBoxes ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setShowBoundingBoxes(!showBoundingBoxes);
                      toast({
                        title: showBoundingBoxes ? "Visual grounding disabled" : "Visual grounding enabled",
                        description: showBoundingBoxes ? "Bounding boxes are now hidden" : "Click on data below to highlight regions in document",
                      });
                    }}
                    data-testid="button-toggle-bboxes"
                    className="gap-2"
                  >
                    <Target className="w-4 h-4" />
                    {showBoundingBoxes ? 'Hide Regions' : 'Show Regions'}
                  </Button>
                </div>

                {/* Enhanced Extraction Results with Visual Grounding */}
                {latestJob?.id ? (
                  <ExtractionResults 
                    jobId={latestJob.id}
                    onRegionHighlight={handleRegionHighlight}
                    onShowBoundingBoxes={handleShowBoundingBoxes}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center py-8 text-muted-foreground" data-testid="no-results">
                        No extraction results available
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="extract" className="flex-1 flex flex-col m-0">
              <div className="flex-1 overflow-hidden" data-testid="extract-tab-content">
                {latestJob?.status === 'completed' && latestJob.result ? (
                  <VisualGroundingInterface
                    extractionResult={latestJob.result as ExtractionResult}
                    onRegionHighlight={handleRegionHighlight}
                    highlightedRegion={highlightedRegion}
                    onCoordinateClick={handleCoordinateClick}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {latestJob?.status === 'processing' ? (
                      <div>
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        Processing document for visual grounding...
                      </div>
                    ) : (
                      "No extraction results available for visual grounding"
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="analyze" className="flex-1 flex flex-col m-0">
              <div className="flex-1 overflow-hidden" data-testid="analyze-tab-content">
                {latestJob?.status === 'completed' && latestJob.result ? (
                  <PerfectExtractionDashboard
                    extractionResult={latestJob.result as ExtractionResult}
                    processingTime={latestJob.completedAt && latestJob.createdAt ? 
                      new Date(latestJob.completedAt).getTime() - new Date(latestJob.createdAt).getTime() : 0}
                    documentMetrics={(latestJob.result as ExtractionResult).metadata}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {latestJob?.status === 'processing' ? (
                      <div>
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        Analyzing document metrics...
                      </div>
                    ) : (
                      "No extraction results available for analysis"
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bbox" className="flex-1 flex flex-col m-0">
              <div className="flex-1 overflow-hidden" data-testid="bbox-tab-content">
                {latestJob?.status === 'completed' && latestJob.result ? (
                  <BoundingBoxViewer
                    documentUrl={getDocumentUrl(document)}
                    extractionResult={latestJob.result as ExtractionResult}
                    documentWidth={getDocumentDimensions().width}
                    documentHeight={getDocumentDimensions().height}
                    onRegionHover={handleRegionHighlight}
                    onRegionClick={(regionId, regionType) => {
                      setHighlightedRegion({ id: regionId, type: regionType });
                      // Optionally switch to extract tab to show grounding
                      setActiveTab('extract');
                    }}
                    highlightedRegion={highlightedRegion}
                  />
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {latestJob?.status === 'processing' ? (
                      <div>
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        Processing bounding box analysis...
                      </div>
                    ) : (
                      "No extraction results available for bounding box visualization"
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="chunks" className="flex-1 flex flex-col m-0">
              <div className="flex-1 overflow-hidden" data-testid="chunks-tab-content">
                {latestJob?.status === 'completed' && latestJob.result ? (
                  <div className="h-full flex flex-col">
                    {/* Text Chunk Toggle Controls */}
                    <div className="p-4 border-b border-border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium">Text Chunk Highlighting</h3>
                          <Badge variant="secondary" className="text-xs">
                            Landing AI Style
                          </Badge>
                        </div>
                        <Button
                          variant={showTextChunkOverlay ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setShowTextChunkOverlay(!showTextChunkOverlay);
                            toast({
                              title: showTextChunkOverlay ? "Text chunks hidden" : "Text chunks visible",
                              description: showTextChunkOverlay 
                                ? "Chunk overlays are now hidden on the document" 
                                : "Click on chunks below to highlight them on the document",
                            });
                          }}
                          data-testid="button-toggle-text-chunks"
                          className="gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          {showTextChunkOverlay ? 'Hide Chunks' : 'Show Chunks'}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Text Chunk Highlighter Component */}
                    <div className="flex-1 overflow-hidden">
                      <TextChunkHighlighter
                        extractionResult={latestJob.result as ExtractionResult}
                        documentDimensions={getDocumentDimensions()}
                        onChunkHighlight={handleChunkHighlight}
                        onChunkClick={handleChunkClick}
                        highlightedChunk={highlightedChunk}
                        currentPage={currentPage - 1}
                        showConfidence={true}
                        className="h-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {latestJob?.status === 'processing' ? (
                      <div>
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        Processing text chunk analysis...
                      </div>
                    ) : (
                      "No extraction results available for text chunk highlighting"
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              <div className="p-4 text-center text-muted-foreground" data-testid="chat-tab-content">
                Chat functionality coming soon...
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}