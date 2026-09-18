"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import {
  createProduct,
  getProducts,
  toggleProductStatus,
  updateProduct,
  type ProductDTO,
} from "./actions";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

type ProductsManagerProps = {
  initialProducts: ProductDTO[];
};

export function ProductsManager({ initialProducts }: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [isPending, startTransition] = useTransition();
  const [showInactive, setShowInactive] = useState(false);

  function refresh() {
    startTransition(async () => {
      const result = await getProducts({ status: "all" });
      setProducts(result);
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", price: "" });
    setDialogOpen(true);
  }

  function openEdit(product: ProductDTO) {
    setEditing(product);
    setForm({ name: product.name, description: product.description ?? "", price: product.price.toString() });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const price = parseFloat(form.price);
    if (!form.name.trim() || isNaN(price) || price <= 0) {
      toast.error("Inserisci nome e prezzo validi.");
      return;
    }

    startTransition(async () => {
      const values = { name: form.name, description: form.description, price };
      const result = editing
        ? await updateProduct(editing.id, values)
        : await createProduct(values);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Prodotto aggiornato." : "Prodotto aggiunto.");
      setDialogOpen(false);
      refresh();
    });
  }

  function handleToggle(product: ProductDTO) {
    startTransition(async () => {
      const result = await toggleProductStatus(product.id, !product.isActive);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.product.isActive ? "Prodotto attivato." : "Prodotto disattivato.");
      refresh();
    });
  }

  const displayed = showInactive ? products : products.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prodotti</h1>
          <p className="text-muted-foreground">Catalogo prodotti in vendita al centro.</p>
        </div>
        <Button onClick={openCreate}>+ Nuovo prodotto</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive">Mostra prodotti disattivati</Label>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessun prodotto."}
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {product.description ?? "—"}
                    </TableCell>
                    <TableCell>{currencyFormatter.format(product.price)}</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? "Attivo" : "Disattivato"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                          Modifica
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(product)}
                          disabled={isPending}
                        >
                          {product.isActive ? "Disattiva" : "Attiva"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica prodotto" : "Nuovo prodotto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-name">Nome *</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Crema mani rigenerante"
              />
            </div>
            <div>
              <Label htmlFor="product-desc">Descrizione</Label>
              <Textarea
                id="product-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrizione del prodotto..."
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="product-price">Prezzo (€) *</Label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="24.90"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
