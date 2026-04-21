import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { FiUploadCloud, FiFile, FiX, FiCheckCircle } from 'react-icons/fi';

/**
 * Loosely normalize a string for comparison only (not for display).
 * Strips all spaces, dashes, underscores, &, /, dots and uppercases —
 * so "UI-UX", "UIUX", "ui ux", "UI / UX" all become "UIUX".
 */
const looseNorm = (raw) => {
  return (raw || '').toUpperCase().replace(/[\s\-_&\/\.]+/g, '');
};

/**
 * Build a per-column lookup from a single column header string.
 * e.g. "AD/IP/BDA" → { AD: "AD", IP: "IP", BDA: "BDA" }
 * Keys are looseNorm'd so fuzzy cell values can match canonical names.
 */
const buildColumnLookup = (header) => {
  const lookup = {};
  header.split('/').forEach(part => {
    const canonical = part.trim();
    if (canonical) lookup[looseNorm(canonical)] = canonical;
  });
  return lookup;
};

/**
 * Resolve a raw cell value to a canonical elective name.
 * Only matches against valid options for THIS specific column (lookup).
 * Returns '' if the value doesn't match any valid option — prevents
 * cross-group contamination and garbage entries from typos.
 */
const resolveElective = (raw, columnLookup) => {
  const s = (raw || '').trim();
  if (!s) return '';
  const key = looseNorm(s);
  return columnLookup[key] || '';
};

