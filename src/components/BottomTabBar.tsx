import React from 'react';
import { Home, Compass, ShoppingCart, Search } from 'lucide-react';

interface BottomTabBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentPath, onNavigate }) => {
  const tabs = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Catalog', path: '/services', icon: Compass },
    { label: 'Order', path: '/order', icon: ShoppingCart },
    { label: 'Track', path: '/track', icon: Search },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800">
      <div className="grid grid-cols-4 items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.path === '/' 
            ? currentPath === '/' 
            : currentPath.startsWith(tab.path);

          return (
            <button
              key={tab.path}
              onClick={() => onNavigate(tab.path)}
              className="flex flex-col items-center justify-center h-full w-full focus:outline-none transition-colors"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-amber-400 scale-110' : 'text-slate-400'
                  }`}
                />
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight mt-1 ${
                  isActive ? 'text-amber-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
