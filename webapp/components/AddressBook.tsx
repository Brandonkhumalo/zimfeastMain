import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** Shape of a saved address from the auth-service API. */
export interface SavedAddress {
  id: string;
  label: string;
  address_text: string;
  lat: number;
  lng: number;
  created: string;
}

interface AddressBookProps {
  /** Called when the user clicks a saved address to select it. */
  onSelect?: (address: SavedAddress) => void;
  /** If provided, the currently selected address id gets highlighted. */
  selectedId?: string | null;
  /** Show a compact view (no add/edit buttons, just selectable list). */
  compact?: boolean;
}

/**
 * AddressBook displays the user's saved addresses and allows CRUD operations.
 * When `onSelect` is provided, clicking an address selects it (useful during
 * checkout). The component calls GET/POST/PATCH/DELETE on
 * /api/accounts/addresses/ which is served by the auth-service.
 */
export default function AddressBook({ onSelect, selectedId, compact = false }: AddressBookProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Fetch all saved addresses
  const { data: addresses = [], isLoading } = useQuery<SavedAddress[]>({
    queryKey: ["/api/accounts/addresses/"],
    queryFn: () => apiRequest<SavedAddress[]>("/api/accounts/addresses/"),
  });

  // Create address
  const createMutation = useMutation({
    mutationFn: async (payload: { label: string; address_text: string; lat: number; lng: number }) => {
      return apiRequest<SavedAddress>("/api/accounts/addresses/", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/addresses/"] });
      toast({ title: "Address Saved", description: "Your address has been added." });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Update address
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; label: string; address_text: string; lat: number; lng: number }) => {
      return apiRequest<SavedAddress>(`/api/accounts/addresses/${id}/`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/addresses/"] });
      toast({ title: "Address Updated" });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete address
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest<void>(`/api/accounts/addresses/${id}/`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/addresses/"] });
      toast({ title: "Address Deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingAddress(null);
    setLabel("");
    setAddressText("");
    setLat(null);
    setLng(null);
  };

  const handleEdit = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setLabel(addr.label);
    setAddressText(addr.address_text);
    setLat(addr.lat);
    setLng(addr.lng);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !addressText.trim()) {
      toast({ title: "Validation Error", description: "Label and address are required.", variant: "destructive" });
      return;
    }

    const payload = {
      label: label.trim(),
      address_text: addressText.trim(),
      lat: lat ?? 0,
      lng: lng ?? 0,
    };

    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  /** Use the browser Geolocation API to fill lat/lng automatically. */
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not Supported", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        toast({ title: "Location Captured", description: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
      },
      () => {
        toast({ title: "Location Denied", description: "Could not access your location.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <i className="fas fa-spinner fa-spin text-orange-500 text-xl mr-2"></i>
        <span className="text-gray-500 dark:text-gray-400">Loading addresses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Address List */}
      {addresses.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No saved addresses yet.
        </p>
      )}

      {addresses.map((addr) => (
        <Card
          key={addr.id}
          className={`p-3 cursor-pointer transition-all border-2 ${
            selectedId === addr.id
              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
              : "border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800"
          }`}
          onClick={() => onSelect?.(addr)}
          data-testid={`address-card-${addr.id}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-orange-500"></i>
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  {addr.label}
                </span>
                {selectedId === addr.id && (
                  <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                {addr.address_text}
              </p>
            </div>

            {!compact && (
              <div className="flex gap-1 ml-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(addr);
                  }}
                  data-testid={`edit-address-${addr.id}`}
                >
                  <i className="fas fa-pen text-xs"></i>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(addr.id);
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid={`delete-address-${addr.id}`}
                >
                  <i className="fas fa-trash text-xs text-red-500"></i>
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}

      {/* Add / Edit Form */}
      {showForm ? (
        <Card className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
              {editingAddress ? "Edit Address" : "Add New Address"}
            </h4>

            <div>
              <Label htmlFor="addr-label" className="text-xs">Label</Label>
              <Input
                id="addr-label"
                placeholder="e.g. Home, Office, Mom's House"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="input-address-label"
              />
            </div>

            <div>
              <Label htmlFor="addr-text" className="text-xs">Address</Label>
              <Input
                id="addr-text"
                placeholder="123 Samora Machel Ave, Harare"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                data-testid="input-address-text"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="addr-lat" className="text-xs">Latitude</Label>
                <Input
                  id="addr-lat"
                  type="number"
                  step="any"
                  placeholder="-17.8292"
                  value={lat ?? ""}
                  onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div>
                <Label htmlFor="addr-lng" className="text-xs">Longitude</Label>
                <Input
                  id="addr-lng"
                  type="number"
                  step="any"
                  placeholder="31.0522"
                  value={lng ?? ""}
                  onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={useCurrentLocation}
              data-testid="button-use-current-location"
            >
              <i className="fas fa-crosshairs mr-2"></i>
              Use Current Location
            </Button>

            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                className="flex-1"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-address"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save Address"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        !compact && (
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setShowForm(true)}
            data-testid="button-add-new-address"
          >
            <i className="fas fa-plus mr-2"></i>
            Add New Address
          </Button>
        )
      )}
    </div>
  );
}
