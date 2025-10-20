import { Button } from "@/components/ui/button";

interface QuickFiltersProps {
  selectedCuisine: string;
  setSelectedCuisine: (value: string) => void;
}

export default function QuickFilters({ selectedCuisine, setSelectedCuisine }: QuickFiltersProps) {
  return (
    <section className="bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex space-x-4 overflow-x-auto">
          <Button variant={selectedCuisine === "" ? "default" : "outline"} onClick={() => setSelectedCuisine("")}>
            <i className="fas fa-utensils mr-2"></i>All Restaurants
          </Button>
          <Button variant={selectedCuisine === "fast_food" ? "default" : "outline"} onClick={() => setSelectedCuisine("fast_food")}>
            <i className="fas fa-pizza-slice mr-2"></i>Fast Food
          </Button>
          <Button variant={selectedCuisine === "traditional" ? "default" : "outline"} onClick={() => setSelectedCuisine("traditional")}>
            <i className="fas fa-leaf mr-2"></i>Traditional
          </Button>
          <Button variant={selectedCuisine === "breakfast" ? "default" : "outline"} onClick={() => setSelectedCuisine("breakfast")}>
            <i className="fas fa-coffee mr-2"></i>Breakfast
          </Button>
          <Button variant={selectedCuisine === "pizza" ? "default" : "outline"} onClick={() => setSelectedCuisine("pizza")}>
            <i className="fas fa-coffee mr-2"></i>Pizza
          </Button>
          <Button variant={selectedCuisine === "chinese" ? "default" : "outline"} onClick={() => setSelectedCuisine("chinese")}>
            <i className="fas fa-coffee mr-2"></i>Chinese
          </Button>
          <Button variant={selectedCuisine === "Indian" ? "default" : "outline"} onClick={() => setSelectedCuisine("Indian")}>
            <i className="fas fa-coffee mr-2"></i>Indian
          </Button>
          <Button variant={selectedCuisine === "lunch_pack" ? "default" : "outline"} onClick={() => setSelectedCuisine("lunch_pack")}>
            <i className="fas fa-coffee mr-2"></i>Lunch Pack
          </Button>
        </div>
      </div>
    </section>
  );
}
