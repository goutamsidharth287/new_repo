import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Challan {
  id: string;
  challanNumber: string;
  status: string;
  totalQuantity: number;
  createdAt: string;
  customer: { name: string };
}

export default function Challans() {
  const [items, setItems] = useState<Challan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get("/challans");
    setItems(res.data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmChallan(id: string) {
    try {
      await api.patch(`/challans/${id}/confirm`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to confirm challan");
    }
  }

  async function cancelChallan(id: string) {
    if (!confirm("Cancel this challan? Stock will be restored if it was confirmed.")) return;
    await api.patch(`/challans/${id}/cancel`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sales Challans</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + New challan
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Challan #</th>
              <th>Customer</th>
              <th>Total qty</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.challanNumber}</td>
                <td>{c.customer?.name}</td>
                <td>{c.totalQuantity}</td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                <td>
                  {c.status === "DRAFT" && (
                    <>
                      <button className="btn-ghost small" onClick={() => confirmChallan(c.id)}>
                        Confirm
                      </button>{" "}
                      <button className="btn-ghost small" onClick={() => cancelChallan(c.id)}>
                        Cancel
                      </button>
                    </>
                  )}
                  {c.status === "CONFIRMED" && (
                    <button className="btn-ghost small" onClick={() => cancelChallan(c.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No challans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <ChallanFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface Line {
  productId: string;
  quantity: number;
}

function ChallanFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/customers", { params: { pageSize: 100 } }).then((r) => setCustomers(r.data.items));
    api.get("/products", { params: { pageSize: 100 } }).then((r) => setProducts(r.data.items));
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(status: "DRAFT" | "CONFIRMED") {
    setError("");
    const validLines = lines.filter((l) => l.productId && l.quantity > 0);
    if (!customerId || validLines.length === 0) {
      setError("Select a customer and at least one product line.");
      return;
    }
    try {
      await api.post("/challans", { customerId, items: validLines, status });
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create challan");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>New sales challan</h2>

        <label>Customer</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.businessName ? `(${c.businessName})` : ""}
            </option>
          ))}
        </select>

        <h3 className="section-title small">Products</h3>
        {lines.map((line, idx) => (
          <div className="line-item" key={idx}>
            <select
              value={line.productId}
              onChange={(e) => updateLine(idx, { productId: e.target.value })}
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — stock: {p.currentStock}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
            />
            <button type="button" className="btn-ghost small" onClick={() => removeLine(idx)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost small" onClick={addLine}>
          + Add product line
        </button>

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-ghost" onClick={() => submit("DRAFT")}>
            Save as draft
          </button>
          <button type="button" className="btn-primary" onClick={() => submit("CONFIRMED")}>
            Confirm challan
          </button>
        </div>
      </div>
    </div>
  );
}
