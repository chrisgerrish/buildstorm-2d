# Buildstorm 2D

A small browser game prototype inspired by the core loop of Fortnite.

You drop into a top-down battle royale match, collect loot, build cover, and try to survive the shrinking storm.

## What It Includes

- top-down movement and aiming
- a full match with bots
- a shrinking storm circle
- loot for ammo, healing, shields, materials, and weapon upgrades
- wall-building for quick cover
- sprinting and simple combat feedback

## Getting Started

This project does not need a build step or any external packages. It runs as a simple static website.

### 1. Open a terminal in the project folder

If you already cloned or downloaded the repo, move into that folder first.

### 2. Start a simple local web server

If you have Python installed, run:

```bash
python3 -m http.server 8000
```

### 3. Open the game in your browser

Go to:

```text
http://localhost:8000
```

If port `8000` is already in use, you can replace it with another number such as `8080`.

## Controls

- `W A S D`: move
- `Shift`: sprint
- `Mouse`: aim
- `Left click`: fire
- `R`: reload
- `F`: build wall
- `Enter`: start/restart match

## For Beginners

- `index.html` sets up the page structure
- `styles.css` controls the visual layout and styling
- `game.js` contains the game logic

If you want to experiment, `game.js` is the main place to start.
