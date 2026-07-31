import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MasterListParams,
  ProductCategoryPayload,
  ProductPayload,
} from "@/modules/master-data/types/master-data.types";
import {
  createProductCategory,
  createProduct,
  getProductCategories,
  getItems,
  getPhysicalCodes,
  getSuppliers,
  getProducts,
  getUoms,
  importSkus,
  updateProductStatus,
} from "@/modules/master-data/services/master-data.service";

export const masterDataKeys = {
  all: ["master-data"] as const,
  products: (params: MasterListParams) =>
    [...masterDataKeys.all, "products", params] as const,
  categories: (params: MasterListParams) =>
    [...masterDataKeys.all, "product-categories", params] as const,
  items: (params: MasterListParams) =>
    [...masterDataKeys.all, "items", params] as const,
  codes: (params: MasterListParams) =>
    [...masterDataKeys.all, "physical-codes", params] as const,
};

export function useSkus(params: MasterListParams) {
  return useQuery({
    queryKey: masterDataKeys.products(params),
    queryFn: () => getProducts(params),
  });
}

export function useItems(params: MasterListParams) {
  return useQuery({
    queryKey: masterDataKeys.items(params),
    queryFn: () => getItems(params),
  });
}

export function usePhysicalCodes(params: MasterListParams) {
  return useQuery({
    queryKey: masterDataKeys.codes(params),
    queryFn: () => getPhysicalCodes(params),
  });
}

export function useProductCategories(params: MasterListParams, enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.categories(params),
    queryFn: () => getProductCategories(params),
    enabled,
  });
}

export function useUoms(enabled = true) {
  return useQuery({
    queryKey: [...masterDataKeys.all, "uoms"],
    queryFn: getUoms,
    enabled,
  });
}

export function useSuppliers(enabled = true) {
  return useQuery({
    queryKey: [...masterDataKeys.all, "suppliers"],
    queryFn: getSuppliers,
    enabled,
  });
}

export function useCreateSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductPayload) => createProduct(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductCategoryPayload) => createProductCategory(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}

export function useUpdateSkuStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number | string;
      status: "active" | "inactive" | "discontinued";
    }) => updateProductStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}

export function useImportSkus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importSkus(file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.all }),
  });
}
