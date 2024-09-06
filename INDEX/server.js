const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const csvFilePath = path.join(__dirname, 'data', 'application_hall_ticket_numbers.csv');
const collegeDataFilePath = path.join(__dirname, 'data', 'college_data.csv');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let users = [];
let collegeData = [];

// Read users data from CSV
fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
        users.push(row);
    })
    .on('end', () => {
        console.log('Users CSV file successfully processed');
    });

// Read college data from CSV
fs.createReadStream(collegeDataFilePath)
    .pipe(csv())
    .on('data', (row) => {
        collegeData.push(row);
    })
    .on('end', () => {
        console.log('College Data CSV file successfully processed');
    });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Signup route
app.post('/signup', (req, res) => {
    const { application_number, hall_ticket_number } = req.body;

    const user = users.find(u => u.application_number === application_number && u.hall_ticket_number === hall_ticket_number);

    if (user) {
        if (user.secret_key) {
            res.send({ success: false, message: 'User already exists' });
        } else {
            res.send({ success: true });
        }
    } else {
        res.send({ success: false, message: 'Invalid credentials' });
    }
});

// Generate random number for secret key
app.post('/generate-random', (req, res) => {
    const { application_number } = req.body;

    const userIndex = users.findIndex(u => u.application_number === application_number);
    if (userIndex !== -1) {
        const randomNumber = generateRandomNumber();
        users[userIndex].secret_key = randomNumber;

        const csvWriter = createCsvWriter({
            path: csvFilePath,
            header: [
                { id: 'application_number', title: 'application_number' },
                { id: 'hall_ticket_number', title: 'hall_ticket_number' },
                { id: 'secret_key', title: 'secret_key' },
                { id: 'rank', title: 'rank' }
            ]
        });

        csvWriter.writeRecords(users)
            .then(() => {
                console.log('CSV file updated');
                res.send({ success: true, random_number: randomNumber });
            });
    } else {
        res.send({ success: false, message: 'User not found' });
    }
});

// Login route
app.post('/login', (req, res) => {
    const { application_number, password } = req.body;

    const user = users.find(u => u.application_number === application_number && u.secret_key === password);

    if (user) {
        res.send({ success: true, application_number: user.application_number });
    } else {
        res.send({ success: false, message: 'Invalid credentials' });
    }
});

// Get rank based on hall ticket number
app.post('/getRank', (req, res) => {
    const { hallTicket } = req.body;

    const user = users.find(u => u.hall_ticket_number === hallTicket);

    if (user) {
        const rank = user.rank || Math.floor(Math.random() * 1000); // Example rank logic
        res.send({ success: true, rank });
    } else {
        res.send({ success: false, message: 'Invalid hall ticket number' });
    }
});
// Get rank based on hall ticket number and application number
app.post('/getRank', (req, res) => {
    const { application_number, hallTicket } = req.body;

    const user = users.find(u => u.application_number === application_number && u.hall_ticket_number === hallTicket);

    if (user) {
        const rank = user.rank || Math.floor(Math.random() * 1000); // Example rank logic
        res.send({ success: true, rank });
    } else {
        res.send({ success: false, message: 'Invalid hall ticket number or application number' });
    }
});
// Validate rank based on hall ticket number and application number
app.post('/validateRank', (req, res) => {
    const { application_number, hallTicket, rank } = req.body;

    const user = users.find(u => u.application_number === application_number && u.hall_ticket_number === hallTicket);

    if (user) {
        if (user.rank === rank) {
            res.send({ success: true });
        } else {
            res.send({ success: false, message: 'Invalid rank' });
        }
    } else {
        res.send({ success: false, message: 'Invalid hall ticket number or application number' });
    }
});


// Validate rank based on hall ticket number
app.post('/validateRank', (req, res) => {
    const { hallTicket, rank } = req.body;

    const user = users.find(u => u.hall_ticket_number === hallTicket);

    if (user) {
        if (user.rank === rank) {
            res.send({ success: true });
        } else {
            res.send({ success: false, message: 'Invalid rank' });
        }
    } else {
        res.send({ success: false, message: 'Invalid hall ticket number' });
    }
});

//Fetch college data based on branch and rank
// app.post('fetch_college_data', (req, res) => {
//     const { branch, rank } = req.body;

//     // Filter colleges by selected branch and calculate chances
//     const filteredColleges = collegeData.filter(college => college.branch == branch).map(college => {
//         const chance = calculateChance(rank, college.gm_rank);
//         return {
//             college_id: college.college_id,
//             college_name: college.college_name,
//             gm_rank: college.gm_rank,
//             chance: chance.toFixed(2) + '%'  // Format the chance as a percentage
//         };
//     });

//     if (filteredColleges.length > 0) {
//         res.send({ success: true, data: filteredColleges });
//     } else {
//         res.send({ success: false, message: 'No colleges found for the given criteria' });
//     }
// });

app.get('/college_data', (req, res) => {
    const { branch, rank } = req.query;

    // Filter colleges based on selected branch and calculate the chance
    const filteredColleges = collegeData
        .filter(college => college.branch === branch)
        .map(college => {
            const chance = calculateChance(Number(rank), Number(college.gm_rank));
            return {
                ...college,
                chance
            };
        })
        .filter(college => college.chance > 0) // Exclude colleges with a chance of 0
        .sort((a, b) => b.chance - a.chance); // Sort colleges by chance in descending order

    res.json(filteredColleges);
});




// Function to calculate the chance of getting a seat
function calculateChance(studentRank, gm_rank) {
    if (studentRank <= gm_rank) {
        let chance = (gm_rank - studentRank) / gm_rank;
        return Math.min(Math.max(chance, 0), 1) * 100;
    } else {
        return 0;
    }
}

// Generate a random secret key
function generateRandomNumber() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Start the server
app.listen(PORT, () => {
    console.log("Server is running on port ${PORT}");
});      