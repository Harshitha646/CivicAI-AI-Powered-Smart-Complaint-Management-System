/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import { dbGet, dbRun, dbAll, initDB, generateId } from "./server/db.js";
import { hashPassword, verifyPassword, generateToken, verifyToken } from "./server/auth.js";
import { classifyComplaint, findDuplicate, generateSmartReply, mapCategoryToDepartment } from "./server/ai.js";
import { Role, ComplaintStatus, Priority } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));

const apiKey = process.env.GEMINI_API_KEY || "";
let ai: any = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

let ACTIVE_CHAT_MODEL = "models/gemini-2.5-flash-lite";

// Lazy database initialization promise
let dbInitializedPromise: Promise<void> | null = null;

function ensureDbInitialized() {
  if (!dbInitializedPromise) {
    dbInitializedPromise = initDB().then(() => {
      if (apiKey) {
        // Run model detection in the background to avoid blocking serverless cold starts
        detectSupportedModel().catch((err: any) => {
          console.error("❌ Dynamic Gemini model detection failed:", err.message || err);
        });
      }
    });
  }
  return dbInitializedPromise;
}

// Global middleware to guarantee DB and AI models are initialized before processing routes
app.use(async (req: any, res: any, next: any) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (err: any) {
    console.error("Database initialization failed:", err);
    res.status(500).json({ error: `Database initialization failed: ${err.message || err}` });
  }
});

async function detectSupportedModel() {
  console.log(`🤖 [CivicAI] Checking API key status...`);
  console.log(`   - GEMINI_API_KEY Configured: ${apiKey ? "YES (Key starts with '" + apiKey.slice(0, 7) + "', length is " + apiKey.length + ")" : "NO (Missing)"}`);
  console.log(`   - SDK Version: @google/genai v2.4.0`);

  if (!apiKey || !ai) {
    throw new Error("GEMINI_API_KEY is missing from environment variables.");
  }

  const chatModels: string[] = [];

  try {
    const listIter = await ai.models.list();
    for await (const m of listIter) {
      const name = m.name;
      console.log(`[Gemini Model Discovery] Available: ${name}`);

      const cleanName = name.replace("models/", "");
      if (
        name.startsWith("models/gemini-") &&
        !cleanName.includes("embedding") &&
        !cleanName.includes("tts") &&
        !cleanName.includes("audio") &&
        !cleanName.includes("image") &&
        !cleanName.includes("translate") &&
        !cleanName.includes("computer-use") &&
        !cleanName.includes("robotics")
      ) {
        chatModels.push(name);
      }
    }
  } catch (err: any) {
    console.error("❌ Failed to list Gemini models:", err);
    throw err;
  }

  if (chatModels.length === 0) {
    throw new Error("No Gemini chat models discovered in list query.");
  }

  // Preferred selection order
  const preferred = [
    "models/gemini-2.5-flash-lite",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
  ];

  // Build sorted list
  const modelsToTest = [
    ...preferred.filter(p => chatModels.includes(p)), 
    ...chatModels.filter(m => !preferred.includes(m))
  ];

  console.log(`🤖 [CivicAI] Testing discovered models for content generation support:`, modelsToTest);

  for (const model of modelsToTest) {
    try {
      console.log(`🤖 [CivicAI] Testing model ${model} with simple generation request...`);
      await ai.models.generateContent({
        model: model,
        contents: "test",
        config: { maxOutputTokens: 1 }
      });
      ACTIVE_CHAT_MODEL = model;
      console.log(`✅ [CivicAI] Dynamic Model Selected & Verified: ${ACTIVE_CHAT_MODEL}`);
      return;
    } catch (err: any) {
      console.warn(`⚠️ Model test failed for ${model}: ${err.message || err}`);
    }
  }

  throw new Error("Tested all discovered Gemini models, but none succeeded to generate content.");
}

// ============================================================================
// HELPER FOR COMPLAINT PARSING
// ============================================================================

