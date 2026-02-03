// =============================
// OFFSFANTASY FULL APP - SINGLE FILE STARTER
// Backend + Firebase + Frontend Example
// =============================

// --------------------
// 1️⃣ Backend: Node + Socket.io
// --------------------
const io = require("socket.io")(3001, {
  cors: { origin: "*" },
});

let leagues = {}; // temporary in-memory store for demonstration

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("joinLeague", ({ leagueId }) => {
    socket.join(leagueId);
  });

  socket.on("draftPlayer", ({ leagueId, player, team }) => {
    if (!leagues[leagueId]) leagues[leagueId] = {};
    io.to(leagueId).emit("playerDrafted", { player, team });
  });

  socket.on("sendMessage", ({ leagueId, user, message }) => {
    io.to(leagueId).emit("newMessage", { user, message, time: Date.now() });
  });
});

// --------------------
// 2️⃣ Firebase Setup
// --------------------
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --------------------
// 3️⃣ User Accounts + Profiles
// --------------------
export async function registerUser(email, password, username) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", userCred.user.uid), { username, leagues: [], avatarUrl: null });
}

export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function updateUserProfile(userId, username, avatarUrl) {
  await updateDoc(doc(db, "users", userId), { username, avatarUrl });
}

// --------------------
// 4️⃣ League Creation + Invites + Co-Commissioners
// --------------------
export async function createLeague(leagueId, commissionerId, settings) {
  await setDoc(doc(db, "leagues", leagueId), {
    commissionerId,
    coCommissioners: [],
    settings,
    members: [commissionerId],
    invites: [],
  });
}

export async function inviteUserToLeague(leagueId, email) {
  const inviteCode = Math.random().toString(36).substring(2, 8);
  await updateDoc(doc(db, "leagues", leagueId), { invites: arrayUnion({ email, inviteCode }) });
  return inviteCode;
}

export async function acceptInvite(userId, leagueId, inviteCode) {
  const leagueRef = doc(db, "leagues", leagueId);
  const leagueSnap = await getDoc(leagueRef);
  const invite = leagueSnap.data().invites.find(i => i.inviteCode === inviteCode);
  if (!invite) throw new Error("Invalid invite");
  await updateDoc(leagueRef, { members: arrayUnion(userId) });
  await updateDoc(doc(db, "users", userId), { leagues: arrayUnion(leagueId) });
}

export async function addCoCommissioner(leagueId, userId) {
  await updateDoc(doc(db, "leagues", leagueId), { coCommissioners: arrayUnion(userId) });
}

export function isLeagueAdmin(userId, league) {
  return userId === league.commissionerId || league.coCommissioners?.includes(userId);
}

// --------------------
// 5️⃣ Draft Logic + Snake Draft
// --------------------
export const getSnakeDraftOrder = (round, numTeams) => {
  const order = Array.from({ length: numTeams }, (_, i) => i);
  return round % 2 === 1 ? order : order.reverse();
};

export const createLeagueTeams = (numTeams) => {
  if (numTeams < 4 || numTeams > 32) throw new Error("League must have 4-32 teams");
  return Array.from({ length: numTeams }, (_, i) => ({ id: i, name: `Team ${i+1}`, roster: [] }));
};

