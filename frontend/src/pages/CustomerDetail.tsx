import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [note, setNote] = useState("");

  async function load() {
    const res = await api.get(`/customers/${id}`);
    setCustomer(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await api.post(`/customers/${id}/followups`, { note });
    setNote("");
    load();
  }

  if (!customer) return <p className="muted">Loading...</p>;

  return (
    <div>
      <Link to="/customers" className="back-link">
        ← Back to customers
      </Link>
      <div className="page-header">
        <h1>{customer.name}</h1>
        <span className={`badge badge-${customer.status.toLowerCase()}`}>{customer.status}</span>
      </div>

      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Mobile</span>
          <span>{customer.mobile}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Email</span>
          <span>{customer.email || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Business</span>
          <span>{customer.businessName || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Type</span>
          <span>{customer.customerType}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">GST</span>
          <span>{customer.gstNumber || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Address</span>
          <span>{customer.address || "—"}</span>
        </div>
      </div>

      <h2 className="section-title">Follow-ups</h2>
      <form onSubmit={addNote} className="inline-form">
        <input
          placeholder="Add a follow-up note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          Add
        </button>
      </form>

      <ul className="followup-list">
        {customer.followUps?.map((f: any) => (
          <li key={f.id}>
            <span>{f.note}</span>
            <span className="muted small">{new Date(f.createdAt).toLocaleString()}</span>
          </li>
        ))}
        {customer.followUps?.length === 0 && <p className="muted">No follow-ups yet.</p>}
      </ul>
    </div>
  );
}
