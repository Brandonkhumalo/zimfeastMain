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

interface MenuItemData {
  id: string;
  name: string;
  price: string;
  description: string;
  category: string[];
  prep_time: number;
  available: boolean;
  item_image: string | null;
}

interface MenuItemFormProps {
  isEdit?: boolean;
  editItem?: MenuItemData | null;
  onSuccess?: () => void;
}

interface Category {
  id: number;
  name: string;
}

export default function MenuItemForm({ isEdit = false, editItem = null, onSuccess }: MenuItemFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(
    isEdit && editItem?.item_image ? editItem.item_image : null
  );

  const form = useForm<MenuItemFormValues>({
    defaultValues: {
      name: editItem?.name || "",
      price: editItem?.price || "0.00",
      description: editItem?.description || "",
      category: "",
      preparationTime: editItem?.prep_time || 15,
      available: editItem?.available ?? true,
    },
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/restaurants/get/category/types/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch categories");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          if (isEdit && editItem?.category && editItem.category.length > 0) {
            const match = data.find((c: Category) => c.name === editItem.category[0]);
            if (match) {
              form.setValue("category", match.id.toString());
            }
          }
        } else {
          setCategories([]);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit: SubmitHandler<MenuItemFormValues> = async (data) => {
    try {
      if (!isEdit && (!data.image || data.image.length === 0)) {
        alert("Please select an image for the menu item.");
        return;
      }

      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("price", data.price);
      formData.append("description", data.description);
      if (data.category) {
        formData.append("category", data.category);
      }
      formData.append("prep_time", data.preparationTime.toString());
      formData.append("available", data.available ? "true" : "false");
      if (data.image && data.image.length > 0) {
        formData.append("item_image", data.image[0]);
      }

      const url = isEdit && editItem
        ? `/api/restaurants/menu/${editItem.id}/update/`
        : "/api/restaurants/add/menu-items/";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error saving menu item:", error);
        alert(`Failed to ${isEdit ? "update" : "add"} menu item. Check console for details.`);
        return;
      }

      alert(`Menu item ${isEdit ? "updated" : "added"} successfully!`);
      if (!isEdit) {
        form.reset();
        setImagePreview(null);
      }
      onSuccess?.();
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="preparationTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preparation Time (min)</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="available"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between">
              <FormLabel>Available</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel className={isEdit ? "" : "text-red-600"}>
                Item Image {!isEdit && <span className="text-sm">(Required)</span>}
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    {...field}
                    onChange={(e) => {
                      onChange(e.target.files);
                      if (e.target.files && e.target.files[0]) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setImagePreview(event.target?.result as string);
                        };
                        reader.readAsDataURL(e.target.files[0]);
                      }
                    }}
                    required={!isEdit}
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
