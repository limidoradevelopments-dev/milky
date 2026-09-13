
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Sale } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const CACHE_KEY = "salesCache";
const PAGE_SIZE = 50;

export function useSalesData(fetchAllInitially: boolean = false) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Search-related state
  const [searchedSales, setSearchedSales] = useState<Sale[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchTerm, setActiveSearchTerm] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchInitialSales = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to load from cache first for instant render
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsedSales = JSON.parse(cachedData).map((s: any) => ({ ...s, saleDate: new Date(s.saleDate) }));
        setSales(parsedSales);
      }
    } catch (e) {
      console.warn("Could not read sales from cache", e);
    }

    try {
      // Fetch first page (or all if fetchAllInitially is true)
      const url = fetchAllInitially ? '/api/sales?limit=10000' : `/api/sales?limit=${PAGE_SIZE}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch sales');
      const data = await res.json();

      const processedSales = data.sales.map((s: any) => ({ ...s, saleDate: new Date(s.saleDate) }));
      setSales(processedSales);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify(processedSales));

    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while fetching sales.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Fetching Sales",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, fetchAllInitially]);

  useEffect(() => {
    fetchInitialSales();
  }, [fetchInitialSales]);

  const loadMoreSales = useCallback(async () => {
    if (!hasMore || isLoading || !nextCursor) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/sales?limit=${PAGE_SIZE}&cursor=${nextCursor}`);
      if (!res.ok) throw new Error('Failed to fetch more sales');
      const data = await res.json();

      const processedSales = data.sales.map((s: any) => ({ ...s, saleDate: new Date(s.saleDate) }));

      setSales(prev => {
        const combined = [...prev, ...processedSales];
        // Update cache with all loaded sales
        localStorage.setItem(CACHE_KEY, JSON.stringify(combined));
        return combined;
      });
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);

    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while fetching more sales.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Loading More Sales",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nextCursor, hasMore, isLoading, toast]);

  // Server-side search function - fetches ALL matching invoices
  const searchSales = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();

    // If search is cleared, reset to paginated data
    if (!trimmed) {
      setSearchedSales(null);
      setActiveSearchTerm(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setActiveSearchTerm(trimmed);

    try {
      const res = await fetch(`/api/sales?search=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error('Failed to search sales');
      const data = await res.json();

      const processedSales = data.sales.map((s: any) => ({ ...s, saleDate: new Date(s.saleDate) }));
      setSearchedSales(processedSales);
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while searching.";
      toast({
        variant: "destructive",
        title: "Search Failed",
        description: errorMessage,
      });
      setSearchedSales(null);
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  // Clear search and return to paginated view
  const clearSearch = useCallback(() => {
    setSearchedSales(null);
    setActiveSearchTerm(null);
    setIsSearching(false);
  }, []);

  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.status !== 'cancelled' ? sale.totalAmount : 0), 0);

  return {
    sales,
    setSales,
    isLoading,
    error,
    totalRevenue,
    hasMore,
    loadMoreSales,
    refetchSales: fetchInitialSales,
    // Search-related exports
    searchSales,
    clearSearch,
    searchedSales,
    isSearching,
    activeSearchTerm,
  };
}
