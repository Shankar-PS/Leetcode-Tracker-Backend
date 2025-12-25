const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());
const cors = require("cors");
app.use(cors());


// DB
const path = require("path");

const db = new sqlite3.Database(
    path.join(__dirname, "problems.db")
);
// const db = new sqlite3.Database("./problems.db", (err) => {
//     if (err) console.log("DB error:", err.message);
//     else console.log("DB connected");
// });

db.run(`
  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_no TEXT,
    title TEXT,
    difficulty TEXT,
    date TEXT
  )
`);


// API
app.post("/add-problem", async (req, res) => {
    console.log("API HIT");
    console.log("Body:", req.body);

    const { titleSlug } = req.body;

    if (!titleSlug) {
        return res.status(400).json({ msg: "titleSlug missing" });
    }

    const query = `
    query getQuestion($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        difficulty
      }
    }
  `;

    try {
        const response = await axios.post(
            "https://leetcode.com/graphql",
            {
                query,
                variables: { titleSlug }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://leetcode.com",
                    "Origin": "https://leetcode.com"
                }
            }
        );

        const q = response.data?.data?.question;

        if (!q) {
            return res.status(404).json({ msg: "Question not found" });
        }

        const today = new Date().toISOString().split("T")[0];

        db.run(
            `INSERT INTO problems (problem_no, title, difficulty, date)
       VALUES (?, ?, ?, ?)`,
            [q.questionFrontendId, q.title, q.difficulty, today],
            (err) => {
                if (err) return res.status(500).json({ msg: "DB insert failed" });

                res.json({
                    msg: "Saved",
                    data: {
                        problemNo: q.questionFrontendId,
                        title: q.title,
                        difficulty: q.difficulty,
                        date: today
                    }
                });
            }
        );
    } catch (err) {
        console.log("Axios error:", err.response?.data || err.message);
        res.status(500).json({ msg: "LeetCode fetch failed" });
    }
});

// debug: view DB
app.get("/all", (req, res) => {
    db.all("SELECT * FROM problems", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});
app.get("/problems", (req, res) => {
    db.all("SELECT * FROM problems ORDER BY id DESC", [], (err, rows) => {
        res.json(rows);
    });
});


app.get("/", (req, res) => {
    res.send("LeetCode Tracker Running");
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});
