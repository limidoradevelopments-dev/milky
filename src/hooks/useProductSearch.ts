
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function useProductSearch(searchTerm: string, category: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("q", searchTerm);
      if (category && category !== "All") params.set("category", category);

      const response = await fetch(`/api/products/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      const data: Product[] = await response.json();
      setProducts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load products");
      // Optional: limit toast spam if user types fast (though we debounce in parent usually)
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    refetch: fetchProducts
  };
}