function parseComplaint(c: any) {
  if (!c) return null;
  return {
    ...c,
    materialsDetected: c.materialsDetected ? JSON.parse(c.materialsDetected) : [],
    upvotedUserIds: c.upvotedUserIds ? JSON.parse(c.upvotedUserIds) : [],
    upvotesCount: Number(c.upvotesCount) || 0,
    hazardSeverity: c.hazardSeverity ? Number(c.hazardSeverity) : null,
    citizenRating: c.citizenRating ? Number(c.citizenRating) : null,
  };
}

function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

async function authenticate(req: any, res: any, next: any) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  try {
    const user = await dbGet("SELECT * FROM Users WHERE id = ?", [payload.userId]);
    if (!user) {
      return res.status(401).json({ error: "Account no longer exists." });
    }

    req.user = user;
    req.token = token;

    if (user.role === Role.OFFICER) {
      const officer = await dbGet("SELECT * FROM Officers WHERE userId = ?", [user.id]);
      req.officer = officer || null;
    }
    next();
  } catch (err: any) {
    console.error("Authentication error:", err);
    return res.status(500).json({ error: "Authentication internal error." });
  }
}

function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

app.post("/api/auth/signup", async (req: any, res: any) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const existingUser = await dbGet("SELECT id FROM Users WHERE LOWER(email) = ?", [normalizedEmail]);
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const userId = generateId("user");
    const newUser = {
      id: userId,
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: Role.CITIZEN,
      phone: phone || "",
      createdAt: new Date().toISOString(),
    };

    await dbRun(
      "INSERT INTO Users (id, name, email, passwordHash, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newUser.id, newUser.name, newUser.email, newUser.passwordHash, newUser.role, newUser.phone, newUser.createdAt]
    );

    const token = generateToken(newUser.id);
    return res.status(201).json({ user: sanitizeUser(newUser), token });
  } catch (err: any) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Failed to complete signup due to server error." });
  }
});

app.post("/api/auth/login", async (req: any, res: any) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const user = await dbGet("SELECT * FROM Users WHERE LOWER(email) = ?", [normalizedEmail]);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user.id);
    return res.json({ user: sanitizeUser(user), token });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Failed to log in due to server error." });
  }
});

app.get("/api/auth/me", authenticate, (req: any, res: any) => {
  return res.json({ user: sanitizeUser(req.user) });
});

app.post("/api/auth/logout", authenticate, (req: any, res: any) => {
  // Stateless token revocation is handled by client discarding the token
  return res.json({ success: true });
});

// ============================================================================
// USERS ROUTE (ADMIN ONLY)
// ============================================================================

app.get("/api/users", authenticate, requireRole(Role.ADMIN), async (req: any, res: any) => {
  try {
    const users = await dbAll("SELECT id, name, email, role, phone, createdAt FROM Users ORDER BY createdAt DESC");
    return res.json(users);
  } catch (err: any) {
    console.error("Fetch users error:", err);
    return res.status(500).json({ error: "Failed to fetch users." });
  }
});

// ============================================================================
// COMPLAINTS
// ============================================================================

app.get("/api/complaints", authenticate, async (req: any, res: any) => {
  try {
    let rows: any[] = [];
    if (req.user.role === Role.CITIZEN) {
      rows = await dbAll("SELECT * FROM Complaints WHERE citizenId = ? ORDER BY createdAt DESC", [req.user.id]);
    } else if (req.user.role === Role.OFFICER) {
      const officerId = req.officer?.id || "";
      rows = await dbAll("SELECT * FROM Complaints WHERE assignedOfficerId = ? ORDER BY createdAt DESC", [officerId]);
    } else {
      // ADMIN
      rows = await dbAll("SELECT * FROM Complaints ORDER BY createdAt DESC");
    }

    const list = rows.map(parseComplaint);
    return res.json(list);
  } catch (err: any) {
    console.error("Get complaints error:", err);
    return res.status(500).json({ error: "Failed to retrieve complaints." });
  }
});

