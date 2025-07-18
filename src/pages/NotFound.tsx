import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center mb-4">
          <div className="text-primary rounded-md p-2 bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-12 w-12" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold">Page Not Found</h1>
        <p className="text-muted-foreground">
          Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
        </p>
        
        <Button asChild className="mt-6">
          <Link to="/">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}