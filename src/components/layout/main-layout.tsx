import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Package,
  Receipt,
  FileBarChart,
  Menu,
  X,
  LogOut,
  User,
  PackagePlus,
  FilePlus2Icon
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

interface SidebarItem {
  title: string;
  icon: React.ElementType;
  href: string;
  adminOnly?: boolean;
}

const sidebarItems: SidebarItem[] = [
  {
    title: 'Dashboard',
    icon: BarChart3,
    href: '/',
  },
  {
    title: 'Products',
    icon: Package,
    href: '/products',
  },
  {
    title: 'Purchase Planner',
    icon: FilePlus2Icon,
    href: '/purchase-planner',
  },
  {
    title: 'Sales',
    icon: Receipt,
    href: '/sales',
  },
  {
    title: 'Reports',
    icon: FileBarChart,
    href: '/reports',
  },
];

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <div className="flex flex-1">
          <aside className="hidden lg:flex w-64 flex-col border-r bg-card px-4 py-6">
            <div className="flex items-center mb-8 px-2">
              <Skeleton className="h-8 w-8 rounded mr-2" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </aside>
          <div className="flex-1 flex flex-col">
            <header className="h-14 flex items-center border-b px-4 lg:px-8">
              <Skeleton className="h-8 w-8 lg:hidden" />
              <div className="ml-auto flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </header>
            <main className="flex-1 p-4 lg:p-8">
              <div className="max-w-6xl mx-auto space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-6">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  const filteredSidebarItems = sidebarItems.filter(
    (item) => !item.adminOnly
  );

  const renderSidebarContent = () => (
    <>
      <div className="flex items-center mb-8 px-2">
        <div className="flex items-center gap-2 font-bold text-xl">
          <div className="text-primary rounded-md p-1 bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6" />
          </div>
          <span>CURUZA POS</span>
        </div>
      </div>
      <div className="space-y-2">
        {filteredSidebarItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex flex-1">
        <aside className="hidden lg:flex w-64 flex-col border-r bg-card px-4 py-6">
          {renderSidebarContent()}
          <div className="mt-auto">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 lg:px-8 bg-card">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 font-bold text-xl">
                    <div className="text-primary rounded-md p-1 bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <span>CURUZA POS</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                {renderSidebarContent()}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground mt-6"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </SheetContent>
            </Sheet>

            <div className="ml-auto flex items-center space-x-3">
              {user && (
                <div className="flex items-center gap-2 text-sm">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.email.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:block">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}