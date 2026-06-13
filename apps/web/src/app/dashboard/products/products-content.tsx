'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  X,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  isAvailable: boolean;
  isVisible: boolean;
  createdAt: string;
  company: {
    id: string;
    legalName: string;
  };
}

interface ProductFormData {
  name: string;
  description: string;
  quantity: number;
  isAvailable: boolean;
  isVisible: boolean;
}

export function ProductsContent() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    quantity: 0,
    isAvailable: true,
    isVisible: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);

  const isSupplier = company?.roles?.includes('SUPPLIER');

  useEffect(() => {
    fetchCompanyAndProducts();
  }, []);

  async function fetchCompanyAndProducts() {
    try {
      setLoading(true);
      const companyRes = await fetch('/api/companies/me');
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        setCompany(companyData);
        
        if (companyData?.roles?.includes('SUPPLIER')) {
          await fetchProducts();
        }
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      } else {
        setError('Failed to load products');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      quantity: 0,
      isAvailable: true,
      isVisible: true,
    });
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      quantity: product.quantity,
      isAvailable: product.isAvailable,
      isVisible: product.isVisible,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      quantity: 0,
      isAvailable: true,
      isVisible: true,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchProducts();
        closeForm();
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to save product');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProducts();
      } else {
        setError('Failed to delete product');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSupplier) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <h2 className="mt-4 text-xl font-semibold text-[hsl(var(--foreground))]">
            Product Management
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Only suppliers can manage products. Please update your company role to access this feature.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Product Management</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Manage your product catalog and inventory
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))]/90"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
              {searchQuery ? 'No products found' : 'No products yet'}
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Get started by adding your first product'}
            </p>
            {!searchQuery && (
              <button
                onClick={openCreateForm}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))]/90"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Quantity:</span>
                    <span className="font-medium text-[hsl(var(--foreground))]">
                      {product.quantity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Available:</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.isAvailable
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {product.isAvailable ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Yes
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          No
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Visible:</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.isVisible
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      {product.isVisible ? (
                        <>
                          <Eye className="h-3 w-3" />
                          Public
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Hidden
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-[hsl(var(--border))] pt-4">
                  <button
                    onClick={() => openEditForm(product)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {deletingId === product.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button
                  onClick={closeForm}
                  className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="Enter product description"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="0"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-colors hover:bg-[hsl(var(--muted))]">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                      className="h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[hsl(var(--foreground))]">Available</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Product is in stock</div>
                    </div>
                  </label>

                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-colors hover:bg-[hsl(var(--muted))]">
                    <input
                      type="checkbox"
                      checked={formData.isVisible}
                      onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                      className="h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[hsl(var(--foreground))]">Visible</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Show to buyers</div>
                    </div>
                  </label>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>{editingProduct ? 'Update Product' : 'Add Product'}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
