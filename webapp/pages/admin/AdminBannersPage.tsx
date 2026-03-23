import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "./components/PageHeader";
import { Plus, Image, Trash2 } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  description: string;
  image: string | null;
  link_url: string;
  campaign_type: string;
  target_audience: string;
  free_delivery_threshold: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  priority: number;
  created: string;
}

const CAMPAIGN_TYPES = [
  { value: "info", label: "Information" },
  { value: "free_delivery", label: "Free Delivery" },
  { value: "discount", label: "Discount" },
  { value: "new_restaurant", label: "New Restaurant" },
];

const TARGET_AUDIENCES = [
  { value: "all", label: "All Users" },
  { value: "new_users", label: "New Users" },
  { value: "returning", label: "Returning Users" },
];

export default function AdminBannersPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    link_url: "",
    campaign_type: "info",
    target_audience: "all",
    free_delivery_threshold: "",
    start_date: "",
    end_date: "",
    priority: "0",
  });

  const { data: banners = [], isLoading, refetch } = useQuery<Banner[]>({
    queryKey: ["admin-banners"],
    queryFn: () => apiRequest<Banner[]>("/api/restaurants/admin/banners/"),
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) =>
      fetch("/api/restaurants/admin/banners/", { method: "POST", body: formData })
        .then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Banner created" });
      setShowCreate(false);
      resetForm();
      refetch();
    },
    onError: () => toast({ title: "Error", description: "Failed to create banner", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/restaurants/admin/banners/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Banner deactivated" });
      refetch();
    },
  });

  function resetForm() {
    setForm({
      title: "", description: "", link_url: "", campaign_type: "info",
      target_audience: "all", free_delivery_threshold: "", start_date: "",
      end_date: "", priority: "0",
    });
  }

  function handleCreate() {
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("link_url", form.link_url);
    fd.append("campaign_type", form.campaign_type);
    fd.append("target_audience", form.target_audience);
    if (form.free_delivery_threshold) fd.append("free_delivery_threshold", form.free_delivery_threshold);
    fd.append("start_date", form.start_date);
    fd.append("end_date", form.end_date);
    fd.append("priority", form.priority);
    fd.append("is_active", "true");
    createMutation.mutate(fd);
  }

  function getBannerStatus(banner: Banner): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
    if (!banner.is_active) return { label: "Inactive", variant: "secondary" };
    const now = new Date();
    if (new Date(banner.start_date) > now) return { label: "Scheduled", variant: "outline" };
    if (new Date(banner.end_date) < now) return { label: "Expired", variant: "destructive" };
    return { label: "Active", variant: "default" };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Banners & Campaigns" description="Manage promotional banners displayed to customers." />
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Banner
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading banners...</p>
      ) : banners.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">No banners yet. Create your first campaign.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {banners.map((banner) => {
            const status = getBannerStatus(banner);
            return (
              <Card key={banner.id} className="shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {banner.image ? (
                      <img src={banner.image} alt={banner.title} className="w-20 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className="w-20 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Image className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{banner.title}</p>
                      <p className="text-sm text-muted-foreground">{banner.description || "No description"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <span className="text-xs text-muted-foreground capitalize">{banner.campaign_type.replace("_", " ")}</span>
                        <span className="text-xs text-muted-foreground">Priority: {banner.priority}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => deactivateMutation.mutate(banner.id)}
                    disabled={!banner.is_active}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Banner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <Input placeholder="Link URL (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select value={form.campaign_type} onValueChange={(v) => setForm({ ...form, campaign_type: v })}>
                <SelectTrigger><SelectValue placeholder="Campaign Type" /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
                <SelectTrigger><SelectValue placeholder="Target" /></SelectTrigger>
                <SelectContent>
                  {TARGET_AUDIENCES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.campaign_type === "free_delivery" && (
              <Input type="number" placeholder="Min order for free delivery ($)" value={form.free_delivery_threshold}
                onChange={(e) => setForm({ ...form, free_delivery_threshold: e.target.value })} />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <Input type="number" placeholder="Priority (higher = shown first)" value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            <Button onClick={handleCreate} disabled={!form.title || !form.start_date || !form.end_date || createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Creating..." : "Create Banner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
