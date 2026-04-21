import { Link } from 'react-router-dom';
import { FiPrinter, FiEdit2, FiCheckCircle, FiUsers, FiHome, FiCalendar, FiClock, FiBook } from 'react-icons/fi';

const StepResult = ({ allocation, onModify }) => {
  if (!allocation) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  };

  const dateRange = allocation.toDate && allocation.toDate !== allocation.fromDate
    ? `${formatDate(allocation.fromDate)} → ${formatDate(allocation.toDate)}`
    : formatDate(allocation.fromDate);

  const infoItems = [
    { icon: <FiBook size={15} />, label: 'Exam', value: allocation.examName },
    { icon: <FiUsers size={15} />, label: 'Year / Semester', value: allocation.yearSemester },
    { icon: <FiClock size={15} />, label: 'Session', value: `${allocation.session} — ${allocation.sessionTime}` },
    { icon: <FiCalendar size={15} />, label: 'Date', value: dateRange },
    { icon: <FiUsers size={15} />, label: 'Total Students', value: allocation.totalStrength },
    { icon: <FiHome size={15} />, label: 'Halls', value: (allocation.hallAllocations || []).map(h => h.hallName).join(', ') || '—' },
  ];

  return (
    <div className="step-content p-4 bg-white rounded-4 shadow-sm border" style={{ borderColor: '#E8E2E5' }}>

      {/* ── Success Banner ── */}
      <div style={{
        textAlign: 'center',
        padding: '28px 20px 24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #FDF2F7 0%, #FEF7FB 100%)',
        border: '1.5px solid rgba(180,43,106,0.15)',
        marginBottom: '24px',
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #B42B6A 0%, #9A2259 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 6px 24px rgba(180,43,106,0.3)',
        }}>
          <FiCheckCircle size={30} color="white" strokeWidth={2.5} />
        </div>
        <h3 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '22px', fontWeight: '800',
          color: '#1B0A12', margin: '0 0 6px',
        }}>
          Allocation Successful!
        </h3>
        <p style={{ color: '#9B8F94', fontSize: '13px', margin: 0 }}>
          Hall plan has been generated. Review details below and print when ready.
        </p>
      </div>

      {/* ── Info Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px',
        marginBottom: '28px',
      }}>
        {infoItems.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#FAFAFA',
            border: '1px solid #F0EDF0',
          }}>
            <div style={{
              color: '#B42B6A', flexShrink: 0, marginTop: '1px',
            }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '2px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1B0A12', lineHeight: 1.3 }}>
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div className="d-flex flex-column flex-sm-row justify-content-center gap-3 pt-3 border-top no-print">
        {onModify && (
          <button
            className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2 px-4 py-2 rounded-pill fw-bold"
            onClick={onModify}
          >
            <FiEdit2 size={15} /> Modify
          </button>
        )}

        {allocation._id && (
          <Link
            to={`/print/${allocation._id}`}
            className="btn btn-primary d-flex align-items-center justify-content-center gap-2 px-5 py-2 rounded-pill fw-bold"
          >
            <FiPrinter size={15} /> Print / Download PDF
          </Link>
        )}
      </div>

    </div>
  );
};

export default StepResult;
