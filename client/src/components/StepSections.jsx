import { useEffect, useRef, useState } from 'react';
import { FiX, FiPlus, FiUploadCloud, FiFile, FiCheckCircle, FiChevronDown } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

const StepSections = ({ formData, setFormData }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview]       = useState(null); // { sections: [{name, strength}] }
  const fileInputRef = useRef();

  // Initialize with Section A if empty
  useEffect(() => {
    if (!formData.sections || formData.sections.length === 0) {
      setFormData(prev => ({
        ...prev,
        sections: [{ name: 'A', strength: '' }]
      }));
    }
  }, [formData.sections, setFormData]);

  const getNextSectionName = (sections) => {
    if (!sections || sections.length === 0) return 'A';
    let maxCode = 64;
    sections.forEach(s => {
      const code = s.name.charCodeAt(0);
      if (code > maxCode) maxCode = code;
    });
    return String.fromCharCode(maxCode + 1);
  };

  const handleAddSection = () => {
    const nextName = getNextSectionName(formData.sections);
    setFormData(prev => ({
      ...prev,
      sections: [...(prev.sections || []), { name: nextName, strength: '' }]
    }));
  };

  const handleDeleteSection = (name) => {
    if (formData.sections.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.name !== name)
    }));
  };

  const handleStrengthChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.name === name ? { ...s, strength: value ? parseInt(value) : '' } : s
      )
    }));
  };

  /* ── File parsing ── */
  const parseFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'pdf'].includes(ext)) {
      toast.error('Only .xlsx, .xls, or .pdf files are supported');
      return;
    }
    setProcessing(true);
    try {
      if (ext === 'pdf') {
        await parsePdf(file);
      } else {
        await parseExcel(file);
      }
    } catch (err) {
      toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const parseExcel = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Detect which column has section data
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        const sectionCol = headers.find(h =>
          /^(section|sec|sec\.|class)$/i.test(h.trim())
        );

        if (!sectionCol) {
          // Fallback: try to detect a 2-column file with section names + counts
          const twoCol = detect2ColSections(rows, headers);
          if (twoCol) { setPreview({ sections: twoCol }); resolve(); return; }
          toast.error('Could not find a "Section" column in the file');
          resolve();
          return;
        }

        // Count students per section
        const counts = {};
        rows.forEach(row => {
          const sec = (row[sectionCol] || '').toString().trim().toUpperCase();
          if (sec) counts[sec] = (counts[sec] || 0) + 1;
        });
        const sections = Object.entries(counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, strength]) => ({ name, strength }));

        if (sections.length === 0) {
          toast.error('No section data found in file');
          resolve();
          return;
        }
        setPreview({ sections });
        resolve();
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  // Heuristic: 2-column file where col1 = section letter/name, col2 = count
  const detect2ColSections = (rows, headers) => {
    if (headers.length < 2) return null;
    const [col1, col2] = headers;
    const sections = [];
    rows.forEach(row => {
      const name  = (row[col1] || '').toString().trim().toUpperCase();
      const count = parseInt(row[col2]);
      if (/^[A-Z]$/.test(name) && !isNaN(count) && count > 0) {
        sections.push({ name, strength: count });
      }
    });
    return sections.length > 0 ? sections : null;
  };

  const parsePdf = async (file) => {
    const { getDocument } = await import('pdfjs-dist');
    const buffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }

    // Try to find patterns like "Section A - 60" or "A: 60" or "A  60"
    const counts = {};
    const patterns = [
      /Section\s+([A-Z])\s*[-:–]\s*(\d+)/gi,
      /\b([A-Z])\s*[-:–]\s*(\d+)\s*students?/gi,
      /\bSec(?:tion)?\s*([A-Z])\b[^0-9]*(\d{1,3})/gi,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const sec = m[1].toUpperCase();
        counts[sec] = parseInt(m[2]);
      }
    }

    if (Object.keys(counts).length === 0) {
      toast.error('Could not extract section data from PDF. Try an Excel file instead.');
      return;
    }
    const sections = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, strength]) => ({ name, strength }));
    setPreview({ sections });
  };

  const applyPreview = (sections) => {
    setFormData(prev => ({ ...prev, sections }));
    setPreview(null);
    setShowUpload(false);
    toast.success(`${sections.length} section(s) imported successfully`);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const totalStrength = (formData.sections || []).reduce((acc, curr) => acc + (parseInt(curr.strength) || 0), 0);
  const sections = formData.sections || [];

  return (
    <div className="step-content p-4 bg-white rounded-4 shadow-sm border" style={{ borderColor: '#E8E2E5' }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <p className="text-muted m-0" style={{ fontSize: '14px' }}>
          Add sections and specify strength for each.
        </p>
        {/* Upload toggle button */}
        <button
          type="button"
          onClick={() => { setShowUpload(p => !p); setPreview(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '50px', border: '1.5px solid #E8E2E5',
            background: showUpload ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : 'white',
            color: showUpload ? 'white' : '#B42B6A',
            fontWeight: '700', fontSize: '12px', cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: showUpload ? '0 4px 14px rgba(180,43,106,0.3)' : 'none',
          }}
        >
          <FiUploadCloud size={14} />
          {showUpload ? 'Manual Entry' : 'Upload File'}
          <FiChevronDown size={12} style={{ transform: showUpload ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* ── File Upload Zone ── */}
      {showUpload && !preview && (
        <div style={{ marginBottom: '20px' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#B42B6A' : '#D4CDD0'}`,
              borderRadius: '14px',
              padding: '32px 20px',
              textAlign: 'center',
              background: dragOver ? 'rgba(180,43,106,0.04)' : '#FAFAFA',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {processing ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
                <div className="spinner-border" style={{ color:'#B42B6A', width:'28px', height:'28px' }} role="status" />
                <span style={{ fontSize:'13px', color:'#9B8F94', fontWeight:'600' }}>Parsing file…</span>
              </div>
            ) : (
              <>
                <FiUploadCloud size={32} color="#B42B6A" style={{ marginBottom:'10px' }} />
                <p style={{ fontWeight:'700', fontSize:'14px', color:'#1B0A12', margin:'0 0 4px' }}>
                  Drop file here or click to browse
                </p>
                <p style={{ fontSize:'12px', color:'#9B8F94', margin:0 }}>
                  Accepts .xlsx, .xls, .pdf — file should contain Section column with student rows
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            style={{ display:'none' }}
            onChange={e => { const f = e.target.files[0]; if (f) parseFile(f); e.target.value=''; }}
          />
        </div>
      )}

      {/* ── Preview Panel ── */}
      {preview && (
        <div style={{
          border: '1.5px solid rgba(180,43,106,0.3)',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '20px',
          background: 'linear-gradient(135deg,#FDF2F7 0%,#FEF7FB 100%)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
            <FiCheckCircle color="#B42B6A" size={16} />
            <span style={{ fontWeight:'700', fontSize:'13px', color:'#B42B6A' }}>
              {preview.sections.length} section(s) detected — review before applying
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px' }}>
            {preview.sections.map((sec, idx) => (
              <div key={sec.name} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontWeight:'700', fontSize:'13px', color:'#2D1F26', minWidth:'80px', fontFamily:"'JetBrains Mono',monospace" }}>
                  SECTION {sec.name}
                </span>
                <input
                  type="number"
                  min="1"
                  value={sec.strength}
                  onChange={e => {
                    const val = e.target.value ? parseInt(e.target.value) : '';
                    setPreview(prev => ({
                      ...prev,
                      sections: prev.sections.map((s, i) => i === idx ? { ...s, strength: val } : s)
                    }));
                  }}
                  style={{
                    width:'80px', padding:'6px 10px', borderRadius:'8px',
                    border:'1.5px solid rgba(180,43,106,0.25)', outline:'none',
                    fontWeight:'800', fontSize:'16px', color:'#B42B6A',
                    textAlign:'center', background:'white',
                  }}
                />
                <span style={{ fontSize:'12px', color:'#9B8F94' }}>students</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{ flex:1, padding:'9px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', color:'#6B5E63' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => applyPreview(preview.sections)}
              style={{ flex:2, padding:'9px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#B42B6A,#9A2259)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.3)' }}
            >
              Apply These Sections
            </button>
          </div>
        </div>
      )}

      {/* ── Manual Section Rows ── */}
      <div className="d-flex flex-column gap-3 mb-4">
        {sections.map((section) => (
          <div key={section.name} className="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border border-light">
            <span className="fw-bold" style={{ fontSize: '15px', color: '#2D1F26', fontFamily: "'JetBrains Mono', Consolas, monospace" }}>
              SECTION {section.name}
            </span>
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center gap-2 bg-white px-2 py-1 rounded border shadow-sm">
                <input
                  type="number"
                  className="form-control form-control-sm border-0 shadow-none text-center fw-bold"
                  style={{ width: '60px', backgroundColor: 'transparent', color: '#B42B6A' }}
                  value={section.strength || ''}
                  onChange={(e) => handleStrengthChange(section.name, e.target.value)}
                  min="1"
                  placeholder="0"
                  required
                />
                <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>students</span>
              </div>
              <button
                type="button"
                className={`btn btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center ${sections.length <= 1 ? 'btn-light text-muted' : 'btn-outline-danger'}`}
                onClick={() => handleDeleteSection(section.name)}
                disabled={sections.length <= 1}
                title="Delete Section"
                style={{ width: '32px', height: '32px' }}
              >
                <FiX size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-light w-100 fw-bold mb-4 d-flex align-items-center justify-content-center gap-2 py-3"
        onClick={handleAddSection}
        style={{ color: '#B42B6A', border: '2px dashed #D4CDD0' }}
      >
        <FiPlus size={18} /> Add Section
      </button>

      <div className="d-flex justify-content-between align-items-center p-3 rounded-3 mt-2" style={{ backgroundColor: '#FDF2F7', border: '1px solid #B42B6A' }}>
        <span className="fw-bold" style={{ color: '#1B0A12', letterSpacing: '0.5px' }}>TOTAL STUDENTS:</span>
        <span className="fw-bold fs-5" style={{ color: '#B42B6A' }}>{totalStrength}</span>
      </div>
    </div>
  );
};

export default StepSections;
