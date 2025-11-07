const express = require('express');
const path = require('path');
const fs = require('fs'); // Add this line at the top
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve specific pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'scoreboard.html'));
});

// Serve other HTML files directly
app.get('/:page', (req, res) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, page.endsWith('.html') ? page : `${page}.html`);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        // If file doesn't exist, try to find it in subdirectories
        const files = getAllFiles(__dirname);
        const foundFile = files.find(file => file.endsWith(`/${page}.html`));

        if (foundFile) {
            res.sendFile(foundFile);
        } else {
            // Fallback to the main page
            res.sendFile(path.join(__dirname, 'scoreboard.html'));
        }
    }
});

// Helper function to get all files recursively
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Access from other devices: http://YOUR_IP_ADDRESS:${PORT}`);
});