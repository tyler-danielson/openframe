import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  ExternalLink,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { api, type SystemSetting } from "../../services/api";
import type { ShoppingItem } from "@openframe/shared";

export function ShoppingListWidget() {
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState("");

  const {
    data: items = [],
    isLoading,
  } = useQuery({
    queryKey: ["shopping-items"],
    queryFn: () => api.getShoppingItems(),
    refetchInterval: 60000,
  });

  const { data: amazonSettings = [] } = useQuery({
    queryKey: ["settings", "amazon"],
    queryFn: () => api.getCategorySettings("amazon"),
  });

  const affiliateTag =
    amazonSettings.find((s: SystemSetting) => s.key === "affiliate_tag")
      ?.value || "";

  const uncheckedItems = items.filter((i: ShoppingItem) => !i.checked);
  const checkedItems = items.filter((i: ShoppingItem) => i.checked);

  const createItem = useMutation({
    mutationFn: (name: string) => api.createShoppingItem({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
      setNewItemName("");
    },
  });

  const toggleItem = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      api.updateShoppingItem(id, { checked }),
    onMutate: async ({ id, checked }) => {
      await queryClient.cancelQueries({ queryKey: ["shopping-items"] });
      const previous = queryClient.getQueryData<ShoppingItem[]>(["shopping-items"]);
      queryClient.setQueryData<ShoppingItem[]>(["shopping-items"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, checked } : item))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["shopping-items"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.deleteShoppingItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  const clearChecked = useMutation({
    mutationFn: () => api.clearCheckedShoppingItems(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  function getAmazonUrl(item: ShoppingItem): string {
    if (item.amazonUrl) return item.amazonUrl;
    const query = encodeURIComponent(item.name);
    const url = `https://www.amazon.com/s?k=${query}`;
    return affiliateTag ? `${url}&tag=${encodeURIComponent(affiliateTag)}` : url;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    createItem.mutate(trimmed);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Items list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <div className="p-3 rounded-full bg-primary/10">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm">No items yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 flex-1 min-h-0">
          {/* Unchecked items */}
          {uncheckedItems.map((item: ShoppingItem) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 py-1.5 px-1 rounded hover:bg-primary/5"
            >
              <button
                onClick={() =>
                  toggleItem.mutate({ id: item.id, checked: true })
                }
                className="w-4 h-4 rounded border-2 border-primary/40 shrink-0 hover:border-primary transition-colors"
              />
              <span className="flex-1 text-sm truncate">{item.name}</span>
              <a
                href={getAmazonUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 text-primary transition-opacity"
                title="Search on Amazon"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => deleteItem.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Checked items */}
          {checkedItems.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {checkedItems.length} checked
                </span>
                <button
                  onClick={() => clearChecked.mutate()}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Clear
                </button>
              </div>
              {checkedItems.map((item: ShoppingItem) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 py-1.5 px-1 rounded hover:bg-primary/5"
                >
                  <button
                    onClick={() =>
                      toggleItem.mutate({ id: item.id, checked: false })
                    }
                    className="w-4 h-4 rounded border-2 border-primary bg-primary shrink-0 flex items-center justify-center transition-colors"
                  >
                    <svg
                      className="w-3 h-3 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                  <span className="flex-1 text-sm truncate line-through text-muted-foreground">
                    {item.name}
                  </span>
                  <button
                    onClick={() => deleteItem.mutate(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Add item form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Add item..."
          className="flex-1 text-sm px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="submit"
          disabled={!newItemName.trim() || createItem.isPending}
          className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
