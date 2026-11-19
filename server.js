import 'dotenv/config';
import pg from 'pg';

// A pool keeps several connections open and reuses them.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (err) => console.error('Postgres pool error', err));

export const query = (text, params) => pool.query(text, params);
//--------------------------------------------------------------------------------------
import 'dotenv/config';
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL);

redis.on('error', (err) => console.error('Redis error', err));
redis.on('connect', () => console.log('Redis connected'));
//--------------------------------------------------------------------------------------


const express = require('express');
const cassandra = require('cassandra-driver');
const { WebSocketServer } = require('ws');
const { Client } = require('@opensearch-project/opensearch');
const http = require('http');
const effects = require('./effects');
const conditions = require('./conditions');
// Express App
const { v4: uuidv4 } = require('uuid');
const { json } = require('body-parser');

var currplayerid = "";
const PORT = 3003;
const app = express();
const wss = new WebSocketServer({ port:PORT }); // Attach WebSocket server
const playerMap = new Map(); // Maps player names to WebSocket connections

app.use(express.json());


// WebSocket Handling
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message',  async (data) => {
        // Decode the buffer into a string
        const decodedData = data.toString('utf8'); 

        // Parse the JSON data if it's in JSON format
        try {
            const jsonData = JSON.parse(decodedData);
            const eventName = jsonData.eventName;

            switch(eventName){
                case"login?":
                    if (!playerMap.has(jsonData.name)) {
                        playerMap.set(jsonData.name, ws);
                    }
                    const queryplayer = `SELECT * FROM ${TABLE_PLAYERS} WHERE name = ?  ALLOW FILTERING`;
                    const result = await client.execute(queryplayer, [jsonData.name], { prepare: true });
                    currplayerid = result.rows[0].id;
                    if (result.rows.length > 0) {
                        // Player exists
                        ws.send(
                            JSON.stringify({
                                eventName: 'created',
                                name: jsonData.name
                            })
                        );
                    } else {
                        ws.send(
                            JSON.stringify({
                                eventName: 'playernotfound',
                            })
                        );
                    }
                break;
                case"search?":
                    let text = jsonData.text || "";
                    let types = jsonData.types || [];
                    let rarities = jsonData.rarities || [];
                    console.log(rarities);
                    let page = jsonData.page || 1;   // page 1, 2, 3...
                    const PAGE_SIZE = 20;
                    const from = (page - 1) * PAGE_SIZE;
                    try {
                        const mustQuery = text.trim()
                        ? [{
                            multi_match: {
                                query: text,
                                fields: ["name^3", "card_text"],
                                type: "best_fields",
                                operator: "and",
                                minimum_should_match: "100%"
                            }
                            }]
                        : [];

                        const result = await os.search({
                        index: 'cards',
                        body: {
                            from: from,
                            size: PAGE_SIZE,
                            query: {
                            bool: {
                                must: mustQuery,
                                filter: [
                                ...(types.length ? [{ terms: { cardtypes: types } }] : []),
                                ...(rarities.length ? [{ terms: { rarity: rarities } }] : [])
                                ]
                            }
                            }
                        }
                        });

                        const cards = result.body.hits.hits.map(h => h._source);
                        ws.send(JSON.stringify({
                            eventName: "search_result",
                            page: page,
                            total: result.body.hits.total.value,
                            results: cards,
                        }));

                    } catch (err) {
                        console.error("OpenSearch error:", err);

                        ws.send(JSON.stringify({
                            eventName: "search_error",
                            message: "Search failed"
                        }));
                    }

                break;
                case"queue?":
                    
                break;
            }
            // Echo a response back
        } catch (error) {
            console.error('Error parsing JSON:', error);
            console.log('Raw Received Data:', decodedData);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        for (const [playerName, connection] of playerMap.entries()) {
            if (connection === ws) {
                playerMap.delete(playerName);
                break;
            }
        }
    });
});