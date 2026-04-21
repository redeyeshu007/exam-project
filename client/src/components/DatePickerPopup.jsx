import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiX, FiAlertTriangle } from 'react-icons/fi';

const DatePickerPopup = ({ isOpen, onClose, onSelect, minDate, initialDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [satConfirm, setSatConfirm] = useState(null); // pending Saturday date

  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        const d = new Date(initialDate);
        setCurrentDate(d);
        setSelectedDate(d);
      } else {
        const defaultDate = minDate ? new Date(minDate) : new Date();
        setCurrentDate(defaultDate);
      }
    }
  }, [isOpen, initialDate, minDate]);

  if (!isOpen) return null;

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getNextMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 6 = Saturday
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const handleDateClick = (day) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (minDate && d < new Date(new Date(minDate).setHours(0,0,0,0))) return;
    if (d.getDay() === 6) {
      setSatConfirm(d); // show Saturday confirmation
      return;
    }
    setSelectedDate(d);
  };

  const handleSatYes = () => {
    setSelectedDate(satConfirm);
    setSatConfirm(null);
  };

  const handleSatNo = () => {
    setSelectedDate(getNextMonday(satConfirm));
    setSatConfirm(null);
  };

  const handleConfirm = () => {
    if (selectedDate) {
      // Format as YYYY-MM-DD
      const offset = selectedDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(selectedDate - offset)).toISOString().split('T')[0];
      onSelect(localISOTime);
      onClose();
    }
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  
  let firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  firstDay = firstDay === 0 ? 6 : firstDay - 1; // Adjust for Monday start (0=Monday, 6=Sunday)
  
  const emptyCells = firstDay;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const minDateTime = minDate ? new Date(new Date(minDate).setHours(0,0,0,0)).getTime() : 0;
  const todayTime = new Date(new Date().setHours(0,0,0,0)).getTime();

  return (
    <div className="modal-overlay date-picker-overlay position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(27,10,18,0.6)', zIndex: 1050 }} onClick={onClose}>
      <div className="card shadow-lg border-0 rounded-4 popup-anim date-picker-card" style={{ width: '90vw', maxWidth: '340px', backgroundColor: '#ffffff' }} onClick={e => e.stopPropagation()}>
        
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '16px', color: '#1B0A12' }}>Select Date</h5>
          <button onClick={onClose} className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button type="button" onClick={handlePrevMonth} className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center hover-scale">
              <FiChevronLeft size={16} />
            </button>
            <span className="fw-bold" style={{ color: '#2D1F26' }}>{monthNames[currentMonth]} {currentYear}</span>
            <button type="button" onClick={handleNextMonth} className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center hover-scale">
              <FiChevronRight size={16} />
            </button>
          </div>

          <div className="d-grid gap-1 mb-2 text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '12px', fontWeight: 'bold', color: '#9B8F94' }}>
            {dayNames.map(day => <div key={day}>{day}</div>)}
          </div>

          <div className="d-grid gap-1 text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: emptyCells }).map((_, i) => <div key={`empty-${i}`} />)}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dTime = new Date(currentYear, currentMonth, day).getTime();
              const isDisabled = minDate && dTime < minDateTime;
              const isSelected = selectedDate && selectedDate.getTime() === dTime;
              const isToday = dTime === todayTime;

              let cellClass = "rounded-circle d-flex align-items-center justify-content-center mx-auto ";
              let cellStyle = { width: '32px', height: '32px', cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: '14px', transition: 'all 0.2s' };
              
              if (isDisabled) {
                cellClass += "text-muted";
                cellStyle.opacity = 0.4;
              } else if (isSelected) {
                cellClass += "text-white shadow-sm";
                cellStyle.backgroundColor = '#B42B6A'; // Primary color
              } else if (isToday) {
                cellClass += "text-primary fw-bold";
                cellStyle.border = '1px solid #B42B6A';
              } else {
                cellClass += "date-cell-hover text-dark";
              }

              return (
                <div key={day} className="py-1">
                  <div
                    className={cellClass}
                    style={cellStyle}
                    onClick={() => !isDisabled && handleDateClick(day)}
                  >
                    {day}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="btn text-white w-100 rounded-pill fw-bold hover-scale"
              style={{ padding: '10px 0', backgroundColor: selectedDate ? '#B42B6A' : '#D4CDD0', border: 'none' }}
            >
              Confirm
            </button>
          </div>
        </div>

      </div>

      <style>{`
        .date-picker-overlay {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        @media (max-width: 768px) {
          .date-picker-overlay {
            align-items: flex-end;
            padding-bottom: 16px;
          }
          .date-picker-card {
            width: 100% !important;
            max-width: 100% !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            animation: slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
          }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Saturday Confirmation overlay (inside the same portal layer) */}
      {satConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(27,10,18,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 1060,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'fadeIn 0.18s ease',
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '28px 24px',
            width: '100%', maxWidth: '340px', textAlign: 'center',
            boxShadow: '0 24px 60px rgba(27,10,18,0.22)',
            animation: 'modalPop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{
              display: 'inline-flex', background: 'rgba(245,158,11,0.1)',
              padding: '14px', borderRadius: '50%', color: '#D97706', marginBottom: '14px',
            }}>
              <FiAlertTriangle size={28} />
            </div>
            <h4 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '17px', fontWeight: '800', color: '#1B0A12', marginBottom: '8px' }}>
              Saturday Selected
            </h4>
            <p style={{ color: '#6B5E63', fontSize: '13px', lineHeight: '1.6', marginBottom: '22px' }}>
              <strong>{satConfirm.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> is a Saturday.
              <br />Do you want to keep this date?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSatNo}
                style={{
                  flex: 1, padding: '10px', borderRadius: '50px',
                  border: '2px solid #B42B6A', background: 'white',
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer', color: '#B42B6A',
                  transition: 'all 0.18s',
                }}
              >
                No — Next Monday
              </button>
              <button
                onClick={handleSatYes}
                style={{
                  flex: 1, padding: '10px', borderRadius: '50px',
                  border: 'none',
                  background: 'linear-gradient(135deg,#B42B6A,#9A2259)',
                  color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(180,43,106,0.35)',
                  transition: 'all 0.18s',
                }}
              >
                Yes, Keep It
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes modalPop {
              0%   { transform: scale(0.85); opacity: 0; }
              100% { transform: scale(1);    opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default DatePickerPopup;
