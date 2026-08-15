import DatePickerPopup from './DatePickerPopup';
import ClockTimePicker from './ClockTimePicker';
import { FiCalendar, FiClock, FiUpload } from 'react-icons/fi';
import { useState } from 'react';

const EXAM_NAMES = ['Serial Test - I', 'Serial Test - II'];

const StepExamDetails = ({ formData, setFormData, electiveEnabled, setElectiveEnabled }) => {
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen,   setIsEndOpen]   = useState(false);

  const handleYearChange = (e) => {
    const year = e.target.value;
    const map = { I: ['I','ODD'], II: ['III','ODD'], III: ['V','ODD'], IV: ['VII','ODD'] };
    const [newSem, newType] = map[year] || ['',''];
    setFormData(prev => ({ ...prev, year, semester: newSem, semesterType: newType, yearSemester: year ? `${year} / ${newSem}` : '' }));
  };

  const handleSemChange = (e) => {
    const sem = e.target.value;
    const isOdd = ['I','III','V','VII'].includes(sem);
    setFormData(prev => ({ ...prev, semester: sem, semesterType: isOdd ? 'ODD' : 'EVEN', yearSemester: `${prev.year} / ${sem}` }));
  };

  const handleSessionChange = (sess) => {
    const defaultTime = sess === 'FN' ? 'FN & 09.30 AM - 11.30 AM' : 'AN & 02.30 PM - 04.30 PM';
    setFormData(prev => ({ ...prev, session: sess, sessionTime: defaultTime }));
  };

  const handleTextChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAcademicYearBlur = () => {
    const val = (formData.academicYear || '').trim();
    if (/^\d{4}$/.test(val)) {
      const start = parseInt(val, 10);
      setFormData(prev => ({ ...prev, academicYear: `${start}-${start + 4}` }));
    }
  };

  const handleStartDate = (date) =>
    setFormData(prev => ({
      ...prev, fromDate: date,
      toDate: prev.toDate && new Date(prev.toDate) < new Date(date) ? '' : prev.toDate,
    }));

  const handleEndDate = (date) => setFormData(prev => ({ ...prev, toDate: date }));

  const getSemesterOptions = () => {
    const opts = { I:[['I','I'],['II','II']], II:[['III','III'],['IV','IV']], III:[['V','V'],['VI','VI']], IV:[['VII','VII'],['VIII','VIII']] };
    return (opts[formData.year] || []).map(([v,l]) => ({ v, l }));
  };

  const formatDateDisplay = (ds) => {
    if (!ds) return 'DD / MM / YYYY';
    return new Date(ds).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  };

  const lbl = { fontSize:'11px', letterSpacing:'0.5px' };

  return (
    <div className="step-content p-4 bg-white rounded-4 shadow-sm border" style={{ borderColor:'#E8E2E5' }}>
      <div className="row g-4">

        {/* Exam Name — pill buttons */}
        <div className="col-12">
          <label className="form-label-small text-muted fw-bold" style={lbl}>EXAM NAME</label>
          <div className="d-flex gap-2 flex-wrap mt-1">
            {EXAM_NAMES.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, examName: n }))}
                style={{
                  padding: '10px 24px',
                  borderRadius: '50px',
                  border: formData.examName === n ? '2px solid #B42B6A' : '2px solid #E8E2E5',
                  background: formData.examName === n
                    ? 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)'
                    : 'white',
                  color: formData.examName === n ? 'white' : '#6B5E63',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: formData.examName === n ? '0 4px 14px rgba(180,43,106,0.3)' : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Academic Year */}
        <div className="col-md-6 col-12">
          <label className="form-label-small text-muted fw-bold" style={lbl}>ACADEMIC YEAR</label>
          <input type="text" name="academicYear"
            className="form-control form-control-lg bg-light border-0 wizard-input"
            value={formData.academicYear} onChange={handleTextChange}
            onBlur={handleAcademicYearBlur}
            placeholder="e.g., 2023-2027" />
        </div>

        {/* Year */}
        <div className="col-md-6 col-12">
          <label className="form-label-small text-muted fw-bold" style={lbl}>YEAR</label>
          <select className="form-select form-select-lg bg-light border-0 wizard-input fw-medium"
            value={formData.year || ''} onChange={handleYearChange}>
            <option value="">Select Year</option>
            {['I','II','III','IV'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Semester */}
        <div className="col-md-6 col-12">
          <label className="form-label-small text-muted fw-bold d-flex justify-content-between mb-1" style={lbl}>
            SEMESTER
            {formData.semesterType && (
              <span className="badge rounded-pill" style={{
                backgroundColor: formData.semesterType === 'ODD' ? '#FDF2F7' : '#EFF6FF',
                color: formData.semesterType === 'ODD' ? '#B42B6A' : '#3B82F6',
                border: `1px solid ${formData.semesterType === 'ODD' ? '#B42B6A' : '#3B82F6'}`,
                fontSize: '10px',
              }}>{formData.semesterType}</span>
            )}
          </label>
          <select className="form-select form-select-lg bg-light border-0 wizard-input fw-medium"
            value={formData.semester || ''} onChange={handleSemChange} disabled={!formData.year}>
            <option value="">Select Semester</option>
            {getSemesterOptions().map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        {/* Session */}
        <div className="col-md-6 col-12">
          <label className="form-label-small text-muted fw-bold" style={lbl}>SESSION</label>
          <div className="d-flex bg-light rounded-3 p-1" style={{ gap:'4px' }}>
            {['FN','AN'].map(sess => (
              <button key={sess} type="button" className="btn flex-grow-1 rounded-2 fw-bold"
                style={{
                  backgroundColor: formData.session === sess ? '#B42B6A' : 'transparent',
                  color: formData.session === sess ? 'white' : '#6B5E63',
                  fontSize: '14px', border:'none', transition:'all 0.2s',
                  boxShadow: formData.session === sess ? '0 2px 8px rgba(180,43,106,0.3)' : 'none',
                }}
                onClick={() => handleSessionChange(sess)}>
                {sess}
              </button>
            ))}
          </div>
        </div>

        {/* Clock Time Picker */}
        {formData.session && (
          <div className="col-12">
            <label className="form-label-small text-muted fw-bold d-flex align-items-center gap-2 mb-2" style={lbl}>
              <FiClock size={12} /> EXAMINATION TIME
            </label>
            <ClockTimePicker
              session={formData.session}
              value={formData.sessionTime}
              onChange={(t) => setFormData(prev => ({ ...prev, sessionTime: t }))}
            />
          </div>
        )}

        {/* Block */}
        <div className="col-md-6 col-12">
          <label className="form-label-small text-muted fw-bold" style={lbl}>BLOCK</label>
          <input type="text" className="form-control form-control-lg border-0 wizard-input text-muted"
            value="CSE Block" readOnly style={{ cursor:'not-allowed', backgroundColor:'#FAFAFA' }} />
        </div>

        {/* Start Date */}
        <div className="col-md-6 col-12 position-relative">
          <label className="form-label-small text-muted fw-bold" style={lbl}>START DATE</label>
          <div className="form-control form-control-lg bg-light border-0 wizard-input d-flex align-items-center gap-2"
            style={{ cursor:'pointer' }} onClick={() => setIsStartOpen(true)}>
            <FiCalendar color="#B42B6A" />
            <span className={formData.fromDate ? 'text-dark fw-medium' : 'text-muted'} style={{ fontSize:'15px' }}>
              {formatDateDisplay(formData.fromDate)}
            </span>
          </div>
          <DatePickerPopup isOpen={isStartOpen} initialDate={formData.fromDate||null}
            onSelect={handleStartDate} onClose={() => setIsStartOpen(false)} />
        </div>

        {/* End Date */}
        <div className="col-md-6 col-12 position-relative">
          <label className="form-label-small text-muted fw-bold" style={lbl}>END DATE</label>
          <div className="form-control form-control-lg bg-light border-0 wizard-input d-flex align-items-center gap-2"
            style={{ cursor:'pointer' }} onClick={() => setIsEndOpen(true)}>
            <FiCalendar color="#B42B6A" />
            <span className={formData.toDate ? 'text-dark fw-medium' : 'text-muted'} style={{ fontSize:'15px' }}>
              {formatDateDisplay(formData.toDate)}
            </span>
          </div>
          <DatePickerPopup isOpen={isEndOpen} minDate={formData.fromDate||undefined}
            initialDate={formData.toDate||null} onSelect={handleEndDate} onClose={() => setIsEndOpen(false)} />
        </div>

        {/* Elective Toggle — only for I/II year */}
        {(formData.year === 'I' || formData.year === 'II') && (
          <div className="col-12">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '14px',
                border: electiveEnabled
                  ? '1.5px solid rgba(180,43,106,0.4)'
                  : '1.5px solid #E8E2E5',
                background: electiveEnabled
                  ? 'linear-gradient(135deg, #FDF2F7 0%, #FEF7FB 100%)'
                  : '#FAFAFA',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
              onClick={() => setElectiveEnabled(prev => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: electiveEnabled ? 'rgba(180,43,106,0.12)' : '#F0EDF0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FiUpload size={16} color={electiveEnabled ? '#B42B6A' : '#9B8F94'} />
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: electiveEnabled ? '#B42B6A' : '#2D1F26' }}>
                    Enable Elective File Upload
                  </div>
                  <div style={{ fontSize: '11px', color: '#9B8F94', marginTop: '1px' }}>
                    {electiveEnabled
                      ? 'Student elective data will be uploaded in next step'
                      : 'Tap to enable if this batch has elective subjects'}
                  </div>
                </div>
              </div>
              {/* Toggle switch */}
              <div style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: electiveEnabled ? '#B42B6A' : '#D4CDD0',
                position: 'relative', flexShrink: 0,
                transition: 'background 0.25s ease',
                boxShadow: electiveEnabled ? '0 2px 8px rgba(180,43,106,0.3)' : 'none',
              }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: '3px',
                  left: electiveEnabled ? '23px' : '3px',
                  transition: 'left 0.25s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StepExamDetails;
