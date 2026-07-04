const pool = require('../config/db');

// Helper to query Gemini API
async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("La clé API Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Erreur de l'API Gemini (Status: ${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Aucune réponse générée par l'IA.");
  }
  return text.trim();
}

// POST /api/ai/chat
exports.chat = async (req, res, next) => {
  const { message, history } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ message: "Le message est requis." });
  }

  try {
    const systemPrompt = `Tu es Antigravity, un assistant IA collaboratif et intelligent au sein de la super-app TaskFlow.
Tu aides les utilisateurs à s'organiser, gérer leurs projets, coder, et planifier leurs études ou leur business.
Sois concis, professionnel et utilise un ton chaleureux. Utilise le markdown pour formater tes réponses.`;

    let fullPrompt = `${systemPrompt}\n\n`;
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        fullPrompt += `${h.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${h.content}\n`;
      });
    }
    fullPrompt += `Utilisateur: ${message.trim()}\nAssistant:`;

    const reply = await callGemini(fullPrompt);
    res.json({ reply });
  } catch (err) {
    console.error("Erreur Chat IA :", err.message);
    res.status(500).json({ message: err.message || "Une erreur est survenue lors de l'appel à l'assistant IA." });
  }
};

// POST /api/ai/generate-tasks
exports.generateTasks = async (req, res, next) => {
  const { projectDescription, workspaceId } = req.body;
  if (!projectDescription || !projectDescription.trim()) {
    return res.status(400).json({ message: "La description du projet est requise." });
  }

  try {
    const prompt = `Tu es un assistant chef de projet expérimenté.
L'utilisateur souhaite planifier le projet/l'idée suivante : "${projectDescription.trim()}"
Génère une liste de 4 à 6 tâches concrètes et bien structurées pour démarrer ce projet.
Renvoie STRICTEMENT un tableau JSON valide, sans aucune balise markdown comme \`\`\`json ou autre texte.
Chaque objet tâche du tableau doit avoir EXACTEMENT la structure suivante :
{
  "title": "Titre clair et court de la tâche",
  "description": "Description concise mais informative de l'action à mener",
  "priority": "basse" | "moyenne" | "haute",
  "tag": "Nom du tag en un seul mot (ex: Design, Code, Marketing, Planning, Admin)"
}
Exemple de retour attendu :
[{"title": "Ma tâche", "description": "Faire ceci", "priority": "moyenne", "tag": "Code"}]`;

    const aiResponse = await callGemini(prompt);
    
    // Nettoyer si l'IA a malgré tout ajouté des balises markdown
    let cleanJson = aiResponse;
    if (cleanJson.includes("```")) {
      cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    let parsedTasks;
    try {
      parsedTasks = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("Erreur de parsing du JSON généré par l'IA. Brut :", aiResponse);
      return res.status(500).json({ message: "L'IA a généré une réponse mal formatée. Réessaye avec une description différente." });
    }

    if (!Array.isArray(parsedTasks)) {
      return res.status(500).json({ message: "L'IA n'a pas renvoyé un tableau de tâches." });
    }

    // Insérer les tâches générées
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const createdTasks = [];
      for (const t of parsedTasks) {
        const [result] = await conn.query(
          `INSERT INTO tasks (title, description, priority, tag, status, workspace_id, user_id, tenant_id)
           VALUES (?, ?, ?, ?, 'a_faire', ?, ?, ?)`,
          [
            t.title || "Tâche sans titre",
            t.description || "",
            t.priority || "moyenne",
            t.tag || null,
            workspaceId && workspaceId !== 'personal' ? workspaceId : null,
            req.userId,
            req.tenantId || null
          ]
        );
        createdTasks.push({
          id: result.insertId,
          title: t.title,
          description: t.description,
          priority: t.priority,
          tag: t.tag,
          status: 'a_faire',
          workspace_id: workspaceId && workspaceId !== 'personal' ? workspaceId : null
        });
      }

      await conn.commit();
      res.status(201).json({
        message: `${createdTasks.length} tâches ont été générées et ajoutées à votre espace.`,
        tasks: createdTasks
      });
    } catch (insertErr) {
      await conn.rollback();
      throw insertErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Erreur Génération Tâches IA :", err.message);
    res.status(500).json({ message: err.message || "Une erreur est survenue lors de la génération de tâches." });
  }
};
