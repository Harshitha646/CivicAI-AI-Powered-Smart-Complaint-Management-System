/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import path from 'path';
import fs from 'fs';
import { hashPassword, generateId } from './auth.js';
import { Role } from '../src/types.js';

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const DATA_DIR = process.env.DB_DIR || (isVercel ? '/tmp' : path.resolve(process.cwd(), 'server', 'data'));

let useSqlite = false;
let db: any = null;
let sqlite: any = null;

// JSON DB Fallback Variables
const JSON_DB_FILE = path.join(DATA_DIR, 'civicai_db.json');
interface DBData {
  Users: any[];
  Departments: any[];
  Officers: any[];
  Complaints: any[];
  Feedback: any[];
  Notifications: any[];
  StatusHistory: any[];
}
let dbData: DBData = {
  Users: [],
  Departments: [],
  Officers: [],
  Complaints: [],
  Feedback: [],
  Notifications: [],
  StatusHistory: []
};

// JSON DB Helper Functions
function loadJsonData() {
  if (fs.existsSync(JSON_DB_FILE)) {
    try {
      const content = fs.readFileSync(JSON_DB_FILE, 'utf-8');
      dbData = JSON.parse(content);
    } catch (err) {
      console.error("Failed to parse JSON DB:", err);
    }
  } else {
    saveJsonData();
  }
}

function saveJsonData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(JSON_DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to save JSON DB:", err);
  }
}

// Get DB connection (attempts SQLite, falls back to JSON)
async function getDbConnection() {
  if (db) return db;
  if (useSqlite) return null; // already failed/resolved

  try {
    const sqlite3 = await import('sqlite3');
    sqlite = sqlite3.default.verbose();
    const SQLiteFile = path.join(DATA_DIR, 'civicai.db');
    
    if (DATA_DIR !== path.resolve(process.cwd(), 'server', 'data')) {
      const srcDb = path.resolve(process.cwd(), 'server', 'data', 'civicai.db');
      if (fs.existsSync(srcDb) && !fs.existsSync(SQLiteFile)) {
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.copyFileSync(srcDb, SQLiteFile);
          console.log(`Successfully copied civicai.db to ${SQLiteFile}`);
        } catch (err) {
          console.error(`Failed to copy civicai.db to ${SQLiteFile}:`, err);
        }
      }
    } else {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    }

    db = new sqlite.Database(SQLiteFile);
    useSqlite = true;
    console.log("Using SQLite Database binding.");
    return db;
  } catch (err) {
    console.warn("SQLite native load failed, falling back to JSON DB:", err);
    useSqlite = false;
    loadJsonData();
    return null;
  }
}

export async function dbGet(sql: string, params: any[] = []): Promise<any> {
  await getDbConnection();
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // JSON DB Fallback implementation
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  if (cleanSql.includes("SELECT COUNT(*) as count FROM Users")) {
    return { count: dbData.Users.length };
  }
  if (cleanSql.includes("SELECT * FROM Users WHERE LOWER(email) =")) {
    const email = String(params[0]).toLowerCase().trim();
    return dbData.Users.find(u => u.email.toLowerCase().trim() === email) || null;
  }
  if (cleanSql.includes("SELECT id FROM Users WHERE LOWER(email) =")) {
    const email = String(params[0]).toLowerCase().trim();
    const user = dbData.Users.find(u => u.email.toLowerCase().trim() === email);
    return user ? { id: user.id } : null;
  }
  if (cleanSql.includes("SELECT * FROM Users WHERE id =")) {
    const id = params[0];
    return dbData.Users.find(u => u.id === id) || null;
  }
  if (cleanSql.includes("SELECT * FROM Officers WHERE userId =")) {
    const userId = params[0];
    return dbData.Officers.find(o => o.userId === userId) || null;
  }
  if (cleanSql.includes("SELECT * FROM Officers WHERE id =")) {
    const id = params[0];
    return dbData.Officers.find(o => o.id === id) || null;
  }
  if (cleanSql.includes("SELECT * FROM Departments WHERE id =")) {
    const id = params[0];
    return dbData.Departments.find(d => d.id === id) || null;
  }
  if (cleanSql.includes("SELECT * FROM Complaints WHERE id =")) {
    const id = params[0];
    return dbData.Complaints.find(c => c.id === id) || null;
  }
  if (cleanSql.includes("citizenId != ? AND category = ?")) {
    const citizenId = params[0];
    const category = params[1];
    const street = String(params[2]).trim().toLowerCase();
    const area = params[3];
    const cutoff = params[4];
    return dbData.Complaints.find(c => 
      c.citizenId !== citizenId &&
      c.category === category &&
      String(c.street).trim().toLowerCase() === street &&
      c.area === area &&
      c.status !== 'RESOLVED' && c.status !== 'REJECTED' &&
      c.createdAt > cutoff
    ) || null;
  }

  console.warn("Unhandled dbGet JSON query:", sql, params);
  return null;
}

