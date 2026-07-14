/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import path from 'path';
import fs from 'fs';
import { hashPassword, generateId } from './auth';
import { Role } from '../src/types';

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const DATA_DIR = process.env.DB_DIR || (isVercel ? '/tmp' : path.resolve(process.cwd(), 'server', 'data'));
const DB_FILE = path.join(DATA_DIR, 'civicai_db.json');

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

// Read from JSON DB file
function loadData() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbData = JSON.parse(content);
    } catch (err) {
      console.error("Failed to parse JSON DB:", err);
    }
  } else {
    saveData();
  }
}

// Write to JSON DB file
function saveData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to save JSON DB:", err);
  }
}

export async function dbGet(sql: string, params: any[] = []): Promise<any> {
  loadData();
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // 1. SELECT COUNT(*) as count FROM Users
  if (cleanSql.includes("SELECT COUNT(*) as count FROM Users")) {
    return { count: dbData.Users.length };
  }

  // 2. SELECT * FROM Users WHERE LOWER(email) = ?
  if (cleanSql.includes("SELECT * FROM Users WHERE LOWER(email) =")) {
    const email = String(params[0]).toLowerCase().trim();
    return dbData.Users.find(u => u.email.toLowerCase().trim() === email) || null;
  }

  // 3. SELECT id FROM Users WHERE LOWER(email) = ?
  if (cleanSql.includes("SELECT id FROM Users WHERE LOWER(email) =")) {
    const email = String(params[0]).toLowerCase().trim();
    const user = dbData.Users.find(u => u.email.toLowerCase().trim() === email);
    return user ? { id: user.id } : null;
  }

  // 4. SELECT * FROM Users WHERE id = ?
  if (cleanSql.includes("SELECT * FROM Users WHERE id =")) {
    const id = params[0];
    return dbData.Users.find(u => u.id === id) || null;
  }

  // 5. SELECT * FROM Officers WHERE userId = ?
  if (cleanSql.includes("SELECT * FROM Officers WHERE userId =")) {
    const userId = params[0];
    return dbData.Officers.find(o => o.userId === userId) || null;
  }

  // 6. SELECT * FROM Officers WHERE id = ?
  if (cleanSql.includes("SELECT * FROM Officers WHERE id =")) {
    const id = params[0];
    return dbData.Officers.find(o => o.id === id) || null;
  }

  // 7. SELECT * FROM Departments WHERE id = ?
  if (cleanSql.includes("SELECT * FROM Departments WHERE id =")) {
    const id = params[0];
    return dbData.Departments.find(d => d.id === id) || null;
  }

  // 8. SELECT * FROM Complaints WHERE id = ?
  if (cleanSql.includes("SELECT * FROM Complaints WHERE id =")) {
    const id = params[0];
    return dbData.Complaints.find(c => c.id === id) || null;
  }

  // 9. SELECT * FROM Complaints WHERE citizenId != ? AND category = ? ...
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

  console.warn("Unhandled dbGet query:", sql, params);
  return null;
}

