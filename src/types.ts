/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Role {
  CITIZEN = 'CITIZEN',
  ADMIN = 'ADMIN',
  OFFICER = 'OFFICER'
}

export enum ComplaintStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  departmentId?: string; // For officers
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  headName: string;
}

export interface Officer {
  id: string;
  userId: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  phone: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  rating: number;
}

export interface StatusHistory {
  id: string;
  complaintId: string;
  status: ComplaintStatus;
  updatedBy: string;
  updatedByName: string;
  remarks: string;
  imageUrl?: string;
  timestamp: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  area: string;
  street: string;
  landmark: string;
  city: string;
  pincode: string;
  imageUrl?: string;
  videoUrl?: string;
  preferredContact: 'EMAIL' | 'SMS' | 'PHONE' | 'APP';
  status: ComplaintStatus;
  citizenId: string;
  citizenName: string;
  citizenEmail: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  departmentId?: string;
  departmentName?: string;
  estimatedResolutionTime?: string; // ISO date string or duration
  aiSentiment?: string; // Positive, Neutral, Negative, Very Angry
  aiSummary?: string;
  hazardSeverity?: number;
  materialsDetected?: string[];
  aiEvidenceAnalysis?: string;
  upvotesCount: number;
  upvotedUserIds: string[]; // Duplicate complaint support system
  citizenRating?: number;
  citizenFeedback?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'COMPLAINT_STATUS' | 'COMPLAINT_ASSIGNED' | 'SYSTEM' | 'AI_ALERT';
  createdAt: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}
