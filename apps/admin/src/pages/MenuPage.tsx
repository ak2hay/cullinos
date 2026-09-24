import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Drawer, Input, PageShell, Tabs, useToast } from '@cullinos/ui';
import { ImageUploadField } from '@/components/ImageUploadField';
import {
  menuApi,
  taxApi,
  type MenuCategory,
  type MenuCombo,
  type MenuItem,
  type MenuItemVariant,
  type MenuModifier,
  type MenuModifierGroup,
  type MenuSchedule,
  type OutletMenuPriceRow,
} from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

type Tab = 'categories' | 'items' | 'combos' | 'schedules' | 'outlet-prices';

const TAB_LABEL_KEYS: Record<Tab, string> = {
  categories: 'menu.categories',
  items: 'menu.menuItems',
  combos: 'menu.combos',
  schedules: 'menu.dayparts',
  'outlet-prices': 'menu.outletPrices',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_VARIANT: MenuItemVariant = { name: '', price: 0 };
const EMPTY_MODIFIER: MenuModifier = { name: '', price: 0 };
const EMPTY_MODIFIER_GROUP: MenuModifierGroup = {
  name: '',
  minSelect: 0,
  maxSelect: 1,
  modifiers: [{ ...EMPTY_MODIFIER }],
};

export function MenuPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  const [missingPhotosOnly, setMissingPhotosOnly] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    basePrice: '',
    packagingCharge: '',
    onlineAvailable: true,
    stockBasedAvailability: false,
    isVeg: false,
    isSpecial: false,
    taxGroupId: '',
    hsnCode: '996331',
    imageUrl: '' as string,
    variants: [] as MenuItemVariant[],
    modifierGroups: [] as MenuModifierGroup[],
  });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);

  const [comboForm, setComboForm] = useState({
    name: '',
    price: '',
    items: [{ menuItemId: '', quantity: '1' }],
  });
  const [editingCombo, setEditingCombo] = useState<MenuCombo | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    daysOfWeek: [] as number[],
    startTime: '09:00',
    endTime: '22:00',
    categoryIds: [] as string[],
    isActive: true,
  });
  const [editingSchedule, setEditingSchedule] = useState<MenuSchedule | null>(null);

  const [priceEdits, setPriceEdits] = useState<
    Record<string, { price: string; isAvailable: boolean }>
  >({});

  function showNotice(type: 'success' | 'error', text: string) {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }

  const categoriesQuery = useQuery({
    queryKey: ['menu', 'categories'],
    queryFn: menuApi.listCategories,
  });

  const taxQuery = useQuery({
    queryKey: ['tax'],
    queryFn: taxApi.list,
  });

  const itemsQuery = useQuery({
    queryKey: ['menu', 'items'],
    queryFn: menuApi.listItems,
  });

  const combosQuery = useQuery({
    queryKey: ['menu', 'combos'],
    queryFn: menuApi.listCombos,
  });

  const schedulesQuery = useQuery({
    queryKey: ['menu', 'schedules'],
    queryFn: menuApi.listSchedules,
  });

  const outletPricesQuery = useQuery({
    queryKey: ['menu', 'outlet-prices', outletId],
    queryFn: () => menuApi.listOutletPrices(outletId!),
    enabled: Boolean(outletId) && activeTab === 'outlet-prices',
  });

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
    queryClient.invalidateQueries({ queryKey: ['menu', 'outlet-prices'] });
  };

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] });
      invalidateItems();
      showNotice('success', 'Category deleted.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to delete category.'),
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      const basePrice = Math.round(parseFloat(itemForm.basePrice) * 100);
      const packagingCharge = Math.round(parseFloat(itemForm.packagingCharge || '0') * 100);
      const variants = itemForm.variants
        .filter((v) => v.name.trim())
        .map((v, idx) => ({
          name: v.name.trim(),
          price: Math.round(Number(v.price) * 100) || basePrice,
          isDefault: v.isDefault ?? idx === 0,
          sortOrder: idx,
        }));
      const modifierGroups = itemForm.modifierGroups
        .filter((g) => g.name.trim())
        .map((g) => ({
          name: g.name.trim(),
          minSelect: g.minSelect ?? 0,
          maxSelect: g.maxSelect ?? 1,
          isRequired: g.isRequired ?? false,
          modifiers: (g.modifiers ?? [])
            .filter((m) => m.name.trim())
            .map((m, idx) => ({
              name: m.name.trim(),
              price: Math.round(Number(m.price) * 100),
              sortOrder: idx,
            })),
        }));
      const payload = {
        name: itemForm.name,
        description: itemForm.description || undefined,
        imageUrl: itemForm.imageUrl.trim() || null,
        basePrice,
        packagingCharge,
        onlineAvailable: itemForm.onlineAvailable,
        stockBasedAvailability: itemForm.stockBasedAvailability,
        isVeg: itemForm.isVeg,
        isSpecial: itemForm.isSpecial,
        taxGroupId: itemForm.taxGroupId || null,
        hsnCode: itemForm.hsnCode.trim() || null,
        variants,
        modifierGroups,
      };
      if (editingItem) return menuApi.updateItem(editingItem.id, payload);
      return menuApi.createItem({ ...payload, categoryId: itemForm.categoryId });
    },
    onSuccess: (saved) => {
      invalidateItems();
      setEditingItem(saved);
      setItemForm((f) => ({
        ...f,
        imageUrl: saved.imageUrl ?? '',
      }));
      showNotice('success', editingItem ? 'Item updated.' : 'Item added.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to save item.'),
  });

  const toggleItemOnline = useMutation({
    mutationFn: ({ id, onlineAvailable }: { id: string; onlineAvailable: boolean }) =>
      menuApi.updateItem(id, { onlineAvailable }),
    onSuccess: () => {
      invalidateItems();
      showNotice('success', 'Availability updated.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to update availability.'),
  });

  const deleteItem = useMutation({
    mutationFn: menuApi.deleteItem,
    onSuccess: () => {
      invalidateItems();
      showNotice('success', 'Item deleted.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to delete item.'),
  });

  const saveCombo = useMutation({
    mutationFn: async () => {
      const price = Math.round(parseFloat(comboForm.price) * 100);
      const items = comboForm.items
        .filter((i) => i.menuItemId)
        .map((i) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 }));
      const payload = { name: comboForm.name, price, items };
      if (editingCombo) return menuApi.updateCombo(editingCombo.id, payload);
      return menuApi.createCombo(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'combos'] });
      setEditingCombo(null);
      setComboForm({ name: '', price: '', items: [{ menuItemId: '', quantity: '1' }] });
      showNotice('success', 'Combo saved.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to save combo.'),
  });

  const deleteCombo = useMutation({
    mutationFn: menuApi.deleteCombo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'combos'] });
      showNotice('success', 'Combo removed.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to delete combo.'),
  });

  const saveSchedule = useMutation({
    mutationFn: async () => {
      const payload = {
        name: scheduleForm.name,
        daysOfWeek: scheduleForm.daysOfWeek,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        categoryIds: scheduleForm.categoryIds,
        isActive: scheduleForm.isActive,
      };
      if (editingSchedule) return menuApi.updateSchedule(editingSchedule.id, payload);
      return menuApi.createSchedule(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'schedules'] });
      setEditingSchedule(null);
      setScheduleForm({
        name: '',
        daysOfWeek: [],
        startTime: '09:00',
        endTime: '22:00',
        categoryIds: [],
        isActive: true,
      });
      showNotice('success', 'Schedule saved.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to save schedule.'),
  });

  const deleteSchedule = useMutation({
    mutationFn: menuApi.deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'schedules'] });
      showNotice('success', 'Schedule deleted.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to delete schedule.'),
  });

  const saveOutletPrice = useMutation({
    mutationFn: async (row: OutletMenuPriceRow) => {
      const edit = priceEdits[row.menuItemId];
      const priceStr = edit?.price ?? (row.outletPrice != null ? String(row.outletPrice / 100) : String(row.basePrice / 100));
      const price = Math.round(parseFloat(priceStr) * 100);
      const isAvailable = edit?.isAvailable ?? row.isAvailable;
      return menuApi.setOutletPrice(outletId!, row.menuItemId, { price, isAvailable });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu', 'outlet-prices', outletId] });
      showNotice('success', 'Outlet price saved.');
    },
    onError: (err: Error) => showNotice('error', err.message ?? 'Failed to save outlet price.'),
  });

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const missingPhotoCount = items.filter((item) => !item.imageUrl).length;
  const visibleItems = missingPhotosOnly ? items.filter((item) => !item.imageUrl) : items;
  const combos = combosQuery.data ?? [];
  const schedules = schedulesQuery.data ?? [];
  const outletPrices = outletPricesQuery.data ?? [];

  function loadItemForEdit(item: MenuItem) {
    setEditingItem(item);
    setItemDrawerOpen(true);
    setItemForm({
      name: item.name,
      description: item.description ?? '',
      categoryId: item.categoryId,
      basePrice: String(item.basePrice / 100),
      packagingCharge: String((item.packagingCharge ?? 0) / 100),
      onlineAvailable: item.onlineAvailable !== false,
      stockBasedAvailability: item.stockBasedAvailability ?? false,
      isVeg: item.isVeg ?? false,
      isSpecial: item.isSpecial ?? false,
      taxGroupId: item.taxGroupId ?? '',
      hsnCode: item.hsnCode ?? '996331',
      imageUrl: item.imageUrl ?? '',
      variants: (item.variants ?? []).map((v) => ({
        ...v,
        price: v.price / 100,
      })),
      modifierGroups: (item.modifierGroups ?? []).map((g) => ({
        ...g,
        modifiers: (g.modifiers ?? []).map((m) => ({ ...m, price: m.price / 100 })),
      })),
    });
  }

  function openNewItemDrawer() {
    setEditingItem(null);
    setItemForm({
      name: '',
      description: '',
      categoryId: '',
      basePrice: '',
      packagingCharge: '',
      onlineAvailable: true,
      stockBasedAvailability: false,
      isVeg: false,
      isSpecial: false,
      taxGroupId: '',
      hsnCode: '996331',
      imageUrl: '',
      variants: [],
      modifierGroups: [],
    });
    setItemDrawerOpen(true);
  }

  function closeItemDrawer() {
    setItemDrawerOpen(false);
    setEditingItem(null);
    setItemForm({
      name: '',
      description: '',
      categoryId: '',
      basePrice: '',
      packagingCharge: '',
      onlineAvailable: true,
      stockBasedAvailability: false,
      isVeg: false,
      isSpecial: false,
      taxGroupId: '',
      hsnCode: '996331',
      imageUrl: '',
      variants: [],
      modifierGroups: [],
    });
  }

  async function handleItemImageUpload(file: File): Promise<string> {
    if (!editingItem?.id) {
      throw new Error('Save the item first, then upload a photo.');
    }
    const result = await menuApi.uploadItemImage(editingItem.id, file);
    setEditingItem((prev) => (prev ? { ...prev, imageUrl: result.imageUrl } : prev));
    invalidateItems();
    showNotice('success', 'Product photo uploaded.');
    return result.imageUrl;
  }

  const tabs: Tab[] = ['categories', 'items', 'combos', 'schedules', 'outlet-prices'];
  const tabItems = tabs.map((tab) => ({
    id: tab,
    label: t(TAB_LABEL_KEYS[tab]),
  }));

  return (
    <PageShell
      title={t('menu.title')}
      description={t('menu.description')}
      actions={
        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
      }
    >

      {activeTab === 'categories' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{editingCategory ? 'Edit category' : 'New category'}</h2>
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
              <Input label="Name" required value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="Description" value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} />
              <div className="flex gap-2">
                <Button type="submit" loading={createCategory.isPending || updateCategory.isPending}>
                  {editingCategory ? 'Save changes' : 'Add category'}
                </Button>
                {editingCategory ? (
                  <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>
                ) : null}
              </div>
            </form>
          </div>
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{t('menu.categories')}</h2>
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
                      {category.description ? <p className="text-sm text-text-muted">{category.description}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => {
                        setEditingCategory(category);
                        setCategoryForm({ name: category.name, description: category.description ?? '' });
                      }}>Edit</Button>
                      <Button type="button" variant="ghost" loading={deleteCategory.isPending} onClick={() => {
                        if (window.confirm(`Delete category "${category.name}"?`)) deleteCategory.mutate(category.id);
                      }}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'items' ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-semibold tracking-tight">{t('menu.menuItems')}</h2>
            <div className="flex flex-wrap items-center gap-3">
              {missingPhotoCount > 0 || missingPhotosOnly ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-primary"
                    checked={missingPhotosOnly}
                    onChange={(e) => setMissingPhotosOnly(e.target.checked)}
                  />
                  {t('menu.missingPhotosOnly')} ({missingPhotoCount})
                </label>
              ) : null}
              <Button type="button" onClick={openNewItemDrawer}>
                Add item
              </Button>
            </div>
          </div>
          {itemsQuery.isLoading ? (
            <p className="text-sm text-text-muted">{t('common.loading')}</p>
          ) : visibleItems.length === 0 ? (
            <p className="text-sm text-text-muted">No items yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => loadItemForEdit(item)}
                        title={t('menu.addPhoto')}
                        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] leading-tight text-text-muted transition hover:border-brand-primary hover:text-brand-primary"
                      >
                        <span aria-hidden="true" className="text-base leading-none">+</span>
                        {t('menu.addPhoto')}
                      </button>
                    )}
                    <div className="min-w-0">
                    <p className="break-words font-medium">{item.name}</p>
                    <p className="text-sm text-text-muted">
                      {formatMoney(item.basePrice)}
                      {(item.packagingCharge ?? 0) > 0 ? ` · pkg ${formatMoney(item.packagingCharge!)}` : ''}
                      {item.onlineAvailable === false ? ' · Online OFF' : ''}
                      {item.stockBasedAvailability ? ' · Stock-linked' : ''}
                      {item.isVeg ? ' · Veg' : ' · Non-veg'}
                      {item.isSpecial ? ' · Special' : ''}
                    </p>
                    {(item.variants?.length ?? 0) > 0 ? (
                      <p className="text-xs text-text-muted">{item.variants!.length} variant(s)</p>
                    ) : null}
                    {(item.modifierGroups?.length ?? 0) > 0 ? (
                      <p className="text-xs text-text-muted">{item.modifierGroups!.length} modifier group(s)</p>
                    ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={item.onlineAvailable !== false}
                        disabled={toggleItemOnline.isPending}
                        onChange={(e) => toggleItemOnline.mutate({ id: item.id, onlineAvailable: e.target.checked })}
                      />
                      Online
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => loadItemForEdit(item)}>Edit</Button>
                      <Button type="button" variant="ghost" loading={deleteItem.isPending} onClick={() => {
                        if (window.confirm(`Delete menu item "${item.name}"?`)) deleteItem.mutate(item.id);
                      }}>Delete</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Drawer
            open={itemDrawerOpen}
            onClose={closeItemDrawer}
            title={editingItem ? t('menu.editItem') : t('menu.newItem')}
            description="Variants and modifiers live with the item."
            width="xl"
            footer={
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={closeItemDrawer}>
                  Cancel
                </Button>
                <Button type="submit" form="menu-item-form" loading={saveItem.isPending}>
                  {editingItem ? 'Save changes' : 'Add item'}
                </Button>
              </div>
            }
          >
            <form id="menu-item-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveItem.mutate(); }}>
              {!editingItem ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">Category</label>
                  <select required value={itemForm.categoryId} onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))} className="h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm">
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : null}
              <Input label="Name" required value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="Description" value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))} />
              <ImageUploadField
                slot="menuItem"
                value={itemForm.imageUrl}
                onChange={(url) => setItemForm((f) => ({ ...f, imageUrl: url }))}
                onUpload={handleItemImageUpload}
                disabled={!editingItem}
                uploadLabel={editingItem ? 'Upload photo' : 'Save item to upload'}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Price (₹)" type="number" min="0" step="0.01" required value={itemForm.basePrice} onChange={(e) => setItemForm((f) => ({ ...f, basePrice: e.target.value }))} />
                <Input label="Packaging (₹)" type="number" min="0" step="0.01" value={itemForm.packagingCharge} onChange={(e) => setItemForm((f) => ({ ...f, packagingCharge: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">Tax group</label>
                  <select
                    value={itemForm.taxGroupId}
                    onChange={(e) => setItemForm((f) => ({ ...f, taxGroupId: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm"
                  >
                    <option value="">Default (first org group)</option>
                    {(taxQuery.data ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="HSN / SAC"
                  placeholder="996331"
                  value={itemForm.hsnCode}
                  onChange={(e) => setItemForm((f) => ({ ...f, hsnCode: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={itemForm.onlineAvailable} onChange={(e) => setItemForm((f) => ({ ...f, onlineAvailable: e.target.checked }))} />
                  Online ON
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={itemForm.stockBasedAvailability} onChange={(e) => setItemForm((f) => ({ ...f, stockBasedAvailability: e.target.checked }))} />
                  Stock-based availability
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.isVeg}
                    onChange={(e) => setItemForm((f) => ({ ...f, isVeg: e.target.checked }))}
                  />
                  Veg
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.isSpecial}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (next) {
                        const specialCount = (itemsQuery.data ?? []).filter(
                          (i) => i.isSpecial && i.id !== editingItem?.id,
                        ).length;
                        if (specialCount >= 5) {
                          showNotice('error', 'Maximum 5 special dishes per organisation.');
                          return;
                        }
                      }
                      setItemForm((f) => ({ ...f, isSpecial: next }));
                    }}
                  />
                  Special dish
                  <span className="text-xs text-text-muted">(max 5)</span>
                </label>
              </div>

              <div className="space-y-2 rounded-lg border border-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Variants</p>
                  <Button type="button" variant="ghost" onClick={() => setItemForm((f) => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT }] }))}>Add variant</Button>
                </div>
                {itemForm.variants.map((v, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                    <Input label="" placeholder="Name" value={v.name} onChange={(e) => setItemForm((f) => {
                      const variants = [...f.variants];
                      variants[idx] = { ...variants[idx], name: e.target.value };
                      return { ...f, variants };
                    })} />
                    <Input label="" type="number" placeholder="₹" value={String(v.price)} onChange={(e) => setItemForm((f) => {
                      const variants = [...f.variants];
                      variants[idx] = { ...variants[idx], price: Number(e.target.value) };
                      return { ...f, variants };
                    })} />
                    <Button type="button" variant="ghost" onClick={() => setItemForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))}>Remove</Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border border-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Modifier groups</p>
                  <Button type="button" variant="ghost" onClick={() => setItemForm((f) => ({ ...f, modifierGroups: [...f.modifierGroups, { ...EMPTY_MODIFIER_GROUP, modifiers: [{ ...EMPTY_MODIFIER }] }] }))}>Add group</Button>
                </div>
                {itemForm.modifierGroups.map((g, gIdx) => (
                  <div key={gIdx} className="space-y-2 rounded border border-white/5 p-2">
                    <Input label="" placeholder="Group name" value={g.name} onChange={(e) => setItemForm((f) => {
                      const modifierGroups = [...f.modifierGroups];
                      modifierGroups[gIdx] = { ...modifierGroups[gIdx], name: e.target.value };
                      return { ...f, modifierGroups };
                    })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Min" type="number" value={String(g.minSelect ?? 0)} onChange={(e) => setItemForm((f) => {
                        const modifierGroups = [...f.modifierGroups];
                        modifierGroups[gIdx] = { ...modifierGroups[gIdx], minSelect: Number(e.target.value) };
                        return { ...f, modifierGroups };
                      })} />
                      <Input label="Max" type="number" value={String(g.maxSelect ?? 1)} onChange={(e) => setItemForm((f) => {
                        const modifierGroups = [...f.modifierGroups];
                        modifierGroups[gIdx] = { ...modifierGroups[gIdx], maxSelect: Number(e.target.value) };
                        return { ...f, modifierGroups };
                      })} />
                    </div>
                    {(g.modifiers ?? []).map((m, mIdx) => (
                      <div key={mIdx} className="grid gap-2 sm:grid-cols-[1fr_100px]">
                        <Input label="" placeholder="Modifier" value={m.name} onChange={(e) => setItemForm((f) => {
                          const modifierGroups = [...f.modifierGroups];
                          const modifiers = [...(modifierGroups[gIdx].modifiers ?? [])];
                          modifiers[mIdx] = { ...modifiers[mIdx], name: e.target.value };
                          modifierGroups[gIdx] = { ...modifierGroups[gIdx], modifiers };
                          return { ...f, modifierGroups };
                        })} />
                        <Input label="" type="number" placeholder="₹" value={String(m.price)} onChange={(e) => setItemForm((f) => {
                          const modifierGroups = [...f.modifierGroups];
                          const modifiers = [...(modifierGroups[gIdx].modifiers ?? [])];
                          modifiers[mIdx] = { ...modifiers[mIdx], price: Number(e.target.value) };
                          modifierGroups[gIdx] = { ...modifierGroups[gIdx], modifiers };
                          return { ...f, modifierGroups };
                        })} />
                      </div>
                    ))}
                    <Button type="button" variant="ghost" onClick={() => setItemForm((f) => {
                      const modifierGroups = [...f.modifierGroups];
                      modifierGroups[gIdx] = { ...modifierGroups[gIdx], modifiers: [...(modifierGroups[gIdx].modifiers ?? []), { ...EMPTY_MODIFIER }] };
                      return { ...f, modifierGroups };
                    })}>Add modifier</Button>
                    <Button type="button" variant="ghost" onClick={() => setItemForm((f) => ({ ...f, modifierGroups: f.modifierGroups.filter((_, i) => i !== gIdx) }))}>Remove group</Button>
                  </div>
                ))}
              </div>
            </form>
          </Drawer>
        </Card>
      ) : null}

      {activeTab === 'combos' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{editingCombo ? 'Edit combo' : 'New combo'}</h2>
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); saveCombo.mutate(); }}>
              <Input label="Name" required value={comboForm.name} onChange={(e) => setComboForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="Combo price (₹)" type="number" min="0" step="0.01" required value={comboForm.price} onChange={(e) => setComboForm((f) => ({ ...f, price: e.target.value }))} />
              <div className="space-y-2">
                <p className="text-sm font-medium">Items in combo</p>
                {comboForm.items.map((row, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_80px_auto]">
                    <select value={row.menuItemId} onChange={(e) => setComboForm((f) => {
                      const items = [...f.items];
                      items[idx] = { ...items[idx], menuItemId: e.target.value };
                      return { ...f, items };
                    })} className="h-11 rounded-lg border border-white/10 bg-bg-card px-3 text-sm">
                      <option value="">Select item</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <Input label="" type="number" min="1" value={row.quantity} onChange={(e) => setComboForm((f) => {
                      const items = [...f.items];
                      items[idx] = { ...items[idx], quantity: e.target.value };
                      return { ...f, items };
                    })} />
                    <Button type="button" variant="ghost" onClick={() => setComboForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>Remove</Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" onClick={() => setComboForm((f) => ({ ...f, items: [...f.items, { menuItemId: '', quantity: '1' }] }))}>Add item</Button>
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={saveCombo.isPending}>{editingCombo ? 'Save combo' : 'Create combo'}</Button>
                {editingCombo ? <Button type="button" variant="ghost" onClick={() => setEditingCombo(null)}>Cancel</Button> : null}
              </div>
            </form>
          </div>
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">Combos</h2>
            {combosQuery.isLoading ? <p className="mt-4 text-sm text-text-muted">Loading…</p> : combos.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">No combos yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {combos.filter((c) => c.isActive).map((combo) => (
                  <li key={combo.id} className="py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{combo.name}</p>
                        <p className="text-sm text-text-muted">{formatMoney(combo.price)}</p>
                        <ul className="mt-1 text-xs text-text-muted">
                          {combo.items.map((i) => <li key={i.id}>{i.quantity}× {i.menuItemName}</li>)}
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => {
                          setEditingCombo(combo);
                          setComboForm({
                            name: combo.name,
                            price: String(combo.price / 100),
                            items: combo.items.map((i) => ({ menuItemId: i.menuItemId, quantity: String(i.quantity) })),
                          });
                        }}>Edit</Button>
                        <Button type="button" variant="ghost" onClick={() => {
                          if (window.confirm(`Remove combo "${combo.name}"?`)) deleteCombo.mutate(combo.id);
                        }}>Delete</Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'schedules' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{editingSchedule ? 'Edit daypart' : 'New daypart'}</h2>
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); saveSchedule.mutate(); }}>
              <Input label="Name" required value={scheduleForm.name} onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Start time" type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((f) => ({ ...f, startTime: e.target.value }))} />
                <Input label="End time" type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">Days</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, day) => (
                    <label key={day} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-sm">
                      <input type="checkbox" checked={scheduleForm.daysOfWeek.includes(day)} onChange={(e) => setScheduleForm((f) => ({
                        ...f,
                        daysOfWeek: e.target.checked ? [...f.daysOfWeek, day].sort() : f.daysOfWeek.filter((d) => d !== day),
                      }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">Categories shown</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={scheduleForm.categoryIds.includes(c.id)} onChange={(e) => setScheduleForm((f) => ({
                        ...f,
                        categoryIds: e.target.checked ? [...f.categoryIds, c.id] : f.categoryIds.filter((id) => id !== c.id),
                      }))} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scheduleForm.isActive} onChange={(e) => setScheduleForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
              <div className="flex gap-2">
                <Button type="submit" loading={saveSchedule.isPending}>{editingSchedule ? 'Save schedule' : 'Create schedule'}</Button>
                {editingSchedule ? <Button type="button" variant="ghost" onClick={() => setEditingSchedule(null)}>Cancel</Button> : null}
              </div>
            </form>
          </div>
          <div className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">Dayparts / schedules</h2>
            {schedulesQuery.isLoading ? <p className="mt-4 text-sm text-text-muted">Loading…</p> : schedules.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">No schedules yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {schedules.map((s) => (
                  <li key={s.id} className="flex items-start justify-between py-3">
                    <div>
                      <p className="font-medium">{s.name}{s.isActive ? '' : ' (inactive)'}</p>
                      <p className="text-sm text-text-muted">{s.startTime} – {s.endTime}</p>
                      <p className="text-xs text-text-muted">
                        {s.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')} · {s.categoryIds.length} categories
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => {
                        setEditingSchedule(s);
                        setScheduleForm({
                          name: s.name,
                          daysOfWeek: s.daysOfWeek,
                          startTime: s.startTime,
                          endTime: s.endTime,
                          categoryIds: s.categoryIds,
                          isActive: s.isActive,
                        });
                      }}>Edit</Button>
                      <Button type="button" variant="ghost" onClick={() => {
                        if (window.confirm(`Delete schedule "${s.name}"?`)) deleteSchedule.mutate(s.id);
                      }}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'outlet-prices' ? (
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="font-semibold">Outlet prices</h2>
          {!outletId ? (
            <p className="mt-4 text-sm text-text-muted">Select an outlet from the header to edit per-outlet prices.</p>
          ) : outletPricesQuery.isLoading ? (
            <p className="mt-4 text-sm text-text-muted">Loading…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted">
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Base</th>
                    <th className="py-2 pr-4">Packaging</th>
                    <th className="py-2 pr-4">Outlet price (₹)</th>
                    <th className="py-2 pr-4">Available</th>
                    <th className="py-2">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {outletPrices.map((row) => {
                    const edit = priceEdits[row.menuItemId];
                    const priceVal = edit?.price ?? (row.outletPrice != null ? String(row.outletPrice / 100) : String(row.basePrice / 100));
                    const available = edit?.isAvailable ?? row.isAvailable;
                    return (
                      <tr key={row.menuItemId} className="border-b border-white/5">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{row.name}</p>
                          {row.onlineAvailable === false ? <p className="text-xs text-text-muted">Online OFF globally</p> : null}
                        </td>
                        <td className="py-3 pr-4">{formatMoney(row.basePrice)}</td>
                        <td className="py-3 pr-4">{formatMoney(row.packagingCharge)}</td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={priceVal}
                            onChange={(e) => setPriceEdits((prev) => ({
                              ...prev,
                              [row.menuItemId]: { price: e.target.value, isAvailable: available },
                            }))}
                            className="h-9 w-24 rounded border border-white/10 bg-bg-card px-2"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="checkbox"
                            checked={available}
                            onChange={(e) => setPriceEdits((prev) => ({
                              ...prev,
                              [row.menuItemId]: { price: priceVal, isAvailable: e.target.checked },
                            }))}
                          />
                        </td>
                        <td className="py-3">
                          <Button type="button" variant="ghost" loading={saveOutletPrice.isPending} onClick={() => saveOutletPrice.mutate(row)}>Save</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
