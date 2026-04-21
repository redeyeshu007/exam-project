# Exam Hall Allocation System - Project Report

## Project Overview
The **Exam Hall Allocation System** is a full-stack web application designed to automate and manage the process of allocating students to exam halls based on hall capacity and exam schedules. It provides a streamlined workflow for administrators to upload student data, manage hall availability, and generate optimized seating arrangements.

---

## Core Features

### 1. **User Authentication & Authorization**
- **Secure Admin Login**: Protects the system with JWT-based authentication.
- **Protected Routes**: Ensures only authorized personnel can access the allocation tools and history.

### 2. **Exam & Session Management**
- **Exam Details**: Define exam names, dates, and specific time slots (Morning/Afternoon).
- **Flexible Scheduling**: Manage multiple exams and sessions efficiently.

### 3. **Smart Student Data Import**
- **File Upload System**: Easily import student lists via files (Excel/CSV).
- **Section Parsing**: Automatically identifies and categorizes students based on their sections or departments.

### 4. **Hall & Capacity Management**
- **Hall Database**: Maintain a detailed list of available exam halls.
- **Dynamic Capacity Control**: Track the seating capacity of each hall to ensure no overcrowding.

### 5. **Automated Allocation Wizard**
- **Step-by-Step Workflow**: A guided multi-step process for generating allocations:
    - **Step 1: Exam Details**: Set the context for the allocation.
    - **Step 2: Student Upload**: Input the student list.
    - **Step 3: Section Mapping**: Select which sections are part of the current exam.
    - **Step 4: Hall Selection**: Choose available halls for the session.
    - **Step 5: Result Generation**: The system automatically distributes students across selected halls.

### 6. **Reporting & Print-Ready Outputs**
- **Hall Plan Visualization**: View detailed allocation results grouped by hall.
- **Print Functionality**: Generate high-quality, print-friendly hall plans for physical posting at exam venues.

### 7. **Historical Tracking**
- **Allocation History**: Access and review previous exam hall arrangements.
- **Data Persistence**: All past allocations are stored securely in the database for future reference.

---

## Technical Architecture

### **Frontend (Client)**
- **Framework**: React.js (Vite)
- **State Management**: React Hooks
- **Styling**: Component-based CSS
- **Key Components**: 
    - `AllocationWizard`: The heart of the allocation logic.
    - `HallPlanPrint`: Specialized component for generating physical reports.

### **Backend (Server)**
- **Runtime**: Node.js with Express.js
- **Database**: MongoDB (via Mongoose)
- **Security**: 
    - Password hashing using `bcrypt`.
    - Session management using `jsonwebtoken` (JWT).
- **API Architecture**: RESTful endpoints for Halls, Allocations, and Authentication.

---

## Key Benefits
- **Efficiency**: Reduces the manual effort required to assign hundreds of students to multiple halls.
- **Accuracy**: Eliminates human error in capacity calculations and student duplication.
- **Professionalism**: Provides clean, readable, and printable reports for students and faculty.
