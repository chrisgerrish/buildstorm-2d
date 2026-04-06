# Buildstorm 2D

Small browser game prototype inspired by Fortnite's core loop:

- top-down movement and aiming
- battle royale match with 11 bots
- shrinking storm circle
- loot for ammo, heals, shields, materials, and weapon upgrades
- quick wall-building for cover

## Run

Any static server works. For example:

```bash
cd /Users/chrisgerrish/repos/cash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- `W A S D`: move
- `Mouse`: aim
- `Left click`: fire
- `R`: reload
- `F`: build wall
- `Enter`: start/restart match

## Notes

This is a single-file canvas game with no build step or external dependencies, so it is easy to tweak in place.
