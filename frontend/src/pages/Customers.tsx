import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  businessName: string | null;
  customerType: string;
  status: string;
}

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get("/customers", { params: { search } });
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
        <h1>Customers</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add customer
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Search by name, mobile, or business..."
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
              <th>Mobile</th>
              <th>Business</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/customers/${c.id}`}>{c.name}</Link>
                </td>
                <td>{c.mobile}</td>
                <td>{c.businessName || "—"}</td>
                <td>{c.customerType}</td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <CustomerFormModal
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

function CustomerFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    businessName: "",
    customerType: "RETAIL",
    address: "",
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/customers", form);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save customer");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add customer</h2>
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label>Mobile</label>
          <input
            required
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <label>Business name</label>
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
          <label>Customer type</label>
          <select
            value={form.customerType}
            onChange={(e) => setForm({ ...form, customerType: e.target.value })}
          >
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </select>
          <label>Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />

          {error && <div className="error-text">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
