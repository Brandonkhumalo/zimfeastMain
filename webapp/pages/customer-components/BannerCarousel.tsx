import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";

interface Banner {
  id: string;
  title: string;
  description: string;
  image: string | null;
  link_url: string;
  campaign_type: string;
  priority: number;
}

export default function BannerCarousel() {
  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ["active-banners"],
    queryFn: () => apiRequest<Banner[]>("/api/restaurants/banners/active/"),
    staleTime: 60_000,
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const getCampaignColor = (type: string) => {
    switch (type) {
      case "free_delivery": return "from-green-500 to-emerald-600";
      case "discount": return "from-orange-500 to-red-500";
      case "new_restaurant": return "from-purple-500 to-indigo-600";
      default: return "from-blue-500 to-cyan-600";
    }
  };

  return (
    <div className="mb-6">
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {banners.map((banner) => (
            <div
              key={banner.id}
              className={`w-full flex-shrink-0 bg-gradient-to-r ${getCampaignColor(banner.campaign_type)} p-6 rounded-xl cursor-pointer`}
              onClick={() => {
                if (banner.link_url) window.location.href = banner.link_url;
              }}
            >
              <div className="flex items-center gap-4">
                {banner.image && (
                  <img
                    src={banner.image}
                    alt={banner.title}
                    className="w-20 h-20 rounded-lg object-cover shadow-lg"
                  />
                )}
                <div className="text-white">
                  <h3 className="text-lg font-bold">{banner.title}</h3>
                  {banner.description && (
                    <p className="text-sm text-white/80 mt-1">{banner.description}</p>
                  )}
                  {banner.campaign_type === "free_delivery" && (
                    <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                      Free Delivery
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        {banners.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {banners.map((_, idx) => (
              <button
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-gray-300"
                }`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
