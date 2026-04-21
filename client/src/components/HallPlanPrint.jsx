import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FiArrowLeft, FiPrinter, FiEdit2, FiSave, FiXCircle, FiAlignLeft, FiAlignCenter, FiAlignRight, FiType, FiMove } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';

const PRINT_FONT = '"Times New Roman", Times, serif';

const HallPlanPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [allocation, setAllocation] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [dragMode,  setDragMode]  = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);
  const printRef     = useRef();
  const dragRef      = useRef(null);
  const containerRef   = useRef();
  const userZoomedRef  = useRef(false);
  const [pageScale,    setPageScale]  = useState(1);

  const fmt = useCallback((cmd, val) => { document.execCommand(cmd, false, val ?? null); }, []);
  const addTextBox = useCallback(() => {
    setTextBoxes(prev => [...prev, { id: Date.now(), x: 40, y: 80 + prev.length * 70, text: 'Text box — click to edit' }]);
  }, []);
  const startDrag = useCallback((e, tb) => {
    dragRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y };
    e.preventDefault();
  }, []);
  useEffect(() => {
    if (!isEditing) return;
    const onMove = (e) => {
      if (!dragRef.current) return;
      const { id, startX, startY, origX, origY } = dragRef.current;
      setTextBoxes(prev => prev.map(tb => tb.id === id ? { ...tb, x: origX + (e.clientX - startX), y: origY + (e.clientY - startY) } : tb));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isEditing]);

  /* ── Drag-anything: only active when dragMode is explicitly ON ── */
  useEffect(() => {
    if (!dragMode) return;
    const container = printRef.current;
    if (!container) return;

    const THRESHOLD = 4;
    let state = null;

    const findTarget = (el) => {
      let node = el;
      while (node && node !== container) {
        if (node.dataset?.textbox) return null;
        if (node.classList?.contains('hall-plan-output')) return null;
        if (node.tagName === 'IMG')   return node;
        if (node.tagName === 'TR')    return node;
        if (node.tagName === 'TD' || node.tagName === 'TH') return node.closest('tr') || node;
        if (node.tagName === 'TABLE') return node;
        if (node.tagName === 'DIV') {
          const d = window.getComputedStyle(node).display;
          if (d === 'block' || d === 'flex' || d === 'grid') return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const onDown = (e) => {
      if (dragRef.current) return;
      const el = findTarget(e.target);
      if (!el) return;
      const m = new DOMMatrix(window.getComputedStyle(el).transform);
      state = { el, startX: e.clientX, startY: e.clientY,
                origX: isNaN(m.m41) ? 0 : m.m41,
                origY: isNaN(m.m42) ? 0 : m.m42, moved: false };
    };

    const onMove = (e) => {
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.moved) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        state.moved = true;
        window.getSelection()?.removeAllRanges();
        state.el.style.position = 'relative';
        state.el.style.zIndex   = '5';
        state.el.style.cursor   = 'grabbing';
      }
      state.el.style.transform = `translate(${state.origX + dx}px,${state.origY + dy}px)`;
      e.preventDefault();
    };

    const onUp = () => {
      if (state?.el) state.el.style.cursor = '';
      state = null;
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragMode]);

  /* ── Scale A4 page to fit screen (auto-fit unless user manually zoomed) ── */
  useEffect(() => {
    const update = () => {
      if (userZoomedRef.current) return;
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setPageScale(Math.min(1, (w - 32) / 794));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const zoomIn  = () => { userZoomedRef.current = true; setPageScale(s => Math.min(2,   Math.round((s + 0.1) * 10) / 10)); };
  const zoomOut = () => { userZoomedRef.current = true; setPageScale(s => Math.max(0.25, Math.round((s - 0.1) * 10) / 10)); };

  useEffect(() => {
    const fetchAllocation = async () => {
      try {
        const res = await api.get(`/allocations/${id}`);
        setAllocation(res.data);
      } catch (err) {
        toast.error('Failed to load allocation for printing');
        navigate('/history');
      } finally {
        setLoading(false);
      }
    };
    fetchAllocation();
  }, [id, navigate]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `HallPlan_${allocation?.examName}_${allocation?.academicYear}`
  });

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: '#FAF7F9' }}>
        <div className="spinner-border" style={{ color: '#B42B6A' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!allocation) return null;

  const isElective = allocation.hasElectives;
  const electiveSubjects = allocation.electiveSubjects || [];
  const sectionElectiveCounts = allocation.sectionElectiveCounts || {};
  const hallSubjectCounts = allocation.hallSubjectCounts || {};
  const detectedSections = Object.keys(sectionElectiveCounts).sort();

  const sectionStrengthMap = {};
  (allocation.sections || []).forEach(s => { sectionStrengthMap[s.name] = s.strength; });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  };

  const thStyle = {
    fontFamily: PRINT_FONT,
    fontSize: '10.5pt',
    fontWeight: 'bold',
    padding: '7px 10px',
    textAlign: 'center',
    border: '1px solid #000',
    backgroundColor: '#f2f2f2',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const tdStyle = {
    fontFamily: PRINT_FONT,
    fontSize: '10.5pt',
    padding: '6px 10px',
    textAlign: 'center',
    border: '1px solid #000',
  };

  const PageHeader = ({ subtitle }) => (
    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
      <img src="/psna2logo.png" alt="PSNA Logo" style={{ height: '72px', marginBottom: '6px' }} />
      <h2 style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '15pt', margin: '0 0 3px 0', color: '#000' }}>
        PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY, DINDIGUL
      </h2>
      <p style={{ fontFamily: PRINT_FONT, fontSize: '12pt', fontWeight: 'normal', margin: '0 0 6px 0', color: '#000' }}>
        (An Autonomous Institution affiliated to Anna University)
      </p>
      <p style={{ fontFamily: PRINT_FONT, fontSize: '11.5pt', fontWeight: 'bold', margin: '0 0 10px 0', color: '#000' }}>
        DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
      </p>
      <div style={{ display: 'inline-block', borderTop: '2.5px solid #000', borderBottom: '2.5px solid #000', padding: '6px 36px' }}>
        <p style={{ fontFamily: PRINT_FONT, fontSize: '13.5pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 2px 0', color: '#000' }}>
          {allocation.examName}
        </p>
        <p style={{ fontFamily: PRINT_FONT, fontSize: '11pt', fontWeight: 'normal', margin: '0', color: '#000' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'linear-gradient(135deg, #FAF7F9 0%, #FEF9FB 100%)', minHeight: '100vh', padding: '24px 16px' }}>

      {/* ── Toolbar ── */}
      <div className="no-print print-toolbar-outer mb-4" style={{ background: isEditing ? '#FDF2F7' : 'rgba(255,255,255,0.7)', backdropFilter:'blur(12px)', borderRadius:'16px', border: isEditing ? '1.5px solid rgba(180,43,106,0.22)' : '1.5px solid rgba(232,226,229,0.8)', boxShadow:'0 4px 20px rgba(27,10,18,0.07)', padding:'10px 14px', transition:'all 0.25s' }}>

        {/* Row 1 — navigation + actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>

          {/* Left */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button onClick={() => navigate(-1)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#444', fontWeight:'600', fontSize:'13px', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', whiteSpace:'nowrap' }}>
              <FiArrowLeft size={15} /> Back
            </button>
            {isEditing && (
              <span style={{ background:'linear-gradient(135deg,#FDF2F7,#FEF7FB)', border:'1px solid rgba(180,43,106,0.3)', borderRadius:'50px', padding:'5px 12px', fontSize:'11px', fontWeight:'700', color:'#B42B6A', display:'flex', alignItems:'center', gap:'5px', whiteSpace:'nowrap' }}>
                <FiEdit2 size={11} /> Editing
              </span>
            )}
          </div>

          {/* Right — action buttons */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
            {!isEditing ? (
              <>
                <button onClick={() => setIsEditing(true)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#6B5E63', fontWeight:'600', fontSize:'13px', cursor:'pointer' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#B42B6A';e.currentTarget.style.color='#B42B6A';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#E8E2E5';e.currentTarget.style.color='#6B5E63';}}>
                  <FiEdit2 size={14} /> Edit
                </button>
                <button onClick={() => handlePrint()} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 18px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#C43078,#B42B6A)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}>
                  <FiPrinter size={14} /> Print / PDF
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsEditing(false); setDragMode(false); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#6B5E63', fontWeight:'600', fontSize:'13px', cursor:'pointer' }}>
                  <FiXCircle size={14} /> Cancel
                </button>
                <button onClick={() => { handlePrint(); setIsEditing(false); setDragMode(false); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 18px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#B42B6A,#9A2259)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}>
                  <FiSave size={14} /> Save &amp; Print
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2 — zoom controls centered */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(232,226,229,0.7)' }}>
          <div style={{ display:'flex', alignItems:'center', background:'white', border:'1.5px solid #E8E2E5', borderRadius:'50px', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <button onClick={zoomOut} title="Zoom out" style={{ padding:'7px 16px', background:'none', border:'none', cursor:'pointer', color:'#6B5E63', fontSize:'18px', fontWeight:'700', lineHeight:1 }}
              onMouseEnter={e=>e.currentTarget.style.background='#FDF2F7'} onMouseLeave={e=>e.currentTarget.style.background='none'}>−</button>
            <span style={{ fontSize:'13px', fontWeight:'800', color:'#1B0A12', minWidth:'52px', textAlign:'center', userSelect:'none' }}>
              {Math.round(pageScale * 100)}%
            </span>
            <button onClick={zoomIn} title="Zoom in" style={{ padding:'7px 16px', background:'none', border:'none', cursor:'pointer', color:'#6B5E63', fontSize:'18px', fontWeight:'700', lineHeight:1 }}
              onMouseEnter={e=>e.currentTarget.style.background='#FDF2F7'} onMouseLeave={e=>e.currentTarget.style.background='none'}>+</button>
          </div>
        </div>

      </div>

      {/* ── Mini editor toolbar (no-print) ── */}
      {isEditing && (() => {
        const TB = { display:'flex',alignItems:'center',justifyContent:'center',minWidth:'28px',height:'28px',padding:'0 6px',borderRadius:'6px',border:'1px solid transparent',background:'transparent',cursor:'pointer',color:'#6B5E63',fontSize:'13px',fontFamily:'inherit',transition:'all 0.15s',userSelect:'none' };
        const tbHov = (e) => { e.currentTarget.style.background='#FDF2F7'; e.currentTarget.style.color='#B42B6A'; e.currentTarget.style.border='1px solid rgba(180,43,106,0.22)'; };
        const tbLv  = (e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#6B5E63'; e.currentTarget.style.border='1px solid transparent'; };
        const Sep = () => <div style={{ width:1,height:20,background:'#E8E2E5',margin:'0 4px',flexShrink:0 }} />;
        return (
          <div className="no-print mb-3 print-editor-toolbar" style={{ maxWidth:'100%',background:'white',border:'1.5px solid #E8E2E5',borderRadius:'12px',padding:'6px 12px',display:'flex',alignItems:'center',gap:'2px',flexWrap:'wrap',boxShadow:'0 2px 12px rgba(180,43,106,0.08)' }}>
            {[{label:<b style={{fontFamily:'Georgia,serif',fontSize:'14px'}}>B</b>,cmd:'bold',title:'Bold'},{label:<i style={{fontFamily:'Georgia,serif',fontSize:'14px'}}>I</i>,cmd:'italic',title:'Italic'},{label:<u style={{fontSize:'13px'}}>U</u>,cmd:'underline',title:'Underline'},{label:<s style={{fontSize:'13px'}}>S</s>,cmd:'strikeThrough',title:'Strikethrough'}].map(({label,cmd,title})=>(
              <button key={cmd} title={title} style={TB} onMouseDown={e=>{e.preventDefault();fmt(cmd);}} onMouseEnter={tbHov} onMouseLeave={tbLv}>{label}</button>
            ))}
            <Sep />
            <select onChange={e=>document.execCommand('fontSize',false,e.target.value)} style={{height:'28px',borderRadius:'6px',border:'1px solid #E8E2E5',padding:'0 4px',fontSize:'12px',color:'#6B5E63',cursor:'pointer',background:'white'}}>
              <option value="1">8pt</option><option value="2">10pt</option><option value="3" defaultValue>12pt</option><option value="4">14pt</option><option value="5">18pt</option><option value="6">24pt</option><option value="7">32pt</option>
            </select>
            <Sep />
            <label title="Text Colour" style={{...TB,position:'relative',overflow:'hidden',cursor:'pointer'}} onMouseEnter={tbHov} onMouseLeave={tbLv}>
              <span style={{fontWeight:'700',fontSize:'13px',borderBottom:'2.5px solid #B42B6A',lineHeight:1}}>A</span>
              <input type="color" defaultValue="#000000" onChange={e=>document.execCommand('foreColor',false,e.target.value)} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
            </label>
            <label title="Highlight" style={{...TB,position:'relative',overflow:'hidden',cursor:'pointer'}} onMouseEnter={tbHov} onMouseLeave={tbLv}>
              <span style={{fontWeight:'700',fontSize:'12px',background:'#FDE68A',padding:'1px 3px',borderRadius:'2px'}}>H</span>
              <input type="color" defaultValue="#FFFF88" onChange={e=>document.execCommand('backColor',false,e.target.value)} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
            </label>
            <Sep />
            {[{Icon:FiAlignLeft,cmd:'justifyLeft',title:'Align Left'},{Icon:FiAlignCenter,cmd:'justifyCenter',title:'Centre'},{Icon:FiAlignRight,cmd:'justifyRight',title:'Align Right'}].map(({Icon,cmd,title})=>(
              <button key={cmd} title={title} style={TB} onMouseDown={e=>{e.preventDefault();fmt(cmd);}} onMouseEnter={tbHov} onMouseLeave={tbLv}><Icon size={14} /></button>
            ))}
            <Sep />
            <button title="Add floating text box" onMouseDown={e=>{e.preventDefault();addTextBox();}} style={{...TB,gap:'5px',padding:'0 10px',fontSize:'12px',fontWeight:'600'}} onMouseEnter={tbHov} onMouseLeave={tbLv}><FiType size={13} /> + Text Box</button>
            <Sep />
            <button
              title={dragMode ? 'Click to disable Drag & Drop' : 'Click to enable Drag & Drop'}
              onMouseDown={e=>{e.preventDefault();setDragMode(v=>!v);}}
              style={{...TB,gap:'5px',padding:'0 12px',fontSize:'12px',fontWeight:'700',background:dragMode?'#B42B6A':'transparent',color:dragMode?'white':'#6B5E63',border:dragMode?'1px solid #B42B6A':'1px solid transparent'}}
            ><FiMove size={13} /> {dragMode ? 'Drag ON' : 'Drag & Drop'}</button>
          </div>
        );
      })()}

      {/* Printable Area */}
      <div ref={containerRef} className="print-page-outer">
      <div ref={printRef} style={{ position:'relative' }}>
      <div
        className="hall-plan-output bg-white mx-auto"
        contentEditable={isEditing}
        suppressContentEditableWarning={true}
        style={{
          width: '210mm',
          minHeight: '297mm',
          zoom: pageScale,
          transformOrigin: 'top left',
          padding: '14mm 16mm',
          boxSizing: 'border-box',
          color: '#000',
          fontFamily: PRINT_FONT,
          boxShadow: isEditing
            ? '0 0 0 2px #B42B6A, 0 8px 40px rgba(0,0,0,0.12)'
            : '0 8px 40px rgba(0,0,0,0.12)',
          borderRadius: '4px',
          outline: 'none',
          cursor: dragMode ? 'grab' : 'text',
          transition: 'box-shadow 0.2s',
        }}
      >
        {/* Page 1 Header */}
        <PageHeader subtitle={`HALL PLAN - CSE (${allocation.academicYear}) ${allocation.semesterType}`} />

        {/* Sub-header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: PRINT_FONT, fontSize: '11pt', fontWeight: 'bold', marginBottom: '12px', padding: '0 2px' }}>
          <span>{allocation.yearSemester}</span>
          <span>Session: {allocation.session}</span>
          <span>DATE: {formatDate(allocation.fromDate)}{allocation.toDate && allocation.toDate !== allocation.fromDate ? ` to ${formatDate(allocation.toDate)}` : ''}</span>
        </div>

        {/* Main Allocation Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ ...thStyle, width: '18%' }}>Year / Semester</th>
              <th rowSpan="2" style={{ ...thStyle, width: '10%' }}>Section</th>
              <th colSpan="2" style={thStyle}>Roll No.</th>
              <th rowSpan="2" style={{ ...thStyle, width: '16%' }}>Hall No.</th>
              <th rowSpan="2" style={{ ...thStyle, width: '16%' }}>Total Strength</th>
              <th rowSpan="2" style={{ ...thStyle, width: '14%' }}>Block</th>
            </tr>
            <tr>
              <th style={thStyle}>From</th>
              <th style={thStyle}>To</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const tableRows = [];
              let isFirstRow = true;
              let totalEntries = 0;
              allocation.hallAllocations.forEach(h => { totalEntries += h.entries.length; });

              allocation.hallAllocations.forEach((hall) => {
                hall.entries.forEach((entry, eIdx) => {
                  tableRows.push(
                    <tr key={`${hall.hallName}-${entry.section}`}>
                      {isFirstRow && (
                        <td rowSpan={totalEntries} style={{ ...tdStyle, fontWeight: 'bold', verticalAlign: 'middle' }}>
                          {allocation.yearSemester}
                        </td>
                      )}
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{entry.section}</td>
                      <td style={tdStyle}>{entry.fromRoll}</td>
                      <td style={tdStyle}>{entry.toRoll}</td>
                      {eIdx === 0 && (
                        <td rowSpan={hall.entries.length} style={{ ...tdStyle, fontWeight: 'bold', verticalAlign: 'middle' }}>{hall.hallName}</td>
                      )}
                      {eIdx === 0 && (
                        <td rowSpan={hall.entries.length} style={{ ...tdStyle, fontWeight: 'bold', verticalAlign: 'middle' }}>{hall.totalInHall}</td>
                      )}
                      {isFirstRow && (
                        <td rowSpan={totalEntries + 1} style={{ ...tdStyle, fontWeight: 'bold', verticalAlign: 'middle' }}>
                          {allocation.block || 'CSE Block'}
                        </td>
                      )}
                      {(isFirstRow = false, null)}
                    </tr>
                  );
                });
              });
              return tableRows;
            })()}
            <tr>
              <td colSpan="5" style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '16px' }}>TOTAL</td>
              <td style={{ ...tdStyle, fontWeight: 'bold' }}>{allocation.totalStrength}</td>
            </tr>
          </tbody>
        </table>

        {/* Examination Timings */}
        <p style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', marginBottom: '8px' }}>Examination Timings:</p>
        <table style={{ width: '55%', margin: '0 auto 24px auto', borderCollapse: 'collapse', border: '1px solid #000' }}>
          <thead>
            <tr>
              <th style={thStyle}>Year &amp; Semester</th>
              <th style={thStyle}>Session &amp; Time</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 'bold' }}>{allocation.yearSemester.replace(' / ', ' & ')}</td>
              <td style={tdStyle}>{allocation.sessionTime}</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures Page 1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', padding: '0 16px' }}>
          <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', borderTop: '1px solid #000', paddingTop: '6px', width: '180px' }}>
            Exam Cell In-charge
          </div>
          <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', borderTop: '1px solid #000', paddingTop: '6px', width: '180px' }}>
            HOD-CSE
          </div>
        </div>

        {/* ========== ELECTIVE PAGES ========== */}
        {isElective && electiveSubjects.length > 0 && (
          <>
            <div style={{ pageBreakBefore: 'always' }} />
            <PageHeader subtitle={`ELECTIVE SUBJECT DETAILS - CSE (${allocation.academicYear}) ${allocation.semesterType}`} />

            <p style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase', textAlign: 'center', margin: '16px 0 10px' }}>
              Section Wise Elective Count
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '24px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Section</th>
                  {electiveSubjects.map(el => <th key={el} style={thStyle}>{el}</th>)}
                  <th style={thStyle}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {detectedSections.map(sec => {
                  const counts = sectionElectiveCounts[sec] || {};
                  const sectionStudentCount = sectionStrengthMap[sec] || 0;
                  return (
                    <tr key={sec}>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{sec}-Sec</td>
                      {electiveSubjects.map(el => <td key={el} style={tdStyle}>{counts[el] || 0}</td>)}
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{sectionStudentCount}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL</td>
                  {electiveSubjects.map(el => {
                    const colTotal = detectedSections.reduce((sum, sec) => sum + ((sectionElectiveCounts[sec] || {})[el] || 0), 0);
                    return <td key={el} style={{ ...tdStyle, fontWeight: 'bold' }}>{colTotal}</td>;
                  })}
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{allocation.totalStrength}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase', textAlign: 'center', margin: '16px 0 10px' }}>
              Hall Wise Elective Count
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '24px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Hall No</th>
                  {electiveSubjects.map(el => <th key={el} style={thStyle}>{el}</th>)}
                  <th style={thStyle}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {allocation.hallAllocations.map(hall => {
                  const counts = hallSubjectCounts[hall.hallName] || {};
                  return (
                    <tr key={hall.hallName}>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{hall.hallName}</td>
                      {electiveSubjects.map(el => <td key={el} style={tdStyle}>{counts[el] || 0}</td>)}
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{hall.totalInHall}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL</td>
                  {electiveSubjects.map(el => {
                    const colTotal = allocation.hallAllocations.reduce((sum, hall) => sum + ((hallSubjectCounts[hall.hallName] || {})[el] || 0), 0);
                    return <td key={el} style={{ ...tdStyle, fontWeight: 'bold' }}>{colTotal}</td>;
                  })}
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{allocation.totalStrength}</td>
                </tr>
              </tbody>
            </table>

            {/* Final Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', padding: '0 16px' }}>
              <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', borderTop: '1px solid #000', paddingTop: '6px', width: '180px' }}>
                Exam Cell In-charge
              </div>
              <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', borderTop: '1px solid #000', paddingTop: '6px', width: '180px' }}>
                HOD-CSE
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Floating text boxes ── */}
      {textBoxes.map(tb => (
        <div key={tb.id} data-textbox="1" style={{ position:'absolute',left:tb.x,top:tb.y,minWidth:'120px',minHeight:'32px',border:isEditing?'1.5px dashed #B42B6A':'1px solid #333',background:'white',zIndex:20,borderRadius:'3px',boxShadow:isEditing?'0 2px 10px rgba(180,43,106,0.18)':'none',cursor:isEditing?'move':'default' }}
          onMouseDown={e=>{if(!isEditing)return;e.stopPropagation();startDrag(e,tb);}}>
          {isEditing && (
            <button className="no-print" onClick={e=>{e.stopPropagation();setTextBoxes(prev=>prev.filter(t=>t.id!==tb.id));}} onMouseDown={e=>e.stopPropagation()}
              style={{position:'absolute',top:-10,right:-10,width:20,height:20,borderRadius:'50%',border:'none',background:'#B42B6A',color:'white',fontSize:'14px',lineHeight:1,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.25)'}}>×</button>
          )}
          <div contentEditable={isEditing} suppressContentEditableWarning={true} onMouseDown={e=>e.stopPropagation()}
            style={{padding:'6px 10px',minHeight:'28px',fontFamily:PRINT_FONT,fontSize:'10pt',outline:'none',cursor:'text',whiteSpace:'pre-wrap'}}
          >{tb.text}</div>
        </div>
      ))}
      </div>{/* end printRef wrapper */}
      </div>{/* end print-page-outer */}

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            background: #fff;
          }
          .no-print {
            display: none !important;
          }
          .hall-plan-output {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            zoom: 1 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HallPlanPrint;
