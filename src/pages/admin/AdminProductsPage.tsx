import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  useProducts,
  useUpsertProduct,
  useDeleteProduct,
  uploadProductImage,
} from "@/queries/products";
import type { ProductRow } from "@/lib/database.types";
import { formatINR } from "@/lib/format";

interface FormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  is_active: boolean;
}

export function AdminProductsPage() {
  const { data: products, isLoading } = useProducts();
  const upsert = useUpsertProduct();
  const deleteProduct = useDeleteProduct();
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      price: "",
      stock: "",
      is_active: true,
    },
  });

  const openNew = useCallback(() => {
    form.reset({
      name: "",
      description: "",
      price: "",
      stock: "",
      is_active: true,
    });
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  }, [form]);

  const openEdit = useCallback(
    (p: ProductRow) => {
      form.reset({
        name: p.name,
        description: p.description ?? "",
        price: String(p.price),
        stock: p.stock != null ? String(p.stock) : "",
        is_active: p.is_active,
      });
      setEditing(p);
      setImageFile(null);
      setImagePreview(p.image_url);
      setShowModal(true);
    },
    [form],
  );

  const close = () => setShowModal(false);

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const onSave = form.handleSubmit(async (data) => {
    setSaving(true);
    try {
      let imageUrl = editing?.image_url ?? null;
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile);
      }
      await upsert.mutateAsync({
        id: editing?.id,
        name: data.name.trim(),
        description: data.description.trim() || null,
        price: Number(data.price),
        image_url: imageUrl,
        stock: data.stock ? Number(data.stock) : null,
        is_active: data.is_active,
      });
      toast.success(editing ? "Product updated." : "Product added.");
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  });

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Product deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Products</h1>
        <Button onClick={openNew}>+ Add product</Button>
      </div>

      {!products || products.length === 0 ? (
        <EmptyState
          title="No products"
          description="Add your first product to start selling."
          action={<Button onClick={openNew}>+ Add product</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {products.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-slate-300">
                      📦
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {p.name}
                    </span>
                    {!p.is_active ? <Badge tone="neutral">Inactive</Badge> : null}
                  </div>
                  <div className="text-sm text-slate-500">
                    {formatINR(p.price)}
                    {p.stock != null ? ` · Stock: ${p.stock}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(p)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onDelete(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={close}
        title={editing ? "Edit product" : "Add product"}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button loading={saving} onClick={onSave}>
              {editing ? "Save" : "Add product"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label required>Name</Label>
            <Input {...form.register("name", { required: "Required" })} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea {...form.register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...form.register("price", { required: "Required", min: 0 })}
              />
              <FieldError message={form.formState.errors.price?.message} />
            </div>
            <div>
              <Label>Stock (optional)</Label>
              <Input type="number" min="0" {...form.register("stock")} />
            </div>
          </div>
          <div>
            <Label>Image</Label>
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="text-sm"
            />
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-2 h-24 w-24 rounded-lg object-cover"
              />
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...form.register("is_active")}
              className="rounded"
            />
            Active (visible to customers)
          </label>
        </div>
      </Modal>
    </div>
  );
}
