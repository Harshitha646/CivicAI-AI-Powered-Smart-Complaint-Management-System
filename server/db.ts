/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { hashPassword, generateId } from './auth';
import { Role } from '../src/types';

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const DATA_DIR = isVercel ? '/tmp' : path.resolve(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'civicai.db');

if (isVercel) {
  const srcDb = path.resolve(process.cwd(), 'server', 'data', 'civicai.db');
  if (fs.existsSync(srcDb) && !fs.existsSync(DB_FILE)) {
    try {
      fs.copyFileSync(srcDb, DB_FILE);
      console.log('Successfully copied civicai.db to /tmp');
    } catch (err) {
      console.error('Failed to copy civicai.db to /tmp:', err);
    }
  }
} else {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// verbose mode for sqlite
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(DB_FILE);

export function dbRun(sql: string, params: any[] = []): Promise<{ lastID: any; changes: any }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function dbGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function initDB() {
  // Enable foreign keys
  await dbRun('PRAGMA foreign_keys = ON;');

  // Create Users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      departmentId TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  // Create Departments table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS Departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      headName TEXT
    )
  `);

  // Create Officers table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS Officers (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      departmentId TEXT NOT NULL,
      departmentName TEXT NOT NULL,
      phone TEXT,
      status TEXT NOT NULL,
      rating REAL NOT NULL,
      FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY (departmentId) REFERENCES Departments(id)
    )
  `);

  // Create Complaints table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS Complaints (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      area TEXT NOT NULL,
      street TEXT NOT NULL,
      landmark TEXT,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      imageUrl TEXT,
      videoUrl TEXT,
      preferredContact TEXT NOT NULL,
      status TEXT NOT NULL,
      citizenId TEXT NOT NULL,
      citizenName TEXT NOT NULL,
      citizenEmail TEXT NOT NULL,
      assignedOfficerId TEXT,
      assignedOfficerName TEXT,
      departmentId TEXT,
      departmentName TEXT,
      aiSentiment TEXT,
      aiSummary TEXT,
      hazardSeverity REAL,
      materialsDetected TEXT, -- JSON array
      aiEvidenceAnalysis TEXT,
      upvotesCount INTEGER DEFAULT 0,
      upvotedUserIds TEXT DEFAULT '[]', -- JSON array
      estimatedResolutionTime TEXT,
      citizenRating INTEGER,
      citizenFeedback TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (citizenId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY (assignedOfficerId) REFERENCES Officers(id) ON DELETE SET NULL,
      FOREIGN KEY (departmentId) REFERENCES Departments(id) ON DELETE SET NULL
    )
  `);

  // Create Feedback table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS Feedback (
      id TEXT PRIMARY KEY,
      complaintId TEXT UNIQUE NOT NULL,
      citizenId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      feedback TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (complaintId) REFERENCES Complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (citizenId) REFERENCES Users(id) ON DELETE CASCADE
    )
  `);

  // Create Notifications table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS Notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
      type TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
    )
  `);

  // Create StatusHistory table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS StatusHistory (
      id TEXT PRIMARY KEY,
      complaintId TEXT NOT NULL,
      status TEXT NOT NULL,
      updatedBy TEXT NOT NULL,
      updatedByName TEXT NOT NULL,
      remarks TEXT NOT NULL,
      imageUrl TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (complaintId) REFERENCES Complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (updatedBy) REFERENCES Users(id) ON DELETE CASCADE
    )
  `);

  // Seed default data
  await seedDB();
}

async function seedDB() {
  const userCount = await dbGet('SELECT COUNT(*) as count FROM Users');
  if (userCount.count > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();

  // 1. Seed Departments
  const departments = [
    { id: 'dept-wsd', name: 'Water & Sewage', code: 'WSD', description: 'Water supply, drainage, and sewage infrastructure', headName: 'Priya Ramesh' },
    { id: 'dept-rid', name: 'Roads & Infrastructure', code: 'RID', description: 'Road damage, potholes, and public transport routes', headName: 'Karan Mehta' },
    { id: 'dept-ele', name: 'Electricity', code: 'ELE', description: 'Street lighting and power grid issues', headName: 'Anita Suresh' },
    { id: 'dept-wmd', name: 'Waste Management', code: 'WMD', description: 'Garbage collection and illegal dumping', headName: 'Rahul Verma' },
    { id: 'dept-psd', name: 'Public Safety', code: 'PSD', description: 'Noise pollution and general public safety', headName: 'Deepa Nair' },
    { id: 'dept-gad', name: 'General Administration', code: 'GAD', description: 'Uncategorized municipal concerns', headName: 'Vikram Rao' },
  ];

  for (const d of departments) {
    await dbRun(
      'INSERT INTO Departments (id, name, code, description, headName) VALUES (?, ?, ?, ?, ?)',
      [d.id, d.name, d.code, d.description, d.headName]
    );
  }

  // 2. Seed Users
  const officerUsers = [
    { id: 'user-officer-thomas', name: 'Thomas Reyes', email: 'thomas@civicai.com', password: 'Officer@123', departmentId: 'dept-wsd', phone: '+1 (555) 200-1001' },
    { id: 'user-officer-maria', name: 'Maria Chen', email: 'maria@civicai.com', password: 'Officer@123', departmentId: 'dept-rid', phone: '+1 (555) 200-1002' },
    { id: 'user-officer-james', name: 'James Cole', email: 'james@civicai.com', password: 'Officer@123', departmentId: 'dept-ele', phone: '+1 (555) 200-1003' },
    { id: 'user-officer-priya', name: 'Priya Nair', email: 'priya@civicai.com', password: 'Officer@123', departmentId: 'dept-wmd', phone: '+1 (555) 200-1004' },
  ];

  // Admin
  await dbRun(
    'INSERT INTO Users (id, name, email, passwordHash, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['user-admin', 'Alex Morgan', 'admin@civicai.com', hashPassword('Admin@123'), Role.ADMIN, '+1 (555) 100-0001', now]
  );

  // Citizen
  await dbRun(
    'INSERT INTO Users (id, name, email, passwordHash, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['user-citizen', 'John Citizen', 'citizen@civicai.com', hashPassword('Citizen@123'), Role.CITIZEN, '+1 (555) 900-2000', now]
  );

  // Officers
  const departmentNameById: Record<string, string> = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  for (let idx = 0; idx < officerUsers.length; idx++) {
    const o = officerUsers[idx];
    await dbRun(
      'INSERT INTO Users (id, name, email, passwordHash, role, phone, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [o.id, o.name, o.email, hashPassword(o.password), Role.OFFICER, o.phone, o.departmentId, now]
    );

    // Also seed Officers table
    await dbRun(
      'INSERT INTO Officers (id, userId, name, email, departmentId, departmentName, phone, status, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `off-${o.id}`,
        o.id,
        o.name,
        o.email,
        o.departmentId,
        departmentNameById[o.departmentId],
        o.phone,
        'ACTIVE',
        4.2 + (idx % 3) * 0.2
      ]
    );
  }
}

export { generateId };
