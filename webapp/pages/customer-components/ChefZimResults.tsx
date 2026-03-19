import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Recommendation {
  dish_name: string;
  restaurant_name: string;
  reason: string;
  match_score: number;
  item_id?: string;
  restaurant_id?: string;
  price?: number;
  image_url?: string;
}

interface ChefZimResultsProps {
  isOpen: boolean;
  onClose: () => void;
  greeting: string;
  recommendations: Recommendation[];
  closing: string;
  onViewRestaurant?: (restaurantId: string) => void;
}

export default function ChefZimResults({
  isOpen,
  onClose,
  greeting,
  recommendations,
  closing,
  onViewRestaurant,
}: ChefZimResultsProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold">Z</span>
            </div>
            <span className="text-orange-500 font-semibold text-lg">Chef Zim's Picks</span>
          </div>
          <DialogTitle className="sr-only">AI Recommendations</DialogTitle>
        </DialogHeader>

        {greeting && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <p className="text-orange-800">{greeting}</p>
          </div>
        )}

        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="flex">
                  {rec.image_url ? (
                    <div className="w-32 h-32 flex-shrink-0">
                      <img
                        src={rec.image_url}
                        alt={rec.dish_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                      <span className="text-4xl">🍽️</span>
                    </div>
                  )}
                  
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{rec.dish_name}</h3>
                        <p className="text-sm text-muted-foreground">{rec.restaurant_name}</p>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="bg-green-100 text-green-800"
                      >
                        {rec.match_score}% match
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{rec.reason}</p>
                    
                    <div className="flex items-center justify-between">
                      {rec.price && (
                        <span className="font-semibold text-primary">
                          ${rec.price.toFixed(2)}
                        </span>
                      )}
                      {rec.restaurant_id && onViewRestaurant && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewRestaurant(rec.restaurant_id!)}
                        >
                          View Restaurant
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {closing && (
          <div className="bg-gray-50 border rounded-lg p-4 mt-4">
            <p className="text-gray-600 text-sm">{closing}</p>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
