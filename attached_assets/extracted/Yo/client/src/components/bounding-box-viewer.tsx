import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Eye, 
  EyeOff, 
  Target, 
  Box, 
  Type, 
  AlignLeft, 
  FileText, 
  Table, 
  Brain,
  Zap,
  Info
} from "lucide-react";
import { BoundingBox, Word, Line as LineType, Block, Table as TableType, ExtractionResult } from "@shared/schema";

interface BoundingBoxViewerProps {
  documentUrl: string;
  extractionResult?: ExtractionResult;
  documentWidth: number;
  documentHeight: number;
  onRegionHover?: (regionId: string | null, regionType: string) => void;
  onRegionClick?: (regionId: string, regionType: string) => void;
  highlightedRegion?: { id: string; type: string } | null;
}

type VisualizationLevel = 'words' | 'lines' | 'blocks' | 'tables' | 'semantic' | 'all';

interface RegionData {
  id: string;
  type: 'word' | 'line' | 'block' | 'table' | 'semantic';
  bbox: BoundingBox;
  content: string;
  confidence?: number;
  semanticType?: string;
}

const levelColors = {
  word: 'rgba(59, 130, 246, 0.3)', // blue
  line: 'rgba(16, 185, 129, 0.3)', // emerald
  block: 'rgba(245, 158, 11, 0.3)', // amber
  table: 'rgba(239, 68, 68, 0.3)', // red
  semantic: 'rgba(147, 51, 234, 0.3)', // purple
};

const levelBorderColors = {
  word: 'rgb(59, 130, 246)',
  line: 'rgb(16, 185, 129)',
  block: 'rgb(245, 158, 11)',
  table: 'rgb(239, 68, 68)',
  semantic: 'rgb(147, 51, 234)',
};

