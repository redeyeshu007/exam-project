import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import StepExamDetails from './StepExamDetails';
import StepSections from './StepSections';
import StepFileUpload from './StepFileUpload';
import StepHallSelect from './StepHallSelect';
import StepResult from './StepResult';
import api from '../services/api';

const AllocationWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Edit mode: when History redirects here with an existing allocation,
  // prefill all fields and remember the source id so we can replace it.
  const editAllocation = location.state?.editAllocation || null;
  const [editingId, setEditingId] = useState(editAllocation?._id || null);

  const buildInitialForm = () => {
    if (!editAllocation) {
      return {
        examName: '', academicYear: '', year: '', semester: '',
        semesterType: '', yearSemester: '', session: '', sessionTime: '',
        fromDate: '', toDate: '',
        sections: [], halls: [],
        studentData: null, electiveSubjects: null, sectionElectiveCounts: null,
        hasElectives: false,
      };
    }
    const fromDate = editAllocation.fromDate ? String(editAllocation.fromDate).split('T')[0] : '';
    const toDate   = editAllocation.toDate   ? String(editAllocation.toDate).split('T')[0]   : '';
    // Reconstruct halls list with capacity for StepHallSelect prefill.
    const halls = (editAllocation.hallAllocations || []).map(h => ({
      hallName: h.hallName,
      capacity: h.totalInHall,
    }));
    return {
      examName:      editAllocation.examName      || '',
      academicYear:  editAllocation.academicYear  || '',
      year:          editAllocation.year          || '',
      semester:      editAllocation.semester      || '',
      semesterType:  editAllocation.semesterType  || '',
      yearSemester:  editAllocation.yearSemester  || '',
      session:       editAllocation.session       || '',
      sessionTime:   editAllocation.sessionTime   || '',
      fromDate, toDate,
      sections: editAllocation.sections || [],
      halls,
      studentData:           editAllocation.studentData           || null,
      electiveSubjects:      editAllocation.electiveSubjects      || null,
      sectionElectiveCounts: editAllocation.sectionElectiveCounts || null,
      hasElectives:          !!editAllocation.hasElectives,
    };
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState('forward');
  const [submitting, setSubmitting] = useState(false);
  const [allocation, setAllocation] = useState(null);
  const [electiveEnabled, setElectiveEnabled] = useState(!!editAllocation?.hasElectives);

  const [formData, setFormData] = useState(buildInitialForm);

  // Determine if electives are active:
  // - III/IV year: always elective
  // - I/II year: only if user explicitly enabled
  const isElectiveYear = formData.year === 'III' || formData.year === 'IV'
    || ((formData.year === 'I' || formData.year === 'II') && electiveEnabled);

  // Dynamic steps based on year selection
  // I/II Year:  4 steps → Exam Details → Sections → Halls → Result
  // III/IV Year: 5 steps → Exam Details → File Upload → Sections → Halls → Result
  const steps = useMemo(() => {
    if (isElectiveYear) {
      return [
        { num: 1, label: 'Exam Details' },
        { num: 2, label: 'File Upload' },
        { num: 3, label: 'Sections' },
        { num: 4, label: 'Select Halls' },
        { num: 5, label: 'Result' }
      ];
    }
    return [
      { num: 1, label: 'Exam Details' },
      { num: 2, label: 'Sections' },
      { num: 3, label: 'Select Halls' },
      { num: 4, label: 'Result' }
    ];
  }, [isElectiveYear]);

  const hallStep = isElectiveYear ? 4 : 3;
  const resultStep = isElectiveYear ? 5 : 4;

  // On entering edit mode, start at Step 1 (Exam Details) with everything
  // pre-filled, so the user can resume the allocation step-by-step.
  useEffect(() => {
    if (!editAllocation) return;
    setCurrentStep(1);
    // Clear router state so a page refresh doesn't re-enter edit mode,
    // but keep formData/editingId in component state across step changes.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalStudents = formData.sections.reduce((acc, curr) => acc + (parseInt(curr.strength) || 0), 0);
  const totalCapacity = formData.halls.reduce((acc, curr) => acc + (parseInt(curr.capacity) || 0), 0);

  const validateStep1 = () => {
    const { examName, academicYear, semesterType, yearSemester, session, sessionTime, fromDate, toDate } = formData;
    if (!examName || !academicYear || !semesterType || !yearSemester || !session || !sessionTime || !fromDate || !toDate) {
      toast.error('Please fill all fields and select dates');
      return false;
    }
    return true;
  };

  const validateFileUpload = () => {
    if (!formData.studentData || formData.studentData.length === 0) {
      toast.error('Please upload a student data file first');
      return false;
    }
    if (!formData.electiveSubjects || formData.electiveSubjects.length === 0) {
      toast.error('No elective subjects found in the uploaded file');
      return false;
    }
    return true;
  };

  const validateSections = () => {
    if (formData.sections.length === 0) {
      toast.error('Please select at least one section');
      return false;
    }
    for (const sec of formData.sections) {
      if (!sec.strength || parseInt(sec.strength) <= 0) {
        toast.error(`Please enter a valid strength for Section ${sec.name}`);
        return false;
      }
    }
    return true;
  };

  const validateHalls = () => {
    if (formData.halls.length === 0) {
      toast.error('Please select at least one hall');
      return false;
    }
    for (const hall of formData.halls) {
      if (!hall.capacity || parseInt(hall.capacity) <= 0) {
        toast.error(`Please enter a valid capacity for ${hall.hallName}`);
        return false;
      }
    }
    if (totalCapacity < totalStudents) {
      toast.error(`Insufficient capacity. Need ${totalStudents - totalCapacity} more seats.`);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    // Validate current step before moving
    if (currentStep === 1 && !validateStep1()) return;

    if (isElectiveYear) {
      // 5-step flow: 1=Exam, 2=FileUpload, 3=Sections, 4=Halls, 5=Result
      if (currentStep === 2 && !validateFileUpload()) return;
      if (currentStep === 3 && !validateSections()) return;
    } else {
      // 4-step flow: 1=Exam, 2=Sections, 3=Halls, 4=Result
      if (currentStep === 2 && !validateSections()) return;
    }

    setDirection('forward');
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setDirection('backward');
    setCurrentStep(prev => prev - 1);
  };

  const handleAllocate = async () => {
    if (!validateHalls()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        block: 'CSE Block',
        totalStrength: totalStudents,
        hasElectives: isElectiveYear,
      };

      // Clean payload for non-elective years
      if (!isElectiveYear) {
        delete payload.studentData;
        delete payload.electiveSubjects;
        delete payload.sectionElectiveCounts;
      }

      const res = await api.post('/allocations', payload);
      // If editing an existing allocation, remove the old record so the
      // updated one replaces it cleanly in the history list.
      if (editingId) {
        try { await api.delete(`/allocations/${editingId}`); } catch { /* non-fatal */ }
        setEditingId(null);
      }
      toast.success(editingId ? 'Allocation updated!' : 'Allocation successful!');
      setAllocation(res.data);
      setDirection('forward');

      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      if (isMobile && res.data?._id) {
        navigate(`/print/${res.data._id}`);
      } else {
        setCurrentStep(resultStep);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating allocation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModify = () => {
    setDirection('backward');
    setCurrentStep(hallStep);
    setAllocation(null);
  };

  const stepAnimation = direction === 'forward' ? 'step-forward' : 'step-backward';

  // Determine what to render for current step
  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <StepExamDetails
          formData={formData}
          setFormData={setFormData}
          electiveEnabled={electiveEnabled}
          setElectiveEnabled={setElectiveEnabled}
        />
      );
    }

    if (isElectiveYear) {
      // 5-step: 1=Exam, 2=FileUpload, 3=Sections, 4=Halls, 5=Result
      if (currentStep === 2) return <StepFileUpload formData={formData} setFormData={setFormData} />;
      if (currentStep === 3) return <StepSections formData={formData} setFormData={setFormData} />;
      if (currentStep === 4) return <StepHallSelect formData={formData} setFormData={setFormData} totalStudents={totalStudents} />;
      if (currentStep === 5) return <StepResult allocation={allocation} onModify={handleModify} formData={formData} />;
    } else {
      // 4-step: 1=Exam, 2=Sections, 3=Halls, 4=Result
      if (currentStep === 2) return <StepSections formData={formData} setFormData={setFormData} />;
      if (currentStep === 3) return <StepHallSelect formData={formData} setFormData={setFormData} totalStudents={totalStudents} />;
      if (currentStep === 4) return <StepResult allocation={allocation} onModify={handleModify} formData={formData} />;
    }
    return null;
  };

  return (
    <div className="viewport-wrapper">
      <div className="compact-view page-enter">
        <div className="wizard-container">

          {/* ── Edit-mode banner ── */}
          {editingId && (
            <div style={{
              background: 'linear-gradient(135deg, #FDF2F7, #FEF7FB)',
              border: '1px solid rgba(180,43,106,0.3)',
              borderRadius: '12px',
              padding: '8px 14px',
              marginBottom: '14px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#B42B6A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#B42B6A', display: 'inline-block',
              }} />
              Editing existing allocation — pre-filled below. Continue through each step to update.
            </div>
          )}

          {/* ── Step Indicator ── */}
          <div className="wizard-steps-bar mb-4">
            {steps.map((step, idx) => {
              const isActiveStep = currentStep === step.num;
              const isCompleted  = currentStep > step.num;
              const isLast       = idx === steps.length - 1;

              return (
                <div key={step.num} className="wizard-step-unit" style={{ flex: isLast ? '0 0 auto' : 1 }}>

                  {/* Node: ring wrapper + label below */}
                  <div className="wizard-step-node">
                    {/* ring-wrapper holds outer ring + inner circle, both centred */}
                    <div className="step-ring-wrap">
                      {/* Outer pale ring — only shown when active */}
                      {isActiveStep && (
                        <div className="step-outer-ring step-outer-ring--active" />
                      )}
                      {/* Inner solid circle */}
                      <div className={
                        isCompleted  ? 'step-inner-circle step-inner-circle--done'
                        : isActiveStep ? 'step-inner-circle step-inner-circle--active'
                        : 'step-inner-circle step-inner-circle--pending'
                      }>
                        {isCompleted
                          ? <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          : <span>{step.num}</span>
                        }
                      </div>
                    </div>

                    {/* Label below */}
                    <span className={
                      'wizard-step-label d-none d-md-block '
                      + (isActiveStep ? 'wizard-step-label--active' : isCompleted ? 'wizard-step-label--done' : '')
                    }>
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line between nodes */}
                  {!isLast && (
                    <div className="wizard-step-line">
                      <div className="wizard-step-line-fill" style={{ width: isCompleted ? '100%' : '0%' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="step-content-area w-100" key={currentStep}>
            <div className={stepAnimation}>
              {renderStepContent()}
            </div>
          </div>

          {/* Actions — hidden on result step */}
          {currentStep < resultStep && (
            <div className="form-actions w-100">
              {currentStep > 1 ? (
                <button className="btn-secondary" onClick={handleBack}>
                  ← Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < hallStep ? (
                <button className="btn-primary" onClick={handleNext}>
                  Next →
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleAllocate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="btn-spinner" />
                      Allocating...
                    </>
                  ) : (
                    'Allocate'
                  )}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AllocationWizard;
