import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface MenuItemFormValues {
  name: string;
  price: string;
  description: string;
  category: string;
  preparationTime: number;
  available: boolean;
  image: FileList;
}

interface MenuItemFormProps {
  isEdit?: boolean;
}

interface Category {
  id: number;
  name: string;
}

export default function MenuItemForm({ isEdit = false }: MenuItemFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<MenuItemFormValues>({
    defaultValues: {
      name: "",
      price: "0.00",
      description: "",
      category: "",
      preparationTime: 15,
      available: true,
    },
  });

  // Fetch categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          "http://127.0.0.1:8000/api/restaurants/get/category/types/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Failed to fetch categories");

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
        } else {
          setCategories([]); // no categories
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setCategories([]); // fallback
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleAddMenuItem: SubmitHandler<MenuItemFormValues> = async (data) => {
    try {
      // Validate that an image is selected
      if (!data.image || data.image.length === 0) {
        alert("Please select an image for the menu item.");
        return;
      }

      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("price", data.price);
      formData.append("description", data.description);
      formData.append("category", data.category);
      formData.append("prep_time", data.preparationTime.toString());
      formData.append("available", data.available ? "true" : "false");
      formData.append("item_image", data.image[0]); // Add the image file

      const response = await fetch(
        "http://127.0.0.1:8000/api/restaurants/add/menu-items/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Error adding menu item:", error);
        alert("Failed to add menu item. Check console for details.");
        return;
      }

      const result = await response.json();
      console.log("Menu item added successfully:", result);
      alert("Menu item added successfully!");
      form.reset();
      setImagePreview(null); // Clear image preview
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleAddMenuItem)}
        className="space-y-4"
      >
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Price */}
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={loadingCategories || categories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      loadingCategories
                        ? "Loading categories..."
                        : categories.length === 0
                        ? "No food category found"
                        : "Select category"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length > 0
                      ? categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                          </SelectItem>
                        ))
                      : null}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preparation Time */}
        <FormField
          control={form.control}
          name="preparationTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preparation Time (min)</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Available Switch */}
        <FormField
          control={form.control}
          name="available"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between">
              <FormLabel>Available</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image Upload - MANDATORY */}
        <FormField
          control={form.control}
          name="image"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel className="text-red-600">
                Item Image <span className="text-sm">(Required)</span>
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    {...field}
                    onChange={(e) => {
                      onChange(e.target.files);
                      // Preview the image
                      if (e.target.files && e.target.files[0]) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setImagePreview(event.target?.result as string);
                        };
                        reader.readAsDataURL(e.target.files[0]);
                      }
                    }}
                    required
                    className="cursor-pointer"
                  />
                  {imagePreview && (
                    <div className="mt-2 border rounded-lg p-2">
                      <p className="text-sm text-gray-600 mb-2">Image Preview:</p>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full h-48 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">{isEdit ? "Update Item" : "Add Item"}</Button>
      </form>
    </Form>
  );
}
