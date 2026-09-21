# Game Design

**Pitch:** Explore a real city and observe a living ecosystem inside it. Not GTA, not Google Earth,
not photorealistic.

## Loop

Select city -> select area -> load stylized 3D area -> walk around -> watch animals live their lives
-> approach, inspect, follow -> day turns to night -> discover species.

## MVP scope

One city (Hyderabad), one ~1 km area, one player, five species (dog, cat, pigeon, monkey, squirrel),
buildings, roads, trees, third-person movement/camera, wandering + basic AI, player-animal
interaction, basic UI, basic day/night, deployment.

## Controls (desktop)

W/A/S/D move · Shift run · Space jump · E interact · Mouse camera · Esc pause.

## Animals

Attributes: id, species, position, rotation, speed, state, energy, hunger, curiosity, social,
target, animation state. Personality varies per individual around species defaults.

States: IDLE, WANDER, MOVE_TO_TARGET, EAT, DRINK, REST, SLEEP, FLEE, INVESTIGATE, FOLLOW, INTERACT.

Zone preferences (config-driven): dog park>sidewalk>residential; pigeon building>road>park;
monkey trees>park>residential; squirrel trees>park.
Activity: birds morning, cats evening/night, dogs day.

## Later (not in MVP)

Weather, discovery system, audio, mobile controls, vehicles, quests, saves, multiplayer.

## Player/animal interaction (implemented)

- Each species notices the player inside a detection radius. Sociable dogs tend to follow,
  curious cats/monkeys come to look from a safe distance, pigeons and squirrels ignore you until
  you get too close, then bolt. Running at animals scares everything; bold individuals tolerate more.
- Animals that have reacted lose interest for a while (no pestering).
- Press E within 5 m: panel with energy, hunger, mood, state and Observe / Follow / Interact.
  Interact succeeds for trusting individuals; shy ones retreat; sleeping ones are left alone.
- Follow: the camera tracks the animal until you press F or move.
