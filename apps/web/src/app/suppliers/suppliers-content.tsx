'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Package,
  MapPin,
  Building2,
  CheckCircle,
  Loader2,
  Send,
  X,
  Filter,
  ShoppingCart,
  FileSpreadsheet,
  Building,
  Mail,
  Phone,
  Globe,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  isAvailable: boolean;
  isVisible: boolean;
  company: {
    id: string;
    legalName: string;
    country: string;
    city?: string;
    industry?: string;
    verificationStatus: string;
  };
}

interface RFQFormData {
  title: string;
  description: string;
  quantity: number;
  supplierId: string;
  productId?: string;
}

interface ImportedProvider {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  vatId: string | null;
  website: string | null;
  notes: string | null;
  importedAt: string;
}

export function SuppliersContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [importedProviders, setImportedProviders] = useState<ImportedProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rfqFormData, setRfqFormData] = useState<RFQFormData>({
    title: '',
    description: '',
    quantity: 1,
    supplierId: '',
    productId: '',
  });
  const [submittingRFQ, setSubmittingRFQ] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchImportedProviders();
  }, []);

  async function fetchImportedProviders() {
    try {
      const res = await fetch('/api/provider-import/imported-providers');
      if (res.ok) {
        const data = await res.json();
        setImportedProviders(data);
      }
    } catch {
      // Silently fail - imported providers are optional
    } finally {
      setLoadingProviders(false);
    }
  }

  useEffect(() => {
    if (searchQuery.trim()) {
      const debounce = setTimeout(() => {
        searchProducts();
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setProducts([]);
    }
  }, [searchQuery]);

  async function searchProducts() {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      } else {
        setError('Failed to search products');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }

  function openRFQModal(product: Product) {
    setSelectedProduct(product);
    setRfqFormData({
      title: `RFQ for ${product.name}`,
      description: '',
      quantity: 1,
      supplierId: product.company.id,
      productId: product.id,
    });
    setShowRFQModal(true);
    setError('');
    setSuccessMessage('');
  }

  function closeRFQModal() {
    setShowRFQModal(false);
    setSelectedProduct(null);
    setRfqFormData({
      title: '',
      description: '',
      quantity: 1,
      supplierId: '',
      productId: '',
    });
  }

  async function handleRFQSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingRFQ(true);
    setError('');

    try {
      const res = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfqFormData),
      });

      if (res.ok) {
        setSuccessMessage('RFQ submitted successfully!');
        setTimeout(() => {
          closeRFQModal();
          setSuccessMessage('');
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to submit RFQ');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setSubmittingRFQ(false);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Find Suppliers & Products</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Search for products from verified suppliers and submit RFQs
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search for products, suppliers, or industries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-4 pl-12 pr-4 text-base text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
            />
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-500">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Imported Providers Section */}
        {!loadingProviders && importedProviders.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                Your Imported Providers
              </h2>
              <span className="rounded-full bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary))]">
                {importedProviders.length}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {importedProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                        <Building className="h-5 w-5 text-violet-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[hsl(var(--foreground))]">
                          {provider.companyName}
                        </h3>
                        {provider.country && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {provider.country}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {provider.contactPerson && (
                      <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{provider.contactPerson}</span>
                      </div>
                    )}
                    {provider.email && (
                      <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{provider.email}</span>
                      </div>
                    )}
                    {provider.phone && (
                      <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Phone className="h-3.5 w-3.5" />
                        <span className="truncate">{provider.phone}</span>
                      </div>
                    )}
                    {provider.website && (
                      <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Globe className="h-3.5 w-3.5" />
                        <a
                          href={provider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-[hsl(var(--primary))] hover:underline"
                        >
                          {provider.website}
                        </a>
                      </div>
                    )}
                  </div>
                  {provider.notes && (
                    <p className="mt-3 border-t border-[hsl(var(--border))] pt-3 text-xs text-[hsl(var(--muted-foreground))]">
                      {provider.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Searching products...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !searchQuery && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
              Start Your Search
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Enter keywords to find products from verified suppliers
            </p>
          </div>
        )}

        {/* No Results */}
        {!loading && searchQuery && products.length === 0 && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
              No Products Found
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              Try adjusting your search query or browse different categories
            </p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && products.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Found {products.length} {products.length === 1 ? 'product' : 'products'}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-all hover:border-[hsl(var(--primary))] hover:shadow-lg"
                >
                  {/* Product Info */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))]">
                        {product.name}
                      </h3>
                      {product.company.verificationStatus === 'VERIFIED' && (
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500" title="Verified Supplier" />
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Quantity Badge */}
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500">
                      <Package className="h-3 w-3" />
                      {product.quantity} units available
                    </span>
                  </div>

                  {/* Supplier Info */}
                  <div className="mb-4 space-y-2 border-t border-[hsl(var(--border))] pt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="font-medium text-[hsl(var(--foreground))]">
                        {product.company.legalName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {[product.company.city, product.company.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                    {product.company.industry && (
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        Industry: {product.company.industry}
                      </div>
                    )}
                  </div>

                  {/* RFQ Button */}
                  <button
                    onClick={() => openRFQModal(product)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))]/90"
                  >
                    <Send className="h-4 w-4" />
                    Request Quote
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RFQ Modal */}
        {showRFQModal && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                  Submit Request for Quote
                </h2>
                <button
                  onClick={closeRFQModal}
                  className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Product Summary */}
              <div className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[hsl(var(--foreground))]">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {selectedProduct.company.legalName}
                    </p>
                  </div>
                  {selectedProduct.company.verificationStatus === 'VERIFIED' && (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {selectedProduct.quantity} units available
                </div>
              </div>

              <form onSubmit={handleRFQSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    RFQ Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={rfqFormData.title}
                    onChange={(e) => setRfqFormData({ ...rfqFormData, title: e.target.value })}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="Enter RFQ title"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Description
                  </label>
                  <textarea
                    value={rfqFormData.description}
                    onChange={(e) => setRfqFormData({ ...rfqFormData, description: e.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="Provide additional details about your requirements..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={rfqFormData.quantity}
                    onChange={(e) => setRfqFormData({ ...rfqFormData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="Enter quantity needed"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <p className="text-sm text-emerald-500">{successMessage}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeRFQModal}
                    className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRFQ}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
                  >
                    {submittingRFQ ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit RFQ
                      </>
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
