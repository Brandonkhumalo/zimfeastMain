import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MapPin, Clock, DollarSign, Store } from "lucide-react";
import LocationPicker from "@/components/ui/location-picker";

const GOOGLE_MAPS_API_KEY = "AIzaSyB6rSsWSWLJhcA2pzFtt-Y1I2wx6UAdyD4";

interface RestaurantData {
  id: number;
  name: string;
  description: string;
  full_address: string;
  lat: number;
  lng: number;
  phone_number: string;
  minimum_order_price: number;
  est_delivery_time: number;
  is_open: boolean;
}

interface Branch {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  is_active: boolean;
}

export default function RestaurantSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAddBranch, setShowAddBranch] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    phone_number: "",
    minimum_order_price: 0,
    est_delivery_time: 30,
    full_address: "",
    lat: 0,
    lng: 0,
  });

  const [newBranch, setNewBranch] = useState({
    name: "",
    address: "",
    lat: 0,
    lng: 0,
  });

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/restaurants/my-restaurant/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch restaurant data");

        const data = await res.json();
        setRestaurant(data);
        setFormData({
          name: data.name || "",
          description: data.description || "",
          phone_number: data.phone_number || "",
          minimum_order_price: data.minimum_order_price || 0,
          est_delivery_time: data.est_delivery_time || 30,
          full_address: data.full_address || "",
          lat: data.lat || 0,
          lng: data.lng || 0,
        });

        if (data.branches) {
          setBranches(data.branches);
        }
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to load restaurant settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [toast]);

  const handleLocationChange = (location: { lat: number; lng: number; address: string }) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      full_address: location.address,
    }));
  };

  const handleBranchLocationChange = (location: { lat: number; lng: number; address: string }) => {
    setNewBranch((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    }));
  };

  const handleSaveSettings = async () => {
    if (!restaurant) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/restaurants/${restaurant.id}/update/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update restaurant");

      toast({
        title: "Settings Saved",
        description: "Your restaurant settings have been updated",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddBranch = async () => {
    if (!restaurant || !newBranch.name || !newBranch.address) {
      toast({
        title: "Missing Information",
        description: "Please provide branch name and select a location",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/restaurants/${restaurant.id}/branches/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newBranch),
      });

      if (!res.ok) throw new Error("Failed to add branch");

      const newBranchData = await res.json();
      setBranches((prev) => [...prev, newBranchData]);
      setNewBranch({ name: "", address: "", lat: 0, lng: 0 });
      setShowAddBranch(false);

      toast({
        title: "Branch Added",
        description: `${newBranch.name} has been added successfully`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add branch",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!confirm("Are you sure you want to delete this branch?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/restaurants/branches/${branchId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete branch");

      setBranches((prev) => prev.filter((b) => b.id !== branchId));
      toast({
        title: "Branch Deleted",
        description: "The branch has been removed",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete branch",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">No restaurant found. Please register your restaurant first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Restaurant Settings</h2>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" data-testid="tab-general">
            <Store className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="location" data-testid="tab-location">
            <MapPin className="h-4 w-4 mr-2" />
            Location
          </TabsTrigger>
          <TabsTrigger value="branches" data-testid="tab-branches">
            <Store className="h-4 w-4 mr-2" />
            Branches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update your restaurant details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Restaurant Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  data-testid="input-settings-name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  data-testid="input-settings-description"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone_number}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
                  data-testid="input-settings-phone"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minOrder">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Minimum Order (USD)
                  </Label>
                  <Input
                    id="minOrder"
                    type="number"
                    step="0.01"
                    value={formData.minimum_order_price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, minimum_order_price: parseFloat(e.target.value) || 0 }))
                    }
                    data-testid="input-settings-min-order"
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryTime">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Est. Delivery Time (min)
                  </Label>
                  <Input
                    id="deliveryTime"
                    type="number"
                    value={formData.est_delivery_time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, est_delivery_time: parseInt(e.target.value) || 0 }))
                    }
                    data-testid="input-settings-delivery-time"
                  />
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={saving} data-testid="button-save-general">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Main Location</CardTitle>
              <CardDescription>
                Update your restaurant's primary address. Drag the marker or search to set the exact location.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LocationPicker
                initialLat={formData.lat}
                initialLng={formData.lng}
                initialAddress={formData.full_address}
                onLocationChange={handleLocationChange}
                apiKey={GOOGLE_MAPS_API_KEY}
                height="400px"
              />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Latitude</Label>
                  <p className="font-mono" data-testid="text-lat">{formData.lat.toFixed(6)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Longitude</Label>
                  <p className="font-mono" data-testid="text-lng">{formData.lng.toFixed(6)}</p>
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={saving} data-testid="button-save-location">
                {saving ? "Saving..." : "Update Location"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branch Locations</CardTitle>
              <CardDescription>
                Manage multiple branch locations for your restaurant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {branches.length === 0 && !showAddBranch ? (
                <p className="text-muted-foreground text-center py-4">
                  No branches added yet. Add a branch to expand your delivery coverage.
                </p>
              ) : (
                <div className="space-y-3">
                  {branches.map((branch) => (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                      data-testid={`branch-item-${branch.id}`}
                    >
                      <div>
                        <p className="font-medium">{branch.name}</p>
                        <p className="text-sm text-muted-foreground">{branch.address}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteBranch(branch.id)}
                        data-testid={`button-delete-branch-${branch.id}`}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {showAddBranch ? (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium">Add New Branch</h4>
                  <div>
                    <Label htmlFor="branchName">Branch Name</Label>
                    <Input
                      id="branchName"
                      placeholder="e.g., Downtown Branch"
                      value={newBranch.name}
                      onChange={(e) => setNewBranch((prev) => ({ ...prev, name: e.target.value }))}
                      data-testid="input-branch-name"
                    />
                  </div>

                  <LocationPicker
                    onLocationChange={handleBranchLocationChange}
                    apiKey={GOOGLE_MAPS_API_KEY}
                    height="300px"
                  />

                  <div className="flex gap-2">
                    <Button onClick={handleAddBranch} disabled={saving} data-testid="button-confirm-add-branch">
                      {saving ? "Adding..." : "Add Branch"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddBranch(false);
                        setNewBranch({ name: "", address: "", lat: 0, lng: 0 });
                      }}
                      data-testid="button-cancel-add-branch"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowAddBranch(true)} data-testid="button-add-branch">
                  Add Branch Location
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