app.post("/api/complaints", authenticate, async (req: any, res: any) => {
  const body = req.body || {};
  const required = ["title", "description", "street", "pincode"];
  for (const field of required) {
    if (!body[field]) {
      return res.status(400).json({ error: `Field "${field}" is required.` });
    }
  }

  const category = body.category || "Others";
  const area = body.area || "Downtown";
  const street = body.street;

  try {
    // 1. Check for duplicates
    const cutoffMs = Date.now() - 1000 * 60 * 60 * 24 * 21; // 21 days
    const cutoff = new Date(cutoffMs).toISOString();

    const duplicate = await dbGet(
      `SELECT * FROM Complaints 
       WHERE citizenId != ? 
         AND category = ? 
         AND LOWER(TRIM(street)) = LOWER(TRIM(?)) 
         AND area = ? 
         AND status NOT IN ('RESOLVED', 'REJECTED') 
         AND createdAt > ?`,
      [req.user.id, category, street, area, cutoff]
    );

    if (duplicate) {
      return res.status(200).json({
        duplicate: true,
        message: `A similar "${category}" complaint was already reported nearby on ${new Date(duplicate.createdAt).toLocaleDateString()}. You can back it instead of filing a duplicate — this boosts its priority and gets it fixed faster.`,
        existingComplaint: parseComplaint(duplicate),
      });
    }

    // 2. Routing and priority
    const departments = await dbAll("SELECT * FROM Departments");
    const dept = mapCategoryToDepartment(category, departments);

    const submittedPriority: Priority = (body.priority as Priority) || Priority.MEDIUM;
    const classification = classifyComplaint(body.description, category, submittedPriority);

    const now = new Date().toISOString();
    const complaintId = generateId("comp");

    // 3. Write complaint to SQLite
    await dbRun(
      `INSERT INTO Complaints (
        id, title, description, category, priority, area, street, landmark, city, pincode,
        imageUrl, videoUrl, preferredContact, status, citizenId, citizenName, citizenEmail,
        departmentId, departmentName, aiSentiment, aiSummary, hazardSeverity, materialsDetected,
        aiEvidenceAnalysis, upvotesCount, upvotedUserIds, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaintId,
        body.title,
        body.description,
        category,
        classification.priority,
        area,
        street,
        body.landmark || "",
        body.city || "Metro City",
        body.pincode,
        body.imageUrl || "",
        body.videoUrl || "",
        body.preferredContact || "APP",
        ComplaintStatus.SUBMITTED,
        req.user.id,
        req.user.name,
        req.user.email,
        dept?.id || null,
        dept?.name || null,
        classification.aiSentiment,
        classification.aiSummary,
        classification.hazardSeverity,
        JSON.stringify(classification.materialsDetected),
        classification.aiEvidenceAnalysis,
        0,
        JSON.stringify([]),
        now,
        now
      ]
    );

    // 4. Create history entry
    await dbRun(
      `INSERT INTO StatusHistory (id, complaintId, status, updatedBy, updatedByName, remarks, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId("hist"),
        complaintId,
        ComplaintStatus.SUBMITTED,
        req.user.id,
        req.user.name,
        `Complaint submitted by citizen. AI routed to ${dept?.name || "General Administration"} with priority ${classification.priority}.`,
        now
      ]
    );

    // 5. Create Notification
    await dbRun(
      `INSERT INTO Notifications (id, userId, title, message, read, type, createdAt) 
       VALUES (?, ?, ?, ?, 0, 'COMPLAINT_STATUS', ?)`,
      [
        generateId("notif"),
        req.user.id,
        "Complaint Submitted",
        `Your complaint "${body.title}" was received and routed to ${dept?.name}.`,
        now
      ]
    );

    const inserted = await dbGet("SELECT * FROM Complaints WHERE id = ?", [complaintId]);
    return res.status(201).json({ complaint: parseComplaint(inserted) });
  } catch (err: any) {
    console.error("Create complaint error:", err);
    return res.status(500).json({ error: "Failed to file complaint due to server error." });
  }
});

