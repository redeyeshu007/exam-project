import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPrinter, FiEdit2, FiSave, FiXCircle, FiAlignLeft, FiAlignCenter, FiAlignRight, FiType, FiMove, FiRotateCcw, FiRotateCw, FiDownload } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';

const PRINT_FONT = '"Times New Roman", Times, serif';
const PRINT_INK = '#1B1F5C';

const HallPlanPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [allocation, setAllocation] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [dragMode,  setDragMode]  = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printRef     = useRef();
  const dragRef      = useRef(null);
  const containerRef   = useRef();
  const userZoomedRef  = useRef(false);
  const [pageScale,    setPageScale]  = useState(1);
  const pageScaleRef   = useRef(1);
  const tbsRef         = useRef([]);

  const fmt = useCallback((cmd, val) => { document.execCommand(cmd, false, val ?? null); }, []);

  /* ── Undo / Redo for textBoxes ── */
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length > 0) {
      setTextBoxes(current => {
        redoStack.current.push(current);
        return undoStack.current.pop();
      });
    } else {
      document.execCommand('undo');
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length > 0) {
      setTextBoxes(current => {
        undoStack.current.push(current);
        return redoStack.current.pop();
      });
    } else {
      document.execCommand('redo');
    }
  }, []);

  /* Keep refs in sync */
  useEffect(() => { pageScaleRef.current = pageScale; }, [pageScale]);
  useEffect(() => { tbsRef.current = textBoxes; }, [textBoxes]);

  /* Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo */
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditing, handleUndo, handleRedo]);

  const addTextBox = useCallback(() => {
    setTextBoxes(prev => {
      undoStack.current.push(prev);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      return [...prev, { id: Date.now(), x: 60, y: 100, html: 'Text box — click to edit' }];
    });
  }, []);

  const startDrag = useCallback((e, tb) => {
    dragRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y, preDragTBs: tbsRef.current };
    e.preventDefault();
  }, []);
  useEffect(() => {
    if (!isEditing) return;
    const onMove = (e) => {
      if (!dragRef.current) return;
      const { id, startX, startY, origX, origY } = dragRef.current;
      const sc = pageScaleRef.current || 1;
      setTextBoxes(prev => prev.map(tb => tb.id === id ? { ...tb, x: origX + (e.clientX - startX) / sc, y: origY + (e.clientY - startY) / sc } : tb));
    };
    const onUp = () => {
      const dr = dragRef.current;
      if (dr?.preDragTBs) {
        setTextBoxes(curr => {
          const moved = curr.find(t => t.id === dr.id);
          if (moved && (Math.abs(moved.x - dr.origX) > 1 || Math.abs(moved.y - dr.origY) > 1)) {
            undoStack.current.push(dr.preDragTBs);
            if (undoStack.current.length > 50) undoStack.current.shift();
            redoStack.current = [];
          }
          return curr;
        });
      }
      dragRef.current = null;
    };
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

  /* ── Auto-scale Hall Plan PAGE 1 content to STRICTLY fit one A4 page ──
     Strategy: each "page" div is wrapped with className "single-page-fit"
     and we scale ITS first child via CSS transform until scrollHeight <= MAX_H.
     This adjusts font size, row height, padding and margins proportionally
     while preserving readability. Used both in editor preview and print.

     adjustAllRef holds the latest fit function so it can be invoked directly
     from react-to-print's onBeforePrint hook (see handlePrint below) — the
     old approach of listening for the main window's `beforeprint` event
     doesn't reliably fire for react-to-print's cloned print iframe, which
     is why the printed output could end up using a stale/unfit zoom value
     that didn't match what was actually on screen. */
  const hallOutputRef = useRef(null);
  const adjustAllRef = useRef(() => {});
  useEffect(() => {
    const root = hallOutputRef.current;
    if (!root) return;

    // A4 height at 96dpi is 297mm. A small safety buffer (3%) is subtracted
    // so the fitted content never sits flush against the physical page edge
    // — print dialogs / drivers can impose a whisker of margin even when
    // the app's own @page rule asks for zero, and without this buffer that
    // alone is enough to push content onto a phantom second page or clip it,
    // which is what shows up as "alignment changed" between preview and PDF.
    const MAX_H_PX = 297 * 3.7795 * 0.90;

    const fitPage = (pageEl) => {
      const inner = pageEl.querySelector('.page-inner');
      if (!inner) return;
      // reset prior zoom / transform
      inner.style.zoom = '1';
      inner.style.transform = '';
      inner.style.transformOrigin = 'top left';
      inner.style.width = '';
      const natural = inner.scrollHeight;
      if (natural <= MAX_H_PX) return;
      // Compute scale, never below 0.75 to keep readable — a lower floor
      // (previously 0.55) made data-heavy elective tables shrink to the
      // point of being hard to read; 0.75 trades a small chance of the
      // rare very-long sheet spilling past the page for legibility.
      const scale = Math.max(0.75, MAX_H_PX / natural);
      inner.style.transform = `scale(${scale})`;
      inner.style.transformOrigin = 'top left';
      inner.style.width = `${100 / scale}%`;
    };

    const adjustAll = () => {
      root.querySelectorAll('.single-page-fit').forEach(fitPage);
    };

    adjustAllRef.current = adjustAll;
    // Wait for fonts to finish loading/swapping before the first measurement
    // so the auto-fit scale computed on page load matches the scale recomputed
    // at print time — a font metric change between the two would otherwise
    // shift table/row heights and throw off the alignment.
    if (document.fonts?.ready) {
      document.fonts.ready.then(adjustAll);
    }
    adjustAll();
    const ro = new ResizeObserver(adjustAll);
    ro.observe(root);
    window.addEventListener('resize', adjustAll);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', adjustAll);
    };
  }, [allocation, isEditing]);

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

  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    userZoomedRef.current = true; // suspend the auto screen-fit resize handler
    setPageScale(1);
    
    // Wait for state updates and browser layout reflow
    await new Promise(resolve => setTimeout(resolve, 100));
    if (document.fonts?.ready) await document.fonts.ready;
    adjustAllRef.current();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = printRef.current;
      
      const year  = allocation.year
        ? `${allocation.year} Year`
        : (allocation.yearSemester || '').split('/')[0].trim();
      const exam  = allocation.examName || '';
      const batch = (allocation.academicYear || '').replace(/-/g, '–');
      const filename = `${year} Hall Plan – ${exam} (${batch} Batch).pdf`;
      
      const opt = {
        margin:       0,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2.5, 
          useCORS: true, 
          logging: false, 
          letterRendering: true,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().from(element).set(opt).save();
    } catch (err) {
      toast.error('Failed to generate PDF download');
      console.error(err);
    } finally {
      setIsExportingPDF(false);
      userZoomedRef.current = false;
      if (containerRef.current) {
        setPageScale(Math.min(1, (containerRef.current.clientWidth - 32) / 794));
      }
    }
  };

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

  let totalEntriesCount = 0;
  allocation.hallAllocations.forEach(h => { totalEntriesCount += h.entries.length; });
  const totalMainRows = totalEntriesCount + 3; // headers (2) + total row (1)
  const mainCellPaddingY = Math.max(4, Math.min(18, Math.floor(120 / (totalMainRows || 10))));

  const thStyle = {
    fontFamily: PRINT_FONT,
    fontSize: '10.5pt',
    fontWeight: 'bold',
    padding: `${mainCellPaddingY + 1}px 8px`,
    textAlign: 'center',
    border: `1px solid ${PRINT_INK}`,
    color: PRINT_INK,
    backgroundColor: '#f2f2f2',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const tdStyle = {
    fontFamily: PRINT_FONT,
    fontSize: '10.5pt',
    fontWeight: 'bold',
    padding: `${mainCellPaddingY}px 8px`,
    textAlign: 'center',
    border: `1px solid ${PRINT_INK}`,
    color: PRINT_INK,
  };

  const electiveSecRows = detectedSections.length + 2;
  const electiveSecPaddingY = Math.max(5, Math.min(20, Math.floor(160 / (electiveSecRows || 5))));

  const electiveHallRows = allocation.hallAllocations.length + 2;
  const electiveHallPaddingY = Math.max(5, Math.min(20, Math.floor(160 / (electiveHallRows || 5))));

  const electiveSecThStyle = {
    ...thStyle,
    fontSize: '13.5pt',
    padding: `${electiveSecPaddingY + 1}px 12px`,
  };

  const electiveSecTdStyle = {
    ...tdStyle,
    fontSize: '13pt',
    fontWeight: 800,
    padding: `${electiveSecPaddingY}px 12px`,
  };

  const electiveHallThStyle = {
    ...thStyle,
    fontSize: '13.5pt',
    padding: `${electiveHallPaddingY + 1}px 12px`,
  };

  const electiveHallTdStyle = {
    ...tdStyle,
    fontSize: '13pt',
    fontWeight: 800,
    padding: `${electiveHallPaddingY}px 12px`,
  };

  const PageHeader = ({ subtitle }) => (
    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
      <img src="/psna2logo.png" alt="PSNA Logo" style={{ height: '72px', marginBottom: '9px' }} />
      <h2 style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '16pt', margin: '0 0 7px 0', color: PRINT_INK, letterSpacing: '0.2px' }}>
        PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY,<br />DINDIGUL
      </h2>
      <p style={{ fontFamily: PRINT_FONT, fontSize: '10.5pt', fontStyle: 'italic', fontWeight: 'normal', margin: '0 0 8px 0', color: PRINT_INK }}>
        (An Autonomous Institution affiliated to Anna University)
      </p>
      <p style={{ fontFamily: PRINT_FONT, fontSize: '11pt', fontWeight: 'bold', margin: '0 0 12px 0', color: PRINT_INK, letterSpacing: '0.3px' }}>
        DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
      </p>
      <div style={{ display: 'inline-block', borderTop: `2.5px solid ${PRINT_INK}`, borderBottom: `2.5px solid ${PRINT_INK}`, padding: '7px 40px' }}>
        <p style={{ fontFamily: PRINT_FONT, fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 3px 0', color: PRINT_INK, letterSpacing: '0.5px' }}>
          {allocation.examName}
        </p>
        <p style={{ fontFamily: PRINT_FONT, fontSize: '10.5pt', fontWeight: 'bold', margin: '0', color: PRINT_INK }}>
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
            <button onClick={() => navigate('/history')} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#444', fontWeight:'600', fontSize:'13px', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', whiteSpace:'nowrap' }}>
              <FiArrowLeft size={15} /> Back to History
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
                <button onClick={handleDownloadPDF} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 18px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#C43078,#B42B6A)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}>
                  <FiDownload size={14} /> Download PDF
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsEditing(false); setDragMode(false); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#6B5E63', fontWeight:'600', fontSize:'13px', cursor:'pointer' }}>
                  <FiXCircle size={14} /> Cancel
                </button>
                <button onClick={async () => { await handleDownloadPDF(); setIsEditing(false); setDragMode(false); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 18px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#B42B6A,#9A2259)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}>
                  <FiSave size={14} /> Save &amp; Download PDF
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

        {/* Row 3 — print-dialog guidance so the saved PDF keeps this exact alignment */}
        <div style={{ textAlign:'center', marginTop:'8px', fontSize:'11px', color:'#9B8F94', fontWeight:'600' }}>
          Downloads directly as a high-quality PDF.
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
            {/* Undo / Redo */}
            <button title="Undo (Ctrl+Z)" style={TB} onMouseDown={e=>{e.preventDefault();handleUndo();}} onMouseEnter={tbHov} onMouseLeave={tbLv}><FiRotateCcw size={13}/></button>
            <button title="Redo (Ctrl+Y)" style={TB} onMouseDown={e=>{e.preventDefault();handleRedo();}} onMouseEnter={tbHov} onMouseLeave={tbLv}><FiRotateCw size={13}/></button>
            <Sep />
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
      <div 
        ref={printRef} 
        className="print-ref-inner" 
        style={{ 
          position: 'relative', 
          width: '210mm', 
          height: isExportingPDF ? `${(isElective && electiveSubjects.length > 0 ? 2 : 1) * 296}mm` : 'auto',
          overflow: isExportingPDF ? 'hidden' : 'visible',
          zoom: pageScale, 
          margin: '0 auto' 
        }}
      >
      <div
        ref={hallOutputRef}
        className="hall-plan-output bg-white"
        contentEditable={isEditing && !isExportingPDF}
        suppressContentEditableWarning={true}
        style={{
          color: PRINT_INK,
          fontFamily: PRINT_FONT,
          outline: 'none',
          cursor: dragMode ? 'grab' : 'text',
        }}
      >
      <div
        className="single-page-fit"
        style={{
          width: '210mm',
          height: isExportingPDF ? '296mm' : '297mm',
          boxSizing: 'border-box',
          background: 'white',
          boxShadow: isExportingPDF 
            ? 'none' 
            : (isEditing ? '0 0 0 2px #B42B6A, 0 8px 40px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.12)'),
          borderRadius: isExportingPDF ? '0' : '4px',
          overflow: 'hidden',
          marginBottom: isExportingPDF ? '0' : '16px',
          position: 'relative',
        }}
      >
        <div className="page-inner" style={{ padding: '18mm 28mm', boxSizing: 'border-box' }}>
        {/* Page 1 Header */}
        <PageHeader subtitle={`HALL PLAN - CSE (${allocation.academicYear}) ${allocation.semesterType}`} />

        {/* Sub-header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: PRINT_FONT, fontSize: '11pt', fontWeight: 'bold', marginBottom: '14px', padding: '0 2px 10px', borderBottom: `1.5px solid ${PRINT_INK}` }}>
          <span>{allocation.yearSemester}</span>
          <span>Session: {allocation.session}</span>
          <span>DATE: {formatDate(allocation.fromDate)}{allocation.toDate && allocation.toDate !== allocation.fromDate ? ` to ${formatDate(allocation.toDate)}` : ''}</span>
        </div>

        {/* Main Allocation Table */}
        <table style={{ width: '90%', margin: '0 auto 28px', borderCollapse: 'collapse', border: `1px solid ${PRINT_INK}` }}>
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

        {/* Examination Timings Container */}
        <div style={{ width: '52%', margin: '0 auto 12px auto' }}>
          <p style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', marginBottom: '8px', textAlign: 'left' }}>
            Examination Timings:
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${PRINT_INK}` }}>
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
        </div>

        {/* Signatures Page 1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%', margin: '56px auto 0', padding: '0', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', width: '180px' }}>
            Exam Cell In-charge
          </div>
          <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', width: '180px' }}>
            HOD-CSE
          </div>
        </div>



        </div>{/* end page-inner Page1 */}
        </div>{/* end single-page-fit Page1 */}

        {/* ========== ELECTIVE PAGES ========== */}
        {isElective && electiveSubjects.length > 0 && (
          <div
            className="single-page-fit"
            style={{
              width: '210mm',
              height: isExportingPDF ? '296mm' : '297mm',
              boxSizing: 'border-box',
              background: 'white',
              boxShadow: isExportingPDF
                ? 'none'
                : (isEditing ? '0 0 0 2px #B42B6A, 0 8px 40px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.12)'),
              borderRadius: isExportingPDF ? '0' : '4px',
              overflow: 'hidden',
              pageBreakBefore: 'always',
              breakBefore: 'page',
              position: 'relative',
            }}
          >
            <div className="page-inner" style={{ padding: '18mm 28mm', boxSizing: 'border-box' }}>
            <PageHeader subtitle={`ELECTIVE SUBJECT DETAILS - CSE (${allocation.academicYear}) ${allocation.semesterType}`} />

            <p style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase', textAlign: 'center', margin: '10px 0 6px' }}>
              Section Wise Elective Count
            </p>
            <table style={{ width: '90%', margin: '0 auto 12px', borderCollapse: 'collapse', border: `1px solid ${PRINT_INK}` }}>
              <thead>
                <tr>
                  <th style={electiveSecThStyle}>Section</th>
                  {electiveSubjects.map(el => <th key={el} style={electiveSecThStyle}>{el}</th>)}
                  <th style={electiveSecThStyle}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {detectedSections.map(sec => {
                  const counts = sectionElectiveCounts[sec] || {};
                  const sectionStudentCount = sectionStrengthMap[sec] || 0;
                  return (
                    <tr key={sec}>
                      <td style={{ ...electiveSecTdStyle, fontWeight: 'bold' }}>{sec}-Sec</td>
                      {electiveSubjects.map(el => <td key={el} style={electiveSecTdStyle}>{counts[el] || 0}</td>)}
                      <td style={{ ...electiveSecTdStyle, fontWeight: 'bold' }}>{sectionStudentCount}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <td style={{ ...electiveSecTdStyle, fontWeight: 'bold' }}>TOTAL</td>
                  {electiveSubjects.map(el => {
                    const colTotal = detectedSections.reduce((sum, sec) => sum + ((sectionElectiveCounts[sec] || {})[el] || 0), 0);
                    return <td key={el} style={{ ...electiveSecTdStyle, fontWeight: 'bold' }}>{colTotal}</td>;
                  })}
                  <td style={{ ...electiveSecTdStyle, fontWeight: 'bold' }}>{allocation.totalStrength}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase', textAlign: 'center', margin: '10px 0 6px' }}>
              Hall Wise Elective Count
            </p>
            <table style={{ width: '90%', margin: '0 auto 12px', borderCollapse: 'collapse', border: `1px solid ${PRINT_INK}` }}>
              <thead>
                <tr>
                  <th style={electiveHallThStyle}>Hall No</th>
                  {electiveSubjects.map(el => <th key={el} style={electiveHallThStyle}>{el}</th>)}
                  <th style={electiveHallThStyle}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {allocation.hallAllocations.map(hall => {
                  const counts = hallSubjectCounts[hall.hallName] || {};
                  return (
                    <tr key={hall.hallName}>
                      <td style={{ ...electiveHallTdStyle, fontWeight: 'bold' }}>{hall.hallName}</td>
                      {electiveSubjects.map(el => <td key={el} style={electiveHallTdStyle}>{counts[el] || 0}</td>)}
                      <td style={{ ...electiveHallTdStyle, fontWeight: 'bold' }}>{hall.totalInHall}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <td style={{ ...electiveHallTdStyle, fontWeight: 'bold' }}>TOTAL</td>
                  {electiveSubjects.map(el => {
                    const colTotal = allocation.hallAllocations.reduce((sum, hall) => sum + ((hallSubjectCounts[hall.hallName] || {})[el] || 0), 0);
                    return <td key={el} style={{ ...electiveHallTdStyle, fontWeight: 'bold' }}>{colTotal}</td>;
                  })}
                  <td style={{ ...electiveHallTdStyle, fontWeight: 'bold' }}>{allocation.totalStrength}</td>
                </tr>
              </tbody>
            </table>

            {/* Final Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%', margin: '56px auto 0', padding: '0', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', width: '180px' }}>
                Exam Cell In-charge
              </div>
              <div style={{ textAlign: 'center', fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', width: '180px' }}>
                HOD-CSE
              </div>
            </div>



            </div>{/* end page-inner Elective */}
          </div>
        )}
      </div>

      {/* ── Floating text boxes ── */}
      {textBoxes.map(tb => (
        <div key={tb.id} data-textbox="1" style={{ position:'absolute',left:tb.x,top:tb.y,minWidth:'120px',minHeight:'32px',border:(isEditing && !isExportingPDF)?'1.5px dashed #B42B6A':'none',background:'white',zIndex:20,borderRadius:'3px',boxShadow:(isEditing && !isExportingPDF)?'0 2px 10px rgba(180,43,106,0.18)':'none',cursor:isEditing?'move':'default' }}
          onMouseDown={e=>{if(!isEditing)return;e.stopPropagation();startDrag(e,tb);}}>
          {isEditing && !isExportingPDF && (
            <button className="no-print" onClick={e=>{e.stopPropagation();setTextBoxes(prev=>{undoStack.current.push(prev);redoStack.current=[];return prev.filter(t=>t.id!==tb.id);});}} onMouseDown={e=>e.stopPropagation()}
              style={{position:'absolute',top:-10,right:-10,width:20,height:20,borderRadius:'50%',border:'none',background:'#B42B6A',color:'white',fontSize:'14px',lineHeight:1,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.25)'}}>×</button>
          )}
          <div contentEditable={isEditing ? 'true' : 'false'} suppressContentEditableWarning={true}
            onMouseDown={e=>e.stopPropagation()}
            onBlur={e=>{const h=e.currentTarget.innerHTML;setTextBoxes(p=>p.map(t=>t.id===tb.id?{...t,html:h}:t));}}
            dangerouslySetInnerHTML={{ __html: tb.html || '' }}
            style={{padding:'6px 10px',minHeight:'28px',fontFamily:PRINT_FONT,fontSize:'10pt',fontWeight:'bold',outline:'none',cursor:'text',whiteSpace:'pre-wrap'}}
          />
        </div>
      ))}
      </div>{/* end printRef wrapper */}
      </div>{/* end print-page-outer */}

      <style>{`
        .single-page-fit {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: always;
          break-after: page;
        }
        .single-page-fit:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .single-page-fit > .page-inner {
          width: 100%;
          height: 100%;
        }
        /* Tables inside auto-fit pages must NOT split */
        .single-page-fit table,
        .single-page-fit tr,
        .single-page-fit thead,
        .single-page-fit tbody {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
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
          .print-ref-inner {
            zoom: 1 !important;
            margin: 0 !important;
            width: 210mm !important;
          }
          .hall-plan-output {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            font-size: 100% !important;
          }
          .single-page-fit {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 296mm !important;
            overflow: hidden !important;
          }
          [data-textbox] {
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HallPlanPrint;
