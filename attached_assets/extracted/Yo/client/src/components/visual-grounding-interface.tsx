import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  MapPin, 
  Eye, 
  Copy, 
  Download,
  Crosshair,
  MousePointer2,
  Info,
  Layers
} from "lucide-react";
import { ExtractionResult, BoundingBox, KeyValuePair, Block, Line as LineType, Word, Table as TableType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface VisualGroundingInterfaceProps {
  extractionResult: ExtractionResult;
  onRegionHighlight?: (regionId: string | null, regionType: string) => void;
  highlightedRegion?: { id: string; type: string } | null;
  onCoordinateClick?: (bbox: BoundingBox) => void;
}

interface GroundedElement {
  id: string;
  type: 'table' | 'text' | 'object' | 'key_value' | 'semantic';
  content: any;
  bbox?: BoundingBox;
  confidence?: number;
  sourceRegion?: string;
}

export default function VisualGroundingInterface({
  extractionResult,
  onRegionHighlight,
  highlightedRegion,
  onCoordinateClick
}: VisualGroundingInterfaceProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'data' | 'coordinates' | 'trace'>('data');
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Extract grounded elements from extraction result
  const extractGroundedElements = (): GroundedElement[] => {
    const elements: GroundedElement[] = [];

    // Process tables with bounding boxes
    if (extractionResult.tables) {
      extractionResult.tables.forEach((table, index) => {
        // Check if this table has coordinate information
        const ir = extractionResult.intermediate_representation;
        const tableWithCoords = ir?.pages?.[0]?.tables?.find((t: TableType) => 
          t.title === table.title || t.id === `table-${index}`
        );

        elements.push({
          id: `table-${index}`,
          type: 'table',
          content: table,
          bbox: tableWithCoords?.bbox,
          confidence: table.confidence || tableWithCoords?.confidence,
          sourceRegion: `Page 1, Table ${index + 1}`,
        });
      });
    }

    // Process text blocks with coordinates
    if (extractionResult.intermediate_representation?.pages?.[0]?.blocks) {
      extractionResult.intermediate_representation.pages[0].blocks.forEach((block: Block, index: number) => {
        const blockText = block.lines?.map((l: LineType) => l.words.map((w: Word) => w.text).join(' ')).join('\n') || '';
        if (blockText && blockText.trim()) {
          elements.push({
            id: `block-${index}`,
            type: 'text',
            content: { text: blockText, blockType: block.type },
            bbox: block.bbox,
            confidence: block.confidence,
            sourceRegion: `Page 1, Block ${index + 1}`,
          });
        }
      });
    }

    // Process objects with coordinates
    if (extractionResult.objects) {
      extractionResult.objects.forEach((obj: { label: string; confidence: number; description?: string; category?: string; bbox?: BoundingBox; }, index: number) => {
        elements.push({
          id: `object-${index}`,
          type: 'object',
          content: obj,
          bbox: obj.bbox,
          confidence: obj.confidence,
          sourceRegion: `Page 1, Object ${index + 1}`,
        });
      });
    }

    // Process key-value pairs with coordinates
    if (extractionResult.intermediate_representation?.pages?.[0]?.keyValuePairs) {
      extractionResult.intermediate_representation.pages[0].keyValuePairs.forEach((kv: KeyValuePair, index: number) => {
        elements.push({
          id: `kv-${index}`,
          type: 'key_value',
          content: kv,
          bbox: kv.key.bbox || kv.value.bbox,
          confidence: kv.key.confidence || kv.value.confidence,
          sourceRegion: `Page 1, Key-Value ${index + 1}`,
        });
      });
    }

    // Process semantic regions
    if (extractionResult.intermediate_representation?.pages?.[0]?.semanticRegions) {
      extractionResult.intermediate_representation.pages[0].semanticRegions.forEach((region: { id: string; type: string; bbox: BoundingBox; confidence: number; blockIds: string[]; }, index: number) => {
        elements.push({
          id: `semantic-${index}`,
          type: 'semantic',
          content: { type: region.type, blockIds: region.blockIds },
          bbox: region.bbox,
          confidence: region.confidence,
          sourceRegion: `Page 1, Semantic Region ${index + 1}`,
        });
      });
    }

    return elements.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  };

  const groundedElements = extractGroundedElements();

  const handleElementHover = (elementId: string | null) => {
    setHoveredElement(elementId);
    if (elementId) {
      const element = groundedElements.find(e => e.id === elementId);
      if (element) {
        onRegionHighlight?.(elementId, element.type);
      }
    } else {
      onRegionHighlight?.(null, '');
    }
  };

  const handleCoordinatesCopy = (bbox: BoundingBox) => {
    const coordsText = `x: ${bbox.x.toFixed(3)}, y: ${bbox.y.toFixed(3)}, width: ${bbox.width.toFixed(3)}, height: ${bbox.height.toFixed(3)}`;
    navigator.clipboard.writeText(coordsText);
    toast({
      title: "Coordinates copied",
      description: "Bounding box coordinates copied to clipboard",
    });
  };

  const handleElementClick = (element: GroundedElement) => {
    if (element.bbox) {
      onCoordinateClick?.(element.bbox);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'table': return '📊';
      case 'text': return '📝';
      case 'object': return '🎯';
      case 'key_value': return '🔑';
      case 'semantic': return '🧠';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'table': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'text': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'object': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'key_value': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'semantic': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const renderElementContent = (element: GroundedElement) => {
    switch (element.type) {
      case 'table':
        return (
          <div className="space-y-2">
            <div className="font-medium">{element.content.title || 'Untitled Table'}</div>
            <div className="text-sm text-muted-foreground">
              {element.content.data?.length || 0} rows detected
            </div>
          </div>
        );
      
      case 'text':
        return (
          <div className="space-y-2">
            <div className="text-sm line-clamp-3">{element.content.text}</div>
            {element.content.blockType && (
              <Badge variant="outline" className="text-xs">
                {element.content.blockType}
              </Badge>
            )}
          </div>
        );
      
      case 'object':
        return (
          <div className="space-y-2">
            <div className="font-medium">{element.content.label}</div>
            {element.content.description && (
              <div className="text-sm text-muted-foreground">{element.content.description}</div>
            )}
            {element.content.category && (
              <Badge variant="outline" className="text-xs">
                {element.content.category}
              </Badge>
            )}
          </div>
        );
      
      case 'key_value':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Key:</div>
              <div>{element.content.key}</div>
              <div className="font-medium">Value:</div>
              <div>{element.content.value}</div>
            </div>
          </div>
        );
      
      case 'semantic':
        return (
          <div className="space-y-2">
            <div className="font-medium">{element.content.type}</div>
            {element.content.description && (
              <div className="text-sm text-muted-foreground">{element.content.description}</div>
            )}
          </div>
        );
      
      default:
        return <div className="text-sm">Unknown element type</div>;
    }
  };

  return (
    <Card className="h-full flex flex-col" data-testid="visual-grounding-interface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4" />
          Visual Grounding
        </CardTitle>
        
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Link extracted data to source locations
          </div>
          <Badge variant="secondary" className="text-xs">
            {groundedElements.length} elements
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0" data-testid="grounding-content">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
          <TabsList className="grid grid-cols-3 mx-4 mb-2">
            <TabsTrigger value="data" className="text-xs" data-testid="tab-data">
              <Layers className="w-3 h-3 mr-1" />
              Data
            </TabsTrigger>
            <TabsTrigger value="coordinates" className="text-xs" data-testid="tab-coordinates">
              <MapPin className="w-3 h-3 mr-1" />
              Coordinates
            </TabsTrigger>
            <TabsTrigger value="trace" className="text-xs" data-testid="tab-trace">
              <Crosshair className="w-3 h-3 mr-1" />
              Trace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="flex-1 m-0">
            <ScrollArea className="h-full px-4" ref={scrollAreaRef}>
              <div className="space-y-3" data-testid="grounded-elements">
                {groundedElements.map((element) => (
                  <Card
                    key={element.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      hoveredElement === element.id || highlightedRegion?.id === element.id
                        ? 'ring-2 ring-primary shadow-md'
                        : 'hover:shadow-sm'
                    }`}
                    onMouseEnter={() => handleElementHover(element.id)}
                    onMouseLeave={() => handleElementHover(null)}
                    onClick={() => handleElementClick(element)}
                    data-testid={`grounded-element-${element.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getTypeIcon(element.type)}</span>
                          <Badge className={`text-xs ${getTypeColor(element.type)}`}>
                            {element.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {element.confidence && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(element.confidence * 100)}%
                            </Badge>
                          )}
                          {element.bbox && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCoordinateClick?.(element.bbox!);
                              }}
                              data-testid={`locate-${element.id}`}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {renderElementContent(element)}

                      {element.sourceRegion && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {element.sourceRegion}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="coordinates" className="flex-1 m-0">
            <ScrollArea className="h-full px-4">
              <div className="space-y-3" data-testid="coordinate-list">
                {groundedElements
                  .filter(element => element.bbox)
                  .map((element) => (
                    <Card key={element.id} className="hover:shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{getTypeIcon(element.type)}</span>
                            <span className="text-sm font-medium">{element.id}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCoordinatesCopy(element.bbox!)}
                            data-testid={`copy-coords-${element.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div>X: {element.bbox!.x.toFixed(3)}</div>
                          <div>Y: {element.bbox!.y.toFixed(3)}</div>
                          <div>W: {element.bbox!.width.toFixed(3)}</div>
                          <div>H: {element.bbox!.height.toFixed(3)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="trace" className="flex-1 m-0">
            <div className="p-4 text-center">
              <div className="space-y-4">
                <Info className="w-8 h-8 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-2">Traceability Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Hover over elements in the Data tab to see their source locations on the document.
                    Click to jump to specific coordinates.
                  </p>
                </div>
                
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span>Total Elements:</span>
                      <span className="font-mono">{groundedElements.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>With Coordinates:</span>
                      <span className="font-mono">
                        {groundedElements.filter(e => e.bbox).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Confidence:</span>
                      <span className="font-mono">
                        {Math.round(
                          groundedElements
                            .filter(e => e.confidence)
                            .reduce((sum, e) => sum + (e.confidence || 0), 0) /
                          groundedElements.filter(e => e.confidence).length * 100
                        )}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}