app.get("/api/complaints/:id", authenticate, async (req: any, res: any) => {
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [req.params.id]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    const complaint = parseComplaint(complaintRow);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    if (req.user.role === Role.CITIZEN && complaint.citizenId !== req.user.id) {
      return res.status(403).json({ error: "You cannot view this complaint." });
    }
    if (req.user.role === Role.OFFICER && complaint.assignedOfficerId !== req.officer?.id) {
      return res.status(403).json({ error: "This complaint is not assigned to you." });
    }

    const timeline = await dbAll(
      "SELECT * FROM StatusHistory WHERE complaintId = ? ORDER BY timestamp ASC",
      [complaint.id]
    );

    return res.json({ complaint, timeline });
  } catch (err: any) {
    console.error("Get complaint by id error:", err);
    return res.status(500).json({ error: "Failed to retrieve complaint details." });
  }
});

app.post("/api/complaints/:id/upvote", authenticate, async (req: any, res: any) => {
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [req.params.id]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    const complaint = parseComplaint(complaintRow);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    if (!complaint.upvotedUserIds.includes(req.user.id)) {
      complaint.upvotedUserIds.push(req.user.id);
      complaint.upvotesCount += 1;
      const updatedAt = new Date().toISOString();

      let priority = complaint.priority;
      if (complaint.upvotesCount >= 10 && complaint.priority !== Priority.CRITICAL) {
        priority = Priority.CRITICAL;
      } else if (complaint.upvotesCount >= 5 && complaint.priority === Priority.MEDIUM) {
        priority = Priority.HIGH;
      }

      await dbRun(
        `UPDATE Complaints 
         SET upvotedUserIds = ?, upvotesCount = ?, priority = ?, updatedAt = ? 
         WHERE id = ?`,
        [JSON.stringify(complaint.upvotedUserIds), complaint.upvotesCount, priority, updatedAt, complaint.id]
      );

      await dbRun(
        `INSERT INTO StatusHistory (id, complaintId, status, updatedBy, updatedByName, remarks, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId("hist"),
          complaint.id,
          complaint.status,
          req.user.id,
          req.user.name,
          `${req.user.name} backed this complaint (${complaint.upvotesCount} total supporters).`,
          updatedAt
        ]
      );
    }

    return res.json({ success: true, upvotesCount: complaint.upvotesCount });
  } catch (err: any) {
    console.error("Upvote complaint error:", err);
    return res.status(500).json({ error: "Failed to register upvote." });
  }
});

app.post("/api/complaints/:id/feedback", authenticate, async (req: any, res: any) => {
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [req.params.id]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    const complaint = parseComplaint(complaintRow);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    if (complaint.citizenId !== req.user.id) {
      return res.status(403).json({ error: "You can only rate your own complaints." });
    }

    const { rating, feedback } = req.body || {};
    const feedbackRating = Number(rating) || 5;
    const feedbackText = feedback || "";
    const updatedAt = new Date().toISOString();

    // 1. Insert into Feedback table
    await dbRun(
      `INSERT OR REPLACE INTO Feedback (id, complaintId, citizenId, rating, feedback, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId("feed"), complaint.id, req.user.id, feedbackRating, feedbackText, updatedAt]
    );

    // 2. Update complaint details
    await dbRun(
      `UPDATE Complaints SET citizenRating = ?, citizenFeedback = ?, updatedAt = ? WHERE id = ?`,
      [feedbackRating, feedbackText, updatedAt, complaint.id]
    );

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Submit feedback error:", err);
    return res.status(500).json({ error: "Failed to record feedback." });
  }
});

