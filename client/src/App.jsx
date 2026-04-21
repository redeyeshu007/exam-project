import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AllocationWizard from './components/AllocationWizard';
import AllocationResult from './components/AllocationResult';
import HallPlanPrint from './components/HallPlanPrint';
import History from './components/History';
import Home from './components/Home';
import AttendancePage from './components/AttendancePage';
import AttendancePrint from './components/AttendancePrint';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const App = () => {
  return (
    <Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/allocate" element={
          <ProtectedRoute>
            <div className="app-layout">
              <Navbar />
              <div className="main-content page-enter">
                <AllocationWizard />
              </div>
              <Footer />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/result/:id" element={
          <ProtectedRoute>
            <div className="app-layout">
              <Navbar />
              <div className="main-content page-enter">
                <AllocationResult />
              </div>
              <Footer />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/print/:id" element={
          <ProtectedRoute>
            <HallPlanPrint />
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute>
            <div className="app-layout">
              <Navbar />
              <div className="main-content page-enter">
                <History />
              </div>
              <Footer />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/home" element={
          <ProtectedRoute>
            <div className="app-layout">
              <Navbar />
              <div className="main-content page-enter">
                <Home />
              </div>
              <Footer />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/attendance" element={
          <ProtectedRoute>
            <div className="app-layout">
              <Navbar />
              <div className="main-content page-enter">
                <AttendancePage />
              </div>
              <Footer />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/attendance-print/:id" element={
          <ProtectedRoute>
            <AttendancePrint />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
