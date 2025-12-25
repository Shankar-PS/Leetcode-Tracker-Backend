const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());

// DB
const db = new sqlite3.Database("./problems.db", (err) => {
    if (err) console.log("DB error:", err.message);
    else console.log("DB connected");
});

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

    const { problem_no } = req.body;

    // guard
    if (!problem_no) {
        return res.status(400).json({ msg: "problem_no missing" });
    }

    const query = `
query problemsetQuestionListV2($limit: Int, $skip: Int) {
  problemsetQuestionListV2(limit: $limit, skip: $skip) {
    questions {
      questionFrontendId
      title
      difficulty
    }
  }
}
`;


    try {
        const response = await axios.post(
            "https://leetcode.com/graphql",
            {
                query
            }
            ,
            {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://leetcode.com",
                    "Origin": "https://leetcode.com"
                }
            }
        );

        const questions =
            response.data?.data?.problemsetQuestionList?.questions || [];

        const question = questions.find(
            q => q.questionFrontendId === problem_no
        );


        if (!question) {
            return res.status(404).json({ msg: "Problem not found" });
        }

        const today = new Date().toISOString().split("T")[0];

        db.run(
            `INSERT INTO problems (problem_no, title, difficulty, date)
       VALUES (?, ?, ?, ?)`,
            [problem_no, question.title, question.difficulty, today],
            function (err) {
                if (err) {
                    console.log("DB insert error:", err.message);
                    return res.status(500).json({ msg: "DB insert failed" });
                }

                res.json({
                    msg: "Saved",
                    data: {
                        problem_no,
                        title: question.title,
                        difficulty: question.difficulty,
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

app.get("/", (req, res) => {
    res.send("LeetCode Tracker Running");
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});