export async function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  await getDbConnection();
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // JSON DB Fallback implementation
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  if (cleanSql.includes("SELECT id, name, email, role, phone, createdAt FROM Users")) {
    return [...dbData.Users]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id, name, email, role, phone, createdAt }) => ({ id, name, email, role, phone, createdAt }));
  }
  if (cleanSql.includes("SELECT * FROM Complaints WHERE citizenId =")) {
    const citizenId = params[0];
    return [...dbData.Complaints]
      .filter(c => c.citizenId === citizenId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (cleanSql.includes("SELECT * FROM Complaints WHERE assignedOfficerId =")) {
    const officerId = params[0];
    return [...dbData.Complaints]
      .filter(c => c.assignedOfficerId === officerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (cleanSql.includes("SELECT * FROM Complaints")) {
    return [...dbData.Complaints]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (cleanSql.includes("SELECT * FROM StatusHistory WHERE complaintId =")) {
    const complaintId = params[0];
    return [...dbData.StatusHistory]
      .filter(h => h.complaintId === complaintId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  if (cleanSql.includes("SELECT * FROM Notifications WHERE userId =")) {
    const userId = params[0];
    return [...dbData.Notifications]
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }
  if (cleanSql.includes("SELECT * FROM Departments")) {
    return [...dbData.Departments];
  }
  if (cleanSql.includes("SELECT * FROM Officers")) {
    return [...dbData.Officers];
  }

  console.warn("Unhandled dbAll JSON query:", sql, params);
  return [];
}

export async function dbRun(sql: string, params: any[] = []): Promise<{ lastID: any; changes: any }> {
  await getDbConnection();
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (this: any, err: any) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  // JSON DB Fallback implementation
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  if (cleanSql.includes("PRAGMA")) {
    return { lastID: null, changes: 0 };
  }
  if (cleanSql.includes("INSERT INTO Users")) {
    const hasDept = cleanSql.includes("departmentId");
    const userItem: any = {
      id: params[0],
      name: params[1],
      email: params[2],
      passwordHash: params[3],
      role: params[4],
      phone: params[5],
      departmentId: hasDept ? params[6] : null,
      createdAt: hasDept ? params[7] : params[6],
    };
    dbData.Users.push(userItem);
    saveJsonData();
    return { lastID: userItem.id, changes: 1 };
  }
  if (cleanSql.includes("INSERT INTO Departments")) {
    const dept = {
      id: params[0],
      name: params[1],
      code: params[2],
      description: params[3],
      headName: params[4],
    };
    dbData.Departments.push(dept);
    saveJsonData();
    return { lastID: dept.id, changes: 1 };
  }
  if (cleanSql.includes("INSERT INTO Officers")) {
    const officer = {
      id: params[0],
      userId: params[1],
      name: params[2],
      email: params[3],
      departmentId: params[4],
      departmentName: params[5],
      phone: params[6],
      status: params[7],
      rating: params[8],
    };
    dbData.Officers.push(officer);
    saveJsonData();
    return { lastID: officer.id, changes: 1 };
  }
  if (cleanSql.includes("INSERT INTO Complaints")) {
    const c = {
      id: params[0],
      title: params[1],
      description: params[2],
      category: params[3],
      priority: params[4],
      area: params[5],
      street: params[6],
      landmark: params[7],
      city: params[8],
      pincode: params[9],
      imageUrl: params[10],
      videoUrl: params[11],
      preferredContact: params[12],
      status: params[13],
      citizenId: params[14],
      citizenName: params[15],
      citizenEmail: params[16],
      departmentId: params[17],
      departmentName: params[18],
      aiSentiment: params[19],
      aiSummary: params[20],
      hazardSeverity: params[21],
      materialsDetected: params[22],
      aiEvidenceAnalysis: params[23],
      upvotesCount: params[24],
      upvotedUserIds: params[25],
      createdAt: params[26],
      updatedAt: params[27],
      assignedOfficerId: null,
      assignedOfficerName: null,
      estimatedResolutionTime: null,
      citizenRating: null,
      citizenFeedback: null,
    };
    dbData.Complaints.push(c);
    saveJsonData();
    return { lastID: c.id, changes: 1 };
  }
  if (cleanSql.includes("UPDATE Complaints SET upvotedUserIds =")) {
    const upvotedUserIds = params[0];
    const upvotesCount = params[1];
    const priority = params[2];
    const updatedAt = params[3];
    const id = params[4];
    const c = dbData.Complaints.find(x => x.id === id);
    if (c) {
      c.upvotedUserIds = upvotedUserIds;
      c.upvotesCount = upvotesCount;
      c.priority = priority;
      c.updatedAt = updatedAt;
      saveJsonData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }
  if (cleanSql.includes("INSERT OR REPLACE INTO Feedback")) {
    const f = {
      id: params[0],
      complaintId: params[1],
      citizenId: params[2],
      rating: params[3],
      feedback: params[4],
      createdAt: params[5],
    };
    const idx = dbData.Feedback.findIndex(x => x.complaintId === f.complaintId);
    if (idx > -1) {
      dbData.Feedback[idx] = f;
    } else {
      dbData.Feedback.push(f);
    }
    saveJsonData();
    return { lastID: f.id, changes: 1 };
  }
  if (cleanSql.includes("UPDATE Complaints SET citizenRating =")) {
    const citizenRating = params[0];
    const citizenFeedback = params[1];
    const updatedAt = params[2];
    const id = params[3];
    const c = dbData.Complaints.find(x => x.id === id);
    if (c) {
      c.citizenRating = citizenRating;
      c.citizenFeedback = citizenFeedback;
      c.updatedAt = updatedAt;
      saveJsonData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }
  if (cleanSql.includes("UPDATE Complaints SET assignedOfficerId =")) {
    const assignedOfficerId = params[0];
    const assignedOfficerName = params[1];
    const departmentId = params[2];
    const departmentName = params[3];
    const status = params[4];
    const estimatedResolutionTime = params[5];
    const updatedAt = params[6];
    const id = params[7];
    const c = dbData.Complaints.find(x => x.id === id);
    if (c) {
      c.assignedOfficerId = assignedOfficerId;
      c.assignedOfficerName = assignedOfficerName;
      c.departmentId = departmentId;
      c.departmentName = departmentName;
      c.status = status;
      c.estimatedResolutionTime = estimatedResolutionTime;
      c.updatedAt = updatedAt;
      saveJsonData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }
  if (cleanSql.includes("UPDATE Complaints SET status = ?, updatedAt = ? WHERE id = ?")) {
    const status = params[0];
    const updatedAt = params[1];
    const id = params[2];
    const c = dbData.Complaints.find(x => x.id === id);
    if (c) {
      c.status = status;
      c.updatedAt = updatedAt;
      saveJsonData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }
  if (cleanSql.includes("UPDATE Complaints SET status = ?, priority = ?, updatedAt = ? WHERE id = ?")) {
    const status = params[0];
    const priority = params[1];
    const updatedAt = params[2];
    const id = params[3];
    const c = dbData.Complaints.find(x => x.id === id);
    if (c) {
      c.status = status;
      c.priority = priority;
      c.updatedAt = updatedAt;
      saveJsonData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }
  if (cleanSql.includes("INSERT INTO StatusHistory")) {
    const hasImage = params.length === 8;
    const historyItem = {
      id: params[0],
      complaintId: params[1],
      status: params[2],
      updatedBy: params[3],
      updatedByName: params[4],
      remarks: params[5],
      imageUrl: hasImage ? params[6] : null,
      timestamp: hasImage ? params[7] : params[6],
    };
    dbData.StatusHistory.push(historyItem);
    saveJsonData();
    return { lastID: historyItem.id, changes: 1 };
  }
  if (cleanSql.includes("INSERT INTO Notifications")) {
    const notif = {
      id: params[0],
      userId: params[1],
      title: params[2],
      message: params[3],
      read: params[4] || 0,
      type: params[5] || 'COMPLAINT_STATUS',
      createdAt: params[6],
    };
    dbData.Notifications.push(notif);
    saveJsonData();
    return { lastID: notif.id, changes: 1 };
  }
  if (cleanSql.includes("UPDATE Notifications SET read = 1")) {
    const userId = params[0];
    let changes = 0;
    dbData.Notifications.forEach(n => {
      if (n.userId === userId && n.read !== 1) {
        n.read = 1;
        changes++;
      }
    });
    if (changes > 0) {
      saveJsonData();
    }
    return { lastID: null, changes };
  }

  console.warn("Unhandled dbRun JSON query:", sql, params);
  return { lastID: null, changes: 0 };
}

export async function initDB() {
  await getDbConnection();
  if (useSqlite) {
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
        materialsDetected TEXT,
        aiEvidenceAnalysis TEXT,
        upvotesCount INTEGER DEFAULT 0,
        upvotedUserIds TEXT DEFAULT '[]',
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
        read INTEGER NOT NULL DEFAULT 0,
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
  }

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
