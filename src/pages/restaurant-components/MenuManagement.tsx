import { useEffect, useState } from "react";
import MenuItemForm from "./MenuItemForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

interface MenuManagementProps {
  handleAddItem: () => void;
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
}

export default function MenuManagement({ handleAddItem, isAddDialogOpen, setIsAddDialogOpen }: MenuManagementProps) {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);

  // Fetch restaurant's menu items from backend
  const fetchMenuItems = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/restaurants/menu/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch menu items");
      const data = await res.json();

      // Map category array to string for display
      const formattedData = data.map((item: any) => ({
        ...item,
        isAvailable: item.available,
        imageUrl: item.item_image,
        category: item.category ? item.category.map((c: any) => c.name).join(", ") : null,
      }));

      setMenuItems(formattedData);
    } catch (err) {
      console.error("Error fetching menu items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Delete menu item from backend and local state
  const deleteMenuItem = async (item: any) => {
    setSelectedMenuItemId(item.id);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/restaurants/menu/${item.id}/delete/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to delete menu item:", error);
        alert("Failed to delete menu item. Check console for details.");
        return;
      }

      // Remove deleted item from local state
      setMenuItems((prev) => prev.filter(menuitem => menuitem.id !== item.id));
      alert("Menu item deleted successfully!");
    } catch (err) {
      console.error("Error deleting menu item:", err);
      alert("An unexpected error occurred while deleting menu item.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle>Menu Management</CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddItem} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <i className="fas fa-plus mr-2"></i>Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Menu Item</DialogTitle>
            </DialogHeader>
            <MenuItemForm isEdit={false} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading menu items...</div>
        ) : menuItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-utensils text-4xl mb-4"></i>
            No menu items
          </div>
        ) : (
          menuItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="fas fa-utensils text-gray-400"></i>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm font-semibold text-primary">${Number(item.price).toFixed(2)}</p>
                  {item.category && (
                    <span className="inline-block px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-full mt-1">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${item.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-xs text-muted-foreground">{item.isAvailable ? 'Available' : 'Unavailable'}</span>
                </div>
                <Button variant="ghost" size="sm" >
                  <i className="fas fa-edit">N/A</i>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <i className="fas fa-trash">Delete</i>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{item.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMenuItem(item)} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
