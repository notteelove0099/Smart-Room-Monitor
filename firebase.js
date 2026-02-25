import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "......",
  databaseURL: ".....",
  projectId: ".....",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
