import { Button } from "@/components/ui/button";

interface QuickFiltersProps {
  selectedCuisine: string;
  setSelectedCuisine: (value: string) => void;
}

const cuisineFilters = [
  { id: "", label: "All Restaurants", icon: "fas fa-utensils" },
  { id: "fast_food", label: "Fast Food", icon: "fas fa-burger" },
  { id: "traditional", label: "Traditional", icon: "fas fa-leaf" },
  { id: "breakfast", label: "Breakfast", icon: "fas fa-coffee" },
  { id: "pizza", label: "Pizza", icon: "fas fa-pizza-slice" },
  { id: "chinese", label: "Chinese", icon: "fas fa-bowl-rice" },
  { id: "Indian", label: "Indian", icon: "fas fa-pepper-hot" },
  { id: "lunch_pack", label: "Lunch Pack", icon: "fas fa-box" },
];

export default function QuickFilters({ selectedCuisine, setSelectedCuisine }: QuickFiltersProps) {
  return (
    <section className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex space-x-3 overflow-x-auto scrollbar-hide pb-2">
          {cuisineFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedCuisine(filter.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
                selectedCuisine === filter.id
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                  : "bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white/70 hover:bg-zinc-200 dark:hover:bg-white/20 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <i className={filter.icon}></i>
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
