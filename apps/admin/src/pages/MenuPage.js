import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { menuApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
export function MenuPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('categories');
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [itemForm, setItemForm] = useState({
        name: '',
        description: '',
        categoryId: '',
        basePrice: '',
    });
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
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
        mutationFn: ({ id, payload }) => menuApi.updateCategory(id, payload),
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
        mutationFn: ({ id, payload }) => menuApi.updateItem(id, payload),
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Menu" }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: "Manage categories and menu items." })] }), _jsx("div", { className: "flex rounded-lg border border-white/10 bg-bg-card p-1", children: ['categories', 'items'].map((tab) => (_jsx("button", { type: "button", onClick: () => setActiveTab(tab), className: `rounded-md px-4 py-2 text-sm capitalize transition ${activeTab === tab
                                ? 'bg-brand-primary text-bg-primary'
                                : 'text-text-secondary hover:text-text-primary'}`, children: tab }, tab))) })] }), activeTab === 'categories' ? (_jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("h2", { className: "font-semibold", children: editingCategory ? 'Edit category' : 'New category' }), _jsxs("form", { className: "mt-4 space-y-4", onSubmit: (e) => {
                                    e.preventDefault();
                                    if (editingCategory) {
                                        updateCategory.mutate({
                                            id: editingCategory.id,
                                            payload: {
                                                name: categoryForm.name,
                                                description: categoryForm.description || undefined,
                                            },
                                        });
                                    }
                                    else {
                                        createCategory.mutate({
                                            name: categoryForm.name,
                                            description: categoryForm.description || undefined,
                                        });
                                    }
                                }, children: [_jsx(Input, { label: "Name", required: true, value: categoryForm.name, onChange: (e) => setCategoryForm((f) => ({ ...f, name: e.target.value })) }), _jsx(Input, { label: "Description", value: categoryForm.description, onChange: (e) => setCategoryForm((f) => ({ ...f, description: e.target.value })) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", loading: createCategory.isPending || updateCategory.isPending, children: editingCategory ? 'Save changes' : 'Add category' }), editingCategory ? (_jsx(Button, { type: "button", variant: "ghost", onClick: () => setEditingCategory(null), children: "Cancel" })) : null] })] })] }), _jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("h2", { className: "font-semibold", children: "Categories" }), categoriesQuery.isLoading ? (_jsx("p", { className: "mt-4 text-sm text-text-muted", children: "Loading\u2026" })) : categories.length === 0 ? (_jsx("p", { className: "mt-4 text-sm text-text-muted", children: "No categories yet." })) : (_jsx("ul", { className: "mt-4 divide-y divide-white/5", children: categories.map((category) => (_jsxs("li", { className: "flex items-center justify-between py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: category.name }), category.description ? (_jsx("p", { className: "text-sm text-text-muted", children: category.description })) : null] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => {
                                                        setEditingCategory(category);
                                                        setCategoryForm({
                                                            name: category.name,
                                                            description: category.description ?? '',
                                                        });
                                                    }, children: "Edit" }), _jsx(Button, { variant: "ghost", onClick: () => deleteCategory.mutate(category.id), children: "Delete" })] })] }, category.id))) }))] })] })) : (_jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("h2", { className: "font-semibold", children: editingItem ? 'Edit item' : 'New menu item' }), _jsxs("form", { className: "mt-4 space-y-4", onSubmit: (e) => {
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
                                    }
                                    else {
                                        createItem.mutate({
                                            categoryId: itemForm.categoryId,
                                            name: itemForm.name,
                                            description: itemForm.description || undefined,
                                            basePrice,
                                        });
                                    }
                                }, children: [!editingItem ? (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary", children: "Category" }), _jsxs("select", { required: true, value: itemForm.categoryId, onChange: (e) => setItemForm((f) => ({ ...f, categoryId: e.target.value })), className: "h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm", children: [_jsx("option", { value: "", children: "Select category" }), categories.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] })) : null, _jsx(Input, { label: "Name", required: true, value: itemForm.name, onChange: (e) => setItemForm((f) => ({ ...f, name: e.target.value })) }), _jsx(Input, { label: "Description", value: itemForm.description, onChange: (e) => setItemForm((f) => ({ ...f, description: e.target.value })) }), _jsx(Input, { label: "Price (\u20B9)", type: "number", min: "0", step: "0.01", required: true, value: itemForm.basePrice, onChange: (e) => setItemForm((f) => ({ ...f, basePrice: e.target.value })) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", loading: createItem.isPending || updateItem.isPending, children: editingItem ? 'Save changes' : 'Add item' }), editingItem ? (_jsx(Button, { type: "button", variant: "ghost", onClick: () => setEditingItem(null), children: "Cancel" })) : null] })] })] }), _jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("h2", { className: "font-semibold", children: "Menu items" }), itemsQuery.isLoading ? (_jsx("p", { className: "mt-4 text-sm text-text-muted", children: "Loading\u2026" })) : items.length === 0 ? (_jsx("p", { className: "mt-4 text-sm text-text-muted", children: "No items yet." })) : (_jsx("ul", { className: "mt-4 divide-y divide-white/5", children: items.map((item) => (_jsxs("li", { className: "flex items-center justify-between py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: item.name }), _jsxs("p", { className: "text-sm text-text-muted", children: [formatMoney(item.basePrice), !item.isAvailable ? ' · Unavailable' : ''] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => {
                                                        setEditingItem(item);
                                                        setItemForm({
                                                            name: item.name,
                                                            description: item.description ?? '',
                                                            categoryId: item.categoryId,
                                                            basePrice: String(item.basePrice / 100),
                                                        });
                                                    }, children: "Edit" }), _jsx(Button, { variant: "ghost", onClick: () => deleteItem.mutate(item.id), children: "Delete" })] })] }, item.id))) }))] })] }))] }));
}