app.post("/api/complaints/:id/assign", authenticate, requireRole(Role.ADMIN), async (req: any, res: any) => {
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [req.params.id]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    const { officerId, departmentId, estimatedDays } = req.body || {};
    const officer = await dbGet("SELECT * FROM Officers WHERE id = ?", [officerId]);
    const department = await dbGet("SELECT * FROM Departments WHERE id = ?", [departmentId]);

    if (!officer) return res.status(400).json({ error: "Selected officer not found." });

    const now = new Date().toISOString();
    const days = Number(estimatedDays) || 5;
    const estimatedResolutionTime = new Date(Date.now() + days * 86400000).toISOString();

    await dbRun(
      `UPDATE Complaints SET 
        assignedOfficerId = ?, 
        assignedOfficerName = ?, 
        departmentId = ?, 
        departmentName = ?, 
        status = ?, 
        estimatedResolutionTime = ?, 
        updatedAt = ? 
       WHERE id = ?`,
      [
        officer.id,
        officer.name,
        department?.id || complaintRow.departmentId,
        department?.name || complaintRow.departmentName,
        ComplaintStatus.ASSIGNED,
        estimatedResolutionTime,
        now,
        complaintRow.id
      ]
    );

    // History
    await dbRun(
      `INSERT INTO StatusHistory (id, complaintId, status, updatedBy, updatedByName, remarks, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId("hist"),
        complaintRow.id,
        ComplaintStatus.ASSIGNED,
        req.user.id,
        req.user.name,
        `Dispatched to ${officer.name} (${department?.name || complaintRow.departmentName}). Estimated resolution in ${days} day(s).`,
        now
      ]
    );

    // Notification
    await dbRun(
      `INSERT INTO Notifications (id, userId, title, message, read, type, createdAt) 
       VALUES (?, ?, ?, ?, 0, 'COMPLAINT_ASSIGNED', ?)`,
      [
        generateId("notif"),
        complaintRow.citizenId,
        "Squad Dispatched",
        `${officer.name} from ${department?.name || complaintRow.departmentName} has been assigned to your complaint "${complaintRow.title}".`,
        now
      ]
    );

    const updated = await dbGet("SELECT * FROM Complaints WHERE id = ?", [complaintRow.id]);
    return res.json({ success: true, complaint: parseComplaint(updated) });
  } catch (err: any) {
    console.error("Assign complaint error:", err);
    return res.status(500).json({ error: "Failed to assign complaint." });
  }
});

app.post("/api/complaints/:id/status", authenticate, requireRole(Role.OFFICER), async (req: any, res: any) => {
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [req.params.id]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    if (complaintRow.assignedOfficerId !== req.officer?.id) {
      return res.status(403).json({ error: "This complaint is not assigned to you." });
    }

    const { status, remarks, imageUrl } = req.body || {};
    if (!remarks) return res.status(400).json({ error: "Remarks are required." });
    if (!Object.values(ComplaintStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE Complaints SET status = ?, updatedAt = ? WHERE id = ?`,
      [status, now, complaintRow.id]
    );

    // History
    await dbRun(
      `INSERT INTO StatusHistory (id, complaintId, status, updatedBy, updatedByName, remarks, imageUrl, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId("hist"),
        complaintRow.id,
        status,
        req.user.id,
        req.user.name,
        remarks,
        imageUrl || null,
        now
      ]
    );

    // Notification
    await dbRun(
      `INSERT INTO Notifications (id, userId, title, message, read, type, createdAt) 
       VALUES (?, ?, ?, ?, 0, 'COMPLAINT_STATUS', ?)`,
      [
        generateId("notif"),
        complaintRow.citizenId,
        "Complaint Status Updated",
        `"${complaintRow.title}" is now ${String(status).replace("_", " ")}.`,
        now
      ]
    );

    const updated = await dbGet("SELECT * FROM Complaints WHERE id = ?", [complaintRow.id]);
    return res.json({ success: true, complaint: parseComplaint(updated) });
  } catch (err: any) {
    console.error("Update status error:", err);
    return res.status(500).json({ error: "Failed to update complaint status." });
  }
});

app.post("/api/complaints/:id/escalate", authenticate, requireRole(Role.ADMIN), async (req: any, res: any) => {
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [req.params.id]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE Complaints SET status = ?, priority = ?, updatedAt = ? WHERE id = ?`,
      [ComplaintStatus.ESCALATED, Priority.CRITICAL, now, complaintRow.id]
    );

    // History
    await dbRun(
      `INSERT INTO StatusHistory (id, complaintId, status, updatedBy, updatedByName, remarks, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId("hist"),
        complaintRow.id,
        ComplaintStatus.ESCALATED,
        req.user.id,
        req.user.name,
        `Escalated by admin ${req.user.name}. Senior executives notified.`,
        now
      ]
    );

    // Notification
    await dbRun(
      `INSERT INTO Notifications (id, userId, title, message, read, type, createdAt) 
       VALUES (?, ?, ?, ?, 0, 'COMPLAINT_STATUS', ?)`,
      [
        generateId("notif"),
        complaintRow.citizenId,
        "Complaint Escalated",
        `"${complaintRow.title}" has been escalated for urgent attention.`,
        now
      ]
    );

    const updated = await dbGet("SELECT * FROM Complaints WHERE id = ?", [complaintRow.id]);
    return res.json({ success: true, complaint: parseComplaint(updated) });
  } catch (err: any) {
    console.error("Escalate complaint error:", err);
    return res.status(500).json({ error: "Failed to escalate complaint." });
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

app.get("/api/notifications", authenticate, async (req: any, res: any) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM Notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50",
      [req.user.id]
    );
    const notifications = rows.map((n) => ({
      ...n,
      read: n.read === 1,
    }));
    return res.json(notifications);
  } catch (err: any) {
    console.error("Fetch notifications error:", err);
    return res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

app.post("/api/notifications/read", authenticate, async (req: any, res: any) => {
  try {
    await dbRun("UPDATE Notifications SET read = 1 WHERE userId = ?", [req.user.id]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Read notifications error:", err);
    return res.status(500).json({ error: "Failed to mark notifications as read." });
  }
});

// ============================================================================
// DEPARTMENTS / OFFICERS
// ============================================================================

app.get("/api/departments", async (_req: any, res: any) => {
  try {
    const departments = await dbAll("SELECT * FROM Departments");
    return res.json(departments);
  } catch (err: any) {
    console.error("Fetch departments error:", err);
    return res.status(500).json({ error: "Failed to fetch departments." });
  }
});

app.get("/api/officers", async (_req: any, res: any) => {
  try {
    const officers = await dbAll("SELECT * FROM Officers");
    return res.json(officers);
  } catch (err: any) {
    console.error("Fetch officers error:", err);
    return res.status(500).json({ error: "Failed to fetch officers." });
  }
});

// ============================================================================
// ANALYTICS (admin only)
// ============================================================================

app.get("/api/analytics", authenticate, requireRole(Role.ADMIN), async (_req: any, res: any) => {
  try {
    const complaintsRows = await dbAll("SELECT * FROM Complaints");
    const complaints = complaintsRows.map(parseComplaint);

    const summary = {
      total: complaints.length,
      resolved: complaints.filter((c) => c.status === ComplaintStatus.RESOLVED).length,
      inProgress: complaints.filter((c) => c.status === ComplaintStatus.IN_PROGRESS || c.status === ComplaintStatus.ASSIGNED).length,
      escalated: complaints.filter((c) => c.status === ComplaintStatus.ESCALATED).length,
    };

    const categoryCounts: Record<string, number> = {};
    complaints.forEach((c) => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });
    const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

    // Last 6 months trend
    const monthlyTrends: { month: string; submitted: number; resolved: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString("default", { month: "short" });
      const submitted = complaints.filter((c) => {
        const cd = new Date(c.createdAt);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      const resolved = complaints.filter((c) => {
        if (c.status !== ComplaintStatus.RESOLVED) return false;
        const cd = new Date(c.updatedAt);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      monthlyTrends.push({ month: monthLabel, submitted, resolved });
    }

    const departments = await dbAll("SELECT * FROM Departments");
    const departmentStats = departments.map((dept) => {
      const deptComplaints = complaints.filter((c) => c.departmentId === dept.id);
      const resolved = deptComplaints.filter((c) => c.status === ComplaintStatus.RESOLVED).length;
      const total = deptComplaints.length;
      const efficiency = total > 0 ? Math.round((resolved / total) * 100) : 0;
      return { department: dept.code, total, resolved, efficiency };
    });

    return res.json({ summary, categoryData, monthlyTrends, departmentStats });
  } catch (err: any) {
    console.error("Fetch analytics error:", err);
    return res.status(500).json({ error: "Failed to fetch analytics." });
  }
});

// ============================================================================
// AI ROUTES
// ============================================================================

app.post("/api/ai/chat", authenticate, async (req: any, res: any) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  if (!apiKey) {
    console.error("❌ Gemini API Key is missing!");
    return res.status(500).json({ error: "Gemini API Key is missing. Please configure GEMINI_API_KEY in your .env file." });
  }

  try {
    let contextStr = "";
    if (req.user) {
      contextStr += `Current Logged-in User Profile:\n`;
      contextStr += `- Name: ${req.user.name}\n`;
      contextStr += `- Email: ${req.user.email}\n`;
      contextStr += `- Role: ${req.user.role}\n`;
      if (req.user.phone) contextStr += `- Phone: ${req.user.phone}\n`;

      // Fetch complaints
      let query = "";
      let params = [];
      if (req.user.role === Role.CITIZEN) {
        query = "SELECT * FROM Complaints WHERE citizenId = ?";
        params = [req.user.id];
      } else if (req.user.role === Role.OFFICER) {
        const officerId = req.officer?.id || "";
        query = "SELECT * FROM Complaints WHERE assignedOfficerId = ?";
        params = [officerId];
      } else {
        // ADMIN sees everything
        query = "SELECT * FROM Complaints";
        params = [];
      }

      const complaintRows = await dbAll(query, params);
      const complaints = complaintRows.map(parseComplaint);

      if (complaints.length > 0) {
        contextStr += `\nUser's Complaints in Database:\n`;
        complaints.forEach((c: any, index: number) => {
          contextStr += `Complaint #${index + 1}:\n`;
          contextStr += `  - ID: ${c.id}\n`;
          contextStr += `  - Title: ${c.title}\n`;
          contextStr += `  - Description: ${c.description}\n`;
          contextStr += `  - Category: ${c.category}\n`;
          contextStr += `  - Status: ${c.status}\n`;
          contextStr += `  - Priority: ${c.priority}\n`;
          contextStr += `  - Area: ${c.area}, Street: ${c.street}\n`;
          contextStr += `  - Created At: ${c.createdAt}\n`;
          contextStr += `  - Support Count: ${c.upvotesCount}\n`;
          if (c.citizenRating) contextStr += `  - User Rating: ${c.citizenRating}/5\n`;
          if (c.citizenFeedback) contextStr += `  - User Feedback: "${c.citizenFeedback}"\n`;
        });
      } else {
        contextStr += `\nUser's Complaints in Database: None\n`;
      }
    }

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.text) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.text }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    if (!ACTIVE_CHAT_MODEL) {
      throw new Error("No active Gemini model verified. Please check server configuration.");
    }

    console.log(`🤖 [Gemini API Request] Sending generation request to model: ${ACTIVE_CHAT_MODEL}`);
    console.log(`🤖 [Gemini API Request] Prompt message: "${message}"`);
    console.log(`🤖 [Gemini API Request] System context length: ${contextStr.length} chars`);

    const response = await ai.models.generateContent({
      model: ACTIVE_CHAT_MODEL,
      contents: contents,
      config: {
        systemInstruction: `You are CivicAI, an intelligent municipal complaint management assistant.
Help citizens file complaints, answer civic questions, guide users through complaint categories, explain complaint status, and provide government service information.
Be polite, professional, and use concise answers. Do not hallucinate. If you don't know something, say so honestly.
If the user describes a physical city problem or issue they want to report (like potholes, garbage, street light outages, broken pipes, etc.), extract the structured complaint details:
- Category (e.g. Roads, Garbage, Water Supply, Electricity, Noise Pollution, Public Safety, etc.)
- Priority (Low, Medium, High, Critical)
- Location (Any location details mentioned, or "Unknown" if not specified)
- Suggested Department (e.g. Roads & Infrastructure, Waste Management, Water & Sewage, Electricity, Public Safety, etc.)
- Suggested Title (Concise title of the issue)
Provide these extracted details in a clean Markdown table or list at the very end of your response, under the heading "### 📋 Extracted Complaint Details".

Here is the database context of the current logged-in user and their complaints. Use this real data to answer questions about their complaints, summarize them, check statuses, check priorities, count pending issues, etc. if asked:
${contextStr}

For all other queries, respond conversationally in natural Markdown format without compiling structured complaint details.`,
      }
    });

    console.log(`🤖 [Gemini API Response] Successfully generated content!`);
    console.log(`🤖 [Gemini API Response] Length: ${response.text?.length || 0} chars`);

    return res.json({ id: `bot-msg-${Date.now()}`, reply: response.text, text: response.text, sender: "bot" });
  } catch (apiError: any) {
    console.error("❌ Gemini API Call Failed: - server.ts", apiError);
    
    const errStr = String(apiError.message || apiError).toLowerCase();
    let errorExplanation = "";
    if (errStr.includes("key") || errStr.includes("api_key") || errStr.includes("unauthorized") || errStr.includes("invalid") || errStr.includes("identity")) {
      errorExplanation = "The configured GEMINI_API_KEY appears to be invalid or restricted. Please create a new valid API key in Google AI Studio (https://aistudio.google.com/) and replace the GEMINI_API_KEY in your .env file.";
    } else if (errStr.includes("quota") || errStr.includes("limit") || errStr.includes("rate") || errStr.includes("429")) {
      errorExplanation = "The Gemini API quota limit for this account or model has been exceeded. Please wait a minute before retrying, check your billing details, or check rate limits in Google AI Studio.";
    } else {
      errorExplanation = `Gemini API Request failed due to server/api error: ${apiError.message || apiError}`;
    }

    return res.status(500).json({ error: errorExplanation });
  }
});

