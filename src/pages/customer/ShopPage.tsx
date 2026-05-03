import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useProducts } from "@/queries/products";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/format";

export function ShopPage() {
  const { data: products, isLoading, error } = useProducts({ activeOnly: true });
  const cart = useCart();
  const toast = useToast();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  if (isLoading) return <PageSpinner />;
  if (error) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600">
            Failed to load products: {(error as Error).message}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Shop</h1>
          <p className="text-sm text-slate-500">
            Browse products and add to your cart.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Link to="/cart">
            <Button variant="primary">Cart ({cart.count})</Button>
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? "No products match" : "No products yet"}
          description={
            search
              ? "Try a different search term."
              : "Your supplier hasn't added any products yet."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              <div className="aspect-[4/3] w-full bg-slate-100">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">
                    📦
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <span className="shrink-0 text-base font-semibold text-brand-700">
                    {formatINR(p.price)}
                  </span>
                </div>
                {p.description ? (
                  <p className="line-clamp-3 text-sm text-slate-600">
                    {p.description}
                  </p>
                ) : null}
                <div className="mt-auto pt-2">
                  <Button
                    onClick={() => {
                      cart.add(p);
                      toast.success(`${p.name} added to cart`);
                    }}
                    className="w-full"
                    variant="primary"
                  >
                    Add to cart
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