export async function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  loadData();
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // 1. SELECT id, name, email, role, phone, createdAt FROM Users ORDER BY createdAt DESC
  if (cleanSql.includes("SELECT id, name, email, role, phone, createdAt FROM Users")) {
    return [...dbData.Users]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id, name, email, role, phone, createdAt }) => ({ id, name, email, role, phone, createdAt }));
  }

  // 2. SELECT * FROM Complaints WHERE citizenId = ? ORDER BY createdAt DESC (or without order)
  if (cleanSql.includes("SELECT * FROM Complaints WHERE citizenId =")) {
    const citizenId = params[0];
    return [...dbData.Complaints]
      .filter(c => c.citizenId === citizenId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // 3. SELECT * FROM Complaints WHERE assignedOfficerId = ? ORDER BY createdAt DESC
  if (cleanSql.includes("SELECT * FROM Complaints WHERE assignedOfficerId =")) {
    const officerId = params[0];
    return [...dbData.Complaints]
      .filter(c => c.assignedOfficerId === officerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // 4. SELECT * FROM Complaints ORDER BY createdAt DESC (or general selection)
  if (cleanSql.includes("SELECT * FROM Complaints")) {
    return [...dbData.Complaints]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // 5. SELECT * FROM StatusHistory WHERE complaintId = ? ORDER BY timestamp ASC
  if (cleanSql.includes("SELECT * FROM StatusHistory WHERE complaintId =")) {
    const complaintId = params[0];
    return [...dbData.StatusHistory]
      .filter(h => h.complaintId === complaintId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // 6. SELECT * FROM Notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50
  if (cleanSql.includes("SELECT * FROM Notifications WHERE userId =")) {
    const userId = params[0];
    return [...dbData.Notifications]
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  // 7. SELECT * FROM Departments
  if (cleanSql.includes("SELECT * FROM Departments")) {
    return [...dbData.Departments];
  }

  // 8. SELECT * FROM Officers
  if (cleanSql.includes("SELECT * FROM Officers")) {
    return [...dbData.Officers];
  }

  console.warn("Unhandled dbAll query:", sql, params);
  return [];
}

export async function dbRun(sql: string, params: any[] = []): Promise<{ lastID: any; changes: any }> {
  loadData();
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // 1. PRAGMA foreign_keys = ON;
  if (cleanSql.includes("PRAGMA")) {
    return { lastID: null, changes: 0 };
  }

  // 2. INSERT INTO Users
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
    saveData();
    return { lastID: userItem.id, changes: 1 };
  }

  // 3. INSERT INTO Departments
  if (cleanSql.includes("INSERT INTO Departments")) {
    const dept = {
      id: params[0],
      name: params[1],
      code: params[2],
      description: params[3],
      headName: params[4],
    };
    dbData.Departments.push(dept);
    saveData();
    return { lastID: dept.id, changes: 1 };
  }

  // 4. INSERT INTO Officers
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
    saveData();
    return { lastID: officer.id, changes: 1 };
  }

  // 5. INSERT INTO Complaints
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
    saveData();
    return { lastID: c.id, changes: 1 };
  }

  // 6. UPDATE Complaints SET upvotedUserIds = ?, upvotesCount = ?, priority = ?, updatedAt = ? WHERE id = ?
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
      saveData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }

  // 7. INSERT OR REPLACE INTO Feedback
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
    saveData();
    return { lastID: f.id, changes: 1 };
  }

  // 8. UPDATE Complaints SET citizenRating = ?, citizenFeedback = ?, updatedAt = ? WHERE id = ?
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
      saveData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }

  // 9. UPDATE Complaints SET assignedOfficerId = ?, assignedOfficerName = ?, departmentId = ?, departmentName = ?, status = ?, estimatedResolutionTime = ?, updatedAt = ? WHERE id = ?
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
      saveData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }

  // 10. UPDATE Complaints SET status = ?, updatedAt = ? WHERE id = ?
  if (cleanSql.includes("UPDATE Complaints SET status = ?, updatedAt = ? WHERE id = ?")) {
    const status = params[0];
    const updatedAt = params[1];
    const id = params[2];
    const c = dbData.Complaints.find(x => x.id === id);
    if (c) {
      c.status = status;
      c.updatedAt = updatedAt;
      saveData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }

  // 11. UPDATE Complaints SET status = ?, priority = ?, updatedAt = ? WHERE id = ?
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
      saveData();
      return { lastID: null, changes: 1 };
    }
    return { lastID: null, changes: 0 };
  }

  // 12. INSERT INTO StatusHistory
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
    saveData();
    return { lastID: historyItem.id, changes: 1 };
  }

  // 13. INSERT INTO Notifications
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
    saveData();
    return { lastID: notif.id, changes: 1 };
  }

  // 14. UPDATE Notifications SET read = 1 WHERE userId = ?
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
      saveData();
    }
    return { lastID: null, changes };
  }

  console.warn("Unhandled dbRun query:", sql, params);
  return { lastID: null, changes: 0 };
}

export async function initDB() {
  loadData();
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