app.post("/api/ai/smart-reply", authenticate, requireRole(Role.ADMIN), async (req: any, res: any) => {
  const { complaintId } = req.body || {};
  try {
    const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [complaintId]);
    if (!complaintRow) return res.status(404).json({ error: "Complaint not found." });

    const complaint = parseComplaint(complaintRow);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    if (!apiKey) {
      return res.json({ reply: generateSmartReply(complaint) });
    }

    if (!ACTIVE_CHAT_MODEL) {
      throw new Error("No active Gemini model verified. Please check server configuration.");
    }

    const response = await ai.models.generateContent({
      model: ACTIVE_CHAT_MODEL,
      contents: `Draft a short, professional, empathetic municipal response to a citizen complaint. Citizen: ${complaint.citizenName}. Title: ${complaint.title}. Category: ${complaint.category}. Status: ${complaint.status}. Description: ${complaint.description}`,
    });
    return res.json({ reply: response.text });
  } catch (apiError: any) {
    console.error("❌ Gemini smart-reply failed, falling back to template - server.ts", apiError);
    // fallback
    try {
      const complaintRow = await dbGet("SELECT * FROM Complaints WHERE id = ?", [complaintId]);
      const complaint = parseComplaint(complaintRow);
      return res.json({ reply: generateSmartReply(complaint) });
    } catch {
      return res.status(500).json({ error: "Failed to generate smart reply." });
    }
  }
});

// --- VITE FRONTEND MIDDLEWARE ---
async function startServer() {
  // Trigger eager database and model setup locally
  await ensureDbInitialized();

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        let template = await fs.promises.readFile(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 [CivicAI] Server running on port ${PORT}.`);
    console.log(`   Seeded logins → admin@civicai.com / Admin@123 | citizen@civicai.com / Citizen@123 | thomas@civicai.com / Officer@123`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("❌ Failed to start server:", err);
  });
}

export default app;
