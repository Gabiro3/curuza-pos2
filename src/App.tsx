import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { MainLayout } from './components/layout/main-layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import NotFound from './pages/NotFound';
import InventoryPage from './pages/Inventory';
import ProductMetricsPage from './pages/ProductMetrics';
import PurchasePlannerPage from './pages/PurchasePlanner';

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={
              <MainLayout>
                <Dashboard />
              </MainLayout>
            } />
            <Route path="/products" element={
              <MainLayout>
                <Products />
              </MainLayout>
            } />
            <Route path="/sales" element={
              <MainLayout>
                <Sales />
              </MainLayout>
            } />
            <Route path="/reports" element={
              <MainLayout>
                <Reports />
              </MainLayout>
            } />
            <Route path="/reports" element={
              <MainLayout>
                <Reports />
              </MainLayout>
            } />
            <Route path="/product-metrics/:productId" element={
              <MainLayout>
                <ProductMetricsPage />
              </MainLayout>
            } />
            <Route path="/purchase-planner" element={
              <MainLayout>
                <PurchasePlannerPage />
              </MainLayout>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);


export default App;