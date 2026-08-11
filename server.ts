import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

let firebaseConfig: any = null;
try {
  const configContent = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8');
  firebaseConfig = JSON.parse(configContent);
} catch (e) {
  console.warn("Could not read firebase-applet-config.json", e);
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

let db: any = null;
if (firebaseConfig) {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");
}

app.post("/api/store", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Firebase not configured" });
  }
  try {
    const { key, value } = req.body;
    await setDoc(doc(db, "app_data", key), { value });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/load/:key", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Firebase not configured" });
  }
  try {
    const key = req.params.key;
    const docSnap = await getDoc(doc(db, "app_data", key));
    if (docSnap.exists()) {
      res.json({ value: docSnap.data().value });
    } else {
      res.json({ value: null });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
