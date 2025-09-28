import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import DocumentPreview from "@/pages/document-preview";
import NotFound from "@/pages/not-found";
import PDFViewer from "@/components/pdf-viewer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/pdf-viewer" component={PDFViewer}/>
      <Route path="/preview/:documentId" component={DocumentPreview}/>
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
