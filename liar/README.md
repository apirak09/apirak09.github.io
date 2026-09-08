# Liar Table

[Open the game](https://jack-liar-table.apirak.chatgpt.site) · [GitHub launch page](https://apirak09.github.io/liar/)

Classic Liar’s Deck card mode for 2–4 friends with room codes, invite links, private hands, persistent roulette risk, reconnect support, sound and responsive controls.

**Access status:** the hosted preview currently permits only the owner. Guest access is awaiting explicit approval. Friend-room functionality is implemented and tested but guests cannot open the hosted game until its access policy permits them.

All application source, locked dependencies, generated database migrations, and 15 automated checks are in [source/](source/). See [source/README.md](source/README.md) for rules, architecture, and the documented browser inactivity policy.

The launch page preserves `?room=ABC234` when opening the game. GitHub Pages hosts the launch page; the server and database run on Worker hosting.
