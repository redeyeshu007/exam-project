import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import StepResult from './StepResult';
import { FiArrowLeft } from 'react-icons/fi';

const AllocationResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllocation = async () => {
      try {
        const res = await api.get(`/allocations/${id}`);
        setAllocation(res.data);
      } catch (err) {
        toast.error('Failed to load allocation details');
        navigate('/history');
      } finally {
        setLoading(false);
      }
    };
    fetchAllocation();
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!allocation) return null;

  return (
    <div className="compact-view page-enter">
      <div className="mb-3">
        <button className="btn-secondary" onClick={() => navigate('/history')}>
          <FiArrowLeft size={14} /> Back to History
        </button>
      </div>
      
      <div className="step-content-area" style={{ flex: 'none', padding: 'clamp(12px, 4vw, 2rem)' }}>
        <StepResult
          allocation={allocation}
        />
      </div>
    </div>
  );
};

export default AllocationResult;
