import { Check, Clock, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ExtractionJob } from "@shared/schema";

interface ProcessingHistoryProps {
  onJobSelect: (jobId: string) => void;
}

export default function ProcessingHistory({ onJobSelect }: ProcessingHistoryProps) {
  const { toast } = useToast();

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['/api/extraction'],
    refetchInterval: 5000,
  });

  const handleDownload = async (job: ExtractionJob, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (job.status !== 'completed') return;

    try {
      const blob = await api.downloadResult(job.id, job.outputFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `extraction_${job.id}.${job.outputFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `File downloaded in ${job.outputFormat} format`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />;
      case 'failed':
        return <Clock className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100';
      case 'processing':
      case 'pending':
        return 'bg-orange-100';
      case 'failed':
        return 'bg-red-100';
      default:
        return 'bg-muted';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  };

  if (isLoading) {
    return (
      <Card data-testid="card-processing-history-loading">
        <CardHeader>
          <CardTitle>Recent Extractions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-processing-history">
      <CardHeader>
        <CardTitle>Recent Extractions</CardTitle>
      </CardHeader>
      <CardContent>
        {(jobsData as { jobs?: ExtractionJob[] })?.jobs && (jobsData as { jobs: ExtractionJob[] }).jobs.length > 0 ? (
          <div className="space-y-3">
            {(jobsData as { jobs: ExtractionJob[] }).jobs.slice(0, 5).map((job: ExtractionJob) => (
              <Link
                key={job.id}
                href={`/preview/${job.documentId}?jobId=${job.id}&tab=extract`}
                className="block"
                data-testid={`job-item-${job.id}`}
              >
                <div className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${getStatusColor(job.status)} rounded-full flex items-center justify-center`}>
                    {getStatusIcon(job.status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium" data-testid={`text-job-document-${job.id}`}>
                      Document {job.documentId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-job-time-${job.id}`}>
                      {job.status === 'processing' ? 'Processing...' : formatTimeAgo(new Date(job.createdAt))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span 
                    className="text-xs bg-muted px-2 py-1 rounded uppercase" 
                    data-testid={`badge-format-${job.id}`}
                  >
                    {job.outputFormat}
                  </span>
                  {job.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDownload(job, e)}
                      data-testid={`button-download-${job.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No extractions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a document and start extraction to see history
            </p>
          </div>
        )}

        {(jobsData as { jobs?: ExtractionJob[] })?.jobs && (jobsData as { jobs: ExtractionJob[] }).jobs.length > 5 && (
          <Button 
            variant="ghost" 
            className="w-full mt-4 text-muted-foreground hover:text-foreground"
            data-testid="button-view-all"
          >
            View all extractions
            <span className="ml-1">→</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
