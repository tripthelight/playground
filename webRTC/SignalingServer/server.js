import dotenv from 'dotenv';
dotenv.config();
import { WebSocketServer } from "ws";

const host = process.env.HOST;
const port = process.env.PORT || 8080; 
const wss = new WebSocketServer({ host, port });
