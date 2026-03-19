import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ExternalAPIFormValues {
  category: string;
  api_url: string;
  api_key: string;
}

interface ExternalAPIDialogProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
}

export default function ExternalAPIDialog({
  isOpen,
  onClose,
  restaurantId,
}: ExternalAPIDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExternalAPIFormValues>({
    defaultValues: {
      category: "",
      api_url: "",
      api_key: "",
    },
  });

  const handleSubmit: SubmitHandler<ExternalAPIFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/restaurants/${restaurantId}/external-apis/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Error adding external API:", error);
        toast({
          title: "Error",
          description: error.detail || "Failed to add external API",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      console.log("External API added successfully:", result);
      toast({
        title: "Success",
        description: "External API added successfully!",
      });
      form.reset();
      onClose();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-plug text-primary"></i>
            Add External API Integration
          </DialogTitle>
          <DialogDescription>
            Connect external APIs to your restaurant for enhanced functionality
            like menu synchronization and data management.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5"
          >
            {/* Category Field */}
            <FormField
              control={form.control}
              name="category"
              rules={{ required: "Category is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Category</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select API category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="menu_api">Menu API</SelectItem>
                        <SelectItem value="meal_data">Meal Data</SelectItem>
                        <SelectItem value="categories">Categories</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Choose the type of integration you want to add
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API URL Field */}
            <FormField
              control={form.control}
              name="api_url"
              rules={{
                required: "API URL is required",
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: "Please enter a valid URL (starting with http:// or https://)",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://api.example.com/v1/..."
                      type="url"
                    />
                  </FormControl>
                  <FormDescription>
                    The endpoint URL for your external API
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API Key Field */}
            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter your API key"
                      type="password"
                    />
                  </FormControl>
                  <FormDescription>
                    Your API authentication key (if required)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus mr-2"></i>
                    Add API
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
