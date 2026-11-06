import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { BottomTabBar } from './components/BottomTabBar.tsx';
import { Footer } from './components/Footer.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { OrderFormPage } from './pages/OrderFormPage.tsx';
import { OrderStatusPage } from './pages/OrderStatusPage.tsx';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage.tsx';
import { SupportPage } from './pages/SupportPage.tsx';
import { ProofsPage } from './pages/ProofsPage.tsx';
import { OngoingPage } from './pages/OngoingPage.tsx';
import { Service } from './types/index.ts';
import { api } from './lib/api.ts';
import { auth } from './lib/firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname + window.location.search || '/';
  });

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Parse path & params
  const [pathOnly, searchParams] = React.useMemo(() => {
    const parts = currentPath.split('?');
    const p = parts[0] || '/';
    const params = new URLSearchParams(parts[1] || '');
    return [p, params] as const;
  }, [currentPath]);

  // Check admin session on boot and listen to Firebase auth state changes
  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          // Check if there is an active session token (e.g. from tests or prior login)
          const isAuthed = await api.adminCheckSession();
          if (mounted) setIsAdminAuthenticated(isAuthed);
        } else {
          // User is authenticated with Firebase; verify custom claims strictly
          const isAuthed = await api.adminCheckSession();
          if (mounted) setIsAdminAuthenticated(isAuthed);
        }
      } catch (err) {
        console.warn('Admin session check error:', err);
        if (mounted) setIsAdminAuthenticated(false);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Load catalog
  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        const list = await api.getServices();
        if (mounted) {
          setServices(list);
        }
      } catch (err) {
        console.error('Error fetching services catalog:', err);
      } finally {
        if (mounted) {
          setLoadingServices(false);
        }
      }
    }
    loadCatalog();
    return () => { mounted = false; };
  }, []);

  // Sync with browser navigation
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminLogout = async () => {
    await api.adminLogout();
    setIsAdminAuthenticated(false);
    navigate('/');
  };

  // Preselected service ID from query parameter
  const preselectedServiceId = searchParams.get('service');
  // Preselected volatile fruit from market trends
  const preselectedFruit = searchParams.get('fruit');
  // Tracking token from query parameter or path
  const trackingToken = searchParams.get('token') || searchParams.get('q');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950">
      <Navbar currentPath={pathOnly} onNavigate={navigate} isAdmin={isAdminAuthenticated} />

      <main className="flex-1">
        {pathOnly === '/' && (
          <LandingPage
            onNavigate={navigate}
            featuredServices={services}
            loadingServices={loadingServices}
          />
        )}

        {(pathOnly === '/services' || pathOnly.startsWith('/services/')) && (
          <CatalogPage
            services={services}
            loading={loadingServices}
            onNavigate={navigate}
            selectedServiceSlug={pathOnly.replace('/services/', '')}
          />
        )}

        {pathOnly === '/order' && (
          <OrderFormPage
            services={services}
            preselectedServiceId={preselectedServiceId}
            preselectedFruit={preselectedFruit}
            onNavigate={navigate}
          />
        )}

        {(pathOnly === '/track' || pathOnly.startsWith('/order/')) && (
          <OrderStatusPage
            initialToken={trackingToken}
            onNavigate={navigate}
          />
        )}

        {(pathOnly === '/support' || pathOnly === '/contact') && (
          <SupportPage onNavigate={navigate} />
        )}

        {pathOnly === '/proofs' && (
          <ProofsPage onNavigate={navigate} />
        )}

        {(pathOnly === '/ongoing' || pathOnly === '/active') && (
          <OngoingPage onNavigate={navigate} />
        )}

        {/* ADMIN ROUTES */}
        {pathOnly.startsWith('/admin') && checkingAuth && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-400">Verifying staff session...</p>
          </div>
        )}

        {pathOnly === '/admin/login' && !checkingAuth && (
          isAdminAuthenticated ? (
            <AdminDashboardPage
              onNavigate={navigate}
              onLogout={handleAdminLogout}
              onServiceChange={() => {
                api.getServices().then(setServices).catch(console.error);
              }}
            />
          ) : (
            <AdminLoginPage
              onLoginSuccess={() => {
                setIsAdminAuthenticated(true);
                navigate('/admin');
              }}
              onNavigate={navigate}
            />
          )
        )}

        {(pathOnly === '/admin' || pathOnly === '/admin/catalog' || pathOnly.startsWith('/admin/catalog') || pathOnly === '/admin/research') && !checkingAuth && (
          !isAdminAuthenticated ? (
            <AdminLoginPage
              onLoginSuccess={() => {
                setIsAdminAuthenticated(true);
                navigate(pathOnly);
              }}
              onNavigate={navigate}
            />
          ) : (
            <AdminDashboardPage
              initialTab={pathOnly === '/admin/research' ? 'research' : pathOnly.startsWith('/admin/catalog') ? 'catalog' : 'orders'}
              onNavigate={navigate}
              onLogout={handleAdminLogout}
              onServiceChange={() => {
                api.getServices().then(setServices).catch(console.error);
              }}
            />
          )
        )}

        {pathOnly.startsWith('/admin/orders/') && !checkingAuth && (
          !isAdminAuthenticated ? (
            <AdminLoginPage
              onLoginSuccess={() => {
                setIsAdminAuthenticated(true);
              }}
              onNavigate={navigate}
            />
          ) : (
            <AdminOrderDetailPage
              orderId={pathOnly.replace('/admin/orders/', '')}
              onNavigate={navigate}
            />
          )
        )}
      </main>

      <Footer />
      <BottomTabBar currentPath={pathOnly} onNavigate={navigate} />
    </div>
  );
}
