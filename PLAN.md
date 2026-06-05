Steel City Codes Registration System
1. Overview
A web-based platform to manage student/volunteer registration, class scheduling, and daily operations (attendance/checkout).
2. User Roles & Permissions
•	Administrator: Full CRUD, manual override of all assignments, view all registration data.
•	Volunteer: View assigned classes/roles, perform daily attendance/checkout for students in their assigned class.
•	Parent: Register students, manage student profiles (med/allergy info), view class status.
3. Data Schema (PostgreSQL)
•	profiles: id, role (enum: 'admin', 'volunteer', 'parent'), display_name.
•	students: id, parent_id (FK), age, medical_info.
•	volunteers: id, experience_level (enum: 'junior', 'senior'), availability_week_1 (bool), availability_week_2 (bool), interview_notes.
•	classes: id, name, age_group, capacity, lead_id (FK), support_id (FK).
•	registrations: id, student_id (FK), class_id (FK), status.
•	attendance_logs: id, student_id (FK), class_id (FK), timestamp, action (check-in/check-out).
4. Key Logic & Algorithms
•	Class Assignment (Student): First-come, first-serve validation against class_capacity.
•	Class Assignment (Volunteer): Matching algorithm pairing junior (inexperienced) with senior (experienced) based on week availability.
•	Attendance: Real-time logging of student movement within classroom contexts.
5. Tech Stack & Implementation
•	Frontend: React (TypeScript) for modular, component-based architecture.
•	Styling: Tailwind CSS for a utility-first approach to match the high-contrast brand kit.
•	Backend: Supabase (PostgreSQL) for database, Auth, and RLS policies.
7. Team Workflow & Collaboration
•	Branching Strategy: No code is pushed directly to main. Every feature or fix must be on a feature/ or fix/ branch.
•	Pull Requests (PRs): Every task must result in a Pull Request. Merging requires at least one human review.
•	AI-Assisted PRs: When using Claude Code to author changes, include [AI-Authored] in the PR title. Use Claude Code to generate PR descriptions using the command: "Summarize these changes for a Pull Request, including the problem solved and potential side effects."
•	Code Quality: Before merging, run claude "Review this PR for security, alignment with PLAN.md, and adherence to the DESIGN_SYSTEM.md styling."
•	Conflict Prevention: Keep PRs small and atomic. Communicate task assignments via GitHub Issues to prevent simultaneous edits to the same files.
•	Documentation: Keep PLAN.md as the single source of truth. If a feature changes, update the document before the code is merged.