const StepFileUpload = ({ formData, setFormData, onDataParsed }) => {
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const fileInputRef = useRef();

  /**
   * Detect column types from headers.
   * Known columns: Roll No, Register Number, Name of the Student, Section
   * Elective group columns: any header containing "/" (e.g. AD/IP/BDA, FDM/RSC/WC)
   */
  const classifyColumns = (headers) => {
    const result = {
      rollNo: null,         // serial "Roll No"
      registerNumber: null, // "Register Number"
      studentName: null,    // "Name of the Student"
      section: null,        // "Section"
      electiveGroups: []    // columns with "/" like "AD/IP/BDA"
    };

    headers.forEach(h => {
      const raw = (h || '').toString().trim();
      const lower = raw.toLowerCase().replace(/\s+/g, ' ');

      // Check for elective group columns (contain "/")
      if (raw.includes('/')) {
        result.electiveGroups.push(raw);
        return;
      }

      // Skip filter/separator columns (like ≡ or single special chars)
      if (raw.length <= 2 && !/[a-zA-Z0-9]/.test(raw)) return;

      if (lower === 'roll no' || lower === 'rollno' || lower === 'roll no.' || lower === 's.no' || lower === 'sno' || lower === 'sl no' || lower === 's no') {
        result.rollNo = raw;
      } else if (lower.includes('register') || lower.includes('reg no') || lower.includes('reg. no') || lower.includes('enrollment')) {
        result.registerNumber = raw;
      } else if (lower.includes('name of the student') || lower.includes('student name') || lower.includes('name')) {
        result.studentName = raw;
      } else if (lower === 'section' || lower === 'sec' || lower === 'sec.') {
        result.section = raw;
      }
    });

    return result;
  };

  const parseExcel = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (jsonData.length === 0) {
            reject(new Error('No data found in file'));
            return;
          }

          const headers = Object.keys(jsonData[0]);
          const columns = classifyColumns(headers);

          // Determine which column to use as roll/register number
          const rollCol = columns.registerNumber || columns.rollNo;
          if (!rollCol) {
            reject(new Error('Could not find "Register Number" or "Roll No" column. Found headers: ' + headers.join(', ')));
            return;
          }
          if (!columns.section) {
            reject(new Error('Could not find "Section" column. Found headers: ' + headers.join(', ')));
            return;
          }
          if (columns.electiveGroups.length === 0) {
            reject(new Error('Could not find any elective columns (headers with "/" like AD/IP/BDA). Found headers: ' + headers.join(', ')));
            return;
          }

          // Build a per-column lookup so each column only resolves against its own valid options.
          // e.g. "UI-UX/TSA" → { UIUX: "UI-UX", TSA: "TSA" }
          const perColumnLookup = {};
          columns.electiveGroups.forEach(header => {
            perColumnLookup[header] = buildColumnLookup(header);
          });

          // Parse students with multiple electives
          const students = [];
          jsonData.forEach(row => {
            const rollNumber = String(row[rollCol] || '').trim();
            const studentName = columns.studentName ? String(row[columns.studentName] || '').trim() : '';
            const section = String(row[columns.section] || '').trim().toUpperCase();

            if (!rollNumber || !section) return;

            // Collect electives from all group columns — each resolved only against that column's valid options
            const electives = [];
            columns.electiveGroups.forEach(groupCol => {
              const val = resolveElective(String(row[groupCol] || ''), perColumnLookup[groupCol]);
              if (val) electives.push(val);
            });

            if (electives.length === 0) return;

            students.push({
              rollNumber,
              studentName,
              section,
              electives // array of chosen electives, one per group
            });
          });

          if (students.length === 0) {
            reject(new Error('No valid student records found after parsing.'));
            return;
          }

          resolve({ students, electiveGroups: columns.electiveGroups });
        } catch (err) {
          reject(new Error('Failed to parse Excel file: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const parsePDF = useCallback(async (file) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        allText += pageText + '\n';
      }

      const lines = allText.split('\n').filter(l => l.trim());
      const students = [];

      for (const line of lines) {
        // Match: RegisterNumber Name Section Elective1 Elective2 ...
        const match = line.match(/(\d{10,})\s+(.+?)\s+([A-Z])\s+(.+)\s*$/);
        if (match) {
          const electivesPart = match[4].trim().split(/\s+/);
          students.push({
            rollNumber: match[1].trim(),
            studentName: match[2].trim(),
            section: match[3].trim().toUpperCase(),
            electives: electivesPart.map(e => e.toUpperCase())
          });
        }
      }

      if (students.length === 0) {
        throw new Error('Could not extract student data from PDF. Please try uploading an Excel file (.xlsx) instead.');
      }

      return { students, electiveGroups: [] };
    } catch (err) {
      if (err.message.includes('Could not extract')) throw err;
      throw new Error('Failed to parse PDF: ' + err.message + '. Please try an Excel file (.xlsx) instead.');
    }
  }, []);

  const processFile = useCallback(async (file) => {
    setProcessing(true);
    setParseResult(null);

    try {
      let parseData;
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        parseData = await parseExcel(file);
      } else if (ext === 'pdf') {
        parseData = await parsePDF(file);
      } else {
        throw new Error('Unsupported file type. Please use .xlsx, .xls, or .pdf');
      }

      const { students, electiveGroups } = parseData;

      // Analyze the data
      const sections = [...new Set(students.map(s => s.section))].sort();

      // Extract canonical elective names from column headers — these are the ground truth.
      // e.g. "AD/IP/BDA", "FDM/RSC/WC", "UI-UX/TSA", "SDN/RET"
      //   → ["AD", "IP", "BDA", "FDM", "RSC", "WC", "UI-UX", "TSA", "SDN", "RET"]
      const electives = [];
      electiveGroups.forEach(header => {
        header.split('/').forEach(part => {
          const canonical = part.trim();
          if (canonical && !electives.includes(canonical)) electives.push(canonical);
        });
      });

      // Build section-wise elective counts
      const sectionElectiveCounts = {};
      sections.forEach(sec => {
        sectionElectiveCounts[sec] = {};
        electives.forEach(el => {
          sectionElectiveCounts[sec][el] = 0;
        });
      });

      students.forEach(s => {
        s.electives.forEach(el => {
          if (sectionElectiveCounts[s.section] && sectionElectiveCounts[s.section][el] !== undefined) {
            sectionElectiveCounts[s.section][el]++;
          }
        });
      });

      const result = {
        students,
        sections,
        electives,
        electiveGroups,
        sectionElectiveCounts,
        totalStudents: students.length
      };

      setParseResult(result);

      // Update formData
      const sectionData = sections.map(sec => ({
        name: sec,
        strength: students.filter(s => s.section === sec).length
      }));

      setFormData(prev => ({
        ...prev,
        sections: sectionData,
        studentData: students,
        electiveSubjects: electives,
        electiveGroups: electiveGroups,
        sectionElectiveCounts,
        hasElectives: true
      }));

      if (onDataParsed) onDataParsed(result);
      toast.success(`Successfully parsed ${students.length} students with ${electives.length} elective subjects!`);

    } catch (err) {
      toast.error(err.message);
      setParseResult(null);
    } finally {
      setProcessing(false);
    }
  }, [parseExcel, parsePDF, setFormData, onDataParsed]);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'pdf'].includes(ext)) {
      toast.error('Please upload .xlsx, .xls, or .pdf file');
      return;
    }
    setSelectedFile(file);
    processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  const clearFile = () => {
    setSelectedFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormData(prev => ({
      ...prev,
      studentData: null,
      electiveSubjects: null,
      electiveGroups: null,
      sectionElectiveCounts: null,
      hasElectives: false,
      sections: []
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="step-content p-4 bg-white rounded-4 shadow-sm border" style={{ borderColor: '#E8E2E5' }}>
      <p className="text-muted mb-4" style={{ fontSize: '14px' }}>
        Upload your student data file to auto-extract sections and elective subjects.
      </p>

      {/* Upload Zone */}
      {!selectedFile && (
        <div
          className={`file-upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon">
            <FiUploadCloud size={48} />
          </div>
          <div className="upload-text">
            Drag & Drop your file here
          </div>
          <div className="upload-hint">
            or click to browse
          </div>
          <div className="upload-hint mt-2" style={{ fontSize: '0.75rem' }}>
            Supported: <strong>.xlsx, .xls, .pdf</strong>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.pdf"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="file-preview-card">
          <div className="file-icon">
            <FiFile />
          </div>
          <div className="file-info">
            <div className="file-name">{selectedFile.name}</div>
            <div className="file-size">{formatFileSize(selectedFile.size)}</div>
          </div>
          <button
            className="btn btn-sm btn-outline-danger rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: '32px', height: '32px' }}
            onClick={clearFile}
            title="Remove file"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Processing Indicator */}
      {processing && (
        <div className="mt-4">
          <div className="processing-shimmer mb-3"></div>
          <p className="text-center text-muted" style={{ fontSize: '14px' }}>
            ⏳ Processing file...
          </p>
        </div>
      )}

      {/* Parse Result Summary */}
      {parseResult && !processing && (
        <div className="upload-summary mt-4">
          <div className="summary-header">
            <FiCheckCircle size={22} />
            FILE UPLOADED SUCCESSFULLY
          </div>

          <div className="stat-row">
            <span className="stat-icon">📊</span>
            Total Students Found: <span className="stat-value ms-1">{parseResult.totalStudents}</span>
          </div>

          <div className="stat-row">
            <span className="stat-icon">📚</span>
            Sections Detected: <span className="stat-value ms-1">{parseResult.sections.join(', ')}</span>
          </div>

          {/* Elective Groups */}
          {parseResult.electiveGroups && parseResult.electiveGroups.length > 0 && (
            <div className="stat-row">
              <span className="stat-icon">📂</span>
              Elective Groups: <span className="stat-value ms-1">{parseResult.electiveGroups.length}</span>
              <span className="text-muted ms-2" style={{ fontSize: '0.8rem' }}>
                ({parseResult.electiveGroups.join(' | ')})
              </span>
            </div>
          )}

          <div className="stat-row mb-2">
            <span className="stat-icon">📝</span>
            All Electives Found:
          </div>
          <div className="d-flex flex-wrap gap-1 ms-4">
            {parseResult.electives.map(el => (
              <span key={el} className="elective-chip">{el}</span>
            ))}
          </div>

          {/* Section Breakdown */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #BBF7D0' }}>
            <div className="stat-row mb-2">
              <span className="stat-icon">📋</span>
              <strong>Section Breakdown:</strong>
            </div>
            {parseResult.sections.map(sec => {
              const count = parseResult.students.filter(s => s.section === sec).length;
              return (
                <div key={sec} className="d-flex justify-content-between align-items-center px-4 py-1">
                  <span className="mono fw-bold" style={{ fontSize: '13px' }}>Section {sec}</span>
                  <span className="fw-bold" style={{ color: '#B42B6A', fontSize: '14px' }}>{count} students</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Required Columns Info */}
      {!selectedFile && (
        <div className="mt-4 p-3 rounded-3 border" style={{ backgroundColor: '#FAFAFA', borderColor: '#E8E2E5' }}>
          <p className="fw-bold mb-2" style={{ fontSize: '13px', color: '#2D1F26' }}>
            📄 Expected File Structure:
          </p>
          <div className="d-flex flex-column gap-1" style={{ fontSize: '12px' }}>
            <div className="d-flex gap-3">
              <span className="mono fw-bold" style={{ color: '#B42B6A', minWidth: '160px' }}>Register Number</span>
              <span className="text-muted">e.g., 2303921310421002</span>
            </div>
            <div className="d-flex gap-3">
              <span className="mono fw-bold" style={{ color: '#B42B6A', minWidth: '160px' }}>Name of the Student</span>
              <span className="text-muted">e.g., AARON MARSHALL A</span>
            </div>
            <div className="d-flex gap-3">
              <span className="mono fw-bold" style={{ color: '#B42B6A', minWidth: '160px' }}>Section</span>
              <span className="text-muted">e.g., A, B, C, D</span>
            </div>
            <div className="d-flex gap-3 mt-1 pt-1" style={{ borderTop: '1px dashed #E8E2E5' }}>
              <span className="mono fw-bold" style={{ color: '#B42B6A', minWidth: '160px' }}>Elective Columns</span>
              <span className="text-muted">Headers with "/" → e.g., AD/IP/BDA, FDM/RSC/WC, UI-UX/TSA, SDN/RET</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepFileUpload;
