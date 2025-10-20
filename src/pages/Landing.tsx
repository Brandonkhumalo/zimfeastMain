import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header with gradient */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 relative">
          <div className="text-center">
            <div className="inline-block mb-4">
              <h1 className="text-6xl sm:text-7xl font-bold mb-2 text-primary-foreground tracking-tight">
                ZimFeast
              </h1>
              <div className="h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />
            </div>
            
            <p className="text-xl sm:text-2xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto font-light">
              Delicious food delivery across Zimbabwe
            </p>
            
            <Button 
              onClick={() => window.location.href = '/login'}
              size="lg"
              className="bg-white text-primary hover:bg-white/95 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl px-8 py-6 text-lg font-semibold rounded-full"
              data-testid="button-sign-in"
            >
              Get Started
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 0L60 10C120 20 240 40 360 45C480 50 600 40 720 35C840 30 960 30 1080 35C1200 40 1320 50 1380 55L1440 60V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </header>

      {/* Features */}
      <section className="py-20 -mt-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Why Choose ZimFeast?
            </h2>
            <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
              Fast, reliable food delivery with local flavors
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "fas fa-motorcycle",
                title: "Fast Delivery",
                description: "Quick delivery from your favorite local restaurants"
              },
              {
                icon: "fas fa-utensils",
                title: "Local Cuisine",
                description: "Authentic Zimbabwean dishes and international favorites"
              },
              {
                icon: "fas fa-shield-alt",
                title: "Secure Payments",
                description: "Safe and secure payment options including USD and ZWL"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group text-center p-8 rounded-2xl bg-card border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-[0_12px_40px_-8px_hsl(var(--primary)/0.15)] hover:-translate-y-1"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-lg">
                  <i className={`${feature.icon} text-primary text-3xl`}></i>
                </div>
                <h3 className="text-2xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <div className="inline-block">
                <span className="text-primary font-semibold text-sm uppercase tracking-wider">About ZimFeast</span>
                <div className="h-0.5 bg-gradient-to-r from-primary to-transparent mt-2 rounded-full" />
              </div>
              
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
                Your Favorite Meals,{" "}
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Delivered Fast
                </span>
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                ZimFeast is Zimbabwe's premier food delivery marketplace, connecting hungry customers with the best local restaurants and eateries across the nation. From traditional Zimbabwean cuisine to international favorites, we bring the flavors you love right to your doorstep.
              </p>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Whether you're craving sadza and stew, a juicy burger, or authentic Asian cuisine, our platform makes it effortless to discover, order, and enjoy meals from hundreds of partnered restaurants. With real-time tracking, secure payments in USD and ZWL, and dedicated support, we're revolutionizing how Zimbabwe eats.
              </p>

              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground">Restaurant Partners</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">50K+</div>
                  <div className="text-sm text-muted-foreground">Happy Customers</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">30min</div>
                  <div className="text-sm text-muted-foreground">Average Delivery</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">24/7</div>
                  <div className="text-sm text-muted-foreground">Customer Support</div>
                </div>
              </div>
            </div>

            {/* Right Content - Feature Cards */}
            <div className="relative">
              <div className="space-y-4">
                {[
                  {
                    icon: "fas fa-map-marked-alt",
                    title: "Wide Coverage",
                    description: "Serving major cities across Zimbabwe with expanding reach to new areas every month"
                  },
                  {
                    icon: "fas fa-bolt",
                    title: "Lightning Fast",
                    description: "Real-time order tracking and optimized routing for the fastest delivery times"
                  },
                  {
                    icon: "fas fa-heart",
                    title: "Local Favorites",
                    description: "Supporting Zimbabwean businesses while giving you access to authentic local flavors"
                  },
                  {
                    icon: "fas fa-mobile-alt",
                    title: "Easy Ordering",
                    description: "Seamless experience from browsing menus to checkout with just a few taps"
                  }
                ].map((item, index) => (
                  <div 
                    key={index}
                    className="group flex items-start gap-4 p-6 rounded-2xl bg-card border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.12)] animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <i className={`${item.icon} text-primary text-xl`}></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">{item.title}</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Decorative gradient blob */}
              <div className="absolute -z-10 top-1/2 -right-20 w-72 h-72 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Business Partnership Section */}
      <section className="py-20 bg-gradient-to-b from-transparent via-muted/30 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Partner with ZimFeast
            </h2>
            <p className="text-muted-foreground text-lg sm:text-xl mb-8 max-w-2xl mx-auto">
              Join Zimbabwe's fastest-growing food delivery platform
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {[
              {
                icon: "fas fa-store",
                title: "Restaurant Partners",
                description: "Grow your business with thousands of hungry customers. Easy setup, real-time orders, secure payments.",
                benefits: [
                  "Zero setup fees",
                  "Weekly payments",
                  "Marketing support",
                  "Real-time analytics"
                ]
              },
              {
                icon: "fas fa-motorcycle",
                title: "Delivery Drivers",
                description: "Earn money on your schedule. Flexible hours, daily earnings, fuel bonuses available.",
                benefits: [
                  "Flexible working hours",
                  "Weekly cash payments",
                  "Fuel incentives",
                  "24/7 support"
                ]
              }
            ].map((partner, index) => (
              <div 
                key={index}
                className="group relative overflow-hidden rounded-3xl bg-card border border-border p-8 sm:p-10 hover:border-primary/20 transition-all duration-500 hover:shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.2)]"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <i className={`${partner.icon} text-primary text-4xl`}></i>
                  </div>
                  
                  <h3 className="text-3xl font-bold mb-4">{partner.title}</h3>
                  <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                    {partner.description}
                  </p>
                  
                  <ul className="space-y-3">
                    {partner.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center text-muted-foreground">
                        <svg className="w-5 h-5 text-primary mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button 
              onClick={() => window.location.href = '/business-hub'}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl px-8 py-6 text-lg font-semibold rounded-full"
              data-testid="button-business-hub"
            >
              <i className="fas fa-handshake mr-2"></i>
              Join Business Hub
            </Button>
            <p className="text-sm text-muted-foreground mt-4 font-medium">
              Quick application process • Get approved in 24-48 hours
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
