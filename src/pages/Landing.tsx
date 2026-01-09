import React, { useState, useEffect, useMemo } from 'react';
import { View, Restaurant, CartItem, FoodItem } from './types';
import { RESTAURANTS, CATEGORIES } from './data';

// --- Sub-components ---

const Header: React.FC<{ 
  onViewChange: (v: View) => void, 
  scrolled: boolean,
  theme: 'dark' | 'light',
  onThemeToggle: () => void
}> = ({ onViewChange, scrolled, theme, onThemeToggle }) => (
  <header className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'py-3 glass-dark border-b border-zinc-200 dark:border-white/5' : 'py-6 bg-transparent'}`}>
    <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-12">
        <h1 
          onClick={() => onViewChange('home')}
          className="text-2xl md:text-3xl font-black tracking-tighter cursor-pointer text-gradient"
        >
          ZIMFEAST
        </h1>
        <nav className="hidden md:flex items-center gap-8 text-sm font-bold tracking-wide uppercase">
          <button onClick={() => onViewChange('home')} className="hover:text-orange-500 transition-colors">Customers</button>
          <button 
            onClick={() => window.location.href = '/business-hub'} 
            className="text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Businesses
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onThemeToggle}
          className="p-3 rounded-2xl glass-dark border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  </header>
);

const RestaurantCard: React.FC<{ 
  restaurant: Restaurant, 
  onClick: () => void 
}> = ({ restaurant, onClick }) => (
  <div 
    onClick={onClick}
    className="group cursor-pointer flex flex-col h-full"
  >
    <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-zinc-100 dark:bg-zinc-900 mb-4 shadow-sm group-hover:shadow-xl transition-shadow duration-500">
      <img 
        src={restaurant.image} 
        alt={restaurant.name}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute top-4 right-4 glass-dark px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xl">
        <span className="text-orange-500">★</span>
        {restaurant.rating}
      </div>
      {restaurant.isFeatured && (
        <div className="absolute top-4 left-4 orange-gradient px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg text-white">
          Featured
        </div>
      )}
      <div className="absolute bottom-4 left-4 right-4 flex justify-end items-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
        <span className="text-[10px] font-black bg-orange-500 text-white px-3 py-1 rounded-full uppercase tracking-tighter">{restaurant.deliveryTime}</span>
      </div>
    </div>
    <div className="px-1 space-y-1">
      <h3 className="font-bold text-xl group-hover:text-orange-500 transition-colors truncate">{restaurant.name}</h3>
      <div className="flex items-center gap-2 text-zinc-500 dark:text-white/40 text-sm font-medium">
        <span>{restaurant.categories.join(', ')}</span>
        <span>•</span>
        <span>{restaurant.deliveryFee === 0 ? 'Free' : `$${restaurant.deliveryFee}`} delivery</span>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) ? 'dark' : 'light'
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const cartTotal = useMemo(() => 
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  , [cart]);

  const handleRestaurantSelect = (res: Restaurant) => {
    setSelectedRestaurant(res);
    setCurrentView('restaurant');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (item: FoodItem, restaurant: Restaurant) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, restaurantId: restaurant.id, restaurantName: restaurant.name }];
    });
    // Visual feedback
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 orange-gradient px-6 py-3 rounded-2xl font-bold shadow-2xl z-[100] animate-bounce text-white';
    toast.innerText = `Added ${item.name} to basket`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
    setIsCartOpen(true);
  };

  const filteredRestaurants = useMemo(() => {
    if (!searchQuery) return RESTAURANTS;
    return RESTAURANTS.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="hero-mesh" />

      <Header 
        onViewChange={setCurrentView} 
        scrolled={scrolled}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      <main className="relative pt-24 pb-20">
        {currentView === 'home' && (
          <div className="space-y-20">
            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 mt-10 md:mt-20 text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-zinc-200 dark:border-white/10 mb-4 animate-float">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Live: 50+ local chefs online</span>
              </div>

              <h2 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.9] max-w-4xl mx-auto">
                TASTE THE <br /> <span className="text-gradient">EXTRAORDINARY.</span>
              </h2>

              <p className="text-zinc-500 dark:text-white/40 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                Premium delivery from your city's most exclusive kitchens. 
                Sourced locally, delivered in minutes.
              </p>

              <div className="max-w-2xl mx-auto relative group mt-12">
                <div className="absolute -inset-1 orange-gradient opacity-10 dark:opacity-20 group-focus-within:opacity-30 blur-2xl transition-opacity duration-500" />
                <div className="relative glass flex items-center p-2 rounded-[32px] border border-zinc-200 dark:border-white/10 group-focus-within:border-orange-500/50 transition-all shadow-xl dark:shadow-2xl">
                  <div className="flex-1 flex items-center px-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-zinc-400 dark:text-white/40 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="What are you craving today?"
                      className="bg-transparent border-none outline-none w-full text-lg font-medium text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-white/20"
                    />
                  </div>
                  <button className="orange-gradient h-14 md:h-16 px-10 rounded-3xl font-black text-sm tracking-wide shadow-xl shadow-orange-600/20 hover:scale-[1.02] active:scale-95 transition-all text-white">
                    SEARCH
                  </button>
                </div>
              </div>
            </section>

            {/* Categories */}
            <section className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat.name}
                    className="flex-shrink-0 glass hover:bg-zinc-100 dark:hover:bg-white/5 px-4 py-4 rounded-[28px] flex flex-col items-center gap-3 transition-all border border-zinc-200 dark:border-white/5 group hover:-translate-y-1 min-w-[120px]"
                  >
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-zinc-100 dark:border-white/10">
                      <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <span className="font-bold text-[10px] uppercase tracking-widest text-zinc-400 dark:text-white/50 group-hover:text-zinc-900 dark:group-hover:text-white">{cat.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Auth Buttons */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => window.location.href = '/register'}
                className="orange-gradient w-full sm:w-auto px-12 py-5 rounded-2xl font-black text-sm tracking-[0.2em] shadow-xl shadow-orange-600/20 hover:scale-105 active:scale-95 transition-all uppercase text-white"
              >
                Get Started
              </button>
              <button 
                onClick={() => window.location.href = '/login'}
                className="glass w-full sm:w-auto px-12 py-5 rounded-2xl font-black text-sm tracking-[0.2em] border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all uppercase"
              >
                Login
              </button>
            </section>

            {/* Featured Section */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-3xl md:text-4xl font-black">CURATED SPOTS</h3>
                  <p className="text-zinc-500 dark:text-white/40 font-medium">Hand-picked by our food experts</p>
                </div>
                <div className="flex gap-2">
                   <button className="p-3 glass rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                   </button>
                   <button className="p-3 glass rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {filteredRestaurants.map(res => (
                  <RestaurantCard 
                    key={res.id} 
                    restaurant={res} 
                    onClick={() => handleRestaurantSelect(res)} 
                  />
                ))}
              </div>
            </section>

            {/* Why Zim Feast? */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-20 bg-zinc-50 dark:bg-white/5 rounded-[60px] relative overflow-hidden">
               <div className="absolute top-0 right-0 w-96 h-96 orange-gradient opacity-10 blur-[120px] rounded-full" />
               <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
                  <div className="space-y-4 text-center">
                    <div className="w-16 h-16 rounded-3xl mx-auto overflow-hidden shadow-2xl border border-zinc-200 dark:border-white/10">
                      <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=150" className="w-full h-full object-cover" alt="Speed" />
                    </div>
                    <h4 className="text-xl font-black">Hyper-Fast</h4>
                    <p className="text-zinc-500 dark:text-white/40 text-sm leading-relaxed">Our proprietary logistics engine ensures your food arrives hot, every single time.</p>
                  </div>
                  <div className="space-y-4 text-center">
                    <div className="w-16 h-16 rounded-3xl mx-auto overflow-hidden shadow-2xl border border-zinc-200 dark:border-white/10">
                      <img src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=150" className="w-full h-full object-cover" alt="Secure" />
                    </div>
                    <h4 className="text-xl font-black">Secure Payments</h4>
                    <p className="text-zinc-500 dark:text-white/40 text-sm leading-relaxed">Shop with confidence using our encrypted and highly secure payment gateways.</p>
                  </div>
                  <div className="space-y-4 text-center">
                    <div className="w-16 h-16 rounded-3xl mx-auto overflow-hidden shadow-2xl border border-zinc-200 dark:border-white/10">
                      <img src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=150" className="w-full h-full object-cover" alt="Premium" />
                    </div>
                    <h4 className="text-xl font-black">Premium Selection</h4>
                    <p className="text-zinc-500 dark:text-white/40 text-sm leading-relaxed">We only partner with the best. No subpar meals, only extraordinary experiences.</p>
                  </div>
               </div>
            </section>

             {/* Footer Banner */}
             <section className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="orange-gradient rounded-[60px] p-8 md:p-20 flex flex-col lg:flex-row items-center justify-between gap-16 relative overflow-hidden group text-white">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />

                  <div className="z-10 space-y-8 text-center lg:text-left flex-1">
                    <div className="inline-block bg-black/20 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">The ZIMFEAST App</div>
                    <h3 className="text-4xl md:text-6xl font-black leading-none max-w-xl">Hungry? Order in just a few taps.</h3>
                    <p className="text-white/80 text-lg font-medium max-w-md">Join over 1M+ food lovers. Track your order in real-time and get exclusive daily deals only on our app.</p>

                    <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4">
                      <button className="bg-black hover:bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-all flex items-center gap-3 border border-white/5 shadow-2xl">
                         <div className="text-left leading-none">
                            <span className="text-[10px] block uppercase opacity-60">Download on</span>
                            <span className="text-xl font-black">App Store</span>
                         </div>
                      </button>
                      <button className="bg-black hover:bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-all flex items-center gap-3 border border-white/5 shadow-2xl">
                         <div className="text-left leading-none">
                            <span className="text-[10px] block uppercase opacity-60">Get it on</span>
                            <span className="text-xl font-black">Google Play</span>
                         </div>
                      </button>
                    </div>
                  </div>

                  <div className="relative flex gap-6 md:gap-10 z-10 group-hover:scale-105 transition-transform duration-700">
                    <div className="glass-dark p-6 rounded-[40px] flex flex-col items-center gap-4 border border-white/10 shadow-2xl">
                      <div className="w-32 h-32 md:w-40 md:h-40 bg-white p-3 rounded-3xl overflow-hidden">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://apple.com/app-store" alt="App Store QR" className="w-full h-full" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">iOS</span>
                    </div>
                    <div className="glass-dark p-6 rounded-[40px] flex flex-col items-center gap-4 border border-white/10 shadow-2xl">
                      <div className="w-32 h-32 md:w-40 md:h-40 bg-white p-3 rounded-3xl overflow-hidden">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://play.google.com/store" alt="Play Store QR" className="w-full h-full" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Android</span>
                    </div>
                    <div className="absolute -z-10 -inset-4 bg-white/5 blur-3xl rounded-full opacity-50" />
                  </div>
                </div>
             </section>

             {/* Partner Section */}
             <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-20 space-y-16">
                <div className="text-center space-y-4">
                  <h3 className="text-4xl md:text-6xl font-black tracking-tighter uppercase">Partner with <span className="text-gradient">ZimFeast</span></h3>
                  <p className="text-zinc-500 dark:text-white/40 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">Join Zimbabwe's fastest-growing food delivery platform</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="glass p-10 rounded-[50px] space-y-8 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all border border-zinc-200 dark:border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-[60px] rounded-full" />
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-white/10">
                        <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=150" className="w-full h-full object-cover" alt="Chef" />
                      </div>
                      <h4 className="text-2xl font-black">Restaurant Partners</h4>
                      <p className="text-zinc-500 dark:text-white/40 text-sm leading-relaxed">Grow your business with thousands of hungry customers. Easy setup, real-time orders, secure payments.</p>
                    </div>
                    <ul className="space-y-4">
                      {['Zero setup fees', 'Weekly payments', 'Marketing support', 'Real-time analytics'].map(item => (
                        <li key={item} className="flex items-center gap-3 text-sm font-bold text-zinc-600 dark:text-white/60">
                          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="glass p-10 rounded-[50px] space-y-8 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all border border-zinc-200 dark:border-white/5 relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-600/10 blur-[60px] rounded-full" />
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-white/10">
                        <img src="https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&q=80&w=150" className="w-full h-full object-cover" alt="Rider" />
                      </div>
                      <h4 className="text-2xl font-black">Delivery Drivers</h4>
                      <p className="text-zinc-500 dark:text-white/40 text-sm leading-relaxed">Earn money on your schedule. Flexible hours, daily earnings, fuel bonuses available.</p>
                    </div>
                    <ul className="space-y-4">
                      {['Flexible working hours', 'Weekly cash payments', 'Fuel incentives - earn $0,35 per km', '24/7 support'].map(item => (
                        <li key={item} className="flex items-center gap-3 text-sm font-bold text-zinc-600 dark:text-white/60">
                          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="text-center pt-8">
                  <button 
                    onClick={() => window.location.href = '/business-hub'}
                    className="orange-gradient px-12 py-6 rounded-[32px] font-black text-sm tracking-[0.2em] shadow-2xl shadow-orange-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase text-white"
                  >
                    JOIN BUSINESS HUB
                  </button>
                </div>
             </section>
          </div>
        )}

        {currentView === 'restaurant' && selectedRestaurant && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12 animate-in fade-in duration-700">
            {/* Restaurant Detail Banner */}
            <section className="relative h-[350px] md:h-[500px] rounded-[50px] overflow-hidden group shadow-2xl">
              <img 
                src={selectedRestaurant.image} 
                className="w-full h-full object-cover brightness-[0.4] group-hover:scale-110 transition-transform duration-[5s]" 
                alt={selectedRestaurant.name} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-20 text-white">
                <button 
                  onClick={() => setCurrentView('home')}
                  className="absolute top-10 left-10 glass-dark p-4 rounded-full hover:bg-white/10 transition-colors border border-white/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {selectedRestaurant.categories.map(cat => (
                      <span key={cat} className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest">{cat}</span>
                    ))}
                  </div>
                  <h2 className="text-5xl md:text-8xl font-black mb-4 tracking-tighter">{selectedRestaurant.name}</h2>
                  <div className="flex flex-wrap items-center gap-8 text-sm font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500 text-xl">★</span>
                      {selectedRestaurant.rating} <span className="text-white/60">(1,200+ Reviews)</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-white/60 font-black">DELIVERY:</span>
                       {selectedRestaurant.deliveryTime}
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-white/60 font-black">FEE:</span>
                       <span className="text-orange-400 font-black">{selectedRestaurant.deliveryFee === 0 ? 'FREE' : `$${selectedRestaurant.deliveryFee}`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
              <aside className="lg:col-span-1 hidden lg:block space-y-4 sticky top-32 h-fit">
                <h4 className="font-black text-2xl mb-8 tracking-tighter">THE MENU</h4>
                <div className="space-y-2">
                  {['Popular Picks', ...new Set(selectedRestaurant.menu.map(m => m.category))].map(cat => (
                    <button key={cat} className="w-full text-left px-6 py-4 rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-all font-bold text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:pl-8 border border-transparent hover:border-zinc-200 dark:hover:border-white/5">
                      {cat}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="lg:col-span-3 space-y-16">
                <section>
                  <div className="flex items-center gap-4 mb-10">
                    <h3 className="text-3xl font-black tracking-tighter">POPULAR PICKS</h3>
                    <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {selectedRestaurant.menu.map(item => (
                      <div key={item.id} className="glass p-5 rounded-[40px] flex flex-col sm:row gap-6 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all group border border-zinc-200 dark:border-white/5 shadow-sm hover:shadow-lg">
                        <div className="w-full sm:w-40 h-40 rounded-3xl overflow-hidden flex-shrink-0 relative">
                          <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-2">
                          <div>
                            <h4 className="font-black text-xl group-hover:text-orange-500 transition-colors">{item.name}</h4>
                            <p className="text-sm text-zinc-500 dark:text-white/40 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                          </div>
                          <div className="flex items-center justify-between mt-6">
                            <p className="font-black text-2xl">${item.price.toFixed(2)}</p>
                            <button 
                              onClick={() => addToCart(item, selectedRestaurant)}
                              className="orange-gradient px-6 py-3 rounded-2xl font-black text-xs tracking-widest shadow-lg hover:scale-110 active:scale-95 transition-all uppercase text-white"
                            >
                              ADD
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <div className={`fixed inset-0 z-[200] transition-opacity duration-500 ${isCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 dark:bg-black/90 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
        <div className={`absolute right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-[#0a0a0a] border-l border-zinc-200 dark:border-white/10 shadow-2xl transition-transform duration-700 ease-out ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
          <div className="p-8 md:p-12 flex items-center justify-between border-b border-zinc-100 dark:border-white/5">
            <div>
               <h2 className="text-3xl font-black tracking-tighter uppercase">Your Basket</h2>
               <p className="text-zinc-500 dark:text-white/40 text-sm font-medium">Items selected for checkout</p>
            </div>
            <button onClick={() => setIsCartOpen(false)} className="p-4 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors border border-zinc-200 dark:border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 no-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-48 h-48 rounded-[40px] overflow-hidden glass border border-zinc-200 dark:border-white/10 shadow-xl">
                  <img src="https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover opacity-50 grayscale" alt="Empty Cart" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-black">Basket is empty</p>
                  <p className="text-zinc-500 dark:text-white/40 max-w-[200px] mx-auto">Fill it up with delicious food from our local chefs.</p>
                </div>
                <button 
                  onClick={() => { setIsCartOpen(false); setCurrentView('home'); }}
                  className="orange-gradient px-10 py-4 rounded-2xl font-black tracking-widest text-xs text-white"
                >
                  START BROWSING
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {cart.map(item => (
                  <div key={item.id} className="flex gap-6 group animate-in slide-in-from-right-4 duration-300">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg leading-tight group-hover:text-orange-500 transition-colors">{item.name}</h4>
                          <p className="text-xs text-zinc-500 dark:text-white/40 font-black uppercase mt-1 tracking-widest">{item.restaurantName}</p>
                          <p className="text-sm font-bold mt-1">Quantity: {item.quantity}</p>
                        </div>
                        <p className="font-black text-lg">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-8 md:p-12 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/40 backdrop-blur-xl space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between text-zinc-500 dark:text-white/40 font-bold text-sm tracking-wide">
                  <span>SUBTOTAL</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-500 dark:text-white/40 font-bold text-sm tracking-wide">
                  <span>DELIVERY FEE</span>
                  <span>$2.99</span>
                </div>
                <div className="flex justify-between font-black text-3xl pt-4 border-t border-zinc-200 dark:border-white/5">
                  <span className="tracking-tighter uppercase">Total</span>
                  <span>${(cartTotal + 2.99).toFixed(2)}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  alert("Order placed successfully! Zim Feast is on the way.");
                  setCart([]);
                  setIsCartOpen(false);
                }}
                className="w-full orange-gradient py-6 rounded-[32px] font-black text-sm tracking-[0.2em] shadow-2xl shadow-orange-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase text-white"
              >
                Complete Purchase
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 md:px-8 py-12 border-t border-zinc-200 dark:border-white/5 text-center space-y-2">
        <p className="text-zinc-900 dark:text-white font-medium tracking-wide flex items-center justify-center gap-2">
          Made with Love from Zimbabwe 🇿🇼
        </p>
        <p className="text-zinc-400 dark:text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">copyrights by Tishanyq Digital pvt ltd</p>
      </footer>
    </div>
  );
};

export default App;