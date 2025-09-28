import { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  Search
} from 'lucide-react';
import { TextChunk as LegacyTextChunk, PageData } from './PDFProcessor';
import { TextChunk, Grounding, transformGroundingToPixels, LegacyPageData } from '@/types';

interface DocumentViewerProps {
  pages: PageData[] | LegacyPageData[];
  highlightedChunk: string | null;
  onChunkClick: (chunkId: string) => void;
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
  // Enhanced props for new TextChunk format
  highlightedGrounding?: Grounding | null;
  documentDimensions?: { width: number; height: number };
}

const DocumentViewer = ({ 
  pages, 
  highlightedChunk, 
  onChunkClick, 
  currentPage, 
  onPageChange,
  highlightedGrounding,
  documentDimensions 
}: DocumentViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const currentPageData = pages.find(p => p.pageNumber === currentPage);
  const totalPages = pages.length;

  useEffect(() => {
    if (imageRef.current && imageLoaded) {
      setImageDimensions({ 
        width: imageRef.current.offsetWidth, 
        height: imageRef.current.offsetHeight 
      });
    }
  }, [imageLoaded, zoom, currentPage]);

  useEffect(() => {
    // Reset zoom when changing pages
    setImageLoaded(false);
    setZoom(1);
  }, [currentPage]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (imageRef.current) {
      setImageDimensions({ 
        width: imageRef.current.offsetWidth, 
        height: imageRef.current.offsetHeight 
      });
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleDownload = () => {
    if (currentPageData) {
      const link = document.createElement('a');
      link.download = `page-${currentPage}.png`;
      link.href = currentPageData.imageUrl;
      link.click();
    }
  };

  const navigateToChunk = (chunkId: string) => {
    // Find which page contains this chunk
    const targetPage = pages.find(page => 
      page.textChunks.some(chunk => chunk.id === chunkId)
    );
    
    if (targetPage && targetPage.pageNumber !== currentPage) {
      onPageChange(targetPage.pageNumber);
    }
    
    // Highlight the chunk
    onChunkClick(chunkId);
    
    // Scroll to the chunk after a short delay to ensure page is loaded
    setTimeout(() => {
      const chunkElement = document.querySelector(`[data-chunk-id="${chunkId}"]`);
      if (chunkElement && containerRef.current) {
        chunkElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }
    }, 300);
  };

  const getBoundingBoxStyle = (chunk: LegacyTextChunk) => {
    if (!imageLoaded || !imageDimensions.width || !imageDimensions.height) {
      return { display: 'none' };
    }

    // Handle legacy coordinate system (percentage 0-100)
    const x = (chunk.geometry.x / 100) * imageDimensions.width;
    const y = (chunk.geometry.y / 100) * imageDimensions.height;
    const width = (chunk.geometry.w / 100) * imageDimensions.width;
    const height = (chunk.geometry.h / 100) * imageDimensions.height;

    const isHighlighted = highlightedChunk === chunk.id;

    return {
      position: 'absolute' as const,
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: isHighlighted 
        ? '3px solid #22c55e' // Green color for highlighting
        : '1px solid hsl(var(--bounding-box-stroke) / 0.6)',
      backgroundColor: isHighlighted 
        ? 'rgba(34, 197, 94, 0.2)' // Green background for highlighting
        : 'hsl(var(--bounding-box-fill) / 0.1)',
      cursor: 'pointer',
      transition: 'var(--transition-smooth)',
      borderRadius: '2px',
      boxShadow: isHighlighted 
        ? '0 0 0 1px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3)' 
        : 'none',
      zIndex: isHighlighted ? 20 : 10,
      transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
      transformOrigin: 'center',
    };
  };

  // Enhanced function to handle new TextChunk format with grounding
  const getGroundingBoxStyle = () => {
    if (!highlightedGrounding || !imageLoaded || !imageDimensions.width || !imageDimensions.height || !documentDimensions) {
      console.log('📦 DocumentViewer: Cannot show grounding box', {
        hasHighlightedGrounding: !!highlightedGrounding,
        imageLoaded,
        imageDimensions,
        documentDimensions
      });
      return { display: 'none' };
    }

    // Use the enhanced coordinate transformation for new format
    const pixelCoords = transformGroundingToPixels(
      highlightedGrounding.box,
      imageDimensions.width,
      imageDimensions.height
    );
    
    console.log('💚 DocumentViewer: Creating green bounding box', {
      highlightedGrounding,
      imageDimensions,
      pixelCoords,
      groundingBox: highlightedGrounding.box
    });

    return {
      position: 'absolute' as const,
      left: `${pixelCoords.x}px`,
      top: `${pixelCoords.y}px`,
      width: `${pixelCoords.width}px`,
      height: `${pixelCoords.height}px`,
      border: '3px solid #22c55e', // Green color for highlighting
      backgroundColor: 'rgba(34, 197, 94, 0.2)', // Green background
      cursor: 'pointer',
      transition: 'var(--transition-smooth)',
      borderRadius: '2px',
      boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3)',
      zIndex: 20,
      transform: 'scale(1.02)',
      transformOrigin: 'center',
      pointerEvents: 'none' as const, // Allow click-through since this is just a highlight overlay
    };
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (!currentPageData) {
    return (
      <Card className="p-8 bg-viewer-background border-viewer-border">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Document Loaded</h3>
          <p className="text-muted-foreground">Upload a PDF file to get started</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-viewer-background border-viewer-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-viewer-border bg-viewer-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-pdf-primary" />
            <h3 className="text-lg font-semibold text-foreground">Document Viewer</h3>
            <Badge variant="secondary" className="bg-pdf-primary/10 text-pdf-primary">
              {currentPageData.textChunks.length} text regions
            </Badge>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="hover:bg-pdf-primary/10"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="hover:bg-pdf-primary/10"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="hover:bg-pdf-primary/10"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="hover:bg-pdf-primary/10"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Page Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="hover:bg-pdf-primary/10"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Page</span>
              <span className="font-semibold text-pdf-primary">{currentPage}</span>
              <span className="text-sm text-muted-foreground">of {totalPages}</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="hover:bg-pdf-primary/10"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="p-4">
        <div 
          ref={containerRef}
          className="relative overflow-auto max-h-[70vh] bg-white rounded-lg border-2 border-viewer-border shadow-inner"
          style={{ maxWidth: '100%' }}
        >
          <div style={{ 
            transform: `scale(${zoom})`, 
            transformOrigin: 'top left', 
            position: 'relative',
            transition: 'var(--transition-smooth)'
          }}>
            <img
              ref={imageRef}
              src={currentPageData.imageUrl}
              alt={`Document page ${currentPage}`}
              className="block max-w-full h-auto"
              onLoad={handleImageLoad}
              style={{ display: 'block' }}
            />
            
            {/* Legacy bounding boxes overlay (for PageData format) */}
            {imageLoaded && currentPageData && 'textChunks' in currentPageData && currentPageData.textChunks.map((chunk) => (
              <div
                key={chunk.id}
                data-chunk-id={chunk.id}
                style={getBoundingBoxStyle(chunk)}
                onClick={() => navigateToChunk(chunk.id)}
                onMouseEnter={(e) => {
                  if (highlightedChunk !== chunk.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.8)';
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (highlightedChunk !== chunk.id) {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--bounding-box-fill) / 0.1)';
                    e.currentTarget.style.borderColor = 'hsl(var(--bounding-box-stroke) / 0.6)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
                title={`Page ${chunk.pageNumber}: ${chunk.text}`}
              />
            ))}

            {/* Enhanced grounding overlay (for new TextChunk format) */}
            {imageLoaded && highlightedGrounding && (
              <div
                data-testid="grounding-highlight"
                style={getGroundingBoxStyle()}
                title="Highlighted text region"
              />
            )}
          </div>
        </div>

        {/* Status Footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>
              {highlightedChunk 
                ? 'Click highlighted region to deselect' 
                : 'Click any text region to highlight it'
              }
            </span>
          </div>
          
          {highlightedChunk && (
            <Badge variant="secondary" className="bg-highlight-primary/10 text-highlight-primary">
              Region selected
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};

export default DocumentViewer;