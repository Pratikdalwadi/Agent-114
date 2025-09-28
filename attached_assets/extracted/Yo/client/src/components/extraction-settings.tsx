import { useState } from "react";
import { Brain, Key, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ExtractionSettings as ExtractionSettingsType } from "@/types/api";

interface ExtractionSettingsProps {
  settings: ExtractionSettingsType;
  documentId: string;
  onExtractionStart: (jobId: string) => void;
}

export default function ExtractionSettings({
  settings: initialSettings,
  documentId,
  onExtractionStart,
}: ExtractionSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ExtractionSettingsType>(initialSettings);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const startExtractionMutation = useMutation({
    mutationFn: api.startExtraction,
    onSuccess: (data) => {
      toast({
        title: "Extraction started",
        description: "Your document is being processed with AI",
      });
      onExtractionStart(data.job.id);
      queryClient.invalidateQueries({ queryKey: ['/api/extraction'] });
    },
    onError: (error) => {
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartExtraction = () => {
    if (!documentId) {
      toast({
        title: "No document selected",
        description: "Please select a document first",
        variant: "destructive",
      });
      return;
    }

    // Validate API key requirement
    if (settings.aiProvider === 'openai' && !settings.openaiApiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenAI API key to proceed with extraction.",
        variant: "destructive",
      });
      return;
    }
    
    if (settings.aiProvider === 'gemini' && !settings.geminiApiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your Gemini API key to proceed with extraction.",
        variant: "destructive",
      });
      return;
    }

    startExtractionMutation.mutate({
      documentId,
      ...settings,
    });
  };

  const updateSettings = (updates: Partial<ExtractionSettingsType>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <Card data-testid="card-extraction-settings">
      <CardHeader>
        <CardTitle>Extraction Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Output Format */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Output Format</Label>
          <RadioGroup
            value={settings.outputFormat}
            onValueChange={(value: 'json' | 'csv' | 'markdown') => 
              updateSettings({ outputFormat: value })
            }
            className="grid grid-cols-3 gap-2"
            data-testid="radio-group-output-format"
          >
            <div className="flex items-center space-x-2 p-3 border border-border rounded-md hover:bg-muted cursor-pointer">
              <RadioGroupItem value="json" id="format-json" data-testid="radio-json" />
              <Label htmlFor="format-json" className="text-sm font-medium cursor-pointer">
                JSON
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border border-border rounded-md hover:bg-muted cursor-pointer">
              <RadioGroupItem value="csv" id="format-csv" data-testid="radio-csv" />
              <Label htmlFor="format-csv" className="text-sm font-medium cursor-pointer">
                CSV
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border border-border rounded-md hover:bg-muted cursor-pointer">
              <RadioGroupItem value="markdown" id="format-markdown" data-testid="radio-markdown" />
              <Label htmlFor="format-markdown" className="text-sm font-medium cursor-pointer">
                Markdown
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Extraction Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Extraction Mode</Label>
          <Select
            value={settings.extractionMode}
            onValueChange={(value: 'smart_table' | 'full_text' | 'form_fields' | 'custom' | 'smart_image' | 'automatic_schema' | 'comprehensive' | 'vlm_layout_aware' | 'automated_box_detection' | 'hierarchical_structure_analysis' | 'visual_grounding') =>
              updateSettings({ extractionMode: value })
            }
            data-testid="select-extraction-mode"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smart_table">Smart Table Detection</SelectItem>
              <SelectItem value="full_text">Full Text Extraction</SelectItem>
              <SelectItem value="form_fields">Form Field Detection</SelectItem>
              <SelectItem value="smart_image">Smart Image Object Detection</SelectItem>
              <SelectItem value="automatic_schema">Automatic Schema Generation</SelectItem>
              <SelectItem value="comprehensive">Comprehensive (All Features)</SelectItem>
              <SelectItem value="vlm_layout_aware">VLM Layout-Aware Processing</SelectItem>
              <SelectItem value="automated_box_detection">🎯 Automated Box Detection</SelectItem>
              <SelectItem value="hierarchical_structure_analysis">📊 Hierarchical Structure Analysis</SelectItem>
              <SelectItem value="visual_grounding">🔗 Visual Grounding</SelectItem>
              <SelectItem value="custom">Custom Schema</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* API Key Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Key Configuration
          </Label>
          
          {/* OpenAI API Key */}
          {settings.aiProvider === 'openai' && (
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-sm text-muted-foreground">
                OpenAI API Key
              </Label>
              <div className="relative">
                <Input
                  id="openai-key"
                  type={showOpenAIKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={settings.openaiApiKey || ""}
                  onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                  className="pr-10"
                  data-testid="input-openai-api-key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  data-testid="button-toggle-openai-visibility"
                >
                  {showOpenAIKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Gemini API Key */}
          {settings.aiProvider === 'gemini' && (
            <div className="space-y-2">
              <Label htmlFor="gemini-key" className="text-sm text-muted-foreground">
                Gemini API Key
              </Label>
              <div className="relative">
                <Input
                  id="gemini-key"
                  type={showGeminiKey ? "text" : "password"}
                  placeholder="Enter your Gemini API key..."
                  value={settings.geminiApiKey || ""}
                  onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                  className="pr-10"
                  data-testid="input-gemini-api-key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  data-testid="button-toggle-gemini-visibility"
                >
                  {showGeminiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Your API key is used only for this extraction and is not stored on our servers.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="preserve-formatting"
              checked={settings.preserveFormatting}
              onCheckedChange={(checked) =>
                updateSettings({ preserveFormatting: Boolean(checked) })
              }
              data-testid="checkbox-preserve-formatting"
            />
            <Label htmlFor="preserve-formatting" className="text-sm">
              Preserve table structure and formatting
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="include-confidence"
              checked={settings.includeConfidence}
              onCheckedChange={(checked) =>
                updateSettings({ includeConfidence: Boolean(checked) })
              }
              data-testid="checkbox-include-confidence"
            />
            <Label htmlFor="include-confidence" className="text-sm">
              Include confidence scores
            </Label>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleStartExtraction}
          disabled={!documentId || startExtractionMutation.isPending}
          data-testid="button-start-extraction"
        >
          <Brain className="w-4 h-4 mr-2" />
          {startExtractionMutation.isPending ? "Starting..." : "Start AI Extraction"}
        </Button>
      </CardContent>
    </Card>
  );
}
