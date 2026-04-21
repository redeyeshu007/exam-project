import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiClipboard, FiAlertTriangle } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';

const AttendancePage = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchAllocations(); }, []);

  const fetchAllocations = async () => {
    try {
      const res = await api.get('/allocations');
      setAllocations(res.data);
    } catch {
      toast.error('Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ds) => {
    if (!ds) return '—';
    const d = new Date(ds);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  };

  const generateBtn = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 16px', borderRadius: '50px', border: 'none',
    background: 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)',
    color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(180,43,106,0.28)',
    transition: 'all 0.18s',
    whiteSpace: 'nowrap',
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
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom page-header-wrap">
        <div>
          <h2 className="fw-bold m-0" style={{ fontSize:'clamp(18px,5vw,24px)', color:'#1B0A12', fontFamily:"'Playfair Display', Georgia, serif" }}>
            Attendance Sheet Generation
          </h2>
          <p style={{ color:'#9B8F94', fontSize:'13px', margin:'4px 0 0' }}>
            Select an allocation to generate per-hall attendance sheets
          </p>
        </div>
        <Link to="/home" style={{
          display:'inline-flex', alignItems:'center', gap:'6px',
          padding:'8px 18px', borderRadius:'50px',
          border:'1.5px solid #E8E2E5', background:'white',
          color:'#6B5E63', fontWeight:'600', fontSize:'13px', textDecoration:'none',
          transition:'all 0.18s', flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#B42B6A'; e.currentTarget.style.color='#B42B6A'; e.currentTarget.style.background='#FDF2F7'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='#E8E2E5'; e.currentTarget.style.color='#6B5E63'; e.currentTarget.style.background='white'; }}
        >
          ← Home
        </Link>
      </div>

      {allocations.length === 0 ? (
        <div className="text-center bg-white p-5 rounded-4 border shadow-sm">
          <div style={{ display:'inline-flex', background:'#FDF2F7', padding:'18px', borderRadius:'50%', color:'#B42B6A', marginBottom:'16px' }}>
            <FiClipboard size={30} />
          </div>
          <p className="text-muted mb-3 fs-5">No allocations found.</p>
          <p style={{ color:'#9B8F94', fontSize:'14px', marginBottom:'20px' }}>
            Create an exam hall allocation first, then return here to generate attendance sheets.
          </p>
          <Link to="/allocate" className="btn btn-primary rounded-pill fw-bold px-4 py-2">
            Create Allocation
          </Link>
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div style={{
            background:'#FDF2F7', border:'1px solid rgba(180,43,106,0.18)',
            borderRadius:'12px', padding:'12px 16px',
            display:'flex', alignItems:'flex-start', gap:'10px',
            marginBottom:'20px',
          }}>
            <FiAlertTriangle size={16} color="#B42B6A" style={{ marginTop:'2px', flexShrink:0 }} />
            <p style={{ margin:0, fontSize:'13px', color:'#6B5E63', lineHeight:'1.5' }}>
              <strong style={{ color:'#B42B6A' }}>Standard allocations (I/II year)</strong> store only roll number ranges.
              When generating, you will be asked to upload an Excel file with Register Numbers and Student Names.
              <strong style={{ color:'#B42B6A' }}> Elective allocations (III/IV year)</strong> already have names and will generate immediately.
            </p>
          </div>

          {/* ── Desktop Table ── */}
          <div className="d-none d-md-block bg-white rounded-4 border shadow-sm overflow-hidden mb-4">
            <table className="table table-hover mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  {['Date Created','Exam Name','AY / Sem / Session','Date Range','Students','Type','Action'].map(h => (
                    <th key={h}
                      className={`px-4 py-3 text-muted ${h === 'Action' ? 'text-end' : ''} ${h === 'Students' ? 'text-center' : ''}`}
                      style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #E8E2E5' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.map(alloc => (
                  <tr key={alloc._id} className="history-row-hover" style={{ transition:'all 0.18s ease' }}>
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
                      <span style={{
                        fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'50px',
                        background: alloc.hasElectives ? '#FDF2F7' : '#F5F5F5',
                        color: alloc.hasElectives ? '#B42B6A' : '#6B5E63',
                        border: alloc.hasElectives ? '1px solid rgba(180,43,106,0.18)' : '1px solid #E8E2E5',
                        whiteSpace: 'nowrap',
                      }}>
                        {alloc.hasElectives ? 'Elective' : 'Standard'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        style={generateBtn}
                        onClick={() => navigate(`/attendance-print/${alloc._id}`)}
                        onMouseEnter={e => { e.currentTarget.style.opacity='0.88'; e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}
                      >
                        <FiClipboard size={13} /> Generate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="d-flex d-md-none flex-column gap-3 mb-4">
            {allocations.map(alloc => (
              <div key={alloc._id} className="bg-white p-4 rounded-4 border shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted fw-bold" style={{ fontFamily:"'JetBrains Mono',Consolas,monospace", fontSize:'12px' }}>
                    {formatDate(alloc.createdAt)}
                  </span>
                  <span style={{
                    fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'50px',
                    background: alloc.hasElectives ? '#FDF2F7' : '#F5F5F5',
                    color: alloc.hasElectives ? '#B42B6A' : '#6B5E63',
                    border: alloc.hasElectives ? '1px solid rgba(180,43,106,0.18)' : '1px solid #E8E2E5',
                  }}>
                    {alloc.hasElectives ? 'Elective' : 'Standard'}
                  </span>
                </div>
                <h3 className="fw-bold mb-1" style={{ fontSize:'18px', color:'#1B0A12', fontFamily:"'Playfair Display',Georgia,serif" }}>
                  {alloc.examName}
                </h3>
                <p className="text-muted mb-0 fw-medium" style={{ fontSize:'13px' }}>
                  {alloc.academicYear} &bull; {alloc.yearSemester} &bull; {alloc.session}
                </p>
                <p style={{ color:'#9B8F94', fontSize:'12px', margin:'4px 0 0', fontFamily:"'JetBrains Mono',Consolas,monospace" }}>
                  {formatDate(alloc.fromDate)}{alloc.toDate && alloc.toDate !== alloc.fromDate ? ` → ${formatDate(alloc.toDate)}` : ''}
                </p>
                <div className="pt-3 mt-3" style={{ borderTop:'1px dashed #E8E2E5' }}>
                  <button
                    style={{ ...generateBtn, width:'100%', justifyContent:'center' }}
                    onClick={() => navigate(`/attendance-print/${alloc._id}`)}
                  >
                    <FiClipboard size={14} /> Generate Attendance Sheet
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AttendancePage;
