import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiPrinter, FiTrash2, FiAlertTriangle, FiPlus, FiEdit3, FiX, FiSave, FiCalendar, FiClipboard, FiLayout } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';
import DatePickerPopup from './DatePickerPopup';

const YEAR_SEM_MAP = {
  I:   [['I','I'],['II','II']],
  II:  [['III','III'],['IV','IV']],
  III: [['V','V'],['VI','VI']],
  IV:  [['VII','VII'],['VIII','VIII']],
};

/* ── Compact inline time picker (used inside edit modal) ── */
const MiniTimePicker = ({ session, value, onChange }) => {
  const pad = n => String(n).padStart(2, '0');

  const parse = (str) => {
    const m = (str || '').match(/(\d+)[.:](\d+)\s*(AM|PM)\s*-\s*(\d+)[.:](\d+)\s*(AM|PM)/i);
    if (m) return { sh:parseInt(m[1]), sm:parseInt(m[2]), sp:m[3].toUpperCase(), eh:parseInt(m[4]), em:parseInt(m[5]), ep:m[6].toUpperCase() };
    return session === 'FN'
      ? { sh:9, sm:30, sp:'AM', eh:11, em:30, ep:'AM' }
      : { sh:2, sm:30, sp:'PM', eh:4,  em:30, ep:'PM' };
  };

  const t = parse(value);

  const rebuild = (updates) => {
    const v = { ...t, ...updates };
    onChange(`${session} & ${pad(v.sh)}.${pad(v.sm)} ${v.sp} - ${pad(v.eh)}.${pad(v.em)} ${v.ep}`);
  };

  const inc = (part, min, max) => { const c = t[part]; rebuild({ [part]: c >= max ? min : c + 1 }); };
  const dec = (part, min, max) => { const c = t[part]; rebuild({ [part]: c <= min ? max : c - 1 }); };

  const sBtn = {
    background:'none', border:'none', cursor:'pointer',
    padding:'1px 5px', color:'#B42B6A', fontSize:'9px', lineHeight:1, fontWeight:'900',
    display:'flex', alignItems:'center', justifyContent:'center',
  };
  const nBox = { textAlign:'center', fontSize:'14px', fontWeight:'800', color:'#1B0A12', lineHeight:1, minWidth:'20px' };
  const apBtn = (active) => ({
    padding:'1px 5px', borderRadius:'5px', fontSize:'9px', fontWeight:'700', border:'none', cursor:'pointer',
    background: active ? '#B42B6A' : 'rgba(180,43,106,0.1)',
    color: active ? 'white' : '#B42B6A', transition:'all 0.15s',
  });

  const Spin = ({ part, min, max }) => (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0px' }}>
      <button style={sBtn} type="button" onClick={() => inc(part, min, max)}>▲</button>
      <div style={nBox}>{pad(t[part])}</div>
      <button style={sBtn} type="button" onClick={() => dec(part, min, max)}>▼</button>
    </div>
  );

  const AmPm = ({ partKey, val }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
      <button type="button" style={apBtn(val === 'AM')} onClick={() => rebuild({ [partKey]:'AM' })}>AM</button>
      <button type="button" style={apBtn(val === 'PM')} onClick={() => rebuild({ [partKey]:'PM' })}>PM</button>
    </div>
  );

  return (
    <div style={{
      background:'linear-gradient(135deg,#FDF2F7,#FEF7FB)',
      border:'1.5px solid rgba(180,43,106,0.22)',
      borderRadius:'10px', padding:'6px 10px',
      display:'flex', alignItems:'center', gap:'3px', flexWrap:'wrap',
    }}>
      <span style={{ fontSize:'9px', fontWeight:'700', color:'#9B8F94', letterSpacing:'0.5px', textTransform:'uppercase', marginRight:'5px' }}>
        {session}
      </span>
      <Spin part="sh" min={1} max={12} />
      <span style={{ fontWeight:'800', color:'#B42B6A', fontSize:'13px', margin:'0 1px' }}>.</span>
      <Spin part="sm" min={0} max={59} />
      <AmPm partKey="sp" val={t.sp} />
      <span style={{ color:'#C9BFC5', fontSize:'12px', fontWeight:'700', margin:'0 5px' }}>—</span>
      <Spin part="eh" min={1} max={12} />
      <span style={{ fontWeight:'800', color:'#B42B6A', fontSize:'13px', margin:'0 1px' }}>.</span>
      <Spin part="em" min={0} max={59} />
      <AmPm partKey="ep" val={t.ep} />
    </div>
  );
};

