import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Target, 
  MapPin, 
  Eye, 
  Copy, 
  Download,
  Crosshair,
  MousePointer2,
  Info,
  Layers,
  FileText,
  Table,
  AlignLeft,
  Type,
  Filter,
  Search
} from "lucide-react";
import { ExtractionResult, TextChunk, GroundingBox, Grounding } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TextChunkHighlighterProps {
  extractionResult: ExtractionResult;
  documentDimensions: { width: number; height: number };
  onChunkHighlight?: (chunkId: string | null, grounding?: Grounding) => void;
  onChunkClick?: (chunk: TextChunk) => void;
  highlightedChunk?: string | null;
  currentPage?: number;
  showConfidence?: boolean;
  className?: string;
}

interface ProcessedChunk {
  chunk: TextChunk;
  pixelCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  page: number;
  isVisible: boolean;
  groundingIndex: number; // Track which grounding region this represents
  grounding: Grounding; // Store the specific grounding for this region
}

export default function TextChunkHighlighter({
  extractionResult,
  documentDimensions,
  onChunkHighlight,
  onChunkClick,
  highlightedChunk,
  currentPage = 0,
  showConfidence = true,
  className,
}: TextChunkHighlighterProps) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<'all' | 'text' | 'table' | 'title' | 'figure'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredChunk, setHoveredChunk] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Extract and process text chunks from extraction result
  const textChunks = useMemo((): TextChunk[] => {
    if (!extractionResult) return [];

    // Use text chunks directly from the extraction result
    if (extractionResult.chunks && Array.isArray(extractionResult.chunks)) {
      return extractionResult.chunks;
    }

    // Return empty array if no chunks are available
    console.warn('No text chunks available in extraction result');
    return [];
  }, [extractionResult]);

  // Process chunks with pixel coordinates and page filtering - support multiple grounding regions
  const processedChunks = useMemo((): ProcessedChunk[] => {
    const processedList: ProcessedChunk[] = [];

    textChunks.forEach(chunk => {
      if (!chunk.grounding || chunk.grounding.length === 0) {
        processedList.push({
          chunk,
          pixelCoordinates: { x: 0, y: 0, width: 0, height: 0 },
          page: 0,
          isVisible: false,
          groundingIndex: 0,
          grounding: {} as Grounding,
        });
        return;
      }

      // Create a processed chunk for each grounding region
      chunk.grounding.forEach((grounding, groundingIndex) => {
        // Transform Landing AI coordinates (l, t, r, b) to pixel coordinates
        const pixelCoordinates = transformGroundingToPixels(
          grounding.box,
          documentDimensions.width,
          documentDimensions.height
        );

        processedList.push({
          chunk,
          pixelCoordinates,
          page: grounding.page,
          isVisible: grounding.page === currentPage,
          groundingIndex,
          grounding,
        });
      });
    });

    return processedList;
  }, [textChunks, documentDimensions, currentPage]);

  // Filter chunks based on active filter, search term, and current page
  const filteredChunks = useMemo(() => {
    return processedChunks.filter(({ chunk, isVisible }) => {
      // Page filter
      if (!isVisible) return false;

      // Type filter
      if (activeFilter !== 'all' && chunk.chunk_type !== activeFilter) return false;

      // Search filter
      if (searchTerm && !chunk.text.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [processedChunks, activeFilter, searchTerm]);

  // Handle chunk hover
  const handleChunkHover = (chunkId: string | null) => {
    setHoveredChunk(chunkId);
    if (chunkId) {
      const processedChunk = processedChunks.find(pc => pc.chunk.chunk_id === chunkId);
      if (processedChunk) {
        // For multi-region chunks, pass the grounding for the specific region
        onChunkHighlight?.(chunkId, processedChunk.grounding);
      }
    } else {
      onChunkHighlight?.(null);
    }
  };

  // Handle chunk click
  const handleChunkClick = (chunk: TextChunk) => {
    onChunkClick?.(chunk);
    
    // Auto-scroll to chunk in list if it's not highlighted
    if (highlightedChunk !== chunk.chunk_id) {
      const element = document.querySelector(`[data-chunk-id="${chunk.chunk_id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Handle copy chunk text
  const handleCopyChunk = async (chunk: TextChunk) => {
    try {
      await navigator.clipboard.writeText(chunk.text);
      toast({
        title: "Text copied",
        description: "Chunk text copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  // Get chunk type icon
  const getChunkTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="w-3 h-3" />;
      case 'table': return <Table className="w-3 h-3" />;
      case 'title': return <Type className="w-3 h-3" />;
      case 'figure': return <Target className="w-3 h-3" />;
      case 'list': return <AlignLeft className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  // Get chunk type color
  const getChunkTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'table': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'title': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'figure': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'list': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Get statistics
  const stats = useMemo(() => {
    const total = textChunks.length;
    const visible = filteredChunks.length;
    const confidence = filteredChunks.reduce((sum, pc) => sum + (pc.chunk.confidence || 0), 0) / Math.max(visible, 1);
    
    return { total, visible, confidence };
  }, [textChunks, filteredChunks]);

  return (
    <Card className={cn("h-full flex flex-col", className)} data-testid="text-chunk-highlighter">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4" />
          Text Chunk Highlighting
          <Badge variant="secondary" className="ml-auto" data-testid="badge-chunk-count">
            {stats.visible}/{stats.total}
          </Badge>
        </CardTitle>

        {/* Filter Controls */}
        <div className="space-y-3">
          <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as any)}>
            <TabsList className="grid grid-cols-5 h-8">
              <TabsTrigger value="all" className="text-xs" data-testid="filter-all">All</TabsTrigger>
              <TabsTrigger value="text" className="text-xs" data-testid="filter-text">Text</TabsTrigger>
              <TabsTrigger value="table" className="text-xs" data-testid="filter-table">Table</TabsTrigger>
              <TabsTrigger value="title" className="text-xs" data-testid="filter-title">Title</TabsTrigger>
              <TabsTrigger value="figure" className="text-xs" data-testid="filter-figure">Figure</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-overlay"
                checked={showOverlay}
                onCheckedChange={setShowOverlay}
                data-testid="switch-overlay"
              />
              <Label htmlFor="show-overlay" className="text-xs">Show overlay</Label>
            </div>
            
            <div className="text-xs text-muted-foreground" data-testid="text-confidence">
              Avg: {Math.round(stats.confidence * 100)}%
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chunks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-background"
              data-testid="input-search"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef} data-testid="scroll-chunk-list">
          <div className="p-4 space-y-2">
            {filteredChunks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-chunks">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No text chunks found</p>
                <p className="text-xs">Try adjusting your filters</p>
              </div>
            ) : (
              filteredChunks.map(({ chunk }) => (
                <div
                  key={chunk.chunk_id}
                  data-chunk-id={chunk.chunk_id}
                  className={cn(
                    "group relative p-3 rounded-lg border border-border transition-all duration-200 cursor-pointer",
                    "hover:border-primary/50 hover:bg-muted/50",
                    highlightedChunk === chunk.chunk_id && "border-primary bg-primary/5 ring-1 ring-primary/20",
                    hoveredChunk === chunk.chunk_id && "bg-muted/30"
                  )}
                  onMouseEnter={() => handleChunkHover(chunk.chunk_id)}
                  onMouseLeave={() => handleChunkHover(null)}
                  onClick={() => handleChunkClick(chunk)}
                  data-testid={`chunk-${chunk.chunk_id}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getChunkTypeColor(chunk.chunk_type))}
                        data-testid={`badge-type-${chunk.chunk_type}`}
                      >
                        {getChunkTypeIcon(chunk.chunk_type)}
                        {chunk.chunk_type}
                      </Badge>
                      
                      {chunk.semantic_role && (
                        <Badge variant="secondary" className="text-xs" data-testid="badge-semantic-role">
                          {chunk.semantic_role}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyChunk(chunk);
                        }}
                        data-testid={`button-copy-${chunk.chunk_id}`}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChunkClick(chunk);
                        }}
                        data-testid={`button-locate-${chunk.chunk_id}`}
                      >
                        <Crosshair className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <p className="text-sm text-foreground leading-relaxed line-clamp-3" data-testid="text-chunk-content">
                      {chunk.text}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span data-testid="text-chunk-id">ID: {chunk.chunk_id.split('-').pop()}</span>
                        {chunk.grounding && (
                          <span data-testid="text-page-number">
                            Page {chunk.grounding[0]?.page + 1}
                          </span>
                        )}
                      </div>
                      
                      {showConfidence && chunk.confidence && (
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          data-testid="badge-confidence"
                        >
                          {Math.round(chunk.confidence * 100)}%
                        </Badge>
                      )}
                    </div>

                    {/* Coordinates info (shown on hover) */}
                    {hoveredChunk === chunk.chunk_id && chunk.grounding && (
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2" data-testid="text-coordinates">
                        <div className="font-medium mb-1">Coordinates:</div>
                        <div className="font-mono">
                          L: {chunk.grounding[0].box.l.toFixed(3)}, 
                          T: {chunk.grounding[0].box.t.toFixed(3)}, 
                          R: {chunk.grounding[0].box.r.toFixed(3)}, 
                          B: {chunk.grounding[0].box.b.toFixed(3)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Utility functions

/**
 * Transform Landing AI grounding coordinates (l, t, r, b) to pixel coordinates
 */
function transformGroundingToPixels(
  grounding: GroundingBox,
  documentWidth: number,
  documentHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(grounding.l * documentWidth),
    y: Math.round(grounding.t * documentHeight),
    width: Math.round((grounding.r - grounding.l) * documentWidth),
    height: Math.round((grounding.b - grounding.t) * documentHeight),
  };
}

/**
 * Map block types to chunk types
 */
function mapBlockTypeToChunkType(blockType: string): TextChunk['chunk_type'] {
  const mapping: { [key: string]: TextChunk['chunk_type'] } = {
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
}