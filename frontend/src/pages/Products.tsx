import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unitPrice: string;
  currentStock: number;
  minStockAlert: number;
}

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [stockModalFor, setStockModalFor] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get("/products", { params: { search } });
    setItems(res.data.items);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add product
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Search by name or SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Unit price</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.category || "—"}</td>
                <td>₹{p.unitPrice}</td>
                <td>
                  <span className={p.currentStock <= p.minStockAlert ? "stock-low" : ""}>
                    {p.currentStock}
                  </span>
                  {p.currentStock <= p.minStockAlert && (
                    <span className="badge badge-lead" style={{ marginLeft: 6 }}>
                      Low
                    </span>
                  )}
                </td>
                <td>
                  <button className="btn-ghost small" onClick={() => setStockModalFor(p)}>
                    Adjust stock
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <ProductFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {stockModalFor && (
        <StockMovementModal
          product={stockModalFor}
          onClose={() => setStockModalFor(null)}
          onSaved={() => {
            setStockModalFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unitPrice: "",
    minStockAlert: "0",
    location: "",
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/products", {
        ...form,
        unitPrice: Number(form.unitPrice),
        minStockAlert: Number(form.minStockAlert),
      });
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save product");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add product</h2>
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label>SKU</label>
          <input
            required
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <label>Category</label>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <label>Unit price</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          />
          <label>Minimum stock alert</label>
          <input
            type="number"
            min="0"
            value={form.minStockAlert}
            onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
          />
          <label>Location / warehouse</label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />

          {error && <div className="error-text">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockMovementModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/products/${product.id}/stock-movements`, {
        type,
        quantity: Number(quantity),
        reason,
      });
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to record movement");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Adjust stock — {product.name}</h2>
        <p className="muted">Current stock: {product.currentStock}</p>
        <form onSubmit={handleSubmit}>
          <label>Movement type</label>
          <select value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")}>
            <option value="IN">Stock IN</option>
            <option value="OUT">Stock OUT</option>
          </select>
          <label>Quantity</label>
          <input
            required
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <label>Reason</label>
          <input required value={reason} onChange={(e) => setReason(e.target.value)} />

          {error && <div className="error-text">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Record movement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
