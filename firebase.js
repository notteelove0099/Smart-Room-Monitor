import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAzjzRdjIuOnb0U0uOFuxvyptNpu_x3usc",
  databaseURL: "https://test-mode-f8aca-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-mode-f8aca",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);