// customer-app-components/Header.tsx
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  currency: string;
  setCurrency: (value: string) => void;
  toggleNearbyView: () => void;
  showNearbyOnly: boolean;
  isGettingLocation: boolean;
  userLocation: { lat: number; lng: number } | null;
}

export default function Header({
  searchTerm,
  setSearchTerm,
  currency,
  setCurrency,
  toggleNearbyView,
  showNearbyOnly,
  isGettingLocation,
  userLocation,
}: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">Delicious food, delivered fast</h1>
            <p className="text-xl opacity-90">Order from your favorite restaurants in Zimbabwe</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm opacity-75">Currency</p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="ZWL">ZWL (Z$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Search Bar and Location */}
        <div className="mt-8 max-w-2xl">
          <div className="flex space-x-4">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <Input
                type="text"
                placeholder="Search restaurants, cuisines, or dishes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white text-gray-900 text-lg placeholder-gray-400"
              />
            </div>
            <Button
              onClick={toggleNearbyView}
              disabled={isGettingLocation}
              className={`px-6 py-4 rounded-xl text-lg whitespace-nowrap ${
                showNearbyOnly
                  ? 'bg-white text-primary border-2 border-white hover:bg-gray-50'
                  : 'bg-white/20 text-white border-2 border-white/30 hover:bg-white/30'
              }`}
            >
              {isGettingLocation ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>Getting Location...
                </>
              ) : showNearbyOnly ? (
                <>
                  <i className="fas fa-map-marker-alt mr-2"></i>Show All
                </>
              ) : (
                <>
                  <i className="fas fa-location-arrow mr-2"></i>Find Nearby
                </>
              )}
            </Button>
          </div>
          {showNearbyOnly && userLocation && (
            <div className="mt-2 text-sm text-white/80">
              <i className="fas fa-info-circle mr-1"></i>Showing restaurants within 10km of your location
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
