# **MW2 Top 250 Leaderboard Discord Bot**

This is a Discord Bot I decided to create for my Discord Server so users can search the LIVE Top 250 Leaderboards MW2 has within the game. Most people in my server grind constantly to hit or maintain Top 250 in the world, so when they are out doing things IRL, this is something they can use to check their current rank or see all Top 250 players.

## **How to Use**

1. Search for a player on the Top 250 Leaderboards - `/t250 {playerName}`
2. Display the entire Top 250 Leaderboards - `/t250 all`

Yes, the /all has built in pagination!

### **Installing**

Clone the repository to your local machine:

```
git clone https://github.com/<your-username>/mw2-ranked-bot.git
```

Change into the directory:

```
cd mw2-ranked-bot
```

Install the dependencies:

```
npm i
```

Create a **`.env`** file in the root directory and set the environment variables:

```
DISCORD_BOT_TOKEN=token_here
```

Start the server:

```
node index.js
```

The API should now be running on **`http://localhost:3000`**.

## **Built With**

- **[Node.js](https://nodejs.org/)**
- **[Dotenv](https://github.com/motdotla/dotenv)**