export default function BoundingBoxViewer({
  documentUrl,
  extractionResult,
  documentWidth,
  documentHeight,
  onRegionHover,
  onRegionClick,
  highlightedRegion
}: BoundingBoxViewerProps) {
  const [activeLevel, setActiveLevel] = useState<VisualizationLevel>('blocks');
  const [showConfidence, setShowConfidence] = useState(true);
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(new Set(['blocks']));
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  // Extract regions from extraction result
  const extractRegions = (): RegionData[] => {
    if (!extractionResult?.intermediate_representation?.pages) return [];

    const regions: RegionData[] = [];
    const pages = extractionResult.intermediate_representation.pages;

    // Process each page (for now, just use the first page)
    const page = pages[0];
    if (!page) return [];

    // Add words
    if (page.words) {
      page.words.forEach((word: Word, index: number) => {
        regions.push({
          id: `word-${index}`,
          type: 'word',
          bbox: word.bbox,
          content: word.text,
          confidence: word.confidence,
        });
      });
    }

    // Add lines
    if (page.lines) {
      page.lines.forEach((line: LineType, index: number) => {
        regions.push({
          id: `line-${index}`,
          type: 'line',
          bbox: line.bbox,
          content: line.words?.map((w: Word) => w.text).join(' ') || '',
          confidence: line.words.reduce((sum, w) => sum + w.confidence, 0) / line.words.length,
        });
      });
    }

    // Add blocks
    if (page.blocks) {
      page.blocks.forEach((block: Block, index: number) => {
        regions.push({
          id: `block-${index}`,
          type: 'block',
          bbox: block.bbox,
          content: block.lines?.map((l: LineType) => l.words.map((w: Word) => w.text).join(' ')).join('\n') || '',
          confidence: block.confidence,
          semanticType: block.type,
        });
      });
    }

    // Add tables
    if (page.tables) {
      page.tables.forEach((table: TableType, index: number) => {
        regions.push({
          id: `table-${index}`,
          type: 'table',
          bbox: table.bbox,
          content: `Table (${table.rows}x${table.cols})`,
          confidence: table.confidence,
        });
      });
    }

    // Add semantic regions
    if (page.semanticRegions) {
      page.semanticRegions.forEach((region: { id: string; type: string; bbox: BoundingBox; confidence: number; }, index: number) => {
        regions.push({
          id: `semantic-${index}`,
          type: 'semantic',
          bbox: region.bbox,
          content: region.type || 'Semantic Region',
          confidence: region.confidence,
          semanticType: region.type,
        });
      });
    }

    return regions;
  };

  const regions = extractRegions();

  const toggleLevel = (level: string) => {
    const newVisibleLevels = new Set(visibleLevels);
    if (newVisibleLevels.has(level)) {
      newVisibleLevels.delete(level);
    } else {
      newVisibleLevels.add(level);
    }
    setVisibleLevels(newVisibleLevels);
  };

  const getFilteredRegions = () => {
    if (activeLevel === 'all') {
      return regions.filter(region => visibleLevels.has(region.type));
    }
    return regions.filter(region => region.type === activeLevel);
  };

  const handleRegionMouseEnter = (region: RegionData) => {
    setHoveredRegion(region.id);
    onRegionHover?.(region.id, region.type);
  };

  const handleRegionMouseLeave = () => {
    setHoveredRegion(null);
    onRegionHover?.(null, '');
  };

  const handleRegionClick = (region: RegionData) => {
    onRegionClick?.(region.id, region.type);
  };

  // Calculate scale factor to fit the document in the container
  const scaleX = containerSize.width / documentWidth;
  const scaleY = containerSize.height / documentHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  const scaledWidth = documentWidth * scale;
  const scaledHeight = documentHeight * scale;

  const filteredRegions = getFilteredRegions();

  return (
    <Card className="h-full flex flex-col" data-testid="bounding-box-viewer">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4" />
          Bounding Box Analysis
        </CardTitle>
        
        {/* Level Tabs */}
        <Tabs value={activeLevel} onValueChange={(value) => setActiveLevel(value as VisualizationLevel)}>
          <TabsList className="grid grid-cols-6 w-full text-xs">
            <TabsTrigger value="words" className="text-xs" data-testid="tab-words">
              <Type className="w-3 h-3 mr-1" />
              Words
            </TabsTrigger>
            <TabsTrigger value="lines" className="text-xs" data-testid="tab-lines">
              <AlignLeft className="w-3 h-3 mr-1" />
              Lines
            </TabsTrigger>
            <TabsTrigger value="blocks" className="text-xs" data-testid="tab-blocks">
              <Box className="w-3 h-3 mr-1" />
              Blocks
            </TabsTrigger>
            <TabsTrigger value="tables" className="text-xs" data-testid="tab-tables">
              <Table className="w-3 h-3 mr-1" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="semantic" className="text-xs" data-testid="tab-semantic">
              <Brain className="w-3 h-3 mr-1" />
              Semantic
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
              <Zap className="w-3 h-3 mr-1" />
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-confidence"
                checked={showConfidence}
                onCheckedChange={setShowConfidence}
                data-testid="switch-confidence"
              />
              <Label htmlFor="show-confidence" className="text-xs">Show Confidence</Label>
            </div>
            
            {activeLevel === 'all' && (
              <div className="flex items-center space-x-2">
                {['words', 'lines', 'blocks', 'tables', 'semantic'].map((level) => (
                  <Button
                    key={level}
                    variant={visibleLevels.has(level) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleLevel(level)}
                    className="h-6 px-2 text-xs"
                    data-testid={`toggle-${level}`}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            )}
          </div>
          
          <Badge variant="secondary" className="text-xs">
            {filteredRegions.length} regions
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0" data-testid="bbox-content">
        <div 
          ref={containerRef}
          className="relative w-full h-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
          style={{ minHeight: '400px' }}
        >
          {/* Document Image */}
          <img
            src={documentUrl}
            alt="Document"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: scaledWidth,
              height: scaledHeight,
              maxWidth: '100%',
              maxHeight: '100%',
            }}
            data-testid="document-image"
          />

          {/* Bounding Box Overlays */}
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: scaledWidth,
              height: scaledHeight,
            }}
          >
            {filteredRegions.map((region) => {
              const isHighlighted = highlightedRegion?.id === region.id;
              const isHovered = hoveredRegion === region.id;
              
              return (
                <div
                  key={region.id}
                  className="absolute cursor-pointer transition-all duration-200"
                  style={{
                    left: `${region.bbox.x * 100}%`,
                    top: `${region.bbox.y * 100}%`,
                    width: `${region.bbox.width * 100}%`,
                    height: `${region.bbox.height * 100}%`,
                    backgroundColor: isHighlighted || isHovered 
                      ? levelColors[region.type]
                      : `${levelColors[region.type]}80`,
                    border: `2px solid ${levelBorderColors[region.type]}`,
                    borderStyle: isHighlighted ? 'solid' : 'dashed',
                    transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                    zIndex: isHighlighted || isHovered ? 10 : 1,
                  }}
                  onMouseEnter={() => handleRegionMouseEnter(region)}
                  onMouseLeave={handleRegionMouseLeave}
                  onClick={() => handleRegionClick(region)}
                  data-testid={`bbox-${region.type}-${region.id}`}
                >
                  {/* Confidence Badge */}
                  {showConfidence && region.confidence && (
                    <div
                      className="absolute -top-6 left-0 bg-black text-white text-xs px-1 py-0.5 rounded"
                      style={{ fontSize: '10px' }}
                    >
                      {Math.round(region.confidence * 100)}%
                    </div>
                  )}

                  {/* Content Tooltip on Hover */}
                  {isHovered && (
                    <div
                      className="absolute bottom-full left-0 mb-2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap max-w-xs truncate"
                      style={{ fontSize: '10px', zIndex: 20 }}
                    >
                      <div className="font-semibold">{region.type.toUpperCase()}</div>
                      <div>{region.content}</div>
                      {region.semanticType && (
                        <div className="text-gray-300">Type: {region.semanticType}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-900 rounded-lg p-3 shadow-lg border">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Legend
            </div>
            <div className="space-y-1">
              {Object.entries(levelColors).map(([type, color]) => {
                if (activeLevel !== 'all' && activeLevel !== type) return null;
                if (activeLevel === 'all' && !visibleLevels.has(type)) return null;
                
                return (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded border"
                      style={{
                        backgroundColor: color,
                        borderColor: levelBorderColors[type as keyof typeof levelBorderColors],
                      }}
                    />
                    <span className="capitalize">{type}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* No Data Message */}
          {filteredRegions.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No {activeLevel} data available</p>
                <p className="text-xs">Run extraction with coordinate analysis enabled</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}