// --------------------
// 6️⃣ Draft Timer Hook (React)
// --------------------
import { useEffect, useState } from "react";
export function useDraftTimer(seconds, onExpire) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  useEffect(() => setTimeLeft(seconds), [seconds]);
  useEffect(() => {
    if(timeLeft === 0) { onExpire(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onExpire]);
  return timeLeft;
}

// --------------------
// 7️⃣ PPR Scoring + Custom Scoring
// --------------------
export const PPR_SCORING = { passingYards:0.04, passingTD:4, interception:-2, rushingYards:0.1, rushingTD:6, receivingYards:0.1, receivingTD:6, reception:1, fumbleLost:-2 };

export const calculatePPRPoints = stats =>
  stats.passYds*0.04 + stats.passTD*4 + stats.int*-2 + stats.rushYds*0.1 + stats.rushTD*6 + stats.rec*1 + stats.recYds*0.1 + stats.recTD*6 + stats.fumbles*-2;

export const calculateFantasyPoints = (stats, scoring) =>
  stats.receptions*scoring.ppr + stats.recYds*scoring.recYards + stats.recTD*scoring.recTD + stats.rushTD*scoring.rushTD;

// --------------------
// 8️⃣ Player Rankings + ADP
// --------------------
export const sortByRank = players => [...players].sort((a,b) => a.rank - b.rank);
export const sortByADP = players => [...players].sort((a,b) => a.adp - b.adp);
export function updateADP(player, pickNumber){
  player.timesDrafted++;
  player.totalPicks += pickNumber;
  player.adp = (player.totalPicks / player.timesDrafted).toFixed(1);
}

// --------------------
// 9️⃣ Draft Notifications + Player Locking
// --------------------
export function notifyDraftPick(socket, leagueId, player, team){
  socket.to(leagueId).emit('draftNotification',{message:`${team} drafted ${player.name}`});
}

export function isPlayerLocked(player, playoffStatus){
  return playoffStatus[player.team] === 'eliminated';
}

// --------------------
// 10️⃣ League Chat
// --------------------
socket.on('sendMessage', ({ leagueId, user, message })=>{
  io.to(leagueId).emit('newMessage',{user,message,time:Date.now()});
});
socket.on('newMessage', msg=>{
  setChat(prev=>[...prev,msg]);
});

// --------------------
// 11️⃣ React Frontend Minimal Example
// --------------------
import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div>
      <h1>OffsFantasy 2026 Playoffs</h1>
      <p>Use this starter code to build your draft, chat, and scoring interface!</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

OffsFantasy/
├─ package.json
├─ .gitignore
├─ README.md
├─ server.js                # Node + Socket.io backend
├─ firebase.js              # Firebase config & utils
├─ /functions               # Optional: Firebase Functions for emails/reminders
├─ /public
│   └─ index.html           # React root HTML
├─ /src
│   ├─ index.js             # React entry
│   ├─ App.jsx              # Main app
│   ├─ /components
│   │    ├─ SnakeDraft.jsx  # Draft board, timers, picks
│   │    ├─ LeagueChat.jsx  # Chat interface
│   │    ├─ UserProfile.jsx # Profile, avatar, username
│   ├─ /utils
│   │    ├─ draftLogic.js   # Snake draft + player locking
│   │    ├─ rankings.js     # Player rankings + ADP
│   │    ├─ scoring.js      # PPR + custom scoring
│   └─ /hooks
│        └─ useDraftTimer.js # Draft countdown

const io = require("socket.io")(3001, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("joinLeague", ({ leagueId }) => socket.join(leagueId));

  socket.on("draftPlayer", ({ leagueId, player, team }) => {
    io.to(leagueId).emit("playerDrafted", { player, team });
  });

  socket.on("sendMessage", ({ leagueId, user, message }) => {
    io.to(leagueId).emit("newMessage", { user, message, time: Date.now() });
  });
});

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);

import React from "react";
import SnakeDraft from "./components/SnakeDraft.jsx";
import LeagueChat from "./components/LeagueChat.jsx";
import UserProfile from "./components/UserProfile.jsx";

function App() {
  return (
    <div>
      <h1>OffsFantasy 2026 Playoffs</h1>
      <UserProfile />
      <SnakeDraft />
      <LeagueChat />
    </div>
  );
}

export default App;

import { useEffect, useState } from "react";

export function useDraftTimer(seconds, onExpire) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  useEffect(() => setTimeLeft(seconds), [seconds]);
  useEffect(() => {
    if (timeLeft === 0) { onExpire(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onExpire]);
  return timeLeft;
}

export const getSnakeDraftOrder = (round, numTeams) => {
  const order = Array.from({ length: numTeams }, (_, i) => i);
  return round % 2 === 1 ? order : order.reverse();
};

export const isPlayerLocked = (player, playoffStatus) =>
  playoffStatus[player.team] === 'eliminated';

export const sortByRank = players => [...players].sort((a,b)=>a.rank-b.rank);
export const sortByADP = players => [...players].sort((a,b)=>a.adp-b.adp);

export function updateADP(player, pickNumber){
  player.timesDrafted++;
  player.totalPicks += pickNumber;
  player.adp = (player.totalPicks / player.timesDrafted).toFixed(1);
}

export const PPR_SCORING = { passingYards:0.04, passingTD:4, interception:-2, rushingYards:0.1, rushingTD:6, receivingYards:0.1, receivingTD:6, reception:1, fumbleLost:-2 };

export const calculatePPRPoints = stats =>
  stats.passYds*0.04 + stats.passTD*4 + stats.int*-2 + stats.rushYds*0.1 + stats.rushTD*6 + stats.rec*1 + stats.recYds*0.1 + stats.recTD*6 + stats.fumbles*-2;

git init
git add .
git commit -m "Initial OffsFantasy project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/OffsFantasy.git
git push -u origin main



