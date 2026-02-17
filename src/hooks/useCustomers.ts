"use client";

import { useState, useEffect, useCallback } from "react";
import type { Customer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = "/api/customers";
const CACHE_KEY = "customersCache";


export function useCustomers(paginated: boolean = false, searchTerm: string = "") {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();

  // Search function
  const searchCustomers = useCallback(async (term: string) => {
    if (!term || term.length < 2) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error('Failed to search customers');
      const data = await response.json();
      setCustomers(data);
      setHasMore(false); // Search results are currently not paginated in the same way
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while searching.";
      setError(errorMessage);
      // Don't toast on search error to avoid spamming, just show in UI or log
      console.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    if (searchTerm && searchTerm.length >= 2) {
      await searchCustomers(searchTerm);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // For non-paginated (dropdowns etc), fetch a large number
      const response = await fetch(`${API_BASE_URL}?limit=10000`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();

      const fetchedCustomers = data.customers || [];
      setCustomers(fetchedCustomers);
      localStorage.setItem(CACHE_KEY, JSON.stringify(fetchedCustomers));
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while fetching customers.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Fetching Customers",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, searchTerm, searchCustomers]);

  const fetchInitialPaginated = useCallback(async () => {
    if (searchTerm && searchTerm.length >= 2) {
      await searchCustomers(searchTerm);
      return;
    }

    setError(null);
    setIsLoading(true);
    setHasMore(true);

    // Load from cache first for instant render (only if not searching)
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomers(parsed);
          // Don't set isLoading(false) here, we want to fetch fresh data
        }
      }
    } catch (e) {
      console.warn("Could not read customers from cache", e);
    }

    // Fetch fresh data
    try {
      const response = await fetch(`${API_BASE_URL}?limit=50`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();

      const freshCustomers = data.customers || [];
      setCustomers(freshCustomers);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);

      localStorage.setItem(CACHE_KEY, JSON.stringify(freshCustomers));
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while fetching customers.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error Fetching Customers", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [toast, searchTerm, searchCustomers]);

  const loadMoreCustomers = useCallback(async () => {
    if (searchTerm && searchTerm.length >= 2) return; // Disable load more during search
    if (!hasMore || isLoading || !nextCursor) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}?limit=50&cursor=${nextCursor}`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();

      const newCustomers = data.customers || [];
      setCustomers(prev => [...prev, ...newCustomers]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err: any) {
      const errorMessage = err.message || "An unknown error occurred while fetching more customers.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error Loading More", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [nextCursor, hasMore, isLoading, toast, searchTerm]);


  useEffect(() => {
    if (paginated) {
      fetchInitialPaginated();
    } else {
      // Logic for non-paginated (mostly used for dropdowns, might not need search there yet or handled differently)
      // If we want search in dropdowns, we should verify wherever useCustomers(false) is used.
      // For now, let's assume non-paginated means "load everything" or "load default"
      const loadData = async () => {
        if (searchTerm && searchTerm.length >= 2) {
          await searchCustomers(searchTerm);
        } else {
          try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
              setCustomers(JSON.parse(cachedData));
              setIsLoading(false);
            }
          } catch (e) {
            console.warn("Could not read customers from cache", e);
          }
          await refetch();
        }
      };
      loadData();
    }
  }, [paginated, refetch, fetchInitialPaginated, searchTerm]); // Added searchTerm dependency


  const addCustomer = async (customerData: Omit<Customer, "id" | "avatar">): Promise<Customer | null> => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to add customer" }));
        throw new Error(errorData.details || errorData.error || "Failed to add customer. Server responded with an error.");
      }
      const newCustomer = await response.json();
      await refetch();
      return newCustomer;
    } catch (err: any) {
      console.error("Error adding customer:", err);
      toast({
        variant: "destructive",
        title: "Failed to Add Customer",
        description: err.message,
      });
      return null;
    }
  };

  const updateCustomer = async (id: string, customerData: Partial<Omit<Customer, "id">>): Promise<Customer | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update customer" }));
        throw new Error(errorData.details || errorData.error || `Failed to update customer. Server responded with status ${response.status}.`);
      }
      await refetch();
      const updatedCustomerState = customers.find(c => c.id === id);
      return updatedCustomerState ? { ...updatedCustomerState, ...customerData } as Customer : null;

    } catch (err: any) {
      console.error("Error updating customer:", err);
      toast({
        variant: "destructive",
        title: "Failed to Update Customer",
        description: err.message,
      });
      return null;
    }
  };

  const deleteCustomer = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete customer" }));
        throw new Error(errorData.details || errorData.error || `Failed to delete customer. Server responded with status ${response.status}.`);
      }
      await refetch();
      return true;
    } catch (err: any) {
      console.error("Error deleting customer:", err);
      toast({
        variant: "destructive",
        title: "Failed to Delete Customer",
        description: err.message,
      });
      return false;
    }
  };

  return {
    customers,
    isLoading,
    error,
    hasMore,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refetchCustomers: refetch,
    loadMoreCustomers,
  };
}
