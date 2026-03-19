import { Button } from "@/components/ui/button";

interface ChefZimCardProps {
  onOpenDialog: () => void;
}

export default function ChefZimCard({ onOpenDialog }: ChefZimCardProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div 
        className="relative overflow-hidden rounded-3xl p-8 md:p-10"
        style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-4 py-1 text-sm font-medium text-white mb-4">
              INTRODUCING CHEF ZIM
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
              Don't know what to eat? Ask our AI Concierge.
            </h2>
            
            <Button
              onClick={onOpenDialog}
              className="mt-6 bg-white text-orange-600 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg text-base"
            >
              Try AI Recommendation
            </Button>
          </div>
          
          <div className="hidden md:block relative">
            <div className="w-32 h-32 lg:w-40 lg:h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full opacity-80">
                <rect x="25" y="20" width="50" height="40" rx="8" fill="rgba(255,255,255,0.3)" />
                <circle cx="40" cy="35" r="5" fill="rgba(255,255,255,0.5)" />
                <circle cx="60" cy="35" r="5" fill="rgba(255,255,255,0.5)" />
                <rect x="35" y="45" width="30" height="4" rx="2" fill="rgba(255,255,255,0.4)" />
                <rect x="15" y="50" width="10" height="15" rx="3" fill="rgba(255,255,255,0.3)" />
                <rect x="75" y="50" width="10" height="15" rx="3" fill="rgba(255,255,255,0.3)" />
                <circle cx="20" cy="18" r="4" fill="rgba(255,200,150,0.6)" />
                <circle cx="80" cy="18" r="4" fill="rgba(255,200,150,0.6)" />
                <path d="M15 15 L20 18 L25 15" stroke="rgba(255,200,150,0.6)" strokeWidth="2" fill="none" />
                <path d="M75 15 L80 18 L85 15" stroke="rgba(255,200,150,0.6)" strokeWidth="2" fill="none" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
