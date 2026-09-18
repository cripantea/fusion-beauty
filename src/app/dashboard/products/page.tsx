import { getProducts } from "./actions";
import { ProductsManager } from "./products-manager";

export default async function ProductsPage() {
  const products = await getProducts({ status: "all" });
  return <ProductsManager initialProducts={products} />;
}
