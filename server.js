const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Enable CORS for all domains (for testing purposes, adjust as needed)
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (e.g., your CSS, JS, images)
app.use(express.static(path.join(__dirname, '')));  // Adjust to your static file directory

// Reinitialize user_data.json file on server start (clear contents)
const userDataFilePath = 'user_data.json';

const initializeUserDataFile = () => {
  // Always reinitialize the file to an empty array on server start
  fs.writeFile(userDataFilePath, JSON.stringify([], null, 2), (err) => {
    if (err) {
      console.error('Error reinitializing user_data.json:', err);
    } else {
      console.log('user_data.json has been reinitialized.');
    }
  });
};

// Ensure the file is initialized on server start
initializeUserDataFile();

// Define a route for the root URL to serve your index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'user_study.html'));
});

// Helper function to read user data from file
const readUserData = (callback) => {
  fs.readFile(userDataFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return callback(err, []);
    }
    try {
      const userDataList = JSON.parse(data);
      callback(null, userDataList);
    } catch (parseErr) {
      console.error('Error parsing JSON data:', parseErr);
      callback(parseErr);
    }
  });
};


app.post('/save-data', (req, res) => {
  const userData = req.body;
  console.log('Received user data:', userData);

  // Validate the received data
  if (!userData || !userData.userName || userData.userProgress === undefined || !userData.userChoices) {
    return res.status(400).json({ message: 'Missing required data' });
  }

  // Prepare the data to save (add timestamp)
  const dataToSave = {
    userName: userData.userName,
    userChoices: userData.userChoices,
    userProgress: userData.userProgress, // Unify all progress into this variable
    timestamp: new Date().toISOString() // Add timestamp for when the data was saved
  };

  // Read existing data from file
  readUserData((err, userDataList) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to read existing data' });
    }

    // Check if the user already exists and append or update the data
    const existingUser = userDataList.find(user => user.userName === userData.userName);
    if (existingUser) {
      // Update the existing user's data with the new progress and choices
      existingUser.userChoices.push(...userData.userChoices);
      existingUser.userProgress = userData.userProgress; // Update the progress
    } else {
      // If the user doesn't exist, add a new entry
      userDataList.push(dataToSave);
    }

    // Write the updated list back to the file
    fs.writeFile(userDataFilePath, JSON.stringify(userDataList, null, 2), (writeErr) => {
      if (writeErr) {
        console.error('Error saving data:', writeErr);
        return res.status(500).json({ message: 'Failed to save data' });
      }

      console.log('Data saved successfully!');
      res.json({ message: 'Data saved successfully!' });
    });
  });
});

// New route to view the choice counts
app.get('/view-json', (req, res) => {
  // Read the user data from file
  readUserData((err, userDataList) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to read existing data' });
    }

    // Calculate the summary of 1s, 2s, and 3s across all userChoices
    const choiceCounts = {'original':{ 1: 0, 2: 0, 0:0}};
    userDataList.forEach(user => {
      user.userChoices.forEach(([_, choice, tag]) => {
        if (choiceCounts.hasOwnProperty(tag) && choiceCounts[tag].hasOwnProperty(choice)) {
          choiceCounts[tag][choice]++;
        }
      });
    });

    // Send the summary as a response
    res.json({ choiceCounts });
  });
});

// Route to get user's progress (unified)
app.get('/user-data', (req, res) => {
  const { userName } = req.query;

  // Read data to find the user
  readUserData((err, userDataList) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to read user data' });
    }

    const user = userDataList.find(u => u.userName === userName);
    if (user) {
      res.json({ userData: user });  // Send unified progress
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  });
});
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
app.get('/download-json', (req, res) => {
  // Send the user_data.json file for download
  res.download(userDataFilePath, 'user_data.json', (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).json({ message: 'Failed to download file' });
    }
  });
});
// Start the server on port 3000
const PORT = process.env.PORT || 3000;
// const PORT =  3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