const History = () => {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hallplan');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Date pickers inside edit modal
  const [editFromOpen, setEditFromOpen] = useState(false);
  const [editToOpen,   setEditToOpen]   = useState(false);

  // Saturday-in-range: array of { display, dateStr, included }
  const [satRangeConfirm, setSatRangeConfirm] = useState(null);

  /* Return list of Saturday objects (inclusive of start and end) between fromStr and toStr */
  const getSaturdaysInRange = (fromStr, toStr) => {
    if (!fromStr || !toStr) return [];
    const result = [];
    const cur = new Date(fromStr + 'T00:00:00');
    const end = new Date(toStr   + 'T00:00:00');
    cur.setDate(cur.getDate() + 1); // strictly between (endpoints handled by DatePickerPopup)
    while (cur < end) {
      if (cur.getDay() === 6) {
        result.push({
          display: cur.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
          dateStr: cur.toISOString().split('T')[0],
          included: true,   // default = include
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  };

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/allocations');
      setAllocations(res.data);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  /* ── Delete ── */
  const openDeleteModal = (id) => { setSelectedForDelete(id); setDeleteModalOpen(true); };
  const closeDeleteModal = () => { setDeleteModalOpen(false); setSelectedForDelete(null); };

  const handleDelete = async () => {
    if (!selectedForDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/allocations/${selectedForDelete}`);
      toast.success('Allocation deleted');
      setAllocations(prev => prev.filter(a => a._id !== selectedForDelete));
      closeDeleteModal();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Edit ──
     If the allocation already has classroom (hall) data, redirect to the
     full /allocate wizard pre-filled for editing — the user requested this
     so classroom allocation changes don't have to fit inside the small
     metadata-only modal. Allocations without halls fall back to the modal. */
  const openEditModal = async (alloc) => {
    const hasClassrooms = Array.isArray(alloc.hallAllocations) && alloc.hallAllocations.length > 0;
    if (hasClassrooms) {
      try {
        // List endpoint omits studentData/seatingChart; fetch the full doc so
        // the wizard can prefill electives + halls without data loss.
        const res = await api.get(`/allocations/${alloc._id}`);
        navigate('/allocate', { state: { editAllocation: res.data } });
      } catch {
        toast.error('Failed to load allocation for editing');
      }
      return;
    }
    setEditingAlloc(alloc);
    setEditForm({
      examName:     alloc.examName     || '',
      academicYear: alloc.academicYear || '',
      year:         alloc.year         || '',
      semester:     alloc.semester     || '',
      semesterType: alloc.semesterType || '',
      yearSemester: alloc.yearSemester || '',
      session:      alloc.session      || '',
      sessionTime:  alloc.sessionTime  || '',
      fromDate:     alloc.fromDate     ? alloc.fromDate.split('T')[0] : '',
      toDate:       alloc.toDate       ? alloc.toDate.split('T')[0]   : '',
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => { setEditModalOpen(false); setEditingAlloc(null); };

  const handleEditChange = (field, value) => {
    setEditForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'year') {
        next.semester = ''; next.semesterType = ''; next.yearSemester = '';
      }
      if (field === 'semester') {
        const isOdd = ['I','III','V','VII'].includes(value);
        next.semesterType = isOdd ? 'ODD' : 'EVEN';
        next.yearSemester = `${next.year} / ${value}`;
      }
      if (field === 'session') {
        const defaultTime = value === 'FN' ? 'FN & 09.30 AM - 11.30 AM' : 'AN & 02.30 PM - 04.30 PM';
        next.sessionTime = defaultTime;
      }
      return next;
    });
  };

  /* Date picker handlers — Saturday checks are inside DatePickerPopup itself */
  const handleEditFromDate = (date) => {
    setEditForm(prev => ({
      ...prev, fromDate: date,
      toDate: prev.toDate && prev.toDate < date ? '' : prev.toDate,
    }));
  };

  const handleEditToDate = (date) => {
    setEditForm(prev => {
      // Check for in-between Saturdays after setting toDate
      const sats = getSaturdaysInRange(prev.fromDate, date);
      if (sats.length > 0) setSatRangeConfirm(sats);
      return { ...prev, toDate: date };
    });
  };

  const formatDateDisplay = (ds) => {
    if (!ds) return 'DD / MM / YYYY';
    return new Date(ds + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  };

  const handleSaveEdit = async () => {
    if (!editingAlloc) return;
    setSaving(true);
    try {
      const res = await api.patch(`/allocations/${editingAlloc._id}`, editForm);
      toast.success('Allocation updated');
      setAllocations(prev => prev.map(a => a._id === editingAlloc._id ? { ...a, ...res.data } : a));
      closeEditModal();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  /* ── Helpers ── */
  const formatDate = (ds) => {
    if (!ds) return '—';
    const d = new Date(ds);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  };

  /* ── Shared action icon style ── */
  const actionBtn = (color) => ({
    width: '34px', height: '34px',
    border: '1.5px solid #E8E2E5', borderRadius: '50%',
    background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.18s ease', color,
    padding: 0,
  });

  /* ── Shared modal input style (compact) ── */
  const modalInput = {
    width: '100%', border: '1.5px solid #E8E2E5', borderRadius: '8px',
    padding: '7px 10px', fontSize: '13px', outline: 'none',
    fontFamily: 'inherit', color: '#1B0A12', background: '#FAFAFA',
  };
  const modalLabel = {
    display: 'block', fontSize: '10px', fontWeight: '700',
    color: '#9B8F94', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '4px',
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="spinner-border" style={{ color: '#B42B6A' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 px-lg-4 py-4 page-enter">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom page-header-wrap" style={{ gap: '10px' }}>
        <h2 className="fw-bold m-0" style={{ fontSize:'clamp(18px,5vw,24px)', color:'#1B0A12', fontFamily:"'Playfair Display', Georgia, serif" }}>
          Allocation History
        </h2>
        <Link to="/allocate" className="btn btn-primary rounded-pill fw-bold d-flex align-items-center gap-2 px-3 shadow-sm" style={{ flexShrink: 0 }}>
          New Allocation
        </Link>
      </div>

      {/* ── Tabs ── */}
      <div className="history-tabs mb-4">
        <button
          className={`history-tab-btn${activeTab === 'hallplan' ? ' active' : ''}`}
          onClick={() => setActiveTab('hallplan')}
        >
          <FiLayout size={14} /> Hall Plan
        </button>
        <button
          className={`history-tab-btn${activeTab === 'attendance' ? ' active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <FiClipboard size={14} /> Attendance Sheet
        </button>
      </div>

      {allocations.length === 0 ? (
        <div className="text-center bg-white p-5 rounded-4 border shadow-sm">
          <p className="text-muted mb-3 fs-5">No previous allocations found.</p>
          <Link to="/allocate" className="btn btn-primary rounded-pill fw-bold px-4 py-2">Create First Allocation</Link>
        </div>
      ) : (
        <div className="tab-content-enter" key={activeTab}>
          {/* ── Desktop Table ── */}
          <div className="d-none d-md-block bg-white rounded-4 border shadow-sm overflow-hidden mb-4">
            <table className="table table-hover mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  {['Date Created','Exam Name','AY / Sem / Session','Date Range','Students','Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-muted ${h === 'Actions' ? 'text-end' : ''} ${h === 'Students' ? 'text-center' : ''}`}
                      style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #E8E2E5' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.map(alloc => (
                  <tr key={alloc._id} className="history-row-hover stagger-item" style={{ transition:'all 0.18s ease' }}>
                    <td className="px-4 py-3 text-muted" style={{ fontFamily:"'JetBrains Mono', Consolas, monospace", fontSize:'13px' }}>
                      {formatDate(alloc.createdAt)}
                    </td>
                    <td className="px-4 py-3 fw-bold text-dark" style={{ fontSize:'14px' }}>{alloc.examName}</td>
                    <td className="px-4 py-3">
                      <div className="fw-bold text-dark" style={{ fontSize:'14px' }}>{alloc.academicYear}</div>
                      <div className="text-muted" style={{ fontSize:'12px' }}>{alloc.yearSemester} | {alloc.session}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-dark fw-bold" style={{ fontFamily:"'JetBrains Mono', Consolas, monospace", fontSize:'13px' }}>
                        {formatDate(alloc.fromDate)}
                      </div>
                      {alloc.toDate && alloc.toDate !== alloc.fromDate && (
                        <div className="text-muted" style={{ fontFamily:"'JetBrains Mono', Consolas, monospace", fontSize:'12px' }}>
                          to {formatDate(alloc.toDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center fw-bold" style={{ color:'#B42B6A', fontSize:'16px' }}>
                      {alloc.totalStrength}
                    </td>
                    <td className="px-4 py-3">
                      <div className="d-flex justify-content-end gap-2">
                        {/* Edit — only on Hall Plan tab */}
                        {activeTab === 'hallplan' && (
                          <button className="action-icon-btn aib-edit" onClick={() => openEditModal(alloc)} title="Edit">
                            <FiEdit3 size={14} />
                          </button>
                        )}
                        {activeTab === 'hallplan' ? (
                          <>
                            {/* View Result */}
                            <Link to={`/result/${alloc._id}`} className="action-icon-btn aib-view" title="View Result">
                              <FiEye size={14} />
                            </Link>
                            {/* Print Hall Plan */}
                            <Link to={`/print/${alloc._id}`} className="action-icon-btn aib-print" title="Print Hall Plan">
                              <FiPrinter size={14} />
                            </Link>
                          </>
                        ) : (
                          /* Attendance Sheet */
                          <Link to={`/attendance-print/${alloc._id}`} className="action-icon-btn aib-attend" title="Attendance Sheet">
                            <FiClipboard size={14} />
                          </Link>
                        )}
                        {/* Delete */}
                        <button className="action-icon-btn aib-delete" onClick={() => openDeleteModal(alloc._id)} title="Delete">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="d-flex d-md-none flex-column gap-3 mb-4">
            {allocations.map((alloc, idx) => (
              <div key={alloc._id} className="bg-white p-4 rounded-4 border shadow-sm stagger-item" style={{ animationDelay: `${idx * 60}ms` }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted fw-bold" style={{ fontFamily:"'JetBrains Mono',Consolas,monospace", fontSize:'12px' }}>
                    {formatDate(alloc.createdAt)}
                  </span>
                  <span className="badge rounded-pill fw-bold" style={{ backgroundColor:'#FDF2F7', color:'#B42B6A', border:'1px solid #B42B6A' }}>
                    {alloc.totalStrength} Students
                  </span>
                </div>
                <h3 className="fw-bold mb-1" style={{ fontSize:'18px', color:'#1B0A12', fontFamily:"'Playfair Display',Georgia,serif" }}>
                  {alloc.examName}
                </h3>
                <p className="text-muted mb-0 fw-medium" style={{ fontSize:'13px' }}>
                  {alloc.academicYear} &bull; {alloc.yearSemester} &bull; {alloc.session}
                </p>
                <div className="d-flex flex-wrap gap-2 pt-3 mt-3" style={{ borderTop:'1px dashed #E8E2E5' }}>
                  {/* Edit — only on Hall Plan tab */}
                  {activeTab === 'hallplan' && (
                    <button className="action-mobile-btn aib-edit" onClick={() => openEditModal(alloc)}>
                      <FiEdit3 size={14} /> Edit
                    </button>
                  )}
                  {activeTab === 'hallplan' ? (
                    <>
                      <Link to={`/result/${alloc._id}`} className="action-mobile-btn aib-view">
                        <FiEye size={14} /> View
                      </Link>
                      <Link to={`/print/${alloc._id}`} className="action-mobile-btn aib-print">
                        <FiPrinter size={14} /> Print
                      </Link>
                    </>
                  ) : (
                    <Link to={`/attendance-print/${alloc._id}`} className="action-mobile-btn aib-attend">
                      <FiClipboard size={14} /> Attendance
                    </Link>
                  )}
                  <button className="action-mobile-btn aib-delete" onClick={() => openDeleteModal(alloc._id)}>
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ EDIT MODAL ══════════════ */}
      {editModalOpen && editingAlloc && (
        <div
          style={{
            position:'fixed', inset:0,
            backgroundColor:'rgba(27,10,18,0.55)',
            backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
            zIndex:1050,
            display:'flex', alignItems:'flex-start', justifyContent:'center',
            padding:'max(24px, 6vh) 12px 12px',
            overflowY:'auto',
            animation:'overlayFadeIn 0.2s ease',
          }}
          onClick={closeEditModal}
        >
          {/* ── Compact modal card ── */}
          <div
            className="modal-card-scrollable"
            style={{
              background:'white', borderRadius:'18px',
              width:'100%', maxWidth:'480px',
              boxShadow:'0 20px 56px rgba(27,10,18,0.22)',
              animation:'modalSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 10px', borderBottom:'1px solid #F0ECF0' }}>
              <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'17px', fontWeight:'800', color:'#1B0A12', margin:0 }}>
                Edit Allocation
              </h3>
              <button onClick={closeEditModal} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B8F94', padding:'4px', display:'flex', alignItems:'center' }}>
                <FiX size={18} />
              </button>
            </div>

            {/* ── Form body ── */}
            <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:'10px' }}>

              {/* Exam Name pills */}
              <div>
                <label style={modalLabel}>Exam Name</label>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {['Serial Test - I','Serial Test - II'].map(n => (
                    <button key={n} type="button" onClick={() => handleEditChange('examName', n)}
                      style={{
                        padding:'6px 16px', borderRadius:'50px', fontSize:'12px', fontWeight:'700', cursor:'pointer',
                        border: editForm.examName === n ? '2px solid #B42B6A' : '2px solid #E8E2E5',
                        background: editForm.examName === n ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : 'white',
                        color: editForm.examName === n ? 'white' : '#6B5E63',
                        transition:'all 0.18s',
                        boxShadow: editForm.examName === n ? '0 3px 10px rgba(180,43,106,0.28)' : 'none',
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Academic Year + Year */}
              <div className="edit-grid-2">
                <div>
                  <label style={modalLabel}>Academic Year</label>
                  <input style={modalInput} value={editForm.academicYear}
                    onChange={e => handleEditChange('academicYear', e.target.value)}
                    onBlur={() => {
                      const val = (editForm.academicYear || '').trim();
                      if (/^\d{4}$/.test(val)) {
                        const s = parseInt(val, 10);
                        setEditForm(prev => ({ ...prev, academicYear: `${s}-${s+4}` }));
                      }
                    }}
                    placeholder="e.g. 2023-2027" />
                </div>
                <div>
                  <label style={modalLabel}>Year</label>
                  <select style={modalInput} value={editForm.year} onChange={e => handleEditChange('year', e.target.value)}>
                    <option value="">Select</option>
                    {['I','II','III','IV'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Semester + Session */}
              <div className="edit-grid-2">
                <div>
                  <label style={{ ...modalLabel, display:'flex', alignItems:'center', gap:'5px' }}>
                    Semester
                    {editForm.semesterType && (
                      <span style={{
                        fontSize:'9px', fontWeight:'700', borderRadius:'50px', padding:'1px 6px',
                        color: editForm.semesterType === 'ODD' ? '#B42B6A' : '#3B82F6',
                        border: `1px solid ${editForm.semesterType === 'ODD' ? '#B42B6A' : '#3B82F6'}`,
                        background: editForm.semesterType === 'ODD' ? '#FDF2F7' : '#EFF6FF',
                      }}>{editForm.semesterType}</span>
                    )}
                  </label>
                  <select style={modalInput} value={editForm.semester} onChange={e => handleEditChange('semester', e.target.value)} disabled={!editForm.year}>
                    <option value="">Select</option>
                    {(YEAR_SEM_MAP[editForm.year] || []).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={modalLabel}>Session</label>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {['FN','AN'].map(s => (
                      <button key={s} type="button" onClick={() => handleEditChange('session', s)}
                        style={{
                          flex:1, padding:'7px 0', borderRadius:'8px', fontWeight:'700', fontSize:'13px', cursor:'pointer',
                          border: editForm.session === s ? '2px solid #B42B6A' : '2px solid #E8E2E5',
                          background: editForm.session === s ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : 'white',
                          color: editForm.session === s ? 'white' : '#6B5E63',
                          transition:'all 0.18s',
                          boxShadow: editForm.session === s ? '0 2px 8px rgba(180,43,106,0.28)' : 'none',
                        }}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Session Time — compact interactive time picker */}
              {editForm.session && (
                <div>
                  <label style={modalLabel}>Exam Time</label>
                  <MiniTimePicker
                    session={editForm.session}
                    value={editForm.sessionTime}
                    onChange={t => handleEditChange('sessionTime', t)}
                  />
                </div>
              )}

              {/* Start Date + End Date */}
              <div className="edit-grid-2">
                <div style={{ position:'relative' }}>
                  <label style={modalLabel}>Start Date</label>
                  <div style={{ ...modalInput, display:'flex', alignItems:'center', gap:'7px', cursor:'pointer' }}
                    onClick={() => setEditFromOpen(true)}>
                    <FiCalendar size={13} color="#B42B6A" />
                    <span style={{ fontSize:'13px', color: editForm.fromDate ? '#1B0A12' : '#9B8F94', fontWeight: editForm.fromDate ? '600':'400' }}>
                      {formatDateDisplay(editForm.fromDate)}
                    </span>
                  </div>
                  <DatePickerPopup isOpen={editFromOpen} initialDate={editForm.fromDate||null}
                    onSelect={handleEditFromDate} onClose={() => setEditFromOpen(false)} />
                </div>
                <div style={{ position:'relative' }}>
                  <label style={modalLabel}>End Date</label>
                  <div style={{ ...modalInput, display:'flex', alignItems:'center', gap:'7px', cursor:'pointer' }}
                    onClick={() => setEditToOpen(true)}>
                    <FiCalendar size={13} color="#B42B6A" />
                    <span style={{ fontSize:'13px', color: editForm.toDate ? '#1B0A12' : '#9B8F94', fontWeight: editForm.toDate ? '600':'400' }}>
                      {formatDateDisplay(editForm.toDate)}
                    </span>
                  </div>
                  <DatePickerPopup isOpen={editToOpen} minDate={editForm.fromDate||undefined}
                    initialDate={editForm.toDate||null} onSelect={handleEditToDate} onClose={() => setEditToOpen(false)} />
                </div>
              </div>

            </div>

            {/* ── Actions ── */}
            <div style={{ display:'flex', gap:'8px', padding:'10px 18px 16px' }}>
              <button onClick={closeEditModal}
                style={{ flex:1, padding:'10px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', color:'#6B5E63' }}
                disabled={saving}>
                Cancel
              </button>
              <button onClick={handleSaveEdit}
                style={{
                  flex:2, padding:'10px', borderRadius:'50px', border:'none',
                  background:'linear-gradient(135deg,#B42B6A,#9A2259)',
                  color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                  boxShadow:'0 4px 14px rgba(180,43,106,0.3)',
                  opacity: saving ? 0.7 : 1,
                }}
                disabled={saving}>
                {saving ? 'Saving...' : <><FiSave size={14} /> Save Changes</>}
              </button>
            </div>
          </div>

          {/* ── Saturday-in-range: per-Saturday toggle selection ── */}
          {satRangeConfirm && (
            <div
              style={{
                position:'fixed', inset:0,
                background:'rgba(27,10,18,0.65)',
                backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
                zIndex:1060,
                display:'flex', alignItems:'center', justifyContent:'center',
                padding:'16px',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                background:'white', borderRadius:'20px',
                width:'100%', maxWidth:'400px',
                boxShadow:'0 24px 60px rgba(27,10,18,0.22)',
                animation:'modalSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)',
                overflow:'hidden',
              }}>
                {/* Header */}
                <div style={{ padding:'20px 22px 14px', borderBottom:'1px solid #F0ECF0', textAlign:'center' }}>
                  <div style={{ display:'inline-flex', background:'rgba(245,158,11,0.1)', padding:'12px', borderRadius:'50%', color:'#D97706', marginBottom:'10px' }}>
                    <FiAlertTriangle size={24} />
                  </div>
                  <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'17px', fontWeight:'800', color:'#1B0A12', margin:'0 0 4px' }}>
                    Saturdays in Date Range
                  </h4>
                  <p style={{ color:'#9B8F94', fontSize:'12px', margin:0 }}>
                    Toggle each Saturday — include or skip individually
                  </p>
                </div>

                {/* Per-Saturday toggles */}
                <div style={{ padding:'14px 22px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  {satRangeConfirm.map((sat, i) => (
                    <div
                      key={sat.dateStr}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'12px 14px', borderRadius:'12px',
                        background: sat.included ? 'linear-gradient(135deg,#FDF2F7,#FEF7FB)' : '#F9F7F8',
                        border: `1.5px solid ${sat.included ? 'rgba(180,43,106,0.25)' : '#E8E2E5'}`,
                        transition:'all 0.2s',
                        cursor:'pointer',
                      }}
                      onClick={() => setSatRangeConfirm(prev =>
                        prev.map((s, j) => j === i ? { ...s, included: !s.included } : s)
                      )}
                    >
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'700', color: sat.included ? '#B42B6A' : '#6B5E63' }}>
                          {sat.display}
                        </div>
                        <div style={{ fontSize:'11px', color:'#9B8F94', marginTop:'1px' }}>
                          {sat.included ? 'Will be included as exam day' : 'Will be skipped'}
                        </div>
                      </div>
                      {/* Toggle pill */}
                      <div style={{
                        width:'42px', height:'24px', borderRadius:'12px',
                        background: sat.included ? '#B42B6A' : '#D4CDD0',
                        position:'relative', flexShrink:0, transition:'background 0.2s',
                        boxShadow: sat.included ? '0 2px 8px rgba(180,43,106,0.35)' : 'none',
                      }}>
                        <div style={{
                          width:'18px', height:'18px', borderRadius:'50%', background:'white',
                          position:'absolute', top:'3px',
                          left: sat.included ? '21px' : '3px',
                          transition:'left 0.2s',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ padding:'12px 22px 20px', display:'flex', gap:'10px' }}>
                  <button
                    onClick={() => setSatRangeConfirm(null)}
                    style={{
                      flex:1, padding:'11px', borderRadius:'50px', border:'none',
                      background:'linear-gradient(135deg,#B42B6A,#9A2259)',
                      color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer',
                      boxShadow:'0 4px 14px rgba(180,43,106,0.3)',
                    }}
                  >
                    Confirm Selection
                  </button>
                </div>
              </div>
            </div>
          )}

          <style>{`
            @keyframes overlayFadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes modalSlideUp  { from { transform:scale(0.92) translateY(14px); opacity:0 } to { transform:scale(1) translateY(0); opacity:1 } }
            .edit-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            @media (max-width: 400px) { .edit-grid-2 { grid-template-columns: 1fr; } }
          `}</style>
        </div>
      )}

      {/* ══════════════ DELETE MODAL ══════════════ */}
      {deleteModalOpen && (
        <div
          style={{ position:'fixed', inset:0, backgroundColor:'rgba(27,10,18,0.6)', zIndex:1050, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
          onClick={closeDeleteModal}
        >
          <div
            style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'360px', textAlign:'center', boxShadow:'0 24px 60px rgba(27,10,18,0.18)' }}
            onClick={e => e.stopPropagation()}
            className="popup-anim"
          >
            <div style={{ display:'inline-flex', background:'rgba(220,38,38,0.08)', padding:'16px', borderRadius:'50%', color:'#DC2626', marginBottom:'14px' }}>
              <FiAlertTriangle size={30} />
            </div>
            <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'20px', fontWeight:'800', color:'#1B0A12', marginBottom:'8px' }}>
              Delete Allocation?
            </h3>
            <p style={{ color:'#9B8F94', fontSize:'14px', lineHeight:'1.6', marginBottom:'22px' }}>
              This action cannot be undone. Are you sure you want to permanently delete this exam allocation?
            </p>
            <div style={{ display:'flex', gap:'10px' }}>
              <button
                onClick={closeDeleteModal}
                style={{ flex:1, padding:'11px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', fontWeight:'700', fontSize:'14px', cursor:'pointer' }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{ flex:1, padding:'11px', borderRadius:'50px', border:'none', background:'#DC2626', color:'white', fontWeight:'700', fontSize:'14px', cursor:'pointer' }}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default History;
