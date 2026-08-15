import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LazyMotion, domMax } from 'framer-motion';
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
import HallLayoutDesigner from './components/HallLayoutDesigner';
import SeatingAllotment from './components/SeatingAllotment';
import SeatingChart from './components/SeatingChart';
import Intro from './components/Intro';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsAndConditions from './components/TermsAndConditions';
import Contact from './components/Contact';

/* Page transitions removed — this now just renders its children directly.
   Kept as a passthrough (rather than deleted) so every route's JSX below
   is untouched. Route switches are instant; a lightweight top loading
   bar (RouteLoadingBar) gives feedback instead of an animated swap. */
const PageMotion = ({ children }) => children;

/* Slim top-of-viewport loading bar — flashes briefly on every route
   change so navigation still feels responsive without animating the
   whole page. Self-contained: doesn't wait on any page's data-fetch,
   just gives ~300ms of lightweight feedback while the next route mounts. */
const RouteLoadingBar = () => {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setActive(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), 300);
    return () => clearTimeout(timerRef.current);
  }, [location.pathname]);

  return <div className={`route-loading-bar${active ? ' active' : ''}`} aria-hidden="true" />;
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    <>
      <RouteLoadingBar />
      <Routes location={location} key={location.pathname}>
        <Route path="/"      element={<Intro />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy-policy"       element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/contact"              element={<Contact />} />

        <Route path="/allocate" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="main-content page-enter">
                  <AllocationWizard />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/result/:id" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="main-content page-enter">
                  <AllocationResult />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/print/:id" element={
          <ProtectedRoute>
            <HallPlanPrint />
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="main-content page-enter">
                  <History />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/home" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="main-content page-enter">
                  <Home />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/attendance" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="main-content page-enter">
                  <AttendancePage />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/attendance-print/:id" element={
          <ProtectedRoute>
            <AttendancePrint />
          </ProtectedRoute>
        } />

        <Route path="/hall-designer" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="full-content hall-designer-shell page-enter">
                  <HallLayoutDesigner />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/seating-allotment" element={
          <ProtectedRoute>
            <PageMotion>
              <div className="app-layout">
                <Navbar />
                <div className="full-content page-enter">
                  <SeatingAllotment />
                </div>
                <Footer />
              </div>
            </PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/seat-chart/:id" element={
          <ProtectedRoute>
            <SeatingChart />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const App = () => {
  return (
    <Router>
      <LazyMotion features={domMax} strict>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="colored"
        />
        <AppRoutes />
      </LazyMotion>
    </Router>
  );
};

export default App;
