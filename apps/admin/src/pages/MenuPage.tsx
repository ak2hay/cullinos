import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { menuApi, type MenuCategory, type MenuItem } from '@/lib/api';
import { formatMoney } from '@/lib/format';

export function MenuPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'categories' | 'items'>('categories');
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    basePrice: '',
  });
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['menu', 'categories'],
    queryFn: menuApi.listCategories,
  });

  const itemsQuery = useQuery({
    queryKey: ['menu', 'items'],
    queryFn: menuApi.listItems,
  });

  const createCategory = useMutation({
    mutationFn: menuApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] });
      setCategoryForm({ name: '', description: '' });
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof menuApi.updateCategory>[1] }) =>
      menuApi.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] });
      setEditingCategory(null);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: menuApi.deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] }),
  });

  const createItem = useMutation({
    mutationFn: menuApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
      setItemForm({ name: '', description: '', categoryId: '', basePrice: '' });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof menuApi.updateItem>[1] }) =>
      menuApi.updateItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
      setEditingItem(null);
    },
  });

  const deleteItem = useMutation({
    mutationFn: menuApi.deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu', 'items'] }),
  });

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Menu</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage categories and menu items.
          </p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-bg-card p-1">
          {(['categories', 'items'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-2 text-sm capitalize transition ${
                activeTab === tab
                  ? 'bg-brand-primary text-bg-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'categories' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">
              {editingCategory ? 'Edit category' : 'New category'}
            </h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (editingCategory) {
                  updateCategory.mutate({
                    id: editingCategory.id,
                    payload: {
                      name: categoryForm.name,
                      description: categoryForm.description || undefined,
                    },
                  });
                } else {
                  createCategory.mutate({
                    name: categoryForm.name,
                    description: categoryForm.description || undefined,
                  });
                }
              }}
            >
              <Input
                label="Name"
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button type="submit" loading={createCategory.isPending || updateCategory.isPending}>
                  {editingCategory ? 'Save changes' : 'Add category'}
                </Button>
                {editingCategory ? (
                  <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">Categories</h2>
            {categoriesQuery.isLoading ? (
              <p className="mt-4 text-sm text-text-muted">Loading…</p>
            ) : categories.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">No categories yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {categories.map((category) => (
                  <li key={category.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.description ? (
                        <p className="text-sm text-text-muted">{category.description}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryForm({
                            name: category.name,
                            description: category.description ?? '',
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => deleteCategory.mutate(category.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{editingItem ? 'Edit item' : 'New menu item'}</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const basePrice = Math.round(parseFloat(itemForm.basePrice) * 100);
                if (editingItem) {
                  updateItem.mutate({
                    id: editingItem.id,
                    payload: {
                      name: itemForm.name,
                      description: itemForm.description || undefined,
                      basePrice,
                    },
                  });
                } else {
                  createItem.mutate({
                    categoryId: itemForm.categoryId,
                    name: itemForm.name,
                    description: itemForm.description || undefined,
                    basePrice,
                  });
                }
              }}
            >
              {!editingItem ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">Category</label>
                  <select
                    required
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <Input
                label="Name"
                required
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Description"
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
              />
              <Input
                label="Price (₹)"
                type="number"
                min="0"
                step="0.01"
                required
                value={itemForm.basePrice}
                onChange={(e) => setItemForm((f) => ({ ...f, basePrice: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button type="submit" loading={createItem.isPending || updateItem.isPending}>
                  {editingItem ? 'Save changes' : 'Add item'}
                </Button>
                {editingItem ? (
                  <Button type="button" variant="ghost" onClick={() => setEditingItem(null)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">Menu items</h2>
            {itemsQuery.isLoading ? (
              <p className="mt-4 text-sm text-text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">No items yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-text-muted">
                        {formatMoney(item.basePrice)}
                        {!item.isAvailable ? ' · Unavailable' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingItem(item);
                          setItemForm({
                            name: item.name,
                            description: item.description ?? '',
                            categoryId: item.categoryId,
                            basePrice: String(item.basePrice / 100),
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => deleteItem.mutate(item.id)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
