import { useState, useEffect } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiGrid,
  FiArrowLeft, FiInfo, FiHash, FiBox
} from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const EMPTY_FORM = {
  hallName: '', capacity: 30, rows: 6, cols: 5,
  smallBenchCount: 20, bigBenchCount: 10,
  smallBenchCap: 1, bigBenchCap: 2,
  block: 'CSE Block', notes: '',
};

const InputRow = ({ label, name, value, onChange, type = 'number', min, max, placeholder }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 5 }}>
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      placeholder={placeholder}
      style={{
        width: '100%', border: '1.5px solid #E8E2E5', borderRadius: 8, padding: '9px 12px',
        fontSize: 14, outline: 'none', background: '#FAFAFA', color: '#1B0A12',
        boxSizing: 'border-box', fontFamily: "'DM Sans',system-ui,sans-serif",
        transition: 'border-color 0.18s',
      }}
      onFocus={e => e.target.style.borderColor = '#B42B6A'}
      onBlur={e => e.target.style.borderColor = '#E8E2E5'}
    />
  </div>
);

const HallManager = () => {
  const navigate = useNavigate();
  const [halls,   setHalls]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Modal state
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, else hall doc
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchHalls(); }, []);

  const fetchHalls = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/halls');
      setHalls(data);
    } catch {
      toast.error('Failed to load halls');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (hall) => {
    setEditTarget(hall);
    setForm({
      hallName:        hall.hallName        ?? '',
      capacity:        hall.capacity        ?? 30,
      rows:            hall.rows            ?? 6,
      cols:            hall.cols            ?? 5,
      smallBenchCount: hall.smallBenchCount ?? 20,
      bigBenchCount:   hall.bigBenchCount   ?? 10,
      smallBenchCap:   hall.smallBenchCap   ?? 1,
      bigBenchCap:     hall.bigBenchCap     ?? 2,
      block:           hall.block           ?? 'CSE Block',
      notes:           hall.notes           ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value }));
  };

  const handleSave = async () => {
    if (!form.hallName.trim()) { toast.warn('Hall name is required'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        const { data } = await api.put(`/halls/${editTarget._id}`, form);
        setHalls(h => h.map(x => x._id === data._id ? data : x));
        toast.success('Hall updated successfully');
      } else {
        const { data } = await api.post('/halls', form);
        setHalls(h => [...h, data].sort((a, b) => a.hallName.localeCompare(b.hallName)));
        toast.success('Hall created successfully');
      }
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save hall');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hall) => {
    setDeleting(hall._id);
    try {
      await api.delete(`/halls/${hall._id}`);
      setHalls(h => h.filter(x => x._id !== hall._id));
      toast.success(`"${hall.hallName}" deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete hall');
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const totalSeats = (h) => (h.smallBenchCount ?? 20) * (h.smallBenchCap ?? 1) + (h.bigBenchCount ?? 10) * (h.bigBenchCap ?? 2);

  return (
    <div className="page-enter" style={{ background: '#FAF7F9', minHeight: '100vh', padding: '0 0 40px' }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'white', borderBottom: '1px solid #E8E2E5',
        boxShadow: '0 1px 8px rgba(27,10,18,0.05)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '11px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/home')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', color: '#6B5E63', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
            >
              <FiArrowLeft size={14} /> Back
            </button>
            <div>
              <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 'clamp(15px,3vw,20px)', color: '#1B0A12', margin: 0, lineHeight: 1.2 }}>
                Hall Management
              </h2>
              <p style={{ color: '#9B8F94', fontSize: 12, margin: 0, lineHeight: 1.3 }}>
                Capacity, bench layout &amp; seating structure
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(180,43,106,0.28)', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <FiPlus size={14} /> Add Hall
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 0' }}>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner-border" style={{ color: '#B42B6A' }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : halls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: 16, border: '1.5px dashed #E8E2E5' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#FDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <FiGrid size={26} color="#B42B6A" />
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 17, color: '#1B0A12', margin: '0 0 6px' }}>No Halls Configured</h3>
          <p style={{ color: '#9B8F94', fontSize: 13, margin: '0 0 18px' }}>Add your first exam hall to get started.</p>
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(180,43,106,0.28)' }}>
            <FiPlus size={14} /> Add First Hall
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,270px),1fr))', gap: 14 }}>
          {halls.map(hall => (
            <div
              key={hall._id}
              style={{ background: 'white', borderRadius: 16, border: '1.5px solid #E8E2E5', boxShadow: '0 2px 12px rgba(27,10,18,0.06)', overflow: 'hidden', transition: 'box-shadow 0.2s,border-color 0.2s,transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(180,43,106,0.12)'; e.currentTarget.style.borderColor = 'rgba(180,43,106,0.28)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(27,10,18,0.06)'; e.currentTarget.style.borderColor = '#E8E2E5'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* Card header */}
              <div style={{ background: 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 17, color: 'white', margin: 0, lineHeight: 1.2 }}>{hall.hallName}</h3>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{hall.block || 'CSE Block'}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'white', lineHeight: 1 }}>{hall.capacity ?? 30}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Capacity</div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#E8E2E5' }}>
                {[
                  { label: 'Layout', value: `${hall.rows ?? 6} × ${hall.cols ?? 5}`, sub: 'rows × cols' },
                  { label: 'Total Seats', value: totalSeats(hall), sub: 'computed' },
                  { label: 'Small Benches', value: `${hall.smallBenchCount ?? 20}`, sub: `${hall.smallBenchCap ?? 1} seat each` },
                  { label: 'Big Benches', value: `${hall.bigBenchCount ?? 10}`, sub: `${hall.bigBenchCap ?? 2} seats each` },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ background: 'white', padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1B0A12', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>{value}</div>
                    <div style={{ fontSize: 10, color: '#C0B5BA', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {hall.notes && (
                <div style={{ padding: '8px 14px', background: '#FAFAFA', borderTop: '1px solid #E8E2E5', fontSize: 12, color: '#6B5E63', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <FiInfo size={12} style={{ flexShrink: 0, marginTop: 2, color: '#B42B6A' }} />
                  <span>{hall.notes}</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderTop: '1px solid #E8E2E5', background: 'white' }}>
                <button
                  onClick={() => openEdit(hall)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, border: '1.5px solid rgba(180,43,106,0.2)', background: '#FDF2F7', color: '#B42B6A', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.18s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#B42B6A'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FDF2F7'; e.currentTarget.style.color = '#B42B6A'; }}
                >
                  <FiEdit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => navigate(`/hall-designer?hall=${encodeURIComponent(hall.hallName)}`)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, border: '1.5px solid rgba(59,130,246,0.2)', background: '#EFF6FF', color: '#3B82F6', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.18s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#3B82F6'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#3B82F6'; }}
                >
                  <FiGrid size={13} /> Layout
                </button>
                <button
                  onClick={() => setDeleteConfirm(hall)}
                  disabled={deleting === hall._id}
                  style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 10, border: '1.5px solid rgba(220,38,38,0.2)', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', transition: 'all 0.18s', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }}
                >
                  <FiTrash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>{/* /maxWidth container */}

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(27,10,18,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(27,10,18,0.22)', animation: 'modalSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid #E8E2E5', background: 'linear-gradient(135deg,#FDF2F7,#FFF)' }}>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 17, color: '#1B0A12', margin: 0 }}>
                  {editTarget ? 'Edit Hall' : 'Add New Hall'}
                </h3>
                <p style={{ fontSize: 12, color: '#9B8F94', margin: '3px 0 0' }}>
                  {editTarget ? `Editing "${editTarget.hallName}"` : 'Configure hall name, capacity & bench layout'}
                </p>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: 4, display: 'flex', alignItems: 'center' }}>
                <FiX size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px 24px' }}>
              {/* Section: Identity */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <FiHash size={13} color="#B42B6A" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#B42B6A', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Hall Identity</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <InputRow label="Hall Name *" name="hallName" value={form.hallName} onChange={handleChange} type="text" placeholder="e.g. Hall A, Lab 1, Room 301" />
                  </div>
                  <InputRow label="Block" name="block" value={form.block} onChange={handleChange} type="text" placeholder="CSE Block" />
                  <InputRow label="Capacity (students)" name="capacity" value={form.capacity} onChange={handleChange} min={1} max={500} />
                </div>
              </div>

              <div style={{ height: 1, background: '#E8E2E5', margin: '0 0 20px' }} />

              {/* Section: Grid Layout */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <FiGrid size={13} color="#3B82F6" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#3B82F6', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Grid Layout</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputRow label="Rows" name="rows" value={form.rows} onChange={handleChange} min={1} max={30} />
                  <InputRow label="Columns" name="cols" value={form.cols} onChange={handleChange} min={1} max={20} />
                </div>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1D4ED8', marginTop: 4 }}>
                  <FiInfo size={11} style={{ marginRight: 5 }} />
                  Grid layout is used in Hall Layout Designer to visually place benches.
                </div>
              </div>

              <div style={{ height: 1, background: '#E8E2E5', margin: '0 0 20px' }} />

              {/* Section: Bench Configuration */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <FiBox size={13} color="#D97706" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#D97706', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Bench Configuration</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputRow label="Small Bench Count" name="smallBenchCount" value={form.smallBenchCount} onChange={handleChange} min={0} max={200} />
                  <InputRow label="Small Bench Seats" name="smallBenchCap" value={form.smallBenchCap} onChange={handleChange} min={1} max={2} />
                  <InputRow label="Big Bench Count" name="bigBenchCount" value={form.bigBenchCount} onChange={handleChange} min={0} max={200} />
                  <InputRow label="Big Bench Seats" name="bigBenchCap" value={form.bigBenchCap} onChange={handleChange} min={1} max={4} />
                </div>
                {/* Computed total */}
                <div style={{ background: '#FDF2F7', border: '1px solid rgba(180,43,106,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6B5E63' }}>Computed Total Seats</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#B42B6A', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>
                    {(Number(form.smallBenchCount) || 0) * (Number(form.smallBenchCap) || 1) + (Number(form.bigBenchCount) || 0) * (Number(form.bigBenchCap) || 2)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 5 }}>Notes (Optional)</label>
                <textarea
                  name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Any special notes about this hall..."
                  rows={2}
                  style={{ width: '100%', border: '1.5px solid #E8E2E5', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#FAFAFA', color: '#1B0A12', resize: 'vertical', fontFamily: "'DM Sans',system-ui,sans-serif", boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#B42B6A'}
                  onBlur={e => e.target.style.borderColor = '#E8E2E5'}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '11px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 50, border: 'none', background: saving ? '#E8E2E5' : 'linear-gradient(135deg,#B42B6A,#9A2259)', color: saving ? '#9B8F94' : 'white', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer', boxShadow: saving ? 'none' : '0 4px 14px rgba(180,43,106,0.28)' }}
                >
                  {saving
                    ? <><div className="btn-spinner" /> Saving...</>
                    : <><FiCheck size={14} /> {editTarget ? 'Save Changes' : 'Create Hall'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(27,10,18,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(27,10,18,0.2)', animation: 'modalSlideUp 0.2s cubic-bezier(0.34,1.4,0.64,1)', overflow: 'hidden' }}>
            <div style={{ background: '#FEF2F2', padding: '20px 22px 16px', textAlign: 'center', borderBottom: '1px solid #FCA5A5' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEE2E2', border: '2px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FiTrash2 size={20} color="#DC2626" />
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 17, color: '#1B0A12', margin: '0 0 6px' }}>Delete Hall</h3>
              <p style={{ fontSize: 13, color: '#6B5E63', margin: 0 }}>
                Delete <strong style={{ color: '#DC2626' }}>"{deleteConfirm.hallName}"</strong>? This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '16px 22px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting === deleteConfirm._id}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 50, border: 'none', background: '#DC2626', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
              >
                {deleting === deleteConfirm._id ? <><div className="btn-spinner" /> Deleting...</> : <><FiTrash2 size={13} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalSlideUp {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default HallManager;
